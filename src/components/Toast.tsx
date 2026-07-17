import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
}

interface ToastCtxValue {
  addToast: (message: string, type?: Toast['type']) => void
}

const Ctx = createContext<ToastCtxValue>(null!)

let nextId = 0

export function useToast() {
  return useContext(Ctx)
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-scale-in"
            style={{
              background: toast.type === 'error' ? 'rgba(201,79,42,0.95)' :
                          toast.type === 'success' ? 'rgba(141,163,145,0.95)' :
                          'rgba(51,46,42,0.9)',
              color: '#F8F5F0',
              padding: '10px 20px',
              borderRadius: '0.75rem',
              fontSize: '13px',
              fontWeight: 500,
              backdropFilter: 'blur(12px)',
              maxWidth: '360px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
