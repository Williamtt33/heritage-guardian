interface Props {
  isVisible: boolean
  onClose: () => void
  showPerf: boolean
  onTogglePerf: () => void
}

export default function ControlsHelp({ isVisible, onClose, showPerf, onTogglePerf }: Props) {
  if (!isVisible) return null

  const shortcuts = [
    { key: '鼠标拖拽', desc: '旋转视角' },
    { key: '滚轮', desc: '缩放远近' },
    { key: '右键拖拽', desc: '平移视野' },
    { key: 'W A S D', desc: '飞行移动' },
    { key: 'Q / E', desc: '下降 / 上升' },
    { key: 'Shift', desc: '加速飞行' },
    { key: 'R', desc: '重置视角' },
    { key: '← →', desc: '切换标注点' },
    { key: 'H', desc: '显示/隐藏帮助' },
  ]

  return (
    <div className="absolute bottom-16 left-4 z-10 animate-fade-in">
      <div className="glass rounded-xl p-4 space-y-3 min-w-[240px]">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-white/70 tracking-wider">操作帮助</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 bg-transparent border-none cursor-pointer text-xs">✕</button>
        </div>
        <div className="space-y-1.5">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <kbd className="text-white/50 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{s.key}</kbd>
              <span className="text-white/30">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={onTogglePerf}
            className="text-[10px] text-white/25 hover:text-white/40 bg-transparent border-none cursor-pointer transition-colors"
            style={{ cursor: 'pointer' }}
          >
            {showPerf ? '隐藏' : '显示'}性能面板
          </button>
        </div>
      </div>
    </div>
  )
}
