// ── The Obvious Guitar Hero Knockoff — shared constants ───────────────
// Everything here is original code: procedurally-drawn shapes for the
// note highway and a synthesized backing track built from oscillators
// and noise bursts via the Web Audio API — no sprites, no audio files,
// no copied songs. The "knockoff" is entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 56

export const LANES = [
  { id: 0, key: 'KeyA', label: 'A', color: '#3fae3f' },
  { id: 1, key: 'KeyS', label: 'S', color: '#d8303a' },
  { id: 2, key: 'KeyD', label: 'D', color: '#ffd93d' },
  { id: 3, key: 'KeyF', label: 'F', color: '#2a6fd8' },
  { id: 4, key: 'Space', label: '␣', color: '#e8862a' },
]
export const LANE_COUNT = LANES.length
export const HIGHWAY_X0 = (W - LANE_COUNT * 120) / 2
export const LANE_W = 120
export const HIT_Y = H - 90
export const NOTE_TRAVEL_SECONDS = 1.9 // time from spawn (top) to the hit line
export const NOTE_R = 26

export const PERFECT_WINDOW = 0.07 // seconds
export const GOOD_WINDOW = 0.16

export const HEALTH_START = 50
export const HEALTH_PERFECT = 2.2
export const HEALTH_GOOD = 1.2
export const HEALTH_MISS = -5
export const HEALTH_MAX = 100
