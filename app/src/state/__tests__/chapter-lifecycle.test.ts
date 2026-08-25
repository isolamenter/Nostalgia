/**
 * 章节生命周期（框架扩展·多章节）测试：
 *  - 头章推导：全新周目从不被任何章节 `next` 引用的章节开始（数据驱动，不硬编码 id）
 *  - advanceToChapter：保留 world（状态继承）只重置会话相位，进入下一章 startMap
 *  - next 指向不存在章节 → 无副作用（当前章不变）
 *  - 第一章 settlement 数据已下沉：triggerFlag/endingFlag/三结局定义齐全
 * 这些是 store 层状态不变量，不与 Phaser/React 渲染耦合。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  archivesFileSchema,
  chapterFileSchema,
  charactersFileSchema,
  itemsFileSchema,
  mapsFileSchema,
} from '../../data/schemas'
import type { ChapterData, LocationDef } from '../../data/types'
import type { DataCatalog } from '../../data/loaders'
import { createGameStore, resolvePlaythroughStart } from '../store'
import { MemoryStorage } from '../../engine/save/storage'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const readJson = <T>(p: string): T => JSON.parse(readFileSync(here(p), 'utf8')) as T

/** 合成第二章：最小可流通，指向一个合成地图，便于确认会话相位被重置到「下一章起点」 */
const CH2: ChapterData = {
  chapterId: 'ch2',
  title: '照旧',
  startMap: 'ch2.maps.stub',
  nodes: [{ id: 'ch2.intro.1', mode: 'prose', text: '照旧。', next: '$END' }],
  settlement: {
    docket: '青潭县档案馆 / 章节归档',
    number: 'QT-02-002',
    kicker: '第二章终局 · 一页档案落定',
    theme: '维护无法证明存在的人。',
    triggerFlag: 'ch2.chapter.end',
    endingFlag: 'ch2.ending',
    defaultEnding: 'held',
    endings: { retained: { title: 'r', lines: ['r1'] }, held: { title: 'h', lines: ['h1'] } },
  },
}

const MAP2: LocationDef = {
  id: 'ch2.maps.stub',
  name: '修鞋铺 · 青梧街',
  chapter: 'ch2',
  width: 4,
  height: 4,
  solidTiles: [],
  spawn: { x: 1, y: 1 },
  decorate: [],
  exits: [],
  interactables: [],
  bg: { color: '#111111', accent: '#222222' },
}

/** 第一章外加一条章节链（ch1.next → ch2）+ 合成第二章与地图 */
function mkChainCatalog(): DataCatalog {
  const ch1 = chapterFileSchema.parse(readJson('../../data/story/chapter01.json'))
  const items = itemsFileSchema.parse(readJson('../../data/items/objects.json'))
  const maps = mapsFileSchema.parse(readJson('../../data/maps/maps.json'))
  const archives = archivesFileSchema.parse(readJson('../../data/archives/archives.json'))
  const ch1Linked: ChapterData = { ...ch1, next: 'ch2' }
  return {
    chapters: new Map<string, ChapterData>([
      [ch1Linked.chapterId, ch1Linked],
      [CH2.chapterId, CH2],
    ]),
    characters: new Map(),
    items: new Map(items.map((i): [string, (typeof items)[number]] => [i.id, i])),
    maps: new Map<string, LocationDef>([
      ...maps.map((m): [string, LocationDef] => [m.id, m]),
      [MAP2.id, MAP2],
    ]),
    archives: new Map(archives.map((a): [string, (typeof archives)[number]] => [a.id, a])),
  }
}

/** 读取全部真实章节 + 共享库（用于真实章节链推进测试） */
function mkFullCatalog(): DataCatalog {
  const storyDir = here('../../data/story')
  const chapters = new Map<string, ChapterData>()
  for (const f of readdirSync(storyDir).filter((n) => n.endsWith('.json'))) {
    const ch = chapterFileSchema.parse(JSON.parse(readFileSync(join(storyDir, f), 'utf8')))
    chapters.set(ch.chapterId, ch)
  }
  const characters = charactersFileSchema.parse(readJson('../../data/characters/characters.json'))
  const items = itemsFileSchema.parse(readJson('../../data/items/objects.json'))
  const maps = mapsFileSchema.parse(readJson('../../data/maps/maps.json'))
  const archives = archivesFileSchema.parse(readJson('../../data/archives/archives.json'))
  return {
    chapters,
    characters: new Map(characters.map((c): [string, (typeof characters)[number]] => [c.id, c])),
    items: new Map(items.map((i): [string, (typeof items)[number]] => [i.id, i])),
    maps: new Map<string, LocationDef>(maps.map((m): [string, LocationDef] => [m.id, m])),
    archives: new Map(archives.map((a): [string, (typeof archives)[number]] => [a.id, a])),
  }
}

describe('章节生命周期（多章节）', () => {
  it('真实章节链：newGame→ch1，advanceToChapter 逐章到 final，currentMap 与状态继承正确', () => {
    const store = createGameStore(new MemoryStorage())
    store.setState({ data: mkFullCatalog() })
    store.getState().newGame()
    expect(store.getState().world.currentChapter).toBe('ch1')

    // 状态继承验证：ch1 阶段埋一个 flag，应一路保留到 final
    store.getState().applyFlag('e2e.marker', true)

    const seen: string[] = []
    for (const next of ['ch2', 'ch3', 'ch4', 'final'] as const) {
      store.getState().advanceToChapter(next)
      const s = store.getState()
      seen.push(s.world.currentChapter)
      expect(s.currentMap).toBe(s.data.chapters.get(next)?.startMap)
    }
    expect(seen).toEqual(['ch2', 'ch3', 'ch4', 'final'])
    expect(store.getState().world.flags['e2e.marker']).toBe(true) // 状态继承
  })

  it('头章推导：从不被其他章节 next 引用的章节开始（数据驱动）', () => {
    const catalog = mkChainCatalog()
    const start = resolvePlaythroughStart(catalog)
    expect(start.chapterId).toBe('ch1')
    expect(start.mapId).toBe('ch1.maps.home')

    const store = createGameStore(new MemoryStorage())
    store.setState({ data: catalog })
    store.getState().newGame()
    expect(store.getState().world.currentChapter).toBe('ch1')
    expect(store.getState().currentMap).toBe('ch1.maps.home')
  })

  it('advanceToChapter：保留 world（状态继承）只重置会话相位，进入下一章起点', () => {
    const catalog = mkChainCatalog()
    const store = createGameStore(new MemoryStorage())
    store.setState({ data: catalog })
    store.getState().newGame()

    // 先累积一条档案，验证跨章节不变
    store.getState().discoverArchive('ch1.archive.signal')
    expect(store.getState().world.discoveredArchives['ch1.archive.signal']?.status).toBe('pending')

    store.getState().advanceToChapter('ch2')
    const s = store.getState()
    expect(s.world.currentChapter).toBe('ch2') // 章节前进
    expect(s.world.discoveredArchives['ch1.archive.signal']?.status).toBe('pending') // 世界保留
    expect(s.currentMap).toBe('ch2.maps.stub') // 相位切到下一章起点
    expect(s.inventory).toEqual([]) // 会话重置
    expect(s.interacted).toEqual([])
    expect(s.onceNodes).toEqual([])
    expect(s.pendingNav?.mapId).toBe('ch2.maps.stub')
  })

  it('next 指向不存在的章节：无副作用（当前章不变）', () => {
    const catalog = mkChainCatalog()
    const store = createGameStore(new MemoryStorage())
    store.setState({ data: catalog })
    store.getState().newGame()
    const worldBefore = store.getState().world

    store.getState().advanceToChapter('ch99')
    const s = store.getState()
    expect(s.world.currentChapter).toBe('ch1')
    expect(s.world).toBe(worldBefore) // 未发生任何写
  })

  it('第一章结算数据已下沉：triggerFlag/endingFlag/三结局定义齐全', () => {
    const ch1 = chapterFileSchema.parse(readJson('../../data/story/chapter01.json'))
    expect(ch1.settlement).toBeTruthy()
    expect(ch1.settlement?.triggerFlag).toBe('ch1.chapter.end')
    expect(ch1.settlement?.endingFlag).toBe('ch1.ending')
    for (const key of ['retained', 'held', 'discarded'] as const) {
      expect(ch1.settlement?.endings[key]).toBeTruthy()
    }
  })
})
