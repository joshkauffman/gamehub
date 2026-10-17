// ── The Obvious Metroid Knockoff — game engine ────────────────────────
// Pure state/physics, no rendering. One frame of simulation per stepGame
// call; render.js reads the resulting state to draw it. Each room is a
// single static screen (no in-room camera scrolling) — see levels.js
// for how the world graph and its doors are built.

import {
  PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, PLAY_W, PLAY_H,
  GRAVITY, JUMP_V, HIGH_JUMP_MULT, MOVE_ACCEL, MAX_SPEED, FRICTION, MORPH_SPEED_MULT,
  SPEED_BOOST_CHARGE_FRAMES, SPEED_BOOST_MULT, STAND_SIZE, MORPH_SIZE,
  ENERGY_START, ENERGY_TANK_BONUS, MISSILE_BASE_CAPACITY, MISSILE_TANK_BONUS,
  CONTACT_DAMAGE, BOSS_SHOT_DAMAGE, HEAT_DAMAGE_PER_FRAME, INVINCIBLE_FRAMES,
  BEAM_COOLDOWN, BEAM_SPEED, BEAM_DAMAGE, MISSILE_COOLDOWN, MISSILE_SPEED, MISSILE_DAMAGE,
  BOMB_FUSE, BOMB_RADIUS, BOMB_DAMAGE, BOSS_HP, SOLID_TILES, HAZARD_TILES, ITEM_DEFS, GUN_HEIGHT_FRAC,
} from './constants.js'
import { WORLD, START_ROOM_KEY, TOTAL_ITEMS } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

const ENEMY_HP = { crawler: 2, drifter: 2, turret: 3 }
const ENEMY_SIZE = { crawler: { w: 32, h: 28 }, drifter: { w: 28, h: 28 }, turret: { w: 32, h: 32 } }

function tileCol(px) { return Math.floor((px - PLAY_X0) / TILE) }
function tileRow(py) { return Math.floor((py - PLAY_Y0) / TILE) }
// Out-of-bounds is only reachable through a door that was actually
// carved open (an un-doored edge stays solid '#' as authored), so it's
// never solid itself — treating it as solid would catch a player
// mid-transition before checkRoomTransition gets a chance to fire.
function isSolidTile(tiles, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false
  return SOLID_TILES.has(tiles[row][col])
}
function tileCharAt(tiles, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return '#'
  return tiles[row][col]
}
function rectHitsSolid(tiles, r) {
  const c0 = tileCol(r.x), c1 = tileCol(r.x + r.w - 1)
  const r0 = tileRow(r.y), r1 = tileRow(r.y + r.h - 1)
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) if (isSolidTile(tiles, rr, cc)) return true
  return false
}
function rectOverlapsHazard(tiles, r) {
  const c0 = tileCol(r.x), c1 = tileCol(r.x + r.w - 1)
  const r0 = tileRow(r.y), r1 = tileRow(r.y + r.h - 1)
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
    if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue
    if (HAZARD_TILES.has(tiles[rr][cc])) return true
  }
  return false
}

// Moves an entity by its current vx/vy, resolving against solid tiles
// one tile-row/col at a time — fine at these speeds (well under one
// tile per frame), no need for a full swept sweep.
function moveWithTiles(e, tiles) {
  e.x += e.vx
  if (e.vx > 0) {
    const c1 = tileCol(e.x + e.w - 1)
    const r0 = tileRow(e.y), r1 = tileRow(e.y + e.h - 1)
    for (let r = r0; r <= r1; r++) if (isSolidTile(tiles, r, c1)) { e.x = PLAY_X0 + c1 * TILE - e.w; e.vx = 0; break }
  } else if (e.vx < 0) {
    const c0 = tileCol(e.x)
    const r0 = tileRow(e.y), r1 = tileRow(e.y + e.h - 1)
    for (let r = r0; r <= r1; r++) if (isSolidTile(tiles, r, c0)) { e.x = PLAY_X0 + (c0 + 1) * TILE; e.vx = 0; break }
  }
  e.y += e.vy
  e.onGround = false
  if (e.vy > 0) {
    const r1 = tileRow(e.y + e.h - 1)
    const c0 = tileCol(e.x), c1 = tileCol(e.x + e.w - 1)
    for (let c = c0; c <= c1; c++) if (isSolidTile(tiles, r1, c)) { e.y = PLAY_Y0 + r1 * TILE - e.h; e.vy = 0; e.onGround = true; break }
  } else if (e.vy < 0) {
    const r0 = tileRow(e.y)
    const c0 = tileCol(e.x), c1 = tileCol(e.x + e.w - 1)
    for (let c = c0; c <= c1; c++) if (isSolidTile(tiles, r0, c)) { e.y = PLAY_Y0 + (r0 + 1) * TILE; e.vy = 0; break }
  }
}

function colToX(col) { return PLAY_X0 + col * TILE }
function rowToY(row) { return PLAY_Y0 + row * TILE }

function freshAbilities() {
  return { missiles: false, morph: false, bombs: false, highJump: false, thermal: false, speedBooster: false }
}

function makeEnemy(def) {
  const size = ENEMY_SIZE[def.type]
  const baseY = rowToY(def.baseRow != null ? def.baseRow : def.row) - size.h
  return {
    type: def.type, w: size.w, h: size.h,
    x: colToX(def.col) + (TILE - size.w) / 2,
    y: rowToY(def.row) - size.h,
    baseY,
    minX: def.minCol != null ? colToX(def.minCol) : null,
    maxX: def.maxCol != null ? colToX(def.maxCol) : null,
    facing: def.facing || 'left',
    hp: ENEMY_HP[def.type] || 2,
    vx: def.type === 'turret' ? 0 : (1.2 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1),
    alive: true, hitFlash: 0, attackCooldown: 60 + Math.random() * 60,
    phase: Math.random() * Math.PI * 2,
    isAdd: false,
  }
}

function loadRoom(state, roomKey, entrySide) {
  const room = WORLD[roomKey]
  state.roomKey = roomKey
  state.roomName = room.name
  state.biome = room.biome
  state.isBossRoom = room.isBoss
  state.neighbors = room.neighbors
  state.visitedRooms.add(roomKey)

  const tiles = room.rows.map(r => r.slice())
  for (const destroyedKey of state.destroyedTiles) {
    const [dKey, rStr, cStr] = destroyedKey.split('|')
    if (dKey === roomKey) tiles[Number(rStr)][Number(cStr)] = '.'
  }
  state.tiles = tiles
  state.tileCrackHits = {}

  state.items = (room.items || [])
    .map((it, idx) => ({ ...it, id: `${roomKey}#${idx}` }))
    .filter(it => !state.collectedItems.has(it.id))
    .map(it => ({ ...it, x: colToX(it.col) + TILE / 2 - 14, y: rowToY(it.row) - 28, w: 28, h: 28, bob: Math.random() * Math.PI * 2 }))

  state.enemies = (room.enemies || []).map(makeEnemy)
  state.beams = []
  state.missiles = []
  state.bombs = []
  state.enemyShots = []
  state.particles = []
  state.boss = room.isBoss ? {
    x: PLAY_X0 + PLAY_W / 2 - 44, y: PLAY_Y0 + PLAY_H / 2 - 100, w: 88, h: 88,
    hp: BOSS_HP, maxHp: BOSS_HP, alive: true, attackCooldown: 90, addCooldown: 200, bob: 0,
  } : null

  const p = state.player
  p.morphed = false
  p.w = STAND_SIZE.w; p.h = STAND_SIZE.h
  p.vx = 0
  if (entrySide === 'start') {
    // Off-center and well clear of the vertical-shaft columns, so a
    // start room with a down exit doesn't drop the player through the
    // floor before they've taken a single step.
    p.x = colToX(6) - p.w / 2
    p.y = rowToY(ROWS - 2) - p.h
    p.vy = 0
    p.facing = 1
  } else if (entrySide === 'left') {
    p.x = PLAY_X0 + TILE * 1.4
    p.y = rowToY(ROWS - 2) - p.h
    p.vy = 0
    p.facing = 1
  } else if (entrySide === 'right') {
    p.x = PLAY_X0 + PLAY_W - TILE * 1.4 - p.w
    p.y = rowToY(ROWS - 2) - p.h
    p.vy = 0
    p.facing = -1
  } else if (entrySide === 'top') {
    p.x = colToX(Math.floor(COLS / 2)) - p.w / 2
    p.y = PLAY_Y0 + TILE * 1.5
    p.vy = 1
  } else if (entrySide === 'bottom') {
    p.x = colToX(Math.floor(COLS / 2)) - p.w / 2
    p.y = PLAY_Y0 + PLAY_H - TILE * 2.2 - p.h
    p.vy = -5
  }
}

export function freshState() {
  const state = {
    frame: 0,
    status: 'playing',
    mapOpen: false,
    prevMapHeld: false,
    score: 0,
    message: '', messageTimer: 0,
    collectedItems: new Set(),
    destroyedTiles: new Set(),
    visitedRooms: new Set(),
    player: {
      x: 0, y: 0, w: STAND_SIZE.w, h: STAND_SIZE.h, vx: 0, vy: 0, onGround: false, facing: 1,
      morphed: false, invincible: 90, energy: ENERGY_START, maxEnergy: ENERGY_START,
      missilesCount: 0, maxMissiles: 0, abilities: freshAbilities(),
      prevDownHeld: false, prevUpHeld: false, prevJumpHeld: false,
      beamCooldown: 0, missileCooldown: 0, boostCharge: 0, boosting: false,
    },
  }
  loadRoom(state, START_ROOM_KEY, 'start')
  return state
}

function showMessage(state, text) { state.message = text; state.messageTimer = 110 }

function spawnParticles(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 22, color })
  }
}

function collectItem(state, item) {
  state.collectedItems.add(item.id)
  const def = ITEM_DEFS[item.type]
  const p = state.player
  if (item.type === 'missile_launcher') {
    p.abilities.missiles = true
    p.maxMissiles += MISSILE_BASE_CAPACITY
    p.missilesCount = p.maxMissiles
  } else if (item.type === 'missile_tank') {
    p.maxMissiles += MISSILE_TANK_BONUS
    p.missilesCount += MISSILE_TANK_BONUS
  } else if (item.type === 'morph_ball') {
    p.abilities.morph = true
  } else if (item.type === 'bombs') {
    p.abilities.bombs = true
  } else if (item.type === 'high_jump') {
    p.abilities.highJump = true
  } else if (item.type === 'energy_tank') {
    p.maxEnergy += ENERGY_TANK_BONUS
    p.energy += ENERGY_TANK_BONUS
  } else if (item.type === 'thermal_plating') {
    p.abilities.thermal = true
  } else if (item.type === 'speed_booster') {
    p.abilities.speedBooster = true
  }
  state.score += 100
  showMessage(state, `${def.label} acquired! ${def.desc}`)
  spawnParticles(state, item.x + item.w / 2, item.y + item.h / 2, def.color, 14)
}

function hurtPlayer(state, amount) {
  const p = state.player
  if (p.invincible > 0) return
  p.energy -= amount
  p.invincible = INVINCIBLE_FRAMES
  spawnParticles(state, p.x + p.w / 2, p.y + p.h / 2, '#ff5c5c', 10)
  if (p.energy <= 0) { p.energy = 0; state.status = 'gameover' }
}

function destroyTileAt(state, row, col, requiredChar) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false
  if (state.tiles[row][col] !== requiredChar) return false
  state.tiles[row][col] = '.'
  state.destroyedTiles.add(`${state.roomKey}|${row}|${col}`)
  spawnParticles(state, colToX(col) + TILE / 2, rowToY(row) + TILE / 2, '#c9a46a', 10)
  return true
}

function explodeBomb(state, bomb) {
  const cx = bomb.x + bomb.w / 2, cy = bomb.y + bomb.h / 2
  spawnParticles(state, cx, cy, '#ffe35c', 18)
  const c0 = tileCol(cx - BOMB_RADIUS), c1 = tileCol(cx + BOMB_RADIUS)
  const r0 = tileRow(cy - BOMB_RADIUS), r1 = tileRow(cy + BOMB_RADIUS)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = (colToX(c) + TILE / 2) - cx, dy = (rowToY(r) + TILE / 2) - cy
      if (dx * dx + dy * dy <= BOMB_RADIUS * BOMB_RADIUS) destroyTileAt(state, r, c, 'B')
    }
  }
  for (const e of state.enemies) {
    if (!e.alive) continue
    const dx = (e.x + e.w / 2) - cx, dy = (e.y + e.h / 2) - cy
    if (dx * dx + dy * dy <= BOMB_RADIUS * BOMB_RADIUS) hurtEnemy(state, e, BOMB_DAMAGE, '#ffe35c')
  }
  if (state.boss && state.boss.alive) {
    const b = state.boss
    const dx = (b.x + b.w / 2) - cx, dy = (b.y + b.h / 2) - cy
    if (dx * dx + dy * dy <= BOMB_RADIUS * BOMB_RADIUS * 1.4) hurtBoss(state, BOMB_DAMAGE)
  }
  const p = state.player
  const dxp = (p.x + p.w / 2) - cx, dyp = (p.y + p.h / 2) - cy
  if (dxp * dxp + dyp * dyp <= (BOMB_RADIUS * 1.1) * (BOMB_RADIUS * 1.1) && p.onGround) {
    p.vy = -7
  }
}

function hurtEnemy(state, e, dmg, color) {
  e.hp -= dmg
  e.hitFlash = 8
  spawnParticles(state, e.x + e.w / 2, e.y + e.h / 2, color, 6)
  if (e.hp <= 0) { e.alive = false; state.score += 50 }
}

function hurtBoss(state, dmg) {
  const b = state.boss
  if (!b || !b.alive) return
  b.hp -= dmg
  b.flash = 8
  spawnParticles(state, b.x + b.w / 2, b.y + b.h / 2, '#ff8a8a', 10)
  if (b.hp <= 0) {
    b.alive = false
    state.score += 2000
    spawnParticles(state, b.x + b.w / 2, b.y + b.h / 2, '#ffd873', 40)
    state.status = 'win'
  }
}

const BEAM_CRACKS_TO_BREAK_K = 5

function stepBeams(state) {
  state.beams.forEach(b => {
    b.x += b.vx
    if (b.x < PLAY_X0 || b.x > PLAY_X0 + PLAY_W) { b.dead = true; return }
    const row = tileRow(b.y), col = tileCol(b.x)
    const ch = tileCharAt(state.tiles, row, col)
    // The beam alone can eventually crack a missile block — slower than
    // a missile, but it means missing the launcher can never hard-lock
    // you behind a missile-gated door.
    if (ch === 'K') {
      const key = `${row},${col}`
      state.tileCrackHits[key] = (state.tileCrackHits[key] || 0) + 1
      if (state.tileCrackHits[key] >= BEAM_CRACKS_TO_BREAK_K) destroyTileAt(state, row, col, 'K')
      else spawnParticles(state, b.x, b.y, '#c9a46a', 3)
      b.dead = true
      return
    }
    if (isSolidTile(state.tiles, row, col)) { b.dead = true; return }
    for (const e of state.enemies) {
      if (e.alive && aabb(b, e)) { hurtEnemy(state, e, BEAM_DAMAGE, '#9dffb0'); b.dead = true; break }
    }
    if (!b.dead && state.boss && state.boss.alive && aabb(b, state.boss)) { hurtBoss(state, BEAM_DAMAGE); b.dead = true }
    for (const es of state.enemyShots) {
      if (!es.dead && aabb(b, es)) { es.dead = true; b.dead = true; break }
    }
  })
  state.beams = state.beams.filter(b => !b.dead)
}

function stepMissiles(state) {
  state.missiles.forEach(m => {
    m.x += m.vx
    if (m.x < PLAY_X0 || m.x > PLAY_X0 + PLAY_W) { m.dead = true; return }
    const row = tileRow(m.y), col = tileCol(m.x)
    const ch = tileCharAt(state.tiles, row, col)
    if (ch === 'K') { destroyTileAt(state, row, col, 'K'); m.dead = true; return }
    if (isSolidTile(state.tiles, row, col)) { m.dead = true; return }
    for (const e of state.enemies) {
      if (e.alive && aabb(m, e)) { hurtEnemy(state, e, MISSILE_DAMAGE, '#ffb85c'); m.dead = true; break }
    }
    if (!m.dead && state.boss && state.boss.alive && aabb(m, state.boss)) { hurtBoss(state, MISSILE_DAMAGE); m.dead = true }
  })
  state.missiles = state.missiles.filter(m => !m.dead)
}

function stepBombs(state) {
  state.bombs.forEach(b => { b.fuse--; if (b.fuse <= 0) { explodeBomb(state, b); b.dead = true } })
  state.bombs = state.bombs.filter(b => !b.dead)
}

function stepEnemyShots(state) {
  const p = state.player
  state.enemyShots.forEach(es => {
    es.x += es.vx; es.y += es.vy
    if (es.x < PLAY_X0 - 20 || es.x > PLAY_X0 + PLAY_W + 20 || es.y < PLAY_Y0 - 20 || es.y > PLAY_Y0 + PLAY_H + 20) { es.dead = true; return }
    if (isSolidTile(state.tiles, tileRow(es.y), tileCol(es.x))) { es.dead = true; return }
    if (!p.morphed && aabb(es, p)) { es.dead = true; hurtPlayer(state, es.dmg || CONTACT_DAMAGE) }
  })
  state.enemyShots = state.enemyShots.filter(es => !es.dead)
}

function stepEnemies(state) {
  const p = state.player
  for (const e of state.enemies) {
    if (!e.alive) continue
    if (e.type === 'crawler') {
      e.x += e.vx
      if (e.minX != null && e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx) }
      if (e.maxX != null && e.x + e.w > e.maxX + TILE) { e.x = e.maxX + TILE - e.w; e.vx = -Math.abs(e.vx) }
    } else if (e.type === 'drifter') {
      e.x += e.vx
      if (e.minX != null && e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx) }
      if (e.maxX != null && e.x + e.w > e.maxX + TILE) { e.x = e.maxX + TILE - e.w; e.vx = -Math.abs(e.vx) }
      e.phase += 0.045
      e.y = e.baseY + Math.sin(e.phase) * 18
    } else if (e.type === 'turret') {
      e.attackCooldown--
      if (e.attackCooldown <= 0) {
        e.attackCooldown = 130
        const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[e.facing] || [-1, 0]
        state.enemyShots.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, w: 10, h: 10, vx: dir[0] * 3.2, vy: dir[1] * 3.2, dmg: CONTACT_DAMAGE })
      }
    }
    if (e.hitFlash > 0) e.hitFlash--
    if (!p.morphed && p.invincible <= 0 && aabb(p, e)) hurtPlayer(state, CONTACT_DAMAGE)
  }
  state.enemies = state.enemies.filter(e => e.alive)
}

function stepBoss(state) {
  const b = state.boss
  if (!b || !b.alive) return
  const p = state.player
  b.bob += 0.04
  b.y = (PLAY_Y0 + PLAY_H / 2 - 100) + Math.sin(b.bob) * 10
  if (b.flash > 0) b.flash--
  b.attackCooldown--
  if (b.attackCooldown <= 0) {
    b.attackCooldown = 115
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    const baseAngle = Math.atan2((p.y + p.h / 2) - cy, (p.x + p.w / 2) - cx)
    for (const off of [-0.3, 0, 0.3]) {
      const ang = baseAngle + off
      state.enemyShots.push({ x: cx, y: cy, w: 12, h: 12, vx: Math.cos(ang) * 3.4, vy: Math.sin(ang) * 3.4, dmg: BOSS_SHOT_DAMAGE })
    }
  }
  b.addCooldown--
  if (b.addCooldown <= 0) {
    const liveAdds = state.enemies.filter(e => e.alive && e.isAdd).length
    if (liveAdds < 2) {
      b.addCooldown = 260
      const add = makeEnemy({ type: 'drifter', col: Math.floor((b.x - PLAY_X0) / TILE), row: Math.floor((b.y - PLAY_Y0) / TILE) + 2, minCol: 4, maxCol: 20, baseRow: Math.floor((b.y - PLAY_Y0) / TILE) + 2 })
      add.isAdd = true
      state.enemies.push(add)
    } else {
      b.addCooldown = 60
    }
  }
  if (!p.morphed && p.invincible <= 0 && aabb(p, b)) {
    hurtPlayer(state, CONTACT_DAMAGE)
    p.vx = (p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1) * 4
  }
}

function tryUnmorph(state) {
  const p = state.player
  const candidate = { x: p.x - (STAND_SIZE.w - MORPH_SIZE.w) / 2, y: p.y - (STAND_SIZE.h - MORPH_SIZE.h), w: STAND_SIZE.w, h: STAND_SIZE.h }
  if (rectHitsSolid(state.tiles, candidate)) return
  p.x = candidate.x; p.y = candidate.y; p.w = STAND_SIZE.w; p.h = STAND_SIZE.h; p.morphed = false
}

function morph(state) {
  const p = state.player
  const newX = p.x + (p.w - MORPH_SIZE.w) / 2
  const newY = p.y + (p.h - MORPH_SIZE.h)
  p.x = newX; p.y = newY; p.w = MORPH_SIZE.w; p.h = MORPH_SIZE.h; p.morphed = true
}

function checkRoomTransition(state) {
  const p = state.player
  const n = state.neighbors
  if (p.x + p.w < PLAY_X0 && n.left) { loadRoom(state, n.left, 'right'); return true }
  if (p.x > PLAY_X0 + PLAY_W && n.right) { loadRoom(state, n.right, 'left'); return true }
  if (p.y < PLAY_Y0 && n.up) { loadRoom(state, n.up, 'bottom'); return true }
  if (p.y > PLAY_Y0 + PLAY_H && n.down) { loadRoom(state, n.down, 'top'); return true }
  return false
}

export function stepGame(state, input) {
  if (state.status !== 'playing') return
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  if (input.map && !state.prevMapHeld) state.mapOpen = !state.mapOpen
  state.prevMapHeld = input.map
  if (state.mapOpen) return

  const p = state.player

  // ── Morph toggle ──────────────────────────────────────────────────
  const downPressed = input.down && !p.prevDownHeld
  const upPressed = input.jump && !p.prevJumpHeld
  if (p.abilities.morph && downPressed && p.onGround) {
    if (p.morphed) tryUnmorph(state); else morph(state)
  } else if (p.morphed && upPressed) {
    tryUnmorph(state)
  }
  p.prevDownHeld = input.down

  // ── Horizontal movement ──────────────────────────────────────────
  const speedMult = p.morphed ? MORPH_SPEED_MULT : 1
  let maxSpeed = MAX_SPEED * speedMult
  if (p.boosting) maxSpeed = MAX_SPEED * SPEED_BOOST_MULT
  if (input.left) { p.vx -= MOVE_ACCEL; p.facing = -1 }
  if (input.right) { p.vx += MOVE_ACCEL; p.facing = 1 }
  if (!input.left && !input.right) p.vx *= FRICTION
  p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx))

  // Speed Booster: hold a direction near top speed long enough to charge
  // a dash that busts through cracked (D) walls.
  if (p.abilities.speedBooster && !p.morphed && (input.left || input.right) && Math.abs(p.vx) > MAX_SPEED * 0.85) {
    p.boostCharge++
  } else {
    p.boostCharge = 0
    p.boosting = false
  }
  if (p.boostCharge >= SPEED_BOOST_CHARGE_FRAMES) p.boosting = true
  if (!input.left && !input.right) p.boosting = false

  // ── Jump ──────────────────────────────────────────────────────────
  if (!p.morphed) {
    if (input.jump && p.onGround) {
      p.vy = JUMP_V * (p.abilities.highJump ? HIGH_JUMP_MULT : 1)
    }
  }
  p.prevJumpHeld = input.jump

  p.vy += GRAVITY
  if (p.vy > 16) p.vy = 16

  // ── Weapons ───────────────────────────────────────────────────────
  if (p.beamCooldown > 0) p.beamCooldown--
  if (p.missileCooldown > 0) p.missileCooldown--
  if (input.shoot && !p.morphed && p.beamCooldown <= 0) {
    p.beamCooldown = BEAM_COOLDOWN
    const bh = 8
    state.beams.push({ x: p.facing > 0 ? p.x + p.w : p.x, y: p.y + p.h * GUN_HEIGHT_FRAC - bh / 2, w: 10, h: bh, vx: p.facing * BEAM_SPEED })
  }
  if (input.action) {
    if (p.morphed && p.abilities.bombs && p.missileCooldown <= 0) {
      p.missileCooldown = 30
      state.bombs.push({ x: p.x + p.w / 2 - 8, y: p.y + p.h / 2 - 8, w: 16, h: 16, fuse: BOMB_FUSE })
    } else if (!p.morphed && p.abilities.missiles && p.missilesCount > 0 && p.missileCooldown <= 0) {
      p.missileCooldown = MISSILE_COOLDOWN
      p.missilesCount--
      const mh = 10
      state.missiles.push({ x: p.facing > 0 ? p.x + p.w : p.x, y: p.y + p.h * GUN_HEIGHT_FRAC - mh / 2, w: 12, h: mh, vx: p.facing * MISSILE_SPEED })
    }
  }

  // ── Move + collide ───────────────────────────────────────────────
  moveWithTiles(p, state.tiles)

  // Busting through a speed-wall: only while boosting, and it eats the
  // boost so you can't chain through an entire room of them.
  if (p.boosting) {
    const aheadX = p.facing >= 0 ? p.x + p.w : p.x - 1
    const row0 = tileRow(p.y), row1 = tileRow(p.y + p.h - 1)
    const col = tileCol(aheadX)
    for (let r = row0; r <= row1; r++) {
      if (tileCharAt(state.tiles, r, col) === 'D') {
        for (let rr = row0; rr <= row1; rr++) destroyTileAt(state, rr, col, 'D')
        p.boosting = false; p.boostCharge = 0
        break
      }
    }
  }

  // ── Hazards ───────────────────────────────────────────────────────
  if (!p.abilities.thermal && rectOverlapsHazard(state.tiles, p)) {
    p.energy -= HEAT_DAMAGE_PER_FRAME
    if (p.energy <= 0) { p.energy = 0; state.status = 'gameover' }
  }

  // ── Items ─────────────────────────────────────────────────────────
  for (const item of state.items) {
    if (aabb(p, item)) { collectItem(state, item); break }
  }
  state.items = state.items.filter(it => !state.collectedItems.has(it.id))

  // ── Projectiles / enemies / boss ─────────────────────────────────
  stepBeams(state)
  stepMissiles(state)
  stepBombs(state)
  stepEnemyShots(state)
  stepEnemies(state)
  stepBoss(state)

  // ── Particles ─────────────────────────────────────────────────────
  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)

  if (p.invincible > 0) p.invincible--

  if (state.status !== 'playing') return

  checkRoomTransition(state)
}

export function itemsCollectedCount(state) { return state.collectedItems.size }
export function totalItemsCount() { return TOTAL_ITEMS }
