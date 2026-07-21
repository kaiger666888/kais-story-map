/**
 * 剧本数据 Schema —— 全站类型定义的单一真相源
 *
 * 本文件从 src/data/nightferry.ts 提取所有 TypeScript 类型与常量,
 * 供前端页面、Context、以及 parser 引擎(parser/)共用。
 * nightferry.ts 自身也从这里 re-export,保证现有 `import { ... } from '@/data/nightferry'` 不变。
 *
 * ScriptData 是一份完整剧本的结构化表示:
 *   - parser 将剧本文本解析为 ScriptData(JSON)
 *   - 前端通过 ScriptDataContext 加载任意 ScriptData(默认回退到夜航演示数据)
 *   - DerivedData(图谱节点、情绪序列、统计、查询函数)由 buildDerived(ScriptData) 现场推导
 *
 * 情绪标尺:-5(绝望)→ +5(狂喜)
 */

/* ──────────────────────────── 字面量类型 / 常量 ──────────────────────────── */

export type NodeKind = 'character' | 'prop' | 'scene' | 'emotion' | 'event'
export type ActId = 1 | 2 | 3
export type BeatType = 'setup' | 'inciting' | 'rising' | 'turning' | 'crisis' | 'climax' | 'resolution'
export type EdgeKind = 'character-character' | 'character-prop' | 'character-scene' | 'prop-scene'

/** 图谱节点配色规范(全站统一) */
export const NODE_COLORS: Record<NodeKind, string> = {
  character: '#FFB347',
  scene: '#4DD8FF',
  prop: '#A78BFA',
  emotion: '#FF4D6D',
  event: '#7BE0A3',
}

export const EMOTION_MIN = -5
export const EMOTION_MAX = 5

/* ──────────────────────────── 实体接口 ──────────────────────────── */

export interface Character {
  id: string
  name: string
  nameEn: string
  role: string
  age: number
  gender: '女' | '男'
  /** 个人代表颜色(情绪曲线 / 人物卡使用;图谱节点统一 amber) */
  color: string
  avatar: string
  bio: string
  /** 人物动机 */
  desire: string
  tags: string[]
  /** 逐场情绪值(-5..+5);null = 该场不在场 / 失联 / 死亡 */
  arc: (number | null)[]
}

export interface PropAppearance {
  /** 场号 */
  beat: number
  sceneId: string
  note: string
  /** 该时点持有人 */
  holderId?: string
}

export interface ScriptProp {
  id: string
  name: string
  nameEn: string
  kind: '证据' | '工具' | '信物'
  /** 图谱节点统一 violet */
  color: string
  description: string
  /** 剧情重要性 1–5 */
  significance: number
  timeline: PropAppearance[]
}

export interface SceneLocation {
  id: string
  code: string
  name: string
  nameEn: string
  /** 图谱节点统一 cyan */
  color: string
  description: string
  /** 场景氛围关键词 */
  mood: string[]
}

export interface Beat {
  /** 场号(1 起) */
  index: number
  act: ActId
  /** 发生场景(如 S01) */
  sceneId: string
  title: string
  summary: string
  /** 本场情绪值(-5..+5) */
  emotion: number
  /** 本场出场人物 id */
  characters: string[]
  /** 本场涉及道具 id */
  props?: string[]
  /** 是否关键节拍 */
  key?: boolean
  type: BeatType
}

export interface Act {
  id: ActId
  name: string
  nameEn: string
  /** 场号区间(闭区间) */
  range: [number, number]
  color: string
  summary: string
}

export interface RelationshipEdge {
  id: string
  /** 节点 id(人物 id / 道具 id / 场景 id) */
  source: string
  target: string
  kind: EdgeKind
  /** 关系短语,如「猎手与猎物」 */
  label: string
  /** 关系情感倾向 -5(敌对)..+5(亲密);道具/场景边可为 0 */
  sentiment: number
  /** 关系强度 1–5(图谱边宽) */
  strength: number
  /** 关系建立场号 */
  sinceBeat: number
}

/* ──────────────────────────── 聚合:完整剧本 ──────────────────────────── */

export interface ScriptMeta {
  title: string
  titleEn: string
  genre: string
  synopsis: string
  /** 对白行数 —— 无法从 beat 结构推导,由 parser/meta 提供(缺省时按场数估算) */
  dialogueLines?: number
  /** 节奏熵(0–1) —— 缺省时按节拍间隔计算 */
  paceEntropy?: number
}

/**
 * 一份完整剧本的结构化数据。parser 的输出、前端的输入。
 * relationships 为统一数组,包含全部 EdgeKind(人物-人物 / 人物-道具 / 道具-场景);
 * buildDerived 会按 kind 分类使用。
 */
export interface ScriptData {
  meta: ScriptMeta
  characters: Character[]
  props: ScriptProp[]
  scenes: SceneLocation[]
  beats: Beat[]
  acts: Act[]
  relationships: RelationshipEdge[]
}

/* ──────────────────────────── 派生结构 ──────────────────────────── */

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  labelEn: string
  color: string
  /** 建议半径(px) */
  size: number
  avatar?: string
  meta?: string
}

export interface GraphLink {
  source: string
  target: string
  label?: string
  sentiment?: number
  strength: number
}

export interface ScriptStats {
  beats: number
  characters: number
  dialogueLines: number
  acts: number
  keyBeats: number
  /** 节奏熵(节拍间隔的信息熵,0–1) */
  paceEntropy: number
  /** 人物关系数 */
  relations: number
  /** 流转道具数 */
  propsFlow: number
  /** 情绪振幅 = 峰值 − 谷值 */
  emotionAmplitude: number
  peakBeat: number
  peakValue: number
  valleyBeat: number
  valleyValue: number
  /** 平均张力(|emotion| 均值归一化到 0–1) */
  avgTension: number
}

/** 全剧整体情绪曲线的一个点 */
export interface EmotionPoint {
  beat: number
  emotion: number
  act: ActId
  sceneId: string
  title: string
}

/**
 * 由 ScriptData 现场推导的全部派生数据与查询函数。
 * buildDerived(data) 产出;Context 以 useMemo 缓存。
 */
export interface DerivedData {
  /** 图谱节点(人物 + 道具 + 场景) */
  graphNodes: GraphNode[]
  /** 图谱边(全部关系 + 人物-场景出场) */
  graphLinks: GraphLink[]
  /** 全剧情绪曲线 */
  emotionSeries: EmotionPoint[]
  /** 全剧统计 */
  scriptStats: ScriptStats
  /** 场景 ↔ 出场人物 */
  sceneCharacters: Record<string, string[]>
  /** 场景 ↔ 出场场次 */
  sceneBeats: Record<string, number[]>
  /** 人物-场景出场边(由 beat 记录推导) */
  characterSceneEdges: RelationshipEdge[]
  /** 人物-人物关系边(relationships 子集) */
  characterRelationships: RelationshipEdge[]
  /** 人物-道具边(relationships 子集) */
  characterPropEdges: RelationshipEdge[]
  /** 道具-场景边(relationships 子集) */
  propSceneEdges: RelationshipEdge[]

  getCharacter: (id: string) => Character | undefined
  getProp: (id: string) => ScriptProp | undefined
  getScene: (id: string) => SceneLocation | undefined
  getBeat: (index: number) => Beat | undefined
  getAct: (id: ActId) => Act | undefined
  beatsOfAct: (id: ActId) => Beat[]
  /** 单个人物的逐场情绪序列(含 null) */
  characterArc: (id: string) => (number | null)[]
}

/* ──────────────────────────── 案例库条目(案例库专用,非动态) ──────────────────────────── */

export interface CaseEntry {
  id: string
  title: string
  titleEn: string
  genre: string
  poster: string
  beats: number
  characters: number
  amplitude: number
  paceEntropy: number
  oneLiner: string
  isDemo: boolean
}
