// ── The Obvious Minecraft Knockoff (3D beta) — voxel world core ───────
// Pure data + math, no Three.js, no rendering — a flat typed-array
// voxel grid, deterministic terrain generation, a DDA voxel raycast
// (for mining/placing), and a face-culled mesh-data builder (plain
// typed arrays a renderer feeds straight into a BufferGeometry). All
// of this is testable headlessly with plain objects.

export const SIZE_X = 64
export const SIZE_Y = 28
export const SIZE_Z = 64
export const BASE_HEIGHT = 12

export const BLOCK = {
  AIR: 0, BEDROCK: 1, STONE: 2, DIRT: 3, GRASS: 4, LOG: 5, LEAVES: 6,
  COAL_ORE: 7, IRON_ORE: 8, DIAMOND_ORE: 9, PLANKS: 10, FURNACE: 11,
}
export const BLOCK_NAMES = {
  1: 'bedrock', 2: 'stone', 3: 'dirt', 4: 'grass', 5: 'log', 6: 'leaves',
  7: 'coal_ore', 8: 'iron_ore', 9: 'diamond_ore', 10: 'planks', 11: 'furnace',
}

// What mining a block gives you (an item id, not a block id — ores
// drop their raw material, grass drops dirt, like real Minecraft;
// bedrock never breaks). See items.js for what these item ids mean.
export const BLOCK_DROP = {
  [BLOCK.STONE]: 'stone',
  [BLOCK.DIRT]: 'dirt',
  [BLOCK.GRASS]: 'dirt',
  [BLOCK.LOG]: 'log',
  [BLOCK.LEAVES]: 'leaves',
  [BLOCK.COAL_ORE]: 'coal',
  [BLOCK.IRON_ORE]: 'iron_ore',
  [BLOCK.DIAMOND_ORE]: 'diamond',
  [BLOCK.PLANKS]: 'planks',
  [BLOCK.FURNACE]: 'furnace',
}

// Minimum pickaxe tier (see items.js TOOL_TIERS) needed to actually
// get a drop from this block; mining with too weak a tool still
// breaks the block, it just gives nothing. Anything not listed needs
// no tool at all (dirt, grass, leaves, wood, planks, furnace, ...).
export const BLOCK_REQUIRED_TIER = {
  [BLOCK.STONE]: 1,
  [BLOCK.COAL_ORE]: 1,
  [BLOCK.IRON_ORE]: 2,
  [BLOCK.DIAMOND_ORE]: 3,
}

// Base seconds to mine with a bare hand (tier-0); actual time is this
// divided by the active tool's mining speed multiplier.
export const BLOCK_HARDNESS = {
  [BLOCK.STONE]: 1.3,
  [BLOCK.DIRT]: 0.5,
  [BLOCK.GRASS]: 0.5,
  [BLOCK.LOG]: 0.8,
  [BLOCK.LEAVES]: 0.25,
  [BLOCK.COAL_ORE]: 1.6,
  [BLOCK.IRON_ORE]: 2.2,
  [BLOCK.DIAMOND_ORE]: 3.2,
  [BLOCK.PLANKS]: 0.7,
  [BLOCK.FURNACE]: 1.6,
}

// Per-face flat colors (top/side/bottom) for the handful of block
// types whose faces actually differ; everything else uses `all`.
export const BLOCK_COLOR = {
  [BLOCK.BEDROCK]: { all: 0x1b1b22 },
  [BLOCK.STONE]: { all: 0x8a8a92 },
  [BLOCK.DIRT]: { all: 0x7a5433 },
  [BLOCK.GRASS]: { top: 0x6fcf4a, side: 0x6a8a46, bottom: 0x7a5433 },
  [BLOCK.LOG]: { top: 0x9a7a4a, side: 0x6b4a2a, bottom: 0x9a7a4a },
  [BLOCK.LEAVES]: { all: 0x3d8a3d },
  [BLOCK.COAL_ORE]: { all: 0x4a4a52 },
  [BLOCK.IRON_ORE]: { all: 0xc4a383 },
  [BLOCK.DIAMOND_ORE]: { all: 0x6fe0e8 },
  [BLOCK.PLANKS]: { all: 0xb08552 },
  [BLOCK.FURNACE]: { top: 0x55555d, side: 0x6a6a72, bottom: 0x55555d },
}

export function colorFor(blockId, faceName) {
  const c = BLOCK_COLOR[blockId]
  if (!c) return 0xff00ff // unmistakably wrong if this ever happens
  if (c.all != null) return c.all
  if (faceName === 'py') return c.top
  if (faceName === 'ny') return c.bottom
  return c.side
}

export function inBounds(x, y, z) {
  return x >= 0 && x < SIZE_X && y >= 0 && y < SIZE_Y && z >= 0 && z < SIZE_Z
}

function idx(x, y, z) {
  return (y * SIZE_Z + z) * SIZE_X + x
}

export function createWorld() {
  return { sizeX: SIZE_X, sizeY: SIZE_Y, sizeZ: SIZE_Z, blocks: new Uint8Array(SIZE_X * SIZE_Y * SIZE_Z) }
}

export function getBlock(world, x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z)
  if (!inBounds(x, y, z)) return BLOCK.AIR
  return world.blocks[idx(x, y, z)]
}

export function setBlock(world, x, y, z, id) {
  if (!inBounds(x, y, z)) return false
  world.blocks[idx(x, y, z)] = id
  return true
}

export function isSolid(blockId) { return blockId !== BLOCK.AIR }

// Smooth, deterministic rolling hills — a few layered sine/cosine
// waves at irrational-ish frequencies rather than a noise library.
export function heightAt(x, z, seed = 0) {
  const n =
    Math.sin((x + seed) * 0.12) * Math.cos((z - seed) * 0.1) * 2.4 +
    Math.sin((x - seed * 2) * 0.052 + 1.7) * Math.cos((z + seed) * 0.071) * 1.6 +
    Math.sin((x * 0.31 + z * 0.19 + seed) * 0.9) * 0.5
  return Math.round(BASE_HEIGHT + n)
}

// Deterministic 0..1 pseudo-random per integer column, used for tree
// placement so generation never depends on Math.random().
function hashColumn(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 2246822519) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return ((h >>> 0) % 100000) / 100000
}

// Same idea, one more dimension — used to sprinkle ore through stone.
function hash3D(x, y, z, seed) {
  let h = (x * 374761393 + y * 974786049 + z * 668265263 + seed * 2246822519) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return ((h >>> 0) % 100000) / 100000
}

// Independent per-block chance rather than real vein/blob clustering
// — coal is common throughout the stone layer, iron more common deep,
// diamond rare and only near bedrock. Simple, not authentic-looking
// clusters, but gives real mining progression. Each ore gets its own
// independent roll (different hash offset) rather than sharing one
// random value sliced into bands — carving diamond's and iron's
// slices out of a single shared roll would (and in an earlier version
// of this function, did) make coal, the one meant to be most common,
// actually the rarest, since higher-priority checks ran first and
// silently consumed part of its share.
function oreAt(x, y, z, seed) {
  if (y <= 4 && hash3D(x, y, z, seed + 101) < 0.012) return BLOCK.DIAMOND_ORE
  if (y <= 14 && hash3D(x, y, z, seed + 202) < 0.022) return BLOCK.IRON_ORE
  if (hash3D(x, y, z, seed + 303) < 0.05) return BLOCK.COAL_ORE
  return BLOCK.STONE
}

export function generateTerrain(world, seed = 1337) {
  const treeSpots = []
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      const h = Math.min(SIZE_Y - 6, heightAt(x, z, seed))
      setBlock(world, x, 0, z, BLOCK.BEDROCK)
      for (let y = 1; y < h - 2; y++) setBlock(world, x, y, z, oreAt(x, y, z, seed))
      for (let y = Math.max(1, h - 2); y < h; y++) setBlock(world, x, y, z, BLOCK.DIRT)
      setBlock(world, x, h, z, BLOCK.GRASS)

      if (x >= 3 && x < SIZE_X - 3 && z >= 3 && z < SIZE_Z - 3 && hashColumn(x, z, seed) < 0.02) {
        const tooClose = treeSpots.some(t => Math.abs(t.x - x) <= 2 && Math.abs(t.z - z) <= 2)
        if (!tooClose) treeSpots.push({ x, z, h })
      }
    }
  }

  for (const t of treeSpots) {
    const trunkH = 4 + Math.floor(hashColumn(t.x, t.z, seed + 1) * 2)
    for (let i = 1; i <= trunkH; i++) setBlock(world, t.x, t.h + i, t.z, BLOCK.LOG)
    const canopyY = t.h + trunkH
    for (let dy = -1; dy <= 1; dy++) {
      const ringRadius = dy === 1 ? 1 : 2
      for (let dx = -ringRadius; dx <= ringRadius; dx++) {
        for (let dz = -ringRadius; dz <= ringRadius; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue // leave the trunk/top visible
          if (Math.abs(dx) === ringRadius && Math.abs(dz) === ringRadius && ringRadius === 2) continue // round the corners
          setBlock(world, t.x + dx, canopyY + dy, t.z + dz, BLOCK.LEAVES)
        }
      }
    }
  }
  return world
}

// ── DDA voxel raycast (Amanatides & Woo) ───────────────────────────
// origin/dir: {x,y,z} (dir need not be normalized). Returns either
// { hit:false } or { hit:true, x,y,z (the hit block), normal:{x,y,z}
// (points away from the hit block, toward where a new block would be
// placed), distance }.
export function raycastVoxels(world, origin, dir, maxDist) {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z)
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0

  const tMaxAxis = (o, d, v, step) => {
    if (d === 0) return Infinity
    const boundary = step > 0 ? v + 1 : v
    return (boundary - o) / d
  }
  const tDeltaAxis = d => (d === 0 ? Infinity : Math.abs(1 / d))

  let tMaxX = tMaxAxis(origin.x, dx, x, stepX)
  let tMaxY = tMaxAxis(origin.y, dy, y, stepY)
  let tMaxZ = tMaxAxis(origin.z, dz, z, stepZ)
  const tDeltaX = tDeltaAxis(dx), tDeltaY = tDeltaAxis(dy), tDeltaZ = tDeltaAxis(dz)

  let normal = { x: 0, y: 0, z: 0 }
  let dist = 0
  let guard = 0
  while (dist <= maxDist && guard++ < 4096) {
    if (isSolid(getBlock(world, x, y, z))) {
      return { hit: true, x, y, z, normal, distance: dist }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; dist = tMaxX; tMaxX += tDeltaX; normal = { x: -stepX, y: 0, z: 0 }
    } else if (tMaxY < tMaxZ) {
      y += stepY; dist = tMaxY; tMaxY += tDeltaY; normal = { x: 0, y: -stepY, z: 0 }
    } else {
      z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; normal = { x: 0, y: 0, z: -stepZ }
    }
  }
  return { hit: false }
}

// ── face-culled mesh data ───────────────────────────────────────────
// For each of the 6 axis directions: a unit normal and two basis
// vectors (u, v) with u×v === normal, so the generated quad winds
// correctly for Three.js's default (CCW = front-facing) convention —
// verified directly in voxelWorld.test.mjs rather than just asserted
// here.
const FACES = [
  { name: 'px', normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { name: 'nx', normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { name: 'py', normal: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { name: 'ny', normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { name: 'pz', normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { name: 'nz', normal: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
]

function hexToRgb01(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

// Returns plain arrays (not typed yet — the caller/tests can wrap
// them) of positions/normals/colors (3 per vertex) and indices (6 per
// face, two triangles).
export function buildMeshData(world) {
  const positions = []
  const normals = []
  const colors = []
  const indices = []
  let vertCount = 0

  for (let y = 0; y < world.sizeY; y++) {
    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        const block = getBlock(world, x, y, z)
        if (!isSolid(block)) continue
        for (const face of FACES) {
          const [nx, ny, nz] = face.normal
          if (isSolid(getBlock(world, x + nx, y + ny, z + nz))) continue // buried face

          const cx = x + 0.5 + nx * 0.5
          const cy = y + 0.5 + ny * 0.5
          const cz = z + 0.5 + nz * 0.5
          const [ux, uy, uz] = face.u
          const [vx, vy, vz] = face.v
          const corners = [
            [cx - ux / 2 - vx / 2, cy - uy / 2 - vy / 2, cz - uz / 2 - vz / 2],
            [cx + ux / 2 - vx / 2, cy + uy / 2 - vy / 2, cz + uz / 2 - vz / 2],
            [cx + ux / 2 + vx / 2, cy + uy / 2 + vy / 2, cz + uz / 2 + vz / 2],
            [cx - ux / 2 + vx / 2, cy - uy / 2 + vy / 2, cz - uz / 2 + vz / 2],
          ]
          const [r, g, b] = hexToRgb01(colorFor(block, face.name))
          for (const [px, py, pz] of corners) {
            positions.push(px, py, pz)
            normals.push(nx, ny, nz)
            colors.push(r, g, b)
          }
          indices.push(vertCount, vertCount + 1, vertCount + 2, vertCount, vertCount + 2, vertCount + 3)
          vertCount += 4
        }
      }
    }
  }
  return { positions, normals, colors, indices, faceCount: indices.length / 6 }
}

// A minimal, cheap collision check: true if any corner of the
// player's feet-to-head box sits inside a solid block. Good enough
// for simple axis-separated movement resolution, not a full physics
// engine.
export function collidesBox(world, cx, cy, cz, halfW, height) {
  const xs = [cx - halfW, cx + halfW]
  const zs = [cz - halfW, cz + halfW]
  const ys = [cy + 0.02, cy + height - 0.02]
  for (const x of xs) {
    for (const z of zs) {
      for (const y of ys) {
        if (isSolid(getBlock(world, x, y, z))) return true
      }
    }
  }
  return false
}

// Highest solid-block top surface the (x,z) column occupies at or
// below `fromY` — used to snap the player onto the ground.
export function groundHeightBelow(world, x, z, fromY) {
  let y = Math.min(world.sizeY - 1, Math.floor(fromY))
  while (y >= 0 && !isSolid(getBlock(world, x, y, z))) y--
  return y + 1
}

// Horizontal movement by (dx, dz), resolved per axis against
// collidesBox — but if an axis is blocked at the player's current
// height by a ledge no taller than `stepHeight`, step up onto it
// instead of just stopping dead. Without this, hilly/wavy terrain
// (which isn't perfectly monotonic — a generally-downhill slope can
// still have small 1-block bumps) traps the player on the very first
// ledge in their path, in either direction. Returns a new {x,y,z}; y
// only changes when a step actually happened — the caller's normal
// gravity/ground-snap logic settles the exact resting height.
export function moveWithStep(world, player, dx, dz, halfW, height, stepHeight) {
  let { x, y, z } = player
  if (dx !== 0) {
    if (!collidesBox(world, x + dx, y, z, halfW, height)) {
      x += dx
    } else if (!collidesBox(world, x + dx, y + stepHeight, z, halfW, height)) {
      x += dx
      y += stepHeight
    }
  }
  if (dz !== 0) {
    if (!collidesBox(world, x, y, z + dz, halfW, height)) {
      z += dz
    } else if (!collidesBox(world, x, y + stepHeight, z + dz, halfW, height)) {
      z += dz
      y += stepHeight
    }
  }
  return { x, y, z }
}

// Is there a block of the given type within `range` (Euclidean,
// block-center distance) of (x,y,z)? Used for "are you near a
// furnace" — a small bounded sphere scan, cheap enough to call
// whenever the crafting menu is open, not every frame.
export function isBlockNearby(world, x, y, z, blockId, range) {
  const r = Math.ceil(range)
  const r2 = range * range
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z)
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz > r2) continue
        if (getBlock(world, bx + dx, by + dy, bz + dz) === blockId) return true
      }
    }
  }
  return false
}
