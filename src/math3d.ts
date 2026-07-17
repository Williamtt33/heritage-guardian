import type { Vector3Like } from './types'

/** Project a 3D world point to 2D screen coordinates */
export function worldToScreen(
  worldPos: Vector3Like,
  cameraPos: Vector3Like,
  cameraForward: Vector3Like,
  fovY: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number; visible: boolean } | null {
  const worldUp = { x: 0, y: 1, z: 0 }

  const fLen = Math.sqrt(cameraForward.x ** 2 + cameraForward.y ** 2 + cameraForward.z ** 2)
  const fwd = { x: cameraForward.x / fLen, y: cameraForward.y / fLen, z: cameraForward.z / fLen }

  let rx = worldUp.y * fwd.z - worldUp.z * fwd.y
  let ry = worldUp.z * fwd.x - worldUp.x * fwd.z
  let rz = worldUp.x * fwd.y - worldUp.y * fwd.x
  const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz)
  if (rLen < 0.0001) { rx = 1; ry = 0; rz = 0 }
  else { rx /= rLen; ry /= rLen; rz /= rLen }

  const ux = fwd.y * rz - fwd.z * ry
  const uy = fwd.z * rx - fwd.x * rz
  const uz = fwd.x * ry - fwd.y * rx

  const dx = worldPos.x - cameraPos.x
  const dy = worldPos.y - cameraPos.y
  const dz = worldPos.z - cameraPos.z

  const vx = dx * rx + dy * ry + dz * rz
  const vy = dx * ux + dy * uy + dz * uz
  const vz = dx * fwd.x + dy * fwd.y + dz * fwd.z

  if (vz <= 0.001) return null

  const aspect = screenWidth / screenHeight
  const tanHalfFov = Math.tan((fovY * Math.PI) / 360)
  const h = 2 * tanHalfFov * vz
  const w = h * aspect

  const ndcX = vx / (w / 2)
  const ndcY = -(vy / (h / 2))

  const screenX = (ndcX + 1) / 2 * screenWidth
  const screenY = (ndcY + 1) / 2 * screenHeight

  const visible = screenX >= -50 && screenX <= screenWidth + 50 &&
                  screenY >= -50 && screenY <= screenHeight + 50

  return { x: screenX, y: screenY, visible }
}

/** Ease-in-out cubic */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Catmull-Rom 1D */
function cr1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/** Catmull-Rom spline over Vector3Like */
export function catmullRomPoint(
  p0: Vector3Like, p1: Vector3Like, p2: Vector3Like, p3: Vector3Like, t: number,
): Vector3Like {
  return {
    x: cr1D(p0.x, p1.x, p2.x, p3.x, t),
    y: cr1D(p0.y, p1.y, p2.y, p3.y, t),
    z: cr1D(p0.z, p1.z, p2.z, p3.z, t),
  }
}
