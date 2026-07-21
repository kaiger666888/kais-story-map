/**
 * Agent 协作台 — /agent
 * 「图谱即接口」:4 类 Agent 读取拓扑、提出设计、写回节点与边,最终反向生成剧本。
 * 开发者控制台 × 实验室氛围,cyan 为主色。全部交互为演示模式(模拟运行)。
 */
import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Crosshair,
  Feather,
  FileDown,
  FileOutput,
  Flame,
  Ghost,
  GitBranch,
  HeartHandshake,
  History,
  Loader2,
  Map,
  PenLine,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  VenetianMask,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Slider } from '@/components/ui/slider'
import { NodeChip, SectionHeader } from '@/components/common'
import { CHARACTERS, RELATIONSHIPS, getBeat, getCharacter, getScene } from '@/data/nightferry'
import { cn } from '@/lib/utils'

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

/* ──────────────────────────── 共享类型 ──────────────────────────── */

interface DiffLine {
  op: '+' | '~'
  text: string
}

type AgentSource = 'Agent·人物' | 'Agent·道具' | 'Agent·场景' | 'Agent·情绪' | '人类'

interface ChangeEntry {
  version: number
  source: AgentSource
  summary: string
  time: string
  diff: DiffLine[]
}

const SOURCE_COLOR: Record<AgentSource, string> = {
  'Agent·人物': '#FFB347',
  'Agent·道具': '#A78BFA',
  'Agent·场景': '#4DD8FF',
  'Agent·情绪': '#FF4D6D',
  人类: '#F2EAD8',
}

/* ──────────────────────────── S1 · 页首 ──────────────────────────── */

const H1_CHARS = [
  { ch: 'A', cls: 'font-display italic' },
  { ch: 'g', cls: 'font-display italic' },
  { ch: 'e', cls: 'font-display italic' },
  { ch: 'n', cls: 'font-display italic' },
  { ch: 't', cls: 'font-display italic' },
  { ch: ' ', cls: '' },
  { ch: '协', cls: 'font-serif' },
  { ch: '作', cls: 'font-serif' },
  { ch: '台', cls: 'font-serif' },
]

function HeroSection({ version, pending }: { version: number; pending: number }) {
  const [typed, setTyped] = useState([0, 0, 0])
  const [allDone, setAllDone] = useState(false)

  // 状态面板:逐行 typewriter(仅首次挂载;完成后文本跟随实时版本号)
  useEffect(() => {
    const base = ['AGENTS ONLINE 4/4', 'GRAPH v12 · 未提交改动 3', 'LAST SYNC 00:02:41']
    let li = 0
    let ci = 0
    let timer = 0
    const tick = () => {
      if (li >= base.length) {
        setAllDone(true)
        return
      }
      ci += 1
      const line = li
      const count = ci
      setTyped((prev) => {
        const n = [...prev]
        n[line] = count
        return n
      })
      if (ci >= base[li].length) {
        li += 1
        ci = 0
        timer = window.setTimeout(tick, 200)
      } else {
        timer = window.setTimeout(tick, 26)
      }
    }
    timer = window.setTimeout(tick, 500)
    return () => window.clearTimeout(timer)
  }, [])

  const statusLines = [
    { icon: Bot, text: 'AGENTS ONLINE 4/4', dot: true },
    { icon: GitBranch, text: `GRAPH v${version} · 未提交改动 ${pending}`, dot: false },
    { icon: Activity, text: 'LAST SYNC 00:02:41', dot: false },
  ]

  return (
    <section className="relative overflow-hidden">
      {/* 神经层聚光 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 72% 18%, rgba(77,216,255,0.09), transparent 55%)' }}
        aria-hidden
      />
      <div className="site-container flex flex-col gap-10 py-16 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mono-label flex items-center gap-3">
            <span className="inline-block h-px w-6 bg-cyan" />
            ROOM.04 — AGENTS
          </p>
          <h1 className="mt-5 text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.02em] text-paper">
            {H1_CHARS.map((c, i) => (
              <motion.span
                key={i}
                className={cn('inline-block', c.cls)}
                initial={{ y: 26, opacity: 0, rotate: 2 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.06 + i * 0.05, duration: 0.7, ease: EASE_OUT }}
              >
                {c.ch === ' ' ? ' ' : c.ch}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="mt-5 max-w-xl leading-7 text-paper-dim"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6, ease: EASE_OUT }}
          >
            图谱即接口:4 类 Agent 读取拓扑、提出设计、写回节点与边,最终重新生成剧本。
            人与 AI 面对的是同一张图、同一份 Schema、同一条版本史。
          </motion.p>
        </div>

        {/* 系统状态面板 */}
        <motion.div
          className="w-full shrink-0 rounded-2xl border border-ink-line bg-ink-900 p-5 lg:w-[340px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6, ease: EASE_OUT }}
        >
          <p className="mono-tick mb-4 flex items-center gap-2 text-paper-dim/80">
            <Terminal className="h-3.5 w-3.5 text-cyan" />
            SYSTEM STATUS
          </p>
          <div className="space-y-3 font-mono text-xs">
            {statusLines.map((l, i) => (
              <div key={l.text.slice(0, 8)} className="flex items-center gap-2.5 text-paper">
                {l.dot ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                  </span>
                ) : (
                  <l.icon className="h-3.5 w-3.5 text-cyan/80" />
                )}
                <span className="tracking-[0.06em]">
                  {allDone ? l.text : l.text.slice(0, typed[i])}
                  {!allDone && typed[i] > 0 && typed[i] < l.text.length && (
                    <span className="ml-0.5 inline-block h-3 w-1.5 animate-caret-blink bg-cyan align-[-2px]" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ──────────────────────────── S2 · 拓扑 Schema ──────────────────────────── */

type TokC = 'key' | 'str' | 'num' | 'punc'

interface Tok {
  t: string
  c: TokC
}

interface CodeLine {
  toks: Tok[]
  /** 关联人物 id(relations 行,用于 hover 联动 tooltip) */
  rel?: string
}

const TOK_COLOR: Record<TokC, string> = {
  key: '#4DD8FF',
  str: '#FFB347',
  num: '#FF8FA3',
  punc: '#9A937F',
}

const p = (t: string): Tok => ({ t, c: 'punc' })
const k = (t: string): Tok => ({ t, c: 'key' })
const s = (t: string): Tok => ({ t, c: 'str' })
const n = (t: string): Tok => ({ t, c: 'num' })

const SCHEMA_LINES: CodeLine[] = [
  { toks: [p('{')] },
  { toks: [p('  '), k('"id"'), p(': '), s('"CHAR.01"'), p(',')] },
  { toks: [p('  '), k('"type"'), p(': '), s('"character"'), p(',')] },
  { toks: [p('  '), k('"name"'), p(': '), s('"林晚"'), p(',')] },
  { toks: [p('  '), k('"aliases"'), p(': ['), s('"林晚"'), p(', '), s('"LIN WAN"'), p(', '), s('"记者"'), p('],')] },
  { toks: [p('  '), k('"arc"'), p(': '), s('"真相 → 执念 → 代价 → 见证"'), p(',')] },
  { toks: [p('  '), k('"desires"'), p(': ['), s('"查清姐姐失踪真相"'), p(', '), s('"活着写成报道"'), p('],')] },
  { toks: [p('  '), k('"fears"'), p(': ['), s('"成为第二个消失的人"'), p(', '), s('"线人因自己而死"'), p('],')] },
  { toks: [p('  '), k('"relations"'), p(': [')] },
  {
    rel: 'jiangli',
    toks: [p('    { '), k('"target"'), p(': '), s('"CHAR.02"'), p(', '), k('"kind"'), p(': '), s('"追查与隐瞒"'), p(', '), k('"sentiment"'), p(': '), n('-2'), p(' },')],
  },
  {
    rel: 'suqiao',
    toks: [p('    { '), k('"target"'), p(': '), s('"CHAR.04"'), p(', '), k('"kind"'), p(': '), s('"医患同盟"'), p(', '), k('"sentiment"'), p(': '), n('3'), p(' },')],
  },
  {
    rel: 'hanchong',
    toks: [p('    { '), k('"target"'), p(': '), s('"CHAR.08"'), p(', '), k('"kind"'), p(': '), s('"猎手与猎物"'), p(', '), k('"sentiment"'), p(': '), n('-4'), p(' }')],
  },
  { toks: [p('  ],')] },
  { toks: [p('  '), k('"appearances"'), p(': ['), s('"S01"'), p(', '), s('"S02"'), p(', '), s('"S03"'), p(', '), s('"S05"'), p(', '), s('"S09"'), p(', '), s('"S11"'), p('],')] },
  { toks: [p('  '), k('"emotion_baseline"'), p(': '), n('-1.5')] },
  { toks: [p('}')] },
]

const JSON_RAW = `{
  "id": "CHAR.01",
  "type": "character",
  "name": "林晚",
  "aliases": ["林晚", "LIN WAN", "记者"],
  "arc": "真相 → 执念 → 代价 → 见证",
  "desires": ["查清姐姐失踪真相", "活着写成报道"],
  "fears": ["成为第二个消失的人", "线人因自己而死"],
  "relations": [
    { "target": "CHAR.02", "kind": "追查与隐瞒", "sentiment": -2 },
    { "target": "CHAR.04", "kind": "医患同盟", "sentiment": 3 },
    { "target": "CHAR.08", "kind": "猎手与猎物", "sentiment": -4 }
  ],
  "appearances": ["S01", "S02", "S03", "S05", "S09", "S11"],
  "emotion_baseline": -1.5
}`

const SCHEMA_POINTS = [
  { icon: Crosshair, title: '可寻址', desc: '每个要素拥有稳定 ID(CHAR.01 / SCENE.04),Agent 可以精确引用任何一个节点或边。' },
  { icon: History, title: '可追溯', desc: '每次修改都记录 diff 与来源——谁改的、改了什么、在哪一版,全部留痕。' },
  { icon: FileOutput, title: '可回写', desc: '设计变更可反向导出为剧本段落,图谱与正文永远双向同步。' },
]

function SchemaCodePanel() {
  const [copied, setCopied] = useState(false)
  const [hoverRel, setHoverRel] = useState<number | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON_RAW)
    } catch {
      /* 剪贴板不可用时静默 */
    }
    setCopied(true)
    toast.success('已复制 Schema')
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-ink-line bg-ink-900"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
    >
      {/* 仿终端栏 */}
      <div className="flex items-center justify-between border-b border-ink-line bg-ink-950/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green/70" />
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-paper-dim">
            <Terminal className="h-3 w-3 text-cyan/70" />
            node.char.01.json
          </span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md border border-ink-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-paper-dim transition-colors hover:border-cyan/50 hover:text-cyan"
        >
          {copied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      {/* 代码体:进入视口逐行 reveal */}
      <motion.div
        className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      >
        {SCHEMA_LINES.map((line, i) => {
          const relEdge = line.rel
            ? RELATIONSHIPS.find((r) => r.source === 'linwan' && r.target === line.rel)
            : undefined
          const relChar = line.rel ? getCharacter(line.rel) : undefined
          return (
            <motion.div
              key={i}
              className={cn('relative flex whitespace-pre rounded', line.rel && 'cursor-pointer')}
              style={hoverRel === i ? { backgroundColor: 'rgba(255,179,71,0.08)' } : undefined}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              onMouseEnter={() => line.rel && setHoverRel(i)}
              onMouseLeave={() => line.rel && setHoverRel(null)}
            >
              <span className="w-8 shrink-0 select-none pr-4 text-right text-paper-dim/40">{i + 1}</span>
              <span>
                {line.toks.map((tok, j) => (
                  <span key={j} style={{ color: TOK_COLOR[tok.c] }}>
                    {tok.t}
                  </span>
                ))}
              </span>
              {/* hover 联动 tooltip:关系说明 */}
              <AnimatePresence>
                {hoverRel === i && relEdge && relChar && (
                  <motion.span
                    className="absolute left-16 top-0 z-20 -translate-y-full rounded-lg border border-amber/40 bg-ink-950 px-3 py-1.5 text-[11px] text-paper shadow-glow-amber"
                    initial={{ opacity: 0, y: 6, scale: 0.94 }}
                    animate={{ opacity: 1, y: -6, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    <span className="text-amber">{relChar.name}</span>
                    <span className="text-paper-dim"> — {relEdge.label} · sentiment </span>
                    <span className={relEdge.sentiment < 0 ? 'text-rose-soft' : 'text-green'}>
                      {relEdge.sentiment > 0 ? `+${relEdge.sentiment}` : relEdge.sentiment}
                    </span>
                    <span className="text-paper-dim"> · since 场{String(relEdge.sinceBeat).padStart(2, '0')}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

function SchemaSection() {
  return (
    <section className="site-container py-16 lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="SCHEMA — 可读性证明"
            title="每个节点,都是一份严格 Schema 的 JSON"
            description="图谱中的每个节点与边,Agent 与人类看到完全相同的世界。机器可读,人也可读——这是一切协作的前提。"
          />
          <div className="mt-6 flex flex-wrap gap-2.5">
            <NodeChip kind="character" label="CHARACTER · CHAR.01" />
            <NodeChip kind="scene" label="SCENE · SCENE.04" />
            <NodeChip kind="prop" label="PROP · PROP.07" />
            <NodeChip kind="emotion" label="EMOTION · EMO.-5..+5" />
          </div>
          <ul className="mt-8 space-y-5">
            {SCHEMA_POINTS.map((pt) => (
              <motion.li
                key={pt.title}
                className="flex gap-4"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10">
                  <pt.icon className="h-4 w-4 text-cyan" />
                </span>
                <div>
                  <p className="font-bold text-paper">{pt.title}</p>
                  <p className="mt-1 text-sm leading-6 text-paper-dim">{pt.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
        <SchemaCodePanel />
      </div>
    </section>
  )
}

/* ──────────────────────────── S3 · Agent 流水线 ──────────────────────────── */

interface StationDef {
  id: string
  no: string
  name: string
  codename: string
  color: string
  icon: LucideIcon
  duty: string
  input: string
  output: string
  source: AgentSource
  logs: (v: number) => string[]
  diff: DiffLine[]
  summary: string
}

const STATIONS: StationDef[] = [
  {
    id: 'character',
    no: 'STATION.01',
    name: '人物 Agent',
    codename: 'CHARACTER SMITH',
    color: '#FFB347',
    icon: User,
    duty: '锻造人物卡:欲望、恐惧与弧光。',
    input: '主题与原型',
    output: '人物卡节点(欲望 / 恐惧 / 弧光)',
    source: 'Agent·人物',
    logs: (v) => [
      `> 读取图谱 v${v} … 8 人物 / 26 关系`,
      '> 原型矩阵扫描:殉道者 × 探索者',
      '> 发现 CHAR.01 林晚 arc[13..24] 中段挫折偏弱',
      '> 生成 2 条候选设计 …',
      '> 完成 · 等待人工确认',
    ],
    diff: [
      { op: '+', text: 'CHAR.09 「顾潮生」 海事局卧底 · 欲望 7 / 恐惧 4' },
      { op: '~', text: 'CHAR.01 林晚 · arc[13..24] 中段挫折补强' },
    ],
    summary: '人物 Agent 写入「顾潮生」候选人物卡',
  },
  {
    id: 'prop',
    no: 'STATION.02',
    name: '道具 Agent',
    codename: 'PROP WEAVER',
    color: '#A78BFA',
    icon: Boxes,
    duty: '把欲望编织成可流转的物。',
    input: '人物欲望',
    output: '道具节点 + 流转链设计',
    source: 'Agent·道具',
    logs: (v) => [
      `> 读取图谱 v${v} … 6 道具 / 12 流转边`,
      '> 扫描人物欲望向量 ×8 …',
      '> 韩崇.欲望 ⇒ 需要高价值藏匿物',
      '> 设计流转链:密室 → 药箱 → 救生艇',
      '> 完成 · 等待人工确认',
    ],
    diff: [
      { op: '+', text: 'PROP.07 「航海日志残页」 信物 · 重要度 4/5' },
      { op: '~', text: 'PROP.02 货运舱单 · timeline +beat.33' },
    ],
    summary: '道具 Agent 接入「航海日志残页」流转链',
  },
  {
    id: 'scene',
    no: 'STATION.03',
    name: '场景 Agent',
    codename: 'SCENE ARCHITECT',
    color: '#4DD8FF',
    icon: Map,
    duty: '让人物与道具在空间相撞。',
    input: '人物 × 道具',
    output: '场景序列 + 空间关系',
    source: 'Agent·场景',
    logs: (v) => [
      `> 读取图谱 v${v} … 12 场景 / 42 节拍`,
      '> 人物×道具矩阵 8×6 求交 …',
      '> SCENE.03 底舱货仓 密度 0.82 过高',
      '> 建议拆分动线:通道 → 密室前厅',
      '> 完成 · 等待人工确认',
    ],
    diff: [
      { op: '+', text: 'SCENE.13 「底舱通道」 连接 S03 ↔ S09' },
      { op: '~', text: 'SCENE.03 底舱货仓 · mood +「跟踪」' },
    ],
    summary: '场景 Agent 新增「底舱通道」空间节点',
  },
  {
    id: 'emotion',
    no: 'STATION.04',
    name: '情绪 Agent',
    codename: 'EMOTION CONDUCTOR',
    color: '#FF4D6D',
    icon: Activity,
    duty: '指挥全剧情绪的呼吸与峰值。',
    input: '场景序列',
    output: '逐场情绪谱 + 节奏校准',
    source: 'Agent·情绪',
    logs: (v) => [
      `> 读取图谱 v${v} … 42 拍情绪谱`,
      '> 检测谷值区 场28–30 密度 0.91',
      '> 场29 营救后建议 +0.5 喘息拍',
      '> 节奏重排完成',
      '> 完成 · 等待人工确认',
    ],
    diff: [
      { op: '~', text: 'BEAT.29 「阿灿营救」 emotion -1.0 → -0.5' },
      { op: '+', text: 'BEAT.29.annotation 「喘息拍」' },
    ],
    summary: '情绪 Agent 校准场 29 节奏',
  },
]

type StationStatus = 'idle' | 'running' | 'review' | 'accepting'

function StationCard({
  def,
  version,
  isLast,
  openSide,
  onAccept,
}: {
  def: StationDef
  version: number
  isLast: boolean
  openSide: 'left' | 'right'
  onAccept: (def: StationDef) => void
}) {
  const [status, setStatus] = useState<StationStatus>('idle')
  const [runLogs, setRunLogs] = useState<string[]>([])
  const [shown, setShown] = useState(0)

  const run = () => {
    if (status !== 'idle') return
    setRunLogs(def.logs(version))
    setShown(0)
    setStatus('running')
  }

  useEffect(() => {
    if (status !== 'running') return
    if (shown >= runLogs.length) {
      const t = window.setTimeout(() => setStatus('review'), 420)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setShown((x) => x + 1), shown === 0 ? 320 : 175)
    return () => window.clearTimeout(t)
  }, [status, shown, runLogs.length])

  const accept = () => {
    setStatus('accepting')
    window.setTimeout(() => {
      onAccept(def)
      setStatus('idle')
      setShown(0)
      setRunLogs([])
    }, 720)
  }

  const discard = () => {
    setStatus('idle')
    setShown(0)
    setRunLogs([])
  }

  const busy = status !== 'idle'

  return (
    <motion.div
      className="relative rounded-2xl border border-ink-line bg-ink-900 p-5 transition-colors duration-300"
      variants={{
        hidden: { opacity: 0, y: 28 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
      }}
      style={{ borderColor: busy ? `${def.color}55` : undefined }}
    >
      {/* 虚线箭头 + 流动光点(数据流转) */}
      {!isLast && (
        <div className="absolute -right-10 top-1/2 hidden w-10 -translate-y-1/2 lg:block" aria-hidden>
          <div className="border-t border-dashed border-ink-line" />
          <motion.span
            className="absolute -top-[3px] left-0 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#4DD8FF', boxShadow: '0 0 8px #4DD8FF' }}
            animate={{ x: [0, 34], opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      <div className="flex items-start justify-between">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{ color: def.color, borderColor: `${def.color}55`, backgroundColor: `${def.color}14` }}
        >
          <def.icon className="h-5 w-5" />
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-paper-dim/70">{def.no}</span>
      </div>

      <h3 className="mt-4 font-serif text-lg font-bold text-paper">{def.name}</h3>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: def.color }}>
        {def.codename}
      </p>
      <p className="mt-2 text-xs leading-5 text-paper-dim">{def.duty}</p>

      <div className="mt-3 space-y-1 font-mono text-[10.5px] leading-5">
        <p className="text-paper-dim/80">
          <span className="text-paper-dim/50">IN&nbsp;&nbsp;</span>
          {def.input}
        </p>
        <p className="text-paper-dim/80">
          <span style={{ color: def.color }}>OUT&nbsp;</span>
          {def.output}
        </p>
      </div>

      {/* 运行按钮 */}
      {status === 'idle' && (
        <button
          onClick={run}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2 font-mono text-xs uppercase tracking-[0.14em] transition-all duration-200 hover:-translate-y-0.5"
          style={{ color: def.color, borderColor: `${def.color}66` }}
        >
          <Play className="h-3.5 w-3.5" />
          运行
        </button>
      )}
      {status === 'running' && (
        <button
          disabled
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2 font-mono text-xs uppercase tracking-[0.14em] opacity-80"
          style={{ color: def.color, borderColor: `${def.color}44` }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          运行中
        </button>
      )}

      {/* 实时日志窗 */}
      <AnimatePresence>
        {busy && runLogs.length > 0 && (
          <motion.div
            className="mt-4 overflow-hidden rounded-lg border border-ink-line bg-ink-950"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <div className="flex items-center justify-between border-b border-ink-line px-3 py-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper-dim/70">
                {def.codename} · LOG
              </span>
              <span
                className={cn('h-1.5 w-1.5 rounded-full', status === 'running' ? 'animate-pulse-soft' : '')}
                style={{ backgroundColor: status === 'running' ? '#FFB347' : '#7BE0A3' }}
              />
            </div>
            <div className="space-y-1 px-3 py-2.5 font-mono text-[10.5px] leading-4">
              {runLogs.slice(0, shown).map((line, i) => (
                <motion.p
                  key={i}
                  className="text-paper-dim"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span style={{ color: def.color }}>&gt; </span>
                  {line.slice(2)}
                </motion.p>
              ))}
              {status === 'running' && <span className="inline-block h-3 w-1.5 animate-caret-blink" style={{ backgroundColor: def.color }} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 产出预览:diff 弹出 */}
      <AnimatePresence>
        {(status === 'review' || status === 'accepting') && (
          <motion.div
            className={cn(
              'z-30 mt-3 rounded-xl border border-ink-line bg-ink-950 shadow-2xl',
              openSide === 'right'
                ? 'lg:absolute lg:left-[calc(100%+14px)] lg:top-0 lg:mt-0 lg:w-[330px]'
                : 'lg:absolute lg:right-[calc(100%+14px)] lg:top-0 lg:mt-0 lg:w-[330px]',
            )}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="flex items-center justify-between border-b border-ink-line px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-dim">
                产出预览 — DIFF
              </span>
              <GitBranch className="h-3.5 w-3.5 text-cyan/70" />
            </div>
            <div className="space-y-1.5 px-4 py-3">
              {def.diff.map((d, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-2 rounded px-1.5 py-1 font-mono text-[11px] leading-5"
                  animate={
                    status === 'accepting' && d.op === '+'
                      ? { backgroundColor: ['rgba(123,224,163,0)', 'rgba(123,224,163,0.22)', 'rgba(123,224,163,0)'] }
                      : {}
                  }
                  transition={{ duration: 0.7 }}
                >
                  <span className={d.op === '+' ? 'font-bold text-green' : 'font-bold text-amber'}>{d.op}</span>
                  <span className="text-paper/90">{d.text}</span>
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-ink-line px-4 py-3">
              <button
                onClick={accept}
                disabled={status === 'accepting'}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-green/50 py-1.5 font-mono text-[11px] text-green transition-colors hover:bg-green/10 disabled:opacity-60"
              >
                {status === 'accepting' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                接受写入图谱
              </button>
              <button
                onClick={discard}
                disabled={status === 'accepting'}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 font-mono text-[11px] text-paper-dim transition-colors hover:border-rose/50 hover:text-rose disabled:opacity-60"
              >
                <X className="h-3 w-3" />
                丢弃
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PipelineSection({ version, onAccept }: { version: number; onAccept: (def: StationDef) => void }) {
  return (
    <section className="site-container py-16 lg:py-24">
      <SectionHeader
        eyebrow="PIPELINE — 设计一部戏的四个工位"
        title="四个工位,一条流水线"
        description="点击任意工位运行:Agent 读取当前图谱、给出候选设计,以 diff 形式提交——由你决定是否写回。"
      />
      <motion.div
        className="relative mt-12 rounded-2xl border border-ink-line bg-ink-950/60 p-6 lg:p-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
      >
        <span className="absolute left-7 top-4 font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim/70">
          PIPELINE.RUNNER
        </span>
        <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {STATIONS.map((def, i) => (
            <StationCard
              key={def.id}
              def={def}
              version={version}
              isLast={i === STATIONS.length - 1}
              openSide={i < 2 ? 'right' : 'left'}
              onAccept={onAccept}
            />
          ))}
        </div>
      </motion.div>
    </section>
  )
}

/* ──────────────────────────── S4 · 设计控制台:新建一个人物 ──────────────────────────── */

const ARCHETYPES: { id: string; name: string; icon: LucideIcon; desc: string }[] = [
  { id: 'explorer', name: '探索者', icon: Compass, desc: '被未知吸引,愿为真相付出代价' },
  { id: 'rebel', name: '反叛者', icon: Flame, desc: '向既定秩序开战,哪怕烧到自己' },
  { id: 'guardian', name: '守护者', icon: ShieldCheck, desc: '守住一个人或一个承诺,到底' },
  { id: 'trickster', name: '骗徒', icon: VenetianMask, desc: '用谎言撬动局面,也被谎言反噬' },
  { id: 'martyr', name: '殉道者', icon: HeartHandshake, desc: '把信念放在性命之前' },
  { id: 'outsider', name: '局外人', icon: Ghost, desc: '不属于任何阵营,所以看得最清' },
]

const REL_TYPES = ['亲情', '对立', '隐瞒', '同盟'] as const
type RelType = (typeof REL_TYPES)[number]

const REL_TYPE_COLOR: Record<RelType, string> = {
  亲情: '#7BE0A3',
  对立: '#FF4D6D',
  隐瞒: '#A78BFA',
  同盟: '#4DD8FF',
}

export interface CharPayload {
  name: string
  archetype: string
  desire: number
  fear: number
  goal: string
  relations: { charId: string; type: RelType }[]
}

const CONFETTI_COLORS = ['#FFB347', '#4DD8FF', '#FF4D6D', '#A78BFA', '#7BE0A3']

function ConfettiBurst({ trigger }: { trigger: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5
        const d = 64 + Math.random() * 56
        return {
          x: Math.cos(a) * d,
          y: Math.sin(a) * d - 24,
          c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          r: Math.random() * 320 - 160,
        }
      }),
    [trigger],
  )
  if (trigger === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden>
      {parts.map((pt, i) => (
        <motion.span
          key={`${trigger}-${i}`}
          className="absolute h-2 w-2 rounded-[3px]"
          style={{ backgroundColor: pt.c, boxShadow: `0 0 6px ${pt.c}90` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.5, rotate: 0 }}
          animate={{ x: pt.x, y: [0, pt.y, pt.y + 72], opacity: [1, 1, 0], scale: [0.6, 1, 0.7], rotate: pt.r }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

function MiniRadar({ desire, fear, rels }: { desire: number; fear: number; rels: number }) {
  const size = 156
  const c = size / 2
  const R = 52
  const axes = [
    { label: '欲望', v: desire / 10, angle: -90 },
    { label: '恐惧', v: fear / 10, angle: 30 },
    { label: '关系', v: Math.min(1, rels / 6), angle: 150 },
  ]
  const pt = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180
    return { x: c + Math.cos(rad) * r, y: c + Math.sin(rad) * r }
  }
  const ptsStr = (r: (a: (typeof axes)[number]) => number) =>
    axes.map((a) => {
      const q = pt(a.angle, r(a))
      return `${q.x.toFixed(1)},${q.y.toFixed(1)}`
    })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-[156px] w-[156px]">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ptsStr(() => R * f).join(' ')} fill="none" stroke="#26262F" strokeWidth="1" />
      ))}
      {axes.map((a) => {
        const q = pt(a.angle, R)
        return <line key={a.label} x1={c} y1={c} x2={q.x} y2={q.y} stroke="#26262F" strokeWidth="1" />
      })}
      <polygon
        points={ptsStr((a) => Math.max(0.06, a.v) * R).join(' ')}
        fill="rgba(255,179,71,0.16)"
        stroke="#FFB347"
        strokeWidth="1.5"
      />
      {axes.map((a) => {
        const q = pt(a.angle, R + 17)
        return (
          <text
            key={a.label}
            x={q.x}
            y={q.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="#9A937F"
            fontFamily="JetBrains Mono, monospace"
          >
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}

const STEPS = ['原型', '欲望与恐惧', '关系挂接']

function CharacterConsole({ nextId, onGenerate }: { nextId: number; onGenerate: (p: CharPayload) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [archId, setArchId] = useState('')
  const [desire, setDesire] = useState(7)
  const [fear, setFear] = useState(4)
  const [goal, setGoal] = useState('')
  const [rels, setRels] = useState<Record<string, RelType>>({})
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [burst, setBurst] = useState(0)

  const arch = ARCHETYPES.find((a) => a.id === archId)
  const relList = Object.entries(rels)
  const nextCode = `CHAR.${String(nextId).padStart(2, '0')}`
  const canNext = step === 0 ? name.trim().length > 0 && archId !== '' : true

  const toggleChar = (id: string) => {
    setRels((prev) => {
      const n = { ...prev }
      if (n[id]) delete n[id]
      else n[id] = '同盟'
      return n
    })
    setCreatedId(null)
  }

  const generate = () => {
    if (!name.trim() || !arch) return
    const code = nextCode
    onGenerate({
      name: name.trim(),
      archetype: arch.name,
      desire,
      fear,
      goal: goal.trim(),
      relations: relList.map(([charId, type]) => ({ charId, type })),
    })
    setCreatedId(code)
    setBurst((b) => b + 1)
  }

  const reset = () => {
    setName('')
    setArchId('')
    setDesire(7)
    setFear(4)
    setGoal('')
    setRels({})
    setCreatedId(null)
    setStep(0)
  }

  return (
    <section className="site-container py-16 lg:py-24">
      <SectionHeader
        eyebrow="CONSOLE — CHARACTER FORGE"
        title="设计控制台:新建一个人物"
        description="三步定义一个人物节点:原型定骨、欲望与恐惧定肉、关系挂接定神经。右栏实时预览即将诞生的节点。"
      />
      <div className="relative mt-12 grid gap-8 rounded-2xl border border-ink-line bg-ink-900 p-6 lg:grid-cols-[1.15fr_1fr] lg:p-10">
        <span className="absolute left-7 top-4 font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim/70">
          FIG.04 — CHARACTER FORGE
        </span>

        {/* 左:分步表单 */}
        <div className="mt-6">
          {/* 步骤指示器 */}
          <div className="flex flex-wrap items-center gap-y-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={cn('flex items-center gap-2', i < step ? 'cursor-pointer' : 'cursor-default')}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs transition-colors',
                      i === step
                        ? 'border-amber bg-amber/10 text-amber'
                        : i < step
                          ? 'border-green/60 text-green'
                          : 'border-ink-line text-paper-dim/60',
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn('text-sm', i === step ? 'font-bold text-paper' : 'text-paper-dim')}>{label}</span>
                </button>
                {i < STEPS.length - 1 && <span className="mx-4 h-px w-8 bg-ink-line" />}
              </div>
            ))}
          </div>

          {/* 步骤内容 */}
          <div className="relative mt-8 min-h-[320px]">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                >
                  <label className="mono-tick block">人物名称</label>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setCreatedId(null)
                    }}
                    placeholder="例如:顾潮生"
                    maxLength={8}
                    className="mt-2 w-full rounded-lg border border-ink-line bg-ink-800 px-4 py-2.5 text-sm text-paper outline-none transition-colors placeholder:text-paper-dim/50 focus:border-amber/60"
                  />
                  <label className="mono-tick mt-6 block">原型选择(单选)</label>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ARCHETYPES.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setArchId(a.id)
                          setCreatedId(null)
                        }}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-all duration-200',
                          archId === a.id
                            ? '-translate-y-0.5 border-amber bg-amber/10 shadow-glow-amber'
                            : 'border-ink-line bg-ink-800 hover:border-paper-dim/40',
                        )}
                        style={archId === a.id ? { borderWidth: 2 } : undefined}
                      >
                        <a.icon className={cn('h-5 w-5', archId === a.id ? 'text-amber' : 'text-paper-dim')} />
                        <p className={cn('mt-2 text-sm font-bold', archId === a.id ? 'text-paper' : 'text-paper-dim')}>{a.name}</p>
                        <p className="mt-1 text-[11px] leading-4 text-paper-dim/80">{a.desc}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                >
                  <div className="space-y-7">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <label className="mono-tick">欲望强度 DESIRE</label>
                        <span className="font-mono text-sm font-bold text-amber">{desire}</span>
                      </div>
                      <Slider
                        value={[desire]}
                        onValueChange={(v) => {
                          setDesire(v[0])
                          setCreatedId(null)
                        }}
                        min={0}
                        max={10}
                        step={1}
                        className="mt-3 [&_[data-slot=slider-range]]:bg-amber [&_[data-slot=slider-thumb]]:border-amber [&_[data-slot=slider-thumb]]:bg-ink-950 [&_[data-slot=slider-track]]:bg-ink-800"
                      />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <label className="mono-tick">恐惧强度 FEAR</label>
                        <span className="font-mono text-sm font-bold text-rose">{fear}</span>
                      </div>
                      <Slider
                        value={[fear]}
                        onValueChange={(v) => {
                          setFear(v[0])
                          setCreatedId(null)
                        }}
                        min={0}
                        max={10}
                        step={1}
                        className="mt-3 [&_[data-slot=slider-range]]:bg-rose [&_[data-slot=slider-thumb]]:border-rose [&_[data-slot=slider-thumb]]:bg-ink-950 [&_[data-slot=slider-track]]:bg-ink-800"
                      />
                    </div>
                    <div>
                      <label className="mono-tick block">一句话目标</label>
                      <input
                        value={goal}
                        onChange={(e) => {
                          setGoal(e.target.value)
                          setCreatedId(null)
                        }}
                        placeholder="例如:在下一次靠岸前,把名单送下船"
                        maxLength={40}
                        className="mt-2 w-full rounded-lg border border-ink-line bg-ink-800 px-4 py-2.5 text-sm text-paper outline-none transition-colors placeholder:text-paper-dim/50 focus:border-cyan/60"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                >
                  <label className="mono-tick block">与谁有关系(多选,可点选关系类型)</label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {CHARACTERS.map((c) => {
                      const sel = rels[c.id]
                      return (
                        <div key={c.id}>
                          <button
                            onClick={() => toggleChar(c.id)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-all duration-200',
                              sel ? 'border-cyan/60 bg-cyan/10' : 'border-ink-line bg-ink-800 hover:border-paper-dim/40',
                            )}
                          >
                            <img src={c.avatar} alt={c.name} className="h-7 w-7 rounded-full border border-ink-line object-cover" />
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-sm', sel ? 'font-bold text-paper' : 'text-paper-dim')}>{c.name}</span>
                              <span className="block truncate text-[10px] text-paper-dim/70">{c.role}</span>
                            </span>
                            {sel && <Check className="h-3.5 w-3.5 shrink-0 text-cyan" />}
                          </button>
                          {sel && (
                            <motion.div
                              className="mt-1.5 flex gap-1.5 pl-1"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {REL_TYPES.map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setRels((prev) => ({ ...prev, [c.id]: t }))}
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors',
                                    sel === t ? 'border-transparent text-ink-950' : 'border-ink-line text-paper-dim hover:text-paper',
                                  )}
                                  style={sel === t ? { backgroundColor: REL_TYPE_COLOR[t] } : undefined}
                                >
                                  {t}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 底部操作行 */}
          <div className="mt-6 flex items-center justify-between border-t border-ink-line pt-5">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-lg border border-ink-line px-4 py-2 text-sm text-paper-dim transition-colors hover:text-paper disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              上一步
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canNext && setStep((s) => s + 1)}
                disabled={!canNext}
                className="flex items-center gap-1.5 rounded-lg border border-cyan/60 px-4 py-2 text-sm font-bold text-cyan transition-all hover:bg-cyan/10 disabled:opacity-40"
              >
                下一步
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : createdId ? (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-lg border border-ink-line px-4 py-2 text-sm text-paper-dim transition-colors hover:text-paper"
              >
                <RotateCcw className="h-4 w-4" />
                再建一个
              </button>
            ) : (
              <button
                onClick={generate}
                disabled={!name.trim() || !arch}
                className="flex items-center gap-2 rounded-lg bg-amber px-5 py-2.5 text-sm font-bold text-ink-950 transition-all duration-300 hover:shadow-glow-amber disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                生成人物节点
              </button>
            )}
          </div>
        </div>

        {/* 右:实时预览 */}
        <div className="relative mt-6 lg:mt-0">
          <motion.div
            className="relative h-full overflow-hidden rounded-xl border border-ink-line bg-ink-950 p-6"
            animate={createdId ? { scale: [1, 1.04, 1], borderColor: ['#26262F', '#7BE0A3', '#26262F'] } : {}}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <ConfettiBurst trigger={burst} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-dim/70">
                NODE PREVIEW — {createdId ?? nextCode}
              </span>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 font-mono text-[10px]',
                  createdId ? 'border-green/50 text-green' : 'border-ink-line text-paper-dim/70',
                )}
              >
                {createdId ? '已写入图谱' : '草稿'}
              </span>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber/60 bg-amber/10 font-serif text-2xl font-black text-amber">
                {name.trim() ? name.trim()[0] : '?'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-xl font-bold text-paper">{name.trim() || '未命名人物'}</p>
                <p className="mt-1 font-mono text-[11px] text-paper-dim">
                  {arch ? `${arch.name} · 欲望 ${desire} / 恐惧 ${fear}` : '等待原型选择 …'}
                </p>
              </div>
            </div>

            <p className="mt-4 min-h-[24px] text-sm leading-6 text-paper-dim">
              {goal.trim() ? `目标:${goal.trim()}` : '目标:——(在第二步填写一句话目标)'}
            </p>

            <div className="mt-4 flex justify-center">
              <MiniRadar desire={desire} fear={fear} rels={relList.length} />
            </div>

            <div className="mt-4 border-t border-ink-line pt-4">
              <p className="mono-tick mb-2">将新增的边 EDGES +{relList.length}</p>
              {relList.length === 0 ? (
                <p className="text-xs text-paper-dim/60">尚未挂接关系——到第三步选择。</p>
              ) : (
                <ul className="space-y-1.5">
                  {relList.map(([cid, t]) => (
                    <li key={cid} className="flex items-center gap-2 font-mono text-[11px] text-paper/85">
                      <span className="text-green">+</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: REL_TYPE_COLOR[t] }} />
                      {name.trim() || '新人物'} ↔ {getCharacter(cid)?.name ?? cid}
                      <span className="text-paper-dim">「{t}」</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────── S5 · 从图谱到剧本 ──────────────────────────── */

type BlockT = 'scene' | 'action' | 'char' | 'paren' | 'dial'

interface ScriptBlock {
  t: BlockT
  x: string
}

const SCRIPT_BEATS = [
  { beat: 34, sceneId: 'S04' },
  { beat: 30, sceneId: 'S07' },
  { beat: 38, sceneId: 'S11' },
]

const TONES = [
  { id: 'burst', name: '压抑爆发' },
  { id: 'cold', name: '冷静克制' },
  { id: 'elegy', name: '悲悯释然' },
]

const SCRIPTS: Record<number, Record<string, ScriptBlock[]>> = {
  34: {
    burst: [
      { t: 'scene', x: 'S34  甲板·夜·风暴' },
      { t: 'action', x: '浪砸上甲板。林晚攥着录音笔,指节发白。' },
      { t: 'char', x: '江离' },
      { t: 'paren', x: '(背对着她)' },
      { t: 'dial', x: '你要的真相,在底舱躺了十年。' },
      { t: 'char', x: '林晚' },
      { t: 'dial', x: '那你替我姐签了字——还是替你自己?' },
      { t: 'action', x: '又一排浪。沈确被按倒在舷梯下,电台的火花映在每个人脸上。' },
      { t: 'char', x: '江离' },
      { t: 'dial', x: '这一次,我不签字。我作证。' },
    ],
    cold: [
      { t: 'scene', x: 'S34  甲板·夜·风暴' },
      { t: 'action', x: '风把雨横着推过来。两个人隔着三步,谁也没有提高音量。' },
      { t: 'char', x: '江离' },
      { t: 'paren', x: '(平静地)' },
      { t: 'dial', x: '航海日志第七页,我签的名。你想看,我可以背给你听。' },
      { t: 'char', x: '林晚' },
      { t: 'dial', x: '不用背。录音笔替我记得。' },
      { t: 'action', x: '江离点了点头,像卸下一副很旧的锚。' },
    ],
    elegy: [
      { t: 'scene', x: 'S34  甲板·夜·风暴' },
      { t: 'action', x: '风暴在最烈处忽然慢了半拍,像海也听累了。' },
      { t: 'char', x: '林晚' },
      { t: 'paren', x: '(望着舷窗外的黑)' },
      { t: 'dial', x: '我姐最后那晚,也站在你现在的位置吧。' },
      { t: 'char', x: '江离' },
      { t: 'dial', x: '她让我别回头。我回了十年。' },
      { t: 'action', x: '林晚把录音笔收回口袋,没有按下停止键。' },
    ],
  },
  30: {
    burst: [
      { t: 'scene', x: 'S30  轮机室·夜' },
      { t: 'action', x: '轰鸣吞掉了一切,包括老鬼喊出的那半句警告。' },
      { t: 'char', x: '老鬼' },
      { t: 'paren', x: '(把复印件塞进林晚手里)' },
      { t: 'dial', x: '舱单第九栏——记住这个数!' },
      { t: 'action', x: '灯灭了七秒。再亮时,机组还转着,人已经倒了。' },
      { t: 'char', x: '林晚' },
      { t: 'dial', x: '老鬼——!' },
      { t: 'action', x: '轰鸣继续,像什么都没有发生。' },
    ],
    cold: [
      { t: 'scene', x: 'S30  轮机室·夜' },
      { t: 'action', x: '老鬼把手在破布上擦了三遍,才去碰那半张复印件。' },
      { t: 'char', x: '老鬼' },
      { t: 'dial', x: '图纸我烧了。这个,你带走。' },
      { t: 'char', x: '林晚' },
      { t: 'paren', x: '(低声)' },
      { t: 'dial', x: '你跟我一起走。' },
      { t: 'char', x: '老鬼' },
      { t: 'dial', x: '机舱得有人看着。' },
      { t: 'action', x: '他转身回到机组旁,背影和三十年的油污融为一体。' },
    ],
    elegy: [
      { t: 'scene', x: 'S30  轮机室·夜' },
      { t: 'action', x: '机组的轰鸣忽然停了七秒——这条船第一次这么安静。' },
      { t: 'char', x: '阿灿' },
      { t: 'paren', x: '(跪在机组旁)' },
      { t: 'dial', x: '他钥匙还攥在手里。' },
      { t: 'char', x: '林晚' },
      { t: 'dial', x: '他不是没跑。他是留下来,把灯给我们留着。' },
      { t: 'action', x: '红色警示灯一圈一圈转,像有人还在机舱里踱步。' },
    ],
  },
  38: {
    burst: [
      { t: 'scene', x: 'S38  海面·救生艇·夜' },
      { t: 'action', x: '小艇在黑浪里被抛起来,韩崇的刀尖抵着那半本账页。' },
      { t: 'char', x: '韩崇' },
      { t: 'dial', x: '证据换一条艇。很公道。' },
      { t: 'char', x: '林晚' },
      { t: 'paren', x: '(直视他)' },
      { t: 'dial', x: '我的命换证据。也很公道。' },
      { t: 'action', x: '阿灿趁浪的间隙拉开信号弹——红光撕开夜幕。' },
      { t: 'char', x: '阿灿' },
      { t: 'dial', x: '巡逻艇!他们看见了!' },
    ],
    cold: [
      { t: 'scene', x: 'S38  海面·救生艇·夜' },
      { t: 'action', x: '三平方米的小艇上,没有人先眨眼。' },
      { t: 'char', x: '韩崇' },
      { t: 'paren', x: '(把账页举到艇沿外)' },
      { t: 'dial', x: '浪一大,它就归海。' },
      { t: 'char', x: '林晚' },
      { t: 'dial', x: '你舍得,三年前就扔了。' },
      { t: 'action', x: '远处一点白光扫过水面。韩崇的手,第一次抖了。' },
    ],
    elegy: [
      { t: 'scene', x: 'S38  海面·救生艇·夜' },
      { t: 'action', x: '信号弹的余光落下来,把每个人的脸照得很旧。' },
      { t: 'char', x: '白露' },
      { t: 'paren', x: '(虚弱地)' },
      { t: 'dial', x: '账页我抄了两份。一份在药箱夹层。' },
      { t: 'char', x: '苏乔' },
      { t: 'dial', x: '先省点力气。上岸再算账。' },
      { t: 'action', x: '巡逻艇的灯由远及近,像迟到的黎明。' },
    ],
  },
}

const TYPE_DELAY: Record<BlockT, number> = { scene: 55, action: 38, char: 72, paren: 55, dial: 48 }

function ScriptSection() {
  const [beatId, setBeatId] = useState(34)
  const [tone, setTone] = useState('burst')
  const [len, setLen] = useState(10)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'done'>('idle')
  const [blocks, setBlocks] = useState<ScriptBlock[]>([])
  const [pos, setPos] = useState({ b: 0, c: 0 })

  const start = () => {
    const all = SCRIPTS[beatId][tone]
    setBlocks(all.slice(0, Math.min(len, all.length)))
    setPos({ b: 0, c: 0 })
    setPhase('typing')
  }

  useEffect(() => {
    if (phase !== 'typing') return
    if (pos.b >= blocks.length) {
      setPhase('done')
      return
    }
    const block = blocks[pos.b]
    const atEnd = pos.c >= block.x.length
    const t = window.setTimeout(
      () => {
        if (atEnd) setPos({ b: pos.b + 1, c: 0 })
        else setPos({ b: pos.b, c: pos.c + 1 })
      },
      atEnd ? 170 : TYPE_DELAY[block.t],
    )
    return () => window.clearTimeout(t)
  }, [phase, pos, blocks])

  const renderBlock = (bl: ScriptBlock, text: string, key: number) => {
    switch (bl.t) {
      case 'scene':
        return (
          <p key={key} className="font-serif text-lg font-bold tracking-wide text-paper">
            {text}
          </p>
        )
      case 'action':
        return (
          <p key={key} className="text-sm leading-8 text-paper/85">
            {text}
          </p>
        )
      case 'char':
        return (
          <p key={key} className="pt-2 text-center font-mono text-xs uppercase tracking-[0.22em] text-paper">
            {text}
          </p>
        )
      case 'paren':
        return (
          <p key={key} className="text-center text-xs leading-6 text-paper-dim">
            {text}
          </p>
        )
      case 'dial':
        return (
          <p key={key} className="mx-auto max-w-[85%] text-center text-sm leading-7 text-paper">
            {text}
          </p>
        )
    }
  }

  const statusDot =
    phase === 'typing' ? (
      <span className="h-2 w-2 animate-pulse-soft rounded-full bg-amber" />
    ) : phase === 'done' ? (
      <span className="h-2 w-2 rounded-full bg-green" />
    ) : (
      <span className="h-2 w-2 rounded-full bg-ink-line" />
    )

  return (
    <section className="site-container py-16 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[2fr_3fr]">
        {/* 左:说明 + 生成参数 */}
        <div>
          <SectionHeader
            eyebrow="REVERSE — GRAPH → SCRIPT"
            title="从图谱到剧本"
            description="拓扑不仅能读,还能写:场景节点决定空间,情绪谱决定节奏,关系边决定对白张力。选一组参数,把图谱反向生成为剧本段落。"
          />
          <div className="mt-8 space-y-5 rounded-2xl border border-ink-line bg-ink-900 p-6">
            <p className="mono-tick">生成参数 PARAMS</p>
            <div>
              <label className="mono-tick mb-2 block">场景 BEAT</label>
              <div className="relative">
                <select
                  value={beatId}
                  onChange={(e) => setBeatId(Number(e.target.value))}
                  className="w-full appearance-none rounded-lg border border-ink-line bg-ink-800 px-3.5 py-2.5 pr-9 text-sm text-paper outline-none transition-colors focus:border-cyan/60"
                >
                  {SCRIPT_BEATS.map((b) => (
                    <option key={b.beat} value={b.beat}>
                      场{b.beat} · {getScene(b.sceneId)?.name} — {getBeat(b.beat)?.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-dim" />
              </div>
            </div>
            <div>
              <label className="mono-tick mb-2 block">基调 TONE</label>
              <div className="relative">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-ink-line bg-ink-800 px-3.5 py-2.5 pr-9 text-sm text-paper outline-none transition-colors focus:border-cyan/60"
                >
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-dim" />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label className="mono-tick">长度 LENGTH</label>
                <span className="font-mono text-xs text-cyan">{Math.min(len, SCRIPTS[beatId][tone].length)} 段</span>
              </div>
              <Slider
                value={[len]}
                onValueChange={(v) => setLen(v[0])}
                min={4}
                max={10}
                step={1}
                className="[&_[data-slot=slider-range]]:bg-cyan [&_[data-slot=slider-thumb]]:border-cyan [&_[data-slot=slider-thumb]]:bg-ink-950 [&_[data-slot=slider-track]]:bg-ink-800"
              />
            </div>
            <button
              onClick={start}
              disabled={phase === 'typing'}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan py-3 text-sm font-bold text-ink-950 transition-all duration-300 hover:shadow-glow-cyan disabled:opacity-60"
            >
              {phase === 'typing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {phase === 'typing' ? '生成中 …' : '从图谱生成场景剧本'}
            </button>
          </div>
        </div>

        {/* 右:剧本输出面板 */}
        <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-900">
          <div className="flex items-center justify-between border-b border-ink-line bg-ink-950/60 px-5 py-3">
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-dim">
              <Feather className="h-3.5 w-3.5 text-cyan/70" />
              screenplay.output
            </span>
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper-dim/70">
              {statusDot}
              {phase === 'typing' ? 'WRITING' : phase === 'done' ? 'READY' : 'STANDBY'}
            </span>
          </div>
          <div className="min-h-[460px] px-6 py-8 lg:px-10">
            {phase === 'idle' ? (
              <div className="flex h-[420px] flex-col items-center justify-center gap-4">
                <Feather className="h-8 w-8 text-paper-dim/40" />
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper-dim/60">等待生成</p>
                <p className="max-w-[260px] text-center text-xs leading-5 text-paper-dim/50">
                  左侧选择场景与基调,图谱将把节点、情绪与关系编译为剧本段落。
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {blocks.slice(0, pos.b).map((bl, i) => renderBlock(bl, bl.x, i))}
                {phase === 'typing' && pos.b < blocks.length && (
                  <div>
                    {renderBlock(blocks[pos.b], blocks[pos.b].x.slice(0, pos.c), pos.b)}
                    <span className="mt-1 inline-block h-4 w-2.5 animate-caret-blink bg-cyan" />
                  </div>
                )}
              </div>
            )}
            {phase === 'done' && (
              <motion.div
                className="mt-8 flex flex-wrap items-center gap-3 border-t border-ink-line pt-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                <button
                  onClick={() => toast.success(`已导出 scene_${beatId}.fountain(演示)`)}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan/50 px-3.5 py-2 font-mono text-xs text-cyan transition-colors hover:bg-cyan/10"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  导出 .fountain
                </button>
                <button
                  onClick={() => toast.success(`已插入剧本 · 场 ${beatId}(演示)`)}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-line px-3.5 py-2 font-mono text-xs text-paper-dim transition-colors hover:border-paper-dim/50 hover:text-paper"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  插入剧本
                </button>
                <button
                  onClick={start}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-line px-3.5 py-2 font-mono text-xs text-paper-dim transition-colors hover:border-amber/50 hover:text-amber"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  重新生成
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────── S6 · 协作时间线(图谱 Git Log) ──────────────────────────── */

const INITIAL_ENTRIES: ChangeEntry[] = [
  {
    version: 12,
    source: 'Agent·情绪',
    summary: '校准场 29–30 节奏:谷值落点锁定「老鬼之死」',
    time: '2 分钟前',
    diff: [
      { op: '~', text: 'BEAT.30 「老鬼之死」 emotion -4.0 → -4.2' },
      { op: '+', text: 'BEAT.30.annotation 「全剧谷值」' },
    ],
  },
  {
    version: 11,
    source: '人类',
    summary: '手动合并白露回归线:场 32 救生艇重逢',
    time: '26 分钟前',
    diff: [
      { op: '+', text: 'EDGE r15 阿灿 ↔ 白露 「救生艇下的字条」' },
      { op: '~', text: 'CHAR.07 白露 · arc[24..31] null → 回归' },
    ],
  },
  {
    version: 10,
    source: 'Agent·道具',
    summary: '补全录音笔流转链:沈确 → 白露 → 林晚',
    time: '1 小时前',
    diff: [
      { op: '~', text: 'PROP.01 黑匣子录音笔 · timeline +beat.32' },
      { op: '+', text: 'EDGE cp11 白露 → 录音笔 「冒死偷回」' },
    ],
  },
  {
    version: 9,
    source: 'Agent·场景',
    summary: '底舱密度过高,拆分 S03 跟踪动线',
    time: '昨天 23:41',
    diff: [
      { op: '~', text: 'SCENE.03 底舱货仓 · mood +「跟踪」' },
      { op: '+', text: 'EDGE ps05 生锈的钥匙 ↔ S09 「开启之地」' },
    ],
  },
  {
    version: 8,
    source: '人类',
    summary: '导入《夜航》初稿:42 场全量解析',
    time: '3 天前',
    diff: [
      { op: '+', text: '42 BEATS · 8 CHARACTERS · 6 PROPS' },
      { op: '+', text: '12 SCENES · 26 RELATIONS' },
    ],
  },
]

function ChangeRow({ e, index }: { e: ChangeEntry; index: number }) {
  const [open, setOpen] = useState(false)
  const color = SOURCE_COLOR[e.source]
  return (
    <motion.li
      className="relative pl-10"
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: EASE_OUT }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* 版本节点圆点 */}
      <span
        className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-cyan bg-ink-950"
        style={{ boxShadow: '0 0 10px rgba(77,216,255,0.35)' }}
      >
        <span className="absolute inset-[3px] rounded-full bg-cyan/80" />
      </span>

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink-900"
      >
        <span className="font-mono text-sm font-bold text-cyan">v{e.version}</span>
        <span
          className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
          style={{ borderColor: `${color}55`, color }}
        >
          {e.source}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-paper">{e.summary}</span>
        <span className="mono-tick shrink-0">{e.time}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="mx-2 mb-3 mt-1 space-y-1 rounded-lg border border-ink-line bg-ink-950 px-3 py-2.5">
              {e.diff.map((d, i) => (
                <p key={i} className="flex items-start gap-2 font-mono text-[11px] leading-5">
                  <span className={d.op === '+' ? 'font-bold text-green' : 'font-bold text-amber'}>{d.op}</span>
                  <span className="text-paper/85">{d.text}</span>
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function ChangelogSection({ entries }: { entries: ChangeEntry[] }) {
  return (
    <section className="site-container pb-24 pt-16 lg:pb-32 lg:pt-24">
      <SectionHeader
        eyebrow="CHANGELOG — 图谱版本史"
        title="图谱的 Git Log"
        description="每一次写入——无论来自 Agent 还是人类——都是一个可回溯的版本。悬停任意记录,展开它的 diff。"
      />
      <div className="relative mt-12 rounded-2xl border border-ink-line bg-ink-900 p-6 lg:p-10">
        <span className="absolute left-7 top-4 font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim/70">
          CHANGELOG.LOG
        </span>
        <div className="relative mt-6">
          {/* 竖向时间线:自上而下描边生长 */}
          <motion.span
            className="absolute bottom-3 left-[7px] top-3 w-px bg-ink-line"
            style={{ transformOrigin: 'top' }}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
            aria-hidden
          />
          <ul className="space-y-2">
            {entries.map((e, i) => (
              <ChangeRow key={`${e.version}-${e.summary}`} e={e} index={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────── 页面组装 ──────────────────────────── */

export default function Agent() {
  const [version, setVersion] = useState(12)
  const [pending, setPending] = useState(3)
  const [nextChar, setNextChar] = useState(9)
  const [entries, setEntries] = useState<ChangeEntry[]>(INITIAL_ENTRIES)

  // S3 工位 diff 被接受 → 写入图谱:版本 +1,时间线置顶一条记录
  const handleAccept = (def: StationDef) => {
    const next = version + 1
    setVersion(next)
    setPending((x) => x + 1)
    setEntries((prev) =>
      [{ version: next, source: def.source, summary: def.summary, time: '刚刚', diff: def.diff }, ...prev].slice(0, 8),
    )
    toast.success(`已写入 · 图谱 v${next}`)
  }

  // S4 新人物节点生成
  const handleGenerateChar = (p: CharPayload) => {
    const code = `CHAR.${String(nextChar).padStart(2, '0')}`
    const next = version + 1
    setVersion(next)
    setPending((x) => x + 1)
    const diff: DiffLine[] = [
      { op: '+', text: `${code} 「${p.name}」 ${p.archetype} · 欲望 ${p.desire} / 恐惧 ${p.fear}` },
      ...p.relations
        .slice(0, 2)
        .map((r) => ({ op: '+' as const, text: `EDGE ${p.name} ↔ ${getCharacter(r.charId)?.name ?? r.charId} 「${r.type}」` })),
    ]
    setEntries((prev) =>
      [{ version: next, source: 'Agent·人物' as AgentSource, summary: `新建人物节点「${p.name}」(${p.archetype})`, time: '刚刚', diff }, ...prev].slice(0, 8),
    )
    setNextChar((n) => n + 1)
    toast.success(`节点已加入图谱 · ${code}`)
  }

  return (
    <div className="relative">
      <HeroSection version={version} pending={pending} />
      <SchemaSection />
      <PipelineSection version={version} onAccept={handleAccept} />
      <CharacterConsole nextId={nextChar} onGenerate={handleGenerateChar} />
      <ScriptSection />
      <ChangelogSection entries={entries} />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{ style: { background: '#16161F', border: '1px solid #26262F', color: '#F2EAD8' } }}
      />
    </div>
  )
}
