import { useEffect, useState, useMemo } from 'react'
import { getAllModels } from '../store'
import type { ModelMeta } from '../types'
import ModelCard from './ModelCard'
import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'

export default function Gallery() {
  const [models, setModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const load = () => {
    setLoadError(null)
    setLoading(true)
    getAllModels()
      .then(setModels)
      .catch(err => setLoadError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Collect unique tags from all models
  const allTags = useMemo(() => {
    const seen = new Set<string>()
    for (const m of models) {
      if (m.tags) for (const t of m.tags) seen.add(t)
    }
    return Array.from(seen)
  }, [models])

  // Filter models by active tag
  const filteredModels = useMemo(() => {
    if (!activeTag) return models
    return models.filter(m => m.tags && m.tags.includes(activeTag))
  }, [models, activeTag])

  const noMatch = !loading && !loadError && models.length > 0 && filteredModels.length === 0

  return (
    <main className="min-h-screen bg-surface-0 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-ink-wash opacity-40" />
        <PointCloudBackground className="opacity-40" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(232,224,213,0.1) 6px, rgba(232,224,213,0.1) 7px)' }} />
      </div>

      <div className="relative z-10" style={{ paddingTop: '90px' }}>
        <section className="pt-20 sm:pt-28 pb-16 sm:pb-20">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="mb-10 animate-fade-up">
              <ScrollRoller />
            </div>
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-medium tracking-[0.05em]"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,111,240,0.1)', color: '#7C6FF0' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60" />
                场景画廊
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-6 leading-[1.22]">
                <span className="gradient-text">场景画廊</span>
              </h1>
            </div>
          </div>
        </section>

        {/* Tag filter bar */}
        {!loading && allTags.length > 0 && (
          <section className="pb-8 sm:pb-10 animate-fade-up">
            <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTag(null)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium tracking-[0.03em] transition-all border-none cursor-pointer ${
                    activeTag === null
                      ? 'bg-accent-1 text-white shadow-sm'
                      : 'bg-white/80 text-text-3/50 hover:text-text-2 border border-border-1'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  全部
                  <span className="ml-1.5 text-[10px] opacity-60">{models.length}</span>
                </button>
                {allTags.map(tag => {
                  const count = models.filter(m => m.tags && m.tags.includes(tag)).length
                  const isActive = activeTag === tag
                  return (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(isActive ? null : tag)}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium tracking-[0.03em] transition-all border-none cursor-pointer ${
                        isActive
                          ? 'bg-accent-1 text-white shadow-sm'
                          : 'bg-white/80 text-text-3/50 hover:text-text-2 border border-border-1'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      {tag}
                      <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <section className="pb-24 sm:pb-32">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            {loading ? (
              <div className="flex items-center justify-center py-40">
                <div className="w-8 h-8 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin" />
              </div>
            ) : loadError ? (
              <div className="text-center py-40">
                <div className="text-5xl mb-6 opacity-40">—</div>
                <h2 className="text-lg font-semibold text-text-2 mb-2">加载失败</h2>
                <p className="text-text-3/50 text-sm max-w-md mx-auto mb-5">{loadError}</p>
                <button onClick={load} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-2 text-sm hover:bg-white/[0.08] cursor-pointer" style={{ cursor: 'pointer' }}>
                  重试
                </button>
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-40">
                <div className="inline-block px-6 py-4 rounded-2xl text-center"
                  style={{ background: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(124,111,240,0.1)' }}>
                  <p className="text-text-3/50 text-[14px]">回廊尚空，尚无场景入驻</p>
                  <p className="text-text-3/30 text-[12px] mt-1">前往管理页面上传首个场景</p>
                </div>
              </div>
            ) : noMatch ? (
              <div className="text-center py-40 animate-fade-up">
                <p className="text-text-3/40 text-[14px] mb-3">该标签下暂无场景</p>
                <button
                  onClick={() => setActiveTag(null)}
                  className="text-[12px] text-accent-1/70 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  ← 查看全部
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                {filteredModels.map((model, i) => (
                  <ModelCard key={model.id} model={model} index={i} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
