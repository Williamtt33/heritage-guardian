import { usePage } from '../App'

export default function Footer() {
  const { go } = usePage()

  const linkClass = "text-[12px] text-text-3/40 hover:text-text-2 transition-colors duration-300 bg-transparent border-none cursor-pointer"

  return (
    <footer className="border-t border-border-1 bg-surface-0">
      <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10 sm:py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-1 to-accent-2 flex items-center justify-center text-[9px] font-bold text-white select-none">
                3D
              </div>
              <span className="text-[14px] font-medium tracking-[0.05em] text-text-2"
                style={{ fontFamily: "'Noto Serif SC', serif" }}>
                晶格视界 · 数字文保
              </span>
            </div>
            <span className="text-[11px] text-text-3/40">
              党建领航 · 文化传承 · 科技赋能 — 让历史街区在数字中永续
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
            <button onClick={() => go({ route: 'archive' })} className={linkClass} style={{ cursor: 'pointer' }}>
              数字档案
            </button>
            <button onClick={() => go({ route: 'heritage-map' })} className={linkClass} style={{ cursor: 'pointer' }}>
              文保地图
            </button>
            <button onClick={() => go({ route: 'community' })} className={linkClass} style={{ cursor: 'pointer' }}>
              公众参与
            </button>
            <button onClick={() => go({ route: 'red-routes' })} className={linkClass} style={{ cursor: 'pointer' }}>
              红色路线
            </button>
            <button onClick={() => go({ route: 'about' })} className={linkClass} style={{ cursor: 'pointer' }}>
              关于
            </button>
          </div>

          {/* Tech tag */}
          <span className="text-[10px] text-text-3/30 font-mono tracking-[0.04em]">
            3DGS · WebGL · React
          </span>
        </div>

        <div className="mt-8 pt-6 border-t border-border-1/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-text-3/30">© 2026 晶格视界 · 历史文化街区数字化保护平台</span>
          <span className="text-[10px] text-text-3/20 font-mono">乙巳年夏</span>
        </div>
      </div>
    </footer>
  )
}
