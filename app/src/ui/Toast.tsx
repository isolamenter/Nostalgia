import { useEffect } from 'react'
import { useGameStore } from '../state/store'

/** 轻提示（档案收录 / 获得物品等），自动消失 */
export function Toast() {
  const toast = useGameStore((s) => s.toast)
  const clearToast = useGameStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(clearToast, 3200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id])

  if (!toast) return null
  return (
    <div className="toast" key={toast.id}>
      {toast.message}
    </div>
  )
}