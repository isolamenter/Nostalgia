import Phaser from 'phaser';
import type { InteractableDef } from '../../data/types';
import { useGameStore } from '../../state/store';
import { evalCondition } from '../../engine/dialogue/conditions';
import {
  TILE,
  TOKENS,
  cssColor,
  cssRgba,
  darken,
  rgb,
  rgbToken,
  UI_FONT,
  MONO_FONT,
} from '../constants';
import { ensureItemTexture } from './Decor';
import { itemName } from '../../data/items/names';
import type { Player } from './Player';

export class Interactable extends Phaser.GameObjects.Container {
  readonly def: InteractableDef;
  private readonly player: Player;
  private readonly spriteName: string;
  private hintLabel: Phaser.GameObjects.Text | null = null;
  private near = false;
  private done = false;

  constructor(scene: Phaser.Scene, def: InteractableDef, player: Player) {
    ensureItemTexture(scene);
    super(scene, (def.x + 0.5) * TILE, (def.y + 0.5) * TILE);
    this.def = def;
    this.player = player;
    this.spriteName = def.kind === 'npc' ? 'placeholder-npc' : 'placeholder-item';
    this.setDepth(5);

    const tileColor = def.kind === 'npc' ? rgbToken('danger') : rgbToken('accent');
    this.add(
      new Phaser.GameObjects.Ellipse(
        scene,
        3,
        7,
        TILE * 0.82,
        TILE * 0.34,
        rgb(darken(TOKENS.bg0, 0.55)),
        0.32,
      ).setOrigin(0.5),
    );
    this.add(
      new Phaser.GameObjects.Rectangle(scene, 0, 0, TILE * 0.82, TILE * 0.82, tileColor, 0.12)
        .setStrokeStyle(1, tileColor, 0.5)
        .setOrigin(0.5),
    );
    const go = scene.add.image(0, 0, this.spriteName).setOrigin(0.5);
    this.add(go);

    const label = scene.add
      .text(0, TILE * 0.57, def.name, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        color: cssColor('paper'),
        backgroundColor: cssRgba('bg0', 0.76),
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);
    this.add(label);

    scene.add.existing(this);
  }

  get tileCenter(): { x: number; y: number } {
    return { x: this.def.x, y: this.def.y };
  }

  /** 每帧邻近检测；返回玩家是否在范围内（供场景高亮） */
  tick(): boolean {
    const d = Math.hypot(this.player.x - this.x, this.player.y - this.y);
    this.near = d <= this.def.interactRange * TILE;
    this.setAlpha(this.done ? 0.45 : this.near ? 1 : 0.85);
    return this.near;
  }

  showHint(): void {
    if (!this.hintLabel) {
      this.hintLabel = this.scene.add
        .text(this.x, this.y - TILE * 0.8, 'E', {
          fontFamily: MONO_FONT,
          fontSize: '13px',
          color: cssColor('paper'),
          backgroundColor: cssRgba('bg0', 0.8),
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(20);
    }
    this.hintLabel.setVisible(true);
  }

  hideHint(): void {
    if (this.hintLabel) this.hintLabel.setVisible(false);
  }

  interact(): void {
    if (this.done && this.def.once) return;
    const store = useGameStore.getState();
    const { world } = store;

    // 门禁：不满足 → unmetInspect（或仅提示）
    if (
      this.def.requirements &&
      !evalCondition(this.def.requirements, { world, currentChapter: world.currentChapter })
    ) {
      if (this.def.unmetInspect) useGameStore.getState().openDialogue(this.def.unmetInspect);
      else useGameStore.getState().showToast(`${this.def.name} …还没到你该知道的时候`);
      return;
    }

    // 调查获得档案
    if (this.def.provideArchive && !world.discoveredArchives[this.def.provideArchive]) {
      useGameStore.getState().discoverArchive(this.def.provideArchive, this.def.id);
    }

    // 收集实物入背包
    if (this.def.collect) {
      useGameStore.getState().addToInventory(this.def.collect.id, this.def.collect.count ?? 1);
      useGameStore.getState().showToast(`获得了物品：${itemName(this.def.collect.id)}`);
    }

    // 调查文本 / NPC 对话
    if (this.def.inspect) {
      useGameStore.getState().openDialogue(this.def.inspect);
    } else if (this.def.dialogue) {
      useGameStore.getState().openDialogue(this.def.dialogue);
    }

    if (this.def.once) {
      useGameStore.getState().markInteracted(this.def.id);
      this.done = true;
    }
  }
}
