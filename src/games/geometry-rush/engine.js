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
//
// Two ways to play: endless (infinite procedural generation, Math.random,
// no finish line — the only way to "lose" is to die) and levels (a fixed
// list below, each with a seeded RNG so the layout is identical every
// attempt, and a finite length — reach it and you win). Levels reuse the
// exact same pattern generators as endless, just with a capped difficulty
// and a seeded RNG instead of Math.random, so they inherit the same
// fairness guarantees (see the jump-physics comments below) instead of
// needing separately hand-tuned layouts.

export const PLAYER_SIZE = 34
const PLAYER_HIT = 26          // slightly inset hitbox — fairer than the visual size
const PLAYER_HALF_HIT = PLAYER_HIT / 2

export const BASE_SPEED = 340
export const MAX_SPEED = 620
const SPEED_RAMP_DIST = 9000
const DIFFICULTY_DIST = 7000

const CUBE_GRAVITY = 2600
const CUBE_JUMP_V = 620

const SHIP_GRAVITY = 1500
const SHIP_THRUST = 3000
const SHIP_MAX_VY = 480
export const PLAYFIELD_H_SHIP = 380

const BALL_CEIL_H = 130
const BALL_SNAP_RATE = 16

const ORB_JUMP_V = 720
const PAD_JUMP_V = 920
const ORB_RADIUS = 15

// ── Jump physics ─────────────────────────────────────────────────────
// A cube jump is a simple projectile under constant gravity: peak height
// = v²/2g, full airtime (launch to landing at the same height) = 2v/g.
// The cube pattern generators below size gaps/blocks/spikes as fractions
// of what a jump can actually reach, instead of hand-picked numbers, so a
// correctly-timed jump can always clear what's generated — and it stays
// true even if gravity/jump-velocity/speed constants are retuned later.
function jumpHeight(v) { return (v * v) / (2 * CUBE_GRAVITY) }
function jumpAirTime(v) { return (2 * v) / CUBE_GRAVITY }
function jumpDistance(v, speed) { return speed * jumpAirTime(v) }
const CUBE_JUMP_HEIGHT = jumpHeight(CUBE_JUMP_V) // ~74 units at launch velocity 620

// An orb mid-jump resets vertical velocity to ORB_JUMP_V from wherever the
// player is — so an orb-assisted gap is really two arcs: a normal jump up
// to the orb's height, then a fresh launch from there back down to 0.
// Sized as a fraction of the jump's own peak height (not a fixed number) so
// it's always reachable — a fixed value above the peak makes the "toOrb"
// sqrt below go negative (NaN), which silently halts all level generation.
const ORB_TRIGGER_Y = CUBE_JUMP_HEIGHT * 0.8
function orbComboAirTime() {
  const g = CUBE_GRAVITY
  const toOrb = (CUBE_JUMP_V - Math.sqrt(CUBE_JUMP_V * CUBE_JUMP_V - 2 * g * ORB_TRIGGER_Y)) / g
  const fromOrb = (ORB_JUMP_V + Math.sqrt(ORB_JUMP_V * ORB_JUMP_V + 2 * g * ORB_TRIGGER_Y)) / g
  return toOrb + fromOrb
}
function orbComboDistance(speed) { return speed * orbComboAirTime() }

const LOOKAHEAD = 1400
const PORTAL_BUFFER = 160
const SECTION_LENGTHS = { cube: [1800, 2800], ship: [1400, 2200], ball: [1200, 2000] }
// Distance covered before the first obstacle is allowed to spawn. Speed
// ramps up slightly with distance, so this is sized a bit past 5s worth
// of BASE_SPEED travel to guarantee at least 5 clear seconds every run.
const SAFE_START_DIST = 1900

// ── Finite levels ────────────────────────────────────────────────────
// Each level is just the endless generator run with a seeded RNG (so the
// layout is identical every attempt) and a difficulty cap that never
// reaches 1 until the last level — plus a finish line. Reaching `length`
// is an instant win, no hazard check, so you can never "die at the
// finish line."
export const LEVELS = [
  { id: 'warm-up', name: 'Warm-Up', length: 2800, difficultyCap: 0.15, seed: 1001 },
  { id: 'pickup-speed', name: 'Pickup Speed', length: 3600, difficultyCap: 0.35, seed: 1002 },
  { id: 'mixed-signals', name: 'Mixed Signals', length: 4600, difficultyCap: 0.55, seed: 1003 },
  { id: 'overdrive', name: 'Overdrive', length: 5800, difficultyCap: 0.8, seed: 1004 },
  { id: 'full-rush', name: 'Full Rush', length: 7200, difficultyCap: 1.0, seed: 1005 },
]

const DIST_COIN_RATE = 50 // 1 coin per 50 distance travelled
const LEVEL_FIRST_CLEAR_BONUS = 150
const LEVEL_REPLAY_BONUS = 30
function computeRunCoins(distance) { return Math.floor(distance / DIST_COIN_RATE) }

const BEST_KEY = 'geometry-rush-best'
const COINS_KEY = 'geometry-rush-coins'
const LEVELS_DONE_KEY = 'geometry-rush-levels-complete'

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)) } catch { /* storage unavailable */ }
}

export function loadCoins() {
  try { return Number(localStorage.getItem(COINS_KEY)) || 0 } catch { return 0 }
}
function saveCoins(v) {
  try { localStorage.setItem(COINS_KEY, String(v)) } catch { /* storage unavailable */ }
}
export function addCoins(n) {
  const v = loadCoins() + n
  saveCoins(v)
  return v
}
export function spendCoins(n) {
  const v = loadCoins()
  if (v < n) return false
  saveCoins(v - n)
  return true
}

export function loadCompletedLevels() {
  try { return JSON.parse(localStorage.getItem(LEVELS_DONE_KEY)) || [] } catch { return [] }
}
export function isLevelComplete(id) { return loadCompletedLevels().includes(id) }
function markLevelComplete(id) {
  const done = loadCompletedLevels()
  if (!done.includes(id)) {
    done.push(id)
    try { localStorage.setItem(LEVELS_DONE_KEY, JSON.stringify(done)) } catch { /* storage unavailable */ }
  }
}

// Deterministic PRNG (mulberry32) so a seeded level generates the exact
// same layout every attempt. Endless mode passes no seed and falls back
// to Math.random, which has the same 0-argument, 0..1-return shape.
function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rand(rng, a, b) { return a + rng() * (b - a) }

export function createGameState() {
  const state = {}
  resetRun(state)
  state.status = 'ready' // ready | running | dead | won
  state.best = loadBest()
  return state
}

// options: { seed, length, difficultyCap, levelId } — omit all for endless.
export function resetRun(state, options = {}) {
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
  state.genX = SAFE_START_DIST
  state.sectionMode = 'cube'
  state.sectionEndAt = SAFE_START_DIST + 2000
  state.shipMidY = PLAYFIELD_H_SHIP / 2
  state.particles = []
  state.score = 0
  state.best = state.best ?? loadBest()
  state.shake = 0
  state.lastJumpHeld = false
  state.rng = options.seed != null ? mulberry32(options.seed) : Math.random
  state.length = options.length ?? Infinity
  state.difficultyCap = options.difficultyCap ?? 1
  state.levelId = options.levelId ?? null
  state.coins = loadCoins()
  state.earnedCoins = 0
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

  // Reaching the finish line is an unconditional win — no hazard check —
  // so a level can never be lost to "died right on the finish line."
  if (state.distance >= state.length) {
    state.distance = state.length
    state.score = Math.floor(state.distance / 10)
    win(state)
    return
  }
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
  state.earnedCoins = computeRunCoins(state.distance)
  state.coins = addCoins(state.earnedCoins)
}

function win(state) {
  state.status = 'won'
  state.best = Math.max(state.best, state.score)
  saveBest(state.best)
  let bonus = 0
  if (state.levelId) {
    bonus = isLevelComplete(state.levelId) ? LEVEL_REPLAY_BONUS : LEVEL_FIRST_CLEAR_BONUS
    markLevelComplete(state.levelId)
  }
  state.earnedCoins = computeRunCoins(state.distance) + bonus
  state.coins = addCoins(state.earnedCoins)
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
  while (state.genX < state.distance + LOOKAHEAD && state.genX < state.length && guard++ < 200) {
    if (state.genX >= state.sectionEndAt) { startNewSection(state); continue }
    const difficulty = Math.min(state.difficultyCap, state.distance / DIFFICULTY_DIST)
    if (state.sectionMode === 'cube') genCubeChunk(state, difficulty)
    else if (state.sectionMode === 'ship') genShipChunk(state, difficulty)
    else genBallChunk(state, difficulty)
  }
}

function startNewSection(state) {
  const candidates = ['cube', 'ship', 'ball'].filter(m => m !== state.sectionMode)
  const nextMode = candidates[Math.floor(state.rng() * candidates.length)]
  if (state.genX > 0) {
    state.obstacles.push({ type: 'portal', x: state.genX, w: 20, mode: nextMode, consumed: false })
  }
  state.sectionMode = nextMode
  if (nextMode === 'ship') state.shipMidY = PLAYFIELD_H_SHIP / 2
  state.genX += PORTAL_BUFFER
  const [lo, hi] = SECTION_LENGTHS[nextMode]
  state.sectionEndAt = state.genX + lo + state.rng() * (hi - lo)
}

function patternSpikeRow(startX, difficulty, speed, rng) {
  // Cap how many spikes can be chained so the row never exceeds what a
  // single jump can clear, even at the lowest speed the row can spawn at.
  const maxClear = jumpDistance(CUBE_JUMP_V, speed) - PLAYER_HIT
  const maxCount = Math.max(1, Math.floor((maxClear * 0.5) / 28))
  const count = 1 + Math.floor(rng() * Math.min(1 + difficulty * 2, maxCount))
  const obstacles = []
  for (let i = 0; i < count; i++) obstacles.push({ type: 'spike', x: startX + i * 28, w: 26, bottom: 0, top: 26, dir: 'up' })
  return { obstacles, length: count * 28 }
}
function patternGapJump(startX, difficulty, speed, rng) {
  // Full jump distance minus the player's hitbox width on both ends — the
  // actual span a well-timed jump can clear without clipping either lip.
  // Scaling as a fraction of that (not a fixed number) keeps the gap
  // always legal no matter how fast the player currently is.
  const maxClear = jumpDistance(CUBE_JUMP_V, speed) - PLAYER_HIT
  const w = maxClear * (0.35 + difficulty * 0.12 + rand(rng, -0.03, 0.03))
  return { obstacles: [{ type: 'gap', x: startX, w }], length: w }
}
function patternBlockHop(startX, difficulty, speed, rng) {
  // Block heights as fractions of the jump's peak height — 0.72 leaves
  // just enough margin below the peak for a well-timed jump to clear the
  // "must already be this high" side-collision check; 0.36 is an easy hop.
  const tall = rng() < 0.3 + difficulty * 0.3
  const h = CUBE_JUMP_HEIGHT * (tall ? 0.72 : 0.36)
  const w = 44
  const obstacles = [{ type: 'block', x: startX, w, bottom: 0, top: h }]
  let length = w + 40
  if (rng() < difficulty) {
    // Trailing spike must land within the horizontal distance the player
    // covers while falling from the block's edge (vy=0) down to just above
    // the spike's hazard threshold — otherwise it'd catch them mid-fall.
    const dangerY = 26 - SPIKE_INSET
    const fallTime = Math.sqrt(Math.max(0, (2 * (h - dangerY)) / CUBE_GRAVITY))
    const safeRun = speed * fallTime
    const gapAfter = Math.min(40, safeRun * 0.5)
    obstacles.push({ type: 'spike', x: startX + w + gapAfter, w: 26, bottom: 0, top: 26, dir: 'up' })
    length = w + gapAfter + 26 + 40
  }
  return { obstacles, length }
}
function patternOrbGap(startX, difficulty, speed, rng) {
  // The orb-assisted arc (jump up to the orb, then a fresh launch from it)
  // covers far more ground than a single jump — size the gap as a fraction
  // of that combined reach so the orb boost is genuinely required.
  const maxClear = orbComboDistance(speed) - PLAYER_HIT
  const w = maxClear * (0.32 + difficulty * 0.05 + rand(rng, -0.02, 0.02))
  return {
    obstacles: [
      { type: 'gap', x: startX, w },
      { type: 'orb', x: startX + w / 2, y: ORB_TRIGGER_Y, consumed: false },
    ],
    length: w,
  }
}
function patternPadLaunch(startX, difficulty, speed, rng) {
  // The pad boost (PAD_JUMP_V) clears far more than any spike run placed
  // after it — verified via the same jump-distance math, so the fixed
  // spacing between the pad and its own spikes always has generous margin.
  // But the boosted arc itself travels much farther than that: PAD_JUMP_V
  // (920) vs. a normal jump's 620 means the player is still airborne, at
  // height, well past this pattern's own spikes. If the *next* pattern
  // started generating right after those spikes (as `length` used to
  // report), the player could land straight into whatever it spawns —
  // so `length` has to cover the full pad-launch distance, not just the
  // trailing spikes.
  const padW = 34
  const gapAfter = 60
  const spikeCount = 1 + Math.floor(difficulty * 2)
  const obstacles = [{ type: 'pad', x: startX, w: padW, bottom: 0, top: 14, consumed: false }]
  for (let i = 0; i < spikeCount; i++) obstacles.push({ type: 'spike', x: startX + padW + gapAfter + i * 28, w: 26, bottom: 0, top: 26, dir: 'up' })
  const spikesEnd = padW + gapAfter + spikeCount * 28
  // Use MAX_SPEED here, not the current `speed` — this chunk is generated
  // up to LOOKAHEAD units before the player actually reaches it, and speed
  // keeps ramping in the meantime, so the real landing distance by arrival
  // time is always >= what gen-time speed would predict.
  const padLandDistance = jumpDistance(PAD_JUMP_V, MAX_SPEED)
  return { obstacles, length: Math.max(spikesEnd, padLandDistance) }
}
const CUBE_PATTERNS = [patternSpikeRow, patternGapJump, patternBlockHop, patternOrbGap, patternPadLaunch]

function genCubeChunk(state, difficulty) {
  const pattern = CUBE_PATTERNS[Math.floor(state.rng() * CUBE_PATTERNS.length)]
  const { obstacles, length } = pattern(state.genX, difficulty, state.speed, state.rng)
  for (const o of obstacles) state.obstacles.push(o)
  const flat = (90 - difficulty * 20 + state.rng() * 60) * 1.15
  state.genX += length + flat
}

function genShipChunk(state, difficulty) {
  const segW = 90
  const halfH = 150 - difficulty * 55
  state.shipMidY += rand(state.rng, -45, 45)
  const margin = halfH + 30
  state.shipMidY = Math.max(margin, Math.min(PLAYFIELD_H_SHIP - margin, state.shipMidY))
  const mid = state.shipMidY

  state.obstacles.push({ type: 'block', x: state.genX, w: segW, bottom: 0, top: Math.max(0, mid - halfH) })
  state.obstacles.push({ type: 'block', x: state.genX, w: segW, bottom: Math.min(PLAYFIELD_H_SHIP, mid + halfH), top: PLAYFIELD_H_SHIP })
  if (difficulty > 0.35 && state.rng() < 0.18) {
    state.obstacles.push({ type: 'spike', x: state.genX + segW / 2, w: 22, bottom: mid - 11, top: mid + 11, dir: 'diamond' })
  }
  state.genX += segW
}

function genBallChunk(state, difficulty) {
  const onFloor = state.rng() < 0.5
  const isBlock = state.rng() < 0.25 + difficulty * 0.2
  const w = isBlock ? 40 : 26
  const h = isBlock ? 46 : 26
  const bottom = onFloor ? 0 : BALL_CEIL_H - h
  const top = bottom + h
  state.obstacles.push({ type: isBlock ? 'block' : 'spike', x: state.genX, w, bottom, top, dir: onFloor ? 'up' : 'down' })
  const flat = (100 - difficulty * 30 + state.rng() * 50) * 1.15
  state.genX += w + flat
}
