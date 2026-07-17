import { useState, useRef, useCallback } from 'react'

interface Props {
  /** Current 3D view screenshot (from canvas.toDataURL) */
  currentImage: string | null
  /** Historical photo to compare against */
  historicalPhoto: {
    url: string
    year: string
    caption: string
  } | null
  /** Left side label (historical) */
  beforeLabel?: string
  /** Right side label (current) */
  afterLabel?: string
  isOpen: boolean
  onClose: () => void
  onCaptureScreenshot?: () => void
}

export default function TimeCompare({
  currentImage,
  historicalPhoto,
  beforeLabel = '历史影像',
  afterLabel = '现状',
  isOpen,
  onClose,
  onCaptureScreenshot,
}: Props) {
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const handleMouseDown = useCallback(() => {
    dragging.current = true
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(5, Math.min(95, (x / rect.width) * 100))
    setSliderPos(pct)
  }, [])

  const handleMouseUp = useCallback(() => {
    dragging.current = false
  }, [])

  // Global mouse events for drag outside the divider
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    handleMouseMove(e)
  }, [handleMouseMove])

  const handleGlobalMouseUp = useCallback(() => {
    handleMouseUp()
  }, [handleMouseUp])

  if (!isOpen) return null

  // Attach global listeners when dragging
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', handleGlobalMouseMove)
    window.removeEventListener('mouseup', handleGlobalMouseUp)
    if (dragging.current) {
      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)
    }
  }

  const hasCurrent = !!currentImage
  const hasHistorical = !!(historicalPhoto?.url)
  const canCompare = hasCurrent && hasHistorical

  return (
    <div className="absolute inset-0 z-25 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium text-white/70 tracking-[0.04em]">⏳ 时光对比</span>
          {!hasCurrent && (
            <button
              onClick={onCaptureScreenshot}
              className="px-3 py-1 rounded-lg text-[11px] font-medium text-white/80 border border-white/20 bg-transparent cursor-pointer hover:bg-white/10 transition-colors"
              style={{ cursor: 'pointer' }}
            >
              截取当前视角
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 bg-transparent border-none cursor-pointer transition-colors"
          style={{ cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Compare area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {canCompare ? (
          <>
            {/* Left (historical) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <img
                src={historicalPhoto!.url}
                alt={historicalPhoto!.caption}
                className="w-full h-full object-contain"
                draggable={false}
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-medium text-white/90 bg-black/50 backdrop-blur-sm">
                {beforeLabel} · {historicalPhoto!.year}
              </div>
            </div>

            {/* Right (current) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            >
              <img
                src={currentImage!}
                alt="Current view"
                className="w-full h-full object-contain"
                draggable={false}
              />
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-medium text-white/90 bg-black/50 backdrop-blur-sm">
                {afterLabel}
              </div>
            </div>

            {/* Divider */}
            <div
              className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-col-resize"
              style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)', cursor: 'col-resize' }}
              onMouseDown={handleMouseDown}
            >
              <div className="w-1 h-full bg-white/80 shadow-lg" />
              <div className="absolute w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-text-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              {!historicalPhoto?.url && (
                <p className="text-white/30 text-sm mb-3">暂无历史影像可供对比</p>
              )}
              {historicalPhoto?.url && !hasCurrent && (
                <div className="space-y-4">
                  <p className="text-white/40 text-sm">点击截图按钮，在左侧显示当前 3D 视角</p>
                  <button
                    onClick={onCaptureScreenshot}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-accent-1/60 hover:bg-accent-1/80 border-none cursor-pointer transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    截取当前视角
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom caption */}
      {historicalPhoto && (
        <div className="px-4 py-2.5 text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <p className="text-[11px] text-white/50">{historicalPhoto.caption}</p>
        </div>
      )}
    </div>
  )
}
