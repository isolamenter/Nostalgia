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

/** 三结局结算行文（源自手稿 §十三–十四：回北方、站点停用、第二碗面） */
const ENDING_TEXT: Record<string, { title: string; lines: string[] }> = {
  retained: {
    title: '位置留着',
    lines: [
      '回北方以后，青潭上游站的停用申请很快通过。技术部门关掉旧接口，把残留数据转进历史库。',
      '清点表多出的一页没有作废。第二个名字被记下——替缺席者留一个位置。',
      '你自己也开始煮面。面下到一半，觉得多了，却没有抽回去。',
      '你从橱柜里拿出第二个碗。剩下的面只铺住碗底，你加了一点汤，夹了两根青菜。',
      '洗完之后，晾碗架原本只够放一只碗。你把旁边的杯子往里挪了一点，空出一个位置。',
      '两个碗，并排扣下去。',
    ],
  },
  held: {
    title: '位置空着',
    lines: [
      '回北方以后，青潭上游站的停用申请通过。站点状态变灰，下面写着：已撤销。',
      '那几份记录没有判。你放回待核篮，位置还空着——空着，也是一种记法。',
      '夜里你煮面。水开得很快，你放了一个鸡蛋，一把青菜，又抓了一把挂面。',
      '盛好一碗。锅里还剩一点，你没有立刻关火。',
      '看了很久，最后还是把剩下的留着，装进保鲜盒，放进冰箱。',
      '第二天早上，你把它带到了单位。',
    ],
  },
  discarded: {
    title: '收拾干净',
    lines: [
      '回北方以后，青潭上游站的停用申请通过。那几份异常的记录，你没有保留。',
      '第二份没有出现。',
      '你自己煮面，量正好。',
      '洗干净的碗，一只一只扣回晾碗架。位置刚好够，一只也不多。',
      '窗外有行李箱压过结冰地面，一格一格地响。',
      '你没有回头。',
    ],
  },
};

/** 章节结算：第一章《第二份》终局浮层（由内容 flag ch1.chapter.end 驱动） */
export function ChapterSettlement() {
  const discovered = useGameStore((s) => s.world.discoveredArchives);
  const entries = useGameStore((s) => s.data.archives);
  const ending = useGameStore((s) => s.world.flags['ch1.ending']);
  const saveToManual = useGameStore((s) => s.openPanel);

  const ids = Object.keys(discovered).sort(
    (a, b) => (discovered[a]?.discoveredAt ?? 0) - (discovered[b]?.discoveredAt ?? 0),
  );
  const endingText = ENDING_TEXT[typeof ending === 'string' ? ending : ''] ??
    ENDING_TEXT.held ?? { title: '', lines: [] };

  return (
    <div className="settlement-layer">
      <div className="settlement-card">
        <div className="settlement-docket">
          <span>青潭县档案馆 / 章节归档</span>
          <span>QT-01-002</span>
        </div>
        <p className="settlement-kicker">第一章终局 · 一页档案落定</p>
        <h2 className="settlement-title">《第二份》</h2>
        <p className="settlement-theme">不在场的人，是否仍算家庭成员？</p>

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
          <button onClick={() => saveToManual('save')}>保存进度</button>
          <button
            className="primary"
            onClick={() => useGameStore.setState({ screen: 'title' })}
          >
            回到标题
          </button>
        </div>
        <p className="settlement-foot">这一份档案暂时安静下来。下一次翻开，由你自己决定。</p>
      </div>
    </div>
  );
}
