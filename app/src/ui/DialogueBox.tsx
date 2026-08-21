import { useEffect, useState } from 'react'
import { useGameStore } from '../state/store'
import { evalCondition } from '../engine/dialogue/conditions'
import { ChoiceList } from './ChoiceList'

/**
 * 散文/对话双模式展示。
 * - prose（无 speaker）：整段直接展示，任意点击推进下一段（散文阅读器）
 * - dialogue（有 speaker）：姓名条 + 打字机效果，点击跳过、再点推进
 * 有选项时渲染 ChoiceList；右上角「回看」铺开历史。
 */
export function DialogueBox() {
  const active = useGameStore((s) => s.conv.active)
  const showingChoices = useGameStore((s) => s.conv.showingChoices)
  const currentNode = useGameStore((s) => s.conv.currentNode)
  const history = useGameStore((s) => s.conv.history)
  const world = useGameStore((s) => s.world)
  const node = useGameStore((s) => {
    const chapter = s.data.chapters.get(s.world.currentChapter)
    if (!s.conv.currentNode) return undefined
    return chapter?.nodes.find((n) => n.id === s.conv.currentNode)
  })
  const characters = useGameStore((s) => s.data.characters)

  const advance = useGameStore((s) => s.advance)
  const choose = useGameStore((s) => s.choose)

  const [showHistory, setShowHistory] = useState(false)
  const [typeOffset, setTypeOffset] = useState(0)

  const currentLine = history.length > 0 ? (history[history.length - 1] ?? null) : null
  const isProse = currentLine ? currentLine.kind === 'prose' : true

  // 打字机：进入新节点时重置
  useEffect(() => {
    if (isProse || !active || !currentLine) {
      setTypeOffset(currentLine?.text.length ?? 0)
      return
    }
    let raf = 0
    let i = 0
    const step = () => {
      i += 1
      setTypeOffset(i)
      if (i < currentLine.text.length) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, currentNode])

  if (!active) return null

  const displayName = currentLine?.speaker
    ? (characters.get(currentLine.speaker)?.name ?? currentLine.speaker)
    : undefined

  const visibleChoices = (node?.choices ?? []).filter((c) =>
    c.condition ? evalCondition(c.condition, { world, currentChapter: world.currentChapter }) : true,
  )

  const fullLen = currentLine?.text.length ?? 0
  const showText = isProse
    ? (currentLine?.text ?? '')
    : (currentLine?.text.slice(0, Math.max(typeOffset, 0)) ?? '')

  const handleAdvance = () => {
    if (showingChoices) return
    if (!isProse && typeOffset < fullLen) {
      setTypeOffset(fullLen)
      return
    }
    advance()
  }

  return (
    <div className={`dialogue-layer ${isProse ? 'is-prose' : 'is-speech'}`} onClick={handleAdvance}>
      {showHistory ? (
        <div className="conv-history" onClick={(e) => e.stopPropagation()}>
          <div className="conv-history-head">
            <span>对话记录</span>
            <button onClick={() => setShowHistory(false)}>关闭</button>
          </div>
          <div className="conv-history-body">
            {history.map((line, i) => (
              <div key={i} className={`conv-line ${line.kind}`}>
                {line.speaker ? (
                  <span className="who">{characters.get(line.speaker)?.name ?? line.speaker}</span>
                ) : null}
                <span className="what">{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {!isProse && displayName ? <div className="speaker-tag">{displayName}</div> : null}
          <div className="dialogue-box">
            <p className="dialogue-text">{showText}</p>
            {isProse && fullLen > 0 ? <div className="prose-next-hint">↓ 点按继续</div> : null}
          </div>
          {!isProse && fullLen > 0 && typeOffset < fullLen ? (
            <div className="type-hint">▸ 点击跳过</div>
          ) : null}
          {showingChoices ? <ChoiceList choices={visibleChoices} onPick={(id) => choose(id)} /> : null}
        </>
      )}
      <button className="history-toggle" onClick={() => setShowHistory((v) => !v)}>
        回看
      </button>
    </div>
  )
}