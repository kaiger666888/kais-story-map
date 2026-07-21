/**
 * Parser 主流程 —— 剧本文本 → ScriptData 的多轮 LLM 提取管线。
 *
 *   预处理 → [R1 人物] → [R2 场景] → [R3 道具] → [R4 逐场节拍]
 *          → [R5 关系] → [R6 情绪弧] → [R7 三幕] → 合并(引用归一) → 校验 → 输出
 *
 * LLM 调用通过 LLMClient 抽象隔离。createLLMClient() 按 STORY_MAP_LLM_PROVIDER
 * 路由到 GLMClient(智谱)或 KimiClient(Moonshot),均为 OpenAI 兼容 chat/completions
 * 接口,fetch() 直连,带超时 / 指数退避重试 / JSON 围栏修复;未设置时回退 Stub。
 */
import { existsSync } from 'node:fs'
import { validateScriptData } from './validate'
import type { ScriptData } from './schema'
import {
  promptActs,
  promptBeats,
  promptCharacters,
  promptEmotionArcs,
  promptProps,
  promptRelationships,
  promptScenes,
} from './prompt-templates'

/* schema.ts 仅导出 ScriptData 聚合类型,这里按需要从聚合类型中取元素类型 */
type Character = ScriptData['characters'][number]
type ScriptProp = ScriptData['props'][number]
type SceneLocation = ScriptData['scenes'][number]
type Beat = ScriptData['beats'][number]
type RelationshipEdge = ScriptData['relationships'][number]

/* ──────────────────────────── LLM 客户端抽象 ──────────────────────────── */

export interface LLMExtractOptions {
  /** 期望的 JSON 结构提示(供支持 structured output 的模型使用) */
  schemaHint?: Record<string, unknown>
  temperature?: number
  maxRetries?: number
}

export interface LLMClient {
  /** 发送 prompt,返回已解析为对象的 JSON。失败应抛错(由调用方重试 / 捕获)。 */
  extract(prompt: string, opts?: LLMExtractOptions): Promise<unknown>
}

/**
 * 框架阶段 Stub:不发起任何网络请求。
 * 真实客户端见下方 GLMClient / KimiClient,由 createLLMClient 按环境变量路由。
 */
export class StubLLMClient implements LLMClient {
  async extract(_prompt: string, _opts?: LLMExtractOptions): Promise<unknown> {
    throw new Error(
      'LLM 未接入:当前为框架 Stub。请设置环境变量 STORY_MAP_LLM_PROVIDER=glm|kimi 及对应密钥,' +
        '或向 parseScript 传入实现了 LLMClient 的真实客户端。',
    )
  }
}

/* ──────────────────────── OpenAI 兼容客户端 ──────────────────────── */

export interface OpenAICompatibleOptions {
  apiKey: string
  baseUrl: string
  model: string
  /** 单次请求超时(毫秒),默认 60s */
  timeoutMs?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 从模型输出中提取 JSON:
 *  1. 直接 JSON.parse
 *  2. 失败则尝试剥离 Markdown 代码围栏(```json ... ```)后重试
 *  3. 再失败则截取首个 { 到末个 } 的子串重试
 */
function parseJsonLoose(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    /* fallthrough */
  }
  const fence = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fence) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      /* fallthrough */
    }
  }
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(content.slice(start, end + 1))
    } catch {
      /* fallthrough */
    }
  }
  throw new Error(`LLM 输出不是合法 JSON(前缀): ${content.slice(0, 200)}`)
}

/**
 * OpenAI 兼容 chat/completions 客户端基类(GLM / Kimi 共用)。
 * - 重试:默认 maxRetries=2,指数退避 1s / 2s / 4s
 * - 超时:每次请求 60s(AbortController)
 * - 响应:要求 response_format=json_object,解析 choices[0].message.content
 */
export class OpenAICompatibleClient implements LLMClient {
  constructor(protected readonly cfg: OpenAICompatibleOptions) {
    if (!cfg.apiKey) throw new Error('缺少 API Key(请检查对应环境变量)')
  }

  async extract(prompt: string, opts: LLMExtractOptions = {}): Promise<unknown> {
    const maxRetries = opts.maxRetries ?? 2
    const timeoutMs =
      this.cfg.timeoutMs ?? (Number(process.env.STORY_MAP_LLM_TIMEOUT_MS) || 60_000)
    const url = `${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
    const body = JSON.stringify({
      model: this.cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts.temperature ?? 0.3,
      response_format: { type: 'json_object' },
    })

    let lastErr: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1)) // 1s, 2s, 4s
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.cfg.apiKey}`,
          },
          body,
          signal: ctrl.signal,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 300)}`)
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[]
        }
        const content = json.choices?.[0]?.message?.content
        if (!content) throw new Error('LLM 响应缺少 choices[0].message.content')
        return parseJsonLoose(content)
      } catch (e) {
        lastErr =
          e instanceof Error && e.name === 'AbortError'
            ? new Error(`LLM 请求超时(${timeoutMs / 1000}s)`)
            : e
      } finally {
        clearTimeout(timer)
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }
}

/** 智谱 GLM(默认 glm-4-flash) */
export class GLMClient extends OpenAICompatibleClient {
  constructor(opts: { apiKey: string; baseUrl?: string; model?: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
      model: opts.model ?? 'glm-4-flash',
    })
  }
}

/** 月之暗面 Kimi / Moonshot(默认 moonshot-v1-8k) */
export class KimiClient extends OpenAICompatibleClient {
  constructor(opts: { apiKey: string; baseUrl?: string; model?: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl ?? 'https://api.moonshot.cn/v1',
      model: opts.model ?? 'moonshot-v1-8k',
    })
  }
}

/** 尝试加载项目根目录 .env(存在才加载,不覆盖已有环境变量)。 */
function tryLoadDotenv(): void {
  try {
    const p = `${process.cwd()}/.env`
    if (existsSync(p)) process.loadEnvFile(p)
  } catch {
    /* .env 缺失或不可读时忽略 */
  }
}

/**
 * 根据环境变量创建 LLM 客户端。
 *   STORY_MAP_LLM_PROVIDER=glm  → GLMClient(GLM_API_KEY / GLM_BASE_URL / GLM_MODEL)
 *   STORY_MAP_LLM_PROVIDER=kimi → KimiClient(KIMI_API_KEY / KIMI_BASE_URL / KIMI_MODEL)
 *   其他 / 未设置                → StubLLMClient(不发起网络请求)
 */
export function createLLMClient(): LLMClient {
  tryLoadDotenv()
  const provider = process.env.STORY_MAP_LLM_PROVIDER
  if (provider === 'glm') {
    return new GLMClient({
      apiKey: process.env.GLM_API_KEY ?? '',
      baseUrl: process.env.GLM_BASE_URL,
      model: process.env.GLM_MODEL,
    })
  }
  if (provider === 'kimi') {
    return new KimiClient({
      apiKey: process.env.KIMI_API_KEY ?? '',
      baseUrl: process.env.KIMI_BASE_URL,
      model: process.env.KIMI_MODEL,
    })
  }
  return new StubLLMClient()
}

/* ──────────────────────────── 预处理 ──────────────────────────── */

/** 清洗剧本文本:统一换行、压缩多余空白。幕 / 场 / 对白的细粒度识别交给 LLM。 */
export function preprocess(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ──────────────────────────── 合并 ──────────────────────────── */

function asArray<T>(x: unknown, key: string): T[] {
  if (Array.isArray(x)) return x as T[]
  if (x && typeof x === 'object' && Array.isArray((x as Record<string, unknown>)[key])) {
    return (x as Record<string, unknown>)[key] as T[]
  }
  return []
}

/**
 * 深度清理:删除对象中值为 null/undefined 的属性(数组元素不动,arc 里的 null 保留)。
 * LLM 常对可选字段显式输出 null,而 schema 的 optional 只接受「缺失」,不接受 null。
 */
function stripNullProps<T>(x: T): T {
  if (Array.isArray(x)) {
    for (const item of x) stripNullProps(item)
    return x
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>
    for (const k of Object.keys(o)) {
      if (o[k] === null || o[k] === undefined) delete o[k]
      else stripNullProps(o[k])
    }
  }
  return x
}

/** 把各轮提取结果合并为一份 ScriptData,并把 R6 情绪弧回填到各人物。 */
export function mergeRounds(parts: {
  meta?: ScriptData['meta']
  characters?: unknown
  props?: unknown
  scenes?: unknown
  beats?: unknown
  acts?: unknown
  relationships?: unknown
  arcs?: Record<string, (number | null)[]>
}): ScriptData {
  const characters = asArray<Character>(parts.characters, 'characters')
  const props = asArray<ScriptProp>(parts.props, 'props')
  const scenes = asArray<SceneLocation>(parts.scenes, 'scenes')
  const beats = asArray<Beat>(parts.beats, 'beats')
  const acts = asArray<ScriptData['acts'][number]>(parts.acts, 'acts')
  const relationships = asArray<RelationshipEdge>(parts.relationships, 'relationships')

  /* ── 引用归一:模型偶尔用「名称 / 第N场 / sceneN」代替 id,这里尽量解析回实体 id ── */
  const resolveNode = makeIdResolver(characters, scenes, props, beats)
  const resolveChar = makeIdResolver(characters)
  const resolveScene = makeIdResolver(scenes, [], [], beats)
  const resolveProp = makeIdResolver([], [], props)

  for (const b of beats) {
    b.sceneId = resolveScene(b.sceneId)
    b.characters = (b.characters ?? []).map((c) => resolveChar(c))
    b.props = (b.props ?? []).map((p) => resolveProp(p))
  }
  for (const p of props) {
    for (const t of p.timeline ?? []) {
      t.sceneId = resolveScene(t.sceneId)
      if (t.holderId) t.holderId = resolveChar(t.holderId)
    }
  }
  const validNodeIds = new Set([
    ...characters.map((c) => c.id),
    ...props.map((p) => p.id),
    ...scenes.map((s) => s.id),
  ])
  const resolvedRels = relationships
    .map((r) => ({ ...r, source: resolveNode(r.source), target: resolveNode(r.target) }))
    .filter((r) => validNodeIds.has(r.source) && validNodeIds.has(r.target))

  if (parts.arcs) {
    for (const c of characters) {
      const arc = parts.arcs[c.id]
      if (Array.isArray(arc)) c.arc = arc
    }
  }

  const data = stripNullProps({
    meta: parts.meta ?? { title: '未命名', titleEn: 'UNTITLED', genre: '未分类', synopsis: '' },
    characters,
    props,
    scenes,
    beats,
    acts,
    relationships: resolvedRels,
  })
  fillMissingColors(data)
  return data
}

/* 前端可视化直接用 color 字段渲染,为空时按实体类型分配默认色板 */
const CHARACTER_PALETTE = ['#FF4D6D', '#FFB347', '#4ECDC4', '#95B8D1', '#C77DFF', '#8AC926', '#F2EAD8']
const SCENE_PALETTE = ['#2E4057', '#3D5A6C', '#4A6FA5', '#5B8E7D', '#6A8532', '#83677B', '#7D5A50']
const PROP_PALETTE = ['#D4A373', '#B08968', '#9C6644', '#7F5539']

function fillMissingColors(data: ScriptData): void {
  data.characters.forEach((c, i) => {
    if (!c.color) c.color = CHARACTER_PALETTE[i % CHARACTER_PALETTE.length]
  })
  data.scenes.forEach((s, i) => {
    if (!s.color) s.color = SCENE_PALETTE[i % SCENE_PALETTE.length]
  })
  data.props.forEach((p, i) => {
    if (!p.color) p.color = PROP_PALETTE[i % PROP_PALETTE.length]
  })
}

type IdEntity = { id: string; name?: string; nameEn?: string }

/**
 * 构造「别名 → id」解析器:
 *  - 实体的 id / name / nameEn(含小写)均可命中;
 *  - 「第N场」「sceneN」按 beats 的场号映射到该场场景 id(需传入 beats)。
 * 解析失败原样返回。
 */
function makeIdResolver(
  characters: IdEntity[] = [],
  scenes: IdEntity[] = [],
  props: IdEntity[] = [],
  beats: Beat[] = [],
): (ref: string) => string {
  const map = new Map<string, string>()
  const reg = (alias: string | undefined, id: string) => {
    if (alias && !map.has(alias)) map.set(alias, id)
  }
  for (const e of [...characters, ...scenes, ...props]) {
    reg(e.id, e.id)
    reg(e.name, e.id)
    reg(e.nameEn, e.id)
    reg(e.nameEn?.toLowerCase(), e.id)
  }
  const sceneByBeat = new Map(beats.map((b) => [b.index, b.sceneId]))
  return (ref: string) => {
    if (!ref) return ref
    const hit = map.get(ref) ?? map.get(ref.trim())
    if (hit) return hit
    const m = ref.match(/^(?:第\s*(\d+)\s*场|scene[\s_-]?(\d+))$/i)
    if (m) {
      const idx = Number(m[1] ?? m[2])
      const sid = sceneByBeat.get(idx)
      if (sid) return sid
    }
    return ref
  }
}

/* ──────────────────────────── 主流程 ──────────────────────────── */

export interface ParseProgress {
  round: string
  index: number
  total: number
}

export interface ParseOptions {
  client?: LLMClient
  meta?: Partial<ScriptData['meta']>
  onProgress?: (p: ParseProgress) => void
}

const ROUNDS_TOTAL = 7

/**
 * 剧本 → ScriptData 多轮提取主流程。详见文件头注释。
 * client 默认由 createLLMClient() 按环境变量创建;未配置 provider 时为 Stub(首轮抛错)。
 */
export async function parseScript(text: string, opts: ParseOptions = {}): Promise<ScriptData> {
  const client = opts.client ?? createLLMClient()
  const clean = preprocess(text)
  const onProgress = opts.onProgress ?? (() => {})

  onProgress({ round: 'preprocess', index: 0, total: ROUNDS_TOTAL })

  onProgress({ round: 'characters', index: 1, total: ROUNDS_TOTAL })
  const characters = asArray<Character>(await client.extract(promptCharacters(clean)), 'characters')

  onProgress({ round: 'scenes', index: 2, total: ROUNDS_TOTAL })
  const scenes = asArray<SceneLocation>(await client.extract(promptScenes(clean)), 'scenes')

  // 道具流转需要引用场景 id,因此道具轮放在场景轮之后,并把场景 id 列表补充进 prompt
  onProgress({ round: 'props', index: 3, total: ROUNDS_TOTAL })
  const propsPrompt =
    promptProps(clean, characters) +
    `\n\n【补充约束】timeline 的 sceneId 只能从以下场景 id 中选取:${scenes.map((s) => s.id).join(', ') || '(无)'};` +
    `holderId 只能从已知人物 id 中选取,不确定时省略该字段。`
  const props = asArray<ScriptProp>(await client.extract(propsPrompt), 'props')

  onProgress({ round: 'beats', index: 4, total: ROUNDS_TOTAL })
  const beats = asArray<Beat>(await client.extract(promptBeats(clean, characters, scenes, props)), 'beats')

  onProgress({ round: 'relationships', index: 5, total: ROUNDS_TOTAL })
  const nodeIds = [
    ...characters.map((c) => c.id),
    ...props.map((p) => p.id),
    ...scenes.map((s) => s.id),
  ]
  const relPrompt =
    promptRelationships(clean, characters) +
    `\n\n【补充约束】source 与 target 只能使用以下节点 id(人物 / 道具 / 场景),不要使用名称或自创 id:${nodeIds.join(', ')}`
  const relationships = asArray<RelationshipEdge>(
    await client.extract(relPrompt),
    'relationships',
  )

  onProgress({ round: 'arcs', index: 6, total: ROUNDS_TOTAL })
  const arcsRaw = (await client.extract(promptEmotionArcs(clean, characters, beats.length))) as {
    arcs?: Record<string, (number | null)[]>
  }
  const arcs = arcsRaw?.arcs ?? {}

  onProgress({ round: 'acts', index: 7, total: ROUNDS_TOTAL })
  const acts = asArray<ScriptData['acts'][number]>(
    await client.extract(promptActs(clean, beats.length)),
    'acts',
  )

  const data = mergeRounds({
    meta: {
      // 未显式传 meta 时,从剧本首个 Markdown 一级标题推断剧名
      title: opts.meta?.title ?? clean.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '未命名',
      titleEn: opts.meta?.titleEn ?? 'UNTITLED',
      genre: opts.meta?.genre ?? '未分类',
      synopsis: opts.meta?.synopsis ?? '',
      ...(opts.meta?.dialogueLines ? { dialogueLines: opts.meta.dialogueLines } : {}),
      ...(opts.meta?.paceEntropy ? { paceEntropy: opts.meta.paceEntropy } : {}),
    },
    characters,
    props,
    scenes,
    beats,
    acts,
    relationships,
    arcs,
  })

  const result = validateScriptData(data)
  if (!result.ok) {
    throw new Error(
      `解析结果未通过校验(${result.errors.length} 处错误):\n` +
        result.errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n'),
    )
  }
  return result.data!
}
