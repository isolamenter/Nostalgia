# 《归档故乡》内容生产指引（CONTENT_GUIDE）

本指南面向内容作者。**剧情、角色、物件、地图、档案全部数据化**，放在 `app/src/data/` 下，改 JSON 即热更新（保存后无需重启 dev server），跑 `npm run check:data` 校验合法性。

## 1. 数据目录一览

| 目录 | 文件 | 内容 | 校验 schema |
|---|---|---|---|
| `src/data/story/` | `chapter01.json` | 章节（剧情节点图） | `chapterFileSchema` |
| `src/data/characters/` | `characters.json` | 角色 | 角色数组 |
| `src/data/items/` | `objects.json` | 可交互物件 / NPC | 物件数组 |
| `src/data/maps/` | `maps.json` | 地图 / 场景（栅格驱动） | 地图数组 |
| `src/data/archives/` | `archives.json` | 档案条目（框架扩展目录） | 档案数组 |

> `archives.json` 是规范文档四目录之外、由框架新增的目录，用于存放档案内容定义（发现来源、卡面行、按状态变化的"现实解释"）。

所有字段键名使用**英文小写**。schema 为 **strict 模式**：多写一个未知字段会直接校验失败，防止笔误悄悄飘进游戏。

## 2. 规范字段 vs 框架扩展（务必区分）

### 剧情节点 `StoryNode`

| 字段 | 来源 | 说明 |
|---|---|---|
| `id` | 规范 | 全局唯一 |
| `speaker` | 规范* | *框架放宽为可选：散文段落可省略（无 speaker ⇒ 散文模式） |
| `text` | 规范 | 允许多行 `\n` 长散文 |
| `choices` | 规范 | 选择列表 |
| `flags` | 规范 | 进入节点时应用的状态变更 |
| `next` | 框架扩展 | 线性/条件跳转（`"节点id"` 或 `[{when,to}]` 规则数组） |
| `mode` | 框架扩展 | `"prose"` / `"dialogue"`（缺省按有无 speaker 推断） |
| `once` | 框架扩展 | 一次性节点 |
| `note` | 框架扩展 | 给作者的备注，不影响运行 |

**节点如何链接（框架扩展的 `next` 约定）：**
- 散文长段：每段一个节点，`next: "下一节点id"` 串成推进链。
- 结束对话：`next: "$END"`。
- 条件分流：`next: [{ when: {...}, to: "A" }, { to: "兜底" }]`（数组按序求值，命中的第一条生效；`when` 可省略作兜底）。

### 选择项 `Choice`

| 字段 | 来源 | 说明 |
|---|---|---|
| `id` | 框架扩展 | 稳定 id（存档/日志需要） |
| `text` | 规范 | 选项文案 |
| `next` | 框架扩展 | 选中后跳转（缺省用节点级 next） |
| `flags` | 规范 | 选中时应用 |
| `condition` | 框架扩展 | 满足才显示该选项 |

### 档案状态 `ArchiveStatus`

`unknown(未发现) → pending(待核) → verified(已核对)`，以及 `pending/verified/held → {retained 保留, held 悬置, discarded 移出}`；`retained/discarded` 为终态。**发现必先到 pending**（先保留再决定）。

档案状态回写 flag 约定：`archive.<档案id>.status`。在**任何**节点的 `flags` 里写 `{ "flag": "archive.demo.archive.X.status", "value": "retained" }`，框架会自动完成状态机转换 + 同步 `discoveredArchives` + 触发自动存档——这是"判断是否保留→改变档案状态"闭环的推荐写法。

### 条件 `Condition`（框架扩展，四处可用：next 规则 / 选项 condition / 物件 requirements）

- `{ "hasFlag": "f", "equals": true }` — flag 存在（`equals` 可选，提供则严格相等）
- `{ "hasArchive": "档案id" }` — 已发现该档案
- `{ "chapterEquals": "ch1" }`
- `{ "all": [...] }` / `{ "any": [...] }` / `{ "not": {...} }`

## 3. 新增一个章节

1. 复制 `src/data/story/chapter01.json` → `chapter02.json`，改 `chapterId` 与 `title`。
2. 重写 `nodes` 数组；链式推进记得用 `next`，收尾指针 `next: "$END"`。
3. 其余章节可被 `loaders` 自动收集（`import.meta.glob` 扫描 `story/*.json`），无需注册。
4. 让物件/NPC 的 `inspect` / `dialogue` 指向新的入口节点 id；跨章节跳转不支持（节点图按章独立）。

## 4. 新增角色

在 `characters.json` 加一个对象：

```json
{ "id": "ch2.char.who", "name": "谁", "role": "…", "color": "#…", "shortBio": "…" }
```

节点 `speaker` 填角色 `id`（未知 speaker id 属于内容 bug，`check:data` 不会拦，但节点图会正常显示原始 id——请保持引用正确）。

## 5. 新增可调查物件 / NPC

1. 在 `objects.json` 加一项（`kind: "object" | "npc"`），`location` 指向地图 id，`x/y` 为栅格坐标。
2. 把该物件的 `id` 加进对应地图的 `interactables` 数组。
3. 写调查/对话入口节点（`inspect` 或 `dialogue`）。

物件行为字段：

```json
{
  "id": "ch1.object.riceBowl",
  "name": "饭碗",
  "kind": "object",
  "location": "demo.maps.residence",
  "x": 11, "y": 15,
  "interactRange": 1.5,
  "inspect": "demo.s.bowl.inspect.1",        // 调查入口节点
  "provideArchive": "demo.archive.entryTally", // 调查后收录的档案
  "requirements": { "hasArchive": "…" },      // 门禁（不满足走 unmetInspect）
  "unmetInspect": "demo.s.marketKeeper.before",
  "collect": { "id": "ch1.item.storageReceipt" }, // 实物进背包
  "once": true
}
```

## 6. 新增档案

在 `archives.json` 加一项：

```json
{
  "id": "demo.archive.entryTally",
  "type": "ledger",
  "title": "临时安置清点表",
  "lines": ["实到 3 户", "+1（铅笔）"],
  "foundFrom": "…",
  "interpretations": [
    { "forStatus": "retained", "lines": ["保留后：多出一页。"] },
    { "forStatus": "discarded", "lines": ["移出后：被红笔划掉。"] }
  ]
}
```

- `interpretations` 是**状态对应的"现实解释"层**：档案状态改变后再打开抽屉，会显示对应状态的行文——这是"系统界面变化→现实产生新解释"的关键。
- 入库路径：物件的 `provideArchive` → 玩家调查后自动 `discoverArchive`（初始 `pending`）→ 抽屉可标记状态。

## 7. 新增地图

在 `maps.json` 加一项。地图是**栅格驱动**：`width/height`、`solidTiles`（不可走格）、`spawn`、`exits`（出口 Zone → 目标地图）、`decorate`（占位视觉）、`bg`（氛围色板）。程序化生成碰撞体与占位装饰，无需美术资源。

## 8. 硬性规则

- 字段键名英文小写；id 全局唯一。
- 门禁（requirements）依赖的 flag/档案必须先于使用时被写入（示例顺序：先调查饭碗得档案 → 摊主解锁新话）。
- 内容作者建议直接用 `demo.` 前缀做占位交互演示；正式内容按 `ch<章节>.<域>.<名字>` 命名。
- 提交前必须通过：`npm run check:data` 全绿。

## 9. HMR（内容热更新）

改任意 JSON 保存 → 编辑器/Vite 判定模块失效 → 重新校验并 push 进 store，**页面无需刷新**即生效。若写入非法数据，控制台会打印校验失败原因，且旧数据保持不动（不崩页）。

## 10. demo 端到端验证路径（框架自检）

`npm run dev` 后依次：标题页「开始新的档案」 → 散文开场 → 察饭碗（收档 `entryTally`）→ 捡行李（入包）→ 出门到档案室开铁皮柜（收档 `anomalousLedger`）→ 档案抽屉对它选「保留/悬置/移出」→ 回档案员/摊主对话可见状态影响 → Esc 手动存档 → F5 → 「继续」回到原位置、档案与状态俱在。