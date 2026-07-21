import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Graph from '@/pages/Graph'
import Emotion from '@/pages/Emotion'
import Analysis from '@/pages/Analysis'
import Agent from '@/pages/Agent'
import Cases from '@/pages/Cases'
import { useLenis } from '@/hooks/useLenis'
import { useScriptData } from '@/context/ScriptDataContext'

/**
 * Routing pattern: nested routes (pattern B) — Layout renders <Outlet/>,
 * so all pages MUST be children of `<Route element={<Layout/>}>`.
 * Do not mix with the children pattern (see react-dev.md 'Layout + routing contract').
 */
export default function App() {
  useLenis()
  // 数据源(?data=)切换时整页重挂,使各页 useMemo / 状态基于新剧本重建
  const { dataPath } = useScriptData()

  return (
    <Routes key={dataPath ?? '__default__'}>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="graph" element={<Graph />} />
        <Route path="emotion" element={<Emotion />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="agent" element={<Agent />} />
        <Route path="cases" element={<Cases />} />
      </Route>
    </Routes>
  )
}
