import { motion } from 'framer-motion'

const TITLE = '情绪曲线'.split('')

/** S1 · 页首:mono 眉题 + 逐字上浮 H1 + 说明 + 情绪标尺图例 */
export default function PageHeader() {
  return (
    <section className="site-container flex flex-col gap-10 py-16 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="mono-label flex items-center gap-3">
          <span className="inline-block h-px w-6 bg-rose" />
          ROOM.02 — EMOTION
        </p>
        <h1
          className="mt-5 font-serif text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.02em]"
          aria-label="情绪曲线"
        >
          {TITLE.map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block text-gradient"
              initial={{ y: 34, opacity: 0, rotate: i % 2 === 0 ? 2 : -2 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.08 + i * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>
        <motion.p
          className="mt-5 leading-7 text-paper-dim"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          42 场戏,4 条人物情绪线,1 条全剧张力线。情绪标尺 -5(绝望)至 +5(狂喜)。
          悬停任意图表可探查逐场数值,点击事件标记可展开该场详情。
        </motion.p>
      </div>

      {/* 情绪标尺图例 */}
      <motion.div
        className="w-full max-w-xs shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <p className="mono-tick mb-2.5 flex items-center justify-between">
          <span>EMOTION SCALE</span>
          <span className="text-paper-dim/60">VALENCE</span>
        </p>
        <motion.div
          className="h-2.5 w-full rounded-full gradient-emotion"
          style={{ transformOrigin: 'left center' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="mt-2 flex justify-between font-mono text-[0.6875rem] tracking-[0.08em]">
          <span className="text-cyan">-5 绝望</span>
          <span className="text-paper-dim">0</span>
          <span className="text-rose">+5 狂喜</span>
        </div>
      </motion.div>
    </section>
  )
}
