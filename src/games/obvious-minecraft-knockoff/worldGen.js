// ── The Obvious Minecraft Knockoff — world generation ──────────────────
// Deterministic (seeded) terrain: no cave carving (avoids unreachable-
// pocket bugs), just rolling hills over a strip-mineable stone layer
// with scattered ore veins, trees on the surface, and a solid bedrock
// floor/walls. Everything is derived from pure functions of
// (col, row, seed) so generation is reproducible and easy to test.

import { WORLD_COLS, WORLD_ROWS } from './constants.js'

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return ((h >>> 0) % 1000000) / 1000000
}

export function surfaceRowAt(col, seed) {
  const p1 = seed % 97, p2 = (seed * 7) % 131
  const h = 14
    + 3.2 * Math.sin((col + p1) * 0.045)
    + 1.6 * Math.sin((col + p2) * 0.11 + 1.3)
    + 0.8 * Math.sin(col * 0.21 + 2.1)
  return Math.round(h)
}

function oreAt(col, row, seed, surfaceRow) {
  const depth = row - surfaceRow
  const r = hash(col, row, seed)
  if (depth > 10 && r < 0.012) return 'diamond_ore'
  if (depth > 4 && r < 0.012 + 0.03) return 'iron_ore'
  if (r < 0.012 + 0.03 + 0.06) return 'coal_ore'
  return null
}

export function generateWorld(seed = 1) {
  const rows = []
  for (let r = 0; r < WORLD_ROWS; r++) rows.push(new Array(WORLD_COLS).fill('air'))

  const surfaces = []
  for (let c = 0; c < WORLD_COLS; c++) {
    const s = surfaceRowAt(c, seed)
    surfaces.push(s)
    for (let r = 0; r < WORLD_ROWS; r++) {
      if (r < s) { rows[r][c] = 'air'; continue }
      if (r === s) { rows[r][c] = 'grass'; continue }
      if (r === WORLD_ROWS - 1) { rows[r][c] = 'bedrock'; continue }
      if (r <= s + 4) { rows[r][c] = 'dirt'; continue }
      const ore = oreAt(c, r, seed, s)
      rows[r][c] = ore || 'stone'
    }
    // Side walls are bedrock for a clean, unbreakable boundary.
    if (c === 0 || c === WORLD_COLS - 1) for (let r = 0; r < WORLD_ROWS; r++) rows[r][c] = 'bedrock'
  }

  // Trees: on grass, spaced out, trunk 3-5 tall with a leaf canopy.
  let cooldown = 0
  for (let c = 2; c < WORLD_COLS - 2; c++) {
    if (cooldown > 0) { cooldown--; continue }
    const s = surfaces[c]
    if (hash(c, 0, seed + 999) < 0.16) {
      const trunkH = 3 + Math.floor(hash(c, 1, seed + 999) * 3)
      for (let i = 1; i <= trunkH; i++) {
        const r = s - i
        if (r > 0) rows[r][c] = 'log'
      }
      const topRow = s - trunkH
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = topRow + dr, cc = c + dc
          if (rr < 0 || cc < 1 || cc >= WORLD_COLS - 1) continue
          if (Math.abs(dc) === 2 && dr !== 0) continue
          if (rows[rr][cc] === 'air') rows[rr][cc] = 'leaves'
        }
      }
      cooldown = 3
    }
  }

  return { rows, surfaces }
}

export function findSpawnCol(surfaces) {
  return Math.floor(surfaces.length / 2)
}
