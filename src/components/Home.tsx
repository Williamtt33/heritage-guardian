import { useEffect, useState, useRef } from 'react'
import { usePage, setLocalFile } from '../App'
import { getAllModels } from '../store'
import ModelCard from './ModelCard'
import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'
import type { ModelMeta } from '../types'

const FOG_SEEDS = [
  { x: '15%', y: '25%', s: 180, dx: 30, dy: -20, d: 28 },
  { x: '72%', y: '35%', s: 220, dx: -25, dy: 15, d: 32 },
  { x: '40%', y: '60%', s: 160, dx: 20, dy: -10, d: 35 },
  { x: '85%', y: '18%', s: 140, dx: -15, dy: 25, d: 30 },
  { x: '55%', y: '75%', s: 200, dx: 35, dy: -15, d: 26 },
]

const CAPABILITIES = [
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: '数字建档',
    desc: '高精度 3D 高斯泼溅扫描，为每一处历史建筑建立毫米级精度的数字档案，永久保存建筑原貌。',
    color: '#7C6FF0',
    route: 'archive' as const,
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="18" rx="1" />
        <rect x="13" y="3" width="8" height="18" rx="1" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <path d="M8 12h8" />
      </svg>
    ),
    title: '时光对比',
    desc: '修缮前后同屏对比，老照片与现状滑动切换，直观展示街区活化保护的真实成效。',
    color: '#00C2D9',
    route: 'archive' as const,
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: '公众共治',
    desc: '居民与游客共同参与，上报建筑隐患、分享历史记忆，构建基层文化治理的数字化桥梁。',
    color: '#4CAF50',
    route: 'community' as const,
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: '红色路线',
    desc: '以数字导览串联红色史迹，追寻革命足迹，让党建文化在历史空间中生动传承。',
    color: '#C62828',
    route: 'red-routes' as const,
  },
]

export default function Home() {
  const { go } = usePage()
  const [models, setModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      let buffer: ArrayBuffer
      let name = file.name
      if (file.name.toLowerCase().endsWith('.sog')) {
        const { sogFileToPly } = await import('../utils/sogDecoder')
        name = file.name.replace(/\.sog$/i, '')
        const result = await sogFileToPly(file)
        buffer = result.buffer
      } else {
        buffer = await file.arrayBuffer()
      }
      setLocalFile(buffer, name)
      go({ route: 'localViewer' })
    } catch (err: any) {
      console.error('Failed to load local file:', err)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    setLoading(true)
    getAllModels()
      .then(setModels)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const featured = models.filter(m => m.featured)
  const statsText = models.length > 0
    ? `已收录 ${models.length} 处文保建筑 · 覆盖 ${new Set(models.map(m => m.location?.district).filter(Boolean)).size || models.length} 个区域`
    : '历史文化街区数字化保护平台'

  return (
    <div className="relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-manuscript-grid opacity-20" />
        <PointCloudBackground className="opacity-60" />
        <div className="absolute inset-0 overflow-hidden">
          {FOG_SEEDS.map((s, i) => (
            <div
              key={i}
              className="fog-particle"
              style={{
                left: s.x, top: s.y,
                width: s.s, height: s.s,
                '--drift-x': `${s.dx}px`,
                '--drift-y': `${s.dy}px`,
                '--drift-duration': `${s.d}s`,
                '--drift-delay': `${i * 3.5}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="absolute rounded-full blur-[120px] animate-fade-in"
          style={{ width: 'min(700px, 55vw)', height: 'min(700px, 55vw)', top: '-15%', left: '25%',
            background: 'radial-gradient(circle, rgba(124,111,240,0.08) 0%, transparent 70%)', opacity: 0.15 }} />
        <div className="absolute rounded-full blur-[100px]"
          style={{ width: 'min(500px, 38vw)', height: 'min(500px, 38vw)', top: '45%', right: '12%',
            background: 'radial-gradient(circle, rgba(0,194,217,0.05) 0%, transparent 70%)', opacity: 0.1 }} />
      </div>

      <div className="relative z-10">
        {/* ── Hero ── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
          <div className="absolute top-16 sm:top-20 w-full max-w-4xl animate-fade-up">
            <ScrollRoller />
          </div>

          <div className="text-center max-w-4xl mx-auto animate-fade-up">
            {/* Pill badge */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-[13px] font-medium tracking-[0.04em] sm:tracking-[0.06em] mb-10 sm:mb-12 max-w-[92vw]"
              style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124,111,240,0.12)', color: '#3D4058' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60 animate-pulse shrink-0" />
              <span>党建引领</span>
              <span className="opacity-20">·</span>
              <span>文化传承</span>
              <span className="opacity-20">·</span>
              <span>公众参与</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[88px] font-display leading-[1.25] sm:leading-[1.18] mb-8 sm:mb-10 tracking-tight">
              <span className="gradient-text">让历史街区在数字中永续</span>
            </h1>
            <p className="text-sm sm:text-lg text-text-2 max-w-xl mx-auto mb-10 sm:mb-14 leading-[1.8] font-light">
              高精度三维扫描与实时渲染，为每一处历史建筑建立永恒的数字档案。
              <br />
              <span className="text-text-3/60">基层治理的数字化工具，文化遗产的云端守护者。</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-12">
              <button
                onClick={() => go({ route: 'archive' })}
                className="btn-primary text-[15px] px-8 py-4 rounded-xl font-semibold tracking-[0.04em]"
                style={{ cursor: 'pointer' }}
              >
                <span className="mr-2">◇</span>
                探索数字档案
              </button>
              <div className="flex items-center gap-6 sm:gap-8">
                <button onClick={() => go({ route: 'heritage-map' })} className="text-[13px] text-text-2/60 hover:text-text-1 transition-colors duration-300 bg-transparent border-none cursor-pointer">
                  文保地图
                </button>
                <button onClick={() => go({ route: 'red-routes' })} className="text-[13px] text-text-2/60 hover:text-text-1 transition-colors duration-300 bg-transparent border-none cursor-pointer">
                  红色路线
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sog,.ply,.splat"
                  onChange={handleLocalFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[13px] text-text-2/40 hover:text-text-1 transition-colors duration-300 bg-transparent border-none cursor-pointer"
                  style={{ cursor: 'pointer' }}
                  title="打开本地 .sog / .ply / .splat 文件"
                >
                  📂 打开文件
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Capability Cards ── */}
        <section className="relative pb-24 sm:pb-32">
          <div className="max-w-5xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-14 sm:mb-18 animate-fade-up">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display tracking-tight mb-5 leading-[1.25]">
                <span className="gradient-text">四大核心能力</span>
              </h2>
              <p className="text-text-3 text-base max-w-lg mx-auto font-light leading-[1.8]">
                从数字建档到公众共治，构建完整的历史文化街区活化保护闭环
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {CAPABILITIES.map((cap, i) => (
                <button
                  key={cap.title}
                  onClick={() => go({ route: cap.route })}
                  className="ink-card rounded-2xl p-6 sm:p-7 text-left group cursor-pointer border-none transition-all duration-300 hover:-translate-y-1"
                  style={{
                    animation: `fade-up 0.8s ease-out ${i * 0.1}s both`,
                    cursor: 'pointer',
                  }}
                >
                  <div className="mb-4 transition-colors duration-300" style={{ color: cap.color, opacity: 0.8 }}>
                    {cap.icon}
                  </div>
                  <h3 className="text-[15px] font-semibold text-text-1 mb-2 tracking-[0.03em] font-display">
                    {cap.title}
                  </h3>
                  <p className="text-[13px] text-text-3/70 leading-[1.7] font-light">
                    {cap.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured Sites ── */}
        <section className="relative pb-24 sm:pb-28">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-14 sm:mb-18 animate-fade-up">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display tracking-tight mb-5 leading-[1.25]">
                <span className="gradient-text">精选场景</span>
              </h2>
              <p className="text-text-3 text-base max-w-lg mx-auto font-light leading-[1.8]">
                点击场景，步入三维重建的历史建筑
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin" />
              </div>
            ) : featured.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-text-3/50 text-sm">暂无精选场景</p>
                <button
                  onClick={() => go({ route: 'archive' })}
                  className="mt-4 text-[13px] text-accent-1/70 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  浏览数字档案 →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {featured.map((model, i) => (
                  <ModelCard key={model.id} model={model} index={i} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="relative pb-20 sm:pb-24 animate-fade-up">
          <div className="max-w-3xl mx-auto px-6">
            <div className="ink-card rounded-2xl py-8 sm:py-10 px-6 sm:px-10 text-center">
              <p className="text-sm sm:text-base text-text-2/70 font-medium tracking-[0.04em] leading-[1.8]"
                style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {statsText}
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative pb-24 sm:pb-32 text-center animate-fade-up">
          <button
            onClick={() => go({ route: 'archive' })}
            className="btn-primary text-[15px] px-10 py-4 rounded-xl font-semibold tracking-[0.04em]"
            style={{ cursor: 'pointer' }}
          >
            <span className="mr-2">◇</span>
            探索数字档案库
          </button>
        </section>

        {/* Bottom seal */}
        <div className="pb-16 animate-fade-in">
          <div className="max-w-4xl mx-auto px-6 mb-5">
            <ScrollRoller />
          </div>
          <div className="flex justify-center gap-4">
            <svg className="w-7 h-7 text-accent-1/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L3 12L12 22L21 12Z" />
              <path d="M12 2L12 22" />
              <path d="M3 12L21 12" />
            </svg>
            <span className="text-[10px] text-text-3/25 tracking-[0.2em] font-medium self-end"
              style={{ fontFamily: "'Noto Serif SC', serif" }}>
              党建领航 · 文化传承 · 科技赋能
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
