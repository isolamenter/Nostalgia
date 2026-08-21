import type Phaser from 'phaser'
import type { Point } from '../../engine/pathfinding/grid'
import { TILE, PLAYER_SPEED } from '../constants'
import { useGameStore } from '../../state/store'
import { ensurePlayerTexture } from './Decor'

const DIAG = Math.SQRT1_2

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  /** 待走的格子中心目标序列 */
  private waypoints: Array<{ x: number; y: number }> = []
  private keys: Record<string, Phaser.Input.Keyboard.Key>

  constructor(scene: Phaser.Scene, worldX: number, worldY: number) {
    ensurePlayerTexture(scene)
    this.sprite = scene.physics.add.sprite(worldX, worldY, 'placeholder-player')
    this.sprite.setCollideWorldBounds(true)
    this.sprite.setDepth(10)

    const kb = scene.input.keyboard
    this.keys = kb
      ? {
          w: kb.addKey('W'),
          a: kb.addKey('A'),
          s: kb.addKey('S'),
          d: kb.addKey('D'),
          up: kb.addKey('UP'),
          left: kb.addKey('LEFT'),
          down: kb.addKey('DOWN'),
          right: kb.addKey('RIGHT'),
        }
      : {}
  }

  get x(): number {
    return this.sprite.x
  }
  get y(): number {
    return this.sprite.y
  }
  get tile(): Point {
    return { x: Math.floor(this.sprite.x / TILE), y: Math.floor(this.sprite.y / TILE) }
  }
  /** 是否正沿路径走 */
  get following(): boolean {
    return this.waypoints.length > 0
  }

  setPath(tiles: Point[]): void {
    this.waypoints = tiles.map((t) => ({ x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE }))
  }

  stop(): void {
    this.waypoints = []
    this.sprite.setVelocity(0, 0)
  }

  update(_deltaMs: number): void {
    const locked = useGameStore.getState().inputLocked
    if (locked) {
      this.stop()
      return
    }

    const left = this.keys.a?.isDown || this.keys.left?.isDown
    const right = this.keys.d?.isDown || this.keys.right?.isDown
    const up = this.keys.w?.isDown || this.keys.up?.isDown
    const down = this.keys.s?.isDown || this.keys.down?.isDown

    if (left || right || up || down) {
      this.waypoints = []
      let vx = 0
      let vy = 0
      if (left) vx -= 1
      if (right) vx += 1
      if (up) vy -= 1
      if (down) vy += 1
      if (vx !== 0 && vy !== 0) {
        vx *= DIAG
        vy *= DIAG
      }
      this.sprite.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED)
      if (vx !== 0) this.sprite.setFlipX(vx < 0)
      return
    }

    if (this.waypoints.length > 0) {
      const target = this.waypoints[0]
      if (!target) {
        this.waypoints = []
        return
      }
      const dx = target.x - this.sprite.x
      const dy = target.y - this.sprite.y
      const dist = Math.hypot(dx, dy)
      if (dist < 5) {
        this.waypoints.shift()
        if (this.waypoints.length === 0) {
          this.sprite.setVelocity(0, 0)
          // 到达后回调
        }
      } else {
        this.sprite.setVelocity((dx / dist) * PLAYER_SPEED, (dy / dist) * PLAYER_SPEED)
        this.sprite.setFlipX(dx < 0)
      }
      return
    }

    this.sprite.setVelocity(0, 0)
  }
}