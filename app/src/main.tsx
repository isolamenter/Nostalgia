import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/panels.css'
import App from './App'
import { loadCatalog, onCatalogUpdate } from './data/loaders'
import { useGameStore } from './state/store'
import { startBridge } from './bridge/startBridge'

async function boot(): Promise<void> {
  startBridge()

  let catalog
  try {
    catalog = await loadCatalog()
  } catch (err) {
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `<pre style="color:#f77;padding:24px">数据装载失败：\n${(err as Error).message}</pre>`
    }
    console.error('[boot] 数据装载失败', err)
    return
  }

  useGameStore.getState().setData(catalog)
  useGameStore.getState().refreshSlots()
  onCatalogUpdate((next) => useGameStore.getState().setData(next))

  const rootEl = document.getElementById('root')
  if (!rootEl) return
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()