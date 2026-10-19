// TEMPO – App root
// Layout: TOP | [ LEFT | CENTER | RIGHT ] | BOTTOM | FOOTER
import { useEffect, Suspense, lazy } from 'react'
import { useStore } from './store/useStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import TopStrip           from './components/TopStrip'
import LeftPanel          from './components/LeftPanel'
import RightPanel         from './components/RightPanel'
import GanttTimeline      from './components/GanttTimeline'
import PrioritySlider     from './components/PrioritySlider'
import NLCommandBar       from './components/NLCommandBar'
import Footer             from './components/Footer'
import RecomputingOverlay from './components/RecomputingOverlay'

// Lazy-load Leaflet map to avoid SSR issues
const TacticalMap = lazy(() => import('./components/TacticalMap'))

export default function App() {
  const initApp    = useStore(s => s.initApp)
  const showNLBar  = useStore(s => s.showNLBar)

  useKeyboardShortcuts()

  useEffect(() => {
    initApp().catch(() => {})
  }, [])

  return (
    <div
      className="flex flex-col"
      style={{ width:'100vw', height:'100vh', overflow:'hidden', background:'#0f1316' }}
    >
      {/* TOP STRIP */}
      <TopStrip />

      {/* CENTER ROW – left | map+gantt | right */}
      <div className="flex flex-1 min-h-0">
        <LeftPanel />

        {/* Map + controls column */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">

          {/* Tactical map fills remaining space */}
          <div className="flex-1 relative min-h-0">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full"
                   style={{ color:'#57606a', fontSize:11, fontFamily:'IBM Plex Mono,monospace' }}>
                LOADING MAP...
              </div>
            }>
              <TacticalMap />
            </Suspense>
            <RecomputingOverlay />
          </div>

          {/* Priority ↔ Risk slider */}
          <PrioritySlider />

          {/* NL command bar slides up from bottom when active */}
          {showNLBar && <NLCommandBar />}

          {/* Gantt timeline – taller for readability */}
          <div style={{ height: 260, borderTop: '1px solid #2a3238', overflow: 'hidden' }}>
            <GanttTimeline />
          </div>
        </div>

        <RightPanel />
      </div>

      <Footer />
    </div>
  )
}
