// ── Guugle doodle game — "whack-a-mole" engine ─────────────────────────
// Pure state, no rendering. A 3x3 grid of holes; items pop up into a
// random empty hole and sit for a shrinking window before vanishing
// unclaimed. Click a hole while it's occupied to score: +1 for a good
// item, -1 (floored at 0) for the skin's one bad item.

export const HOLES = 9
export const GAME_FRAMES = 30 * 60 // 30s @ 60fps
export const SPAWN_START_FRAMES = 42
export const SPAWN_MIN_FRAMES = 18
export const ITEM_TTL_START = 70
export const ITEM_TTL_MIN = 40
export const BAD_CHANCE = 0.25

export function freshState(skin) {
  return {
    skin,
    frame: 0,
    timeLeft: GAME_FRAMES,
    score: 0,
    holes: Array(HOLES).fill(null), // null | { emoji, bad, ttl }
    spawnTimer: SPAWN_START_FRAMES,
    status: 'playing', // playing | done
  }
}

export function stepGame(state) {
  if (state.status !== 'playing') return
  state.frame++
  state.timeLeft--
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.status = 'done'
    return
  }

  state.holes = state.holes.map(h => {
    if (!h) return h
    h.ttl--
    return h.ttl <= 0 ? null : h
  })

  state.spawnTimer--
  if (state.spawnTimer <= 0) {
    const emptyIdx = state.holes.reduce((acc, h, i) => { if (!h) acc.push(i); return acc }, [])
    if (emptyIdx.length) {
      const idx = emptyIdx[Math.floor(Math.random() * emptyIdx.length)]
      const bad = Math.random() < BAD_CHANCE
      const emoji = bad ? state.skin.bad : state.skin.good[Math.floor(Math.random() * state.skin.good.length)]
      const ttl = Math.max(ITEM_TTL_MIN, ITEM_TTL_START - Math.floor(state.frame / 200))
      state.holes[idx] = { emoji, bad, ttl }
    }
    state.spawnTimer = Math.max(SPAWN_MIN_FRAMES, SPAWN_START_FRAMES - Math.floor(state.frame / 150))
  }
}

export function clickHole(state, idx) {
  if (state.status !== 'playing') return
  const h = state.holes[idx]
  if (!h) return
  state.score += h.bad ? -1 : 1
  if (state.score < 0) state.score = 0
  state.holes[idx] = null
}
