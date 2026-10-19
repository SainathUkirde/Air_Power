// Contested environment overlay – shown above the map when contested mode is active.
// Displays per-source confidence %, data age, and LIVE/DEGRADED/LOST status.
import { useStore } from '../store/useStore'

const STATUS_COLOR = {
  LIVE:     '#8fb56e',
  DEGRADED: '#e8a317',
  LOST:     '#d64545',
}

function SourceBadge({ source }) {
  const color = STATUS_COLOR[source.status] || '#57606a'
  const age   = source.age_minutes < 1
    ? 'LIVE'
    : source.age_minutes < 60
    ? `${source.age_minutes.toFixed(0)}m AGO`
    : `${(source.age_minutes / 60).toFixed(1)}h AGO`

  return (
    <div
      className="flex flex-col items-center px-2 py-1 border"
      style={{ borderColor: `${color}44`, background: `${color}08`, minWidth: 56 }}
    >
      <div style={{ fontSize: 7, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {source.source.toUpperCase()}
      </div>
      <div style={{ fontSize: 9, color, fontWeight: 600 }}>
        {(source.confidence * 100).toFixed(0)}%
      </div>
      <div style={{ fontSize: 7, color, opacity: 0.8 }}>{age}</div>
    </div>
  )
}

export default function ContestedOverlay() {
  const contested    = useStore(s => s.contested)
  const sources      = useStore(s => s.sources)
  const toggleContested = useStore(s => s.toggleContested)

  if (!contested) return null

  const lostCount     = sources.filter(s => s.status === 'LOST').length
  const degradedCount = sources.filter(s => s.status === 'DEGRADED').length

  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 flex flex-col"
      style={{ pointerEvents: 'none' }}
    >
      {/* Warning banner */}
      <div
        className="flex items-center gap-3 px-3 py-1"
        style={{
          background: 'rgba(214,69,69,0.15)',
          borderBottom: '1px solid rgba(214,69,69,0.4)',
          pointerEvents: 'auto',
        }}
      >
        <span className="replan-pulse" style={{ fontSize: 9, color: '#d64545', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          ● CONTESTED ENVIRONMENT ACTIVE
        </span>
        {lostCount > 0 && (
          <span style={{ fontSize: 9, color: '#d64545' }}>{lostCount} SOURCE{lostCount > 1 ? 'S' : ''} LOST</span>
        )}
        {degradedCount > 0 && (
          <span style={{ fontSize: 9, color: '#e8a317' }}>{degradedCount} DEGRADED</span>
        )}
        <div className="flex-1" />
        <span style={{ fontSize: 8, color: '#57606a' }}>DECISIONS TAGGED LOW CONF WHERE AFFECTED</span>
      </div>

      {/* Source badges */}
      {sources.length > 0 && (
        <div
          className="flex gap-1 px-2 py-1"
          style={{
            background: 'rgba(15,19,22,0.85)',
            borderBottom: '1px solid #2a3238',
            pointerEvents: 'auto',
            flexWrap: 'nowrap',
            overflowX: 'auto',
          }}
        >
          {sources.map(s => <SourceBadge key={s.source} source={s} />)}
        </div>
      )}
    </div>
  )
}
