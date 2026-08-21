import { describe, expect, it } from 'vitest'
import { canTransition, isFinal, nextStatuses } from '../archiveMachine'
import { archiveStatusFlag } from '../../constants'

describe('档案状态机', () => {
  it('转移表逐条合法', () => {
    expect(canTransition('pending', 'verified')).toBe(true)
    expect(canTransition('pending', 'retained')).toBe(true)
    expect(canTransition('pending', 'held')).toBe(true)
    expect(canTransition('pending', 'discarded')).toBe(true)
    expect(canTransition('verified', 'retained')).toBe(true)
    expect(canTransition('verified', 'discarded')).toBe(true)
    expect(canTransition('held', 'verified')).toBe(true)
    expect(canTransition('held', 'retained')).toBe(true)
    expect(canTransition('held', 'discarded')).toBe(true)
  })

  it('非法转移拒绝', () => {
    expect(canTransition('retained', 'pending')).toBe(false)
    expect(canTransition('retained', 'discarded')).toBe(false)
    expect(canTransition('discarded', 'retained')).toBe(false)
    expect(canTransition('discarded', 'held')).toBe(false)
    expect(canTransition('pending', 'pending')).toBe(false)
  })

  it('终态判定', () => {
    expect(isFinal('retained')).toBe(true)
    expect(isFinal('discarded')).toBe(true)
    expect(isFinal('pending')).toBe(false)
    expect(isFinal('held')).toBe(false)
  })

  it('待核状态的可达状态集包含 verified（先保留再决定路径）', () => {
    expect(nextStatuses('pending')).toEqual(expect.arrayContaining(['verified', 'held', 'retained', 'discarded']))
  })

  it('档案状态 flag 命名约定', () => {
    expect(archiveStatusFlag('arc1')).toBe('archive.arc1.status')
  })
})