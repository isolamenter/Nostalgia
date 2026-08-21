import { describe, expect, it } from 'vitest'
import type { ChapterData, StoryNode } from '../../../data/types'
import { buildChapterGraph, collectNodeTargets } from '../chapterGraph'
import { END } from '../../constants'

function nodes(list: StoryNode[]): ChapterData {
  return { chapterId: 'c', title: 't', nodes: list }
}

describe('章节图构建校验', () => {
  it('索引正常构建', () => {
    const chapter = nodes([
      { id: 'a', text: 'x', next: 'b' },
      { id: 'b', text: 'y' },
    ])
    const graph = buildChapterGraph(chapter)
    expect(graph.byId.size).toBe(2)
    expect(graph.byId.get('a')?.text).toBe('x')
  })

  it('重复节点 id 抛错', () => {
    const chapter = nodes([
      { id: 'a', text: 'x' },
      { id: 'a', text: 'y' },
    ])
    expect(() => buildChapterGraph(chapter)).toThrow(/重复节点 id/)
  })

  it('next 悬空抛错', () => {
    expect(() =>
      buildChapterGraph(nodes([{ id: 'a', text: 'x', next: 'ghost' }])),
    ).toThrow(/ghost/)
  })

  it('choice.next 悬空也抛错', () => {
    expect(() =>
      buildChapterGraph(
        nodes([
          {
            id: 'a',
            text: 'x',
            choices: [{ id: 'c1', text: 'go', next: 'gone' }],
          },
        ]),
      ),
    ).toThrow(/gone/)
  })

  it('$END 是合法目标', () => {
    expect(() => buildChapterGraph(nodes([{ id: 'a', text: 'x', next: END }]))).not.toThrow()
  })

  it('收集节点全部目标（含规则数组与 choice.next）', () => {
    const n: StoryNode = {
      id: 'a',
      text: 'x',
      choices: [{ id: 'c1', text: '1', next: 'cTarget' }],
      next: [
        { when: { hasFlag: 'f', equals: true }, to: 'b1' },
        { when: { hasFlag: 'g' }, to: 'b2' },
        { to: 'b3' },
      ],
    }
    const chapter = nodes([
      n,
      { id: 'cTarget', text: 'c' },
      { id: 'b1', text: '1' },
      { id: 'b2', text: '2' },
      { id: 'b3', text: '3' },
    ])
    const graph = buildChapterGraph(chapter)
    expect(collectNodeTargets(n)).toEqual(['b1', 'b2', 'b3', 'cTarget'])
    expect(graph.byId.size).toBe(5)
  })
})