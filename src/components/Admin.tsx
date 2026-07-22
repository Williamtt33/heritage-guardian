import { useState, useEffect, useCallback, useRef } from 'react'
import { usePage } from '../App'
import { useToast } from './Toast'
import { getAllModels, deleteModel, setThumbnailOverride, uploadThumbnail, getAllReports, updateReportStatus, deleteReport, getPendingModels, approveModel, rejectModel, getRejectedModels, saveModelDirect, saveHeritageMeta } from '../store'
import { supabase, isSupabaseConfigured } from '../supabase'
import type { ModelMeta, CommunityReport, HistoricalPhoto, ArchiveDocument, RepairRecord, RedCultureMark } from '../types'
import { PROTECTION_LEVEL_LABELS, CONSERVATION_STATUS_LABELS, uid } from '../types'
import type { HeritageMeta } from '../store'
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
  const [pendingModels, setPendingModels] = useState<ModelMeta[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [rejectedModels, setRejectedModels] = useState<ModelMeta[]>([])
  const [showRejected, setShowRejected] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<ModelMeta | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Add model state ──
  const [showAddModal, setShowAddModal] = useState(false)
  const [addTab, setAddTab] = useState<'basic' | 'heritage' | 'photos' | 'docs' | 'repairs' | 'red'>('basic')
  const [addSaving, setAddSaving] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '', description: '', file: '', thumbnail: '', pointCount: '', size: '',
    featured: false, tags: '',
    protectionLevel: 'none' as HeritageMeta['protectionLevel'],
    constructionYear: '', architecturalStyle: '',
    conservationStatus: 'good' as HeritageMeta['conservationStatus'],
    locationAddress: '', locationDistrict: '', locationLat: '0', locationLng: '0',
    historicalPhotos: [] as HistoricalPhoto[],
    documents: [] as ArchiveDocument[],
    repairRecords: [] as RepairRecord[],
    redCultureMarks: [] as RedCultureMark[],
  })

  const load = useCallback(() => {
    setLoading(true)
    getAllModels().then(setModels).finally(() => setLoading(false))
  }, [])

  const loadReports = useCallback(() => {
    setReportsLoading(true)
    getAllReports().then(setReports).finally(() => setReportsLoading(false))
  }, [])

  const loadPending = useCallback(() => {
    setPendingLoading(true)
    getPendingModels().then(setPendingModels).finally(() => setPendingLoading(false))
  }, [])

  const loadRejected = useCallback(() => {
    getRejectedModels().then(setRejectedModels)
  }, [])

  useEffect(() => {
    // Check if already signed in to Supabase
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setAuthed(true); load(); loadReports(); loadPending(); loadRejected() }
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
      load(); loadPending(); loadRejected()
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
        load(); loadPending(); loadRejected()
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

  const handleApprove = async (id: string) => {
    try {
      await approveModel(id)
      addToast('模型已审核通过，已公开展示', 'success')
      load(); loadPending()
    } catch (e: any) {
      addToast(`审核失败: ${e.message}`, 'error')
    }
  }

  const handleReject = (model: ModelMeta) => {
    setRejectTarget(model)
    setRejectReason('')
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      await rejectModel(rejectTarget.id, rejectReason.trim() || undefined)
      addToast('已拒绝该模型', 'success')
      setRejectTarget(null)
      setRejectReason('')
      loadPending(); loadRejected()
    } catch (e: any) {
      addToast(`操作失败: ${e.message}`, 'error')
    } finally {
      setRejecting(false)
    }
  }

  const handleAddSave = async () => {
    if (!addForm.name.trim() || !addForm.file.trim()) {
      addToast('请至少填写名称和文件路径', 'error')
      return
    }
    setAddSaving(true)
    try {
      const modelId = addForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const tags = addForm.tags.split(',').map(t => t.trim()).filter(Boolean)

      // Save model directly as approved
      await saveModelDirect({
        id: modelId,
        name: addForm.name.trim(),
        description: addForm.description.trim(),
        file: addForm.file.trim(),
        thumbnail: addForm.thumbnail.trim(),
        pointCount: addForm.pointCount.trim(),
        size: addForm.size.trim(),
        featured: addForm.featured,
        tags,
        hotspots: [],
      })

      // Save heritage metadata
      const loc = addForm.locationAddress.trim() || addForm.locationDistrict.trim()
        ? {
            address: addForm.locationAddress.trim(),
            district: addForm.locationDistrict.trim(),
            lat: parseFloat(addForm.locationLat) || 0,
            lng: parseFloat(addForm.locationLng) || 0,
          }
        : undefined
      saveHeritageMeta(modelId, {
        protectionLevel: addForm.protectionLevel === 'none' ? undefined : addForm.protectionLevel,
        constructionYear: addForm.constructionYear.trim() || undefined,
        architecturalStyle: addForm.architecturalStyle.trim() || undefined,
        conservationStatus: addForm.conservationStatus,
        location: loc,
        historicalPhotos: addForm.historicalPhotos.filter(p => p.url || p.caption),
        documents: addForm.documents.filter(d => d.title),
        repairRecords: addForm.repairRecords.filter(r => r.description),
        redCultureMarks: addForm.redCultureMarks.filter(r => r.title),
      })

      addToast(`模型「${addForm.name.trim()}」已创建`, 'success')
      setShowAddModal(false)
      // Reset form
      setAddForm({
        name: '', description: '', file: '', thumbnail: '', pointCount: '', size: '',
        featured: false, tags: '',
        protectionLevel: 'none', constructionYear: '', architecturalStyle: '',
        conservationStatus: 'good', locationAddress: '', locationDistrict: '', locationLat: '0', locationLng: '0',
        historicalPhotos: [], documents: [], repairRecords: [], redCultureMarks: [],
      })
      load()
    } catch (e: any) {
      addToast(`创建失败: ${e.message}`, 'error')
    } finally {
      setAddSaving(false)
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg text-[12px] font-medium text-white bg-accent-1/85 hover:bg-accent-1 border-none cursor-pointer transition-colors"
              style={{ cursor: 'pointer' }}
            >
              + 添加模型
            </button>
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg bg-white border border-border-1 text-text-3/70 text-xs hover:text-text-1 transition-colors cursor-pointer"
              style={{ cursor: 'pointer' }}
            >
              刷新
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-1 border border-border-1 max-w-xs mx-auto mb-8">
          <button
            onClick={() => setActiveSection('models')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-medium transition-all cursor-pointer border-none relative ${
              activeSection === 'models' ? 'bg-white text-text-1 shadow-sm' : 'bg-transparent text-text-3/50 hover:text-text-2'
            }`}
            style={{ cursor: 'pointer' }}
          >
            模型管理
            {pendingModels.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-needs-repair text-white text-[9px] font-bold flex items-center justify-center"
                style={{ background: '#E65100' }}>
                {pendingModels.length > 9 ? '9+' : pendingModels.length}
              </span>
            )}
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
          <>
            {/* Pending review section */}
            {!pendingLoading && pendingModels.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-status-needs-repair animate-pulse" />
                  <h2 className="text-[13px] font-semibold text-text-1">待审核模型</h2>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                    style={{ background: 'rgba(255,152,0,0.12)', color: '#E65100' }}>
                    {pendingModels.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingModels.map(model => (
                    <div key={model.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white border border-status-needs-repair/20"
                      style={{ borderColor: 'rgba(255,152,0,0.2)' }}>
                      <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-surface-2 border border-border-1">
                        {model.thumbnail ? (
                          <img src={model.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-3/15">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-1">{model.name}</p>
                        <p className="text-[11px] text-text-3/50 truncate">{model.file}</p>
                        <p className="text-[10px] text-text-3/30 mt-0.5">{model.description?.slice(0, 40)}{(model.description?.length ?? 0) > 40 ? '…' : ''}</p>
                        {(model.reporterName || model.trackingCode) && (
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-text-3/30">
                            {model.reporterName && <span>上传者：{model.reporterName}</span>}
                            {model.reporterContact && <span>{model.reporterContact}</span>}
                            {model.trackingCode && <span className="font-mono tracking-wider">{model.trackingCode}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-text-3/40 font-mono">{model.size || '-'}</span>
                      </div>
                      <button
                        onClick={() => handleApprove(model.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-status-excellent/80 hover:bg-status-excellent border-none cursor-pointer transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReject(model)}
                        className="px-3 py-1.5 rounded-lg text-[11px] text-accent-3/70 hover:text-accent-3 hover:bg-accent-3/5 bg-transparent border-none cursor-pointer transition-colors"
                        style={{ cursor: 'pointer' }}
                      >
                        拒绝
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected models section (collapsed by default) */}
            {rejectedModels.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowRejected(!showRejected)}
                  className="flex items-center gap-2 text-[12px] text-text-3/40 hover:text-text-3/60 transition-colors bg-transparent border-none cursor-pointer mb-2"
                  style={{ cursor: 'pointer' }}
                >
                  <svg className={`w-3 h-3 transition-transform ${showRejected ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  已拒绝的模型 ({rejectedModels.length})
                </button>
                {showRejected && (
                  <div className="space-y-2">
                    {rejectedModels.map(model => (
                      <div key={model.id}
                        className="flex items-center gap-4 p-3 rounded-xl bg-white/50 border border-accent-3/10">
                        <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-surface-2 border border-border-1 flex items-center justify-center text-text-3/12">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-text-3/50 line-through">{model.name}</p>
                          {model.reviewNote && (
                            <p className="text-[11px] text-accent-3/50 mt-0.5">原因：{model.reviewNote}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading ? (
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
          )}
          </>
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

        {/* Rejection Reason Modal */}
        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-fade-up">
              <h3 className="text-[15px] font-semibold text-text-1 mb-1">拒绝模型</h3>
              <p className="text-[12px] text-text-3/50 mb-4">
                拒绝「{rejectTarget.name}」的上传申请
              </p>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-text-2 mb-1.5">拒绝原因（可选）</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="填写拒绝原因，上传者可在「我的上传」中查看…"
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-surface-1 border border-border-1 text-text-1 placeholder:text-text-3/30 outline-none focus:border-accent-3/30 transition-colors resize-none"
                />
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => { setRejectTarget(null); setRejectReason('') }}
                  className="px-4 py-2 rounded-xl text-[12px] text-text-3/60 hover:text-text-1 bg-transparent border-none cursor-pointer transition-colors"
                  style={{ cursor: 'pointer' }}
                  disabled={rejecting}
                >
                  取消
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={rejecting}
                  className="px-5 py-2 rounded-xl text-[12px] font-medium text-white bg-accent-3/80 hover:bg-accent-3 border-none cursor-pointer transition-colors disabled:opacity-50"
                  style={{ cursor: rejecting ? 'not-allowed' : 'pointer' }}
                >
                  {rejecting ? '处理中…' : '确认拒绝'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Model Modal ── */}
        {showAddModal && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white border border-border-1 shadow-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-1">
                <h2 className="text-[15px] font-semibold text-text-1 font-display tracking-wide">添加模型</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-text-3/50 hover:text-text-1 hover:bg-surface-2 transition-colors bg-transparent border-none cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Tab bar */}
              <div className="shrink-0 flex gap-0 px-6 border-b border-border-1 bg-surface-0/50 overflow-x-auto">
                {([
                  { key: 'basic' as const, label: '基本信息' },
                  { key: 'heritage' as const, label: '文保信息' },
                  { key: 'photos' as const, label: '历史照片' },
                  { key: 'docs' as const, label: '文史档案' },
                  { key: 'repairs' as const, label: '修缮记录' },
                  { key: 'red' as const, label: '红色印记' },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setAddTab(t.key)}
                    className={`px-4 py-2.5 text-[12px] font-medium tracking-wide transition-colors bg-transparent border-none cursor-pointer border-b-2 -mb-[1px] whitespace-nowrap ${
                      addTab === t.key
                        ? 'text-accent-1 border-accent-1'
                        : 'text-text-3/60 border-transparent hover:text-text-2'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {addTab === 'basic' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">名称 <span className="text-accent-3">*</span></label>
                      <input type="text" value={addForm.name}
                        onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="如：沙面汇丰银行旧址"
                        className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">文件路径 <span className="text-accent-3">*</span></label>
                      <input type="text" value={addForm.file}
                        onChange={e => setAddForm(f => ({ ...f, file: e.target.value }))}
                        placeholder="如：models/scene.splat 或 https://..."
                        className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      <p className="text-[10px] text-text-3/40 mt-1">支持相对路径（public/models/）或完整 HTTPS URL</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">描述</label>
                      <textarea value={addForm.description}
                        onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                        rows={3} placeholder="建筑的历史背景、建筑特色等"
                        className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">缩略图 URL</label>
                        <input type="text" value={addForm.thumbnail}
                          onChange={e => setAddForm(f => ({ ...f, thumbnail: e.target.value }))}
                          placeholder="https://..."
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">标签（逗号分隔）</label>
                        <input type="text" value={addForm.tags}
                          onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))}
                          placeholder="岭南建筑, 石雕"
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">点数（展示用）</label>
                        <input type="text" value={addForm.pointCount}
                          onChange={e => setAddForm(f => ({ ...f, pointCount: e.target.value }))}
                          placeholder="如：969K"
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">文件大小</label>
                        <input type="text" value={addForm.size}
                          onChange={e => setAddForm(f => ({ ...f, size: e.target.value }))}
                          placeholder="如：23.4 MB"
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={addForm.featured}
                        onChange={e => setAddForm(f => ({ ...f, featured: e.target.checked }))}
                        className="w-4 h-4 rounded border-border-1 text-accent-1 focus:ring-accent-1/30" />
                      <span className="text-[12px] text-text-2">首页精选展示</span>
                    </label>
                  </div>
                )}

                {addTab === 'heritage' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">保护级别</label>
                        <select value={addForm.protectionLevel ?? 'none'}
                          onChange={e => setAddForm(f => ({ ...f, protectionLevel: e.target.value as HeritageMeta['protectionLevel'] }))}
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors cursor-pointer">
                          {Object.entries(PROTECTION_LEVEL_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">保存状态</label>
                        <select value={addForm.conservationStatus ?? 'good'}
                          onChange={e => setAddForm(f => ({ ...f, conservationStatus: e.target.value as HeritageMeta['conservationStatus'] }))}
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors cursor-pointer">
                          {Object.entries(CONSERVATION_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">建造年代</label>
                        <input type="text" value={addForm.constructionYear}
                          onChange={e => setAddForm(f => ({ ...f, constructionYear: e.target.value }))}
                          placeholder="如：清光绪年间（约1880年）"
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">建筑风格</label>
                        <input type="text" value={addForm.architecturalStyle}
                          onChange={e => setAddForm(f => ({ ...f, architecturalStyle: e.target.value }))}
                          placeholder="如：岭南石雕、徽派建筑"
                          className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                    </div>
                    <fieldset className="rounded-xl border border-border-1 p-4 space-y-3">
                      <legend className="text-[11px] font-medium text-text-3 px-1 tracking-wide">地理位置</legend>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">地址</label>
                          <input type="text" value={addForm.locationAddress}
                            onChange={e => setAddForm(f => ({ ...f, locationAddress: e.target.value }))}
                            placeholder="详细地址"
                            className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">所属区域</label>
                          <input type="text" value={addForm.locationDistrict}
                            onChange={e => setAddForm(f => ({ ...f, locationDistrict: e.target.value }))}
                            placeholder="如：越秀区"
                            className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">纬度</label>
                          <input type="number" step="any" value={addForm.locationLat}
                            onChange={e => setAddForm(f => ({ ...f, locationLat: e.target.value }))}
                            placeholder="23.1196"
                            className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide">经度</label>
                          <input type="number" step="any" value={addForm.locationLng}
                            onChange={e => setAddForm(f => ({ ...f, locationLng: e.target.value }))}
                            placeholder="113.2591"
                            className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                        </div>
                      </div>
                    </fieldset>
                  </div>
                )}

                {addTab === 'photos' && <ListEditor
                  items={addForm.historicalPhotos}
                  emptyText="暂无历史照片"
                  addLabel="+ 添加照片"
                  onAdd={() => setAddForm(f => ({ ...f, historicalPhotos: [...f.historicalPhotos, { id: uid(), url: '', year: '', caption: '' }] }))}
                  onRemove={i => setAddForm(f => ({ ...f, historicalPhotos: f.historicalPhotos.filter((_, j) => j !== i) }))}
                  renderItem={(p, i) => (
                    <div className="space-y-2">
                      <input type="text" value={p.url} onChange={e => {
                        const list = [...addForm.historicalPhotos]; list[i] = { ...list[i], url: e.target.value }; setAddForm(f => ({ ...f, historicalPhotos: list }))
                      }} placeholder="图片 URL" className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={p.year} onChange={e => {
                          const list = [...addForm.historicalPhotos]; list[i] = { ...list[i], year: e.target.value }; setAddForm(f => ({ ...f, historicalPhotos: list }))
                        }} placeholder="年代" className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                        <input type="text" value={p.caption} onChange={e => {
                          const list = [...addForm.historicalPhotos]; list[i] = { ...list[i], caption: e.target.value }; setAddForm(f => ({ ...f, historicalPhotos: list }))
                        }} placeholder="图片说明" className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                    </div>
                  )}
                />}

                {addTab === 'docs' && <ListEditor
                  items={addForm.documents}
                  emptyText="暂无文史档案"
                  addLabel="+ 添加档案"
                  onAdd={() => setAddForm(f => ({ ...f, documents: [...f.documents, { id: uid(), title: '', type: 'other' as ArchiveDocument['type'], description: '', url: '' }] }))}
                  onRemove={i => setAddForm(f => ({ ...f, documents: f.documents.filter((_, j) => j !== i) }))}
                  renderItem={(d, i) => (
                    <div className="space-y-2">
                      <input type="text" value={d.title} onChange={e => {
                        const list = [...addForm.documents]; list[i] = { ...list[i], title: e.target.value }; setAddForm(f => ({ ...f, documents: list }))
                      }} placeholder="档案标题" className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      <div className="flex gap-2">
                        <select value={d.type} onChange={e => {
                          const list = [...addForm.documents]; list[i] = { ...list[i], type: e.target.value as ArchiveDocument['type'] }; setAddForm(f => ({ ...f, documents: list }))
                        }} className="w-32 px-2 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none cursor-pointer">
                          <option value="history">历史资料</option>
                          <option value="architecture">建筑测绘</option>
                          <option value="culture">文化研究</option>
                          <option value="party_history">党史资料</option>
                          <option value="other">其他</option>
                        </select>
                        <input type="text" value={d.url ?? ''} onChange={e => {
                          const list = [...addForm.documents]; list[i] = { ...list[i], url: e.target.value }; setAddForm(f => ({ ...f, documents: list }))
                        }} placeholder="文件 URL（可选）" className="flex-1 px-2 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      </div>
                      <textarea value={d.description} onChange={e => {
                        const list = [...addForm.documents]; list[i] = { ...list[i], description: e.target.value }; setAddForm(f => ({ ...f, documents: list }))
                      }} placeholder="档案描述" rows={2} className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40 resize-none" />
                    </div>
                  )}
                />}

                {addTab === 'repairs' && <ListEditor
                  items={addForm.repairRecords}
                  emptyText="暂无修缮记录"
                  addLabel="+ 添加修缮记录"
                  onAdd={() => setAddForm(f => ({ ...f, repairRecords: [...f.repairRecords, { id: uid(), date: '', description: '', photos: [] }] }))}
                  onRemove={i => setAddForm(f => ({ ...f, repairRecords: f.repairRecords.filter((_, j) => j !== i) }))}
                  renderItem={(r, i) => (
                    <div className="space-y-2">
                      <input type="text" value={r.date} onChange={e => {
                        const list = [...addForm.repairRecords]; list[i] = { ...list[i], date: e.target.value }; setAddForm(f => ({ ...f, repairRecords: list }))
                      }} placeholder="日期（如：2023-08）" className="w-44 px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      <textarea value={r.description} onChange={e => {
                        const list = [...addForm.repairRecords]; list[i] = { ...list[i], description: e.target.value }; setAddForm(f => ({ ...f, repairRecords: list }))
                      }} placeholder="修缮描述" rows={2} className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40 resize-none" />
                    </div>
                  )}
                />}

                {addTab === 'red' && <ListEditor
                  items={addForm.redCultureMarks}
                  emptyText="暂无红色文化印记"
                  addLabel="+ 添加红色印记"
                  onAdd={() => setAddForm(f => ({ ...f, redCultureMarks: [...f.redCultureMarks, { id: uid(), title: '', description: '', period: '' }] }))}
                  onRemove={i => setAddForm(f => ({ ...f, redCultureMarks: f.redCultureMarks.filter((_, j) => j !== i) }))}
                  renderItem={(r, i) => (
                    <div className="space-y-2">
                      <input type="text" value={r.title} onChange={e => {
                        const list = [...addForm.redCultureMarks]; list[i] = { ...list[i], title: e.target.value }; setAddForm(f => ({ ...f, redCultureMarks: list }))
                      }} placeholder="标题（如：大革命时期工农集会点）" className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      <input type="text" value={r.period} onChange={e => {
                        const list = [...addForm.redCultureMarks]; list[i] = { ...list[i], period: e.target.value }; setAddForm(f => ({ ...f, redCultureMarks: list }))
                      }} placeholder="历史时期（如：抗日战争时期 1942-1944）" className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40" />
                      <textarea value={r.description} onChange={e => {
                        const list = [...addForm.redCultureMarks]; list[i] = { ...list[i], description: e.target.value }; setAddForm(f => ({ ...f, redCultureMarks: list }))
                      }} placeholder="详细描述" rows={2} className="w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40 resize-none" />
                    </div>
                  )}
                />}
              </div>

              {/* Footer */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border-1 bg-surface-0/50">
                <p className="text-[10px] text-text-3/40">管理员创建的模型将直接通过审核并公开展示</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-[12px] text-text-2/70 hover:text-text-1 bg-transparent border border-border-1 hover:bg-surface-1 transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddSave}
                    disabled={addSaving || !addForm.name.trim() || !addForm.file.trim()}
                    className="px-5 py-2 rounded-xl text-[12px] font-medium text-white bg-accent-1 hover:opacity-90 transition-opacity border-none cursor-pointer disabled:opacity-50"
                  >
                    {addSaving ? '创建中…' : '创建模型'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/** Generic list editor used in Add Model modal */
function ListEditor<T>({ items, emptyText, addLabel, onAdd, onRemove, renderItem }: {
  items: T[]
  emptyText: string
  addLabel: string
  onAdd: () => void
  onRemove: (i: number) => void
  renderItem: (item: T, i: number) => React.ReactNode
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-[12px] text-text-3/50 text-center py-8">{emptyText}</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl bg-surface-0 border border-border-1 items-start">
          <div className="flex-1">{renderItem(item, i)}</div>
          <button onClick={() => onRemove(i)}
            className="px-2.5 py-1 rounded-lg text-[11px] text-accent-3/60 hover:text-accent-3 hover:bg-accent-3/5 transition-colors bg-transparent border-none cursor-pointer"
            style={{ marginTop: 2 }}>
            删除
          </button>
        </div>
      ))}
      <button onClick={onAdd}
        className="px-3 py-1.5 rounded-lg text-[11px] text-accent-1/70 hover:bg-accent-1/5 transition-colors bg-transparent border border-accent-1/15 cursor-pointer">
        {addLabel}
      </button>
    </div>
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
