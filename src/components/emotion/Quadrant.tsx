import { useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { BEATS } from '@/data/nightferry'
import { PanelCard } from '@/components/common'
import { beatArousal, beatCode, fmtVal } from './shared'

const W = 560
const H = 460
const PAD = { l: 40, r: 20, t: 26, b: 40 }
const ACT_COLORS: Record<number, string> = { 1: '#FFB347', 2: '#FF4D6D', 3: '#4DD8FF' }
const QUAD_LABELS = [
  { text: '紧张 / 恐惧', x: 'l', y: 't' },
  { text: '狂喜 / 爆发', x: 'r', y: 't' },
  { text: '压抑 / 麻木', x: 'l', y: 'b' },
  { text: '松弛 / 满足', x: 'r', y: 'b' },
]

export default function Quadrant({ onLocate }: { onLocate: (range: [number, number]) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, amount: 0.3 })
  const [hover, setHover] = useState<number | null>(null)

  const { x, y } = useMemo(() => {
    return {
      x: scaleLinear().domain([-5, 5]).range([PAD.l, W - PAD.r]),
      y: scaleLinear().domain([0, 10]).range([H - PAD.b, PAD.t]),
    }
  }, [])

  const points = useMemo(
    () =>
      BEATS.map((b) => ({
        beat: b.index,
        title: b.title,
        act: b.act,
        valence: b.emotion,
        arousal: beatArousal(b),
        n: b.characters.length,
      })),
    [],
  )
  const hoverPt = hover != null ? points.find((p) => p.beat === hover) : undefined

  return (
    <PanelCard index="FIG.04 — QUADRANT" accent="#A78BFA" className="h-full">
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-paper">情绪象限 · 效价 × 唤醒</h3>
          <p className="mono-tick mt-1">VALENCE × AROUSAL · 42 BEATS</p>
        </div>
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((a) => (
            <span key={a} className="flex items-center gap-1.5 font-mono text-[0.6875rem] text-paper-dim">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACT_COLORS[a] }} />
              ACT {['I', 'II', 'III'][a - 1]}
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* 象限分隔虚线(延迟淡入) */}
          <motion.line
            x1={x(0)} x2={x(0)} y1={PAD.t} y2={H - PAD.b}
            stroke="#26262F" strokeWidth="1.2" strokeDasharray="5 5"
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ delay: 0.5, duration: 0.6 }}
          />
          <motion.line
            x1={PAD.l} x2={W - PAD.r} y1={y(5)} y2={y(5)}
            stroke="#26262F" strokeWidth="1.2" strokeDasharray="5 5"
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ delay: 0.5, duration: 0.6 }}
          />

          {/* 象限标注 */}
          {QUAD_LABELS.map((q) => (
            <motion.text
              key={q.text}
              x={q.x === 'l' ? PAD.l + 8 : W - PAD.r - 8}
              y={q.y === 't' ? PAD.t + 14 : H - PAD.b - 10}
              textAnchor={q.x === 'l' ? 'start' : 'end'}
              className="fill-paper-dim/60 font-mono"
              fontSize="10"
              letterSpacing="0.1em"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : undefined}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              {q.text}
            </motion.text>
          ))}

          {/* 轴刻度 */}
          {[-5, 0, 5].map((t) => (
            <text key={t} x={x(t)} y={H - PAD.b + 18} textAnchor="middle" className="fill-paper-dim font-mono" fontSize="9.5">
              {t > 0 ? `+${t}` : t}
            </text>
          ))}
          {[0, 5, 10].map((t) => (
            <text key={t} x={PAD.l - 8} y={y(t) + 3} textAnchor="end" className="fill-paper-dim font-mono" fontSize="9.5">
              {t}
            </text>
          ))}
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle" className="fill-paper-dim font-mono" fontSize="9" letterSpacing="0.14em">
            VALENCE 效价 →
          </text>
          <text
            x={12} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle"
            className="fill-paper-dim font-mono" fontSize="9" letterSpacing="0.14em"
            transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}
          >
            AROUSAL 唤醒 →
          </text>

          {/* 散点:从原点散射入场 */}
          {points.map((p, i) => {
            const fx = x(p.valence)
            const fy = y(p.arousal)
            const r = 3 + p.n * 0.85
            const color = ACT_COLORS[p.act]
            const hovered = hover === p.beat
            return (
              <motion.g
                key={p.beat}
                initial={{ x: x(0) - fx, y: y(0) - fy, opacity: 0 }}
                animate={inView ? { x: 0, y: 0, opacity: 1 } : undefined}
                transition={{ delay: i * 0.02, type: 'spring', stiffness: 120, damping: 14 }}
              >
                <motion.circle
                  cx={fx}
                  cy={fy}
                  r={r}
                  fill={color}
                  fillOpacity={hovered ? 1 : 0.75}
                  stroke={hovered ? '#F2EAD8' : '#08080D'}
                  strokeWidth={hovered ? 1.5 : 1}
                  whileHover={{ scale: 1.4, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                  style={{
                    cursor: 'pointer',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    filter: hovered ? `drop-shadow(0 0 8px ${color})` : undefined,
                  }}
                  onMouseEnter={() => setHover(p.beat)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onLocate([p.beat, p.beat])}
                />
              </motion.g>
            )
          })}
        </svg>

        {/* hover tooltip */}
        {hoverPt && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-ink-line bg-ink-950/95 px-3 py-2 font-mono text-[0.6875rem] shadow-lg backdrop-blur-sm"
            style={{
              left: `${(x(hoverPt.valence) / W) * 100}%`,
              top: `${(y(hoverPt.arousal) / H) * 100}%`,
              transform: `translate(${x(hoverPt.valence) / W > 0.7 ? '-105%' : '12px'}, -50%)`,
            }}
          >
            <span style={{ color: ACT_COLORS[hoverPt.act] }}>{beatCode(hoverPt.beat)}</span>
            <span className="mx-1.5 text-paper">{hoverPt.title}</span>
            <span className="text-paper-dim">
              {fmtVal(hoverPt.valence)} / {hoverPt.arousal}
            </span>
          </div>
        )}
      </div>

      <p className="mono-tick mt-3 text-paper-dim/70">
        * 点大小 = 在场人数;唤醒度由 |情绪|、在场人数与关键节拍加权推算;点击点在主图定位该场。
      </p>
    </PanelCard>
  )
}
