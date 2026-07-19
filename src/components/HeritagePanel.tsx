import { useState } from 'react'
import type { ModelMeta } from '../types'
import { PROTECTION_LEVEL_LABELS, CONSERVATION_STATUS_LABELS } from '../types'

interface Props {
  model: ModelMeta | null
  isOpen: boolean
  onClose: () => void
}

export default function HeritagePanel({ model, isOpen, onClose }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  if (!model) return null

  const toggle = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="absolute inset-0 z-20" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className="absolute top-0 bottom-0 right-0 z-30 w-[360px] max-w-[88vw] overflow-y-auto transition-transform duration-400 ease-out"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(124,111,240,0.08)',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.06)',
        }}
      >
        <div className="p-6">
          {/* Close button */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-display font-semibold text-text-1 tracking-[0.04em]">
              建筑档案
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3/50 hover:text-text-1 hover:bg-surface-1 bg-transparent border-none cursor-pointer transition-colors"
              style={{ cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Name + basic info */}
          <h3 className="text-[20px] font-display font-semibold text-text-1 mb-1">{model.name}</h3>
          {model.constructionYear && (
            <p className="text-[13px] text-text-3/60 mb-2">{model.constructionYear}</p>
          )}
          {model.location?.address && (
            <p className="text-[12px] text-text-3/50 mb-4">📍 {model.location.address}</p>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {model.protectionLevel && model.protectionLevel !== 'none' && (
              <span className="px-3 py-1 rounded-md text-[11px] font-semibold tracking-[0.03em]"
                style={{ background: 'rgba(124,111,240,0.1)', color: '#7C6FF0' }}>
                {PROTECTION_LEVEL_LABELS[model.protectionLevel]}
              </span>
            )}
            {model.conservationStatus && (
              <span className="px-3 py-1 rounded-md text-[11px] font-medium tracking-[0.03em]"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.06)' }}>
                {CONSERVATION_STATUS_LABELS[model.conservationStatus]}
              </span>
            )}
            {model.architecturalStyle && (
              <span className="px-3 py-1 rounded-md text-[11px] font-medium text-text-3/60"
                style={{ background: 'rgba(0,0,0,0.03)' }}>
                {model.architecturalStyle}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-[13px] text-text-2/70 leading-relaxed mb-6">{model.description}</p>

          {/* File info */}
          <div className="flex items-center gap-4 text-[10px] text-text-3/40 font-mono mb-8">
            {model.pointCount && <span>{model.pointCount} 点</span>}
            {model.size && <span>{model.size}</span>}
          </div>

          {/* Expandable sections */}
          <div className="space-y-1">
            {/* Historical Photos */}
            <SectionButton
              label="历史影像"
              count={(model.historicalPhotos || []).length}
              isOpen={expandedSection === 'photos'}
              onClick={() => toggle('photos')}
            />
            {expandedSection === 'photos' && (
              <div className="px-3 pb-4 space-y-3">
                {(model.historicalPhotos || []).map(photo => (
                  <div key={photo.id} className="rounded-xl overflow-hidden bg-surface-1 border border-border-1">
                    {photo.url ? (
                      <img src={photo.url} alt={photo.caption} className="w-full aspect-[4/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-surface-2 flex items-center justify-center text-text-3/20 text-[11px]">
                        暂无影像
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-[11px] font-medium text-text-2">{photo.year}</p>
                      <p className="text-[11px] text-text-3/50 mt-0.5">{photo.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Documents */}
            <SectionButton
              label="文史档案"
              count={(model.documents || []).length}
              isOpen={expandedSection === 'documents'}
              onClick={() => toggle('documents')}
            />
            {expandedSection === 'documents' && (
              <div className="px-3 pb-4 space-y-2">
                {(model.documents || []).map(doc => (
                  <div key={doc.id} className="p-3 rounded-xl bg-surface-1">
                    <p className="text-[12px] font-medium text-text-1 mb-1">{doc.title}</p>
                    <p className="text-[11px] text-text-3/50 leading-relaxed">{doc.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Repair Records */}
            <SectionButton
              label="修缮记录"
              count={(model.repairRecords || []).length}
              isOpen={expandedSection === 'repairs'}
              onClick={() => toggle('repairs')}
            />
            {expandedSection === 'repairs' && (
              <div className="px-3 pb-4 space-y-2">
                {(model.repairRecords || []).map(rec => (
                  <div key={rec.id} className="p-3 rounded-xl bg-surface-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-medium text-text-1">{rec.date}</p>
                    </div>
                    <p className="text-[11px] text-text-3/50 leading-relaxed">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

function SectionButton({ label, count, isOpen, onClick }: {
  label: string; count: number; isOpen: boolean; onClick: () => void
}) {
  if (count === 0) return null
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-left bg-transparent border-none cursor-pointer hover:bg-surface-1 transition-colors"
      style={{ cursor: 'pointer' }}
    >
      <span className="text-[13px] font-medium text-text-2">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-3/40">{count}</span>
        <svg
          className={`w-4 h-4 text-text-3/30 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </button>
  )
}
