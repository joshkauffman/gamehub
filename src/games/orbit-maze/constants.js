// ── Orbit Maze — shared data ─────────────────────────────────────────────
// A top-down tilting-board labyrinth, in the spirit of the classic wooden
// gravity maze toy (two knobs tilt the whole board, gravity rolls a marble
// through corridors past holes that drop you back to your last checkpoint).
// The board is a perfect grid maze (recursive-backtracker) with a few extra
// connections braided in for variety, generated from a seed so a level is
// reproducible. Framework-agnostic (plain {x,y} points, no THREE, no DOM)
// so gameEngine.js can be playtested headlessly with a Node script.

export function v2(x, y) { return { x, y } }
export function v2Add(a, b) { return { x: a.x + b.x, y: a.y + b.y } }
export function v2Sub(a, b) { return { x: a.x - b.x, y: a.y - b.y } }
export function v2Scale(a, s) { return { x: a.x * s, y: a.y * s } }
export function v2Dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }

export const CELL = 1.6
export const WALL_THICK = 0.14
export const WALL_HEIGHT = 0.34

export const BALL_RADIUS = 0.26
export const HOLE_VISUAL_RADIUS = 0.28
export const HOLE_CATCH_RADIUS = 0.20
export const GOAL_VISUAL_RADIUS = 0.34
export const GOAL_CATCH_RADIUS = 0.30
export const CHECKPOINT_CATCH_RADIUS = 0.42

export const GRAVITY = 13
export const FRICTION = 1.1
export const MAX_SPEED = 7.5
export const FALL_TIME = 0.9

// ── Seeded RNG (deterministic per level/seed) ───────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStringToSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// A stable per-day seed string, e.g. "2026-08-29" — same for everyone who
// plays "today", so a Daily Challenge is genuinely shared.
export function todaySeedString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Grid maze construction ──────────────────────────────────────────────
// Each cell tracks which of its four sides are walled off. carveMaze() runs
// a randomized depth-first "recursive backtracker" from the corner, which
// always yields a fully connected maze (every cell reachable) with exactly
// one path between any two cells — braidMaze() then knocks down a handful
// of extra interior walls so there are a few loops/shortcuts, more like a
// real toy board than a strict tree.
const DIRS = [
  { d: 'N', dx: 0, dy: -1, opp: 'S' },
  { d: 'E', dx: 1, dy: 0, opp: 'W' },
  { d: 'S', dx: 0, dy: 1, opp: 'N' },
  { d: 'W', dx: -1, dy: 0, opp: 'E' },
]

function carveMaze(cols, rows, rand) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ N: true, E: true, S: true, W: true })))
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
  const stack = [[0, 0]]
  visited[0][0] = true
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const options = []
    for (const o of DIRS) {
      const nx = cx + o.dx, ny = cy + o.dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) options.push({ ...o, nx, ny })
    }
    if (!options.length) { stack.pop(); continue }
    const pick = options[Math.floor(rand() * options.length)]
    cells[cy][cx][pick.d] = false
    cells[pick.ny][pick.nx][pick.opp] = false
    visited[pick.ny][pick.nx] = true
    stack.push([pick.nx, pick.ny])
  }
  return cells
}

function braidMaze(cells, cols, rows, rand, chance = 0.08) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x < cols - 1 && cells[y][x].E && rand() < chance) { cells[y][x].E = false; cells[y][x + 1].W = false }
      if (y < rows - 1 && cells[y][x].S && rand() < chance) { cells[y][x].S = false; cells[y + 1][x].N = false }
    }
  }
}

function openCount(cell) { return (cell.N ? 0 : 1) + (cell.S ? 0 : 1) + (cell.E ? 0 : 1) + (cell.W ? 0 : 1) }

function neighborsOpen(cells, cx, cy) {
  const cell = cells[cy][cx]
  const out = []
  if (!cell.N) out.push({ cx, cy: cy - 1 })
  if (!cell.S) out.push({ cx, cy: cy + 1 })
  if (!cell.E) out.push({ cx: cx + 1, cy })
  if (!cell.W) out.push({ cx: cx - 1, cy })
  return out
}

function bfs(cells, cols, rows, start) {
  const dist = Array.from({ length: rows }, () => Array(cols).fill(-1))
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null))
  dist[start.cy][start.cx] = 0
  const q = [start]
  let qi = 0
  while (qi < q.length) {
    const cur = q[qi++]
    for (const n of neighborsOpen(cells, cur.cx, cur.cy)) {
      if (dist[n.cy][n.cx] === -1) {
        dist[n.cy][n.cx] = dist[cur.cy][cur.cx] + 1
        parent[n.cy][n.cx] = cur
        q.push(n)
      }
    }
  }
  return { dist, parent }
}

function farthestCell(dist, cols, rows) {
  let best = { cx: 0, cy: 0 }, bestD = -1
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (dist[y][x] > bestD) { bestD = dist[y][x]; best = { cx: x, cy: y } }
  return best
}

function reconstructPath(parent, start, goal) {
  const path = []
  let cur = goal
  while (cur) {
    path.push(cur)
    if (cur.cx === start.cx && cur.cy === start.cy) break
    cur = parent[cur.cy][cur.cx]
  }
  path.reverse()
  return path
}

function cellCenter(cx, cy, cellSize) { return { x: (cx + 0.5) * cellSize, y: (cy + 0.5) * cellSize } }

function buildWallSegments(cols, rows, cells, cellSize, thickness) {
  const t = thickness
  const segs = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[y][x]
      const x0 = x * cellSize, y0 = y * cellSize
      if (cell.N) segs.push({ x: x0 - t / 2, y: y0 - t / 2, w: cellSize + t, h: t })
      if (cell.W) segs.push({ x: x0 - t / 2, y: y0 - t / 2, w: t, h: cellSize + t })
      if (y === rows - 1 && cell.S) segs.push({ x: x0 - t / 2, y: y0 + cellSize - t / 2, w: cellSize + t, h: t })
      if (x === cols - 1 && cell.E) segs.push({ x: x0 + cellSize - t / 2, y: y0 - t / 2, w: t, h: cellSize + t })
    }
  }
  return segs
}

// A wall rect placed exactly on the shared border between two adjacent
// (connected) cells — used only for timed gates, which need an obstacle
// that can toggle solid/open on a cycle at a spot the ball would otherwise
// pass through freely.
function wallSegBetween(c1, c2, cellSize, thickness) {
  const t = thickness
  const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy
  if (dx === 1) return { x: (c1.cx + 1) * cellSize - t / 2, y: c1.cy * cellSize - t / 2, w: t, h: cellSize + t }
  if (dx === -1) return { x: c1.cx * cellSize - t / 2, y: c1.cy * cellSize - t / 2, w: t, h: cellSize + t }
  if (dy === 1) return { x: c1.cx * cellSize - t / 2, y: (c1.cy + 1) * cellSize - t / 2, w: cellSize + t, h: t }
  if (dy === -1) return { x: c1.cx * cellSize - t / 2, y: c1.cy * cellSize - t / 2, w: cellSize + t, h: t }
  return null
}

// A single candidate — not guaranteed fair (an on-path hole can end up
// blocking the only reasonable line through its cell). gameEngine.js's
// generateProceduralLevel() wraps this with a solvability check and
// retries with a different seed until one passes — import this raw version
// directly only if you're doing that validation yourself.
export function buildProceduralCandidate(seed, name, blurb, cfg) {
  const { cols, rows, deadEndHoles = 0, onPathHoles = 0, gate = false } = cfg
  const rand = mulberry32(typeof seed === 'number' ? seed : hashStringToSeed(String(seed)))
  const cells = carveMaze(cols, rows, rand)
  braidMaze(cells, cols, rows, rand)

  const { dist: dist0 } = bfs(cells, cols, rows, { cx: 0, cy: 0 })
  const a = farthestCell(dist0, cols, rows)
  const { dist: distA, parent: parentA } = bfs(cells, cols, rows, a)
  const b = farthestCell(distA, cols, rows)
  const startCell = a, goalCell = b
  const pathCells = reconstructPath(parentA, startCell, goalCell)
  const pathKey = new Set(pathCells.map(c => `${c.cx},${c.cy}`))
  const cellSize = CELL
  const center = c => cellCenter(c.cx, c.cy, cellSize)

  // Dead-end holes: leaf cells (only one opening) hanging off the solution
  // path — a wrong-turn hazard, never a blocker of the real route.
  const leaves = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (pathKey.has(`${x},${y}`)) continue
      if (openCount(cells[y][x]) === 1) leaves.push({ cx: x, cy: y })
    }
  }
  shuffle(leaves, rand)
  let holeSeq = 0
  const holes = leaves.slice(0, deadEndHoles).map(leaf => ({ id: `h${holeSeq++}`, pos: center(leaf) }))

  // On-path holes: offset to one side of a corridor cell so there's always
  // a clear (if narrow) lane past it — the real hazard the toy is built
  // around. safeWaypoint records the clear-lane point for the solvability
  // checker (and matches the line a careful player would actually take).
  const interiorPath = pathCells.length > 4 ? pathCells.slice(2, pathCells.length - 2) : []
  shuffle(interiorPath, rand)
  const maxOffset = cellSize / 2 - WALL_THICK / 2 - HOLE_VISUAL_RADIUS - 0.06
  const safeWaypoint = new Map()
  for (const c of interiorPath.slice(0, onPathHoles)) {
    const cell = cells[c.cy][c.cx]
    const vertical = !cell.N || !cell.S // corridor runs N-S -> offset the hole east/west
    const sign = rand() < 0.5 ? -1 : 1
    const base = center(c)
    const holePos = vertical ? { x: base.x + sign * maxOffset, y: base.y } : { x: base.x, y: base.y + sign * maxOffset }
    holes.push({ id: `h${holeSeq++}`, pos: holePos })
    const safePos = vertical ? { x: base.x - sign * maxOffset, y: base.y } : { x: base.x, y: base.y - sign * maxOffset }
    safeWaypoint.set(`${c.cx},${c.cy}`, safePos)
  }

  const walls = buildWallSegments(cols, rows, cells, cellSize, WALL_THICK)

  let gateWall = null
  if (gate && pathCells.length > 5) {
    const gi = Math.floor(pathCells.length / 2)
    const seg = wallSegBetween(pathCells[gi], pathCells[gi + 1], cellSize, WALL_THICK)
    if (seg) {
      gateWall = { ...seg, gate: { period: 2.6 + rand() * 1.2, openFraction: 0.4 + rand() * 0.15, phase: rand() * 2 } }
      walls.push(gateWall)
    }
  }

  const path = pathCells.map(c => safeWaypoint.get(`${c.cx},${c.cy}`) || center(c))

  const checkpoints = []
  if (pathCells.length > 6) {
    const idxs = [Math.floor(pathCells.length / 3), Math.floor((2 * pathCells.length) / 3)]
    idxs.forEach((idx, i) => {
      if (idx > 0 && idx < pathCells.length - 1) checkpoints.push({ id: `cp${i}`, pos: path[idx], waypointIndex: idx })
    })
  }

  const stations = [
    { type: 'start', pos: path[0] },
    ...checkpoints.map(cp => ({ type: 'checkpoint', pos: cp.pos })),
    { type: 'goal', pos: path[path.length - 1] },
  ]

  return {
    name, blurb, cols, rows, cellSize,
    width: cols * cellSize, height: rows * cellSize,
    start: path[0], goal: path[path.length - 1],
    walls, holes, checkpoints, stations, path,
  }
}

// ── Hand-picked level configs (validated + built in gameEngine.js, which
// needs the physics stepper to check solvability) ───────────────────────
export const LEVEL_CONFIGS = [
  {
    name: 'Warm-Up Roll',
    blurb: 'A short, gentle roll — get a feel for tilting the board. One hidden hole off to the side.',
    cols: 6, rows: 6, deadEndHoles: 1, onPathHoles: 0, gate: false,
  },
  {
    name: 'Watch Your Step',
    blurb: 'Longer corridors now, and a hole sits right on your route — tilt precisely to ease around it.',
    cols: 8, rows: 8, deadEndHoles: 2, onPathHoles: 1, gate: false,
  },
  {
    name: 'Full Board',
    blurb: 'A sprawling board with holes both on and off the path. Steady, patient tilts.',
    cols: 10, rows: 9, deadEndHoles: 3, onPathHoles: 2, gate: false,
  },
  {
    name: "Gatekeeper's Run",
    blurb: 'A timed gate blocks the corridor on a cycle — red is shut, green is open. Time your roll.',
    cols: 10, rows: 10, deadEndHoles: 3, onPathHoles: 2, gate: true,
  },
]
export const FIXED_SEEDS = [101, 202, 303, 404]
export const RANDOM_CFG = { cols: 9, rows: 9, deadEndHoles: 3, onPathHoles: 2, gate: true }

const BEST_KEY = 'orbit-maze-2d-best-times'

export function loadBestTimes() {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveBestTime(key, seconds) {
  try {
    const best = loadBestTimes()
    if (best[key] === undefined || seconds < best[key]) {
      best[key] = seconds
      localStorage.setItem(BEST_KEY, JSON.stringify(best))
    }
    return best[key]
  } catch { return seconds }
}
