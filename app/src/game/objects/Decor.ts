import type Phaser from 'phaser';
import type { LocationDef } from '../../data/types';
import { TILE, rgb } from '../constants';

/** 数据驱动场景陈设：用低饱和实体、描边和目录标签建立空间层级。 */
export function drawDecor(scene: Phaser.Scene, loc: LocationDef): void {
  for (const d of loc.decorate) {
    const w = (d.w ?? 1) * TILE;
    const h = (d.h ?? 1) * TILE;
    if (d.kind === 'rect') {
      scene.add
        .rectangle(
          (d.x + 0.5 * (d.w ?? 1)) * TILE + 4,
          (d.y + 0.5 * (d.h ?? 1)) * TILE + 5,
          w,
          h,
          rgb('#080d0e'),
          0.24,
        )
        .setOrigin(0.5);
      scene.add
        .rectangle(
          (d.x + 0.5 * (d.w ?? 1)) * TILE,
          (d.y + 0.5 * (d.h ?? 1)) * TILE,
          w,
          h,
          rgb(d.color),
        )
        .setOrigin(0.5)
        .setAlpha(0.82)
        .setStrokeStyle(1, rgb('#8fafb0'), 0.12);
    } else {
      scene.add
        .text((d.x + 0.5) * TILE, d.y * TILE + 6, d.text ?? '', {
          fontFamily: '"PingFang SC", sans-serif',
          fontSize: '12px',
          color: '#b9c5be',
          backgroundColor: 'rgba(17,25,26,0.58)',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.86);
    }
  }
}

/** 玩家占位贴图（一次性生成，跨场景复用） */
export function ensurePlayerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('placeholder-player')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x0a1011, 0.35);
  g.fillEllipse(3, 30, 27, 9);
  g.fillStyle(0xd0c8ae, 1);
  g.fillRoundedRect(5, 4, 22, 30, 7);
  g.lineStyle(2, 0x8fafb0, 0.7);
  g.strokeRoundedRect(5, 4, 22, 30, 7);
  g.fillStyle(0x203033, 1);
  g.fillCircle(16, 12, 4);
  g.generateTexture('placeholder-player', 32, 40);
  g.destroy();
}

/** 物件/NPC 占位贴图 */
export function ensureItemTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('placeholder-item')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x8fafb0, 1);
  g.fillRoundedRect(3, 3, 22, 22, 3);
  g.lineStyle(2, 0xd0c8ae, 0.7);
  g.strokeRoundedRect(3, 3, 22, 22, 3);
  g.generateTexture('placeholder-item', 28, 28);
  g.clear();
  g.fillStyle(0xd0c8ae, 1);
  g.fillCircle(14, 14, 12);
  g.lineStyle(2, 0x9b554c, 0.65);
  g.strokeCircle(14, 14, 11);
  g.generateTexture('placeholder-npc', 28, 28);
  g.destroy();
}
