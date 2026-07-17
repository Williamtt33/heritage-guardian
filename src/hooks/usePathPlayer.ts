import { useRef, useState, useCallback, useEffect } from 'react'
import { catmullRomPoint, easeInOutCubic } from '../math3d'
import type { CameraPath, Keyframe } from '../types'
import type { Camera, OrbitControls } from 'gsplat'

export type PlaybackState = 'idle' | 'playing' | 'paused'

export interface PlaybackEngine {
  state: PlaybackState
  overallProgress: number
  speed: number
  play: () => void
  pause: () => void
  stop: () => void
  setSpeed: (s: number) => void
}

interface PlaybackInternal {
  segmentIndex: number
  segmentT: number
  lastTime: number
}

function getControlPoints(keyframes: Keyframe[], i: number) {
  const n = keyframes.length
  const wrapPos = (j: number) => keyframes[Math.max(0, Math.min(n - 1, j))].position
  const wrapTgt = (j: number) => keyframes[Math.max(0, Math.min(n - 1, j))].target

  return {
    p0: wrapPos(i - 1), p1: keyframes[i].position,
    p2: wrapPos(i + 1), p3: wrapPos(i + 2),
    p0t: wrapTgt(i - 1), p1t: keyframes[i].target,
    p2t: wrapTgt(i + 1), p3t: wrapTgt(i + 2),
  }
}

function syncOrbitControls(
  controls: OrbitControls,
  splatModule: typeof import('gsplat'),
  targetX: number, targetY: number, targetZ: number,
) {
  controls.setCameraTarget(new splatModule.Vector3(targetX, targetY, targetZ))
  controls.dampening = 1
  controls.update()
  controls.dampening = 0.2
}

export function usePathPlayer(
  activePath: CameraPath | null,
  cameraRef: React.RefObject<Camera | null>,
  controlsRef: React.RefObject<OrbitControls | null>,
  splatModuleRef: React.RefObject<typeof import('gsplat') | null>,
  isPathPlayingRef: React.MutableRefObject<boolean>,
  pathUpdateRef: React.MutableRefObject<(() => void) | null>,
): PlaybackEngine {
  const [state, setState] = useState<PlaybackState>('idle')
  const [overallProgress, setOverallProgress] = useState(0)
  const [speed, setSpeedState] = useState(1)

  const stateRef = useRef<PlaybackState>('idle')
  const speedRef = useRef(1)
  const internalRef = useRef<PlaybackInternal>({ segmentIndex: 0, segmentT: 0, lastTime: 0 })
  const activePathRef = useRef<CameraPath | null>(null)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { activePathRef.current = activePath }, [activePath])

  useEffect(() => {
    isPathPlayingRef.current = state === 'playing' || state === 'paused'
  }, [state, isPathPlayingRef])

  const stopInternal = useCallback(() => {
    setState('idle')
    setOverallProgress(0)
    isPathPlayingRef.current = false
    internalRef.current = { segmentIndex: 0, segmentT: 0, lastTime: 0 }

    const ctrl = controlsRef.current
    const cam = cameraRef.current
    const SPLAT = splatModuleRef.current
    if (ctrl && cam && SPLAT) {
      const fwd = (cam as any).forward ?? { x: 0, y: 0, z: -1 }
      syncOrbitControls(ctrl, SPLAT,
        cam.position.x + fwd.x * 3,
        cam.position.y + fwd.y * 3,
        cam.position.z + fwd.z * 3,
      )
    }
  }, [cameraRef, controlsRef, splatModuleRef, isPathPlayingRef])

  // Stop when path changes
  useEffect(() => {
    if (stateRef.current !== 'idle') stopInternal()
  }, [activePath?.id, stopInternal])

  useEffect(() => {
    return () => { stopInternal() }
  }, [stopInternal])

  // Per-frame update — called from render loop
  const updatePath = useCallback(() => {
    const path = activePathRef.current
    const cam = cameraRef.current
    const SPLAT = splatModuleRef.current
    if (!path || !cam || !SPLAT) return
    const kfs = path.keyframes
    if (kfs.length === 0) return

    if (kfs.length === 1) {
      const p = kfs[0].position; const t = kfs[0].target
      const dx = t.x - p.x; const dy = t.y - p.y; const dz = t.z - p.z
      const dirLen = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dirLen < 0.0001) return
      const rot = SPLAT.Quaternion.LookRotation(new SPLAT.Vector3(dx, dy, dz))
      cam.position = new SPLAT.Vector3(p.x, p.y, p.z)
      cam.rotation = rot
      setOverallProgress(1)
      return
    }

    const intern = internalRef.current
    const spd = speedRef.current
    const now = performance.now()

    if (stateRef.current === 'paused') { intern.lastTime = now; return }
    if (intern.lastTime === 0) intern.lastTime = now

    const dt = (now - intern.lastTime) / 1000
    intern.lastTime = now

    const totalSegments = kfs.length - 1
    const segmentDuration = 2.0 / spd
    intern.segmentT += dt / segmentDuration

    while (intern.segmentT >= 1 && intern.segmentIndex < totalSegments - 1) {
      intern.segmentT -= 1
      intern.segmentIndex++
    }

    if (intern.segmentIndex >= totalSegments - 1 && intern.segmentT >= 1) {
      const last = kfs[kfs.length - 1]
      const dir = new SPLAT.Vector3(
        last.target.x - last.position.x,
        last.target.y - last.position.y,
        last.target.z - last.position.z,
      )
      const rot = SPLAT.Quaternion.LookRotation(dir)
      cam.position = new SPLAT.Vector3(last.position.x, last.position.y, last.position.z)
      cam.rotation = rot
      setOverallProgress(1)
      stopInternal()
      return
    }

    const i = Math.min(intern.segmentIndex, totalSegments - 1)
    const t = Math.max(0, Math.min(1, intern.segmentT))
    const easedT = easeInOutCubic(t)

    const { p0, p1, p2, p3, p0t, p1t, p2t, p3t } = getControlPoints(kfs, i)

    const pos = catmullRomPoint(p0, p1, p2, p3, easedT)
    const tgt = catmullRomPoint(p0t, p1t, p2t, p3t, easedT)

    const dirLen = Math.sqrt((tgt.x - pos.x) ** 2 + (tgt.y - pos.y) ** 2 + (tgt.z - pos.z) ** 2)
    if (dirLen < 0.0001) return
    const rot = SPLAT.Quaternion.LookRotation(new SPLAT.Vector3(tgt.x - pos.x, tgt.y - pos.y, tgt.z - pos.z))

    cam.position = new SPLAT.Vector3(pos.x, pos.y, pos.z)
    cam.rotation = rot

    setOverallProgress((i + t) / totalSegments)
  }, [cameraRef, splatModuleRef, stopInternal])

  pathUpdateRef.current = updatePath

  const play = useCallback(() => {
    const path = activePathRef.current
    if (!path || path.keyframes.length === 0 || !splatModuleRef.current) return
    const ctrl = controlsRef.current
    if (ctrl) ctrl.dampening = 0

    if (stateRef.current === 'idle') {
      internalRef.current = { segmentIndex: 0, segmentT: 0, lastTime: 0 }
      setOverallProgress(0)
    }
    internalRef.current.lastTime = 0
    setState('playing')
    isPathPlayingRef.current = true
  }, [splatModuleRef, controlsRef, isPathPlayingRef])

  const pause = useCallback(() => {
    if (stateRef.current === 'playing') setState('paused')
  }, [])

  const stop = useCallback(() => stopInternal(), [stopInternal])

  const setSpeed = useCallback((s: number) => setSpeedState(s), [])

  return { state, overallProgress, speed, play, pause, stop, setSpeed }
}
