import { supabase, isSupabaseConfigured } from './supabase'
import type { ModelMeta, Hotspot, CameraPath, Vector3Like, HistoricalPhoto, ArchiveDocument, RepairRecord, CommunityReport, RedCultureMark, TourRoute } from './types'
import { STORAGE_KEY_HOTSPOTS, STORAGE_KEY_CAMERA_PATHS, STORAGE_KEY_CUSTOM_MODELS, STORAGE_KEY_INITIAL_CAMERA, STORAGE_KEY_THUMBNAILS, STORAGE_KEY_HERITAGE_META, STORAGE_KEY_COMMUNITY_REPORTS, STORAGE_KEY_PENDING_MODELS, STORAGE_KEY_REJECTED_MODELS, applyHeritageDefaults, generateTrackingCode } from './types'

// ── Helpers ──

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function warn(msg: string, err?: unknown) {
  console.warn(`[store] ${msg}`, err ?? '')
}

/** Race a promise against a timeout — returns null if it takes too long. Accepts any thenable (including Supabase builders). */
async function withTimeout<T>(thenable: any, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms) })
  try {
    const result = await Promise.race([Promise.resolve(thenable), timeout])
    clearTimeout(timer!)
    return result as T | null
  } catch {
    clearTimeout(timer!)
    return null
  }
}

/** Supabase query timeout — short for reads (pages must load fast), longer for writes */
const SUPABASE_READ_TIMEOUT = 3000
const SUPABASE_WRITE_TIMEOUT = 8000

// ── Supabase row ↔ ModelMeta mappers ──

function mapModelFromDB(db: any): ModelMeta {
  return {
    id: db.id,
    name: db.name,
    description: db.description ?? '',
    file: db.file,
    thumbnail: db.thumbnail ?? '',
    tags: db.tags ?? [],
    pointCount: db.point_count ?? '',
    size: db.size ?? '',
    featured: db.featured ?? false,
    hotspots: [],
    status: db.status ?? 'approved',
    reporterName: db.reporter_name ?? undefined,
    reporterContact: db.reporter_contact ?? undefined,
    trackingCode: db.tracking_code ?? undefined,
    reviewNote: db.review_note ?? undefined,
    reviewedAt: db.reviewed_at ?? undefined,
    protectionLevel: db.protection_level ?? undefined,
    constructionYear: db.construction_year ?? undefined,
    architecturalStyle: db.architectural_style ?? undefined,
    conservationStatus: db.conservation_status ?? undefined,
    location: db.location ?? undefined,
  }
}

function mapModelToDB(m: ModelMeta): Record<string, unknown> {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    file: m.file,
    thumbnail: m.thumbnail || null,
    tags: m.tags ?? [],
    point_count: m.pointCount || null,
    size: m.size || null,
    featured: m.featured ?? false,
    status: m.status ?? 'approved',
    tracking_code: m.trackingCode ?? null,
    reporter_name: m.reporterName ?? null,
    reporter_contact: m.reporterContact ?? null,
    review_note: m.reviewNote ?? null,
    reviewed_at: m.reviewedAt ?? null,
    protection_level: m.protectionLevel ?? null,
    construction_year: m.constructionYear ?? null,
    architectural_style: m.architecturalStyle ?? null,
    conservation_status: m.conservationStatus ?? 'good',
    location: m.location ? JSON.stringify(m.location) : null,
  }
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

  // 1. Fetch approved models from Supabase (with timeout — don't block page load)
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('models').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error && (result as any).data) {
        for (const db of (result as any).data as any[]) {
          const m = mapModelFromDB(db)
          if (seen.has(m.id)) continue
          if (!m.file || m.file.trim() === '') continue
          seen.add(m.id)
          all.push(m)
        }
      }
    } catch (e) { warn('Supabase 模型加载失败，使用本地缓存', e) }
  }

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

export async function saveModel(model: Omit<ModelMeta, 'id'> & { id?: string }): Promise<{ id: string; trackingCode: string }> {
  const id = model.id || uid()
  const trackingCode = generateTrackingCode()
  const full: ModelMeta = { ...model, id, status: 'pending', trackingCode, hotspots: (model as any).hotspots ?? [] }

  // Save to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const row = mapModelToDB(full)
      const result = await withTimeout(
        supabase.from('models').upsert(row, { onConflict: 'id' }),
        SUPABASE_WRITE_TIMEOUT,
      )
      if (result && !(result as any).error) return { id, trackingCode }
      if (result) warn('Supabase 保存失败，降级到本地', (result as any).error)
    } catch (e) { warn('Supabase 保存异常', e) }
  }

  // localStorage fallback
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODELS)
    const models: ModelMeta[] = raw ? JSON.parse(raw) : []
    localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(models.filter(x => x.id !== id)))
  } catch { /* localStorage not available */ }
}

// ── Pending model review ──

export async function getPendingModels(): Promise<ModelMeta[]> {
  // Supabase first (with timeout)
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('models').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error && (result as any).data) {
        const cloud = ((result as any).data as any[]).map(mapModelFromDB)
        const seen = new Set(cloud.map(m => m.id))
        try {
          const raw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
          if (raw) {
            const local: ModelMeta[] = JSON.parse(raw)
            for (const m of local) {
              if (!seen.has(m.id)) { seen.add(m.id); cloud.push(m) }
            }
          }
        } catch { /* ignore */ }
        const overrides = getThumbnailOverrides()
        for (const m of cloud) {
          if (overrides[m.id]) m.thumbnail = overrides[m.id]
        }
        return cloud
      }
    } catch (e) { warn('Supabase 待审核查询失败', e) }
  }

  // localStorage fallback
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

  // Supabase: update status
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('models').update({ status: 'approved', review_note: '', reviewed_at: now }).eq('id', id),
        SUPABASE_WRITE_TIMEOUT,
      )
      if (result && !(result as any).error) {
        // Also clean up localStorage copies
        try {
          const pendingRaw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
          if (pendingRaw) {
            const pending: ModelMeta[] = JSON.parse(pendingRaw)
            localStorage.setItem(STORAGE_KEY_PENDING_MODELS, JSON.stringify(pending.filter(m => m.id !== id)))
          }
        } catch { /* ignore */ }
        builtinCache = null
        return
      }
      warn('Supabase 审核失败，降级到本地', (result as any)?.error)
    } catch (e) { warn('Supabase 审核异常', e) }
  }

  // localStorage fallback — same as above but fall through from Supabase timeout/error
  {
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
}

export async function rejectModel(id: string, reason?: string): Promise<void> {
  const now = new Date().toISOString()

  // Supabase: update status
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('models').update({ status: 'rejected', review_note: reason || '', reviewed_at: now }).eq('id', id),
        SUPABASE_WRITE_TIMEOUT,
      )
      if (result && !(result as any).error) {
        // Clean up localStorage pending
        try {
          const pendingRaw = localStorage.getItem(STORAGE_KEY_PENDING_MODELS)
          if (pendingRaw) {
            const pending: ModelMeta[] = JSON.parse(pendingRaw)
            localStorage.setItem(STORAGE_KEY_PENDING_MODELS, JSON.stringify(pending.filter(m => m.id !== id)))
          }
        } catch { /* ignore */ }
        return
      }
      warn('Supabase 拒绝操作失败，降级到本地', (result as any)?.error)
    } catch (e) { warn('Supabase 拒绝操作异常', e) }
  }

  // localStorage fallback
  {
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
}

export async function getRejectedModels(): Promise<ModelMeta[]> {
  // Supabase first (with timeout)
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('models').select('*').eq('status', 'rejected').order('reviewed_at', { ascending: false }),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error && (result as any).data) {
        const cloud = ((result as any).data as any[]).map(mapModelFromDB)
        const seen = new Set(cloud.map(m => m.id))
        try {
          const raw = localStorage.getItem(STORAGE_KEY_REJECTED_MODELS)
          if (raw) {
            const local: ModelMeta[] = JSON.parse(raw)
            for (const m of local) {
              if (!seen.has(m.id)) { seen.add(m.id); cloud.push(m) }
            }
          }
        } catch { /* ignore */ }
        return cloud
      }
    } catch (e) { warn('Supabase 已拒绝查询失败', e) }
  }

  // localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REJECTED_MODELS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** Admin direct add — skips review queue, model is immediately approved */
export async function saveModelDirect(model: Omit<ModelMeta, 'id'> & { id?: string }): Promise<{ id: string }> {
  const id = model.id || uid()
  const full: ModelMeta = { ...model, id, status: 'approved', hotspots: (model as any).hotspots ?? [] }

  if (isSupabaseConfigured()) {
    try {
      const row = mapModelToDB(full)
      const result = await withTimeout(
        supabase.from('models').upsert(row, { onConflict: 'id' }),
        SUPABASE_WRITE_TIMEOUT,
      )
      if (result && !(result as any).error) {
        builtinCache = null
        return { id }
      }
      warn('Supabase 直接保存失败，降级到本地', (result as any)?.error)
    } catch (e) { warn('Supabase 直接保存异常', e) }
  }

  // localStorage fallback
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
  // Supabase first (with timeout)
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('models').select('*').eq('tracking_code', code).maybeSingle(),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error && (result as any).data) return mapModelFromDB((result as any).data)
    } catch (e) { warn('Supabase 追踪码查询失败', e) }
  }

  // localStorage fallback: search all storage keys
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
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('hotspots').select('*').eq('model_id', modelId).order('sort_order', { ascending: true }),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error) {
        return (((result as any).data ?? []) as any[]).map((db: any) => ({
          id: db.id,
          position: { x: db.position_x, y: db.position_y, z: db.position_z },
          title: db.title, description: db.description, note: db.note ?? '',
          order: db.sort_order,
          cameraPosition: { x: db.camera_pos_x, y: db.camera_pos_y, z: db.camera_pos_z },
          cameraTarget: { x: db.camera_tgt_x, y: db.camera_tgt_y, z: db.camera_tgt_z },
        }))
      }
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
      const result = await withTimeout(
        supabase.from('camera_paths').select('*').eq('model_id', modelId).order('created_at', { ascending: true }),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error && ((result as any).data as any[])?.length) {
        const paths = (result as any).data as any[]
        const pathIds = paths.map((p: any) => p.id)
        const kfResult = await withTimeout(
          supabase.from('keyframes').select('*').in('path_id', pathIds).order('sort_order', { ascending: true }),
          SUPABASE_READ_TIMEOUT,
        )
        const kfMap = new Map<string, any[]>()
        if (kfResult && !(kfResult as any).error) {
          for (const kf of ((kfResult as any).data ?? []) as any[]) {
            const arr = kfMap.get(kf.path_id) ?? []; arr.push(kf); kfMap.set(kf.path_id, arr)
          }
        }
        return paths.map((p: any) => ({
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

const REPORTS_KEY = STORAGE_KEY_COMMUNITY_REPORTS + '_global'

/** Get all community reports — Supabase first, localStorage fallback */
export async function getAllReports(): Promise<CommunityReport[]> {
  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('community_reports').select('*').order('created_at', { ascending: false }),
        SUPABASE_READ_TIMEOUT,
      )
      if (result && !(result as any).error && (result as any).data) {
        return ((result as any).data as any[]).map(mapReportFromDB)
      }
    } catch (e) { warn('云端上报加载失败，使用本地缓存', e) }
  }
  // localStorage fallback
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

/** Submit a new community report — Supabase first, localStorage fallback */
export async function submitReport(report: Omit<CommunityReport, 'id' | 'createdAt' | 'status'>): Promise<CommunityReport> {
  const full: CommunityReport = {
    ...report,
    id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  if (isSupabaseConfigured()) {
    try {
      const result = await withTimeout(
        supabase.from('community_reports').insert(mapReportToDB(full)),
        SUPABASE_WRITE_TIMEOUT,
      )
      if (result && !(result as any).error) return full
      if (result) warn('云端上报提交失败，保存到本地', (result as any).error)
    } catch (e) {
      warn('云端上报提交失败，保存到本地', e)
    }
  }

  // localStorage fallback
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
  if (isSupabaseConfigured()) {
    try {
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
      if (adminNote !== undefined) update.admin_note = adminNote
      const { error } = await supabase.from('community_reports').update(update).eq('id', reportId)
      if (error) throw error
      return
    } catch (e) { warn('云端状态更新失败，更新本地', e) }
  }
  // localStorage fallback
  const reports = getLocalReports()
  const idx = reports.findIndex(r => r.id === reportId)
  if (idx >= 0) {
    reports[idx] = { ...reports[idx], status }
    saveLocalReports(reports)
  }
}

/** Admin: delete a report */
export async function deleteReport(reportId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('community_reports').delete().eq('id', reportId)
      if (error) throw error
      return
    } catch (e) { warn('云端删除失败，删除本地', e) }
  }
  const reports = getLocalReports().filter(r => r.id !== reportId)
  saveLocalReports(reports)
}

/** Map Supabase DB row → CommunityReport */
function mapReportFromDB(db: any): CommunityReport {
  return {
    id: db.id,
    title: db.title,
    description: db.description,
    category: db.category,
    reporter: db.reporter ?? '匿名用户',
    reporterEmail: db.reporter_email,
    photos: Array.isArray(db.photos) ? db.photos : [],
    status: db.status ?? 'pending',
    adminNote: db.admin_note,
    createdAt: db.created_at ? db.created_at.slice(0, 10) : '',
    modelId: db.model_id,
  }
}

/** Map CommunityReport → Supabase DB row */
function mapReportToDB(r: CommunityReport): Record<string, unknown> {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    reporter: r.reporter,
    reporter_email: (r as any).reporterEmail ?? null,
    photos: r.photos,
    status: r.status,
    model_id: (r as any).modelId ?? null,
    created_at: r.createdAt,
  }
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
