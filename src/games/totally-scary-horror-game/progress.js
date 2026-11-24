// ── The Totally Scary Horror Game — saved progress ─────────────────────
// Everything that outlives a single run (besides the journal): unlocked
// achievements, monster photos, the local leaderboard, chosen difficulty,
// your scoreboard name, perks, and a few lifetime counters. One
// localStorage key, every access wrapped in try/catch so blocked storage
// just means progress isn't kept.

const KEY = 'totallyScaryHorrorGame.progress.v1'

function blank() {
  return {
    achievements: {}, // id -> unlock timestamp
    photos: {}, // monster id -> small jpeg data URL
    records: [], // { name, seconds, catches, dodges, coins, difficulty, startFloor, date }
    settings: { difficulty: 'normal', name: '', startFloor: 1 },
    perks: { allowance: false },
    wallet: 0, // tips you've carried out of the hotel, kept between runs
    unlocks: { floor3: false, floor4: false, floor13: false },
    stats: { popped: 0, runs: 0, escapes: 0, summoned: false },
  }
}

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      const b = blank()
      return { ...b, ...p, settings: { ...b.settings, ...p.settings }, perks: { ...b.perks, ...p.perks }, stats: { ...b.stats, ...p.stats }, unlocks: { ...b.unlocks, ...p.unlocks } }
    }
  } catch { /* storage unavailable */ }
  return blank()
}

export function saveProgress(p) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); return true } catch { return false }
}

export function updateProgress(fn) {
  const p = loadProgress()
  fn(p)
  saveProgress(p)
  return p
}

// Keeps the photo (a downscaled center crop of the 3D view) for a monster.
export function savePhoto(id, dataUrl) {
  return updateProgress(p => { p.photos[id] = dataUrl })
}

export function addRecord(rec) {
  return updateProgress(p => {
    p.records.push(rec)
    p.records.sort((a, b) => a.seconds - b.seconds)
    p.records = p.records.slice(0, 50)
  })
}

// Running on your own computer (the dev server)? Then you get a stack of
// tips to play with every time.
export function isLocalhost() {
  try { return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) } catch { return false }
}
