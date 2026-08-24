/** Phaser 层视觉/物理参数：630 × 891 = 竖向 A4（210:297） */
export const TILE = 42;
export const GAME_WIDTH = 630;
export const GAME_HEIGHT = 891;
export const PLAYER_SPEED = 210;
/** 与地图栅格一致的碰撞体边距 */
export const SOLID_SHRINK = 0;

/** '#rrggbb' → Phaser 数值色 */
export function rgb(color: string): number {
  const hex = color.replace('#', '');
  return parseInt(hex, 16);
}
