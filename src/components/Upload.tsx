import { useState, useRef } from 'react'
import { useToast } from './Toast'
import { uploadSplatFile, saveModel } from '../store'

export default function Upload() {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterContact, setReporterContact] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
  }

  const handleUpload = async () => {
    if (!file) { addToast('请先选择文件', 'error'); return }
    if (!name.trim()) { addToast('请输入场景名称', 'error'); return }

    setUploading(true)
    try {
      const modelId = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      // Upload file
      const fileUrl = await uploadSplatFile(modelId, file)
      // Save model metadata (as pending)
      const result = await saveModel({
        id: modelId,
        name: name.trim(),
        description,
        file: fileUrl,
        thumbnail: '',
        tags: [],
        pointCount: '',
        size: formatSize(file.size),
        featured: false,
        hotspots: [],
        reporterName: reporterName.trim() || undefined,
        reporterContact: reporterContact.trim() || undefined,
      })
      setTrackingCode(result.trackingCode)
      addToast('上传成功！请等待管理员审核', 'success')
      // Reset form and show confirmation
      setName(''); setDescription(''); setReporterName(''); setReporterContact(''); setFile(null)
      setSubmitted(true)
    } catch (e: any) {
      addToast(`上传失败: ${e.message}`, 'error')
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setSubmitted(false)
    setTrackingCode('')
  }

  return (
    <main className="min-h-screen bg-surface-0" style={{ paddingTop: '90px' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-display tracking-tight mb-2">上传场景</h1>
        <p className="text-text-3/50 text-sm mb-10">上传 .splat 文件，提交审核后公开展示</p>

        {submitted ? (
          /* ── Success screen ── */
          <div className="ink-card rounded-2xl p-8 text-center animate-fade-up">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(76,175,80,0.1)' }}>
              <svg className="w-8 h-8 text-status-excellent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-display text-text-1 mb-2">提交成功</h2>
            <p className="text-[13px] text-text-3/60 leading-relaxed mb-6">
              您的场景已提交审核，管理员审核通过后将公开展示。
            </p>

            {/* Tracking code */}
            <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(124,111,240,0.06)', border: '1px dashed rgba(124,111,240,0.2)' }}>
              <p className="text-[11px] text-text-3/50 mb-1.5">追踪码 · 用于查询审核进度</p>
              <p className="text-2xl font-mono font-bold tracking-[0.15em] text-accent-1 select-all">{trackingCode}</p>
              <p className="text-[11px] text-text-3/40 mt-2">
                请妥善保存此追踪码。在「公众参与 → 我的上传」中输入追踪码可查询审核状态。
              </p>
            </div>

            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl text-[13px] font-medium text-accent-1/80 hover:text-accent-1 border border-accent-1/20 hover:border-accent-1/40 transition-colors bg-transparent cursor-pointer"
              style={{ cursor: 'pointer' }}
            >
              继续上传
            </button>
          </div>
        ) : (
          /* ── Upload form ── */
          <div className="space-y-6">
            {/* File selection */}
            <div>
              <label className="block text-sm font-medium text-text-2 mb-2">场景文件 (.splat)</label>
              <div
                className="border-2 border-dashed border-border-2 rounded-xl p-8 text-center cursor-pointer hover:border-accent-1/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".splat"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-text-1">{file.name}</p>
                    <p className="text-xs text-text-3/50 mt-1">{formatSize(file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-text-3/40 text-sm">点击选择 .splat 文件</p>
                    <p className="text-text-3/25 text-xs mt-1">最大 50MB</p>
                  </div>
                )}
              </div>
              {file && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-2 text-xs text-accent-3/60 hover:text-accent-3 bg-transparent border-none cursor-pointer"
                  style={{ cursor: 'pointer' }}
                >
                  移除文件
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-text-2 mb-2">场景名称 <span className="text-accent-3">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="为你的场景取一个名字"
                className="w-full px-4 py-3 rounded-xl border border-border-1 bg-white text-text-1 text-sm focus:outline-none focus:border-accent-1/50 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-2 mb-2">场景描述</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="简单描述这个场景..."
                className="w-full px-4 py-3 rounded-xl border border-border-1 bg-white text-text-1 text-sm focus:outline-none focus:border-accent-1/50 transition-colors resize-none"
              />
            </div>

            {/* Reporter info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-2 mb-2">您的称呼</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={e => setReporterName(e.target.value)}
                  placeholder="可选"
                  className="w-full px-4 py-3 rounded-xl border border-border-1 bg-white text-text-1 text-sm focus:outline-none focus:border-accent-1/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-2 mb-2">联系方式</label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={e => setReporterContact(e.target.value)}
                  placeholder="手机号或邮箱（可选）"
                  className="w-full px-4 py-3 rounded-xl border border-border-1 bg-white text-text-1 text-sm focus:outline-none focus:border-accent-1/50 transition-colors"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="btn-primary w-full text-[15px] py-3.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
            >
              {uploading ? '上传中...' : '提交审核'}
            </button>

            <p className="text-[11px] text-text-3/35 text-center">
              提交后需经管理员审核，通过后将公开展示在数字档案中
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
