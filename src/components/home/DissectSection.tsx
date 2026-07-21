import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { LayerBadge, LAYER_META } from '@/components/common'
import type { LayerId } from '@/components/common'

gsap.registerPlugin(ScrollTrigger)

interface ActCopy {
  layer: LayerId
  title: string
  desc: string
  points: string[]
}

const ACTS_COPY: ActCopy[] = [
  {
    layer: 'skin',
    title: '每一句对白,都还是一个可索引的节点。',
    desc: '原文不是一堆死文字。剧本导入后,每一场戏、每一句台词、每一个场景标题都被切成带坐标的节点,随时可以溯源、定位、引用。',
    points: ['42 场戏', '8 人物', '1,204 句对白'],
  },
  {
    layer: 'bone',
    title: '三幕、节拍、场景序列,撑起整部戏的脊椎。',
    desc: '结构引擎把剧本折成三幕与十四个关键节拍,暴露节奏断点:哪里塌陷、哪里注水、哪里该来的高潮没有来。',
    points: ['3 幕', '14 个关键节拍', '节奏熵 0.71'],
  },
  {
    layer: 'flesh',
    title: '谁恨谁、谁带着那把钥匙、情绪在哪一场断裂 —— 全部可见。',
    desc: '人物关系、道具流转、逐场情绪,全部叠回同一张拓扑图。你看到的不再是孤立的设定,而是它们之间的张力。',
    points: ['26 条人物关系', '6 件道具流转', '情绪振幅 ±4.2'],
  },
  {
    layer: 'nerve',
    title: '同一张图,Agent 可以读,也可以写。设计即拓扑,拓扑即剧本。',
    desc: '图谱暴露成标准 JSON Schema。Agent 在图上设计人物、布置道具、规划场景、谱写情绪,改动双向同步回剧本。',
    points: ['JSON Schema', '4 类 Agent', '双向同步'],
  },
]

/** 逐字抖动用的假台词行 */
const SHEET_LINES: Record<LayerId, string[]> = {
  skin: ['INT. 底舱货仓 — 夜', '林晚:(低声) 第 9 栏……', '是空的。', '【滴水声】'],
  bone: ['ACT II · 场 21', 'BEAT: 密室开启', 'TURN: 钥匙转动', '∑ PACE 0.71'],
  flesh: ['林晚 — 韩崇: -4', '钥匙 → 林晚 @15', 'EMO S30: -4.2', 'REL × 26'],
  nerve: ['POST /graph/nodes', 'PATCH /edges/r07', 'agent: designer', 'sync: bidirectional'],
}

/**
 * S2 · 剧本解剖叙事 — GSAP ScrollTrigger pin 400vh,四幕滚动解剖。
 * 本组件树内只用 GSAP(不用 Framer Motion),见 react-dev.md 库隔离规则。
 */
export default function DissectSection() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return

      const sheets = gsap.utils.toArray<HTMLElement>('.dissect-sheet')
      const panels = gsap.utils.toArray<HTMLElement>('.dissect-panel')
      const badges = gsap.utils.toArray<HTMLElement>('.dissect-badge')

      // 初始:四张"剧本文档"层叠放
      sheets.forEach((sheet, i) => {
        gsap.set(sheet, { y: i * 10 - 15, rotateX: 0, zIndex: 10 - i })
      })
      panels.forEach((panel, i) => {
        gsap.set(panel, { autoAlpha: i === 0 ? 1 : 0, x: i === 0 ? 0 : 40 })
      })

      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: '+=300%',
          pin: true,
          scrub: 0.8,
          onUpdate: (self) => {
            setActive(Math.min(3, Math.floor(self.progress * 4)))
          },
        },
      })

      ACTS_COPY.forEach((act, i) => {
        const meta = LAYER_META[act.layer]
        const s = i // 每幕占 1 个时间单位
        if (i > 0) {
          // 文字入场:translateX 40→0 + opacity 0→1
          tl.fromTo(panels[i], { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.22 }, s + 0.04)
          // LayerBadge 200ms 缩放脉冲
          tl.fromTo(badges[i], { scale: 1 }, { scale: 1.04, duration: 0.08, yoyo: true, repeat: 1 }, s + 0.04)
        }
        // 文档层剥离:各自的层色 + 间隙
        tl.to(
          sheets[i],
          {
            y: (i - 1.5) * 118,
            rotateX: -10,
            borderColor: `${meta.color}88`,
            boxShadow: `0 0 32px ${meta.color}26`,
            duration: 0.5,
            ease: 'power3.out',
          },
          s + 0.06,
        )
        if (i < ACTS_COPY.length - 1) {
          // 文字离场
          tl.to(panels[i], { autoAlpha: 0, x: -40, duration: 0.22 }, s + 0.82)
        }
      })
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} className="relative min-h-[100dvh] overflow-hidden bg-ink-950">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="site-container relative z-10 grid min-h-[100dvh] items-center gap-8 py-16 lg:grid-cols-[40%_60%]">
        {/* 左:解剖台文档层 */}
        <div className="relative flex items-center justify-center" style={{ perspective: '1200px' }}>
          <div className="relative h-[420px] w-[240px]">
            {ACTS_COPY.map((act, i) => {
              const meta = LAYER_META[act.layer]
              return (
                <div
                  key={act.layer}
                  className="dissect-sheet absolute left-1/2 top-1/2 -ml-[110px] -mt-[150px] flex h-[300px] w-[220px] flex-col rounded-xl border border-ink-line bg-ink-900/95 p-4"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.6875rem] tracking-[0.14em]" style={{ color: meta.color }}>
                      L{i + 1} · {meta.en}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  </div>
                  <div className="mt-3 h-px w-full bg-ink-line" />
                  <div className="mt-3 space-y-2.5">
                    {SHEET_LINES[act.layer].map((line) => (
                      <p key={line} className="font-mono text-[0.6875rem] leading-relaxed text-paper-dim">
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="mt-auto space-y-1.5" aria-hidden>
                    <div className="h-1 w-4/5 rounded bg-ink-line/70" />
                    <div className="h-1 w-3/5 rounded bg-ink-line/50" />
                    <div className="h-1 w-2/3 rounded bg-ink-line/60" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右:逐幕文字 */}
        <div className="relative">
          <p className="mono-label mb-6 flex items-center gap-3">
            <span className="inline-block h-px w-6 bg-amber" />
            DISSECTION — 把剧本一层层剥开
          </p>
          <div className="relative min-h-[380px] md:min-h-[340px]">
            {ACTS_COPY.map((act) => (
              <div key={act.layer} className="dissect-panel absolute inset-x-0 top-0">
                <div className="dissect-badge inline-block origin-left">
                  <LayerBadge layer={act.layer} />
                </div>
                <p className="mt-5 font-display text-[clamp(2.4rem,5vw,4.2rem)] font-black italic leading-none" style={{ color: LAYER_META[act.layer].color }}>
                  {LAYER_META[act.layer].en}
                </p>
                <h3 className="mt-4 max-w-xl font-serif text-[clamp(1.35rem,2.4vw,1.9rem)] font-bold leading-snug text-paper">
                  {act.title}
                </h3>
                <p className="mt-4 max-w-xl leading-7 text-paper-dim">{act.desc}</p>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
                  {act.points.map((p) => (
                    <span key={p} className="font-mono text-xs tracking-[0.12em] text-paper">
                      <span className="mr-2 inline-block h-1 w-1 rounded-full align-middle" style={{ backgroundColor: LAYER_META[act.layer].color }} />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 进度点 */}
          <div className="mt-4 flex items-center gap-3">
            {ACTS_COPY.map((act, i) => (
              <span
                key={act.layer}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: active === i ? 28 : 10,
                  backgroundColor: active === i ? LAYER_META[act.layer].color : '#26262F',
                }}
              />
            ))}
            <span className="ml-2 font-mono text-[0.6875rem] tracking-[0.14em] text-paper-dim">
              0{active + 1} / 04
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
