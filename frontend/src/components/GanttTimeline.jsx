// GANTT timeline – one row per aircraft, mission bars, turnaround blocks, duty markers, current-time cursor
import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { missionColor, ganttPos } from '../utils/format'

const SCENARIO_START = '2024-10-14T06:00:00Z'
const SCENARIO_HOURS = 8
const HOURS = Array.from({ length: SCENARIO_HOURS + 1 }, (_, i) => i)

// ── Grid + labels ─────────────────────────────────────────────────────────────
function HourGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {HOURS.map(h => (
        <div key={h} style={{
          position: 'absolute',
          left: `${(h / SCENARIO_HOURS) * 100}%`,
          top: 0, bottom: 0, width: 1,
          background: h === 0 ? '#2a3238' : '#1e252a',
        }} />
      ))}
    </div>
  )
}

function HourLabels({ rowLeft }) {
  const base = new Date(SCENARIO_START)
  return (
    <div style={{ position: 'relative', height: 20 }}>
      {HOURS.map(h => {
        const d   = new Date(base.getTime() + h * 3600000)
        const hh  = String(d.getUTCHours()).padStart(2, '0')
        const pct = (h / SCENARIO_HOURS) * 100
        return (
          <div key={h} style={{
            position: 'absolute',
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ width: 1, height: 4, background: '#2a3238', marginBottom: 1 }} />
            <span style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              {hh}00Z
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Current time cursor ───────────────────────────────────────────────────────
function CurrentTimeCursor() {
  const base  = new Date(SCENARIO_START).getTime()
  const total = SCENARIO_HOURS * 3600000
  const pct   = Math.max(0, Math.min(100, ((Date.now() - base) / total) * 100))

  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0,
      left: `${pct}%`, width: 1,
      background: '#e8a317', opacity: 0.8,
      pointerEvents: 'none', zIndex: 10,
    }}>
      {/* Tiny NOW label */}
      <div style={{
        position: 'absolute', top: 0, left: 2,
        fontSize: 7, color: '#e8a317', letterSpacing: '0.08em',
        background: '#0f1316', padding: '0 2px',
      }}>NOW</div>
    </div>
  )
}

// ── Turnaround hatch block ────────────────────────────────────────────────────
function TurnaroundBlock({ left, width }) {
  if (!width || width === '0%') return null
  return (
    <div style={{
      position: 'absolute', left, width,
      top: 4, height: 'calc(100% - 8px)',
      background: 'repeating-linear-gradient(45deg,#1e252a 0px,#1e252a 2px,transparent 2px,transparent 7px)',
      border: '1px solid #2a3238',
      opacity: 0.7,
    }} />
  )
}

// ── Duty limit marker ─────────────────────────────────────────────────────────
function DutyMarker({ dutyEndPct, crewName }) {
  const short = crewName?.split(' ').pop() ?? ''
  return (
    <div style={{
      position: 'absolute', left: `${dutyEndPct}%`,
      top: 0, bottom: 0, width: 1,
      background: '#d64545', opacity: 0.6,
      pointerEvents: 'none', zIndex: 8,
    }}>
      <div style={{
        position: 'absolute', bottom: '100%', left: 0,
        fontSize: 7, color: '#d64545', whiteSpace: 'nowrap',
        transform: 'translateX(-50%)', background: '#0f1316', padding: '0 2px',
        letterSpacing: '0.06em',
      }}>
        {short} DL
      </div>
    </div>
  )
}

// ── Row status dot ────────────────────────────────────────────────────────────
function StatusDot({ status, hasAssignment }) {
  const color = status === 'UNSERVICEABLE' ? '#d64545'
              : hasAssignment              ? '#e8a317'
              : '#3a4248'
  return (
    <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
  )
}

// ── Mission bar ───────────────────────────────────────────────────────────────
function MissionBar({ assignment, mission, color, acCallsign }) {
  const { left, width } = ganttPos(assignment.start_zulu, assignment.end_zulu, SCENARIO_START)

  // Turnaround: 30 min after end
  const tEndMs  = new Date(assignment.end_zulu).getTime() + 30 * 60000
  const turn    = ganttPos(assignment.end_zulu, new Date(tEndMs).toISOString(), SCENARIO_START)

  const isLowConf = assignment.low_conf
  const barBg     = isLowConf ? 'rgba(214,69,69,0.18)' : `${color}18`
  const barBorder = `1px solid ${isLowConf ? '#d64545' : color}`

  return (
    <>
      {/* Mission bar */}
      <div
        className="gantt-bar"
        style={{
          position: 'absolute', left, width,
          top: 5, height: 'calc(100% - 10px)',
          background: barBg, border: barBorder,
          zIndex: 5,
          display: 'flex', alignItems: 'center', overflow: 'hidden',
          cursor: 'default',
        }}
        title={`${acCallsign} – ${mission?.name ?? assignment.mission_id}`}
      >
        <span style={{
          fontSize: 9, color, paddingLeft: 4, whiteSpace: 'nowrap',
          overflow: 'hidden', letterSpacing: '0.04em', fontWeight: 600,
        }}>
          {mission?.name}
        </span>
        {isLowConf && (
          <span style={{
            fontSize: 7, color: '#d64545', marginLeft: 3,
            border: '1px solid #d6454566', padding: '0 2px',
          }}>LC</span>
        )}
      </div>
      {/* Turnaround hatch */}
      <TurnaroundBlock left={turn.left} width={turn.width} />
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
const LABEL_W = 96  // px width of the left callsign label column

export default function GanttTimeline() {
  const scenario       = useStore(s => s.scenario)
  const plan           = useStore(s => s.plan)
  const activePlanLabel = useStore(s => s.activePlanLabel)
  const recomputing    = useStore(s => s.recomputing)

  const aircraft  = scenario?.aircraft ?? []
  const crews     = scenario?.crews    ?? []
  const missions  = scenario?.missions ?? []

  const activeOption = plan?.options?.find(o => o.label === activePlanLabel)
  const assignments  = activeOption?.assignments ?? []

  const assignmentsByAc = useMemo(() => {
    const m = {}
    assignments.forEach(a => {
      if (!m[a.aircraft_id]) m[a.aircraft_id] = []
      m[a.aircraft_id].push(a)
    })
    return m
  }, [assignments])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0f1316', borderTop: '1px solid #2a3238',
      flex: 1, minHeight: 0,
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 10px', height: 26,
        borderBottom: '1px solid #2a3238', flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          MISSION TIMELINE
        </span>
        {recomputing && (
          <span className="replan-pulse" style={{
            marginLeft: 12, fontSize: 9, color: '#e8a317',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            RECOMPUTING...
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#57606a', letterSpacing: '0.06em' }}>
          {SCENARIO_START.slice(11, 16)}Z — +{SCENARIO_HOURS}H
        </span>
      </div>

      {/* Hour labels row */}
      <div style={{ paddingLeft: LABEL_W + 8, paddingRight: 8, flexShrink: 0 }}>
        <HourLabels rowLeft={LABEL_W} />
      </div>

      {/* Aircraft rows */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {aircraft.map(ac => {
          const acAssignments = assignmentsByAc[ac.id] || []
          const crew = crews.find(c => acAssignments[0] && c.id === acAssignments[0].crew_id)
          const dutyEndPct = crew
            ? Math.min(100, (crew.max_duty_hrs / SCENARIO_HOURS) * 100)
            : 100

          return (
            <div
              key={ac.id}
              style={{
                display: 'flex', alignItems: 'stretch',
                height: 34,
                borderBottom: '1px solid #1a2228',
              }}
            >
              {/* Callsign label */}
              <div style={{
                width: LABEL_W, flexShrink: 0,
                borderRight: '1px solid #2a3238',
                display: 'flex', alignItems: 'center',
                gap: 6, padding: '0 8px',
              }}>
                <StatusDot status={ac.status} hasAssignment={acAssignments.length > 0} />
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: ac.status === 'UNSERVICEABLE' ? '#d64545' : '#c9d1d9',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  letterSpacing: '0.03em',
                }}>
                  {ac.callsign}
                </span>
              </div>

              {/* Timeline area */}
              <div style={{ position: 'relative', flex: 1, height: '100%' }}>
                <HourGrid />
                <CurrentTimeCursor />

                {/* Duty limit marker */}
                {crew && <DutyMarker dutyEndPct={dutyEndPct} crewName={crew.name} />}

                {/* Mission bars */}
                {acAssignments.map(a => {
                  const m = missions.find(ms => ms.id === a.mission_id)
                  return (
                    <MissionBar
                      key={a.mission_id}
                      assignment={a}
                      mission={m}
                      color={missionColor(m?.type)}
                      acCallsign={ac.callsign}
                    />
                  )
                })}

                {/* Empty row hint */}
                {acAssignments.length === 0 && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center',
                    paddingLeft: 8,
                  }}>
                    <span style={{ fontSize: 8, color: '#2a3238', letterSpacing: '0.06em' }}>
                      UNASSIGNED
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
