// PRIORITY vs RISK slider – debounced 300ms, triggers re-optimisation
import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'

export default function PrioritySlider() {
  const priorityWeight    = useStore(s => s.priorityWeight)
  const setPriorityWeight = useStore(s => s.setPriorityWeight)
  const recomputing       = useStore(s => s.recomputing)
  const debounceRef       = useRef(null)
  const [localVal, setLocalVal] = useState(priorityWeight)

  function handleChange(e) {
    const v = parseFloat(e.target.value)
    setLocalVal(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setPriorityWeight(v), 300)
  }

  const pPct = Math.round(localVal * 100)
  const rPct = 100 - pPct

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 12px', height: 34,
      background: '#0f1316', borderTop: '1px solid #2a3238',
      flexShrink: 0,
    }}>
      {/* Left label */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, minWidth: 48 }}>
        <span style={{ fontSize: 7, color: '#57606a', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>
          RISK
        </span>
        <span style={{ fontSize: 10, color: '#d64545', fontWeight: 600 }}>{rPct}%</span>
      </div>

      {/* Slider */}
      <input
        type="range" min={0} max={1} step={0.05}
        value={localVal}
        onChange={handleChange}
        disabled={recomputing}
        style={{ flex: 1 }}
      />

      {/* Right label */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexShrink: 0, minWidth: 56 }}>
        <span style={{ fontSize: 7, color: '#57606a', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>
          PRIORITY
        </span>
        <span style={{ fontSize: 10, color: '#8fb56e', fontWeight: 600 }}>{pPct}%</span>
      </div>

      {/* Recomputing tag */}
      {recomputing && (
        <span className="replan-pulse" style={{
          fontSize: 8, color: '#e8a317', letterSpacing: '0.1em',
          border: '1px solid #e8a31744', padding: '2px 6px',
        }}>
          RECOMPUTING
        </span>
      )}
    </div>
  )
}
