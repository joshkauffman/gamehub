// ── The Obvious Metroid Knockoff — shared constants ───────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 60
export const PLAY_X0 = 0, PLAY_Y0 = HUD_H
export const TILE = 40
export const COLS = 24, ROWS = 12
export const PLAY_W = COLS * TILE, PLAY_H = ROWS * TILE

// Door slots, standardized across every room so the world-builder can
// auto-carve connections from grid adjacency alone (see levels.js).
export const DOOR_ROWS = [7, 8, 9]   // left/right doors: 3 tiles tall, floor-level
export const DOOR_COLS = [11, 12]    // up/down doors: 2 tiles wide, centered

export const GRAVITY = 0.62
export const JUMP_V = -13.6
export const HIGH_JUMP_MULT = 1.4
export const MOVE_ACCEL = 0.85
export const MAX_SPEED = 4.0
export const FRICTION = 0.82
export const MORPH_SPEED_MULT = 1.15

export const SPEED_BOOST_CHARGE_FRAMES = 55
export const SPEED_BOOST_MULT = 1.9

export const STAND_SIZE = { w: 28, h: 60 }
export const MORPH_SIZE = { w: 32, h: 32 }

// Fraction of player height the arm cannon sits at — shared by the
// engine (where shots spawn) and the renderer (where the cannon is
// drawn), so the beam always visibly comes from the gun and actually
// lines up with floor-level enemies instead of sailing over their heads.
export const GUN_HEIGHT_FRAC = 0.6

export const ENERGY_START = 99
export const ENERGY_TANK_BONUS = 100
export const MISSILE_BASE_CAPACITY = 5
export const MISSILE_TANK_BONUS = 5

export const CONTACT_DAMAGE = 10
export const BOSS_SHOT_DAMAGE = 12
export const HEAT_DAMAGE_PER_FRAME = 0.12
export const INVINCIBLE_FRAMES = 55

export const BEAM_COOLDOWN = 14
export const BEAM_SPEED = 9
export const BEAM_DAMAGE = 1
export const MISSILE_COOLDOWN = 22
export const MISSILE_SPEED = 7
export const MISSILE_DAMAGE = 4
export const BOMB_FUSE = 42
export const BOMB_RADIUS = 72
export const BOMB_DAMAGE = 4

export const BOSS_HP = 28

// Tile legend: '.' empty, '#' solid rock, 'B' bomb block, 'K' missile
// block, 'D' speed-booster wall, 'L' lava/heat hazard (solid but damages
// an unprotected player standing on it).
export const SOLID_TILES = new Set(['#', 'B', 'K', 'D', 'L'])
export const HAZARD_TILES = new Set(['L'])

export const BIOMES = {
  surface: { sky: ['#0a2a4a', '#1a5a7a'], wall: '#1f3d52', wallDeep: '#132a3a', accent: '#3fd0ff' },
  caves: { sky: ['#1a0f2e', '#2e1a4a'], wall: '#2a1f44', wallDeep: '#180f2a', accent: '#b16bff' },
  deep: { sky: ['#0a0a16', '#160a28'], wall: '#1c1430', wallDeep: '#10091e', accent: '#7a5cff' },
  thermal: { sky: ['#2a0a05', '#4a1505'], wall: '#3a1812', wallDeep: '#220c08', accent: '#ff7a3d' },
  reactor: { sky: ['#1a0000', '#3a0808'], wall: '#3a1010', wallDeep: '#200606', accent: '#ff3d3d' },
}

export const ITEM_DEFS = {
  missile_launcher: { label: 'Missile Launcher', color: '#ff9d3d', desc: 'Fire missiles with X.' },
  missile_tank: { label: 'Missile Tank', color: '#ffb85c', desc: '+5 missile capacity.' },
  morph_ball: { label: 'Morph Ball', color: '#ff5cc8', desc: 'Hold Down to curl up and roll through tight gaps.' },
  bombs: { label: 'Bombs', color: '#ffe35c', desc: 'Press X while morphed to drop a bomb.' },
  high_jump: { label: 'High Jump Boots', color: '#5cf0ff', desc: 'Jump noticeably higher.' },
  energy_tank: { label: 'Energy Tank', color: '#5cff8a', desc: '+100 max energy.' },
  thermal_plating: { label: 'Thermal Plating', color: '#ff6b3d', desc: 'Ignore heat damage.' },
  speed_booster: { label: 'Speed Booster', color: '#5c9dff', desc: 'Run in a straight line to charge a dash that busts through cracked walls.' },
}
