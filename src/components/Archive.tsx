import { useEffect, useState, useMemo } from 'react'
import { getAllModels } from '../store'
import type { ModelMeta, ProtectionLevel, ConservationStatus } from '../types'
import { PROTECTION_LEVEL_LABELS, CONSERVATION_STATUS_LABELS } from '../types'
import ModelCard from './ModelCard'
import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'

const STATUS_DOT_COLORS: Record<ConservationStatus, string> = {
  excellent: '#4CAF50',
  good: '#8BC34A',
  needs_repair: '#FF9800',
  critical: '#F44336',
}

type SortKey = 'default' | 'name' | 'era'

export default function Archive() {
  const [models, setModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState<string>('')
  const [protection, setProtection] = useState<ProtectionLevel | ''>('')
  const [status, setStatus] = useState<ConservationStatus | ''>('')
  const [sortBy, setSortBy] = useState<SortKey>('default')

  const load = () => {
    setLoadError(null)
    setLoading(true)
    getAllModels()
      .then(setModels)
      .catch(err => setLoadError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Derived filter options
  const districts = useMemo(() => {
    const seen = new Set<string>()
    for (const m of models) {
      if (m.location?.district) seen.add(m.location.district)
    }
    return Array.from(seen).sort()
  }, [models])

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...models]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.location?.district?.toLowerCase().includes(q) ||
        m.location?.address?.toLowerCase().includes(q) ||
        (m.constructionYear && m.constructionYear.includes(q)) ||
        m.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    if (district) {
      result = result.filter(m => m.location?.district === district)
    }

    if (protection) {
      result = result.filter(m => m.protectionLevel === protection)
    }

    if (status) {
      result = result.filter(m => m.conservationStatus === status)
    }

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    } else if (sortBy === 'era') {
      result.sort((a, b) => (a.constructionYear || '').localeCompare(b.constructionYear || '', 'zh-CN'))
    }

    return result
  }, [models, search, district, protection, status, sortBy])

  const hasActiveFilters = search || district || protection || status
  const noMatch = !loading && !loadError && models.length > 0 && filtered.length === 0

  return (
    <main className="min-h-screen bg-surface-0 relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-ink-wash opacity-40" />
        <PointCloudBackground className="opacity-40" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(124,111,240,0.1) 6px, rgba(124,111,240,0.1) 7px)' }} />
      </div>

      <div className="relative z-10" style={{ paddingTop: '90px' }}>
        {/* Header */}
        <section className="pt-20 sm:pt-28 pb-8 sm:pb-12">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="mb-8 animate-fade-up">
              <ScrollRoller />
            </div>
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-medium tracking-[0.05em]"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,111,240,0.1)', color: '#7C6FF0' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60" />
                数字档案库
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-5 leading-[1.22]">
                <span className="gradient-text">数字档案库</span>
              </h1>
              <p className="text-text-3/60 text-sm max-w-md mx-auto">
                共收录 {models.length} 处文保建筑与文物
              </p>
            </div>
          </div>
        </section>

        {/* Filter bar */}
        <section className="pb-6 sm:pb-8 animate-fade-up">
          <div className="max-w-6xl lg:max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="ink-card rounded-2xl p-4 sm:p-5 space-y-4">
              {/* Search + Sort row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="搜索建筑名称、区域、年代..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] bg-surface-1 border border-border-1 text-text-1 placeholder:text-text-3/30 outline-none focus:border-accent-1/40 transition-colors"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="px-3 py-2.5 rounded-xl text-[12px] bg-surface-1 border border-border-1 text-text-2 outline-none focus:border-accent-1/40 transition-colors cursor-pointer"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="default">默认排序</option>
                  <option value="name">按名称</option>
                  <option value="era">按年代</option>
                </select>
              </div>

              {/* Filter chips row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* District */}
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-surface-1 border border-border-1 text-text-2 outline-none cursor-pointer transition-colors hover:border-accent-1/30"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">全部区域</option>
                  {districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Protection level chips */}
                {(['national', 'provincial', 'city', 'district'] as ProtectionLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setProtection(protection === level ? '' : level)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-[0.03em] border transition-all cursor-pointer ${
                      protection === level
                        ? 'border-accent-1 bg-accent-1/8 text-accent-1'
                        : 'border-border-1 bg-surface-1 text-text-3/50 hover:text-text-2 hover:border-accent-1/30'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    {PROTECTION_LEVEL_LABELS[level]}
                  </button>
                ))}

                <span className="w-px h-4 bg-border-1 mx-1" />

                {/* Status chips */}
                {(['excellent', 'good', 'needs_repair', 'critical'] as ConservationStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(status === s ? '' : s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-[0.03em] border transition-all cursor-pointer ${
                      status === s
                        ? 'border-current'
                        : 'border-border-1 bg-surface-1 text-text-3/50 hover:text-text-2 hover:border-accent-1/30'
                    }`}
                    style={status === s ? { color: STATUS_DOT_COLORS[s], background: `${STATUS_DOT_COLORS[s]}10` } : {}}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT_COLORS[s] }} />
                    {CONSERVATION_STATUS_LABELS[s]}
                  </button>
                ))}

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearch(''); setDistrict(''); setProtection(''); setStatus('') }}
                    className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-medium text-text-3/50 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    清除筛选
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Grid */}
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
                  <p className="text-text-3/50 text-[14px]">档案库尚空，暂无文物数据</p>
                </div>
              </div>
            ) : noMatch ? (
              <div className="text-center py-40 animate-fade-up">
                <p className="text-text-3/40 text-[14px] mb-3">未找到匹配的文物建筑</p>
                <button
                  onClick={() => { setSearch(''); setDistrict(''); setProtection(''); setStatus('') }}
                  className="text-[12px] text-accent-1/70 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  ← 清除所有筛选
                </button>
              </div>
            ) : (
              <>
                <p className="text-[12px] text-text-3/40 mb-5 text-right">
                  共 {filtered.length} 处
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                  {filtered.map((model, i) => (
                    <ModelCard key={model.id} model={model} index={i} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
