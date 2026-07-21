/**
 * 案例库 Cases — `/cases`
 * 电影资料馆式片库:三部示例剧本,每部都有完整"解剖报告"
 * (图谱缩略 / 情绪指纹 / 关键指标),点击进入详情弹窗。
 *
 * 数据规范:核心指标消费 @/data/nightferry 的统一导出
 * (CASES / EMOTION_SERIES / SCRIPT_STATS / GRAPH_NODES / GRAPH_LINKS),
 * 落幕、听雨两部"即将上线"作品的展示型数据在本文件内派生,
 * 数值与 CASES 导出(beats / characters / amplitude / paceEntropy)保持一致。
 */
import { memo, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowRight, BarChart3, Network, Upload, X } from 'lucide-react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { scaleLinear } from 'd3-scale'
import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape'
import {
  CASES,
  EMOTION_MAX,
  EMOTION_MIN,
  EMOTION_SERIES,
  GRAPH_LINKS,
  GRAPH_NODES,
  NODE_COLORS,
  SCRIPT_STATS,
  getBeat,
} from '@/data/nightferry'
import type { CaseEntry, NodeKind } from '@/data/nightferry'
import { SectionHeader } from '@/components/common'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/* ════════════════════════════ 案例展示层数据 ════════════════════════════ */

type FilterCat = '悬疑' | '爱情' | '家庭'

interface KeyBeatMark {
  beat: number
  label: string
}

interface MetricVals {
  beats: number
  chars: number
  props: number
  /** 场景复用率 = 场次 / 场景数(×) */
  reuse: number
  /** 对白密度 = 对白行数 / 场次 */
  density: number
  /** 高潮位置 = 峰值场 / 总场次(0–1,越接近 0.8 越标准) */
  climax: number
  /** 平均张力 0–1 */
  tension: number
}

interface CaseMeta {
  no: string
  /** cases.md 策展式类型标签 */
  genreTag: string
  cat: FilterCat
  tagline: string
  /** 情绪指纹用色:夜航 rose / 落幕 amber / 听雨 cyan */
  color: string
  fingerprint: string
  status: string
  statusTone: 'green' | 'amber'
  /** 全剧逐场情绪(-5..+5);夜航为真实 EMOTION_SERIES,其余为派生样例 */
  emotions: number[]
  keyBeats: KeyBeatMark[]
  /** 六维雷达 0–100:张力 / 节奏 / 关系 / 冲突 / 结构 / 共鸣 */
  radar: number[]
  core: { label: string; value: string }[]
  metrics: MetricVals
}

/** 落幕(36 场,振幅 6.4):慢热单峰型 —— 谷值 -3.0 @场22,峰值 +3.4 @场28 */
const LUOMU_EMOTIONS = [
  -0.8, -1.0, -0.6, -1.2, -0.8, -0.4, -0.9, -1.3, -0.8, -0.5, -1.1, -0.7,
  -0.3, 0.2, -0.2, 0.5, 0.1, -0.6, -1.4, -2.2, -2.8, -3.0, -2.2, -1.2,
  0.2, 1.4, 2.6, 3.4, 2.8, 2.2, 2.6, 2.0, 1.6, 1.8, 2.2, 2.0,
]

/** 听雨(30 场,振幅 5.2):微波往复型 —— 谷值 -2.4 @场19,峰值 +2.8 @场22 */
const TINGYU_EMOTIONS = [
  0.6, 0.2, -0.4, 0.3, -0.8, -0.3, 0.5, 1.0, 0.4, -0.5, -1.2, -0.6,
  0.2, 0.8, 0.3, -0.4, -1.0, -1.8, -2.4, -1.2, -0.2, 2.8, 1.4, 2.0,
  1.2, 0.6, 1.2, 1.8, 2.4, 2.0,
]

const CASE_META: Record<string, CaseMeta> = {
  nightferry: {
    no: 'CASE.01',
    genreTag: '悬疑 · 海难',
    cat: '悬疑',
    tagline: '一艘货轮,一个黑匣子,八个各怀秘密的人。',
    color: '#FF4D6D',
    fingerprint: '后置爆发型',
    status: '已加载 · DEMO',
    statusTone: 'green',
    emotions: EMOTION_SERIES.map((p) => p.emotion),
    keyBeats: [15, 30, 34].map((b) => ({ beat: b, label: getBeat(b)?.title ?? '' })),
    radar: [86, Math.round(SCRIPT_STATS.paceEntropy * 100), 82, 90, 88, 84],
    core: [
      { label: '关键节拍', value: `${SCRIPT_STATS.keyBeats}` },
      { label: '关系边', value: `${SCRIPT_STATS.relations}` },
      { label: '情绪振幅', value: SCRIPT_STATS.emotionAmplitude.toFixed(1) },
      { label: '节奏熵', value: SCRIPT_STATS.paceEntropy.toFixed(2) },
    ],
    metrics: {
      beats: SCRIPT_STATS.beats,
      chars: SCRIPT_STATS.characters,
      props: SCRIPT_STATS.propsFlow,
      reuse: SCRIPT_STATS.beats / 12,
      density: SCRIPT_STATS.dialogueLines / SCRIPT_STATS.beats,
      climax: SCRIPT_STATS.peakBeat / SCRIPT_STATS.beats,
      tension: SCRIPT_STATS.avgTension,
    },
  },
  luomu: {
    no: 'CASE.02',
    genreTag: '爱情 · 县城',
    cat: '爱情',
    tagline: '电影院拆除前的最后一场放映。',
    color: '#FFB347',
    fingerprint: '慢热单峰型',
    status: '即将上线',
    statusTone: 'amber',
    emotions: LUOMU_EMOTIONS,
    keyBeats: [
      { beat: 22, label: '停映通知' },
      { beat: 28, label: '最后一场放映' },
      { beat: 36, label: '灯亮人散' },
    ],
    radar: [62, 58, 64, 55, 80, 92],
    core: [
      { label: '关键节拍', value: '9' },
      { label: '关系边', value: '15' },
      { label: '情绪振幅', value: '6.4' },
      { label: '节奏熵', value: '0.58' },
    ],
    metrics: { beats: 36, chars: 6, props: 4, reuse: 36 / 9, density: 756 / 36, climax: 28 / 36, tension: 0.42 },
  },
  tingyu: {
    no: 'CASE.03',
    genreTag: '家庭 · 庭院',
    cat: '家庭',
    tagline: '一场丧事,把一家人赶回同一张饭桌。',
    color: '#4DD8FF',
    fingerprint: '微波往复型',
    status: '即将上线',
    statusTone: 'amber',
    emotions: TINGYU_EMOTIONS,
    keyBeats: [
      { beat: 19, label: '旧事重提' },
      { beat: 22, label: '雨中对坐' },
      { beat: 30, label: '檐下和解' },
    ],
    radar: [54, 49, 58, 46, 76, 88],
    core: [
      { label: '关键节拍', value: '7' },
      { label: '关系边', value: '11' },
      { label: '情绪振幅', value: '5.2' },
      { label: '节奏熵', value: '0.49' },
    ],
    metrics: { beats: 30, chars: 5, props: 3, reuse: 30 / 8, density: 890 / 30, climax: 22 / 30, tension: 0.34 },
  },
}

const metaOf = (c: CaseEntry): CaseMeta => CASE_META[c.id]

/* ════════════════════════════ 静态图谱数据 ════════════════════════════ */

interface GNode extends SimulationNodeDatum {
  id: string
  kind: NodeKind
  label: string
}
type GLink = SimulationLinkDatum<GNode>
interface GraphData {
  nodes: { id: string; kind: NodeKind; label: string }[]
  links: { source: string; target: string }[]
}

/** 从夜航真实图谱中取子集 */
function subsetGraph(charIds: string[], propIds: string[], sceneIds: string[]): GraphData {
  const ids = new Set([...charIds, ...propIds, ...sceneIds])
  return {
    nodes: GRAPH_NODES.filter((n) => ids.has(n.id)).map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
    links: GRAPH_LINKS.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({
      source: l.source,
      target: l.target,
    })),
  }
}

/** 为"即将上线"作品派生确定性拓扑(人物环 + 道具挂人物 + 场景挂人物) */
function fabricateGraph(chars: string[], props: string[], scenes: string[]): GraphData {
  const nodes: GraphData['nodes'] = [
    ...chars.map((label, i) => ({ id: `c${i}`, kind: 'character' as NodeKind, label })),
    ...props.map((label, i) => ({ id: `p${i}`, kind: 'prop' as NodeKind, label })),
    ...scenes.map((label, i) => ({ id: `s${i}`, kind: 'scene' as NodeKind, label })),
  ]
  const links: GraphData['links'] = []
  chars.forEach((_, i) => links.push({ source: `c${i}`, target: `c${(i + 1) % chars.length}` }))
  if (chars.length >= 4) {
    links.push({ source: 'c0', target: 'c2' }, { source: 'c1', target: 'c3' })
  }
  props.forEach((_, i) => links.push({ source: `p${i}`, target: `c${i % chars.length}` }))
  scenes.forEach((_, i) => links.push({ source: `s${i}`, target: `c${(i + 1) % chars.length}` }))
  if (props.length && scenes.length) links.push({ source: 'p0', target: 's0' })
  return { nodes, links }
}

const NF_CHARS = GRAPH_NODES.filter((n) => n.kind === 'character').map((n) => n.id)
const NF_PROPS = GRAPH_NODES.filter((n) => n.kind === 'prop').map((n) => n.id)

const LUOMU_CHARS = ['老周', '周眠', '陈竞', '阿珍', '刘一水', '小满']
const TINGYU_CHARS = ['沈聿', '苏晚', '祖母', '阿泉', '陆白']

/** S2 悬停叠加层用微缩图谱(~15 节点) */
const MINI_GRAPHS: Record<string, GraphData> = {
  nightferry: subsetGraph(NF_CHARS, ['recorder', 'manifest', 'key', 'photo'], ['S03', 'S04', 'S09']),
  luomu: fabricateGraph(LUOMU_CHARS, ['老放映机', '胶片铁盒', '电影票根', '拆迁通知', '雨伞'], ['门厅', '放映室', '天台', '老街']),
  tingyu: fabricateGraph(TINGYU_CHARS, ['纸灯笼', '油纸伞', '旧信', '留声机', '茶盏', '门环'], ['听雨轩', '长廊', '庭院', '书房']),
}

/** S4 弹窗图谱 Tab 用中量图谱(20 节点) */
const FULL_GRAPHS: Record<string, GraphData> = {
  nightferry: subsetGraph(NF_CHARS, NF_PROPS, ['S01', 'S02', 'S03', 'S04', 'S05', 'S09']),
  luomu: fabricateGraph(
    LUOMU_CHARS,
    ['老放映机', '胶片铁盒', '电影票根', '拆迁通知', '雨伞', '霓虹招牌', '情书'],
    ['门厅', '放映室', '天台', '老街', '售票亭', '后巷', '河堤'],
  ),
  tingyu: fabricateGraph(
    TINGYU_CHARS,
    ['纸灯笼', '油纸伞', '旧信', '留声机', '茶盏', '门环', '琵琶', '琴谱'],
    ['听雨轩', '长廊', '庭院', '书房', '水榭', '月门', '戏台'],
  ),
}

/* ════════════════════════════ 布局 / 路径工具 ════════════════════════════ */

interface LaidSeg {
  a: GNode
  b: GNode
}
interface LaidGraph {
  nodes: GNode[]
  segs: LaidSeg[]
}

/** d3-force 同步静态布局(确定性 phyllotaxis 初始化,固定 tick 数) */
function layoutGraph(data: GraphData, w: number, h: number, pad: number, charge: number): LaidGraph {
  const nodes: GNode[] = data.nodes.map((n) => ({ ...n }))
  const links: GLink[] = data.links.map((l) => ({ ...l }))
  const sim = forceSimulation<GNode>(nodes)
    .force('link', forceLink<GNode, GLink>(links).id((d) => d.id).distance(36).strength(0.55))
    .force('charge', forceManyBody<GNode>().strength(charge))
    .force('center', forceCenter(w / 2, h / 2))
    .force('collide', forceCollide<GNode>(11))
    .force('x', forceX<GNode>(w / 2).strength(0.05))
    .force('y', forceY<GNode>(h / 2).strength(0.08))
    .stop()
  for (let i = 0; i < 320; i++) sim.tick()
  for (const n of nodes) {
    n.x = Math.max(pad, Math.min(w - pad, n.x ?? w / 2))
    n.y = Math.max(pad, Math.min(h - pad, n.y ?? h / 2))
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ref = (r: string | number | GNode): GNode | undefined => (typeof r === 'object' ? r : byId.get(String(r)))
  const segs: LaidSeg[] = links
    .map((l) => ({ a: ref(l.source)!, b: ref(l.target)! }))
    .filter((s) => s.a && s.b)
  return { nodes, segs }
}

const MINI_W = 300
const MINI_H = 200
const FULL_W = 560
const FULL_H = 400

const MINI_LAYOUTS: Record<string, LaidGraph> = Object.fromEntries(
  Object.entries(MINI_GRAPHS).map(([id, g]) => [id, layoutGraph(g, MINI_W, MINI_H, 18, -34)]),
)
const FULL_LAYOUTS: Record<string, LaidGraph> = Object.fromEntries(
  Object.entries(FULL_GRAPHS).map(([id, g]) => [id, layoutGraph(g, FULL_W, FULL_H, 26, -58)]),
)

interface EmotionGeom {
  line: string
  area: string
  pts: { x: number; y: number; v: number }[]
  zeroY: number
}

/** 逐场情绪 → 平滑 line/area 路径(x 按场次进度归一化) */
function emotionGeom(values: number[], w: number, h: number, padX: number, padY: number): EmotionGeom {
  const x = scaleLinear().domain([0, values.length - 1]).range([padX, w - padX])
  const y = scaleLinear().domain([EMOTION_MIN, EMOTION_MAX]).range([h - padY, padY])
  const pts = values.map((v, i) => ({ x: x(i), y: y(v), v }))
  const lineFn = d3line<(typeof pts)[number]>().x((d) => d.x).y((d) => d.y).curve(curveMonotoneX)
  const areaFn = d3area<(typeof pts)[number]>().x((d) => d.x).y0(y(0)).y1((d) => d.y).curve(curveMonotoneX)
  return { line: lineFn(pts) ?? '', area: areaFn(pts) ?? '', pts, zeroY: y(0) }
}

/* ════════════════════════════ 通用动效原件 ════════════════════════════ */

/** 中文大标题逐字上浮(+轻微旋转),进入视口触发一次 */
function RiseChars({ text, className, delay = 0, stagger = 0.05 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: '112%', opacity: 0, rotate: i % 2 === 0 ? 2 : -2 }}
            whileInView={{ y: '0%', opacity: 1, rotate: 0 }}
            viewport={{ once: true, margin: '-8% 0px' }}
            transition={{ duration: 0.7, delay: delay + i * stagger, ease: EASE }}
          >
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/* ════════════════════════════ S2 · 海报悬停微缩图谱 ════════════════════════════ */

/**
 * 微缩图谱(约 15 节点,按类型着色):
 * 节点 CSS 随 group-hover 延迟 0.2s 起逐个 pop;整体一层缓慢"呼吸漂移"(单个 motion.g 承担)。
 */
function MiniGraph({ layout }: { layout: LaidGraph }) {
  return (
    <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`} className="h-full w-full" aria-hidden>
      <motion.g
        animate={{ x: [0, 3, 0, -3, 0], y: [0, -2, 0, 2, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        {layout.segs.map((s, i) => (
          <line
            key={i}
            x1={s.a.x}
            y1={s.a.y}
            x2={s.b.x}
            y2={s.b.y}
            stroke="#3A3A48"
            strokeWidth={0.7}
            opacity={0.65}
          />
        ))}
        {layout.nodes.map((n, i) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.kind === 'character' ? 4.5 : n.kind === 'scene' ? 4 : 3.2}
            fill={NODE_COLORS[n.kind]}
            className="scale-0 transition-transform duration-300 ease-out-expo group-hover:scale-100"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              transitionDelay: `${200 + i * 30}ms`,
              filter: `drop-shadow(0 0 4px ${NODE_COLORS[n.kind]}88)`,
            }}
          />
        ))}
      </motion.g>
    </svg>
  )
}

/* ════════════════════════════ S2 · 案例卡片 ════════════════════════════ */

function CaseCard({ entry, index, onOpen }: { entry: CaseEntry; index: number; onOpen: (c: CaseEntry) => void }) {
  const meta = metaOf(entry)
  const layout = MINI_LAYOUTS[entry.id]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 56 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.25 } }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        layout: { duration: 0.4, ease: EASE },
        opacity: { duration: 0.4, delay: index * 0.15 },
        y: { duration: 0.7, delay: index * 0.15, ease: EASE },
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(entry)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(entry)
          }
        }}
        className="group relative h-full cursor-pointer overflow-hidden rounded-2xl border border-ink-line bg-ink-900 outline-none transition-all duration-300 hover:-translate-y-1.5 hover:border-paper-dim/30 hover:shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)] focus-visible:border-amber/60"
      >
        {/* 海报区 3:4 */}
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={entry.poster}
            alt={`《${entry.title}》海报`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
          />
          {/* 常驻暗角 + 编号 */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-ink-950/20" />
          <span className="absolute left-4 top-4 rounded-full border border-paper/20 bg-ink-950/55 px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.14em] text-paper backdrop-blur-sm">
            {meta.no}
          </span>
          {entry.isDemo && (
            <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-green/40 bg-ink-950/55 px-2.5 py-1 font-mono text-[0.625rem] tracking-[0.14em] text-green backdrop-blur-sm">
              <span className="h-1 w-1 rounded-full bg-green" />
              DEMO
            </span>
          )}

          {/* 悬停叠加层:底部升起,微缩图谱 + 进入解剖 */}
          <div className="pointer-events-none absolute inset-0 flex translate-y-full flex-col justify-between bg-ink-950/85 p-4 backdrop-blur-[6px] transition-transform [transition-duration:350ms] ease-out-expo group-hover:translate-y-0">
            <p className="mono-tick flex items-center gap-2 pt-1">
              <Network className="h-3.5 w-3.5 text-cyan" />
              TOPOLOGY PREVIEW — {layout.nodes.length} NODES
            </p>
            <div className="min-h-0 flex-1 py-2">
              <MiniGraph layout={layout} />
            </div>
            <span className="flex items-center justify-center gap-2 rounded-full bg-amber py-2.5 text-sm font-bold text-ink-950 shadow-glow-amber">
              进入解剖
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>

        {/* 卡体 */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim/70">{meta.no}</span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em]"
              style={{ borderColor: `${meta.color}55`, color: meta.color }}
            >
              <span className="h-1 w-1 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.genreTag}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-xl font-bold text-paper">
            《{entry.title}》
            <span className="ml-2 font-mono text-[0.6875rem] font-normal tracking-[0.12em] text-paper-dim">{entry.titleEn}</span>
          </h3>
          <p className="mt-2 text-sm leading-6 text-paper-dim">{meta.tagline}</p>
          <div className="mt-4 flex items-center gap-4 border-t border-ink-line pt-4 font-mono text-[0.6875rem] tracking-[0.08em] text-paper-dim">
            <span>
              <b className="mr-1 font-bold text-paper">{entry.beats}</b>场
            </span>
            <span className="h-3 w-px bg-ink-line" />
            <span>
              <b className="mr-1 font-bold text-paper">{entry.characters}</b>人物
            </span>
            <span className="h-3 w-px bg-ink-line" />
            <span>
              振幅<b className="ml-1 font-bold" style={{ color: meta.color }}>{entry.amplitude.toFixed(1)}</b>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════ S3 · 带 A 情绪指纹对比 ════════════════════════════ */

const FP_W = 1000
const FP_H = 320
const FP_PAD_X = 46
const FP_PAD_Y = 30
const FP_TICKS = [5, 2.5, 0, -2.5, -5]

function FingerprintChart() {
  const yTick = (v: number) =>
    scaleLinear().domain([EMOTION_MIN, EMOTION_MAX]).range([FP_H - FP_PAD_Y, FP_PAD_Y])(v)
  return (
    <div>
      <svg viewBox={`0 0 ${FP_W} ${FP_H}`} className="w-full" role="img" aria-label="三部作品的全剧情绪曲线对比">
        {/* 网格与轴刻度 */}
        {FP_TICKS.map((t) => (
          <g key={t}>
            <line
              x1={FP_PAD_X}
              x2={FP_W - 12}
              y1={yTick(t)}
              y2={yTick(t)}
              stroke={t === 0 ? '#3A3A48' : '#26262F'}
              strokeWidth={t === 0 ? 1 : 0.6}
              strokeDasharray={t === 0 ? undefined : '3 6'}
            />
            <text x={12} y={yTick(t) + 3} fontSize={11} fill="#9A937F" fontFamily="'JetBrains Mono', monospace">
              {t > 0 ? `+${t}` : t}
            </text>
          </g>
        ))}
        <text x={FP_W - 12} y={FP_H - 6} textAnchor="end" fontSize={11} fill="#9A937F" fontFamily="'JetBrains Mono', monospace" letterSpacing={1.5}>
          场次进度 0% → 100%
        </text>

        {/* 三条情绪指纹:半透明叠放,依次描边 */}
        {CASES.map((c, i) => {
          const meta = metaOf(c)
          const geom = emotionGeom(meta.emotions, FP_W, FP_H, FP_PAD_X, FP_PAD_Y)
          return (
            <g key={c.id}>
              <motion.path
                d={geom.area}
                fill={meta.color}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.08 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.8, delay: 0.9 + i * 0.3 }}
              />
              <motion.path
                d={geom.line}
                fill="none"
                stroke={meta.color}
                strokeWidth={2.2}
                strokeLinecap="round"
                opacity={0.9}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 1.4, delay: i * 0.3, ease: 'easeInOut' }}
              />
            </g>
          )
        })}
      </svg>

      {/* 结论 chips */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {CASES.map((c, i) => {
          const meta = metaOf(c)
          return (
            <motion.span
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 1.2 + i * 0.15, ease: EASE }}
              className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-[0.6875rem] tracking-[0.1em]"
              style={{ borderColor: `${meta.color}55`, color: meta.color, backgroundColor: `${meta.color}0D` }}
            >
              <span className="inline-block h-[2px] w-5 rounded-full" style={{ backgroundColor: meta.color }} />
              《{c.title}》{meta.fingerprint}
            </motion.span>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════ S3 · 带 B 指标对照表 ════════════════════════════ */

const METRIC_ROWS: { label: string; en: string; key: keyof MetricVals; fmt: (v: number) => string; best: (vals: number[]) => number }[] = [
  { label: '场次', en: 'BEATS', key: 'beats', fmt: (v) => `${v}`, best: (v) => v.indexOf(Math.max(...v)) },
  { label: '人物', en: 'CHARACTERS', key: 'chars', fmt: (v) => `${v}`, best: (v) => v.indexOf(Math.max(...v)) },
  { label: '道具', en: 'PROPS', key: 'props', fmt: (v) => `${v}`, best: (v) => v.indexOf(Math.max(...v)) },
  { label: '场景复用率', en: 'SCENE REUSE', key: 'reuse', fmt: (v) => `${v.toFixed(1)}×`, best: (v) => v.indexOf(Math.max(...v)) },
  { label: '对白密度', en: 'DIALOGUE / SCENE', key: 'density', fmt: (v) => v.toFixed(1), best: (v) => v.indexOf(Math.max(...v)) },
  { label: '高潮位置', en: 'CLIMAX AT', key: 'climax', fmt: (v) => `${Math.round(v * 100)}%`, best: (v) => v.reduce((bi, x, i) => (Math.abs(x - 0.8) < Math.abs(v[bi] - 0.8) ? i : bi), 0) },
  { label: '平均张力', en: 'AVG TENSION', key: 'tension', fmt: (v) => v.toFixed(2), best: (v) => v.indexOf(Math.max(...v)) },
]

function MetricsTable() {
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* 表头:三部作品列 */}
        <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] border-b border-ink-line pb-4">
          <span className="mono-tick self-end">METRIC ↓</span>
          {CASES.map((c, ci) => {
            const meta = metaOf(c)
            return (
              <div
                key={c.id}
                className="rounded-t-lg px-3 py-2 transition-colors duration-200"
                style={{ backgroundColor: hoverCol === ci ? `${meta.color}14` : 'transparent' }}
                onMouseEnter={() => setHoverCol(ci)}
                onMouseLeave={() => setHoverCol(null)}
              >
                <p className="flex items-center gap-2 font-serif text-base font-bold text-paper">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}80` }} />
                  《{c.title}》
                </p>
                <p className="mt-1 font-mono text-[0.625rem] tracking-[0.14em] text-paper-dim">
                  {meta.no} · {c.titleEn}
                </p>
              </div>
            )
          })}
        </div>

        {/* 指标行 */}
        {METRIC_ROWS.map((row, ri) => {
          const vals = CASES.map((c) => metaOf(c).metrics[row.key])
          const bestIdx = row.best(vals)
          return (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: ri * 0.05, ease: EASE }}
              className="grid grid-cols-[1.1fr_1fr_1fr_1fr] items-center border-b border-ink-line/60 py-3.5 last:border-b-0"
            >
              <div className="pr-4">
                <p className="text-sm text-paper">{row.label}</p>
                <p className="font-mono text-[0.625rem] tracking-[0.14em] text-paper-dim/70">{row.en}</p>
              </div>
              {CASES.map((c, ci) => {
                const meta = metaOf(c)
                const isBest = ci === bestIdx
                return (
                  <div
                    key={c.id}
                    className="rounded-lg px-3 py-1.5 transition-colors duration-200"
                    style={{ backgroundColor: hoverCol === ci ? `${meta.color}14` : 'transparent' }}
                    onMouseEnter={() => setHoverCol(ci)}
                    onMouseLeave={() => setHoverCol(null)}
                  >
                    <span
                      className={cn('font-mono text-lg font-bold tracking-tight', isBest ? 'text-green' : 'text-paper')}
                    >
                      {row.fmt(vals[ci])}
                    </span>
                    {isBest && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-green align-middle" style={{ boxShadow: '0 0 8px #7BE0A3' }} />}
                  </div>
                )
              })}
            </motion.div>
          )
        })}
        <p className="mono-tick mt-4">GREEN = 该行最优值 · 高潮位置以接近 80% 为佳</p>
      </div>
    </div>
  )
}

/* ════════════════════════════ S4 · 弹窗 Tab:图谱 ════════════════════════════ */

/** 20 节点静态图谱:首次显示节点 pop(stagger 20ms),hover 节点显示名称 */
function ModalGraph({ layout, color }: { layout: LaidGraph; color: string }) {
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <svg viewBox={`0 0 ${FULL_W} ${FULL_H}`} className="h-auto w-full" role="img" aria-label="作品关系拓扑缩略图">
      {layout.segs.map((s, i) => (
        <line
          key={i}
          x1={s.a.x}
          y1={s.a.y}
          x2={s.b.x}
          y2={s.b.y}
          stroke={hovered && (s.a.id === hovered || s.b.id === hovered) ? color : '#2E2E3A'}
          strokeWidth={hovered && (s.a.id === hovered || s.b.id === hovered) ? 1.2 : 0.7}
          opacity={hovered ? (s.a.id === hovered || s.b.id === hovered ? 0.9 : 0.25) : 0.6}
          className="transition-opacity duration-200"
        />
      ))}
      {layout.nodes.map((n, i) => {
        const isHover = hovered === n.id
        const r = n.kind === 'character' ? 7 : n.kind === 'scene' ? 5.5 : 4.5
        return (
          <motion.g
            key={n.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, delay: i * 0.02, ease: EASE }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <circle cx={n.x} cy={n.y} r={r + 6} fill="transparent" />
            <circle
              cx={n.x}
              cy={n.y}
              r={isHover ? r + 1.5 : r}
              fill={NODE_COLORS[n.kind]}
              opacity={hovered && !isHover ? 0.35 : 1}
              className="cursor-pointer transition-all duration-200"
              style={{ filter: isHover ? `drop-shadow(0 0 8px ${NODE_COLORS[n.kind]})` : undefined }}
            />
            {isHover && (
              <text
                x={n.x}
                y={(n.y ?? 0) - r - 8}
                textAnchor="middle"
                fontSize={12}
                fill="#F2EAD8"
                fontFamily="'JetBrains Mono', monospace"
                style={{ pointerEvents: 'none' }}
              >
                {n.label}
              </text>
            )}
          </motion.g>
        )
      })}
    </svg>
  )
}

/* ════════════════════════════ S4 · 弹窗 Tab:情绪 ════════════════════════════ */

const EM_W = 560
const EM_H = 250
const EM_PAD_X = 34
const EM_PAD_Y = 24

function ModalEmotion({ meta }: { meta: CaseMeta }) {
  const geom = emotionGeom(meta.emotions, EM_W, EM_H, EM_PAD_X, EM_PAD_Y)
  const xAt = (beat: number) => EM_PAD_X + ((beat - 1) / (meta.emotions.length - 1)) * (EM_W - EM_PAD_X * 2)
  const yAt = (v: number) => scaleLinear().domain([EMOTION_MIN, EMOTION_MAX]).range([EM_H - EM_PAD_Y, EM_PAD_Y])(v)
  return (
    <svg viewBox={`0 0 ${EM_W} ${EM_H}`} className="h-auto w-full" role="img" aria-label="全剧情绪曲线">
      {[5, 0, -5].map((t) => (
        <g key={t}>
          <line x1={EM_PAD_X} x2={EM_W - 8} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? '#3A3A48' : '#26262F'} strokeWidth={t === 0 ? 1 : 0.6} strokeDasharray={t === 0 ? undefined : '3 6'} />
          <text x={8} y={yAt(t) + 3} fontSize={10} fill="#9A937F" fontFamily="'JetBrains Mono', monospace">
            {t > 0 ? `+${t}` : t}
          </text>
        </g>
      ))}
      <motion.path d={geom.area} fill={meta.color} initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} transition={{ duration: 0.7, delay: 0.6 }} />
      <motion.path
        d={geom.line}
        fill="none"
        stroke={meta.color}
        strokeWidth={2.2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* 3 个关键场标记 */}
      {meta.keyBeats.map((k, i) => {
        const v = meta.emotions[k.beat - 1]
        const x = xAt(k.beat)
        const y = yAt(v)
        return (
          <motion.g key={k.beat} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.15, duration: 0.4 }}>
            <line x1={x} x2={x} y1={y} y2={EM_H - EM_PAD_Y} stroke={meta.color} strokeWidth={0.7} strokeDasharray="2 4" opacity={0.5} />
            <circle cx={x} cy={y} r={4.5} fill="#08080D" stroke={meta.color} strokeWidth={2} />
            <text x={x} y={v > 3.2 ? y + 22 : y - 12} textAnchor="middle" fontSize={10} fill="#F2EAD8" fontFamily="'JetBrains Mono', monospace">
              场{String(k.beat).padStart(2, '0')} {k.label}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}

/* ════════════════════════════ S4 · 弹窗 Tab:指标(雷达 + 核心数字) ════════════════════════════ */

const RADAR_DIMS = ['张力', '节奏', '关系', '冲突', '结构', '共鸣']

function RadarMini({ values, color }: { values: number[]; color: string }) {
  const cx = 130
  const cy = 116
  const R = 78
  const pt = (i: number, ratio: number) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / RADAR_DIMS.length
    return { x: cx + Math.cos(ang) * R * ratio, y: cy + Math.sin(ang) * R * ratio }
  }
  const ring = (ratio: number) => RADAR_DIMS.map((_, i) => pt(i, ratio)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
  const poly = values.map((v, i) => pt(i, v / 100)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
  return (
    <svg viewBox="0 0 260 232" className="mx-auto w-full max-w-[280px]" role="img" aria-label="六维评估雷达">
      {[1, 0.66, 0.33].map((r) => (
        <path key={r} d={ring(r)} fill="none" stroke="#26262F" strokeWidth={0.8} />
      ))}
      {RADAR_DIMS.map((d, i) => {
        const p = pt(i, 1)
        const lp = pt(i, 1.18)
        return (
          <g key={d}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#26262F" strokeWidth={0.6} />
            <text x={lp.x} y={lp.y + 3} textAnchor="middle" fontSize={10.5} fill="#9A937F" fontFamily="'Noto Sans SC', sans-serif">
              {d}
            </text>
          </g>
        )
      })}
      <motion.path
        d={poly}
        fill={color}
        fillOpacity={0.14}
        stroke={color}
        strokeWidth={1.8}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      {values.map((v, i) => {
        const p = pt(i, v / 100)
        return <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={color} />
      })}
    </svg>
  )
}

/* ════════════════════════════ S4 · 案例详情弹窗 ════════════════════════════ */

type TabId = 'graph' | 'emotion' | 'metrics'

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'graph', label: '图谱', icon: <Network className="h-3.5 w-3.5" /> },
  { id: 'emotion', label: '情绪', icon: <Activity className="h-3.5 w-3.5" /> },
  { id: 'metrics', label: '指标', icon: <BarChart3 className="h-3.5 w-3.5" /> },
]

function CaseModalBody({ entry, onClose }: { entry: CaseEntry; onClose: () => void }) {
  const meta = metaOf(entry)
  const [tab, setTab] = useState<TabId>('graph')
  return (
    <div className="grid md:grid-cols-[2fr_3fr]">
      {/* 左 40%:海报全幅 + 基本信息 */}
      <div className="relative flex flex-col border-b border-ink-line md:border-b-0 md:border-r">
        <div className="relative h-52 overflow-hidden md:h-full md:min-h-[420px]">
          <img src={entry.poster} alt={`《${entry.title}》海报`} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/20 to-transparent" />
        </div>
        <dl className="relative z-10 -mt-16 space-y-2 p-5 font-mono text-[0.6875rem] tracking-[0.08em] md:mt-0 md:border-t md:border-ink-line md:bg-ink-900">
          {[
            ['类型 GENRE', meta.genreTag],
            ['场次 BEATS', `${entry.beats}`],
            ['人物 CHARACTERS', `${entry.characters}`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-ink-line/50 pb-2">
              <dt className="text-paper-dim">{k}</dt>
              <dd className="text-paper">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between pb-1">
            <dt className="text-paper-dim">创作状态 STATUS</dt>
            <dd className={cn('flex items-center gap-1.5', meta.statusTone === 'green' ? 'text-green' : 'text-amber')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.statusTone === 'green' ? 'bg-green' : 'bg-amber')} />
              {meta.status}
            </dd>
          </div>
        </dl>
      </div>

      {/* 右 60%:标题 + Tabs + 底部按钮 */}
      <div className="flex flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim">
              {meta.no} — {entry.titleEn}
            </p>
            <h3 className="mt-1.5 font-serif text-2xl font-bold text-paper">
              《{entry.title}》
              <span className="ml-2.5 rounded-full border px-2.5 py-0.5 align-middle font-mono text-[10px] font-normal tracking-[0.1em]" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
                {meta.genreTag}
              </span>
            </h3>
            <p className="mt-2 text-sm leading-6 text-paper-dim">{meta.tagline}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 rounded-full border border-ink-line bg-ink-800 p-2 text-paper-dim transition-colors hover:border-paper-dim/40 hover:text-paper"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mt-5">
          <TabsList className="border border-ink-line bg-ink-800">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="gap-1.5 font-mono text-xs text-paper-dim data-[state=active]:bg-ink-950 data-[state=active]:text-amber data-[state=active]:shadow-none"
              >
                {t.icon}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-4 min-h-[240px] flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {tab === 'graph' && (
                <>
                  <ModalGraph layout={FULL_LAYOUTS[entry.id]} color={meta.color} />
                  <p className="mono-tick mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {(['character', 'scene', 'prop'] as NodeKind[]).map((k) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS[k] }} />
                        {k === 'character' ? '人物' : k === 'scene' ? '场景' : '道具'}
                      </span>
                    ))}
                    <span className="text-paper-dim/60">HOVER 节点查看名称</span>
                  </p>
                </>
              )}
              {tab === 'emotion' && <ModalEmotion meta={meta} />}
              {tab === 'metrics' && (
                <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <RadarMini values={meta.radar} color={meta.color} />
                  <div className="grid grid-cols-2 gap-3">
                    {meta.core.map((m) => (
                      <div key={m.label} className="rounded-xl border border-ink-line bg-ink-800/60 p-3.5">
                        <p className="font-mono text-2xl font-bold" style={{ color: meta.color }}>
                          {m.value}
                        </p>
                        <p className="mono-tick mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 border-t border-ink-line pt-4">
          <Link
            to="/graph"
            onClick={onClose}
            className="group inline-flex items-center gap-2 rounded-full border border-amber/50 px-5 py-2.5 text-sm font-bold text-amber transition-all duration-300 hover:bg-amber hover:text-ink-950 hover:shadow-glow-amber"
          >
            在关系图谱中打开
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function CaseModal({ entry, onClose }: { entry: CaseEntry | null; onClose: () => void }) {
  useEffect(() => {
    if (!entry) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [entry, onClose])

  return (
    <AnimatePresence>
      {entry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8" role="dialog" aria-modal="true" aria-label={`《${entry.title}》解剖详情`}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[8px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 max-h-[90dvh] w-full max-w-[960px] overflow-y-auto rounded-2xl border border-ink-line bg-ink-900 shadow-[0_40px_120px_-24px_rgba(0,0,0,0.9)]"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <CaseModalBody key={entry.id} entry={entry} onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ════════════════════════════ S5 · 底部 CTA(常驻呼吸) ════════════════════════════ */

const BreathingCta = memo(function BreathingCta() {
  return (
    <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
      <Link
        to="/agent"
        className="group inline-flex items-center gap-2.5 rounded-full bg-amber px-8 py-4 text-base font-bold text-ink-950 transition-shadow duration-300 hover:shadow-glow-amber"
      >
        <Upload className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
        导入剧本
      </Link>
    </motion.div>
  )
})

/* ════════════════════════════ 页面装配 ════════════════════════════ */

const FILTERS: { id: 'all' | FilterCat; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: '悬疑', label: '悬疑' },
  { id: '爱情', label: '爱情' },
  { id: '家庭', label: '家庭' },
]

export default function Cases() {
  const [filter, setFilter] = useState<'all' | FilterCat>('all')
  const [openCase, setOpenCase] = useState<CaseEntry | null>(null)

  const visible = useMemo(
    () => (filter === 'all' ? CASES : CASES.filter((c) => metaOf(c).cat === filter)),
    [filter],
  )

  return (
    <div className="relative">
      {/* ── S1 · 页首 ─────────────────────────────── */}
      <section className="relative overflow-hidden py-16">
        <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
        <div className="site-container relative flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label flex items-center gap-3">
              <span className="inline-block h-px w-6 bg-amber" />
              ARCHIVE — 案例库
            </p>
            <h1 className="mt-4 font-serif text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[1.08] tracking-[-0.02em] text-paper">
              <RiseChars text="已被解剖的剧本" />
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
              className="mt-5 leading-7 text-paper-dim"
            >
              三部样例作品,三种类型。每一部,都从皮到骨到肉被完整摊开。
            </motion.p>
          </div>

          {/* 类型筛选 Toggle */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-ink-line bg-ink-900 p-1">
            {FILTERS.map((f) => {
              const active = filter === f.id
              const count = f.id === 'all' ? CASES.length : CASES.filter((c) => metaOf(c).cat === f.id).length
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'relative rounded-full px-4 py-2 font-mono text-xs tracking-[0.08em] transition-colors duration-300',
                    active ? 'text-ink-950' : 'text-paper-dim hover:text-paper',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="cases-filter-pill"
                      className="absolute inset-0 rounded-full bg-amber"
                      transition={{ duration: 0.4, ease: EASE }}
                    />
                  )}
                  <span className="relative z-10">
                    {f.label}
                    <sup className={cn('ml-1 text-[0.625rem]', active ? 'text-ink-950/70' : 'text-paper-dim/60')}>{count}</sup>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── S2 · 案例卡片网格 ─────────────────────── */}
      <section className="site-container pb-24">
        <motion.div layout className="grid gap-8 md:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((c, i) => (
              <CaseCard key={c.id} entry={c} index={i} onOpen={setOpenCase} />
            ))}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ── S3 · 深度案例:解剖报告(旗舰展示) ─────── */}
      <section className="border-t border-ink-line/70 bg-ink-900/30 py-24">
        <div className="site-container">
          <SectionHeader
            eyebrow="FLAGSHIP — 深度解剖报告"
            title={<RiseChars text="三部戏,三枚指纹" />}
            description="三条全剧情绪曲线叠放在同一坐标系,节奏形状一眼可比;下方对照七项关键指标,最优值以绿色标出。"
          />

          {/* 带 A:情绪指纹对比 */}
          <div className="mt-12 rounded-2xl border border-ink-line bg-ink-900 p-5 md:p-8">
            <p className="mono-label mb-6 flex items-center gap-3">
              <span className="inline-block h-px w-6 bg-rose" />
              BAND A — EMOTION FINGERPRINTS
            </p>
            <FingerprintChart />
          </div>

          {/* 带 B:指标对照表 */}
          <div className="mt-8 rounded-2xl border border-ink-line bg-ink-900 p-5 md:p-8">
            <p className="mono-label mb-6 flex items-center gap-3">
              <span className="inline-block h-px w-6 bg-amber" />
              BAND B — METRICS COMPARISON
            </p>
            <MetricsTable />
          </div>
        </div>
      </section>

      {/* ── S5 · 底部 CTA ─────────────────────────── */}
      <section className="relative overflow-hidden py-28">
        <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
        <div className="site-container relative mx-auto max-w-xl text-center">
          <p className="mono-label flex items-center justify-center gap-3">
            <span className="inline-block h-px w-6 bg-amber" />
            YOUR SCRIPT — NEXT CASE
          </p>
          <h2 className="mt-5 font-serif text-[clamp(1.8rem,3.4vw,2.8rem)] font-bold leading-[1.15] text-paper">
            <RiseChars text="你的剧本,就是下一个案例。" stagger={0.04} />
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
            className="mt-9"
          >
            <BreathingCta />
            <p className="mono-tick mt-5">支持 .fountain / .txt / 直接粘贴</p>
          </motion.div>
        </div>
      </section>

      {/* ── S4 · 案例详情弹窗 ─────────────────────── */}
      <CaseModal entry={openCase} onClose={() => setOpenCase(null)} />
    </div>
  )
}
