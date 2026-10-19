// RIGHT PANEL – Plan A/B/C switcher, robustness, tabbed content
import { useStore } from '../store/useStore'
import NegotiationPanel from './NegotiationPanel'
import RobustnessPanel  from './RobustnessPanel'
import PredictionsPanel from './PredictionsPanel'

// ── Robustness mini-bar ───────────────────────────────────────────────────────
function RobustnessBar({ label, score, histogram, active }) {
  const color = (score ?? 0) >= 80 ? '#8fb56e' : (score ?? 0) >= 60 ? '#e8a317' : '#d64545'
  const maxBin = histogram?.length ? Math.max(...histogram, 0.001) : 0.001
  return (
    <div style={{ marginBottom: 10 }}>
      {/* Label + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: active ? '#e8a317' : '#57606a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          PLAN {label}{active ? ' ●' : ''}
        </span>
        <span style={{ fontSize: 13, color, fontWeight: 700 }}>
          {score?.toFixed(0) ?? '--'}<span style={{ fontSize: 9, color: `${color}88` }}>%</span>
        </span>
      </div>
      {/* Histogram bins */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 16, marginBottom: 3 }}>
        {(histogram ?? []).map((v, i) => (
          <div key={i} style={{
            flex: 1, background: color, opacity: 0.55,
            height: `${Math.round((v / maxBin) * 100)}%`,
            minHeight: 1, minWidth: 1,
          }} />
        ))}
      </div>
      {/* Fill bar */}
      <div style={{ height: 3, background: '#1e252a', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${Math.min(100, score ?? 0)}%`,
          background: color,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

// ── Diff line ────────────────────────────────────────────────────────────────
function DiffLine({ diff }) {
  const confColor = diff.low_conf ? '#d64545'
                  : (diff.confidence ?? 1) >= 0.9 ? '#8fb56e' : '#e8a317'
  return (
    <div
      className="diff-enter"
      style={{ borderBottom: '1px solid #1a2228', padding: '8px 10px' }}
    >
      {/* Mission ID + confidence */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#c9d1d9', fontWeight: 600, letterSpacing: '0.04em' }}>
          {diff.mission_id}
        </span>
        <span style={{
          fontSize: 8, color: confColor, border: `1px solid ${confColor}66`,
          padding: '1px 6px', letterSpacing: '0.08em', background: `${confColor}0d`,
        }}>
          {diff.low_conf ? 'LOW CONF' : `${((diff.confidence ?? 1) * 100).toFixed(0)}%`}
        </span>
      </div>
      {/* Before → After */}
      <div style={{ fontSize: 10, marginBottom: 3, lineHeight: 1.4 }}>
        <span style={{ color: '#d64545' }}>{diff.before}</span>
        <span style={{ color: '#3a4248', margin: '0 6px' }}>→</span>
        <span style={{ color: '#8fb56e' }}>{diff.after}</span>
      </div>
      {/* Reason */}
      <div style={{ fontSize: 9, color: '#57606a', lineHeight: 1.4, borderLeft: '2px solid #2a3238', paddingLeft: 6 }}>
        {diff.reason}
      </div>
    </div>
  )
}

// ── Plan DIFF panel ───────────────────────────────────────────────────────────
function DiffPanel() {
  const pendingDiff = useStore(s => s.pendingDiff)
  const diff        = useStore(s => s.diff)
  const acceptDiff  = useStore(s => s.acceptDiff)
  const rejectDiff  = useStore(s => s.rejectDiff)
  const activeDiff  = pendingDiff || diff

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px 4px', background: '#0f1316', borderBottom: '1px solid #2a3238',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 9, color: pendingDiff ? '#e8a317' : '#57606a',
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {pendingDiff ? '● PENDING DIFF' : 'PLAN DIFF'}
        </span>
        {activeDiff && (
          <span style={{ fontSize: 9, color: '#57606a' }}>
            {activeDiff.diffs?.length ?? 0} changes
          </span>
        )}
      </div>

      {/* Disruption summary */}
      {activeDiff?.disruption_summary && (
        <div style={{
          padding: '6px 10px', fontSize: 9, color: '#57606a',
          borderBottom: '1px solid #1a2228', background: '#0f1316', flexShrink: 0,
        }}>
          {activeDiff.disruption_summary}
        </div>
      )}

      {/* Diff lines */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeDiff?.diffs?.map((d, i) => <DiffLine key={i} diff={d} />)}
        {!activeDiff?.diffs?.length && (
          <div style={{ fontSize: 10, color: '#3a4248', padding: '12px 10px', fontStyle: 'italic' }}>
            NO PENDING CHANGES
          </div>
        )}
      </div>

      {/* Accept / Reject */}
      {pendingDiff && (
        <div style={{
          flexShrink: 0, borderTop: '1px solid #2a3238',
          display: 'flex', gap: 8, padding: 10,
        }}>
          <button
            onClick={acceptDiff}
            style={{
              flex: 1, padding: '8px 0',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#8fb56e', border: '1px solid #8fb56e',
              background: 'rgba(143,181,110,0.06)', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(143,181,110,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(143,181,110,0.06)'}
          >
            ✓ ACCEPT
            <span style={{ fontSize: 9, color: '#8fb56e88', border: '1px solid #8fb56e44', padding: '0 3px' }}>A</span>
          </button>
          <button
            onClick={rejectDiff}
            style={{
              flex: 1, padding: '8px 0',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#d64545', border: '1px solid #d64545',
              background: 'rgba(214,69,69,0.06)', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(214,69,69,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(214,69,69,0.06)'}
          >
            ✕ REJECT
            <span style={{ fontSize: 9, color: '#d6454588', border: '1px solid #d6454544', padding: '0 3px' }}>R</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Metrics panel ─────────────────────────────────────────────────────────────
function MetricsPanel() {
  const metrics  = useStore(s => s.metrics)
  const plan     = useStore(s => s.plan)
  const undoPlan = useStore(s => s.undoPlan)
  const history  = useStore(s => s.planHistory)

  const rows = [
    { label: 'MANUAL PLAN TIME',  val: metrics.planningTimeManual,                         highlight: false },
    { label: 'SYSTEM PLAN TIME',  val: metrics.planningTimeSystem,                         highlight: true  },
    { label: 'MISSION COVERAGE',  val: `${metrics.missionsCovered}/${metrics.missionsTotal ?? 8}`, highlight: true  },
    { label: 'UTILISATION',       val: metrics.utilisationAfter ?? metrics.utilisationBefore, highlight: false },
    { label: 'REPLAN TIME',       val: metrics.replanTime,                                 highlight: true  },
    { label: 'PLAN ID',           val: plan?.plan_id ?? '--',                              highlight: false },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px 0' }}>
      {rows.map(r => (
        <div key={r.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderBottom: '1px solid #1a2228',
        }}>
          <span style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {r.label}
          </span>
          <span style={{ fontSize: 10, color: r.highlight ? '#8fb56e' : '#c9d1d9', fontWeight: r.highlight ? 600 : 400 }}>
            {r.val || '—'}
          </span>
        </div>
      ))}

      {history.length > 0 && (
        <div style={{ padding: 10 }}>
          <button
            onClick={undoPlan}
            style={{
              width: '100%', padding: '7px 0',
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#57606a', border: '1px solid #2a3238',
              background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            UNDO LAST ACCEPT ({history.length} in history)
          </button>
        </div>
      )}
    </div>
  )
}

// ── History panel ─────────────────────────────────────────────────────────────
function HistoryPanel() {
  const history  = useStore(s => s.planHistory)
  const undoPlan = useStore(s => s.undoPlan)

  if (!history.length) return (
    <div style={{ fontSize: 10, color: '#3a4248', padding: '12px 10px', fontStyle: 'italic' }}>
      NO PLAN HISTORY YET
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {history.map((snap, i) => (
          <div key={i} style={{ borderBottom: '1px solid #1a2228', padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#c9d1d9', marginBottom: 2 }}>{snap.label}</div>
            <div style={{ fontSize: 9, color: '#57606a' }}>
              {snap.plan?.options?.find(o => o.label === snap.plan.best_option)?.missions_covered ?? '--'} missions covered
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: 10, flexShrink: 0 }}>
        <button
          onClick={undoPlan}
          style={{
            width: '100%', padding: '7px 0',
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#e8a317', border: '1px solid #e8a317',
            background: 'rgba(232,163,23,0.06)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          RESTORE PREVIOUS PLAN
        </button>
      </div>
    </div>
  )
}

// ── Negotiation log panel ─────────────────────────────────────────────────────
const ACTION_COLORS = { BID: '#8fb56e', VETO: '#d64545', AWARD: '#e8a317', RESOLVE: '#7eb8d4' }

function NegLogPanel() {
  const negLog         = useStore(s => s.negLog)
  const runNegotiation = useStore(s => s.runNegotiation)
  const recomputing    = useStore(s => s.recomputing)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px 4px', background: '#0f1316', borderBottom: '1px solid #2a3238',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          NEGOTIATION LOG
        </span>
        <button
          onClick={runNegotiation}
          disabled={recomputing}
          style={{
            fontSize: 9, padding: '2px 8px', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#e8a317', border: '1px solid #e8a317',
            background: 'rgba(232,163,23,0.06)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {recomputing ? '...' : '▶ RUN'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {negLog.length === 0 && (
          <div style={{ fontSize: 10, color: '#3a4248', padding: '12px 10px', fontStyle: 'italic' }}>
            PRESS RUN TO START NEGOTIATION
          </div>
        )}
        {negLog.map((entry, i) => (
          <div
            key={i}
            className="log-enter"
            style={{ borderBottom: '1px solid #1a2228', padding: '7px 10px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 8, color: ACTION_COLORS[entry.action] || '#57606a',
                border: `1px solid ${ACTION_COLORS[entry.action] || '#2a3238'}44`,
                padding: '1px 5px', letterSpacing: '0.1em', textTransform: 'uppercase',
                background: `${ACTION_COLORS[entry.action] || '#57606a'}0d`,
              }}>
                {entry.action}
              </span>
              <span style={{ fontSize: 9, color: '#c9d1d9', fontWeight: 600 }}>{entry.agent}</span>
              <span style={{ fontSize: 9, color: '#57606a', marginLeft: 'auto' }}>{entry.mission_id}</span>
            </div>
            <div style={{ fontSize: 9, color: '#c9d1d9', lineHeight: 1.4 }}>{entry.reason}</div>
            {entry.score > 0 && (
              <div style={{ fontSize: 8, color: '#3a4248', marginTop: 2 }}>score: {entry.score.toFixed(2)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { key: 'diff',       label: 'DIFF'  },
  { key: 'robustness', label: 'ROB'   },
  { key: 'neglog',     label: 'NEG'   },
  { key: 'pred',       label: 'PRED'  },
  { key: 'metrics',    label: 'STATS' },
  { key: 'history',    label: 'HIST'  },
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function RightPanel() {
  const plan               = useStore(s => s.plan)
  const activePlanLabel    = useStore(s => s.activePlanLabel)
  const setActivePlanLabel = useStore(s => s.setActivePlanLabel)
  const activeRightTab     = useStore(s => s.activeRightTab)
  const setActiveRightTab  = useStore(s => s.setActiveRightTab)
  const options            = plan?.options ?? []

  return (
    <div style={{
      width: 272,
      display: 'flex',
      flexDirection: 'column',
      background: '#161b1f',
      borderLeft: '1px solid #2a3238',
      minHeight: 0,
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* ── Plan A / B / C option selector ── */}
      <div style={{
        display: 'flex',
        background: '#0f1316',
        borderBottom: '1px solid #2a3238',
        flexShrink: 0,
      }}>
        {options.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 9, color: '#3a4248', letterSpacing: '0.12em' }}>
            NO PLAN GENERATED
          </div>
        ) : (
          options.map(o => (
            <button
              key={o.label}
              onClick={() => setActivePlanLabel(o.label)}
              style={{
                flex: 1, padding: '7px 4px',
                fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: activePlanLabel === o.label ? '#e8a317' : '#57606a',
                borderBottom: activePlanLabel === o.label ? '2px solid #e8a317' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color 0.15s',
              }}
            >
              PLAN {o.label}
            </button>
          ))
        )}
      </div>

      {/* ── Robustness bars (always visible) ── */}
      {options.length > 0 && (
        <div style={{ padding: '10px 10px 4px', borderBottom: '1px solid #2a3238', flexShrink: 0 }}>
          {options.map(o => (
            <RobustnessBar
              key={o.label}
              label={o.label}
              score={o.robustness_score}
              histogram={o.robustness_histogram}
              active={o.label === activePlanLabel}
            />
          ))}
          {/* Risk score row */}
          <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingTop: 6, borderTop: '1px solid #1a2228' }}>
            {options.map(o => {
              const risk = (o.risk_score ?? 0) * 100
              const c = risk > 30 ? '#d64545' : risk > 15 ? '#e8a317' : '#8fb56e'
              return (
                <div key={o.label} style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                    P{o.label} RISK
                  </div>
                  <div style={{ fontSize: 11, color: c, fontWeight: 600 }}>{risk.toFixed(0)}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Content tabs ── */}
      <div style={{
        display: 'flex',
        background: '#0f1316',
        borderBottom: '1px solid #2a3238',
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveRightTab(t.key)}
            style={{
              flex: 1, padding: '5px 2px',
              fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: activeRightTab === t.key ? '#e8a317' : '#57606a',
              borderBottom: activeRightTab === t.key ? '2px solid #e8a317' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Panel content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {activeRightTab === 'diff'       && <DiffPanel />}
        {activeRightTab === 'robustness' && <RobustnessPanel />}
        {activeRightTab === 'neglog'     && <NegLogPanel />}
        {activeRightTab === 'pred'       && <PredictionsPanel />}
        {activeRightTab === 'metrics'    && <MetricsPanel />}
        {activeRightTab === 'history'    && <HistoryPanel />}
      </div>
    </div>
  )
}
