// ── The Obvious Portal Knockoff — test chambers ───────────────────────
// Tile legend: '.' empty, '#' solid (not portal-able), 'P' solid and
// portal-able, 'D' a door (solid until its linked button is pressed).
// Buttons and the goal are separate marker lists, not tiles, since
// they're triggers rather than geometry.

import { COLS, ROWS } from './constants.js'

function blank(fill = '.') {
  const rows = []
  for (let r = 0; r < ROWS; r++) rows.push(new Array(COLS).fill(fill))
  for (let c = 0; c < COLS; c++) { rows[0][c] = '#'; rows[ROWS - 1][c] = '#' }
  for (let r = 0; r < ROWS; r++) { rows[r][0] = '#'; rows[r][COLS - 1] = '#' }
  return rows
}
function hline(rows, r, c0, c1, ch) { for (let c = c0; c <= c1; c++) rows[r][c] = ch }
function rect(rows, r0, r1, c0, c1, ch) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) rows[r][c] = ch }
// Builds a door's "cells to clear when opened" list from the exact
// same bounds used to carve it with rect() — hand-transcribing a
// separate list invites a mismatch where part of the door never opens.
function doorCells(r0, r1, c0, c1) {
  const cells = []
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells.push([r, c])
  return cells
}

// ── Chamber 1 — First Steps ─────────────────────────────────────────
// A gap in the floor. Shoot a portal where you stand and one on the
// far floor (both floors are portal-able, and nothing blocks the view
// across the open gap), then walk into the near one.
function chamber1() {
  const rows = blank()
  hline(rows, 10, 1, 9, 'P')
  hline(rows, 10, 15, 22, 'P')
  return {
    id: 'first-steps', name: 'First Steps', rows,
    playerStart: { col: 3, row: 9 },
    goal: { col: 20, row: 9 },
    cubes: [], buttons: [], doors: [],
  }
}

// ── Chamber 2 — Up and Over ──────────────────────────────────────────
// The goal sits on a high ledge with nothing but open air beneath the
// ceiling above it. Shoot the ceiling (straight up) and the floor
// (straight down) from the start, then walk into the floor portal —
// you'll drop out of the ceiling portal and land right on the ledge.
function chamber2() {
  const rows = blank()
  hline(rows, 10, 1, 22, '#')
  rows[10][3] = 'P'
  rect(rows, 3, 3, 13, 18, '#') // the high ledge itself
  hline(rows, 0, 13, 18, 'P') // ceiling notch spans the full ledge width — generous aiming margin
  return {
    id: 'up-and-over', name: 'Up and Over', rows,
    playerStart: { col: 3, row: 9 },
    goal: { col: 15, row: 2 },
    cubes: [], buttons: [], doors: [],
  }
}

// ── Chamber 3 — Weighted Problem ─────────────────────────────────────
// A Weighted Something-or-Other sits on an isolated high shelf, out of
// reach. Shoot a portal into the shelf's underside to drop it to the
// main floor, then push it over onto the pressure plate to open the
// door blocking the goal. (Not a portal-drop-onto-the-plate puzzle —
// a floor-exit teleport carries no horizontal drift, so anything
// popping out of one just falls straight back into the same hole.
// Getting the cube down and then pushing it the rest of the way is
// both the more reliable mechanic and the more obvious one.)
function chamber3() {
  const rows = blank()
  hline(rows, 10, 1, 22, '#')
  rect(rows, 3, 3, 3, 6, '#')   // the cube's shelf
  rows[3][5] = 'P'              // portal spot under the cube
  rect(rows, 6, 9, 18, 19, 'D') // door blocking the goal — stops above the floor row so opening it
  return {
    id: 'weighted-problem', name: 'Weighted Problem', rows,
    playerStart: { col: 2, row: 9 },
    goal: { col: 21, row: 9 },
    cubes: [{ col: 5, row: 2 }],
    buttons: [{ col: 10, row: 10, doorId: 'd1' }],
    doors: [{ id: 'd1', cells: doorCells(6, 9, 18, 19) }],
  }
}

// ── Chamber 4 — Two Problems ──────────────────────────────────────────
// Combines both ideas: drop the cube from its shelf and push it onto
// the plate to open door 1, then use a floor/ceiling portal pair of
// your own to reach the high ledge the real goal sits on.
function chamber4() {
  const rows = blank()
  hline(rows, 10, 1, 22, '#')
  rect(rows, 3, 3, 2, 4, '#')    // cube shelf
  rows[3][3] = 'P'
  rect(rows, 6, 9, 10, 11, 'D') // door 1 — stops above the floor row
  hline(rows, 0, 15, 19, 'P')    // ceiling notch — spans the full ledge width for aiming margin
  rect(rows, 3, 3, 15, 19, '#')  // high ledge behind door 1
  rows[10][13] = 'P'             // floor portal to launch the player up to the ledge
  return {
    id: 'two-problems', name: 'Two Problems', rows,
    playerStart: { col: 2, row: 9 },
    goal: { col: 17, row: 2 },
    cubes: [{ col: 3, row: 2 }],
    buttons: [{ col: 6, row: 10, doorId: 'd1' }],
    doors: [{ id: 'd1', cells: doorCells(6, 9, 10, 11) }],
  }
}

export const CHAMBERS = [chamber1(), chamber2(), chamber3(), chamber4()]
export function chamberById(id) { return CHAMBERS.find(c => c.id === id) }
