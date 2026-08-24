import { SLOT_IDS, type SlotId } from '../engine/save/storage';
import { useGameStore } from '../state/store';

const SLOT_LABEL: Record<SlotId, string> = {
  autosave: '自动存档',
  'manual-1': '存档位 一',
  'manual-2': '存档位 二',
  'manual-3': '存档位 三',
};

export function SaveMenu() {
  const open = useGameStore((s) => s.panel === 'save');
  const slots = useGameStore((s) => s.slots);
  const saveToSlot = useGameStore((s) => s.saveToSlot);
  const loadFromSlot = useGameStore((s) => s.loadFromSlot);
  const deleteSlot = useGameStore((s) => s.deleteSlot);
  const closePanel = useGameStore((s) => s.closePanel);

  if (!open) return null;

  const metaOf = (id: SlotId) => slots.find((m) => m.id === id);

  return (
    <div className="overlay-panel save-menu">
      <div className="drawer-head">
        <div>
          <span className="drawer-kicker">SESSION REGISTER</span>
          <span className="drawer-title">存档登记</span>
        </div>
        <button className="icon-btn" onClick={closePanel} aria-label="关闭存档登记">
          ×
        </button>
      </div>
      <div className="slot-list">
        {[...SLOT_IDS].map((id) => {
          const meta = metaOf(id);
          return (
            <div key={id} className="slot-row">
              <div className="slot-info">
                <div className="slot-name">{SLOT_LABEL[id]}</div>
                <div className="slot-time">
                  {meta ? new Date(meta.updatedAt).toLocaleString() : '空'}
                </div>
              </div>
              <div className="slot-actions">
                <button disabled={!meta} onClick={() => saveToSlot(id)}>
                  保存
                </button>
                <button disabled={!meta} onClick={() => loadFromSlot(id)}>
                  读取
                </button>
                <button className="danger-action" disabled={!meta} onClick={() => deleteSlot(id)}>
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="save-hint">自动存档在场景切换 / 选择 / 档案状态变更时写入。</p>
    </div>
  );
}
