import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { area, line, curveCatmullRom } from 'd3-shape'
import { X } from 'lucide-react'
import { ACTS, EMOTION_SERIES, getBeat, getCharacter, getScene } from '@/data/nightferry'
import { PanelCard } from '@/components/common'
import { EVENT_MARKERS, beatCode, fmtVal, valueColor } from './shared'
import { BEAT_QUOTES } from './quotes'

const W = 1100
const H = 440
const PAD = { l: 48, r: 24, t: 36, b: 38 }
const X_TICKS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 42]
const Y_TICKS = [-5, -2.5, 0, 2.5, 5]

export default function TensionChart({
  focusRange,
  onClearFocus,
}: {
  /** 外部联动高亮区间(场号闭区间) */
  focusRange: [number, number] | null
  onClearFocus: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const inView = useInView(wrapRef, { once: true, amount: 0.25 })
  const [hover, setHover] = useState<number | null>(null)
  const [selEvent, setSelEvent] = useState<number | null>(null)

  /* tooltip 跟随:弹性拖尾(约 80ms lerp 手感) */
  const txRaw = useMotionValue(50)
  const tx = useSpring(txRaw, { stiffness: 800, damping: 55, mass: 0.4 })
  const tooltipLeft = useTransform(tx, (v) => `${v}%`)

  const { x, y, linePath, areaPath } = useMemo(() => {
    const x = scaleLinear().domain([1, 42]).range([PAD.l, W - PAD.r])
    const y = scaleLinear().domain([-5, 5]).range([H - PAD.b, PAD.t])
    const lineGen = line<(typeof EMOTION_SERIES)[number]>()
      .x((d) => x(d.beat))
      .y((d) => y(d.emotion))
      .curve(curveCatmullRom.alpha(0.5))
    const areaGen = area<(typeof EMOTION_SERIES)[number]>()
      .x((d) => x(d.beat))
      .y0(y(0))
      .y1((d) => y(d.emotion))
      .curve(curveCatmullRom.alpha(0.5))
    return { x, y, linePath: lineGen(EMOTION_SERIES) ?? '', areaPath: areaGen(EMOTION_SERIES) ?? '' }
  }, [])

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const beat = Math.round(x.invert(px))
    if (beat >= 1 && beat <= 42) {
      setHover(beat)
      txRaw.set((x(beat) / W) * 100)
    } else {
      setHover(null)
    }
  }

  const hoverBeat = hover ? getBeat(hover) : undefined
  const hoverScene = hoverBeat ? getScene(hoverBeat.sceneId) : undefined
  const selBeat = selEvent ? getBeat(selEvent) : undefined
  const selScene = selBeat ? getScene(selBeat.sceneId) : undefined

  /** hover 时高亮的局部曲线段(前后各一场) */
  const segPath = useMemo(() => {
    if (!hover) return ''
    const lineGen = line<(typeof EMOTION_SERIES)[number]>()
      .x((d) => x(d.beat))
      .y((d) => y(d.emotion))
      .curve(curveCatmullRom.alpha(0.5))
    return lineGen(EMOTION_SERIES.slice(Math.max(0, hover - 2), Math.min(42, hover + 1))) ?? ''
  }, [hover, x, y])

  const tooltipShift = hover ? ((x(hover) / W) > 0.8 ? '-92%' : (x(hover) / W) < 0.14 ? '-8%' : '-50%') : '-50%'

  return (
    <section className="site-container">
      <PanelCard index="FIG.01 — GLOBAL TENSION" accent="#FF4D6D" className="scroll-mt-24">
        {/* 面板头 */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-paper">全剧张力曲线</h3>
            <p className="mono-tick mt-1">TENSION · 42 BEATS · SCALE -5..+5</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-tick mr-1 hidden md:inline">KEY EVENTS →</span>
            {EVENT_MARKERS.map((m) => (
              <button
                key={m.beat}
                onClick={() => setSelEvent(m.beat === selEvent ? null : m.beat)}
                className="flex items-center gap-1.5 rounded-full border border-ink-line bg-ink-950/70 px-2.5 py-1 font-mono text-[0.6875rem] text-paper-dim transition-all duration-200 hover:-translate-y-0.5 hover:border-green/50 hover:text-paper"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rotate-45"
                  style={{ backgroundColor: '#7BE0A3', boxShadow: '0 0 6px #7BE0A380' }}
                />
                {beatCode(m.beat)} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 主图 */}
        <div ref={wrapRef} className="relative mt-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={() => focusRange && onClearFocus()}
          >
            <defs>
              <linearGradient id="tension-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF4D6D" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#FF4D6D" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* 三幕背景分格(交替 ink-900 / ink-800,自底生长) */}
            {ACTS.map((act, i) => {
              const half = (x(13) - x(12)) / 2
              const x0 = x(act.range[0]) - (i === 0 ? half : half)
              const x1 = x(act.range[1]) + half
              return (
                <g key={act.id}>
                  <motion.rect
                    x={x0}
                    width={x1 - x0}
                    y={PAD.t}
                    height={H - PAD.t - PAD.b}
                    fill={i % 2 === 0 ? 'rgba(14,14,22,0.9)' : 'rgba(22,22,31,0.9)'}
                    initial={{ scaleY: 0 }}
                    animate={inView ? { scaleY: 1 } : undefined}
                    style={{ transformOrigin: `${x0}px ${H - PAD.b}px` }}
                    transition={{ delay: i * 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <text
                    x={(x0 + x1) / 2}
                    y={PAD.t - 12}
                    textAnchor="middle"
                    className="fill-paper-dim font-mono"
                    fontSize="10"
                    letterSpacing="0.16em"
                  >
                    {act.nameEn} · {act.name.split('·')[1]?.trim()}
                  </text>
                </g>
              )
            })}

            {/* Y 轴刻度 + 0 轴 paper 25% 虚线 */}
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

            {/* 联动高亮区间(底色 200ms 闪入) */}
            <AnimatePresence>
              {focusRange && (
                <motion.g
                  key={`${focusRange[0]}-${focusRange[1]}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ pointerEvents: 'none' }}
                >
                  <rect
                    x={x(focusRange[0]) - (x(2) - x(1)) / 2}
                    width={(x(focusRange[1]) - x(focusRange[0])) + (x(2) - x(1))}
                    y={PAD.t}
                    height={H - PAD.t - PAD.b}
                    fill="rgba(255,179,71,0.10)"
                    stroke="rgba(255,179,71,0.45)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={x(focusRange[0])}
                    y={PAD.t + 14}
                    className="fill-amber font-mono"
                    fontSize="10"
                    letterSpacing="0.1em"
                  >
                    {beatCode(focusRange[0])}–{beatCode(focusRange[1])}
                  </text>
                </motion.g>
              )}
            </AnimatePresence>

            {/* 面积填充(描边完成后淡入) */}
            <motion.path
              d={areaPath}
              fill="url(#tension-fill)"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : undefined}
              transition={{ delay: 1.5, duration: 0.6 }}
              style={{ pointerEvents: 'none' }}
            />
            {/* 主曲线:rose 2.5px,hover 时降至 0.4 */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#FF4D6D"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: inView ? 1 : 0, opacity: hover ? 0.4 : 1 }}
              transition={{
                pathLength: { duration: 1.8, ease: 'easeInOut' },
                opacity: { duration: 0.2 },
              }}
              style={{ pointerEvents: 'none' }}
            />
            {/* hover 局部高亮段 */}
            {hover && (
              <path
                d={segPath}
                fill="none"
                stroke="#FF8FA3"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* 关键事件菱形(green,pop 入场) */}
            {EVENT_MARKERS.map((m, i) => {
              const d = EMOTION_SERIES[m.beat - 1]
              const cx = x(d.beat)
              const cy = y(d.emotion)
              const active = selEvent === m.beat
              return (
                <g
                  key={m.beat}
                  transform={`rotate(45 ${cx} ${cy})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelEvent(active ? null : m.beat)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <motion.rect
                    x={cx - 5}
                    y={cy - 5}
                    width={10}
                    height={10}
                    fill={active ? '#7BE0A3' : '#0E0E16'}
                    stroke="#7BE0A3"
                    strokeWidth="2"
                    initial={{ scale: 0 }}
                    animate={inView ? { scale: [0, 1.25, 1] } : undefined}
                    transition={{ delay: 1.6 + i * 0.1, duration: 0.5 }}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  />
                  {/* 扩大点击热区 */}
                  <rect x={cx - 12} y={cy - 12} width={24} height={24} fill="transparent" />
                </g>
              )
            })}

            {/* hover 十字准线 */}
            {hover && hoverBeat && (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="#FFB347"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  strokeOpacity="0.7"
                />
                <circle cx={x(hover)} cy={y(hoverBeat.emotion)} r="5" fill="#FFB347" stroke="#08080D" strokeWidth="2" />
              </g>
            )}

            {/* X 轴刻度(每 5 场) */}
            {X_TICKS.map((b) => (
              <text
                key={b}
                x={x(b)}
                y={H - PAD.b + 20}
                textAnchor="middle"
                className="fill-paper-dim font-mono"
                fontSize="9.5"
                letterSpacing="0.06em"
              >
                {beatCode(b)}
              </text>
            ))}
          </svg>

          {/* hover tooltip(弹性跟随) */}
          {hover && hoverBeat && hoverScene && (
            <motion.div
              className="pointer-events-none absolute top-0 z-10 w-64"
              style={{ left: tooltipLeft }}
            >
              <div
                className="rounded-xl border border-ink-line bg-ink-950/95 p-3 shadow-xl backdrop-blur-sm transition-transform duration-150"
                style={{ transform: `translateX(${tooltipShift})` }}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[0.6875rem]">
                  <span className="text-amber">
                    {beatCode(hover)} · {hoverBeat.title}
                  </span>
                  <span style={{ color: valueColor(hoverBeat.emotion) }}>{fmtVal(hoverBeat.emotion)}</span>
                </div>
                <p className="mono-tick mt-1 text-cyan/90">
                  {hoverScene.code} {hoverScene.name} · ACT {hoverBeat.act}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {hoverBeat.characters.map((cid) => {
                    const c = getCharacter(cid)
                    if (!c) return null
                    return (
                      <span
                        key={cid}
                        className="flex items-center gap-1 rounded-full border border-ink-line bg-ink-900 px-1.5 py-0.5 font-mono text-[0.625rem] text-paper-dim"
                      >
                        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    )
                  })}
                </div>
                <p className="mt-2 line-clamp-2 text-[0.6875rem] leading-4 text-paper-dim">{hoverBeat.summary}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* 点击事件菱形 → 该场详情条 */}
        <AnimatePresence initial={false}>
          {selBeat && selScene && (
            <motion.div
              key={selBeat.index}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 26 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-green/25 bg-ink-950/70 p-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rotate-45"
                      style={{ backgroundColor: '#7BE0A3', boxShadow: '0 0 8px #7BE0A380' }}
                    />
                    <span className="font-mono text-xs text-green">{beatCode(selBeat.index)}</span>
                    <span className="font-serif text-base font-bold text-paper">{selBeat.title}</span>
                    <span className="mono-tick text-cyan/90">
                      {selScene.code} {selScene.name}
                    </span>
                    <span className="font-mono text-xs" style={{ color: valueColor(selBeat.emotion) }}>
                      {fmtVal(selBeat.emotion)}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-paper-dim">{selBeat.summary}</p>
                  {BEAT_QUOTES[selBeat.index] && (
                    <p className="mt-2 border-l-2 border-amber/50 pl-3 font-serif text-sm italic leading-6 text-paper/90">
                      「{BEAT_QUOTES[selBeat.index].text}」
                      <span className="ml-2 font-mono text-[0.6875rem] not-italic text-paper-dim">
                        —— {BEAT_QUOTES[selBeat.index].speaker}
                      </span>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selBeat.characters.map((cid) => {
                      const c = getCharacter(cid)
                      if (!c) return null
                      return (
                        <span
                          key={cid}
                          className="flex items-center gap-1.5 rounded-full border border-ink-line bg-ink-900 px-2 py-0.5 font-mono text-[0.6875rem] text-paper-dim"
                        >
                          <img src={c.avatar} alt={c.name} className="h-4 w-4 rounded-full object-cover" />
                          {c.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setSelEvent(null)}
                  className="shrink-0 rounded-full border border-ink-line p-1.5 text-paper-dim transition-colors hover:border-paper-dim/50 hover:text-paper"
                  aria-label="关闭详情"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mono-tick mt-4 text-paper-dim/70">
          * 悬停查看逐场张力;点击绿色菱形展开关键事件详情;点击图面清除联动高亮。
        </p>
      </PanelCard>
    </section>
  )
}
