// ── Capeville — shared constants ──────────────────────────────────────
// A superhero creator (pick a name, colors, emblem, cape, mask, and a
// power) followed by a free-roam test patrol around an original city.
// Everything drawn is procedural shapes built from your choices — no
// sprites, no copied character designs.

export const W = 960, H = 540
export const HUD_H = 52

export const CITY_W = 2400, CITY_H = 1600

export const MOVE_SPEED = 3.0
export const SPEED_POWER_MULT = 1.85
export const FLIGHT_MULT = 1.45
export const DASH_SPEED = 13
export const DASH_FRAMES = 14
export const DASH_COOLDOWN = 50

export const PROJECTILE_SPEED = 8.5
export const PROJECTILE_COOLDOWN = 26
export const THROW_SPEED = 9
export const PUNCH_RANGE = 46
export const PUNCH_COOLDOWN = 24
export const PICKUP_RANGE = 40

export const HERO_SIZE = { w: 28, h: 34 }

// ── Combat ──────────────────────────────────────────────────────────
// Villains now take real hits to go down — contact alone no longer
// resolves a crime scene. Every hero can throw a basic punch up close
// regardless of power (Strength hits harder); each power's signature
// move is also a real attack, with a thrown car/dumpster as the
// one-hit finisher that rewards the setup of picking it up.
export const VILLAIN_HP = 3
export const PUNCH_DAMAGE = 1
export const STRENGTH_PUNCH_DAMAGE = 2
export const DASH_DAMAGE = 2
export const PROJECTILE_DAMAGE = 1
export const THROW_DAMAGE = 99
