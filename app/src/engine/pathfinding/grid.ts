/**
 * 栅格寻路（纯净 BFS）。用于点击寻路与任何格子级可达性判定。
 * 边界与实心格均视为不可通行。
 */
export interface GridLike {
  width: number
  height: number
  solidTiles: ReadonlyArray<Readonly<[number, number]>>
}

export interface Point {
  x: number
  y: number
}

export function buildSolidSet(loc: GridLike): Set<string> {
  const set = new Set<string>()
  for (const [x, y] of loc.solidTiles) set.add(`${x},${y}`)
  return set
}

function isSolidSet(solid: Set<string>, x: number, y: number, width: number, height: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return true
  return solid.has(`${x},${y}`)
}

/**
 * BFS，返回从 from 到 to 的路径（不含起点、含终点）。
 * 无路或目标不可达返回 null。
 */
export function bfs(
  loc: GridLike,
  from: Point,
  to: Point,
): Point[] | null {
  const solid = buildSolidSet(loc)
  if (isSolidSet(solid, from.x, from.y, loc.width, loc.height)) return null
  if (isSolidSet(solid, to.x, to.y, loc.width, loc.height)) return null
  if (from.x === to.x && from.y === to.y) return []

  const key = (x: number, y: number) => `${x},${y}`
  const seen = new Set<string>([key(from.x, from.y)])
  const parent = new Map<string, string>()
  const queue: Point[] = [from]

  const dirs4: ReadonlyArray<Point> = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]

  let found = false
  let cursor = 0
  while (cursor < queue.length) {
    const cur = queue[cursor]
    if (!cur) break
    cursor += 1
    for (const d of dirs4) {
      const nx = cur.x + d.x
      const ny = cur.y + d.y
      if (isSolidSet(solid, nx, ny, loc.width, loc.height)) continue
      const nk = key(nx, ny)
      if (seen.has(nk)) continue
      seen.add(nk)
      parent.set(nk, key(cur.x, cur.y))
      if (nx === to.x && ny === to.y) {
        found = true
        break
      }
      queue.push({ x: nx, y: ny })
    }
    if (found) break
  }

  if (!found) return null

  const path: Point[] = []
  let curPoint = { x: to.x, y: to.y }
  const startKey = key(from.x, from.y)
  while (curPoint.x !== from.x || curPoint.y !== from.y) {
    path.unshift({ x: curPoint.x, y: curPoint.y })
    const pk = parent.get(key(curPoint.x, curPoint.y))
    if (!pk) break
    const [px, py] = pk.split(',').map(Number) as [number, number]
    if (pk === startKey) break
    curPoint = { x: px, y: py }
  }
  return path
}

/** 曼哈顿距离（供邻近检测/排序） */
export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}