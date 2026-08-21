import Phaser from 'phaser'
import { buildConfig } from './config'

let game: Phaser.Game | null = null

/**
 * 单例创建（防 React 19 StrictMode 双挂载：模块级缓存已存在则复用）。
 */
export function createGame(parent: HTMLElement): Phaser.Game {
  if (game) return game
  game = new Phaser.Game(buildConfig(parent))
  return game
}

export function getGame(): Phaser.Game | null {
  return game
}

export function destroyGame(): void {
  game?.destroy(true)
  game = null
}