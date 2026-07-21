import { useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { area, line, curveCatmullRom } from 'd3-shape'
import { ACTS, BEATS, EMOTION_SERIES, SCRIPT_STATS, getBeat } from '@/data/nightferry'

const W = 1000
const H = 360
const PAD = { l: 44, r: 16, t: 28, b: 40 }
const CLIMAX = [34, 38, 41]

/** S5 · 情绪指纹横带:《夜航》全剧 42 场情绪曲线 */
export default function EmotionBand() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const inView = useInView(wrapRef, { once: true, margin: '-30% 0px' })
  const [hover, setHover] = useState<number | null>(null)

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
    return {
      x,
      y,
      linePath: lineGen(EMOTION_SERIES) ?? '',
      areaPath: areaGen(EMOTION_SERIES) ?? '',
    }
  }, [])

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const beat = Math.round(x.invert(px))
    setHover(beat >= 1 && beat <= 42 ? beat : null)
  }

  const hoverBeat = hover ? getBeat(hover) : undefined
  const peak = getBeat(SCRIPT_STATS.peakBeat)
  const valley = getBeat(SCRIPT_STATS.valleyBeat)

  return (
    <section className="relative border-y border-ink-line bg-ink-900/40 py-24">
      <div className="site-container">
        <div className="max-w-2xl">
          <p className="mono-label flex items-center gap-3">
            <span className="inline-block h-px w-6 bg-rose" />
            CHAPTER 02 — EMOTION FINGERPRINT
          </p>
          <h3 className="mt-4 font-serif text-[clamp(1.6rem,3vw,2.4rem)] font-bold text-paper">
            每部剧本,都有一枚情绪指纹
          </h3>
          <p className="mt-3 leading-7 text-paper-dim">
            《夜航》42 场的整体情绪走向:哪里积蓄、哪里断裂、哪里爆发,一条曲线全部说清。
          </p>
        </div>

        <div ref={wrapRef} className="relative mt-10">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="emo-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF4D6D" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FF4D6D" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* 三幕背景分格 */}
            {ACTS.map((act, i) => {
              const x0 = x(act.range[0]) - (i === 0 ? 0 : (x(13) - x(12)) / 2)
              const x1 = x(act.range[1]) + (act.range[1] === 42 ? 0 : (x(13) - x(12)) / 2)
              return (
                <g key={act.id}>
                  <motion.rect
                    x={x0}
                    width={x1 - x0}
                    y={PAD.t}
                    height={H - PAD.t - PAD.b}
                    fill={i % 2 === 0 ? 'rgba(242,234,216,0.02)' : 'rgba(242,234,216,0.045)'}
                    initial={{ scaleY: 0 }}
                    animate={inView ? { scaleY: 1 } : undefined}
                    style={{ transformOrigin: `${x0}px ${H - PAD.b}px` }}
                    transition={{ delay: i * 0.2, duration: 0.6 }}
                  />
                  <text x={x0 + 8} y={PAD.t - 8} className="fill-paper-dim font-mono" fontSize="10" letterSpacing="0.12em">
                    {act.nameEn}
                  </text>
                </g>
              )
            })}

            {/* Y 轴刻度 */}
            {[-5, -2.5, 0, 2.5, 5].map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#26262F" strokeWidth={t === 0 ? 1.2 : 0.6} strokeDasharray={t === 0 ? undefined : '3 5'} />
                <text x={PAD.l - 10} y={y(t) + 3} textAnchor="end" className="fill-paper-dim font-mono" fontSize="10">
                  {t > 0 ? `+${t}` : t}
                </text>
              </g>
            ))}

            {/* 面积填充(延迟淡入) */}
            <motion.path
              d={areaPath}
              fill="url(#emo-fill)"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : undefined}
              transition={{ delay: 0.8, duration: 0.9 }}
            />
            {/* 曲线描边(1.6s 描画) */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#FF4D6D"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : undefined}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            />

            {/* 高潮标记 */}
            {CLIMAX.map((beat) => {
              const d = EMOTION_SERIES[beat - 1]
              return (
                <motion.circle
                  key={beat}
                  cx={x(d.beat)}
                  cy={y(d.emotion)}
                  r="5"
                  fill="#FF4D6D"
                  stroke="#08080D"
                  strokeWidth="2"
                  initial={{ scale: 0 }}
                  animate={inView ? { scale: [0, 1.3, 1] } : undefined}
                  transition={{ delay: 0.15 + ((beat - 1) / 41) * 1.6, duration: 0.45 }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                />
              )
            })}

            {/* hover 十字准线 */}
            {hover && hoverBeat && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#FFB347" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.7" />
                <circle cx={x(hover)} cy={y(hoverBeat.emotion)} r="4.5" fill="#FFB347" stroke="#08080D" strokeWidth="2" />
              </g>
            )}

            {/* X 轴场次刻度 */}
            {[1, 7, 13, 20, 27, 34, 42].map((b) => (
              <text key={b} x={x(b)} y={H - PAD.b + 18} textAnchor="middle" className="fill-paper-dim font-mono" fontSize="9">
                {String(b).padStart(2, '0')}
              </text>
            ))}
          </svg>

          {/* hover tooltip */}
          {hover && hoverBeat && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-ink-line bg-ink-950/95 px-3 py-2 font-mono text-[0.6875rem] leading-5 text-paper shadow-lg"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                top: 0,
                transform: `translateX(${x(hover) / W > 0.8 ? '-90%' : x(hover) / W < 0.15 ? '-10%' : '-50%'})`,
              }}
            >
              <span className="text-amber">场 {String(hover).padStart(2, '0')}</span>
              <span className="mx-2 text-paper-dim">{hoverBeat.title}</span>
              <span className={hoverBeat.emotion >= 0 ? 'text-green' : 'text-rose'}>
                {hoverBeat.emotion > 0 ? '+' : ''}
                {hoverBeat.emotion}
              </span>
            </div>
          )}
        </div>

        {/* 指标行 */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { k: '峰值场', v: `场${SCRIPT_STATS.peakBeat} ${peak?.title ?? ''} +${SCRIPT_STATS.peakValue}` },
            { k: '谷值场', v: `场${SCRIPT_STATS.valleyBeat} ${valley?.title ?? ''} ${SCRIPT_STATS.valleyValue}` },
            { k: '平均张力', v: '0.6' },
            { k: '情绪振幅', v: String(SCRIPT_STATS.emotionAmplitude) },
          ].map((m) => (
            <div key={m.k} className="rounded-xl border border-ink-line bg-ink-950/60 px-4 py-3">
              <p className="mono-tick">{m.k}</p>
              <p className="mt-1 font-mono text-sm text-paper">{m.v}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 font-mono text-[0.6875rem] tracking-[0.08em] text-paper-dim/70">
          * 数据源:{BEATS.length} 场整体情绪序列(标尺 -5 绝望 → +5 狂喜)
        </p>
      </div>
    </section>
  )
}
