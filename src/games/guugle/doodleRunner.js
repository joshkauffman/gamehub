// ── Guugle doodle game — "jump the obstacle" runner engine ────────────
// Pure state, no rendering. A fixed-position runner; obstacles scroll
// in from the right at increasing speed. Jump (edge-triggered) to
// clear one while airborne (+1); stay grounded through one (-1,
// floored at 0). Each obstacle resolves at most once.

export const CANVAS_W = 480
export const CANVAS_H = 300
export const GROUND_Y = CANVAS_H - 40
export const GAME_FRAMES = 30 * 60
export const GRAVITY = 0.9
export const JUMP_VELOCITY = -13
export const PLAYER_X = 70
export const PLAYER_HALF_W = 16
export const AIRBORNE_CLEARANCE = 14 // y above ground that counts as "jumped over"
export const SPEED_START = 4
export const SPAWN_START_FRAMES = 70
export const SPAWN_MIN_FRAMES = 38

export function freshState(skin) {
  return {
    skin,
    frame: 0,
    timeLeft: GAME_FRAMES,
    score: 0,
    y: GROUND_Y,
    vy: 0,
    obstacles: [], // { x, resolved }
    spawnTimer: SPAWN_START_FRAMES,
    status: 'playing', // playing | done
    prevJump: false,
  }
}

// input: { jump?: bool } — true while the jump key/pointer is held;
// the actual jump only triggers on the up-edge, same pattern used
// elsewhere in this repo for hop/jump inputs.
export function stepGame(state, input = {}) {
  if (state.status !== 'playing') return
  state.frame++
  state.timeLeft--
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.status = 'done'
    return
  }

  const onGround = state.y >= GROUND_Y - 0.01
  const jumpPressed = !!input.jump
  if (jumpPressed && !state.prevJump && onGround) state.vy = JUMP_VELOCITY
  state.prevJump = jumpPressed

  state.vy += GRAVITY
  state.y += state.vy
  if (state.y > GROUND_Y) { state.y = GROUND_Y; state.vy = 0 }

  const speed = SPEED_START + state.frame / 600
  state.spawnTimer--
  if (state.spawnTimer <= 0) {
    state.obstacles.push({ x: CANVAS_W + 20, resolved: false })
    state.spawnTimer = Math.max(SPAWN_MIN_FRAMES, SPAWN_START_FRAMES - Math.floor(state.frame / 120))
  }
  state.obstacles.forEach(o => { o.x -= speed })

  const airborne = state.y < GROUND_Y - AIRBORNE_CLEARANCE
  for (const o of state.obstacles) {
    if (o.resolved) continue
    if (Math.abs(o.x - PLAYER_X) < PLAYER_HALF_W + 14) {
      if (airborne) { state.score++ } else { state.score = Math.max(0, state.score - 1) }
      o.resolved = true
    }
  }
  state.obstacles = state.obstacles.filter(o => o.x > -30)
}
