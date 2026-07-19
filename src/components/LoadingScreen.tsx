interface Props {
  progress: number
  modelName?: string
}

export default function LoadingScreen({ progress, modelName }: Props) {
  const stage = progress <= 0 ? 0 : progress < 10 ? 1 : progress < 50 ? 2 : progress < 90 ? 3 : 4

  const stages = [
    { label: '正在查找模型', icon: '🔍' },
    { label: '正在连接服务器', icon: '🌐' },
    { label: '正在下载场景数据', icon: '📥' },
    { label: '正在解析点云数据', icon: '⚙️' },
    { label: '即将完成', icon: '✨' },
  ]

  const statusText = stages[stage].label
  const icon = stages[stage].icon

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
      <div className="text-center space-y-5 px-6 max-w-sm">
        {/* Model name */}
        {modelName && (
          <p className="text-white/60 text-[15px] font-display tracking-[0.04em]" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {modelName}
          </p>
        )}

        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.04]" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-1 animate-spin"
            style={{ opacity: progress < 90 ? 1 : 0.3 }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xl">
            {icon}
          </div>
        </div>

        {/* Text */}
        <p className="text-white/30 text-[13px] font-medium tracking-[0.03em]">{statusText}</p>

        {/* Progress bar */}
        <div className="w-56 h-[3px] rounded-full bg-white/[0.04] overflow-hidden mx-auto">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: 'linear-gradient(90deg, #7C6FF0, #00C2D9)',
            }}
          />
        </div>

        {/* Stage dots */}
        <div className="flex items-center justify-center gap-2">
          {stages.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === stage
                  ? 'bg-accent-1 scale-125'
                  : i < stage
                  ? 'bg-accent-1/40'
                  : 'bg-white/[0.06]'
              }`}
            />
          ))}
        </div>

        {/* Percentage */}
        <p className="text-white/15 text-[10px] font-mono">
          {progress > 0 ? `${Math.round(progress)}%` : '—'}
        </p>
      </div>
    </div>
  )
}
