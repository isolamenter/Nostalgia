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

/**
 * 单一色彩来源：与 app/src/styles/index.css 的 :root token 严格对应。
 * 现实空间与记录空间共用同一冷灰体系，禁止在组件里散落新主题色。
 */
export const TOKENS = {
  bg0: '#11191a', // 页面底色 / 最深现实空间
  bg1: '#172224', // 次级背景
  bg2: '#203033', // 档案柜蓝
  bg3: '#293a3c', // 悬停和抬升层
  ink: '#d3d8d1', // 深色背景上的主要文字
  inkDim: '#9ba7a0', // 次要文字
  inkFaint: '#75817a', // 元数据、提示、禁用信息
  line: '#425355', // 主要边界
  lineSoft: '#2d3d3f', // 分隔线和弱边界
  accent: '#8fafb0', // 复写青、可交互、选中
  accentDim: '#668788', // 次级强调、面板上沿
  paper: '#d0c8ae', // 旧票据纸
  paperBright: '#ded7bf', // 纸张高光、标题主字
  paperDim: '#aaa28b', // 深色背景上的纸质辅助色
  paperInk: '#323833', // 纸张上的正文
  danger: '#9b554c', // 氧化印泥、移出和删除
  keep: '#9aafa6', // 保留状态
  hold: '#b7a36b', // 悬置状态
} as const;

export type TokenKey = keyof typeof TOKENS;

/** token → 数值色（Phaser fill / lineStyle / setStrokeStyle） */
export function rgbToken(key: TokenKey): number {
  return rgb(TOKENS[key]);
}

/** token → '#rrggbb' 字符串（Text 'color'） */
export function cssColor(key: TokenKey): string {
  return TOKENS[key];
}

/** token + alpha → rgba(...) 字符串（Text 'backgroundColor'） */
export function cssRgba(key: TokenKey, alpha: number): string {
  const h = TOKENS[key].replace('#', '');
  const c = (i: number): number => parseInt(h.slice(i, i + 2), 16);
  return `rgba(${c(0)},${c(2)},${c(4)},${alpha})`;
}

/** '#rrggbb' + 衰减系数 → 更深的冷色（落地阴影从 token 派生，不用彩色光晕） */
export function darken(color: string, factor: number): string {
  const h = color.replace('#', '');
  const c = (i: number): string =>
    Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * factor))
      .toString(16)
      .padStart(2, '0');
  return `#${c(0)}${c(2)}${c(4)}`;
}

/** UI / 对白黑体 */
export const UI_FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
/** 数据 / 元信息等宽 */
export const MONO_FONT =
  '"SFMono-Regular", "Cascadia Mono", "Roboto Mono", ui-monospace, monospace';
