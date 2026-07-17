/**
 * Decode .sog (SuperSplat Gaussian) files to PLY in the browser.
 */
import { readFile, writePly, MemoryReadFileSystem, MemoryFileSystem } from '@playcanvas/splat-transform'

async function decodeSogBuffer(arrayBuffer: ArrayBuffer, filename: string, onProgress?: (pct: number) => void): Promise<ArrayBuffer> {
  const readFs = new MemoryReadFileSystem()
  readFs.set(filename, new Uint8Array(arrayBuffer))

  onProgress?.(15)

  const [dataTable] = await readFile({
    filename,
    inputFormat: 'sog',
    fileSystem: readFs as any,
    options: {},
    params: {},
  } as any)

  onProgress?.(55)

  const writeFs = new MemoryFileSystem()
  await writePly({
    filename: 'scene.ply',
    plyData: { elements: [{ name: 'vertex', dataTable }], comments: [] },
  } as any, writeFs)

  onProgress?.(90)

  const result = writeFs.results.get('scene.ply')
  if (!result) throw new Error('SoG 解码失败')
  return (result as Uint8Array).buffer as ArrayBuffer
}

/** Decode a .sog File object to PLY ArrayBuffer */
export async function sogFileToPly(file: File): Promise<{ buffer: ArrayBuffer; name: string }> {
  return {
    buffer: await decodeSogBuffer(await file.arrayBuffer(), file.name),
    name: file.name.replace(/\.sog$/i, ''),
  }
}

/** Decode a .sog URL (fetch → decode) to PLY ArrayBuffer, with progress 0–100 */
export async function sogUrlToPly(url: string, onProgress?: (pct: number) => void): Promise<ArrayBuffer> {
  onProgress?.(5)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载 SoG 失败: HTTP ${res.status}`)

  onProgress?.(20)

  const arrayBuffer = await res.arrayBuffer()

  onProgress?.(30)

  const filename = url.split('/').pop() ?? 'scene.sog'
  // Decode phase: 30% → 100%
  return decodeSogBuffer(arrayBuffer, filename, (pct) => {
    onProgress?.(30 + Math.round(pct * 0.7))
  })
}
