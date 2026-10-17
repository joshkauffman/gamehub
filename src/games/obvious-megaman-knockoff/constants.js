// ── The Obvious Mega Man Knockoff — shared constants ──────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 50
export const GROUND_Y = 460

export const GRAVITY = 0.68
export const JUMP_V = -13.5
export const MOVE_ACCEL = 0.9
export const MAX_SPEED = 4.4
export const FRICTION = 0.8

export const PLAYER_SIZE = { w: 28, h: 38 }
export const ENERGY_START = 28
export const INVINCIBLE_FRAMES = 60
export const CONTACT_DAMAGE = 2

export const BUSTER_COOLDOWN = 12
export const BUSTER_SPEED = 10
export const BUSTER_DAMAGE = 1

export const WEAPON_COOLDOWN = 18
export const WEAPON_SPEED = 8
export const WEAPON_AMMO_MAX = 28
export const WEAPON_DAMAGE = 2
export const WEAKNESS_MULT = 3

export const BOSS_HP = 28
export const BOSS_CONTACT_DAMAGE = 3

export const ENEMY_DEFS = {
  walker: { w: 28, h: 26, speed: 1.1, hp: 2, contactDamage: 1 },
  turret: { w: 26, h: 26, speed: 0, hp: 2, contactDamage: 1 },
  flyer: { w: 26, h: 22, speed: 1.6, hp: 2, contactDamage: 1 },
}
