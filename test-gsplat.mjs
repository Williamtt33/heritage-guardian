// Simple test: can gsplat load a .splat file?
import * as SPLAT from 'gsplat'
import { readFile } from 'fs/promises'

async function main() {
  console.log('gsplat Loader:', typeof SPLAT.Loader)
  console.log('gsplat LoadAsync:', typeof SPLAT.Loader?.LoadAsync)
  console.log('gsplat Scene:', typeof SPLAT.Scene)
  console.log('gsplat PLYLoader:', typeof SPLAT.PLYLoader)

  const scene = new SPLAT.Scene()
  console.log('Scene created')

  // Try to load a .splat file from disk via URL
  const url = 'http://localhost:3000/models/chinese-guardian-lion.splat'
  console.log('Loading from:', url)

  try {
    const splat = await SPLAT.Loader.LoadAsync(url, scene, (p) => {
      if (Math.round(p * 100) % 10 === 0) console.log(`  ${Math.round(p * 100)}%`)
    })
    console.log('Loaded! vertexCount:', splat?.data?.vertexCount)
    console.log('Splat keys:', Object.keys(splat || {}).join(', '))

    if (splat?.recalculateBounds) {
      splat.recalculateBounds()
      const b = splat.bounds
      if (b) {
        console.log('Bounds center:', b.center())
        console.log('Bounds size:', b.size())
      }
    }

  } catch (e) {
    console.error('Load failed:', e.message)
    console.error('Stack:', e.stack?.split('\n').slice(0, 5).join('\n'))
  }
}

main().catch(e => console.error(e))
