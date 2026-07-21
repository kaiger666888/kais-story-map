import { useEffect, useRef } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { NODE_COLORS } from '@/data/nightferry'
import type { NodeKind } from '@/data/nightferry'

interface GNode extends SimulationNodeDatum {
  id: number
  kind: NodeKind
  r: number
  birth: number
}

type GLink = SimulationLinkDatum<GNode>

/** 确定性伪随机(保证每次渲染同一张图) */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KINDS: NodeKind[] = [
  ...Array<NodeKind>(12).fill('character'),
  ...Array<NodeKind>(10).fill('scene'),
  ...Array<NodeKind>(8).fill('prop'),
  ...Array<NodeKind>(10).fill('emotion'),
]

/**
 * Hero 右侧微缩力导向图谱(Canvas,40 节点)。
 * 节点按类型着色,持续缓慢漂移;hover 节点时一跳邻居高亮,其余降至 0.25。
 */
export default function MiniGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rand = mulberry32(42)
    const nodes: GNode[] = KINDS.map((kind, i) => ({
      id: i,
      kind,
      r: kind === 'character' ? 3.4 : kind === 'scene' ? 3 : kind === 'prop' ? 2.6 : 2.4,
      birth: performance.now() + i * 25,
      x: 0,
      y: 0,
    }))
    const links: GLink[] = []
    for (let i = 1; i < nodes.length; i++) {
      links.push({ source: Math.floor(rand() * i), target: i })
      if (rand() < 0.22) links.push({ source: Math.floor(rand() * nodes.length), target: i })
    }

    let w = wrap.clientWidth
    let h = wrap.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const sim = forceSimulation<GNode>(nodes)
      .force('link', forceLink<GNode, GLink>(links).distance(34).strength(0.5))
      .force('charge', forceManyBody().strength(-26))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide(9))
      .alphaTarget(0.02)

    const resize = () => {
      w = wrap.clientWidth
      h = wrap.clientHeight
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      sim.force('center', forceCenter(w / 2, h / 2))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // hover 状态
    let hovered: GNode | null = null
    const neighbors = new Set<number>()
    const linkKey = (l: GLink) => {
      const s = (l.source as GNode).id ?? l.source
      const t = (l.target as GNode).id ?? l.target
      return [Number(s), Number(t)]
    }
    const rebuildNeighbors = () => {
      neighbors.clear()
      if (!hovered) return
      for (const l of links) {
        const [s, t] = linkKey(l)
        if (s === hovered.id) neighbors.add(t)
        if (t === hovered.id) neighbors.add(s)
      }
    }
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      let best: GNode | null = null
      let bd = 18
      for (const n of nodes) {
        const d = Math.hypot((n.x ?? 0) - mx, (n.y ?? 0) - my)
        if (d < bd) {
          bd = d
          best = n
        }
      }
      hovered = best
      rebuildNeighbors()
      canvas.style.cursor = best ? 'pointer' : 'default'
    }
    const onLeave = () => {
      hovered = null
      neighbors.clear()
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    // 离屏暂停
    let running = true
    let raf = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting
        if (running) {
          sim.alphaTarget(0.02)
          cancelAnimationFrame(raf)
          raf = requestAnimationFrame(draw)
        } else {
          sim.alphaTarget(0)
        }
      },
      { threshold: 0.05 },
    )
    io.observe(wrap)

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const draw = () => {
      if (!running) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const now = performance.now()

      // 边
      for (const l of links) {
        const s = l.source as GNode
        const t = l.target as GNode
        const active = hovered && (s.id === hovered.id || t.id === hovered.id)
        ctx.strokeStyle = active ? 'rgba(255,179,71,0.45)' : 'rgba(120,116,140,0.16)'
        if (hovered && !active) ctx.strokeStyle = 'rgba(120,116,140,0.05)'
        ctx.lineWidth = active ? 1 : 0.6
        ctx.beginPath()
        ctx.moveTo(s.x ?? 0, s.y ?? 0)
        ctx.lineTo(t.x ?? 0, t.y ?? 0)
        ctx.stroke()
      }
      // 节点
      for (const n of nodes) {
        const grow = easeOut(Math.min(1, Math.max(0, (now - n.birth) / 500)))
        if (grow <= 0) continue
        const isHover = hovered?.id === n.id
        const isNeighbor = hovered && neighbors.has(n.id)
        const alpha = hovered ? (isHover || isNeighbor ? 1 : 0.25) : 0.9
        const r = n.r * grow * (isHover ? 1.4 : 1)
        const color = NODE_COLORS[n.kind]
        ctx.globalAlpha = alpha
        ctx.shadowBlur = isHover || isNeighbor ? 10 : 0
        ctx.shadowColor = color
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      sim.stop()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
