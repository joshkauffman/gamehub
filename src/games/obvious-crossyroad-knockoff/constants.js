// ── The Obvious Crossy Road Knockoff — shared constants ───────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 60
export const PLAY_Y0 = HUD_H
export const TILE = 40
export const COLS = 24
export const ROWS = Math.floor((H - HUD_H) / TILE) // 12
export const PLAY_W = COLS * TILE

export const PLAYER_SIZE = { w: 28, h: 28 }
export const HOP_FRAMES = 8
export const CAMERA_LOOKAHEAD_ROWS = 3 // how many rows of "behind you" stay visible at the bottom
export const CAMERA_EASE = 0.16

export const SAFE_START_ROWS = 4   // rows 0..3 are always plain, obstacle-free grass
export const RIVER_UNLOCK_ROW = 10
export const RAIL_UNLOCK_ROW = 22
export const DIFFICULTY_CAP_ROW = 120 // difficulty stops ramping past this distance
export const LANE_GEN_BUFFER_ROWS = 20 // how far ahead of the camera lanes stay generated

export const VEHICLE_SIZE = { w: 46, h: 30 }
export const LOG_SIZE = { w: 90, h: 30 }

export const RAIL_WARN_FRAMES = 50
export const RAIL_ACTIVE_FRAMES = 22

export const STALL_THRESHOLD_FRAMES = 240 // ~4s with no new best distance before a hawk gets interested
export const HAWK_TELEGRAPH_FRAMES = 45
export const HAWK_HIT_RADIUS = 20

export const LANE_COLORS = {
  grass: { base: '#5fa83f', alt: '#6cbf49' },
  road: { base: '#45454c', alt: '#3d3d43' },
  river: { base: '#2f7fd1', alt: '#3a8ce0' },
  rail: { base: '#9a8a63', alt: '#8d7d58' },
}

export const HIGH_SCORE_KEY = 'obvious-crossyroad-knockoff:high-score'

// ── Power-ups ───────────────────────────────────────────────────────
// Spawned only on grass lanes (always reachable, never mid-hazard) at
// an unoccupied, obstacle-free column. Each is a genuinely different
// effect, not a reskin:
//   shield - total immunity to every death condition for its duration
//   speed  - hops resolve in half the usual frame count
//   freeze - pauses ALL lane hazards (traffic/logs/trains) and both
//            players' hawk-stall clocks — global, not per-player,
//            since it's freezing the shared world
//   life   - +1 life immediately (capped), so the next hit costs a
//            life and respawns in place instead of ending the run
export const POWERUP_TYPES = ['shield', 'speed', 'freeze', 'life']
export const POWERUP_SPAWN_CHANCE = 0.16 // rolled once per eligible grass lane at generation time
export const POWERUP_ICON_SIZE = 22

export const SHIELD_DURATION = 360 // 6s @60fps
export const SPEED_DURATION = 480 // 8s
export const SPEED_HOP_FRAMES = 4 // vs. the normal HOP_FRAMES (8) — twice as fast
export const FREEZE_DURATION = 240 // 4s

export const START_LIVES = 1
export const MAX_LIVES = 4
export const RESPAWN_INVULN_FRAMES = 75 // brief immunity right after burning a life to respawn

// ── 2-player split screen ───────────────────────────────────────────
// Each player gets their own vertical slice of the canvas, side by
// side, with its own compact HUD strip and its own independently-
// scrolling camera — both horizontally (following that player's
// column, since the world is wider than one half-screen) and
// vertically. Both halves read from the exact same shared `lanes`
// array, so it's true co-op on one synced world, not two separate
// simulations.
export const SPLIT_HUD_H = 26
export const SPLIT_VIEW_W = W / 2
export const SPLIT_VISIBLE_COLS = Math.floor(SPLIT_VIEW_W / TILE) // 12
export const SPLIT_PLAY_X0 = [0, SPLIT_VIEW_W]
export const SPLIT_ROWS = Math.floor((H - SPLIT_HUD_H) / TILE) // 12 — full height per side
