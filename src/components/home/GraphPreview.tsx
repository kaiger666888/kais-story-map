import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, useInView } from 'framer-motion'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { Pause, Play, ArrowRight } from 'lucide-react'
import { NodeChip } from '@/components/common'
import {
  CHARACTERS,
  PROPS,
  SCENES,
  RELATIONSHIPS,
  CHARACTER_PROP_EDGES,
  PROP_SCENE_EDGES,
  NODE_COLORS,
} from '@/data/nightferry'
import type { NodeKind } from '@/data/nightferry'

const VB_W = 960
const VB_H = 540
const SCENE_IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S07', 'S09', 'S11']
const PROP_SHORT: Record<string, string> = {
  recorder: '录音笔',
  manifest: '舱单',
  key: '钥匙',
  flare: '信号弹',
  medkit: '药箱',
  photo: '旧照片',
}
const CHAR_SCENE: [string, string][] = [
  ['linwan', 'S03'],
  ['jiangli', 'S02'],
  ['laogui', 'S07'],
  ['suqiao', 'S05'],
  ['achan', 'S04'],
  ['hanchong', 'S03'],
  ['bailu', 'S01'],
  ['shenque', 'S02'],
]
const KIND_LABEL: Record<NodeKind, string> = {
  character: '人物',
  scene: '场景',
  prop: '道具',
  emotion: '情绪',
  event: '事件',
}

interface PNode extends SimulationNodeDatum {
  id: string
  kind: NodeKind
  label: string
  color: string
  r: number
  avatar?: string
}
interface PLink extends SimulationLinkDatum<PNode> {
  strength: number
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** S4 · 实时图谱预览:《夜航》全量演示图谱(SVG 力导向,可播放/暂停) */
export default function GraphPreview() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, margin: '-20% 0px' })
  const [playing, setPlaying] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const lineRefs = useRef<(SVGLineElement | null)[]>([])
  const nodeRefs = useRef<(SVGGElement | null)[]>([])
  const simRef = useRef<ReturnType<typeof forceSimulation<PNode>> | null>(null)

  const { nodes, links, neighborMap, degreeMap } = useMemo(() => {
    const rand = mulberry32(7)
    const nodes: PNode[] = [
      ...CHARACTERS.map((c) => ({
        id: c.id, kind: 'character' as NodeKind, label: c.name, color: NODE_COLORS.character,
        r: 17, avatar: c.avatar, x: VB_W / 2 + (rand() - 0.5) * 80, y: VB_H / 2 + (rand() - 0.5) * 80,
      })),
      ...PROPS.map((p) => ({
        id: p.id, kind: 'prop' as NodeKind, label: PROP_SHORT[p.id] ?? p.name, color: NODE_COLORS.prop,
        r: 10, x: VB_W / 2 + (rand() - 0.5) * 200, y: VB_H / 2 + (rand() - 0.5) * 200,
      })),
      ...SCENES.filter((s) => SCENE_IDS.includes(s.id)).map((s) => ({
        id: s.id, kind: 'scene' as NodeKind, label: s.code, color: NODE_COLORS.scene,
        r: 12, x: VB_W / 2 + (rand() - 0.5) * 200, y: VB_H / 2 + (rand() - 0.5) * 200,
      })),
    ]
    const links: PLink[] = [
      ...RELATIONSHIPS.filter((e) => e.strength >= 4).map((e) => ({ source: e.source, target: e.target, strength: e.strength })),
      ...CHARACTER_PROP_EDGES.filter((e) => e.strength >= 4).map((e) => ({ source: e.source, target: e.target, strength: e.strength })),
      ...PROP_SCENE_EDGES.filter((e) => SCENE_IDS.includes(e.target)).map((e) => ({ source: e.source, target: e.target, strength: e.strength })),
      ...CHAR_SCENE.map(([s, t]) => ({ source: s, target: t, strength: 2 })),
    ]
    const neighborMap = new Map<string, Set<string>>()
    const degreeMap = new Map<string, number>()
    for (const l of links) {
      const s = String(l.source)
      const t = String(l.target)
      if (!neighborMap.has(s)) neighborMap.set(s, new Set())
      if (!neighborMap.has(t)) neighborMap.set(t, new Set())
      neighborMap.get(s)!.add(t)
      neighborMap.get(t)!.add(s)
      degreeMap.set(s, (degreeMap.get(s) ?? 0) + 1)
      degreeMap.set(t, (degreeMap.get(t) ?? 0) + 1)
    }
    return { nodes, links, neighborMap, degreeMap }
  }, [])

  // 力导向模拟:tick 时直接写 DOM 属性(不触发 React 重渲染)
  useEffect(() => {
    const sim = forceSimulation<PNode>(nodes)
      .force('link', forceLink<PNode, PLink>(links).id((d) => d.id).distance(72).strength(0.45))
      .force('charge', forceManyBody().strength(-190))
      .force('center', forceCenter(VB_W / 2, VB_H / 2))
      .force('x', forceX(VB_W / 2).strength(0.05))
      .force('y', forceY(VB_H / 2).strength(0.07))
      .force('collide', forceCollide<PNode>().radius((d) => d.r + 14))
      .alpha(0.9)
      .alphaTarget(0.015)

    // 预跑若干 tick,让布局先舒展开
    for (let i = 0; i < 90; i++) sim.tick()

    sim.on('tick', () => {
      links.forEach((l, i) => {
        const el = lineRefs.current[i]
        if (!el) return
        const s = l.source as PNode
        const t = l.target as PNode
        el.setAttribute('x1', String(s.x ?? 0))
        el.setAttribute('y1', String(s.y ?? 0))
        el.setAttribute('x2', String(t.x ?? 0))
        el.setAttribute('y2', String(t.y ?? 0))
      })
      nodes.forEach((n, i) => {
        const el = nodeRefs.current[i]
        if (!el) return
        el.setAttribute('transform', `translate(${n.x ?? 0}, ${n.y ?? 0})`)
      })
    })

    simRef.current = sim
    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [nodes, links])

  // 播放 / 暂停(浮层打开时暂停漂移,便于阅读)
  useEffect(() => {
    simRef.current?.alphaTarget(playing && !selectedId ? 0.015 : 0)
  }, [playing, selectedId])

  const isDim = (id: string) => {
    if (!hoveredId) return false
    if (id === hoveredId) return false
    return !neighborMap.get(hoveredId)?.has(id)
  }
  const isEdgeDim = (l: PLink) => {
    if (!hoveredId) return false
    const s = (l.source as PNode).id ?? String(l.source)
    const t = (l.target as PNode).id ?? String(l.target)
    return s !== hoveredId && t !== hoveredId
  }

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) : undefined

  return (
    <section className="relative py-24">
      <div className="site-container">
        <motion.div
          ref={wrapRef}
          className="rounded-3xl border border-ink-line bg-ink-900 px-5 py-8 md:px-8 md:py-10"
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 控制条 */}
          <div className="flex flex-wrap items-center gap-4">
            <img
              src="/case-nightferry.png"
              alt="《夜航》海报"
              className="h-14 w-14 rounded-full border border-ink-line object-cover"
            />
            <div className="mr-auto">
              <p className="font-serif text-lg font-bold text-paper">《夜航》全量演示图谱</p>
              <p className="font-mono text-[0.6875rem] tracking-[0.1em] text-paper-dim">
                {nodes.length} NODES · {links.length} EDGES · LIVE FORCE LAYOUT
              </p>
            </div>
            <div className="hidden flex-wrap gap-2 xl:flex">
              <NodeChip kind="character" label="人物" />
              <NodeChip kind="scene" label="场景" />
              <NodeChip kind="prop" label="道具" />
              <NodeChip kind="emotion" label="情绪" />
              <NodeChip kind="event" label="事件" />
            </div>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-line bg-ink-800 text-paper transition-colors hover:border-amber/60 hover:text-amber"
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <Link
              to="/graph"
              className="group flex items-center gap-1.5 font-mono text-xs tracking-[0.1em] text-amber"
            >
              查看完整工作台
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* 图谱画布 */}
          <div className="relative mt-6">
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-[420px] w-full select-none md:h-[520px]">
              {links.map((l, i) => (
                <motion.line
                  key={`${String(l.source)}-${String(l.target)}-${i}`}
                  ref={(el) => {
                    lineRefs.current[i] = el
                  }}
                  stroke={isEdgeDim(l) ? '#26262F' : hoveredId ? '#FFB347' : '#3a3a48'}
                  strokeOpacity={isEdgeDim(l) ? 0.25 : hoveredId ? 0.7 : 0.5}
                  strokeWidth={0.5 + l.strength * 0.25}
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : undefined}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                />
              ))}
              {nodes.map((n, i) => (
                <g
                  key={n.id}
                  ref={(el) => {
                    nodeRefs.current[i] = el
                  }}
                  style={{ opacity: isDim(n.id) ? 0.25 : 1, transition: 'opacity 200ms' }}
                >
                  <motion.g
                    initial={{ scale: 0 }}
                    animate={inView ? { scale: 1 } : undefined}
                    transition={{ delay: 0.6 + i * 0.03, type: 'spring', stiffness: 260, damping: 18 }}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center', cursor: 'pointer' }}
                    whileHover={{ scale: 1.15 }}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId((cur) => (cur === n.id ? null : n.id))}
                  >
                    {n.kind === 'character' && n.avatar ? (
                      <>
                        <circle r={n.r + 2.5} fill="none" stroke={n.color} strokeWidth={selectedId === n.id ? 2.5 : 1.2} strokeOpacity={selectedId === n.id ? 1 : 0.7} />
                        <clipPath id={`clip-${n.id}`}>
                          <circle r={n.r} />
                        </clipPath>
                        <image href={n.avatar} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} clipPath={`url(#clip-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                      </>
                    ) : (
                      <circle
                        r={n.r}
                        fill={n.color}
                        fillOpacity={n.kind === 'scene' ? 0.14 : 0.2}
                        stroke={n.color}
                        strokeWidth={selectedId === n.id ? 2.5 : 1.2}
                      />
                    )}
                    <text
                      y={n.r + 14}
                      textAnchor="middle"
                      className="fill-paper-dim font-mono"
                      fontSize="10"
                      style={{ pointerEvents: 'none' }}
                    >
                      {n.label}
                    </text>
                  </motion.g>
                </g>
              ))}
            </svg>

            {/* 节点浮层 */}
            {selected && (
              <motion.div
                className="absolute z-20 w-56 rounded-xl border border-ink-line bg-ink-950/95 p-4 shadow-xl backdrop-blur-sm"
                style={{
                  left: `${Math.min(88, Math.max(4, ((selected.x ?? 0) / VB_W) * 100))}%`,
                  top: `${Math.min(78, Math.max(4, ((selected.y ?? 0) / VB_H) * 100))}%`,
                }}
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selected.color }} />
                  <p className="font-serif text-base font-bold text-paper">{selected.label}</p>
                  <span className="ml-auto font-mono text-[0.6875rem] text-paper-dim">{KIND_LABEL[selected.kind]}</span>
                </div>
                <p className="mt-2 font-mono text-[0.6875rem] leading-5 text-paper-dim">
                  DEGREE — {degreeMap.get(selected.id) ?? 0} 条连接
                </p>
                <Link
                  to="/graph"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber/50 px-3 py-1.5 font-mono text-[0.6875rem] text-amber transition-colors hover:bg-amber/10"
                >
                  在图谱中打开
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
