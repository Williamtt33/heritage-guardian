import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-0 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="text-5xl mb-6 opacity-30">—</div>
            <h2 className="text-lg font-semibold text-text-2 mb-2">页面加载出错</h2>
            <p className="text-text-3/50 text-sm max-w-md mx-auto leading-relaxed mb-5">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-2 text-sm hover:bg-white/[0.08] transition-all cursor-pointer"
              style={{ cursor: 'pointer' }}
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
