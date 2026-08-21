import { useEffect, useRef } from 'react'
import { createGame, destroyGame, getGame } from '../game/createGame'
import { useGameStore } from '../state/store'

/** Phaser 挂载容器 + 全局导航（新游戏/继续）响应 */
export function GameHost() {
  const ref = useRef<HTMLDivElement>(null)
  const pendingNav = useGameStore((s) => s.pendingNav)

  useEffect(() => {
    if (!ref.current) return
    createGame(ref.current)
    return () => destroyGame()
  }, [])

  // pendingNav：新游戏 / 读档后由 React 通知 Phaser 切场景
  useEffect(() => {
    if (!pendingNav) return
    const game = getGame()
    if (!game) return
    game.scene.start('MapScene', {
      mapId: pendingNav.mapId,
      spawn: { x: pendingNav.x, y: pendingNav.y },
    })
    useGameStore.setState({ pendingNav: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNav?.version])

  return <div ref={ref} id="phaser-root" className="game-host" />
}