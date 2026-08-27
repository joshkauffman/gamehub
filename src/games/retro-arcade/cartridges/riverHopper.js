// ── River Hopper — a lane-crossing cartridge in the spirit of the classic
// road-and-river hopper. Original code, canvas-drawn shapes only: traffic
// to dodge, logs to ride (fall in the water without one and you're done),
// and five homes to fill before the clock runs out.

const TILE = 44
const COLS = 12
const ROWS = 13
const HUD_H = 40
const MAZE_W = COLS * TILE
const MAZE_H = ROWS * TILE

const HOME_ROW = 0
const RIVER_ROWS = [1, 2, 3, 4, 5]
const MEDIAN_ROW = 6
const ROAD_ROWS = [7, 8, 9, 10, 11]
const START_ROW = 12

const LIVES_START = 3
const TIME_LIMIT = 26 * 60
const HOP_FRAMES = 7
const HOME_COUNT = 5
const HOME_TOLERANCE = TILE * 0.55

function rand(a, b) { return a + Math.random() * (b - a) }

function buildLane(row, dir, speed, widthRange, count) {
  const entities = []
  let x = rand(0, MAZE_W)
  for (let i = 0; i < count; i++) {
    const width = rand(widthRange[0], widthRange[1])
    entities.push({ x, width, dir, speed })
    x += width + rand(70, 160)
  }
  return entities
}

function buildLevel(wave) {
  const lanes = {}
  RIVER_ROWS.forEach((row, i) => {
    const dir = i % 2 === 0 ? 1 : -1
    lanes[row] = buildLane(row, dir, 0.9 + wave * 0.12 + i * 0.08, [70, 150], 4)
  })
  ROAD_ROWS.forEach((row, i) => {
    const dir = i % 2 === 0 ? -1 : 1
    lanes[row] = buildLane(row, dir, 1.5 + wave * 0.18 + i * 0.1, [36, 64], 4)
  })
  const homeXs = Array.from({ length: HOME_COUNT }, (_, i) => (MAZE_W / (HOME_COUNT + 1)) * (i + 1))
  return { lanes, homes: homeXs.map(x => ({ x, filled: false })) }
}

function startPos() { return { col: Math.floor(COLS / 2), row: START_ROW } }

export const riverHopper = {
  id: 'river-hopper',
  title: 'River Hopper',
  emoji: '🐸',
  tagline: 'Dodge traffic, hitch a ride on a log, and fill all five homes before time runs out.',
  controls: 'Arrow keys / WASD to hop',
  width: MAZE_W,
  height: MAZE_H + HUD_H,

  readInput(keys) {
    return {
      up: keys.has('ArrowUp') || keys.has('KeyW'),
      down: keys.has('ArrowDown') || keys.has('KeyS'),
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
    }
  },

  createState() {
    const level = buildLevel(1)
    const start = startPos()
    return {
      status: 'playing', score: 0, lives: LIVES_START, wave: 1,
      ...level,
      player: { ...start, x: start.col * TILE + TILE / 2, y: start.row * TILE + TILE / 2, hopFrom: null, hopT: 0 },
      maxRowReached: START_ROW,
      timeLeft: TIME_LIMIT,
      prevInput: {},
      frame: 0,
      deathTimer: 0,
    }
  },

  step(state, input) { stepRiverHopper(state, input) },
  render(ctx, state) { renderRiverHopper(ctx, state) },
}

function cellCenter(col, row) { return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 } }

function stepRiverHopper(state, input) {
  if (state.status !== 'playing') return
  state.frame++

  Object.values(state.lanes).flat().forEach(e => {
    e.x += e.dir * e.speed
    if (e.dir > 0 && e.x > MAZE_W + 60) e.x = -e.width - 60
    if (e.dir < 0 && e.x < -e.width - 60) e.x = MAZE_W + 60
  })

  if (state.deathTimer > 0) {
    state.deathTimer--
    if (state.deathTimer === 0) {
      if (state.lives <= 0) { state.status = 'gameover'; return }
      resetFrog(state)
    }
    return
  }

  const p = state.player
  if (p.hopFrom) {
    p.hopT++
    const t = Math.min(1, p.hopT / HOP_FRAMES)
    const to = cellCenter(p.col, p.row)
    p.x = p.hopFrom.x + (to.x - p.hopFrom.x) * t
    p.y = p.hopFrom.y + (to.y - p.hopFrom.y) * t
    if (t >= 1) { p.hopFrom = null; onLanded(state) }
  } else {
    const pressed = (dir) => input[dir] && !state.prevInput[dir]
    let dc = 0, dr = 0
    if (pressed('up')) dr = -1
    else if (pressed('down')) dr = 1
    else if (pressed('left')) dc = -1
    else if (pressed('right')) dc = 1
    if (dc !== 0 || dr !== 0) {
      const nc = Math.max(0, Math.min(COLS - 1, p.col + dc))
      const nr = Math.max(0, Math.min(ROWS - 1, p.row + dr))
      if (nc !== p.col || nr !== p.row) {
        p.hopFrom = { x: p.x, y: p.y }
        p.col = nc; p.row = nr; p.hopT = 0
      }
    }
    if (RIVER_ROWS.includes(p.row)) {
      const log = state.lanes[p.row].find(e => p.x >= e.x && p.x <= e.x + e.width)
      if (log) p.x += log.dir * log.speed
    }
  }
  state.prevInput = { ...input }

  // Re-read state.player instead of trusting `p` — a landing this same
  // frame (onLanded) may have replaced it via resetFrog/killFrog.
  const cur = state.player
  if (cur.row < state.maxRowReached) {
    state.score += (state.maxRowReached - cur.row) * 10
    state.maxRowReached = cur.row
  }

  state.timeLeft--
  if (state.timeLeft <= 0) { killFrog(state); return }

  checkHazards(state)
}

function onLanded(state) {
  const p = state.player
  if (p.row === HOME_ROW) {
    const slot = state.homes.find(h => !h.filled && Math.abs(h.x - p.x) < HOME_TOLERANCE)
    if (slot) {
      slot.filled = true
      state.score += 50
      if (state.homes.every(h => h.filled)) {
        state.score += 200
        state.wave++
        Object.assign(state, buildLevel(state.wave))
      }
      resetFrog(state)
    } else {
      killFrog(state)
    }
  }
}

function checkHazards(state) {
  const p = state.player
  if (p.hopFrom) return
  if (ROAD_ROWS.includes(p.row)) {
    const hit = state.lanes[p.row].some(e => p.x + 12 > e.x && p.x - 12 < e.x + e.width)
    if (hit) { killFrog(state); return }
  }
  if (RIVER_ROWS.includes(p.row)) {
    const onLog = state.lanes[p.row].some(e => p.x >= e.x && p.x <= e.x + e.width)
    if (!onLog || p.x < 0 || p.x > MAZE_W) killFrog(state)
  }
}

function killFrog(state) {
  state.lives--
  state.deathTimer = 45
}

function resetFrog(state) {
  const start = startPos()
  state.player = { ...start, x: start.col * TILE + TILE / 2, y: start.row * TILE + TILE / 2, hopFrom: null, hopT: 0 }
  state.maxRowReached = START_ROW
  state.timeLeft = TIME_LIMIT
}

function renderRiverHopper(ctx, state) {
  ctx.clearRect(0, 0, MAZE_W, MAZE_H + HUD_H)
  ctx.fillStyle = '#050510'
  ctx.fillRect(0, 0, MAZE_W, MAZE_H + HUD_H)

  ctx.fillStyle = '#dfe6ff'
  ctx.font = 'bold 15px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(`SCORE ${state.score}`, 8, HUD_H / 2)
  ctx.fillText(`TIME ${Math.ceil(state.timeLeft / 60)}`, MAZE_W / 2 - 40, HUD_H / 2)
  ctx.fillText('❤'.repeat(Math.max(0, state.lives)), MAZE_W - 66, HUD_H / 2)

  ctx.save()
  ctx.translate(0, HUD_H)

  ctx.fillStyle = '#0f3d1f'
  ctx.fillRect(0, HOME_ROW * TILE, MAZE_W, TILE)
  ctx.fillStyle = '#1a5c8a'
  RIVER_ROWS.forEach(row => ctx.fillRect(0, row * TILE, MAZE_W, TILE))
  ctx.fillStyle = '#2a6b3a'
  ctx.fillRect(0, MEDIAN_ROW * TILE, MAZE_W, TILE)
  ctx.fillStyle = '#222'
  ROAD_ROWS.forEach(row => ctx.fillRect(0, row * TILE, MAZE_W, TILE))
  ctx.fillStyle = '#2a6b3a'
  ctx.fillRect(0, START_ROW * TILE, MAZE_W, TILE)

  ctx.fillStyle = '#0a2a12'
  state.homes.forEach(h => {
    if (h.filled) return
    ctx.beginPath()
    ctx.arc(h.x, HOME_ROW * TILE + TILE / 2, TILE * 0.4, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.fillStyle = '#3dbf5d'
  state.homes.forEach(h => {
    if (h.filled) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🐸', h.x, HOME_ROW * TILE + TILE / 2 + 2); ctx.textAlign = 'left' }
  })

  RIVER_ROWS.forEach(row => {
    ctx.fillStyle = '#7a4a2a'
    state.lanes[row].forEach(e => ctx.fillRect(e.x, row * TILE + 8, e.width, TILE - 16))
  })
  ROAD_ROWS.forEach(row => {
    ctx.fillStyle = '#c0392b'
    state.lanes[row].forEach(e => ctx.fillRect(e.x, row * TILE + 6, e.width, TILE - 12))
  })

  if (state.deathTimer === 0 || state.frame % 6 < 3) {
    ctx.font = '26px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🐸', state.player.x, state.player.y + 2)
    ctx.textAlign = 'left'
  }

  ctx.restore()
}
