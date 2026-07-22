import { useEffect, useRef, useState } from 'react'
import type { Scene, Camera, WebGLRenderer, OrbitControls, IntersectionTester } from 'gsplat'

interface UseSceneInitOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  modelSource: { type: 'url'; url: string } | { type: 'buffer'; buffer: ArrayBuffer; format?: string } | null
  /** Stable key that changes when the model changes — triggers scene re-init. */
  modelKey?: string
}

interface UseSceneInitResult {
  rendererRef: React.RefObject<WebGLRenderer | null>
  sceneRef: React.RefObject<Scene | null>
  cameraRef: React.RefObject<Camera | null>
  controlsRef: React.RefObject<OrbitControls | null>
  splatModuleRef: React.RefObject<typeof import('gsplat') | null>
  splatRef: React.RefObject<any>
  intersectionTesterRef: React.RefObject<IntersectionTester | null>
  isLoading: boolean
  progress: number
  error: string | null
  splatCount: number
}

export function useSceneInit({ canvasRef, containerRef, modelSource, modelKey }: UseSceneInitOptions): UseSceneInitResult {
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const splatModuleRef = useRef<typeof import('gsplat') | null>(null)
  const splatRef = useRef<any>(null)
  const intersectionTesterRef = useRef<IntersectionTester | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [splatCount, setSplatCount] = useState(0)

  // Init WebGL scene
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false
    let localRenderer: WebGLRenderer | null = null
    let localScene: Scene | null = null
    let localCamera: Camera | null = null
    let localControls: OrbitControls | null = null

    // ── Resize helper (defined before import so we can call it once renderer is ready) ──
    // Only needs container + renderer + camera — does NOT depend on splat/model
    const resize = () => {
      const container = containerRef.current
      if (!container || !localRenderer || !localCamera) return
      let w = container.clientWidth
      let h = container.clientHeight
      // Fallback to window dimensions if container hasn't been laid out yet
      if (w === 0) w = window.innerWidth
      if (h === 0) h = window.innerHeight
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
    // Register resize listeners early (they no-op until renderer is created)
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(() => resize())
    if (containerRef.current) ro.observe(containerRef.current)

    import('gsplat').then(async (SPLAT) => {
      if (disposed) return
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

        // ★ Critical: resize canvas to match container now that renderer exists
        resize()

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
            splatRef.current = splat
            setSplatCount(splat.data?.vertexCount ?? 0)
          }
        } else {
          const splat = await SPLAT.Loader.LoadAsync(
            modelSource.url, localScene as any,
            (p: number) => setProgress(Math.round(p * 100)),
          )
          if (!disposed && splat) {
            splatRef.current = splat
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
            }
          }
        }
      } catch (err: any) {
        console.error('[Viewer-C] Scene/model load failed:', err.message || err, err)
        if (!disposed) setError(err.message || '场景初始化失败')
      } finally {
        if (!disposed) setIsLoading(false)
      }
    }).catch((err: any) => {
      console.error('[Viewer-D] gsplat import failed:', err.message || err)
      if (!disposed) { setError('渲染引擎加载失败'); setIsLoading(false) }
    })

    return () => {
      disposed = true
      window.removeEventListener('resize', resize)
      ro.disconnect()
      if (localRenderer) {
        try { localRenderer.dispose?.() } catch { /* ignore */ }
      }
    }
  }, [modelKey ?? (modelSource?.type === 'url' ? (modelSource as any).url : (modelSource as any)?.buffer?.byteLength ?? '')])

  return {
    rendererRef, sceneRef, cameraRef, controlsRef,
    splatModuleRef, splatRef, intersectionTesterRef,
    isLoading, progress, error, splatCount,
  }
}
