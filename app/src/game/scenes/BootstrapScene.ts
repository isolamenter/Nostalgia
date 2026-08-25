import Phaser from 'phaser'
import { useGameStore, resolvePlaythroughStart } from '../../state/store'

/**
 * 启动场景：数据由 main.tsx 提前 hydrate（本场景兜底再验），
 * 决定进入哪张地图；若当前没有会话则落回数据驱动的头章起点。
 */
export class BootstrapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootstrapScene' })
  }

  create(): void {
    const st = useGameStore.getState()
    if (st.currentMap) {
      // 已有会话（读档/中途刷新），回到最后地图
      this.scene.start('MapScene', {
        mapId: st.currentMap,
        spawn: { x: st.playerTile.x, y: st.playerTile.y },
      })
      return
    }

    // 全新会话兜底：数据驱动头章起点（正常流程由 newGame 先设好 currentMap）
    const { mapId, spawn } = resolvePlaythroughStart(st.data)
    st.setMap(mapId)
    this.scene.start('MapScene', {
      mapId,
      spawn: { x: spawn.x, y: spawn.y },
    })
  }
}