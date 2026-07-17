import { supabase, isSupabaseConfigured } from './supabase'
import type { ModelMeta, Hotspot, CameraPath, Vector3Like, HistoricalPhoto, ArchiveDocument, RepairRecord, CommunityReport, RedCultureMark, TourRoute } from './types'
import { STORAGE_KEY_HOTSPOTS, STORAGE_KEY_CAMERA_PATHS, STORAGE_KEY_CUSTOM_MODELS, STORAGE_KEY_INITIAL_CAMERA, STORAGE_KEY_THUMBNAILS, STORAGE_KEY_HERITAGE_META, STORAGE_KEY_COMMUNITY_REPORTS, applyHeritageDefaults } from './types'

// ── Helpers ──

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function warn(msg: string, err?: unknown) {
  console.warn(`[store] ${msg}`, err ?? '')
}

// ── Built-in models (static manifest) ──

let builtinCache: ModelMeta[] | null = null

export async function getBuiltinModels(): Promise<ModelMeta[]> {
  if (builtinCache) return builtinCache
  try {
    // Cache-bust with timestamp to avoid stale browser cache
    const url = `${import.meta.env.BASE_URL}models/manifest.json?v=${Date.now()}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    builtinCache = Array.isArray(data) ? data : []
    return builtinCache
  } catch (e) {
    warn('内置模型加载失败', e)
    return []
  }
}

// ── Public API: Models ──

export async function getAllModels(): Promise<ModelMeta[]> {
  const builtin = await getBuiltinModels()
  // Merge custom models from localStorage
  let custom: ModelMeta[] = []
  let needsCleanup = false
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
    custom = raw ? JSON.parse(raw) : []
  } catch { /* localStorage not available */ }
  // Deduplicate by id (builtin takes precedence), filter out obviously stale entries
  const seen = new Set(builtin.map(m => m.id))
  const all = [...builtin]
  for (const m of custom) {
    if (seen.has(m.id)) continue
    // Skip obvious stale entries (models referencing deleted full-size files)
    if (!m.file || m.file.trim() === '') { needsCleanup = true; continue }
    if (/\bfull\b/i.test(m.id) || /\bfull\b/i.test(m.file)) { needsCleanup = true; continue }
    seen.add(m.id)
    all.push(m)
  }
  // Auto-cleanup stale models from localStorage
  if (needsCleanup) {
    try {
      const valid = custom.filter(m => {
        if (!m.file || m.file.trim() === '') return false
        if (/\bfull\b/i.test(m.id) || /\bfull\b/i.test(m.file)) return false
        return true
      })
      localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(valid))
    } catch { /* ignore */ }
  }
  // Apply thumbnail overrides (so built-in models can also have custom covers)
  const overrides = getThumbnailOverrides()
  for (const m of all) {
    if (overrides[m.id]) m.thumbnail = overrides[m.id]
  }
  // Apply heritage defaults + merge extended metadata
  for (let i = 0; i < all.length; i++) {
    all[i] = applyHeritageDefaults(all[i])
    // Merge heritage metadata from dedicated storage
    const ext = getHeritageMeta(all[i].id)
    if (ext) Object.assign(all[i], ext)
  }
  return all
}

export async function getModelById(id: string): Promise<ModelMeta | null> {
  const all = await getAllModels()
  return all.find(m => m.id === id) ?? null
}

export async function saveModel(model: Omit<ModelMeta, 'id'> & { id?: string }): Promise<string> {
  const id = model.id || uid()
  // Save to localStorage only (Supabase is down)
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
    const models: ModelMeta[] = raw ? JSON.parse(raw) : []
    const filtered = models.filter(x => x.id !== id)
    filtered.unshift({ ...model, id, hotspots: (model as any).hotspots ?? [] })
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(filtered))
  } catch { /* localStorage not available */ }
  return id
}

export async function deleteModel(id: string): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
    const models: ModelMeta[] = raw ? JSON.parse(raw) : []
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(models.filter(x => x.id !== id)))
  } catch { /* localStorage not available */ }
}

// ── Thumbnail overrides (persisted separately so built-in models can also have custom covers) ──

export function getThumbnailOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THUMBNAILS)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function setThumbnailOverride(modelId: string, url: string): void {
  const map = getThumbnailOverrides()
  map[modelId] = url
  try { localStorage.setItem(STORAGE_KEY_THUMBNAILS, JSON.stringify(map)) } catch { /* quota exceeded */ }
}

// ── Public API: Hotspots ──

export async function getHotspots(modelId: string): Promise<Hotspot[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('hotspots').select('*').eq('model_id', modelId).order('sort_order', { ascending: true })
      if (error) throw error
      return ((data ?? []) as any[]).map((db: any) => ({
        id: db.id,
        position: { x: db.position_x, y: db.position_y, z: db.position_z },
        title: db.title, description: db.description, note: db.note ?? '',
        order: db.sort_order,
        cameraPosition: { x: db.camera_pos_x, y: db.camera_pos_y, z: db.camera_pos_z },
        cameraTarget: { x: db.camera_tgt_x, y: db.camera_tgt_y, z: db.camera_tgt_z },
      }))
    } catch (e) {
      warn('云端标注加载失败，使用本地缓存', e)
    }
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOTSPOTS + modelId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function saveHotspots(modelId: string, hotspots: Hotspot[]): Promise<void> {
  // Always save to localStorage as backup
  localStorage.setItem(STORAGE_KEY_HOTSPOTS + modelId, JSON.stringify(hotspots))

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('hotspots').delete().eq('model_id', modelId)
      if (hotspots.length > 0) {
        const rows = hotspots.map(hs => ({
          id: hs.id, model_id: modelId,
          position_x: hs.position.x, position_y: hs.position.y, position_z: hs.position.z,
          title: hs.title, description: hs.description, note: hs.note, sort_order: hs.order,
          camera_pos_x: hs.cameraPosition.x, camera_pos_y: hs.cameraPosition.y, camera_pos_z: hs.cameraPosition.z,
          camera_tgt_x: hs.cameraTarget.x, camera_tgt_y: hs.cameraTarget.y, camera_tgt_z: hs.cameraTarget.z,
        }))
        const { error } = await supabase.from('hotspots').insert(rows)
        if (error) throw error
      }
    } catch (e) {
      warn('云端标注保存失败', e)
    }
  }
}

// ── Public API: Camera Paths ──

export async function getCameraPaths(modelId: string): Promise<CameraPath[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data: paths, error } = await supabase.from('camera_paths').select('*').eq('model_id', modelId).order('created_at', { ascending: true })
      if (!error && paths?.length) {
        const pathIds = (paths as any[]).map((p: any) => p.id)
        const { data: kfs } = await supabase.from('keyframes').select('*').in('path_id', pathIds).order('sort_order', { ascending: true })
        const kfMap = new Map<string, any[]>()
        for (const kf of (kfs ?? []) as any[]) {
          const arr = kfMap.get(kf.path_id) ?? []; arr.push(kf); kfMap.set(kf.path_id, arr)
        }
        return (paths as any[]).map((p: any) => ({
          id: p.id, name: p.name,
          keyframes: (kfMap.get(p.id) ?? []).map((kf: any) => ({
            id: kf.id,
            position: { x: kf.pos_x, y: kf.pos_y, z: kf.pos_z },
            target: { x: kf.tgt_x, y: kf.tgt_y, z: kf.tgt_z },
          })),
        }))
      }
    } catch (e) { warn('云端相机路径加载失败', e) }
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMERA_PATHS + modelId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function saveCameraPaths(modelId: string, paths: CameraPath[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY_CAMERA_PATHS + modelId, JSON.stringify(paths))

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('camera_paths').delete().eq('model_id', modelId)
      for (const path of paths) {
        await supabase.from('camera_paths').insert({ id: path.id, model_id: modelId, name: path.name })
        if (path.keyframes.length > 0) {
          await supabase.from('keyframes').insert(path.keyframes.map((kf, i) => ({
            id: kf.id, path_id: path.id, sort_order: i,
            pos_x: kf.position.x, pos_y: kf.position.y, pos_z: kf.position.z,
            tgt_x: kf.target.x, tgt_y: kf.target.y, tgt_z: kf.target.z,
          })))
        }
      }
    } catch (e) { warn('云端相机路径保存失败', e) }
  }
}

// ── Initial Camera (localStorage only) ──

export function getInitialCamera(modelId: string): { position: Vector3Like; target: Vector3Like } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INITIAL_CAMERA + modelId)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveInitialCamera(modelId: string, position: Vector3Like, target: Vector3Like): void {
  localStorage.setItem(STORAGE_KEY_INITIAL_CAMERA + modelId, JSON.stringify({ position, target }))
}

// ── File Storage ──

export async function uploadSplatFile(modelId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未配置，无法上传文件')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'splat'
  const path = `${modelId}/scene.${ext}`
  const { error } = await supabase.storage.from('splat-files').upload(path, file, { cacheControl: '31536000', upsert: true })
  if (error) throw new Error(`文件上传失败: ${error.message}`)
  const { data } = supabase.storage.from('splat-files').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadThumbnail(modelId: string, dataUrl: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未配置，无法上传封面')
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const path = `${modelId}/thumb.${blob.type === 'image/png' ? 'png' : 'jpg'}`
  const { error } = await supabase.storage.from('thumbnails').upload(path, blob, { cacheControl: '31536000', upsert: true, contentType: blob.type })
  if (error) throw new Error(`封面上传失败: ${error.message}`)
  const { data } = supabase.storage.from('thumbnails').getPublicUrl(path)
  return data.publicUrl
}

// ── Heritage Extended Metadata ──

export interface HeritageMeta {
  protectionLevel?: ModelMeta['protectionLevel']
  constructionYear?: string
  architecturalStyle?: string
  conservationStatus?: ModelMeta['conservationStatus']
  location?: ModelMeta['location']
  historicalPhotos?: HistoricalPhoto[]
  documents?: ArchiveDocument[]
  repairRecords?: RepairRecord[]
  redCultureMarks?: RedCultureMark[]
  tourRoutes?: TourRoute[]
}

export function getHeritageMeta(modelId: string): HeritageMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HERITAGE_META + modelId)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveHeritageMeta(modelId: string, meta: HeritageMeta): void {
  try { localStorage.setItem(STORAGE_KEY_HERITAGE_META + modelId, JSON.stringify(meta)) } catch { /* quota */ }
}

// ── Community Reports ──

export function getCommunityReports(modelId: string): CommunityReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMUNITY_REPORTS + modelId)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveCommunityReports(modelId: string, reports: CommunityReport[]): void {
  try { localStorage.setItem(STORAGE_KEY_COMMUNITY_REPORTS + modelId, JSON.stringify(reports)) } catch { /* quota */ }
}

// ── Model URL Resolution ──

export type ModelSource =
  | { type: 'url'; url: string }
  | { type: 'buffer'; buffer: ArrayBuffer; format?: string }

export async function resolveModelSource(
  model: ModelMeta,
  onProgress?: (pct: number) => void,
): Promise<ModelSource> {
  const file = model.file
  onProgress?.(5)

  // HTTP(S) URL → handle .sog decoding, otherwise use as-is
  if (file.startsWith('http://') || file.startsWith('https://')) {
    if (file.toLowerCase().endsWith('.sog')) {
      // Remote .sog → download + decode to PLY client-side
      const { sogUrlToPly } = await import('./utils/sogDecoder')
      const plyBuffer = await sogUrlToPly(file, (p) => onProgress?.(5 + Math.round(p * 0.9)))
      onProgress?.(95)
      return { type: 'buffer', buffer: plyBuffer, format: 'ply' }
    }
    onProgress?.(50)
    return { type: 'url', url: file }
  }

  // Relative path → serve from /models/
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base}models/${file}`
  onProgress?.(10)

  // SoG files: download + decode to PLY
  if (file.toLowerCase().endsWith('.sog')) {
    const { sogUrlToPly } = await import('./utils/sogDecoder')
    const plyBuffer = await sogUrlToPly(url, (p) => onProgress?.(10 + Math.round(p * 0.85)))
    onProgress?.(95)
    return { type: 'buffer', buffer: plyBuffer, format: 'ply' }
  }

  // .ply / .splat: stream via gsplat LoadAsync (supports progress callback)
  if (file.toLowerCase().endsWith('.ply') || file.toLowerCase().endsWith('.splat')) {
    onProgress?.(30) // URL resolved, gsplat will handle the rest
    return { type: 'url', url }
  }

  // Other files: pre-fetch as ArrayBuffer
  const res = await fetch(url)
  if (!res.ok) throw new Error(`加载模型失败: HTTP ${res.status}`)
  const buffer = await res.arrayBuffer()
  onProgress?.(100)
  return { type: 'buffer', buffer }
}
