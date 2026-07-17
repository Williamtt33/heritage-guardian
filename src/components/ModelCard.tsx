import { useMemo } from 'react'
import type { ModelMeta, ConservationStatus, ProtectionLevel } from '../types'
import { PROTECTION_LEVEL_LABELS, CONSERVATION_STATUS_LABELS } from '../types'
import { usePage } from '../App'

function gradientFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  const hue1 = (hash % 60) + 240
  const hue2 = (hash % 40) + 180
  return `linear-gradient(135deg, hsl(${hue1}, 40%, 85%) 0%, hsl(${hue2}, 35%, 80%) 100%)`
}

const STATUS_DOT_COLORS: Record<ConservationStatus, string> = {
  excellent: '#4CAF50',
  good: '#8BC34A',
  needs_repair: '#FF9800',
  critical: '#F44336',
}

const PROTECTION_BADGE_COLORS: Record<ProtectionLevel, { bg: string; text: string }> = {
  national: { bg: 'rgba(198,40,40,0.1)', text: '#C62828' },
  provincial: { bg: 'rgba(255,152,0,0.1)', text: '#E65100' },
  city: { bg: 'rgba(124,111,240,0.1)', text: '#7C6FF0' },
  district: { bg: 'rgba(0,194,217,0.1)', text: '#00838F' },
  none: { bg: 'rgba(123,127,150,0.08)', text: '#7B7F96' },
}

export default function ModelCard({ model, index }: { model: ModelMeta; index: number }) {
  const { go } = usePage()
  const placeholderGradient = useMemo(() => gradientFromId(model.id), [model.id])
  const statusColor = model.conservationStatus ? STATUS_DOT_COLORS[model.conservationStatus] : undefined
  const protectionBadge = model.protectionLevel ? PROTECTION_BADGE_COLORS[model.protectionLevel] : undefined

  return (
    <button
      onClick={() => go({ route: 'viewer', modelId: model.id })}
      className="group ink-card rounded-2xl overflow-hidden text-left w-full border-none cursor-pointer"
      style={{
        animation: `fade-up 0.55s ease-out ${index * 0.08}s both`,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-surface-2 overflow-hidden">
        {model.thumbnail ? (
          <img
            src={model.thumbnail}
            alt={model.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center relative"
            style={{ background: placeholderGradient }}
          >
            <div className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'repeating-linear-gradient(60deg, rgba(124,111,240,0.3) 0px, transparent 1px, transparent 20px, rgba(124,111,240,0.3) 21px), repeating-linear-gradient(-60deg, rgba(0,194,217,0.3) 0px, transparent 1px, transparent 20px, rgba(0,194,217,0.3) 21px)',
              }}
            />
            <svg className="w-12 h-12 text-text-3/10 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L3 12L12 22L21 12Z" />
              <path d="M12 2L12 22" />
              <path d="M3 12L21 12" />
            </svg>
          </div>
        )}
        {/* Protection level badge (top-left) */}
        {protectionBadge && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-[0.04em]"
            style={{ background: protectionBadge.bg, color: protectionBadge.text }}>
            {PROTECTION_LEVEL_LABELS[model.protectionLevel!]}
          </div>
        )}
        {/* Status dot (top-right) */}
        {statusColor && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium tracking-[0.03em]"
            style={{ background: 'rgba(255,255,255,0.85)', color: statusColor }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
            {CONSERVATION_STATUS_LABELS[model.conservationStatus!]}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.03] transition-colors duration-500 flex items-center justify-center">
          <span className="text-[11px] font-medium tracking-[0.06em] text-text-1/0 group-hover:text-text-1/50 transition-all duration-500 bg-white/0 group-hover:bg-white/80 px-4 py-1.5 rounded-full">
            探索场景 →
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-text-1 mb-1.5 group-hover:text-accent-1/80 transition-colors">
          {model.name}
        </h3>
        {model.description && (
          <p className="text-[12px] text-text-3/60 leading-relaxed line-clamp-2 mb-2">
            {model.description}
          </p>
        )}
        {/* Heritage meta line */}
        {(model.constructionYear || model.location?.district) && (
          <p className="text-[10px] text-text-3/40 mb-2 tracking-[0.02em]">
            {model.constructionYear && <span>{model.constructionYear}</span>}
            {model.constructionYear && model.location?.district && <span className="mx-1.5">·</span>}
            {model.location?.district && <span>{model.location.district}</span>}
          </p>
        )}
        <div className="flex items-center gap-4">
          {model.pointCount && (
            <span className="text-[10px] text-text-3/40 font-mono">{model.pointCount} 点</span>
          )}
          {model.size && (
            <span className="text-[10px] text-text-3/40 font-mono">{model.size}</span>
          )}
        </div>
        {/* Tags */}
        {model.tags && model.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {model.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 rounded-md text-[9px] font-medium tracking-[0.03em]"
                style={{ background: 'rgba(124,111,240,0.07)', color: '#7C6FF0' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
