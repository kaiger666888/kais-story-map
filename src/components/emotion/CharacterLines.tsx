import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX, curveStepAfter } from 'd3-shape'
import { CHARACTERS, EMOTION_SERIES } from '@/data/nightferry'
import { PanelCard } from '@/components/common'
import { cn } from '@/lib/utils'
import { EVENT_MARKERS, beatCode, charMean, fmtVal } from './shared'

const W = 1100
const H = 480
const PAD = { l: 48, r: 24, t: 26, b: 38 }
const X_TICKS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 42]
const Y_TICKS = [-5, -2.5, 0, 2.5, 5]
const MAX_ACTIVE = 4
const DEFAULT_ACTIVE = ['linwan', 'jiangli', 'shenque', 'suqiao']

type Mode = 'smooth' | 'step'

export default function CharacterLines() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, amount: 0.25 })
  const [active, setActive] = useState<string[]>(DEFAULT_ACTIVE)
  const [mode, setMode] = useState<Mode>('smooth')
  const [showEvents, setShowEvents] = useState(true)
  const [hoverLine, setHoverLine] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const { x, y, refPath } = useMemo(() => {
    const x = scaleLinear().domain([1, 42]).range([PAD.l, W - PAD.r])
    const y = scaleLinear().domain([-5, 5]).range([H - PAD.b, PAD.t])
    const refGen = line<(typeof EMOTION_SERIES)[number]>()
      .x((d) => x(d.beat))
      .y((d) => y(d.emotion))
      .curve(curveMonotoneX)
    return { x, y, refPath: refGen(EMOTION_SERIES) ?? '' }
  }, [])

  /** 各人物曲线路径(含 null 断段,随平滑/逐场模式重算) */
  const paths = useMemo(() => {
    const curve = mode === 'smooth' ? curveMonotoneX : curveStepAfter
    const map: Record<string, string> = {}
    for (const c of CHARACTERS) {
      const gen = line<{ beat: number; v: number | null }>()
        .x((d) => x(d.beat))
        .y((d) => y(d.v ?? 0))
        .defined((d) => d.v != null)
        .curve(curve)
      map[c.id] = gen(c.arc.map((v, i) => ({ beat: i + 1, v }))) ?? ''
    }
    return map
  }, [x, y, mode])

  const toggle = (id: string) => {
    if (active.includes(id)) {
      setActive(active.filter((a) => a !== id))
    } else if (active.length >= MAX_ACTIVE) {
      setToast(`最多同时显示 ${MAX_ACTIVE} 条人物曲线 — 请先取消一条`)
    } else {
      setActive([...active, id])
    }
  }

  return (
    <section className="site-container">
      <PanelCard index="FIG.02 — CHARACTER LINES" accent="#FFB347">
        {/* 面板头:标题 + 控件 */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-paper">人物情绪多线图</h3>
            <p className="mono-tick mt-1">CHARACTER ARCS vs GLOBAL TENSION(淡色参考线)</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* 平滑 / 逐场 切换 */}
            <div className="flex rounded-full border border-ink-line bg-ink-950/70 p-0.5">
              {(
                [
                  { id: 'smooth', label: '平滑' },
                  { id: 'step', label: '逐场' },
                ] as { id: Mode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'rounded-full px-3 py-1 font-mono text-[0.6875rem] transition-all duration-200',
                    mode === m.id ? 'bg-amber font-bold text-ink-950' : 'text-paper-dim hover:text-paper',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* 事件标记开关 */}
            <button
              onClick={() => setShowEvents(!showEvents)}
              className="flex items-center gap-2 font-mono text-[0.6875rem] text-paper-dim transition-colors hover:text-paper"
              role="switch"
              aria-checked={showEvents}
            >
              <span
                className={cn(
                  'relative h-4 w-7 rounded-full transition-colors duration-200',
                  showEvents ? 'bg-green/70' : 'bg-ink-line',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-3 w-3 rounded-full bg-paper transition-all duration-200',
                    showEvents ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </span>
              显示事件标记
            </button>
          </div>
        </div>

        {/* 人物切换器 + 图例 */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {CHARACTERS.map((c) => {
              const on = active.includes(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border bg-ink-950/70 py-1 pl-1 pr-3 transition-all duration-200',
                    on ? 'border-2 -translate-y-0.5' : 'border-ink-line opacity-70 hover:opacity-100',
                  )}
                  style={on ? { borderColor: c.color, boxShadow: `0 0 14px ${c.color}30` } : undefined}
                  aria-pressed={on}
                >
                  <img src={c.avatar} alt={c.name} className="h-8 w-8 rounded-full object-cover" />
                  <span className={cn('text-xs', on ? 'font-bold text-paper' : 'text-paper-dim')}>{c.name}</span>
                </button>
              )
            })}
          </div>
          {/* 图例:当前线的颜色与均值 */}
          <div className="flex flex-col gap-1.5">
            {active.map((id) => {
              const c = CHARACTERS.find((ch) => ch.id === id)
              if (!c) return null
              return (
                <button
                  key={id}
                  onMouseEnter={() => setHoverLine(id)}
                  onMouseLeave={() => setHoverLine(null)}
                  onClick={() => toggle(id)}
                  className="flex items-center gap-2 font-mono text-[0.6875rem] text-paper-dim transition-colors hover:text-paper"
                >
                  <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="w-9 text-left">{c.name}</span>
                  <span style={{ color: c.color }}>μ {fmtVal(charMean(id))}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 多线图 */}
        <div ref={wrapRef} className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {/* 幕分界虚线 */}
            {[12.5, 34.5].map((b) => (
              <line
                key={b}
                x1={x(b)}
                x2={x(b)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="#26262F"
                strokeWidth="1"
                strokeDasharray="5 5"
              />
            ))}
            {Y_TICKS.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? 'rgba(242,234,216,0.25)' : '#26262F'}
                  strokeWidth={t === 0 ? 1.2 : 0.6}
                  strokeDasharray={t === 0 ? '5 5' : '3 5'}
                />
                <text x={PAD.l - 10} y={y(t) + 3} textAnchor="end" className="fill-paper-dim font-mono" fontSize="10">
                  {t > 0 ? `+${t}` : t}
                </text>
              </g>
            ))}
            {X_TICKS.map((b) => (
              <text
                key={b}
                x={x(b)}
                y={H - PAD.b + 20}
                textAnchor="middle"
                className="fill-paper-dim font-mono"
                fontSize="9.5"
              >
                {beatCode(b)}
              </text>
            ))}

            {/* 全剧张力参考线(极淡 paper) */}
            <motion.path
              d={refPath}
              fill="none"
              stroke="#F2EAD8"
              strokeWidth="1"
              strokeOpacity="0.15"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : undefined}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              style={{ pointerEvents: 'none' }}
            />

            {/* 事件标记(可开关) */}
            {showEvents &&
              EVENT_MARKERS.map((m) => {
                const d = EMOTION_SERIES[m.beat - 1]
                return (
                  <rect
                    key={m.beat}
                    x={x(d.beat) - 3.5}
                    y={y(d.emotion) - 3.5}
                    width={7}
                    height={7}
                    fill="#7BE0A3"
                    fillOpacity="0.9"
                    transform={`rotate(45 ${x(d.beat)} ${y(d.emotion)})`}
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })}

            {/* 人物曲线(toggle 描边生长 / 收起) */}
            <AnimatePresence>
              {active.map((id) => {
                const c = CHARACTERS.find((ch) => ch.id === id)
                if (!c) return null
                const dimmed = hoverLine != null && hoverLine !== id
                return (
                  <motion.path
                    key={`${id}-${mode}`}
                    d={paths[id]}
                    fill="none"
                    stroke={c.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 1 }}
                    animate={{ pathLength: 1, opacity: dimmed ? 0.15 : 1 }}
                    exit={{ pathLength: 0, opacity: 0, transition: { duration: 0.3 } }}
                    transition={{
                      pathLength: { duration: 0.9, ease: 'easeInOut' },
                      opacity: { duration: 0.2 },
                    }}
                    onMouseEnter={() => setHoverLine(id)}
                    onMouseLeave={() => setHoverLine(null)}
                    style={{ cursor: 'pointer' }}
                  />
                )
              })}
            </AnimatePresence>
          </svg>
        </div>

        <p className="mono-tick mt-3 text-paper-dim/70">
          * 点击头像 chip 切换曲线(最多 {MAX_ACTIVE} 条);断线段 = 该人物不在场 / 失联 / 死亡;悬停某条线可孤立查看。
        </p>

        {/* 超限 toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-8 left-1/2 z-[80] rounded-full border border-amber/40 bg-ink-950/95 px-4 py-2 font-mono text-xs text-amber shadow-glow-amber backdrop-blur"
              style={{ x: '-50%' }}
              role="status"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </PanelCard>
    </section>
  )
}
