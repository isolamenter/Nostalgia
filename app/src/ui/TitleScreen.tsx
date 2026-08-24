import { useGameStore } from '../state/store';

/** 标题页：开始新的档案 / 继续自动存档 */
export function TitleScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const loadFromSlot = useGameStore((s) => s.loadFromSlot);
  const hasAuto = useGameStore((s) => s.slots.some((m) => m.id === 'autosave'));

  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="title-docket" aria-label="卷宗信息">
          <span>青潭县档案馆</span>
          <span>卷宗 01 / 归档中</span>
        </div>
        <div className="title-heading-wrap">
          <span className="title-copy" aria-hidden="true">
            归档故乡
          </span>
          <h1 className="title-name">
            <span>归档</span>
            <span className="title-accent">故乡</span>
          </h1>
        </div>
        <p className="title-chapter">第一章 · 第二份</p>
        <p className="title-sub">档案会为现在，分配一个过去。</p>
        <div className="title-actions">
          <button
            className="title-btn primary"
            onClick={() => {
              newGame();
            }}
          >
            开始新的档案
          </button>
          <button
            className="title-btn"
            disabled={!hasAuto}
            onClick={() => {
              const ok = loadFromSlot('autosave');
              if (!ok) console.warn('[title] 没有可读的自动存档');
            }}
          >
            {hasAuto ? '继续上次的档案' : '继续（暂无存档）'}
          </button>
        </div>
        <div className="title-register" aria-hidden="true">
          <span>收件</span>
          <span className="register-line" />
          <span>复核</span>
          <span className="register-line" />
          <span>归档</span>
        </div>
        <p className="title-foot">档案编号 QT-01-002 · 内部阅览</p>
      </div>
    </div>
  );
}
