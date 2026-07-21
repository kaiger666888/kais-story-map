import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { ArrowRight, ChevronDown, Clapperboard } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: '首页' },
  { to: '/graph', label: '关系图谱' },
  { to: '/emotion', label: '情绪曲线' },
  { to: '/analysis', label: '剧本评估' },
  { to: '/agent', label: 'Agent 协作' },
  { to: '/cases', label: '案例库' },
]

/**
 * Navbar — sticky top-0 z-50, stays in normal document flow.
 * Pages never compensate for nav height (see react-dev.md 'Navbar positioning contract').
 * Scroll > 40px: transparent → rgba(8,8,13,0.75) + backdrop-blur 12px + 1px ink-line.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-ink-line bg-[rgba(8,8,13,0.75)] backdrop-blur-[12px]'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="site-container flex h-16 items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <img src="/icon-layers.svg" alt="剧核 DramaCore" className="h-8 w-8 transition-transform duration-500 group-hover:rotate-90" />
          <span className="font-serif text-lg font-black tracking-tight text-paper">
            剧核 <span className="text-paper-dim">DramaCore</span>
          </span>
        </Link>

        {/* Center links */}
        <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative pb-1 text-sm font-medium transition-[letter-spacing,color] duration-300 hover:tracking-[0.08em]',
                  isActive
                    ? 'text-paper after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-amber'
                    : 'text-paper-dim hover:text-paper',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: script picker + CTA */}
        <div className="flex shrink-0 items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden items-center gap-1.5 rounded-full border border-ink-line bg-ink-900 px-3.5 py-1.5 text-xs font-medium text-paper-dim outline-none transition-colors hover:border-paper-dim/40 hover:text-paper md:flex">
              <Clapperboard className="h-3.5 w-3.5 text-amber" />
              《夜航》demo
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-ink-line bg-ink-900 text-paper">
              <DropdownMenuItem className="cursor-pointer focus:bg-ink-800 focus:text-paper">
                <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-green" />
                《夜航 NIGHT FERRY》· 已加载
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-paper-dim focus:bg-ink-800 focus:text-paper">
                《落幕 FINAL SHOW》· 即将上线
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-paper-dim focus:bg-ink-800 focus:text-paper">
                《听雨 RAIN LISTENER》· 即将上线
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            to="/agent"
            className="group flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-sm font-bold text-ink-950 transition-all duration-300 hover:shadow-glow-amber"
          >
            导入剧本
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </header>
  )
}
