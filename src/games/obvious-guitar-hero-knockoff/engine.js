// ── The Obvious Guitar Hero Knockoff — gameplay engine ────────────────
// Pure state/logic, no audio and no rendering. stepGame is driven by an
// explicit `songTime` (seconds since the backing track started, read
// from the audio clock by the React wrapper) rather than its own
// internal clock — that keeps judging sample-accurate against the
// actual sound and keeps this file testable without a real
// AudioContext.

import { HEALTH_START, HEALTH_MAX, HEALTH_PERFECT, HEALTH_GOOD, HEALTH_MISS, PERFECT_WINDOW, GOOD_WINDOW } from './constants.js'

export function freshState(song) {
  return {
    song,
    status: 'playing',
    songTime: 0,
    notes: song.notes.map(n => ({ ...n, judged: false, hit: false })),
    health: HEALTH_START,
    score: 0,
    combo: 0,
    maxCombo: 0,
    judgment: null, judgmentTimer: 0,
    laneFlash: new Array(5).fill(0),
  }
}

function judgeHit(state, note, quality) {
  note.judged = true
  note.hit = true
  const perfect = quality === 'perfect'
  state.health = Math.min(HEALTH_MAX, state.health + (perfect ? HEALTH_PERFECT : HEALTH_GOOD))
  state.combo++
  state.maxCombo = Math.max(state.maxCombo, state.combo)
  const mult = 1 + Math.floor(state.combo / 10) * 0.5
  state.score += Math.round((perfect ? 100 : 60) * mult)
  state.judgment = perfect ? 'PERFECT!' : 'Good'
  state.judgmentTimer = 24
}

function judgeMiss(state, note) {
  note.judged = true
  note.hit = false
  state.health = Math.max(0, state.health + HEALTH_MISS)
  state.combo = 0
  state.judgment = 'Miss'
  state.judgmentTimer = 24
}

// `pressedLanes` is the set of lane ids that received a fresh keydown
// this tick (edge-triggered — a held key shouldn't register twice).
export function stepGame(state, songTime, pressedLanes) {
  if (state.status !== 'playing') return
  state.songTime = songTime
  if (state.judgmentTimer > 0) state.judgmentTimer--
  state.laneFlash = state.laneFlash.map(f => Math.max(0, f - 1))

  for (const lane of pressedLanes) {
    state.laneFlash[lane] = 8
    // The closest unjudged note in this lane, if it's within the
    // (generous) good window either side of now.
    let best = null
    for (const n of state.notes) {
      if (n.judged || n.lane !== lane) continue
      const dt = Math.abs(songTime - n.time)
      if (dt <= GOOD_WINDOW && (!best || dt < Math.abs(songTime - best.time))) best = n
    }
    if (best) {
      const dt = Math.abs(songTime - best.time)
      judgeHit(state, best, dt <= PERFECT_WINDOW ? 'perfect' : 'good')
    }
  }

  for (const n of state.notes) {
    if (!n.judged && songTime - n.time > GOOD_WINDOW) judgeMiss(state, n)
  }

  if (state.health <= 0) {
    state.status = 'failed'
    return
  }
  if (songTime >= state.song.duration) {
    state.status = state.health > 0 ? 'cleared' : 'failed'
  }
}

export function accuracy(state) {
  const judged = state.notes.filter(n => n.judged)
  if (judged.length === 0) return 100
  const hits = judged.filter(n => n.hit).length
  return Math.round((hits / judged.length) * 100)
}
