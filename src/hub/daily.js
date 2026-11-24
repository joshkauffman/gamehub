// ── Daily challenge ──────────────────────────────────────────────────────
// One small goal per player per day, picked from today's date so it's the
// same all day. When the day's challenge is first shown we snapshot a
// "baseline" (time played, games tried, trophy entries, …); progress is
// measured against that, so only things done today count.
import { pkey } from './profiles.js'
import { loadStats, dayKey, streaks } from './playStats.js'
import { loadRatings, loadFavorites } from './social.js'
import { HUB_SECRETS, loadFound } from './secrets.js'
import { TROPHY_GAMES, readTrophy } from './trophies.js'

const KEY = 'gamehub-daily'

function rngFrom(str) {
  let h = 2166136261
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }

function load() {
  try { return { doneDays: [], ...JSON.parse(localStorage.getItem(pkey(KEY))) } } catch { return { doneDays: [] } }
}
function save(d) {
  try { localStorage.setItem(pkey(KEY), JSON.stringify(d)) } catch { /* storage unavailable */ }
}

// pool: playable games (no secret or external ones). sections: [{name, games}].
function pick(pid, pool, sections) {
  const rnd = rngFrom(dayKey() + pid)
  const one = (arr) => arr[Math.floor(rnd() * arr.length)]
  const stats = loadStats()
  const tried = new Set(Object.keys(stats.games).filter(id => stats.games[id].plays > 0))
  const untried = pool.filter(g => !tried.has(g.id))
  const unfound = HUB_SECRETS.filter(s => !loadFound()[s.id])
  const trophyPool = pool.filter(g => TROPHY_GAMES.includes(g.id))
  const cats = sections.filter(s => s.games.length >= 3)
  const solo = pool.filter(g => g.category !== 'Tools & Hangouts') // not much of a challenge to sit in the dice roller

  const kinds = [
    () => { const g = one(solo); return { type: 'play', game: g.id, text: `Play ${g.emoji} ${g.title}` } },
    () => { const g = one(solo); return { type: 'time', game: g.id, need: 300, text: `Spend 5 minutes playing ${g.emoji} ${g.title}` } },
    () => untried.length && { type: 'new', text: 'Try a game you have never played before' },
    () => ({ type: 'three', need: 3, text: 'Play 3 different games today' }),
    () => { const c = cats.length && one(cats); return c && { type: 'category', cat: c.name, need: 2, text: `Play 2 different ${c.name} games` } },
    () => { const g = trophyPool.length && one(trophyPool); return g && { type: 'record', game: g.id, text: readTrophy(g.id) ? `Beat your best (or improve your trophy) in ${g.emoji} ${g.title}` : `Get ${g.emoji} ${g.title} onto your Trophy Shelf` } },
    () => ({ type: 'rate', need: 2, text: 'Give star ratings to 2 games' }),
    () => unfound.length && { type: 'secret', secret: one(unfound).id, text: 'Find a hub secret you haven’t found yet' },
    () => loadFavorites().length < 4 && { type: 'favorite', text: 'Add a game to your ❤️ favorites' },
  ]
  for (let tries = 0; tries < 20; tries++) {
    const c = one(kinds)()
    if (c) return c
  }
  return { type: 'three', need: 3, text: 'Play 3 different games today' }
}

function baselineFor(ch) {
  const stats = loadStats()
  if (ch.type === 'time') return stats.games[ch.game]?.seconds || 0
  if (ch.type === 'new') return Object.keys(stats.games).filter(id => stats.games[id].plays > 0)
  if (ch.type === 'record') return JSON.stringify(readTrophy(ch.game))
  if (ch.type === 'favorite') return loadFavorites()
  return null
}

// Today's challenge for the active profile (creating it if needed).
export function todaysChallenge(pid, pool, sections) {
  const d = load()
  if (d.today?.date === dayKey()) return d
  const ch = pick(pid, pool, sections)
  const next = { ...d, today: { date: dayKey(), ch, base: baselineFor(ch), done: false } }
  save(next)
  return next
}

// { have, need, done }
export function progressOf(today, pid, sectionsByName) {
  const { ch, base } = today
  const stats = loadStats()
  const t0 = startOfToday()
  const playedToday = Object.entries(stats.games).filter(([, g]) => g.last >= t0).map(([id]) => id)
  let have = 0, need = ch.need || 1
  switch (ch.type) {
    case 'play': have = playedToday.includes(ch.game) ? 1 : 0; break
    case 'time': have = Math.min(need, Math.floor((stats.games[ch.game]?.seconds || 0) - (base || 0))); break
    case 'new': have = playedToday.some(id => !base.includes(id)) ? 1 : 0; break
    case 'three': have = playedToday.length; break
    case 'category': {
      const ids = new Set((sectionsByName[ch.cat] || []).map(g => g.id))
      have = playedToday.filter(id => ids.has(id)).length
      break
    }
    case 'record': { const now = readTrophy(ch.game); have = now && JSON.stringify(now) !== base ? 1 : 0; break }
    case 'rate': have = Object.values(loadRatings()).filter(g => g[pid]?.at >= t0).length; break
    case 'secret': have = Object.values(loadFound()).includes(dayKey()) ? 1 : 0; break
    case 'favorite': have = loadFavorites().some(id => !base.includes(id)) ? 1 : 0; break
    default: break
  }
  return { have: Math.max(0, Math.min(have, need)), need, done: have >= need }
}

// Marks today done (once). Returns the updated record, or null if it was already done.
export function completeToday() {
  const d = load()
  if (!d.today || d.today.done) return null
  const next = { ...d, today: { ...d.today, done: true }, doneDays: [...new Set([...d.doneDays, d.today.date])].slice(-400) }
  save(next)
  return next
}

export function challengeStreak(doneDays) { return { ...streaks(doneDays), total: doneDays.length } }
export function secretHint(id) { return HUB_SECRETS.find(s => s.id === id)?.hint }
