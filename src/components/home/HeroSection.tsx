import { Suspense, lazy } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import MiniGraph from '@/components/home/MiniGraph'

const ParticleField = lazy(() => import('@/components/home/ParticleField'))

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface CharSpec {
  ch: string
  color?: string
}

/** 第一行:「把剧本从皮到骨到肉」— 皮 / 骨 / 肉 分别染层色 */
const LINE1: CharSpec[] = [
  { ch: '把' },
  { ch: '剧' },
  { ch: '本' },
  { ch: '从' },
  { ch: '皮', color: '#F2EAD8' },
  { ch: '到' },
  { ch: '骨', color: '#FFB347' },
  { ch: '到' },
  { ch: '肉', color: '#FF4D6D' },
]

const LINE2: CharSpec[] = [...'完全摊开在你面前'].map((ch) => ({ ch }))

function AnimatedLine({ chars, offset }: { chars: CharSpec[]; offset: number }) {
  return (
    <span className="block">
      {chars.map((c, i) => (
        <motion.span
          key={`${c.ch}-${i}`}
          className="inline-block"
          style={c.color ? { color: c.color, textShadow: `0 0 32px ${c.color}55` } : undefined}
          initial={{ y: 60, rotate: 2, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2 + (offset + i) * 0.04, duration: 0.8, ease: EASE }}
        >
          {c.ch}
        </motion.span>
      ))}
    </span>
  )
}

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden bg-ink-950">
      {/* 粒子星群(全站唯一 3D 常驻效果) */}
      <Suspense fallback={null}>
        <ParticleField />
      </Suspense>
      {/* 聚光灯光斑 */}
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />

      <div className="site-container relative z-10 grid w-full items-center gap-10 py-24 lg:grid-cols-[55%_45%]">
        {/* 左侧标题区 */}
        <div>
          <motion.p
            className="mono-label"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: EASE }}
          >
            SCRIPT → TOPOLOGY — 从文本到图谱
          </motion.p>

          <h1 className="mt-6 font-serif text-[clamp(3rem,8vw,7rem)] font-black leading-[1.05] tracking-[-0.02em] text-paper">
            <AnimatedLine chars={LINE1} offset={0} />
            <AnimatedLine chars={LINE2} offset={LINE1.length} />
          </h1>

          <motion.p
            className="mt-7 max-w-xl text-lg leading-8 text-paper-dim"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7, ease: EASE }}
          >
            人物 · 道具 · 场景 · 情绪 · 结构 —— 一切关联要素编织成一张
            <span className="text-paper">可评估、可设计、可反哺创作</span>的拓扑图谱。
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7, ease: EASE }}
          >
            <Link
              to="/agent"
              className="group flex items-center gap-2 rounded-full bg-amber px-6 py-3.5 text-base font-bold text-ink-950 transition-all duration-300 hover:shadow-glow-amber"
            >
              导入剧本,开始解剖
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/graph"
              className="rounded-full border border-paper/40 px-6 py-3.5 text-base font-medium text-paper transition-colors duration-300 hover:bg-paper/10"
            >
              先逛逛示例《夜航》
            </Link>
          </motion.div>
        </div>

        {/* 右侧实时微缩图谱 */}
        <motion.div
          className="relative hidden h-[62vh] lg:block"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 1, ease: EASE }}
        >
          <div className="absolute inset-0 rounded-3xl border border-ink-line/60 bg-ink-900/20 backdrop-blur-[2px]" />
          <MiniGraph />
          <div className="pointer-events-none absolute bottom-4 left-5 flex gap-4 font-mono text-[0.6875rem] tracking-[0.08em] text-paper-dim">
            <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle" />人物</span>
            <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan align-middle" />场景</span>
            <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-violet align-middle" />道具</span>
            <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose align-middle" />情绪</span>
          </div>
          <p className="pointer-events-none absolute right-5 top-4 font-mono text-[0.6875rem] tracking-[0.12em] text-paper-dim/70">
            LIVE TOPOLOGY — 40 NODES
          </p>
        </motion.div>
      </div>

      {/* 底部滚动提示 */}
      <motion.div
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
      >
        <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-paper-dim">SCROLL TO DISSECT</span>
        <span className="block h-10 w-px animate-scroll-pulse bg-amber" />
      </motion.div>
    </section>
  )
}
