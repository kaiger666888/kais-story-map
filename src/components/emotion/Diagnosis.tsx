import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { PanelCard } from '@/components/common'

type Status = 'pass' | 'note' | 'warn'

interface DiagItem {
  status: Status
  icon: LucideIcon
  title: string
  desc: string
  tag: string
  range: [number, number]
}

const STATUS_META: Record<Status, { color: string; label: string; pulse: number | null }> = {
  pass: { color: '#7BE0A3', label: '通过', pulse: null },
  note: { color: '#FFB347', label: '注意', pulse: 2 },
  warn: { color: '#FF4D6D', label: '警告', pulse: 1.2 },
}

const ITEMS: DiagItem[] = [
  {
    status: 'pass',
    icon: CheckCircle,
    title: '高潮位置健康',
    desc: '最高点落在 S34(全场 81% 处),符合高潮后置。',
    tag: 'S34',
    range: [34, 34],
  },
  {
    status: 'note',
    icon: AlertTriangle,
    title: 'ACT II 中段偏平',
    desc: 'S18–S24 情绪振幅仅 1.1,连续 7 场无冲突升级。',
    tag: 'S18–S24',
    range: [18, 24],
  },
  {
    status: 'warn',
    icon: TrendingUp,
    title: '谷值后恢复过快',
    desc: 'S30 老鬼之死(-4.2)后 2 场内回到 +1,哀悼被压缩。',
    tag: 'S30–S32',
    range: [30, 32],
  },
  {
    status: 'pass',
    icon: CheckCircle,
    title: '开场钩子',
    desc: 'S01 即以 -1.8 悬疑开局,前 3 场完成人物登场。',
    tag: 'S01–S03',
    range: [1, 3],
  },
]

export default function Diagnosis({ onLocate }: { onLocate: (range: [number, number]) => void }) {
  return (
    <PanelCard index="FIG.05 — DIAGNOSIS" accent="#7BE0A3" className="h-full">
      <div className="mt-5">
        <h3 className="font-serif text-lg font-bold text-paper">节奏诊断</h3>
        <p className="mono-tick mt-1">RHYTHM DIAGNOSIS · 4 CHECKS</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {ITEMS.map((item, i) => {
          const meta = STATUS_META[item.status]
          const Icon = item.icon
          return (
            <motion.button
              key={item.title}
              className="group flex w-full items-start gap-3 rounded-xl border border-ink-line bg-ink-950/60 p-4 text-left transition-colors duration-200 hover:border-paper-dim/30 hover:bg-ink-800/60"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onLocate(item.range)}
            >
              {/* 状态点(rose 快 pulse 1.2s / amber 慢 2s) */}
              <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                {meta.pulse && (
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                    animate={{ scale: [1, 2.1], opacity: [0.6, 0] }}
                    transition={{ duration: meta.pulse, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span
                  className="relative inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}80` }}
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
                  <span className="text-sm font-bold text-paper">{item.title}</span>
                  <span className="mono-tick" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                </span>
                <span className="mt-1.5 block text-[0.8125rem] leading-6 text-paper-dim">{item.desc}</span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="rounded-full border border-ink-line bg-ink-900 px-2 py-0.5 font-mono text-[0.6875rem] text-paper-dim transition-colors duration-200 group-hover:border-amber/50 group-hover:text-amber">
                  {item.tag}
                </span>
                <span className="font-mono text-[0.625rem] text-paper-dim/0 transition-all duration-200 group-hover:text-paper-dim/70">
                  在主图查看 →
                </span>
              </span>
            </motion.button>
          )
        })}
      </div>

      <p className="mono-tick mt-4 text-paper-dim/70">* 点击条目平滑滚动回主图,并高亮对应场区间。</p>
    </PanelCard>
  )
}
