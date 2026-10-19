// Animated multi-agent negotiation log.
// Shows entries streaming in with colour-coded action tags and scarcity scores.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

const ACTION_COLOR = {
  BID:     '#8fb56e',
  VETO:    '#d64545',
  AWARD:   '#e8a317',
  RESOLVE: '#7eb8d4',
}

const AGENT_SHORT = {
  AIRCRAFT_AGENT: 'AC',
  CREW_AGENT:     'CR',
  WEAPONS_AGENT:  'WP',
  WEATHER_AGENT:  'WX',
  COORDINATOR:    'CO',
}

function LogEntry({ entry, index, visible }) {
  const color = ACTION_COLOR[entry.action] || '#57606a'
  const agent = AGENT_SHORT[entry.agent] || entry.agent.slice(0, 2)

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(8px)',
        transition: `opacity 0.18s ${index * 0.04}s, transform 0.18s ${index * 0.04}s`,
        borderBottom: '1px solid #1a2228',
        padding: '5px 8px',
      }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {/* Action badge */}
        <span style={{
          fontSize: 8, color, border: `1px solid ${color}`,
          padding: '0 3px', letterSpacing: '0.08em', flexShrink: 0,
        }}>
          {entry.action}
        </span>
        {/* Agent badge */}
        <span style={{
          fontSize: 8, color: '#57606a', background: '#1e252a',
          padding: '0 3px', letterSpacing: '0.06em',
        }}>
          {agent}
        </span>
        {/* Mission */}
        <span style={{ fontSize: 8, color: '#57606a', marginLeft: 'auto' }}>
          {entry.mission_id}
        </span>
        {/* Score */}
        {entry.score > 0 && (
          <span style={{ fontSize: 8, color: color === '#e8a317' ? '#e8a317' : '#57606a' }}>
            {entry.score.toFixed(2)}
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: '#c9d1d9', lineHeight: 1.35 }}>
        {entry.reason}
      </div>
      <div style={{ fontSize: 8, color: '#57606a', marginTop: 1 }}>{entry.zulu}</div>
    </div>
  )
}

export default function NegotiationPanel() {
  const negLog          = useStore(s => s.negLog)
  const negMeta         = useStore(s => s.negMeta)     // { elapsed_ms, scarcity, robustness }
  const runNegotiation  = useStore(s => s.runNegotiation)
  const recomputing     = useStore(s => s.recomputing)

  const [visibleCount, setVisibleCount] = useState(0)
  const logRef = useRef(null)

  // Animate entries streaming in when log changes
  useEffect(() => {
    setVisibleCount(0)
    if (!negLog.length) return
    let i = 0
    const step = () => {
      i++
      setVisibleCount(i)
      if (i < negLog.length) setTimeout(step, 80)
    }
    // Small initial delay so the panel renders first
    const tid = setTimeout(step, 120)
    return () => clearTimeout(tid)
  }, [negLog])

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleCount])

  const awarded  = negLog.filter(e => e.action === 'AWARD').length
  const vetoed   = negLog.filter(e => e.action === 'VETO').length
  const resolved = negLog.filter(e => e.action === 'RESOLVE').length

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0"
           style={{ borderColor: '#2a3238', background: '#0f1316' }}>
        <span style={{ fontSize: 9, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          NEGOTIATION LOG
        </span>
        <button
          onClick={runNegotiation}
          disabled={recomputing}
          className="text-[9px] px-2 py-0.5 border tracking-widest uppercase"
          style={{ color: '#e8a317', borderColor: '#e8a317', opacity: recomputing ? 0.5 : 1 }}
        >
          {recomputing ? '...' : 'RUN'}
        </button>
      </div>

      {/* Stats row */}
      {negLog.length > 0 && (
        <div className="flex gap-3 px-2 py-1 border-b shrink-0" style={{ borderColor: '#1a2228' }}>
          <div>
            <div style={{ fontSize: 8, color: '#57606a', textTransform: 'uppercase' }}>AWARDED</div>
            <div style={{ fontSize: 11, color: '#e8a317' }}>{awarded}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: '#57606a', textTransform: 'uppercase' }}>VETOED</div>
            <div style={{ fontSize: 11, color: '#d64545' }}>{vetoed}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: '#57606a', textTransform: 'uppercase' }}>RESOLVED</div>
            <div style={{ fontSize: 11, color: '#7eb8d4' }}>{resolved}</div>
          </div>
          {negMeta?.elapsed_ms && (
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 8, color: '#57606a', textTransform: 'uppercase' }}>TIME</div>
              <div style={{ fontSize: 9, color: '#8fb56e' }}>{negMeta.elapsed_ms.toFixed(0)}ms</div>
            </div>
          )}
        </div>
      )}

      {/* Robustness summary if available */}
      {negMeta?.robustness && (
        <div className="flex gap-2 px-2 py-1 border-b shrink-0" style={{ borderColor: '#1a2228' }}>
          {Object.entries(negMeta.robustness).map(([label, score]) => {
            const color = score >= 80 ? '#8fb56e' : score >= 60 ? '#e8a317' : '#d64545'
            return (
              <div key={label} className="flex items-center gap-1">
                <span style={{ fontSize: 8, color: '#57606a' }}>PLAN {label}</span>
                <span style={{ fontSize: 10, color, fontWeight: 600 }}>{score?.toFixed(0)}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Log entries */}
      <div ref={logRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {negLog.slice(0, visibleCount).map((entry, i) => (
          <LogEntry key={i} entry={entry} index={i} visible={true} />
        ))}
        {negLog.length === 0 && (
          <div style={{ fontSize: 10, color: '#57606a', padding: '10px 8px' }}>
            PRESS RUN TO START NEGOTIATION
          </div>
        )}
        {recomputing && negLog.length === 0 && (
          <div className="replan-pulse" style={{ fontSize: 9, color: '#e8a317', padding: '8px' }}>
            AGENTS NEGOTIATING...
          </div>
        )}
      </div>
    </div>
  )
}
