import { create } from 'zustand'
import { apiFetch, isOffline, waitForServer, zuluNow } from '../api/client'
import {
  SCENARIO, MOCK_PLAN, MOCK_DISRUPTIONS,
  MOCK_ADVISORIES, MOCK_DIFF, MOCK_PREDICTIONS, MOCK_NEG_LOG,
  MOCK_CONTESTED_SOURCES, MOCK_JAMMED_POLYGON,
} from '../mock/data'

// ── helpers ──────────────────────────────────────────────────────────────────

function metricsFromPlan(plan, prevPlan, replanMs) {
  const bestOpt  = plan?.options?.find(o => o.label === plan.best_option) ?? plan?.options?.[0]
  const prevBest = prevPlan?.options?.find(o => o.label === prevPlan.best_option) ?? prevPlan?.options?.[0]
  return {
    planningTimeManual: '18 MIN',
    planningTimeSystem: plan?.planning_time_s != null
      ? `${(plan.planning_time_s * 1000).toFixed(0)} MS`
      : '-- MS',
    missionsCovered: bestOpt?.missions_covered ?? 0,
    missionsTotal:   plan?.options?.[0] != null
      ? (MOCK_PLAN.options[0].assignments.length + 2)   // total from seed
      : 8,
    utilisationBefore: prevBest
      ? `${prevBest.utilisation_pct?.toFixed(0) ?? '--'}%`
      : '42%',
    utilisationAfter: bestOpt
      ? `${bestOpt.utilisation_pct?.toFixed(0) ?? '--'}%`
      : '--',
    replanTime: replanMs != null ? `${replanMs} MS` : '-- MS',
  }
}

// Minimum 2-second UX pulse before showing results
async function withMinDelay(fn, minMs = 2000) {
  const [result] = await Promise.all([fn(), new Promise(r => setTimeout(r, minMs))])
  return result
}

// ── store ─────────────────────────────────────────────────────────────────────

export const useStore = create((set, get) => ({

  // ── connection state ────────────────────────────────────────────────────────
  online:  !isOffline(),
  offline:  isOffline(),
  waking:   false,

  // ── scenario ────────────────────────────────────────────────────────────────
  scenario: SCENARIO,

  // ── plan ────────────────────────────────────────────────────────────────────
  plan:            MOCK_PLAN,
  planHistory:     [],          // stack of { plan, diff, label } snapshots
  activePlanLabel: 'A',
  recomputing:     false,
  priorityWeight:  0.5,

  // ── disruptions / advisories ─────────────────────────────────────────────────
  disruptions: MOCK_DISRUPTIONS,
  advisories:  MOCK_ADVISORIES,

  // ── plan diff ────────────────────────────────────────────────────────────────
  diff:        MOCK_DIFF,
  pendingDiff: null,

  // ── predictions ──────────────────────────────────────────────────────────────
  predictions: MOCK_PREDICTIONS,

  // ── negotiation ───────────────────────────────────────────────────────────────
  negLog:  MOCK_NEG_LOG,
  negMeta: null,   // { elapsed_ms, scarcity, robustness, assignments }

  // ── contested ─────────────────────────────────────────────────────────────────
  contested:     false,
  sources:       [],
  jammedPolygon: [],

  // ── UI state ──────────────────────────────────────────────────────────────────
  showDisruptModal: false,
  showNLBar:        false,
  activeRightTab:   'diff',    // 'diff' | 'metrics' | 'history' | 'neglog'

  metrics: metricsFromPlan(MOCK_PLAN, null, null),

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECTION / SCENARIO
  // ─────────────────────────────────────────────────────────────────────────────

  /** Try live server; if first request takes >3s assume cold-start. */
  initApp: async () => {
    if (isOffline()) { set({ offline: true }); return }

    // probe health with a short timeout to detect cold-start
    let alive = false
    try {
      await apiFetch('/api/health', {}, 4000)
      alive = true
    } catch {
      // cold-start: poll until alive
      alive = await waitForServer(
        () => set({ waking: true }),
        () => set({ waking: false, online: true }),
        30000,
      )
    }

    if (!alive) { set({ offline: true, waking: false }); return }

    set({ waking: false, online: true, offline: false })
    await get().loadScenario()
    await get().generatePlan()
    await get().loadPredictions()
  },

  loadScenario: async () => {
    try {
      const sc = await apiFetch('/api/scenario')
      set({ scenario: sc, offline: false })
    } catch {
      set({ offline: true })
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PLAN GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  generatePlan: async () => {
    set({ recomputing: true })
    const t0 = performance.now()
    try {
      const { priorityWeight, plan: prevPlan } = get()
      const plan = await withMinDelay(() =>
        apiFetch('/api/plan', {
          method: 'POST',
          body: JSON.stringify({ priority_weight: priorityWeight, include_robustness: true }),
        })
      )
      const elapsed = Math.round(performance.now() - t0)
      set({
        plan,
        activePlanLabel: plan.best_option,
        recomputing: false,
        metrics: metricsFromPlan(plan, prevPlan, elapsed),
      })
    } catch {
      set({ recomputing: false })
    }
  },

  /** Called by the priority slider; debounced by 300ms in the component. */
  setPriorityWeight: async (w) => {
    set({ priorityWeight: w, recomputing: true })
    const t0 = performance.now()
    try {
      const { plan: prevPlan } = get()
      const plan = await withMinDelay(() =>
        apiFetch('/api/plan', {
          method: 'POST',
          body: JSON.stringify({ priority_weight: w, include_robustness: true }),
        })
      )
      const elapsed = Math.round(performance.now() - t0)
      set({
        plan,
        activePlanLabel: plan.best_option,
        recomputing: false,
        metrics: metricsFromPlan(plan, prevPlan, elapsed),
      })
    } catch {
      set({ recomputing: false })
    }
  },

  setActivePlanLabel: (label) => set({ activePlanLabel: label }),

  // ─────────────────────────────────────────────────────────────────────────────
  // DISRUPTION → REPLAN → DIFF
  // ─────────────────────────────────────────────────────────────────────────────

  injectDisruption: async (event) => {
    const feed = {
      id: Date.now(),
      zulu: zuluNow(),
      type: event.type,
      severity: event.severity,
      text: buildFeedText(event),
    }
    set(s => ({
      disruptions: [feed, ...s.disruptions],
      recomputing: true,
      showDisruptModal: false,
    }))

    const t0 = performance.now()
    try {
      const dr = await withMinDelay(() =>
        apiFetch('/api/disruption', { method: 'POST', body: JSON.stringify(event) })
      )
      const elapsed = Math.round(performance.now() - t0)
      const { plan: prevPlan } = get()
      const newAdvs = (dr.advisories || []).map((a, i) => ({
        id: `adv-${Date.now()}-${i}`,
        text: a,
        level: 'HIGH',
      }))
      set(s => ({
        plan:        dr.new_plan,
        pendingDiff: dr.diff,
        advisories:  [...newAdvs, ...s.advisories].slice(0, 20),
        recomputing: false,
        metrics:     metricsFromPlan(dr.new_plan, prevPlan, elapsed),
      }))
    } catch {
      // offline: generate a mock diff showing the disruption effect
      const mockDiff = buildMockDiff(event)
      set({ pendingDiff: mockDiff, recomputing: false })
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCEPT / REJECT / UNDO
  // ─────────────────────────────────────────────────────────────────────────────

  acceptDiff: () => {
    set(s => {
      const snapshot = {
        plan:  s.plan,
        diff:  s.diff,
        label: `Plan ${s.plan?.plan_id ?? '?'} @ ${zuluNow()}`,
      }
      return {
        planHistory: [snapshot, ...s.planHistory.slice(0, 9)],
        diff:        s.pendingDiff ?? s.diff,
        pendingDiff: null,
      }
    })
  },

  rejectDiff: () => set({ pendingDiff: null }),

  undoPlan: () => {
    set(s => {
      if (!s.planHistory.length) return {}
      const [prev, ...rest] = s.planHistory
      return {
        plan:        prev.plan,
        diff:        prev.diff,
        planHistory: rest,
      }
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PREDICTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  loadPredictions: async () => {
    try {
      const p = await apiFetch('/api/predictions')
      // Merge advisory text into advisories strip for high-risk aircraft
      const newAdvs = p.aircraft
        .filter(a => a.advisory)
        .map(a => ({ id: `pred-${a.aircraft_id}`, text: a.advisory, level: a.risk_level }))
      set(s => ({
        predictions: p,
        advisories:  dedup([...newAdvs, ...s.advisories], 'id').slice(0, 20),
      }))
    } catch { /* stay on mock */ }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTESTED
  // ─────────────────────────────────────────────────────────────────────────────

  toggleContested: async () => {
    const next = !get().contested
    set({ contested: next })
    try {
      const r = await apiFetch('/api/contested', {
        method: 'POST',
        body: JSON.stringify({
          enable: next,
          jammed_sources: next ? ['comms', 'radar'] : [],
        }),
      })
      set({ sources: r.sources, jammedPolygon: r.jammed_polygon })
    } catch {
      // offline fallback: show mock contested data so UI renders correctly
      set({
        sources:       next ? MOCK_CONTESTED_SOURCES : [],
        jammedPolygon: next ? MOCK_JAMMED_POLYGON    : [],
      })
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NEGOTIATION
  // ─────────────────────────────────────────────────────────────────────────────

  runNegotiation: async () => {
    set({ recomputing: true })
    try {
      const r = await withMinDelay(() =>
        apiFetch('/api/negotiate', { method: 'POST', body: '{}' })
      )
      set({
        negLog:  r.negotiation_log,
        negMeta: {
          elapsed_ms:  r.elapsed_ms,
          scarcity:    r.scarcity,
          robustness:  r.robustness,
          assignments: r.assignments,
        },
        recomputing:    false,
        activeRightTab: 'neglog',
      })
    } catch {
      set({ recomputing: false, activeRightTab: 'neglog' })
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NL COMMAND
  // ─────────────────────────────────────────────────────────────────────────────

  nlCommand: async (text, commit) => {
    try {
      const r = await apiFetch('/api/nl', {
        method: 'POST',
        body: JSON.stringify({ text, commit }),
      })
      if (!r.is_what_if && r.plan_diff) {
        set({ pendingDiff: r.plan_diff })
      }
      return r
    } catch {
      // offline: try regex parse locally
      return localNLParse(text, commit)
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  setShowDisruptModal: (v) => set({ showDisruptModal: v }),
  setShowNLBar:        (v) => set({ showNLBar: v }),
  setActiveRightTab:   (v) => set({ activeRightTab: v }),
}))

// ── local helpers ─────────────────────────────────────────────────────────────

function buildFeedText(event) {
  const labels = {
    AIRCRAFT_UNSERVICEABLE: `Aircraft ${event.target_id} declared unserviceable`,
    CREW_UNAVAILABLE:       `Crew ${event.target_id} removed from flying duties`,
    WEATHER_CLOSING:        `Weather deterioration – ${event.detail || 'route area'}`,
    NEW_THREAT:             `New threat zone activated${event.detail ? ': ' + event.detail : ''}`,
    COMMS_JAM:              `Comms jamming event detected`,
    PRIORITY_CHANGE:        `Mission ${event.target_id} priority changed`,
  }
  return labels[event.type] || event.detail || event.type
}

function buildMockDiff(event) {
  // When offline, generate a plausible diff for the disruption type
  const base = {
    plan_before_id: 'mock-before',
    plan_after_id:  'mock-after',
    disruption_summary: `${event.type}: ${event.target_id || ''} at ${zuluNow()}`,
    diffs: [],
  }
  if (event.type === 'AIRCRAFT_UNSERVICEABLE' && event.target_id) {
    base.diffs.push({
      mission_id: 'M01',
      before: `AC:${event.target_id} CR:CR01`,
      after:  'REASSIGNING...',
      reason: `${event.target_id} removed – finding substitute`,
      confidence: 0.85,
      low_conf: false,
    })
  }
  return base
}

function localNLParse(text, commit) {
  const lower = text.toLowerCase()
  const isWhatIf = /what if|what happens|hypothet|suppose|if we|if weather/.test(lower)
  const m = lower.match(/(viper|raptor|hawk|ghost)\s*(\d+)\s+(is\s+)?(down|u\/s|broken|unserviceable)/)
  if (m) {
    return {
      intent: 'AIRCRAFT_UNSERVICEABLE',
      explanation: `[OFFLINE] ${m[1].toUpperCase()} ${m[2]} flagged as unserviceable. Backend needed to replan.`,
      is_what_if: true,
    }
  }
  return {
    intent: 'UNKNOWN',
    explanation: 'Backend offline – typed commands require a live connection to re-plan.',
    is_what_if: true,
  }
}

function dedup(arr, key) {
  const seen = new Set()
  return arr.filter(x => {
    if (seen.has(x[key])) return false
    seen.add(x[key])
    return true
  })
}
