// LEFT PANEL – advisories, disruption feed, inject & NL buttons
import { useStore } from '../store/useStore'
import { SEVERITY_COLOR } from '../utils/format'
import DisruptModal from './DisruptModal'

// ── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ sev }) {
  const color = SEVERITY_COLOR[sev] || '#57606a'
  return (
    <span style={{
      fontSize: 8, color, border: `1px solid ${color}44`,
      padding: '1px 5px', letterSpacing: '0.1em', textTransform: 'uppercase',
      background: `${color}0d`, flexShrink: 0,
    }}>
      {sev}
    </span>
  )
}

// ── Advisory item ─────────────────────────────────────────────────────────────
function AdvisoryItem({ item, onClick }) {
  const isCrit   = item.level === 'CRITICAL'
  const isHigh   = item.level === 'HIGH'
  const color    = isCrit ? '#d64545' : isHigh ? '#e8a317' : '#c9d1d9'
  const bgColor  = isCrit ? 'rgba(214,69,69,0.06)' : isHigh ? 'rgba(232,163,23,0.04)' : 'transparent'

  return (
    <div
      className={isCrit ? 'crit-advisory' : ''}
      onClick={onClick}
      style={{
        borderBottom: '1px solid #1e252a',
        borderLeft: `2px solid ${color}`,
        padding: '7px 10px',
        cursor: 'pointer',
        background: bgColor,
        transition: 'background 0.15s',
      }}
      title="View predictions"
    >
      <div style={{ fontSize: 10, color, lineHeight: 1.45, fontWeight: isCrit ? 600 : 400 }}>
        {item.text}
      </div>
    </div>
  )
}

// ── Feed item ──────────────────────────────────────────────────────────────────
function FeedItem({ item }) {
  return (
    <div
      className="feed-enter"
      style={{ borderBottom: '1px solid #1a2228', padding: '7px 10px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: '#57606a', letterSpacing: '0.06em' }}>{item.zulu}</span>
        <SeverityBadge sev={item.severity} />
      </div>
      <div style={{ fontSize: 11, color: '#c9d1d9', lineHeight: 1.45 }}>{item.text}</div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, amber }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 10px 4px',
      background: '#0f1316',
      borderBottom: '1px solid #2a3238',
    }}>
      <span style={{ fontSize: 9, color: amber ? '#e8a317' : '#57606a', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {count != null && (
        <span style={{
          fontSize: 9, color: count > 0 ? '#e8a317' : '#57606a',
          border: count > 0 ? '1px solid #e8a31744' : 'none',
          padding: count > 0 ? '0 5px' : 0,
          minWidth: 18, textAlign: 'center',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LeftPanel() {
  const disruptions         = useStore(s => s.disruptions)
  const advisories          = useStore(s => s.advisories)
  const showDisruptModal    = useStore(s => s.showDisruptModal)
  const setShowDisruptModal = useStore(s => s.setShowDisruptModal)
  const setShowNLBar        = useStore(s => s.setShowNLBar)
  const setActiveRightTab   = useStore(s => s.setActiveRightTab)

  return (
    <div style={{
      width: 252,
      display: 'flex',
      flexDirection: 'column',
      background: '#161b1f',
      borderRight: '1px solid #2a3238',
      minHeight: 0,
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* ── ADVISORIES section ── */}
      <SectionHeader label="ADVISORIES" count={advisories.length} amber />
      <div style={{ flexShrink: 0, maxHeight: 130, overflowY: 'auto' }}>
        {advisories.length === 0 ? (
          <div style={{ fontSize: 10, color: '#3a4248', padding: '8px 10px', fontStyle: 'italic' }}>
            NO ACTIVE ADVISORIES
          </div>
        ) : (
          advisories.slice(0, 4).map(a => (
            <AdvisoryItem
              key={a.id}
              item={a}
              onClick={() => setActiveRightTab('pred')}
            />
          ))
        )}
      </div>

      {/* ── DISRUPTION FEED section ── */}
      <SectionHeader label="DISRUPTION FEED" count={disruptions.length} />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {disruptions.length === 0 ? (
          <div style={{ fontSize: 10, color: '#3a4248', padding: '8px 10px', fontStyle: 'italic' }}>
            NO DISRUPTIONS LOGGED
          </div>
        ) : (
          disruptions.map(d => <FeedItem key={d.id} item={d} />)
        )}
      </div>

      {/* ── Action buttons ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #2a3238',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <button
          id="inject-btn"
          onClick={() => setShowDisruptModal(true)}
          style={{
            width: '100%',
            padding: '8px 0',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#e8a317',
            border: '1px solid #e8a317',
            background: 'rgba(232,163,23,0.06)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,163,23,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,163,23,0.06)'}
        >
          <span style={{ fontSize: 12 }}>⚡</span>
          INJECT DISRUPTION
          <span style={{ fontSize: 9, color: '#e8a31788', border: '1px solid #e8a31744', padding: '0 4px' }}>I</span>
        </button>

        <button
          onClick={() => setShowNLBar(true)}
          style={{
            width: '100%',
            padding: '7px 0',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#57606a',
            border: '1px solid #2a3238',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c9d1d9'; e.currentTarget.style.borderColor = '#3a4248' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#57606a'; e.currentTarget.style.borderColor = '#2a3238' }}
        >
          <span style={{ fontSize: 11 }}>◎</span>
          NL COMMAND
          <span style={{ fontSize: 9, color: '#57606a', border: '1px solid #2a3238', padding: '0 4px' }}>M</span>
        </button>
      </div>

      {showDisruptModal && <DisruptModal />}
    </div>
  )
}
