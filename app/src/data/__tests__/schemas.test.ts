import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  archivesFileSchema,
  chapterFileSchema,
  charactersFileSchema,
  itemsFileSchema,
  mapsFileSchema,
} from '../schemas'
import type { ChapterData } from '../types'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const readJson = (p: string): unknown => JSON.parse(readFileSync(here(p), 'utf8'))

describe('demo 数据合法', () => {
  it('chapter01.json 通过章节 schema', () => {
    const raw = readJson('../story/chapter01.json')
    expect(chapterFileSchema.safeParse(raw).success).toBe(true)
  })
  it('characters.json 通过角色 schema', () => {
    expect(charactersFileSchema.safeParse(readJson('../characters/characters.json')).success).toBe(true)
  })
  it('objects.json 通过物件 schema', () => {
    expect(itemsFileSchema.safeParse(readJson('../items/objects.json')).success).toBe(true)
  })
  it('maps.json 通过地图 schema', () => {
    expect(mapsFileSchema.safeParse(readJson('../maps/maps.json')).success).toBe(true)
  })
  it('archives.json 通过档案 schema', () => {
    expect(archivesFileSchema.safeParse(readJson('../archives/archives.json')).success).toBe(true)
  })
})

describe('schema 严格校验（变异拒绝）', () => {
  it('未知字段被拒绝（strict 防笔误）', () => {
    const raw = readJson('../story/chapter01.json') as ChapterData
    const bad = { ...raw, typoField: true } as unknown
    expect(chapterFileSchema.safeParse(bad).success).toBe(false)
  })
  it('空选项 id 被拒绝', () => {
    const raw = readJson('../story/chapter01.json') as ChapterData
    const bad: unknown = {
      ...raw,
      nodes: [
        { id: 'x', text: 't', choices: [{ id: '', text: '空' }] },
        ...raw.nodes.map((n) => ({ ...n })),
      ],
    }
    expect(chapterFileSchema.safeParse(bad).success).toBe(false)
  })
  it('非法档案状态被拒绝', () => {
    const raw = readJson('../archives/archives.json') as Record<string, unknown>[]
    const first = raw[0] ?? {}
    const bad: unknown = [
      { ...first, interpretations: [{ forStatus: 'nope', lines: ['x'] }] },
    ]
    expect(archivesFileSchema.safeParse(bad).success).toBe(false)
  })
  it('地图缺 bg 被拒绝', () => {
    const raw = readJson('../maps/maps.json') as Array<Record<string, unknown>>
    const [first, ...rest] = raw
    const bad: unknown = [{ ...(first ?? {}), bg: undefined }, ...rest]
    expect(mapsFileSchema.safeParse(bad).success).toBe(false)
  })
})