// ── The Obvious Zelda Knockoff — shared constants ─────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 56
export const PLAY_X0 = 0, PLAY_Y0 = HUD_H
export const TILE = 40
export const COLS = 24, ROWS = 12
export const PLAY_W = COLS * TILE, PLAY_H = ROWS * TILE

// Door slots, standardized across every room so the world-builder can
// auto-carve connections from grid adjacency alone (see levels.js).
export const DOOR_ROWS = [5, 6, 7]   // left/right doors: 3 tiles tall, vertically centered
export const DOOR_COLS = [11, 12]    // up/down doors: 2 tiles wide, centered

export const PLAYER_SIZE = { w: 26, h: 26 }
export const MOVE_SPEED = 2.6

export const HEARTS_START = 6 // half-heart units (3 hearts)
export const HEART_CONTAINER_BONUS = 2
export const CONTACT_DAMAGE = 1
export const STRONG_CONTACT_DAMAGE = 2
export const INVINCIBLE_FRAMES = 60

export const SWORD_COOLDOWN = 26
export const SWORD_ACTIVE_FRAMES = 10
export const SWORD_REACH = 22
export const SWORD_DAMAGE = 1

export const BOOMERANG_COOLDOWN = 40
export const BOOMERANG_SPEED = 6
export const BOOMERANG_RANGE = 170
export const BOOMERANG_DAMAGE = 1

export const ARROW_COOLDOWN = 22
export const ARROW_SPEED = 7
export const ARROW_DAMAGE = 2

export const BOMB_COOLDOWN = 50
export const BOMB_FUSE = 50
export const BOMB_RADIUS = 70
export const BOMB_DAMAGE = 3

export const BOSS_HP = 20

// Tile legend: '.' empty, '#' solid rock/wall, 'T' tree (overworld
// decoration, solid), 'W' water (solid, overworld), 'B' bomb-crackable
// wall, 'K' locked door (needs a Small Key).
export const SOLID_TILES = new Set(['#', 'T', 'W', 'B', 'K'])

export const BIOMES = {
  field: { ground: '#4a9d3a', groundAlt: '#3f8c30', wall: '#2a5a1f' },
  forest: { ground: '#3a7d33', groundAlt: '#326e2c', wall: '#1f4a1a' },
  shore: { ground: '#4a9d3a', groundAlt: '#3f8c30', wall: '#2a5a1f' },
  dungeon: { ground: '#4a4458', groundAlt: '#3e394e', wall: '#241f30' },
  boss: { ground: '#4a2a44', groundAlt: '#3e2038', wall: '#1f1322' },
}

export const ITEM_DEFS = {
  sword: { label: 'Sword', color: '#d8d8e4', desc: 'Press Z to swing it.' },
  boomerang: { label: 'Boomerang', color: '#5bc8ff', desc: 'Press X to throw it — stuns enemies, comes right back.' },
  bow: { label: 'Bow', color: '#c99a5b', desc: 'Press C to fire an arrow.' },
  bombs: { label: 'Bombs', color: '#444', desc: 'Press V to drop a bomb — cracks weak walls.' },
  heart_container: { label: 'Heart Container', color: '#ff4d6a', desc: '+1 heart, fully healed.' },
  small_key: { label: 'Small Key', color: '#ffd54a', desc: 'Opens one locked door.' },
}
