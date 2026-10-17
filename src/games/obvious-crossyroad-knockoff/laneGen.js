// ── The Obvious Crossy Road Knockoff — procedural lane generation ─────
// Infinite, one row at a time, generated lazily as the player approaches
// (see ensureLanesTo in engine.js). No seed/replay requirement for an
// endless arcade high-score game, so this just uses Math.random()
// directly rather than carrying a seeded PRNG around.

import {
  COLS, PLAY_W, VEHICLE_SIZE, LOG_SIZE, SAFE_START_ROWS,
  RIVER_UNLOCK_ROW, RAIL_UNLOCK_ROW, DIFFICULTY_CAP_ROW,
} from './constants.js'

function difficultyAt(row) { return Math.min(1, Math.max(0, row / DIFFICULTY_CAP_ROW)) }

function laneWeights(row) {
  const t = difficultyAt(row)
  const w = { grass: 0.5 - 0.12 * t, road: 0.32 + 0.1 * t, river: 0, rail: 0 }
  if (row >= RIVER_UNLOCK_ROW) w.river = 0.14 + 0.05 * t
  if (row >= RAIL_UNLOCK_ROW) w.rail = 0.06 + 0.03 * t
  return w
}

function weightedPick(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [type, w] of entries) { if (r < w) return type; r -= w }
  return entries[entries.length - 1][0]
}

// Obstacles are capped at 2 out of 24 columns, so a lane can never be
// fully blocked (and the player can always sidestep around them) — no
// "is this lane passable" check is needed anywhere else.
function makeGrassLane(row) {
  const obstacles = new Set()
  if (row >= SAFE_START_ROWS) {
    const count = Math.floor(Math.random() * 3) // 0-2 obstacles
    for (let i = 0; i < count; i++) obstacles.add(Math.floor(Math.random() * COLS))
  }
  return { row, type: 'grass', obstacles, decoSeed: Math.random() }
}

// Vehicles/logs live on an infinite conveyor: generated across a span
// wider than the screen, each one wraps to the far side once it fully
// exits the near side, so the stream looks endless without ever
// reallocating the array.
function makeRoadLane(row) {
  const t = difficultyAt(row)
  const dir = Math.random() < 0.5 ? 1 : -1
  const speed = 1.0 + 1.8 * t + Math.random() * 0.6
  const gap = 190 - 60 * t + Math.random() * 70
  const spanWidth = PLAY_W + 600
  const vehicles = []
  for (let x = -200; x < PLAY_W + 200; x += gap) {
    vehicles.push({ x: x + (Math.random() - 0.5) * 30, w: VEHICLE_SIZE.w, colorSeed: Math.random() })
  }
  return { row, type: 'road', dir, speed, vehicles, spanWidth }
}

function makeRiverLane(row) {
  const t = difficultyAt(row)
  const dir = Math.random() < 0.5 ? 1 : -1
  const speed = 0.8 + 1.3 * t + Math.random() * 0.4
  const gap = 130 - 20 * t + Math.random() * 50
  const spanWidth = PLAY_W + 600
  const logs = []
  for (let x = -200; x < PLAY_W + 200; x += gap) {
    logs.push({ x, w: LOG_SIZE.w + Math.random() * 30 - 15 })
  }
  return { row, type: 'river', dir, speed, logs, spanWidth }
}

// phase counts down every frame: positive = safe (with a flashing
// warning once it's within warnFrames of zero), zero-to-negative-
// activeFrames = a train is sweeping the whole lane, then it resets to
// a fresh random wait. See stepRail in engine.js.
function makeRailLane(row) {
  return { row, type: 'rail', phase: 110 + Math.random() * 150, warnFrames: 50, activeFrames: 22 }
}

export function generateLane(row) {
  if (row < SAFE_START_ROWS) return makeGrassLane(row)
  const type = weightedPick(laneWeights(row))
  if (type === 'road') return makeRoadLane(row)
  if (type === 'river') return makeRiverLane(row)
  if (type === 'rail') return makeRailLane(row)
  return makeGrassLane(row)
}
