// ── The Obvious Minecraft Knockoff — gameplay constants ────────────────
// Everything here is original code and procedurally-generated geometry
// (no sprites, no copied assets, no copyrighted names) — the "knockoff"
// is entirely the joke, worn openly.

export const GRAVITY = 22
export const JUMP_SPEED = 8.2
export const MOVE_SPEED = 5.2
export const MAX_FALL_SPEED = -30
export const PLAYER_HALF_W = 0.3
export const PLAYER_HEIGHT = 1.75
export const EYE_HEIGHT = 1.6
export const STEP_HEIGHT = 1.05 // tallest ledge the player can walk straight up onto

export const REACH = 6 // blocks

export const PLAYER_MAX_HP = 10

// Day/night cycle, in seconds.
export const DAY_LENGTH = 75
export const NIGHT_LENGTH = 45
export const CYCLE_LENGTH = DAY_LENGTH + NIGHT_LENGTH
export const DUSK_DAWN_LENGTH = 6 // seconds of fade on either side of the day/night boundary

export const FURNACE_RANGE = 3.2 // blocks, for the smelt_iron recipe

export const SAVE_DEBOUNCE_MS = 1200

// 1 at full daylight, 0 at full night, smoothly ramping across a
// DUSK_DAWN_LENGTH-second window on each side of the boundary. `t` is
// seconds into the cycle (0..CYCLE_LENGTH, wraps).
export function dayFactorAt(t) {
  const duskStart = DAY_LENGTH - DUSK_DAWN_LENGTH
  const dawnStart = CYCLE_LENGTH - DUSK_DAWN_LENGTH
  if (t < duskStart) return 1
  if (t < DAY_LENGTH) return 1 - (t - duskStart) / DUSK_DAWN_LENGTH
  if (t < dawnStart) return 0
  if (t < CYCLE_LENGTH) return (t - dawnStart) / DUSK_DAWN_LENGTH
  return 1
}
