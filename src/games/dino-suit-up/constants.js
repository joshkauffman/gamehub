// ── Dino Suit Up — shared data ──────────────────────────────────────────
// An original gather-craft-boss game: you're a dinosaur roaming an open
// world, chopping wood and mining stone (and rarer materials found
// farther out) to craft a sequence of wearable suits, each one only
// craftable after you've beaten the boss that guards its "core" — up to
// the final Cyborg Suit. Same engine/render split as this hub's other 3D
// games (see Avatar, Dungeon Crawler Free Roam).
//
// Movement is tank-style (turn + thrust) with a fixed chase camera behind
// the dino's facing direction — no mouse-look, so there's no pointer-lock
// dependency at all (that API is unreliable under browser automation and
// unnecessary for this game's feel).

export const WORLD_HALF = 240
export const UNIT_RADIUS = 1.0

export const BASE_SPEED = 7.5
export const TURN_SPEED = 2.6

export const ATTACK_RANGE = 2.8
export const ATTACK_DURATION = 0.22
export const ATTACK_COOLDOWN = 0.42

export const BOSS_AGGRO_RANGE = 24
export const BOSS_LEASH_RANGE = 60
export const BOSS_CONTACT_RANGE = 2.8
export const BOSS_CONTACT_COOLDOWN = 0.9

export const INVULN_TIME = 0.7
export const RESPAWN_HEAL_DELAY = 0.4

export const RESOURCE_RESPAWN_TIME = 26
export const RESOURCE_HIT_YIELD = [1, 2] // min,max granted per successful hit

// Suit tiers, in strict crafting order. Tier 0 ("Bare Hide") is the
// starting state — not craftable, no boss required. Each subsequent tier
// requires both the listed raw-material cost AND (if set) the matching
// boss "core" key item. Crafting fully re-equips: new atk/def/maxHp/speed
// replace the old ones outright (not additive), and the player is healed
// to the new max, matching this hub's existing gear-upgrade convention
// (see Dungeon Crawler Free Roam's weapon equip).
export const SUIT_TIERS = [
  {
    id: 'none', name: 'Bare Hide', emoji: '🦖',
    atk: 5, def: 0, maxHp: 50, speedMult: 1.0,
    cost: {}, requiresCore: null,
  },
  {
    id: 'bark', name: 'Bark Suit', emoji: '🌳',
    atk: 8, def: 3, maxHp: 65, speedMult: 1.0,
    cost: { wood: 12 }, requiresCore: null,
  },
  {
    id: 'stone', name: 'Stone Suit', emoji: '🪨',
    atk: 11, def: 6, maxHp: 85, speedMult: 0.96,
    cost: { wood: 6, stone: 16 }, requiresCore: 'stone',
  },
  {
    id: 'bone', name: 'Bone Suit', emoji: '🦴',
    atk: 15, def: 9, maxHp: 110, speedMult: 1.04,
    cost: { stone: 8, bone: 16 }, requiresCore: 'bone',
  },
  {
    id: 'iron', name: 'Iron Suit', emoji: '⚙️',
    atk: 20, def: 14, maxHp: 140, speedMult: 1.0,
    cost: { bone: 10, iron: 16 }, requiresCore: 'iron',
  },
  {
    id: 'crystal', name: 'Crystal Suit', emoji: '💎',
    atk: 26, def: 19, maxHp: 175, speedMult: 1.15,
    cost: { iron: 10, crystal: 13 }, requiresCore: 'crystal',
  },
  {
    id: 'cyborg', name: 'Cyborg Suit', emoji: '🤖',
    atk: 36, def: 28, maxHp: 220, speedMult: 1.25,
    cost: { crystal: 10, tech: 16 }, requiresCore: 'tech',
  },
]

export function tierByIdx(idx) { return SUIT_TIERS[idx] }

// Raw-material resource nodes scattered across the world. `rMin`/`rMax`
// are distance-from-spawn bands so early materials cluster close in and
// rarer ones require venturing toward the boss-guarded outer rings.
export const RESOURCE_KINDS = [
  { kind: 'wood', emoji: '🌲', count: 16, rMin: 10, rMax: 75, hits: 3, color: 0x4a7c3a, accent: 0x6b4a2a },
  { kind: 'stone', emoji: '🪨', count: 16, rMin: 10, rMax: 90, hits: 3, color: 0x8a8a92, accent: 0x5a5a62 },
  { kind: 'bone', emoji: '🦴', count: 11, rMin: 55, rMax: 135, hits: 2, color: 0xe8e0c8, accent: 0xb8ac90 },
  { kind: 'iron', emoji: '⚙️', count: 9, rMin: 95, rMax: 175, hits: 3, color: 0x9a9aa4, accent: 0xc47a3a },
  { kind: 'crystal', emoji: '💎', count: 7, rMin: 150, rMax: 215, hits: 2, color: 0x5fe0e8, accent: 0x2a8a92 },
  { kind: 'tech', emoji: '🔧', count: 6, rMin: 190, rMax: 232, hits: 2, color: 0x4a4a55, accent: 0xff3a3a },
]

export const MATERIAL_LABELS = {
  wood: 'Wood', stone: 'Stone', bone: 'Bone', iron: 'Iron', crystal: 'Crystal', tech: 'Tech Scrap',
}
export const MATERIAL_EMOJI = {
  wood: '🌲', stone: '🪨', bone: '🦴', iron: '⚙️', crystal: '💎', tech: '🔧',
}

// Five bosses, each guarding the core needed for the suit tier that
// follows it (thornbeast -> Stone Suit, ..., overseer -> Cyborg Suit).
// Placed at increasing distance from spawn around a ring so the world
// naturally escalates in danger as the player ventures farther out.
export const BOSSES = [
  {
    id: 'thornbeast', name: 'The Thorn Beast', emoji: '🐗', coreId: 'stone',
    hp: 150, atk: 9, speed: 4.2, radius: 1.9,
    color: 0x5a8a3a, accent: 0x2a4a1a, shape: 'quad', dist: 65,
  },
  {
    id: 'bonereaper', name: 'The Bone Reaper', emoji: '💀', coreId: 'bone',
    hp: 280, atk: 14, speed: 4.6, radius: 2.1,
    color: 0xe8e0c8, accent: 0x8a8068, shape: 'biped', dist: 105,
  },
  {
    id: 'irongolem', name: 'The Iron Golem', emoji: '🗿', coreId: 'iron',
    hp: 420, atk: 20, speed: 3.6, radius: 2.4,
    color: 0x8a8a92, accent: 0x5a5a62, shape: 'golem', dist: 145,
  },
  {
    id: 'crystalwraith', name: 'The Crystal Wraith', emoji: '👻', coreId: 'crystal',
    hp: 600, atk: 27, speed: 5.2, radius: 2.1,
    color: 0x5fe0e8, accent: 0x2a8a92, shape: 'wraith', dist: 185,
  },
  {
    id: 'overseer', name: 'The Overseer', emoji: '🤖', coreId: 'tech',
    hp: 900, atk: 36, speed: 4.8, radius: 2.8,
    color: 0x2a2a33, accent: 0xff3a3a, shape: 'overseer', dist: 225, isFinal: true,
  },
]

export const SAVE_KEY = 'dino-suit-up-save-v1'
export const AUTOSAVE_INTERVAL = 10
