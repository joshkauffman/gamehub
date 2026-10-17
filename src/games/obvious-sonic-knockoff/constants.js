// ── The Obvious Sonic Knockoff — shared constants ─────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 54

export const GRAVITY = 0.68
export const JUMP_V = -13.2
export const MAX_GROUND_SPEED = 9.2
export const GROUND_ACCEL = 0.3
export const GROUND_DECEL = 0.55   // braking when reversing direction
export const FRICTION = 0.12       // natural slowdown with no input held
export const AIR_ACCEL = 0.22
export const MAX_FALL_SPEED = 16
// How strongly a slope's grade (rise/run) nudges horizontal speed each
// frame — downhill speeds you up, uphill slows you down, the core of
// Sonic's momentum feel without full rotational physics. Applied as
// `vx += grade * SLOPE_FACTOR`, so this stays a small per-frame value.
export const SLOPE_FACTOR = 0.09

export const SPINDASH_CHARGE_STEP = 1.6
export const SPINDASH_MAX_CHARGE = 13
export const SPINDASH_DECAY = 0.01   // charge bleeds off slowly while revving

export const PLAYER_STAND_SIZE = { w: 28, h: 40 }
export const PLAYER_ROLL_SIZE = { w: 28, h: 28 }

export const LIVES_START = 3
export const INVINCIBLE_FRAMES = 90
export const RING_SCATTER_COUNT = 8

export const ENEMY_DEFS = {
  crawler: { w: 30, h: 24, speed: 1.6 },
  buzzer: { w: 28, h: 26, speed: 1.3 },
}

export const BOSS_HP = 5
