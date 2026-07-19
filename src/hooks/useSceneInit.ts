import { useEffect, useRef, useState, useCallback } from 'react'
import type { Scene, Camera, WebGLRenderer, OrbitControls, IntersectionTester } from 'gsplat'

interface UseSceneInitOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  modelSource: { type: 'url'; url: string } | { type: 'buffer'; buffer: ArrayBuffer; format?: string } | null
}

interface UseSceneInitResult {
  rendererRef: React.RefObject<WebGLRenderer | null>
  sceneRef: React.RefObject<Scene | null>
  cameraRef: React.RefObject<Camera | null>
  controlsRef: React.RefObject<OrbitControls | null>
  splatModuleRef: React.RefObject<typeof import('gsplat') | null>
  intersectionTesterRef: React.RefObject<IntersectionTester | null>
  isLoading: boolean
  progress: number
  error: string | null
  splatCount: number
  fps: number
  /** Call this every frame from the main rAF loop */
  renderFrame: (onFrame?: (dt: number) => void) => void
}

export function useSceneInit({ canvasRef, containerRef, modelSource }: UseSceneInitOptions): UseSceneInitResult {
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const splatModuleRef = useRef<typeof import('gsplat') | null>(null)
  const intersectionTesterRef = useRef<IntersectionTester | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [splatCount, setSplatCount] = useState(0)
  const [fps, setFps] = useState(0)

  const fpsFramesRef = useRef<number[]>([])
  const lastFpsTimeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

  // Init WebGL scene
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false
    let localRenderer: WebGLRenderer | null = null
    let localScene: Scene | null = null
    let localCamera: Camera | null = null
    let localControls: OrbitControls | null = null
    let localSplat: typeof import('gsplat') | null = null

    import('gsplat').then(async (SPLAT) => {
      if (disposed) return
      localSplat = SPLAT
      splatModuleRef.current = SPLAT

      localScene = new SPLAT.Scene()
      localCamera = new SPLAT.Camera()
      localRenderer = new SPLAT.WebGLRenderer(canvas)
      localControls = new SPLAT.OrbitControls(
        localCamera as any,
        canvas,
        window.innerWidth / 2,
        window.innerHeight / 2,
        Math.PI / 180,
        false, // disable keyboard — we handle WASD ourselves
      )

      sceneRef.current = localScene
      cameraRef.current = localCamera
      rendererRef.current = localRenderer
      controlsRef.current = localControls

      // Intersection tester for hotspot placement
      try {
        intersectionTesterRef.current = new SPLAT.IntersectionTester(
          localScene as any,
          localCamera as any,
          localRenderer as any,
        )
      } catch { /* IntersectionTester might not be available */ }

      // Load model
      if (!modelSource) { setIsLoading(false); return }

      try {
        setIsLoading(true)
        setError(null)
        setProgress(0)

        if (modelSource.type === 'buffer') {
          setProgress(10) // parsing
          const isPly = modelSource.format === 'ply'
          const loader = isPly ? SPLAT.PLYLoader : SPLAT.Loader
          const splat = await (loader as any).LoadFromArrayBuffer(
            modelSource.buffer, localScene as any,
          )
          setProgress(100)
          if (!disposed && splat) {
            setSplatCount(splat.data?.vertexCount ?? 0)
          }
        } else {
          // Pre-flight check: verify the file is reachable before handing to gsplat
          try {
            const headRes = await fetch(modelSource.url, { method: 'HEAD' })
            if (!headRes.ok) {
              throw new Error(`模型文件不存在 (HTTP ${headRes.status}): ${modelSource.url}`)
            }
          } catch (preflightErr: any) {
            if (preflightErr.message?.includes('HTTP')) throw preflightErr
            // Network error — rethrow with URL context
            throw new Error(`无法连接服务器加载模型: ${modelSource.url}`)
          }

          // Pre-compute scene bounds from splat data for camera framing
          let sceneBounds: { cx: number; cy: number; cz: number; halfSize: number } | null = null
          try {
            const sampleRes = await fetch(modelSource.url + '?sample')
            if (sampleRes.ok && sampleRes.body) {
              const reader = sampleRes.body.getReader()
              const chunks: Uint8Array[] = []
              let totalBytes = 0
              const MAX_SAMPLE = 65536 // Read first 64KB (~2048 gaussians)
              while (totalBytes < MAX_SAMPLE) {
                const { done, value } = await reader.read()
                if (done || !value) break
                chunks.push(value)
                totalBytes += value.length
              }
              reader.cancel() // Abort the rest of the download

              // Merge chunks and parse positions
              const buf = new Uint8Array(totalBytes)
              let offset = 0
              for (const c of chunks) { buf.set(c, offset); offset += c.length }

              const count = Math.floor(totalBytes / 32)
              let minX = Infinity, minY = Infinity, minZ = Infinity
              let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
              const view = new DataView(buf.buffer)
              const stride = Math.max(1, Math.floor(count / 500)) // Sample ~500 points
              for (let i = 0; i < count; i += stride) {
                const off = i * 32
                const x = view.getFloat32(off, true)
                const y = view.getFloat32(off + 4, true)
                const z = view.getFloat32(off + 8, true)
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                  if (x < minX) minX = x; if (x > maxX) maxX = x
                  if (y < minY) minY = y; if (y > maxY) maxY = y
                  if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
                }
              }
              if (isFinite(minX)) {
                const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
                const halfSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2
                sceneBounds = { cx, cy, cz, halfSize }
              }
            }
          } catch { /* pre-compute failed, use default camera */ }

          const splat = await SPLAT.Loader.LoadAsync(
            modelSource.url, localScene as any,
            (p: number) => setProgress(Math.round(p * 100)),
          )
          if (!disposed && splat) {
            setSplatCount(splat.data?.vertexCount ?? 0)

            // Auto-frame camera to show the model
            if (sceneBounds) {
              const { cx, cy, cz, halfSize } = sceneBounds
              const dist = halfSize * 2.5 || 5
              const SPLAT_V3 = SPLAT.Vector3
              localCamera.position = new SPLAT_V3(cx + dist * 0.5, cy + dist * 0.3, cz + dist)
              localControls.setCameraTarget(new SPLAT_V3(cx, cy, cz))
              localControls.dampening = 1; localControls.update(); localControls.dampening = 0.2
            }
          }
        }
      } catch (err: any) {
        if (!disposed) setError(err.message || '模型加载失败')
      } finally {
        if (!disposed) setIsLoading(false)
      }
    })

    // Resize handler
    const resize = () => {
      const container = containerRef.current
      if (!container || !localRenderer || !localCamera || !localSplat) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      if (typeof (localRenderer as any).setSize === 'function') {
        (localRenderer as any).setSize(w * dpr, h * dpr)
      }
    }
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      disposed = true
      window.removeEventListener('resize', resize)
      ro.disconnect()
      localRenderer?.dispose?.()
    }
  }, [modelSource?.type === 'url' ? (modelSource as any).url : (modelSource as any)?.buffer?.byteLength])

  const renderFrame = useCallback((onFrame?: (dt: number) => void) => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!renderer || !scene || !camera) return

    const now = performance.now()
    const dt = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 16
    lastFrameTimeRef.current = now

    onFrame?.(dt)

    controls?.update()
    renderer.render(scene as any, camera as any)

    // FPS
    fpsFramesRef.current.push(now)
    while (fpsFramesRef.current.length > 0 && fpsFramesRef.current[0] < now - 1000) {
      fpsFramesRef.current.shift()
    }
    if (now - lastFpsTimeRef.current > 500) {
      lastFpsTimeRef.current = now
      setFps(fpsFramesRef.current.length)
    }
  }, [])

  return {
    rendererRef, sceneRef, cameraRef, controlsRef,
    splatModuleRef, intersectionTesterRef,
    isLoading, progress, error, splatCount, fps,
    renderFrame,
  }
}
