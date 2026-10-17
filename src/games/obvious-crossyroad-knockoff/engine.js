// ── The Obvious Crossy Road Knockoff — game engine ────────────────────
// Pure state/physics, no rendering. The player's horizontal position is
// continuous pixels (so river currents can carry it smoothly); its
// vertical position is a logical integer row (each lane is one hazard
// check, not a sub-row simulation) plus a tweened `displayRow` float
// used only for the hop animation and the camera.

import {
  W, H, PLAY_Y0, TILE, COLS, ROWS, PLAY_W,
  PLAYER_SIZE, HOP_FRAMES, CAMERA_LOOKAHEAD_ROWS, CAMERA_EASE,
  LANE_GEN_BUFFER_ROWS, STALL_THRESHOLD_FRAMES, HAWK_TELEGRAPH_FRAMES, HAWK_HIT_RADIUS,
  HIGH_SCORE_KEY,
} from './constants.js'
import { generateLane } from './laneGen.js'
import { characterById } from './characters.js'

function colOf(x) { return Math.round((x - (TILE - PLAYER_SIZE.w) / 2) / TILE) }
function xOfCol(col) { return col * TILE + (TILE - PLAYER_SIZE.w) / 2 }

function readHighScore() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY)
    return raw ? parseInt(raw, 10) || 0 : 0
  } catch { return 0 }
}
function writeHighScore(value) {
  try { localStorage.setItem(HIGH_SCORE_KEY, String(value)) } catch { /* private mode etc — just skip persisting */ }
}

function ensureLanesTo(state, uptoRow) {
  while (state.lanes.length <= uptoRow) state.lanes.push(generateLane(state.lanes.length))
}

export function freshState(characterId) {
  const state = {
    frame: 0,
    status: 'playing', // playing | dead
    character: characterById(characterId),
    lanes: [],
    camera: { row: 0 },
    maxRowReached: 0,
    framesSinceProgress: 0,
    hawk: null,
    deathReason: null,
    newRecord: false,
    highScore: readHighScore(),
    particles: [],
    prevInput: { up: false, down: false, left: false, right: false },
    player: {
      x: xOfCol(Math.floor(COLS / 2)),
      row: 0, displayRow: 0,
      facing: 'up',
      hopTimer: 0, hopFromX: 0, hopFromRow: 0, hopTargetX: 0, hopTargetRow: 0,
      alive: true,
    },
  }
  ensureLanesTo(state, ROWS + LANE_GEN_BUFFER_ROWS)
  return state
}

function spawnParticles(state, x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 - 1, life: 24, color })
  }
}

function killPlayer(state, reason) {
  if (state.status !== 'playing') return
  state.player.alive = false
  state.status = 'dead'
  state.deathReason = reason
  spawnParticles(state, state.player.x + PLAYER_SIZE.w / 2, PLAY_Y0 + (ROWS - 1) * TILE, '#ffe35c', 18)
  if (state.maxRowReached > state.highScore) {
    state.highScore = state.maxRowReached
    state.newRecord = true
    writeHighScore(state.highScore)
  }
}

// Edge-triggered: only fires the frame a direction key transitions from
// up to down (the up/down/left/right diffing lives in stepGame, this
// just does the actual hop attempt once that's established).
function tryHop(state, dir) {
  const p = state.player
  if (p.hopTimer > 0 || state.status !== 'playing') return
  const currentCol = colOf(p.x)
  let targetRow = p.row
  let targetCol = currentCol
  if (dir === 'up') targetRow = p.row + 1
  else if (dir === 'down') targetRow = Math.max(0, p.row - 1)
  else if (dir === 'left') targetCol = Math.max(0, currentCol - 1)
  else if (dir === 'right') targetCol = Math.min(COLS - 1, currentCol + 1)
  if (targetRow === p.row && targetCol === currentCol) return // clamped at an edge — no-op

  ensureLanesTo(state, targetRow + ROWS + LANE_GEN_BUFFER_ROWS)
  const lane = state.lanes[targetRow]
  if (lane.type === 'grass' && lane.obstacles.has(targetCol)) return // blocked by a tree/rock

  p.facing = dir
  p.hopFromX = p.x
  p.hopFromRow = p.displayRow
  p.hopTargetX = xOfCol(targetCol)
  p.hopTargetRow = targetRow
  p.hopTimer = HOP_FRAMES
  p.row = targetRow
  if (p.row > state.maxRowReached) { state.maxRowReached = p.row; state.framesSinceProgress = 0 }
}

function stepHopTween(state) {
  const p = state.player
  if (p.hopTimer <= 0) return
  p.hopTimer--
  const progress = 1 - p.hopTimer / HOP_FRAMES
  p.x = p.hopFromX + (p.hopTargetX - p.hopFromX) * progress
  p.displayRow = p.hopFromRow + (p.hopTargetRow - p.hopFromRow) * progress
  if (p.hopTimer <= 0) { p.x = p.hopTargetX; p.displayRow = p.hopTargetRow }
}

function stepVehicles(lane) {
  for (const v of lane.vehicles) {
    v.x += lane.dir * lane.speed
    if (lane.dir > 0 && v.x > PLAY_W + 200) v.x -= lane.spanWidth
    else if (lane.dir < 0 && v.x < -200 - v.w) v.x += lane.spanWidth
  }
}
function stepLogs(lane) {
  for (const l of lane.logs) {
    l.x += lane.dir * lane.speed
    if (lane.dir > 0 && l.x > PLAY_W + 200) l.x -= lane.spanWidth
    else if (lane.dir < 0 && l.x < -200 - l.w) l.x += lane.spanWidth
  }
}
function stepRail(lane) {
  lane.phase--
  if (lane.phase <= -lane.activeFrames) lane.phase = 150 + Math.random() * 150
}

// Only applies once the hop has actually landed (hopTimer<=0) — you
// don't drown or get carried while still mid-air over a river tile.
function stepRiverCarry(state) {
  const p = state.player
  if (p.hopTimer > 0 || state.status !== 'playing') return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'river') return
  const centerX = p.x + PLAYER_SIZE.w / 2
  const log = lane.logs.find(l => centerX >= l.x && centerX <= l.x + l.w)
  if (!log) { killPlayer(state, 'drowned'); return }
  p.x += lane.dir * lane.speed
}

function checkRoadCollision(state) {
  const p = state.player
  if (state.status !== 'playing') return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'road') return
  for (const v of lane.vehicles) {
    if (p.x < v.x + v.w && p.x + PLAYER_SIZE.w > v.x) { killPlayer(state, 'squashed'); return }
  }
}

function checkRailCollision(state) {
  const p = state.player
  if (state.status !== 'playing') return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'rail') return
  if (lane.phase <= 0 && lane.phase > -lane.activeFrames) killPlayer(state, 'train')
}

// A hawk only gets curious after a long stretch with no new best
// distance. It telegraphs where it's diving (a snapshot of the
// player's position the instant it notices) and only actually hits if
// the player is still near that spot once the dive resolves — any
// movement at all during the telegraph is enough to dodge it, and
// successfully dodging resets the stall clock for a fresh grace period.
function stepHawk(state) {
  if (state.status !== 'playing') return
  state.framesSinceProgress++
  if (!state.hawk && state.framesSinceProgress > STALL_THRESHOLD_FRAMES) {
    state.hawk = {
      targetX: state.player.x + PLAYER_SIZE.w / 2, targetRow: state.player.row,
      timer: HAWK_TELEGRAPH_FRAMES, totalFrames: HAWK_TELEGRAPH_FRAMES,
    }
  }
  if (state.hawk) {
    state.hawk.timer--
    if (state.hawk.timer <= 0) {
      const dx = (state.player.x + PLAYER_SIZE.w / 2) - state.hawk.targetX
      const sameRow = state.player.row === state.hawk.targetRow
      if (sameRow && Math.abs(dx) < HAWK_HIT_RADIUS) killPlayer(state, 'hawk')
      state.hawk = null
      state.framesSinceProgress = 0
    }
  }
}

export function stepGame(state, input) {
  if (state.status !== 'playing') {
    state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.life-- })
    state.particles = state.particles.filter(pt => pt.life > 0)
    return
  }
  state.frame++

  const prev = state.prevInput
  if (input.up && !prev.up) tryHop(state, 'up')
  else if (input.down && !prev.down) tryHop(state, 'down')
  else if (input.left && !prev.left) tryHop(state, 'left')
  else if (input.right && !prev.right) tryHop(state, 'right')
  state.prevInput = { up: input.up, down: input.down, left: input.left, right: input.right }

  stepHopTween(state)
  ensureLanesTo(state, Math.ceil(state.camera.row) + ROWS + LANE_GEN_BUFFER_ROWS)

  // Only simulate lanes actually near the camera — the lanes array only
  // ever grows over a long session, so stepping the whole history every
  // frame would make the per-frame cost creep upward the longer you play.
  const loRow = Math.max(0, Math.floor(state.camera.row) - 2)
  const hiRow = Math.min(state.lanes.length - 1, Math.ceil(state.camera.row) + ROWS + LANE_GEN_BUFFER_ROWS)
  for (let r = loRow; r <= hiRow; r++) {
    const lane = state.lanes[r]
    if (!lane) continue
    if (lane.type === 'road') stepVehicles(lane)
    else if (lane.type === 'river') stepLogs(lane)
    else if (lane.type === 'rail') stepRail(lane)
  }

  stepRiverCarry(state)
  checkRoadCollision(state)
  checkRailCollision(state)
  if (state.status === 'playing' && (state.player.x < -TILE || state.player.x > PLAY_W)) killPlayer(state, 'fell')
  stepHawk(state)

  const targetCameraRow = Math.max(0, state.player.displayRow - CAMERA_LOOKAHEAD_ROWS)
  state.camera.row += (targetCameraRow - state.camera.row) * CAMERA_EASE

  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)
}

export function rowToScreenY(state, row) {
  return PLAY_Y0 + (ROWS - 1) * TILE - (row - state.camera.row) * TILE
}
