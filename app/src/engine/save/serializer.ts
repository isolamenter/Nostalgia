/**
 * 存档序列化/解析 + 版本迁移。
 * - buildSaveData：世界+续玩信息 → SaveData 快照
 * - parseSaveData：字符串 → 校验 → 逐级版本迁移 → 最新结构
 * - 未知更高版本 → 拒绝（提示存档版本过高）
 */
import type { SaveData, SaveResume, WorldState } from '../../data/types'
import { saveDataSchema } from '../../data/schemas'

export const SAVE_SCHEMA_VERSION = 1

export const CLASS_NAME = 'SaveError'
export class SaveError extends Error {
  readonly kind: 'corrupt' | 'invalid' | 'version-too-new'
  constructor(kind: SaveError['kind'], message: string) {
    super(message)
    this.name = 'SaveError'
    this.kind = kind
  }
}

export function buildSaveData(
  world: WorldState,
  resume: SaveResume,
  playTimeSec: number,
  updatedAt: number,
): SaveData {
  return { schemaVersion: SAVE_SCHEMA_VERSION, world, resume, playTimeSec, updatedAt }
}

export function serializeSaveData(data: SaveData): string {
  return JSON.stringify(data)
}

/** 版本迁移器注册表：from → to(version+1)。未来加字段时在这里补迁移。 */
const MIGRATIONS: Record<number, (data: SaveData) => SaveData> = {}

function migrateUp(data: SaveData): SaveData {
  let cursor = data.schemaVersion
  let current = data
  while (cursor < SAVE_SCHEMA_VERSION) {
    const step = MIGRATIONS[cursor]
    if (!step) {
      throw new SaveError('corrupt', `缺少从第 ${cursor} 版升级到第 ${cursor + 1} 版的迁移器`)
    }
    current = step(current)
    cursor += 1
  }
  return current
}

export function parseSaveData(json: string): SaveData {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new SaveError('corrupt', '存档不是合法 JSON')
  }
  const first = saveDataSchema.safeParse(raw)
  if (!first.success) throw new SaveError('invalid', '存档结构不合法')
  const version = first.data.schemaVersion
  if (version > SAVE_SCHEMA_VERSION) {
    throw new SaveError('version-too-new', `存档版本 ${version} 高于当前 ${SAVE_SCHEMA_VERSION}`)
  }
  const migrated = migrateUp(first.data)
  // 迁移后的快照再次过 zod（世界态 literal 1 校验）
  const finalCheck = saveDataSchema.safeParse(migrated)
  if (!finalCheck.success) throw new SaveError('invalid', '迁移后存档仍不合法')
  return finalCheck.data
}