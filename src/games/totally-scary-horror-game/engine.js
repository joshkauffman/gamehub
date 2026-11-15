// ── The Totally Scary Horror Game — pure gameplay state/logic ──────────
// Framework-agnostic: plain pixel coordinates, no canvas, no DOM.
// stepGame() moves the player and every monster, resolves wall
// collision, and checks for a "catch" (a monster reaching the player),
// which opens a dialogue and freezes the player until it's dismissed.
// Reaching an exit tile wins.
import {
  TILE, SOLID_TILES, HOTEL_MAP, PLAYER_SPAWN, PLAYER_HALF, PLAYER_SPEED,
  MONSTER_HALF, NOTICE_RADIUS, LOSE_RADIUS, CATCH_RADIUS, REST_COOLDOWN,
  MONSTER_DEFS,
} from './constants.js'

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) }

function tileAt(px, py) {
  const col = Math.floor(px / TILE)
  const row = Math.floor(py / TILE)
  const r = HOTEL_MAP[row]
  if (!r) return '#'
  return r[col] ?? '#'
}

function collidesWall(x, y, half) {
  const corners = [
    [x - half, y - half], [x + half, y - half],
    [x - half, y + half], [x + half, y + half],
  ]
  return corners.some(([cx, cy]) => SOLID_TILES.has(tileAt(cx, cy)))
}

export function createGame() {
  return {
    player: { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, facing: 'down' },
    monsters: MONSTER_DEFS.map(def => ({
      ...def,
      x: def.patrolA.x, y: def.patrolA.y,
      mode: 'patrol', patrolTarget: 'B', restCooldown: 0,
    })),
    dialogue: null,
    metIds: new Set(),
    metCount: 0,
    catchCount: 0,
    won: false,
    elapsed: 0,
  }
}

function movePlayer(state, input, dt) {
  const p = state.player
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (dx === 0 && dy === 0) return
  const len = Math.hypot(dx, dy) || 1
  dx /= len; dy /= len
  if (Math.abs(dx) > Math.abs(dy)) p.facing = dx > 0 ? 'right' : 'left'
  else p.facing = dy > 0 ? 'down' : 'up'

  const nx = p.x + dx * PLAYER_SPEED * dt
  const ny = p.y + dy * PLAYER_SPEED * dt
  if (!collidesWall(nx, p.y, PLAYER_HALF)) p.x = nx
  if (!collidesWall(p.x, ny, PLAYER_HALF)) p.y = ny
}

function triggerCatch(state, m) {
  m.mode = 'sitting'
  const firstTime = !state.metIds.has(m.id)
  if (firstTime) { state.metIds.add(m.id); state.metCount += 1 }
  state.catchCount += 1
  state.dialogue = {
    monsterId: m.id,
    lines: firstTime ? m.lines : [m.repeatLine],
    lineIndex: 0,
  }
}

function stepMonster(state, m, dt) {
  if (m.mode === 'sitting') return

  if (m.restCooldown > 0) {
    m.restCooldown -= dt
  } else {
    const d = dist(m.x, m.y, state.player.x, state.player.y)
    if (m.mode === 'patrol' && d < NOTICE_RADIUS) m.mode = 'chase'
    else if (m.mode === 'chase' && d > LOSE_RADIUS) m.mode = 'patrol'
  }

  let tx, ty
  if (m.mode === 'chase') {
    tx = state.player.x; ty = state.player.y
  } else {
    const target = m.patrolTarget === 'A' ? m.patrolA : m.patrolB
    tx = target.x; ty = target.y
    if (dist(m.x, m.y, tx, ty) < 6) m.patrolTarget = m.patrolTarget === 'A' ? 'B' : 'A'
  }

  const dx = tx - m.x, dy = ty - m.y, len = Math.hypot(dx, dy) || 1
  const speed = m.mode === 'chase' ? m.chaseSpeed : m.speed
  m.x += (dx / len) * speed * dt
  m.y += (dy / len) * speed * dt

  if (m.restCooldown <= 0 && !state.dialogue && dist(m.x, m.y, state.player.x, state.player.y) < CATCH_RADIUS) {
    triggerCatch(state, m)
  }
}

export function advanceDialogue(state) {
  if (!state.dialogue) return
  state.dialogue.lineIndex += 1
  if (state.dialogue.lineIndex >= state.dialogue.lines.length) {
    const m = state.monsters.find(x => x.id === state.dialogue.monsterId)
    if (m) { m.mode = 'patrol'; m.restCooldown = REST_COOLDOWN }
    state.dialogue = null
  }
}

export function stepGame(state, input, dt) {
  if (state.won) return
  state.elapsed += dt

  if (!state.dialogue) movePlayer(state, input, dt)
  state.monsters.forEach(m => stepMonster(state, m, dt))

  if (!state.dialogue && tileAt(state.player.x, state.player.y) === 'E') {
    state.won = true
  }
}
