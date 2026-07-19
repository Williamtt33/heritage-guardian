import { useState, useCallback, createContext, useContext, useEffect } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './components/Home'
import Archive from './components/Archive'
import HeritageMap from './components/HeritageMap'
import Community from './components/Community'
import About from './components/About'
import Admin from './components/Admin'
import ViewerPage from './components/ViewerPage'
import LocalViewerPage from './components/LocalViewerPage'
import ToastProvider from './components/Toast'

// ── Page State Machine ──

export type Page =
  | { route: 'home' }
  | { route: 'archive' }
  | { route: 'heritage-map' }
  | { route: 'community' }
  | { route: 'about' }
  | { route: 'viewer'; modelId: string; edit?: boolean }
  | { route: 'localViewer' }
  | { route: 'admin' }

// Module-level storage for local file data
let localFileBuffer: ArrayBuffer | null = null
let localFileName = ''

export function setLocalFile(buffer: ArrayBuffer, name: string) {
  localFileBuffer = buffer
  localFileName = name
}

export function getLocalFile(): { buffer: ArrayBuffer; name: string } | null {
  if (!localFileBuffer) return null
  return { buffer: localFileBuffer!, name: localFileName }
}

interface PageCtxValue {
  page: Page
  go: (p: Page) => void
  back: () => void
}

const PageCtx = createContext<PageCtxValue>(null!)

export function usePage() {
  return useContext(PageCtx)
}

function pageFromHash(): Page {
  const hash = window.location.hash.replace('#', '')
  if (hash === '/archive' || hash === '/gallery') return { route: 'archive' }
  if (hash === '/heritage-map') return { route: 'heritage-map' }
  if (hash === '/community') return { route: 'community' }
  if (hash === '/about') return { route: 'about' }
  if (hash === '/local-viewer') return { route: 'localViewer' }
  if (hash.startsWith('/viewer/')) {
    const parts = hash.split('/')
    return { route: 'viewer', modelId: parts[2], edit: parts[3] === 'edit' }
  }
  if (hash === '/admin') return { route: 'admin' }
  return { route: 'home' }
}

function pageToHash(p: Page): string {
  switch (p.route) {
    case 'archive': return '/archive'
    case 'heritage-map': return '/heritage-map'
    case 'community': return '/community'
    case 'about': return '/about'
    case 'viewer': return `/viewer/${p.modelId}${p.edit ? '/edit' : ''}`
    case 'localViewer': return '/local-viewer'
    case 'admin': return '/admin'
    default: return ''
  }
}

export default function App() {
  const [history, setHistory] = useState<Page[]>(() => [pageFromHash()])

  const page = history[history.length - 1]

  const go = useCallback((p: Page) => {
    setHistory(prev => [...prev, p])
    window.location.hash = pageToHash(p)
  }, [])

  const back = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) return prev
      const next = prev.slice(0, -1)
      window.location.hash = pageToHash(next[next.length - 1])
      return next
    })
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const p = pageFromHash()
      setHistory([p])
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page.route, (page as any).modelId])

  const isViewer = page.route === 'viewer'

  return (
    <PageCtx.Provider value={{ page, go, back }}>
      <ToastProvider>
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
          {!isViewer && <Navbar />}
          <div style={{ flex: 1, paddingTop: isViewer ? 0 : 90 }}>
            <PageRenderer page={page} />
          </div>
          {!isViewer && <Footer />}
        </div>
      </ToastProvider>
    </PageCtx.Provider>
  )
}

function PageRenderer({ page }: { page: Page }) {
  switch (page.route) {
    case 'home': return <Home />
    case 'archive': return <Archive />
    case 'heritage-map': return <HeritageMap />
    case 'community': return <Community />
    case 'about': return <About />
    case 'viewer': return <ViewerPage modelId={page.modelId} edit={page.edit} />
    case 'localViewer': return <LocalViewerPage />
    case 'admin': return <Admin />
  }
}
