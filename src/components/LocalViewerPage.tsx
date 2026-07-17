import { useState, useEffect } from 'react'
import { getLocalFile } from '../App'
import Viewer3D from './Viewer3D'

export default function LocalViewerPage() {
  const [source, setSource] = useState<{ type: 'buffer'; buffer: ArrayBuffer } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const file = getLocalFile()
    if (!file) {
      setError('没有本地文件数据')
      return
    }
    setSource({ type: 'buffer', buffer: file.buffer })
  }, [])

  if (error) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-400 text-4xl mb-4">⚠</div>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!source) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-accent-1 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Viewer3D
      modelSource={source}
      modelName="本地文件"
      modelId="local"
      readOnly
    />
  )
}
