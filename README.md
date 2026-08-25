# 《归档故乡》

> **档案会为现在，分配一个过去。**

Web 端 2D 叙事探索游戏。玩家在安置区、档案室、菜市场等「现实空间」里探索与调查，通过档案抽屉等「记录空间」整理、核对、保留或移出各类记录——记录如何被保存、被修改，会反过来改变这个世界的解释。

当前进度：**核心系统框架（Epic 0 + Epic 1）已交付**；**第一章《第二份》Vertical Slice（Epic 2）已完成** —— 一张可独立体验 30–60 分钟的完整章节（安置区住宅、档案室、菜市场、厨房四张地图，含调查 → 核对 → 裁决分支与 3 种结局）；**Epic 3 内容扩展（#016-019）已交付** —— 《照旧》（修鞋）、《临时停靠》（公交）、《水没有来》（档案审核）、《终章归档》四章全流程打通，章节间状态继承（档案/flag 跨章累加），构成一条完整的《第二份 → 照旧 → 临时停靠 → 水没有来 → 终章归档》章节链。内容数据化在 `app/src/data/story/`，新增章节按 `app/CONTENT_GUIDE.md` 编写。

## 技术栈

| 层 | 技术 |
|---|---|
| 构建 | Vite 8 + TypeScript 5.9 |
| 现实空间层 | **Phaser 3**（数据驱动地图 / 移动 / 场景切换 / 物件交互） |
| 记录空间层 | **React 19**（对话 / 分支 / 档案抽屉 / 物件栏 / 存档） |
| 状态 | Zustand 5（data / world / session / save 四 slice，统一世界状态） |
| 事件 | mitt（类型化领域事件总线，单向桥接） |
| 校验 | zod 4（"剧情数据库 JSON Schema"落地为运行时 schema） |
| 测试 | Vitest 4（引擎 / 存档 / 校验 / 状态机 / 寻路纯逻辑单测） |

架构遵循《docs/《归档故乡》游戏技术方案文档（Web架构）.md》：Phaser 负责故乡的空间，React 负责故乡的记录，统一世界状态串联单向循环——玩家探索现实空间 → 触发事件 → 修改记录状态 → 系统界面变化 → 现实产生新的解释。

## 快速开始

```bash
cd app
npm install
npm run dev          # 本地开发（改 JSON 即热更新）
npm run ci           # 一键：typecheck + lint + test + check:data + build
```

## npm scripts（`app/`）

| 命令 | 说明 |
|---|---|
| `dev` | Vite 开发服务器（HMR） |
| `build` | typecheck 后生产构建 |
| `preview` | 预览构建产物 |
| `typecheck` | tsc 双工程（app / node）无错 |
| `lint` | ESLint（flat config + typed linting） |
| `format` / `format:check` | Prettier |
| `test` / `test:watch` | Vitest |
| `check:data` | 磁盘全量剧情数据 zod 校验 |
| `merge:drafts` | 多章节并行产出 `_drafts/*.json` 合并进共享库（去重 + zod 校验） |
| `ci` | 上述全部串联 |

## 目录速览

```
Nostalgia/
├── docs/                      # 8 份设计文档（技术方案 / GDD / JSON规范 / 第一章规格 / Backlog / 主稿 / 地图规范 / 视觉规范）
├── .github/workflows/ci.yml   # CI
└── app/
    ├── src/data/              # ★ 内容数据（story/characters/items/maps/archives 五目录 JSON）
    ├── src/data/…             # 领域类型 types.ts + zod schemas.ts + loaders（glob 导入 + HMR）
    ├── src/engine/            # 纯逻辑：dialogue 对话/分支、archive 状态机、save 存档、pathfinding
    ├── src/state/store.ts     # 统一世界状态
    ├── src/bridge/            # mitt 总线 + startBridge
    ├── src/game/              # Phaser 层（Bootstrap/MapScene/Player/Interactable/Decor）
    ├── src/ui/                # React 记录空间（HUD/对话/档案抽屉/物件/存档/标题）
    └── scripts/check-data.ts  # 数据校验（CI）
```

## 从框架到内容

剧情、角色、物件、地图、档案**全部数据化**，存放在 `app/src/data/` 下（结构见上）。新增内容只需要改 JSON 文件，保存即热更新生效，无需改代码：

```bash
cd app && npm run check:data   # 校验所有 JSON 是否合法
```

内容生产规范、字段对照（规范原文 vs 框架扩展）、新增章节/人物/物件/档案的步骤，见 **[app/CONTENT_GUIDE.md](app/CONTENT_GUIDE.md)**。

## CI

`.github/workflows/ci.yml`：push / PR → typecheck + lint + vitest + check:data + build。

## 阶段规划（对齐 docs/ Backlog）

| 阶段 | 状态 | 对应 Epic |
|---|---|---|
| Epic 0 项目初始化（#001-003） | ✅ | 已交付 |
| Epic 1 核心系统（#004-010） | ✅ | 已交付（移动/场景/对话/分支/物件调查/档案收集/存档） |
| Epic 2 第一章 Vertical Slice（#011-015） | ✅ | 已交付（《第二份》四地图全流程 / 3 结局） |
| Epic 3 内容扩展（#016-019） | ✅ | 已交付（《照旧》修鞋 / 《临时停靠》公交 / 《水没有来》档案审核 / 《终章归档》+ 章节链状态继承） |
| Epic 4 发布（#020-022） | 待后续 | 部署 / 性能 / 测试打包 |