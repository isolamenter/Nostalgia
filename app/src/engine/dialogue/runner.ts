/**
 * 对话/分支/散文推进核心（纯函数，无副作用，单测对象）。
 *
 * 流转约定：
 *  - enter 进入节点：返回展示文本（node.text）+ 需应用的 flags（node.flags）+ 后继
 *  - 后续是 await-choice → UI 渲染选项；玩家 choose 时应用 choice.flags 并按其 next 走
 *  - 后续是 node → UI 点推进时对该节点调用 enter
 *  - 后续是 end → 点击后结束对话（触发存档/结算回调）
 *  - flags 应用时机：节点进入时应用 node.flags；选项被选中时应用 choice.flags
 */
import type { Choice, FlagChange, NextTarget, StoryNode, WorldState } from '../../data/types'
import { END } from '../constants'
import { evalCondition } from './conditions'
import type { ChapterGraph } from './chapterGraph'
import { getChapterNode } from './chapterGraph'

export type FollowNext = { type: 'node'; id: string }
export type Follow = { type: 'await-choice' } | FollowNext | { type: 'end' }

export interface EnterResult {
  node: StoryNode
  mode: 'prose' | 'dialogue'
  flagsToApply: FlagChange[]
  follow: Follow
}

export interface ChooseResult {
  choice: Choice
  flagsToApply: FlagChange[]
  follow: Follow
}

export function modeOf(node: StoryNode): 'prose' | 'dialogue' {
  return node.mode ?? (node.speaker ? 'dialogue' : 'prose')
}

function targetFollow(graph: ChapterGraph, target: string): Follow {
  if (target === END) return { type: 'end' }
  if (!graph.byId.has(target)) {
    throw new Error(
      `章节 ${graph.chapter.chapterId}：节点/选项指向不存在的目标 "${target}"（构建期应已拦截）`,
    )
  }
  return { type: 'node', id: target }
}

function resolveNextTarget(graph: ChapterGraph, next: NextTarget | undefined, world: WorldState): Follow {
  if (next === undefined) return { type: 'end' }
  if (typeof next === 'string') return targetFollow(graph, next)
  for (const rule of next) {
    if (!rule.when || evalCondition(rule.when, { world, currentChapter: graph.chapter.chapterId })) {
      return targetFollow(graph, rule.to)
    }
  }
  return { type: 'end' }
}

/** 进入节点（应用于图文节点本身） */
export function enterGraph(graph: ChapterGraph, nodeId: string, world: WorldState): EnterResult {
  const node = getChapterNode(graph, nodeId)
  const choices = node.choices ?? []
  const follow: Follow = choices.length > 0 ? { type: 'await-choice' } : resolveNextTarget(graph, node.next, world)
  return { node, mode: modeOf(node), flagsToApply: node.flags ?? [], follow }
}

/** 玩家选中选项 */
export function chooseFromGraph(
  graph: ChapterGraph,
  nodeId: string,
  choiceId: string,
  world: WorldState,
): ChooseResult {
  const node = getChapterNode(graph, nodeId)
  const choice = node.choices?.find((c) => c.id === choiceId)
  if (!choice) {
    throw new Error(`章节 ${graph.chapter.chapterId}：节点 "${nodeId}" 中找不到选项 "${choiceId}"`)
  }
  const follow: Follow = choice.next
    ? targetFollow(graph, choice.next)
    : resolveNextTarget(graph, node.next, world)
  return { choice, flagsToApply: choice.flags ?? [], follow }
}

/** 无选项节点推进时的后继解析（供 store.advance 使用） */
export function resolveFollowFor(graph: ChapterGraph, nodeId: string, world: WorldState): Follow {
  const node = getChapterNode(graph, nodeId)
  return resolveNextTarget(graph, node.next, world)
}

/** 检查选项是否对当前世界可见（condition 求值） */
export function choiceVisible(graph: ChapterGraph, choice: Choice, world: WorldState): boolean {
  if (!choice.condition) return true
  return evalCondition(choice.condition, { world, currentChapter: graph.chapter.chapterId })
}