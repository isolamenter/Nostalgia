import { useGameStore } from '../state/store';

/** 物件显示名：优先取内容侧展示名，兜底去掉前缀（demo./chN. 等）后的 .item. 段 */
const ITEM_LABEL: Record<string, string> = {
  'ch1.item.prescription': '药方小票',
  'ch1.item.crackedBowl': '裂纹瓷碗',
  'ch1.item.photocopy': '复印页',
  'ch1.item.mothersMedicine': '母亲的药',
};
function itemName(id: string): string {
  if (ITEM_LABEL[id]) return ITEM_LABEL[id];
  const marker = '.item.';
  const idx = id.indexOf(marker);
  return idx >= 0 ? id.slice(idx + marker.length) : id;
}

/** 物件栏：收集到的实物（统一收据等）；点击展开面板 */
export function InventoryBar() {
  const inventory = useGameStore((s) => s.inventory);
  const panel = useGameStore((s) => s.panel);
  const togglePanel = useGameStore((s) => s.togglePanel);

  return (
    <div className="inventory-bar">
      {inventory.length === 0 ? (
        <span className="inv-empty">物件栏 · 空</span>
      ) : (
        inventory.map((item) => (
          <button key={item.id} className="inv-slot" onClick={() => togglePanel('inventory')}>
            <span className="inv-name">{itemName(item.id)}</span>
            {item.count > 1 ? <span className="inv-count">×{item.count}</span> : null}
          </button>
        ))
      )}
      {panel === 'inventory' ? (
        <div className="inv-popover">
          <div className="inv-popover-head">
            <div>
              <span className="drawer-kicker">PERSONAL EFFECTS</span>
              <span className="drawer-title">随身物件</span>
            </div>
            <button
              className="icon-btn"
              onClick={() => togglePanel('inventory')}
              aria-label="关闭随身物件"
            >
              ×
            </button>
          </div>
          {inventory.length === 0 ? (
            <p>还没有捡起任何东西。</p>
          ) : (
            inventory.map((item) => (
              <div key={item.id} className="inv-row">
                <span className="inv-row-name">{itemName(item.id)}</span>
                <span className="inv-row-count">×{item.count}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
