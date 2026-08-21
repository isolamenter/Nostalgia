/**
 * 数据全量校验（CI 用）。
 * 递归遍历 src/data 下全部 json，逐文件跑与浏览器同一套 zod schema，
 * 保证磁盘上的真实内容合法（与 HMR 缓存无关）。
 *
 * 用法：npm run check:data
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  archivesFileSchema,
  chapterFileSchema,
  charactersFileSchema,
  itemsFileSchema,
  mapsFileSchema,
} from '../src/data/schemas'

const DATA_DIR = fileURLToPath(new URL('../src/data', import.meta.url))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.json')) out.push(full)
  }
  return out
}

function schemaFor(relPath: string): { name: string; schema: z.ZodType<unknown> } | null {
  const segments = relPath.split('/')
  // src/data/<domain>/<file>.json
  const domain = segments[0]
  if (segments.length !== 2) return null
  switch (domain) {
    case 'story':
      return { name: 'story', schema: chapterFileSchema }
    case 'characters':
      return { name: 'characters', schema: charactersFileSchema }
    case 'items':
      return { name: 'items', schema: itemsFileSchema }
    case 'maps':
      return { name: 'maps', schema: mapsFileSchema }
    case 'archives':
      return { name: 'archives', schema: archivesFileSchema }
    default:
      return null
  }
}

const files = walk(DATA_DIR)
let failed = 0
let checked = 0
const errors: string[] = []

for (const file of files) {
  const rel = file.slice(DATA_DIR.length + 1)
  const mapping = schemaFor(rel)
  if (!mapping) continue
  checked += 1
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    failed += 1
    errors.push(`[${rel}] JSON 解析失败: ${(err as Error).message}`)
    continue
  }
  const result = mapping.schema.safeParse(raw)
  if (!result.success) {
    failed += 1
    errors.push(`[${rel} (${mapping.name})] ${z.prettifyError(result.error)}`)
  }
}

if (errors.length > 0) {
  console.error(`\n✗ check:data 失败 ${failed}/${checked}\n`)
  for (const e of errors) console.error(`  ${e}`)
  process.exitCode = 1
} else {
  console.log(`✓ check:data 通过（${checked} 个数据文件，全部合法）`)
}