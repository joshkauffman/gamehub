// ── Orbit Maze — pure gameplay state/logic ──────────────────────────────
// Framework-agnostic: plain {x,y} points, no THREE, no DOM — testable
// headlessly with a Node script (see this hub's other games for the same
// convention/reasoning).
//
// The ball has a position and velocity in board-plane coordinates. Every
// frame, the current tilt vector (from drag/keys/device-tilt, always in
// [-1,1] per axis) is treated as the direction+strength of gravity on the
// tilted board, accelerating the ball; walls are axis-aligned rectangles
// resolved as circle-vs-rect collisions (push out + cancel the velocity
// component into the wall, so the ball slides along a wall it's tilted
// into, same as a real marble on a tilted board). Holes and the goal are
// simple circular trigger zones.
import {
  BALL_RADIUS, HOLE_CATCH_RADIUS, GOAL_CATCH_RADIUS, CHECKPOINT_CATCH_RADIUS,
  GRAVITY, FRICTION, MAX_SPEED, FALL_TIME,
  v2Dist, buildProceduralCandidate, LEVEL_CONFIGS, FIXED_SEEDS,
} from './constants.js'

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
export function approach(cur, target, maxDelta) {
  if (cur < target) return Math.min(target, cur + maxDelta)
  if (cur > target) return Math.max(target, cur - maxDelta)
  return cur
}

// ── Tilt control ─────────────────────────────────────────────────────
const TILT_MAX_DEG = 40
const KEY_TILT_RATE = 3.2 // units/sec of tilt-vector easing toward the arrow-key target

export function applyKeyTilt(tilt, turnX, turnY, dt) {
  return { x: approach(tilt.x, turnX, KEY_TILT_RATE * dt), y: approach(tilt.y, turnY, KEY_TILT_RATE * dt) }
}
export function decayTilt(tilt, dt) {
  return { x: approach(tilt.x, 0, KEY_TILT_RATE * dt), y: approach(tilt.y, 0, KEY_TILT_RATE * dt) }
}
export function tiltFromDrag(dx, dy, maxRadiusPx) {
  const mag = Math.hypot(dx, dy)
  if (mag < 1e-6) return { x: 0, y: 0 }
  const scale = Math.min(mag, maxRadiusPx) / maxRadiusPx
  return { x: (dx / mag) * scale, y: (dy / mag) * scale }
}
export function tiltFromDeviceAngles(betaDeg, gammaDeg) {
  const b = clamp(betaDeg, -TILT_MAX_DEG, TILT_MAX_DEG)
  const g = clamp(gammaDeg, -TILT_MAX_DEG, TILT_MAX_DEG)
  return { x: g / TILT_MAX_DEG, y: b / TILT_MAX_DEG }
}

// A gated wall blocks passage on a duty-cycle: open for `openFraction` of
// each `period` seconds (offset by `phase`), shut the rest of the time.
// Timed against the ball's own elapsed clock so it keeps cycling even
// while the ball is waiting — you have to watch it and time your tilt.
export function isGateOpen(gate, time) {
  const { period, openFraction, phase = 0 } = gate
  const cyclePos = ((time + phase) % period + period) % period
  return cyclePos < period * openFraction
}

function resolveWallCollision(ball, wall) {
  const r = BALL_RADIUS
  const closestX = clamp(ball.pos.x, wall.x, wall.x + wall.w)
  const closestY = clamp(ball.pos.y, wall.y, wall.y + wall.h)
  const dx = ball.pos.x - closestX, dy = ball.pos.y - closestY
  const distSq = dx * dx + dy * dy
  if (distSq >= r * r) return
  let dist = Math.sqrt(distSq)
  let nx, ny
  if (dist < 1e-6) {
    // Ball center landed inside the rect (can happen at high speed against
    // a corner) — push out along whichever side has the least overlap.
    const overlaps = [
      { n: [-1, 0], v: ball.pos.x - wall.x },
      { n: [1, 0], v: (wall.x + wall.w) - ball.pos.x },
      { n: [0, -1], v: ball.pos.y - wall.y },
      { n: [0, 1], v: (wall.y + wall.h) - ball.pos.y },
    ]
    overlaps.sort((a, b) => a.v - b.v)
    ;[nx, ny] = overlaps[0].n
    dist = 0
  } else {
    nx = dx / dist; ny = dy / dist
  }
  const penetration = r - dist
  ball.pos.x += nx * penetration
  ball.pos.y += ny * penetration
  const vn = ball.vel.x * nx + ball.vel.y * ny
  if (vn < 0) { ball.vel.x -= vn * nx; ball.vel.y -= vn * ny }
}

// ── Ball / game state ────────────────────────────────────────────────
export function createBallState(level) {
  return {
    pos: { ...level.start }, vel: { x: 0, y: 0 },
    status: 'playing', trapTimer: 0, elapsed: 0, drops: 0,
    checkpoint: { ...level.start },
  }
}

export function createGameState(level) {
  return {
    level,
    tilt: { x: 0, y: 0 },
    ball: createBallState(level),
    reached: new Set(),
    result: null,
    lastEvent: null, eventSeq: 0,
  }
}

// A one-shot notification for the render layer (SFX/particle triggers) —
// consumed by watching `eventSeq` for changes, so each real transition
// fires exactly once no matter how many frames re-render the same state.
function emit(state, type, extra) {
  state.lastEvent = { type, ...extra }
  state.eventSeq += 1
}

export function stepGame(state, dt) {
  if (state.result) return
  const ball = state.ball
  ball.elapsed += dt

  if (ball.status === 'trapped') {
    ball.trapTimer -= dt
    if (ball.trapTimer <= 0) {
      ball.status = 'playing'
      ball.pos = { ...ball.checkpoint }
      ball.vel = { x: 0, y: 0 }
    }
    return
  }

  const accel = { x: state.tilt.x * GRAVITY, y: state.tilt.y * GRAVITY }
  ball.vel.x += accel.x * dt
  ball.vel.y += accel.y * dt
  const damp = Math.max(0, 1 - FRICTION * dt)
  ball.vel.x *= damp
  ball.vel.y *= damp
  const speed = Math.hypot(ball.vel.x, ball.vel.y)
  if (speed > MAX_SPEED) { ball.vel.x *= MAX_SPEED / speed; ball.vel.y *= MAX_SPEED / speed }

  ball.pos.x += ball.vel.x * dt
  ball.pos.y += ball.vel.y * dt

  for (const wall of state.level.walls) {
    if (wall.gate && isGateOpen(wall.gate, ball.elapsed)) continue
    resolveWallCollision(ball, wall)
  }

  for (const cp of state.level.checkpoints) {
    if (!state.reached.has(cp.id) && v2Dist(ball.pos, cp.pos) < CHECKPOINT_CATCH_RADIUS) {
      state.reached.add(cp.id)
      ball.checkpoint = { ...ball.pos }
      emit(state, 'checkpoint', { id: cp.id })
    }
  }

  for (const hole of state.level.holes) {
    if (v2Dist(ball.pos, hole.pos) < HOLE_CATCH_RADIUS) {
      ball.status = 'trapped'
      ball.trapTimer = FALL_TIME
      ball.drops += 1
      emit(state, 'trap', { id: hole.id, pos: hole.pos })
      return
    }
  }

  if (v2Dist(ball.pos, state.level.goal) < GOAL_CATCH_RADIUS) {
    ball.status = 'won'
    state.result = 'won'
    emit(state, 'goal', {})
  }
}

// An omniscient "aim straight at the next waypoint" solver — much steadier
// than any real player, but cheap and good enough to catch the one failure
// mode procedural holes actually have: an on-path hole whose clear lane
// ended up too narrow, or a hole that happens to sit square in a
// bottleneck. If this can't finish in `maxSeconds` of simulated time,
// treat the level as unfair rather than merely "needs a steadier player".
export function isLikelySolvable(level, maxSeconds = 30) {
  const state = createGameState(level)
  const dt = 1 / 60
  const maxSteps = Math.round(maxSeconds / dt)
  const waypoints = level.path
  const REACH = level.cellSize * 0.4
  let wpIndex = 1
  let lastCheckpointWpIndex = 0
  let lastSeenSeq = state.eventSeq

  for (let i = 0; i < maxSteps; i++) {
    if (state.result === 'won') return true
    const ball = state.ball
    if (wpIndex < waypoints.length && v2Dist(ball.pos, waypoints[wpIndex]) < REACH) wpIndex++
    const target = waypoints[Math.min(wpIndex, waypoints.length - 1)]
    const dx = target.x - ball.pos.x, dy = target.y - ball.pos.y
    const len = Math.hypot(dx, dy) || 1
    state.tilt = { x: dx / len, y: dy / len }
    stepGame(state, dt)

    if (state.eventSeq !== lastSeenSeq) {
      lastSeenSeq = state.eventSeq
      const ev = state.lastEvent
      if (ev?.type === 'checkpoint') {
        const cp = level.checkpoints.find(c => c.id === ev.id)
        if (cp) lastCheckpointWpIndex = cp.waypointIndex
      } else if (ev?.type === 'trap') {
        wpIndex = Math.max(1, lastCheckpointWpIndex + 1)
      }
    }
  }
  return state.result === 'won'
}

// Public procedural-level API: generate a candidate and validate it with
// isLikelySolvable, retrying with a derived seed until one passes (or a
// generous attempt budget runs out, in which case the last candidate is
// returned anyway — vanishingly unlikely given each attempt's independent
// high pass rate). Deterministic per input seed, so a Daily Challenge seed
// always converges to the same accepted level for every player.
export function generateProceduralLevel(seed, name, blurb, cfg, maxAttempts = 60) {
  let candidate = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = typeof seed === 'number' ? seed + attempt * 7919 : `${seed}::${attempt}`
    candidate = buildProceduralCandidate(attemptSeed, name, blurb, cfg)
    if (isLikelySolvable(candidate)) return candidate
  }
  return candidate
}

// The 4 hand-picked level configs, each generated once at module load from
// a fixed seed and validated exactly like Daily/Random — so every level in
// the game, curated or procedural, is built and vetted by the same path.
export const LEVELS = LEVEL_CONFIGS.map((cfg, i) => generateProceduralLevel(FIXED_SEEDS[i], cfg.name, cfg.blurb, cfg))
