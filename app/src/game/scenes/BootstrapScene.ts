import Phaser from 'phaser'
import { useGameStore, DEFAULT_START_MAP, DEFAULT_START_POS } from '../../state/store'

/**
 * 启动场景：数据由 main.tsx 提前 hydrate（本场景兜底再验），
 * 决定进入哪张地图；若当前没有会话则落回默认起点。
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

    // 全新会话：默认地图
    st.setMap(DEFAULT_START_MAP)
    this.scene.start('MapScene', {
      mapId: DEFAULT_START_MAP,
      spawn: { x: DEFAULT_START_POS.x, y: DEFAULT_START_POS.y },
    })
  }
}