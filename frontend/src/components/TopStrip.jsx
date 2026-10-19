// TOP STRIP – scenario name, resource bars, replan, link status, CONTESTED toggle, Zulu clock
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { zuluClock } from '../utils/format'

function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: '#2a3238', margin: '0 2px' }} />
}

// Resource readiness bar with percentage fill
function ResourceBar({ label, ready, total, color = '#e8a317' }) {
  const pct = total ? Math.round((ready / total) * 100) : 0
  const barColor = pct === 100 ? '#8fb56e' : pct < 50 ? '#d64545' : color
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.14em', textTransform: 'uppercase', minWidth: 28 }}>
        {label}
      </span>
      {/* Bar track */}
      <div style={{ width: 52, height: 4, background: '#1e252a', position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: barColor,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {/* Count */}
      <span style={{ fontSize: 12, color: barColor, fontWeight: 600, minWidth: 38 }}>
        {ready}
        <span style={{ fontSize: 9, color: '#57606a', fontWeight: 400 }}>/{total}</span>
      </span>
    </div>
  )
}

// Small status pill
function StatusPill({ children, color, bg, blink }) {
  return (
    <span
      className={blink ? 'replan-pulse' : ''}
      style={{
        fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
        color, border: `1px solid ${color}`,
        background: bg || 'transparent',
        padding: '2px 7px',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function TopStrip() {
  const [clock, setClock] = useState(zuluClock())
  const scenario        = useStore(s => s.scenario)
  const online          = useStore(s => s.online)
  const offline         = useStore(s => s.offline)
  const waking          = useStore(s => s.waking)
  const contested       = useStore(s => s.contested)
  const sources         = useStore(s => s.sources)
  const toggleContested = useStore(s => s.toggleContested)
  const generatePlan    = useStore(s => s.generatePlan)
  const recomputing     = useStore(s => s.recomputing)

  useEffect(() => {
    const t = setInterval(() => setClock(zuluClock()), 1000)
    return () => clearInterval(t)
  }, [])

  const aircraft = scenario?.aircraft ?? []
  const crews    = scenario?.crews    ?? []
  const weapons  = scenario?.weapons  ?? []

  const acReady = aircraft.filter(a => a.status === 'READY').length
  const crReady = crews.filter(c => c.available !== false).length
  const wpTotal = weapons.reduce((s, w) => s + w.count, 0)

  return (
    <div
      style={{
        height: 44,
        background: '#0f1316',
        borderBottom: '1px solid #2a3238',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 0,
        flexShrink: 0,
      }}
    >
      {/* Scenario name */}
      <div style={{ paddingRight: 14, minWidth: 0 }}>
        <div style={{ fontSize: 8, color: '#57606a', letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1 }}>
          SCENARIO
        </div>
        <div style={{ fontSize: 12, color: '#e8a317', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
          {scenario?.name ?? 'LOADING...'}
        </div>
      </div>

      <Divider />

      {/* Resource bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 14px' }}>
        <ResourceBar label="AC"  ready={acReady} total={aircraft.length} />
        <ResourceBar label="CR"  ready={crReady} total={crews.length} />
        <ResourceBar label="WPN" ready={wpTotal} total={wpTotal} color="#7eb8d4" />
      </div>

      <Divider />

      {/* REPLAN */}
      <div style={{ padding: '0 12px' }}>
        <button
          onClick={generatePlan}
          disabled={recomputing}
          style={{
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: recomputing ? '#e8a317' : '#e8a317',
            border: '1px solid #e8a317',
            background: recomputing ? 'rgba(232,163,23,0.12)' : 'rgba(232,163,23,0.06)',
            padding: '4px 12px',
            cursor: recomputing ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            fontFamily: 'inherit',
          }}
        >
          {recomputing ? (
            <span className="replan-pulse">● RECOMPUTING</span>
          ) : '▶ REPLAN'}
        </button>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Status badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
        {waking && (
          <StatusPill color="#e8a317" blink>
            ◌ WAKING SERVER
          </StatusPill>
        )}
        {offline && !waking && (
          <StatusPill color="#e8a317" bg="rgba(232,163,23,0.08)">
            ⊘ OFFLINE SIM
          </StatusPill>
        )}
        {online && !offline && (
          <StatusPill color="#8fb56e" bg="rgba(143,181,110,0.08)">
            ● LINK LIVE
          </StatusPill>
        )}
      </div>

      <Divider />

      {/* CONTESTED toggle */}
      <div style={{ padding: '0 12px' }}>
        <button
          onClick={toggleContested}
          title="Toggle contested environment mode  [C]"
          style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: contested ? '#d64545' : '#57606a',
            border: `1px solid ${contested ? '#d64545' : '#2a3238'}`,
            background: contested ? 'rgba(214,69,69,0.1)' : 'transparent',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: contested ? '#d64545' : 'transparent',
            border: `1px solid ${contested ? '#d64545' : '#57606a'}`,
            display: 'inline-block',
          }} />
          CONTESTED
          {/* Source mini-badges when active */}
          {contested && sources.slice(0, 3).map(s => {
            const c = s.status === 'LOST' ? '#d64545' : s.status === 'DEGRADED' ? '#e8a317' : '#8fb56e'
            return (
              <span key={s.source} style={{
                fontSize: 7, color: c, border: `1px solid ${c}`,
                padding: '0 3px', lineHeight: '14px', letterSpacing: '0.06em',
              }}>
                {s.source.slice(0, 3).toUpperCase()}
              </span>
            )
          })}
        </button>
      </div>

      <Divider />

      {/* Zulu clock */}
      <div style={{ paddingLeft: 12, minWidth: 170, textAlign: 'right' }}>
        <div style={{ fontSize: 8, color: '#57606a', letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1 }}>
          ZULU
        </div>
        <div style={{ fontSize: 14, color: '#c9d1d9', fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
          {clock}
        </div>
      </div>
    </div>
  )
}
