// ── Wings of Fire: Talon Clash — shared data ────────────────────────────
// An original dragon-tribe combat game inspired by Wings of Fire: pick a
// tribe, each with one signature breath attack (or, for MudWing, a charge)
// plus a basic claw, and fly a free 3D sky arena.

export const MAP_HALF = 42
export const ARENA_MIN_Y = 2
export const ARENA_MAX_Y = 34

export const TRIBES = [
  {
    key: 'skywing', name: 'SkyWing', icon: '🔥', color: 0xd6472c, accent: 0xffb066,
    desc: 'Fast and fierce, with a scorching fireball breath that burns on contact.',
    maxHp: 100, speedMult: 1.05,
    claw: { damage: 8, range: 3.4, cooldown: 0.45 },
    breath: {
      name: 'Fireball', speed: 26, radius: 0.9, damage: 14, cooldown: 2.2, life: 3.0,
      color: 0xff5a2a, tag: 'fire', dot: { damage: 3, duration: 2 },
    },
  },
  {
    key: 'icewing', name: 'IceWing', icon: '❄️', color: 0xbfe6ff, accent: 0xffffff,
    desc: 'A frost breath that chills the air and slows whatever it hits.',
    maxHp: 100, speedMult: 1.0,
    claw: { damage: 8, range: 3.4, cooldown: 0.45 },
    breath: {
      name: 'Frost Breath', speed: 20, radius: 1.0, damage: 13, cooldown: 2.0, life: 2.6,
      color: 0x8fe0ff, tag: 'ice', slow: { mult: 0.5, duration: 2.5 },
    },
  },
  {
    key: 'sandwing', name: 'SandWing', icon: '🦂', color: 0xe0c375, accent: 0xa8823a,
    desc: 'A venomous tail barb, flung fast and hard — a glass cannon.',
    maxHp: 95, speedMult: 1.1,
    claw: { damage: 8, range: 3.4, cooldown: 0.45 },
    breath: {
      name: 'Venom Barb', speed: 34, radius: 0.6, damage: 20, cooldown: 3.0, life: 2.2,
      color: 0xd8e04a, tag: 'venom',
    },
  },
  {
    key: 'seawing', name: 'SeaWing', icon: '🌊', color: 0x2c8fc9, accent: 0x8fe0ff,
    desc: 'A slow, huge tidal blast that knocks foes clear out of the sky.',
    maxHp: 105, speedMult: 0.95,
    claw: { damage: 8, range: 3.4, cooldown: 0.45 },
    breath: {
      name: 'Tidal Orb', speed: 14, radius: 1.6, damage: 15, cooldown: 2.4, life: 4.0,
      color: 0x3ab0e0, tag: 'water', knockback: 7,
    },
  },
  {
    key: 'mudwing', name: 'MudWing', icon: '💪', color: 0x7a5c3a, accent: 0x5a4028,
    desc: 'Tough and fire-resistant — wins fights with a bone-crushing charge.',
    maxHp: 130, speedMult: 0.9,
    claw: { damage: 8, range: 3.4, cooldown: 0.45 },
    charge: { damage: 18, speedMult: 3.2, duration: 0.45, cooldown: 4.2, range: 3.8 },
    fireResist: 0.5,
  },
  {
    key: 'rainwing', name: 'RainWing', icon: '🌈', color: 0x4ecb6a, accent: 0xd85fd0,
    desc: 'Spits venom, then vanishes into camouflage to line up the next shot.',
    maxHp: 100, speedMult: 1.0,
    claw: { damage: 8, range: 3.4, cooldown: 0.45 },
    breath: {
      name: 'Venom Spit', speed: 22, radius: 0.8, damage: 9, cooldown: 2.0, life: 2.8,
      color: 0x7a4fd8, tag: 'venom', dot: { damage: 4, duration: 3 }, camo: 1.6,
    },
  },
]

export function getTribe(key) { return TRIBES.find(t => t.key === key) }

// Solo mode: a run of escalating waves, each a single CPU dragon. Beating
// one heals you a little and throws the next tribe at you.
export const WAVES = [
  { tribe: 'skywing', hpMult: 0.7 },
  { tribe: 'icewing', hpMult: 0.8 },
  { tribe: 'sandwing', hpMult: 0.85 },
  { tribe: 'seawing', hpMult: 0.95 },
  { tribe: 'rainwing', hpMult: 1.0 },
  { tribe: 'mudwing', hpMult: 1.1 },
]

export const HEAL_BETWEEN_WAVES = 25
