import { useCallback, useRef, useState } from 'react'
import PageHeader from '@/components/emotion/PageHeader'
import TensionChart from '@/components/emotion/TensionChart'
import CharacterLines from '@/components/emotion/CharacterLines'
import Heatmap from '@/components/emotion/Heatmap'
import Quadrant from '@/components/emotion/Quadrant'
import Diagnosis from '@/components/emotion/Diagnosis'
import BeatAccordion from '@/components/emotion/BeatAccordion'

/**
 * 情绪曲线页 — /emotion
 * S1 页首 · S2 全剧张力主图 · S3 人物情绪多线图 · S4 场景×人物热力矩阵
 * S5 情绪象限 · S6 节奏诊断 · S7 逐场情绪明细
 *
 * 跨图联动:focusRange(场号区间)由热力行 / 象限点 / 诊断卡设置,
 * 主图高亮该区间并平滑滚动回 FIG.01。
 */
export default function Emotion() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [focusRange, setFocusRange] = useState<[number, number] | null>(null)

  const locate = useCallback((range: [number, number]) => {
    setFocusRange(range)
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const clearFocus = useCallback(() => setFocusRange(null), [])

  return (
    <div className="relative">
      {/* S1 · 页首 */}
      <PageHeader />

      {/* S2 · 全剧张力主图(联动定位锚点) */}
      <div ref={chartRef} className="scroll-mt-24">
        <TensionChart focusRange={focusRange} onClearFocus={clearFocus} />
      </div>

      {/* S3 · 人物情绪多线图 */}
      <div className="mt-8">
        <CharacterLines />
      </div>

      {/* S4 · 情绪热力矩阵 */}
      <div className="mt-8">
        <Heatmap onLocate={locate} />
      </div>

      {/* S5 + S6 · 象限 / 诊断(半宽并排,移动端堆叠) */}
      <div className="site-container mt-8 grid items-stretch gap-8 lg:grid-cols-2">
        <Quadrant onLocate={locate} />
        <Diagnosis onLocate={locate} />
      </div>

      {/* S7 · 逐场情绪明细 */}
      <div className="mt-8 pb-24">
        <BeatAccordion />
      </div>
    </div>
  )
}
