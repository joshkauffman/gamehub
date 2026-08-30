// ── Geometry Rush — pure gameplay engine ────────────────────────────────
// Framework-agnostic, same engine/render split as this hub's other games
// (see dog-man-dash/worldEngine.js). Everything is plain world-space
// numbers; the React component owns the canvas, input, and converts
// world x to screen x by tracking the player at a fixed screen position
// while the world scrolls underneath.
//
// Three control modes, switched by touching a portal obstacle:
//   cube — classic platformer: tap to jump, gravity, can land on blocks.
//   ship — free flight: hold to thrust up, release to fall, threading a
//          winding corridor of top/bottom walls (no landing — touching
//          anything is instant death).
//   ball — a tight two-surface tunnel: tap flips which surface (floor or
//          ceiling) you're stuck to; dodge hazards mounted on either side.

export const PLAYER_SIZE = 34
const PLAYER_HIT = 26          // slightly inset hitbox — fairer than the visual size
const PLAYER_HALF_HIT = PLAYER_HIT / 2

export const BASE_SPEED = 340
export const MAX_SPEED = 620
const SPEED_RAMP_DIST = 9000
const DIFFICULTY_DIST = 7000

const CUBE_GRAVITY = 2600
const CUBE_JUMP_V = 760

const SHIP_GRAVITY = 1500
const SHIP_THRUST = 3000
const SHIP_MAX_VY = 480
export const PLAYFIELD_H_SHIP = 380

const BALL_CEIL_H = 130
const BALL_SNAP_RATE = 16

const ORB_JUMP_V = 720
const PAD_JUMP_V = 920
const ORB_RADIUS = 15

const LOOKAHEAD = 1400
const PORTAL_BUFFER = 160
const SECTION_LENGTHS = { cube: [1800, 2800], ship: [1400, 2200], ball: [1200, 2000] }

const STORAGE_KEY = 'geometry-rush-best'
function loadBest() {
  try { return Number(localStorage.getItem(STORAGE_KEY)) || 0 } catch { return 0 }
}
function saveBest(v) {
  try { localStorage.setItem(STORAGE_KEY, String(v)) } catch { /* storage unavailable */ }
}

function rand(a, b) { return a + Math.random() * (b - a) }

export function createGameState() {
  const state = {}
  resetRun(state)
  state.status = 'ready' // ready | running | dead
  state.best = loadBest()
  return state
}

export function resetRun(state) {
  state.status = 'running'
  state.mode = 'cube'
  state.distance = 0
  state.speed = BASE_SPEED
  state.y = 0
  state.vy = 0
  state.onGround = true
  state.gravityDir = 1
  state.rotation = 0
  state.obstacles = []
  state.genX = 0
  state.sectionMode = 'cube'
  state.sectionEndAt = 2000
  state.shipMidY = PLAYFIELD_H_SHIP / 2
  state.particles = []
  state.score = 0
  state.best = state.best ?? loadBest()
  state.shake = 0
  state.lastJumpHeld = false
}

function edge(input, state) {
  const held = !!input.jump
  const was = state.lastJumpHeld
  state.lastJumpHeld = held
  return held && !was
}

export function stepGame(state, input, dt) {
  if (state.status !== 'running') return

  ensureGenerated(state)

  state.distance += state.speed * dt
  state.speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * Math.min(1, state.distance / SPEED_RAMP_DIST)
  state.score = Math.floor(state.distance / 10)

  const jumpPressed = edge(input, state)

  if (state.mode === 'cube') stepCube(state, input, jumpPressed, dt)
  else if (state.mode === 'ship') stepShip(state, input, dt)
  else stepBall(state, jumpPressed, dt)

  if (state.status !== 'running') return // died this frame

  spawnTrailParticle(state)
  updateParticles(state, dt)
  cullObstacles(state)
}

function die(state) {
  state.status = 'dead'
  state.shake = 1
  state.best = Math.max(state.best, state.score)
  saveBest(state.best)
}

// ── Cube mode ────────────────────────────────────────────────────────
function stepCube(state, input, jumpPressed, dt) {
  const px = state.distance

  if (jumpPressed && state.onGround) {
    state.vy = CUBE_JUMP_V
    state.onGround = false
  } else if (jumpPressed && !state.onGround) {
    for (const o of state.obstacles) {
      if (o.type === 'orb' && !o.consumed && Math.hypot(px - o.x, (state.y + PLAYER_HALF_HIT) - o.y) < ORB_RADIUS + PLAYER_HALF_HIT) {
        state.vy = ORB_JUMP_V
        break
      }
    }
  }

  state.vy -= CUBE_GRAVITY * dt
  const newY = state.y + state.vy * dt

  const groundTop = groundTopAt(state.obstacles, px, state.y)
  if (groundTop === null && newY <= 0) { die(state); return }
  const floor = groundTop === null ? -Infinity : groundTop
  if (newY <= floor) {
    state.y = floor
    state.vy = 0
    state.onGround = true
  } else {
    state.y = newY
    state.onGround = false
  }

  if (checkCubeHazards(state, px)) { die(state); return }

  for (const o of state.obstacles) {
    if (o.type === 'pad' && !o.consumed && aabbOverlapPlayer(px, state.y, o)) {
      state.vy = PAD_JUMP_V
      o.consumed = true
    }
  }

  checkPortal(state, px)
  state.rotation += (state.onGround ? -state.rotation * Math.min(1, dt * 8) : dt * 9)
}

function groundTopAt(obstacles, px, prevY) {
  const hw = PLAYER_HALF_HIT
  let groundTop = 0
  let isPit = false
  for (const o of obstacles) {
    const overlapX = px + hw > o.x && px - hw < o.x + o.w
    if (!overlapX) continue
    if (o.type === 'gap') isPit = true
    if (o.type === 'block' && prevY >= o.top - 6) groundTop = Math.max(groundTop, o.top)
  }
  if (isPit && groundTop === 0) return null
  return groundTop
}

const SPIKE_INSET = 6
function checkCubeHazards(state, px) {
  const hw = PLAYER_HALF_HIT
  const yb = state.y, yt = state.y + PLAYER_HIT
  for (const o of state.obstacles) {
    if (o.type === 'spike') {
      if (px + hw > o.x + SPIKE_INSET && px - hw < o.x + o.w - SPIKE_INSET &&
          yt > o.bottom + SPIKE_INSET && yb < o.top - SPIKE_INSET) return true
    } else if (o.type === 'block') {
      const overlapX = px + hw > o.x && px - hw < o.x + o.w
      if (!overlapX) continue
      if (yb >= o.top - 1) continue // resting on top — safe, handled by groundTopAt
      if (yt > o.bottom && yb < o.top) return true
    }
  }
  return false
}

function aabbOverlapPlayer(px, y, o) {
  const hw = PLAYER_HALF_HIT
  return px + hw > o.x && px - hw < o.x + o.w && y + PLAYER_HIT > o.bottom && y < o.top
}

// ── Ship & ball share a simple "touch anything = death" hazard check ──
function checkGenericHazards(state, px) {
  const hw = PLAYER_HALF_HIT
  const yb = state.y, yt = state.y + PLAYER_HIT
  for (const o of state.obstacles) {
    if (o.type !== 'block' && o.type !== 'spike') continue
    if (px + hw > o.x && px - hw < o.x + o.w && yt > o.bottom && yb < o.top) return true
  }
  return false
}

function stepShip(state, input, dt) {
  const px = state.distance
  if (input.jump) state.vy += SHIP_THRUST * dt
  state.vy -= SHIP_GRAVITY * dt
  state.vy = Math.max(-SHIP_MAX_VY, Math.min(SHIP_MAX_VY, state.vy))
  const newY = state.y + state.vy * dt
  state.y = Math.max(0, Math.min(PLAYFIELD_H_SHIP - PLAYER_SIZE, newY))

  if (checkGenericHazards(state, px)) { die(state); return }
  checkPortal(state, px)
  state.rotation = state.vy / SHIP_MAX_VY * 0.5
}

function stepBall(state, jumpPressed, dt) {
  const px = state.distance
  if (jumpPressed) state.gravityDir *= -1
  const target = state.gravityDir === 1 ? 0 : BALL_CEIL_H - PLAYER_SIZE
  state.y += (target - state.y) * Math.min(1, BALL_SNAP_RATE * dt)

  if (checkGenericHazards(state, px)) { die(state); return }
  checkPortal(state, px)
  state.rotation += dt * 7 * state.gravityDir
}

function checkPortal(state, px) {
  for (const o of state.obstacles) {
    if (o.type === 'portal' && !o.consumed && px >= o.x) {
      o.consumed = true
      state.mode = o.mode
      if (o.mode === 'ship') { state.y = Math.min(state.y, PLAYFIELD_H_SHIP - PLAYER_SIZE); state.vy = 0 }
      else if (o.mode === 'ball') { state.y = 0; state.vy = 0; state.gravityDir = 1 }
      // Cube always lands on solid ground on entry — otherwise a
      // transition from high up in ship/ball mode could free-fall
      // straight onto whatever obstacle happens to be waiting.
      else { state.y = 0; state.vy = 0; state.onGround = true }
    }
  }
}

// ── Particles (visual trail only — no gameplay effect) ─────────────────
function spawnTrailParticle(state) {
  state.particles.push({ x: state.distance, y: state.y + PLAYER_SIZE / 2, life: 0.45, age: 0, mode: state.mode })
}
function updateParticles(state, dt) {
  for (const p of state.particles) p.age += dt
  state.particles = state.particles.filter(p => p.age < p.life)
}

function cullObstacles(state) {
  const minX = state.distance - 200
  state.obstacles = state.obstacles.filter(o => o.x + (o.w || 0) > minX)
}

// ── Procedural generation ───────────────────────────────────────────────
function ensureGenerated(state) {
  let guard = 0
  while (state.genX < state.distance + LOOKAHEAD && guard++ < 200) {
    if (state.genX >= state.sectionEndAt) { startNewSection(state); continue }
    const difficulty = Math.min(1, state.distance / DIFFICULTY_DIST)
    if (state.sectionMode === 'cube') genCubeChunk(state, difficulty)
    else if (state.sectionMode === 'ship') genShipChunk(state, difficulty)
    else genBallChunk(state, difficulty)
  }
}

function startNewSection(state) {
  const candidates = ['cube', 'ship', 'ball'].filter(m => m !== state.sectionMode)
  const nextMode = candidates[Math.floor(Math.random() * candidates.length)]
  if (state.genX > 0) {
    state.obstacles.push({ type: 'portal', x: state.genX, w: 20, mode: nextMode, consumed: false })
  }
  state.sectionMode = nextMode
  if (nextMode === 'ship') state.shipMidY = PLAYFIELD_H_SHIP / 2
  state.genX += PORTAL_BUFFER
  const [lo, hi] = SECTION_LENGTHS[nextMode]
  state.sectionEndAt = state.genX + lo + Math.random() * (hi - lo)
}

function patternSpikeRow(startX, difficulty) {
  const count = 1 + Math.floor(Math.random() * (1 + difficulty * 2))
  const obstacles = []
  for (let i = 0; i < count; i++) obstacles.push({ type: 'spike', x: startX + i * 28, w: 26, bottom: 0, top: 26, dir: 'up' })
  return { obstacles, length: count * 28 }
}
function patternGapJump(startX, difficulty) {
  const w = 70 + difficulty * 50 + Math.random() * 20
  return { obstacles: [{ type: 'gap', x: startX, w }], length: w }
}
function patternBlockHop(startX, difficulty) {
  const h = Math.random() < 0.3 + difficulty * 0.3 ? 80 : 40
  const w = 44
  const obstacles = [{ type: 'block', x: startX, w, bottom: 0, top: h }]
  if (Math.random() < difficulty) obstacles.push({ type: 'spike', x: startX + w + 10, w: 26, bottom: 0, top: 26, dir: 'up' })
  return { obstacles, length: w + 40 }
}
function patternOrbGap(startX, difficulty) {
  const w = 110 + difficulty * 40
  return {
    obstacles: [
      { type: 'gap', x: startX, w },
      { type: 'orb', x: startX + w / 2, y: 90, consumed: false },
    ],
    length: w,
  }
}
function patternPadLaunch(startX, difficulty) {
  const padW = 34
  const gapAfter = 60
  const spikeCount = 1 + Math.floor(difficulty * 2)
  const obstacles = [{ type: 'pad', x: startX, w: padW, bottom: 0, top: 14, consumed: false }]
  for (let i = 0; i < spikeCount; i++) obstacles.push({ type: 'spike', x: startX + padW + gapAfter + i * 28, w: 26, bottom: 0, top: 26, dir: 'up' })
  return { obstacles, length: padW + gapAfter + spikeCount * 28 }
}
const CUBE_PATTERNS = [patternSpikeRow, patternGapJump, patternBlockHop, patternOrbGap, patternPadLaunch]

function genCubeChunk(state, difficulty) {
  const pattern = CUBE_PATTERNS[Math.floor(Math.random() * CUBE_PATTERNS.length)]
  const { obstacles, length } = pattern(state.genX, difficulty)
  for (const o of obstacles) state.obstacles.push(o)
  const flat = 90 - difficulty * 20 + Math.random() * 60
  state.genX += length + flat
}

function genShipChunk(state, difficulty) {
  const segW = 90
  const halfH = 150 - difficulty * 55
  state.shipMidY += rand(-45, 45)
  const margin = halfH + 30
  state.shipMidY = Math.max(margin, Math.min(PLAYFIELD_H_SHIP - margin, state.shipMidY))
  const mid = state.shipMidY

  state.obstacles.push({ type: 'block', x: state.genX, w: segW, bottom: 0, top: Math.max(0, mid - halfH) })
  state.obstacles.push({ type: 'block', x: state.genX, w: segW, bottom: Math.min(PLAYFIELD_H_SHIP, mid + halfH), top: PLAYFIELD_H_SHIP })
  if (difficulty > 0.35 && Math.random() < 0.18) {
    state.obstacles.push({ type: 'spike', x: state.genX + segW / 2, w: 22, bottom: mid - 11, top: mid + 11, dir: 'diamond' })
  }
  state.genX += segW
}

function genBallChunk(state, difficulty) {
  const onFloor = Math.random() < 0.5
  const isBlock = Math.random() < 0.25 + difficulty * 0.2
  const w = isBlock ? 40 : 26
  const h = isBlock ? 46 : 26
  const bottom = onFloor ? 0 : BALL_CEIL_H - h
  const top = bottom + h
  state.obstacles.push({ type: isBlock ? 'block' : 'spike', x: state.genX, w, bottom, top, dir: onFloor ? 'up' : 'down' })
  const flat = 100 - difficulty * 30 + Math.random() * 50
  state.genX += w + flat
}
