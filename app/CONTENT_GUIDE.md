# 《归档故乡》内容生产指引（CONTENT_GUIDE）

本指南面向内容作者。**剧情、角色、物件、地图、档案全部数据化**，放在 `app/src/data/` 下，改 JSON 即热更新（保存后无需重启 dev server），跑 `npm run check:data` 校验合法性。

## 1. 数据目录一览

| 目录                   | 文件              | 内容                     | 校验 schema         |
| ---------------------- | ----------------- | ------------------------ | ------------------- |
| `src/data/story/`      | `chapter01.json`  | 章节（剧情节点图）       | `chapterFileSchema` |
| `src/data/characters/` | `characters.json` | 角色                     | 角色数组            |
| `src/data/items/`      | `objects.json`    | 可交互物件 / NPC         | 物件数组            |
| `src/data/maps/`       | `maps.json`       | 地图 / 场景（栅格驱动）  | 地图数组            |
| `src/data/archives/`   | `archives.json`   | 档案条目（框架扩展目录） | 档案数组            |

> `archives.json` 是规范文档四目录之外、由框架新增的目录，用于存放档案内容定义（发现来源、卡面行、按状态变化的"现实解释"）。

所有字段键名使用**英文小写**。schema 为 **strict 模式**：多写一个未知字段会直接校验失败，防止笔误悄悄飘进游戏。

## 2. 规范字段 vs 框架扩展（务必区分）

### 剧情节点 `StoryNode`

| 字段      | 来源     | 说明                                                     |
| --------- | -------- | -------------------------------------------------------- |
| `id`      | 规范     | 全局唯一                                                 |
| `speaker` | 规范*    | *框架放宽为可选：散文段落可省略（无 speaker ⇒ 散文模式） |
| `text`    | 规范     | 允许多行 `\n` 长散文                                     |
| `choices` | 规范     | 选择列表                                                 |
| `flags`   | 规范     | 进入节点时应用的状态变更                                 |
| `next`    | 框架扩展 | 线性/条件跳转（`"节点id"` 或 `[{when,to}]` 规则数组）    |
| `mode`    | 框架扩展 | `"prose"` / `"dialogue"`（缺省按有无 speaker 推断）      |
| `once`    | 框架扩展 | 一次性节点                                               |
| `note`    | 框架扩展 | 给作者的备注，不影响运行                                 |

**节点如何链接（框架扩展的 `next` 约定）：**

- 散文长段：每段一个节点，`next: "下一节点id"` 串成推进链。
- 结束对话：`next: "$END"`。
- 条件分流：`next: [{ when: {...}, to: "A" }, { to: "兜底" }]`（数组按序求值，命中的第一条生效；`when` 可省略作兜底）。

### 选择项 `Choice`

| 字段        | 来源     | 说明                            |
| ----------- | -------- | ------------------------------- |
| `id`        | 框架扩展 | 稳定 id（存档/日志需要）        |
| `text`      | 规范     | 选项文案                        |
| `next`      | 框架扩展 | 选中后跳转（缺省用节点级 next） |
| `flags`     | 规范     | 选中时应用                      |
| `condition` | 框架扩展 | 满足才显示该选项                |

### 档案状态 `ArchiveStatus`

`unknown(未发现) → pending(待核) → verified(已核对)`，以及 `pending/verified/held → {retained 保留, held 悬置, discarded 移出}`；`retained/discarded` 为终态。**发现必先到 pending**（先保留再决定）。

档案状态回写 flag 约定：`archive.<档案id>.status`。在**任何**节点的 `flags` 里写 `{ "flag": "archive.demo.archive.X.status", "value": "retained" }`，框架会自动完成状态机转换 + 同步 `discoveredArchives` + 触发自动存档——这是"判断是否保留→改变档案状态"闭环的推荐写法。

### 条件 `Condition`（框架扩展，四处可用：next 规则 / 选项 condition / 物件 requirements）

- `{ "hasFlag": "f", "equals": true }` — flag 存在（`equals` 可选，提供则严格相等）
- `{ "hasArchive": "档案id" }` — 已发现该档案
- `{ "chapterEquals": "ch1" }`
- `{ "all": [...] }` / `{ "any": [...] }` / `{ "not": {...} }`

## 3. 新增一个章节

1. 复制 `src/data/story/chapter01.json` → `chapter02.json`，改 `chapterId` 与 `title`，并补 `startMap`：**本章起点地图 id**（新游戏出生点，`MapScene`/`newGame` 优先读取）。
2. 可加 `intro`：`{ "flag": "<一次性flag>", "node": "<章节内开场节点id>" }` —— 首次进入 `startMap` 时自动展开该散文节点（数据驱动开场，替代框架里的硬编码钩子）。
3. 重写 `nodes` 数组；节点链式推进的 `next` 只指向**本章内节点 id** 或 `$END`。节点图的 next 与章节链的 next（第 6 条）是两回事，不要混用。
4. 其余章节可被 `loaders` 自动收集（`import.meta.glob` 扫描 `story/*.json`），无需注册。
5. 让物件/NPC 的 `inspect` / `dialogue` 指向新的入口节点 id；节点图按章独立，跨章不走节点跳转。
6. **章节链（框架扩展）**：`next` 填下一章 `chapterId`，把多章串成链条。终局结算浮层据此提供「下一章」按钮——`advanceToChapter` 会**保留 world 状态（档案/flag/选择随周目累加，即「状态继承」）、只重置会话相位**，进入下一章 `startMap`。章节链入口 = 不被任何章节 `next` 引用的那个章节（头章），`newGame` 自动推导，无需硬编码。
7. **结算定义（框架扩展）**：`settlement` 数据化终局浮层，字段如下。章节未设 `settlement` 则无结算浮层。

   | 字段 | 说明 |
   |---|---|
   | `triggerFlag` | **必填**。终局选择里写入的 flag；为 true 时弹出结算（如 `ch1.chapter.end`） |
   | `endingFlag` | **必填**。记录结局变体（retained/held/discarded）的 flag（如 `ch1.ending`） |
   | `endings` | **必填**。各结局变体 → `{ title, lines[] }`（三结局行文不同） |
   | `defaultEnding` | 可选。读不到 `endingFlag` 时兜底变体（缺省 `held`） |
   | `docket` / `number` / `kicker` / `theme` / `foot` | 可选。结语抬头、归档编号、前置小字、主题句、底部小字 |

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
  "x": 11,
  "y": 15,
  "interactRange": 1.5,
  "inspect": "demo.s.bowl.inspect.1", // 调查入口节点
  "provideArchive": "demo.archive.entryTally", // 调查后收录的档案
  "requirements": { "hasArchive": "…" }, // 门禁（不满足走 unmetInspect）
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

## 10. 第一章《第二份》端到端验证路径

`npm run dev` 后依次：标题页「开始新的档案」 → 自动开场散文（回家）→ 门口察手机（收档 `signal`）→ 饭桌察碗（收档 `bowls`）/ 药盒（收档 `pillbox`）/ 桌角小票（入包）→ 厨房察电饭锅、晾碗架收裂纹瓷碗 → 出门到县档案馆、收齐 `ledger` / `distribution` / `transfer` 三份记录、与档案员黄对话（红圈选项在收档后出现）→ 菜市场与摊主对话（收 `signal` 后解锁「多留一份」话）、药房买药入包 → 回家先与母亲说话被措辞挡下 → 收齐四份异常记录后再与母亲 → 完整饭桌事件 → 终局三选一 → 章节结算浮层（按三选一显示不同结局行文 + 档案状态汇总）→ 保存/回到标题。

> 旧 `demo.*` 占位数据已被正式第一章取代；旧 demo 存档因引用已删 id 会「地图数据缺失」，开发期删除即可。
