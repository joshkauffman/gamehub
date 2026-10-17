// ── The Obvious Zelda Knockoff — world map ────────────────────────────
// Three small worlds share one grid-based room system: the Overworld,
// a single-room Sword Cave, and the Dungeon. Within a world, adjacency
// (and therefore which doors exist) is derived automatically from
// which grid cells are occupied, exactly like the room system in The
// Obvious Metroid Knockoff — a room builder never hand-wires its own
// exits, it just draws terrain; clearDoorGaps() punches the actual
// openings afterward. Crossing between worlds (a cave mouth, a dungeon
// entrance) is handled separately by a short list of point-to-point
// portals, since those aren't grid-adjacent.

import { COLS, ROWS, DOOR_ROWS, DOOR_COLS } from './constants.js'

function blankRoom(fill = '.') {
  const rows = []
  for (let r = 0; r < ROWS; r++) rows.push(new Array(COLS).fill(fill))
  for (let c = 0; c < COLS; c++) { rows[0][c] = '#'; rows[ROWS - 1][c] = '#' }
  for (let r = 0; r < ROWS; r++) { rows[r][0] = '#'; rows[r][COLS - 1] = '#' }
  return rows
}
function hline(rows, r, c0, c1, ch = '#') { for (let c = c0; c <= c1; c++) rows[r][c] = ch }
function vline(rows, c, r0, r1, ch = '#') { for (let r = r0; r <= r1; r++) rows[r][c] = ch }
function rect(rows, r0, r1, c0, c1, ch = '#') { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) rows[r][c] = ch }
function put(rows, r, c, ch) { rows[r][c] = ch }

function clearDoorGaps(rows, n) {
  const [c0, c1] = DOOR_COLS
  const [r0, , r2] = DOOR_ROWS
  if (n.up) { for (const c of [c0, c1]) { rows[0][c] = '.'; rows[1][c] = '.' } }
  if (n.down) { for (const c of [c0, c1]) { rows[ROWS - 1][c] = '.'; rows[ROWS - 2][c] = '.' } }
  if (n.left) { for (const r of [r0, r0 + 1, r2]) { rows[r][0] = '.'; rows[r][1] = '.' } }
  if (n.right) { for (const r of [r0, r0 + 1, r2]) { rows[r][COLS - 1] = '.'; rows[r][COLS - 2] = '.' } }
}

// ── Overworld room builders ──────────────────────────────────────────

function buildStartMeadow(rows) {
  hline(rows, 3, 9, 14, 'T')
  put(rows, 3, 11, '.'); put(rows, 3, 12, '.') // gap lined up with the north door
  rect(rows, 9, 10, 10, 13, '#') // the old man's cave mouth structure
  put(rows, 9, 11, '.'); put(rows, 9, 12, '.') // the dark entrance itself
}
function buildNorthField(rows) {
  rect(rows, 3, 4, 3, 6, 'T')
  rect(rows, 7, 8, 16, 19, 'T')
}
function buildForestGrove(rows) {
  rect(rows, 2, 9, 2, 4, 'T')
  rect(rows, 2, 9, 19, 21, 'T')
}
function buildCaveRidge(rows) {
  rect(rows, 8, 9, 10, 13, '#') // dungeon entrance mouth
  put(rows, 8, 11, '.'); put(rows, 8, 12, '.') // the dark entrance itself
  put(rows, 9, 11, '.'); put(rows, 9, 12, '.') // clear path on through to the south door
  rect(rows, 2, 5, 3, 5, 'T')
}
function buildWestWoods(rows) {
  rect(rows, 2, 4, 9, 14, 'T')
  put(rows, 2, 11, '.'); put(rows, 2, 12, '.') // gap lined up with the north door
  put(rows, 3, 11, '.'); put(rows, 3, 12, '.')
  put(rows, 4, 11, '.'); put(rows, 4, 12, '.')
  rect(rows, 7, 9, 3, 5, 'T')
}
function buildEastShore(rows) {
  rect(rows, 2, 9, 17, 20, 'W')
  rect(rows, 2, 4, 3, 6, 'W')
}
function buildDungeonApproach(rows) {
  // Full interior height so it can't be walked around (the overworld has
  // no top/bottom framing walls like the dungeon rooms do).
  rect(rows, 1, 10, 15, 16, 'B')
}
function buildSouthField(rows) {
  rect(rows, 3, 4, 10, 13, 'T')
}
function buildLakeside(rows) {
  rect(rows, 2, 9, 7, 16, 'W')
  rect(rows, 5, 6, 10, 13, '.')
}

// ── Sword Cave (single room, its own tiny world) ───────────────────────

function buildSwordCave(rows) {
  // A plain little chamber — just the pedestal, nothing to collide with.
  put(rows, 7, 5, '#'); put(rows, 7, 18, '#')
}

// ── Dungeon room builders ──────────────────────────────────────────────

function buildDungeonEntry(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 1, 1, 22)
}
function buildKeyRoom(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 1, 1, 22)
  rect(rows, 4, 5, 10, 13, '#')
  put(rows, 4, 11, '.'); put(rows, 4, 12, '.')
}
function buildCrossroads(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 1, 1, 22)
  // locked-door wall toward the Locked Hall — a few cells clear of the
  // auto-carved right-door opening, floor-to-ceiling so it can't be
  // skirted around.
  rect(rows, 2, 9, 18, 19, 'K')
}
function buildWestHall(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 1, 1, 22)
  rect(rows, 2, 9, 17, 18, 'B')
}
function buildLockedHall(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 1, 1, 22)
}
function buildBossRoom(rows) {
  hline(rows, 10, 1, 22)
  hline(rows, 1, 1, 22)
}

// ── World graphs ─────────────────────────────────────────────────────

const OVERWORLD_ROOMS = [
  { gx: 0, gy: 0, name: 'Forest Grove', biome: 'forest', build: buildForestGrove,
    items: [{ type: 'boomerang', col: 12, row: 5 }],
    enemies: [{ type: 'blob', col: 8, row: 6, minCol: 6, maxCol: 17, minRow: 3, maxRow: 9 }] },
  { gx: 1, gy: 0, name: 'North Field', biome: 'field', build: buildNorthField,
    enemies: [{ type: 'blob', col: 11, row: 6, minCol: 8, maxCol: 15, minRow: 3, maxRow: 9 }] },
  { gx: 2, gy: 0, name: 'Cave Ridge', biome: 'field', build: buildCaveRidge,
    enemies: [{ type: 'pebblefoot', col: 17, row: 4, facing: 'down' }] },
  { gx: 0, gy: 1, name: 'West Woods', biome: 'forest', build: buildWestWoods,
    items: [{ type: 'heart_container', col: 12, row: 6 }],
    enemies: [{ type: 'pebblefoot', col: 17, row: 7, facing: 'left' }] },
  { gx: 1, gy: 1, name: 'Start Meadow', biome: 'field', build: buildStartMeadow, isStart: true },
  { gx: 2, gy: 1, name: 'East Shore', biome: 'shore', build: buildEastShore,
    items: [{ type: 'bow', col: 11, row: 9 }],
    enemies: [{ type: 'bat', col: 10, row: 5, minCol: 6, maxCol: 16, minRow: 2, maxRow: 9 }] },
  { gx: 3, gy: 1, name: 'Dungeon Approach', biome: 'field', build: buildDungeonApproach,
    items: [{ type: 'heart_container', col: 18, row: 5 }],
    enemies: [{ type: 'blob', col: 6, row: 6, minCol: 3, maxCol: 9, minRow: 3, maxRow: 9 }] },
  { gx: 1, gy: 2, name: 'South Field', biome: 'field', build: buildSouthField,
    items: [{ type: 'bombs', col: 12, row: 7 }],
    enemies: [{ type: 'blob', col: 8, row: 7, minCol: 5, maxCol: 18, minRow: 6, maxRow: 9 }] },
  { gx: 2, gy: 2, name: 'Lakeside', biome: 'shore', build: buildLakeside,
    enemies: [{ type: 'pebblefoot', col: 11, row: 6, facing: 'up' }] },
]

const CAVE_ROOMS = [
  { gx: 0, gy: 0, name: "Old Man's Cave", biome: 'dungeon', build: buildSwordCave,
    items: [{ type: 'sword', col: 11, row: 5 }] },
]

const DUNGEON_ROOMS = [
  { gx: 0, gy: 0, name: 'Dungeon Entry', biome: 'dungeon', build: buildDungeonEntry, isStart: true,
    enemies: [{ type: 'skeleton', col: 10, row: 6, minCol: 3, maxCol: 20, minRow: 3, maxRow: 9 }] },
  { gx: 1, gy: 0, name: 'Key Room', biome: 'dungeon', build: buildKeyRoom,
    items: [{ type: 'small_key', col: 11, row: 7 }],
    enemies: [{ type: 'skeleton', col: 15, row: 6, minCol: 3, maxCol: 20, minRow: 6, maxRow: 9 }] },
  { gx: 1, gy: 1, name: 'Crossroads', biome: 'dungeon', build: buildCrossroads,
    enemies: [{ type: 'skeleton', col: 11, row: 6, minCol: 3, maxCol: 16, minRow: 3, maxRow: 9 }] },
  { gx: 0, gy: 1, name: 'West Hall', biome: 'dungeon', build: buildWestHall,
    items: [{ type: 'heart_container', col: 10, row: 6 }],
    enemies: [{ type: 'skeleton', col: 8, row: 6, minCol: 3, maxCol: 15, minRow: 3, maxRow: 9 }] },
  { gx: 2, gy: 1, name: 'Locked Hall', biome: 'dungeon', build: buildLockedHall,
    enemies: [{ type: 'skeleton', col: 12, row: 6, minCol: 3, maxCol: 20, minRow: 3, maxRow: 9 }, { type: 'bat', col: 16, row: 4, minCol: 10, maxCol: 20, minRow: 2, maxRow: 9 }] },
  { gx: 2, gy: 2, name: 'Boss Chamber', biome: 'boss', build: buildBossRoom, isBoss: true },
]

function buildGraph(list) {
  const byKey = {}
  for (const d of list) byKey[`${d.gx},${d.gy}`] = d
  const rooms = {}
  for (const d of list) {
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

export const WORLDS = {
  overworld: buildGraph(OVERWORLD_ROOMS),
  cave: buildGraph(CAVE_ROOMS),
  dungeon: buildGraph(DUNGEON_ROOMS),
}

export const START_WORLD = 'overworld'
export const START_ROOM_KEY = (() => {
  const d = OVERWORLD_ROOMS.find(r => r.isStart)
  return `${d.gx},${d.gy}`
})()

// Point-to-point portals: stepping onto the trigger tile in `from`
// drops the player at the matching spawn point in `to`.
export const PORTALS = [
  {
    fromWorld: 'overworld', fromKey: '1,1', col: 11, row: 9,
    toWorld: 'cave', toKey: '0,0', entryCol: 11, entryRow: 8,
  },
  {
    fromWorld: 'cave', fromKey: '0,0', col: 11, row: 2,
    toWorld: 'overworld', toKey: '1,1', entryCol: 11, entryRow: 8,
  },
  {
    fromWorld: 'overworld', fromKey: '2,0', col: 11, row: 8,
    toWorld: 'dungeon', toKey: '0,0', entryCol: 6, entryRow: 6,
  },
  {
    fromWorld: 'dungeon', fromKey: '0,0', col: 4, row: 6,
    toWorld: 'overworld', toKey: '2,0', entryCol: 11, entryRow: 7,
  },
]

export const TOTAL_ITEMS = [...OVERWORLD_ROOMS, ...CAVE_ROOMS, ...DUNGEON_ROOMS]
  .reduce((n, r) => n + (r.items ? r.items.length : 0), 0)
