/**
 * 条件求值（纯函数）。
 * 上下文 = 世界快照 + 当前章节；用于节点 next 规则、选项 condition、物件门禁。
 */
import type { Condition, FlagValue, WorldState } from '../../data/types'

export interface CondCtx {
  world: WorldState
  currentChapter: string
}

/** equals 缺省 = 该 flag 已存在（truthy 判定）；equals 提供 = 严格相等 */
function hasFlagMatch(flags: Record<string, FlagValue>, flag: string, equals?: FlagValue): boolean {
  const value = flags[flag]
  if (value === undefined) return false
  if (equals === undefined) return value !== false && value !== '' && value !== 0
  return value === equals
}

export function evalCondition(cond: Condition, ctx: CondCtx): boolean {
  if ('hasFlag' in cond) {
    return hasFlagMatch(ctx.world.flags, cond.hasFlag, cond.equals)
  }
  if ('hasArchive' in cond) {
    return ctx.world.discoveredArchives[cond.hasArchive] !== undefined
  }
  if ('chapterEquals' in cond) {
    return ctx.currentChapter === cond.chapterEquals
  }
  if ('all' in cond) {
    return cond.all.every((c) => evalCondition(c, ctx))
  }
  if ('any' in cond) {
    return cond.any.some((c) => evalCondition(c, ctx))
  }
  if ('not' in cond) {
    return !evalCondition(cond.not, ctx)
  }
  return false
}