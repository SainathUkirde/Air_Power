// Full-screen recomputing overlay shown during any plan generation (min 2s).
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

const STAGES = [
  'PARSING SCENARIO STATE...',
  'EVALUATING CONSTRAINTS...',
  'RUNNING CP-SAT OPTIMISER...',
  'SCORING OPTIONS A / B / C...',
  'RUNNING MONTE CARLO (500)...',
  'ASSEMBLING PLAN DIFF...',
]

export default function RecomputingOverlay() {
  const recomputing = useStore(s => s.recomputing)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!recomputing) { setStage(0); return }
    setStage(0)
    let i = 0
    const t = setInterval(() => {
      i++
      setStage(Math.min(i, STAGES.length - 1))
    }, 330)
    return () => clearInterval(t)
  }, [recomputing])

  if (!recomputing) return null

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center"
      style={{ background: 'rgba(15,19,22,0.72)', pointerEvents: 'none' }}
    >
      <div
        className="flex flex-col items-center gap-4 border px-10 py-7"
        style={{ background: '#161b1f', borderColor: '#e8a317', minWidth: 260 }}
      >
        {/* Title */}
        <div style={{ fontSize: 10, color: '#e8a317', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          RECOMPUTING PLAN
        </div>

        {/* Animated dot row */}
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 5, height: 5, background: '#e8a317',
                animation: `replan-pulse 0.8s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Stage text */}
        <div style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.10em', minHeight: 14, textAlign: 'center' }}>
          {STAGES[stage]}
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 2, background: '#2a3238' }}>
          <div
            style={{
              height: '100%',
              background: '#e8a317',
              width: `${((stage + 1) / STAGES.length) * 100}%`,
              transition: 'width 0.32s ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}
