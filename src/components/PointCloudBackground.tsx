import { useRef, useEffect, useCallback } from 'react'

interface Point3D {
  x: number; y: number; z: number
  r: number
  a: number
  speed: number
  color: 0 | 1
}

const POINT_COUNT = 340
const SPHERE_RADIUS = 600
const ROTATE_SPEED = 0.0003
const LINE_DIST = 180
const DOT_COLOR_A = '124, 111, 240'   // crystal violet
const DOT_COLOR_B = '0, 194, 217'     // ice cyan
const LINE_ALPHA = 0.03
const DOT_ALPHA_BASE = 0.12

interface Props { className?: string }

export default function PointCloudBackground({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Point3D[]>([])
  const animRef = useRef<number>(0)
  const timeRef = useRef<number>(0)
  const visibleRef = useRef(true)

  const initPoints = useCallback((count: number, radius: number) => {
    const points: Point3D[] = []
    let seed = 42
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const r = radius * (0.6 + rand() * 0.4)
      points.push({
        x: Math.cos(theta) * Math.sin(phi) * r,
        y: Math.sin(theta) * Math.sin(phi) * r * 0.7,
        z: Math.cos(phi) * r,
        r: 0.8 + rand() * 2.2,
        a: DOT_ALPHA_BASE * (0.5 + rand() * 0.5),
        speed: 0.7 + rand() * 0.6,
        color: (rand() > 0.4 ? 0 : 1) as 0 | 1,
      })
    }
    // Background scatter
    for (let i = 0; i < 60; i++) {
      const theta2 = rand() * Math.PI * 2
      const phi2 = rand() * Math.PI
      const r2 = radius * (0.3 + rand() * 0.9)
      points.push({
        x: Math.cos(theta2) * Math.sin(phi2) * r2,
        y: Math.sin(theta2) * Math.sin(phi2) * r2 * 0.5,
        z: Math.cos(phi2) * r2,
        r: 0.5 + rand() * 1.2,
        a: DOT_ALPHA_BASE * (0.3 + rand() * 0.3),
        speed: 0.9 + rand() * 0.4,
        color: (rand() > 0.6 ? 1 : 0) as 0 | 1,
      })
    }
    return points
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (pointsRef.current.length === 0) {
      pointsRef.current = initPoints(POINT_COUNT, SPHERE_RADIUS)
    }
    const points = pointsRef.current

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    const io = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0 },
    )
    io.observe(canvas)

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = mq.matches
    mq.addEventListener('change', (e) => { reducedMotion = e.matches })

    const w = () => canvas.parentElement?.getBoundingClientRect().width ?? 0
    const h = () => canvas.parentElement?.getBoundingClientRect().height ?? 0

    const animate = (timestamp: number) => {
      if (!visibleRef.current) { animRef.current = requestAnimationFrame(animate); return }
      const cw = w(); const ch = h()
      if (cw === 0 || ch === 0) { animRef.current = requestAnimationFrame(animate); return }

      const dt = timeRef.current ? timestamp - timeRef.current : 16
      timeRef.current = timestamp

      const angle = reducedMotion ? 0 : ROTATE_SPEED * dt
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      for (const p of points) { const nx = p.x * cos - p.z * sin; p.z = p.x * sin + p.z * cos; p.x = nx }

      ctx.clearRect(0, 0, cw, ch)

      const cx = cw / 2; const cy = ch / 2
      const scale = Math.min(cw, ch) / 1200

      const projected: { sx: number; sy: number; z: number; r: number; a: number; color: 0 | 1 }[] = []
      for (const p of points) {
        const fov = 800
        const sz = fov / (fov + p.z)
        projected.push({ sx: cx + p.x * sz * scale, sy: cy + p.y * sz * scale, z: p.z, r: p.r * sz * scale * 1.5, a: p.a * sz, color: p.color })
      }
      projected.sort((a, b) => a.z - b.z)

      // Lines — use violet for connections
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].sx - projected[j].sx
          const dy = projected[i].sy - projected[j].sy
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxDist = LINE_DIST * scale
          if (dist < maxDist) {
            const alpha = LINE_ALPHA * (1 - dist / maxDist) * projected[i].a
            ctx.beginPath()
            ctx.moveTo(projected[i].sx, projected[i].sy)
            ctx.lineTo(projected[j].sx, projected[j].sy)
            ctx.strokeStyle = `rgba(${DOT_COLOR_A}, ${alpha})`
            ctx.lineWidth = 0.3
            ctx.stroke()
          }
        }
      }

      // Dots — dual color: violet + cyan
      for (const p of projected) {
        if (p.r < 0.2) continue
        const rgb = p.color === 0 ? DOT_COLOR_A : DOT_COLOR_B
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, Math.max(0.3, p.r), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${p.a})`
        if (p.r > 2) { ctx.shadowColor = `rgba(${rgb}, ${p.a * 0.5})`; ctx.shadowBlur = p.r * 2 }
        ctx.fill()
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      io.disconnect()
    }
  }, [initPoints])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
    />
  )
}
