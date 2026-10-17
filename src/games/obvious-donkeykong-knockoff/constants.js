// ── The Obvious Donkey Kong Knockoff — shared constants ───────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly. Each stage is a single static screen
// (no camera scroll), exactly like the arcade original.

export const W = 960, H = 540
export const HUD_H = 40
export const PLAY_Y0 = HUD_H
export const TILE = 24
export const COLS = Math.floor(W / TILE)              // 40
export const ROWS = Math.floor((H - HUD_H) / TILE)     // 20

export const GRAVITY = 0.55
export const JUMP_V = -9.2
export const MOVE_SPEED = 2.3
export const CLIMB_SPEED = 2.0
export const PLAYER_SIZE = { w: 16, h: 20 }

export const BARREL_SIZE = { w: 16, h: 16 }
export const BARREL_SPEED = 1.7
export const BARREL_SPAWN_INTERVAL = 150 // frames between barrels

export const HAMMER_DURATION = 480 // frames (~8s)
export const LIVES_START = 3

export const SCORE_JUMP_BARREL = 30
export const SCORE_SMASH_BARREL = 100
export const SCORE_RIVET = 50
export const SCORE_STAGE_CLEAR = 500

// Tile legend:
// '.' empty / air
// '#' girder — solid, walkable
// 'L' ladder — climbable, not solid for horizontal walking
// 'X' girder + ladder foot (solid AND climbable, where a ladder meets a girder)
export const SOLID_CHARS = new Set(['#', 'X'])
export const LADDER_CHARS = new Set(['L', 'X'])
