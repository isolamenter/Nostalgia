import { useState } from 'react';
import { useGameStore } from '../state/store';
import { isFinal, nextStatuses } from '../engine/archive/archiveMachine';
import type { ArchiveEntry, ArchiveStatus, ArchiveType } from '../data/types';

const TYPE_LABEL: Record<ArchiveType, string> = {
  registration: '登记',
  'incident-report': '事件报告',
  ledger: '清点表',
  receipt: '单据',
  photograph: '照片',
  memo: '备忘',
  'cleanup-list': '清理清单',
};

const STATUS_LABEL: Record<ArchiveStatus, string> = {
  pending: '待核',
  verified: '已核对',
  retained: '保留',
  held: '悬置',
  discarded: '移出',
};

/** 档案抽屉：已发现档案列表 / 详情（含状态机操作与「现实解释」层） */
export function ArchiveDrawer() {
  const open = useGameStore((s) => s.panel === 'archive');
  const discovered = useGameStore((s) => s.world.discoveredArchives);
  const entries = useGameStore((s) => s.data.archives);
  const setArchiveStatus = useGameStore((s) => s.setArchiveStatus);
  const closePanel = useGameStore((s) => s.closePanel);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!open) return null;

  const ids = Object.keys(discovered).sort(
    (a, b) => (discovered[a]?.discoveredAt ?? 0) - (discovered[b]?.discoveredAt ?? 0),
  );
  const detail = openId ? entries.get(openId) : undefined;

  return (
    <div className="drawer archive-drawer">
      <div className="drawer-head">
        <div>
          <span className="drawer-kicker">QT / 卷宗 01</span>
          <span className="drawer-title">档案夹</span>
        </div>
        <button className="icon-btn" onClick={closePanel} aria-label="关闭档案夹">
          ×
        </button>
      </div>
      <div className="drawer-body">
        {ids.length === 0 ? (
          <p className="drawer-empty">还没有收录任何档案。去房间里看看。</p>
        ) : (
          ids.map((id, index) => {
            const entry = entries.get(id);
            const appear = discovered[id];
            if (!entry || !appear) return null;
            return (
              <div key={id} className="archive-card">
                <button
                  className="card-toggle"
                  onClick={() => setOpenId(openId === id ? null : id)}
                >
                  <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="card-type">{TYPE_LABEL[entry.type]}</span>
                  <span className="card-title">{entry.title}</span>
                  <span className={`card-status s-${appear.status}`}>
                    {STATUS_LABEL[appear.status]}
                  </span>
                </button>
                {detail && openId === id ? (
                  <div className="card-detail">
                    <div className="detail-lines">
                      {interpretationLines(entry, appear.status).map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                    </div>
                    <div className="detail-actions">
                      {nextStatuses(appear.status).map((s) => (
                        <button
                          className={`status-btn ${isFinal(s) ? 'final' : ''}`}
                          key={s}
                          onClick={() => setArchiveStatus(id, s)}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                      {isFinal(appear.status) ? (
                        <span className="status-note">已归档，不再变更</span>
                      ) : (
                        <span className="status-note">状态变更会改写现实解释</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function interpretationLines(entry: ArchiveEntry, status: ArchiveStatus): string[] {
  const interp = entry.interpretations?.find((i) => i.forStatus === status);
  return interp ? interp.lines : entry.lines;
}
