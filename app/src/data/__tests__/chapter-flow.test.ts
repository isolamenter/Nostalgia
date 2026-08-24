/**
 * 第一章《第二份》内容闭环测试：
 *  - 类型/交叉引用软规则：物件 inspect/dialogue/unmetInspect 指向的节点必须存在于章内，
 *    provideArchive 指向的档案必须存在，chapter.startMap / intro.node 合法。
 *  - 端到端通关模拟：用真实 store（MemoryStorage）跑一遍——发现四份异常记录 →
 *    进入完整饭桌事件 → 终局三选一 → 断言档案状态机联动 + ch1.chapter.end 触发结算。
 * 这些是 check:data（zod strict）拦不住的软规则，在此补闸。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chapterFileSchema, itemsFileSchema, mapsFileSchema, archivesFileSchema } from '../schemas'
import type { ChapterData, InteractableDef } from '../types'
import type { DataCatalog } from '../loaders'
import { buildChapterGraph } from '../../engine/dialogue/chapterGraph'
import { evalCondition } from '../../engine/dialogue/conditions'
import { createGameStore } from '../../state/store'
import { MemoryStorage } from '../../engine/save/storage'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const readJson = <T>(p: string): T => JSON.parse(readFileSync(here(p), 'utf8')) as T

const ANOMALIES = [
  'ch1.archive.signal',
  'ch1.archive.ledger',
  'ch1.archive.distribution',
  'ch1.archive.transfer',
]

function mkCatalog(): DataCatalog {
  const chapter = readJson<unknown>('../story/chapter01.json')
  const parsed = chapterFileSchema.parse(chapter) as ChapterData
  const items = itemsFileSchema.parse(readJson('../items/objects.json'))
  const maps = mapsFileSchema.parse(readJson('../maps/maps.json'))
  const archives = archivesFileSchema.parse(readJson('../archives/archives.json'))
  return {
    chapters: new Map([[parsed.chapterId, parsed]]),
    characters: new Map(),
    items: new Map(items.map((i) => [i.id, i])),
    maps: new Map(maps.map((m) => [m.id, m])),
    archives: new Map(archives.map((a) => [a.id, a])),
  }
}

describe('第一章《第二份》内容闭环', () => {
  it('章内引用全部可解析（节点 / 档案 / 起始地图 / 开场）', () => {
    const catalog = mkCatalog()
    const chapter = catalog.chapters.get('ch1')!
    const graph = buildChapterGraph(chapter) // 重复 id / 悬空 next 会在此抛错

    // 开场字段
    expect(catalog.maps.has(chapter.startMap!)).toBe(true)
    expect(graph.byId.has(chapter.intro!.node)).toBe(true)

    // 每个物件引用到的节点 / 档案
    for (const item of catalog.items.values()) {
      for (const key of ['inspect', 'dialogue', 'unmetInspect'] as const) {
        const target = item[key]
        if (target) expect(graph.byId.has(target), `${item.id}.${key} → ${target}`).toBe(true)
      }
      if (item.provideArchive) {
        expect(catalog.archives.has(item.provideArchive), `${item.id}.provideArchive`).toBe(true)
      }
    }
  })

  it('母亲 NPC 门禁：收齐四份异常记录后才解锁完整饭桌事件', () => {
    const catalog = mkCatalog()
    const ma = catalog.items.get('ch1.object.ma') as InteractableDef
    expect(ma.requirements).toBeTruthy()

    // 未收齐 → 门禁不满足（走 unmetInspect）
    const store = createGameStore(new MemoryStorage())
    store.setState({ data: catalog })
    store.getState().discoverArchive('ch1.archive.signal')
    expect(store.getState().world.flags['archive.ch1.archive.signal.status']).toBe('pending')

    // 收齐 → 门禁满足
    const store2 = createGameStore(new MemoryStorage())
    store2.setState({ data: catalog })
    for (const id of ANOMALIES) store2.getState().discoverArchive(id)
    expect(evalCondition(ma.requirements!, { world: store2.getState().world, currentChapter: 'ch1' })).toBe(
      true,
    )
  })

  it('端到端通关：三选一终局均可走通 → 档案状态机 + 结算 flag', () => {
    // retained（保留）/ held（悬置）/ discarded（移出）三路各跑一遍
    for (const [choiceId, status, ending] of [
      ['choose.retained', 'retained', 'retained'],
      ['choose.held', 'held', 'held'],
      ['choose.discarded', 'discarded', 'discarded'],
    ] as const) {
      const catalog = mkCatalog()
      const store = createGameStore(new MemoryStorage())
      store.setState({ data: catalog })

      // 发现四份异常记录（均可从物件提供）
      for (const id of ANOMALIES) {
        store.getState().discoverArchive(id)
        expect(store.getState().world.discoveredArchives[id]?.status).toBe('pending')
      }

      // 进入完整饭桌事件
      store.getState().openDialogue('ch1.event.dinner.1')
      expect(store.getState().conv.active).toBe(true)

      // 沿散文链推进；在终局三选一处选本路选项
      for (let guard = 0; guard < 40; guard++) {
        const s = store.getState()
        if (!s.conv.active) break
        if (s.conv.showingChoices) {
          s.choose(choiceId)
          break
        }
        s.advance()
      }

      // 结算触发 target + 状态机联动
      const w = store.getState().world
      expect(w.flags['ch1.chapter.end']).toBe(true)
      expect(w.flags['ch1.ending']).toBe(ending)
      for (const id of ANOMALIES) {
        expect(w.discoveredArchives[id]?.status).toBe(status)
        expect(w.flags[`archive.${id}.status`]).toBe(status)
      }
    }
  })
})