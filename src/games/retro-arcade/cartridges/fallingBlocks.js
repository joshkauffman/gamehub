// ── Falling Blocks — a line-clearing puzzle cartridge in the spirit of
// the genre-defining classic. Original code: a simple non-SRS rotation
// system (no wall kicks, like the earliest versions of the genre), a
// 7-bag randomizer so pieces don't repeat too often, and canvas-drawn
// blocks only.

const COLS = 10
const ROWS = 20
const CELL = 26
const FIELD_W = COLS * CELL
const FIELD_H = ROWS * CELL
const MARGIN = 20
const SIDEBAR_W = 150
const W = FIELD_W + MARGIN * 2 + SIDEBAR_W
const H = FIELD_H + MARGIN * 2

const SHAPES = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#4dd0ff' },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ffd23c' },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#c77dff' },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#7be07b' },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ff5d5d' },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#5f8fff' },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#ff9d3d' },
}
const TYPES = Object.keys(SHAPES)

function shuffledBag() {
  const bag = [...TYPES]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

function spawnPiece(type) {
  const shape = SHAPES[type]
  return { type, n: shape.n, cells: shape.cells.map(c => [...c]), col: Math.floor((COLS - shape.n) / 2), row: type === 'I' ? -1 : -2 }
}

function emptyGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)) }

const DAS_DELAY = 13
const DAS_REPEAT = 4
const HARD_DROP_POINTS = 2
const SOFT_DROP_POINTS = 1
const LINE_SCORE = [0, 100, 300, 500, 800]

function gravityInterval(level) { return Math.max(6, 48 - (level - 1) * 4) }

export const fallingBlocks = {
  id: 'falling-blocks',
  title: 'Falling Blocks',
  emoji: '🧩',
  tagline: 'Clear lines before the stack reaches the top. Seven-piece bag, no repeats in a row.',
  controls: '← → move · ↓ soft drop · ↑ rotate · Space hard drop',
  width: W,
  height: H,

  readInput(keys) {
    return {
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
      down: keys.has('ArrowDown') || keys.has('KeyS'),
      rotate: keys.has('ArrowUp') || keys.has('KeyW'),
      drop: keys.has('Space'),
    }
  },

  createState() {
    const bag = shuffledBag()
    const type = bag.pop()
    const nextBag = bag.length ? bag : shuffledBag()
    return {
      status: 'playing', score: 0, lines: 0, level: 1,
      grid: emptyGrid(),
      piece: spawnPiece(type),
      bag: nextBag,
      next: nextBag[nextBag.length - 1],
      fallTimer: gravityInterval(1),
      horizDir: 0, horizTimer: 0,
      prevRotate: false, prevDrop: false,
      clearFlash: [],
      flashTimer: 0,
      frame: 0,
    }
  },

  step(state, input) { stepFallingBlocks(state, input) },
  render(ctx, state) { renderFallingBlocks(ctx, state) },
}

function collides(state, cells, col, row) {
  for (const [cx, cy] of cells) {
    const gx = col + cx, gy = row + cy
    if (gx < 0 || gx >= COLS || gy >= ROWS) return true
    if (gy < 0) continue
    if (state.grid[gy][gx]) return true
  }
  return false
}

function drawNextType(state) {
  const type = state.bag.pop()
  if (state.bag.length === 0) state.bag = shuffledBag()
  return type
}

function lockPiece(state) {
  const p = state.piece
  const color = SHAPES[p.type].color
  for (const [cx, cy] of p.cells) {
    const gx = p.col + cx, gy = p.row + cy
    if (gy < 0) { state.status = 'gameover'; return }
    state.grid[gy][gx] = color
  }
  const fullRows = []
  for (let r = 0; r < ROWS; r++) if (state.grid[r].every(c => c)) fullRows.push(r)
  if (fullRows.length) {
    state.score += LINE_SCORE[fullRows.length] * state.level
    state.lines += fullRows.length
    state.level = Math.floor(state.lines / 10) + 1
    state.grid = state.grid.filter((_, r) => !fullRows.includes(r))
    while (state.grid.length < ROWS) state.grid.unshift(Array(COLS).fill(null))
    state.flashTimer = 12
  }

  const type = state.next
  state.next = drawNextType(state)
  const fresh = spawnPiece(type)
  if (collides(state, fresh.cells, fresh.col, fresh.row)) { state.status = 'gameover'; return }
  state.piece = fresh
  state.fallTimer = gravityInterval(state.level)
}

function stepFallingBlocks(state, input) {
  if (state.status !== 'playing') return
  state.frame++
  if (state.flashTimer > 0) state.flashTimer--

  const p = state.piece
  const dir = input.left ? -1 : input.right ? 1 : 0
  if (dir !== state.horizDir) {
    state.horizDir = dir
    state.horizTimer = 0
    if (dir !== 0 && !collides(state, p.cells, p.col + dir, p.row)) p.col += dir
  } else if (dir !== 0) {
    state.horizTimer--
    if (state.horizTimer <= 0) {
      state.horizTimer = DAS_REPEAT
      if (!collides(state, p.cells, p.col + dir, p.row)) p.col += dir
    }
  }
  // After the initial move, arm the long DAS delay before repeats kick in.
  if (dir !== 0 && state.horizTimer === 0) state.horizTimer = DAS_DELAY

  if (input.rotate && !state.prevRotate) {
    const rotated = p.cells.map(([x, y]) => [p.n - 1 - y, x])
    if (!collides(state, rotated, p.col, p.row)) p.cells = rotated
  }
  state.prevRotate = input.rotate

  if (input.drop && !state.prevDrop) {
    let dropRows = 0
    while (!collides(state, p.cells, p.col, p.row + 1)) { p.row++; dropRows++ }
    state.score += dropRows * HARD_DROP_POINTS
    lockPiece(state)
    state.prevDrop = input.drop
    return
  }
  state.prevDrop = input.drop

  const interval = input.down ? Math.min(3, gravityInterval(state.level)) : gravityInterval(state.level)
  state.fallTimer--
  if (state.fallTimer <= 0) {
    state.fallTimer = interval
    if (!collides(state, p.cells, p.col, p.row + 1)) {
      p.row++
      if (input.down) state.score += SOFT_DROP_POINTS
    } else {
      lockPiece(state)
    }
  }
}

function renderFallingBlocks(ctx, state) {
  ctx.fillStyle = '#080410'
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.translate(MARGIN, MARGIN)
  ctx.fillStyle = '#0d0a1a'
  ctx.fillRect(0, 0, FIELD_W, FIELD_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, FIELD_H); ctx.stroke() }
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(FIELD_W, r * CELL); ctx.stroke() }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.grid[r][c]) drawCell(ctx, c, r, state.grid[r][c])
    }
  }

  const p = state.piece
  const color = SHAPES[p.type].color
  p.cells.forEach(([cx, cy]) => { if (p.row + cy >= 0) drawCell(ctx, p.col + cx, p.row + cy, color) })

  if (state.flashTimer > 0 && state.flashTimer % 4 < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.strokeRect(0, 0, FIELD_W, FIELD_H)
  ctx.restore()

  ctx.save()
  ctx.translate(MARGIN * 2 + FIELD_W, MARGIN)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText('SCORE', 0, 0)
  ctx.font = 'bold 18px monospace'
  ctx.fillText(String(state.score), 0, 20)
  ctx.font = 'bold 14px monospace'
  ctx.fillText('LEVEL', 0, 56)
  ctx.font = 'bold 18px monospace'
  ctx.fillText(String(state.level), 0, 76)
  ctx.font = 'bold 14px monospace'
  ctx.fillText('LINES', 0, 112)
  ctx.font = 'bold 18px monospace'
  ctx.fillText(String(state.lines), 0, 132)

  ctx.font = 'bold 14px monospace'
  ctx.fillText('NEXT', 0, 170)
  const nextShape = SHAPES[state.next]
  const boxSize = 4 * (CELL * 0.7)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.strokeRect(0, 194, boxSize, boxSize)
  const cs = CELL * 0.7
  const offsetX = (4 - nextShape.n) / 2 * cs
  nextShape.cells.forEach(([cx, cy]) => {
    ctx.fillStyle = nextShape.color
    ctx.fillRect(offsetX + cx * cs + 2, 194 + offsetX + cy * cs + 2, cs - 4, cs - 4)
  })
  ctx.restore()
}

function drawCell(ctx, col, row, color) {
  const x = col * CELL, y = row * CELL
  ctx.fillStyle = color
  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(x + 1, y + 1, CELL - 2, 4)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(x + 1, y + CELL - 5, CELL - 2, 4)
}
