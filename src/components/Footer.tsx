import { useRef } from 'react'
import { Link } from 'react-router'
import { motion, useScroll, useTransform } from 'framer-motion'

const LAYER_LINKS = [
  { layer: '皮', en: 'SKIN', desc: '原文与对白', to: '/cases', color: '#F2EAD8' },
  { layer: '骨', en: 'BONE', desc: '结构与节拍', to: '/analysis', color: '#FFB347' },
  { layer: '肉', en: 'FLESH', desc: '关系与情绪', to: '/graph', color: '#FF4D6D' },
  { layer: '神经', en: 'NERVE', desc: 'Agent 接口', to: '/agent', color: '#4DD8FF' },
]

const NODE_COLORS = ['#FFB347', '#FF4D6D', '#4DD8FF', '#A78BFA', '#7BE0A3']

export default function Footer() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const watermarkY = useTransform(scrollYProgress, [0, 1], [60, 0])

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-ink-line bg-ink-950">
      {/* 图谱边分隔线:5 色节点 */}
      <div className="site-container flex items-center gap-0 py-0" aria-hidden>
        {NODE_COLORS.map((c, i) => (
          <div key={c} className="flex flex-1 items-center">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}66` }} />
            {i < NODE_COLORS.length - 1 && <span className="h-px flex-1 bg-ink-line" />}
          </div>
        ))}
      </div>

      <div className="site-container grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/icon-layers.svg" alt="" className="h-9 w-9" />
            <span className="font-serif text-xl font-black text-paper">
              剧核 <span className="text-paper-dim">DramaCore</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-paper-dim">
            剧本的 X 光机与手术台——把线性文本解剖成多维拓扑,
            让评估与创作都发生在图谱之上。
          </p>
          <p className="mono-tick mt-6">SCRIPT → TOPOLOGY → SCRIPT</p>
        </div>

        {/* 四层索引 */}
        <div>
          <p className="mono-label mb-5">LAYERS — 四层解剖</p>
          <ul className="space-y-3">
            {LAYER_LINKS.map((l) => (
              <li key={l.layer}>
                <Link to={l.to} className="group flex items-baseline gap-3">
                  <span
                    className="font-serif text-base font-black transition-transform duration-300 group-hover:-translate-y-0.5"
                    style={{ color: l.color }}
                  >
                    {l.layer}
                  </span>
                  <span className="font-display text-xs italic" style={{ color: l.color }}>
                    {l.en}
                  </span>
                  <span className="text-sm text-paper-dim transition-colors group-hover:text-paper">{l.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 技术栈与数据说明 */}
        <div>
          <p className="mono-label mb-5">STACK — 技术与数据</p>
          <ul className="space-y-2 font-mono text-xs leading-6 text-paper-dim">
            <li>React 19 · TypeScript · Vite</li>
            <li>d3-force · d3-shape · three / R3F</li>
            <li>GSAP ScrollTrigger · Framer Motion · Lenis</li>
            <li className="pt-2 text-paper-dim/70">
              演示数据:《夜航 NIGHT FERRY》
              <br />8 人物 · 12 场景 · 6 道具 · 42 场戏
            </li>
          </ul>
        </div>
      </div>

      {/* 水印大字 */}
      <div className="pointer-events-none relative select-none overflow-hidden">
        <motion.div
          style={{ y: watermarkY, opacity: 0.06 }}
          className="site-container pb-2 text-center font-display text-[clamp(4rem,14vw,12rem)] font-black italic leading-none tracking-tight text-paper"
          aria-hidden
        >
          DRAMACORE
        </motion.div>
      </div>

      <div className="border-t border-ink-line">
        <div className="site-container flex flex-col items-center justify-between gap-2 py-5 md:flex-row">
          <p className="mono-tick">© 2025 DRAMACORE — DISSECT YOUR SCRIPT</p>
          <p className="mono-tick">SKIN / BONE / FLESH / NERVE</p>
        </div>
      </div>
    </footer>
  )
}
