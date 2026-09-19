// All School Prep state lives in the browser only — no server, no accounts.
const ROUND_KEY = 'school-prep:round'
const HISTORY_KEY = 'school-prep:history'
const SEEN_KEY = 'school-prep:seen'
const VISITS_KEY = 'school-prep:visits'
const VISITOR_ID_KEY = 'school-prep:visitor-id'

export function saveRound(round) {
  try {
    localStorage.setItem(ROUND_KEY, JSON.stringify(round))
  } catch { /* private-browsing / quota — practice still works, just isn't resumable */ }
}

export function loadRound() {
  try {
    const raw = localStorage.getItem(ROUND_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearRound() {
  try {
    localStorage.removeItem(ROUND_KEY)
  } catch { /* ignore */ }
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function appendHistory(entry) {
  const history = loadHistory()
  history.unshift(entry)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)))
  } catch { /* ignore */ }
}

// Question ids seen recently, per subject, so a round prefers fresh material.
export function loadSeen(subject) {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[subject] || []
  } catch {
    return []
  }
}

export function markSeen(subject, ids) {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const prior = all[subject] || []
    // Keep the last 3 rounds' worth (roughly) so "seen recently" fades over time.
    all[subject] = [...ids, ...prior].slice(0, 200)
    localStorage.setItem(SEEN_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

// Secret page-visit counter (per browser). Shown by clicking the "P" in the
// Setup title.
export function loadVisits() {
  try {
    return Number(localStorage.getItem(VISITS_KEY)) || 0
  } catch {
    return 0
  }
}

export function recordVisit() {
  const next = loadVisits() + 1
  try {
    localStorage.setItem(VISITS_KEY, String(next))
  } catch { /* ignore */ }
  return next
}

// Anonymous random id used only to count unique visitors server-side. Null if
// localStorage is unavailable (that open still counts, just not as unique).
function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

// Global open + unique-visitor counters, kept server-side (api/visits.js).
// Resolves to { opens, uniques }, or null when the API is unreachable (e.g.
// plain `vite dev`), so callers can fall back to the per-browser count.
export async function recordGlobalVisit() {
  try {
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId() }),
    })
    if (!res.ok) return null
    const { opens, uniques } = await res.json()
    return Number.isFinite(opens) && Number.isFinite(uniques) ? { opens, uniques } : null
  } catch {
    return null
  }
}
