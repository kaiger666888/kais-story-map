import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { PanelCard } from '@/components/common'
import { cn } from '@/lib/utils'
import { useScript } from '@/context/ScriptDataContext'
import { beatCode, fmtVal, heatColor, useEmotionHelpers } from './shared'
import { BEAT_QUOTES } from './quotes'

interface Tip {
  x: number
  y: number
  sceneId: string
  charId: string
}

export default function Heatmap({ onLocate }: { onLocate: (range: [number, number]) => void }) {
  const { beats: BEATS, characters: CHARACTERS, scenes: SCENES } = useScript()
  const { sceneCharAvg, sceneBeatRange } = useEmotionHelpers()
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, amount: 0.2 })
  const [tip, setTip] = useState<Tip | null>(null)
  const [selectedScene, setSelectedScene] = useState<string | null>(null)

  const enterTip = (e: React.MouseEvent, sceneId: string, charId: string) => {
    const grid = gridRef.current
    if (!grid) return
    const cell = e.currentTarget.getBoundingClientRect()
    const cont = grid.getBoundingClientRect()
    setTip({ x: cell.left - cont.left + cell.width / 2, y: cell.top - cont.top, sceneId, charId })
  }

  const tipScene = tip ? SCENES.find((s) => s.id === tip.sceneId) : undefined
  const tipChar = tip ? CHARACTERS.find((c) => c.id === tip.charId) : undefined
  const tipVal = tip ? sceneCharAvg(tip.sceneId, tip.charId) : null
  const tipBeat = tip ? BEATS.find((b) => b.sceneId === tip.sceneId && b.characters.includes(tip.charId)) : undefined

  return (
    <section className="site-container">
      <PanelCard index="FIG.03 — HEATMAP" accent="#4DD8FF">
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-paper">情绪热力矩阵 · 场景 × 人物</h3>
            <p className="mono-tick mt-1">AVG EMOTION PER SCENE × CHARACTER · 点击行联动主图</p>
          </div>
          {/* 色阶图例 */}
          <div className="w-56">
            <div
              className="h-2 w-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #4DD8FF, #16161F 50%, #FF4D6D)' }}
            />
            <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] text-paper-dim">
              <span>-5</span>
              <span>0</span>
              <span>+5</span>
            </div>
          </div>
        </div>

        <div ref={wrapRef} className="mt-4 overflow-x-auto pb-1">
          <div ref={gridRef} className="relative min-w-[780px]">
            {/* 列首:人物头像 */}
            <div className="grid grid-cols-[minmax(104px,140px)_repeat(8,1fr)] items-end gap-1 pb-2">
              <span className="mono-tick pb-1">SCENE ↓</span>
              {CHARACTERS.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <img src={c.avatar} alt={c.name} className="h-6 w-6 rounded-full border border-ink-line object-cover" />
                  <span className="font-mono text-[0.625rem] text-paper-dim">{c.name}</span>
                </div>
              ))}
            </div>

            {/* 行:12 场景 */}
            {SCENES.map((s, ri) => {
              const selected = selectedScene === s.id
              return (
                <motion.div
                  key={s.id}
                  className={cn(
                    'relative grid cursor-pointer grid-cols-[minmax(104px,140px)_repeat(8,1fr)] items-center gap-1 rounded-lg py-1 pr-1 transition-colors duration-200',
                    selected ? 'bg-amber/[0.07]' : 'hover:bg-ink-800/50',
                  )}
                  initial={{ x: -24, opacity: 0 }}
                  animate={inView ? { x: 0, opacity: 1 } : undefined}
                  transition={{ delay: ri * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => {
                    setSelectedScene(s.id)
                    onLocate(sceneBeatRange(s.id))
                  }}
                >
                  {selected && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-amber" />}
                  {/* 行首场景 chip */}
                  <div className="flex items-center gap-2 pl-2">
                    <span className="rounded-full border border-cyan/40 bg-ink-950 px-2 py-0.5 font-mono text-[0.6875rem] text-cyan">
                      {s.code}
                    </span>
                    <span className="truncate text-xs text-paper-dim">{s.name}</span>
                  </div>
                  {/* 色格 */}
                  {CHARACTERS.map((c, ci) => {
                    const v = sceneCharAvg(s.id, c.id)
                    return (
                      <motion.button
                        key={c.id}
                        className={cn(
                          'flex h-9 items-center justify-center rounded-md font-mono text-[0.6875rem]',
                          v == null && 'border border-dashed border-ink-line/80 bg-transparent',
                        )}
                        style={v != null ? { backgroundColor: heatColor(v), color: Math.abs(v) > 2.6 ? '#08080D' : '#F2EAD8' } : undefined}
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 1 } : undefined}
                        transition={{ delay: ri * 0.06 + ci * 0.012 + 0.2, duration: 0.35 }}
                        whileHover={{ scale: 1.1, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                        whileTap={{ scale: 0.98 }}
                        onMouseEnter={(e) => v != null && enterTip(e, s.id, c.id)}
                        onMouseLeave={() => setTip(null)}
                        aria-label={v != null ? `${s.name} × ${c.name}:${fmtVal(v)}` : `${s.name} × ${c.name}:未出场`}
                      >
                        {v != null ? fmtVal(v) : ''}
                      </motion.button>
                    )
                  })}
                </motion.div>
              )
            })}

            {/* 格 tooltip */}
            {tip && tipScene && tipChar && tipVal != null && (
              <div
                className="pointer-events-none absolute z-20 w-56 rounded-xl border border-ink-line bg-ink-950/95 p-3 shadow-xl backdrop-blur-sm"
                style={{ left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)' }}
              >
                <div className="flex items-center justify-between font-mono text-[0.6875rem]">
                  <span className="text-cyan">
                    {tipScene.code} {tipScene.name}
                  </span>
                  <span style={{ color: tipChar.color }}>{tipChar.name}</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="mono-tick">平均情绪</span>
                  <span className="font-mono text-sm" style={{ color: tipVal > 0 ? '#FF8FA3' : tipVal < 0 ? '#4DD8FF' : '#9A937F' }}>
                    {fmtVal(tipVal)}
                  </span>
                </div>
                {tipBeat && BEAT_QUOTES[tipBeat.index] && (
                  <p className="mt-2 line-clamp-2 border-l-2 border-amber/40 pl-2 font-serif text-[0.6875rem] italic leading-4 text-paper/85">
                    「{BEAT_QUOTES[tipBeat.index].text}」
                  </p>
                )}
                <p className="mono-tick mt-1.5 text-paper-dim/60">{beatCode(tipBeat?.index ?? 0)} 等场次</p>
              </div>
            )}
          </div>
        </div>

        <p className="mono-tick mt-3 text-paper-dim/70">
          * 虚线透明格 = 该人物此场景未出场;hover 格放大并显示关键句;点击行在主图定位该场景覆盖场次。
        </p>
      </PanelCard>
    </section>
  )
}
