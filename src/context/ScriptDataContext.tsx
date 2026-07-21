/**
 * ScriptDataContext —— 全站剧本数据源
 *
 * - ScriptDataProvider 在应用根节点包裹,根据 URL ?data= / localStorage / 默认,
 *   异步加载当前 ScriptData 并以 useMemo 缓存派生数据。
 * - useScriptData() 返回原始 { data, derived, loading, ... },供需要状态/手动切换的组件使用。
 * - useScript() 返回扁平对象,字段名与原 nightferry 导出兼容(characters/beats/graphNodes/...),
 *   便于把页面从「直接 import nightferry」迁移到「从 Context 取数据」。
 *
 * URL 是权威数据源:导航到 #/graph?data=parsed.json 即加载该 JSON;
 * 无参数则回退 localStorage → 默认夜航数据。加载失败回退默认数据并暴露 error。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { DerivedData, ScriptData } from '@/types/script-schema'
import { buildDerived } from '@/data/derived'
import { DEFAULT_DATA } from '@/data/nightferry'
import { loadScriptData, resolveDataParam, saveToLocalStorage, type DataSource } from '@/data/loader'

interface ScriptDataContextValue {
  data: ScriptData
  derived: DerivedData
  source: DataSource
  dataPath?: string
  loading: boolean
  error: string | null
  /** 重新解析当前 URL/localStorage 并加载 */
  reload: () => void
  /** 手动切换剧本;opts.persist=true 时写入 localStorage */
  setData: (data: ScriptData, opts?: { persist?: boolean }) => void
}

const ScriptDataContext = createContext<ScriptDataContextValue | null>(null)

export function ScriptDataProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [data, setDataState] = useState<ScriptData>(DEFAULT_DATA)
  const [source, setSource] = useState<DataSource>('default')
  const [dataPath, setDataPath] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // location.search 变化(?data= 切换)或手动 reload 时重新加载。
  // 不依赖 pathname —— 切页不触发重复 fetch。
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadScriptData()
      .then((res) => {
        if (cancelled) return
        setDataState(res.data)
        setSource(res.source)
        setDataPath(res.dataPath)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        // 加载失败时回退默认数据,保证页面始终可用
        setDataState(DEFAULT_DATA)
        setSource('default')
        setDataPath(undefined)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [location.search, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const setData = useCallback((next: ScriptData, opts?: { persist?: boolean }) => {
    setDataState(next)
    setSource('manual')
    setDataPath(undefined)
    setError(null)
    if (opts?.persist) saveToLocalStorage(next)
  }, [])

  const derived = useMemo(() => buildDerived(data), [data])

  const value = useMemo<ScriptDataContextValue>(
    () => ({ data, derived, source, dataPath, loading, error, reload, setData }),
    [data, derived, source, dataPath, loading, error, reload, setData],
  )

  return <ScriptDataContext.Provider value={value}>{children}</ScriptDataContext.Provider>
}

/** 取原始 Context 值(含 loading/error/reload/setData)。必须在 Provider 内使用。 */
export function useScriptData(): ScriptDataContextValue {
  const ctx = useContext(ScriptDataContext)
  if (!ctx) throw new Error('useScriptData 必须在 <ScriptDataProvider> 内使用')
  return ctx
}

/**
 * 便捷 hook:返回扁平对象,字段名与原 nightferry 导出兼容。
 * 页面迁移时,把 `import { CHARACTERS, BEATS, getCharacter } from '@/data/nightferry'`
 * 改为 `const { characters: CHARACTERS, beats: BEATS, getCharacter } = useScript()`。
 * 类型(Beat/NodeKind/...)与常量(NODE_COLORS)仍从 @/data/nightferry 或 @/types/script-schema 导入。
 */
export function useScript() {
  const ctx = useScriptData()
  return {
    // 状态
    loading: ctx.loading,
    error: ctx.error,
    source: ctx.source,
    dataPath: ctx.dataPath,
    reload: ctx.reload,
    setData: ctx.setData,
    // 原始
    data: ctx.data,
    meta: ctx.data.meta,
    // 核心数据
    characters: ctx.data.characters,
    props: ctx.data.props,
    scenes: ctx.data.scenes,
    beats: ctx.data.beats,
    acts: ctx.data.acts,
    relationships: ctx.derived.characterRelationships,
    characterPropEdges: ctx.derived.characterPropEdges,
    propSceneEdges: ctx.derived.propSceneEdges,
    // 派生
    graphNodes: ctx.derived.graphNodes,
    graphLinks: ctx.derived.graphLinks,
    emotionSeries: ctx.derived.emotionSeries,
    scriptStats: ctx.derived.scriptStats,
    sceneCharacters: ctx.derived.sceneCharacters,
    sceneBeats: ctx.derived.sceneBeats,
    characterSceneEdges: ctx.derived.characterSceneEdges,
    // 查询
    getCharacter: ctx.derived.getCharacter,
    getProp: ctx.derived.getProp,
    getScene: ctx.derived.getScene,
    getBeat: ctx.derived.getBeat,
    getAct: ctx.derived.getAct,
    beatsOfAct: ctx.derived.beatsOfAct,
    characterArc: ctx.derived.characterArc,
  }
}

/** 仅查询当前 dataPath(非 hook 场景的工具函数,直接读 URL)。 */
export function currentDataParam(): string | null {
  return resolveDataParam()
}
