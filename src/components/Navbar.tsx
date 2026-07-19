import { useState, useEffect, useCallback, useRef } from 'react'
import { usePage } from '../App'

const SCROLL_THRESHOLD = 10

export default function Navbar() {
  const { page, go } = usePage()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const lastScrollRef = useRef(0)

  const handleScroll = useCallback(() => {
    const y = window.scrollY || document.documentElement.scrollTop
    setScrolled(y > 20)
    if (y <= 0) { setHidden(false); lastScrollRef.current = y; return }
    const delta = Math.abs(lastScrollRef.current - y)
    if (delta <= SCROLL_THRESHOLD) return
    setHidden(y > lastScrollRef.current)
    lastScrollRef.current = y
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const currentRoute = page.route

  const navLinks = [
    { route: 'home' as const,          label: '首页' },
    { route: 'archive' as const,       label: '数字档案' },
    { route: 'heritage-map' as const,  label: '文保地图' },
    { route: 'community' as const,     label: '公众参与' },
    { route: 'about' as const,         label: '关于' },
  ]

  const isActive = (route: string) => currentRoute === route

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <nav
        className="navbar-glass flex items-center flex-nowrap w-full"
        style={{
          height: scrolled ? 48 : 64,
          paddingLeft: 'clamp(12px, 3vw, 48px)',
          paddingRight: 'clamp(12px, 3vw, 48px)',
          transition: 'height 0.7s ease-out',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 mr-4">
          <button
            onClick={() => go({ route: 'home' })}
            className="flex items-center gap-2 sm:gap-2.5 group bg-transparent border-none cursor-pointer"
            style={{ font: 'inherit', color: 'inherit' }}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-accent-1/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L3 12L12 22L21 12Z" />
              <path d="M12 2L12 22" />
              <path d="M3 12L21 12" />
            </svg>
            <span className="font-medium tracking-[0.05em] leading-none hidden sm:inline whitespace-nowrap text-text-1/80"
              style={{ fontSize: scrolled ? 13 : 15 }}>
              晶格视界
            </span>
            <span className="hidden lg:inline text-[11px] tracking-[0.08em] text-text-3/40 leading-none whitespace-nowrap"
              style={{ fontSize: scrolled ? 10 : 11 }}>
              · 数字文保
            </span>
          </button>
        </div>

        {/* Desktop nav — center */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {navLinks.map(link => {
            const active = isActive(link.route)
            return (
              <button
                key={link.route}
                onClick={() => go({ route: link.route })}
                className={`relative px-2.5 lg:px-4 py-2 text-[12px] lg:text-[13px] font-medium tracking-[0.04em] whitespace-nowrap transition-colors duration-300 bg-transparent border-none cursor-pointer ${active ? 'text-text-1' : 'text-text-3/40 hover:text-text-2/60'}`}
              >
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-1" />
                )}
                {link.label}
              </button>
            )
          })}
        </div>

        {/* Right spacer (keep symmetry) */}
        <div className="hidden md:block shrink-0" style={{ width: 'clamp(80px, 10vw, 160px)' }} />

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 -mr-2 bg-transparent border-none cursor-pointer text-text-3/40 ml-auto"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {mobileOpen
              ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
              : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>
            }
          </svg>
        </button>
      </nav>

      {/* Bottom glow */}
      <div className="h-px w-full opacity-25"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(124,111,240,0.25) 20%, rgba(124,111,240,0.45) 50%, rgba(0,194,217,0.25) 80%, transparent 100%)' }}
      />

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed top-[64px] left-3 right-3 max-w-lg mx-auto glass rounded-2xl overflow-hidden"
          style={{ animation: 'fade-in 0.2s ease-out' }}>
          <nav className="px-1.5 py-2 space-y-0.5">
            {navLinks.map(link => {
              const active = isActive(link.route)
              return (
                <button
                  key={link.route}
                  onClick={() => { go({ route: link.route }); setMobileOpen(false) }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium w-full text-left bg-transparent border-none cursor-pointer transition-all whitespace-nowrap ${active ? 'bg-white/[0.06] text-text-1' : 'text-text-3/70'}`}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60" />}
                  <span>{link.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
