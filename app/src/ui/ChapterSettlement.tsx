import { useGameStore } from '../state/store';
import type { ArchiveStatus, ArchiveType } from '../data/types';

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

/**
 * 章节结算：由当前章 `settlement` 定义的数据驱动浮层。
 * 标题 / 主题 / 归档抬头编号 / 三结局行文 / 触发 flag 全部来自章节数据，
 * 支持章节链（`next` 存在时提供「下一章」，否则「回到标题」）。
 */
export function ChapterSettlement() {
  const chapterId = useGameStore((s) => s.world.currentChapter);
  const chapter = useGameStore((s) => s.data.chapters.get(chapterId));
  const discovered = useGameStore((s) => s.world.discoveredArchives);
  const entries = useGameStore((s) => s.data.archives);
  const flags = useGameStore((s) => s.world.flags);
  const openPanel = useGameStore((s) => s.openPanel);
  const advanceToChapter = useGameStore((s) => s.advanceToChapter);

  const settlement = chapter?.settlement;
  const next = chapter?.next;
  const canAdvance = useGameStore((s) => (next ? s.data.chapters.has(next) : false));
  if (!settlement) return null;

  const endingRaw = flags[settlement.endingFlag];
  const ending = typeof endingRaw === 'string' ? endingRaw : '';
  const endingText =
    settlement.endings[ending] ??
    settlement.endings[settlement.defaultEnding ?? 'held'] ?? { title: '', lines: [] };

  const ids = Object.keys(discovered).sort(
    (a, b) => (discovered[a]?.discoveredAt ?? 0) - (discovered[b]?.discoveredAt ?? 0),
  );

  return (
    <div className="settlement-layer">
      <div className="settlement-card">
        <div className="settlement-docket">
          <span>{settlement.docket ?? '档案 / 章节归档'}</span>
          <span>{settlement.number ?? ''}</span>
        </div>
        <p className="settlement-kicker">{settlement.kicker ?? ''}</p>
        <h2 className="settlement-title">《{chapter?.title ?? ''}》</h2>
        <p className="settlement-theme">{settlement.theme ?? ''}</p>

        <div className="settlement-archives">
          <p className="settlement-archives-head">档案清点</p>
          {ids.length === 0 ? (
            <p className="drawer-empty">这一章，你什么都没有留下。——你看了看空空的档案夹。</p>
          ) : (
            ids.map((id) => {
              const entry = entries.get(id);
              const appear = discovered[id];
              if (!entry || !appear) return null;
              return (
                <div key={id} className="archive-card settlement-arch-card">
                  <span className="card-type">{TYPE_LABEL[entry.type]}</span>
                  <span className="card-title">{entry.title}</span>
                  <span className={`card-status s-${appear.status}`}>
                    {STATUS_LABEL[appear.status]}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="settlement-ending">
          <p className="settlement-ending-title">{endingText.title}</p>
          {endingText.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>

        <div className="settlement-actions">
          <button onClick={() => openPanel('save')}>保存进度</button>
          {canAdvance ? (
            <button className="primary" onClick={() => advanceToChapter(next!)}>
              下一章
            </button>
          ) : null}
          <button
            className={canAdvance ? '' : 'primary'}
            onClick={() => useGameStore.setState({ screen: 'title' })}
          >
            回到标题
          </button>
        </div>
        <p className="settlement-foot">{settlement.foot ?? ''}</p>
      </div>
    </div>
  );
}
