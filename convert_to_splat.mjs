/**
 * Convert 3DGS .ply (binary, from splat-transform) to gsplat.js raw splat format.
 * Format (32 bytes/gaussian): pos(3f) + scales(3f) + color(4b RGBA) + rot(4b WXYZ)
 * NO header - gsplat.js parses as raw array of 32-byte records.
 */
import { readFileSync, writeFileSync } from 'fs';

const SH_C0 = 0.28209479177387814;
const ROW = 32;

function sigmoid(v) {
  if (v > 80) return 1;
  if (v < -80) return 0;
  return 1 / (1 + Math.exp(-v));
}

// Read PLY
const ply = readFileSync('public/models/ponte-portagem.ply');
const hdrEnd = ply.indexOf(Buffer.from('end_header\n'));
const headerStr = ply.subarray(0, hdrEnd).toString();
const dataStart = hdrEnd + 10;

// Parse properties
const props = [];
for (const line of headerStr.split('\n')) {
  const p = line.trim().split(/\s+/);
  if (p[0] === 'property') props.push({ type: p[1], name: p[2] });
}

// Build offset map
let off = 0;
const col = {};
const sizes = { float: 4, uchar: 1, uint: 4, int: 4, short: 2 };
for (const p of props) {
  col[p.name] = { offset: off, type: p.type };
  off += sizes[p.type] || 4;
}
const stride = off;
const getF = (buf, name) => buf.readFloatLE(col[name].offset);

// Count
let total = 0;
for (const line of headerStr.split('\n')) {
  const p = line.trim().split(/\s+/);
  if (p[0] === 'element' && p[1] === 'vertex') total = parseInt(p[2]);
}
console.log(`Converting ${(total / 1e6).toFixed(2)}M gaussians...`);

// Pre-allocate output: NO header, just raw 32-byte records
const out = Buffer.alloc(total * ROW);
let written = 0;

for (let i = 0; i < total; i++) {
  const row = ply.subarray(dataStart + i * stride, dataStart + (i + 1) * stride);

  // Position
  const px = getF(row, 'x');
  const py = getF(row, 'y');
  const pz = getF(row, 'z');

  // Opacity (sigmoid)
  const rawOpacity = getF(row, 'opacity');
  const opacity = sigmoid(rawOpacity);

  // Skip invisible gaussians at origin
  if (opacity < 0.001 && Math.abs(px) < 0.0001 && Math.abs(py) < 0.0001 && Math.abs(pz) < 0.0001) {
    continue;
  }

  // Scales (exp)
  const sx = Math.exp(getF(row, 'scale_0'));
  const sy = Math.exp(getF(row, 'scale_1'));
  const sz = Math.exp(getF(row, 'scale_2'));

  // Color from SH DC: 0.5 + SH_C0 * f_dc
  let r = 0.5 + SH_C0 * getF(row, 'f_dc_0');
  let g = 0.5 + SH_C0 * getF(row, 'f_dc_1');
  let b = 0.5 + SH_C0 * getF(row, 'f_dc_2');
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b = Math.max(0, Math.min(1, b));
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255);

  // Rotation quaternion (normalize + quantize to [0,255] from [-1,1])
  let qw = getF(row, 'rot_0');
  let qx = getF(row, 'rot_1');
  let qy = getF(row, 'rot_2');
  let qz = getF(row, 'rot_3');
  const qLen = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  if (qLen > 0.001) { qx /= qLen; qy /= qLen; qz /= qLen; qw /= qLen; }
  else { qx = 0; qy = 0; qz = 0; qw = 1; }

  // gsplat order: W, X, Y, Z (rotations[0]=w, [1]=x, [2]=y, [3]=z)
  const rw = Math.round((qw + 1) / 2 * 255);
  const rx = Math.round((qx + 1) / 2 * 255);
  const ry = Math.round((qy + 1) / 2 * 255);
  const rz = Math.round((qz + 1) / 2 * 255);

  // Write 32-byte record:
  // offset 0-11:  position (3 × float32)
  // offset 12-23: scales   (3 × float32)
  // offset 24-27: color    (4 × uint8 RGBA)
  // offset 28-31: rotation (4 × uint8 W,X,Y,Z)
  const base = written * ROW;
  out.writeFloatLE(px, base);
  out.writeFloatLE(py, base + 4);
  out.writeFloatLE(pz, base + 8);
  out.writeFloatLE(sx, base + 12);
  out.writeFloatLE(sy, base + 16);
  out.writeFloatLE(sz, base + 20);
  out.writeUInt8(Math.round(r * 255), base + 24);
  out.writeUInt8(Math.round(g * 255), base + 25);
  out.writeUInt8(Math.round(b * 255), base + 26);
  out.writeUInt8(alpha, base + 27);
  out.writeUInt8(rw, base + 28);
  out.writeUInt8(rx, base + 29);
  out.writeUInt8(ry, base + 30);
  out.writeUInt8(rz, base + 31);

  written++;

  if (i % 500000 === 0 && i > 0) {
    console.log(`  ${(i / 1e6).toFixed(1)}M / ${(total / 1e6).toFixed(2)}M`);
  }
}

console.log(`Filtered ${total - written} inactive, kept ${written} gaussians`);

// Write raw 32-byte records (no header)
const outPath = 'public/models/ponte-portagem.splat';
writeFileSync(outPath, out.subarray(0, written * ROW));
console.log(`Done: ${outPath} (${(written * ROW / 1024 / 1024).toFixed(1)} MB, ${written} gaussians)`);
