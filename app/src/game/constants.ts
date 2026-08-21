/** Phaser 层视觉/物理参数（占位阶段） */
export const TILE = 24
export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
export const PLAYER_SPEED = 150
/** 与地图栅格一致的碰撞体边距 */
export const SOLID_SHRINK = 0

/** '#rrggbb' → Phaser 数值色 */
export function rgb(color: string): number {
  const hex = color.replace('#', '')
  return parseInt(hex, 16)
}