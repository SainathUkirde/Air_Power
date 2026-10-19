// Full NL command bar with Web Speech API mic + typed fallback.
// WHAT-IF mode (default) → no state change, shows explanation only.
// COMMIT mode → triggers actual disruption/replan if structured event returned.
import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

// ── Web Speech API hook ───────────────────────────────────────────────────────
function useSpeechRecognition(onResult, onError) {
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setSupported(false); return }
    setSupported(true)

    const rec = new SpeechRecognition()
    rec.lang           = 'en-US'
    rec.continuous     = false
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onResult(transcript)
      setListening(false)
    }
    rec.onerror = (e) => {
      onError(e.error)
      setListening(false)
    }
    rec.onend = () => setListening(false)

    recRef.current = rec
  }, [])

  const start = useCallback(() => {
    if (!recRef.current) return
    try { recRef.current.start(); setListening(true) }
    catch { setListening(false) }
  }, [])

  const stop = useCallback(() => {
    if (!recRef.current) return
    try { recRef.current.stop() }
    catch {}
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}

// ── example commands shown in placeholder rotation ───────────────────────────
const EXAMPLES = [
  'VIPER 12 is down, what\'s the best re-plan?',
  'What breaks if weather worsens at 1400?',
  'What if GHOST 41 is unavailable?',
  'Escalate STRIKE ALPHA to priority 1',
  'Jam comms on north sector',
]

// ── result card ───────────────────────────────────────────────────────────────
function ResultCard({ result }) {
  if (!result) return null
  const isWhatIf  = result.is_what_if
  const color     = isWhatIf ? '#e8a317' : '#8fb56e'
  const label     = isWhatIf ? 'WHAT-IF' : 'COMMITTED'

  return (
    <div style={{
      marginTop: 4,
      border: `1px solid ${color}22`,
      background: `${color}08`,
      padding: '6px 8px',
    }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 8, color, border: `1px solid ${color}`, padding: '0 3px', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontSize: 8, color: '#57606a' }}>{result.intent}</span>
        {result.plan_diff && (
          <span style={{ fontSize: 8, color: '#8fb56e', marginLeft: 'auto' }}>
            DIFF READY
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: '#c9d1d9', lineHeight: 1.4 }}>
        {result.explanation}
      </div>
    </div>
  )
}

// ── history item ──────────────────────────────────────────────────────────────
function HistoryItem({ item, onReplay }) {
  return (
    <button
      onClick={() => onReplay(item.text)}
      className="w-full text-left border-b px-2 py-1"
      style={{ borderColor: '#1a2228', background: 'transparent' }}
    >
      <div style={{ fontSize: 9, color: '#57606a' }}>{item.text}</div>
      <div style={{ fontSize: 8, color: '#2a3238' }}>{item.zulu}</div>
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function NLCommandBar() {
  const nlCommand    = useStore(s => s.nlCommand)
  const setShowNLBar = useStore(s => s.setShowNLBar)
  const setActiveRightTab = useStore(s => s.setActiveRightTab)

  const [text,       setText]       = useState('')
  const [commit,     setCommit]     = useState(false)
  const [result,     setResult]     = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [history,    setHistory]    = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [micError,   setMicError]   = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const inputRef = useRef(null)

  // Rotate placeholder text
  useEffect(() => {
    const t = setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLES.length), 4000)
    return () => clearInterval(t)
  }, [])

  const { listening, supported, start, stop } = useSpeechRecognition(
    (transcript) => { setText(transcript); setMicError('') },
    (err) => setMicError(`MIC: ${err.toUpperCase()}`)
  )

  async function submit(e) {
    e?.preventDefault()
    const q = text.trim()
    if (!q) return
    setLoading(true)
    setResult(null)

    const zulu = zuluNow()
    const r = await nlCommand(q, commit)
    setResult(r)
    setLoading(false)

    // Push to history
    setHistory(prev => [{ text: q, zulu, result: r }, ...prev.slice(0, 9)])

    // If committed and a diff came back, switch to diff tab
    if (!r.is_what_if && r.plan_diff) {
      setActiveRightTab('diff')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') { setShowNLBar(false) }
  }

  function toggleMic() {
    if (listening) stop()
    else { setMicError(''); start() }
  }

  return (
    <div
      className="border-t flex flex-col"
      style={{
        background: '#0f1316', borderColor: '#2a3238',
        padding: '8px', gap: 6, maxHeight: 260,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ fontSize: 9, color: '#e8a317', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          NL COMMAND
        </span>
        <span style={{ fontSize: 8, color: '#57606a' }}>
          {commit ? 'COMMIT MODE' : 'WHAT-IF MODE'}
        </span>
        <div className="flex-1" />

        {/* WHAT-IF / COMMIT toggle */}
        <button
          onClick={() => setCommit(c => !c)}
          className="text-[8px] px-2 py-0.5 border tracking-widest uppercase"
          style={{
            color:       commit ? '#d64545' : '#57606a',
            borderColor: commit ? '#d64545' : '#2a3238',
            background:  commit ? 'rgba(214,69,69,0.08)' : 'transparent',
          }}
        >
          {commit ? 'COMMIT' : 'WHAT-IF'}
        </button>

        {/* History toggle */}
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(s => !s)}
            style={{ fontSize: 8, color: '#57606a' }}
          >
            HIST ({history.length})
          </button>
        )}

        <button onClick={() => setShowNLBar(false)} style={{ color: '#57606a', fontSize: 12 }}>
          ✕
        </button>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="shrink-0 border overflow-y-auto" style={{ borderColor: '#2a3238', maxHeight: 80 }}>
          {history.map((h, i) => (
            <HistoryItem key={i} item={h} onReplay={(t) => { setText(t); setShowHistory(false); inputRef.current?.focus() }} />
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={submit} className="flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={EXAMPLES[exampleIdx]}
          className="flex-1 px-2 py-1 border text-[11px]"
          style={{ background: '#161b1f', color: '#c9d1d9', borderColor: '#2a3238', outline: 'none' }}
          autoFocus
        />

        {/* Mic button */}
        {supported && (
          <button
            type="button"
            onClick={toggleMic}
            className="px-2 py-1 border text-[10px] tracking-widest"
            style={{
              color:       listening ? '#d64545' : '#57606a',
              borderColor: listening ? '#d64545' : '#2a3238',
              background:  listening ? 'rgba(214,69,69,0.12)' : 'transparent',
              minWidth: 36,
            }}
            title={listening ? 'Stop listening' : 'Start voice input (M)'}
          >
            {listening ? '●' : '⊙'}
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-3 py-1 border text-[10px] tracking-widest uppercase"
          style={{
            color:      loading ? '#57606a' : '#e8a317',
            borderColor: loading ? '#2a3238' : '#e8a317',
            opacity: (!text.trim() && !loading) ? 0.4 : 1,
          }}
        >
          {loading ? '...' : 'SEND'}
        </button>
      </form>

      {/* Mic error */}
      {micError && (
        <div style={{ fontSize: 9, color: '#d64545' }}>{micError}</div>
      )}

      {/* Listening indicator */}
      {listening && (
        <div className="replan-pulse shrink-0" style={{ fontSize: 9, color: '#d64545', letterSpacing: '0.12em' }}>
          LISTENING...
        </div>
      )}

      {/* Result */}
      <div className="overflow-y-auto" style={{ minHeight: 0 }}>
        <ResultCard result={result} />
      </div>
    </div>
  )
}

function zuluNow() {
  const d  = new Date()
  const dd = String(d.getUTCDate()).padStart(2,'0')
  const hh = String(d.getUTCHours()).padStart(2,'0')
  const mm = String(d.getUTCMinutes()).padStart(2,'0')
  const mo = d.toLocaleString('en-US', { month:'short', timeZone:'UTC' }).toUpperCase()
  return `${dd}${hh}${mm}Z ${mo}`
}
