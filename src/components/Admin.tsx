import { useState, useEffect, useCallback, useRef } from 'react'
import { usePage } from '../App'
import { useToast } from './Toast'
import { getAllModels, deleteModel, setThumbnailOverride, uploadThumbnail, getAllReports, updateReportStatus, deleteReport } from '../store'
import { supabase, isSupabaseConfigured } from '../supabase'
import type { ModelMeta, CommunityReport } from '../types'
import HeritageEditor from './HeritageEditor'

export default function Admin() {
  const { go } = usePage()
  const { addToast } = useToast()
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [models, setModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingThumbId, setUploadingThumbId] = useState<string | null>(null)
  const [pendingThumbModel, setPendingThumbModel] = useState<string | null>(null)
  const [editingHeritage, setEditingHeritage] = useState<ModelMeta | null>(null)
  const [activeSection, setActiveSection] = useState<'models' | 'reports'>('models')
  const [reports, setReports] = useState<CommunityReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAllModels().then(setModels).finally(() => setLoading(false))
  }, [])

  const loadReports = useCallback(() => {
    setReportsLoading(true)
    getAllReports().then(setReports).finally(() => setReportsLoading(false))
  }, [])

  useEffect(() => {
    // Check if already signed in to Supabase
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setAuthed(true); load(); loadReports() }
      else setLoading(false)
    })
  }, [load])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')

    // Local credential fallback (works without Supabase)
    if (email === '1590992057@qq.com' && password === 'Admin123456!') {
      setAuthed(true)
      addToast('已登录（本地验证）', 'success')
      load()
      // Also try Supabase sync in background
      supabase.auth.signInWithPassword({ email, password }).catch(() => {})
      return
    }

    // Try Supabase auth
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError('邮箱或密码错误')
      } else {
        setAuthed(true)
        addToast('已登录', 'success')
        load()
      }
    } catch {
      setAuthError('登录服务不可用，请检查网络')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模型吗？')) return
    try {
      await deleteModel(id)
      addToast('已删除', 'success')
      load()
    } catch (e: any) {
      addToast(`删除失败: ${e.message}`, 'error')
    }
  }

  const handleThumbClick = (modelId: string) => {
    setPendingThumbModel(modelId)
    // Reset input value so re-selecting the same file triggers change
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }

  const handleThumbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const modelId = pendingThumbModel
    if (!file || !modelId) return

    setUploadingThumbId(modelId)
    setPendingThumbModel(null)

    try {
      const dataUrl = await resizeImage(file, 800, 0.75)
      let thumbnailUrl: string
      if (isSupabaseConfigured()) {
        thumbnailUrl = await uploadThumbnail(modelId, dataUrl)
      } else {
        thumbnailUrl = dataUrl
      }
      setThumbnailOverride(modelId, thumbnailUrl)
      addToast('封面已更新', 'success')
      load()
    } catch (e: any) {
      addToast(`封面设置失败: ${e.message}`, 'error')
    } finally {
      setUploadingThumbId(null)
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-surface-0 flex items-center justify-center" style={{ paddingTop: '90px' }}>
        <div className="w-full max-w-sm mx-auto px-6">
          <h1 className="text-2xl font-display tracking-tight text-center mb-8">管理员登录</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="邮箱"
                className="w-full px-4 py-3 rounded-xl border border-border-1 bg-white text-text-1 text-sm focus:outline-none focus:border-accent-1/50 transition-colors"
                required
              />
            </div>
            <div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="密码"
                className="w-full px-4 py-3 rounded-xl border border-border-1 bg-white text-text-1 text-sm focus:outline-none focus:border-accent-1/50 transition-colors"
                required
              />
            </div>
            {authError && <p className="text-accent-3 text-xs">{authError}</p>}
            <button type="submit" className="btn-primary w-full text-[14px] py-3 rounded-xl" style={{ cursor: 'pointer' }}>
              登录
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface-0" style={{ paddingTop: '90px' }}>
      {/* Hidden file input for thumbnail upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleThumbFile}
        className="hidden"
      />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl font-display tracking-tight">模型管理</h1>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-white border border-border-1 text-text-3/70 text-xs hover:text-text-1 transition-colors cursor-pointer"
            style={{ cursor: 'pointer' }}
          >
            刷新
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-1 border border-border-1 max-w-xs mx-auto mb-8">
          <button
            onClick={() => setActiveSection('models')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-medium transition-all cursor-pointer border-none ${
              activeSection === 'models' ? 'bg-white text-text-1 shadow-sm' : 'bg-transparent text-text-3/50 hover:text-text-2'
            }`}
            style={{ cursor: 'pointer' }}
          >
            模型管理
          </button>
          <button
            onClick={() => { setActiveSection('reports'); loadReports() }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-medium transition-all cursor-pointer border-none ${
              activeSection === 'reports' ? 'bg-white text-text-1 shadow-sm' : 'bg-transparent text-text-3/50 hover:text-text-2'
            }`}
            style={{ cursor: 'pointer' }}
          >
            公众上报
          </button>
        </div>

        {activeSection === 'models' ? (
          /* ── Models list ── */
          loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin mx-auto" />
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-text-3/50 text-sm">暂无模型</p>
            </div>
          ) : (
            <div className="space-y-3">
              {models.map(model => (
                <div
                  key={model.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white border border-border-1"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => handleThumbClick(model.id)}
                    className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-surface-2 border border-border-1 relative group/thumb"
                    style={{ cursor: 'pointer' }}
                    title="点击设置封面"
                  >
                    {model.thumbnail ? (
                      <img src={model.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-3/15">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21,15 16,10 5,21" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                      <svg className="w-4 h-4 text-white opacity-0 group-hover/thumb:opacity-90 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    {uploadingThumbId === model.id && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-accent-1 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-1">{model.name}</p>
                    <p className="text-[11px] text-text-3/50 truncate">{model.file}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-text-3/40 font-mono">{model.pointCount || '-'}</span>
                    <span className="text-[10px] text-text-3/40 font-mono">{model.size || '-'}</span>
                  </div>
                  <button
                    onClick={() => setEditingHeritage(model)}
                    className="px-3 py-1.5 rounded-lg text-[11px] text-accent-2/70 hover:bg-accent-2/5 transition-colors bg-transparent border-none cursor-pointer"
                    style={{ cursor: 'pointer' }}
                    title="编辑文保信息"
                  >
                    文保
                  </button>
                  <button
                    onClick={() => go({ route: 'viewer', modelId: model.id, edit: true })}
                    className="px-3 py-1.5 rounded-lg text-[11px] text-accent-1/70 hover:bg-accent-1/5 transition-colors bg-transparent border-none cursor-pointer"
                    style={{ cursor: 'pointer' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="px-3 py-1.5 rounded-lg text-[11px] text-accent-3/70 hover:bg-accent-3/5 transition-colors bg-transparent border-none cursor-pointer"
                    style={{ cursor: 'pointer' }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── Reports review panel ── */
          <div className="space-y-3">
            {reportsLoading ? (
              <div className="text-center py-10">
                <div className="w-6 h-6 border-2 border-accent-1/20 border-t-accent-1 rounded-full animate-spin mx-auto" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-text-3/40 text-sm">暂无上报记录</p>
              </div>
            ) : (
              reports.map((r: CommunityReport) => {
                const stLabel = { pending: '待审核', reviewed: '已审核', resolved: '已处理' }[r.status]
                const stColors: Record<string, { bg: string; text: string }> = {
                  pending: { bg: 'rgba(255,152,0,0.1)', text: '#E65100' },
                  reviewed: { bg: 'rgba(124,111,240,0.1)', text: '#7C6FF0' },
                  resolved: { bg: 'rgba(76,175,80,0.1)', text: '#2E7D32' },
                }
                const st = stColors[r.status]
                const catLabel = { damage: '损坏报告', suggestion: '保护建议', memory: '历史记忆', other: '其他' }[r.category]
                return (
                  <div key={r.id} className="p-4 rounded-xl bg-white border border-border-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-[0.03em]"
                            style={{ background: st.bg, color: st.text }}>
                            {stLabel}
                          </span>
                          <span className="text-[10px] text-text-3/40">{catLabel}</span>
                          <span className="text-[10px] text-text-3/40">{r.createdAt}</span>
                        </div>
                        <h3 className="text-[14px] font-medium text-text-1">{r.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.status === 'pending' && (
                          <>
                            <button
                              onClick={async () => {
                                await updateReportStatus(r.id, 'reviewed')
                                addToast('已标记为审核通过', 'success')
                                loadReports()
                              }}
                              className="px-2.5 py-1 rounded-md text-[10px] font-medium text-white bg-accent-1/80 hover:bg-accent-1 border-none cursor-pointer transition-colors"
                              style={{ cursor: 'pointer' }}
                            >
                              通过
                            </button>
                            <button
                              onClick={async () => {
                                await updateReportStatus(r.id, 'resolved', '经审核，此上报已处理')
                                addToast('已标记为处理完成', 'success')
                                loadReports()
                              }}
                              className="px-2.5 py-1 rounded-md text-[10px] font-medium text-white bg-status-excellent/80 hover:bg-status-excellent border-none cursor-pointer transition-colors"
                              style={{ cursor: 'pointer' }}
                            >
                              处理
                            </button>
                          </>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm('确定要删除这条上报吗？')) return
                            await deleteReport(r.id)
                            addToast('已删除', 'success')
                            loadReports()
                          }}
                          className="px-2 py-1 rounded-md text-[10px] text-accent-3/60 hover:text-accent-3 hover:bg-accent-3/5 border-none bg-transparent cursor-pointer transition-colors"
                          style={{ cursor: 'pointer' }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="text-[12px] text-text-3/60 leading-relaxed mb-2">{r.description}</p>
                    {r.photos.length > 0 && (
                      <div className="flex gap-2 mb-2">
                        {r.photos.map((url: string, i: number) => (
                          <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border-1" />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-text-3/30">
                      <span>{r.reporter}</span>
                      {r.adminNote && <span className="text-accent-1/60">备注：{r.adminNote}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Heritage Editor Modal */}
        {editingHeritage && (
          <HeritageEditor
            model={editingHeritage}
            onClose={() => setEditingHeritage(null)}
            onSaved={() => {
              setEditingHeritage(null)
              addToast('文保信息已保存', 'success')
              load()
            }}
          />
        )}
      </div>
    </main>
  )
}

/** Resize an image file to maxDim on longest side, return JPEG data URL */
function resizeImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}
