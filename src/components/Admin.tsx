import { useState, useEffect, useCallback, useRef } from 'react'
import { usePage } from '../App'
import { useToast } from './Toast'
import { getAllModels, deleteModel, setThumbnailOverride, uploadThumbnail } from '../store'
import { supabase, isSupabaseConfigured } from '../supabase'
import type { ModelMeta } from '../types'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAllModels().then(setModels).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Check if already signed in to Supabase
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setAuthed(true); load() }
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
