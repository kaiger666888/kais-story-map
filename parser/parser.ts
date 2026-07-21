/**
 * Parser 主流程 —— 剧本文本 → ScriptData 的多轮 LLM 提取管线。
 *
 *   预处理 → [R1 人物] → [R2 道具] → [R3 场景] → [R4 逐场节拍]
 *          → [R5 关系] → [R6 情绪弧] → [R7 三幕] → 合并 → 校验 → 输出
 *
 * 框架阶段说明:LLM 调用通过 LLMClient 抽象隔离,默认 StubLLMClient 不发起任何网络请求
 * (parseScript 会在第一轮抛出「未接入」错误)。流程编排、上下文注入、合并与校验均已就绪,
 * 接入真实客户端(Kimi / OpenAI 兼容)即可端到端跑通。见 README「接入 LLM」。
 */
import { validateScriptData } from './validate'
import type { Beat, Character, RelationshipEdge, SceneLocation, ScriptData, ScriptProp } from './schema'
import {
  promptActs,
  promptBeats,
  promptCharacters,
  promptEmotionArcs,
  promptProps,
  promptRelationships,
  promptScenes,
} from './prompt-templates'

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
 * 真正接入 LLM 时,替换为 KimiClient / OpenAICompatibleClient(见 createLLMClient 与 README)。
 */
export class StubLLMClient implements LLMClient {
  async extract(_prompt: string, _opts?: LLMExtractOptions): Promise<unknown> {
    throw new Error(
      'LLM 未接入:当前为框架 Stub。请设置环境变量 STORY_MAP_LLM_PROVIDER=kimi|openai 及对应密钥,' +
        '或向 parseScript 传入实现了 LLMClient 的真实客户端。',
    )
  }
}

/**
 * 根据环境变量创建 LLM 客户端。
 * 框架阶段:任何情况都返回 Stub —— 真实 Kimi / OpenAI 请求逻辑留待实现(见 README),
 * 避免在未就绪时误调真实 API / 产生费用。
 */
export function createLLMClient(): LLMClient {
  const provider = process.env.STORY_MAP_LLM_PROVIDER
  if (!provider) return new StubLLMClient()
  // TODO(provider === 'kimi'):   return new KimiClient({ apiKey: process.env.KIMI_API_KEY!, baseUrl: process.env.KIMI_BASE_URL, model: process.env.KIMI_MODEL })
  // TODO(provider === 'openai'): return new OpenAICompatibleClient({ ... })
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
  if (x && typeof x === 'object' && Array.isArray((x as Record<string, unknown>)[key])) {
    return (x as Record<string, unknown>)[key] as T[]
  }
  return []
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

  if (parts.arcs) {
    for (const c of characters) {
      const arc = parts.arcs[c.id]
      if (Array.isArray(arc)) c.arc = arc
    }
  }

  return {
    meta: parts.meta ?? { title: '未命名', titleEn: 'UNTITLED', genre: '未分类', synopsis: '' },
    characters,
    props,
    scenes,
    beats,
    acts,
    relationships,
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
 * 框架阶段:client 默认 Stub,首轮即抛错;流程本身完整可用。
 */
export async function parseScript(text: string, opts: ParseOptions = {}): Promise<ScriptData> {
  const client = opts.client ?? createLLMClient()
  const clean = preprocess(text)
  const onProgress = opts.onProgress ?? (() => {})

  onProgress({ round: 'preprocess', index: 0, total: ROUNDS_TOTAL })

  onProgress({ round: 'characters', index: 1, total: ROUNDS_TOTAL })
  const characters = asArray<Character>(await client.extract(promptCharacters(clean)), 'characters')

  onProgress({ round: 'props', index: 2, total: ROUNDS_TOTAL })
  const props = asArray<ScriptProp>(await client.extract(promptProps(clean, characters)), 'props')

  onProgress({ round: 'scenes', index: 3, total: ROUNDS_TOTAL })
  const scenes = asArray<SceneLocation>(await client.extract(promptScenes(clean)), 'scenes')

  onProgress({ round: 'beats', index: 4, total: ROUNDS_TOTAL })
  const beats = asArray<Beat>(await client.extract(promptBeats(clean, characters, scenes, props)), 'beats')

  onProgress({ round: 'relationships', index: 5, total: ROUNDS_TOTAL })
  const relationships = asArray<RelationshipEdge>(
    await client.extract(promptRelationships(clean, characters)),
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
      title: opts.meta?.title ?? '未命名',
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
