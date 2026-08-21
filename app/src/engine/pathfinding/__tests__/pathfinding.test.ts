import { describe, expect, it } from 'vitest'
import { bfs, manhattan, type GridLike } from '../grid'

const empty: GridLike = { width: 5, height: 5, solidTiles: [] }

describe('bfs 寻路', () => {
  it('直线可达', () => {
    const path = bfs(empty, { x: 0, y: 0 }, { x: 4, y: 0 })
    expect(path).not.toBeNull()
    expect(path?.at(-1)).toEqual({ x: 4, y: 0 })
  })
  it('绕开实心格子', () => {
    const loc: GridLike = {
      width: 5,
      height: 5,
      solidTiles: [
        [2, 0],
        [2, 1],
        [2, 2],
      ],
    }
    const path = bfs(loc, { x: 0, y: 2 }, { x: 4, y: 2 })
    expect(path).not.toBeNull()
    // 路径上不允许出现实心格
    expect(
      path?.every((p) => !loc.solidTiles.some(([sx, sy]) => sx === p.x && sy === p.y)),
    ).toBe(true)
  })
  it('目标在实心格 → 不可达', () => {
    const loc: GridLike = { width: 5, height: 5, solidTiles: [[2, 2]] }
    expect(bfs(loc, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull()
  })
  it('四面包围 → 不可达', () => {
    const loc: GridLike = {
      width: 5,
      height: 5,
      solidTiles: [
        [2, 1],
        [2, 3],
        [1, 2],
        [3, 2],
        [0, 2],
        [4, 2],
      ],
    }
    // 终点 (2,2) 全部邻格被堵（含边界）
    expect(bfs(loc, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull()
  })
  it('越界栅格视作实心', () => {
    expect(bfs(empty, { x: 0, y: 0 }, { x: 99, y: 0 })).toBeNull()
  })
  it('起点即终点 → 空路径', () => {
    expect(bfs(empty, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([])
  })
})

describe('manhattan', () => {
  it('计算曼哈顿距离', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
  })
})