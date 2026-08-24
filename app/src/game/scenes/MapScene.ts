import Phaser from 'phaser';
import type { LocationDef } from '../../data/types';
import { bfs, type Point } from '../../engine/pathfinding/grid';
import { bus } from '../../bridge/bus';
import { useGameStore, DEFAULT_START_MAP } from '../../state/store';
import { GAME_HEIGHT, GAME_WIDTH, TILE, rgb } from '../constants';
import { drawDecor } from '../objects/Decor';
import { Player } from '../objects/Player';
import { Interactable } from '../objects/Interactable';

interface SceneData {
  mapId?: string;
  spawn?: { x: number; y: number };
}

/**
 * 通用数据驱动场景：地图骨架/碰撞/出口/交互全部由 maps.json + objects.json 描述。
 * 玩家探索 → 交互 → store 变化 → React 记录空间刷新，构成「异常循环」。
 */
export class MapScene extends Phaser.Scene {
  private mapId = '';
  private loc: LocationDef | null = null;
  private player: Player | null = null;
  private interactables: Interactable[] = [];
  private solidBodies: Phaser.GameObjects.Rectangle[] = [];
  private queuedInteract: Interactable | null = null;
  private transitioning = false;
  private eKey: Phaser.Input.Keyboard.Key | null = null;

  constructor() {
    super({ key: 'MapScene' });
  }

  init(data: SceneData): void {
    const st = useGameStore.getState();
    this.mapId = data.mapId ?? st.currentMap ?? DEFAULT_START_MAP;
    this.interactables = [];
    this.solidBodies = [];
    this.transitioning = false;
    this.queuedInteract = null;
  }

  create(data: SceneData): void {
    const st = useGameStore.getState();
    const loc = st.data.maps.get(this.mapId);
    if (!loc) {
      console.error(`[MapScene] 找不到地图 "${this.mapId}"`);
      this.add.text(20, 20, `地图数据缺失：${this.mapId}`, { color: '#ff7777' });
      return;
    }
    this.loc = loc;
    if (st.currentMap !== this.mapId) st.setMap(this.mapId);

    const mapW = loc.width * TILE;
    const mapH = loc.height * TILE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBackgroundColor(rgb(loc.bg.color));

    // 地面底色 + 档案网格 + 四角暗晕
    this.add.rectangle(mapW / 2, mapH / 2, mapW, mapH, rgb(loc.bg.color)).setDepth(-11);
    const accent = rgb(loc.bg.accent);
    const floorGrid = this.add.graphics().setDepth(-9);
    floorGrid.lineStyle(1, rgb('#8fafb0'), 0.055);
    for (let x = 0; x <= mapW; x += TILE) floorGrid.lineBetween(x, 0, x, mapH);
    for (let y = 0; y <= mapH; y += TILE) floorGrid.lineBetween(0, y, mapW, y);
    const vignette = (x: number, y: number, w: number, h: number, a: number) =>
      this.add
        .rectangle(x, y, mapW * w, mapH * h, accent)
        .setAlpha(a)
        .setDepth(-10);
    vignette(0, 0, 0.4, 0.4, 0.16);
    vignette(mapW, 0, 0.4, 0.4, 0.16);
    vignette(0, mapH, 0.4, 0.4, 0.16);
    vignette(mapW, mapH, 0.4, 0.4, 0.16);

    drawDecor(this, loc);

    // 实心碰撞：数据栅格 → 静态矩形
    for (const [gx, gy] of loc.solidTiles) {
      this.add
        .rectangle(
          (gx + 0.5) * TILE + 3,
          (gy + 0.5) * TILE + 4,
          TILE * 0.88,
          TILE * 0.88,
          rgb('#080d0e'),
          0.32,
        )
        .setDepth(0.8);
      const r = this.add
        .rectangle((gx + 0.5) * TILE, (gy + 0.5) * TILE, TILE * 0.88, TILE * 0.88, accent)
        .setOrigin(0.5)
        .setStrokeStyle(1, rgb('#8fafb0'), 0.12)
        .setDepth(1);
      this.physics.add.existing(r, true);
      this.solidBodies.push(r);
    }

    // 玩家（出生点：读档/切图 data.spawn 优先，否则用地图 spawn）
    const spawn = data.spawn ?? loc.spawn;
    this.player = new Player(this, (spawn.x + 0.5) * TILE, (spawn.y + 0.5) * TILE);
    st.movePlayerTile(spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.solidBodies);

    // 物件
    for (const itemId of loc.interactables) {
      const def = st.data.items.get(itemId);
      if (def && def.location === this.mapId) {
        this.interactables.push(new Interactable(this, def, this.player));
      }
    }

    // 出口可视化：可走的门洞 + 目标地图短名（「哪里能进下一张地图」的直接答案）
    for (const exit of loc.exits) {
      const target = st.data.maps.get(exit.to);
      const cx = (exit.x + exit.w / 2) * TILE;
      const cy = (exit.y + exit.h / 2) * TILE;
      const w = exit.w * TILE;
      const h = exit.h * TILE;
      this.add.rectangle(cx, cy, w, h, rgb('#8fafb0'), 0.08).setDepth(2);
      this.add
        .rectangle(cx, cy, w, h, rgb('#8fafb0'), 0)
        .setStrokeStyle(1.5, rgb('#8fafb0'), 0.62)
        .setDepth(2.1);
      const shortTarget = target?.name.split('·')[0]?.trim() ?? '出口';
      this.add
        .text(cx, cy, `${shortTarget} →`, {
          fontFamily: '"PingFang SC", sans-serif',
          fontSize: '13px',
          color: '#d0c8ae',
          backgroundColor: 'rgba(17,25,26,0.82)',
          padding: { x: 7, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(2.2);
    }

    this.eKey = this.input.keyboard?.addKey('E') ?? null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
      this.handlePointerDown(pointer),
    );

    // A4 纵向视窗：按地图高度选择克制的缩放，横向地图随玩家移动探索。
    const camera = this.cameras.main;
    const mapZoom = Phaser.Math.Clamp(GAME_HEIGHT / mapH, 0.92, 1.5);
    camera.setZoom(mapZoom);
    camera.startFollow(this.player.sprite, true, 0.09, 0.09);
    camera.setDeadzone(GAME_WIDTH * 0.2, GAME_HEIGHT * 0.24);
    camera.centerOn(this.player.x, this.player.y);
    camera.setRoundPixels(true);
    this.cameras.main.fadeIn(220, 0, 0, 0);

    // 本章开场：数据驱动（ChapterData.intro）——首次进入本章 startMap 自动展开散文
    const chapter = st.data.chapters.get(st.world.currentChapter);
    const intro = chapter?.intro;
    if (intro && chapter?.startMap === this.mapId && !st.world.flags[intro.flag]) {
      st.applyFlag(intro.flag, true);
      this.time.delayedCall(320, () => {
        if (useGameStore.getState().screen === 'game') {
          useGameStore.getState().openDialogue(intro.node);
        }
      });
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const st = useGameStore.getState();
    if (st.inputLocked || st.conv.active || !this.player || !this.loc) return;
    const wx = pointer.worldX;
    const wy = pointer.worldY;

    // 点击物件：范围内直接交互；否则走过去再自动交互
    const hitItem = this.interactables.find((it) => Math.hypot(it.x - wx, it.y - wy) < TILE * 0.8);
    if (hitItem) {
      const d = Math.hypot(hitItem.x - this.player.x, hitItem.y - this.player.y);
      if (d <= hitItem.def.interactRange * TILE) {
        hitItem.interact();
      } else {
        const path = bfs(this.loc, this.player.tile, hitItem.tileCenter);
        if (path) {
          this.player.setPath(path);
          this.queuedInteract = hitItem;
        }
      }
      return;
    }

    // 点击地面：寻路
    const tile: Point = { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
    const path = bfs(this.loc, this.player.tile, tile);
    if (path) {
      this.player.setPath(path);
      this.queuedInteract = null;
    }
  }

  override update(_time: number, delta: number): void {
    this.player?.update(delta);
    const st = useGameStore.getState();
    if (st.inputLocked || !this.player || !this.loc) return;

    // 邻近提示 + 高亮
    let near: Interactable | null = null;
    for (const it of this.interactables) {
      const n = it.tick();
      if (n) near = it;
    }
    this.interactables.forEach((it) => it.hideHint());
    near?.showHint();

    // E 键交互最近在范围内的物件
    if (this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      const target = this.interactables.find((it) => {
        const d = Math.hypot(it.x - this.player!.x, it.y - this.player!.y);
        return d <= it.def.interactRange * TILE;
      });
      if (target) target.interact();
    }

    // 寻路完成到达 → 自动交互
    if (this.queuedInteract && !this.player.following) {
      const item = this.queuedInteract;
      this.queuedInteract = null;
      const d = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (d <= item.def.interactRange * TILE + 6) item.interact();
    }

    // 出口检测（栅格级）
    const t = this.player.tile;
    if (!this.transitioning) {
      for (const e of this.loc.exits) {
        if (t.x >= e.x && t.x < e.x + e.w && t.y >= e.y && t.y < e.y + e.h) {
          this.beginExit(e.to);
          break;
        }
      }
    }
  }

  private beginExit(to: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const from = this.mapId;
    // 先落地地图变更，使 bridge 的 scene:change 自动存档写入正确地图
    useGameStore.getState().setMap(to);
    bus.emit('scene:change', { from, to });
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const target = useGameStore.getState().data.maps.get(to);
      const spawn = target?.spawn ?? { x: 6, y: 12 };
      this.scene.restart({ mapId: to, spawn: { x: spawn.x, y: spawn.y } });
    });
    this.cameras.main.fadeOut(180, 16, 22, 22);
  }
}
