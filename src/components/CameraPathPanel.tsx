import { useState, useEffect, useCallback, useRef } from 'react'
import type { Camera, OrbitControls } from 'gsplat'
import type { CameraPath, Keyframe } from '../types'
import type { PlaybackEngine } from '../hooks/usePathPlayer'
import { getCameraPaths, saveCameraPaths } from '../store'

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

interface Props {
  modelId: string
  cameraRef: React.RefObject<Camera | null>
  controlsRef: React.RefObject<OrbitControls | null>
  splatModuleRef: React.RefObject<typeof import('gsplat') | null>
  playback: PlaybackEngine
  activePathId: string | null
  onSelectPath: (path: CameraPath | null) => void
  visible: boolean
  onClose: () => void
}

export default function CameraPathPanel({
  modelId, cameraRef, playback, activePathId, onSelectPath, visible, onClose,
}: Props) {
  const [paths, setPaths] = useState<CameraPath[]>([])
  const [name, setName] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const recordTimerRef = useRef<number>(0)
  const recordingPathRef = useRef<CameraPath | null>(null)

  // Load paths
  useEffect(() => {
    if (!visible) return
    getCameraPaths(modelId).then(setPaths)
  }, [modelId, visible])

  const persist = async (newPaths: CameraPath[]) => {
    setPaths(newPaths)
    await saveCameraPaths(modelId, newPaths)
  }

  const createPath = async () => {
    const pathName = name.trim() || `路径 ${paths.length + 1}`
    const path: CameraPath = { id: uid(), name: pathName, keyframes: [] }
    await persist([...paths, path])
    onSelectPath(path)
    setName('')
  }

  const deletePath = async (id: string) => {
    if (activePathId === id) onSelectPath(null)
    await persist(paths.filter(p => p.id !== id))
  }

  const captureKeyframe = useCallback(() => {
    const cam = cameraRef.current
    if (!cam) return
    const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
    const fwd = cam.forward
    const tgt = { x: pos.x + fwd.x * 3, y: pos.y + fwd.y * 3, z: pos.z + fwd.z * 3 }
    const path = paths.find(p => p.id === activePathId)
    if (!path) return
    const kf: Keyframe = { id: uid(), position: pos, target: tgt }
    const updated = paths.map(p => p.id === activePathId ? { ...p, keyframes: [...p.keyframes, kf] } : p)
    persist(updated)
  }, [cameraRef, activePathId, paths, persist])

  const startRecording = () => {
    const pathName = name.trim() || `录制 ${paths.length + 1}`
    const path: CameraPath = { id: uid(), name: pathName, keyframes: [] }
    recordingPathRef.current = path
    setIsRecording(true)
    onSelectPath(path)

    // Record keyframe every 80ms
    recordTimerRef.current = window.setInterval(() => {
      const cam = cameraRef.current
      if (!cam) return
      const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
      const fwd = cam.forward
      const tgt = { x: pos.x + fwd.x * 3, y: pos.y + fwd.y * 3, z: pos.z + fwd.z * 3 }
      const kf: Keyframe = { id: uid(), position: pos, target: tgt }
      recordingPathRef.current!.keyframes.push(kf)
    }, 80)
  }

  const stopRecording = async () => {
    clearInterval(recordTimerRef.current)
    setIsRecording(false)
    if (recordingPathRef.current) {
      await persist([...paths, recordingPathRef.current])
      recordingPathRef.current = null
    }
  }

  const activePath = paths.find(p => p.id === activePathId) ?? null

  if (!visible) return null

  const { state: playState, overallProgress, speed, play, pause, stop, setSpeed } = playback

  return (
    <div className="absolute bottom-24 right-4 z-10 animate-fade-in">
      <div className="glass rounded-xl p-5 w-[340px] space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-white/80">相机路径</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 bg-transparent border-none cursor-pointer text-sm">✕</button>
        </div>

        {/* Create path */}
        <div className="flex gap-2">
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="路径名称"
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 text-xs focus:outline-none focus:border-accent-1/30 transition-colors"
          />
          <button onClick={createPath} className="px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white bg-white/[0.04] border border-white/[0.06] cursor-pointer"
            style={{ cursor: 'pointer' }}>新建</button>
        </div>

        {/* Recording */}
        <div className="flex gap-2">
          {isRecording ? (
            <button onClick={stopRecording} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 cursor-pointer animate-pulse"
              style={{ cursor: 'pointer' }}>⏹ 停止录制</button>
          ) : (
            <button onClick={startRecording} className="flex-1 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white bg-white/[0.04] border border-white/[0.06] cursor-pointer"
              style={{ cursor: 'pointer' }}>● 录制</button>
          )}
        </div>

        {/* Path list */}
        {paths.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">已保存路径</div>
            {paths.map(p => (
              <div key={p.id}
                onClick={() => onSelectPath(p)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  p.id === activePathId ? 'bg-white/[0.06] text-white/80' : 'text-white/40 hover:bg-white/[0.02]'
                }`}
                style={{ cursor: 'pointer' }}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span>{p.name}</span>
                  <span className="text-white/20">{p.keyframes.length} 帧</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deletePath(p.id) }}
                  className="text-white/20 hover:text-red-400 text-xs bg-transparent border-none cursor-pointer"
                  style={{ cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Active path controls */}
        {activePath && (
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <button onClick={captureKeyframe} className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white bg-white/[0.04] border border-white/[0.06] cursor-pointer"
                style={{ cursor: 'pointer' }}>📷 捕获当前视角</button>
            </div>

            {/* Keyframe list */}
            {activePath.keyframes.length > 0 && (
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                <div className="text-[10px] text-white/30 uppercase tracking-wider">关键帧 ({activePath.keyframes.length})</div>
                {activePath.keyframes.map((kf, i) => (
                  <div key={kf.id} className="flex items-center justify-between px-3 py-1.5 rounded text-xs text-white/30">
                    <span>#{i + 1}</span>
                    <button
                      onClick={() => {
                        const updated = paths.map(p => p.id === activePathId
                          ? { ...p, keyframes: p.keyframes.filter((_, j) => j !== i) }
                          : p)
                        persist(updated)
                      }}
                      className="text-white/10 hover:text-red-400 text-xs bg-transparent border-none cursor-pointer"
                      style={{ cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Playback */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={play} disabled={playState === 'playing'}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/70 hover:bg-white/[0.1] disabled:opacity-30 border-none cursor-pointer"
                  style={{ cursor: 'pointer' }}>▶ 播放</button>
                <button onClick={pause} disabled={playState !== 'playing'}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.06] text-white/70 hover:bg-white/[0.1] disabled:opacity-30 border-none cursor-pointer"
                  style={{ cursor: 'pointer' }}>⏸</button>
                <button onClick={stop} disabled={playState === 'idle'}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.06] text-white/70 hover:bg-white/[0.1] disabled:opacity-30 border-none cursor-pointer"
                  style={{ cursor: 'pointer' }}>⏹</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/25">速度</span>
                {[0.5, 1, 2].map(s => (
                  <button key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border-none ${speed === s ? 'bg-accent-1/20 text-accent-1' : 'bg-white/[0.02] text-white/40'}`}
                    style={{ cursor: 'pointer' }}
                  >{s}x</button>
                ))}
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full bg-accent-1/60 transition-all duration-100"
                  style={{ width: `${(overallProgress * 100).toFixed(1)}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
