import type { Choice } from '../data/types'

interface Props {
  choices: Choice[]
  onPick: (choiceId: string) => void
}

/** 选择分支渲染：仅展示对当前世界可见的选项；点击调 choose */
export function ChoiceList({ choices, onPick }: Props) {
  if (choices.length === 0) return null
  return (
    <div className="choice-list">
      {choices.map((c) => (
        <button key={c.id} className="choice-btn" onClick={() => onPick(c.id)}>
          {c.text}
        </button>
      ))}
    </div>
  )
}