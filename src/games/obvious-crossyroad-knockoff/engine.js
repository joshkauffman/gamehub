// ── The Obvious Crossy Road Knockoff — game engine ────────────────────
// Pure state/physics, no rendering. A player's horizontal position is
// continuous pixels (so river currents can carry it smoothly); its
// vertical position is a logical integer row (each lane is one hazard
// check, not a sub-row simulation) plus a tweened `displayRow` float
// used only for the hop animation and that player's own camera.
//
// 1 or 2 players live in `state.players` — single-player is just the
// 2-player path with one entry, not a separate code path. Each player
// carries their own camera, hawk-stall clock, lives, and power-up
// timers; `state.lanes` and `state.freezeTimer` are the only shared
// (not per-player) world state, since both players hop around on the
// exact same procedurally generated world.

import {
  PLAY_W, TILE, COLS, ROWS,
  PLAYER_SIZE, HOP_FRAMES, CAMERA_LOOKAHEAD_ROWS, CAMERA_EASE,
  LANE_GEN_BUFFER_ROWS, STALL_THRESHOLD_FRAMES, HAWK_TELEGRAPH_FRAMES, HAWK_HIT_RADIUS,
  HIGH_SCORE_KEY, SHIELD_DURATION, SPEED_DURATION, SPEED_HOP_FRAMES, FREEZE_DURATION,
  START_LIVES, MAX_LIVES, RESPAWN_INVULN_FRAMES,
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

function freshPlayer(id, characterId) {
  return {
    id, character: characterById(characterId),
    x: xOfCol(Math.floor(COLS / 2)),
    row: 0, displayRow: 0,
    facing: 'up',
    hopTimer: 0, hopTotalFrames: HOP_FRAMES, hopFromX: 0, hopFromRow: 0, hopTargetX: 0, hopTargetRow: 0,
    alive: true,
    camera: { row: 0 },
    maxRowReached: 0, framesSinceProgress: 0, hawk: null,
    lives: START_LIVES, shieldTimer: 0, speedTimer: 0, respawnInvuln: 0,
    deathReason: null, newRecord: false,
    prevInput: { up: false, down: false, left: false, right: false },
  }
}

// `character2Id` omitted/null => single-player. Passing one => 2-player
// co-op on one shared world (see the module comment above).
export function freshState(character1Id, character2Id) {
  const twoPlayer = !!character2Id
  const state = {
    frame: 0,
    status: 'playing', // playing | dead (dead once every player has run out of lives)
    twoPlayer,
    lanes: [],
    freezeTimer: 0,
    highScore: readHighScore(),
    particles: [],
    toasts: [], // [{ playerId, text, timer }]
    players: [freshPlayer(0, character1Id)],
  }
  if (twoPlayer) state.players.push(freshPlayer(1, character2Id))
  ensureLanesTo(state, ROWS + LANE_GEN_BUFFER_ROWS)
  return state
}

// Particles are anchored to a world ROW (not a screen pixel) plus a
// small local pixel offset that animates normally — row, not pixel Y,
// because each player now has their own independently-scrolling
// camera (and in 2-player mode, their own viewport entirely), so
// there's no single fixed "screen Y" a particle could be spawned at
// that would read correctly for every camera that might render it.
// render.js converts row -> screen Y per-viewport at draw time.
function spawnParticles(state, x, row, color, n = 10) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, row, dy: 0,
      vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 - 1,
      life: 24, color,
    })
  }
}

function showToast(state, playerId, text) {
  state.toasts.push({ playerId, text, timer: 80 })
}

function recordHighScore(state, player) {
  if (player.maxRowReached > state.highScore) {
    state.highScore = player.maxRowReached
    player.newRecord = true
    writeHighScore(state.highScore)
  }
}

function allPlayersDone(state) { return state.players.every(p => !p.alive) }

// Single entry point for every death condition (car, drowning, train,
// hawk, swept off the edge). A shield or the brief post-respawn grace
// window absorbs it with no cost at all; otherwise it costs a life and
// respawns the player right where they were (not a true death) unless
// that was their last life.
function resolveHit(state, player, reason) {
  if (state.status !== 'playing' || !player.alive) return
  if (player.shieldTimer > 0 || player.respawnInvuln > 0) {
    spawnParticles(state, player.x + PLAYER_SIZE.w / 2, player.displayRow, '#9ad8ff', 8)
    return
  }
  player.lives--
  if (player.lives > 0) {
    player.hopTimer = 0
    player.x = xOfCol(colOf(player.x))
    player.respawnInvuln = RESPAWN_INVULN_FRAMES
    player.deathReason = reason
    spawnParticles(state, player.x + PLAYER_SIZE.w / 2, player.displayRow, '#ff9a4a', 12)
    showToast(state, player.id, 'Lost a life!')
    return
  }
  player.alive = false
  player.deathReason = reason
  spawnParticles(state, player.x + PLAYER_SIZE.w / 2, player.displayRow, '#ffe35c', 18)
  recordHighScore(state, player)
  if (allPlayersDone(state)) state.status = 'dead'
}

// Edge-triggered: only fires the frame a direction key transitions from
// up to down (the diffing lives in stepGame, this just does the actual
// hop attempt once that's established).
function tryHop(state, player, dir) {
  const p = player
  if (p.hopTimer > 0 || !p.alive || state.status !== 'playing') return
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
  p.hopTotalFrames = p.speedTimer > 0 ? SPEED_HOP_FRAMES : HOP_FRAMES
  p.hopTimer = p.hopTotalFrames
  p.row = targetRow
  if (p.row > p.maxRowReached) { p.maxRowReached = p.row; p.framesSinceProgress = 0 }
}

function stepHopTween(player) {
  const p = player
  if (p.hopTimer <= 0) return
  // hopTotalFrames was fixed by tryHop the instant this hop started, so
  // a speed boost expiring (or a fresh one landing) mid-flight can't
  // change the denominator out from under an in-progress tween and
  // cause the player to visually jump.
  p.hopTimer--
  const progress = 1 - p.hopTimer / p.hopTotalFrames
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

// Only applies once a hop has actually landed (hopTimer<=0) — you don't
// drown or get carried while still mid-air over a river tile.
function stepRiverCarry(state, player) {
  const p = player
  if (p.hopTimer > 0 || !p.alive || state.status !== 'playing') return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'river') return
  const centerX = p.x + PLAYER_SIZE.w / 2
  const log = lane.logs.find(l => centerX >= l.x && centerX <= l.x + l.w)
  if (!log) { resolveHit(state, p, 'drowned'); return }
  if (state.freezeTimer <= 0) p.x += lane.dir * lane.speed
}

function checkRoadCollision(state, player) {
  const p = player
  if (!p.alive || state.status !== 'playing') return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'road') return
  for (const v of lane.vehicles) {
    if (p.x < v.x + v.w && p.x + PLAYER_SIZE.w > v.x) { resolveHit(state, p, 'squashed'); return }
  }
}

function checkRailCollision(state, player) {
  const p = player
  if (!p.alive || state.status !== 'playing') return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'rail') return
  if (lane.phase <= 0 && lane.phase > -lane.activeFrames) resolveHit(state, p, 'train')
}

function checkPowerupPickup(state, player) {
  const p = player
  if (p.hopTimer > 0 || !p.alive) return
  const lane = state.lanes[p.row]
  if (!lane || lane.type !== 'grass' || !lane.powerup || lane.powerup.taken) return
  if (colOf(p.x) !== lane.powerup.col) return
  lane.powerup.taken = true
  const type = lane.powerup.type
  const cx = p.x + PLAYER_SIZE.w / 2, cy = p.displayRow
  if (type === 'shield') { p.shieldTimer = SHIELD_DURATION; showToast(state, p.id, 'Shield!'); spawnParticles(state, cx, cy, '#9ad8ff', 12) }
  else if (type === 'speed') { p.speedTimer = SPEED_DURATION; showToast(state, p.id, 'Speed Boost!'); spawnParticles(state, cx, cy, '#ffe35c', 12) }
  else if (type === 'freeze') { state.freezeTimer = FREEZE_DURATION; showToast(state, p.id, 'Freeze!'); spawnParticles(state, cx, cy, '#bfe8ff', 12) }
  else if (type === 'life') { p.lives = Math.min(MAX_LIVES, p.lives + 1); showToast(state, p.id, 'Extra Life!'); spawnParticles(state, cx, cy, '#ff6a8a', 12) }
}

// A hawk only gets curious after a long stretch with no new best
// distance for THAT player. It telegraphs where it's diving (a
// snapshot of the player's position the instant it notices) and only
// actually hits if the player is still near that spot once the dive
// resolves — any movement at all during the telegraph is enough to
// dodge it, and successfully dodging resets the stall clock for a
// fresh grace period. A freeze pauses the stall clock entirely (and
// any hawk already inbound), since the world — including the threat
// of a hawk — is standing still.
function stepHawk(state, player) {
  const p = player
  if (!p.alive || state.status !== 'playing' || state.freezeTimer > 0) return
  p.framesSinceProgress++
  if (!p.hawk && p.framesSinceProgress > STALL_THRESHOLD_FRAMES) {
    p.hawk = { targetX: p.x + PLAYER_SIZE.w / 2, targetRow: p.row, timer: HAWK_TELEGRAPH_FRAMES, totalFrames: HAWK_TELEGRAPH_FRAMES }
  }
  if (p.hawk) {
    p.hawk.timer--
    if (p.hawk.timer <= 0) {
      const dx = (p.x + PLAYER_SIZE.w / 2) - p.hawk.targetX
      const sameRow = p.row === p.hawk.targetRow
      if (sameRow && Math.abs(dx) < HAWK_HIT_RADIUS) resolveHit(state, p, 'hawk')
      p.hawk = null
      p.framesSinceProgress = 0
    }
  }
}

export function stepGame(state, input1, input2) {
  if (state.status !== 'playing') {
    state.particles.forEach(pt => { pt.x += pt.vx; pt.dy += pt.vy; pt.vy += 0.2; pt.life-- })
    state.particles = state.particles.filter(pt => pt.life > 0)
    return
  }
  state.frame++
  if (state.freezeTimer > 0) state.freezeTimer--

  const inputs = [input1, input2]
  let maxCameraRow = 0
  for (const player of state.players) {
    const p = player
    if (p.shieldTimer > 0) p.shieldTimer--
    if (p.speedTimer > 0) p.speedTimer--
    if (p.respawnInvuln > 0) p.respawnInvuln--

    if (p.alive) {
      const input = inputs[p.id] || {}
      const prev = p.prevInput
      if (input.up && !prev.up) tryHop(state, p, 'up')
      else if (input.down && !prev.down) tryHop(state, p, 'down')
      else if (input.left && !prev.left) tryHop(state, p, 'left')
      else if (input.right && !prev.right) tryHop(state, p, 'right')
      p.prevInput = { up: !!input.up, down: !!input.down, left: !!input.left, right: !!input.right }
      stepHopTween(p)
    }
    maxCameraRow = Math.max(maxCameraRow, p.row + ROWS + LANE_GEN_BUFFER_ROWS)
  }
  ensureLanesTo(state, maxCameraRow)

  if (state.freezeTimer <= 0) {
    // Only simulate lanes actually near a camera — the lanes array only
    // ever grows over a long session, so stepping the whole history
    // every frame would make the per-frame cost creep upward the
    // longer you play.
    let loRow = Infinity, hiRow = 0
    for (const p of state.players) {
      loRow = Math.min(loRow, Math.floor(p.camera.row) - 2)
      hiRow = Math.max(hiRow, Math.ceil(p.camera.row) + ROWS + LANE_GEN_BUFFER_ROWS)
    }
    loRow = Math.max(0, loRow)
    hiRow = Math.min(state.lanes.length - 1, hiRow)
    for (let r = loRow; r <= hiRow; r++) {
      const lane = state.lanes[r]
      if (!lane) continue
      if (lane.type === 'road') stepVehicles(lane)
      else if (lane.type === 'river') stepLogs(lane)
      else if (lane.type === 'rail') stepRail(lane)
    }
  }

  for (const player of state.players) {
    if (!player.alive) continue
    stepRiverCarry(state, player)
    checkRoadCollision(state, player)
    checkRailCollision(state, player)
    if (player.alive && state.status === 'playing' && (player.x < -TILE || player.x > PLAY_W)) resolveHit(state, player, 'fell')
    checkPowerupPickup(state, player)
    stepHawk(state, player)

    const targetCameraRow = Math.max(0, player.displayRow - CAMERA_LOOKAHEAD_ROWS)
    player.camera.row += (targetCameraRow - player.camera.row) * CAMERA_EASE
  }

  state.particles.forEach(pt => { pt.x += pt.vx; pt.dy += pt.vy; pt.vy += 0.2; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)
  state.toasts.forEach(t => t.timer--)
  state.toasts = state.toasts.filter(t => t.timer > 0)
}

export function rowToScreenY(viewport, row) {
  return viewport.y0 + (viewport.rows - 1) * TILE - (row - viewport.cameraRow) * TILE
}
