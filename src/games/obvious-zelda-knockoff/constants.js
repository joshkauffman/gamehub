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

// Non-weapon pickups only — weapon pickups ('weapon_melee', 'weapon_item1',
// etc. in levels.js) resolve through the chosen character's loadout
// instead (see characterData.js / weapons.js), since the same pickup
// spot hands out a different concrete weapon per character.
export const ITEM_DEFS = {
  heart_container: { label: 'Heart Container', color: '#ff4d6a', desc: '+1 heart, fully healed.' },
  small_key: { label: 'Small Key', color: '#ffd54a', desc: 'Opens one locked door.' },
}
