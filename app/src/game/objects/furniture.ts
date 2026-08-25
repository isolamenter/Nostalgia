import type Phaser from 'phaser';
import type { LocationDef } from '../../data/types';
import { TILE, TOKENS, darken, rgb, rgbToken } from '../constants';

/**
 * 家具/实心块的装饰层（与物理层解耦）。
 *
 * 物理体仍由 MapScene 用「不可见矩形」逐格创建，尺寸/中心不变；本层只负责视觉：
 * 把同一行的相邻实心格聚成一条水平 run，整块绘制（消除逐格间距的「调试方块网格」感），
 * 再对每个家具块的外围描一圈弱边，接地处做短阴影。全部派生自色彩 token。
 */
export function drawFurniture(scene: Phaser.Scene, loc: LocationDef): void {
  const solid = new Set<string>(loc.solidTiles.map(([x, y]) => `${x},${y}`));
  const isSolid = (x: number, y: number): boolean => solid.has(`${x},${y}`);

  // 按行聚成水平 run
  const runs: Array<{ x: number; y: number; len: number }> = [];
  const seen = new Set<string>();
  for (const [gx, gy] of loc.solidTiles) {
    const key = `${gx},${gy}`;
    if (seen.has(key)) continue;
    let end = gx;
    while (isSolid(end + 1, gy)) {
      end += 1;
      seen.add(`${end},${gy}`);
    }
    seen.add(key);
    runs.push({ x: gx, y: gy, len: end - gx + 1 });
  }

  const fillColor = rgb(loc.bg.accent);
  const shadowColor = rgb(darken(TOKENS.bg0, 0.55));

  for (const { x: startX, y: rowY, len } of runs) {
    const cx = startX * TILE + (len * TILE) / 2;
    const cy = (rowY + 0.5) * TILE;
    const w = len * TILE;
    const h = TILE;

    // 短落地阴影（无逐格接缝）
    scene.add
      .rectangle(cx + 3, cy + 4, w, h, shadowColor, 0.34)
      .setOrigin(0.5)
      .setDepth(0.8);

    // 实体色填充（低饱和冷色块）
    scene.add.rectangle(cx, cy, w, h, fillColor, 0.98).setOrigin(0.5).setDepth(1);
  }

  // 弱描边：只在暴露边（相邻格非实心）画短线，形成每个家具块一圈干净外围
  const g = scene.add.graphics().setDepth(1.1);
  g.lineStyle(1, rgbToken('accentDim'), 0.4);
  const edge = (x1: number, y1: number, x2: number, y2: number): void => {
    g.lineBetween(x1, y1, x2, y2);
  };
  for (const [gx, gy] of loc.solidTiles) {
    const l = gx * TILE;
    const r = l + TILE;
    const t = gy * TILE;
    const b = t + TILE;
    if (!isSolid(gx, gy - 1)) edge(l, t, r, t); // 上
    if (!isSolid(gx, gy + 1)) edge(l, b, r, b); // 下
    if (!isSolid(gx - 1, gy)) edge(l, t, l, b); // 左
    if (!isSolid(gx + 1, gy)) edge(r, t, r, b); // 右
  }
}
