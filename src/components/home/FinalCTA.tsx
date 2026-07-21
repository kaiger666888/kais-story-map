import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const TITLE = [...'你的下一部戏,']

/** S7 · 最终 CTA */
export default function FinalCTA() {
  const [value, setValue] = useState('')

  return (
    <section className="relative overflow-hidden py-36">
      {/* 聚光灯径向渐变 */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 40%, rgba(255,179,71,0.13), transparent 65%)' }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1.2 }}
        aria-hidden
      />

      <div className="site-container relative z-10 mx-auto max-w-[720px] text-center">
        <h2 className="font-serif text-[clamp(2rem,5vw,3.6rem)] font-black leading-tight text-paper">
          {TITLE.map((ch, i) => (
            <motion.span
              key={`${ch}-${i}`}
              className="inline-block"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.03, duration: 0.6, ease: EASE }}
            >
              {ch}
            </motion.span>
          ))}
          <motion.span
            className="text-gradient inline-block"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: TITLE.length * 0.03 + 0.05, duration: 0.7, ease: EASE }}
          >
            先从看见它开始。
          </motion.span>
        </h2>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.35, duration: 0.7, ease: EASE }}
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-ink-line bg-ink-900/80 p-3 backdrop-blur-sm transition-colors duration-200 focus-within:border-amber sm:flex-row">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="粘贴你的剧本第一幕……"
              className="h-12 flex-1 rounded-xl border border-transparent bg-ink-800 px-4 text-sm text-paper placeholder:text-paper-dim/60 focus:border-amber focus:outline-none"
            />
            <button
              type="button"
              className="group flex h-12 items-center justify-center gap-2 rounded-xl bg-amber px-6 text-sm font-bold text-ink-950 transition-all duration-300 hover:scale-[1.03] hover:shadow-glow-amber"
            >
              免费开始解剖
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
          <p className="mono-tick mt-5">无需注册 · 演示数据即时可看</p>
        </motion.div>
      </div>
    </section>
  )
}
