// ── GameHub play stats ───────────────────────────────────────────────────
// Kept in this browser only. Every time you open a game we count a play
// and mark today as a "played" day; time is added while the game's page
// is open and the tab is visible. Saved per player profile.

import { pkey } from './profiles.js'

const KEY = 'gamehub-stats-v1'

function blank() { return { games: {}, days: [] } }

export function loadStats(pid) {
  try {
    const s = JSON.parse(localStorage.getItem(pkey(KEY, pid)))
    if (s && typeof s === 'object' && s.games) return { ...blank(), ...s }
  } catch { /* storage unavailable */ }
  return blank()
}

function saveStats(s) {
  try { localStorage.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* storage unavailable */ }
}

export function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function recordPlay(id) {
  const s = loadStats()
  const g = s.games[id] || { plays: 0, seconds: 0, last: 0 }
  if (Date.now() - g.last < 1500) return // the same visit counted twice (React dev mode mounts twice)
  g.plays += 1
  g.last = Date.now()
  s.games[id] = g
  const today = dayKey()
  if (!s.days.includes(today)) s.days = [...s.days, today].slice(-400)
  saveStats(s)
}

export function addTime(id, seconds) {
  if (!(seconds > 0)) return
  const s = loadStats()
  const g = s.games[id] || { plays: 0, seconds: 0, last: Date.now() }
  g.seconds += Math.min(seconds, 4 * 3600) // never more than 4h from one sitting (a tab left open overnight)
  s.games[id] = g
  saveStats(s)
}

// Consecutive days played, counting back from today (or yesterday, so a
// streak isn't "broken" just because you haven't played yet today).
export function streaks(days) {
  const set = new Set(days)
  const step = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  let d = new Date()
  if (!set.has(dayKey(d))) d = step(d, -1)
  let current = 0
  while (set.has(dayKey(d))) { current++; d = step(d, -1) }
  let best = 0, run = 0, prev = null
  for (const k of [...set].sort()) {
    run = prev && dayKey(step(new Date(prev + 'T12:00:00'), 1)) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return { current, best }
}

export function summarize(stats, catalog) {
  const entries = Object.entries(stats.games)
  const plays = entries.reduce((n, [, g]) => n + g.plays, 0)
  const seconds = entries.reduce((n, [, g]) => n + g.seconds, 0)
  const tried = entries.filter(([id, g]) => g.plays > 0 && catalog[id]).length
  const fav = entries.filter(([id]) => catalog[id]).sort((a, b) => (b[1].seconds - a[1].seconds) || (b[1].plays - a[1].plays))[0]
  return { plays, seconds, tried, favorite: fav ? { id: fav[0], ...fav[1] } : null, ...streaks(stats.days) }
}

export function fmtDuration(sec) {
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
