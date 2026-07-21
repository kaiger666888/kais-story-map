/**
 * 剧本评估 Analysis — `/analysis`
 * 体检报告 / 仪表盘:总评分量规、三幕结构节拍带、六维评估雷达、指标卡阵、
 * 对白与话语权分析、蓝图式场景利用地图、可交互改稿建议清单。
 * 全部图表 SVG 代码绘制,数据源:src/data/nightferry.ts
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, animate, motion, useInView } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { area, curveBasis, curveCatmullRom, line } from 'd3-shape'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  Gauge,
  Lightbulb,
  Map as MapIcon,
  Radar,
} from 'lucide-react'
import { PanelCard, SectionHeader } from '@/components/common'
import { cn } from '@/lib/utils'
import {
  ACTS,
  BEATS,
  CHARACTERS,
  SCENES,
  SCRIPT_STATS,
  SCENE_BEATS,
  getBeat,
  getCharacter,
  getScene,
} from '@/data/nightferry'
import type { Beat, BeatType } from '@/data/nightferry'

/* ──────────────────────────── 常量 ──────────────────────────── */

const AMBER = '#FFB347'
const ROSE = '#FF4D6D'
const CYAN = '#4DD8FF'
const PAPER = '#F2EAD8'
const INK_LINE = '#26262F'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

/** 情绪热力色阶(与情绪页一致):-5 青 → 绿 → 琥珀 → +5 玫红 */
const emotionColor = scaleLinear<string>()
  .domain([-5, -1.7, 1.7, 5])
  .range(['#4DD8FF', '#7BE0A3', '#FFB347', '#FF4D6D'])
  .clamp(true)

const TYPE_LABEL: Record<BeatType, string> = {
  setup: '建置',
  inciting: '激励事件',
  rising: '上升动作',
  turning: '转折',
  crisis: '危机',
  climax: '高潮',
  resolution: '收束',
}

const TYPE_WEIGHT: Record<BeatType, number> = {
  setup: 0.25,
  inciting: 0.5,
  rising: 0.45,
  turning: 0.62,
  crisis: 0.88,
  climax: 1,
  resolution: 0.3,
}

/** 14 个关键节拍的结构角色 + 一句诊断 */
const KEY_ROLES: Record<number, { role: string; desc: string }> = {
  1: { role: '开场画面', desc: '雨夜登船,基调、悬念与视角人物一次立住。' },
  5: { role: '激励事件', desc: '底舱异响打破平衡,调查正式启动。' },
  9: { role: '第一线索', desc: '舱单第 9 栏,全剧第一道裂缝。' },
  12: { role: '第一情节点', desc: '午夜被跟踪,主角被锁进悬疑核心。' },
  15: { role: '关键托付', desc: '钥匙交接,B 故事与密室线同时启动。' },
  16: { role: '首次大危机', desc: '风暴登陆,外部压力全面升级。' },
  21: { role: '中点推进', desc: '密室开启,真相第一次显形。' },
  22: { role: '中点', desc: '照片背面揭出姐姐,调查彻底私人化。' },
  25: { role: '人物转折', desc: '江离忏悔,敌我关系重新排布。' },
  28: { role: '至暗时刻', desc: '主角被囚、证据被夺,主动权归零。' },
  30: { role: '灵魂黑夜', desc: '老鬼之死,全剧情绪谷值 -4.2。' },
  34: { role: '高潮', desc: '风暴夜全船摊牌,驾驶舱易主。' },
  38: { role: '终局逆转', desc: '信号弹撕开夜幕,海警回应。' },
  42: { role: '结局', desc: '黎明抵港,每条人物弧光收束。' },
}

/* ──────────────────────────── 工具 ──────────────────────────── */

function useCountUp(start: boolean, to: number, duration = 1.2, delay = 0) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!start) return
    const controls = animate(0, to, { duration, delay, ease: EASE, onUpdate: setV })
    return () => controls.stop()
  }, [start, to, duration, delay])
  return v
}

function CountUp({
  to,
  decimals = 0,
  duration = 1.1,
  delay = 0,
  start,
}: {
  to: number
  decimals?: number
  duration?: number
  delay?: number
  start: boolean
}) {
  const v = useCountUp(start, to, duration, delay)
  return <>{v.toFixed(decimals)}</>
}

/* ──────────────────────────── S1 · 总评分量规 ──────────────────────────── */

const GAUGE_SCORE = 82

function ScoreGauge() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const score = useCountUp(inView, GAUGE_SCORE, 1.4, 0.3)
  const CX = 130
  const CY = 132
  const R = 96
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`
  const needleAngle = (GAUGE_SCORE / 100) * 180
  const badges = [
    { label: '结构', grade: 'B+', color: AMBER },
    { label: '情绪', grade: 'A-', color: ROSE },
    { label: '人物', grade: 'B', color: CYAN },
  ]
  return (
    <div ref={ref} className="mx-auto w-full max-w-[340px]">
      <svg viewBox="0 0 260 168" className="w-full">
        {/* 刻度 */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = (Math.PI * (180 - i * 18)) / 180
          return (
            <line
              key={i}
              x1={CX + (R + 8) * Math.cos(a)}
              y1={CY - (R + 8) * Math.sin(a)}
              x2={CX + (R + 15) * Math.cos(a)}
              y2={CY - (R + 15) * Math.sin(a)}
              stroke={INK_LINE}
              strokeWidth={i % 5 === 0 ? 2 : 1.2}
            />
          )
        })}
        {/* 底弧 */}
        <path d={arc} fill="none" stroke="#16161F" strokeWidth={14} strokeLinecap="round" />
        {/* 分数弧(0 → 82% 生长) */}
        <motion.path
          d={arc}
          fill="none"
          stroke={AMBER}
          strokeWidth={14}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: GAUGE_SCORE / 100 } : undefined}
          transition={{ duration: 1.4, delay: 0.3, ease: EASE }}
          style={{ filter: 'drop-shadow(0 0 10px rgba(255,179,71,0.45))' }}
        />
        {/* 指针 */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={inView ? { rotate: needleAngle } : undefined}
          transition={{ duration: 1.4, delay: 0.3, ease: EASE }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        >
          <line x1={CX - 8} y1={CY} x2={CX - (R - 24)} y2={CY} stroke={PAPER} strokeWidth={2.5} strokeLinecap="round" />
        </motion.g>
        <circle cx={CX} cy={CY} r={5} fill="#08080D" stroke={AMBER} strokeWidth={2} />
        <text x={CX - R} y={CY + 24} textAnchor="middle" fontSize={9} className="fill-paper-dim font-mono">0</text>
        <text x={CX + R} y={CY + 24} textAnchor="middle" fontSize={9} className="fill-paper-dim font-mono">100</text>
        {/* 中心大数字(Fraunces 900) */}
        <text x={CX} y={CY - 16} textAnchor="middle" fontSize={48} fontWeight={900} className="fill-paper font-display">
          {Math.round(score)}
        </text>
        <text x={CX} y={CY + 26} textAnchor="middle" fontSize={9} letterSpacing="0.22em" className="fill-paper-dim font-mono">
          TOTAL / 100
        </text>
      </svg>
      {/* 三个小徽章 */}
      <div className="mt-3 flex justify-center gap-2">
        {badges.map((b, i) => (
          <motion.span
            key={b.label}
            initial={{ opacity: 0, scale: 0.5, y: 8 }}
            animate={inView ? { opacity: 1, scale: 1, y: 0 } : undefined}
            transition={{ delay: 1 + i * 0.1, duration: 0.4, ease: EASE }}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[0.6875rem]"
            style={{ borderColor: `${b.color}55`, color: b.color }}
          >
            {b.label} <span className="font-bold">{b.grade}</span>
          </motion.span>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────── S2 · 三幕结构节拍带 ──────────────────────────── */

const ACT_COLORS = [AMBER, ROSE, CYAN]

const BS_W = 1240
const BS_H = 190
const BS_PAD_L = 26
const BS_PAD_R = 26
const BS_TRACK_Y = 54
const BS_TRACK_H = 40
const BS_CHART_Y = 110
const BS_CHART_H = 52

function BeatSheet() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [hover, setHover] = useState<number | null>(null)

  /** 42 格:等宽为基准,按场次时长(危机/高潮更长)微调 */
  const cells = useMemo(() => {
    const weights = BEATS.map(
      (b) => 1 + (b.type === 'climax' ? 0.28 : b.type === 'crisis' ? 0.14 : 0) + (((b.index * 37) % 7) - 3) * 0.03,
    )
    const gap = 3
    const total = BS_W - BS_PAD_L - BS_PAD_R - gap * (BEATS.length - 1)
    const sum = weights.reduce((s, w) => s + w, 0)
    const widths = weights.map((w) => (w / sum) * total)
    return BEATS.map((b, i) => {
      const x = BS_PAD_L + widths.slice(0, i).reduce((s, w) => s + w, 0) + gap * i
      return { beat: b, x, w: widths[i], cx: x + widths[i] / 2 }
    })
  }, [])

  /** 冲突强度 0–1:|情绪| × 节拍类型权重 */
  const conflict = useMemo(
    () => BEATS.map((b) => Math.min(1, 0.6 * (Math.abs(b.emotion) / 5) + 0.4 * TYPE_WEIGHT[b.type])),
    [],
  )

  const { areaPath, linePath, refPath } = useMemo(() => {
    const xS = scaleLinear().domain([1, BEATS.length]).range([cells[0].cx, cells[cells.length - 1].cx])
    const yS = scaleLinear().domain([0, 1]).range([BS_CHART_Y + BS_CHART_H, BS_CHART_Y])
    const pts = BEATS.map((b, i) => ({ x: b.index, y: conflict[i] }))
    const areaGen = area<{ x: number; y: number }>()
      .x((d) => xS(d.x))
      .y0(BS_CHART_Y + BS_CHART_H)
      .y1((d) => yS(d.y))
      .curve(curveCatmullRom.alpha(0.5))
    const lineGen = line<{ x: number; y: number }>()
      .x((d) => xS(d.x))
      .y((d) => yS(d.y))
      .curve(curveCatmullRom.alpha(0.5))
    /** 经典三幕张力参考曲线(控制点 → 平滑虚线抛物线) */
    const refPts: [number, number][] = [
      [0, 0.16], [0.08, 0.24], [0.16, 0.32], [0.25, 0.48], [0.33, 0.44], [0.42, 0.52],
      [0.5, 0.62], [0.58, 0.56], [0.67, 0.66], [0.75, 0.78], [0.83, 0.84], [0.9, 0.97],
      [0.95, 0.7], [1, 0.48],
    ]
    const refGen = line<[number, number]>()
      .x((d) => xS(1 + d[0] * (BEATS.length - 1)))
      .y((d) => yS(d[1]))
      .curve(curveBasis)
    return { areaPath: areaGen(pts) ?? '', linePath: lineGen(pts) ?? '', refPath: refGen(refPts) ?? '' }
  }, [cells, conflict])

  const hoverBeat = hover !== null ? getBeat(hover) : undefined
  const hoverCell = hover !== null ? cells[hover - 1] : undefined
  const keyCells = cells.filter((c) => c.beat.key)

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${BS_W} ${BS_H}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {/* 三幕大括号 */}
        {ACTS.map((act, ai) => {
          const first = cells[act.range[0] - 1]
          const last = cells[act.range[1] - 1]
          const x0 = first.x
          const x1 = last.x + last.w
          const color = ACT_COLORS[ai]
          return (
            <g key={act.id}>
              <motion.path
                d={`M ${x0} 40 L ${x0} 34 L ${x1} 34 L ${x1} 40`}
                fill="none"
                stroke={color}
                strokeWidth={1}
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : undefined}
                transition={{ duration: 0.6, delay: 0.2 + ai * 0.2 }}
              />
              <motion.text
                x={(x0 + x1) / 2}
                y={24}
                textAnchor="middle"
                fontSize={10}
                letterSpacing="0.18em"
                className="font-mono"
                fill={color}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{ delay: 0.35 + ai * 0.2 }}
              >
                {act.nameEn} · 场{String(act.range[0]).padStart(2, '0')}–{String(act.range[1]).padStart(2, '0')}
              </motion.text>
            </g>
          )
        })}

        {/* 42 场格子(按场景情绪着色,从左到右点亮) */}
        {cells.map((c, i) => (
          <motion.rect
            key={c.beat.index}
            x={c.x}
            y={BS_TRACK_Y}
            width={c.w}
            height={BS_TRACK_H}
            rx={2}
            fill={emotionColor(c.beat.emotion)}
            fillOpacity={0.16 + 0.16 * (Math.abs(c.beat.emotion) / 5)}
            stroke={hover === c.beat.index ? AMBER : INK_LINE}
            strokeWidth={hover === c.beat.index ? 1.2 : 0.5}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 0.1 + i * 0.015, duration: 0.3 }}
            className="cursor-crosshair transition-transform duration-150 hover:-translate-y-1"
            style={{ transformBox: 'fill-box' }}
            onMouseEnter={() => setHover(c.beat.index)}
          />
        ))}

        {/* 14 个关键节拍骨节(pop 入场) */}
        {keyCells.map((c, ki) => (
          <motion.g
            key={c.beat.index}
            initial={{ scale: 0 }}
            animate={inView ? { scale: [0, 1.3, 1] } : undefined}
            transition={{ delay: 0.6 + ki * 0.08, duration: 0.45 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <circle cx={c.cx} cy={BS_TRACK_Y + BS_TRACK_H / 2} r={7.5} fill="#08080D" stroke={AMBER} strokeWidth={1.5} />
            <circle cx={c.cx} cy={BS_TRACK_Y + BS_TRACK_H / 2} r={3} fill={AMBER} />
            <circle
              cx={c.cx}
              cy={BS_TRACK_Y + BS_TRACK_H / 2}
              r={14}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHover(c.beat.index)}
            />
          </motion.g>
        ))}

        {/* 冲突强度 mini 面积图 */}
        <motion.path
          d={areaPath}
          fill={ROSE}
          fillOpacity={0.22}
          stroke="none"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ delay: 1.1, duration: 0.8 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={ROSE}
          strokeWidth={1.5}
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : undefined}
          transition={{ delay: 0.9, duration: 1.2 }}
        />
        {/* 经典三幕张力参考虚线(最后淡入) */}
        <motion.path
          d={refPath}
          fill="none"
          stroke={PAPER}
          strokeWidth={1}
          strokeDasharray="5 5"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 0.35 } : undefined}
          transition={{ delay: 1.6, duration: 0.8 }}
        />
        <line x1={BS_PAD_L} x2={BS_W - BS_PAD_R} y1={BS_CHART_Y + BS_CHART_H} y2={BS_CHART_Y + BS_CHART_H} stroke={INK_LINE} strokeWidth={1} />

        {/* X 轴场次刻度 */}
        {[1, 7, 13, 20, 27, 34, 42].map((b) => (
          <text key={b} x={cells[b - 1].cx} y={BS_CHART_Y + BS_CHART_H + 16} textAnchor="middle" fontSize={9} className="fill-paper-dim font-mono">
            {String(b).padStart(2, '0')}
          </text>
        ))}

        {/* hover 准线 */}
        {hoverCell && (
          <line
            x1={hoverCell.cx}
            x2={hoverCell.cx}
            y1={BS_TRACK_Y - 4}
            y2={BS_CHART_Y + BS_CHART_H}
            stroke={AMBER}
            strokeWidth={1}
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            pointerEvents="none"
          />
        )}
      </svg>

      {/* hover tooltip:场号 / 场景 / 节拍角色 */}
      {hoverCell && hoverBeat && (
        <div
          className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg border border-ink-line bg-ink-950/95 px-3 py-2 font-mono text-[0.6875rem] leading-5 text-paper shadow-xl"
          style={{
            left: `${(hoverCell.cx / BS_W) * 100}%`,
            top: 34,
            transform: `translateX(${hoverCell.cx / BS_W > 0.78 ? '-92%' : hoverCell.cx / BS_W < 0.16 ? '-8%' : '-50%'})`,
          }}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-amber">场{String(hoverBeat.index).padStart(2, '0')}</span>
            <span className="text-paper-dim">
              {hoverBeat.sceneId} {getScene(hoverBeat.sceneId)?.name}
            </span>
            <span style={{ color: emotionColor(hoverBeat.emotion) }}>
              {hoverBeat.emotion > 0 ? '+' : ''}
              {hoverBeat.emotion}
            </span>
          </div>
          <div className="mt-0.5 text-paper">
            {KEY_ROLES[hoverBeat.index] ? `◆ ${KEY_ROLES[hoverBeat.index].role} · ` : ''}
            {TYPE_LABEL[hoverBeat.type]} — {hoverBeat.title}
          </div>
          {KEY_ROLES[hoverBeat.index] && <div className="text-paper-dim">{KEY_ROLES[hoverBeat.index].desc}</div>}
        </div>
      )}

      {/* 图例 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.6875rem] text-paper-dim">
        <span className="flex items-center gap-1.5">
          <span className="gradient-emotion h-2.5 w-2.5 rounded-sm" /> 场次情绪(-5 → +5)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-amber bg-ink-950" /> 关键节拍({SCRIPT_STATS.keyBeats})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-rose/40" /> 冲突强度
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-5 border-t border-dashed border-paper/60" /> 经典三幕张力参考
        </span>
      </div>
    </div>
  )
}

/* ──────────────────────────── S3 · 六维评估雷达 ──────────────────────────── */

const DIMS = [
  { label: '结构完整度', score: 85, avg: 75 },
  { label: '人物弧光', score: 78, avg: 72 },
  { label: '冲突密度', score: 88, avg: 70 },
  { label: '对白效率', score: 74, avg: 68 },
  { label: '场景利用', score: 90, avg: 65 },
  { label: '原创性', score: 76, avg: 70 },
]

function RadarChart() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [hoverDim, setHoverDim] = useState<number | null>(null)

  const VW = 420
  const VH = 384
  const CX = 210
  const CY = 198
  const R = 116
  const angle = (i: number) => ((-90 + i * 60) * Math.PI) / 180
  const pt = (i: number, v: number): [number, number] => [
    CX + R * (v / 100) * Math.cos(angle(i)),
    CY + R * (v / 100) * Math.sin(angle(i)),
  ]
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ')

  const hoverPt = hoverDim !== null ? pt(hoverDim, 100) : null

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="mx-auto w-full max-w-[440px]">
        {/* 3 圈同心网格(先淡入) */}
        {[33.3, 66.7, 100].map((v, ri) => (
          <motion.polygon
            key={v}
            points={poly(DIMS.map(() => v))}
            fill="none"
            stroke={INK_LINE}
            strokeWidth={ri === 2 ? 1.2 : 0.7}
            strokeDasharray={ri === 2 ? undefined : '3 4'}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: ri * 0.12, duration: 0.5 }}
          />
        ))}
        {/* 轴线 */}
        {DIMS.map((d, i) => {
          const [x, y] = pt(i, 100)
          return (
            <line
              key={d.label}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={hoverDim === i ? AMBER : INK_LINE}
              strokeWidth={hoverDim === i ? 1.4 : 0.7}
            />
          )
        })}

        {/* 同类型悬疑片均值(虚线对照多边形,延迟淡入) */}
        <motion.polygon
          points={poly(DIMS.map((d) => d.avg))}
          fill="none"
          stroke="#9A937F"
          strokeOpacity={0.55}
          strokeWidth={1}
          strokeDasharray="4 4"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ delay: 0.9, duration: 0.6 }}
        />
        {/* 本剧多边形(从中心放大生长) */}
        <motion.polygon
          points={poly(DIMS.map((d) => d.score))}
          fill={AMBER}
          fillOpacity={0.25}
          stroke={AMBER}
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : undefined}
          transition={{ delay: 0.2, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        {DIMS.map((d, i) => {
          const [x, y] = pt(i, d.score)
          return <circle key={d.label} cx={x} cy={y} r={3} fill={AMBER} stroke="#08080D" strokeWidth={1.5} />
        })}

        {/* 轴端点标签 */}
        {DIMS.map((d, i) => {
          const [x, y] = pt(i, 132)
          const cos = Math.cos(angle(i))
          const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
          return (
            <g key={d.label}>
              <text
                x={x}
                y={y - 2}
                textAnchor={anchor}
                fontSize={10.5}
                className="font-mono"
                fill={hoverDim === i ? AMBER : '#9A937F'}
              >
                {d.label}
              </text>
              <text x={x} y={y + 12} textAnchor={anchor} fontSize={10} fontWeight={700} className="font-mono" fill={hoverDim === i ? AMBER : PAPER}>
                {d.score}
              </text>
            </g>
          )
        })}

        {/* hover 热区 */}
        {DIMS.map((d, i) => {
          const [x, y] = pt(i, 100)
          return (
            <circle
              key={d.label}
              cx={x}
              cy={y}
              r={20}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverDim(i)}
              onMouseLeave={() => setHoverDim(null)}
            />
          )
        })}
      </svg>

      {/* 双分数对比 tooltip */}
      {hoverDim !== null && hoverPt && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-ink-line bg-ink-950/95 px-3 py-2 font-mono text-[0.6875rem] leading-5 text-paper shadow-xl"
          style={{
            left: `${(hoverPt[0] / VW) * 100}%`,
            top: `${(hoverPt[1] / VH) * 100}%`,
            transform: `translate(${hoverPt[0] / VW > 0.7 ? '-105%' : hoverPt[0] / VW < 0.3 ? '5%' : '-50%'}, -115%)`,
          }}
        >
          <div className="whitespace-nowrap text-paper">{DIMS[hoverDim].label}</div>
          <div className="whitespace-nowrap">
            <span className="text-amber">本剧 {DIMS[hoverDim].score}</span>
            <span className="mx-2 text-paper-dim">均值 {DIMS[hoverDim].avg}</span>
            <span className="text-green">+{DIMS[hoverDim].score - DIMS[hoverDim].avg}</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[0.6875rem] text-paper-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-amber/70" /> 本剧《夜航》
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-5 border-t border-dashed border-paper-dim/70" /> 同类型悬疑片均值
        </span>
      </div>
    </div>
  )
}

/* ──────────────────────────── S4 · 指标卡阵 ──────────────────────────── */

function MiniRing({ pct, color, start, delay }: { pct: number; color: string; start: boolean; delay: number }) {
  const r = 15.5
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#16161F" strokeWidth="4.5" />
      <motion.circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={start ? { strokeDashoffset: c * (1 - pct) } : undefined}
        transition={{ duration: 1, delay, ease: EASE }}
      />
    </svg>
  )
}

function MiniViz({ id, start, delay }: { id: string; start: boolean; delay: number }) {
  if (id === 'beats') {
    /* sparkbar:三幕场次分布 12 / 22 / 8 */
    return (
      <div className="flex h-10 items-end gap-1">
        {[12, 22, 8].map((v, i) => (
          <motion.div
            key={i}
            className="w-2.5 rounded-sm bg-amber/80"
            initial={{ height: 0 }}
            animate={start ? { height: `${(v / 22) * 100}%` } : undefined}
            transition={{ delay: delay + i * 0.08, duration: 0.6, ease: EASE }}
          />
        ))}
      </div>
    )
  }
  if (id === 'dialogue') return <MiniRing pct={0.68} color={AMBER} start={start} delay={delay} />
  if (id === 'conflict') return <MiniRing pct={0.57} color={ROSE} start={start} delay={delay} />
  if (id === 'appear') {
    /* 点阵:20 格中 16 格 */
    return (
      <div className="grid w-[76px] grid-cols-10 gap-[3px]">
        {Array.from({ length: 20 }, (_, i) => (
          <motion.span
            key={i}
            className={cn('h-1.5 w-1.5 rounded-full', i < 16 ? 'bg-amber' : 'bg-ink-800')}
            initial={{ opacity: 0 }}
            animate={start ? { opacity: 1 } : undefined}
            transition={{ delay: delay + i * 0.02 }}
          />
        ))}
      </div>
    )
  }
  if (id === 'reuse') {
    return (
      <div className="h-2 w-16 overflow-hidden rounded-full bg-ink-800">
        <motion.div
          className="h-full rounded-full bg-amber/85"
          initial={{ width: 0 }}
          animate={start ? { width: '70%' } : undefined}
          transition={{ delay, duration: 0.8, ease: EASE }}
        />
      </div>
    )
  }
  /* mono:独白迷你文字块(第 3 行为最长段) */
  return (
    <div className="flex w-16 flex-col gap-1">
      {[1, 0.82, 0.92, 0.6].map((w, i) => (
        <motion.div
          key={i}
          className={cn('h-1 rounded-full', i === 2 ? 'bg-amber' : 'bg-ink-800')}
          initial={{ scaleX: 0 }}
          animate={start ? { scaleX: w } : undefined}
          style={{ transformOrigin: 'left' }}
          transition={{ delay: delay + i * 0.06, duration: 0.4 }}
        />
      ))}
    </div>
  )
}

interface Metric {
  id: string
  label: string
  value: number
  decimals?: number
  unit?: string
  sub?: string
  up: boolean
  avgText: string
}

const METRICS: Metric[] = [
  { id: 'beats', label: '场景数(场)', value: 42, up: true, avgText: '36' },
  { id: 'dialogue', label: '对白密度', value: 68, unit: '%', up: false, avgText: '72%' },
  { id: 'appear', label: '人均出场(场)', value: 15.8, decimals: 1, up: true, avgText: '12.6' },
  { id: 'reuse', label: '场景复用率(场/景)', value: 3.5, decimals: 1, up: true, avgText: '2.8' },
  { id: 'conflict', label: '冲突场景占比', value: 57, unit: '%', up: true, avgText: '49%' },
  { id: 'mono', label: '独白最长段(页)', value: 2.4, decimals: 1, sub: '场34 · 林晚', up: true, avgText: '1.6 页' },
]

function MetricGrid() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <div ref={ref}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="mono-label flex items-center gap-3">
          <span className="inline-block h-px w-6 bg-amber" />
          METRICS — 关键指标
        </p>
        <p className="mono-tick">vs 同类型均值</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
            className="rounded-xl border border-ink-line bg-ink-900 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber/40"
          >
            <p className="mono-tick">
              {m.label}
              {m.sub && <span className="ml-1.5 text-amber/80">{m.sub}</span>}
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="font-display text-[1.85rem] font-black leading-none text-paper">
                <CountUp start={inView} to={m.value} decimals={m.decimals ?? 0} delay={0.15 + i * 0.08} />
                {m.unit && <span className="ml-0.5 text-sm font-bold text-paper-dim">{m.unit}</span>}
              </p>
              <MiniViz id={m.id} start={inView} delay={0.3 + i * 0.08} />
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[0.6875rem]">
              {m.up ? <ArrowUp className="h-3 w-3 text-green" /> : <ArrowDown className="h-3 w-3 text-rose" />}
              <span className={m.up ? 'text-green' : 'text-rose'}>{m.up ? '高于' : '低于'}</span>
              <span className="text-paper-dim">均值 {m.avgText}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────── S5 · 对白与话语权 ──────────────────────────── */

/** 8 人物对白量(句数合计 = SCRIPT_STATS.dialogueLines)+ 带情绪标记句数 + 台词密度 TOP3 场次 */
const DIALOGUE: Record<string, { lines: number; emotional: number; top: { beat: number; lines: number }[] }> = {
  linwan: { lines: 312, emotional: 148, top: [{ beat: 34, lines: 28 }, { beat: 11, lines: 19 }, { beat: 18, lines: 17 }] },
  jiangli: { lines: 208, emotional: 96, top: [{ beat: 25, lines: 24 }, { beat: 18, lines: 15 }, { beat: 40, lines: 14 }] },
  hanchong: { lines: 165, emotional: 58, top: [{ beat: 11, lines: 18 }, { beat: 37, lines: 16 }, { beat: 31, lines: 12 }] },
  shenque: { lines: 142, emotional: 66, top: [{ beat: 27, lines: 14 }, { beat: 2, lines: 11 }, { beat: 34, lines: 10 }] },
  suqiao: { lines: 118, emotional: 52, top: [{ beat: 17, lines: 16 }, { beat: 26, lines: 13 }, { beat: 33, lines: 12 }] },
  achan: { lines: 96, emotional: 41, top: [{ beat: 38, lines: 11 }, { beat: 29, lines: 10 }, { beat: 20, lines: 8 }] },
  laogui: { lines: 88, emotional: 38, top: [{ beat: 15, lines: 14 }, { beat: 14, lines: 12 }, { beat: 30, lines: 7 }] },
  bailu: { lines: 75, emotional: 34, top: [{ beat: 32, lines: 12 }, { beat: 8, lines: 9 }, { beat: 37, lines: 8 }] },
}

function DialogueShare() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [selected, setSelected] = useState('linwan')

  const rows = useMemo(
    () => [...CHARACTERS].sort((a, b) => (DIALOGUE[b.id]?.lines ?? 0) - (DIALOGUE[a.id]?.lines ?? 0)),
    [],
  )
  const max = DIALOGUE[rows[0].id]?.lines ?? 1
  const sel = getCharacter(selected)
  const selData = DIALOGUE[selected]

  return (
    <div ref={ref}>
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* 条形图 */}
        <div className="flex-1 space-y-0.5">
          {rows.map((c, i) => {
            const d = DIALOGUE[c.id]
            const active = selected === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-2 py-[7px] text-left transition-colors duration-200',
                  active ? 'bg-ink-800' : 'hover:bg-ink-800/60',
                )}
              >
                <span
                  className={cn(
                    'w-11 shrink-0 text-right font-mono text-[0.6875rem] transition-colors',
                    active ? 'text-amber' : 'text-paper-dim group-hover:text-paper',
                  )}
                >
                  {c.name}
                </span>
                <span className="relative h-6 flex-1">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-sm bg-amber/85"
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${(d.lines / max) * 100}%` } : undefined}
                    transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: EASE }}
                  />
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-sm bg-rose/90"
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${(d.emotional / max) * 100}%` } : undefined}
                    transition={{ delay: 0.3 + i * 0.07, duration: 0.7, ease: EASE }}
                  />
                </span>
                <span className="w-9 shrink-0 font-mono text-[0.6875rem] text-paper">{d.lines}</span>
              </button>
            )
          })}
        </div>

        {/* 选中人物:台词密度 TOP 3 场次 */}
        <AnimatePresence mode="wait">
          {sel && selData && (
            <motion.div
              key={selected}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="w-full shrink-0 rounded-xl border border-ink-line bg-ink-950/60 p-4 lg:w-[248px]"
            >
              <div className="flex items-center gap-3">
                <img
                  src={sel.avatar}
                  alt={sel.name}
                  className="h-10 w-10 rounded-full border border-ink-line object-cover"
                />
                <div>
                  <p className="font-serif font-bold text-paper">
                    {sel.name} <span className="ml-1 font-mono text-[0.625rem] font-normal text-paper-dim">{sel.nameEn}</span>
                  </p>
                  <p className="font-mono text-[0.6875rem] text-paper-dim">
                    {selData.lines} 句 · 情绪标记 {selData.emotional} 句
                  </p>
                </div>
              </div>
              <p className="mono-tick mt-4">台词密度 TOP 3</p>
              <div className="mt-2 space-y-1.5">
                {selData.top.map((t, i) => {
                  const b = getBeat(t.beat)
                  return (
                    <div
                      key={t.beat}
                      className="flex items-center justify-between gap-2 rounded-lg border border-ink-line/70 px-2.5 py-1.5"
                    >
                      <span className="font-mono text-[0.6875rem] text-paper">
                        <span className="mr-1 text-amber">#{i + 1}</span>
                        场{String(t.beat).padStart(2, '0')} {b?.title}
                      </span>
                      <span className="shrink-0 font-mono text-[0.6875rem] text-paper-dim">{t.lines} 句</span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.6875rem] text-paper-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-amber/85" /> 对白句数
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-rose/90" /> 带情绪标记
        </span>
        <span className="sm:ml-auto">全剧 {SCRIPT_STATS.dialogueLines} 句 · 点击条形查看人物场次</span>
      </div>
    </div>
  )
}

/* ──────────────────────────── S5 · 人物对白往来矩阵 ──────────────────────────── */

function InteractionMatrix() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [hover, setHover] = useState<[number, number] | null>(null)

  /** 格值 = 两人同场对白轮次(按同场场次统计);最激烈一场 = 同场中 |情绪| 最大者 */
  const { counts, best, maxV } = useMemo(() => {
    const ids = CHARACTERS.map((c) => c.id)
    const n = ids.length
    const counts: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
    const best: (number | null)[][] = Array.from({ length: n }, () => new Array<number | null>(n).fill(null))
    for (const b of BEATS) {
      for (let i = 0; i < n; i++) {
        if (!b.characters.includes(ids[i])) continue
        for (let j = i + 1; j < n; j++) {
          if (!b.characters.includes(ids[j])) continue
          counts[i][j] += 1
          counts[j][i] += 1
          const cur = best[i][j]
          const curAbs = cur !== null ? Math.abs(getBeat(cur)?.emotion ?? 0) : -1
          if (Math.abs(b.emotion) > curAbs) {
            best[i][j] = b.index
            best[j][i] = b.index
          }
        }
      }
    }
    let maxV = 0
    counts.forEach((row, i) =>
      row.forEach((v, j) => {
        if (i !== j && v > maxV) maxV = v
      }),
    )
    return { counts, best, maxV }
  }, [])

  const hoverData =
    hover !== null
      ? {
          a: CHARACTERS[hover[0]],
          b: CHARACTERS[hover[1]],
          v: counts[hover[0]][hover[1]],
          bestBeat: best[hover[0]][hover[1]] !== null ? getBeat(best[hover[0]][hover[1]] as number) : undefined,
        }
      : null

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
        <div />
        {CHARACTERS.map((c) => (
          <div key={c.id} className="pb-0.5 text-center font-mono text-[0.625rem] text-paper-dim">
            {c.name}
          </div>
        ))}
        {CHARACTERS.map((rowC, i) => (
          <Fragment key={rowC.id}>
            <div className="flex items-center justify-center font-mono text-[0.625rem] text-paper-dim">
              {rowC.name}
            </div>
            {CHARACTERS.map((colC, j) => {
              const diag = i === j
              const v = counts[i][j]
              const inCross = !diag && hover !== null && (hover[0] === i || hover[1] === j)
              const isCell = !diag && hover !== null && hover[0] === i && hover[1] === j
              return (
                <motion.div
                  key={colC.id}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={inView ? { opacity: 1, scale: 1 } : undefined}
                  transition={{ delay: 0.15 + (i + j) * 0.045, duration: 0.35 }}
                  onMouseEnter={() => !diag && setHover([i, j])}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-[4px] font-mono text-[0.625rem]',
                    diag ? 'bg-ink-800/70 text-paper-dim/30' : 'cursor-crosshair text-paper/60',
                  )}
                  style={
                    diag
                      ? undefined
                      : {
                          backgroundColor: `rgba(255,179,71,${v === 0 ? 0.04 : 0.08 + 0.8 * (v / maxV)})`,
                          boxShadow: isCell
                            ? '0 0 0 1.5px #FFB347'
                            : inCross
                              ? 'inset 0 0 0 100px rgba(242,234,216,0.08)'
                              : undefined,
                        }
                  }
                >
                  {!diag && v > 0 ? v : diag ? '—' : ''}
                </motion.div>
              )
            })}
          </Fragment>
        ))}
      </div>

      {/* hover tooltip:两人名 + 轮次 + 最激烈的一场 */}
      {hover !== null && hoverData && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-ink-line bg-ink-950/95 px-3 py-2 font-mono text-[0.6875rem] leading-5 text-paper shadow-xl"
          style={{
            left: `${((hover[1] + 1.5) / 9) * 100}%`,
            top: `${((hover[0] + 1) / 9) * 100}%`,
            transform: `translate(${hover[1] <= 1 ? '-15%' : hover[1] >= 6 ? '-85%' : '-50%'}, ${hover[0] === 0 ? '15%' : '-115%'})`,
          }}
        >
          <div className="whitespace-nowrap">
            <span className="text-amber">{hoverData.a.name}</span>
            <span className="mx-1.5 text-paper-dim">×</span>
            <span className="text-amber">{hoverData.b.name}</span>
          </div>
          {hoverData.v > 0 ? (
            <>
              <div className="whitespace-nowrap text-paper-dim">同场对白 {hoverData.v} 场</div>
              {hoverData.bestBeat && (
                <div className="whitespace-nowrap text-paper">
                  最激烈:场{String(hoverData.bestBeat.index).padStart(2, '0')} {hoverData.bestBeat.title}
                </div>
              )}
            </>
          ) : (
            <div className="whitespace-nowrap text-paper-dim">无同场对手戏</div>
          )}
        </div>
      )}

      <p className="mt-4 font-mono text-[0.6875rem] text-paper-dim">
        格值 = 两人同场对白轮次(按场统计,共 {BEATS.length} 场)· 对角线为本人,不可选
      </p>
    </div>
  )
}

/* ──────────────────────────── S6 · 场景利用蓝图 ──────────────────────────── */

interface BlueBlock {
  x: number
  y: number
  w: number
  h: number
  dashed?: boolean
  deco?: 'containers' | 'windows' | 'waves' | 'hatch' | 'boat'
}

/** 楼层平面图式布局:块面积 ∝ 场景使用场次数 */
const BLUE_BLOCKS: Record<string, BlueBlock> = {
  S01: { x: 26, y: 58, w: 116, h: 118 },
  S12: { x: 26, y: 188, w: 116, h: 86 },
  S08: { x: 200, y: 100, w: 170, h: 78 },
  S04: { x: 378, y: 100, w: 142, h: 78, deco: 'waves' },
  S02: { x: 528, y: 100, w: 172, h: 78, deco: 'windows' },
  S10: { x: 708, y: 100, w: 142, h: 78 },
  S06: { x: 200, y: 186, w: 220, h: 92 },
  S05: { x: 428, y: 186, w: 132, h: 92 },
  S07: { x: 568, y: 186, w: 132, h: 92, deco: 'hatch' },
  S09: { x: 708, y: 186, w: 142, h: 92, dashed: true },
  S03: { x: 200, y: 286, w: 360, h: 74, deco: 'containers' },
  S11: { x: 420, y: 396, w: 128, h: 34, deco: 'boat' },
}

const HULL_PATH =
  'M 175 90 L 830 90 C 905 90 955 150 968 231 C 955 312 905 374 830 374 L 175 374 C 163 374 156 366 156 354 L 156 110 C 156 98 163 90 175 90 Z'

function wavePath(y: number, amp: number, seg: number) {
  let d = `M 0 ${y}`
  for (let x = 0; x < 1000; x += seg) d += ` Q ${x + seg / 2} ${y - amp} ${x + seg} ${y}`
  return d
}

interface SceneStat {
  count: number
  mean: number
  keyBeat: Beat | undefined
}

function BlueprintMap() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [hoverLoc, setHoverLoc] = useState<string | null>(null)

  const stats = useMemo(() => {
    const m = new Map<string, SceneStat>()
    for (const s of SCENES) {
      const bs = (SCENE_BEATS[s.id] ?? []).map((i) => getBeat(i)).filter((b): b is Beat => !!b)
      const count = bs.length
      const mean = count ? bs.reduce((sum, b) => sum + b.emotion, 0) / count : 0
      const keyBeat =
        bs.find((b) => b.key) ?? (count ? bs.reduce((a, b) => (Math.abs(b.emotion) > Math.abs(a.emotion) ? b : a)) : undefined)
      m.set(s.id, { count, mean, keyBeat })
    }
    return m
  }, [])

  /** 洞察:压力锅(情绪均值最低)+ 最高频空间 */
  const insight = useMemo(() => {
    const arr = SCENES.map((s) => ({ s, stat: stats.get(s.id) as SceneStat }))
    const pressure = arr.filter((a) => a.stat.count >= 3).reduce((a, b) => (a.stat.mean < b.stat.mean ? a : b))
    const busiest = arr.reduce((a, b) => (a.stat.count > b.stat.count ? a : b))
    return { pressure, busiest }
  }, [stats])

  const hoverBlock = hoverLoc ? BLUE_BLOCKS[hoverLoc] : undefined
  const hoverScene = hoverLoc ? getScene(hoverLoc) : undefined
  const hoverStat = hoverLoc ? stats.get(hoverLoc) : undefined

  return (
    <div ref={ref}>
      <div className="relative">
        <svg viewBox="0 0 1000 452" className="w-full">
          {/* 蓝图标注:比例尺 / 指北针 / 十字标记 */}
          <motion.g
            stroke={CYAN}
            strokeOpacity={0.35}
            strokeWidth={1}
            fill="none"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 0.2 }}
          >
            <line x1={156} y1={72} x2={968} y2={72} />
            <line x1={156} y1={67} x2={156} y2={77} />
            <line x1={968} y1={67} x2={968} y2={77} />
            {[[600, 416], [300, 416], [906, 56], [80, 330]].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
                <line x1={x} y1={y - 5} x2={x} y2={y + 5} />
              </g>
            ))}
            <circle cx={84} cy={352} r={16} />
            <line x1={84} y1={362} x2={84} y2={344} />
            <path d="M 80 350 L 84 342 L 88 350" />
          </motion.g>
          <motion.text
            x={562}
            y={66}
            textAnchor="middle"
            fontSize={9}
            letterSpacing="0.2em"
            className="font-mono"
            fill={CYAN}
            fillOpacity={0.5}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 0.3 }}
          >
            M.V. NIGHT FERRY · DECK PLAN 1:200 · LOA 78M
          </motion.text>
          <motion.text
            x={84}
            y={392}
            textAnchor="middle"
            fontSize={9}
            className="font-mono"
            fill={CYAN}
            fillOpacity={0.5}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 0.3 }}
          >
            N
          </motion.text>

          {/* 岸线区域 */}
          <motion.rect
            x={16}
            y={42}
            width={136}
            height={248}
            fill="none"
            stroke={CYAN}
            strokeOpacity={0.3}
            strokeDasharray="6 5"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 0.1 }}
          />
          <motion.text
            x={84}
            y={54}
            textAnchor="middle"
            fontSize={9}
            letterSpacing="0.24em"
            className="font-mono"
            fill={CYAN}
            fillOpacity={0.5}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 0.2 }}
          >
            岸 SHORE
          </motion.text>

          {/* 船体轮廓 */}
          <motion.path
            d={HULL_PATH}
            fill="rgba(77,216,255,0.02)"
            stroke={CYAN}
            strokeOpacity={0.45}
            strokeWidth={1.2}
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : undefined}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />

          {/* 12 个场景块(线框描边生长) */}
          {SCENES.map((s, i) => {
            const b = BLUE_BLOCKS[s.id]
            const st = stats.get(s.id)
            if (!b || !st) return null
            const isBoat = b.deco === 'boat'
            return (
              <motion.g
                key={s.id}
                onMouseEnter={() => setHoverLoc(s.id)}
                onMouseLeave={() => setHoverLoc(null)}
                className="cursor-crosshair"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{ delay: 0.25 + i * 0.06 }}
              >
                <motion.rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={isBoat ? 16 : 2}
                  fill={hoverLoc === s.id ? 'rgba(77,216,255,0.08)' : 'rgba(77,216,255,0.03)'}
                  stroke={CYAN}
                  strokeWidth={1}
                  strokeDasharray={b.dashed ? '5 4' : undefined}
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : undefined}
                  transition={{ duration: 0.8, delay: 0.25 + i * 0.06 }}
                  style={{ transition: 'fill 0.2s' }}
                />
                {/* 装饰:集装箱 / 舰桥窗 / 海浪 / 机房 hatch */}
                {b.deco === 'containers' && (
                  <g stroke={CYAN} strokeOpacity={0.22}>
                    {[0.25, 0.5, 0.75].map((f) => (
                      <line key={f} x1={b.x + b.w * f} y1={b.y + 6} x2={b.x + b.w * f} y2={b.y + b.h - 6} />
                    ))}
                    <line x1={b.x + 6} y1={b.y + b.h / 2} x2={b.x + b.w - 6} y2={b.y + b.h / 2} />
                  </g>
                )}
                {b.deco === 'windows' && (
                  <g stroke={CYAN} strokeOpacity={0.35}>
                    {[0.2, 0.45, 0.7].map((f) => (
                      <line key={f} x1={b.x + b.w * f} y1={b.y + 8} x2={b.x + b.w * f + 14} y2={b.y + 8} strokeWidth={2} />
                    ))}
                  </g>
                )}
                {b.deco === 'waves' && (
                  <g stroke={CYAN} strokeOpacity={0.3} fill="none">
                    <path d={`M ${b.x + 12} ${b.y + b.h - 12} q 6 -6 12 0 t 12 0 t 12 0`} />
                    <path d={`M ${b.x + b.w - 60} ${b.y + 14} q 6 -6 12 0 t 12 0 t 12 0`} />
                  </g>
                )}
                {b.deco === 'hatch' && (
                  <g stroke={CYAN} strokeOpacity={0.25}>
                    {[0, 1, 2].map((k) => (
                      <line key={k} x1={b.x + b.w - 34 + k * 10} y1={b.y + b.h - 8} x2={b.x + b.w - 22 + k * 10} y2={b.y + b.h - 20} />
                    ))}
                  </g>
                )}
                {/* 标签 */}
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : undefined}
                  transition={{ delay: 0.7 + i * 0.06 }}
                >
                  <text
                    x={isBoat ? b.x + b.w / 2 : b.x + 10}
                    y={b.y + (isBoat ? 14 : 19)}
                    textAnchor={isBoat ? 'middle' : 'start'}
                    fontSize={11}
                    className="fill-paper font-mono"
                  >
                    {s.code} {s.name}
                  </text>
                  <text
                    x={isBoat ? b.x + b.w / 2 : b.x + 10}
                    y={b.y + (isBoat ? 27 : 34)}
                    textAnchor={isBoat ? 'middle' : 'start'}
                    fontSize={10}
                    fill={CYAN}
                    className="font-mono"
                  >
                    ×{st.count} 场
                  </text>
                  {!isBoat && (
                    <circle cx={b.x + b.w - 12} cy={b.y + 12} r={3} fill={emotionColor(st.mean)} fillOpacity={0.9} />
                  )}
                </motion.g>
              </motion.g>
            )
          })}

          {/* 未登记空间(压载舱) */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 1.1 }}
          >
            <rect x={568} y={286} width={282} height={74} fill="none" stroke={CYAN} strokeOpacity={0.25} strokeDasharray="3 4" />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <line
                key={k}
                x1={576 + k * 46}
                y1={354}
                x2={606 + k * 46}
                y2={292}
                stroke={CYAN}
                strokeOpacity={0.12}
              />
            ))}
            <text x={709} y={327} textAnchor="middle" fontSize={9} letterSpacing="0.2em" className="font-mono" fill={CYAN} fillOpacity={0.4}>
              VOID · 未登记空间
            </text>
          </motion.g>

          {/* 海浪 */}
          <motion.g
            stroke={CYAN}
            fill="none"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 0.25 } : undefined}
            transition={{ delay: 1.2 }}
          >
            <path d={wavePath(440, 5, 50)} />
            <path d={wavePath(450, 4, 40)} />
          </motion.g>
        </svg>

        {/* hover tooltip:场景 / 场次数 / 情绪均值 / 关键事件 */}
        {hoverBlock && hoverScene && hoverStat && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-ink-line bg-ink-950/95 px-3 py-2 font-mono text-[0.6875rem] leading-5 text-paper shadow-xl"
            style={{
              left: `${((hoverBlock.x + hoverBlock.w / 2) / 1000) * 100}%`,
              top: `${(hoverBlock.y / 452) * 100}%`,
              transform: `translate(${(hoverBlock.x + hoverBlock.w / 2) / 1000 > 0.78 ? '-90%' : (hoverBlock.x + hoverBlock.w / 2) / 1000 < 0.18 ? '-10%' : '-50%'}, -118%)`,
            }}
          >
            <div className="whitespace-nowrap text-paper">
              {hoverScene.code} {hoverScene.name}
              <span className="ml-2 text-cyan">×{hoverStat.count} 场</span>
            </div>
            <div className="whitespace-nowrap text-paper-dim">
              情绪均值 <span style={{ color: emotionColor(hoverStat.mean) }}>{hoverStat.mean.toFixed(1)}</span>
            </div>
            {hoverStat.keyBeat && (
              <div className="whitespace-nowrap text-paper-dim">
                关键事件:场{String(hoverStat.keyBeat.index).padStart(2, '0')} {hoverStat.keyBeat.title}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 洞察行(延迟淡入) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: 0.6, duration: 0.6, ease: EASE }}
        className="mt-5 flex items-start gap-3 rounded-xl border border-cyan/25 bg-cyan/5 px-4 py-3"
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
        <p className="text-sm leading-6 text-paper-dim">
          <span className="text-paper">{insight.pressure.s.name}</span> {insight.pressure.stat.count} 场戏、情绪均值{' '}
          <span className="font-mono text-rose">{insight.pressure.stat.mean.toFixed(1)}</span>
          ,是全剧的「压力锅」;<span className="text-paper">{insight.busiest.s.name}</span> 以{' '}
          <span className="font-mono text-cyan">{insight.busiest.stat.count}</span> 场成为最高频空间 ——
          建议保持两处视觉母题的一致性。
        </p>
      </motion.div>
    </div>
  )
}

/* ──────────────────────────── S7 · 改稿建议清单 ──────────────────────────── */

interface Revision {
  p: 'P0' | 'P1' | 'P2'
  color: string
  title: string
  problem: string
  beats: number[]
  fix: string
}

const REVISIONS: Revision[] = [
  {
    p: 'P0',
    color: ROSE,
    title: '修复场30 之后的情绪断裂',
    problem:
      '场30「老鬼之死」把情绪打到谷值 -4.2,场31 却直接进入全员猜忌的群戏——观众没有时间消化这场死亡,情绪曲线出现一次「假性复位」,高潮前的蓄势被削弱。',
    beats: [30, 31],
    fix: '在场30 与场31 之间插入一场 1 页以内的静默哀悼戏:轰鸣停了七秒的轮机室空镜、阿灿伸手合上老鬼的眼睛、林晚把那半张舱单复印件收进贴身处。零对白,用声音设计承接谷值。',
  },
  {
    p: 'P1',
    color: AMBER,
    title: '为阿灿增加 ACT I 伏笔',
    problem:
      '阿灿在 ACT II 的营救(场29)与 ACT III 的信号弹(场38)是全剧两次关键解围,但 ACT I 中他只有场6 烫伤求助一次功能性出场,高光时刻缺乏前置铺垫。',
    beats: [6, 29, 38],
    fix: '在 ACT I 增加阿灿与救生艇甲板 / 信号弹箱的一次接触(可并入场7 信号失联后的夜巡),让场38 的一拉成为「回收」而非「巧合」。',
  },
  {
    p: 'P1',
    color: AMBER,
    title: '压缩场18–场24 的平铺段落',
    problem:
      '场18 到场24 连续七场维持在 -2.5 至 -4 的低压平台,信息密度下降;餐厅场景在场23 / 场24 连续出现,空间与威胁都在重复。',
    beats: [18, 23, 24],
    fix: '合并场23「白露失联」与场24「血色餐刀」为一场餐厅戏:空座位与缠着丝巾的餐刀同场出现,威胁一步到位,为场25 江离的独白腾出呼吸。',
  },
  {
    p: 'P2',
    color: CYAN,
    title: '韩崇对白量过高(第 3 位)但戏剧功能单一',
    problem:
      '韩崇以 165 句对白排名第 3,但功能几乎只有「威胁」一种;盘问与说明性台词偏多,反派的压迫感应来自行动而非解释。',
    beats: [11, 31, 37],
    fix: '削减场11、场31 约三分之一的说明性台词,改为动作与沉默;把关键信息转移进场37 救生艇博弈的对价谈判,让反派「少说、多要」。',
  },
  {
    p: 'P2',
    color: CYAN,
    title: '为「旧照片」增加一次视觉回 call',
    problem:
      '旧照片在场3 首次露面,场22 / 场25 完成叙事功能后于场33 最后一次出现;结尾场42 的黎明码头没有任何回收,信物弧光未闭合。',
    beats: [3, 22, 25, 33, 42],
    fix: '在场42 尾声增加一个镜头:林晚的报道付印,桌角压着那张修复过的合影——与场3 相框里露出的一角形成首尾对位。',
  },
]

function RevisionList() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <div className="mt-10 space-y-3">
      {REVISIONS.map((r, i) => {
        const open = openIdx === i
        return (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.08, duration: 0.55, ease: EASE }}
            className={cn(
              'overflow-hidden rounded-xl border bg-ink-900 transition-colors duration-300',
              open ? 'border-ink-line' : 'border-ink-line hover:border-paper-dim/30',
            )}
          >
            <button
              onClick={() => setOpenIdx(open ? null : i)}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <motion.span
                whileHover={{ scale: [1, 1.15, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.45 }}
                className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] font-bold"
                style={{ borderColor: `${r.color}66`, color: r.color }}
              >
                {r.p}
              </motion.span>
              <span className="flex-1 font-medium text-paper">{r.title}</span>
              <span className="hidden shrink-0 font-mono text-[0.6875rem] text-paper-dim md:block">
                {r.beats.map((b) => `场${String(b).padStart(2, '0')}`).join(' · ')}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-paper-dim transition-transform duration-300', open && 'rotate-180 text-amber')}
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4 px-5 pb-5 pt-1">
                    <div>
                      <p className="mono-tick">问题描述</p>
                      <p className="mt-1.5 text-sm leading-7 text-paper-dim">{r.problem}</p>
                    </div>
                    <div>
                      <p className="mono-tick">涉及场次</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {r.beats.map((b) => {
                          const beat = getBeat(b)
                          return (
                            <span
                              key={b}
                              className="inline-flex items-center gap-1.5 rounded-full border border-ink-line bg-ink-950/60 px-2.5 py-1 font-mono text-[0.6875rem] text-paper-dim"
                            >
                              <span className="text-amber">场{String(b).padStart(2, '0')}</span>
                              {beat?.title}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mono-tick">修改方向</p>
                      <p className="mt-1.5 border-l-2 border-amber/50 pl-3 text-sm leading-7 text-paper">{r.fix}</p>
                    </div>
                    <Link
                      to="/agent"
                      className="group/agent mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-cyan/40 px-4 py-2 font-mono text-[0.75rem] text-cyan transition-colors duration-300 hover:bg-cyan/10"
                    >
                      交给 Agent 处理
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-500 group-hover/agent:rotate-180" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ──────────────────────────── 页面 ──────────────────────────── */

export default function Analysis() {
  return (
    <div className="relative">
      {/* S1 · 页首 + 总评分 */}
      <section className="relative overflow-hidden py-16">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="spotlight pointer-events-none absolute inset-0" />
        <div className="site-container relative grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className="mono-label flex items-center gap-3">
              <span className="inline-block h-px w-6 bg-amber" />
              ROOM.03 — DIAGNOSIS
            </p>
            <h1 className="mt-5 font-serif text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[1.05] tracking-tight">
              <span className="text-gradient">剧本评估</span>
            </h1>
            <p className="mt-4 font-mono text-[0.75rem] tracking-[0.12em] text-paper-dim">
              《夜航》第一稿 · {SCRIPT_STATS.beats} 场 · 评估于 2024-06
            </p>
            <p className="mt-5 max-w-xl leading-7 text-paper-dim">
              把剧本当作一个可体检的有机体:结构、节拍、对白、场景利用与人物弧光,全部量化为可诊断的指标,
              并给出可直接进入改稿流水线的修复方案。
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          >
            <PanelCard index="SCORE" accent={AMBER}>
              <p className="mb-2 mt-4 flex items-center justify-center gap-2 font-mono text-[0.6875rem] tracking-[0.18em] text-paper-dim">
                <Gauge className="h-3.5 w-3.5 text-amber" />
                总评分 OVERALL
              </p>
              <ScoreGauge />
            </PanelCard>
          </motion.div>
        </div>
      </section>

      {/* S2 · 三幕结构节拍带 */}
      <section className="site-container py-8">
        <PanelCard index="FIG.01 — BEAT SHEET" accent={AMBER}>
          <div className="mb-5 mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-bold text-paper">三幕结构节拍带</h3>
            <p className="mono-tick">
              {SCRIPT_STATS.beats} 场 · {SCRIPT_STATS.keyBeats} 个关键节拍 · 经典曲线对照
            </p>
          </div>
          <BeatSheet />
        </PanelCard>
      </section>

      {/* S3 + S4 · 六维雷达 + 指标卡阵 */}
      <section className="site-container grid gap-6 py-8 lg:grid-cols-2">
        <PanelCard index="FIG.02 — RADAR" accent={AMBER}>
          <div className="mb-2 mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2.5 font-serif text-lg font-bold text-paper">
              <Radar className="h-5 w-5 text-amber" />
              六维评估雷达
            </h3>
            <p className="mono-tick">六轴均值 81.8 → 总评 82</p>
          </div>
          <RadarChart />
        </PanelCard>
        <MetricGrid />
      </section>

      {/* S5 · 对白与话语权分析 */}
      <section className="site-container grid gap-6 py-8 lg:grid-cols-2">
        <PanelCard index="FIG.03 — DIALOGUE SHARE" accent={AMBER}>
          <div className="mb-5 mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-bold text-paper">对白量分布</h3>
            <p className="mono-tick">8 人物 · {SCRIPT_STATS.dialogueLines} 句</p>
          </div>
          <DialogueShare />
        </PanelCard>
        <PanelCard index="FIG.04 — INTERACTION" accent={AMBER}>
          <div className="mb-5 mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-bold text-paper">人物对白往来矩阵</h3>
            <p className="mono-tick">8 × 8 · hover 查看详情</p>
          </div>
          <InteractionMatrix />
        </PanelCard>
      </section>

      {/* S6 · 场景利用地图 */}
      <section className="site-container py-8">
        <PanelCard index="FIG.05 — LOCATIONS" accent={CYAN}>
          <div className="mb-5 mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2.5 font-serif text-lg font-bold text-paper">
              <MapIcon className="h-5 w-5 text-cyan" />
              场景利用地图
            </h3>
            <p className="mono-tick">12 场景 · 块面积 ∝ 使用场次数</p>
          </div>
          <BlueprintMap />
        </PanelCard>
      </section>

      {/* S7 · 改稿建议清单 */}
      <section className="site-container py-16">
        <SectionHeader
          eyebrow="CHAPTER — REVISION"
          title={
            <span className="flex items-center gap-3">
              <ClipboardList className="h-7 w-7 text-amber" />
              改稿建议清单
            </span>
          }
          description="按优先级排序的 5 条可执行修改:每条都定位到具体场次,可一键交给 Agent 进入改稿流水线。"
        />
        <RevisionList />
      </section>
    </div>
  )
}
