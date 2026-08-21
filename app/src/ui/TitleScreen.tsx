import { useGameStore } from '../state/store'

/** 标题页：开始新的档案 / 继续自动存档 */
export function TitleScreen() {
  const newGame = useGameStore((s) => s.newGame)
  const loadFromSlot = useGameStore((s) => s.loadFromSlot)
  const hasAuto = useGameStore((s) => s.slots.some((m) => m.id === 'autosave'))

  return (
    <div className="title-screen">
      <div className="title-card">
        <h1 className="title-name">
          归档<span className="title-accent">故乡</span>
        </h1>
        <p className="title-sub">档案会为现在，分配一个过去。</p>
        <div className="title-actions">
          <button
            className="title-btn primary"
            onClick={() => {
              newGame()
            }}
          >
            开始新的档案
          </button>
          <button
            className="title-btn"
            disabled={!hasAuto}
            onClick={() => {
              const ok = loadFromSlot('autosave')
              if (!ok) console.warn('[title] 没有可读的自动存档')
            }}
          >
            {hasAuto ? '继续上次的档案' : '继续（暂无存档）'}
          </button>
        </div>
        <p className="title-foot">框架演示 · 内容为占位（Epic 0 + Epic 1）</p>
      </div>
    </div>
  )
}