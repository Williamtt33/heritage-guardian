interface Props {
  progress: number
}

export default function LoadingScreen({ progress }: Props) {
  const statusText =
    progress <= 0 ? '正在查找模型...' :
    progress < 10 ? '正在连接...' :
    progress < 50 ? '正在下载场景文件...' :
    progress < 90 ? '正在解析数据...' :
    '即将完成...'

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
      <div className="text-center space-y-4 px-6">
        <div className="w-12 h-12 border-2 border-white/[0.06] border-t-accent-1 rounded-full animate-spin mx-auto" />
        <p className="text-white/30 text-sm font-medium">{statusText}</p>
        <div className="w-48 h-1 rounded-full bg-white/[0.04] overflow-hidden mx-auto">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-1 to-accent-2 transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <p className="text-white/20 text-[10px] font-mono">
          {progress > 0 ? `${Math.round(progress)}%` : '—'}
        </p>
      </div>
    </div>
  )
}
