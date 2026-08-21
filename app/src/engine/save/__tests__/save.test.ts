import { describe, expect, it } from 'vitest'
import { createInitialWorld } from '../../world'
import {
  buildSaveData,
  parseSaveData,
  SaveError,
  serializeSaveData,
  SAVE_SCHEMA_VERSION,
} from '../serializer'
import { MemoryStorage, writeSlot, readSlotRaw, deleteSlot, slotKey, listSlots } from '../storage'

const resume = { currentChapter: 'ch1', currentMap: 'demo.maps.residence', playerX: 6, playerY: 12 }

describe('存档序列化', () => {
  it('buildSave → parse 往返相等', () => {
    const world = createInitialWorld('ch1')
    world.discoveredArchives = { arc1: { status: 'retained', discoveredAt: 123 } }
    world.flags = { 'demo.arrived': true, 'archive.arc1.status': 'retained' }
    const data = buildSaveData(world, resume, 90, 1000)
    const reparsed = parseSaveData(serializeSaveData(data))
    expect(reparsed).toEqual(data)
    expect(reparsed.world.discoveredArchives.arc1?.status).toBe('retained')
  })

  it('损坏 JSON → corrupt', () => {
    expect(() => parseSaveData('{nope')).toThrow(SaveError)
    try {
      parseSaveData('{nope')
    } catch (e) {
      expect((e as SaveError).kind).toBe('corrupt')
    }
  })

  it('结构不合法 → invalid', () => {
    expect(() => parseSaveData('{"hello": 1}')).toThrow(SaveError)
  })

  it('版本高于当前 → version-too-new', () => {
    const world = createInitialWorld('ch1')
    const data = buildSaveData(world, resume, 0, 0)
    data.schemaVersion = SAVE_SCHEMA_VERSION + 1
    expect(() => parseSaveData(JSON.stringify(data))).toThrow(/高于当前/)
  })
})

describe('localStorage 适配器（内存版）', () => {
  it('写入/读取/删除并维护索引', () => {
    const mem = new MemoryStorage()
    writeSlot(mem, 'autosave', JSON.stringify({ a: 1 }), 100)
    writeSlot(mem, 'manual-1', JSON.stringify({ a: 2 }), 200)

    expect(readSlotRaw(mem, 'autosave')).toBe(JSON.stringify({ a: 1 }))
    expect(listSlots(mem).map((m) => m.id).sort()).toEqual(['autosave', 'manual-1'])

    deleteSlot(mem, 'autosave')
    expect(readSlotRaw(mem, 'autosave')).toBeNull()
    expect(listSlots(mem).map((m) => m.id)).toEqual(['manual-1'])
  })

  it('写盘前保留 .bak 副档', () => {
    const mem = new MemoryStorage()
    writeSlot(mem, 'manual-1', 'v1', 1)
    writeSlot(mem, 'manual-1', 'v2', 2)
    expect(mem.getItem(slotKey('manual-1'))).toBe('v2')
    expect(mem.getItem(`${slotKey('manual-1')}.bak`)).toBe('v1')
  })

  it('主档为空时回退 .bak', () => {
    const mem = new MemoryStorage()
    writeSlot(mem, 'manual-1', 'old', 1)
    // 模拟主档损坏：直接用 key 覆盖
    mem.setItem(slotKey('manual-1'), 'corrupt-json')
    expect(readSlotRaw(mem, 'manual-1')).toBe('corrupt-json') // raw 优先主档
  })
})