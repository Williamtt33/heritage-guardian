import { supabase, isSupabaseConfigured } from './supabase'
import type { ModelMeta, Hotspot, CameraPath, Vector3Like, HistoricalPhoto, ArchiveDocument, RepairRecord, CommunityReport, RedCultureMark, TourRoute } from './types'
import { STORAGE_KEY_HOTSPOTS, STORAGE_KEY_CAMERA_PATHS, STORAGE_KEY_CUSTOM_MODELS, STORAGE_KEY_INITIAL_CAMERA, STORAGE_KEY_THUMBNAILS, STORAGE_KEY_HERITAGE_META, STORAGE_KEY_COMMUNITY_REPORTS, STORAGE_KEY_PENDING_MODELS, STORAGE_KEY_REJECTED_MODELS, applyHeritageDefaults, generateTrackingCode, uid } from './types'

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
  const seen = new Set(builtin.map(m => m.id))
  const all = [...builtin]

  // 1. Supabase model sync — disabled: models are served from local public/models/
  // (Supabase auth/upload admin features remain available when configured)

  // 2. Merge custom models from localStorage
  let custom: ModelMeta[] = []
  let needsCleanup = false
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
    custom = raw ? JSON.parse(raw) : []
  } catch { /* localStorage not available */ }
  for (const m of custom) {
    if (seen.has(m.id)) continue
    if (!m.file || m.file.trim() === '') { needsCleanup = true; continue }
    seen.add(m.id)
    all.push(m)
  }
  // Auto-cleanup stale models from localStorage (only remove entries with empty file paths)
  if (needsCleanup) {
    try {
      const valid = custom.filter(m => m.file && m.file.trim() !== '')
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

export async function saveModel(model: Omit<ModelMeta, 'id'> & { id?: string }): Promise<{ id: string; trackingCode: string }> {
  const id = model.id || uid()
  const trackingCode = generateTrackingCode()
  const full: ModelMeta = { ...model, id, status: 'pending', trackingCode, hotspots: (model as any).hotspots ?? [] }

  // Local-only storage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
    const pending: ModelMeta[] = raw ? JSON.parse(raw) : []
    const filtered = pending.filter(x => x.id !== id)
    filtered.unshift(full)
    localStorage.setItem(STORAGE_KEY_PENDING_MODELS, JSON.stringify(filtered))
  } catch { /* localStorage not available */ }
  return { id, trackingCode }
}

export async function deleteModel(id: string): Promise<void> {
  // Clean up localStorage: all model-related keys
  const storageKeys = [
    STORAGE_KEY_CUSTOM_MODELS,
    STORAGE_KEY_PENDING_MODELS,
    STORAGE_KEY_REJECTED_MODELS,
  ]
  for (const key of storageKeys) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const list: ModelMeta[] = JSON.parse(raw)
        localStorage.setItem(key, JSON.stringify(list.filter(x => x.id !== id)))
      }
    } catch { /* ignore */ }
  }

  // 3. Clean up associated data: hotspots, camera paths, heritage meta, thumbnails, initial camera
  try { localStorage.removeItem(STORAGE_KEY_HOTSPOTS + id) } catch { /* ignore */ }
  try { localStorage.removeItem(STORAGE_KEY_CAMERA_PATHS + id) } catch { /* ignore */ }
  try { localStorage.removeItem(STORAGE_KEY_HERITAGE_META + id) } catch { /* ignore */ }
  try { localStorage.removeItem(STORAGE_KEY_INITIAL_CAMERA + id) } catch { /* ignore */ }

  // Clean up thumbnail override for this model
  try {
    const overrides = getThumbnailOverrides()
    if (overrides[id]) {
      delete overrides[id]
      localStorage.setItem(STORAGE_KEY_THUMBNAILS, JSON.stringify(overrides))
    }
  } catch { /* ignore */ }

  // Invalidate built-in cache (so re-fetch picks up the change)
  builtinCache = null
}

// ── Pending model review ──

export async function getPendingModels(): Promise<ModelMeta[]> {
  // Local-only: skip Supabase query
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
    const all: ModelMeta[] = raw ? JSON.parse(raw) : []
    const overrides = getThumbnailOverrides()
    for (const m of all) {
      if (overrides[m.id]) m.thumbnail = overrides[m.id]
    }
    return all
  } catch { return [] }
}

export async function approveModel(id: string): Promise<void> {
  const now = new Date().toISOString()

  const pendingRaw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
  const pending: ModelMeta[] = pendingRaw ? JSON.parse(pendingRaw) : []
  const idx = pending.findIndex(m => m.id === id)
  if (idx < 0) throw new Error('模型不在待审核列表中')

  const approved = { ...pending[idx], status: 'approved' as const, reviewNote: '', reviewedAt: now }
  pending.splice(idx, 1)
  localStorage.setItem(STORAGE_KEY_PENDING_MODELS, JSON.stringify(pending))

  const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
  const custom: ModelMeta[] = raw ? JSON.parse(raw) : []
  custom.unshift(approved)
  localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(custom))

  builtinCache = null
}

export async function rejectModel(id: string, reason?: string): Promise<void> {
  const now = new Date().toISOString()

  const pendingRaw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
  const pending: ModelMeta[] = pendingRaw ? JSON.parse(pendingRaw) : []
  const idx = pending.findIndex(m => m.id === id)
  if (idx < 0) throw new Error('模型不在待审核列表中')

  const rejected = {
    ...pending[idx],
    status: 'rejected' as const,
    reviewNote: reason || '',
    reviewedAt: now,
  }
  pending.splice(idx, 1)
  localStorage.setItem(STORAGE_KEY_PENDING_MODELS, JSON.stringify(pending))

  const raw = localStorage.getItem(STORAGE_KEY_REJECTED_MODELS)
  const rejectedList: ModelMeta[] = raw ? JSON.parse(raw) : []
  rejectedList.unshift(rejected)
  localStorage.setItem(STORAGE_KEY_REJECTED_MODELS, JSON.stringify(rejectedList))
}

export async function getRejectedModels(): Promise<ModelMeta[]> {
  // Local-only: skip Supabase query
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REJECTED_MODELS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** Admin direct add — skips review queue, model is immediately approved */
export async function saveModelDirect(model: Omit<ModelMeta, 'id'> & { id?: string }): Promise<{ id: string }> {
  const id = model.id || uid()
  const full: ModelMeta = { ...model, id, status: 'approved', hotspots: (model as any).hotspots ?? [] }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
    const custom: ModelMeta[] = raw ? JSON.parse(raw) : []
    custom.unshift(full)
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(custom))
    builtinCache = null
  } catch { /* localStorage not available */ }
  return { id }
}

// ── Status lookup for uploaders ──

export async function getModelByTrackingCode(code: string): Promise<ModelMeta | null> {
  // Local-only: search all storage keys
  const searchLocal = (key: string): ModelMeta | null => {
    try {
      const raw = localStorage.getItem(key)
      const list: ModelMeta[] = raw ? JSON.parse(raw) : []
      return list.find(m => m.trackingCode === code) ?? null
    } catch { return null }
  }
  return searchLocal(STORAGE_KEY_PENDING_MODELS)
    ?? searchLocal(STORAGE_KEY_REJECTED_MODELS)
    ?? searchLocal(STORAGE_KEY_CUSTOM_MODELS)
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOTSPOTS + modelId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function saveHotspots(modelId: string, hotspots: Hotspot[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY_HOTSPOTS + modelId, JSON.stringify(hotspots))
}

// ── Public API: Camera Paths ──

export async function getCameraPaths(modelId: string): Promise<CameraPath[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMERA_PATHS + modelId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function saveCameraPaths(modelId: string, paths: CameraPath[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY_CAMERA_PATHS + modelId, JSON.stringify(paths))
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

const REPORTS_KEY = STORAGE_KEY_COMMUNITY_REPORTS + '_global'

/** Get all community reports — localStorage only (Supabase table not yet created) */
export async function getAllReports(): Promise<CommunityReport[]> {
  return getLocalReports()
}

function getLocalReports(): CommunityReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalReports(reports: CommunityReport[]): void {
  try { localStorage.setItem(REPORTS_KEY, JSON.stringify(reports)) } catch { /* quota */ }
}

/** Upload a report photo to Supabase Storage. Returns public URL. */
export async function uploadReportPhoto(file: File): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未配置')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `reports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('report-photos')
    .upload(path, file, { cacheControl: '31536000', upsert: true, contentType: file.type })
  if (error) throw new Error(`图片上传失败: ${error.message}`)
  const { data } = supabase.storage.from('report-photos').getPublicUrl(path)
  return data.publicUrl
}

/** Submit a new community report — local storage */
export async function submitReport(report: Omit<CommunityReport, 'id' | 'createdAt' | 'status'>): Promise<CommunityReport> {
  const full: CommunityReport = {
    ...report,
    id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  const existing = getLocalReports()
  existing.unshift(full)
  saveLocalReports(existing)
  return full
}

/** Admin: update report status */
export async function updateReportStatus(
  reportId: string,
  status: CommunityReport['status'],
  adminNote?: string,
): Promise<void> {
  const reports = getLocalReports()
  const idx = reports.findIndex(r => r.id === reportId)
  if (idx >= 0) {
    reports[idx] = { ...reports[idx], status, adminNote }
    saveLocalReports(reports)
  }
}

/** Admin: delete a report */
export async function deleteReport(reportId: string): Promise<void> {
  const reports = getLocalReports().filter(r => r.id !== reportId)
  saveLocalReports(reports)
}

/** Backward-compat: kept for existing code, returns local reports only */
export function getCommunityReports(_modelId: string): CommunityReport[] {
  return getLocalReports()
}

export function saveCommunityReports(_modelId: string, reports: CommunityReport[]): void {
  saveLocalReports(reports)
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
