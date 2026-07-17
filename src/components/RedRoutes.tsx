import { useEffect, useState, useMemo } from 'react'
import { getAllModels } from '../store'
import type { ModelMeta } from '../types'
import { usePage } from '../App'
import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'

// Curated red-culture tour routes built from model data
interface RouteCard {
  id: string
  name: string
  description: string
  sites: string[]        // model IDs in this route
  duration: string
  theme: string          // e.g. "大革命时期", "抗日战争"
}

// Pre-defined routes referencing real models
const RED_ROUTES: RouteCard[] = [
  {
    id: 'red-route-1',
    name: '大革命时期广州红色足迹',
    description: '从五仙观的工农集会点到省港罢工委员会旧址，追寻1925-1927年大革命时期广州的红色印记。',
    sites: ['chinese-guardian-lion'],
    duration: '约15分钟',
    theme: '大革命时期',
  },
  {
    id: 'red-route-2',
    name: '珠江纵队水乡交通线',
    description: '跟随珠江纵队顺德大队的足迹，探访抗日战争时期水乡古桥作为秘密交通站的历史往事。',
    sites: ['ponte-portagem'],
    duration: '约12分钟',
    theme: '抗日战争时期',
  },
]

export default function RedRoutes({ routeId }: { routeId?: string }) {
  const { go } = usePage()
  const [models, setModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllModels()
      .then(setModels)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Enrich routes with model data
  const enrichedRoutes = useMemo(() => {
    return RED_ROUTES.map(route => ({
      ...route,
      siteModels: route.sites.map(id => models.find(m => m.id === id)).filter(Boolean) as ModelMeta[],
    }))
  }, [models])

  // If a specific route is selected
  const selectedRoute = routeId ? enrichedRoutes.find(r => r.id === routeId) : null

  return (
    <main className="min-h-screen bg-surface-0 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-ink-wash opacity-40" />
        <PointCloudBackground className="opacity-40" />
      </div>

      <div className="relative z-10" style={{ paddingTop: '90px' }}>
        {/* Header */}
        <section className="pt-20 sm:pt-28 pb-10 sm:pb-14">
          <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="mb-8 animate-fade-up">
              <ScrollRoller />
            </div>
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-medium tracking-[0.05em]"
                style={{ background: 'rgba(198,40,40,0.08)', border: '1px solid rgba(198,40,40,0.15)', color: '#C62828' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-party-red/60" />
                红色文化 · 数字传承
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-5 leading-[1.22]">
                <span className="gradient-text">红色路线</span>
              </h1>
              <p className="text-text-3/60 text-sm max-w-lg mx-auto">
                追寻红色足迹，守护历史文脉——以数字导览串联革命史迹
              </p>
            </div>
          </div>
        </section>

        {selectedRoute ? (
          /* Route detail view */
          <section className="pb-24 sm:pb-32">
            <div className="max-w-3xl mx-auto px-6 sm:px-8">
              <button
                onClick={() => go({ route: 'red-routes' })}
                className="mb-8 text-[12px] text-accent-1/70 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                style={{ cursor: 'pointer' }}
              >
                ← 返回路线列表
              </button>

              <div className="ink-card rounded-2xl p-6 sm:p-10 mb-8 animate-fade-up">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-4"
                  style={{ background: 'rgba(198,40,40,0.08)', color: '#C62828' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#C62828' }} />
                  {selectedRoute.theme}
                </div>
                <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-text-1 mb-3">
                  {selectedRoute.name}
                </h2>
                <p className="text-text-3/60 text-sm leading-relaxed mb-4">
                  {selectedRoute.description}
                </p>
                <div className="flex items-center gap-4 text-[12px] text-text-3/50">
                  <span>🏛️ {selectedRoute.siteModels.length} 个站点</span>
                  <span>⏱️ {selectedRoute.duration}</span>
                </div>
              </div>

              {/* Site timeline */}
              <div className="space-y-6">
                {selectedRoute.siteModels.map((site, i) => {
                  const redMarks = site.redCultureMarks || []
                  return (
                    <div key={site.id} className="flex gap-4 sm:gap-6"
                      style={{ animation: `fade-up 0.5s ease-out ${i * 0.1}s both` }}>
                      {/* Timeline dot + line */}
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold font-mono shrink-0"
                          style={{ background: 'rgba(198,40,40,0.1)', color: '#C62828' }}>
                          {i + 1}
                        </div>
                        {i < selectedRoute.siteModels.length - 1 && (
                          <div className="w-px flex-1 my-2" style={{ background: 'rgba(198,40,40,0.15)' }} />
                        )}
                      </div>
                      {/* Site card */}
                      <button
                        onClick={() => go({ route: 'viewer', modelId: site.id })}
                        className="flex-1 ink-card rounded-2xl p-5 text-left border-none cursor-pointer group transition-all hover:-translate-y-0.5 mb-2"
                        style={{ cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                      >
                        <h3 className="text-[15px] font-semibold text-text-1 mb-1 group-hover:text-accent-1/80 transition-colors">
                          {site.name}
                        </h3>
                        {site.location?.address && (
                          <p className="text-[11px] text-text-3/50 mb-2">📍 {site.location.address}</p>
                        )}
                        <p className="text-[12px] text-text-3/60 leading-relaxed mb-3">{site.description}</p>
                        {/* Red culture marks */}
                        {redMarks.length > 0 && (
                          <div className="space-y-2">
                            {redMarks.map(rm => (
                              <div key={rm.id} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                                style={{ background: 'rgba(198,40,40,0.04)' }}>
                                <span className="text-[14px] mt-0.5">🚩</span>
                                <div>
                                  <p className="text-[12px] font-semibold" style={{ color: '#C62828' }}>{rm.title}</p>
                                  <p className="text-[11px] text-text-3/50 mt-0.5">{rm.description}</p>
                                  <p className="text-[10px] text-text-3/40 mt-1">{rm.period}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 text-[11px] text-accent-1/60 group-hover:text-accent-1 transition-colors">
                          进入 3D 导览 →
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : (
          /* Route list */
          <section className="pb-24 sm:pb-32">
            <div className="max-w-4xl mx-auto px-6 sm:px-8">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-5">
                  {enrichedRoutes.map((route, i) => (
                    <div key={route.id} className="ink-card rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-5 sm:gap-8 items-start"
                      style={{ animation: `fade-up 0.5s ease-out ${i * 0.1}s both` }}>
                      {/* Left: number badge */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl flex items-center justify-center text-[22px] font-bold font-display"
                        style={{ background: 'rgba(198,40,40,0.08)', color: '#C62828' }}>
                        {i + 1}
                      </div>
                      {/* Right: info */}
                      <div className="flex-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-3"
                          style={{ background: 'rgba(198,40,40,0.06)', color: '#C62828' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#C62828' }} />
                          {route.theme}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-display tracking-tight text-text-1 mb-2">
                          {route.name}
                        </h2>
                        <p className="text-[13px] text-text-3/60 leading-relaxed mb-4">
                          {route.description}
                        </p>
                        <div className="flex items-center gap-4 text-[12px] text-text-3/50 mb-4">
                          <span>🏛️ {route.siteModels.length} 个站点</span>
                          <span>⏱️ {route.duration}</span>
                        </div>
                        {/* Site chips */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          {route.siteModels.map(site => (
                            <span key={site.id} className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                              style={{ background: 'rgba(124,111,240,0.06)', color: '#7C6FF0' }}>
                              {site.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => go({ route: 'red-routes', routeId: route.id })}
                            className="text-[13px] font-medium px-5 py-2.5 rounded-xl text-white border-none cursor-pointer transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg, #C62828 0%, #8B0000 100%)', cursor: 'pointer' }}
                          >
                            查看路线详情
                          </button>
                          {route.siteModels.length > 0 && (
                            <button
                              onClick={() => go({ route: 'viewer', modelId: route.siteModels[0].id })}
                              className="text-[12px] text-accent-1/70 hover:text-accent-1 bg-transparent border-none cursor-pointer transition-colors"
                              style={{ cursor: 'pointer' }}
                            >
                              进入 3D 导览 →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom note */}
              <div className="mt-12 text-center animate-fade-up">
                <p className="text-[12px] text-text-3/30 leading-relaxed max-w-md mx-auto">
                  红色路线以数字导览的形式串联革命史迹，将党建教育融入历史文化空间的沉浸式体验中。
                  更多路线持续收录中。
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
