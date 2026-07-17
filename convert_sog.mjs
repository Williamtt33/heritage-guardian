/**
 * Convert .sog (SuperSplat) → .splat (raw 32-byte gaussians)
 * Bypasses PLY — reads DataTable columns directly and writes .splat.
 */
import { readFile, MemoryReadFileSystem } from '@playcanvas/splat-transform'
import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'public/models/Container.sog'
const OUTPUT = 'public/models/Container.splat'

const SH_C0 = 0.28209479177387814
const ROW = 32

function sigmoid(v) {
  if (v > 80) return 1
  if (v < -80) return 0
  return 1 / (1 + Math.exp(-v))
}

console.log('Reading SoG...')
const sogBuffer = readFileSync(INPUT)
const readFs = new MemoryReadFileSystem()
readFs.set('Container.sog', new Uint8Array(sogBuffer))

const [dataTable] = await readFile({
  filename: 'Container.sog',
  inputFormat: 'sog',
  fileSystem: readFs,
  options: {},
  params: {},
})

const numRows = dataTable.numRows
console.log(`Decoded: ${numRows} gaussians`)

// Get column data directly (bypass PLY)
const getCol = (name) => {
  const col = dataTable.getColumnByName(name)
  return col ? col.data : null
}

const xs = getCol('x')
const ys = getCol('y')
const zs = getCol('z')
const sc0 = getCol('scale_0')
const sc1 = getCol('scale_1')
const sc2 = getCol('scale_2')
const dc0 = getCol('f_dc_0')
const dc1 = getCol('f_dc_1')
const dc2 = getCol('f_dc_2')
const op = getCol('opacity')
const r0 = getCol('rot_0')
const r1 = getCol('rot_1')
const r2 = getCol('rot_2')
const r3 = getCol('rot_3')

if (!xs || !sc0) throw new Error('Missing columns')

// Pre-allocate output buffer
const out = Buffer.alloc(numRows * ROW)
let written = 0

for (let i = 0; i < numRows; i++) {
  const px = xs[i], py = ys[i], pz = zs[i]
  const rawOpacity = op[i]
  const opacity = sigmoid(rawOpacity)

  // Skip invisible gaussians at origin
  if (opacity < 0.001 && Math.abs(px) < 0.0001 && Math.abs(py) < 0.0001 && Math.abs(pz) < 0.0001) {
    continue
  }

  // Scales: exp activation
  const sx = Math.exp(sc0[i])
  const sy = Math.exp(sc1[i])
  const sz = Math.exp(sc2[i])

  // Color from SH DC: 0.5 + SH_C0 * f_dc
  let cr = 0.5 + SH_C0 * dc0[i]
  let cg = 0.5 + SH_C0 * dc1[i]
  let cb = 0.5 + SH_C0 * dc2[i]
  cr = Math.max(0, Math.min(1, cr))
  cg = Math.max(0, Math.min(1, cg))
  cb = Math.max(0, Math.min(1, cb))
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)

  // Rotation quaternion: normalize + quantize [-1,1] → [0,255]
  let qw = r0[i], qx = r1[i], qy = r2[i], qz = r3[i]
  const qLen = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw)
  if (qLen > 0.001) { qx /= qLen; qy /= qLen; qz /= qLen; qw /= qLen }
  else { qx = 0; qy = 0; qz = 0; qw = 1 }

  // Quantize to [0, 255]
  const rw = Math.round(((qw + 1) / 2) * 255)
  const rx = Math.round(((qx + 1) / 2) * 255)
  const ry = Math.round(((qy + 1) / 2) * 255)
  const rz = Math.round(((qz + 1) / 2) * 255)

  // Write 32-byte record
  const base = written * ROW
  out.writeFloatLE(px, base)
  out.writeFloatLE(py, base + 4)
  out.writeFloatLE(pz, base + 8)
  out.writeFloatLE(sx, base + 12)
  out.writeFloatLE(sy, base + 16)
  out.writeFloatLE(sz, base + 20)
  out.writeUInt8(Math.round(cr * 255), base + 24)
  out.writeUInt8(Math.round(cg * 255), base + 25)
  out.writeUInt8(Math.round(cb * 255), base + 26)
  out.writeUInt8(alpha, base + 27)
  out.writeUInt8(rw, base + 28)
  out.writeUInt8(rx, base + 29)
  out.writeUInt8(ry, base + 30)
  out.writeUInt8(rz, base + 31)

  written++

  if (i % 300000 === 0 && i > 0) {
    console.log(`  ${(i / 1e6).toFixed(1)}M / ${(numRows / 1e6).toFixed(2)}M`)
  }
}

console.log(`Filtered ${numRows - written} inactive, kept ${written}`)

writeFileSync(OUTPUT, out.subarray(0, written * ROW))
console.log(`Done: ${OUTPUT} (${(written * ROW / 1024 / 1024).toFixed(1)} MB, ${written} gaussians)`)
