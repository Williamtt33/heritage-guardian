import { useState, useRef } from 'react'
import { usePage } from '../App'
import { useToast } from './Toast'
import { uploadSplatFile, saveModel } from '../store'

export default function Upload() {
  const { go } = usePage()
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    // Revoke old URL if needed
    URL.createObjectURL(f) // keep for GC
  }

  const handleUpload = async () => {
    if (!file) { addToast('请先选择文件', 'error'); return }
    if (!name.trim()) { addToast('请输入场景名称', 'error'); return }

    setUploading(true)
    try {
      const modelId = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      // Upload file
      const fileUrl = await uploadSplatFile(modelId, file)
      // Save model metadata
      await saveModel({
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
      })
      addToast('上传成功！', 'success')
      go({ route: 'viewer', modelId })
    } catch (e: any) {
      addToast(`上传失败: ${e.message}`, 'error')
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-0" style={{ paddingTop: '90px' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-display tracking-tight mb-2">上传场景</h1>
        <p className="text-text-3/50 text-sm mb-10">上传 .splat 文件到云端展示</p>

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
            <label className="block text-sm font-medium text-text-2 mb-2">场景名称 *</label>
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

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="btn-primary w-full text-[15px] py-3.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            {uploading ? '上传中...' : '上传到云端'}
          </button>
        </div>
      </div>
    </main>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
