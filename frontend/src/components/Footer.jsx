// Footer – classification strip, keyboard shortcut legend, data disclaimer
export default function Footer() {
  const shortcuts = [
    ['I', 'INJECT'],
    ['A', 'ACCEPT'],
    ['R', 'REJECT'],
    ['M', 'NL CMD'],
    ['C', 'CONTESTED'],
    ['ESC', 'CLOSE'],
  ]

  return (
    <div style={{
      height: 24,
      background: '#0a0d0f',
      borderTop: '1px solid #1e252a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 0,
      flexShrink: 0,
    }}>
      {/* Classification */}
      <span style={{ fontSize: 8, color: '#3a4248', letterSpacing: '0.2em', textTransform: 'uppercase', minWidth: 160 }}>
        EXERCISE — UNCLASSIFIED
      </span>

      {/* Keyboard shortcuts */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        {shortcuts.map(([key, label]) => (
          <span key={key} style={{ fontSize: 8, color: '#3a4248', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              color: '#57606a', border: '1px solid #2a3238',
              padding: '0 4px', lineHeight: '14px', letterSpacing: '0.04em',
            }}>
              {key}
            </span>
            {label}
          </span>
        ))}
      </div>

      {/* Disclaimer */}
      <span style={{ fontSize: 8, color: '#2a3238', letterSpacing: '0.08em', whiteSpace: 'nowrap', minWidth: 280, textAlign: 'right' }}>
        OPERATIONAL DATA IS SIMULATED · PIPELINE ACCEPTS REAL FEEDS · TEMPO v1.0
      </span>
    </div>
  )
}
