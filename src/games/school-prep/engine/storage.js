// All School Prep state lives in the browser only — no server, no accounts.
const ROUND_KEY = 'school-prep:round'
const HISTORY_KEY = 'school-prep:history'
const SEEN_KEY = 'school-prep:seen'

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
