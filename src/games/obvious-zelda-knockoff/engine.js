// ── The Obvious Zelda Knockoff — game engine ──────────────────────────
// Pure state/physics, no rendering. One frame of simulation per stepGame
// call; render.js reads the resulting state to draw it. Top-down, no
// gravity — each room is a single static screen, same one-screen-at-a-
// time idea as The Obvious Metroid Knockoff, just without the jumping.

import {
  PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, PLAY_W, PLAY_H,
  PLAYER_SIZE, MOVE_SPEED, HEARTS_START, HEART_CONTAINER_BONUS,
  CONTACT_DAMAGE, STRONG_CONTACT_DAMAGE, INVINCIBLE_FRAMES,
  SWORD_COOLDOWN, SWORD_ACTIVE_FRAMES, SWORD_REACH, SWORD_DAMAGE,
  BOOMERANG_COOLDOWN, BOOMERANG_SPEED, BOOMERANG_RANGE, BOOMERANG_DAMAGE,
  ARROW_COOLDOWN, ARROW_SPEED, ARROW_DAMAGE,
  BOMB_COOLDOWN, BOMB_FUSE, BOMB_RADIUS, BOMB_DAMAGE, BOSS_HP,
  SOLID_TILES, ITEM_DEFS,
} from './constants.js'
import { WORLDS, PORTALS, START_WORLD, START_ROOM_KEY, TOTAL_ITEMS } from './levels.js'

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

function freshAbilities() { return { sword: false, boomerang: false, bow: false, bombs: false } }

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
  state.boomerang = null
  state.arrows = []
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
      x: 0, y: 0, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0, facing: 'down',
      hearts: HEARTS_START, maxHearts: HEARTS_START, smallKeys: 0,
      abilities: freshAbilities(), invincible: 90,
      swordCooldown: 0, swordSwing: 0, boomerangCooldown: 0, arrowCooldown: 0, bombCooldown: 0,
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

function collectItem(state, item) {
  state.collectedItems.add(item.id)
  const def = ITEM_DEFS[item.type]
  const p = state.player
  if (item.type === 'sword') p.abilities.sword = true
  else if (item.type === 'boomerang') p.abilities.boomerang = true
  else if (item.type === 'bow') p.abilities.bow = true
  else if (item.type === 'bombs') p.abilities.bombs = true
  else if (item.type === 'heart_container') { p.maxHearts += HEART_CONTAINER_BONUS; p.hearts = p.maxHearts }
  else if (item.type === 'small_key') p.smallKeys += 1
  state.score += 100
  showMessage(state, `${def.label} acquired! ${def.desc}`)
  spawnParticles(state, item.x + item.w / 2, item.y + item.h / 2, def.color, 14)
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

function destroyBombWalls(state, cx, cy) {
  const c0 = tileCol(cx - BOMB_RADIUS), c1 = tileCol(cx + BOMB_RADIUS)
  const r0 = tileRow(cy - BOMB_RADIUS), r1 = tileRow(cy + BOMB_RADIUS)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue
      if (state.tiles[r][c] !== 'B') continue
      const dx = (colToX(c) + TILE / 2) - cx, dy = (rowToY(r) + TILE / 2) - cy
      if (dx * dx + dy * dy <= BOMB_RADIUS * BOMB_RADIUS) {
        state.tiles[r][c] = '.'
        state.destroyedTiles.add(`${state.roomFullKey}|${r}|${c}`)
        spawnParticles(state, colToX(c) + TILE / 2, rowToY(r) + TILE / 2, '#c9a46a', 8)
      }
    }
  }
}

function explodeBomb(state, bomb) {
  const cx = bomb.x + bomb.w / 2, cy = bomb.y + bomb.h / 2
  spawnParticles(state, cx, cy, '#ffe35c', 18)
  destroyBombWalls(state, cx, cy)
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
}

function stepWeapons(state, input) {
  const p = state.player
  if (p.swordCooldown > 0) p.swordCooldown--
  if (p.boomerangCooldown > 0) p.boomerangCooldown--
  if (p.arrowCooldown > 0) p.arrowCooldown--
  if (p.bombCooldown > 0) p.bombCooldown--
  if (p.swordSwing > 0) p.swordSwing--

  const fv = facingVector(p.facing)
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2

  if (input.sword && p.abilities.sword && p.swordCooldown <= 0) {
    p.swordCooldown = SWORD_COOLDOWN
    p.swordSwing = SWORD_ACTIVE_FRAMES
    const reach = {
      x: cx + fv.x * (p.w / 2) - (fv.x === 0 ? p.w * 0.4 : 2),
      y: cy + fv.y * (p.h / 2) - (fv.y === 0 ? p.h * 0.4 : 2),
      w: fv.x !== 0 ? SWORD_REACH : p.w * 0.8,
      h: fv.y !== 0 ? SWORD_REACH : p.h * 0.8,
    }
    for (const e of state.enemies) if (e.alive && aabb(reach, e)) hurtEnemy(state, e, SWORD_DAMAGE, '#d8d8e4')
    if (state.boss && state.boss.alive && aabb(reach, state.boss)) hurtBoss(state, SWORD_DAMAGE)
  }

  if (input.item1 && p.abilities.boomerang && p.boomerangCooldown <= 0 && !state.boomerang) {
    p.boomerangCooldown = BOOMERANG_COOLDOWN
    state.boomerang = {
      x: cx, y: cy, vx: fv.x * BOOMERANG_SPEED, vy: fv.y * BOOMERANG_SPEED,
      traveled: 0, returning: false, hit: new Set(),
    }
  }

  if (input.item2 && p.abilities.bow && p.arrowCooldown <= 0) {
    p.arrowCooldown = ARROW_COOLDOWN
    state.arrows.push({ x: cx - 5, y: cy - 5, w: 10, h: 10, vx: fv.x * ARROW_SPEED, vy: fv.y * ARROW_SPEED })
  }

  if (input.item3 && p.abilities.bombs && p.bombCooldown <= 0) {
    p.bombCooldown = BOMB_COOLDOWN
    state.bombs.push({ x: cx - 8, y: cy - 8, w: 16, h: 16, fuse: BOMB_FUSE })
  }
}

function stepBoomerang(state) {
  const b = state.boomerang
  if (!b) return
  const p = state.player
  if (!b.returning) {
    b.x += b.vx; b.y += b.vy
    b.traveled += Math.hypot(b.vx, b.vy)
    if (b.traveled >= BOOMERANG_RANGE) b.returning = true
  } else {
    const dx = (p.x + p.w / 2) - b.x, dy = (p.y + p.h / 2) - b.y
    const dist = Math.hypot(dx, dy) || 1
    b.vx = (dx / dist) * BOOMERANG_SPEED
    b.vy = (dy / dist) * BOOMERANG_SPEED
    b.x += b.vx; b.y += b.vy
    if (dist < 16) { state.boomerang = null; return }
  }
  const rect = { x: b.x - 6, y: b.y - 6, w: 12, h: 12 }
  for (const e of state.enemies) {
    if (e.alive && !b.hit.has(e) && aabb(rect, e)) { hurtEnemy(state, e, BOOMERANG_DAMAGE, '#5bc8ff'); b.hit.add(e) }
  }
  if (state.boss && state.boss.alive && !b.hit.has(state.boss) && aabb(rect, state.boss)) {
    hurtBoss(state, BOOMERANG_DAMAGE); b.hit.add(state.boss)
  }
}

function stepArrows(state) {
  state.arrows.forEach(a => {
    a.x += a.vx; a.y += a.vy
    if (a.x < PLAY_X0 || a.x > PLAY_X0 + PLAY_W || a.y < PLAY_Y0 || a.y > PLAY_Y0 + PLAY_H) { a.dead = true; return }
    if (isSolidTile(state.tiles, tileRow(a.y), tileCol(a.x))) { a.dead = true; return }
    for (const e of state.enemies) {
      if (e.alive && aabb(a, e)) { hurtEnemy(state, e, ARROW_DAMAGE, '#ffb85c'); a.dead = true; break }
    }
    if (!a.dead && state.boss && state.boss.alive && aabb(a, state.boss)) { hurtBoss(state, ARROW_DAMAGE); a.dead = true }
  })
  state.arrows = state.arrows.filter(a => !a.dead)
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
  stepBoomerang(state)
  stepArrows(state)
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
