import { useEffect } from 'react'
import { useStore } from '../store/useStore'

// Global keyboard shortcuts
// I = inject disruption   A = accept diff   R = reject diff
// M = open NL command bar   C = toggle contested mode
// Escape = close modals / NL bar
export function useKeyboardShortcuts() {
  const setShowDisruptModal = useStore(s => s.setShowDisruptModal)
  const acceptDiff          = useStore(s => s.acceptDiff)
  const rejectDiff          = useStore(s => s.rejectDiff)
  const setShowNLBar        = useStore(s => s.setShowNLBar)
  const showNLBar           = useStore(s => s.showNLBar)
  const setActiveRightTab   = useStore(s => s.setActiveRightTab)
  const pendingDiff         = useStore(s => s.pendingDiff)
  const toggleContested     = useStore(s => s.toggleContested)

  // Auto-switch right panel to DIFF when a pending diff arrives
  useEffect(() => {
    if (pendingDiff) setActiveRightTab('diff')
  }, [pendingDiff])

  useEffect(() => {
    function onKey(e) {
      // Don't fire when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      switch (e.key.toLowerCase()) {
        case 'i': setShowDisruptModal(true);            break
        case 'a': if (pendingDiff) acceptDiff();        break
        case 'r': if (pendingDiff) rejectDiff();        break
        case 'm': setShowNLBar(!showNLBar);             break
        case 'c': toggleContested();                    break
        case 'escape':
          setShowNLBar(false)
          setShowDisruptModal(false)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDiff, showNLBar])
}
