// ── Favorites, ratings, game-of-the-week votes, New/Updated badges ───────
// Favorites are per profile. Ratings and votes are stored once for the
// whole browser, keyed by profile id inside, so the family view can add
// everyone's up.
import { pkey } from './profiles.js'
import { GAME_DATES } from './gameDates.js'
import { dayKey } from './playStats.js'

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function write(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ }
}

// ── Favorites ──
export const loadFavorites = () => read(pkey('gamehub-favorites'), [])
export function toggleFavorite(id) {
  const f = loadFavorites()
  const next = f.includes(id) ? f.filter(x => x !== id) : [id, ...f]
  write(pkey('gamehub-favorites'), next)
  return next
}

// ── Ratings: { gameId: { profileId: { stars, note, at } } } ──
const RATINGS = 'gamehub-ratings-v1'
export const loadRatings = () => read(RATINGS, {})
export function rate(gameId, profileId, stars, note) {
  const r = loadRatings()
  r[gameId] = { ...r[gameId], [profileId]: { stars, note: (note || '').trim().slice(0, 140), at: Date.now() } }
  write(RATINGS, r)
  return r
}
export function forgetProfileRatings(profileId) {
  const r = loadRatings()
  for (const g of Object.values(r)) delete g[profileId]
  write(RATINGS, r)
}
export function averageOf(entry) {
  const v = Object.values(entry || {})
  return v.length ? v.reduce((n, x) => n + x.stars, 0) / v.length : 0
}
// "Not now" on the after-play prompt: don't ask about that game again.
export const loadRateSkips = () => read(pkey('gamehub-rate-skip'), [])
export function skipRating(id) { write(pkey('gamehub-rate-skip'), [...new Set([...loadRateSkips(), id])].slice(-80)) }

// ── Game of the week ──
// Weeks start on Monday. Votes cast this week pick NEXT week's game.
export function weekIndex(d = new Date()) {
  const monday = new Date(2024, 0, 1) // a Monday
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((day - monday) / (7 * 86400000))
}
const VOTES = 'gamehub-votes-v1'
export const loadVotes = () => read(VOTES, {})
export function castVote(week, profileId, gameId) {
  const v = loadVotes()
  const w = { ...v[week], [profileId]: gameId }
  if (!gameId) delete w[profileId]
  // Only keep a few weeks around.
  const keep = Object.fromEntries(Object.entries({ ...v, [week]: w }).filter(([k]) => Number(k) >= week - 4))
  write(VOTES, keep)
  return keep
}
export function tally(votesForWeek) {
  const counts = {}
  for (const id of Object.values(votesForWeek || {})) counts[id] = (counts[id] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}
function hash(n) { let x = (n + 0x9e3779b9) | 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); return (x ^ (x >>> 16)) >>> 0 }
export function gameOfWeek(pool, week = weekIndex()) {
  const votes = loadVotes()[week]
  const top = tally(votes)[0]
  const voted = top && pool.find(g => g.id === top[0])
  if (voted) return { game: voted, votes: top[1] }
  return { game: pool[hash(week) % pool.length], votes: 0 }
}

// ── New / Updated badges ──
const daysSince = (iso) => (Date.parse(dayKey() + 'T12:00:00') - Date.parse(iso + 'T12:00:00')) / 86400000
export function freshness(game) {
  const d = GAME_DATES[game.path?.split('/')[1]]
  if (!d) return null
  if (daysSince(d.added) <= 14) return 'new'
  if (daysSince(d.updated) <= 10) return 'updated'
  return null
}
