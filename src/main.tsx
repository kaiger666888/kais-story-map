import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { ScriptDataProvider } from '@/context/ScriptDataContext'

// No <StrictMode>: it double-runs canvas / WebGL effects (see react-dev.md).
createRoot(document.getElementById('root')!).render(
  <HashRouter>
    {/* 剧本数据源:URL ?data= / localStorage / 默认夜航;Provider 在 Router 内以读取 location */}
    <ScriptDataProvider>
      <App />
    </ScriptDataProvider>
  </HashRouter>,
)
