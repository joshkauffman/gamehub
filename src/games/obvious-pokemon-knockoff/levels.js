// ── The Obvious Pokémon Knockoff — world map ──────────────────────────
// Same grid-based room system as the other knockoffs: rooms sit on a
// (gx, gy) grid, adjacency (and therefore doors) is derived automatically
// from which cells are occupied, and a short list of point-to-point
// portals handles stepping into a building. Grass tiles mark wild-
// encounter ground; a short TRAINERS list marks the rival and the gym
// leader, the same way PORTALS marks cave mouths.

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

function buildHometown(rows) {
  rect(rows, 3, 5, 9, 14, '#') // the lab building
  put(rows, 5, 11, '.'); put(rows, 5, 12, '.') // lab doorway
  put(rows, 8, 6, 'H') // heal spot
}
function buildRoute1(rows) {
  rect(rows, 2, 5, 5, 9, 'G')
  rect(rows, 7, 9, 14, 19, 'G')
}
function buildCrossroads(rows) {
  rect(rows, 2, 4, 10, 13, '#')
  put(rows, 4, 11, '.'); put(rows, 4, 12, '.')
}
function buildRoute2(rows) {
  rect(rows, 2, 9, 3, 7, 'G')
  rect(rows, 2, 9, 16, 20, 'G')
}
function buildGymTown(rows) {
  rect(rows, 3, 5, 9, 14, '#') // the gym building
  put(rows, 5, 11, '.'); put(rows, 5, 12, '.') // gym doorway
  put(rows, 8, 17, 'H') // heal spot
}
function buildSouthPath(rows) {
  rect(rows, 2, 5, 4, 8, 'G')
  rect(rows, 7, 9, 15, 20, 'G')
}
function buildLakeshore(rows) {
  rect(rows, 2, 8, 5, 10, 'G')
  rect(rows, 3, 9, 13, 19, 'G')
}
function buildRoute3(rows) {
  rect(rows, 2, 9, 3, 7, 'G')
  rect(rows, 2, 9, 16, 20, 'G')
}
function buildPortTown(rows) {
  rect(rows, 3, 5, 9, 14, '#') // the cave-mouth building
  put(rows, 5, 11, '.'); put(rows, 5, 12, '.') // doorway
  put(rows, 8, 6, 'H') // heal spot
}

// ── Lab and Gym (single-room worlds) ───────────────────────────────────

function buildLab(rows) {
  put(rows, 7, 4, '#'); put(rows, 7, 19, '#')
}
function buildGym(rows) {
  rect(rows, 4, 7, 4, 6, '#')
  rect(rows, 4, 7, 17, 19, '#')
}

// ── Dusk Cave ───────────────────────────────────────────────────────────

function buildCaveEntrance(rows) {
  rect(rows, 3, 8, 9, 14, 'G')
}
function buildCaveDepths(rows) {
  rect(rows, 2, 9, 3, 8, 'G')
  rect(rows, 2, 9, 15, 20, 'G')
}
function buildCaveEnd(rows) {
  rect(rows, 3, 8, 8, 15, 'G')
}

// ── World graphs ─────────────────────────────────────────────────────

const OVERWORLD_ROOMS = [
  { gx: 0, gy: 0, name: 'Hometown', biome: 'town', build: buildHometown, isStart: true },
  { gx: 1, gy: 0, name: 'Route 1', biome: 'route', build: buildRoute1,
    wild: [{ speciesId: 'fluttermoth', weight: 3 }, { speciesId: 'pebblet', weight: 2 }] },
  { gx: 2, gy: 0, name: 'Crossroads', biome: 'town', build: buildCrossroads },
  { gx: 3, gy: 0, name: 'Route 2', biome: 'route', build: buildRoute2,
    wild: [{ speciesId: 'puddlit', weight: 3 }, { speciesId: 'rockling', weight: 2 }] },
  { gx: 4, gy: 0, name: 'Gym Town', biome: 'town', build: buildGymTown },
  { gx: 5, gy: 0, name: 'Route 3', biome: 'route', build: buildRoute3,
    wild: [{ speciesId: 'sandnap', weight: 3 }, { speciesId: 'pebblet', weight: 2 }] },
  { gx: 6, gy: 0, name: 'Port Town', biome: 'town', build: buildPortTown },
  { gx: 2, gy: 1, name: 'South Path', biome: 'route', build: buildSouthPath,
    wild: [{ speciesId: 'leaflen', weight: 3 }, { speciesId: 'fluttermoth', weight: 2 }] },
  { gx: 2, gy: 2, name: 'Lakeshore', biome: 'shore', build: buildLakeshore,
    wild: [{ speciesId: 'driftkit', weight: 3 }, { speciesId: 'puddlit', weight: 2 }] },
]

const LAB_ROOMS = [
  { gx: 0, gy: 0, name: 'Research Lab', biome: 'indoor', build: buildLab },
]

const GYM_ROOMS = [
  { gx: 0, gy: 0, name: 'Gym', biome: 'indoor', build: buildGym },
]

const CAVE_ROOMS = [
  { gx: 0, gy: 0, name: 'Cave Entrance', biome: 'cave', build: buildCaveEntrance,
    wild: [{ speciesId: 'cindermite', weight: 3 }, { speciesId: 'glowgrub', weight: 2 }] },
  { gx: 1, gy: 0, name: 'Cave Depths', biome: 'cave', build: buildCaveDepths,
    wild: [{ speciesId: 'cindermite', weight: 2 }, { speciesId: 'glowgrub', weight: 3 }] },
  { gx: 2, gy: 0, name: 'Cave End', biome: 'cave', build: buildCaveEnd,
    wild: [{ speciesId: 'embergeist', weight: 1 }] },
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
      wild: d.wild || [], isStart: !!d.isStart,
    }
  }
  return rooms
}

export const WORLDS = {
  overworld: buildGraph(OVERWORLD_ROOMS),
  lab: buildGraph(LAB_ROOMS),
  gym: buildGraph(GYM_ROOMS),
  cave: buildGraph(CAVE_ROOMS),
}

export const START_WORLD = 'overworld'
export const START_ROOM_KEY = (() => {
  const d = OVERWORLD_ROOMS.find(r => r.isStart)
  return `${d.gx},${d.gy}`
})()

// Point-to-point portals, same idea as The Obvious Zelda Knockoff.
// Entry points are kept at least two rows clear of the trigger that
// leads back the other way — close enough (e.g. one row) and holding
// the same direction key for a few more frames after arriving walks
// you straight back through it, ping-ponging between the two rooms.
export const PORTALS = [
  { fromWorld: 'overworld', fromKey: '0,0', col: 11, row: 5, toWorld: 'lab', toKey: '0,0', entryCol: 11, entryRow: 8 },
  { fromWorld: 'lab', fromKey: '0,0', col: 11, row: 2, toWorld: 'overworld', toKey: '0,0', entryCol: 11, entryRow: 7 },
  { fromWorld: 'overworld', fromKey: '4,0', col: 11, row: 5, toWorld: 'gym', toKey: '0,0', entryCol: 11, entryRow: 8 },
  { fromWorld: 'gym', fromKey: '0,0', col: 11, row: 2, toWorld: 'overworld', toKey: '4,0', entryCol: 11, entryRow: 7 },
  { fromWorld: 'overworld', fromKey: '6,0', col: 11, row: 5, toWorld: 'cave', toKey: '0,0', entryCol: 11, entryRow: 8 },
  { fromWorld: 'cave', fromKey: '0,0', col: 11, row: 2, toWorld: 'overworld', toKey: '6,0', entryCol: 11, entryRow: 7 },
]

// Fixed trainer encounters — stepping onto one starts a trainer battle
// (once per game; see state.defeatedTrainers).
export const TRAINERS = [
  { id: 'rival', world: 'overworld', roomKey: '3,0', col: 11, row: 4, name: 'Rival', speciesId: 'rivalstarter', reward: 150 },
  { id: 'angler', world: 'overworld', roomKey: '2,1', col: 11, row: 4, name: 'Angler', speciesId: 'anglerace', reward: 120 },
  { id: 'gymleader', world: 'gym', roomKey: '0,0', col: 11, row: 5, name: 'Gym Leader', speciesId: 'magmadon', reward: 1000, isBoss: true },
]

export const STARTER_ORBS = [
  { speciesId: 'charbit', col: 9, row: 7 },
  { speciesId: 'sproutling', col: 12, row: 7 },
  { speciesId: 'dampup', col: 15, row: 7 },
]
