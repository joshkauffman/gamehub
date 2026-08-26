// ── The Obvious Mario Knockoff — shared constants ─────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const TILE = 40
export const GROUND_Y = 460
export const GRAVITY = 0.7
export const JUMP_V = -14.2
export const MOVE_ACCEL = 0.75
export const MAX_SPEED = 4.6
export const FRICTION = 0.78
export const LIVES_START = 3
export const STAR_DURATION = 480
export const FIRE_COOLDOWN = 24
export const SNEAKER_DURATION = 420
export const SNEAKER_SPEED_MULT = 1.6
export const SNEAKER_JUMP_MULT = 1.12
export const CAPE_GLIDE_GRAVITY = 0.12
export const CAPE_GLIDE_MAX_VY = 2.4
export const DOUBLE_JUMP_V = -11.5
export const TONGUE_COOLDOWN = 20
export const TONGUE_DURATION = 14
export const TONGUE_REACH = 46

export const SMALL_SIZE = { w: 30, h: 44 }
export const BIG_SIZE = { w: 32, h: 60 }

// Visual themes per level (all procedural — colors only, no assets).
export const THEMES = {
  overworld: { sky: ['#4ea1e8', '#bfe8ff'], ground: '#8b5a2b', groundTop: '#6dbf3c', hills: true, clouds: true, brick: '#b5652f', block: '#f0a94e', void: '#0a1420' },
  underground: { sky: ['#050510', '#0d0d24'], ground: '#1b3a6b', groundTop: '#2a5aa0', hills: false, clouds: false, brick: '#2a4a8a', block: '#4a7ad0', void: '#000006' },
  sky: { sky: ['#7ec8f0', '#eaf7ff'], ground: '#8a6a42', groundTop: '#5fae6a', hills: false, clouds: true, brick: '#a4824e', block: '#f5c96e', void: '#bfe4ff' },
  castle: { sky: ['#1a0505', '#3a0a0a'], ground: '#3a2020', groundTop: '#7a1818', hills: false, clouds: false, brick: '#6a2a1a', block: '#a04a20', void: '#3a0a00', lava: true },
  // A whole-hub cheat theme (toggled with the H key, see engine.js/render.js)
  // that overrides every course's normal theme, regardless of world.
  horror: { sky: ['#0a0208', '#2a0512'], ground: '#241018', groundTop: '#5c0f1e', hills: false, clouds: true, brick: '#3a1220', block: '#6b1030', void: '#030103', fog: true, fogColor: 'rgba(150,10,60,0.16)' },
}
