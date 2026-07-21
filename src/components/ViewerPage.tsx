import { useState, useEffect } from 'react'
import { resolveModelSource } from '../store'
import { getModelById } from '../store'
import type { ModelMeta } from '../types'
import Viewer3D from './Viewer3D'

interface Props {
  modelId: string
  edit?: boolean
}

export default function ViewerPage({ modelId, edit }: Props) {
  const [model, setModel] = useState<ModelMeta | null>(null)
  const [source, setSource] = useState<{ type: 'url'; url: string } | { type: 'buffer'; buffer: ArrayBuffer; format?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getModelById(modelId).then(async (m) => {
      if (cancelled || !m) {
        if (!cancelled) setError('模型未找到')
        setLoading(false)
        return
      }
      setModel(m)
      try {
        const src = await resolveModelSource(m)
        if (!cancelled) setSource(src)
      } catch (e: any) {
        if (!cancelled) setError(e.message || '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }).catch(e => {
      if (!cancelled) { setError(e.message); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [modelId])

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-accent-1 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !model) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-400 text-4xl mb-4">⚠</div>
          <p className="text-red-300 mb-2 font-semibold">加载失败</p>
          <p className="text-white/40 text-sm max-w-md">{error || '模型未找到'}</p>
        </div>
      </div>
    )
  }

  if (!source) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-sm">无法解析模型源</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Viewer3D
        modelSource={source}
        modelName={model.name}
        modelId={modelId}
        readOnly={!edit}
        heritageModel={model}
      />
    </div>
  )
}
