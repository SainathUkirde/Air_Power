// Predictions panel – aircraft failure risk cards + mission at-risk flags
// + pre-emptive advisory cards with one-click backup plan loading
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { apiFetch } from '../api/client'

const RISK_COLOR = {
  CRITICAL: '#d64545',
  HIGH:     '#e8a317',
  MEDIUM:   '#c9d1d9',
  LOW:      '#57606a',
}

function RiskBar({ value, color }) {
  return (
    <div style={{ height: 3, background: '#2a3238', marginTop: 2 }}>
      <div style={{ width: `${Math.min(100, value * 100)}%`, background: color, height: '100%', transition: 'width .4s' }} />
    </div>
  )
}

function AircraftCard({ pred }) {
  const color = RISK_COLOR[pred.risk_level] || '#57606a'
  return (
    <div className="border-b px-2 py-1.5" style={{ borderColor: '#1a2228' }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{pred.callsign}</span>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 8, color, border: `1px solid ${color}`, padding: '0 3px' }}>
            {pred.risk_level}
          </span>
          <span style={{ fontSize: 10, color }}>
            {(pred.fail_probability * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <RiskBar value={pred.fail_probability} color={color} />
      <div className="flex justify-between mt-1">
        <span style={{ fontSize: 8, color: '#57606a' }}>RUL: {pred.rul_hrs.toFixed(0)} HRS</span>
        {pred.advisory && (
          <span style={{ fontSize: 8, color: '#e8a317' }}>ADV ACTIVE</span>
        )}
      </div>
    </div>
  )
}

function MissionRiskCard({ pred }) {
  if (!pred.at_risk) return null
  const wiColor = pred.weather_impact > 0.5 ? '#d64545' : '#e8a317'
  const taColor = pred.threat_approach > 0.3 ? '#d64545' : '#e8a317'
  return (
    <div className="border-b px-2 py-1.5" style={{ borderColor: '#1a2228', background: 'rgba(214,69,69,0.04)' }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 9, color: '#d64545', fontWeight: 600 }}>{pred.mission_name}</span>
        <span style={{ fontSize: 8, color: '#d64545', border: '1px solid #d64545', padding: '0 3px' }}>
          AT RISK
        </span>
      </div>
      <div className="flex gap-4">
        <div>
          <div style={{ fontSize: 7, color: '#57606a', textTransform: 'uppercase' }}>WX IMPACT</div>
          <div style={{ fontSize: 10, color: wiColor }}>{(pred.weather_impact * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 7, color: '#57606a', textTransform: 'uppercase' }}>THREAT APR</div>
          <div style={{ fontSize: 10, color: taColor }}>{(pred.threat_approach * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div style={{ fontSize: 8, color: '#57606a', marginTop: 2 }}>{pred.reason}</div>
    </div>
  )
}

function AdvisoryCard({ card, onLoadBackup }) {
  const color = RISK_COLOR[card.level] || '#57606a'
  return (
    <div className="border-b px-2 py-2" style={{ borderColor: '#1a2228', background: 'rgba(232,163,23,0.03)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 8, color, border: `1px solid ${color}`, padding: '0 3px' }}>{card.level}</span>
        <span style={{ fontSize: 8, color: '#57606a' }}>{card.category}</span>
        <span style={{ fontSize: 8, color: '#57606a', marginLeft: 'auto' }}>{card.zulu}</span>
      </div>
      <div style={{ fontSize: 10, color, fontWeight: 600, marginBottom: 2 }}>{card.title}</div>
      <div style={{ fontSize: 9, color: '#c9d1d9', lineHeight: 1.35 }}>{card.detail}</div>
      {card.backup_plan && (
        <div className="flex items-center justify-between mt-2 pt-1 border-t" style={{ borderColor: '#2a3238' }}>
          <div>
            <span style={{ fontSize: 8, color: '#57606a' }}>BACKUP: </span>
            <span style={{ fontSize: 8, color: '#8fb56e' }}>
              {card.backup_plan.missions_covered} missions / {card.backup_plan.robustness_score.toFixed(0)}% rob
            </span>
          </div>
          <button
            onClick={() => onLoadBackup(card)}
            className="text-[9px] px-2 py-0.5 border tracking-widest uppercase"
            style={{ color: '#e8a317', borderColor: '#e8a317' }}
          >
            LOAD
          </button>
        </div>
      )}
    </div>
  )
}

export default function PredictionsPanel() {
  const predictions    = useStore(s => s.predictions)
  const loadPredictions = useStore(s => s.loadPredictions)
  const injectDisruption = useStore(s => s.injectDisruption)

  const [advisories, setAdvisories] = useState([])
  const [loading, setLoading]       = useState(false)
  const [tab, setTab]               = useState('aircraft')  // 'aircraft'|'missions'|'advisories'

  useEffect(() => {
    loadPredictions()
    fetchAdvisories()
  }, [])

  async function fetchAdvisories() {
    setLoading(true)
    try {
      const data = await apiFetch('/api/advisory')
      setAdvisories(data)
    } catch {
      // advisory endpoint not available; use prediction advisories from store
      setAdvisories(
        (predictions?.aircraft ?? [])
          .filter(p => p.advisory)
          .map(p => ({
            id: `pred-${p.aircraft_id}`,
            level: p.risk_level,
            category: 'MAINTENANCE',
            title: p.advisory.split('.')[0],
            detail: p.advisory,
            zulu: '--',
            aircraft_id: p.aircraft_id,
            backup_plan: null,
          }))
      )
    }
    setLoading(false)
  }

  function handleLoadBackup(card) {
    // Mark the aircraft as unserviceable to trigger re-plan with backup
    if (card.aircraft_id) {
      injectDisruption({
        type: 'AIRCRAFT_UNSERVICEABLE',
        target_id: card.aircraft_id,
        severity: 'HIGH',
        detail: `Pre-emptive: ${card.title}`,
      })
    }
  }

  const acPreds = predictions?.aircraft ?? []
  const mPreds  = predictions?.missions  ?? []
  const atRisk  = mPreds.filter(m => m.at_risk)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0"
           style={{ borderColor: '#2a3238', background: '#0f1316' }}>
        <span style={{ fontSize: 9, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          PREDICTIONS
        </span>
        <button onClick={() => { loadPredictions(); fetchAdvisories() }}
          style={{ fontSize: 8, color: '#57606a' }}>↻ REFRESH</button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b shrink-0" style={{ borderColor: '#2a3238' }}>
        {[
          { key: 'aircraft',   label: `AC (${acPreds.length})` },
          { key: 'missions',   label: `MSN${atRisk.length > 0 ? ` ⚑${atRisk.length}` : ''}` },
          { key: 'advisories', label: `ADV (${advisories.length})` },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-1 text-[8px] tracking-wide uppercase"
            style={{
              color: tab === t.key ? '#e8a317' : '#57606a',
              borderBottom: tab === t.key ? '1px solid #e8a317' : '1px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {/* Aircraft risk */}
        {tab === 'aircraft' && acPreds.map(p => <AircraftCard key={p.aircraft_id} pred={p} />)}

        {/* Mission risk */}
        {tab === 'missions' && (
          <>
            {atRisk.length === 0 && (
              <div style={{ fontSize: 10, color: '#57606a', padding: '10px 8px' }}>NO AT-RISK MISSIONS</div>
            )}
            {mPreds.map(p => <MissionRiskCard key={p.mission_id} pred={p} />)}
          </>
        )}

        {/* Pre-emptive advisories */}
        {tab === 'advisories' && (
          <>
            {loading && (
              <div className="replan-pulse" style={{ fontSize: 9, color: '#e8a317', padding: '8px' }}>
                LOADING ADVISORIES...
              </div>
            )}
            {!loading && advisories.length === 0 && (
              <div style={{ fontSize: 10, color: '#57606a', padding: '10px 8px' }}>NO ADVISORIES</div>
            )}
            {advisories.map(c => (
              <AdvisoryCard key={c.id} card={c} onLoadBackup={handleLoadBackup} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
