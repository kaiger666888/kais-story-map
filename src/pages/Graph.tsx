/**
 * 关系图谱 Graph — `/graph`
 * 《夜航》力导向拓扑工作台:筛选工具条 + d3-force 画布(拖拽/缩放/聚焦)
 * + 双点最短路径 + 右侧详情抽屉 + 42 场时间轴回放 + 图谱洞察。
 *
 * 图谱构成(与设计稿 S1 一致:35 节点 / 58 边 / 密度 0.097):
 *   8 人物 + 6 道具 + 12 场景(来自 GRAPH_NODES)+ 9 事件(由关键节拍派生)
 *   26 人物关系 + 10 人物-道具持有 + 8 道具-场景 + 9 事件-场景 + 5 事件-人物
 *   (事件按场景均匀选取并配人物锚定边,保证 12 场景全部连通;
 *    道具的完整「流转链」仍在详情抽屉中呈现)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import type { ForceLink, Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  Download,
  FileText,
  Flame,
  Image as ImageIcon,
  KeyRound,
  Layers,
  MapPin,
  Maximize2,
  Mic,
  Minus,
  Network,
  Orbit,
  Package,
  Play,
  Pause,
  Plus,
  Route,
  Search,
  SlidersHorizontal,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NodeChip, PanelCard } from '@/components/common'
import { NODE_COLORS } from '@/data/nightferry'
import type {
  ActId,
  Beat,
  Character,
  GraphNode,
  NodeKind,
  RelationshipEdge,
  ScriptProp,
} from '@/data/nightferry'
import { useScript } from '@/context/ScriptDataContext'

/* ──────────────────────────── 图谱数据构建 ──────────────────────────── */

type EdgeKind = 'cc' | 'cp' | 'ps' | 'es' | 'ec'
type RelCategory = 'kin' | 'conflict' | 'secret' | 'hold' | 'presence'
type LayoutMode = 'force' | 'act' | 'ring'

interface WorkNode {
  id: string
  kind: NodeKind
  label: string
  labelEn: string
  color: string
  size: number
  avatar?: string
  meta?: string
  sinceBeat: number
  act: ActId
}

interface WorkEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
  label: string
  sentiment: number
  strength: number
  sinceBeat: number
  category: RelCategory
  dashed: boolean
}

/** 9 个事件节点:跨场景选取的代表性节拍(覆盖道具-场景边未触及的 5 个场景) */
const EVENT_BEAT_INDICES = [5, 15, 16, 24, 25, 27, 30, 38, 42] as const
/** 事件 → 核心人物锚定边:为未被道具边覆盖的场景事件各配一条,保证全图连通 */
const EVENT_CHARACTER_ANCHORS: Record<number, string> = {
  16: 'jiangli',
  24: 'hanchong',
  25: 'jiangli',
  27: 'shenque',
  42: 'linwan',
}
const actOfBeat = (beat: number): ActId => (beat <= 12 ? 1 : beat <= 34 ? 2 : 3)
const eventNodeId = (beat: number) => `evt-${String(beat).padStart(2, '0')}`

const ccCategory = (sentiment: number): RelCategory =>
  sentiment >= 2 ? 'kin' : sentiment <= -2 ? 'conflict' : 'secret'

/* WORK_NODES / WORK_EDGES / NODE_MAP / ADJ / DEGREE 等派生资产由 buildGraphAssets(当前剧本数据)
   在组件内 useMemo 构建 —— 见下方 buildGraphAssets。 */

const KIND_LABEL: Record<NodeKind, string> = {
  character: '人物',
  scene: '场景',
  prop: '道具',
  event: '事件',
  emotion: '情绪',
}
const KIND_ORDER: NodeKind[] = ['character', 'scene', 'prop', 'event']
const KIND_ICON: Record<string, typeof Users> = {
  character: Users,
  scene: MapPin,
  prop: Package,
  event: Zap,
}
const CATEGORY_LABEL: Record<RelCategory, string> = {
  kin: '亲情',
  conflict: '对立',
  secret: '隐瞒',
  hold: '持有',
  presence: '在场',
}
const CATEGORY_COLOR: Record<RelCategory, string> = {
  kin: '#7BE0A3',
  conflict: '#FF4D6D',
  secret: '#9A937F',
  hold: '#A78BFA',
  presence: '#4DD8FF',
}
const REL_FILTER_OPTIONS: { value: RelCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部关系' },
  { value: 'kin', label: '亲情' },
  { value: 'conflict', label: '对立' },
  { value: 'secret', label: '隐瞒' },
  { value: 'hold', label: '持有' },
  { value: 'presence', label: '在场' },
]

const PROP_ICON: Record<string, typeof Mic> = {
  recorder: Mic,
  manifest: FileText,
  key: KeyRound,
  flare: Flame,
  medkit: Briefcase,
  photo: ImageIcon,
}

/* monoIdOf / lastSeenOf / twoHopSet / shortestPath / TOP_DEGREE / longestAbsence / BAILU_GAP /
   COMMUNITIES / crossEdges 均为「依赖当前剧本数据」的派生物,已移入下方 buildGraphAssets。 */

/* ──────────────────────────── 图谱派生资产(数据驱动) ──────────────────────────── */

/** buildGraphAssets 的入参 —— useScript() 提供的数据子集 */
interface GraphAssetsInput {
  characters: Character[]
  props: ScriptProp[]
  beats: Beat[]
  graphNodes: GraphNode[]
  sceneBeats: Record<string, number[]>
  relationships: RelationshipEdge[]
  characterPropEdges: RelationshipEdge[]
  propSceneEdges: RelationshipEdge[]
  getBeat: (i: number) => Beat | undefined
  getProp: (id: string) => ScriptProp | undefined
  getCharacter: (id: string) => Character | undefined
}

interface GraphAssets {
  WORK_NODES: WorkNode[]
  WORK_EDGES: WorkEdge[]
  NODE_MAP: Map<string, WorkNode>
  ADJ: Map<string, Set<string>>
  DEGREE: Map<string, number>
  GRAPH_NODE_COUNT: number
  GRAPH_EDGE_COUNT: number
  GRAPH_DENSITY: number
  TOP_DEGREE: { node: WorkNode; deg: number }[]
  BAILU_GAP: { from: number; to: number; len: number; back: number }
  COMMUNITIES: { id: string; name: string; en: string; color: string; members: string[] }[]
  monoIdOf: (node: WorkNode) => string
  lastSeenOf: (node: WorkNode) => number
  twoHopSet: (id: string) => Set<string>
  shortestPath: (a: string, b: string) => string[] | null
  crossEdges: (a: string[], b: string[]) => number
  beatCount: number
}

/**
 * 根据当前剧本数据(useScript 提供)构建 Graph 所需的全部派生资产。纯函数。
 * 组件以 useMemo(() => buildGraphAssets(script), [script.data]) 缓存;
 * 数据切换(?data=)时整套图谱 / 洞察随之重建。
 * 容错:事件场号、人物 / 道具锚定 id 在动态数据中不存在时自动跳过,不报错。
 */
function buildGraphAssets(d: GraphAssetsInput): GraphAssets {
  const beatCount = d.beats.length

  const firstAppearanceBeat = (charId: string): number => {
    let min = beatCount + 1
    for (const b of d.beats) if (b.characters.includes(charId) && b.index < min) min = b.index
    return min > beatCount ? 1 : min
  }
  const lastAppearanceBeat = (charId: string): number => {
    let max = 0
    for (const b of d.beats) if (b.characters.includes(charId) && b.index > max) max = b.index
    return max
  }

  /** 画布持有边:多持有记录的道具仅保留前两条(原规格);动态数据无 cp06/cp11 时 filter 无害 */
  const CP_CANVAS_EDGES = d.characterPropEdges.filter((e) => e.id !== 'cp06' && e.id !== 'cp11')
  /** 仅保留动态数据中真实存在的事件场号 */
  const eventBeats = (EVENT_BEAT_INDICES as readonly number[]).filter((bi) => d.getBeat(bi))

  const WORK_NODES: WorkNode[] = [
    ...d.graphNodes.map<WorkNode>((n) => {
      const sinceBeat =
        n.kind === 'character'
          ? firstAppearanceBeat(n.id)
          : n.kind === 'prop'
            ? Math.min(...(d.getProp(n.id)?.timeline.map((t) => t.beat) ?? [1]))
            : Math.min(...(d.sceneBeats[n.id] ?? [1]))
      return { ...n, sinceBeat, act: actOfBeat(sinceBeat) }
    }),
    ...eventBeats.map<WorkNode>((bi) => {
      const b = d.getBeat(bi)!
      const i = (EVENT_BEAT_INDICES as readonly number[]).indexOf(bi)
      return {
        id: eventNodeId(bi),
        kind: 'event',
        label: b.title,
        labelEn: `EVT.${String(i + 1).padStart(2, '0')}`,
        color: NODE_COLORS.event,
        size: 5,
        meta: b.sceneId,
        sinceBeat: bi,
        act: b.act,
      }
    }),
  ]

  const WORK_EDGES: WorkEdge[] = [
    ...d.relationships.map<WorkEdge>((e) => ({
      id: e.id, source: e.source, target: e.target, kind: 'cc',
      label: e.label, sentiment: e.sentiment, strength: e.strength, sinceBeat: e.sinceBeat,
      category: ccCategory(e.sentiment), dashed: e.sentiment <= -3,
    })),
    ...CP_CANVAS_EDGES.map<WorkEdge>((e) => ({
      id: e.id, source: e.source, target: e.target, kind: 'cp',
      label: e.label, sentiment: 0, strength: e.strength, sinceBeat: e.sinceBeat,
      category: 'hold', dashed: false,
    })),
    ...d.propSceneEdges.map<WorkEdge>((e) => ({
      id: e.id, source: e.source, target: e.target, kind: 'ps',
      label: e.label, sentiment: 0, strength: e.strength, sinceBeat: e.sinceBeat,
      category: 'presence', dashed: false,
    })),
    ...eventBeats.map<WorkEdge>((bi, i) => ({
      id: `es${String(i + 1).padStart(2, '0')}`, source: eventNodeId(bi), target: d.getBeat(bi)!.sceneId,
      kind: 'es', label: '发生于', sentiment: 0, strength: 2, sinceBeat: bi, category: 'presence', dashed: false,
    })),
    ...(Object.entries(EVENT_CHARACTER_ANCHORS) as [string, string][])
      .filter(([bi, charId]) => d.getBeat(Number(bi)) && d.getCharacter(charId))
      .map<WorkEdge>(([bi, charId], i) => ({
        id: `ec${String(i + 1).padStart(2, '0')}`, source: eventNodeId(Number(bi)), target: charId,
        kind: 'ec', label: '核心人物', sentiment: 0, strength: 2, sinceBeat: Number(bi), category: 'presence', dashed: false,
      })),
  ]

  const NODE_MAP = new Map<string, WorkNode>(WORK_NODES.map((n) => [n.id, n]))
  const ADJ = new Map<string, Set<string>>()
  const DEGREE = new Map<string, number>()
  for (const e of WORK_EDGES) {
    if (!ADJ.has(e.source)) ADJ.set(e.source, new Set())
    if (!ADJ.has(e.target)) ADJ.set(e.target, new Set())
    ADJ.get(e.source)!.add(e.target)
    ADJ.get(e.target)!.add(e.source)
    DEGREE.set(e.source, (DEGREE.get(e.source) ?? 0) + 1)
    DEGREE.set(e.target, (DEGREE.get(e.target) ?? 0) + 1)
  }

  const GRAPH_NODE_COUNT = WORK_NODES.length
  const GRAPH_EDGE_COUNT = WORK_EDGES.length
  const GRAPH_DENSITY = GRAPH_NODE_COUNT > 1 ? (2 * GRAPH_EDGE_COUNT) / (GRAPH_NODE_COUNT * (GRAPH_NODE_COUNT - 1)) : 0

  const monoIdOf = (node: WorkNode): string => {
    if (node.kind === 'character') {
      const i = d.characters.findIndex((c) => c.id === node.id)
      return `CHAR.${String(i + 1).padStart(2, '0')}`
    }
    if (node.kind === 'prop') {
      const i = d.props.findIndex((p) => p.id === node.id)
      return `PROP.${String(i + 1).padStart(2, '0')}`
    }
    if (node.kind === 'scene') return node.id
    return node.labelEn
  }

  const lastSeenOf = (node: WorkNode): number => {
    if (node.kind === 'character') return lastAppearanceBeat(node.id)
    if (node.kind === 'prop') return Math.max(...(d.getProp(node.id)?.timeline.map((t) => t.beat) ?? [0]))
    if (node.kind === 'scene') return Math.max(...(d.sceneBeats[node.id] ?? [0]))
    return node.sinceBeat
  }

  /** 双跳子图 */
  const twoHopSet = (id: string): Set<string> => {
    const out = new Set<string>([id])
    for (const n of ADJ.get(id) ?? []) {
      out.add(n)
      for (const n2 of ADJ.get(n) ?? []) out.add(n2)
    }
    return out
  }

  /** BFS 最短路径 */
  const shortestPath = (a: string, b: string): string[] | null => {
    if (a === b) return [a]
    const prev = new Map<string, string | null>([[a, null]])
    const queue = [a]
    while (queue.length) {
      const cur = queue.shift()!
      for (const nb of ADJ.get(cur) ?? []) {
        if (prev.has(nb)) continue
        prev.set(nb, cur)
        if (nb === b) {
          const path: string[] = [b]
          let p: string | null = cur
          while (p) {
            path.unshift(p)
            p = prev.get(p) ?? null
          }
          return path
        }
        queue.push(nb)
      }
    }
    return null
  }

  const TOP_DEGREE = [...DEGREE.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, deg]) => ({ node: NODE_MAP.get(id)!, deg }))
    .filter((x) => x.node)

  const longestAbsence = (charId: string): { from: number; to: number; len: number; back: number } => {
    const present = new Set<number>()
    for (const b of d.beats) if (b.characters.includes(charId)) present.add(b.index)
    let best = { from: 0, to: 0, len: 0, back: 0 }
    let runStart = 0
    for (let i = 1; i <= beatCount; i++) {
      if (!present.has(i)) {
        if (runStart === 0) runStart = i
      } else {
        if (runStart !== 0 && i - runStart > best.len) {
          best = { from: runStart, to: i - 1, len: i - runStart, back: i }
        }
        runStart = 0
      }
    }
    return best
  }
  const BAILU_GAP = longestAbsence('bailu')

  const COMMUNITIES = [
    { id: 'crew', name: '船方', en: 'CREW', color: '#4DD8FF', members: ['jiangli', 'shenque', 'laogui', 'achan'].filter((m) => NODE_MAP.has(m)) },
    { id: 'passenger', name: '乘客方', en: 'PASSENGERS', color: '#FFB347', members: ['linwan', 'suqiao', 'bailu'].filter((m) => NODE_MAP.has(m)) },
    { id: 'cargo', name: '货主方', en: 'CARGO', color: '#FF4D6D', members: ['hanchong'].filter((m) => NODE_MAP.has(m)) },
  ]
  const crossEdges = (a: string[], b: string[]): number =>
    d.relationships.filter(
      (e) => (a.includes(e.source) && b.includes(e.target)) || (a.includes(e.target) && b.includes(e.source)),
    ).length

  return {
    WORK_NODES, WORK_EDGES, NODE_MAP, ADJ, DEGREE,
    GRAPH_NODE_COUNT, GRAPH_EDGE_COUNT, GRAPH_DENSITY,
    TOP_DEGREE, BAILU_GAP, COMMUNITIES,
    monoIdOf, lastSeenOf, twoHopSet, shortestPath, crossEdges, beatCount,
  }
}

/* ──────────────────────────── 小组件 / hooks ──────────────────────────── */

function useCountUp(target: number, duration: number, delay: number, decimals: number): string {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = 0
    const begin = performance.now() + delay
    const step = (t: number) => {
      if (t < begin) {
        raf = requestAnimationFrame(step)
        return
      }
      if (!start) start = t
      const p = Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(target * e)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, delay])
  return val.toFixed(decimals)
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface SimNode extends SimulationNodeDatum, WorkNode {}
interface SimLink extends SimulationLinkDatum<SimNode> {
  edge: WorkEdge
}
interface Transform {
  k: number
  x: number
  y: number
}
interface Size {
  w: number
  h: number
}

const SCENE_CHIP_H = 26
function sceneChipWidth(n: WorkNode): number {
  return 24 + (n.meta?.length ?? 0) * 7.5 + n.label.length * 12
}
/** 边端点收缩:让连线止于节点轮廓之外 */
function trimDistance(n: WorkNode, ux: number, uy: number): number {
  if (n.kind === 'character') return 26
  if (n.kind === 'prop') return 22
  if (n.kind === 'event') return 9
  const rx = sceneChipWidth(n) / 2 + 5
  const ry = SCENE_CHIP_H / 2 + 5
  return 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2)
}

const LAYOUT_MODES: { value: LayoutMode; label: string; icon: typeof Network }[] = [
  { value: 'force', label: '力导向', icon: Network },
  { value: 'act', label: '按幕分组', icon: Layers },
  { value: 'ring', label: '环形', icon: Orbit },
]

/* ──────────────────────────── 主页面 ──────────────────────────── */

export default function Graph() {
  // 数据切换(?data=)时通过 key 完全重挂,使图谱派生资产 / 仿真 / 状态基于新剧本重建
  const { dataPath } = useScript()
  return <GraphImpl key={dataPath ?? '__default__'} />
}

function GraphImpl() {
  const navigate = useNavigate()

  /* 当前剧本数据(来自 ScriptDataContext:URL ?data= / localStorage / 默认) */
  const script = useScript()
  const assets = useMemo(() => buildGraphAssets(script), [script.data])
  const {
    WORK_NODES,
    WORK_EDGES,
    NODE_MAP,
    ADJ,
    DEGREE,
    GRAPH_NODE_COUNT,
    GRAPH_EDGE_COUNT,
    GRAPH_DENSITY,
    TOP_DEGREE,
    BAILU_GAP,
    COMMUNITIES,
    lastSeenOf,
    twoHopSet,
    shortestPath,
    crossEdges,
  } = assets
  const BEAT_COUNT = assets.beatCount
  // 查询函数与原始数组直接取自当前剧本数据
  const { getBeat, getScene, getCharacter, beats: BEATS } = script

  /* 画布状态 */
  const [size, setSize] = useState<Size>({ w: 960, h: 640 })
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 })
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force')

  /* 交互状态 */
  const [activeKinds, setActiveKinds] = useState<Set<NodeKind>>(new Set(KIND_ORDER))
  const [relFilter, setRelFilter] = useState<RelCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [pathMode, setPathMode] = useState(false)
  const [pathSel, setPathSel] = useState<string[]>([])
  const [pathResult, setPathResult] = useState<string[] | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [relMenuOpen, setRelMenuOpen] = useState(false)
  const [toolbarStuck, setToolbarStuck] = useState(false)

  /* 时间轴 */
  const [currentBeat, setCurrentBeat] = useState(BEAT_COUNT)
  const [playing, setPlaying] = useState(false)
  const [popIds, setPopIds] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const sizeRef = useRef(size)
  const transformRef = useRef(transform)
  const positionsRef = useRef(positions)
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const didDragRef = useRef(false)
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const animRafRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const prevBeatRef = useRef(BEAT_COUNT)

  sizeRef.current = size
  transformRef.current = transform
  positionsRef.current = positions

  /* ── 统计数字 count-up ── */
  const statNodes = useCountUp(GRAPH_NODE_COUNT, 1000, 400, 0)
  const statEdges = useCountUp(GRAPH_EDGE_COUNT, 1000, 520, 0)
  const statDensity = useCountUp(GRAPH_DENSITY, 1000, 640, 3)

  /* ── 容器尺寸 ── */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(320, r.width), h: Math.max(360, r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ── d3-force 仿真(挂载一次;节点从中心爆开入场) ── */
  useEffect(() => {
    const simNodes: SimNode[] = WORK_NODES.map((n) => ({ ...n, x: 0, y: 0 }))
    const simLinks: SimLink[] = WORK_EDGES.map((e) => ({ source: e.source, target: e.target, edge: e }))
    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(90)
          .strength((l) => 0.35 + l.edge.strength * 0.06),
      )
      .force('charge', forceManyBody().strength(-260))
      .force('collide', forceCollide<SimNode>((d) => d.size + 14).iterations(2))
      .force('x', forceX(0).strength(0.05))
      .force('y', forceY(0).strength(0.08))
      .alpha(0.9)
      .on('tick', () => {
        const next: Record<string, { x: number; y: number }> = {}
        for (const n of simNodes) next[n.id] = { x: n.x ?? 0, y: n.y ?? 0 }
        setPositions(next)
      })
    simRef.current = sim
    simNodesRef.current = simNodes
    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [])

  /* ── 布局切换 ── */
  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    const { w, h } = sizeRef.current
    const link = sim.force('link') as ForceLink<SimNode, SimLink> | undefined
    sim.force('radial', null)
    if (layoutMode === 'act') {
      link?.distance(64)
      sim.force('x', forceX<SimNode>((d) => (d.act - 2) * w * 0.27).strength(0.4))
      sim.force('y', forceY(0).strength(0.14))
    } else if (layoutMode === 'ring') {
      link?.distance(70)
      const R = Math.min(w, h)
      const radius = (kind: NodeKind) =>
        kind === 'character' ? R * 0.16 : kind === 'prop' ? R * 0.27 : kind === 'scene' ? R * 0.37 : R * 0.45
      sim.force('radial', forceRadial<SimNode>((d) => radius(d.kind), 0, 0).strength(0.75))
      sim.force('x', forceX(0).strength(0.02))
      sim.force('y', forceY(0).strength(0.02))
    } else {
      link?.distance(90)
      sim.force('x', forceX(0).strength(0.05))
      sim.force('y', forceY(0).strength(0.08))
    }
    sim.alpha(0.8).restart()
  }, [layoutMode, size])

  /* ── 滚轮缩放(0.4×–2.5×,围绕光标) ── */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const cx = e.clientX - rect.left - sizeRef.current.w / 2
      const cy = e.clientY - rect.top - sizeRef.current.h / 2
      setTransform((tf) => {
        const k = clamp(tf.k * Math.exp(-e.deltaY * 0.0016), 0.4, 2.5)
        const s = k / tf.k
        return { k, x: cx - (cx - tf.x) * s, y: cy - (cy - tf.y) * s }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  /* ── 工具条吸附阴影 ── */
  useEffect(() => {
    const onScroll = () => setToolbarStuck(window.scrollY > 140)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ── 播放(600ms/场) ── */
  useEffect(() => {
    if (!playing) return
    if (currentBeat >= BEAT_COUNT) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setCurrentBeat((b) => Math.min(BEAT_COUNT, b + 1)), 600)
    return () => clearTimeout(t)
  }, [playing, currentBeat])

  /* ── 时间轴物化 pop 脉冲 ── */
  useEffect(() => {
    const prev = prevBeatRef.current
    prevBeatRef.current = currentBeat
    if (currentBeat <= prev) return
    const fresh = new Set<string>()
    for (const n of WORK_NODES) if (n.sinceBeat > prev && n.sinceBeat <= currentBeat) fresh.add(n.id)
    for (const e of WORK_EDGES) if (e.sinceBeat > prev && e.sinceBeat <= currentBeat) fresh.add(e.id)
    if (fresh.size) {
      setPopIds(fresh)
      const t = setTimeout(() => setPopIds(new Set()), 900)
      return () => clearTimeout(t)
    }
  }, [currentBeat])

  /* ── 镜头动画 ── */
  const animateTransform = useCallback((to: Transform, dur = 600) => {
    cancelAnimationFrame(animRafRef.current)
    const from = transformRef.current
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = easeInOutCubic(p)
      setTransform({
        k: from.k + (to.k - from.k) * e,
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
      })
      if (p < 1) animRafRef.current = requestAnimationFrame(step)
    }
    animRafRef.current = requestAnimationFrame(step)
  }, [])

  const zoomToFit = useCallback(
    (ids: Set<string> | null, dur = 600) => {
      const pos = positionsRef.current
      const { w, h } = sizeRef.current
      const pts = (ids ? [...ids] : WORK_NODES.map((n) => n.id))
        .map((id) => pos[id])
        .filter((p): p is { x: number; y: number } => !!p)
      if (!pts.length) return
      const minX = Math.min(...pts.map((p) => p.x))
      const maxX = Math.max(...pts.map((p) => p.x))
      const minY = Math.min(...pts.map((p) => p.y))
      const maxY = Math.max(...pts.map((p) => p.y))
      const bw = Math.max(80, maxX - minX + 180)
      const bh = Math.max(80, maxY - minY + 180)
      const k = clamp(Math.min(w / bw, h / bh), 0.45, 2.2)
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      animateTransform({ k, x: -cx * k, y: -cy * k }, dur)
    },
    [animateTransform],
  )

  const centerOnNode = useCallback(
    (id: string, k = 1.25) => {
      const p = positionsRef.current[id]
      if (!p) return
      animateTransform({ k, x: -p.x * k, y: -p.y * k }, 600)
    },
    [animateTransform],
  )

  /* ── Esc 退出聚焦 / 路径 / 抽屉 ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (focusId) {
        setFocusId(null)
        zoomToFit(null)
      } else if (pathMode) {
        setPathMode(false)
        setPathSel([])
        setPathResult(null)
      } else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusId, pathMode, selectedId, zoomToFit])

  /* ── 节点拖拽(拖拽时冻结,松手回弹) ── */
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const tf = transformRef.current
    const { w, h } = sizeRef.current
    return {
      x: (clientX - rect.left - w / 2 - tf.x) / tf.k,
      y: (clientY - rect.top - h / 2 - tf.y) / tf.k,
    }
  }, [])

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation()
      dragRef.current = { id, moved: false }
      const node = simNodesRef.current.find((n) => n.id === id)
      if (node) {
        const p = toWorld(e.clientX, e.clientY)
        node.fx = p.x
        node.fy = p.y
      }
      simRef.current?.alphaTarget(0.25).restart()

      const move = (ev: globalThis.PointerEvent) => {
        const d = dragRef.current
        if (!d) return
        d.moved = true
        didDragRef.current = true
        const n = simNodesRef.current.find((nn) => nn.id === d.id)
        if (n) {
          const p = toWorld(ev.clientX, ev.clientY)
          n.fx = p.x
          n.fy = p.y
        }
      }
      const up = () => {
        const d = dragRef.current
        dragRef.current = null
        if (d) {
          const n = simNodesRef.current.find((nn) => nn.id === d.id)
          if (n) {
            n.fx = null
            n.fy = null
          }
        }
        simRef.current?.alphaTarget(0)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [toWorld],
  )

  /* ── 空白平移 ── */
  const onBgPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    panRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: transformRef.current.x,
      oy: transformRef.current.y,
      moved: false,
    }
    const move = (ev: globalThis.PointerEvent) => {
      const p = panRef.current
      if (!p) return
      const dx = ev.clientX - p.sx
      const dy = ev.clientY - p.sy
      if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true
      setTransform((tf) => ({ ...tf, x: p.ox + dx, y: p.oy + dy }))
    }
    const up = () => {
      panRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  /* ── 节点点击(选点模式 / 打开抽屉) ── */
  const onNodeClick = useCallback(
    (id: string) => {
      if (didDragRef.current) {
        didDragRef.current = false
        return
      }
      if (pathMode) {
        setPathSel((sel) => {
          if (sel.includes(id)) return sel
          const next = [...sel, id].slice(-2)
          if (next.length === 2) {
            const path = shortestPath(next[0], next[1])
            setPathResult(path)
            if (path) zoomToFit(new Set(path), 650)
          }
          return next
        })
        return
      }
      setSelectedId(id)
    },
    [pathMode, zoomToFit],
  )

  const onNodeDoubleClick = useCallback(
    (id: string) => {
      setFocusId(id)
      zoomToFit(twoHopSet(id), 600)
    },
    [zoomToFit],
  )

  /* ── 关系行点击:画布聚焦该节点 ── */
  const focusNodeFromDrawer = useCallback(
    (id: string) => {
      setSelectedId(id)
      centerOnNode(id, 1.3)
    },
    [centerOnNode],
  )

  /* ── 派生可视状态 ── */
  const matchedIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return new Set(
      WORK_NODES.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.labelEn.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          (n.meta ?? '').toLowerCase().includes(q),
      ).map((n) => n.id),
    )
  }, [query])

  const hoverSet = useMemo(() => {
    if (!hoverId) return null
    return new Set([hoverId, ...(ADJ.get(hoverId) ?? [])])
  }, [hoverId])

  const focusSet = useMemo(() => (focusId ? twoHopSet(focusId) : null), [focusId])
  const pathSet = useMemo(() => (pathResult ? new Set(pathResult) : null), [pathResult])
  const pathEdgeIds = useMemo(() => {
    if (!pathResult) return null
    const set = new Set<string>()
    for (const e of WORK_EDGES) {
      const si = pathResult.indexOf(e.source)
      const ti = pathResult.indexOf(e.target)
      if (si >= 0 && ti >= 0 && Math.abs(si - ti) === 1) set.add(e.id)
    }
    return set
  }, [pathResult])

  const nodeVisual = useCallback(
    (n: WorkNode): { opacity: number; scale: number } => {
      let opacity = 1
      let scale = 1
      if (!activeKinds.has(n.kind)) {
        opacity = Math.min(opacity, 0.06)
        scale = 0.6
      }
      if (matchedIds && !matchedIds.has(n.id)) opacity = Math.min(opacity, 0.22)
      if (hoverSet && !hoverSet.has(n.id)) opacity = Math.min(opacity, 0.2)
      if (focusSet && !focusSet.has(n.id)) {
        opacity = Math.min(opacity, 0.04)
        scale = Math.min(scale, 0.7)
      }
      if (pathSet && !pathSet.has(n.id)) opacity = Math.min(opacity, 0.15)
      if (n.sinceBeat > currentBeat) opacity = Math.min(opacity, 0.15)
      return { opacity, scale }
    },
    [activeKinds, matchedIds, hoverSet, focusSet, pathSet, currentBeat],
  )

  const edgeVisual = useCallback(
    (e: WorkEdge): { opacity: number; highlight: boolean; ghost: boolean } => {
      const s = NODE_MAP.get(e.source)!
      const t = NODE_MAP.get(e.target)!
      let opacity = 1
      let highlight = false
      if (!activeKinds.has(s.kind) || !activeKinds.has(t.kind)) opacity = Math.min(opacity, 0.04)
      if (relFilter !== 'all' && e.category !== relFilter) opacity = Math.min(opacity, 0.05)
      if (matchedIds && !(matchedIds.has(e.source) && matchedIds.has(e.target))) opacity = Math.min(opacity, 0.18)
      if (hoverSet) {
        if (e.source === hoverId || e.target === hoverId) highlight = true
        else opacity = Math.min(opacity, 0.15)
      }
      if (focusSet && !(focusSet.has(e.source) && focusSet.has(e.target))) opacity = Math.min(opacity, 0.04)
      if (pathEdgeIds) {
        if (pathEdgeIds.has(e.id)) highlight = true
        else opacity = Math.min(opacity, 0.06)
      }
      const ghost = e.sinceBeat > currentBeat
      if (ghost) opacity = Math.min(opacity, 0.15)
      return { opacity, highlight, ghost }
    },
    [activeKinds, relFilter, matchedIds, hoverSet, hoverId, focusSet, pathEdgeIds, currentBeat],
  )

  /* ── 导出 JSON ── */
  const exportJson = useCallback(() => {
    const payload = {
      script: '夜航 NIGHT FERRY',
      generated: new Date().toISOString(),
      stats: { nodes: GRAPH_NODE_COUNT, edges: GRAPH_EDGE_COUNT, density: Number(GRAPH_DENSITY.toFixed(3)) },
      nodes: WORK_NODES.map((n) => ({
        id: n.id,
        kind: n.kind,
        label: n.label,
        labelEn: n.labelEn,
        act: n.act,
        sinceBeat: n.sinceBeat,
        degree: DEGREE.get(n.id) ?? 0,
      })),
      links: WORK_EDGES.map((e) => ({
        source: e.source,
        target: e.target,
        kind: e.kind,
        category: e.category,
        label: e.label,
        sentiment: e.sentiment,
        strength: e.strength,
        sinceBeat: e.sinceBeat,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nightferry-graph.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  /* ── 时间轴拖动 ── */
  const scrubTo = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const r = track.getBoundingClientRect()
    const beat = clamp(Math.round(((clientX - r.left) / r.width) * (BEAT_COUNT - 1)) + 1, 1, BEAT_COUNT)
    setCurrentBeat(beat)
  }, [])

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      scrubTo(e.clientX)
      const move = (ev: globalThis.PointerEvent) => scrubTo(ev.clientX)
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [scrubTo],
  )

  const toggleKind = (kind: NodeKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const currentBeatData = getBeat(currentBeat) as Beat
  const currentScene = getScene(currentBeatData.sceneId)
  const hoverNode = hoverId ? NODE_MAP.get(hoverId) : null
  const selectedNode = selectedId ? NODE_MAP.get(selectedId) : null

  /* ── 边渲染 ── */
  const renderEdge = (e: WorkEdge, i: number) => {
    const p1 = positions[e.source]
    const p2 = positions[e.target]
    if (!p1 || !p2) return null
    const n1 = NODE_MAP.get(e.source)!
    const n2 = NODE_MAP.get(e.target)!
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const dist = Math.hypot(dx, dy)
    if (dist < 1) return null
    const ux = dx / dist
    const uy = dy / dist
    const t1 = trimDistance(n1, ux, uy)
    const t2 = trimDistance(n2, -ux, -uy)
    const x1 = p1.x + ux * t1
    const y1 = p1.y + uy * t1
    const x2 = p2.x - ux * t2
    const y2 = p2.y - uy * t2
    const v = edgeVisual(e)
    const onPath = pathEdgeIds?.has(e.id) ?? false

    let stroke = '#3A3A48'
    let width = e.kind === 'cc' ? (e.strength >= 4 ? 1.3 : 1) : 1
    let dash: string | undefined
    if (e.dashed) {
      stroke = '#FF4D6D'
      width = 1.5
      dash = '5 4'
    } else if (e.kind === 'cp') {
      stroke = '#A78BFA'
      width = 1.2
    } else if (e.kind === 'es' || e.kind === 'ec') {
      stroke = '#7BE0A355'
      dash = '2 4'
    } else if (e.kind === 'ps') {
      stroke = '#4DD8FF44'
    }
    if (v.highlight) {
      stroke = onPath ? '#FFB347' : e.dashed ? '#FF4D6D' : '#FFB347CC'
      width = onPath ? 2.5 : 2
    }

    return (
      <g key={e.id} className="gf-edge-enter" style={{ animationDelay: `${300 + i * 12}ms` }}>
        {/* 新建立关系闪色脉冲 */}
        {popIds.has(e.id) && !v.ghost && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={CATEGORY_COLOR[e.category]}
            strokeWidth={2.5}
            className="gf-edge-flash"
          />
        )}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={width}
          strokeDasharray={onPath ? '7 5' : dash}
          className={cn('gf-edge-line', onPath && 'gf-path-flow')}
          style={{ opacity: v.opacity }}
          markerStart={e.kind === 'cp' ? 'url(#gf-arrow-violet)' : undefined}
        >
          <title>{`${n1.label} — ${e.label} — ${n2.label}`}</title>
        </line>
        {/* hover 时显示关系标签 */}
        {hoverId && (e.source === hoverId || e.target === hoverId) && !pathEdgeIds && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 4}
            textAnchor="middle"
            className="gf-edge-tag"
            style={{ opacity: v.opacity }}
          >
            {e.label}
          </text>
        )}
      </g>
    )
  }

  /* ── 节点渲染 ── */
  const renderNode = (n: WorkNode, i: number) => {
    const p = positions[n.id] ?? { x: 0, y: 0 }
    const v = nodeVisual(n)
    const isSearchHit = (matchedIds?.has(n.id) ?? false) && query.trim() !== ''
    const isPathNode = pathSet?.has(n.id) ?? false
    const isFocusRoot = focusId === n.id
    const isSelected = selectedId === n.id
    const ghost = n.sinceBeat > currentBeat

    return (
      <g
        key={n.id}
        transform={`translate(${p.x}, ${p.y})`}
        className="gf-node"
        onPointerDown={(e) => onNodePointerDown(e, n.id)}
        onClick={() => onNodeClick(n.id)}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onNodeDoubleClick(n.id)
        }}
        onPointerEnter={() => setHoverId(n.id)}
        onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
        data-interactive
      >
        {/* 入场爆开 */}
        <g className="gf-node-enter" style={{ animationDelay: `${i * 20}ms` }}>
          {/* 筛选/聚焦过渡 */}
          <g
            style={{
              opacity: v.opacity,
              transform: `scale(${v.scale})`,
              transition: 'opacity 400ms cubic-bezier(0.22,1,0.36,1), transform 400ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {/* 时间轴物化 pop */}
            {popIds.has(n.id) && !ghost && (
              <circle r={n.size + 6} fill="none" stroke={n.color} strokeWidth={1.5} className="gf-mat-pop" />
            )}
            {/* 搜索命中脉冲 */}
            {isSearchHit && (
              <circle r={n.size + 8} fill="none" stroke="#FFB347" strokeWidth={1.5} className="gf-search-pulse" />
            )}
            {/* 路径节点光圈 */}
            {isPathNode && <circle r={n.size + 7} fill="none" stroke="#FFB347" strokeWidth={1.2} opacity={0.7} />}
            {isFocusRoot && (
              <circle r={n.size + 10} fill="none" stroke="#4DD8FF" strokeWidth={1} strokeDasharray="3 4" opacity={0.8} />
            )}

            {n.kind === 'character' && (
              <g>
                {n.id === 'linwan' && (
                  <circle r={n.size + 5} fill="none" stroke="#FFB34755" strokeWidth={1} className="gf-glow-ring" />
                )}
                <circle
                  r={n.size + 2}
                  fill="#0E0E16"
                  stroke={isPathNode || isSelected ? '#FFB347' : n.color}
                  strokeWidth={isPathNode || isSelected ? 2.5 : 2}
                />
                <clipPath id={`gf-clip-${n.id}`}>
                  <circle r={n.size - 1} />
                </clipPath>
                <text y={5} textAnchor="middle" fill="#FFB347" fontSize={14} fontWeight={700}>
                  {n.label[0]}
                </text>
                <image
                  href={n.avatar}
                  x={-(n.size - 1)}
                  y={-(n.size - 1)}
                  width={(n.size - 1) * 2}
                  height={(n.size - 1) * 2}
                  clipPath={`url(#gf-clip-${n.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
                <text y={n.size + 16} textAnchor="middle" className="gf-node-label" fill="#F2EAD8">
                  {n.label}
                </text>
              </g>
            )}

            {n.kind === 'scene' && (
              <g>
                <rect
                  x={-sceneChipWidth(n) / 2}
                  y={-SCENE_CHIP_H / 2}
                  width={sceneChipWidth(n)}
                  height={SCENE_CHIP_H}
                  rx={8}
                  fill="#0E0E16"
                  stroke={isPathNode || isSelected ? '#4DD8FF' : '#4DD8FF99'}
                  strokeWidth={isPathNode || isSelected ? 2 : 1.2}
                />
                <text textAnchor="middle" y={3.5} className="gf-scene-chip" fill="#4DD8FF">
                  {n.meta} {n.label}
                </text>
              </g>
            )}

            {n.kind === 'prop' && (
              <g>
                <rect
                  x={-13}
                  y={-13}
                  width={26}
                  height={26}
                  rx={4}
                  transform="rotate(45)"
                  fill="#0E0E16"
                  stroke={isPathNode || isSelected ? '#A78BFA' : '#A78BFA99'}
                  strokeWidth={isPathNode || isSelected ? 2 : 1.2}
                />
                {(() => {
                  const Icon = PROP_ICON[n.id] ?? Package
                  return <Icon x={-6} y={-6} width={12} height={12} color="#A78BFA" strokeWidth={1.8} />
                })()}
                <text y={28} textAnchor="middle" className="gf-node-label" fill="#C9C2B0">
                  {n.label}
                </text>
              </g>
            )}

            {n.kind === 'event' && (
              <g>
                <circle r={5} fill={isPathNode || isSelected ? '#7BE0A3' : '#7BE0A3CC'} />
                <circle r={5} fill="none" stroke="#7BE0A355" strokeWidth={4} opacity={0.35} />
                <text x={10} y={3} className="gf-event-label" fill="#7BE0A3">
                  {n.label}
                </text>
              </g>
            )}
          </g>
        </g>
      </g>
    )
  }

  /* ── 侧栏内容 ── */
  const sidebarContent = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div>
        <p className="mono-label mb-3">LEGEND — 图例</p>
        <ul className="space-y-2.5">
          {KIND_ORDER.map((kind) => {
            const count = WORK_NODES.filter((n) => n.kind === kind).length
            return (
              <li key={kind} className="flex items-center gap-2.5">
                <span
                  className={cn('h-2.5 w-2.5', kind === 'prop' ? 'rotate-45 rounded-[2px]' : 'rounded-full')}
                  style={{ backgroundColor: NODE_COLORS[kind], boxShadow: `0 0 8px ${NODE_COLORS[kind]}66` }}
                />
                <span className="text-xs text-paper">{KIND_LABEL[kind]}</span>
                <span className="ml-auto font-mono text-[0.6875rem] text-paper-dim">{count}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-ink-line pt-5">
        <p className="mono-label mb-3">EDGES — 关系线</p>
        <ul className="space-y-2.5 text-xs text-paper-dim">
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-0 w-6 border-t border-dashed border-rose" />
            关键冲突(虚线)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-0 w-6 border-t border-violet" />
            持有道具(箭头指向持有者)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-0 w-6 border-t border-[#4DD8FF66]" />
            在场 / 发生地
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-0 w-6 border-t border-[#3A3A48]" />
            一般关系
          </li>
        </ul>
      </div>

      <div className="border-t border-ink-line pt-5">
        <p className="mono-label mb-3">HUBS — 度数 TOP5</p>
        <ul className="space-y-2">
          {TOP_DEGREE.map(({ node, deg }) => (
            <li key={node.id}>
              <button
                className="flex w-full items-center gap-2 text-left text-xs text-paper-dim transition-colors hover:text-paper"
                onClick={() => focusNodeFromDrawer(node.id)}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: node.color }} />
                <span className="truncate">{node.label}</span>
                <span className="ml-auto font-mono text-[0.6875rem] text-amber">{deg}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-ink-line pt-5">
        <p className="mono-label mb-2">TIPS — 操作</p>
        <ul className="space-y-1.5 font-mono text-[0.6875rem] leading-5 text-paper-dim/80">
          <li>拖拽节点 · 松手回弹</li>
          <li>滚轮缩放 · 空白拖拽平移</li>
          <li>单击详情 · 双击聚焦两跳</li>
          <li>Esc 退出聚焦 / 路径模式</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="relative">
      <style>{GRAPH_CSS}</style>

      {/* ═══ S1 · 页首引导条 ═══ */}
      <section className="site-container relative overflow-hidden py-16">
        <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-10">
          <div className="max-w-2xl">
            <p className="mono-label flex items-center gap-3">
              <span className="inline-block h-px w-6 bg-amber" />
              ROOM.01 — TOPOLOGY
            </p>
            <h1 className="mt-4 font-serif text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.02em] text-paper">
              {'关系图谱'.split('').map((ch, i) => (
                <motion.span
                  key={ch + i}
                  className="inline-block"
                  initial={{ y: 28, opacity: 0, rotate: 2 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="mt-4 leading-7 text-paper-dim"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              {script.meta.title} · {script.characters.length} 人物 · {script.props.length} 道具 · {script.scenes.length} 场景 · {GRAPH_NODE_COUNT} 个节点 · {GRAPH_EDGE_COUNT} 条边。
              拖拽、缩放、聚焦、查径——整张情报板由你拆解。
            </motion.p>
          </div>
          <div className="flex gap-4">
            {[
              { label: '节点', value: statNodes },
              { label: '边', value: statEdges },
              { label: '密度', value: statDensity },
            ].map((s) => (
              <motion.div
                key={s.label}
                className="min-w-[92px] rounded-xl border border-ink-line bg-ink-900 px-4 py-3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <p className="font-mono text-2xl font-bold text-amber">{s.value}</p>
                <p className="mono-tick mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S2 · 工具条(吸顶) ═══ */}
      <div
        className={cn(
          'sticky top-16 z-40 border-b border-ink-line bg-ink-900/95 backdrop-blur-[8px] transition-all duration-300',
          toolbarStuck ? 'shadow-[0_8px_30px_rgba(0,0,0,0.45)]' : 'shadow-none',
        )}
      >
        <div className="site-container flex items-center gap-2.5 overflow-x-auto py-2.5">
          {/* 搜索 */}
          <div className="group relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-paper-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索节点:人名 / 道具 / 场景"
              className="w-56 rounded-full border border-ink-line bg-ink-800 py-1.5 pl-9 pr-8 font-mono text-xs text-paper placeholder:text-paper-dim/60 focus:border-amber focus:outline-none"
            />
            {query && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-paper-dim hover:text-paper"
                onClick={() => setQuery('')}
                aria-label="清除搜索"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span className="hidden h-5 w-px shrink-0 bg-ink-line md:block" />

          {/* 类型筛选 */}
          <div className="flex shrink-0 items-center gap-1.5">
            {KIND_ORDER.map((kind) => {
              const Icon = KIND_ICON[kind]
              const active = activeKinds.has(kind)
              return (
                <button
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all duration-300',
                    active ? 'text-paper' : 'border-ink-line text-paper-dim/50 hover:text-paper-dim',
                  )}
                  style={
                    active
                      ? { borderColor: `${NODE_COLORS[kind]}66`, backgroundColor: `${NODE_COLORS[kind]}14` }
                      : undefined
                  }
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: active ? NODE_COLORS[kind] : undefined }} />
                  {KIND_LABEL[kind]}
                </button>
              )
            })}
          </div>

          <span className="hidden h-5 w-px shrink-0 bg-ink-line md:block" />

          {/* 关系筛选 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setRelMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full border border-ink-line bg-ink-800 px-3.5 py-1.5 text-xs text-paper-dim transition-colors hover:text-paper"
            >
              {REL_FILTER_OPTIONS.find((o) => o.value === relFilter)?.label}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', relMenuOpen && 'rotate-180')} />
            </button>
            {relMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRelMenuOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-32 overflow-hidden rounded-xl border border-ink-line bg-ink-800 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                  {REL_FILTER_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      className={cn(
                        'flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs transition-colors hover:bg-ink-900',
                        relFilter === o.value ? 'text-amber' : 'text-paper-dim hover:text-paper',
                      )}
                      onClick={() => {
                        setRelFilter(o.value)
                        setRelMenuOpen(false)
                      }}
                    >
                      {o.value !== 'all' && (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLOR[o.value as RelCategory] }}
                        />
                      )}
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 布局切换 */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-ink-line bg-ink-800 p-1">
            {LAYOUT_MODES.map((m) => {
              const Icon = m.icon
              const active = layoutMode === m.value
              return (
                <button
                  key={m.value}
                  title={m.label}
                  onClick={() => setLayoutMode(m.value)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200',
                    active ? 'bg-amber text-ink-950' : 'text-paper-dim hover:text-paper',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* 路径查找 */}
            <button
              onClick={() => {
                setPathMode((m) => !m)
                setPathSel([])
                setPathResult(null)
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-all duration-200',
                pathMode ? 'border-rose bg-rose/15 text-rose' : 'border-rose/60 text-rose hover:bg-rose/10',
              )}
            >
              <Route className="h-3.5 w-3.5" />
              {pathMode ? '选点中…' : '路径查找'}
            </button>
            {/* 导出 JSON */}
            <button
              onClick={exportJson}
              className="flex items-center gap-1.5 rounded-full border border-ink-line px-3.5 py-1.5 text-xs text-paper-dim transition-colors hover:border-paper-dim/40 hover:text-paper"
            >
              <Download className="h-3.5 w-3.5" />
              导出 JSON
            </button>
          </div>
        </div>
      </div>

      {/* ═══ S3 · 主画布 ═══ */}
      <section className="flex border-b border-ink-line">
        {/* 左侧筛选/图例栏 */}
        <aside className="hidden w-60 shrink-0 border-r border-ink-line bg-ink-950/80 lg:block">{sidebarContent}</aside>

        <div
          ref={containerRef}
          className="bg-grid relative h-[calc(100dvh-220px)] min-h-[540px] flex-1 overflow-hidden bg-ink-950"
        >
          <svg
            ref={svgRef}
            width={size.w}
            height={size.h}
            style={{ display: 'block', touchAction: 'none', cursor: pathMode ? 'crosshair' : 'grab' }}
            onPointerDown={onBgPointerDown}
            onDoubleClick={() => {
              if (focusId) {
                setFocusId(null)
                zoomToFit(null)
              }
            }}
          >
            <defs>
              <marker
                id="gf-arrow-violet"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#A78BFA" />
              </marker>
            </defs>

            {/* 罗盘玫瑰装饰(屏幕空间,不随缩放) */}
            <g transform={`translate(${size.w - 110}, ${size.h - 190})`} opacity={0.1} pointerEvents="none">
              {[34, 60, 86].map((r) => (
                <circle key={r} r={r} fill="none" stroke="#F2EAD8" strokeWidth={0.6} />
              ))}
              <line x1={-92} y1={0} x2={92} y2={0} stroke="#F2EAD8" strokeWidth={0.6} />
              <line x1={0} y1={-92} x2={0} y2={92} stroke="#F2EAD8" strokeWidth={0.6} />
              <text y={-96} textAnchor="middle" fontSize={8} fill="#F2EAD8" fontFamily="monospace">N</text>
              <text y={102} textAnchor="middle" fontSize={8} fill="#F2EAD8" fontFamily="monospace">38.2°N</text>
              <text x={98} y={3} fontSize={8} fill="#F2EAD8" fontFamily="monospace">121.6°E</text>
            </g>

            <g transform={`translate(${size.w / 2 + transform.x}, ${size.h / 2 + transform.y}) scale(${transform.k})`}>
              {/* 按幕分组列标签 */}
              {layoutMode === 'act' &&
                ([-1, 0, 1] as const).map((col) => (
                  <text
                    key={col}
                    x={col * size.w * 0.27}
                    y={-size.h * 0.34}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#9A937F"
                    fontFamily="monospace"
                    letterSpacing={2}
                    opacity={0.7}
                  >
                    {col === -1 ? 'ACT I' : col === 0 ? 'ACT II' : 'ACT III'}
                  </text>
                ))}
              {WORK_EDGES.map(renderEdge)}
              {WORK_NODES.map(renderNode)}
            </g>
          </svg>

          {/* 顶部:路径条 / 模式提示 */}
          <AnimatePresence>
            {pathResult && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="absolute left-1/2 top-3 z-10 flex max-w-[90%] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-amber/50 bg-ink-900/95 py-1.5 pl-4 pr-2 shadow-glow-amber"
              >
                <Route className="h-3.5 w-3.5 shrink-0 text-amber" />
                {pathResult.map((id, i) => (
                  <span key={id} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-amber">→</span>}
                    <span className="font-mono text-xs text-paper">{NODE_MAP.get(id)?.label}</span>
                  </span>
                ))}
                <span className="mono-tick ml-1 text-amber">{pathResult.length - 1} 跳</span>
                <button
                  className="ml-1 rounded-full p-1 text-paper-dim hover:text-paper"
                  onClick={() => {
                    setPathResult(null)
                    setPathSel([])
                  }}
                  aria-label="清除路径"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
            {pathMode && !pathResult && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-rose/50 bg-ink-900/95 px-4 py-1.5"
              >
                <span className="font-mono text-xs text-rose">
                  {pathSel.length === 0
                    ? '路径模式:点击第一个节点'
                    : `已选 ${NODE_MAP.get(pathSel[0])?.label} · 再点一个节点`}
                </span>
              </motion.div>
            )}
            {focusId && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan/40 bg-ink-900/95 px-4 py-1.5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                <span className="font-mono text-xs text-cyan">
                  聚焦 {NODE_MAP.get(focusId)?.label} · 两跳子图 · Esc 退出
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 右上:缩放控制 */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
            {[
              {
                icon: Plus,
                label: '放大',
                fn: () =>
                  animateTransform({ ...transformRef.current, k: clamp(transformRef.current.k * 1.25, 0.4, 2.5) }, 200),
              },
              {
                icon: Minus,
                label: '缩小',
                fn: () =>
                  animateTransform({ ...transformRef.current, k: clamp(transformRef.current.k / 1.25, 0.4, 2.5) }, 200),
              },
              { icon: Maximize2, label: '适配全图', fn: () => zoomToFit(null) },
            ].map((b) => (
              <button
                key={b.label}
                title={b.label}
                onClick={b.fn}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-line bg-ink-900/90 text-paper-dim transition-colors hover:text-paper"
              >
                <b.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {/* 移动端:图例抽屉开关 */}
          <button
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-ink-line bg-ink-900/90 text-paper-dim lg:hidden"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="图例"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="absolute bottom-0 left-0 top-0 z-20 w-60 border-r border-ink-line bg-ink-900 lg:hidden"
              >
                <button
                  className="absolute right-3 top-3 z-10 text-paper-dim"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
                {sidebarContent}
              </motion.aside>
            )}
          </AnimatePresence>

          {/* 左下:hover 快捷信息卡 */}
          <AnimatePresence>
            {hoverNode && (
              <motion.div
                key={hoverNode.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-none absolute bottom-[88px] left-3 z-10 w-52 rounded-xl border border-ink-line bg-ink-900/95 p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hoverNode.color }} />
                  <span className="font-serif text-sm font-bold text-paper">{hoverNode.label}</span>
                  <span className="mono-tick ml-auto">{KIND_LABEL[hoverNode.kind]}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5 font-mono text-[0.6875rem] text-paper-dim">
                  <span>
                    度数 <span className="text-amber">{DEGREE.get(hoverNode.id) ?? 0}</span>
                  </span>
                  <span>
                    最近出场 <span className="text-amber">第{lastSeenOf(hoverNode)}场</span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ S5 · 时间轴回放条 ═══ */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex h-[72px] items-center gap-4 border-t border-ink-line bg-ink-900/95 px-4 backdrop-blur">
            <div className="hidden shrink-0 md:block">
              <p className="mono-label text-[0.625rem]">TIMELINE</p>
              <p className="mono-tick mt-0.5">按场次回放</p>
            </div>
            <button
              onClick={() => {
                if (!playing && currentBeat >= BEAT_COUNT) setCurrentBeat(1)
                setPlaying((p) => !p)
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink-950 transition-shadow hover:shadow-glow-amber"
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>

            <div className="min-w-0 flex-1">
              <div
                ref={trackRef}
                className="relative flex h-8 cursor-pointer items-end gap-[2px]"
                onPointerDown={onTrackPointerDown}
              >
                {BEATS.map((b) => {
                  const active = b.index <= currentBeat
                  const isCurrent = b.index === currentBeat
                  const actColor = b.act === 1 ? '#F2EAD8' : b.act === 2 ? '#FFB347' : '#FF4D6D'
                  return (
                    <div
                      key={b.index}
                      className="flex-1 rounded-sm transition-all duration-300"
                      style={{
                        height: isCurrent ? '100%' : b.key ? '70%' : '45%',
                        backgroundColor: actColor,
                        opacity: isCurrent ? 1 : active ? 0.55 : 0.14,
                      }}
                      title={`第${b.index}场 · ${b.title}`}
                    />
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[0.5625rem] tracking-[0.08em] text-paper-dim/60">
                <span>ACT I</span>
                <span>ACT II</span>
                <span>ACT III</span>
              </div>
            </div>

            <div className="w-40 shrink-0 text-right">
              <p className="font-mono text-xs text-cyan">
                {currentScene?.code} {currentScene?.name}
              </p>
              <p className="mono-tick mt-0.5 truncate">
                第 {String(currentBeat).padStart(2, '0')} 场 / {BEAT_COUNT} · {currentBeatData.title}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ S4 · 节点详情抽屉 ═══ */}
      <AnimatePresence>
        {selectedNode && (
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed bottom-0 right-0 top-16 z-40 w-[420px] max-w-full overflow-y-auto border-l border-ink-line bg-ink-900"
          >
            <DrawerContent
              key={selectedNode.id}
              node={selectedNode}
              assets={assets}
              onClose={() => setSelectedId(null)}
              onFocusNode={focusNodeFromDrawer}
              onJumpEmotion={(beat) => navigate(`/emotion?beat=${beat}`)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══ S6 · 图谱洞察 ═══ */}
      <section className="site-container py-24">
        <p className="mono-label flex items-center gap-3">
          <span className="inline-block h-px w-6 bg-amber" />
          INSIGHTS — 图谱洞察
        </p>
        <h2 className="mt-4 font-serif text-[clamp(1.8rem,3.4vw,2.8rem)] font-bold text-paper">这张网在说什么</h2>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {/* 枢纽人物排行 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <PanelCard index="FIG.01" accent="#FFB347" className="h-full">
              <p className="mono-label mb-1 mt-3">枢纽人物排行</p>
              <p className="mb-5 text-xs text-paper-dim">按度数中心性 Top 5</p>
              <ul className="space-y-3.5">
                {TOP_DEGREE.map(({ node, deg }, i) => (
                  <li key={node.id}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="flex items-center gap-2 text-sm text-paper">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: node.color }} />
                        {node.label}
                        <span className="mono-tick">{KIND_LABEL[node.kind]}</span>
                      </span>
                      <span className="font-mono text-xs text-amber">{deg}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: '#FFB347' }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(deg / TOP_DEGREE[0].deg) * 100}%` }}
                        viewport={{ once: true, amount: 0.25 }}
                        transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </PanelCard>
          </motion.div>

          {/* 孤立要素提醒 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <PanelCard index="FIG.02" accent="#FF4D6D" className="relative h-full overflow-hidden">
              <div className="gf-warn-border absolute inset-y-4 left-0 w-[2px] rounded-full bg-rose" />
              <div className="mt-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose" />
                <p className="mono-label !text-rose">孤立要素提醒</p>
              </div>
              {BAILU_GAP.len > 0 ? (
                <>
                  <p className="mt-4 font-serif text-lg font-bold leading-7 text-paper">
                    白露自第 {BAILU_GAP.from} 场起连续 {BAILU_GAP.len} 场未出场
                  </p>
                  <p className="mt-2 text-sm leading-6 text-paper-dim">
                    第 {BAILU_GAP.back} 场她才在救生艇底被找回——ACT II 中段存在感断层,长线人物几乎脱网。
                    考虑回收戏份,或在前 12 场前置埋线。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <NodeChip kind="character" label="白露 · 线人" />
                    <NodeChip kind="event" label={`缺席 ${BAILU_GAP.len} 场`} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-paper-dim">
                  当前剧本未检测到长线人物的显著缺席断层。
                </p>
              )}
            </PanelCard>
          </motion.div>

          {/* 社群检测 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <PanelCard index="FIG.03" accent="#4DD8FF" className="h-full">
              <p className="mono-label mb-1 mt-3">社群检测</p>
              <p className="mb-5 text-xs text-paper-dim">自动聚类的 3 个团伙</p>
              <div className="space-y-4">
                {COMMUNITIES.map((c) => (
                  <div key={c.id}>
                    <p className="mb-2 flex items-baseline gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: c.color }}>
                        {c.name}
                      </span>
                      <span className="mono-tick">{c.en}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.members.map((id) => (
                        <button
                          key={id}
                          onClick={() => focusNodeFromDrawer(id)}
                          className="rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-transform duration-200 hover:-translate-y-0.5"
                          style={{ borderColor: `${c.color}55`, color: c.color }}
                        >
                          {getCharacter(id)?.name ?? id}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-1 border-t border-ink-line pt-4 font-mono text-[0.6875rem] text-paper-dim">
                <p>船方 ↔ 乘客方 · {crossEdges(COMMUNITIES[0].members, COMMUNITIES[1].members)} 条连线</p>
                <p>船方 ↔ 货主方 · {crossEdges(COMMUNITIES[0].members, COMMUNITIES[2].members)} 条连线</p>
                <p>乘客方 ↔ 货主方 · {crossEdges(COMMUNITIES[1].members, COMMUNITIES[2].members)} 条连线</p>
              </div>
            </PanelCard>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

/* ──────────────────────────── 详情抽屉 ──────────────────────────── */

const drawerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const drawerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

function DrawerContent({
  node,
  onClose,
  onFocusNode,
  onJumpEmotion,
  assets,
}: {
  node: WorkNode
  onClose: () => void
  onFocusNode: (id: string) => void
  onJumpEmotion: (beat: number) => void
  assets: GraphAssets
}) {
  const script = useScript()
  const { getCharacter, getProp, getScene, getBeat, beats: BEATS, sceneBeats: SCENE_BEATS } = script
  const { WORK_EDGES, NODE_MAP, monoIdOf, beatCount: BEAT_COUNT } = assets
  const character = node.kind === 'character' ? getCharacter(node.id) : undefined
  const prop = node.kind === 'prop' ? getProp(node.id) : undefined
  const scene = node.kind === 'scene' ? getScene(node.id) : undefined
  const eventBeat = node.kind === 'event' ? getBeat(node.sinceBeat) : undefined

  /* 出场标记(42 场) */
  const presentBeats = new Set<number>()
  if (character) character.arc.forEach((v, i) => v !== null && presentBeats.add(i + 1))
  if (scene) (SCENE_BEATS[scene.id] ?? []).forEach((b) => presentBeats.add(b))
  if (eventBeat) presentBeats.add(eventBeat.index)

  /* 关系列表(按类型分组) */
  const incident = WORK_EDGES.filter((e) => e.source === node.id || e.target === node.id)
  const grouped = new Map<RelCategory, { edge: WorkEdge; other: WorkNode }[]>()
  for (const e of incident) {
    const otherId = e.source === node.id ? e.target : e.source
    const other = NODE_MAP.get(otherId)!
    if (!grouped.has(e.category)) grouped.set(e.category, [])
    grouped.get(e.category)!.push({ edge: e, other })
  }

  /* 关联原文摘录 */
  const quotes: { tag: string; text: string }[] = []
  if (character) {
    BEATS.filter((b) => b.characters.includes(character.id))
      .sort((a, b) => Number(b.key ?? false) - Number(a.key ?? false) || Math.abs(b.emotion) - Math.abs(a.emotion))
      .slice(0, 3)
      .forEach((b) => quotes.push({ tag: `第${b.index}场 · ${b.title}`, text: b.summary }))
  } else if (prop) {
    quotes.push({ tag: `道具档案 · ${prop.kind}`, text: prop.description })
    prop.timeline.slice(0, 2).forEach((t) => quotes.push({ tag: `第${t.beat}场 · ${t.sceneId}`, text: t.note }))
  } else if (scene) {
    quotes.push({ tag: `场景档案 · ${scene.nameEn}`, text: scene.description })
    const sceneBeats = SCENE_BEATS[scene.id] ?? []
    sceneBeats.slice(0, 2).forEach((bi) => {
      const b = getBeat(bi)
      if (b) quotes.push({ tag: `第${b.index}场 · ${b.title}`, text: b.summary })
    })
  } else if (eventBeat) {
    quotes.push({ tag: `第${eventBeat.index}场 · ${eventBeat.sceneId}`, text: eventBeat.summary })
  }

  return (
    <motion.div
      className="relative p-6"
      variants={drawerContainer}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-ink-line text-paper-dim transition-colors hover:text-paper"
        aria-label="关闭详情"
      >
        <X className="h-4 w-4" />
      </button>

      {/* 1 · 头部 */}
      <motion.div variants={drawerItem} className="flex items-center gap-4">
        {character ? (
          <span className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 border-amber">
            <span className="absolute inset-0 flex items-center justify-center font-serif text-2xl font-black text-amber">
              {character.name[0]}
            </span>
            <img src={character.avatar} alt={character.name} className="absolute inset-0 h-full w-full object-cover" />
          </span>
        ) : (
          <span
            className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border"
            style={{ borderColor: `${node.color}88`, backgroundColor: `${node.color}11` }}
          >
            {(() => {
              const Icon = node.kind === 'prop' ? PROP_ICON[node.id] ?? Package : KIND_ICON[node.kind]
              return <Icon className="h-7 w-7" style={{ color: node.color }} />
            })()}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-bold text-paper">{node.label}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <NodeChip kind={node.kind} label={KIND_LABEL[node.kind]} />
            <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-paper-dim">{monoIdOf(node)}</span>
          </div>
          {node.meta && node.kind !== 'event' && <p className="mono-tick mt-1.5">{node.meta}</p>}
        </div>
      </motion.div>

      {/* 2 · 出场时间线 / 流转链 */}
      {prop ? (
        <motion.div variants={drawerItem} className="mt-6">
          <p className="mono-label mb-3">FLOW — 流转链</p>
          <ol className="relative ml-2 space-y-4 border-l border-violet/40 pl-5">
            {prop.timeline.map((t) => {
              const holder = t.holderId ? getCharacter(t.holderId) : undefined
              return (
                <li key={`${t.beat}-${t.sceneId}`} className="relative">
                  <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full border-2 border-violet bg-ink-900" />
                  <p className="font-mono text-[0.6875rem] tracking-[0.08em] text-violet">
                    第{String(t.beat).padStart(2, '0')}场 · {t.sceneId}
                    {holder ? ` · ${holder.name}` : ''}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-paper-dim">{t.note}</p>
                </li>
              )
            })}
          </ol>
        </motion.div>
      ) : (
        <motion.div variants={drawerItem} className="mt-6">
          <p className="mono-label mb-3">APPEARANCES — 出场时间线</p>
          <div className="flex h-10 items-end gap-[2px]">
            {BEATS.map((b) => {
              const on = presentBeats.has(b.index)
              return (
                <button
                  key={b.index}
                  onClick={() => onJumpEmotion(b.index)}
                  title={`第${b.index}场 · ${b.title}`}
                  className="flex-1 rounded-sm transition-transform duration-150 hover:scale-y-125"
                  style={{
                    height: on ? '100%' : '30%',
                    backgroundColor: on ? node.color : '#26262F',
                    opacity: on ? 0.9 : 0.5,
                  }}
                />
              )
            })}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[0.5625rem] text-paper-dim/60">
            <span>01</span>
            <span>点击跳转到情绪曲线对应场</span>
            <span>{BEAT_COUNT}</span>
          </div>
        </motion.div>
      )}

      {/* 3 · 关系列表 */}
      <motion.div variants={drawerItem} className="mt-6">
        <p className="mono-label mb-3">RELATIONS — 关系({incident.length})</p>
        <div className="space-y-4">
          {[...grouped.entries()].map(([cat, rows]) => (
            <div key={cat}>
              <p
                className="mb-2 flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.12em]"
                style={{ color: CATEGORY_COLOR[cat] }}
              >
                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                {CATEGORY_LABEL[cat]} · {rows.length}
              </p>
              <ul className="space-y-1.5">
                {rows.map(({ edge, other }) => (
                  <li key={edge.id}>
                    <button
                      onClick={() => onFocusNode(other.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-all duration-150 hover:border-ink-line hover:bg-ink-800"
                    >
                      {other.kind === 'character' ? (
                        <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full border border-amber/60">
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-amber">
                            {other.label[0]}
                          </span>
                          <img src={other.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        </span>
                      ) : (
                        <span
                          className={cn('h-3 w-3 shrink-0', other.kind === 'prop' ? 'rotate-45 rounded-[2px]' : 'rounded-full')}
                          style={{ backgroundColor: other.color }}
                        />
                      )}
                      <span className="truncate text-sm text-paper">{other.label}</span>
                      <span
                        className="ml-auto shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.625rem]"
                        style={{ borderColor: `${CATEGORY_COLOR[cat]}44`, color: CATEGORY_COLOR[cat] }}
                      >
                        {edge.label}
                      </span>
                      <span className="flex shrink-0 gap-[3px]">
                        {[1, 2, 3, 4, 5].map((d) => (
                          <span
                            key={d}
                            className="h-1 w-1 rounded-full"
                            style={{ backgroundColor: d <= edge.strength ? '#FFB347' : '#26262F' }}
                          />
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {incident.length === 0 && <p className="text-sm text-paper-dim">暂无关联边。</p>}
        </div>
      </motion.div>

      {/* 4 · 关联原文 */}
      <motion.div variants={drawerItem} className="mt-6 pb-4">
        <p className="mono-label mb-3">SCRIPT — 关联原文</p>
        <div className="space-y-3">
          {quotes.map((q) => (
            <blockquote key={q.tag} className="border-l-2 border-amber pl-4">
              <p className="font-mono text-[0.6875rem] tracking-[0.08em] text-amber">{q.tag}</p>
              <p className="mt-1 font-serif text-sm leading-6 text-paper">{q.text}</p>
            </blockquote>
          ))}
        </div>
        {scene && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {scene.mood.map((m) => (
              <span key={m} className="rounded-full border border-cyan/30 px-2.5 py-1 font-mono text-[0.625rem] text-cyan">
                {m}
              </span>
            ))}
          </div>
        )}
        {character && (
          <p className="mt-4 text-xs leading-6 text-paper-dim">
            <span className="text-paper">动机:</span>
            {character.desire}
          </p>
        )}
        {eventBeat && (
          <p className="mt-4 font-mono text-[0.6875rem] leading-6 text-paper-dim">
            出场:{eventBeat.characters.map((c) => getCharacter(c)?.name ?? c).join(' / ')}
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ──────────────────────────── 画布 CSS 动效 ──────────────────────────── */

const GRAPH_CSS = `
.gf-node { cursor: pointer; }
.gf-node-enter { animation: gf-pop 0.55s cubic-bezier(0.22,1,0.36,1) both; transform-box: fill-box; transform-origin: center; }
@keyframes gf-pop { from { transform: scale(0) rotate(6deg); } to { transform: scale(1) rotate(0deg); } }
.gf-edge-enter { animation: gf-edge-in 0.6s ease both; }
@keyframes gf-edge-in { from { opacity: 0; } to { opacity: 1; } }
.gf-edge-line { transition: opacity 400ms cubic-bezier(0.22,1,0.36,1); }
.gf-path-flow { animation: gf-dash-flow 0.8s linear infinite; }
@keyframes gf-dash-flow { to { stroke-dashoffset: -24; } }
.gf-search-pulse { animation: gf-pulse-ring 1.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.gf-mat-pop { animation: gf-pulse-ring 0.7s ease-out both; transform-box: fill-box; transform-origin: center; }
.gf-glow-ring { animation: gf-glow-soft 2.4s ease-in-out infinite; }
@keyframes gf-pulse-ring { from { transform: scale(0.7); opacity: 0.9; } to { transform: scale(1.9); opacity: 0; } }
@keyframes gf-glow-soft { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }
.gf-edge-flash { animation: gf-flash 0.8s ease-out both; }
@keyframes gf-flash { from { opacity: 1; } to { opacity: 0; } }
.gf-node-label { font-size: 11px; font-weight: 500; pointer-events: none; }
.gf-scene-chip { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em; pointer-events: none; }
.gf-event-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.06em; pointer-events: none; }
.gf-edge-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; fill: #F2EAD8; paint-order: stroke; stroke: #08080D; stroke-width: 3px; pointer-events: none; }
.gf-warn-border { animation: gf-warn-pulse 2s ease-in-out infinite; }
@keyframes gf-warn-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
`
