import { useGameStore } from '../state/store';
import type { PanelId } from '../data/types';

export function HUD() {
  const mapName = useGameStore((s) => s.data.maps.get(s.currentMap ?? '')?.name ?? '');
  const archiveCount = useGameStore((s) => Object.keys(s.world.discoveredArchives).length);
  const panel = useGameStore((s) => s.panel);
  const togglePanel = useGameStore((s) => s.togglePanel);

  const btn = (id: PanelId, label: string, extra?: string) => (
    <button
      className={`hud-btn ${panel === id ? 'active' : ''}`}
      onClick={() => togglePanel(id)}
      aria-pressed={panel === id}
    >
      <span>{label}</span>
      {extra ? <span className="hud-badge">{extra}</span> : null}
    </button>
  );

  return (
    <div className="hud">
      <div className="hud-left">
        <span className="hud-eyebrow">当前位置 / Location</span>
        <span className="hud-map">{mapName}</span>
      </div>
      <div className="hud-buttons">
        {btn('archive', '档案', String(archiveCount))}
        {btn('inventory', '物件')}
        {btn('save', '存档')}
      </div>
      <span className="hud-tip">WASD / 点击寻路 · E 交互 · Esc 存档</span>
    </div>
  );
}
