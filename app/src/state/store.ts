/**
 * 统一世界状态（zustand 单 store）。
 * Phaser 帧内只读 getState()，React 用 selector 订阅；一切变异走 action，
 * 事件经 bus 广播——单一事实源，无双向同步环。
 */
import { create } from 'zustand';
import type {
  ArchiveStatus,
  ConvState,
  FlagChange,
  FlagValue,
  InventoryItem,
  PanelId,
  WorldState,
} from '../data/types';
import { createEmptyConv } from '../data/types';
import type { DataCatalog } from '../data/loaders';
import type { ChapterData } from '../data/types';
import { recordChoice as applyRecordChoice, setFlag } from '../engine/world';
import { archiveStatusFlag, parseArchiveStatusFlag } from '../engine/constants';
import { canTransition } from '../engine/archive/archiveMachine';
import { buildChapterGraph, type ChapterGraph } from '../engine/dialogue/chapterGraph';
import { chooseFromGraph, enterGraph, modeOf } from '../engine/dialogue/runner';
import type { Follow } from '../engine/dialogue/runner';
import { buildSaveData, parseSaveData, serializeSaveData } from '../engine/save/serializer';
import {
  bakKey,
  browserStorage,
  deleteSlot as storageDelete,
  listSlots,
  readSlotRaw,
  writeSlot,
  type KVStorage,
  type SlotId,
  type SlotMeta,
} from '../engine/save/storage';
import { bus } from '../bridge/bus';

export const DEFAULT_START_MAP = 'ch1.maps.home';
export const DEFAULT_START_POS = { x: 8, y: 13 };

// conv.pending 形态
type ConvPending = { type: 'node'; id: string } | { type: 'end' };

export interface GameStore {
  // ---- data slice ----
  data: DataCatalog;
  setData: (catalog: DataCatalog) => void;

  // ---- world slice ----
  world: WorldState;
  applyFlag: (flag: string, value: FlagValue) => void;
  applyFlagChanges: (changes: FlagChange[]) => void;
  discoverArchive: (id: string, fromItem?: string) => void;
  setArchiveStatus: (id: string, status: ArchiveStatus) => boolean;
  recordChoice: (nodeId: string, choiceId: string) => void;
  setEnding: (key: string, value: boolean) => void;
  setPending: (key: string, value: FlagValue) => void;

  // ---- 相位 ----
  screen: 'title' | 'game';
  startGame: () => void;

  // ---- session slice ----
  currentMap: string | null;
  playerTile: { x: number; y: number };
  interacted: string[];
  inventory: InventoryItem[];
  onceNodes: string[];
  inputLocked: boolean;
  panel: PanelId | null;
  conv: ConvState;
  toast: { id: number; message: string } | null;
  pendingNav: { mapId: string; x: number; y: number; version: number } | null;
  playTimeSec: number;
  slots: SlotMeta[];

  setMap: (mapId: string | null) => void;
  movePlayerTile: (x: number, y: number) => void;
  markInteracted: (id: string) => void;
  addToInventory: (id: string, count?: number) => void;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  requestNav: (mapId: string, x: number, y: number) => void;
  newGame: () => void;
  /** 框架扩展：从当前章推进到下一章（保留世界状态，重置会话相位） */
  advanceToChapter: (nextId: string) => void;

  // ---- dialogue ----
  openDialogue: (nodeId: string) => void;
  presentNode: (nodeId: string) => void;
  advance: () => void;
  choose: (choiceId: string) => void;
  finishConversation: () => void;

  // ---- save slice ----
  autosave: () => void;
  saveToSlot: (id: SlotId) => void;
  loadFromSlot: (id: SlotId) => boolean;
  deleteSlot: (id: SlotId) => void;
  refreshSlots: () => void;
}

const graphCache = new WeakMap<ChapterData, ChapterGraph>();

function ensureGraph(data: DataCatalog, chapterId: string): ChapterGraph {
  const chapter = data.chapters.get(chapterId);
  if (!chapter) throw new Error(`找不到章节 "${chapterId}"`);
  let graph = graphCache.get(chapter);
  if (!graph) {
    graph = buildChapterGraph(chapter);
    graphCache.set(chapter, graph);
  }
  return graph;
}

function followToPending(follow: Follow): ConvPending | null {
  if (follow.type === 'end') return { type: 'end' };
  if (follow.type === 'node') return { type: 'node', id: follow.id };
  return null;
}

function freshWorld(chapterId: string): WorldState {
  return {
    schemaVersion: 1,
    currentChapter: chapterId,
    discoveredArchives: {},
    relations: {},
    choices: {},
    choiceLog: [],
    endings: {},
    flags: {},
    pending: {},
  };
}

/**
 * 头章推导（框架扩展·多章节）：未被任何章节 `next` 引用的章节即章节链的入口。
 * 数据驱动，避免硬编码章节 id；多入口（内容并联）时按 chapterId 取首个做起点。
 */
function headChapterId(data: DataCatalog): string {
  const referenced = new Set<string>();
  for (const c of data.chapters.values()) if (c.next) referenced.add(c.next);
  const head = [...data.chapters.values()]
    .filter((c) => !referenced.has(c.chapterId))
    .sort((a, b) => a.chapterId.localeCompare(b.chapterId))[0];
  return head?.chapterId ?? 'ch1';
}

/** 章节起点：startMap id + 该地图出生点（缺省兜底常量） */
function chapterStart(
  data: DataCatalog,
  chapterId: string,
): { mapId: string; spawn: { x: number; y: number } } {
  const mapId = data.chapters.get(chapterId)?.startMap ?? DEFAULT_START_MAP;
  const spawn = data.maps.get(mapId)?.spawn ?? DEFAULT_START_POS;
  return { mapId, spawn: { x: spawn.x, y: spawn.y } };
}

/**
 * 解析全新周目的起点（框架扩展·多章节）：头章 + 其 startMap + 出生点。
 * 供 store.newGame 与 BootstrapScene 兜底共用，避免头章推导逻辑分叉。
 */
export function resolvePlaythroughStart(
  data: DataCatalog,
): { chapterId: string; mapId: string; spawn: { x: number; y: number } } {
  const chapterId = headChapterId(data);
  const { mapId, spawn } = chapterStart(data, chapterId);
  return { chapterId, mapId, spawn };
}

let toastSeq = 0;

export function createGameStore(storage: KVStorage = browserStorage) {
  return create<GameStore>()((set, get) => {
    let playStart = Date.now();

    const doSave = (id: SlotId): void => {
      const s = get();
      const playTimeSec = Math.round((Date.now() - playStart) / 1000) + s.playTimeSec;
      const save = buildSaveData(
        s.world,
        {
          currentChapter: s.world.currentChapter,
          currentMap: s.currentMap ?? DEFAULT_START_MAP,
          playerX: s.playerTile.x,
          playerY: s.playerTile.y,
        },
        playTimeSec,
        Date.now(),
      );
      writeSlot(storage, id, serializeSaveData(save), Date.now());
      set({ slots: listSlots(storage), playTimeSec });
      bus.emit('world:autosaved', { slotId: id });
    };

    return {
      // ---------------- data ----------------
      data: {
        chapters: new Map(),
        characters: new Map(),
        items: new Map(),
        maps: new Map(),
        archives: new Map(),
      },
      setData(catalog) {
        set({ data: catalog });
      },

      // ---------------- world ----------------
      world: freshWorld('ch1'),
      applyFlag(flag, value) {
        const archiveId = parseArchiveStatusFlag(flag);
        if (archiveId) {
          get().setArchiveStatus(archiveId, value as ArchiveStatus);
          return;
        }
        set((s) => ({ world: setFlag(s.world, flag, value) }));
        bus.emit('world:flagChanged', { flag, value });
      },
      applyFlagChanges(changes) {
        for (const c of changes) get().applyFlag(c.flag, c.value);
      },
      discoverArchive(id, fromItem) {
        const w = get().world;
        if (w.discoveredArchives[id]) return;
        set((s) => ({
          world: {
            ...s.world,
            flags: { ...s.world.flags, [archiveStatusFlag(id)]: 'pending' },
            discoveredArchives: {
              ...s.world.discoveredArchives,
              [id]: { status: 'pending', discoveredAt: Date.now() },
            },
          },
        }));
        bus.emit('world:archiveDiscovered', { archiveId: id, fromItem });
      },
      setArchiveStatus(id, status) {
        const w = get().world;
        const existing = w.discoveredArchives[id];
        if (existing && existing.status === status) return false;
        if (existing && !canTransition(existing.status, status)) return false;
        set((s) => ({
          world: {
            ...s.world,
            flags: { ...s.world.flags, [archiveStatusFlag(id)]: status },
            discoveredArchives: existing
              ? {
                  ...s.world.discoveredArchives,
                  [id]: { status, discoveredAt: existing.discoveredAt },
                }
              : s.world.discoveredArchives,
          },
        }));
        bus.emit('world:archiveStatusChanged', { archiveId: id, status });
        return true;
      },
      recordChoice(nodeId, choiceId) {
        set((s) => ({ world: applyRecordChoice(s.world, nodeId, choiceId, Date.now()) }));
        bus.emit('world:choiceMade', { nodeId, choiceId });
      },
      setEnding(key, value) {
        set((s) => ({ world: { ...s.world, endings: { ...s.world.endings, [key]: value } } }));
      },
      setPending(key, value) {
        set((s) => ({
          world: { ...s.world, pending: { ...s.world.pending, [key]: { value, at: Date.now() } } },
        }));
      },

      // ---------------- 相位 ----------------
      screen: 'title',
      startGame() {
        set({ screen: 'game' });
      },

      // ---------------- session ----------------
      currentMap: null,
      playerTile: { ...DEFAULT_START_POS },
      interacted: [],
      inventory: [],
      onceNodes: [],
      inputLocked: false,
      panel: null,
      conv: createEmptyConv(),
      toast: null,
      pendingNav: null,
      playTimeSec: 0,
      slots: [],

      setMap(mapId) {
        set({ currentMap: mapId });
      },
      movePlayerTile(x, y) {
        set({ playerTile: { x, y } });
      },
      markInteracted(id) {
        set((s) => (s.interacted.includes(id) ? {} : { interacted: [...s.interacted, id] }));
      },
      addToInventory(id, count = 1) {
        set((s) => {
          const prev = s.inventory.find((i) => i.id === id);
          if (prev) {
            return {
              inventory: s.inventory.map((i) =>
                i.id === id ? { ...i, count: i.count + count } : i,
              ),
            };
          }
          return { inventory: [...s.inventory, { id, count }] };
        });
      },
      openPanel(panel) {
        set({ panel, inputLocked: true });
      },
      closePanel() {
        set((s) => ({ panel: null, inputLocked: s.conv.active }));
      },
      togglePanel(panel) {
        set((s) => {
          if (s.panel === panel) return { panel: null, inputLocked: s.conv.active };
          return { panel, inputLocked: true };
        });
      },
      showToast(message) {
        set({ toast: { id: ++toastSeq, message } });
      },
      clearToast() {
        set({ toast: null });
      },
      requestNav(mapId, x, y) {
        set((s) => ({
          pendingNav: { mapId, x, y, version: (s.pendingNav?.version ?? 0) + 1 },
        }));
      },
      newGame() {
        // 头章数据驱动（不被任何 next 引用者），起始地图取该章 startMap（内容驱动）
        const { chapterId: first, mapId, spawn } = resolvePlaythroughStart(get().data);
        set({
          screen: 'game',
          world: freshWorld(first),
          currentMap: mapId,
          playerTile: { ...spawn },
          interacted: [],
          inventory: [],
          onceNodes: [],
          inputLocked: false,
          panel: null,
          conv: createEmptyConv(),
          toast: null,
        });
        get().requestNav(mapId, spawn.x, spawn.y);
      },
      advanceToChapter(nextId) {
        const s = get();
        const data = s.data;
        if (!data.chapters.get(nextId)) {
          console.error(`[store] advanceToChapter 指向不存在的章节 "${nextId}"`);
          return;
        }
        const { mapId, spawn } = chapterStart(data, nextId);
        // 状态继承：仅推进 currentChapter，保留 world（档案/flag/选择/结局随周目累加）
        set({
          world: { ...s.world, currentChapter: nextId },
          currentMap: mapId,
          playerTile: { ...spawn },
          interacted: [],
          inventory: [],
          onceNodes: [],
          inputLocked: false,
          panel: null,
          conv: createEmptyConv(),
          toast: null,
        });
        bus.emit('chapter:advance', { to: nextId });
        get().requestNav(mapId, spawn.x, spawn.y);
      },

      // ---------------- dialogue ----------------
      openDialogue(nodeId) {
        const s = get();
        if (s.conv.active) return;
        const graph = ensureGraph(s.data, s.world.currentChapter);
        const result = enterGraph(graph, nodeId, s.world);
        if (result.flagsToApply.length) get().applyFlagChanges(result.flagsToApply);
        set({
          conv: {
            active: true,
            entryNode: nodeId,
            currentNode: nodeId,
            pending: followToPending(result.follow),
            showingChoices: result.follow.type === 'await-choice',
            history: [
              ...s.conv.history,
              {
                kind: modeOf(result.node) === 'prose' ? 'prose' : 'speech',
                text: result.node.text,
                speaker: result.node.speaker,
                at: Date.now(),
              },
            ],
          },
          inputLocked: true,
        });
        bus.emit('dialog:start', { nodeId });
      },
      presentNode(nodeId) {
        const s = get();
        if (!s.conv.active) return;
        const graph = ensureGraph(s.data, s.world.currentChapter);

        // 一次性节点守护：已消费过 → 沿后继前进，不重复展示
        let target = nodeId;
        for (;;) {
          const node = graph.byId.get(target);
          if (!node) break;
          if (!node.once || !s.onceNodes.includes(target)) break;
          const result = enterGraph(graph, target, s.world);
          if (result.follow.type === 'end') {
            get().finishConversation();
            return;
          }
          if (result.follow.type !== 'node') break;
          target = result.follow.id;
        }

        const result = enterGraph(graph, target, s.world);
        if (result.node.once) {
          set((st) => ({
            onceNodes: [...st.onceNodes, target].filter((v, i, a) => a.indexOf(v) === i),
          }));
        }
        if (result.flagsToApply.length) get().applyFlagChanges(result.flagsToApply);
        set((st) => ({
          conv: {
            ...st.conv,
            currentNode: target,
            pending: followToPending(result.follow),
            showingChoices: result.follow.type === 'await-choice',
            history: [
              ...st.conv.history,
              {
                kind: modeOf(result.node) === 'prose' ? 'prose' : 'speech',
                text: result.node.text,
                speaker: result.node.speaker,
                at: Date.now(),
              },
            ],
          },
        }));
      },
      advance() {
        const s = get();
        if (!s.conv.active || s.conv.showingChoices) return;
        const p = s.conv.pending;
        if (!p) return;
        if (p.type === 'node') get().presentNode(p.id);
        else get().finishConversation();
      },
      choose(choiceId) {
        const s = get();
        if (!s.conv.active || !s.conv.currentNode || !s.conv.showingChoices) return;
        const graph = ensureGraph(s.data, s.world.currentChapter);
        const result = chooseFromGraph(graph, s.conv.currentNode, choiceId, s.world);
        set((st) => ({
          conv: {
            ...st.conv,
            showingChoices: false,
            pending: followToPending(result.follow),
            history: [
              ...st.conv.history,
              { kind: 'choice', text: result.choice.text, at: Date.now() },
            ],
          },
        }));
        get().recordChoice(s.conv.currentNode, choiceId);
        if (result.flagsToApply.length) get().applyFlagChanges(result.flagsToApply);
        if (result.follow.type === 'node') get().presentNode(result.follow.id);
        else get().finishConversation();
      },
      finishConversation() {
        const s = get();
        if (!s.conv.active) return;
        const lastNode = s.conv.currentNode;
        set((st) => ({ conv: createEmptyConv(), inputLocked: st.panel !== null }));
        bus.emit('dialog:end', { nextNodeId: lastNode });
        doSave('autosave');
      },

      // ---------------- save ----------------
      autosave() {
        doSave('autosave');
      },
      saveToSlot(id) {
        doSave(id);
      },
      loadFromSlot(id) {
        const raw = readSlotRaw(storage, id);
        if (raw === null) return false;
        let save: ReturnType<typeof parseSaveData>;
        try {
          save = parseSaveData(raw);
        } catch {
          const bak = storage.getItem(bakKey(id));
          if (bak === null) return false;
          try {
            save = parseSaveData(bak);
          } catch {
            return false;
          }
        }
        const prev = get().currentMap;
        set({
          screen: 'game',
          world: save.world,
          currentMap: save.resume.currentMap,
          playerTile: { x: save.resume.playerX, y: save.resume.playerY },
          interacted: [],
          inventory: [],
          onceNodes: [],
          inputLocked: false,
          panel: null,
          conv: createEmptyConv(),
          playTimeSec: save.playTimeSec,
          pendingNav: {
            mapId: save.resume.currentMap,
            x: save.resume.playerX,
            y: save.resume.playerY,
            version: Date.now(),
          },
        });
        playStart = Date.now();
        bus.emit('scene:change', { from: prev, to: save.resume.currentMap });
        return true;
      },
      deleteSlot(id) {
        storageDelete(storage, id);
        set({ slots: listSlots(storage) });
      },
      refreshSlots() {
        set({ slots: listSlots(storage) });
      },
    };
  });
}

export const useGameStore = createGameStore();
