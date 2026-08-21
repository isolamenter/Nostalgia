import { describe, expect, it } from 'vitest'
import type { ChapterData, WorldState } from '../../../data/types'
import { buildChapterGraph } from '../chapterGraph'
import { chooseFromGraph, enterGraph, modeOf, resolveFollowFor, choiceVisible } from '../runner'
import { END } from '../../constants'

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

const chapter: ChapterData = {
  chapterId: 'c1',
  title: 't',
  nodes: [
    { id: 'n1', mode: 'prose', text: 'p1', next: 'n2' },
    { id: 'n2', mode: 'prose', text: 'p2', next: 'n3' },
    { id: 'n3', mode: 'prose', text: 'p3', next: END },
    {
      id: 'n4',
      mode: 'dialogue',
      speaker: 'charA',
      text: 'q?',
      next: 'n4b',
    },
    { id: 'n4b', mode: 'dialogue', speaker: 'charA', text: 'more', next: END },
    {
      id: 'branch',
      mode: 'dialogue',
      speaker: 'charA',
      text: 'pick',
      choices: [
        { id: 'keep', text: '保留', next: 'kept' },
        { id: 'dump', text: '移出', next: 'dumped' },
      ],
    },
    { id: 'kept', mode: 'prose', text: 'kept text', next: END },
    { id: 'dumped', mode: 'prose', text: 'dumped text', next: END },
    {
      id: 'gate',
      mode: 'prose',
      text: 'gate',
      next: [
        { when: { hasFlag: 'x', equals: 'on' }, to: 'gateOn' },
        { to: 'gateOff' },
      ],
    },
    { id: 'gateOn', mode: 'prose', text: 'on', next: END },
    { id: 'gateOff', mode: 'prose', text: 'off', next: END },
    { id: 'flagNode', mode: 'prose', text: 'f', flags: [{ flag: 'applied', value: true }], next: END },
    {
      id: 'onceNode',
      mode: 'prose',
      text: 'once only',
      once: true,
      next: 'onceTarget',
    },
    { id: 'onceTarget', mode: 'prose', text: 'after once', next: END },
  ],
}

const graph = buildChapterGraph(chapter)

describe('runner 推进', () => {
  it('散文链式推进 + 模式推断', () => {
    const r = enterGraph(graph, 'n1', world())
    expect(r.mode).toBe('prose')
    expect(r.node.text).toBe('p1')
    expect(r.follow).toEqual({ type: 'node', id: 'n2' })

    const r2 = enterGraph(graph, 'n2', world())
    expect(r2.follow).toEqual({ type: 'node', id: 'n3' })

    const r3 = enterGraph(graph, 'n3', world())
    expect(r3.follow).toEqual({ type: 'end' })
  })

  it('带 speaker 节点推断 dialogue 模式', () => {
    const r = enterGraph(graph, 'n4', world())
    expect(r.mode).toBe('dialogue')
    expect(r.follow).toEqual({ type: 'node', id: 'n4b' })
    expect(modeOf({ id: 'x', text: 't' })).toBe('prose')
    expect(modeOf({ id: 'x', text: 't', speaker: 's' })).toBe('dialogue')
  })

  it('有选择题 → await-choice；选中按选项 flags 与 next', () => {
    const r = enterGraph(graph, 'branch', world())
    expect(r.follow).toEqual({ type: 'await-choice' })

    const keep = chooseFromGraph(graph, 'branch', 'keep', world())
    expect(keep.choice.id).toBe('keep')
    expect(keep.flagsToApply).toEqual([])
    expect(keep.follow).toEqual({ type: 'node', id: 'kept' })

    const dump = chooseFromGraph(graph, 'branch', 'dump', world())
    expect(dump.follow).toEqual({ type: 'node', id: 'dumped' })
  })

  it('选项不存在抛错', () => {
    expect(() => chooseFromGraph(graph, 'branch', 'nope', world())).toThrow(/找不到选项/)
  })

  it('next 规则数组按序条件命中', () => {
    const off = enterGraph(graph, 'gate', world())
    expect(off.follow).toEqual({ type: 'node', id: 'gateOff' })

    const on = enterGraph(graph, 'gate', world({ flags: { x: 'on' } }))
    expect(on.follow).toEqual({ type: 'node', id: 'gateOn' })
  })

  it('节点 flags 在进入时返回待应用', () => {
    const r = enterGraph(graph, 'flagNode', world())
    expect(r.flagsToApply).toEqual([{ flag: 'applied', value: true }])
  })

  it('resolveFollowFor 组合推进（无选项时的后继）', () => {
    expect(resolveFollowFor(graph, 'n2', world())).toEqual({ type: 'node', id: 'n3' })
    expect(resolveFollowFor(graph, 'n3', world())).toEqual({ type: 'end' })
  })

  it('choiceVisible 条件过滤选项', () => {
    const g = buildChapterGraph({
      chapterId: 'c1',
      title: 't',
      nodes: [
        {
          id: 'cv',
          mode: 'dialogue',
          speaker: 'a',
          text: 't',
          choices: [{ id: 'h', text: 'H', condition: { hasArchive: 'arc1' } }],
        },
      ],
    })
    const c = g.byId.get('cv')!.choices![0]!
    expect(choiceVisible(g, c, world())).toBe(false)
    expect(choiceVisible(g, c, world({ discoveredArchives: { arc1: { status: 'pending', discoveredAt: 1 } } }))).toBe(true)
  })
})