/**
 * 领域事件契约：Phaser/React/模块间广播的事实（不是指令）。
 * bus 见 src/bridge/bus.ts；所有「变异」走 store action，事件只播报已发生的事实。
 */
import type { ArchiveStatus, FlagValue } from '../data/types'

export type DomainEventMap = {
  /** 新档案被发现（入库 + toast） */
  'world:archiveDiscovered': { archiveId: string; fromItem?: string }
  /** 档案状态被更改（触发自动存档 + 场景/节点重读） */
  'world:archiveStatusChanged': { archiveId: string; status: ArchiveStatus }
  /** 任意状态 flag 被写 */
  'world:flagChanged': { flag: string; value: FlagValue }
  /** 玩家做出选择 */
  'world:choiceMade': { nodeId: string; choiceId: string }
  /** 玩家与物件/NPC 交互 */
  'player:interact': { itemId: string }
  /** 自动存档完成 */
  'world:autosaved': { slotId: string }
  /** 对话开始/结束 */
  'dialog:start': { nodeId: string }
  'dialog:end': { nextNodeId: string | null }
  /** 场景切换 */
  'scene:change': { from: string | null; to: string }
  /** 玩家进入新格子（低频） */
  'player:enteredTile': { x: number; y: number }
  /** UI 提示（toast） */
  'ui:toast': { message: string }
}