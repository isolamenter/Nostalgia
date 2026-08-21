/**
 * bus → store 的反向接线（少数事实事件驱动的副作用）。
 * 自动存档 / toast；不引发新的领域广播，避免环路。
 */
import { bus } from './bus'
import { useGameStore } from '../state/store'

export function startBridge(): () => void {
  const store = useGameStore

  const onArchiveDiscovered = ({ archiveId }: { archiveId: string }) => {
    const { data, autosave, showToast } = store.getState()
    const entry = data.archives.get(archiveId)
    showToast(entry ? `档案已收录：《${entry.title}》` : `档案已收录：${archiveId}`)
    autosave()
  }
  const onArchiveStatusChanged = () => store.getState().autosave()
  const onChoiceMade = () => store.getState().autosave()
  const onSceneChange = () => store.getState().autosave()

  bus.on('world:archiveDiscovered', onArchiveDiscovered)
  bus.on('world:archiveStatusChanged', onArchiveStatusChanged)
  bus.on('world:choiceMade', onChoiceMade)
  bus.on('scene:change', onSceneChange)

  return () => {
    bus.off('world:archiveDiscovered', onArchiveDiscovered)
    bus.off('world:archiveStatusChanged', onArchiveStatusChanged)
    bus.off('world:choiceMade', onChoiceMade)
    bus.off('scene:change', onSceneChange)
  }
}