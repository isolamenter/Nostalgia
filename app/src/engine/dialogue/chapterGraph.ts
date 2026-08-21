/**
 * 章节节点索引 + 构建期校验（重复 id / 悬空 next）。
 * 校验失败即开发期报错，防内容作者写出断链。
 */
import type { ChapterData, StoryNode } from '../../data/types'
import { END } from '../constants'

export interface ChapterGraph {
  chapter: ChapterData
  byId: Map<string, StoryNode>
}

export function collectNodeTargets(node: StoryNode): string[] {
  const targets: string[] = []
  if (typeof node.next === 'string') targets.push(node.next)
  else if (node.next) targets.push(...node.next.map((r) => r.to))
  for (const c of node.choices ?? []) if (c.next) targets.push(c.next)
  return targets
}

export function buildChapterGraph(chapter: ChapterData): ChapterGraph {
  const byId = new Map<string, StoryNode>()
  for (const node of chapter.nodes) {
    if (byId.has(node.id)) {
      throw new Error(`章节 ${chapter.chapterId} 存在重复节点 id "${node.id}"`)
    }
    byId.set(node.id, node)
  }

  for (const node of chapter.nodes) {
    for (const target of collectNodeTargets(node)) {
      if (target === END) continue
      if (!byId.has(target)) {
        throw new Error(
          `章节 ${chapter.chapterId}：节点 "${node.id}" 引用不存在的目标节点 "${target}"`,
        )
      }
    }
  }

  return { chapter, byId }
}

export function getChapterNode(graph: ChapterGraph, nodeId: string): StoryNode {
  const node = graph.byId.get(nodeId)
  if (!node) {
    throw new Error(`章节 ${graph.chapter.chapterId}：找不到节点 "${nodeId}"`)
  }
  return node
}