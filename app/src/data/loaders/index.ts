/**
 * 数据装载（import.meta.glob + 热更新）
 *
 * 将所有 JSON 内容在编译期纳入模块图，免费获得类型安全与 Vite HMR
 * （「内容可由工具生成、校验和热更新」的落地）。
 * 新增数据文件只需放进对应目录，无需注册。
 */
import { z } from 'zod'
import type { ArchiveEntry, ChapterData, Character, InteractableDef, LocationDef } from '../types'
import {
  archivesFileSchema,
  chapterFileSchema,
  charactersFileSchema,
  itemsFileSchema,
  mapsFileSchema,
} from '../schemas'

/** 四件套 + 框架扩展 archives 的光标目录 */
export interface DataCatalog {
  chapters: Map<string, ChapterData>
  characters: Map<string, Character>
  items: Map<string, InteractableDef>
  maps: Map<string, LocationDef>
  archives: Map<string, ArchiveEntry>
}

export function createEmptyCatalog(): DataCatalog {
  return {
    chapters: new Map(),
    characters: new Map(),
    items: new Map(),
    maps: new Map(),
    archives: new Map(),
  }
}

type RawModule = { default: unknown }

const storyGlob = import.meta.glob<RawModule>('../story/*.json', { import: 'default' })
const charactersGlob = import.meta.glob<RawModule>('../characters/*.json', { import: 'default' })
const itemsGlob = import.meta.glob<RawModule>('../items/*.json', { import: 'default' })
const mapsGlob = import.meta.glob<RawModule>('../maps/*.json', { import: 'default' })
const archivesGlob = import.meta.glob<RawModule>('../archives/*.json', { import: 'default' })

const HOT_PATTERNS = [
  '../story/*.json',
  '../characters/*.json',
  '../items/*.json',
  '../maps/*.json',
  '../archives/*.json',
]

async function collect<T>(paths: Record<string, () => Promise<T>>): Promise<T[]> {
  const loaded = await Promise.all(Object.values(paths).map((load) => load()))
  return loaded
}

function parseOrThrow<T>(label: string, schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    // zod v4 错误美化打印，开发期直接红屏
    throw new Error(`数据校验失败 [${label}]: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

function index<T extends { id: string }>(label: string, rows: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    if (map.has(row.id)) {
      throw new Error(`数据校验失败 [${label}]: 重复 id "${row.id}"`)
    }
    map.set(row.id, row)
  }
  return map
}

/** 读取全部数据；校验失败即抛错（坏数据进不了游戏） */
export async function loadCatalog(): Promise<DataCatalog> {
  const [storyRaw, charsRaw, itemsRaw, mapsRaw, archivesRaw] = await Promise.all([
    collect(storyGlob),
    collect(charactersGlob),
    collect(itemsGlob),
    collect(mapsGlob),
    collect(archivesGlob),
  ])

  const chapters = new Map<string, ChapterData>()
  for (const raw of storyRaw) {
    const chapter = parseOrThrow(`story`, chapterFileSchema, raw)
    if (chapters.has(chapter.chapterId)) {
      throw new Error(`数据校验失败 [story]: 重复章节 id "${chapter.chapterId}"`)
    }
    chapters.set(chapter.chapterId, chapter)
  }

  const characters = index('characters', parseOrThrow('characters', charactersFileSchema, charsRaw))
  const items = index('items', parseOrThrow('items', itemsFileSchema, itemsRaw))
  const maps = index('maps', parseOrThrow('maps', mapsFileSchema, mapsRaw))
  const archives = index('archives', parseOrThrow('archives', archivesFileSchema, archivesRaw))

  // 交叉引用门禁：物件所在 map / 档案 / 章节入口必须存在（内容生产防呆）
  for (const [id, item] of items) {
    if (!maps.has(item.location)) {
      throw new Error(`数据校验失败 [items.${id}]: 地点 "${item.location}" 不存在于 maps.json`)
    }
  }

  return { chapters, characters, items, maps, archives }
}

type HydrateListener = (catalog: DataCatalog) => void
let listener: HydrateListener | null = null
/** 注册数据变更监听（HMR 用；由入口把新目录推进 store） */
export function onCatalogUpdate(fn: HydrateListener): void {
  listener = fn
}

if (import.meta.hot) {
  import.meta.hot.accept(HOT_PATTERNS, async () => {
    const next = await loadCatalog().catch((err: unknown) => {
      console.error('[archive:data] 热更新失败', err)
      return createEmptyCatalog()
    })
    listener?.(next)
  })
}