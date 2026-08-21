/**
 * 档案状态机（纯函数，单测对象）。
 *
 *   unknown(未发现) → pending(待核) → verified(已核对)
 *                           └→ retained(保留) / held(悬置·临时保管) / discarded(移出)
 *   verified → { retained, held, discarded }（复核后改判）
 *   held     → { verified, retained, discarded }（悬置可再解）
 *   retained / discarded 为终态
 *
 * 「发现」必须是 unknown → pending（先保留再决定；unknown 不可直接 discarded/retained）。
 */
import type { ArchiveStatus } from '../../data/types'
import { archiveStatusFlag } from '../constants'

const TRANSITIONS: Record<ArchiveStatus, readonly ArchiveStatus[]> = {
  pending: ['verified', 'retained', 'held', 'discarded'],
  verified: ['retained', 'held', 'discarded'],
  held: ['verified', 'retained', 'discarded'],
  retained: [],
  discarded: [],
}

export const ALL_STATUSES: readonly ArchiveStatus[] = [
  'pending',
  'verified',
  'retained',
  'held',
  'discarded',
]

export function canTransition(from: ArchiveStatus, to: ArchiveStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function isFinal(status: ArchiveStatus): boolean {
  return TRANSITIONS[status].length === 0
}

export function nextStatuses(from: ArchiveStatus): ArchiveStatus[] {
  return [...TRANSITIONS[from]]
}

export { archiveStatusFlag }