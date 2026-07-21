import HeroSection from '@/components/home/HeroSection'
import DissectSection from '@/components/home/DissectSection'
import FeatureGrid from '@/components/home/FeatureGrid'
import GraphPreview from '@/components/home/GraphPreview'
import EmotionBand from '@/components/home/EmotionBand'
import Workflow from '@/components/home/Workflow'
import FinalCTA from '@/components/home/FinalCTA'

/**
 * 首页 — 品牌 Hero + 皮/骨/肉/神经滚动解剖 + 功能全景
 * + 实时图谱预览 + 情绪指纹 + 工作流 + 最终 CTA
 */
export default function Home() {
  return (
    <div className="relative">
      <HeroSection />
      <DissectSection />
      <FeatureGrid />
      <GraphPreview />
      <EmotionBand />
      <Workflow />
      <FinalCTA />
    </div>
  )
}
