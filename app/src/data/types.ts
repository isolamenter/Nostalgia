/**
 * 《归档故乡》领域类型契约（Epic 1 数据层地基）
 *
 * 本文件定义一切游戏/剧情/档案/地图数据在静态类型层面的形状。
 * 运行时校验由 src/data/schemas.ts（zod）承担，二者通过
 * `ZodType<...>` 注解在编译期保持一致，避免单测与运行时漂移。
 *
 * 命名沿用剧情数据库与JSON Schema规范文档的英文小写键名约定。
 * 带「框架扩展」注释的字段是规范文档未定义、由本框架新增的约定，
 * 内容生产者必须区分（见 CONTENT_GUIDE.md）。
 */

/** 状态值类型：boolean | string | number */
export type FlagValue = boolean | string | number

/**
 * 条件谓词（框架扩展）：在对话/选择/物件门禁中求值的表达式树。
 */
export type Condition =
  | { hasFlag: string; equals?: FlagValue }
  | { hasArchive: string }
  | { chapterEquals: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }

/** 状态变更（规范 flags 单条落地） */
export interface FlagChange {
  flag: string
  value: FlagValue
}

/** 选择项（规范 choices 单条） */
export interface Choice {
  /** 框架扩展：稳定 id，用于存档/日志/追溯 */
  id: string
  text: string
  /** 框架扩展：选中后的跳转目标节点 id（缺省用节点级 next） */
  next?: string
  /** 选中时应用的状态变更 */
  flags?: FlagChange[]
  /** 框架扩展：仅当条件满足时展示该选项 */
  condition?: Condition
}

/** 条件跳转规则（框架扩展）；when 缺省 = 无条件兜底规则 */
export interface NextRule {
  when?: Condition
  /** 目标节点 id，或哨兵 '$END' 结束对话 */
  to: string
}

/** next 字段：单一目标或规则数组（数组按序求值，命中即跳） */
export type NextTarget = string | NextRule[]

/**
 * 剧情节点（规范五字段 id/speaker/text/choices/flags + 框架扩展）
 *
 * speaker 规范为必填，但主文档《代行故乡》是弱归属散文，故放宽为可选：
 * 缺省 speaker 的节点即散文段落（mode 缺省时按 prose 渲染）。
 */
export interface StoryNode {
  /** 规范 */
  id: string
  /** 规范（框架放宽为可选：散文段落缺省） */
  speaker?: string
  /** 规范（允许多行 \n 长散文） */
  text: string
  /** 规范 */
  choices?: Choice[]
  /** 规范（进入节点时应用） */
  flags?: FlagChange[]
  /** 框架扩展：链式推进（字符串=单后继，数组=按序条件求值） */
  next?: NextTarget
  /** 框架扩展：渲染提示（缺省由 speaker 推断） */
  mode?: 'prose' | 'dialogue'
  /** 框架扩展：一次性节点（阻止重复回放） */
  once?: boolean
  /** 框架扩展：给内容作者的内部备注（不影响运行） */
  note?: string
}

/** 章节数据（/story/chapterNN.json） */
export interface ChapterData {
  chapterId: string
  title: string
  nodes: StoryNode[]
}

/** 档案媒介类型 */
export type ArchiveType =
  | 'registration'
  | 'incident-report'
  | 'ledger'
  | 'receipt'
  | 'photograph'
  | 'memo'
  | 'cleanup-list'

/**
 * 档案状态机状态。
 * unknown(未发现) → pending(待核) → verified(已核对)
 *                        └→ retained(保留) / held(悬置·临时保管) / discarded(移出)
 */
export type ArchiveStatus = 'pending' | 'verified' | 'retained' | 'held' | 'discarded'

/** 档案某状态对应的「现实解释」行文（框架扩展：状态改变后再次查看显示不同内容） */
export interface ArchiveInterpretation {
  forStatus: ArchiveStatus
  title?: string
  lines: string[]
}

/** 档案条目（命名为 ArchiveEntry，与规范核心对象一致） */
export interface ArchiveEntry {
  id: string
  type: ArchiveType
  title: string
  /** 卡面行（可用制表对齐；前端等宽渲染） */
  lines: string[]
  /** 来自哪个交互点 id（元信息） */
  foundFrom?: string
  /** 框架扩展：按状态显示的解释层 */
  interpretations?: ArchiveInterpretation[]
}

/** 可交互点（物件/NPC）（/items/objects.json） */
export interface InteractableDef {
  id: string
  name: string
  kind: 'object' | 'npc'
  /** 所在地图 location id */
  location: string
  /** 交互点（格子坐标） */
  x: number
  y: number
  /** 邻近检测半径（格） */
  interactRange: number
  /** 调查文本：入口节点 id */
  inspect?: string
  /** NPC 对话入口节点 id */
  dialogue?: string
  /** 调查后获得的档案 id（入库 + toast） */
  provideArchive?: string
  /** 框架扩展：前置门禁（不满足时优先走 unmetInspect） */
  requirements?: Condition
  /** 门禁未满足时调查指向的入口节点 id */
  unmetInspect?: string
  /** 实物进背包 */
  collect?: { id: string; count?: number }
  once?: boolean
}

/** 装饰物（程序化占位图形） */
export interface DecorDef {
  kind: 'rect' | 'label'
  x: number
  y: number
  w?: number
  h?: number
  color: string
  text?: string
}

/** 出口 Zone（玩家进入后切换地图） */
export interface ExitDef {
  id: string
  x: number
  y: number
  w: number
  h: number
  to: string
}

/** 地点/地图（/maps/maps.json） */
export interface LocationDef {
  id: string
  name: string
  chapter: string
  /** 栅格宽高（格） */
  width: number
  height: number
  /** 碰撞栅格（数据驱动 solid） */
  solidTiles: Array<[number, number]>
  spawn: { x: number; y: number }
  decorate: DecorDef[]
  exits: ExitDef[]
  /** 该地图中的物件 id 列表（渲染时按 objects.json 查） */
  interactables: string[]
  /** 占位氛围色板 */
  bg: { color: string; accent: string }
}

export interface Character {
  id: string
  name: string
  role?: string
  color?: string
  shortBio?: string
}

/** 已发现档案的出现状态 */
export interface AppearanceState {
  status: ArchiveStatus
  discoveredAt: number
}

export interface RelationState {
  value?: FlagValue
  seen: number
}

/**
 * 世界状态（规范五项 + 扩展）
 * ① 当前章节/② 已发现档案/③ 人物关系/④ 玩家选择/⑤ 结局状态
 */
export interface WorldState {
  /** 世界快照版本（存档迁移用） */
  schemaVersion: 1
  /** 规范① 当前章节 */
  currentChapter: string
  /** 规范② 已发现档案：id → {status, discoveredAt} */
  discoveredArchives: Record<string, AppearanceState>
  /** 规范③ 人物关系（框架简化记录） */
  relations: Record<string, RelationState>
  /** 规范④ 玩家选择：节点 id → 选中 choice id */
  choices: Record<string, string>
  /** ④ 扩展：完整选择轨迹 */
  choiceLog: Array<{ nodeId: string; choiceId: string; at: number }>
  /** 规范⑤ 结局状态 */
  endings: Record<string, boolean>
  /** 扩展：状态变化落地容器 */
  flags: Record<string, FlagValue>
  /** 扩展：悬置态/待定/临时保管（叙事常以"未提交"作结） */
  pending: Record<string, { value: FlagValue; at: number }>
}

/** 存档需要的运行时续玩信息（不存对话进行态） */
export interface SaveResume {
  currentChapter: string
  currentMap: string
  playerX: number
  playerY: number
}

/** 存档数据 */
export interface SaveData {
  schemaVersion: number
  world: WorldState
  resume: SaveResume
  playTimeSec: number
  updatedAt: number
}

/** 对话历史行 */
export interface ConvLine {
  speaker?: string
  text: string
  kind: 'speech' | 'prose' | 'choice' | 'system'
  at: number
}

/** 对话后继（当前展示节点之后；await-choice 由 showingChoices 表达） */
export type ConvPending = { type: 'node'; id: string } | { type: 'end' }

/** 对话会话状态 */
export interface ConvState {
  active: boolean
  entryNode: string | null
  currentNode: string | null
  /** 当前展示节点读到的后继（无 = await-choice 或尚未进入） */
  pending: ConvPending | null
  history: ConvLine[]
  showingChoices: boolean
}

export function createEmptyConv(): ConvState {
  return {
    active: false,
    entryNode: null,
    currentNode: null,
    pending: null,
    history: [],
    showingChoices: false,
  }
}

export type PanelId = 'archive' | 'inventory' | 'save'

/** 背包物品 */
export interface InventoryItem {
  id: string
  count: number
}