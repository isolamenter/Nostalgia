import { describe, expect, it } from 'vitest';
import { createGameStore } from '../store';
import type { DataCatalog } from '../../data/loaders';
import { archiveStatusFlag } from '../../engine/constants';
import type { ChapterData } from '../../data/types';
import { MemoryStorage } from '../../engine/save/storage';

function mkCatalog(): DataCatalog {
  const chapter: ChapterData = {
    chapterId: 'chT',
    title: '测试章节',
    nodes: [
      { id: 'a1', mode: 'prose', text: '进屋。', next: 'a2' },
      {
        id: 'a2',
        mode: 'dialogue',
        speaker: 'someone',
        text: '怎么处理这份档案？',
        choices: [
          {
            id: 'keep',
            text: '保留',
            flags: [{ flag: archiveStatusFlag('arc1'), value: 'retained' }],
            next: 'a3',
          },
          { id: 'drop', text: '移出', next: 'dropped' },
        ],
      },
      {
        id: 'a3',
        mode: 'prose',
        text: '处理中。',
        next: [
          { when: { hasFlag: archiveStatusFlag('arc1'), equals: 'retained' }, to: 'a4' },
          { to: 'a2' },
        ],
      },
      { id: 'a4', mode: 'prose', text: '已保留。', next: '$END' },
      { id: 'dropped', mode: 'prose', text: '已移出。', next: '$END' },
    ],
  };
  return {
    chapters: new Map([['chT', chapter]]),
    characters: new Map([['someone', { id: 'someone', name: '某人' }]]),
    items: new Map(),
    maps: new Map(),
    archives: new Map([['arc1', { id: 'arc1', type: 'ledger', title: '清点表', lines: ['x'] }]]),
  };
}

describe('统一世界状态（store 集成）', () => {
  it('对话推进：散文链 → 选择题 → flags → 条件跳转 → 结束', () => {
    const store = createGameStore(new MemoryStorage());
    store.setState({ data: mkCatalog() });
    const { world } = store.getState();
    store.setState({ world: { ...world, currentChapter: 'chT' } });

    store.getState().openDialogue('a1');
    expect(store.getState().conv.active).toBe(true);
    expect(store.getState().conv.history.at(-1)?.text).toBe('进屋。');
    expect(store.getState().conv.pending).toEqual({ type: 'node', id: 'a2' });

    store.getState().advance();
    expect(store.getState().conv.showingChoices).toBe(true);

    store.getState().choose('keep');
    // 选项 flags 落地
    expect(store.getState().world.flags[archiveStatusFlag('arc1')]).toBe('retained');
    // 选择轨迹
    expect(store.getState().world.choices.a2).toBe('keep');
    // 条件跳转已消费 → 进入 a3
    expect(store.getState().conv.currentNode).toBe('a3');
    expect(store.getState().conv.pending).toEqual({ type: 'node', id: 'a4' });

    store.getState().advance();
    expect(store.getState().conv.currentNode).toBe('a4');
    store.getState().advance();
    expect(store.getState().conv.active).toBe(false);
  });

  it('档案收集与状态机联动', () => {
    const store = createGameStore(new MemoryStorage());
    store.setState({ data: mkCatalog() });

    store.getState().discoverArchive('arc1');
    expect(store.getState().world.discoveredArchives.arc1?.status).toBe('pending');
    expect(store.getState().world.flags[archiveStatusFlag('arc1')]).toBe('pending');

    // 重复发现幂等
    store.getState().discoverArchive('arc1');
    expect(Object.keys(store.getState().world.discoveredArchives)).toHaveLength(1);

    const ok = store.getState().setArchiveStatus('arc1', 'retained');
    expect(ok).toBe(true);
    expect(store.getState().world.discoveredArchives.arc1?.status).toBe('retained');

    // 终态不可再迁移
    expect(store.getState().setArchiveStatus('arc1', 'pending')).toBe(false);
  });

  it('存档写入并能跨实例读回', () => {
    const mem = new MemoryStorage();
    const store = createGameStore(mem);
    store.getState().setMap('ch1.maps.home');
    store.getState().applyFlag('ch1.testflag', 'yes');
    store.getState().autosave();

    const store2 = createGameStore(mem);
    const ok = store2.getState().loadFromSlot('autosave');
    expect(ok).toBe(true);
    expect(store2.getState().world.flags['ch1.testflag']).toBe('yes');
    expect(store2.getState().currentMap).toBe('ch1.maps.home');
  });

  it('toast 显示与清除', () => {
    const store = createGameStore(new MemoryStorage());
    store.getState().showToast('测试');
    expect(store.getState().toast?.message).toBe('测试');
    store.getState().clearToast();
    expect(store.getState().toast).toBeNull();
  });
});
