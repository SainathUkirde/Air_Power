// API client with timeout, Render cold-start detection, and offline fallback.
// All backend calls go through here so retry/timeout logic is centralised.

const API_BASE = import.meta.env.VITE_API_URL || ''
const TIMEOUT_MS = 12000   // 12s default; cold-start can take up to 30s handled by caller

export const isOffline = () => !API_BASE

/**
 * Fetch with timeout. Throws on network error, non-2xx, or offline.
 * @param {string} path  e.g. '/api/plan'
 * @param {RequestInit} opts
 * @param {number} timeoutMs
 */
export async function apiFetch(path, opts = {}, timeoutMs = TIMEOUT_MS) {
  if (!API_BASE) throw new Error('OFFLINE')

  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(tid)
  }
}

/**
 * Poll /api/health until it responds (for Render cold-start).
 * onWaking() called immediately, onAlive() when server responds.
 * Gives up after maxWaitMs.
 */
export async function waitForServer(onWaking, onAlive, maxWaitMs = 30000) {
  onWaking()
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    try {
      await apiFetch('/api/health', {}, 5000)
      onAlive()
      return true
    } catch {
      await sleep(2000)
    }
  }
  return false  // gave up
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// Zulu timestamp string for feed items
export function zuluNow() {
  const d  = new Date()
  const dd = String(d.getUTCDate()).padStart(2,'0')
  const hh = String(d.getUTCHours()).padStart(2,'0')
  const mm = String(d.getUTCMinutes()).padStart(2,'0')
  const mo = d.toLocaleString('en-US', { month:'short', timeZone:'UTC' }).toUpperCase()
  const yy = String(d.getUTCFullYear()).slice(2)
  return `${dd}${hh}${mm}Z ${mo} ${yy}`
}
