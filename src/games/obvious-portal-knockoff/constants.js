// ── The Obvious Portal Knockoff — shared constants ────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 40
export const PLAY_Y0 = HUD_H
export const TILE = 40
export const COLS = 24, ROWS = Math.floor((H - HUD_H) / TILE) // 12

export const GRAVITY = 0.62
export const JUMP_V = -12.8
export const MOVE_ACCEL = 0.8
export const MAX_SPEED = 4.2
export const FRICTION = 0.78
export const PLAYER_SIZE = { w: 24, h: 34 }

export const CUBE_SIZE = { w: 28, h: 28 }
export const CUBE_PUSH_SPEED = 2.2

export const TELEPORT_MIN_SPEED = 3.4
// Exiting a floor portal straight up has zero horizontal drift, so
// gravity always drags the entity back down through that exact same
// (now-hollow) tile. The cooldown has to outlast the full arc — rise,
// fall back to the tile, then fall all the way through its height —
// or it re-triggers mid-fall and ping-pongs forever between the pair.
export const TELEPORT_COOLDOWN = 50
export const PORTAL_W = 10 // thickness of the portal oval across the surface normal
export const PORTAL_LEN = 54 // length of the portal along the surface

// Tile legend:
// '.' empty / air
// '#' solid, NOT portal-able (dark concrete)
// 'P' solid, portal-able surface (pale panel)
// 'D' door — solid until its linked button is pressed
// 'H' hazard — instant respawn on touch
export const SOLID_CHARS = new Set(['#', 'P', 'D'])
export const PORTALABLE_CHARS = new Set(['P'])
