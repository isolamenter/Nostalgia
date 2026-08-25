/**
 * 全章节内容交叉引用测试（把关 loader 运行时的跨文件校验）。
 *
 * `check:data`（schemas.ts）只验证单文件 zod；而 loadCatalog 还有一套跨文件检查
 * （startMap/intro/next/物件引用/出口同章/provideArchive/speaker）。本测试把全量
 * 章节（ch1-ch4 + final）连同共享库一起加载，逐一复现这些检查，作为 CI 的补闸。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  archivesFileSchema,
  chapterFileSchema,
  charactersFileSchema,
  itemsFileSchema,
  mapsFileSchema,
} from '../schemas'
import type {
  ArchiveEntry,
  Character,
  ChapterData,
  InteractableDef,
  LocationDef,
} from '../types'
import { loadCatalog } from '../loaders'
import { buildChapterGraph } from '../../engine/dialogue/chapterGraph'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const readArr = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

type FullCatalog = {
  chapters: Map<string, ChapterData>
  characters: Map<string, Character>
  items: Map<string, InteractableDef>
  maps: Map<string, LocationDef>
  archives: Map<string, ArchiveEntry>
}

function loadPart(): FullCatalog {
  const storyDir = here('../story')
  const chapters = new Map<string, ChapterData>()
  for (const f of readdirSync(storyDir).filter((n) => n.endsWith('.json'))) {
    const ch = chapterFileSchema.parse(JSON.parse(readFileSync(join(storyDir, f), 'utf8')))
    if (chapters.has(ch.chapterId)) throw new Error(`重复章节 "${ch.chapterId}"`)
    chapters.set(ch.chapterId, ch)
  }
  const characters = charactersFileSchema.parse(readArr(here('../characters/characters.json')))
  const items = itemsFileSchema.parse(readArr(here('../items/objects.json')))
  const maps = mapsFileSchema.parse(readArr(here('../maps/maps.json')))
  const archives = archivesFileSchema.parse(readArr(here('../archives/archives.json')))
  return {
    chapters,
    characters: new Map(characters.map((c) => [c.id, c])),
    items: new Map(items.map((i) => [i.id, i])),
    maps: new Map(maps.map((m) => [m.id, m])),
    archives: new Map(archives.map((a) => [a.id, a])),
  }
}

describe('全章节内容交叉引用（loader 运行时校验的补闸）', () => {
  it('loadCatalog（真实 glob）解析全部章节与共享库（含其内部全套交叉校验）', async () => {
    // 生产加载路径：import.meta.glob + zod + 交叉引用检查，任一内容 bug 都会在此抛错
    const cat = await loadCatalog()
    expect([...cat.chapters.keys()].sort()).toEqual(['ch1', 'ch2', 'ch3', 'ch4', 'final'])
    expect(cat.maps.size).toBe(15)
    expect(cat.items.size).toBe(59)
    expect(cat.archives.size).toBe(26)
    expect(cat.characters.size).toBe(20)
  })

  it('章节链：ch1→ch2→ch3→ch4→final，头章为 ch1，无缺失/环', () => {
    const c = loadPart()
    const ids = [...c.chapters.keys()].sort()
    expect(ids).toEqual(['ch1', 'ch2', 'ch3', 'ch4', 'final'])
    expect(c.chapters.get('ch1')?.next).toBe('ch2')
    expect(c.chapters.get('ch2')?.next).toBe('ch3')
    expect(c.chapters.get('ch3')?.next).toBe('ch4')
    expect(c.chapters.get('ch4')?.next).toBe('final')
    expect(c.chapters.get('final')?.next).toBeUndefined()
    // 头章 = 不被任何 next 引用的章节，应恰为 ch1
    const referenced = new Set([...c.chapters.values()].map((x) => x.next).filter(Boolean))
    const heads = [...c.chapters.values()]
      .filter((x) => !referenced.has(x.chapterId))
      .map((x) => x.chapterId)
      .sort()
    expect(heads).toEqual(['ch1'])
  })

  it('每个章节：节点图完整、startMap/intro/next 合法', () => {
    const c = loadPart()
    for (const ch of c.chapters.values()) {
      const g = buildChapterGraph(ch) // 重复节点 id / 悬空 next 会在此抛错
      if (ch.startMap) expect(c.maps.has(ch.startMap), `${ch.chapterId}.startMap`).toBe(true)
      if (ch.intro) expect(g.byId.has(ch.intro.node), `${ch.chapterId}.intro.node`).toBe(true)
      if (ch.next) expect(c.chapters.has(ch.next), `${ch.chapterId}.next`).toBe(true)
    }
  })

  it('地图：出口存在且同章（防跨章断链）', () => {
    const c = loadPart()
    for (const map of c.maps.values()) {
      for (const exit of map.exits) {
        const t = c.maps.get(exit.to)
        expect(t, `${map.id}.exit.${exit.id}`).toBeTruthy()
        expect(t!.chapter, `${map.id}.exit.${exit.id} 跨章`).toBe(map.chapter)
      }
    }
  })

  it('物件/NPC：location 有效，节点引用指向本图所在章节，provideArchive 存在', () => {
    const c = loadPart()
    for (const item of c.items.values()) {
      const map = c.maps.get(item.location)
      expect(map, `${item.id}.location`).toBeTruthy()
      const ch = c.chapters.get(map!.chapter)
      if (!ch) continue // 章外地图不校验
      const g = buildChapterGraph(ch)
      for (const key of ['inspect', 'dialogue', 'unmetInspect'] as const) {
        const target = item[key]
        if (target) expect(g.byId.has(target), `${item.id}.${key} → ${target}`).toBe(true)
      }
      if (item.provideArchive) {
        expect(c.archives.has(item.provideArchive), `${item.id}.provideArchive`).toBe(true)
      }
    }
  })

  it('所有 speaker 均指向已注册角色（防主稿原始 id 漂移）', () => {
    const c = loadPart()
    for (const ch of c.chapters.values()) {
      const g = buildChapterGraph(ch)
      for (const node of g.byId.values()) {
        if (node.speaker) {
          expect(c.characters.has(node.speaker), `${node.id}.speaker=${node.speaker}`).toBe(true)
        }
      }
    }
  })

  it('物件 requirements 条件引用的档案均在库（hasArchive）', () => {
    const c = loadPart()
    const checkCondition = (cond: InteractableDef['requirements']): void => {
      if (!cond) return
      if ('all' in cond) return cond.all.forEach(checkCondition)
      if ('any' in cond) return cond.any.forEach(checkCondition)
      if ('not' in cond) return checkCondition(cond.not)
      if ('hasArchive' in cond) {
        expect(c.archives.has(cond.hasArchive), `requirements.hasArchive=${cond.hasArchive}`).toBe(true)
      }
    }
    for (const item of c.items.values()) checkCondition(item.requirements)
  })
})
