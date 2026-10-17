// ── Capeville — the city itself ────────────────────────────────────────
// A simple procedural city grid: each cell is either a building block
// (inset from the cell bounds, leaving road on all sides) or an open
// park. Crime scenes (a villain menacing a citizen) sit at a handful of
// road intersections, far enough from buildings to never spawn inside
// one.

import { CITY_W, CITY_H } from './constants.js'

const COLS = 6, ROWS = 4
const CELL_W = CITY_W / COLS, CELL_H = CITY_H / ROWS
const MARGIN = 58

// Cells marked here are parks instead of buildings (row*COLS+col).
const PARK_CELLS = new Set([2, 9, 14, 20])

function buildBlocks() {
  const buildings = []
  const parks = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c
      const x = c * CELL_W, y = r * CELL_H
      const bx = x + MARGIN, by = y + MARGIN, bw = CELL_W - MARGIN * 2, bh = CELL_H - MARGIN * 2
      if (PARK_CELLS.has(idx)) {
        parks.push({ x: bx, y: by, w: bw, h: bh })
      } else {
        // A little size/height variance so the skyline isn't a grid of
        // identical boxes.
        const shrink = (idx % 3) * 10
        const stories = 3 + (idx % 5)
        buildings.push({ x: bx + shrink / 2, y: by + shrink / 2, w: bw - shrink, h: bh - shrink, stories })
      }
    }
  }
  return { buildings, parks }
}

export const { buildings: BUILDINGS, parks: PARKS } = buildBlocks()

function cellCenter(col, row) { return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 } }

// Crime scenes sit at open park cells and a few road intersections —
// always well clear of building footprints.
export const CRIME_SCENES = [
  { ...cellCenter(2, 0), id: 'cs1' },
  { x: 1 * CELL_W, y: 2 * CELL_H, id: 'cs2' }, // road intersection, not a cell center — avoids landing inside a building block
  { ...cellCenter(3, 1), id: 'cs3' },
  { x: 5 * CELL_W, y: 2 * CELL_H, id: 'cs4' }, // road intersection, right edge
  { x: 2 * CELL_W, y: 4 * CELL_H - 10, id: 'cs5' },
  { ...cellCenter(2, 2), id: 'cs6' },
  // y:90 (not 0) — the villain sprite draws 60px above this marker, so
  // anything closer than that to the top edge spawns the villain at a
  // negative y the player (clamped to y >= 0) can never reach.
  { x: 3 * CELL_W, y: 90, id: 'cs7' },
]

// Heavy props a Super Strength hero can hoist and throw, scattered
// along the roads.
export const PROPS = [
  { x: 1 * CELL_W, y: 1 * CELL_H, kind: 'car' },
  { x: 4 * CELL_W, y: 3 * CELL_H, kind: 'car' },
  { x: 5 * CELL_W, y: 0 * CELL_H + 30, kind: 'dumpster' },
  { x: 1 * CELL_W, y: 3 * CELL_H, kind: 'dumpster' },
]

// Park cell at (col 2, row 3) — the one park not already hosting a
// crime scene — so the hero never spawns on top of trouble.
export const HQ_SPAWN = cellCenter(2, 3)
