/**
 * 剧本数据加载层
 *
 * 解析优先级(高 → 低):
 *   1. URL 参数 ?data=<path>     —— 来自 HashRouter 的 hash query,如 #/graph?data=parsed.json
 *   2. localStorage(story-map:script-data) —— 用户手动切换并持久化的剧本
 *   3. DEFAULT_DATA(夜航)        —— 兜底,保证页面永远可用
 *
 * loader 是纯运行时模块(无 React 依赖),既被 ScriptDataContext 使用,
 * 也可在测试 / 调试中单独调用。
 */
import type { ScriptData } from '@/types/script-schema'
import { DEFAULT_DATA } from './nightferry'

const LS_KEY = 'story-map:script-data'
const DEFAULT_TIMEOUT_MS = 15000

export type DataSource = 'url' | 'localStorage' | 'default' | 'manual'

export interface LoadResult {
  data: ScriptData
  source: DataSource
  /** 当 source === 'url' 时的数据路径 */
  dataPath?: string
}

/**
 * 从当前 URL 的 hash 中读取 ?data= 参数。
 * 兼容 HashRouter:真实 query 在 `#/path?data=x` 的 hash 段。
 */
export function resolveDataParam(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash ?? ''
  const qIdx = hash.indexOf('?')
  if (qIdx < 0) return null
  const params = new URLSearchParams(hash.slice(qIdx + 1))
  const val = params.get('data')
  return val && val.trim() ? val.trim() : null
}

/** 读取 localStorage 中持久化的剧本;无则 null。 */
export function loadFromLocalStorage(): ScriptData | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScriptData
  } catch {
    return null
  }
}

/** 把一份剧本写入 localStorage(供用户手动切换后持久化)。 */
export function saveToLocalStorage(data: ScriptData): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    /* 配额不足 / 隐私模式 —— 静默忽略 */
  }
}

/**
 * 按 path 拉取一份 ScriptData JSON,带超时。
 * path 可为相对(相对当前页面,如 'parsed.json')、绝对路径或完整 URL。
 */
export async function fetchScriptData(dataPath: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ScriptData> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(dataPath, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`加载失败:HTTP ${res.status} ${res.statusText}`)
    const json = (await res.json()) as ScriptData
    if (!json || typeof json !== 'object' || !Array.isArray(json.beats)) {
      throw new Error('数据结构不合法:缺少 beats 数组')
    }
    return json
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`加载超时(>${timeoutMs}ms):${dataPath}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 按优先级解析当前应使用的剧本。
 * UI 层通常不直接调用,而由 ScriptDataContext 在 location 变化时调用。
 */
export async function loadScriptData(): Promise<LoadResult> {
  const dataPath = resolveDataParam()
  if (dataPath) {
    const data = await fetchScriptData(dataPath)
    return { data, source: 'url', dataPath }
  }
  const ls = loadFromLocalStorage()
  if (ls) return { data: ls, source: 'localStorage' }
  return { data: DEFAULT_DATA, source: 'default' }
}
