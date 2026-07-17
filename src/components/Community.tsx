import { useState, useEffect } from 'react'
import type { CommunityReport } from '../types'
import { getCommunityReports, saveCommunityReports } from '../store'
import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'

// Pre-seeded demo reports for the competition
const DEMO_REPORTS: CommunityReport[] = [
  {
    id: 'demo-1',
    title: '古桥桥面石板松动',
    description: '顺德古桥东侧第三块桥面石板出现明显松动，行人经过时晃动，存在安全隐患。建议尽快安排勘察修复。',
    category: 'damage',
    status: 'reviewed',
    createdAt: '2026-06-12',
    reporter: '逢简村民陈伯',
    photos: [],
  },
  {
    id: 'demo-2',
    title: '五仙观石狮风化加速迹象',
    description: '近期发现石狮底座南侧风化纹路明显增多，可能与酸雨和游客触摸有关，建议加强防护措施。',
    category: 'damage',
    status: 'pending',
    createdAt: '2026-07-02',
    reporter: '文保志愿者小李',
    photos: [],
  },
  {
    id: 'demo-3',
    title: '1950年代古桥老照片投稿',
    description: '我父亲年轻时在古桥前拍的照片，桥栏上的石雕当时还很完整。希望通过平台为历史档案添一份力。',
    category: 'memory',
    status: 'reviewed',
    createdAt: '2026-05-20',
    reporter: '广州市民张女士',
    photos: [],
  },
  {
    id: 'demo-4',
    title: '关于石狮增设玻璃防护罩的建议',
    description: '建议在不影响观瞻的前提下，为石狮设置透明防护罩，减少游客触摸和酸雨侵蚀，同时保留拍照空间。',
    category: 'suggestion',
    status: 'resolved',
    createdAt: '2026-04-08',
    reporter: '文保专家王教授',
    photos: [],
  },
  {
    id: 'demo-5',
    title: '青花瓷瓶展柜温湿度异常',
    description: '省博展厅3号柜的温湿度监测显示波动较大，对陶瓷文物保存不利，建议检查恒温恒湿设备。',
    category: 'damage',
    status: 'resolved',
    createdAt: '2026-03-15',
    reporter: '博物馆巡查员',
    photos: [],
  },
]

const CATEGORY_LABELS: Record<CommunityReport['category'], string> = {
  damage: '损坏报告',
  suggestion: '保护建议',
  memory: '历史记忆',
  other: '其他',
}

const STATUS_LABELS: Record<CommunityReport['status'], string> = {
  pending: '待审核',
  reviewed: '已审核',
  resolved: '已处理',
}

const STATUS_STYLES: Record<CommunityReport['status'], { bg: string; text: string }> = {
  pending: { bg: 'rgba(255,152,0,0.1)', text: '#E65100' },
  reviewed: { bg: 'rgba(124,111,240,0.1)', text: '#7C6FF0' },
  resolved: { bg: 'rgba(76,175,80,0.1)', text: '#2E7D32' },
}

export default function Community() {
  const [tab, setTab] = useState<'reports' | 'submit'>('reports')
  const [reports, setReports] = useState<CommunityReport[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState<CommunityReport['category']>('damage')
  const [formReporter, setFormReporter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // Load from localStorage, fall back to demo data
    const all: CommunityReport[] = []
    // Aggregate reports across all models (using the demo data as base)
    const stored = getCommunityReports('_global')
    if (stored.length > 0) {
      all.push(...stored)
    } else {
      all.push(...DEMO_REPORTS)
    }
    setReports(all)
    setLoading(false)
  }, [])

  const handleSubmit = () => {
    if (!formTitle.trim() || !formDesc.trim()) return
    setSubmitting(true)
    const report: CommunityReport = {
      id: `cr-${Date.now()}`,
      title: formTitle.trim(),
      description: formDesc.trim(),
      category: formCategory,
      reporter: formReporter.trim() || '匿名用户',
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
      photos: [],
    }
    const updated = [report, ...reports]
    setReports(updated)
    saveCommunityReports('_global', updated)
    setFormTitle(''); setFormDesc(''); setFormReporter('')
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

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
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,111,240,0.1)', color: '#7C6FF0' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60" />
                公众参与 · 共建共享
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-5 leading-[1.22]">
                <span className="gradient-text">公众参与</span>
              </h1>
              <p className="text-text-3/60 text-sm max-w-lg mx-auto">
                党建引领下的基层文化治理——每位市民都是历史街区的守护者
              </p>
            </div>
          </div>
        </section>

        {/* Tab bar */}
        <section className="pb-8 animate-fade-up">
          <div className="max-w-4xl mx-auto px-6 sm:px-8">
            <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-surface-1 border border-border-1 max-w-xs mx-auto">
              <button
                onClick={() => setTab('reports')}
                className={`flex-1 py-2 px-4 rounded-lg text-[13px] font-medium transition-all cursor-pointer border-none ${
                  tab === 'reports' ? 'bg-white text-text-1 shadow-sm' : 'bg-transparent text-text-3/50 hover:text-text-2'
                }`}
                style={{ cursor: 'pointer' }}
              >
                众治动态
              </button>
              <button
                onClick={() => setTab('submit')}
                className={`flex-1 py-2 px-4 rounded-lg text-[13px] font-medium transition-all cursor-pointer border-none ${
                  tab === 'submit' ? 'bg-white text-text-1 shadow-sm' : 'bg-transparent text-text-3/50 hover:text-text-2'
                }`}
                style={{ cursor: 'pointer' }}
              >
                我要上报
              </button>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="pb-24 sm:pb-32">
          <div className="max-w-3xl mx-auto px-6 sm:px-8">

            {tab === 'reports' ? (
              /* Reports list */
              loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin" />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-text-3/40 text-sm">暂无上报记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((r, i) => {
                    const cat = CATEGORY_LABELS[r.category]
                    const st = STATUS_STYLES[r.status]
                    return (
                      <div key={r.id} className="ink-card rounded-2xl p-5 sm:p-6"
                        style={{ animation: `fade-up 0.5s ease-out ${i * 0.05}s both` }}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-[15px] font-semibold text-text-1">{r.title}</h3>
                          <span className="shrink-0 px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-[0.03em]"
                            style={{ background: st.bg, color: st.text }}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </div>
                        <p className="text-[13px] text-text-3/60 leading-relaxed mb-3">{r.description}</p>
                        <div className="flex items-center gap-4 flex-wrap text-[11px] text-text-3/40">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.text, opacity: 0.5 }} />
                            {cat}
                          </span>
                          <span>{r.createdAt}</span>
                          <span>— {r.reporter}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              /* Submit form */
              <div className="ink-card rounded-2xl p-6 sm:p-8 animate-fade-up">
                {submitted && (
                  <div className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium"
                    style={{ background: 'rgba(76,175,80,0.1)', color: '#2E7D32' }}>
                    ✓ 上报成功！感谢您的参与，我们将尽快审核处理。
                  </div>
                )}
                <div className="space-y-5">
                  <div>
                    <label className="block text-[12px] font-medium text-text-2 mb-1.5">上报类型</label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as CommunityReport['category'])}
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-surface-1 border border-border-1 text-text-1 outline-none focus:border-accent-1/40 transition-colors cursor-pointer"
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="damage">损坏报告</option>
                      <option value="suggestion">保护建议</option>
                      <option value="memory">历史记忆 / 老照片</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-text-2 mb-1.5">标题 <span className="text-accent-3">*</span></label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="简要描述您发现的问题或建议"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-surface-1 border border-border-1 text-text-1 placeholder:text-text-3/30 outline-none focus:border-accent-1/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-text-2 mb-1.5">详细描述 <span className="text-accent-3">*</span></label>
                    <textarea
                      value={formDesc}
                      onChange={e => setFormDesc(e.target.value)}
                      rows={4}
                      placeholder="请详细说明情况，包括具体位置、发现时间等"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-surface-1 border border-border-1 text-text-1 placeholder:text-text-3/30 outline-none focus:border-accent-1/40 transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-text-2 mb-1.5">您的称呼</label>
                    <input
                      type="text"
                      value={formReporter}
                      onChange={e => setFormReporter(e.target.value)}
                      placeholder="留空则为匿名提交"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-surface-1 border border-border-1 text-text-1 placeholder:text-text-3/30 outline-none focus:border-accent-1/40 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !formTitle.trim() || !formDesc.trim()}
                    className="btn-primary w-full text-[14px] py-3 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}
                  >
                    {submitting ? '提交中...' : '提交上报'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
