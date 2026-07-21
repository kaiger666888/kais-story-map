import { motion } from 'framer-motion'
import { SectionHeader } from '@/components/common'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const STEPS = [
  { no: '01', title: '导入', desc: '粘贴剧本原文(幕场格式),自动切分场景与对白。', color: '#F2EAD8' },
  { no: '02', title: '解剖', desc: '引擎抽取人物 / 道具 / 场景 / 情绪,生成拓扑。', color: '#FFB347' },
  { no: '03', title: '评估', desc: '结构与情绪指标体检,找到断裂的节拍。', color: '#FF4D6D' },
  { no: '04', title: '创作', desc: '把图谱交给 Agent 改写,再导出回剧本。', color: '#4DD8FF' },
]

/** S6 · 工作流「从可视化到创作」 */
export default function Workflow() {
  return (
    <section className="relative py-28">
      <div className="site-container">
        <SectionHeader
          eyebrow="CHAPTER 03 — WORKFLOW"
          title="从可视化到创作,四步闭环"
          description="可视化不是终点。评估出的问题直接交给 Agent 改稿,改完再长回剧本。"
        />

        <div className="mt-16 grid gap-10 md:grid-cols-4 md:gap-0">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.no}
              className="group relative md:px-6"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.14, duration: 0.65, ease: EASE }}
            >
              {/* 连接虚线(桌面) */}
              {i < STEPS.length - 1 && (
                <motion.svg
                  className="absolute -right-6 top-7 hidden h-4 w-12 md:block"
                  viewBox="0 0 48 16"
                  fill="none"
                  aria-hidden
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.2, duration: 0.4 }}
                >
                  <motion.line
                    x1="0"
                    y1="8"
                    x2="40"
                    y2="8"
                    stroke="#26262F"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.2, duration: 0.4 }}
                  />
                  <path d="M38 3 L46 8 L38 13" stroke="#26262F" strokeWidth="1.5" fill="none" />
                </motion.svg>
              )}

              <p
                className="font-display text-6xl font-black italic leading-none transition-all duration-300 group-hover:rotate-[-4deg]"
                style={{ color: `${step.color}55` }}
              >
                {step.no}
              </p>
              <h3
                className="mt-4 font-serif text-xl font-bold text-paper transition-colors duration-300"
                style={{ textDecorationColor: step.color }}
              >
                {step.title}
              </h3>
              <p className="mt-2.5 text-sm leading-7 text-paper-dim">{step.desc}</p>
              <span
                className="mt-4 block h-0.5 w-8 rounded-full transition-all duration-300 group-hover:w-14"
                style={{ backgroundColor: step.color }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
