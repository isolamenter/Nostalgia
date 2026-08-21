/**
 * localStorage 持久层（可注入 KVStorage 以便单测）。
 * 槽位：autosave + manual-1..3；每次写盘前把旧值另存 .bak，读坏可回退。
 */
export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const SLOT_IDS = ['autosave', 'manual-1', 'manual-2', 'manual-3'] as const
export type SlotId = (typeof SLOT_IDS)[number]

export interface SlotMeta {
  id: SlotId
  updatedAt: number
}

const PREFIX = 'gdg.slot.'
const INDEX_KEY = 'gdg.slots.index'

export function slotKey(id: SlotId): string {
  return `${PREFIX}${id}`
}

export function bakKey(id: SlotId): string {
  return `${slotKey(id)}.bak`
}

function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).includes(value)
}

function readIndex(storage: KVStorage): SlotMeta[] {
  const raw = storage.getItem(INDEX_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (x): x is SlotMeta =>
          typeof x === 'object' && x !== null && isSlotId((x as SlotMeta).id),
      )
    }
  } catch {
    /* 索引损坏则重建 */
  }
  return []
}

function writeIndex(storage: KVStorage, index: SlotMeta[]): void {
  storage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function writeSlot(storage: KVStorage, id: SlotId, json: string, now: number): void {
  const previous = storage.getItem(slotKey(id))
  if (previous !== null) storage.setItem(bakKey(id), previous)
  storage.setItem(slotKey(id), json)

  const index = readIndex(storage).filter((m) => m.id !== id)
  index.push({ id, updatedAt: now })
  index.sort((a, b) => b.updatedAt - a.updatedAt)
  writeIndex(storage, index)
}

/** 优先读主档；空/损坏时回退 .bak（损坏判定由调用方 zod 校验驱动） */
export function readSlotRaw(storage: KVStorage, id: SlotId): string | null {
  const main = storage.getItem(slotKey(id))
  if (main !== null) return main
  return storage.getItem(bakKey(id))
}

export function deleteSlot(storage: KVStorage, id: SlotId): void {
  storage.removeItem(slotKey(id))
  storage.removeItem(bakKey(id))
  const index = readIndex(storage).filter((m) => m.id !== id)
  writeIndex(storage, index)
}

export function listSlots(storage: KVStorage): SlotMeta[] {
  return readIndex(storage)
}

/** 浏览器 localStorage（SSR/测试时用内存版替代） */
export const browserStorage: KVStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v)
    } catch {
      /* 隐私模式等场景忽略配额错误 */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

/** 内存版 KVStorage（单测用） */
export class MemoryStorage implements KVStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}