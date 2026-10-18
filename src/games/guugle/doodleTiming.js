// ── Guugle doodle game — "timing / reflex" engine ──────────────────────
// Pure state, no rendering. A marker sweeps back and forth along a
// bar holding one good zone and one bad zone, repositioned after
// every attempt. Tap/click at any time to register an attempt against
// the marker's current position: +1 inside the good zone, -1 (floored
// at 0) inside the bad zone, no change otherwise.

export const CANVAS_W = 480
export const CANVAS_H = 200
export const GAME_FRAMES = 30 * 60
export const BAR_Y = 120
export const BAR_W = 420
export const BAR_X = (CANVAS_W - BAR_W) / 2
export const ZONE_W = 60
export const MARKER_SPEED_START = 0.035
export const MARKER_SPEED_RAMP = 0.00002
export const FLASH_FRAMES = 20

function randomZones() {
  const goodStart = Math.random() * (BAR_W - ZONE_W * 2 - 20)
  let badStart
  do { badStart = Math.random() * (BAR_W - ZONE_W) } while (Math.abs(badStart - goodStart) < ZONE_W + 10)
  return { good: [goodStart, goodStart + ZONE_W], bad: [badStart, badStart + ZONE_W] }
}

export function freshState(skin) {
  return {
    skin,
    frame: 0,
    timeLeft: GAME_FRAMES,
    score: 0,
    zones: randomZones(),
    status: 'playing', // playing | done
    flash: null, // { result: 'good'|'bad'|'miss', ttl }
  }
}

// 0..BAR_W position of the marker at the state's current frame.
export function markerPos(state) {
  const speed = MARKER_SPEED_START + state.frame * MARKER_SPEED_RAMP
  const t = (Math.sin(state.frame * speed) + 1) / 2
  return t * BAR_W
}

export function stepGame(state) {
  if (state.status !== 'playing') return
  state.frame++
  state.timeLeft--
  if (state.flash) {
    state.flash.ttl--
    if (state.flash.ttl <= 0) state.flash = null
  }
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.status = 'done'
  }
}

export function attemptHit(state) {
  if (state.status !== 'playing') return
  const pos = markerPos(state)
  const { good, bad } = state.zones
  let result = 'miss'
  if (pos >= good[0] && pos <= good[1]) { state.score++; result = 'good' }
  else if (pos >= bad[0] && pos <= bad[1]) { state.score = Math.max(0, state.score - 1); result = 'bad' }
  state.flash = { result, ttl: FLASH_FRAMES }
  state.zones = randomZones()
}
