// ── The Obvious Zelda Knockoff — game engine ──────────────────────────
// Pure state/physics, no rendering. One frame of simulation per stepGame
// call; render.js reads the resulting state to draw it. Top-down, no
// gravity — each room is a single static screen, same one-screen-at-a-
// time idea as The Obvious Metroid Knockoff, just without the jumping.

import {
  PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, PLAY_W, PLAY_H,
  PLAYER_SIZE, MOVE_SPEED, HEARTS_START, HEART_CONTAINER_BONUS,
  CONTACT_DAMAGE, STRONG_CONTACT_DAMAGE, INVINCIBLE_FRAMES, BOSS_HP,
  SOLID_TILES, ITEM_DEFS,
} from './constants.js'
import { WORLDS, PORTALS, START_WORLD, START_ROOM_KEY, TOTAL_ITEMS } from './levels.js'
import { WEAPON_DEFS } from './weapons.js'
import { characterById } from './characterData.js'

const SLOTS = ['melee', 'item1', 'item2', 'item3']

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

const ENEMY_HP = { blob: 2, pebblefoot: 2, bat: 1, skeleton: 3 }
const ENEMY_SIZE = { blob: { w: 26, h: 26 }, pebblefoot: { w: 28, h: 28 }, bat: { w: 22, h: 22 }, skeleton: { w: 26, h: 30 } }
const ENEMY_SPEED = { blob: 1.1, pebblefoot: 0, bat: 2.1, skeleton: 1.4 }

function tileCol(px) { return Math.floor((px - PLAY_X0) / TILE) }
function tileRow(py) { return Math.floor((py - PLAY_Y0) / TILE) }

// Out-of-bounds is only reachable through a door that was actually
// carved open, so it's never solid itself — treating it as solid would
// catch the player mid-transition before checkRoomTransition fires.
function isSolidTile(tiles, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false
  return SOLID_TILES.has(tiles[row][col])
}
function rectHitsChar(tiles, r, ch) {
  const c0 = tileCol(r.x), c1 = tileCol(r.x + r.w - 1)
  const r0 = tileRow(r.y), r1 = tileRow(r.y + r.h - 1)
  for (let rr = r0; rr <= r1; rr++) {
    for (let cc = c0; cc <= c1; cc++) {
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue
      if (tiles[rr][cc] === ch) return true
    }
  }
  return false
}

// Moves an entity by its current vx/vy, resolving against solid tiles
// one axis at a time (no gravity here — just stop dead at a wall).
function moveWithTiles(e, tiles) {
  e.x += e.vx
  if (e.vx > 0) {
    const c1 = tileCol(e.x + e.w - 1)
    const r0 = tileRow(e.y), r1 = tileRow(e.y + e.h - 1)
    for (let r = r0; r <= r1; r++) if (isSolidTile(tiles, r, c1)) { e.x = PLAY_X0 + c1 * TILE - e.w; break }
  } else if (e.vx < 0) {
    const c0 = tileCol(e.x)
    const r0 = tileRow(e.y), r1 = tileRow(e.y + e.h - 1)
    for (let r = r0; r <= r1; r++) if (isSolidTile(tiles, r, c0)) { e.x = PLAY_X0 + (c0 + 1) * TILE; break }
  }
  e.y += e.vy
  if (e.vy > 0) {
    const r1 = tileRow(e.y + e.h - 1)
    const c0 = tileCol(e.x), c1 = tileCol(e.x + e.w - 1)
    for (let c = c0; c <= c1; c++) if (isSolidTile(tiles, r1, c)) { e.y = PLAY_Y0 + r1 * TILE - e.h; break }
  } else if (e.vy < 0) {
    const r0 = tileRow(e.y)
    const c0 = tileCol(e.x), c1 = tileCol(e.x + e.w - 1)
    for (let c = c0; c <= c1; c++) if (isSolidTile(tiles, r0, c)) { e.y = PLAY_Y0 + (r0 + 1) * TILE; break }
  }
}

function colToX(col) { return PLAY_X0 + col * TILE }
function rowToY(row) { return PLAY_Y0 + row * TILE }

function freshAbilities() { return { melee: false, item1: false, item2: false, item3: false } }

function makeEnemy(def) {
  const size = ENEMY_SIZE[def.type]
  const minX = def.minCol != null ? colToX(def.minCol) : colToX(1)
  const maxX = def.maxCol != null ? colToX(def.maxCol) : colToX(COLS - 2)
  const minY = def.minRow != null ? rowToY(def.minRow) : rowToY(1)
  const maxY = def.maxRow != null ? rowToY(def.maxRow) : rowToY(ROWS - 2)
  const speed = ENEMY_SPEED[def.type]
  const ang = Math.random() * Math.PI * 2
  return {
    type: def.type, w: size.w, h: size.h,
    x: colToX(def.col), y: rowToY(def.row),
    minX, maxX, minY, maxY,
    facing: def.facing || 'left',
    hp: ENEMY_HP[def.type] || 2,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    alive: true, hitFlash: 0, changeDirTimer: 60 + Math.random() * 60,
    attackCooldown: 60 + Math.random() * 60,
  }
}

function fullKey(world, roomKey) { return `${world}:${roomKey}` }

function loadRoom(state, world, roomKey, entrySide, entryPoint) {
  const room = WORLDS[world][roomKey]
  state.world = world
  state.roomKey = roomKey
  state.roomFullKey = fullKey(world, roomKey)
  state.roomName = room.name
  state.biome = room.biome
  state.isBossRoom = room.isBoss
  state.neighbors = room.neighbors
  state.visitedRooms.add(state.roomFullKey)

  const tiles = room.rows.map(r => r.slice())
  for (const destroyedKey of state.destroyedTiles) {
    const [dKey, rStr, cStr] = destroyedKey.split('|')
    if (dKey === state.roomFullKey) tiles[Number(rStr)][Number(cStr)] = '.'
  }
  state.tiles = tiles

  state.items = (room.items || [])
    .map((it, idx) => ({ ...it, id: `${state.roomFullKey}#${idx}` }))
    .filter(it => !state.collectedItems.has(it.id))
    .map(it => ({ ...it, x: colToX(it.col) + TILE / 2 - 14, y: rowToY(it.row) - 14, w: 28, h: 28, bob: Math.random() * Math.PI * 2 }))

  state.enemies = (room.enemies || []).map(makeEnemy)
  state.returning = null
  state.bolts = []
  state.orbs = []
  state.bombs = []
  state.enemyShots = []
  state.particles = []
  state.boss = room.isBoss ? {
    x: PLAY_X0 + PLAY_W / 2 - 40, y: PLAY_Y0 + PLAY_H / 2 - 40, w: 80, h: 80,
    hp: BOSS_HP, maxHp: BOSS_HP, alive: true, attackCooldown: 90, vx: 1, vy: 0,
  } : null

  const p = state.player
  if (entryPoint) {
    p.x = colToX(entryPoint.col) + TILE / 2 - p.w / 2
    p.y = rowToY(entryPoint.row) + TILE / 2 - p.h / 2
  } else if (entrySide === 'start') {
    p.x = colToX(12) - p.w / 2
    p.y = rowToY(6) - p.h / 2
  } else if (entrySide === 'left') {
    p.x = PLAY_X0 + TILE * 1.3
    p.y = rowToY(6) - p.h / 2
    p.facing = 'right'
  } else if (entrySide === 'right') {
    p.x = PLAY_X0 + PLAY_W - TILE * 1.3 - p.w
    p.y = rowToY(6) - p.h / 2
    p.facing = 'left'
  } else if (entrySide === 'top') {
    p.y = PLAY_Y0 + TILE * 1.3
    p.x = colToX(11) + TILE - p.w / 2
    p.facing = 'down'
  } else if (entrySide === 'bottom') {
    p.y = PLAY_Y0 + PLAY_H - TILE * 1.3 - p.h
    p.x = colToX(11) + TILE - p.w / 2
    p.facing = 'up'
  }
  p.vx = 0; p.vy = 0
}

export function freshState(characterId) {
  const state = {
    frame: 0,
    status: 'playing',
    character: characterById(characterId),
    mapOpen: false,
    prevMapHeld: false,
    score: 0,
    message: '', messageTimer: 0,
    collectedItems: new Set(),
    destroyedTiles: new Set(),
    visitedRooms: new Set(),
    player: {
      x: 0, y: 0, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0, facing: 'down',
      hearts: HEARTS_START, maxHearts: HEARTS_START, smallKeys: 0,
      abilities: freshAbilities(), invincible: 90,
      cooldowns: { melee: 0, item1: 0, item2: 0, item3: 0 },
      meleeSwing: 0, meleeWeaponId: null,
    },
  }
  loadRoom(state, START_WORLD, START_ROOM_KEY, 'start')
  return state
}

function showMessage(state, text) { state.message = text; state.messageTimer = 110 }

function spawnParticles(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 20, color })
  }
}

function facingVector(facing) {
  if (facing === 'left') return { x: -1, y: 0 }
  if (facing === 'right') return { x: 1, y: 0 }
  if (facing === 'up') return { x: 0, y: -1 }
  return { x: 0, y: 1 }
}

// Weapon pickups are slot-based ('weapon_melee', 'weapon_item1', ...) —
// the same pickup spot resolves to a different concrete weapon depending
// on which character is being played (see characterData.js). Heart
// containers and small keys aren't weapons, so they resolve through the
// plain ITEM_DEFS table same as before.
function collectItem(state, item) {
  state.collectedItems.add(item.id)
  const p = state.player
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2
  state.score += 100

  if (item.type === 'heart_container') {
    p.maxHearts += HEART_CONTAINER_BONUS; p.hearts = p.maxHearts
    const def = ITEM_DEFS.heart_container
    showMessage(state, `${def.label} acquired! ${def.desc}`)
    spawnParticles(state, cx, cy, def.color, 14)
    return
  }
  if (item.type === 'small_key') {
    p.smallKeys += 1
    const def = ITEM_DEFS.small_key
    showMessage(state, `${def.label} acquired! ${def.desc}`)
    spawnParticles(state, cx, cy, def.color, 14)
    return
  }

  const slot = item.type.replace('weapon_', '')
  const weaponId = state.character.weapons[slot]
  const def = WEAPON_DEFS[weaponId]
  p.abilities[slot] = true
  showMessage(state, `${def.label} acquired! ${def.desc}`)
  spawnParticles(state, cx, cy, def.color, 14)
}

function hurtPlayer(state, amount) {
  const p = state.player
  if (p.invincible > 0) return
  p.hearts -= amount
  p.invincible = INVINCIBLE_FRAMES
  spawnParticles(state, p.x + p.w / 2, p.y + p.h / 2, '#ff5c5c', 10)
  if (p.hearts <= 0) { p.hearts = 0; state.status = 'gameover' }
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

function checkLockedDoor(state) {
  const p = state.player
  if (p.smallKeys <= 0) return
  const probe = { x: p.x - 6, y: p.y - 6, w: p.w + 12, h: p.h + 12 }
  if (rectHitsChar(state.tiles, probe, 'K')) {
    p.smallKeys--
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.tiles[r][c] === 'K') {
          state.tiles[r][c] = '.'
          state.destroyedTiles.add(`${state.roomFullKey}|${r}|${c}`)
        }
      }
    }
    showMessage(state, 'Small Key used — the door creaks open!')
  }
}

function destroyBombWalls(state, cx, cy, radius) {
  const c0 = tileCol(cx - radius), c1 = tileCol(cx + radius)
  const r0 = tileRow(cy - radius), r1 = tileRow(cy + radius)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue
      if (state.tiles[r][c] !== 'B') continue
      const dx = (colToX(c) + TILE / 2) - cx, dy = (rowToY(r) + TILE / 2) - cy
      if (dx * dx + dy * dy <= radius * radius) {
        state.tiles[r][c] = '.'
        state.destroyedTiles.add(`${state.roomFullKey}|${r}|${c}`)
        spawnParticles(state, colToX(c) + TILE / 2, rowToY(r) + TILE / 2, '#c9a46a', 8)
      }
    }
  }
}

// Every character's item3 weapon is bomb-kind (just reskinned/retuned —
// bombs/smokebomb/firebomb), so bomb-gated bonus content stays reachable
// no matter who you're playing.
function explodeBomb(state, bomb) {
  const cx = bomb.x + bomb.w / 2, cy = bomb.y + bomb.h / 2
  spawnParticles(state, cx, cy, bomb.color, 18)
  destroyBombWalls(state, cx, cy, bomb.radius)
  for (const e of state.enemies) {
    if (!e.alive) continue
    const dx = (e.x + e.w / 2) - cx, dy = (e.y + e.h / 2) - cy
    if (dx * dx + dy * dy <= bomb.radius * bomb.radius) hurtEnemy(state, e, bomb.damage, bomb.color)
  }
  if (state.boss && state.boss.alive) {
    const b = state.boss
    const dx = (b.x + b.w / 2) - cx, dy = (b.y + b.h / 2) - cy
    if (dx * dx + dy * dy <= bomb.radius * bomb.radius * 1.4) hurtBoss(state, bomb.damage)
  }
}

// Slot-agnostic: each slot (melee/item1/item2/item3) just looks up
// whatever weapon the current character has plugged into it and
// dispatches on that weapon's `kind` — the slot itself doesn't know or
// care whether it's holding a sword, a dagger, or a flame rod.
function stepWeapons(state, input) {
  const p = state.player
  for (const slot of SLOTS) if (p.cooldowns[slot] > 0) p.cooldowns[slot]--
  if (p.meleeSwing > 0) p.meleeSwing--

  const fv = facingVector(p.facing)
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2

  for (const slot of SLOTS) {
    if (!input[slot] || !p.abilities[slot] || p.cooldowns[slot] > 0) continue
    const weaponId = state.character.weapons[slot]
    const def = WEAPON_DEFS[weaponId]
    if (!def) continue

    if (def.kind === 'melee') {
      p.cooldowns[slot] = def.cooldown
      p.meleeSwing = def.active
      p.meleeWeaponId = weaponId
      const reach = {
        x: cx + fv.x * (p.w / 2) - (fv.x === 0 ? p.w * 0.4 : 2),
        y: cy + fv.y * (p.h / 2) - (fv.y === 0 ? p.h * 0.4 : 2),
        w: fv.x !== 0 ? def.reach : p.w * 0.8,
        h: fv.y !== 0 ? def.reach : p.h * 0.8,
      }
      for (const e of state.enemies) if (e.alive && aabb(reach, e)) hurtEnemy(state, e, def.damage, def.color)
      if (state.boss && state.boss.alive && aabb(reach, state.boss)) hurtBoss(state, def.damage)
    } else if (def.kind === 'return') {
      if (state.returning) continue // only one can be in flight at a time
      p.cooldowns[slot] = def.cooldown
      state.returning = {
        weaponId, color: def.color, damage: def.damage, speed: def.speed, range: def.range,
        x: cx, y: cy, vx: fv.x * def.speed, vy: fv.y * def.speed,
        traveled: 0, returning: false, hit: new Set(),
      }
    } else if (def.kind === 'straight') {
      p.cooldowns[slot] = def.cooldown
      const size = def.size || 10
      state.bolts.push({
        x: cx - size / 2, y: cy - size / 2, w: size, h: size,
        vx: fv.x * def.speed, vy: fv.y * def.speed, color: def.color, dmg: def.damage,
      })
    } else if (def.kind === 'bomb') {
      p.cooldowns[slot] = def.cooldown
      state.bombs.push({
        x: cx - 8, y: cy - 8, w: 16, h: 16, fuse: def.fuse,
        radius: def.radius, damage: def.damage, color: def.color,
      })
    } else if (def.kind === 'burst') {
      p.cooldowns[slot] = def.cooldown
      state.orbs.push({
        x: cx, y: cy, vx: fv.x * def.speed, vy: fv.y * def.speed,
        traveled: 0, range: def.range, radius: def.radius, damage: def.damage, color: def.color,
      })
    }
  }
}

function stepReturning(state) {
  const b = state.returning
  if (!b) return
  const p = state.player
  if (!b.returning) {
    b.x += b.vx; b.y += b.vy
    b.traveled += Math.hypot(b.vx, b.vy)
    if (b.traveled >= b.range) b.returning = true
  } else {
    const dx = (p.x + p.w / 2) - b.x, dy = (p.y + p.h / 2) - b.y
    const dist = Math.hypot(dx, dy) || 1
    b.vx = (dx / dist) * b.speed
    b.vy = (dy / dist) * b.speed
    b.x += b.vx; b.y += b.vy
    if (dist < 16) { state.returning = null; return }
  }
  const rect = { x: b.x - 6, y: b.y - 6, w: 12, h: 12 }
  for (const e of state.enemies) {
    if (e.alive && !b.hit.has(e) && aabb(rect, e)) { hurtEnemy(state, e, b.damage, b.color); b.hit.add(e) }
  }
  if (state.boss && state.boss.alive && !b.hit.has(state.boss) && aabb(rect, state.boss)) {
    hurtBoss(state, b.damage); b.hit.add(state.boss)
  }
}

function stepBolts(state) {
  state.bolts.forEach(a => {
    a.x += a.vx; a.y += a.vy
    if (a.x < PLAY_X0 || a.x > PLAY_X0 + PLAY_W || a.y < PLAY_Y0 || a.y > PLAY_Y0 + PLAY_H) { a.dead = true; return }
    if (isSolidTile(state.tiles, tileRow(a.y), tileCol(a.x))) { a.dead = true; return }
    for (const e of state.enemies) {
      if (e.alive && aabb(a, e)) { hurtEnemy(state, e, a.dmg, a.color); a.dead = true; break }
    }
    if (!a.dead && state.boss && state.boss.alive && aabb(a, state.boss)) { hurtBoss(state, a.dmg); a.dead = true }
  })
  state.bolts = state.bolts.filter(a => !a.dead)
}

// Detonates a burst-kind orb in place: area damage to everything within
// `radius`, same shape as a bomb's blast but triggered by impact/range
// instead of a fuse timer.
function detonateOrb(state, o) {
  spawnParticles(state, o.x, o.y, o.color, 16)
  for (const e of state.enemies) {
    if (!e.alive) continue
    const dx = (e.x + e.w / 2) - o.x, dy = (e.y + e.h / 2) - o.y
    if (dx * dx + dy * dy <= o.radius * o.radius) hurtEnemy(state, e, o.damage, o.color)
  }
  if (state.boss && state.boss.alive) {
    const b = state.boss
    const dx = (b.x + b.w / 2) - o.x, dy = (b.y + b.h / 2) - o.y
    if (dx * dx + dy * dy <= o.radius * o.radius * 1.2) hurtBoss(state, o.damage)
  }
}

// A burst-kind weapon is a lobbed orb, not an out-and-back throw — it
// flies until it touches a target, a wall, or runs out of range, then
// detonates into one area-of-effect blast. No return trip, and unlike a
// bolt it can catch a whole cluster of enemies at once.
function stepOrbs(state) {
  state.orbs.forEach(o => {
    o.x += o.vx; o.y += o.vy
    o.traveled += Math.hypot(o.vx, o.vy)
    const hitbox = { x: o.x - 6, y: o.y - 6, w: 12, h: 12 }
    let detonate = o.traveled >= o.range
      || o.x < PLAY_X0 || o.x > PLAY_X0 + PLAY_W || o.y < PLAY_Y0 || o.y > PLAY_Y0 + PLAY_H
      || isSolidTile(state.tiles, tileRow(o.y), tileCol(o.x))
    if (!detonate) {
      for (const e of state.enemies) if (e.alive && aabb(hitbox, e)) { detonate = true; break }
      if (!detonate && state.boss && state.boss.alive && aabb(hitbox, state.boss)) detonate = true
    }
    if (detonate) { detonateOrb(state, o); o.dead = true }
  })
  state.orbs = state.orbs.filter(o => !o.dead)
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
    if (aabb(es, p)) { es.dead = true; hurtPlayer(state, es.dmg || CONTACT_DAMAGE) }
  })
  state.enemyShots = state.enemyShots.filter(es => !es.dead)
}

function steerWithinBounds(e) {
  if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx) }
  if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx) }
  if (e.y < e.minY) { e.y = e.minY; e.vy = Math.abs(e.vy) }
  if (e.y + e.h > e.maxY) { e.y = e.maxY - e.h; e.vy = -Math.abs(e.vy) }
}

function stepEnemies(state) {
  const p = state.player
  for (const e of state.enemies) {
    if (!e.alive) continue
    if (e.hitFlash > 0) e.hitFlash--

    if (e.type === 'blob' || e.type === 'bat' || e.type === 'skeleton') {
      e.changeDirTimer--
      if (e.changeDirTimer <= 0) {
        e.changeDirTimer = e.type === 'bat' ? (30 + Math.random() * 30) : (70 + Math.random() * 70)
        const speed = ENEMY_SPEED[e.type]
        const ang = Math.random() * Math.PI * 2
        e.vx = Math.cos(ang) * speed
        e.vy = Math.sin(ang) * speed
      }
      e.x += e.vx; e.y += e.vy
      steerWithinBounds(e)
    } else if (e.type === 'pebblefoot') {
      e.attackCooldown--
      if (e.attackCooldown <= 0) {
        e.attackCooldown = 130
        const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[e.facing] || [-1, 0]
        state.enemyShots.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, w: 10, h: 10, vx: dir[0] * 3, vy: dir[1] * 3, dmg: CONTACT_DAMAGE })
      }
    }

    if (p.invincible <= 0 && aabb(p, e)) hurtPlayer(state, CONTACT_DAMAGE)
  }
  state.enemies = state.enemies.filter(e => e.alive)
}

function stepBoss(state) {
  const b = state.boss
  if (!b || !b.alive) return
  const p = state.player
  if (b.flash > 0) b.flash--
  b.x += b.vx
  if (b.x < PLAY_X0 + TILE * 4 || b.x + b.w > PLAY_X0 + PLAY_W - TILE * 4) b.vx *= -1
  b.attackCooldown--
  if (b.attackCooldown <= 0) {
    b.attackCooldown = 105
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    const baseAngle = Math.atan2((p.y + p.h / 2) - cy, (p.x + p.w / 2) - cx)
    for (const off of [-0.3, 0, 0.3]) {
      const ang = baseAngle + off
      state.enemyShots.push({ x: cx, y: cy, w: 12, h: 12, vx: Math.cos(ang) * 3.2, vy: Math.sin(ang) * 3.2, dmg: STRONG_CONTACT_DAMAGE })
    }
  }
  if (p.invincible <= 0 && aabb(p, b)) hurtPlayer(state, STRONG_CONTACT_DAMAGE)
}

function checkPortals(state) {
  const p = state.player
  for (const portal of PORTALS) {
    if (portal.fromWorld !== state.world || portal.fromKey !== state.roomKey) continue
    const trigger = { x: colToX(portal.col), y: rowToY(portal.row), w: TILE * 2, h: TILE }
    if (aabb(p, trigger)) {
      loadRoom(state, portal.toWorld, portal.toKey, null, { col: portal.entryCol, row: portal.entryRow })
      return true
    }
  }
  return false
}

function checkRoomTransition(state) {
  const p = state.player
  const n = state.neighbors
  if (p.x + p.w < PLAY_X0 && n.left) { loadRoom(state, state.world, n.left, 'right'); return true }
  if (p.x > PLAY_X0 + PLAY_W && n.right) { loadRoom(state, state.world, n.right, 'left'); return true }
  if (p.y < PLAY_Y0 && n.up) { loadRoom(state, state.world, n.up, 'bottom'); return true }
  if (p.y > PLAY_Y0 + PLAY_H && n.down) { loadRoom(state, state.world, n.down, 'top'); return true }
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

  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071 }
  p.vx = vx * MOVE_SPEED
  p.vy = vy * MOVE_SPEED
  if (input.down) p.facing = 'down'
  else if (input.up) p.facing = 'up'
  else if (input.left) p.facing = 'left'
  else if (input.right) p.facing = 'right'

  checkLockedDoor(state)
  moveWithTiles(p, state.tiles)

  stepWeapons(state, input)
  stepReturning(state)
  stepBolts(state)
  stepOrbs(state)
  stepBombs(state)
  stepEnemyShots(state)
  stepEnemies(state)
  stepBoss(state)

  for (const item of state.items) {
    if (aabb(p, item)) { collectItem(state, item); break }
  }
  state.items = state.items.filter(it => !state.collectedItems.has(it.id))

  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)

  if (p.invincible > 0) p.invincible--

  if (state.status !== 'playing') return

  if (checkPortals(state)) return
  checkRoomTransition(state)
}

export function itemsCollectedCount(state) { return state.collectedItems.size }
export function totalItemsCount() { return TOTAL_ITEMS }
