import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Network, Activity, Gauge, Bot, ArrowRight } from 'lucide-react'
import { SectionHeader } from '@/components/common'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const ROOMS = [
  {
    no: 'ROOM.01',
    to: '/graph',
    icon: Network,
    title: '关系图谱',
    desc: '人物、道具、场景力导向拓扑。拖拽、筛选、追踪任意两个要素之间的路径。',
    accent: '#FFB347',
  },
  {
    no: 'ROOM.02',
    to: '/emotion',
    icon: Activity,
    title: '情绪曲线',
    desc: '全剧与单人物情绪走向,逐场拆解,定位高潮与塌陷点。',
    accent: '#FF4D6D',
  },
  {
    no: 'ROOM.03',
    to: '/analysis',
    icon: Gauge,
    title: '剧本评估',
    desc: '结构雷达、节拍完整性、对白密度,给出可执行的改稿建议。',
    accent: '#4DD8FF',
  },
  {
    no: 'ROOM.04',
    to: '/agent',
    icon: Bot,
    title: 'Agent 协作',
    desc: '把图谱交给 Agent:设计人物、布置道具、规划场景、谱写情绪。',
    accent: '#A78BFA',
  },
]

/** S3 · 功能全景「一台四室」 */
export default function FeatureGrid() {
  return (
    <section className="relative py-28">
      <div className="site-container">
        <SectionHeader
          eyebrow="CHAPTER 01 — CONSOLE"
          title="四个工作台,一张图谱"
          description="解剖完成的剧本拓扑,同时驱动四个工作台。你在任何一室的改动,都会实时写回同一张图。"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {ROOMS.map((room, i) => (
            <motion.div
              key={room.no}
              initial={{ opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: EASE }}
            >
              <Link
                to={room.to}
                className="group relative block overflow-hidden rounded-2xl border border-ink-line bg-ink-900 p-8 transition-all duration-300 hover:-translate-y-1.5"
                style={{ ['--accent' as string]: room.accent }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${room.accent}66`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = ''
                }}
              >
                {/* 层色径向微光 */}
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle, ${room.accent}1f, transparent 65%)` }}
                  aria-hidden
                />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim">{room.no}</span>
                    <room.icon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" style={{ color: room.accent }} />
                  </div>
                  <h3 className="mt-8 font-serif text-2xl font-bold text-paper">{room.title}</h3>
                  <p className="mt-3 max-w-sm leading-7 text-paper-dim">{room.desc}</p>
                  <span className="mt-7 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em]" style={{ color: room.accent }}>
                    进入
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
