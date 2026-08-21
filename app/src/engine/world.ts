/**
 * 世界快照纯操作：WorldState 的不可变读写助手。
 * 存档序列化、存档往返测试共用同一批构造逻辑。
 */
import type { FlagChange, FlagValue, WorldState } from '../data/types'

export function createInitialWorld(currentChapter: string): WorldState {
  return {
    schemaVersion: 1,
    currentChapter,
    discoveredArchives: {},
    relations: {},
    choices: {},
    choiceLog: [],
    endings: {},
    flags: {},
    pending: {},
  }
}

export function setFlag(world: WorldState, flag: string, value: FlagValue): WorldState {
  return { ...world, flags: { ...world.flags, [flag]: value } }
}

/** 批量应用一串 flag；后写覆盖先写。返回新世界。 */
export function applyChanges(world: WorldState, changes: FlagChange[]): WorldState {
  let next = world
  for (const c of changes) next = setFlag(next, c.flag, c.value)
  return next
}

export function recordChoice(
  world: WorldState,
  nodeId: string,
  choiceId: string,
  at: number,
): WorldState {
  return {
    ...world,
    choices: { ...world.choices, [nodeId]: choiceId },
    choiceLog: [...world.choiceLog, { nodeId, choiceId, at }],
  }
}