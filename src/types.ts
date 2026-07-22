export interface Vector3Like {
  x: number
  y: number
  z: number
}

export interface Hotspot {
  id: string
  position: Vector3Like
  title: string
  description: string
  note: string
  order: number
  cameraPosition: Vector3Like
  cameraTarget: Vector3Like
  /** 标注类型：info=信息点, damage=破损标记, red_culture=红色文化点 */
  type?: 'info' | 'damage' | 'red_culture'
}

// ── Heritage extension types ──

export type ProtectionLevel = 'national' | 'provincial' | 'city' | 'district' | 'none'

export type ConservationStatus = 'excellent' | 'good' | 'needs_repair' | 'critical'

export type ModelStatus = 'pending' | 'approved' | 'rejected'

export interface SiteLocation {
  address: string
  district: string
  lat: number
  lng: number
}

export interface HistoricalPhoto {
  id: string
  url: string
  year: string
  caption: string
}

export interface ArchiveDocument {
  id: string
  title: string
  type: 'history' | 'architecture' | 'culture' | 'party_history' | 'other'
  description: string
  url?: string
}

export interface RepairRecord {
  id: string
  date: string
  description: string
  photos: string[]
}

export interface CommunityReport {
  id: string
  title: string
  description: string
  category: 'damage' | 'suggestion' | 'memory' | 'other'
  position?: Vector3Like
  photos: string[]
  status: 'pending' | 'reviewed' | 'resolved'
  createdAt: string
  reporter: string
  reporterEmail?: string
  modelId?: string
  adminNote?: string
}

export interface RedCultureMark {
  id: string
  title: string
  description: string
  period: string
  hotspotId?: string
}

export interface TourRoute {
  id: string
  name: string
  description?: string
  category: 'general' | 'red_culture' | 'architecture'
  /** Voice narration audio URL */
  narrationUrl?: string
  /** Estimated duration string, e.g. "约5分钟" */
  duration?: string
  keyframes: Keyframe[]
}

// ── Core model (extended with optional heritage fields) ──

export interface ModelMeta {
  id: string
  name: string
  description: string
  file: string
  thumbnail: string
  tags: string[]
  pointCount: string
  size: string
  featured: boolean
  hotspots: Hotspot[]
  status?: ModelStatus
  /** Uploader info — set when a user uploads a model for review */
  reporterName?: string
  reporterContact?: string
  trackingCode?: string
  /** Admin review note (e.g. rejection reason) */
  reviewNote?: string
  reviewedAt?: string
  initialCameraPosition?: Vector3Like
  initialCameraTarget?: Vector3Like

  // Heritage extension fields (all optional for backward compat)
  protectionLevel?: ProtectionLevel
  constructionYear?: string
  architecturalStyle?: string
  conservationStatus?: ConservationStatus
  location?: SiteLocation
  historicalPhotos?: HistoricalPhoto[]
  documents?: ArchiveDocument[]
  repairRecords?: RepairRecord[]
  redCultureMarks?: RedCultureMark[]
  tourRoutes?: TourRoute[]
}

export interface Keyframe {
  id: string
  position: Vector3Like
  target: Vector3Like
}

export interface CameraPath {
  id: string
  name: string
  keyframes: Keyframe[]
}

// ── Storage keys ──

export const STORAGE_KEY_HOTSPOTS = 'gs_hotspots_'
export const STORAGE_KEY_CAMERA_PATHS = 'gs_camera_paths_'
export const STORAGE_KEY_CUSTOM_MODELS = 'gs_custom_models'
export const STORAGE_KEY_INITIAL_CAMERA = 'gs_initial_camera_'
export const STORAGE_KEY_THUMBNAILS = 'gs_thumbnails'
export const STORAGE_KEY_HERITAGE_META = 'gs_heritage_meta_'
export const STORAGE_KEY_COMMUNITY_REPORTS = 'gs_community_reports_'
export const STORAGE_KEY_PENDING_MODELS = 'gs_pending_models'
export const STORAGE_KEY_REJECTED_MODELS = 'gs_rejected_models'

/** Generate a short human-readable tracking code for uploaders */
export function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[arr[i] % chars.length]
  return code
}

// ── Defaults ──

/** Apply default values for heritage fields on a model that lacks them */
export function applyHeritageDefaults(m: ModelMeta): ModelMeta {
  return {
    ...m,
    protectionLevel: m.protectionLevel ?? 'none',
    conservationStatus: m.conservationStatus ?? 'good',
    historicalPhotos: m.historicalPhotos ?? [],
    documents: m.documents ?? [],
    repairRecords: m.repairRecords ?? [],
    redCultureMarks: m.redCultureMarks ?? [],
    tourRoutes: m.tourRoutes ?? [],
  }
}

// ── Helper: status display ──

export const CONSERVATION_STATUS_LABELS: Record<ConservationStatus, string> = {
  excellent: '保存完好',
  good: '状况良好',
  needs_repair: '亟需修缮',
  critical: '濒危',
}

export const PROTECTION_LEVEL_LABELS: Record<ProtectionLevel, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  district: '区级',
  none: '未定级',
}

/** Centralized conservation status dot colors — use in all UI components */
export const STATUS_DOT_COLORS: Record<ConservationStatus, string> = {
  excellent: '#4CAF50',
  good: '#8BC34A',
  needs_repair: '#FF9800',
  critical: '#F44336',
}

/** Generate a unique ID (crypto-native with fallback) */
export function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
