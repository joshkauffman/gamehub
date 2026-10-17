// ── The Obvious Pokémon Knockoff — shared constants ───────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 56
export const PLAY_X0 = 0, PLAY_Y0 = HUD_H
export const TILE = 40
export const COLS = 24, ROWS = 12
export const PLAY_W = COLS * TILE, PLAY_H = ROWS * TILE

export const DOOR_ROWS = [5, 6, 7]
export const DOOR_COLS = [11, 12]

export const PLAYER_SIZE = { w: 26, h: 26 }
export const MOVE_SPEED = 2.6

export const ENCOUNTER_CHANCE_PER_FRAME = 1 / 150
export const PARTY_MAX = 3

// '.' walk, '#' solid wall/building, 'G' tall grass (walkable, can
// trigger a wild encounter), 'H' heal spot (walkable, fully heals the
// party on contact).
export const SOLID_TILES = new Set(['#'])
export const GRASS_TILES = new Set(['G'])

export const BIOMES = {
  town: { ground: '#d8c88a', groundAlt: '#cbb87a', wall: '#8a6a4a' },
  route: { ground: '#4a9d3a', groundAlt: '#3f8c30', wall: '#2a5a1f' },
  indoor: { ground: '#d8b878', groundAlt: '#cca868', wall: '#5a3a24' },
  shore: { ground: '#4ab89d', groundAlt: '#3fa88e', wall: '#2a6a5a' },
  cave: { ground: '#4a4458', groundAlt: '#3e394e', wall: '#201c2c' },
}

export const TYPES = ['ember', 'aqua', 'leaf', 'normal']

// attacker type -> the type it hits hard (1.5x); everything else that
// isn't a mirror match is neutral (1x); a mirror match is soft (0.67x).
export const STRONG_AGAINST = { ember: 'leaf', leaf: 'aqua', aqua: 'ember' }

export function typeMultiplier(moveType, targetType) {
  if (moveType === 'normal' || targetType === 'normal') return 1
  if (STRONG_AGAINST[moveType] === targetType) return 1.5
  if (moveType === targetType) return 0.67
  return 1
}
