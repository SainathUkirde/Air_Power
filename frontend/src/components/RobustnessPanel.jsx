// Monte Carlo robustness comparison: Plan A vs B vs C
// Shows survival %, histogram, failure causes, weakest mission.
import { useStore } from '../store/useStore'

function Histogram({ bins, color }) {
  if (!bins?.length) return null
  const max = Math.max(...bins, 0.001)
  return (
    <div className="flex items-end gap-px" style={{ height: 28, marginTop: 3 }}>
      {bins.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: color,
            height: `${(v / max) * 100}%`,
            opacity: 0.7,
            minWidth: 1,
            transition: 'height 0.3s',
          }}
        />
      ))}
    </div>
  )
}

function CauseTag({ cause }) {
  const labels = {
    aircraft_failure:  'AC FAIL',
    weather_shift:     'WX SHIFT',
    crew_delay:        'CREW DLY',
    threat_expansion:  'THREAT EXP',
  }
  return (
    <span style={{
      fontSize: 8, color: '#57606a', background: '#1e252a',
      padding: '1px 4px', marginRight: 3,
    }}>
      {labels[cause] || cause}
    </span>
  )
}

function PlanRobustness({ option, active }) {
  const score = option.robustness_score ?? 0
  const color = score >= 80 ? '#8fb56e' : score >= 60 ? '#e8a317' : '#d64545'
  const causes = option.top_failure_causes ?? []

  return (
    <div
      className="border-b px-2 py-2"
      style={{
        borderColor: '#1a2228',
        background: active ? 'rgba(232,163,23,0.04)' : 'transparent',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span style={{
            fontSize: 9,
            color: active ? '#e8a317' : '#57606a',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            PLAN {option.label}{active ? ' ●' : ''}
          </span>
          <span style={{ fontSize: 8, color: '#57606a' }}>
            {option.missions_covered} missions
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <div style={{ fontSize: 7, color: '#57606a', textTransform: 'uppercase' }}>RISK</div>
            <div style={{ fontSize: 10, color: option.risk_score > 0.2 ? '#d64545' : '#8fb56e' }}>
              {((option.risk_score ?? 0) * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 7, color: '#57606a', textTransform: 'uppercase' }}>SURVIVAL</div>
            <div style={{ fontSize: 14, color, fontWeight: 700, lineHeight: 1 }}>
              {score.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Survival bar */}
      <div style={{ height: 3, background: '#2a3238', marginBottom: 2 }}>
        <div style={{ width: `${Math.min(100, score)}%`, background: color, height: '100%', transition: 'width .5s' }} />
      </div>

      {/* Histogram */}
      <Histogram bins={option.robustness_histogram} color={color} />

      {/* Failure causes */}
      {causes.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 7, color: '#57606a', textTransform: 'uppercase', marginRight: 4 }}>TOP CAUSES:</span>
          {causes.map(c => <CauseTag key={c} cause={c} />)}
        </div>
      )}

      {/* Weakest mission */}
      {option.weakest_mission && option.weakest_mission !== 'N/A' && (
        <div style={{ fontSize: 8, color: '#57606a', marginTop: 3 }}>
          WEAKEST: <span style={{ color: '#e8a317' }}>{option.weakest_mission}</span>
        </div>
      )}
    </div>
  )
}

export default function RobustnessPanel() {
  const plan           = useStore(s => s.plan)
  const activePlanLabel = useStore(s => s.activePlanLabel)
  const generatePlan   = useStore(s => s.generatePlan)
  const recomputing    = useStore(s => s.recomputing)
  const options        = plan?.options ?? []

  // Find best option by robustness score
  const bestRob = options.reduce((best, o) =>
    (o.robustness_score ?? 0) > (best?.robustness_score ?? 0) ? o : best, null)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0"
           style={{ borderColor: '#2a3238', background: '#0f1316' }}>
        <span style={{ fontSize: 9, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          PLAN ROBUSTNESS  (500 MC RUNS)
        </span>
        {bestRob && (
          <span style={{ fontSize: 8, color: '#8fb56e' }}>
            BEST: PLAN {bestRob.label}
          </span>
        )}
      </div>

      {recomputing && (
        <div className="replan-pulse px-2 py-1 shrink-0"
             style={{ fontSize: 9, color: '#e8a317', borderBottom: '1px solid #1a2228' }}>
          RUNNING MONTE CARLO...
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {options.map(o => (
          <PlanRobustness key={o.label} option={o} active={o.label === activePlanLabel} />
        ))}
        {options.length === 0 && (
          <div style={{ fontSize: 10, color: '#57606a', padding: '10px 8px' }}>
            NO PLAN LOADED
          </div>
        )}
      </div>

      <div className="shrink-0 p-2 border-t" style={{ borderColor: '#2a3238' }}>
        <button
          onClick={generatePlan}
          disabled={recomputing}
          className="w-full py-1.5 text-[9px] tracking-widest uppercase border"
          style={{ color: '#e8a317', borderColor: '#e8a317', opacity: recomputing ? 0.5 : 1 }}
        >
          {recomputing ? 'RECOMPUTING...' : 'REFRESH ROBUSTNESS'}
        </button>
      </div>
    </div>
  )
}
