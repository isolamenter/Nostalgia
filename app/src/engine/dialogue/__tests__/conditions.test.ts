import { describe, expect, it } from 'vitest'
import type { WorldState } from '../../../data/types'
import { evalCondition } from '../conditions'

function world(partial?: Partial<WorldState>): WorldState {
  return {
    schemaVersion: 1,
    currentChapter: 'c1',
    discoveredArchives: {},
    relations: {},
    choices: {},
    choiceLog: [],
    endings: {},
    flags: {},
    pending: {},
    ...partial,
  }
}

describe('condition 求值', () => {
  it('hasFlag 存在且 truthy', () => {
    expect(evalCondition({ hasFlag: 'a' }, { world: world({ flags: { a: true } }), currentChapter: 'c1' })).toBe(true)
    expect(evalCondition({ hasFlag: 'b' }, { world: world(), currentChapter: 'c1' })).toBe(false)
  })

  it('hasFlag equals 严格匹配（false 值）', () => {
    const w = world({ flags: { s: 'retained', b: false } })
    expect(evalCondition({ hasFlag: 's', equals: 'retained' }, { world: w, currentChapter: 'c1' })).toBe(true)
    expect(evalCondition({ hasFlag: 's', equals: 'held' }, { world: w, currentChapter: 'c1' })).toBe(false)
    expect(evalCondition({ hasFlag: 'b', equals: false }, { world: w, currentChapter: 'c1' })).toBe(true)
    expect(evalCondition({ hasFlag: 'missing', equals: false }, { world: w, currentChapter: 'c1' })).toBe(false)
  })

  it('hasArchive 依据已发现档案', () => {
    const w = world({ discoveredArchives: { arc1: { status: 'pending', discoveredAt: 1 } } })
    expect(evalCondition({ hasArchive: 'arc1' }, { world: w, currentChapter: 'c1' })).toBe(true)
    expect(evalCondition({ hasArchive: 'arc2' }, { world: w, currentChapter: 'c1' })).toBe(false)
  })

  it('chapterEquals', () => {
    expect(evalCondition({ chapterEquals: 'c1' }, { world: world(), currentChapter: 'c1' })).toBe(true)
    expect(evalCondition({ chapterEquals: 'c2' }, { world: world(), currentChapter: 'c1' })).toBe(false)
  })

  it('all / any / not 组合', () => {
    const w = world({ flags: { a: true, b: false } })
    const ctx = { world: w, currentChapter: 'c1' }
    expect(evalCondition({ all: [{ hasFlag: 'a' }, { not: { hasFlag: 'b' } }] }, ctx)).toBe(true)
    expect(evalCondition({ any: [{ hasFlag: 'zzz' }, { hasFlag: 'a' }] }, ctx)).toBe(true)
    expect(evalCondition({ not: { hasFlag: 'a' } }, ctx)).toBe(false)
    expect(evalCondition({ all: [{ hasFlag: 'a' }, { hasFlag: 'b' }] }, ctx)).toBe(false)
  })

  it('未知条件字段安全返回 false', () => {
    expect(evalCondition({ someUnknown: 1 } as never, { world: world(), currentChapter: 'c1' })).toBe(false)
  })
})