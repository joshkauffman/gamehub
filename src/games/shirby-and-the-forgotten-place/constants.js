// ── Shirby and the Forgotten Place — shared constants ─────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly, same house style as the Obvious Mario
// Knockoff next door.

export const W = 960, H = 540
export const TILE = 40
export const GROUND_Y = 460
export const GRAVITY = 0.5
export const FLOAT_GRAVITY = 0.1
export const FLOAT_MAX_VY = 2.0
export const JUMP_V = -10.5
export const MOVE_ACCEL = 0.65
export const MAX_SPEED = 4.0
export const FRICTION = 0.8
export const LIVES_START = 4
export const MAX_HP = 6
export const PLAYER_SIZE = { w: 36, h: 36 }

export const INHALE_RANGE = 100
export const INHALE_PULL = 6
export const INVULN_FRAMES = 70
export const KNOCKBACK_VX = 5
export const KNOCKBACK_VY = -7

export const PROJECTILE_SPEED = 8
export const PROJECTILE_LIFE = 90

export const BLADE_COOLDOWN = 18
export const BLADE_REACH = 46
export const BLADE_ARC_H = 46
export const EMBER_RANGE = 62
export const EMBER_TICK = 10
export const FROST_COOLDOWN = 30
export const ZAP_PULSE_COOLDOWN = 40
export const ZAP_PULSE_RADIUS = 74
export const ROCK_COOLDOWN = 48
export const ROCK_RADIUS = 62
export const BUBBLE_COOLDOWN = 22

// ── Content ────────────────────────────────────────────────────────────
// A "talented" enemy grants its `power` id when swallowed; a plain one
// (power: null) only ever gives a small score bonus. `noInhale` enemies
// can't be sucked in at all — float or jump over them instead, same
// texture as the Mario knockoff's munchers being a pure hazard.
export const ENEMY_DEFS = {
  dustbunny: { name: 'Dust Bunny', power: null, color: '#cfc7d8', kind: 'ground' },
  bladebeetle: { name: 'Rusty Blade Beetle', power: 'blade', color: '#8a5a3a', kind: 'ground' },
  snailsprout: { name: 'Snail Sprout', power: null, color: '#7aa85a', kind: 'ground' },
  embermoth: { name: 'Ember Moth', power: 'ember', color: '#e8703a', kind: 'fly' },
  frostsnail: { name: 'Frost Snail', power: 'frost', color: '#7ad0e0', kind: 'ground' },
  glitchblob: { name: 'Glitch Blob', power: null, color: '#c04ad0', kind: 'erratic' },
  staticsock: { name: 'Static Sock', power: 'zap', color: '#f0d020', kind: 'ground' },
  pebblegolem: { name: 'Pebble Golem', power: 'rock', color: '#8a8070', kind: 'ground' },
  bubblefish: { name: 'Bubble Fish', power: 'bubble', color: '#5ac8f0', kind: 'bob' },
  spikeball: { name: 'Rolling Spike Ball', power: null, color: '#333333', kind: 'ground', noInhale: true },
}

export const POWERS = {
  blade: { name: 'Blade', hatColor: '#c9c9d8', accent: '#8a8a9a', emoji: '🗡️' },
  ember: { name: 'Ember', hatColor: '#ff7a3a', accent: '#c94a10', emoji: '🔥' },
  frost: { name: 'Frost', hatColor: '#8fe0ff', accent: '#3fa8c9', emoji: '❄️' },
  zap: { name: 'Zap', hatColor: '#f5e050', accent: '#c9a800', emoji: '⚡' },
  rock: { name: 'Rock', hatColor: '#a89878', accent: '#6b5f47', emoji: '🪨' },
  bubble: { name: 'Bubble', hatColor: '#7ad0ff', accent: '#3f8fc9', emoji: '🫧' },
}

// Swallowing a second, *different* talented enemy while a power is already
// equipped fuses the two into a mega power instead of just replacing it —
// same spirit as a certain star-riding hero's combo-copy-ability spinoff.
// Keyed by the two base power ids sorted and joined with '+' (see
// comboKey() in engine.js) so lookup doesn't care which one you got first.
//
// Each combo's `attack` is genuinely different, not a reskin — three
// shared "shapes" (arc/aoe/projectile/magnet) built from the same
// primitives the six base powers already use, but every combo picks its
// own parameters so the *mechanic* differs (bigger reach vs. a chained
// hit vs. a follow-up bolt vs. a piercing/bouncing/spread/gravity-affected
// shot), not just the color. Rock is the "heavy" element in every combo it
// touches (slow, huge, hits hardest); Zap (without Rock) is the "fast"
// element (quick, weak, spammable); everything else lands in between —
// see usePowerAttack()/megaArcAttack()/megaAoeAttack()/megaFireProjectile()/
// megaMagnetTick() in engine.js for what each field actually does.
export const MEGA_POWERS = {
  // ── Heavy (Rock-involved): slow, huge, hits hardest ─────────────────
  'blade+rock': { name: 'Boulder Blade', emoji: '🪨', attack: { shape: 'arc', reachMult: 2.0, arcHMult: 1.8, cooldown: 74, bossDmg: 3, killScore: 250, color: '#a89878' } },
  'ember+rock': { name: 'Magma Slam', emoji: '🌋', attack: { shape: 'aoe', radius: 100, cooldown: 74, bossDmg: 3, killScore: 250, color: '#ff5a1a' } },
  'frost+rock': { name: 'Glacier Smash', emoji: '🧊', attack: { shape: 'aoe', radius: 115, cooldown: 74, bossDmg: 3, killScore: 250, color: '#8fe0ff' } },
  'rock+zap': { name: 'Magnet Slam', emoji: '🧲', attack: { shape: 'magnet', radius: 130, cooldown: 74, bossDmg: 3, killScore: 250, color: '#f5e050' } },
  'bubble+rock': { name: 'Heavy Bubble', emoji: '🪨', attack: { shape: 'projectile', gravity: 0.35, speed: 0.6, burstRadius: 55, big: true, cooldown: 74, bossDmg: 3, killScore: 250, color: '#a89878' } },
  // ── Fast (Zap without Rock, plus Scald Spray): quick, weak, spammable ─
  'blade+zap': { name: 'Storm Blade', emoji: '⚡', attack: { shape: 'arc', chainRadius: 90, cooldown: 30, bossDmg: 1, killScore: 100, color: '#f5e050' } },
  'ember+zap': { name: 'Plasma Storm', emoji: '🌩️', attack: { shape: 'projectile', speed: 1.15, burstRadius: 50, cooldown: 30, bossDmg: 1, killScore: 100, color: '#ff9a3d' } },
  'frost+zap': { name: 'Blizzard Shock', emoji: '🌨️', attack: { shape: 'projectile', pierceCount: 3, cooldown: 30, bossDmg: 1, killScore: 100, color: '#8fe0ff' } },
  'bubble+zap': { name: 'Charged Bubble', emoji: '⚡', attack: { shape: 'projectile', speed: 1.1, bounces: 3, cooldown: 30, bossDmg: 1, killScore: 100, color: '#f5e050' } },
  'bubble+ember': { name: 'Scald Spray', emoji: '♨️', attack: { shape: 'projectile', count: 3, spreadAngle: 0.4, cooldown: 30, bossDmg: 1, killScore: 100, color: '#ff9a3d' } },
  // ── Balanced (everything else) ──────────────────────────────────────
  'blade+ember': { name: 'Blazing Blade', emoji: '🔥', attack: { shape: 'arc', reachMult: 1.6, cooldown: 46, bossDmg: 2, killScore: 180, color: '#ff7a3a' } },
  'blade+frost': { name: 'Frost Blade', emoji: '❄️', attack: { shape: 'arc', bolt: true, cooldown: 46, bossDmg: 2, killScore: 180, color: '#8fe0ff' } },
  'blade+bubble': { name: 'Bubble Blade', emoji: '🫧', attack: { shape: 'arc', projectile: true, cooldown: 46, bossDmg: 2, killScore: 180, color: '#7ad0ff' } },
  'ember+frost': { name: 'Steam Burst', emoji: '💨', attack: { shape: 'aoe', radius: 90, launch: -4, cooldown: 46, bossDmg: 2, killScore: 180, color: '#ffffff' } },
  'bubble+frost': { name: 'Ice Bubble', emoji: '🧊', attack: { shape: 'projectile', speed: 0.6, life: 1.4, pierceCount: 2, big: true, cooldown: 48, bossDmg: 2, killScore: 180, color: '#8fe0ff' } },
}

export function blendHex(a, b) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round((v + pb[i]) / 2).toString(16).padStart(2, '0')).join('')
}
// The single place that knows how to describe whatever's in `player.power`
// — a plain base power id, or a mega combo id (two base ids sorted and
// joined with '+') — as a display-ready {name, emoji, hatColor, accent}.
export function getPowerDisplay(id) {
  if (!id) return null
  if (POWERS[id]) return POWERS[id]
  const mega = MEGA_POWERS[id]
  if (!mega) return null
  const [a, b] = id.split('+')
  return {
    name: mega.name, emoji: mega.emoji, mega: true,
    hatColor: blendHex(POWERS[a].hatColor, POWERS[b].hatColor),
    accent: blendHex(POWERS[a].accent, POWERS[b].accent),
  }
}

// Visual themes per world (all procedural — colors only, no assets).
export const THEMES = {
  attic: { sky: ['#2a2035', '#4a3a5a'], ground: '#5a4530', groundTop: '#7a5f40', dust: true, void: '#0a0810' },
  garden: { sky: ['#4ea1e8', '#bfe8ff'], ground: '#5a3a20', groundTop: '#4a8a3a', hills: true, clouds: true, void: '#0a1420' },
  arcade: { sky: ['#0a0520', '#2a0a4a'], ground: '#241a3a', groundTop: '#4a2a7a', glow: true, void: '#000006' },
  landfill: { sky: ['#3a3020', '#6a5a30'], ground: '#3a3020', groundTop: '#8a7a30', haze: true, void: '#1a1408' },
  horror: { sky: ['#0a0208', '#2a0512'], ground: '#241018', groundTop: '#5c0f1e', haze: true, void: '#030103' },
}
