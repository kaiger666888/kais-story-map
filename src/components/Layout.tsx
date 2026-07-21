import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/**
 * Custom cursor: 8px amber dot + 36px trailing ring (desktop / fine pointers only).
 * Ring grows to 56px over interactive elements. Native cursor stays visible as fallback.
 */
function Cursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const ringX = useSpring(x, { stiffness: 260, damping: 28, mass: 0.6 })
  const ringY = useSpring(y, { stiffness: 260, damping: 28, mass: 0.6 })
  const scale = useMotionValue(1)
  const ringScale = useSpring(scale, { stiffness: 300, damping: 24 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const move = (e: MouseEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      const interactive = t?.closest('a, button, [role="button"], [data-cursor], input, textarea, [data-interactive]')
      scale.set(interactive ? 56 / 36 : 1)
    }
    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('mouseover', over, { passive: true })
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
    }
  }, [x, y, scale])

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] hidden [@media(pointer:fine)]:block" aria-hidden>
      <motion.div
        className="absolute h-2 w-2 rounded-full bg-amber"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
      />
      <motion.div
        className="absolute h-9 w-9 rounded-full border border-amber/60"
        style={{ x: ringX, y: ringY, scale: ringScale, translateX: '-50%', translateY: '-50%' }}
      />
    </div>
  )
}

/**
 * Shared layout — nested-route (layout-route) pattern:
 * Layout renders <Outlet/>, so App.tsx MUST nest page routes inside
 * `<Route element={<Layout/>}>`. Do NOT pass routes as children.
 *
 * Navbar is sticky (in normal flow), so no page needs top-offset bookkeeping.
 */
export default function Layout() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-ink-950 text-paper">
      <Cursor />
      <Navbar />
      <main className="relative flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
