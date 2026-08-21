import type Phaser from 'phaser'
import type { LocationDef } from '../../data/types'
import { TILE, rgb } from '../constants'

/** 程序化占位视觉：把 LocationDef.decorate 渲染为矩形/文字 */
export function drawDecor(scene: Phaser.Scene, loc: LocationDef): void {
  for (const d of loc.decorate) {
    const w = (d.w ?? 1) * TILE
    const h = (d.h ?? 1) * TILE
    if (d.kind === 'rect') {
      scene.add
        .rectangle((d.x + 0.5 * (d.w ?? 1)) * TILE, (d.y + 0.5 * (d.h ?? 1)) * TILE, w, h, rgb(d.color))
        .setOrigin(0.5)
        .setAlpha(0.7)
    } else {
      scene.add
        .text((d.x + 0.5) * TILE, d.y * TILE + 4, d.text ?? '', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#c9d6d4',
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.75)
    }
  }
}

/** 玩家占位贴图（一次性生成，跨场景复用） */
export function ensurePlayerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('placeholder-player')) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(0xd8dcd9, 1)
  g.fillRoundedRect(0, 0, 16, 22, 4)
  g.fillStyle(0x3a4a4b, 1)
  g.fillCircle(8, 6, 3)
  g.generateTexture('placeholder-player', 16, 22)
  g.destroy()
}

/** 物件/NPC 占位贴图 */
export function ensureItemTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('placeholder-item')) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(0x9aa8a6, 1)
  g.fillRoundedRect(0, 0, 18, 18, 3)
  g.generateTexture('placeholder-item', 18, 18)
  g.clear()
  g.fillStyle(0xb0a98c, 1)
  g.fillRoundedRect(0, 0, 18, 18, 9)
  g.generateTexture('placeholder-npc', 18, 18)
  g.destroy()
}