// ── The Obvious Metroid Knockoff — world map ──────────────────────────
// Rooms live on a grid (gx, gy); adjacency (and therefore which doors
// exist) is derived automatically from which grid cells are occupied —
// a room builder never has to hand-wire its own exits. Builders just
// draw a floor/platforms/hazards; clearDoorGaps() punches the actual
// door openings afterward, so nothing a builder draws can accidentally
// wall off a connection to a neighboring room.

import { COLS, ROWS, DOOR_ROWS, DOOR_COLS } from './constants.js'

function blankRoom() {
  const rows = []
  for (let r = 0; r < ROWS; r++) rows.push(new Array(COLS).fill('.'))
  for (let c = 0; c < COLS; c++) { rows[0][c] = '#'; rows[ROWS - 1][c] = '#' }
  for (let r = 0; r < ROWS; r++) { rows[r][0] = '#'; rows[r][COLS - 1] = '#' }
  return rows
}
function hline(rows, r, c0, c1, ch = '#') { for (let c = c0; c <= c1; c++) rows[r][c] = ch }
function rect(rows, r0, r1, c0, c1, ch = '#') { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) rows[r][c] = ch }

function clearDoorGaps(rows, n) {
  const [c0, c1] = DOOR_COLS
  const [r0, , r2] = DOOR_ROWS
  if (n.up) { for (const c of [c0, c1]) { rows[0][c] = '.'; rows[1][c] = '.' } }
  if (n.down) { for (const c of [c0, c1]) { rows[ROWS - 1][c] = '.'; rows[ROWS - 2][c] = '.' } }
  if (n.left) { for (const r of [r0, r0 + 1, r2]) { rows[r][0] = '.'; rows[r][1] = '.' } }
  if (n.right) { for (const r of [r0, r0 + 1, r2]) { rows[r][COLS - 1] = '.'; rows[r][COLS - 2] = '.' } }
}

// ── Room builders ──────────────────────────────────────────────────────

function buildLandingSite(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 6, 14, 18)
}
function buildRidgeOverlook(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 7, 2, 6)
}
function buildWestBluff(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 8, 10, 16)
}
function buildCauseway(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 7, 3, 7)
  hline(rows, 7, 16, 20)
}
function buildHollowCistern(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 8, 2, 5)
  hline(rows, 6, 17, 21)
}
function buildEmberShelf(rows) {
  hline(rows, 10, 1, 22)
  // Missile-gated pocket (cols 19-22) holding Missile Tank #1 — the wall
  // runs floor-to-ceiling so it can't be jumped over, only blasted.
  rect(rows, 1, 9, 17, 18, 'K')
}
function buildMidHub(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 7, 9, 14)
  // Bomb-gated wall toward Updraft Shaft, well clear of the auto-carved
  // right-door opening.
  rect(rows, 1, 9, 18, 19, 'B')
}
function buildUnderCrawl(rows) {
  hline(rows, 10, 1, 22)
  // A one-tile-tall crawl band — too low for a standing player, easy
  // for a morph ball — gates the Bombs pickup at the room's west end.
  hline(rows, 8, 3, 9, '#')
}
function buildUpdraftShaft(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 8, 2, 5)
}
function buildLongStraightaway(rows) {
  hline(rows, 10, 1, 22)
  // Speed-wall dead-end pocket (cols 21-22) hiding bonus Missile Tank #2.
  rect(rows, 1, 9, 19, 20, 'D')
}
function buildVentGauntlet(rows) {
  hline(rows, 10, 1, 8, 'L')
  hline(rows, 10, 9, 14, '#')
  hline(rows, 10, 15, 22, 'L')
}
function buildLowerHub(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 7, 4, 8)
  hline(rows, 7, 15, 19)
}
function buildReactorAccess(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 10, 2, 6, 'L')
  hline(rows, 10, 17, 21, 'L')
  // Missile-gated band sitting over the down-shaft (one row clear of the
  // auto-carved door gap) — the only way deeper, toward the boss.
  hline(rows, 9, 10, 13, 'K')
  hline(rows, 8, 10, 13, 'K')
}
function buildCoreChamber(rows) {
  hline(rows, 10, 1, 22)
}

// ── World graph ─────────────────────────────────────────────────────────

const ROOM_LIST = [
  { gx: 2, gy: 0, name: 'Landing Site', biome: 'surface', build: buildLandingSite, isStart: true,
    enemies: [{ type: 'crawler', col: 6, row: 10, minCol: 3, maxCol: 20 }] },
  { gx: 3, gy: 0, name: 'Ridge Overlook', biome: 'surface', build: buildRidgeOverlook,
    items: [{ type: 'missile_launcher', col: 4, row: 6 }],
    enemies: [{ type: 'drifter', col: 16, row: 5, minCol: 12, maxCol: 20, baseRow: 5 }] },
  { gx: 1, gy: 0, name: 'West Bluff', biome: 'surface', build: buildWestBluff,
    items: [{ type: 'energy_tank', col: 13, row: 7 }],
    enemies: [{ type: 'crawler', col: 5, row: 10, minCol: 2, maxCol: 20 }] },
  { gx: 2, gy: 1, name: 'Causeway', biome: 'caves', build: buildCauseway,
    enemies: [
      { type: 'crawler', col: 10, row: 10, minCol: 2, maxCol: 21 },
      { type: 'turret', col: 18, row: 7, facing: 'left' },
    ] },
  { gx: 1, gy: 1, name: 'Hollow Cistern', biome: 'caves', build: buildHollowCistern,
    items: [{ type: 'morph_ball', col: 19, row: 5 }],
    enemies: [{ type: 'drifter', col: 10, row: 5, minCol: 4, maxCol: 18, baseRow: 5 }] },
  { gx: 3, gy: 1, name: 'Ember Shelf', biome: 'caves', build: buildEmberShelf,
    items: [{ type: 'missile_tank', col: 20, row: 8 }],
    enemies: [{ type: 'turret', col: 17, row: 10, facing: 'left' }] },
  { gx: 2, gy: 2, name: 'Mid Hub', biome: 'deep', build: buildMidHub,
    enemies: [
      { type: 'crawler', col: 12, row: 10, minCol: 2, maxCol: 21 },
      { type: 'drifter', col: 11, row: 6, minCol: 9, maxCol: 15, baseRow: 6 },
    ] },
  { gx: 1, gy: 2, name: 'Under-Crawl', biome: 'deep', build: buildUnderCrawl,
    items: [{ type: 'bombs', col: 2, row: 9 }],
    enemies: [{ type: 'crawler', col: 6, row: 10, minCol: 2, maxCol: 8 }] },
  { gx: 3, gy: 2, name: 'Updraft Shaft', biome: 'deep', build: buildUpdraftShaft,
    items: [{ type: 'high_jump', col: 3, row: 7 }],
    enemies: [{ type: 'drifter', col: 14, row: 5, minCol: 9, maxCol: 20, baseRow: 5 }] },
  { gx: 4, gy: 2, name: 'Long Straightaway', biome: 'deep', build: buildLongStraightaway,
    items: [{ type: 'speed_booster', col: 12, row: 9 }, { type: 'missile_tank', col: 21, row: 8 }],
    enemies: [{ type: 'turret', col: 11, row: 10, facing: 'left' }] },
  { gx: 1, gy: 3, name: 'Vent Gauntlet', biome: 'thermal', build: buildVentGauntlet,
    items: [{ type: 'thermal_plating', col: 11, row: 9 }] },
  { gx: 2, gy: 3, name: 'Lower Hub', biome: 'thermal', build: buildLowerHub,
    items: [{ type: 'energy_tank', col: 17, row: 6 }],
    enemies: [
      { type: 'crawler', col: 9, row: 10, minCol: 2, maxCol: 21 },
      { type: 'turret', col: 6, row: 7, facing: 'right' },
    ] },
  { gx: 2, gy: 4, name: 'Reactor Access', biome: 'reactor', build: buildReactorAccess,
    enemies: [{ type: 'turret', col: 18, row: 7, facing: 'left' }] },
  { gx: 2, gy: 5, name: 'Core Chamber', biome: 'reactor', build: buildCoreChamber, isBoss: true },
]

function buildWorld() {
  const byKey = {}
  for (const d of ROOM_LIST) byKey[`${d.gx},${d.gy}`] = d
  const rooms = {}
  for (const d of ROOM_LIST) {
    const key = `${d.gx},${d.gy}`
    const n = {
      up: !!byKey[`${d.gx},${d.gy - 1}`],
      down: !!byKey[`${d.gx},${d.gy + 1}`],
      left: !!byKey[`${d.gx - 1},${d.gy}`],
      right: !!byKey[`${d.gx + 1},${d.gy}`],
    }
    const neighborKeys = {
      up: n.up ? `${d.gx},${d.gy - 1}` : null,
      down: n.down ? `${d.gx},${d.gy + 1}` : null,
      left: n.left ? `${d.gx - 1},${d.gy}` : null,
      right: n.right ? `${d.gx + 1},${d.gy}` : null,
    }
    const rows = blankRoom()
    d.build(rows, n)
    clearDoorGaps(rows, n)
    rooms[key] = {
      key, gx: d.gx, gy: d.gy, name: d.name, biome: d.biome, rows, neighbors: neighborKeys,
      items: d.items || [], enemies: d.enemies || [], isBoss: !!d.isBoss, isStart: !!d.isStart,
    }
  }
  return rooms
}

export const WORLD = buildWorld()
export const START_ROOM_KEY = ROOM_LIST.find(r => r.isStart) ? `${ROOM_LIST.find(r => r.isStart).gx},${ROOM_LIST.find(r => r.isStart).gy}` : Object.keys(WORLD)[0]
export const TOTAL_ITEMS = ROOM_LIST.reduce((n, r) => n + (r.items ? r.items.length : 0), 0)
