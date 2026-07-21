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

      try {
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

        // Set a safe default camera position before model loads
        localCamera.position = new SPLAT.Vector3(0, 1.5, 8)
        localControls.setCameraTarget(new SPLAT.Vector3(0, 0, 0))

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

        setIsLoading(true)
        setError(null)
        setProgress(0)

        if (modelSource.type === 'buffer') {
          setProgress(10)
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
          const splat = await SPLAT.Loader.LoadAsync(
            modelSource.url, localScene as any,
            (p: number) => setProgress(Math.round(p * 100)),
          )
          console.log('[Viewer] Model loaded:', modelSource.url, 'points:', splat?.data?.vertexCount)
          if (!disposed && splat) {
            setSplatCount(splat.data?.vertexCount ?? 0)

            // Auto-frame camera using gsplat's native bounds (no double-download)
            splat.recalculateBounds()
            try {
              const bounds = splat.bounds
              if (bounds) {
                const center = bounds.center()
                const size = bounds.size()
                const halfSize = Math.max(size.x, size.y, size.z) / 2
                const dist = Math.max(halfSize * 2.5, 3)
                console.log('[Viewer] Bounds center:', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2), 'halfSize:', halfSize.toFixed(2), 'dist:', dist.toFixed(2))
                localCamera.position = new SPLAT.Vector3(
                  center.x + dist * 0.5,
                  center.y + dist * 0.3,
                  center.z + dist,
                )
                localControls.setCameraTarget(new SPLAT.Vector3(center.x, center.y, center.z))
                localControls.dampening = 1; localControls.update(); localControls.dampening = 0.2
              }
            } catch {
              // gsplat bounds not available — camera stays at default position
              console.warn('[Viewer] Could not compute model bounds, using default camera')
            }
          } else {
            console.warn('[Viewer] Splat object is null after loading:', modelSource.url)
          }
        }
      } catch (err: any) {
        console.error('[Viewer] Scene init failed:', err.message || err)
        if (!disposed) setError(err.message || '场景初始化失败')
      } finally {
        if (!disposed) setIsLoading(false)
      }
    }).catch((err: any) => {
      console.error('[Viewer] gsplat import failed:', err.message || err)
      if (!disposed) { setError('渲染引擎加载失败'); setIsLoading(false) }
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
