/**
 * 派生数据构建 —— 把一份 ScriptData 现场推导为图谱 / 情绪曲线 / 统计 / 查询函数。
 *
 * 这是 nightferry.ts 原有派生逻辑(SCRIPT_STATS / GRAPH_NODES / EMOTION_SERIES /
 * SCENE_CHARACTERS / SCENE_BEATS / CHARACTER_SCENE_EDGES / 查询函数)的参数化版本,
 * 保证「默认数据走 Context」与「未迁移页面直接 import」结果一致。
 *
 * 见 src/types/script-schema.ts 的 DerivedData。
 */
import type {
  ActId,
  Beat,
  Character,
  DerivedData,
  GraphLink,
  GraphNode,
  RelationshipEdge,
  SceneLocation,
  ScriptData,
  ScriptProp,
  ScriptStats,
} from '@/types/script-schema'
import { EMOTION_MAX, NODE_COLORS } from '@/types/script-schema'

/* ──────────────────────────── 查询函数工厂 ──────────────────────────── */

const makeGetters = (data: ScriptData) => ({
  getCharacter: (id: string): Character | undefined => data.characters.find((c) => c.id === id),
  getProp: (id: string): ScriptProp | undefined => data.props.find((p) => p.id === id),
  getScene: (id: string): SceneLocation | undefined => data.scenes.find((s) => s.id === id),
  getBeat: (index: number): Beat | undefined => data.beats.find((b) => b.index === index),
  getAct: (id: ActId) => data.acts.find((a) => a.id === id),
  beatsOfAct: (id: ActId): Beat[] => data.beats.filter((b) => b.act === id),
  characterArc: (id: string): (number | null)[] => data.characters.find((c) => c.id === id)?.arc ?? [],
})

/* ──────────────────────────── 统计 ──────────────────────────── */

function computeStats(data: ScriptData): ScriptStats {
  const emotions = data.beats.map((b) => b.emotion)
  const peakValue = Math.max(...emotions)
  const valleyValue = Math.min(...emotions)
  const peakBeat = data.beats[emotions.indexOf(peakValue)].index
  const valleyBeat = data.beats[emotions.indexOf(valleyValue)].index
  const avgTension = emotions.reduce((s, e) => s + Math.abs(e), 0) / emotions.length / EMOTION_MAX
  const ccRelations = data.relationships.filter((r) => r.kind === 'character-character')
  return {
    beats: data.beats.length,
    characters: data.characters.length,
    dialogueLines: data.meta.dialogueLines ?? Math.round(data.beats.length * 28),
    acts: data.acts.length,
    keyBeats: data.beats.filter((b) => b.key).length,
    paceEntropy: data.meta.paceEntropy ?? 0.5,
    relations: ccRelations.length,
    propsFlow: data.props.length,
    emotionAmplitude: Math.round((peakValue - valleyValue) * 10) / 10,
    peakBeat,
    peakValue,
    valleyBeat,
    valleyValue,
    avgTension: Math.round(avgTension * 100) / 100,
  }
}

/* ──────────────────────────── 场景映射 ──────────────────────────── */

function buildSceneCharacters(data: ScriptData): Record<string, string[]> {
  const map: Record<string, Set<string>> = {}
  for (const b of data.beats) {
    if (!map[b.sceneId]) map[b.sceneId] = new Set()
    b.characters.forEach((c) => map[b.sceneId].add(c))
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]))
}

function buildSceneBeats(data: ScriptData): Record<string, number[]> {
  const map: Record<string, number[]> = {}
  for (const b of data.beats) {
    if (!map[b.sceneId]) map[b.sceneId] = []
    map[b.sceneId].push(b.index)
  }
  return map
}

/* ──────────────────────────── 人物-场景出场边 ──────────────────────────── */

function buildCharacterSceneEdges(data: ScriptData, sceneCharacters: Record<string, string[]>): RelationshipEdge[] {
  const edges: RelationshipEdge[] = []
  let n = 0
  for (const scene of data.scenes) {
    for (const charId of sceneCharacters[scene.id] ?? []) {
      const firstBeat = Math.min(
        ...data.beats.filter((b) => b.sceneId === scene.id && b.characters.includes(charId)).map((b) => b.index),
      )
      n += 1
      edges.push({
        id: `cs${String(n).padStart(2, '0')}`,
        source: charId,
        target: scene.id,
        kind: 'character-scene',
        label: '出场',
        sentiment: 0,
        strength: 1,
        sinceBeat: firstBeat,
      })
    }
  }
  return edges
}

/* ──────────────────────────── 图谱节点 / 边 ──────────────────────────── */

function buildGraphNodes(data: ScriptData): GraphNode[] {
  return [
    ...data.characters.map<GraphNode>((c) => ({
      id: c.id,
      kind: 'character',
      label: c.name,
      labelEn: c.nameEn,
      color: NODE_COLORS.character,
      size: 22,
      avatar: c.avatar,
      meta: c.role,
    })),
    ...data.props.map<GraphNode>((p) => ({
      id: p.id,
      kind: 'prop',
      label: p.name,
      labelEn: p.nameEn,
      color: NODE_COLORS.prop,
      size: 13,
      meta: p.kind,
    })),
    ...data.scenes.map<GraphNode>((s) => ({
      id: s.id,
      kind: 'scene',
      label: s.name,
      labelEn: s.nameEn,
      color: NODE_COLORS.scene,
      size: 15,
      meta: s.code,
    })),
  ]
}

function buildGraphLinks(
  data: ScriptData,
  characterSceneEdges: RelationshipEdge[],
): GraphLink[] {
  const cc = data.relationships.filter((r) => r.kind === 'character-character')
  const cp = data.relationships.filter((r) => r.kind === 'character-prop')
  const ps = data.relationships.filter((r) => r.kind === 'prop-scene')
  return [
    ...cc.map<GraphLink>((e) => ({ source: e.source, target: e.target, label: e.label, sentiment: e.sentiment, strength: e.strength })),
    ...cp.map<GraphLink>((e) => ({ source: e.source, target: e.target, label: e.label, strength: e.strength })),
    ...ps.map<GraphLink>((e) => ({ source: e.source, target: e.target, label: e.label, strength: e.strength })),
    ...characterSceneEdges.map<GraphLink>((e) => ({ source: e.source, target: e.target, strength: e.strength })),
  ]
}

/* ──────────────────────────── 主入口 ──────────────────────────── */

/**
 * 从一份 ScriptData 构建全部派生数据。纯函数,无副作用。
 * Context 用 useMemo(() => buildDerived(data), [data]) 缓存。
 */
export function buildDerived(data: ScriptData): DerivedData {
  const sceneCharacters = buildSceneCharacters(data)
  const sceneBeats = buildSceneBeats(data)
  const characterSceneEdges = buildCharacterSceneEdges(data, sceneCharacters)
  const emotionSeries = data.beats.map((b) => ({
    beat: b.index,
    emotion: b.emotion,
    act: b.act,
    sceneId: b.sceneId,
    title: b.title,
  }))

  const characterRelationships = data.relationships.filter((r) => r.kind === 'character-character')
  const characterPropEdges = data.relationships.filter((r) => r.kind === 'character-prop')
  const propSceneEdges = data.relationships.filter((r) => r.kind === 'prop-scene')

  return {
    graphNodes: buildGraphNodes(data),
    graphLinks: buildGraphLinks(data, characterSceneEdges),
    emotionSeries,
    scriptStats: computeStats(data),
    sceneCharacters,
    sceneBeats,
    characterSceneEdges,
    characterRelationships,
    characterPropEdges,
    propSceneEdges,
    ...makeGetters(data),
  }
}
