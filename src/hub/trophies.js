// ── Trophy shelf ─────────────────────────────────────────────────────────
// Reads the scores and progress each game already saves in this browser
// and turns them into little shelf entries. Read-only: never writes to a
// game's save. Each reader returns null when there's nothing to show yet.
import { ACHIEVEMENTS } from '../games/totally-scary-horror-game/achievements.js'
import { TOTAL_WINS } from '../games/easy-game/wins.js'
import { LEVELS as GEO_LEVELS } from '../games/geometry-rush/engine.js'

function get(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function json(key) {
  try { const v = get(key); return v ? JSON.parse(v) : null } catch { return null }
}
function num(key) {
  const v = Number(get(key))
  return Number.isFinite(v) && v > 0 ? v : 0
}
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// medal: 'gold' | 'silver' | 'bronze' — how far along you are
const medal = (frac) => (frac >= 1 ? 'gold' : frac >= 0.5 ? 'silver' : 'bronze')

const READERS = {
  'totally-scary-horror-game': () => {
    const p = json('totallyScaryHorrorGame.progress.v1')
    if (!p) return null
    const got = Object.keys(p.achievements || {}).length
    const best = (p.records || []).filter(r => r.startFloor === 1).sort((a, b) => a.seconds - b.seconds)[0]
    if (!got && !best) return null
    return { medal: medal(got / ACHIEVEMENTS.length), stats: [`🏆 ${got}/${ACHIEVEMENTS.length} achievements`, best ? `⏱️ best escape ${fmtTime(best.seconds)}` : null] }
  },
  'easy-game': () => {
    const wins = json('easy-game-wins-v1')
    if (!wins?.length) return null
    return { medal: medal(wins.length / TOTAL_WINS), stats: [`🏆 ${wins.length}/${TOTAL_WINS} secret wins`] }
  },
  'retro-arcade': () => {
    const s = json('retro-arcade-high-scores-v1')
    const e = s && Object.entries(s).sort((a, b) => b[1] - a[1])
    if (!e?.length) return null
    return { medal: medal(e.length / 9), stats: [`🕹️ ${e.length} cabinets played`, `⭐ top score ${e[0][1].toLocaleString()}`] }
  },
  'geometry-rush': () => {
    const best = num('geometry-rush-best'), lv = json('geometry-rush-levels-complete') || []
    if (!best && !lv.length) return null
    return { medal: medal(lv.length / GEO_LEVELS.length), stats: [lv.length ? `✅ ${lv.length}/${GEO_LEVELS.length} levels beaten` : null, best ? `⭐ best ${best}` : null] }
  },
  'orbit-maze': () => {
    const t = json('orbit-maze-2d-best-times')
    const v = t && Object.values(t)
    if (!v?.length) return null
    return { medal: medal(v.length / 5), stats: [`🌀 ${v.length} mazes solved`, `⏱️ fastest ${fmtTime(Math.min(...v))}`] }
  },
  'kaboom-corral': () => {
    const s = json('kaboom-corral-stats-v1')
    if (!s?.gamesPlayed) return null
    return { medal: medal(s.gamesWon / 10), stats: [`💥 ${s.gamesWon} wins`, `🎮 ${s.gamesPlayed} games`] }
  },
  'snack-squad': () => {
    const s = json('snackSquadSaveV1')
    const kinds = s?.owned ? Object.keys(s.owned).filter(k => s.owned[k] > 0).length : 0
    if (!kinds) return null
    return { medal: medal(kinds / 60), stats: [`🍪 ${kinds} different cards`, `🪙 ${s.coins} coins`] }
  },
  'dino-suit-up': () => {
    const s = json('dino-suit-up-save-v1')
    if (!s) return null
    const n = (s.bossesDefeated || 0)
    return { medal: s.won ? 'gold' : medal(n / 6), stats: [s.won ? '👑 won the game!' : `🦖 suit tier ${s.player?.suitTier ?? 0}`, `💀 ${n} bosses beaten`] }
  },
  'lil-monster-battles': () => {
    const u = json('lilMonsterBattlesUnlocks')
    if (!u?.length) return null
    return { medal: medal(u.length / 4), stats: [`🐉 ${u.length}/4 legendaries unlocked`] }
  },
  'obvious-crossyroad-knockoff': () => {
    const h = num('obvious-crossyroad-knockoff:high-score')
    return h ? { medal: medal(h / 100), stats: [`🐔 best ${h} hops`] } : null
  },
  'flappy-goose': () => {
    const h = num('flappyGooseHigh')
    return h ? { medal: medal(h / 50), stats: [`🪿 high score ${h}`] } : null
  },
  'snake-clash': () => {
    const h = num('snakeClashHigh'), c = num('snakeClashCoins')
    return h ? { medal: medal(h / 300), stats: [`🐍 high score ${h}`, c ? `🪙 ${c} coins` : null] } : null
  },
  'school-prep': () => {
    const h = json('school-prep:history')
    if (!h?.length) return null
    const best = Math.max(...h.map(r => r.percent || 0))
    return { medal: medal(best / 100), stats: [`📝 ${h.length} rounds`, `⭐ best ${Math.round(best)}%`] }
  },
  'loot-and-scoot': () => {
    const s = json('loot-and-scoot-v1')
    if (!s?.jobsDone) return null
    return { medal: medal(s.jobsDone / 20), stats: [`💰 ${s.jobsDone} jobs done`, `💵 $${(s.cash || 0).toLocaleString()}`] }
  },
  'treasure-dig': () => {
    const s = json('treasure-dig-v1')
    const st = s?.stars ? Object.values(s.stars) : []
    if (!st.length) return null
    const total = st.reduce((a, b) => a + b, 0)
    return { medal: medal(total / 12), stats: [`🏝️ ${st.length}/4 islands`, `⭐ ${total}/12 stars`] }
  },
  'intergalactic-poker': () => {
    const w = num('intergalactic-poker-wallet')
    return w ? { medal: medal(w / 5000), stats: [`🪐 ${w.toLocaleString()} chips`] } : null
  },
}

export function readShelf(catalog) {
  const out = []
  for (const [id, read] of Object.entries(READERS)) {
    if (!catalog[id]) continue
    let r = null
    try { r = read() } catch { r = null }
    if (r) out.push({ id, game: catalog[id], medal: r.medal, stats: r.stats.filter(Boolean) })
  }
  const rank = { gold: 0, silver: 1, bronze: 2 }
  return out.sort((a, b) => rank[a.medal] - rank[b.medal])
}

// Which games have a shelf reader, and one game's current entry (or null) —
// the daily challenge compares these to spot a new record.
export const TROPHY_GAMES = Object.keys(READERS)
export function readTrophy(id) {
  try { const r = READERS[id]?.(); return r ? { medal: r.medal, stats: r.stats.filter(Boolean) } : null } catch { return null }
}
