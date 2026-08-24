import { useEffect } from 'react';
import { GameHost } from './ui/GameHost';
import { HUD } from './ui/HUD';
import { DialogueBox } from './ui/DialogueBox';
import { ArchiveDrawer } from './ui/ArchiveDrawer';
import { InventoryBar } from './ui/InventoryBar';
import { SaveMenu } from './ui/SaveMenu';
import { TitleScreen } from './ui/TitleScreen';
import { ChapterSettlement } from './ui/ChapterSettlement';
import { Toast } from './ui/Toast';
import { useGameStore } from './state/store';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const panel = useGameStore((s) => s.panel);
  // 章节结算：内容 flag ch1.chapter.end 驱动（随 world 持久，读档可重现）
  const settled = useGameStore((s) => s.screen === 'game' && !!s.world.flags['ch1.chapter.end']);

  // 结算期间始终锁定移动输入；面板开合（closePanel 会解锁）后重新上锁
  useEffect(() => {
    if (settled) useGameStore.setState({ inputLocked: true });
  }, [settled, panel]);

  // Esc 开合存档菜单（对话中不打断）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const st = useGameStore.getState();
      if (st.screen !== 'game' || st.conv.active) return;
      st.togglePanel('save');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 游戏时长累计（供存档 playTimeSec）
  useEffect(() => {
    if (screen !== 'game') return;
    const timer = window.setInterval(() => {
      const s = useGameStore.getState();
      if (s.screen === 'game') useGameStore.setState({ playTimeSec: s.playTimeSec + 1 });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  return (
    <div className="game-app">
      <GameHost />
      {screen === 'title' ? (
        <TitleScreen />
      ) : (
        <>
          <HUD />
          <DialogueBox />
          <ArchiveDrawer />
          <InventoryBar />
          <SaveMenu />
          {settled ? <ChapterSettlement /> : null}
        </>
      )}
      <Toast />
    </div>
  );
}
