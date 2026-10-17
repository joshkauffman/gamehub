// ── The Obvious Donkey Kong Knockoff — game engine ────────────────────
// Pure state/physics, no rendering. Single static screen per stage, no
// camera. Girders are flat tiles (vertical collision only — nothing in
// these layouts ever requires horizontal tile collision, since the gap
// between consecutive girders is always open air); ladders are a
// separate climb mode that takes over movement entirely while active.

import {
  W, PLAY_Y0, TILE, COLS, ROWS, GRAVITY, JUMP_V, MOVE_SPEED, CLIMB_SPEED, PLAYER_SIZE,
  BARREL_SIZE, BARREL_SPEED, HAMMER_DURATION, LIVES_START,
  SCORE_JUMP_BARREL, SCORE_SMASH_BARREL, SCORE_RIVET, SCORE_STAGE_CLEAR,
  SOLID_CHARS, LADDER_CHARS,
} from './constants.js'
import { STAGES } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function colToX(col) { return col * TILE }
function rowToY(row) { return PLAY_Y0 + row * TILE }
function inBounds(row, col) { return row >= 0 && row < ROWS && col >= 0 && col < COLS }

function tileCharAt(state, row, col) {
  if (!inBounds(row, col)) return '.'
  return state.tiles[row][col]
}
function isSolidAt(state, row, col) { return SOLID_CHARS.has(tileCharAt(state, row, col)) }
function isLadderAt(state, row, col) { return LADDER_CHARS.has(tileCharAt(state, row, col)) }

// What tile is directly under an entity's feet-center — used both for
// "can I stand here" and "am I touching a ladder" checks.
function footTile(e) {
  return { col: Math.floor((e.x + e.w / 2) / TILE), row: Math.floor((e.y + e.h - PLAY_Y0) / TILE) }
}

function moveVerticalOnGirders(state, e) {
  e.y += e.vy
  e.onGround = false
  if (e.vy >= 0) {
    const col = Math.floor((e.x + e.w / 2) / TILE)
    const row = Math.floor((e.y + e.h - PLAY_Y0) / TILE)
    if (isSolidAt(state, row, col)) { e.y = rowToY(row) - e.h; e.vy = 0; e.onGround = true }
  }
}

export function freshState(stageIndex = 0, lives = LIVES_START, score = 0) {
  const stage = STAGES[stageIndex]
  return {
    stageIndex,
    tiles: stage.rows.map(r => r.slice()),
    stage,
    lives, score,
    status: 'playing', // playing | cleared | dead | gameover
    message: '', messageTimer: 0,
    frame: 0,
    player: {
      x: colToX(stage.playerStart.col), y: rowToY(stage.playerStart.row) - PLAYER_SIZE.h,
      w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0, onGround: true, facing: 1,
      climbing: false, hammerTimer: 0, invulnTimer: 0, jumping: false,
    },
    barrels: [],
    barrelTimer: 90,
    rivets: stage.rivets.map(r => ({ ...r, taken: false })),
    hammersLeft: stage.hammers.map(h => ({ ...h, taken: false })),
  }
}

function showMessage(state, text, frames = 90) { state.message = text; state.messageTimer = frames }

function respawnPlayer(state) {
  const p = state.player
  const stage = state.stage
  p.x = colToX(stage.playerStart.col); p.y = rowToY(stage.playerStart.row) - p.h
  p.vx = 0; p.vy = 0; p.climbing = false; p.hammerTimer = 0; p.invulnTimer = 90
  state.barrels = []
  state.barrelTimer = 90
}

function loseLife(state) {
  state.lives--
  if (state.lives <= 0) {
    state.status = 'gameover'
    showMessage(state, 'Out of lives!', 999)
  } else {
    showMessage(state, 'Ouch!', 60)
    respawnPlayer(state)
  }
}

function chuteForRow(state, row) {
  return state.stage.chutes.find(c => c.row === row)
}

function spawnBarrel(state) {
  const sp = state.stage.barrelSpawn
  const chute = chuteForRow(state, sp.row)
  const startX = colToX(sp.col)
  const dir = chute && colToX(chute.col) < startX ? -1 : 1
  state.barrels.push({
    x: startX, y: rowToY(sp.row) - BARREL_SIZE.h, w: BARREL_SIZE.w, h: BARREL_SIZE.h,
    vx: BARREL_SPEED * dir, vy: 0, onGround: true, scored: false, rollPhase: 0, age: 0,
  })
}

export function stepGame(state, input) {
  if (state.status !== 'playing') return
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  const p = state.player
  if (p.invulnTimer > 0) p.invulnTimer--
  if (p.hammerTimer > 0) p.hammerTimer--

  const foot = footTile(p)
  const onLadderNow = isLadderAt(state, foot.row, foot.col)

  if (onLadderNow && !input.left && !input.right && (input.up || input.down || p.climbing)) {
    p.climbing = true
    p.vy = input.up ? -CLIMB_SPEED : input.down ? CLIMB_SPEED : 0
    p.vx = 0
    p.y += p.vy
    p.onGround = false
    p.jumping = false
    // Clamp so climbing off the top of a ladder lands you standing on
    // the girder above rather than overshooting into it.
    const newFoot = footTile(p)
    if (p.vy < 0 && isSolidAt(state, newFoot.row, newFoot.col) && !isLadderAt(state, newFoot.row, newFoot.col)) {
      p.y = rowToY(newFoot.row) - p.h
      p.climbing = false
      p.onGround = true
    }
  } else {
    p.climbing = false
    if (input.left) { p.vx = -MOVE_SPEED; p.facing = -1 }
    else if (input.right) { p.vx = MOVE_SPEED; p.facing = 1 }
    else p.vx = 0
    p.x += p.vx
    p.x = Math.max(TILE, Math.min(COLS * TILE - TILE - p.w, p.x))

    if (input.jump && p.onGround) { p.vy = JUMP_V; p.onGround = false; p.jumping = true }
    p.vy += GRAVITY
    if (p.vy > 14) p.vy = 14
    moveVerticalOnGirders(state, p)
    if (p.onGround) p.jumping = false
  }

  // ── Hammer pickup ──────────────────────────────────────────────
  for (const h of state.hammersLeft) {
    if (h.taken) continue
    const rect = { x: colToX(h.col), y: rowToY(h.row) - TILE, w: TILE, h: TILE }
    if (aabb(p, rect)) { h.taken = true; p.hammerTimer = HAMMER_DURATION; showMessage(state, 'Got the hammer!', 60) }
  }

  // ── Rivets ───────────────────────────────────────────────────────
  for (const r of state.rivets) {
    if (r.taken) continue
    const rect = { x: colToX(r.col), y: rowToY(r.row) - TILE, w: TILE, h: TILE }
    if (aabb(p, rect)) { r.taken = true; state.score += SCORE_RIVET }
  }

  // ── Barrels: spawn, roll toward this girder's chute, drop through it ──
  // Girders are solid all the way across (no physical gap), so where a
  // barrel falls is a scripted trigger (the chute column) rather than
  // "wherever rolling happened to carry it past an edge" — that keeps
  // landings fully deterministic instead of depending on exact drift
  // during a multi-tile fall, which could otherwise carry a barrel
  // past the next girder's solid columns entirely.
  state.barrelTimer--
  if (state.barrelTimer <= 0) { spawnBarrel(state); state.barrelTimer = state.stage.barrelInterval }

  for (const b of state.barrels) {
    b.age++
    const wasOnGround = b.onGround
    if (wasOnGround) {
      const row = Math.round((b.y + b.h - PLAY_Y0) / TILE)
      const chute = chuteForRow(state, row)
      if (chute) {
        const chuteX = colToX(chute.col) + TILE / 2 - b.w / 2
        if (Math.abs(b.x - chuteX) <= Math.abs(b.vx)) {
          b.x = chuteX
          // Girders are solid everywhere (no literal hole at the chute
          // column — that column is also a ladder tile the player
          // needs to stand on), so a tiny nudge gets immediately
          // re-caught by this same row's collision check. Drop a full
          // tile below the girder's surface, into the genuinely open
          // gap between girder rows, so the next frame's fall-check
          // actually finds open air instead of snapping right back.
          b.y = rowToY(row) + TILE
          b.onGround = false
        } else {
          b.vx = b.x < chuteX ? Math.abs(BARREL_SPEED) : -Math.abs(BARREL_SPEED)
          b.x += b.vx
        }
      } else {
        // No chute at this row (the floor) — just pace back and forth.
        b.x += b.vx
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) }
        else if (b.x > W - b.w) { b.x = W - b.w; b.vx = -Math.abs(b.vx) }
      }
    }
    b.vy += GRAVITY
    if (b.vy > 14) b.vy = 14
    moveVerticalOnGirders(state, b)
    b.rollPhase += Math.abs(b.vx) * 0.3
  }
  state.barrels = state.barrels.filter(b => b.y < ROWS * TILE + 100 && b.age < 2400)

  // ── Barrel vs player ───────────────────────────────────────────────
  for (const b of state.barrels) {
    if (!aabb(p, b)) {
      // Jump-over scoring: airborne, horizontally overlapping, barrel
      // just below the player's feet.
      if (!b.scored && !p.onGround && p.x < b.x + b.w && p.x + p.w > b.x) {
        const feetY = p.y + p.h
        if (b.y > feetY - 6 && b.y < feetY + 18) { b.scored = true; state.score += SCORE_JUMP_BARREL }
      }
      continue
    }
    if (p.hammerTimer > 0) {
      b.dead = true
      state.score += SCORE_SMASH_BARREL
    } else if (p.invulnTimer <= 0) {
      loseLife(state)
      break
    }
  }
  state.barrels = state.barrels.filter(b => !b.dead)

  // ── Win conditions ─────────────────────────────────────────────────
  if (state.status === 'playing') {
    const stage = state.stage
    if (stage.goal) {
      const goalRect = { x: colToX(stage.goal.col), y: rowToY(stage.goal.row) - TILE, w: TILE, h: TILE }
      if (aabb(p, goalRect)) { state.status = 'cleared'; state.score += SCORE_STAGE_CLEAR; showMessage(state, 'Stage clear!', 999) }
    } else if (state.rivets.length > 0 && state.rivets.every(r => r.taken)) {
      state.status = 'cleared'; state.score += SCORE_STAGE_CLEAR; showMessage(state, 'Stage clear!', 999)
    }
  }
}

export function nextStageState(state) {
  const nextIndex = state.stageIndex + 1
  if (nextIndex >= STAGES.length) return null
  return freshState(nextIndex, state.lives, state.score)
}

export function restartRun() { return freshState(0, LIVES_START, 0) }
