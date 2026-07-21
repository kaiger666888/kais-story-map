import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { NodeKind } from '@/data/nightferry'
import { NODE_COLORS } from '@/data/nightferry'

/* ──────────────────────────── NodeChip ──────────────────────────── */

export function NodeChip({
  kind,
  label,
  className,
}: {
  kind: NodeKind
  label: string
  className?: string
}) {
  const color = NODE_COLORS[kind]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-ink-line bg-ink-900 px-3 py-1',
        'font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-paper-dim',
        'transition-all duration-200 hover:-translate-y-0.5 hover:text-paper',
        className,
      )}
      style={{ ['--chip-color' as string]: color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
      {label}
    </span>
  )
}

/* ──────────────────────────── LayerBadge ──────────────────────────── */

export type LayerId = 'skin' | 'bone' | 'flesh' | 'nerve'

export const LAYER_META: Record<LayerId, { zh: string; en: string; color: string }> = {
  skin: { zh: '皮', en: 'SKIN', color: '#F2EAD8' },
  bone: { zh: '骨', en: 'BONE', color: '#FFB347' },
  flesh: { zh: '肉', en: 'FLESH', color: '#FF4D6D' },
  nerve: { zh: '神经', en: 'NERVE', color: '#4DD8FF' },
}

export function LayerBadge({ layer, className }: { layer: LayerId; className?: string }) {
  const meta = LAYER_META[layer]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]',
        className,
      )}
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.zh} · {meta.en}
    </span>
  )
}

/* ──────────────────────────── PanelCard ──────────────────────────── */

export function PanelCard({
  index,
  accent = '#FFB347',
  className,
  children,
}: {
  /** 左上角 mono 编号,如 FIG.01 */
  index?: string
  /** hover 边框层色 */
  accent?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-ink-line bg-ink-900 p-6 transition-all duration-300',
        className,
      )}
      style={{ ['--panel-accent' as string]: accent }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}66`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = ''
      }}
    >
      {index && (
        <span className="absolute left-5 top-4 font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim/70">
          {index}
        </span>
      )}
      {children}
    </div>
  )
}

/* ──────────────────────────── SectionHeader ──────────────────────────── */

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: {
  /** mono 眉题,如 CHAPTER 02 — EMOTION */
  eyebrow: string
  title: ReactNode
  description?: string
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className={cn('mono-label flex items-center gap-3', align === 'center' && 'justify-center')}>
        <span className="inline-block h-px w-6 bg-amber" />
        {eyebrow}
      </p>
      <h2 className="mt-4 font-serif text-[clamp(1.8rem,3.4vw,2.8rem)] font-bold leading-[1.15] text-paper">
        {title}
      </h2>
      {description && <p className="mt-4 leading-7 text-paper-dim">{description}</p>}
    </div>
  )
}
