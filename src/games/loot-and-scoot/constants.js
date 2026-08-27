// ── Loot & Scoot — shared data ──────────────────────────────────────────
// A cartoon cat-burglar heist game: original code, original low-poly
// procedural characters (no sprites, no real-world crime references) —
// take jobs from the Fence, sneak past guards, grab the loot, then spend
// the cash on gear at the Shop. Nobody gets hurt; getting caught just
// sends you back to the hideout to try again.

export const MAP_HALF = 66

export const GEAR = [
  {
    key: 'speed',
    name: 'Fast Sneakers',
    icon: '👟',
    desc: 'Move faster everywhere.',
    tiers: [0, 120, 320, 700],
  },
  {
    key: 'stealth',
    name: 'Shadow Hoodie',
    icon: '🥷',
    desc: 'Guards notice you from further away, at a shorter range.',
    tiers: [0, 150, 380, 800],
  },
  {
    key: 'time',
    name: 'Lockpick Set',
    icon: '🔧',
    desc: 'More time on the clock for every job.',
    tiers: [0, 100, 260, 600],
  },
  {
    key: 'lootMult',
    name: 'Bigger Bag',
    icon: '🎒',
    desc: 'Every job pays out more.',
    tiers: [0, 200, 500, 1100],
  },
]

export function gearCost(key, nextTier) {
  const def = GEAR.find(g => g.key === key)
  return def?.tiers[nextTier] ?? Infinity
}

// Recruitable helpers — unlike gear, you can own several at once and they
// all pitch in during a job. Bought once, permanent.
export const MINIONS = [
  {
    key: 'cat',
    name: 'Shadow the Cat',
    icon: '🐱',
    desc: 'Every so often, darts over and distracts the nearest guard, resetting their suspicion.',
    cost: 300,
  },
  {
    key: 'raven',
    name: 'Scout the Raven',
    icon: '🐦',
    desc: 'Keeps watch from above — guard suspicion cools down faster once you break line of sight.',
    cost: 260,
  },
  {
    key: 'raccoon',
    name: 'Bandit the Raccoon',
    icon: '🦝',
    desc: 'Scampers ahead and can fetch the loot for you from much farther away.',
    cost: 340,
  },
  {
    key: 'pup',
    name: 'Biscuit the Pup',
    icon: '🐶',
    desc: 'Barks and startles any guard the moment they spot you, slowing their chase.',
    cost: 320,
  },
]

export function minionCost(key) {
  return MINIONS.find(m => m.key === key)?.cost ?? Infinity
}

const TARGET_NAMES = [
  { name: "The Mayor's Mansion", reward: 260, guards: 3 },
  { name: 'Glitter & Gold Jewelers', reward: 220, guards: 2 },
  { name: 'Old Towne Bank', reward: 340, guards: 3 },
  { name: 'The Velvet Museum', reward: 300, guards: 3 },
  { name: 'Countess Buttercup’s Villa', reward: 240, guards: 2 },
  { name: 'Fizzy Pop Candy Warehouse', reward: 140, guards: 1 },
  { name: 'The Pawn King', reward: 160, guards: 1 },
  { name: 'Sunset Casino', reward: 380, guards: 3 },
]
export { TARGET_NAMES }

// A one-off, much tougher job: instead of sneaking through a door, you
// scale the outside of a tower on an exterior fire escape and take down
// a boss guarding the loot on the roof.
export const BOSS_TARGET = { name: "The Kingpin's Tower", reward: 950, guards: 2 }

export const MISSION_BASE_TIME = 55
export const BOSS_MISSION_TIME = 95

const SAVE_KEY = 'loot-and-scoot-v1'
const DEFAULT_SAVE = { cash: 0, gear: { speed: 0, stealth: 0, time: 0, lootMult: 0 }, minions: [], jobsDone: 0 }

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return structuredCloneSafe(DEFAULT_SAVE)
    const parsed = JSON.parse(raw)
    return { ...structuredCloneSafe(DEFAULT_SAVE), ...parsed, gear: { ...DEFAULT_SAVE.gear, ...parsed.gear } }
  } catch {
    return structuredCloneSafe(DEFAULT_SAVE)
  }
}

function structuredCloneSafe(obj) { return JSON.parse(JSON.stringify(obj)) }

export function persistSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* storage unavailable */ }
}
