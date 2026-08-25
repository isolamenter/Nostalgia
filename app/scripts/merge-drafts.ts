/**
 * 合并并行内容 agent 产出的 `_drafts/*.json` 进共享数据目录。
 *
 * 背景：Epic 3 四章并行开发时，各章节 agent 只写自己的 `story/chapterNN.json`，
 * 并把要加进共享库（maps/objects/archives/characters）的条目写成 `_drafts/<tag>.<域>.json`，
 * 由本脚本统一合并、按 id 去重（重复即报错）、经 zod 校验后写回真实文件，最后清理 _drafts。
 *
 * 用法：npm run merge:drafts
 */
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  archivesFileSchema,
  charactersFileSchema,
  itemsFileSchema,
  mapsFileSchema,
} from '../src/data/schemas'

const DATA = fileURLToPath(new URL('../src/data', import.meta.url))
const DRAFTS = join(DATA, '_drafts')

const DOMAINS = [
  {
    dir: 'maps',
    draftPrefix: 'maps',
    file: 'maps.json',
    schema: mapsFileSchema,
    label: 'maps',
  },
  {
    dir: 'items',
    draftPrefix: 'objects',
    file: 'objects.json',
    schema: itemsFileSchema,
    label: 'items',
  },
  {
    dir: 'archives',
    draftPrefix: 'archives',
    file: 'archives.json',
    schema: archivesFileSchema,
    label: 'archives',
  },
  {
    dir: 'characters',
    draftPrefix: 'characters',
    file: 'characters.json',
    schema: charactersFileSchema,
    label: 'characters',
  },
] as const

function mergeDomain(
  domain: (typeof DOMAINS)[number],
): { merged: Array<{ id: string }>; added: number; dupes: string[] } {
  const realPath = join(DATA, domain.dir, domain.file)
  const real = JSON.parse(readFileSync(realPath, 'utf8')) as Array<{ id: string }>
  const additions: Array<{ id: string }> = []
  if (existsSync(DRAFTS)) {
    for (const f of readdirSync(DRAFTS)) {
      if (!f.endsWith(`.${domain.draftPrefix}.json`)) continue
      const arr = JSON.parse(readFileSync(join(DRAFTS, f), 'utf8')) as Array<{ id: string }>
      additions.push(...arr)
    }
  }
  const merged = [...real, ...additions]
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const row of merged) {
    if (seen.has(row.id)) dupes.push(row.id)
    seen.add(row.id)
  }
  // 合并后整体过 zod，非法即抛（不写坏数据进库）
  const parsed = domain.schema.parse(merged) as Array<{ id: string }>
  return { merged: parsed, added: additions.length, dupes }
}

console.log('[merge:drafts] 合并并行产出 → 共享数据目录…')
let any = false
for (const domain of DOMAINS) {
  const { merged, added, dupes } = mergeDomain(domain)
  if (dupes.length) throw new Error(`[merge:drafts] ${domain.label}: 重复 id → ${dupes.join(', ')}`)
  if (added > 0) {
    any = true
    writeFileSync(join(DATA, domain.dir, domain.file), JSON.stringify(merged, null, 2) + '\n')
    console.log(`  • ${domain.file}: +${added} 条（总量 ${merged.length}）`)
  } else {
    console.log(`  • ${domain.file}: 无新增`)
  }
}

if (existsSync(DRAFTS)) {
  for (const f of readdirSync(DRAFTS)) rmSync(join(DRAFTS, f))
  try {
    rmSync(DRAFTS)
  } catch {
    /* 目录非空或权限，忽略 */
  }
}

console.log(any ? '✓ 合并完成，_drafts 已清理' : '⚠ 未发现任何 draft 新增，无变更')
