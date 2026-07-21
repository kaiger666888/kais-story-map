/**
 * Schema 校验 —— 对一份 ScriptData JSON 做结构 + 引用一致性校验。
 *
 * 两层:
 *   1. 结构:scriptDataSchema(zod)逐字段类型 / 枚举 / 区间
 *   2. 引用一致性:beat 出场人物 / 道具 / 场景、关系端点、道具流转持有人,
 *      必须指向已定义的实体 id;以及 arc 长度 == 场数、场号连续等结构性警告。
 *
 * 供 cli.ts validate 命令、parser.ts 解析后自检共用。
 */
import { readFileSync } from 'node:fs'
import { scriptDataSchema, type ScriptData } from './schema'

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationIssue[]
  warnings: string[]
  stats: {
    characters: number
    props: number
    scenes: number
    beats: number
    acts: number
    relationships: number
  }
  data?: ScriptData
}

/** 校验一份已解析的 ScriptData 对象(内存)。 */
export function validateScriptData(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: string[] = []

  const parsed = scriptDataSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ path: issue.path.join('.') || '(root)', message: issue.message })
    }
    return { ok: false, errors, warnings, stats: { characters: 0, props: 0, scenes: 0, beats: 0, acts: 0, relationships: 0 } }
  }
  const d = parsed.data

  const charIds = new Set(d.characters.map((c) => c.id))
  const propIds = new Set(d.props.map((p) => p.id))
  const sceneIds = new Set(d.scenes.map((s) => s.id))
  const nodeIds = new Set<string>([...charIds, ...propIds, ...sceneIds])
  const beatIndex = new Set(d.beats.map((b) => b.index))
  const beatCount = d.beats.length

  /* ── 幕区间与场号 ── */
  for (const act of d.acts) {
    const [lo, hi] = act.range
    if (lo > hi) errors.push({ path: `acts[${act.id}].range`, message: `区间下界 ${lo} 大于上界 ${hi}` })
  }

  /* ── 节拍引用 ── */
  for (const b of d.beats) {
    if (!sceneIds.has(b.sceneId)) {
      errors.push({ path: `beats[index=${b.index}].sceneId`, message: `未知场景 id: ${b.sceneId}` })
    }
    for (const cid of b.characters) {
      if (!charIds.has(cid)) errors.push({ path: `beats[index=${b.index}].characters`, message: `未知人物 id: ${cid}` })
    }
    for (const pid of b.props ?? []) {
      if (!propIds.has(pid)) errors.push({ path: `beats[index=${b.index}].props`, message: `未知道具 id: ${pid}` })
    }
  }

  /* ── 场号连续性(1..N,提示级) ── */
  for (let i = 1; i <= beatCount; i++) {
    if (!beatIndex.has(i)) warnings.push(`场号不连续:缺第 ${i} 场`)
  }

  /* ── 人物弧长 == 场数(提示级) ── */
  for (const c of d.characters) {
    if (c.arc.length !== beatCount) {
      warnings.push(`人物 ${c.id} 的 arc 长度 ${c.arc.length} ≠ 场数 ${beatCount}`)
    }
  }

  /* ── 关系端点 ── */
  for (const r of d.relationships) {
    if (!nodeIds.has(r.source)) errors.push({ path: `relationships[${r.id}].source`, message: `未知节点 id: ${r.source}` })
    if (!nodeIds.has(r.target)) errors.push({ path: `relationships[${r.id}].target`, message: `未知节点 id: ${r.target}` })
  }

  /* ── 道具流转引用 ── */
  for (const p of d.props) {
    for (const t of p.timeline) {
      if (!sceneIds.has(t.sceneId)) errors.push({ path: `props[${p.id}].timeline.sceneId`, message: `未知场景 id: ${t.sceneId}` })
      if (!beatIndex.has(t.beat)) warnings.push(`道具 ${p.id} 流转指向不存在的场号 ${t.beat}`)
      if (t.holderId && !charIds.has(t.holderId)) {
        errors.push({ path: `props[${p.id}].timeline.holderId`, message: `未知人物 id: ${t.holderId}` })
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      characters: d.characters.length,
      props: d.props.length,
      scenes: d.scenes.length,
      beats: d.beats.length,
      acts: d.acts.length,
      relationships: d.relationships.length,
    },
    data: d,
  }
}

/** 读取 JSON 文件并校验。 */
export function validateScriptFile(filePath: string): ValidationResult {
  const raw = readFileSync(filePath, 'utf8')
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: '(file)', message: `JSON 解析失败:${e instanceof Error ? e.message : String(e)}` }],
      warnings: [],
      stats: { characters: 0, props: 0, scenes: 0, beats: 0, acts: 0, relationships: 0 },
    }
  }
  return validateScriptData(json)
}
