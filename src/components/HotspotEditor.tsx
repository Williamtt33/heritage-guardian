import { useState, useEffect } from 'react'
import type { Hotspot } from '../types'

interface Props {
  isOpen: boolean
  hotspot: Hotspot | null
  onSave: (data: { title: string; description: string }) => void
  onDelete?: () => void
  onClose: () => void
}

export default function HotspotEditor({ isOpen, hotspot, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (isOpen && hotspot && hotspot.id !== '__pending__') {
      setTitle(hotspot.title || '')
      setDescription(hotspot.description || '')
    } else {
      setTitle('')
      setDescription('')
    }
  }, [isOpen, hotspot])

  if (!isOpen) return null

  const isNew = !hotspot || hotspot.id === '__pending__'

  return (
    <div className="absolute bottom-24 right-4 z-10 animate-fade-in">
      <div className="glass rounded-xl p-5 w-[320px] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-white/80">
            {isNew ? '新建标注' : '编辑标注'}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 bg-transparent border-none cursor-pointer text-sm">✕</button>
        </div>

        <div>
          <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">标题</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="标注标题"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 text-xs focus:outline-none focus:border-accent-1/30 transition-colors"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">描述</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="对这个位置的说明..."
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 text-xs focus:outline-none focus:border-accent-1/30 transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-[10px] text-red-400/60 hover:text-red-400 bg-transparent border-none cursor-pointer"
                style={{ cursor: 'pointer' }}
              >
                删除标注
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 bg-white/[0.02] border border-white/[0.04] cursor-pointer transition-colors"
              style={{ cursor: 'pointer' }}
            >
              取消
            </button>
            <button
              onClick={() => onSave({ title, description })}
              disabled={!title.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-1/80 text-black hover:bg-accent-1 disabled:opacity-30 border-none cursor-pointer transition-colors"
              style={{ cursor: 'pointer' }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
