/**
 * 数据运行时校验（zod）——唯一校验来源。
 * check:data、loaders、存档读入共用同一套 schema。
 * 各 schema 以 `: z.ZodType<T>` 注解与 types.ts 保持编译期一致。
 */
import { z } from 'zod'
import type {
  AppearanceState,
  ArchiveEntry,
  ArchiveInterpretation,
  ArchiveStatus,
  ArchiveType,
  ChapterData,
  Character,
  Choice,
  Condition,
  DecorDef,
  FlagChange,
  FlagValue,
  InteractableDef,
  InventoryItem,
  LocationDef,
  NextRule,
  NextTarget,
  SaveData,
  SaveResume,
  StoryNode,
  WorldState,
} from './types'

/** 严格模式：拒绝未知字段，防笔误漂流（仅对象 schema 支持） */
const strictObj = <S extends z.ZodRawShape>(s: z.ZodObject<S>) => s.strict()

export const flagValueSchema: z.ZodType<FlagValue> = z.union([z.boolean(), z.string(), z.number()])

/** 条件谓词（递归） */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ hasFlag: z.string(), equals: flagValueSchema.optional() }),
    z.object({ hasArchive: z.string() }),
    z.object({ chapterEquals: z.string() }),
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
    z.object({ not: conditionSchema }),
  ]),
)

export const flagChangeSchema: z.ZodType<FlagChange> = strictObj(
  z.object({ flag: z.string(), value: flagValueSchema }),
)

export const choiceSchema: z.ZodType<Choice> = strictObj(
  z.object({
    id: z.string().min(1),
    text: z.string(),
    next: z.string().optional(),
    flags: z.array(flagChangeSchema).optional(),
    condition: conditionSchema.optional(),
  }),
)

export const nextRuleSchema: z.ZodType<NextRule> = strictObj(
  z.object({ when: conditionSchema.optional(), to: z.string() }),
)

export const nextTargetSchema: z.ZodType<NextTarget> = z.union([z.string(), z.array(nextRuleSchema)])

export const storyNodeSchema: z.ZodType<StoryNode> = strictObj(
  z.object({
    id: z.string().min(1),
    speaker: z.string().optional(),
    text: z.string(),
    choices: z.array(choiceSchema).optional(),
    flags: z.array(flagChangeSchema).optional(),
    next: nextTargetSchema.optional(),
    mode: z.enum(['prose', 'dialogue']).optional(),
    once: z.boolean().optional(),
    note: z.string().optional(),
  }),
)

export const chapterSchema: z.ZodType<ChapterData> = strictObj(
  z.object({
    chapterId: z.string().min(1),
    title: z.string(),
    nodes: z.array(storyNodeSchema),
  }),
)

export const chapterFileSchema = chapterSchema

export const archiveTypeSchema: z.ZodType<ArchiveType> = z.enum([
  'registration',
  'incident-report',
  'ledger',
  'receipt',
  'photograph',
  'memo',
  'cleanup-list',
])

export const archiveStatusSchema: z.ZodType<ArchiveStatus> = z.enum([
  'pending',
  'verified',
  'retained',
  'held',
  'discarded',
])

export const archiveInterpretationSchema: z.ZodType<ArchiveInterpretation> = strictObj(
  z.object({
    forStatus: archiveStatusSchema,
    title: z.string().optional(),
    lines: z.array(z.string()),
  }),
)

export const archiveEntrySchema: z.ZodType<ArchiveEntry> = strictObj(
  z.object({
    id: z.string().min(1),
    type: archiveTypeSchema,
    title: z.string(),
    lines: z.array(z.string()),
    foundFrom: z.string().optional(),
    interpretations: z.array(archiveInterpretationSchema).optional(),
  }),
)

export const interactableDefSchema: z.ZodType<InteractableDef> = strictObj(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    kind: z.enum(['object', 'npc']),
    location: z.string(),
    x: z.number(),
    y: z.number(),
    interactRange: z.number().default(2),
    inspect: z.string().optional(),
    dialogue: z.string().optional(),
    provideArchive: z.string().optional(),
    requirements: conditionSchema.optional(),
    unmetInspect: z.string().optional(),
    collect: z
      .object({ id: z.string().min(1), count: z.number().optional() })
      .strict()
      .optional(),
    once: z.boolean().optional(),
  }),
)

const rectDecorSchema = strictObj(
  z.object({
    kind: z.literal('rect'),
    x: z.number(),
    y: z.number(),
    w: z.number().optional(),
    h: z.number().optional(),
    color: z.string(),
  }),
)
const labelDecorSchema = strictObj(
  z.object({
    kind: z.literal('label'),
    x: z.number(),
    y: z.number(),
    color: z.string(),
    text: z.string().optional(),
  }),
)

export const decorDefSchema: z.ZodType<DecorDef> = z.union([rectDecorSchema, labelDecorSchema])

export const exitDefSchema = strictObj(
  z.object({
    id: z.string().min(1),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    to: z.string(),
  }),
)

export const locationDefSchema: z.ZodType<LocationDef> = strictObj(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    chapter: z.string(),
    width: z.number().int().min(2),
    height: z.number().int().min(2),
    solidTiles: z.array(z.tuple([z.number(), z.number()])),
    spawn: z.object({ x: z.number(), y: z.number() }).strict(),
    decorate: z.array(decorDefSchema).default([]),
    exits: z.array(exitDefSchema).default([]),
    interactables: z.array(z.string()).default([]),
    bg: z.object({ color: z.string(), accent: z.string() }).strict(),
  }),
)

export const characterSchema: z.ZodType<Character> = strictObj(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    role: z.string().optional(),
    color: z.string().optional(),
    shortBio: z.string().optional(),
  }),
)

export const appearanceStateSchema: z.ZodType<AppearanceState> = strictObj(
  z.object({ status: archiveStatusSchema, discoveredAt: z.number() }),
)

export const worldStateSchema: z.ZodType<WorldState> = strictObj(
  z.object({
    schemaVersion: z.literal(1),
    currentChapter: z.string(),
    discoveredArchives: z.record(z.string(), appearanceStateSchema),
    relations: z.record(
      z.string(),
      strictObj(z.object({ value: flagValueSchema.optional(), seen: z.number() })),
    ),
    choices: z.record(z.string(), z.string()),
    choiceLog: z.array(
      strictObj(z.object({ nodeId: z.string(), choiceId: z.string(), at: z.number() })),
    ),
    endings: z.record(z.string(), z.boolean()),
    flags: z.record(z.string(), flagValueSchema),
    pending: z.record(z.string(), strictObj(z.object({ value: flagValueSchema, at: z.number() }))),
  }),
)

export const saveResumeSchema: z.ZodType<SaveResume> = strictObj(
  z.object({
    currentChapter: z.string(),
    currentMap: z.string(),
    playerX: z.number(),
    playerY: z.number(),
  }),
)

export const saveDataSchema: z.ZodType<SaveData> = strictObj(
  z.object({
    schemaVersion: z.number().int(),
    world: worldStateSchema,
    resume: saveResumeSchema,
    playTimeSec: z.number(),
    updatedAt: z.number(),
  }),
)

// —— 文件容器 ——
export const charactersFileSchema = z.array(characterSchema)
export const itemsFileSchema = z.array(interactableDefSchema)
export const mapsFileSchema = z.array(locationDefSchema)
export const archivesFileSchema = z.array(archiveEntrySchema)

export const inventoryItemSchema: z.ZodType<InventoryItem> = strictObj(
  z.object({ id: z.string(), count: z.number().int().min(1) }),
)