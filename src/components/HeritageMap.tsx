import { useEffect, useState, useMemo } from 'react'
import { getAllModels } from '../store'
import type { ModelMeta, ConservationStatus } from '../types'
import { CONSERVATION_STATUS_LABELS } from '../types'
import { usePage } from '../App'
import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'

const STATUS_DOT_COLORS: Record<ConservationStatus, string> = {
  excellent: '#4CAF50',
  good: '#8BC34A',
  needs_repair: '#FF9800',
  critical: '#F44336',
}

export default function HeritageMap() {
  const { go } = usePage()
  const [models, setModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<string>('')

  const load = () => {
    setLoadError(null)
    setLoading(true)
    getAllModels()
      .then(setModels)
      .catch(err => setLoadError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const districts = useMemo(() => {
    const seen = new Set<string>()
    for (const m of models) {
      if (m.location?.district) seen.add(m.location.district)
    }
    return Array.from(seen).sort()
  }, [models])

  const filtered = selectedDistrict
    ? models.filter(m => m.location?.district === selectedDistrict)
    : models

  const statusCounts = useMemo(() => {
    const counts: Record<ConservationStatus, number> = { excellent: 0, good: 0, needs_repair: 0, critical: 0 }
    for (const m of models) {
      if (m.conservationStatus) counts[m.conservationStatus]++
    }
    return counts
  }, [models])

  return (
    <main className="min-h-screen bg-surface-0 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-ink-wash opacity-40" />
        <PointCloudBackground className="opacity-40" />
      </div>

      <div className="relative z-10" style={{ paddingTop: '90px' }}>
        {/* Header */}
        <section className="pt-20 sm:pt-28 pb-10 sm:pb-14">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="mb-8 animate-fade-up">
              <ScrollRoller />
            </div>
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-medium tracking-[0.05em]"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,111,240,0.1)', color: '#7C6FF0' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60" />
                文保地图
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-5 leading-[1.22] text-center">
                <span className="gradient-text">文保地图</span>
              </h1>
              <p className="text-text-3/60 text-sm max-w-md mx-auto">
                一览所有收录文保建筑的地理分布与保护状态
              </p>
            </div>
          </div>
        </section>

        {/* Status legend */}
        <section className="pb-8 animate-fade-up">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {(['excellent', 'good', 'needs_repair', 'critical'] as ConservationStatus[]).map(s => (
                <div key={s} className="flex items-center gap-2 text-[12px] text-text-2/70">
                  <span className="w-3 h-3 rounded-full" style={{ background: STATUS_DOT_COLORS[s] }} />
                  {CONSERVATION_STATUS_LABELS[s]}
                  <span className="text-text-3/40 font-mono text-[10px]">{statusCounts[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* District filter */}
        <section className="pb-8 animate-fade-up">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedDistrict('')}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium tracking-[0.03em] transition-all border-none cursor-pointer ${
                  selectedDistrict === ''
                    ? 'bg-accent-1 text-white shadow-sm'
                    : 'bg-white/80 text-text-3/50 hover:text-text-2 border border-border-1'
                }`}
                style={{ cursor: 'pointer' }}
              >
                全部区域
                <span className="ml-1.5 text-[10px] opacity-60">{models.length}</span>
              </button>
              {districts.map(d => {
                const count = models.filter(m => m.location?.district === d).length
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDistrict(selectedDistrict === d ? '' : d)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium tracking-[0.03em] transition-all border-none cursor-pointer ${
                      selectedDistrict === d
                        ? 'bg-accent-1 text-white shadow-sm'
                        : 'bg-white/80 text-text-3/50 hover:text-text-2 border border-border-1'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    {d}
                    <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* Site cards by district */}
        <section className="pb-24 sm:pb-32">
          <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-10">
            {loading ? (
              <div className="flex items-center justify-center py-40">
                <div className="w-8 h-8 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin" />
              </div>
            ) : loadError ? (
              <div className="text-center py-40 animate-fade-up">
                <p className="text-text-3/40 text-sm mb-3">数据加载失败</p>
                <button onClick={load}
                  className="px-4 py-2 rounded-xl text-[12px] text-accent-1/70 hover:text-accent-1 border border-accent-1/20 hover:border-accent-1/40 bg-transparent cursor-pointer transition-colors"
                  style={{ cursor: 'pointer' }}>重试</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-40 animate-fade-up">
                <div className="text-4xl mb-4 opacity-30">🗺️</div>
                <p className="text-text-3/40 text-sm">{selectedDistrict ? `「${selectedDistrict}」暂无收录建筑` : '暂无文保建筑数据'}</p>
                {selectedDistrict && (
                  <button onClick={() => setSelectedDistrict('')}
                    className="mt-3 text-[12px] text-accent-1/70 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                    style={{ cursor: 'pointer' }}>← 查看全部区域</button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((model, i) => {
                  const statusColor = model.conservationStatus ? STATUS_DOT_COLORS[model.conservationStatus] : undefined
                  return (
                    <button
                      key={model.id}
                      onClick={() => go({ route: 'viewer', modelId: model.id })}
                      className="ink-card rounded-2xl p-5 sm:p-6 flex items-center gap-4 sm:gap-6 w-full text-left border-none cursor-pointer group transition-all hover:-translate-y-0.5"
                      style={{
                        animation: `fade-up 0.5s ease-out ${i * 0.06}s both`,
                        cursor: 'pointer',
                        font: 'inherit',
                        color: 'inherit',
                      }}
                    >
                      {/* Numbered marker */}
                      <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-[15px] font-bold font-display"
                        style={{
                          background: statusColor ? `${statusColor}12` : 'rgba(124,111,240,0.08)',
                          color: statusColor || '#7C6FF0',
                        }}>
                        {i + 1}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] sm:text-base font-semibold text-text-1 mb-1 group-hover:text-accent-1/80 transition-colors">
                          {model.name}
                        </h3>
                        <p className="text-[12px] text-text-3/50 line-clamp-1 mb-1.5">
                          {model.location?.address || model.description}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          {model.constructionYear && (
                            <span className="text-[11px] text-text-3/40">{model.constructionYear}</span>
                          )}
                          {statusColor && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: statusColor }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                              {CONSERVATION_STATUS_LABELS[model.conservationStatus!]}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Arrow */}
                      <svg className="w-5 h-5 text-text-3/20 group-hover:text-accent-1/50 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
