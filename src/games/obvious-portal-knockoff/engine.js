// ── The Obvious Portal Knockoff — game engine ─────────────────────────
// Pure state/physics, no rendering. A portal is never a tile mutation —
// it's an overlay record (col, row, normal) that collision and
// teleport checks cross-reference against the static tile grid. That
// keeps "which tile is solid right now" and "which tile has an active
// portal" cleanly separable.

import {
  PLAY_Y0, TILE, COLS, ROWS, GRAVITY, JUMP_V, MOVE_ACCEL, MAX_SPEED, FRICTION,
  PLAYER_SIZE, CUBE_SIZE, TELEPORT_MIN_SPEED, TELEPORT_COOLDOWN,
  SOLID_CHARS, PORTALABLE_CHARS, H,
} from './constants.js'
import { chamberById } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function colToX(col) { return col * TILE }
function rowToY(row) { return PLAY_Y0 + row * TILE }
function tileOf(x, y) { return { col: Math.floor(x / TILE), row: Math.floor((y - PLAY_Y0) / TILE) } }

function doorIdAt(state, row, col) {
  const key = `${row},${col}`
  return state.doorCellToId[key] || null
}

function isSolidAt(state, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true
  const ch = state.tiles[row][col]
  if (!SOLID_CHARS.has(ch)) return false
  if (ch === 'D') {
    const id = doorIdAt(state, row, col)
    if (id && state.openDoors.has(id)) return false
    return true
  }
  const b = state.portals.blue, o = state.portals.orange
  if (b && b.row === row && b.col === col) return false
  if (o && o.row === row && o.col === col) return false
  return true
}

// Shifts a cube horizontally by dx, stopping early if it runs into a
// solid tile. Returns the actual delta applied (may be less than dx,
// or 0, if blocked) — used to make pushing rigid rather than a
// separate "nudge speed" the player can simply outrun.
function shiftCubeX(state, cube, dx) {
  if (dx === 0) return 0
  const startX = cube.x
  cube.x += dx
  const r0 = Math.floor((cube.y - PLAY_Y0) / TILE), r1 = Math.floor((cube.y + cube.h - 1 - PLAY_Y0) / TILE)
  if (dx > 0) {
    const c1 = Math.floor((cube.x + cube.w - 1) / TILE)
    for (let r = r0; r <= r1; r++) if (isSolidAt(state, r, c1)) { cube.x = c1 * TILE - cube.w; break }
  } else {
    const c0 = Math.floor(cube.x / TILE)
    for (let r = r0; r <= r1; r++) if (isSolidAt(state, r, c0)) { cube.x = (c0 + 1) * TILE; break }
  }
  return cube.x - startX
}

function moveWithTiles(state, e) {
  e.x += e.vx
  const r0 = Math.floor((e.y - PLAY_Y0) / TILE), r1 = Math.floor((e.y + e.h - 1 - PLAY_Y0) / TILE)
  if (e.vx > 0) {
    const c1 = Math.floor((e.x + e.w - 1) / TILE)
    for (let r = r0; r <= r1; r++) if (isSolidAt(state, r, c1)) { e.x = c1 * TILE - e.w; e.vx = 0; break }
  } else if (e.vx < 0) {
    const c0 = Math.floor(e.x / TILE)
    for (let r = r0; r <= r1; r++) if (isSolidAt(state, r, c0)) { e.x = (c0 + 1) * TILE; e.vx = 0; break }
  }
  e.y += e.vy
  e.onGround = false
  const c0b = Math.floor(e.x / TILE), c1b = Math.floor((e.x + e.w - 1) / TILE)
  if (e.vy > 0) {
    const r1b = Math.floor((e.y + e.h - 1 - PLAY_Y0) / TILE)
    for (let c = c0b; c <= c1b; c++) if (isSolidAt(state, r1b, c)) { e.y = rowToY(r1b) - e.h; e.vy = 0; e.onGround = true; break }
  } else if (e.vy < 0) {
    const r0b = Math.floor((e.y - PLAY_Y0) / TILE)
    for (let c = c0b; c <= c1b; c++) if (isSolidAt(state, r0b, c)) { e.y = rowToY(r0b + 1); e.vy = 0; break }
  }
}

// Steps a ray in small increments from (x0,y0) toward (x1,y1) to find
// the first solid cell, then re-derives the exact entry point and face
// analytically (the standard slab ray/AABB test against that cell's
// bounds) rather than trusting the discrete sample — sampling error
// can misjudge shallow-angle rays that enter right at a corner.
//
// A shallow shot that grazes a platform's leading corner is, strictly,
// a side hit — but it's a terrible, trap-prone outcome for what the
// player experiences as "aiming at the floor," so a near-flush corner
// (within FACE_FORGIVENESS of the top/bottom edge) is rounded to the
// horizontal face instead. Horizontal portals have no such forgiveness
// the other way, since clipping a wall from slightly above/below it is
// much less consequential than falling into an unexpectedly-opened pit.
const FACE_FORGIVENESS = 6
export function raycast(state, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return null
  const ux = dx / dist, uy = dy / dist
  const step = 3
  const steps = Math.ceil(dist / step)
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ux * step * i, y = y0 + uy * step * i
    const cur = tileOf(x, y)
    if (cur.row < 0 || cur.row >= ROWS || cur.col < 0 || cur.col >= COLS) return null
    if (isSolidAt(state, cur.row, cur.col)) {
      const cellX0 = cur.col * TILE, cellX1 = cellX0 + TILE
      const cellY0 = PLAY_Y0 + cur.row * TILE, cellY1 = cellY0 + TILE
      // t-value at which the ray enters the cell's x-slab (resp. y-slab);
      // the later of the two is the true entry time, and whichever axis
      // produced it is the face the ray actually crossed last.
      const txmin = dx === 0 ? -Infinity : Math.min((cellX0 - x0) / dx, (cellX1 - x0) / dx)
      const tymin = dy === 0 ? -Infinity : Math.min((cellY0 - y0) / dy, (cellY1 - y0) / dy)
      let normal
      if (txmin > tymin) {
        const entryY = y0 + txmin * dy
        const localY = entryY - cellY0
        normal = (localY < FACE_FORGIVENESS || localY > TILE - FACE_FORGIVENESS)
          ? { x: 0, y: dy > 0 ? -1 : 1 }
          : { x: dx > 0 ? -1 : 1, y: 0 }
      } else {
        normal = { x: 0, y: dy > 0 ? -1 : 1 }
      }
      return { row: cur.row, col: cur.col, ch: state.tiles[cur.row][cur.col], normal }
    }
  }
  return null
}

export function shootPortal(state, color, fromX, fromY, toX, toY) {
  const hit = raycast(state, fromX, fromY, toX, toY)
  if (!hit || !PORTALABLE_CHARS.has(hit.ch)) { state.lastShotFizzled = true; state.fizzleTimer = 14; return false }
  // If the other color is already on this exact cell, bump it off.
  const other = color === 'blue' ? 'orange' : 'blue'
  if (state.portals[other] && state.portals[other].row === hit.row && state.portals[other].col === hit.col) {
    state.portals[other] = null
  }
  state.portals[color] = { row: hit.row, col: hit.col, normal: hit.normal }
  return true
}

function portalExitPlacement(portal, w, h) {
  const cx = colToX(portal.col) + TILE / 2, cy = rowToY(portal.row) + TILE / 2
  const reach = TILE / 2 + Math.max(w, h) / 2 + 3
  const ex = cx + portal.normal.x * reach, ey = cy + portal.normal.y * reach
  return { x: ex - w / 2, y: ey - h / 2 }
}

function tryTeleport(state, entity) {
  if (entity.teleportCooldown > 0) { entity.teleportCooldown--; return }
  const b = state.portals.blue, o = state.portals.orange
  if (!b || !o) return
  for (const portal of [b, o]) {
    const rect = { x: colToX(portal.col), y: rowToY(portal.row), w: TILE, h: TILE }
    if (aabb(entity, rect)) {
      const target = portal === b ? o : b
      const speed = Math.max(TELEPORT_MIN_SPEED, Math.hypot(entity.vx, entity.vy))
      entity.vx = target.normal.x * speed
      entity.vy = target.normal.y * speed
      const pos = portalExitPlacement(target, entity.w, entity.h)
      entity.x = pos.x; entity.y = pos.y
      entity.teleportCooldown = TELEPORT_COOLDOWN
      return
    }
  }
}

export function freshState(chamberId) {
  const chamber = chamberById(chamberId)
  const doorCellToId = {}
  for (const door of chamber.doors) for (const [r, c] of door.cells) doorCellToId[`${r},${c}`] = door.id

  return {
    chamberId,
    status: 'playing',
    message: '', messageTimer: 0,
    tiles: chamber.rows,
    doorCellToId,
    openDoors: new Set(),
    portals: { blue: null, orange: null },
    lastShotFizzled: false, fizzleTimer: 0,
    player: {
      x: colToX(chamber.playerStart.col), y: rowToY(chamber.playerStart.row) - PLAYER_SIZE.h,
      w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0, onGround: false, facing: 1, teleportCooldown: 0,
    },
    cubes: chamber.cubes.map((c, i) => ({
      id: i, x: colToX(c.col) + (TILE - CUBE_SIZE.w) / 2, y: rowToY(c.row) - CUBE_SIZE.h,
      w: CUBE_SIZE.w, h: CUBE_SIZE.h, vx: 0, vy: 0, onGround: false, teleportCooldown: 0,
    })),
    goal: chamber.goal,
  }
}

function showMessage(state, text, frames = 90) { state.message = text; state.messageTimer = frames }

export function stepGame(state, input) {
  if (state.status !== 'playing') return
  if (state.messageTimer > 0) state.messageTimer--
  if (state.fizzleTimer > 0) state.fizzleTimer--

  const p = state.player
  if (input.left) { p.facing = -1; p.vx -= MOVE_ACCEL }
  else if (input.right) { p.facing = 1; p.vx += MOVE_ACCEL }
  else p.vx *= FRICTION
  p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx))
  if (input.jump && p.onGround) p.vy = JUMP_V
  p.vy += GRAVITY
  if (p.vy > 18) p.vy = 18

  moveWithTiles(state, p)
  p.x = Math.max(0, Math.min(COLS * TILE - p.w, p.x))

  // Push any cube the player walks into — rigidly: the cube absorbs
  // the player's ENTIRE overlap each frame (re-gluing to the player's
  // leading edge), and the player is held back only by whatever the
  // cube couldn't give up (a wall on its far side). A capped "push
  // speed" here would just let the player outrun/clip through the
  // cube, since the player's own top speed exceeds any sane cap.
  for (const cube of state.cubes) {
    if (!aabb(p, cube)) continue
    if (p.x + p.w / 2 < cube.x + cube.w / 2) {
      const overlap = (p.x + p.w) - cube.x
      if (overlap > 0) { const moved = shiftCubeX(state, cube, overlap); p.x -= (overlap - moved) }
    } else {
      const overlap = (cube.x + cube.w) - p.x
      if (overlap > 0) { const moved = shiftCubeX(state, cube, -overlap); p.x += (overlap - Math.abs(moved)) }
    }
  }

  for (const cube of state.cubes) {
    cube.vy += GRAVITY
    if (cube.vy > 18) cube.vy = 18
    moveWithTiles(state, cube)
    cube.vx *= 0.9
    tryTeleport(state, cube)
  }
  tryTeleport(state, p)

  if (p.y > H + 200) {
    // Fell into the void — a gentle, low-stakes reset, not a real fail state.
    const chamber = chamberById(state.chamberId)
    p.x = colToX(chamber.playerStart.col); p.y = rowToY(chamber.playerStart.row) - p.h
    p.vx = 0; p.vy = 0
    showMessage(state, 'Reset.', 60)
  }
  for (const cube of state.cubes) {
    if (cube.y > H + 200) {
      const chamber = chamberById(state.chamberId)
      const def = chamber.cubes[cube.id]
      cube.x = colToX(def.col) + (TILE - cube.w) / 2; cube.y = rowToY(def.row) - cube.h
      cube.vx = 0; cube.vy = 0
    }
  }

  // Buttons only count while something is actually on them — classic
  // weighted-plate behaviour, which is also what makes the cube
  // puzzles meaningful (you have to leave it there).
  const chamber = chamberById(state.chamberId)
  const nextOpen = new Set()
  for (const btn of chamber.buttons) {
    const rect = { x: colToX(btn.col), y: rowToY(btn.row) - 6, w: TILE, h: 10 }
    const pressed = aabb(p, rect) || state.cubes.some(c => aabb(c, rect))
    if (pressed) nextOpen.add(btn.doorId)
  }
  state.openDoors = nextOpen

  // goal.row follows the same "open-air cell above the standing
  // surface" convention as playerStart/cubes, not the floor-row
  // convention buttons use — so this spans rowToY(row) to +TILE,
  // matching where the player's feet actually land, not one tile above it.
  const goalRect = { x: colToX(state.goal.col), y: rowToY(state.goal.row), w: TILE, h: TILE }
  if (aabb(p, goalRect)) {
    state.status = 'cleared'
    showMessage(state, 'Chamber complete.', 999)
  }
}

export function resetChamber(state) {
  return freshState(state.chamberId)
}
