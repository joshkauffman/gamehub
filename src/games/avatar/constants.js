// ── Avatar: Elemental Grounds — shared data ─────────────────────────────
// An original elemental-bending combat game inspired by Avatar: The Last
// Airbender: pick a bending style, roam an open-world proving grounds to
// find your opponent, then fight with a basic strike plus two signature
// bending moves once you're close enough to engage. Same engine/render
// split, and the same original-characters-not-the-show approach, as this
// hub's other games (see Wings of Fire) — benders are original archetypes
// (Airbender, Waterbender, ...), not the show's named characters.
//
// Each bender has `moves: [primary, secondary]`. A move's `kind` decides
// how gameEngine.js resolves it:
//   'projectile' — travels and hits the first thing in its path (speed,
//                  radius, damage, life, plus optional dot/slow/knockback/camo)
//   'self'       — applied to the caster instantly, no projectile
//                  (heal, and/or a temporary armorBonus or speedBonus)
//   'burst'      — instant AoE centered on the caster (radius, damage,
//                  plus optional slow/knockback), no travel time

export const WORLD_HALF = 34
export const TRIGGER_RADIUS = 4.5 // how close an unengaged pair must get to start a battle
export const BATTLE_RING_RADIUS = 9 // once engaged, combatants are held near the spot they met
export const UNIT_RADIUS = 0.6

export const BENDERS = [
  {
    key: 'air', name: 'Airbender', icon: '🌪️', color: 0xdfeeff, accent: 0xffffff,
    desc: 'Fastest on their feet — a gust attack that knocks foes flying, or a self-centered tornado to repel anyone who gets close.',
    maxHp: 90, speedMult: 1.15, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Air Gust', kind: 'projectile', speed: 24, radius: 0.9, damage: 10, cooldown: 1.9, life: 2.6,
        color: 0xf0faff, tag: 'air', knockback: 8,
      },
      {
        name: 'Tornado Spin', kind: 'burst', cooldown: 3.2, radius: 3.6, damage: 6,
        color: 0xdfefff, tag: 'air', knockback: 9,
      },
    ],
  },
  {
    key: 'water', name: 'Waterbender', icon: '💧', color: 0x2f8fd1, accent: 0x9fe0ff,
    desc: 'A water whip that binds and slows whatever it hits, backed by a healing wave to keep the fight going.',
    maxHp: 100, speedMult: 1.0, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Water Whip', kind: 'projectile', speed: 20, radius: 0.9, damage: 12, cooldown: 2.0, life: 2.6,
        color: 0x5fc3ee, tag: 'water', slow: { mult: 0.55, duration: 2.2 },
      },
      { name: 'Healing Wave', kind: 'self', cooldown: 8.5, color: 0x8fe0ff, heal: 16 },
    ],
  },
  {
    key: 'earth', name: 'Earthbender', icon: '🪨', color: 0x8a7355, accent: 0x5a4a38,
    desc: 'Thick-skinned and heavy-hitting — hurls slow, punishing boulders, and can armor up in solid stone.',
    maxHp: 130, speedMult: 0.85, armor: 0.2,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Boulder Toss', kind: 'projectile', speed: 13, radius: 1.5, damage: 18, cooldown: 2.6, life: 3.4,
        color: 0x9a8060, tag: 'earth',
      },
      { name: 'Stone Armor', kind: 'self', cooldown: 7.5, color: 0x8a7355, armorBonus: { amount: 0.25, duration: 4.5 } },
    ],
  },
  {
    key: 'fire', name: 'Firebender', icon: '🔥', color: 0xd6472c, accent: 0xffb066,
    desc: 'A scorching fireball that keeps burning after it hits, plus a fast close-range fire whip.',
    maxHp: 100, speedMult: 1.05, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Fireball', kind: 'projectile', speed: 25, radius: 0.85, damage: 13, cooldown: 2.1, life: 2.8,
        color: 0xff5a2a, tag: 'fire', dot: { damage: 3, duration: 2 },
      },
      {
        name: 'Fire Whip', kind: 'projectile', speed: 30, radius: 0.6, damage: 9, cooldown: 1.5, life: 1.3,
        color: 0xffb066, tag: 'fire',
      },
    ],
  },
  {
    key: 'lava', name: 'Lavabender', icon: '🌋', color: 0x7a2e12, accent: 0xff6a1f,
    desc: 'Molten globs that burn, then harden and slow the ground beneath them, with an obsidian shell to tank the return hit.',
    maxHp: 112, speedMult: 0.88, armor: 0.1,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Molten Glob', kind: 'projectile', speed: 16, radius: 1.1, damage: 14, cooldown: 2.6, life: 3.0,
        color: 0xff4400, tag: 'lava', dot: { damage: 3, duration: 2.2 }, slow: { mult: 0.6, duration: 1.8 },
      },
      { name: 'Obsidian Shell', kind: 'self', cooldown: 7.5, color: 0x3a1a10, armorBonus: { amount: 0.2, duration: 4.5 } },
    ],
  },
  {
    key: 'metal', name: 'Metalbender', icon: '🔩', color: 0xb8bec4, accent: 0x707880,
    desc: 'Armored and precise — flings fast metal shards with a short cooldown, or snaps a metal cage shut to pin a foe in place.',
    maxHp: 96, speedMult: 1.0, armor: 0.15,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Metal Shard', kind: 'projectile', speed: 32, radius: 0.5, damage: 9, cooldown: 1.4, life: 2.0,
        color: 0xd8dde2, tag: 'metal',
      },
      {
        name: 'Metal Cage', kind: 'projectile', speed: 18, radius: 0.8, damage: 6, cooldown: 3.4, life: 2.2,
        color: 0x9aa0a6, tag: 'metal', slow: { mult: 0.15, duration: 1.8 },
      },
    ],
  },
  {
    key: 'sand', name: 'Sandbender', icon: '🏜️', color: 0xdcc27a, accent: 0xb89a55,
    desc: 'Kicks up a sandstorm blast, then vanishes into the haze — or opens a quicksand trap to bog a foe down.',
    maxHp: 96, speedMult: 1.05, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Sandstorm Blast', kind: 'projectile', speed: 22, radius: 1.0, damage: 10, cooldown: 2.1, life: 2.6,
        color: 0xe8d19a, tag: 'sand', camo: 1.5,
      },
      {
        name: 'Quicksand Trap', kind: 'projectile', speed: 16, radius: 1.2, damage: 5, cooldown: 3.2, life: 2.6,
        color: 0xc9a76a, tag: 'sand', slow: { mult: 0.2, duration: 2.2 },
      },
    ],
  },
  {
    key: 'lightning', name: 'Lightningbender', icon: '⚡', color: 0xe7e6ff, accent: 0xfff36b,
    desc: 'A rare, devastating lightning bolt for the big moment, backed by a quick static charge to chip away between bolts.',
    maxHp: 85, speedMult: 1.0, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Lightning Bolt', kind: 'projectile', speed: 42, radius: 0.6, damage: 24, cooldown: 3.6, life: 2.0,
        color: 0xfff9c4, tag: 'lightning',
      },
      {
        name: 'Static Charge', kind: 'projectile', speed: 36, radius: 0.4, damage: 6, cooldown: 1.0, life: 1.6,
        color: 0xfff36b, tag: 'lightning',
      },
    ],
  },
  {
    key: 'ice', name: 'Icebender', icon: '❄️', color: 0xbfe6ff, accent: 0xffffff,
    desc: 'Ice spikes fast and precise — freezes whatever they hit in place — and a suit of ice armor to shrug off the reply.',
    maxHp: 102, speedMult: 0.95, armor: 0.1,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Ice Spike', kind: 'projectile', speed: 28, radius: 0.6, damage: 11, cooldown: 1.8, life: 2.4,
        color: 0xdfffff, tag: 'ice', slow: { mult: 0.45, duration: 2.6 },
      },
      { name: 'Ice Armor', kind: 'self', cooldown: 7.5, color: 0xbfe6ff, armorBonus: { amount: 0.2, duration: 4.5 } },
    ],
  },
  {
    key: 'crystal', name: 'Crystalbender', icon: '💎', color: 0xb98ee8, accent: 0xf0e0ff,
    desc: 'Razor-sharp crystal shards for glass-cannon precision, plus a crystal prison shard to root a foe in place.',
    maxHp: 92, speedMult: 1.0, armor: 0.05,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Crystal Shard', kind: 'projectile', speed: 34, radius: 0.45, damage: 15, cooldown: 1.7, life: 2.0,
        color: 0xe8d9ff, tag: 'crystal',
      },
      {
        name: 'Crystal Prison', kind: 'projectile', speed: 26, radius: 0.6, damage: 7, cooldown: 3.2, life: 2.0,
        color: 0xd0b0ff, tag: 'crystal', slow: { mult: 0.2, duration: 2.0 },
      },
    ],
  },
  {
    key: 'combustion', name: 'Combustionbender', icon: '💥', color: 0x8a1a1a, accent: 0xff4400,
    desc: 'A single devastating point-blast — the biggest hit in the Grounds, if you can land it — plus a fast ember flick to fill the gaps.',
    maxHp: 80, speedMult: 0.95, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Combustion Blast', kind: 'projectile', speed: 20, radius: 1.6, damage: 26, cooldown: 4.2, life: 2.6,
        color: 0xff2200, tag: 'combustion', knockback: 5,
      },
      {
        name: 'Ember Flick', kind: 'projectile', speed: 30, radius: 0.4, damage: 7, cooldown: 1.1, life: 1.6,
        color: 0xff6a33, tag: 'combustion',
      },
    ],
  },
  {
    key: 'storm', name: 'Stormbender', icon: '⛈️', color: 0x4a5a78, accent: 0xc7d6ff,
    desc: 'Calls down a wide storm burst that knocks back and slicks the ground, or rides the gale for a burst of speed.',
    maxHp: 98, speedMult: 1.05, armor: 0,
    claw: { damage: 8, range: 3.0, cooldown: 0.45 },
    moves: [
      {
        name: 'Thunderhead', kind: 'projectile', speed: 18, radius: 1.3, damage: 12, cooldown: 2.4, life: 3.0,
        color: 0xa8c0ff, tag: 'storm', slow: { mult: 0.6, duration: 1.8 }, knockback: 4,
      },
      { name: 'Gale Force', kind: 'self', cooldown: 6.0, color: 0xc7d6ff, speedBonus: { mult: 0.6, duration: 3.0 } },
    ],
  },
]

export function getBender(key) { return BENDERS.find(b => b.key === key) }

// Solo mode: a gauntlet of escalating waves, one CPU bender at a time,
// roughly easy-to-hard across the full 12-style roster (pure elements
// first, hybrid specialty styles later, Lightningbender as the final wave).
export const WAVES = [
  { element: 'air', hpMult: 0.65 },
  { element: 'water', hpMult: 0.72 },
  { element: 'ice', hpMult: 0.78 },
  { element: 'sand', hpMult: 0.84 },
  { element: 'earth', hpMult: 0.9 },
  { element: 'crystal', hpMult: 0.95 },
  { element: 'metal', hpMult: 1.0 },
  { element: 'fire', hpMult: 1.05 },
  { element: 'storm', hpMult: 1.1 },
  { element: 'lava', hpMult: 1.15 },
  { element: 'combustion', hpMult: 1.2 },
  { element: 'lightning', hpMult: 1.3 },
]

export const HEAL_BETWEEN_WAVES = 25

// Four cardinal elemental monuments dressing the open world — fixed
// landmarks so the space reads as a real place, not an empty box, and
// double as collidable obstacles during explore.
export const MONUMENTS = [
  { element: 'water', x: 0, z: -(WORLD_HALF - 7) },
  { element: 'fire', x: (WORLD_HALF - 7), z: 0 },
  { element: 'earth', x: 0, z: (WORLD_HALF - 7) },
  { element: 'air', x: -(WORLD_HALF - 7), z: 0 },
]
