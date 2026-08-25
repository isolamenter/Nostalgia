/** 实物显示名：优先进内容侧展示名，兜底去掉前缀（demo./chN. 等）后的 .item. 段。
 *  规范 §7.5：物件名称使用玩家认识的名称，不显示内部数据 ID。 */
const ITEM_LABEL: Record<string, string> = {
  'ch1.item.prescription': '药方小票',
  'ch1.item.crackedBowl': '裂纹瓷碗',
  'ch1.item.photocopy': '复印页',
  'ch1.item.mothersMedicine': '母亲的药',
};

export function itemName(id: string): string {
  if (ITEM_LABEL[id]) return ITEM_LABEL[id];
  const marker = '.item.';
  const idx = id.indexOf(marker);
  return idx >= 0 ? id.slice(idx + marker.length) : id;
}
