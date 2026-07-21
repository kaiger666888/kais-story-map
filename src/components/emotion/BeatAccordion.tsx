import { useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { ChevronDown, Quote } from 'lucide-react'
import type { ActId, Beat } from '@/data/nightferry'
import { PanelCard } from '@/components/common'
import { cn } from '@/lib/utils'
import { useScript } from '@/context/ScriptDataContext'
import { beatCode, fmtVal, valueColor } from './shared'
import { BEAT_QUOTES } from './quotes'

/* ── 60px 迷你 sparkline(本场前后各 3 场窗口) ── */
function Sparkline({ center }: { center: number }) {
  const { emotionSeries: EMOTION_SERIES, beats } = useScript()
  const beatCount = beats.length
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: '-5% 0px' })
  const w = 60
  const h = 22
  const lo = Math.max(1, center - 3)
  const hi = Math.min(beatCount, center + 3)
  const data = EMOTION_SERIES.slice(lo - 1, hi)
  const sx = scaleLinear().domain([lo, hi]).range([2, w - 2])
  const sy = scaleLinear().domain([-5, 5]).range([h - 2, 2])
  const gen = line<(typeof EMOTION_SERIES)[number]>()
    .x((d) => sx(d.beat))
    .y((d) => sy(d.emotion))
    .curve(curveMonotoneX)
  const cur = EMOTION_SERIES[center - 1]
  return (
    <svg ref={ref} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <line x1={2} x2={w - 2} y1={sy(0)} y2={sy(0)} stroke="#26262F" strokeWidth={0.5} strokeDasharray="2 2" />
      <motion.path
        d={gen(data) ?? ''}
        fill="none"
        stroke="#FF8FA3"
        strokeWidth={1.2}
        initial={{ pathLength: 0 }}
        animate={inView ? { pathLength: 1 } : undefined}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
      <circle cx={sx(center)} cy={sy(cur.emotion)} r={2} fill="#FFB347" />
    </svg>
  )
}

/* ── 在场人物情绪条(-5..+5 中心发散) ── */
function EmotionBar({ charId, value }: { charId: string; value: number }) {
  const { getCharacter } = useScript()
  const c = getCharacter(charId)
  if (!c) return null
  const pct = (Math.abs(value) / 5) * 50
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 shrink-0 text-right text-[0.6875rem] text-paper-dim">{c.name}</span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-ink-950/80">
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-line" />
        <motion.span
          className="absolute inset-y-[3px] rounded-full"
          style={{
            backgroundColor: c.color,
            left: value >= 0 ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            boxShadow: `0 0 8px ${c.color}50`,
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="w-9 shrink-0 font-mono text-[0.6875rem]" style={{ color: valueColor(value) }}>
        {fmtVal(value)}
      </span>
    </div>
  )
}

/* ── 单场行 ── */
function BeatRow({ beat, open, onToggle, delay }: { beat: Beat; open: boolean; onToggle: () => void; delay: number }) {
  const { getScene, getCharacter } = useScript()
  const scene = getScene(beat.sceneId)
  const quote = BEAT_QUOTES[beat.index]
  return (
    <motion.div
      className="border-b border-ink-line/60 last:border-b-0"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-4% 0px' }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        className={cn(
          'flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors duration-150 md:gap-4 md:px-3',
          open ? 'bg-ink-800/60' : 'hover:bg-ink-800/40',
        )}
        onClick={onToggle}
        aria-expanded={open}
      >
        {/* 场号 chip */}
        <span
          className={cn(
            'w-11 shrink-0 rounded-full border px-2 py-0.5 text-center font-mono text-[0.6875rem]',
            beat.key ? 'border-amber/50 text-amber' : 'border-ink-line text-paper-dim',
          )}
        >
          {beatCode(beat.index)}
        </span>
        {/* 标题 + 场景名 */}
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', open ? 'font-bold text-paper' : 'text-paper/90')}>
            {beat.title}
          </span>
          <span className="mono-tick text-cyan/80">
            {scene?.code} {scene?.name}
          </span>
        </span>
        {/* 头像堆叠(-8px 重叠) */}
        <span className="hidden shrink-0 items-center sm:flex" style={{ paddingLeft: 8 }}>
          {beat.characters.slice(0, 5).map((cid) => {
            const c = getCharacter(cid)
            if (!c) return null
            return (
              <img
                key={cid}
                src={c.avatar}
                alt={c.name}
                title={c.name}
                className="-ml-2 h-6 w-6 rounded-full border border-ink-950 object-cover"
              />
            )
          })}
          {beat.characters.length > 5 && (
            <span className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full border border-ink-950 bg-ink-800 font-mono text-[0.5625rem] text-paper-dim">
              +{beat.characters.length - 5}
            </span>
          )}
        </span>
        {/* 迷你 sparkline */}
        <span className="hidden shrink-0 md:block">
          <Sparkline center={beat.index} />
        </span>
        {/* 情绪值 */}
        <span className="w-11 shrink-0 text-right font-mono text-sm" style={{ color: valueColor(beat.emotion) }}>
          {fmtVal(beat.emotion)}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-paper-dim transition-transform duration-300', open && 'rotate-180 text-amber')}
        />
      </button>

      {/* 展开详情 */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
            className="overflow-hidden"
          >
            <motion.div
              className="grid gap-5 bg-ink-950/50 px-4 py-4 md:grid-cols-[1.1fr_1fr] md:px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
            >
              <div>
                <p className="mono-tick mb-2">SCENE SUMMARY</p>
                <p className="text-[0.8125rem] leading-6 text-paper-dim">{beat.summary}</p>
                {quote && (
                  <p className="mt-3 border-l-2 border-amber/50 pl-3 font-serif text-[0.8125rem] italic leading-6 text-paper/90">
                    <Quote className="mr-1.5 inline h-3 w-3 text-amber/60" />
                    {quote.text}
                    <span className="ml-2 font-mono text-[0.6875rem] not-italic text-paper-dim">—— {quote.speaker}</span>
                  </p>
                )}
              </div>
              <div>
                <p className="mono-tick mb-2">CHARACTER EMOTION · 在场人物</p>
                <div className="flex flex-col gap-2">
                  {beat.characters.map((cid) => {
                    const v = getCharacter(cid)?.arc[beat.index - 1]
                    if (v == null) return null
                    return <EmotionBar key={cid} charId={cid} value={v} />
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── 手风琴:42 场按幕分三组(默认展开 ACT I) ── */
export default function BeatAccordion() {
  const { acts: ACTS, beatsOfAct } = useScript()
  const [openActs, setOpenActs] = useState<Set<ActId>>(new Set([1]))
  const [openRows, setOpenRows] = useState<Set<number>>(new Set([9]))

  const toggleAct = (id: ActId) => {
    const next = new Set(openActs)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpenActs(next)
  }
  const toggleRow = (idx: number) => {
    const next = new Set(openRows)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setOpenRows(next)
  }

  return (
    <section className="site-container">
      <PanelCard index="FIG.06 — BEAT DETAIL" accent="#F2EAD8">
        <div className="mt-5">
          <h3 className="font-serif text-lg font-bold text-paper">逐场情绪明细</h3>
          <p className="mono-tick mt-1">42 BEATS · GROUPED BY ACT · CLICK ROW TO EXPAND</p>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {ACTS.map((act) => {
            const beats = beatsOfAct(act.id)
            const open = openActs.has(act.id)
            return (
              <div key={act.id} className="overflow-hidden rounded-xl border border-ink-line bg-ink-950/40">
                {/* 幕组头 */}
                <button
                  className="flex w-full items-center gap-3 bg-ink-900/60 px-4 py-3 text-left transition-colors hover:bg-ink-800/60"
                  onClick={() => toggleAct(act.id)}
                  aria-expanded={open}
                >
                  <span className="font-mono text-[0.6875rem] tracking-[0.14em]" style={{ color: act.color }}>
                    {act.nameEn}
                  </span>
                  <span className="font-serif text-sm font-bold text-paper">{act.name}</span>
                  <span className="mono-tick hidden md:inline">
                    {beatCode(act.range[0])}–{beatCode(act.range[1])} · {beats.length} 场
                  </span>
                  <span className="mono-tick ml-auto hidden max-w-[40%] truncate lg:inline">{act.summary}</span>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-paper-dim transition-transform duration-300', open && 'rotate-180')}
                  />
                </button>
                {/* 幕内容 */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                      className="overflow-hidden"
                    >
                      <div className="px-1 md:px-2">
                        {beats.map((b, i) => (
                          <BeatRow
                            key={b.index}
                            beat={b}
                            open={openRows.has(b.index)}
                            onToggle={() => toggleRow(b.index)}
                            delay={i * 0.03}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        <p className="mono-tick mt-4 text-paper-dim/70">* amber 场号 = 关键节拍;情绪条以人物代表色自 0 轴发散。</p>
      </PanelCard>
    </section>
  )
}
