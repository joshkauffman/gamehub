// ── The Obvious Donkey Kong Knockoff — stage layouts ───────────────────
// Each stage is a single static screen: a stack of flat girders
// connected by ladders. Girders are deliberately flat (not sloped) —
// collision stays simple tile-top landing, and the "diagonal girder"
// look is purely a render.js flourish, not real slope physics. That
// keeps barrel/player physics in exactly one well-tested code path.

import { COLS, ROWS } from './constants.js'

function blank() {
  const rows = []
  for (let r = 0; r < ROWS; r++) rows.push(new Array(COLS).fill('.'))
  return rows
}
function girder(rows, r, c0, c1) { for (let c = c0; c <= c1; c++) rows[r][c] = '#' }
// Connects two girder rows with a climbable ladder — the cells at the
// girder rows themselves become 'X' (solid AND climbable) so stepping
// onto a ladder from a girder, or off a ladder onto one, is seamless.
function ladder(rows, col, rTop, rBottom) {
  for (let r = rTop; r <= rBottom; r++) {
    rows[r][col] = rows[r][col] === '#' ? 'X' : 'L'
  }
}

// ── Stage 1 — Girders ──────────────────────────────────────────────
function stage1() {
  const rows = blank()
  const girderRows = [18, 15, 12, 9, 6, 3]
  for (const r of girderRows) girder(rows, r, 0, 39)
  ladder(rows, 8, 15, 18)
  ladder(rows, 30, 12, 15)
  ladder(rows, 8, 9, 12)
  ladder(rows, 30, 6, 9)
  ladder(rows, 19, 3, 6)
  return {
    id: 'girders', name: 'Girders', rows,
    playerStart: { col: 3, row: 18 },
    ape: { col: 6, row: 3 },
    goal: { col: 33, row: 3 },
    hammers: [{ col: 20, row: 12 }, { col: 20, row: 6 }],
    rivets: [],
    barrelSpawn: { col: 8, row: 3 },
    barrelInterval: 150,
    // Each girder's designated drop point, reusing that level's own
    // ladder column — barrels roll toward it and fall through there to
    // the girder below. Girders are solid all the way across (no
    // physical gap), so this is a scripted trigger, not a hole in the
    // floor: it keeps "where does a barrel land" fully deterministic
    // instead of depending on exactly where rolling happened to drift.
    chutes: [{ row: 3, col: 19 }, { row: 6, col: 30 }, { row: 9, col: 8 }, { row: 12, col: 30 }, { row: 15, col: 8 }],
  }
}

// ── Stage 2 — The Shaft ─────────────────────────────────────────────
// Two parallel ladder lanes the whole way up, so there's always a
// second route to dodge a barrel — and barrels drop more often.
function stage2() {
  const rows = blank()
  const girderRows = [18, 15, 12, 9, 6, 3]
  for (const r of girderRows) girder(rows, r, 0, 39)
  for (let i = 0; i < girderRows.length - 1; i++) {
    const rBottom = girderRows[i], rTop = girderRows[i + 1]
    ladder(rows, 6, rTop, rBottom)
    ladder(rows, 32, rTop, rBottom)
  }
  return {
    id: 'the-shaft', name: 'The Shaft', rows,
    playerStart: { col: 3, row: 18 },
    ape: { col: 10, row: 3 },
    goal: { col: 28, row: 3 },
    hammers: [{ col: 19, row: 15 }, { col: 19, row: 9 }],
    rivets: [],
    barrelSpawn: { col: 10, row: 3 },
    barrelInterval: 100,
    chutes: [{ row: 3, col: 6 }, { row: 6, col: 32 }, { row: 9, col: 6 }, { row: 12, col: 32 }, { row: 15, col: 6 }],
  }
}

// ── Stage 3 — Rivets ────────────────────────────────────────────────
// No goal tile — clear every rivet across all six girders and the
// stage ends, same as the arcade's final board.
function stage3() {
  const rows = blank()
  const girderRows = [18, 15, 12, 9, 6, 3]
  for (const r of girderRows) girder(rows, r, 0, 39)
  ladder(rows, 8, 15, 18)
  ladder(rows, 30, 12, 15)
  ladder(rows, 8, 9, 12)
  ladder(rows, 30, 6, 9)
  ladder(rows, 19, 3, 6)
  const rivets = []
  for (const r of girderRows) { rivets.push({ col: 14, row: r }); rivets.push({ col: 26, row: r }) }
  return {
    id: 'rivets', name: 'Rivets', rows,
    playerStart: { col: 3, row: 18 },
    ape: { col: 6, row: 3 },
    goal: null,
    hammers: [{ col: 20, row: 9 }],
    rivets,
    barrelSpawn: { col: 8, row: 3 },
    barrelInterval: 150,
    chutes: [{ row: 3, col: 19 }, { row: 6, col: 30 }, { row: 9, col: 8 }, { row: 12, col: 30 }, { row: 15, col: 8 }],
  }
}

export const STAGES = [stage1(), stage2(), stage3()]
