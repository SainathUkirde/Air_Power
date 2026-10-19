// Shared micro-utilities used across components

export function zuluClock() {
  const d = new Date()
  const dd = String(d.getUTCDate()).padStart(2,'0')
  const hh = String(d.getUTCHours()).padStart(2,'0')
  const mm = String(d.getUTCMinutes()).padStart(2,'0')
  const ss = String(d.getUTCSeconds()).padStart(2,'0')
  const mo = d.toLocaleString('en-US',{month:'short',timeZone:'UTC'}).toUpperCase()
  const yr = d.getUTCFullYear()
  return `${dd}${hh}${mm}Z ${mo} ${yr}`
}

export const SEVERITY_COLOR = {
  CRITICAL: '#d64545',
  HIGH:     '#e8a317',
  MEDIUM:   '#c9d1d9',
  LOW:      '#57606a',
}

export const ROLE_COLOR = {
  STRIKE: '#e8a317',
  SEAD:   '#d64545',
  CAS:    '#7eb8d4',
  ISR:    '#8fb56e',
}

export function missionColor(type) {
  return ROLE_COLOR[type] || '#c9d1d9'
}

export function pctBarStyle(pct, color='#e8a317') {
  return { width:`${Math.min(100,pct)}%`, background: color, height:'3px', transition:'width .4s' }
}

export function hoursToLabel(isoStr) {
  const d = new Date(isoStr)
  const hh = String(d.getUTCHours()).padStart(2,'0')
  const mm = String(d.getUTCMinutes()).padStart(2,'0')
  return `${hh}${mm}Z`
}

// Given an assignment's start/end, return left% and width% on a timeline
// that spans scenarioStart → scenarioStart + 8h
export function ganttPos(startIso, endIso, scenarioStartIso) {
  const base  = new Date(scenarioStartIso).getTime()
  const total = 8 * 60 * 60 * 1000
  const s     = new Date(startIso).getTime() - base
  const e     = new Date(endIso).getTime()   - base
  return {
    left:  `${Math.max(0, s/total*100).toFixed(2)}%`,
    width: `${Math.max(0.5, (e-s)/total*100).toFixed(2)}%`,
  }
}
