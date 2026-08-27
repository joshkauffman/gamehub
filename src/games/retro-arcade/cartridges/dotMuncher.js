// ── Dot Muncher — a maze-chase cartridge in the spirit of a certain
// yellow circle's arcade outing. Everything here is original: a freshly
// procedurally-generated maze every run (so nobody can call it a traced
// layout), original ghost-behavior heuristics, and shapes drawn with
// canvas primitives — no sprites, no copied assets, no copyrighted names.

const COLS = 19
const ROWS = 21
const TILE = 24
const HUD_H = 36
const MAZE_W = COLS * TILE
const MAZE_H = ROWS * TILE

const PLAYER_SPEED = 2.4
const GHOST_SPEED = 2.05
const FRIGHT_SPEED = 1.35
const FRIGHT_FRAMES = 8 * 60
const SCATTER_FRAMES = 7 * 60
const CHASE_FRAMES = 20 * 60
const LIVES_START = 3

const DIRS = {
  none: { dx: 0, dy: 0 },
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}
function opposite(d) { return { dx: -d.dx, dy: -d.dy } }
function sameDir(a, b) { return a.dx === b.dx && a.dy === b.dy }

function cellCenter(col, row) { return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 } }

// ── Maze generation: recursive-backtracker spanning tree on a coarse
// grid of "room" cells (odd coordinates), then a pass that knocks out a
// few extra walls to add loops — Pac-Man-style corridors need loops or
// there's nowhere to juke a chaser.
function generateMaze(rng) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1))
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false))
  function neighbors(r, c) {
    return [[r - 2, c], [r + 2, c], [r, c - 2], [r, c + 2]]
      .filter(([nr, nc]) => nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1)
  }
  const stack = [[1, 1]]
  visited[1][1] = true
  grid[1][1] = 0
  while (stack.length) {
    const [r, c] = stack[stack.length - 1]
    const options = neighbors(r, c).filter(([nr, nc]) => !visited[nr][nc])
    if (options.length === 0) { stack.pop(); continue }
    const [nr, nc] = options[Math.floor(rng() * options.length)]
    grid[nr][nc] = 0
    grid[(r + nr) / 2][(c + nc) / 2] = 0
    visited[nr][nc] = true
    stack.push([nr, nc])
  }
  for (let r = 2; r < ROWS - 2; r++) {
    for (let c = 2; c < COLS - 2; c++) {
      if (grid[r][c] !== 1) continue
      if (rng() > 0.08) continue
      const horizOpen = grid[r][c - 1] === 0 && grid[r][c + 1] === 0
      const vertOpen = grid[r - 1][c] === 0 && grid[r + 1][c] === 0
      if (horizOpen || vertOpen) grid[r][c] = 0
    }
  }
  return grid
}

function isWall(grid, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true
  return grid[row][col] === 1
}
function canMove(grid, col, row, dir) { return !isWall(grid, col + dir.dx, row + dir.dy) }

function roomCells(grid) {
  const cells = []
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) if (grid[r][c] === 0) cells.push([c, r])
  return cells
}

function farthestFrom(cells, from) {
  let best = cells[0], bestD = -1
  for (const [c, r] of cells) {
    const d = (c - from[0]) ** 2 + (r - from[1]) ** 2
    if (d > bestD) { bestD = d; best = [c, r] }
  }
  return best
}

function newLevel(rng, level) {
  const grid = generateMaze(rng)
  const cells = roomCells(grid)
  const playerStart = cells[Math.floor(cells.length * 0.5)] || cells[0]
  const dots = new Set()
  cells.forEach(([c, r]) => dots.add(`${c},${r}`))
  // Power pellets: 4 cells spread toward the corners of the room space.
  const corners = [
    farthestFrom(cells, [0, 0]),
    farthestFrom(cells, [COLS, 0]),
    farthestFrom(cells, [0, ROWS]),
    farthestFrom(cells, [COLS, ROWS]),
  ]
  const powerCells = new Set(corners.map(([c, r]) => `${c},${r}`))
  powerCells.forEach(key => dots.delete(key))
  dots.delete(`${playerStart[0]},${playerStart[1]}`)

  const ghostCount = Math.min(3 + Math.floor((level - 1) / 2), 5)
  const ghostHome = cells[Math.floor(cells.length * 0.5) + Math.floor(cells.length * 0.15)] || cells[Math.floor(cells.length / 2)]
  const ghostColors = ['#ff4d4d', '#ff8fd6', '#7be0ff', '#ffb84d', '#b98cff']
  const ghostPersonality = ['chase', 'ambush', 'erratic', 'chase', 'ambush']
  const scatterCorners = [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]]
  const ghosts = Array.from({ length: ghostCount }, (_, i) => {
    const c = cellCenter(ghostHome[0], ghostHome[1])
    return {
      x: c.x, y: c.y, col: ghostHome[0], row: ghostHome[1],
      dir: DIRS.up, color: ghostColors[i % ghostColors.length],
      personality: ghostPersonality[i % ghostPersonality.length],
      scatterCorner: scatterCorners[i % scatterCorners.length],
      frightened: 0,
    }
  })

  return {
    grid, dots, powerCells,
    playerStart,
    ghostHome,
    ghosts,
  }
}

export const dotMuncher = {
  id: 'dot-muncher',
  title: 'Dot Muncher',
  emoji: '🟡',
  tagline: 'Gobble every dot in a fresh maze while a pack of colorful shapes hunt you down.',
  controls: 'Arrow keys / WASD to move',
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
    const rng = Math.random
    const level = newLevel(rng, 1)
    const start = cellCenter(level.playerStart[0], level.playerStart[1])
    return {
      status: 'playing', score: 0, lives: LIVES_START, level: 1,
      ...level,
      player: { x: start.x, y: start.y, col: level.playerStart[0], row: level.playerStart[1], dir: DIRS.none, wantDir: DIRS.none, mouth: 0 },
      modeTimer: SCATTER_FRAMES, mode: 'scatter',
      frightChain: 0,
      frame: 0,
      deathTimer: 0,
    }
  },

  step(state, input) {
    if (state.status !== 'playing') return
    state.frame++

    if (input.up) state.player.wantDir = DIRS.up
    else if (input.down) state.player.wantDir = DIRS.down
    else if (input.left) state.player.wantDir = DIRS.left
    else if (input.right) state.player.wantDir = DIRS.right

    if (state.deathTimer > 0) {
      state.deathTimer--
      if (state.deathTimer === 0) {
        if (state.lives <= 0) { state.status = 'gameover'; return }
        const start = cellCenter(state.playerStart[0], state.playerStart[1])
        state.player = { x: start.x, y: start.y, col: state.playerStart[0], row: state.playerStart[1], dir: DIRS.none, wantDir: DIRS.none, mouth: 0 }
        const home = cellCenter(state.ghostHome[0], state.ghostHome[1])
        state.ghosts.forEach(g => {
          g.x = home.x; g.y = home.y; g.col = state.ghostHome[0]; g.row = state.ghostHome[1]
          g.frightened = 0; g.dir = DIRS.up
        })
      }
      return
    }

    // mode timer (scatter <-> chase), pauses while any ghost is frightened
    const anyFrightened = state.ghosts.some(g => g.frightened > 0)
    if (!anyFrightened) {
      state.modeTimer--
      if (state.modeTimer <= 0) {
        if (state.mode === 'scatter') { state.mode = 'chase'; state.modeTimer = CHASE_FRAMES }
        else { state.mode = 'scatter'; state.modeTimer = SCATTER_FRAMES }
        state.ghosts.forEach(g => { g.dir = opposite(g.dir) })
      }
    }

    stepPlayer(state)
    state.ghosts.forEach(g => stepGhost(state, g))
    checkDotEaten(state)
    checkGhostCollisions(state)

    if (state.dots.size === 0 && state.powerCells.size === 0) {
      state.level++
      const level = newLevel(Math.random, state.level)
      Object.assign(state, level)
      const start = cellCenter(state.playerStart[0], state.playerStart[1])
      state.player = { x: start.x, y: start.y, col: state.playerStart[0], row: state.playerStart[1], dir: DIRS.none, wantDir: DIRS.none, mouth: 0 }
      state.mode = 'scatter'; state.modeTimer = SCATTER_FRAMES
    }
  },

  render(ctx, state) { renderDotMuncher(ctx, state) },
}

function atCenter(pos, speed) {
  const nearestCol = Math.floor(pos.x / TILE)
  const nearestRow = Math.floor(pos.y / TILE)
  const c = cellCenter(nearestCol, nearestRow)
  return Math.abs(pos.x - c.x) < speed * 0.6 && Math.abs(pos.y - c.y) < speed * 0.6 ? { col: nearestCol, row: nearestRow, center: c } : null
}

function stepPlayer(state) {
  const p = state.player
  const hit = atCenter(p, PLAYER_SPEED)
  if (hit) {
    p.x = hit.center.x; p.y = hit.center.y; p.col = hit.col; p.row = hit.row
    if (p.wantDir !== DIRS.none && canMove(state.grid, hit.col, hit.row, p.wantDir)) p.dir = p.wantDir
    else if (!canMove(state.grid, hit.col, hit.row, p.dir)) p.dir = DIRS.none
  }
  p.x += p.dir.dx * PLAYER_SPEED
  p.y += p.dir.dy * PLAYER_SPEED
  p.mouth = (p.mouth + 1) % 20
}

function ghostSpeed(g) { return g.frightened > 0 ? FRIGHT_SPEED : GHOST_SPEED }

function stepGhost(state, g) {
  if (g.frightened > 0) g.frightened--
  const speed = ghostSpeed(g)
  const hit = atCenter(g, speed)
  if (hit) {
    g.x = hit.center.x; g.y = hit.center.y; g.col = hit.col; g.row = hit.row
    const target = ghostTarget(state, g)
    const candidates = Object.values(DIRS).filter(d => d !== DIRS.none && canMove(state.grid, hit.col, hit.row, d) && !sameDir(d, opposite(g.dir)))
    let pool = candidates.length ? candidates : Object.values(DIRS).filter(d => d !== DIRS.none && canMove(state.grid, hit.col, hit.row, d))
    if (pool.length === 0) pool = [opposite(g.dir)]
    let chosen
    if (g.frightened > 0 || (g.personality === 'erratic' && Math.random() < 0.4)) {
      chosen = pool[Math.floor(Math.random() * pool.length)]
    } else {
      chosen = pool.reduce((best, d) => {
        const nc = hit.col + d.dx, nr = hit.row + d.dy
        const dist = (nc - target[0]) ** 2 + (nr - target[1]) ** 2
        return dist < best.dist ? { d, dist } : best
      }, { d: pool[0], dist: Infinity }).d
    }
    g.dir = chosen
  }
  g.x += g.dir.dx * speed
  g.y += g.dir.dy * speed
}

function ghostTarget(state, g) {
  if (state.mode === 'scatter' && g.frightened === 0) return g.scatterCorner
  const p = state.player
  if (g.personality === 'ambush') return [p.col + p.dir.dx * 4, p.row + p.dir.dy * 4]
  return [p.col, p.row]
}

function checkDotEaten(state) {
  const key = `${state.player.col},${state.player.row}`
  if (state.dots.has(key)) { state.dots.delete(key); state.score += 10 }
  if (state.powerCells.has(key)) {
    state.powerCells.delete(key); state.score += 50
    state.frightChain = 0
    state.ghosts.forEach(g => { g.frightened = FRIGHT_FRAMES; g.dir = opposite(g.dir) })
  }
}

function checkGhostCollisions(state) {
  const p = state.player
  for (const g of state.ghosts) {
    const dx = p.x - g.x, dy = p.y - g.y
    if (dx * dx + dy * dy > (TILE * 0.55) ** 2) continue
    if (g.frightened > 0) {
      state.frightChain++
      state.score += 200 * Math.pow(2, Math.min(3, state.frightChain - 1))
      const home = cellCenter(state.ghostHome[0], state.ghostHome[1])
      g.x = home.x; g.y = home.y; g.col = state.ghostHome[0]; g.row = state.ghostHome[1]
      g.frightened = 0; g.dir = DIRS.up
    } else {
      state.lives--
      state.deathTimer = 60
    }
  }
}

function renderDotMuncher(ctx, state) {
  ctx.clearRect(0, 0, MAZE_W, MAZE_H + HUD_H)
  ctx.fillStyle = '#050510'
  ctx.fillRect(0, 0, MAZE_W, MAZE_H + HUD_H)

  ctx.fillStyle = '#dfe6ff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(`SCORE ${state.score}`, 10, HUD_H / 2)
  ctx.fillText(`LEVEL ${state.level}`, MAZE_W / 2 - 30, HUD_H / 2)
  ctx.fillText('❤'.repeat(Math.max(0, state.lives)), MAZE_W - 70, HUD_H / 2)

  ctx.save()
  ctx.translate(0, HUD_H)

  ctx.fillStyle = '#1533c9'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.grid[r][c] === 1) {
        ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2)
      }
    }
  }

  ctx.fillStyle = '#ffe08a'
  state.dots.forEach(key => {
    const [c, r] = key.split(',').map(Number)
    const p = cellCenter(c, r)
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill()
  })
  const pulse = 4 + Math.sin(state.frame * 0.15) * 1.5
  ctx.fillStyle = '#ffb84d'
  state.powerCells.forEach(key => {
    const [c, r] = key.split(',').map(Number)
    const p = cellCenter(c, r)
    ctx.beginPath(); ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2); ctx.fill()
  })

  if (state.deathTimer === 0 || state.lives > 0) {
    drawMuncher(ctx, state.player)
  }
  state.ghosts.forEach(g => drawGhost(ctx, g))

  ctx.restore()

  if (state.deathTimer > 0 && state.lives > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, HUD_H, MAZE_W, MAZE_H)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('OOF', MAZE_W / 2, HUD_H + MAZE_H / 2)
    ctx.textAlign = 'left'
  }
}

function drawMuncher(ctx, p) {
  const angle = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0, none: 0 }
  let facing = 'right'
  for (const [name, d] of Object.entries(DIRS)) if (sameDir(d, p.dir) && name !== 'none') facing = name
  const openAmt = (Math.sin(p.mouth / 20 * Math.PI * 2) + 1) / 2 * 0.28 + 0.02
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle[facing])
  ctx.fillStyle = '#ffd23c'
  ctx.beginPath()
  ctx.arc(0, 0, TILE * 0.42, openAmt * Math.PI, (2 - openAmt) * Math.PI)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawGhost(ctx, g) {
  const r = TILE * 0.42
  ctx.fillStyle = g.frightened > 0 ? (g.frightened < 90 && g.frightened % 20 < 10 ? '#ffffff' : '#3d4dff') : g.color
  ctx.beginPath()
  ctx.arc(g.x, g.y - r * 0.15, r, Math.PI, 0)
  ctx.lineTo(g.x + r, g.y + r * 0.7)
  for (let i = 0; i < 3; i++) {
    const x1 = g.x + r - (2 * r / 3) * i
    const x2 = g.x + r - (2 * r / 3) * (i + 0.5)
    ctx.lineTo(x2, g.y + r * 0.3)
    ctx.lineTo(x1 - (2 * r / 3), g.y + r * 0.7)
  }
  ctx.lineTo(g.x - r, g.y + r * 0.7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(g.x - r * 0.4, g.y - r * 0.2, r * 0.28, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(g.x + r * 0.4, g.y - r * 0.2, r * 0.28, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a3d'
  const lookX = g.dir.dx * r * 0.14, lookY = g.dir.dy * r * 0.14
  ctx.beginPath(); ctx.arc(g.x - r * 0.4 + lookX, g.y - r * 0.2 + lookY, r * 0.13, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(g.x + r * 0.4 + lookX, g.y - r * 0.2 + lookY, r * 0.13, 0, Math.PI * 2); ctx.fill()
}
