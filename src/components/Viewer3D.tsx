import { useEffect, useRef, useState, useCallback } from 'react'
import { usePage } from '../App'
import type { Hotspot, CameraPath } from '../types'
import { worldToScreen, easeInOutCubic } from '../math3d'
import { getInitialCamera, saveInitialCamera } from '../store'
import { useSceneInit } from '../hooks/useSceneInit'
import { useHotspots } from '../hooks/useHotspots'
import { usePathPlayer } from '../hooks/usePathPlayer'
import HotspotEditor from './HotspotEditor'
import CameraPathPanel from './CameraPathPanel'
import ControlsHelp from './ControlsHelp'
import LoadingScreen from './LoadingScreen'
import HeritagePanel from './HeritagePanel'
import TimeCompare from './TimeCompare'
import type { ModelMeta } from '../types'

interface Props {
  modelSource: { type: 'url'; url: string } | { type: 'buffer'; buffer: ArrayBuffer; format?: string }
  modelName: string
  modelId: string
  readOnly?: boolean
  downloadProgress?: number
  heritageModel?: ModelMeta | null
}

const SPEED_MIN = 5; const SPEED_MAX = 150

export default function Viewer3D({ modelSource, modelName, modelId, readOnly, downloadProgress, heritageModel }: Props) {
  const { go } = usePage()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  // Scene init
  const {
    rendererRef, sceneRef, cameraRef, controlsRef, splatModuleRef, intersectionTesterRef,
    isLoading, progress, error, splatCount,
  } = useSceneInit({ canvasRef, containerRef, modelSource })

  // Hotspots
  const {
    hotspots, selectedHotspot, editingHotspot, isPlacingHotspot,
    selectHotspot, editHotspot, startPlacing, cancelPlacing, placeHotspot,
    updateHotspot, deleteHotspot, hotspotsRef,
  } = useHotspots(modelId)

  // Camera path
  const [activePath, setActivePath] = useState<CameraPath | null>(null)
  const [activePathId, setActivePathId] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [showHotspotEditor, setShowHotspotEditor] = useState(false)
  const [showCameraPathPanel, setShowCameraPathPanel] = useState(false)
  const [showPerf, setShowPerf] = useState(false)
  const [showHeritagePanel, setShowHeritagePanel] = useState(false)
  const [showTimeCompare, setShowTimeCompare] = useState(false)
  const [compareScreenshot, setCompareScreenshot] = useState<string | null>(null)
  const isPathPlayingRef = useRef(false)
  const pathUpdateRef = useRef<(() => void) | null>(null)
  const playback = usePathPlayer(activePath, cameraRef, controlsRef, splatModuleRef, isPathPlayingRef, pathUpdateRef)

  // FPS tracking (done in render loop, not useSceneInit)
  const [fps, setFps] = useState(0)
  const fpsFramesRef = useRef<number[]>([])

  // WASD flight
  const keysRef = useRef<Set<string>>(new Set())
  const lastTimeRef = useRef(0)
  const [flightSpeed, setFlightSpeed] = useState(() => {
    try { const v = parseInt(localStorage.getItem('gs_flight_speed') || '25', 10); return v >= SPEED_MIN && v <= SPEED_MAX ? v : 25 }
    catch { return 25 }
  })
  const flightSpeedRef = useRef(flightSpeed)
  useEffect(() => { flightSpeedRef.current = flightSpeed; localStorage.setItem('gs_flight_speed', String(flightSpeed)) }, [flightSpeed])

  // Fly-to state
  const isFlyingRef = useRef(false)
  const flyStateRef = useRef<{ startPos: Vector3; endPos: Vector3; endLookAt: Vector3; startTime: number; duration: number } | null>(null)
  type Vector3 = { x: number; y: number; z: number }

  const flyToHotspot = useCallback((hs: Hotspot) => {
    const cam = cameraRef.current; const ctrl = controlsRef.current
    if (!cam || !ctrl) { selectHotspot(hs); return }
    selectHotspot(hs)

    const startPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
    const hasSaved = hs.cameraPosition && (hs.cameraPosition.x !== 0 || hs.cameraPosition.y !== 0 || hs.cameraPosition.z !== 0)
    const endPos = hasSaved
      ? { x: hs.cameraPosition!.x, y: hs.cameraPosition!.y, z: hs.cameraPosition!.z }
      : (() => {
          const d = Math.sqrt((startPos.x - hs.position.x) ** 2 + (startPos.y - hs.position.y) ** 2 + (startPos.z - hs.position.z) ** 2)
          const cd = 1.5
          if (d < 0.01) return { x: hs.position.x + 2, y: hs.position.y + 1, z: hs.position.z + 1.5 }
          const f = cd / d
          return { x: hs.position.x + (startPos.x - hs.position.x) * f, y: hs.position.y + (startPos.y - hs.position.y) * f, z: hs.position.z + (startPos.z - hs.position.z) * f }
        })()
    const endLookAt = hasSaved
      ? { x: hs.cameraTarget!.x, y: hs.cameraTarget!.y, z: hs.cameraTarget!.z }
      : { x: hs.position.x, y: hs.position.y, z: hs.position.z }

    flyStateRef.current = { startPos, endPos, endLookAt, startTime: performance.now(), duration: 0.6 }
    isFlyingRef.current = true
    ctrl.dampening = 0
  }, [cameraRef, controlsRef, selectHotspot])

  // Hotspot screen positions — updated via DOM for 60fps
  const hotspotScreensRef = useRef<Map<string, { x: number; y: number; visible: boolean; scale: number }>>(new Map())
  const selectedHotspotRef = useRef<Hotspot | null>(null)
  useEffect(() => { selectedHotspotRef.current = selectedHotspot }, [selectedHotspot])

  // Main render loop
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const animate = () => {
      const now = performance.now()
      const cam = cameraRef.current
      const ctrl = controlsRef.current
      const SPLAT = splatModuleRef.current

      if (!cam || !ctrl) { animRef.current = requestAnimationFrame(animate); return }

      // 1. Fly animation
      if (isFlyingRef.current) {
        const fly = flyStateRef.current
        if (fly && SPLAT) {
          const t = Math.min((now - fly.startTime) / 1000 / fly.duration, 1)
          const ease = easeInOutCubic(t)
          cam.position = new SPLAT.Vector3(
            fly.startPos.x + (fly.endPos.x - fly.startPos.x) * ease,
            fly.startPos.y + (fly.endPos.y - fly.startPos.y) * ease,
            fly.startPos.z + (fly.endPos.z - fly.startPos.z) * ease,
          )
          const dir = new SPLAT.Vector3(fly.endLookAt.x - (cam.position.x), fly.endLookAt.y - (cam.position.y), fly.endLookAt.z - (cam.position.z))
          cam.rotation = SPLAT.Quaternion.LookRotation(dir)
          if (t >= 1) {
            isFlyingRef.current = false
            flyStateRef.current = null
            ctrl.setCameraTarget(new SPLAT.Vector3(fly.endLookAt.x, fly.endLookAt.y, fly.endLookAt.z))
            ctrl.dampening = 1; ctrl.update(); ctrl.dampening = 0.2
          }
        }
      }
      // 2. Path playback
      else if (isPathPlayingRef.current) {
        pathUpdateRef.current?.()
      }
      // 3. WASD flight
      else {
        const keys = keysRef.current
        if (keys.size > 0) {
          const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1)
          if (lastTimeRef.current > 0 && dt > 0 && SPLAT) {
            const cp = cam.position
            const fwd = cam.forward
            const rx = fwd.z; const rz = -fwd.x
            const rLen = Math.sqrt(rx * rx + rz * rz)
            const rightX = rLen > 0.0001 ? rx / rLen : 1
            const rightZ = rLen > 0.0001 ? rz / rLen : 0
            const spd = flightSpeedRef.current * dt

            let mx = 0, my = 0, mz = 0
            if (keys.has('KeyW')) { mx += fwd.x * spd; my += fwd.y * spd; mz += fwd.z * spd }
            if (keys.has('KeyS')) { mx -= fwd.x * spd; my -= fwd.y * spd; mz -= fwd.z * spd }
            if (keys.has('KeyA')) { mx -= rightX * spd; mz -= rightZ * spd }
            if (keys.has('KeyD')) { mx += rightX * spd; mz += rightZ * spd }
            if (keys.has('KeyQ')) my -= spd
            if (keys.has('KeyE')) my += spd

            if (mx !== 0 || my !== 0 || mz !== 0) {
              const nx = cp.x + mx; const ny = cp.y + my; const nz = cp.z + mz
              const ld = 3
              cam.position = new SPLAT.Vector3(nx, ny, nz)
              ctrl.setCameraTarget(new SPLAT.Vector3(nx + fwd.x * ld, ny + fwd.y * ld, nz + fwd.z * ld))
            }
          }
          lastTimeRef.current = now
          const saved = ctrl.dampening; ctrl.dampening = 1; ctrl.update(); ctrl.dampening = saved
        } else {
          ctrl.update()
        }
      }

      // 4. Render the scene
      const renderer = rendererRef.current
      const scene = sceneRef.current
      if (renderer && scene && SPLAT) {
        renderer.render(scene as any, cam as any)
        // FPS tracking
        fpsFramesRef.current.push(now)
        while (fpsFramesRef.current.length > 0 && fpsFramesRef.current[0] < now - 1000) {
          fpsFramesRef.current.shift()
        }
        setFps(fpsFramesRef.current.length)
      }

      // 5. Hotspot projection
      const currentHotspots = hotspotsRef.current
      const pending = editingHotspot?.id === '__pending__' && editingHotspot.position ? editingHotspot : null
      const allHotspots = pending ? [...currentHotspots, pending] : currentHotspots
      if (allHotspots.length > 0 && container) {
        const newScreens = new Map<string, { x: number; y: number; visible: boolean; scale: number }>()
        const camPos = cam.position
        const rect = container.getBoundingClientRect()
        const sw = rect.width; const sh = rect.height

        // Try gsplat view-projection matrix first
        const vp = (cam as any).data?.viewProj
        const vpBuffer: number[] | undefined = vp?.buffer

        for (const hs of allHotspots) {
          if (vpBuffer) {
            const wx = hs.position.x; const wy = hs.position.y; const wz = hs.position.z
            const cx = vpBuffer[0] * wx + vpBuffer[4] * wy + vpBuffer[8] * wz + vpBuffer[12]
            const cy = vpBuffer[1] * wx + vpBuffer[5] * wy + vpBuffer[9] * wz + vpBuffer[13]
            const cz = vpBuffer[2] * wx + vpBuffer[6] * wy + vpBuffer[10] * wz + vpBuffer[14]
            const cw = vpBuffer[3] * wx + vpBuffer[7] * wy + vpBuffer[11] * wz + vpBuffer[15]
            if (cw <= 0.0001) continue
            const sx = (cx / cw * 0.5 + 0.5) * sw
            const sy = (-cy / cw * 0.5 + 0.5) * sh
            const visible = Math.abs(cx / cw) <= 1.2 && Math.abs(cy / cw) <= 1.2 && cz > 0
            const dist = Math.sqrt((wx - camPos.x) ** 2 + (wy - camPos.y) ** 2 + (wz - camPos.z) ** 2)
            newScreens.set(hs.id, { x: sx, y: sy, visible, scale: Math.max(0.4, Math.min(1.5, 5 / dist)) })
          } else {
            // Fallback to simple projection
            const fwd = cam.forward
            const cd = (cam as any).data
            const fov = cd ? 2 * Math.atan(cd.height / (2 * cd.fy)) * (180 / Math.PI) : 50
            const screen = worldToScreen(hs.position, camPos, fwd, fov, sw, sh)
            if (screen) {
              const dist = Math.sqrt((hs.position.x - camPos.x) ** 2 + (hs.position.y - camPos.y) ** 2 + (hs.position.z - camPos.z) ** 2)
              newScreens.set(hs.id, { x: screen.x, y: screen.y, visible: screen.visible, scale: Math.max(0.4, Math.min(1.5, 5 / dist)) })
            }
          }
        }

        hotspotScreensRef.current = newScreens
        const overlay = overlayRef.current
        if (overlay) {
          overlay.querySelectorAll<HTMLElement>('[data-hotspot]').forEach(el => {
            const id = el.dataset.hotspot
            if (!id) return
            const screen = newScreens.get(id)
            if (screen?.visible) {
              el.style.display = ''
              el.style.transform = `translate(0, -50%) scale(${screen.scale})`
              el.style.left = `${screen.x}px`
              el.style.top = `${screen.y}px`
            } else {
              el.style.display = 'none'
            }
          })
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [cameraRef, controlsRef, splatModuleRef, hotspotsRef, editingHotspot])

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'SELECT') return
      if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
        keysRef.current.add(e.code)
      }
      if (e.key === 'h' || e.key === 'H') setShowControls(prev => !prev)
      if (e.key === 'r' || e.key === 'R') {
        const cam = cameraRef.current; const ctrl = controlsRef.current; const SPLAT = splatModuleRef.current
        if (cam && ctrl && SPLAT) {
          cam.position = new SPLAT.Vector3(0, 0, 5)
          ctrl.setCameraTarget(new SPLAT.Vector3(0, 0, 0)); ctrl.update()
        }
      }
      // Arrow navigation between hotspots
      const current = hotspotsRef.current
      if (current.length > 0 && !isLoading) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const sel = selectedHotspotRef.current
          const idx = sel ? current.findIndex(h => h.id === sel.id) : -1
          flyToHotspot(idx > 0 ? current[idx - 1] : current[current.length - 1])
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          const sel = selectedHotspotRef.current
          const idx = sel ? current.findIndex(h => h.id === sel.id) : -1
          flyToHotspot(idx < current.length - 1 ? current[idx + 1] : current[0])
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [cameraRef, controlsRef, splatModuleRef, hotspotsRef, isLoading, flyToHotspot])

  // Apply initial camera
  useEffect(() => {
    if (isLoading) return
    const saved = getInitialCamera(modelId)
    if (!saved) return
    const cam = cameraRef.current; const ctrl = controlsRef.current; const SPLAT = splatModuleRef.current
    if (!cam || !ctrl || !SPLAT) return
    ctrl.setCameraTarget(new SPLAT.Vector3(saved.target.x, saved.target.y, saved.target.z))
    cam.position = new SPLAT.Vector3(saved.position.x, saved.position.y, saved.position.z)
    const dx = saved.target.x - saved.position.x; const dy = saved.target.y - saved.position.y; const dz = saved.target.z - saved.position.z
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.001) {
      cam.rotation = SPLAT.Quaternion.LookRotation(new SPLAT.Vector3(dx, dy, dz))
    }
    ctrl.dampening = 1; ctrl.update(); ctrl.dampening = 0.2
  }, [isLoading, modelId, cameraRef, controlsRef, splatModuleRef])

  // Hotspot editor handlers
  const handleSaveHotspot = useCallback((data: { title: string; description: string }) => {
    if (!data.title.trim() || !editingHotspot?.id) return
    updateHotspot(editingHotspot.id, data)
    setShowHotspotEditor(false)
  }, [editingHotspot, updateHotspot])

  const handleDeleteHotspot = useCallback((id: string) => {
    deleteHotspot(id)
    setShowHotspotEditor(false)
  }, [deleteHotspot])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden"
      onClick={async (e) => {
        if (isPlacingHotspot && (e.target as HTMLElement).tagName === 'CANVAS') {
          const canvas = canvasRef.current; const cam = cameraRef.current
          if (!canvas || !cam) return
          const rect = canvas.getBoundingClientRect()
          const x = e.clientX - rect.left; const y = e.clientY - rect.top
          const tester = intersectionTesterRef.current
          let pos = { x: cam.position.x + cam.forward.x * 3, y: cam.position.y + cam.forward.y * 3, z: cam.position.z + cam.forward.z * 3 }
          if (tester?.testPoint(x, y)) {
            // Raycast through gsplat
            try {
              const rayDir = (cam as any).screenPointToRay(x, y)
              const cp = cam.position; const vp = (cam as any).data.viewProj.buffer
              const { width: w, height: h } = (cam as any).data
              for (let d = 0.5; d <= 80; d += 0.5) {
                const wx = cp.x + rayDir.x * d; const wy = cp.y + rayDir.y * d; const wz = cp.z + rayDir.z * d
                const cw = vp[3] * wx + vp[7] * wy + vp[11] * wz + vp[15]
                if (cw <= 0.001) continue
                const sx = ((vp[0] * wx + vp[4] * wy + vp[8] * wz + vp[12]) / cw * 0.5 + 0.5) * w
                const sy = ((-(vp[1] * wx + vp[5] * wy + vp[9] * wz + vp[13]) / cw) * 0.5 + 0.5) * h
                if (Math.abs(sx - x) < 3 && Math.abs(sy - y) < 3) { pos = { x: wx, y: wy, z: wz }; break }
              }
            } catch { /* fallback to default pos */ }
          }
          const camTgt = { x: cam.position.x + cam.forward.x * 3, y: cam.position.y + cam.forward.y * 3, z: cam.position.z + cam.forward.z * 3 }
          const camPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
          await placeHotspot(pos, camPos, camTgt)
          setShowHotspotEditor(true)
          return
        }
        if ((e.target as HTMLElement).tagName === 'CANVAS') {
          selectHotspot(null); cancelPlacing()
        }
      }}
    >
      <canvas ref={canvasRef} className="gsplat-canvas absolute inset-0" tabIndex={-1} />

      {/* Hotspot markers */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
        {(hotspots ?? []).map((hs, idx) => (
          <HotspotMarker
            key={hs.id}
            hotspotId={hs.id}
            number={hs.order || idx + 1}
            title={hs.title || '未命名'}
            isSelected={selectedHotspot?.id === hs.id}
            onSelect={() => flyToHotspot(hs)}
            onEdit={() => { editHotspot(hs); setShowHotspotEditor(true) }}
          />
        ))}
        {editingHotspot?.id === '__pending__' && editingHotspot.position && (
          <HotspotMarker
            key="__pending__"
            hotspotId="__pending__"
            number={hotspots.length + 1}
            title="新标注"
            isSelected={true}
            onSelect={() => {}}
            onEdit={() => {}}
          />
        )}
      </div>

      {/* Loading */}
      {isLoading && <LoadingScreen progress={downloadProgress !== undefined ? Math.max(progress, downloadProgress) : progress} modelName={modelName} />}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
          <div className="text-center p-8 max-w-sm">
            <div className="text-5xl mb-5 opacity-70">⚠️</div>
            <h2 className="text-white/80 text-lg font-semibold mb-2 font-display">加载失败</h2>
            <p className="text-white/30 text-[13px] leading-relaxed mb-6">{error}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => go({ route: 'archive' })}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white/80 border border-white/15 bg-transparent cursor-pointer hover:bg-white/[0.04] transition-colors"
                style={{ cursor: 'pointer' }}
              >
                ← 返回档案库
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-accent-1/70 hover:bg-accent-1/80 border-none cursor-pointer transition-colors"
                style={{ cursor: 'pointer' }}
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!isLoading && !error && (
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10 flex-wrap animate-fade-in">
          <div className="glass rounded-xl flex items-center gap-0 px-1.5 py-1.5">
            <button onClick={() => go({ route: 'archive' })} className="px-2.5 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.03] bg-transparent border-none cursor-pointer" title="返回画廊">←</button>
            <span className="w-px h-4 bg-[rgba(199,185,156,0.10)]" />
            <span className="px-2.5 py-1.5 text-[13px] font-medium text-[#d4c5a9]/80 select-none">{modelName}</span>
            <span className="w-px h-4 bg-[rgba(199,185,156,0.10)]" />
            <div className="flex items-center gap-1.5 pl-2 pr-1">
              <span className="text-[9px] text-white/25 font-medium uppercase">Spd</span>
              <input
                type="range" min={SPEED_MIN} max={SPEED_MAX} value={flightSpeed}
                onChange={e => setFlightSpeed(Number(e.target.value))}
                className="w-12 h-[2px] appearance-none rounded-full outline-none cursor-pointer bg-white/[0.07] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#c9a96e]/70"
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Heritage info panel toggle (all users) */}
          {heritageModel && (
            <>
              <div className="w-px h-6 bg-white/10" />
              <button
                onClick={() => { setShowHeritagePanel(prev => !prev); setShowTimeCompare(false) }}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all bg-transparent cursor-pointer ${showHeritagePanel ? 'bg-accent-1/20 text-accent-1 border border-accent-1/30' : 'glass text-white/70 hover:text-white'}`}
                style={{ cursor: 'pointer' }}
              >📋 建筑档案</button>
            </>
          )}

          {/* Time compare toggle (all users) */}
          {heritageModel && (heritageModel.historicalPhotos?.length ?? 0) > 0 && (
            <button
              onClick={() => { setShowTimeCompare(prev => !prev); setShowHeritagePanel(false) }}
              className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all bg-transparent cursor-pointer ${showTimeCompare ? 'bg-accent-2/20 text-accent-2 border border-accent-2/30' : 'glass text-white/70 hover:text-white'}`}
              style={{ cursor: 'pointer' }}
            >⏳ 时光对比</button>
          )}

          {!readOnly && (
            <>
              <div className="w-px h-6 bg-white/10" />
              <button
                onClick={() => { startPlacing(); setShowHotspotEditor(false) }}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all bg-transparent cursor-pointer ${isPlacingHotspot ? 'bg-accent-1/25 text-accent-1 border border-accent-1/40' : 'glass text-white/70 hover:text-white'}`}
                style={{ cursor: 'pointer' }}
              >📌 {isPlacingHotspot ? '点击画布放置...' : '添加标注'}</button>
              <div className="w-px h-6 bg-white/10" />
              <button
                onClick={() => setShowCameraPathPanel(prev => !prev)}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all bg-transparent cursor-pointer ${showCameraPathPanel ? 'bg-accent-1/20 text-accent-1 border border-accent-1/30' : 'glass text-white/70 hover:text-white'}`}
                style={{ cursor: 'pointer' }}
              >🎥 相机路径</button>
              <div className="w-px h-6 bg-white/10" />
              <button
                onClick={() => {
                  const cam = cameraRef.current
                  if (!cam) return
                  const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z }
                  const fwd = cam.forward
                  saveInitialCamera(modelId, pos, { x: pos.x + fwd.x * 3, y: pos.y + fwd.y * 3, z: pos.z + fwd.z * 3 })
                }}
                className="rounded-xl px-3 py-2.5 text-xs font-medium glass text-white/70 hover:text-white bg-transparent cursor-pointer transition-all"
                style={{ cursor: 'pointer' }}
              >🎯 设初始视角</button>
            </>
          )}
        </div>
      )}

      {/* FPS counter */}
      {showPerf && !isLoading && !error && (
        <div className="absolute top-4 right-4 glass rounded-lg px-3 py-2 text-xs text-white/50 font-mono z-10">
          {fps} fps · {splatCount.toLocaleString()} 点
        </div>
      )}

      {/* Hotspot editor */}
      {!readOnly && (
        <HotspotEditor
          isOpen={showHotspotEditor}
          hotspot={editingHotspot}
          onSave={handleSaveHotspot}
          onDelete={editingHotspot?.id && editingHotspot.id !== '__pending__' ? () => handleDeleteHotspot(editingHotspot!.id) : undefined}
          onClose={() => { setShowHotspotEditor(false); editHotspot(null) }}
        />
      )}

      {/* Camera path panel */}
      {!readOnly && (
        <CameraPathPanel
          modelId={modelId}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          splatModuleRef={splatModuleRef}
          playback={playback}
          activePathId={activePathId}
          onSelectPath={(p) => { setActivePathId(p?.id ?? null); setActivePath(p) }}
          visible={showCameraPathPanel}
          onClose={() => setShowCameraPathPanel(false)}
        />
      )}

      {/* Heritage info panel (available to all users) */}
      <HeritagePanel
        model={heritageModel ?? null}
        isOpen={showHeritagePanel}
        onClose={() => setShowHeritagePanel(false)}
      />

      {/* Time compare overlay */}
      <TimeCompare
        currentImage={compareScreenshot}
        historicalPhotos={(heritageModel?.historicalPhotos || []).map(p => ({
          url: p.url,
          year: p.year,
          caption: p.caption,
        }))}
        isOpen={showTimeCompare}
        onClose={() => setShowTimeCompare(false)}
        onCaptureScreenshot={() => {
          const canvas = canvasRef.current
          if (canvas) {
            setCompareScreenshot(canvas.toDataURL('image/jpeg', 0.85))
          }
        }}
      />

      <ControlsHelp
        isVisible={showControls && !isLoading && !error}
        onClose={() => setShowControls(false)}
        showPerf={showPerf}
        onTogglePerf={() => setShowPerf(!showPerf)}
      />

      {!isLoading && !error && !showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute bottom-4 left-4 glass rounded-lg px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors z-10 bg-transparent border-none cursor-pointer"
        >H: 操作帮助</button>
      )}
    </div>
  )
}

// ── Hotspot Marker ──

function HotspotMarker({ hotspotId, number, title, isSelected, onSelect, onEdit }: {
  hotspotId: string; number: number; title: string; isSelected: boolean; onSelect: () => void; onEdit: () => void
}) {
  return (
    <div
      data-hotspot={hotspotId}
      className="absolute pointer-events-auto"
      style={{ left: 0, top: 0, transform: 'translate(0, -50%)' }}
    >
      <button
        onClick={onSelect}
        onDoubleClick={onEdit}
        className="relative flex items-center gap-1.5 group bg-transparent border-none cursor-pointer"
        style={{ cursor: 'pointer' }}
        title={title}
      >
        {/* Circle */}
        <div className={`shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${
          isSelected ? 'w-[52px] h-[52px] border-[2px] border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'w-[42px] h-[42px] border-[1.5px] border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.1)] group-hover:border-white/60'
        }`}>
          <span className={`font-mono font-bold select-none ${isSelected ? 'text-[16px] text-white' : 'text-[13px] text-white/80'}`}>{number}</span>
        </div>
        {/* Label */}
        {isSelected && title && (
          <span className="text-[14px] font-medium text-white bg-black/50 px-2 py-0.5 rounded select-none whitespace-nowrap">{title}</span>
        )}
      </button>
    </div>
  )
}
