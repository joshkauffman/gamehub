// ── Kaboom Corral — cosmetic card packs ────────────────────────────────
// Packs are purely a visual reskin of the whole deck (name, emoji, color
// for every one of the 12 card types, not just the 5 critters) — they
// never touch game rules, so this module has zero dependency on the
// network layer and applies identically in every mode (local, CPU, host,
// guest). Each device tracks its own stats/unlocks in localStorage and
// picks its own active pack; two players in the same game can be looking
// at totally different art for the same card.
import { CARD_TYPES } from './engine.js'

const STATS_KEY = 'kaboom-corral-stats-v1'
const ACTIVE_PACK_KEY = 'kaboom-corral-active-pack-v1'

const DEFAULT_STATS = { gamesPlayed: 0, gamesWon: 0, pairsPlayed: 0 }

export function getStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { ...DEFAULT_STATS }
    return { ...DEFAULT_STATS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)) } catch { /* storage unavailable */ }
}

export function recordGameEnd({ won }) {
  const stats = getStats()
  stats.gamesPlayed += 1
  if (won) stats.gamesWon += 1
  saveStats(stats)
  return stats
}

export function recordPairPlayed() {
  const stats = getStats()
  stats.pairsPlayed += 1
  saveStats(stats)
  return stats
}

export const PACKS = [
  {
    id: 'woodland',
    name: 'Woodland',
    icon: '🌲',
    description: 'The original deck, forest critters and all.',
    requirement: 'Unlocked from the start.',
    isUnlocked: () => true,
    cardArt: null,
  },
  {
    id: 'fantasy',
    name: 'Fantasy Pack',
    icon: '🐉',
    description: 'Dragons, wizards, and curses replace every card in the deck.',
    requirement: 'Win 2 games.',
    isUnlocked: (stats) => stats.gamesWon >= 2,
    cardArt: {
      kaboom: { name: 'Dragonfire', emoji: '🔥', bg: '#7a1f1f', edge: '#2e0b0b' },
      shield: { name: 'Ward', emoji: '✨', bg: '#2f6fa8', edge: '#0f2a40' },
      skip: { name: 'Vanish', emoji: '💨', bg: '#2f9e8f', edge: '#0f3d37' },
      attack: { name: 'Curse', emoji: '🪄', bg: '#8a3fa0', edge: '#33143d' },
      shuffle: { name: 'Enchant', emoji: '🌀', bg: '#8352c9', edge: '#2f1a52' },
      peek: { name: 'Scrying', emoji: '🔮', bg: '#5b4fc4', edge: '#211a4d' },
      swap: { name: 'Trade Pact', emoji: '🤝', bg: '#c9a227', edge: '#4d3b0d' },
      'critter-fox': { name: 'Dragon', emoji: '🐉', bg: '#7a1f1f', edge: '#2e0b0b' },
      'critter-owl': { name: 'Wizard', emoji: '🧙', bg: '#4a2d7a', edge: '#1c1030' },
      'critter-squirrel': { name: 'Fairy', emoji: '🧚', bg: '#b23a8f', edge: '#4a1739' },
      'critter-hedgehog': { name: 'Direwolf', emoji: '🐺', bg: '#4a5a6a', edge: '#1c242c' },
      'critter-turtle': { name: 'Unicorn', emoji: '🦄', bg: '#c96fae', edge: '#5c2b4d' },
    },
  },
  {
    id: 'crystal',
    name: 'Crystal Pack',
    icon: '💎',
    description: 'Gem-encrusted art for every card, not just the critters.',
    requirement: 'Steal with a critter pair 5 times.',
    isUnlocked: (stats) => stats.pairsPlayed >= 5,
    cardArt: {
      kaboom: { name: 'Shatter', emoji: '💥', bg: '#c0392b', edge: '#4a0e08' },
      shield: { name: 'Bedrock Ward', emoji: '🪨', bg: '#6b5a4a', edge: '#2a221b' },
      skip: { name: 'Deep Freeze', emoji: '❄️', bg: '#2f9ecf', edge: '#0f3d4d' },
      attack: { name: 'Fracture', emoji: '⚡', bg: '#d9691f', edge: '#5c2a0c' },
      shuffle: { name: 'Prism Spin', emoji: '🌀', bg: '#8352c9', edge: '#2f1a52' },
      peek: { name: 'Farsight', emoji: '🔮', bg: '#5b4fc4', edge: '#211a4d' },
      swap: { name: 'Gem Trade', emoji: '💠', bg: '#c9a227', edge: '#4d3b0d' },
      'critter-fox': { name: 'Diamond Fox', emoji: '💎', bg: '#3d7ac9', edge: '#173154' },
      'critter-owl': { name: 'Sapphire Owl', emoji: '🔷', bg: '#2a5fa0', edge: '#102540' },
      'critter-squirrel': { name: 'Topaz Squirrel', emoji: '🔶', bg: '#c9821f', edge: '#54360c' },
      'critter-hedgehog': { name: 'Amber Hedgehog', emoji: '🔸', bg: '#b5702a', edge: '#4a2d10' },
      'critter-turtle': { name: 'Geode Turtle', emoji: '🧊', bg: '#3d9c9c', edge: '#173d3d' },
    },
  },
  {
    id: 'cryptids',
    name: 'Cryptids Pack',
    icon: '🦶',
    description: 'A full deck of blurry-photograph folklore, action cards included.',
    requirement: 'Play 5 games.',
    isUnlocked: (stats) => stats.gamesPlayed >= 5,
    cardArt: {
      kaboom: { name: 'Abduction', emoji: '🛸', bg: '#2a5c3a', edge: '#0f2415' },
      shield: { name: 'Tinfoil Hat', emoji: '🧢', bg: '#6b6b6b', edge: '#2a2a2a' },
      skip: { name: 'Vanish Into Fog', emoji: '🌫️', bg: '#5c6a6a', edge: '#242c2c' },
      attack: { name: 'Howl', emoji: '🌕', bg: '#4a4a6a', edge: '#1c1c2c' },
      shuffle: { name: 'Static', emoji: '📼', bg: '#5c3a2a', edge: '#241711' },
      peek: { name: 'Trail Cam', emoji: '📸', bg: '#3a4a5c', edge: '#171d24' },
      swap: { name: 'Cross Paths', emoji: '🐾', bg: '#8a6a3d', edge: '#382b19' },
      'critter-fox': { name: 'Bigfoot', emoji: '🦶', bg: '#5c4a33', edge: '#241d14' },
      'critter-owl': { name: 'Mothman', emoji: '🦇', bg: '#3d3d3d', edge: '#161616' },
      'critter-squirrel': { name: 'Jackalope', emoji: '🐇', bg: '#8a6a3d', edge: '#382b19' },
      'critter-hedgehog': { name: 'Chupacabra', emoji: '👹', bg: '#5c2a5c', edge: '#241124' },
      'critter-turtle': { name: 'Nessie', emoji: '🐍', bg: '#2a5c4a', edge: '#11241d' },
    },
  },
  {
    id: 'special',
    name: 'Special Edition',
    icon: '✨',
    description: 'Foil-stamped gold variants of the entire deck for true champions.',
    requirement: 'Win 5 games.',
    isUnlocked: (stats) => stats.gamesWon >= 5,
    cardArt: {
      kaboom: { name: 'Golden Kaboom', emoji: '💥', bg: '#a9821f', edge: '#4d3b0d' },
      shield: { name: 'Golden Shield', emoji: '🛡️', bg: '#a9821f', edge: '#4d3b0d' },
      skip: { name: 'Golden Skip', emoji: '⏭️', bg: '#a9821f', edge: '#4d3b0d' },
      attack: { name: 'Golden Double', emoji: '⚔️', bg: '#a9821f', edge: '#4d3b0d' },
      shuffle: { name: 'Golden Shuffle', emoji: '🔀', bg: '#a9821f', edge: '#4d3b0d' },
      peek: { name: 'Golden Peek', emoji: '🔮', bg: '#a9821f', edge: '#4d3b0d' },
      swap: { name: 'Golden Swap', emoji: '🤝', bg: '#a9821f', edge: '#4d3b0d' },
      'critter-fox': { name: 'Golden Fox', emoji: '🦊', bg: '#a9821f', edge: '#4d3b0d' },
      'critter-owl': { name: 'Golden Owl', emoji: '🦉', bg: '#a9821f', edge: '#4d3b0d' },
      'critter-squirrel': { name: 'Golden Squirrel', emoji: '🐿️', bg: '#a9821f', edge: '#4d3b0d' },
      'critter-hedgehog': { name: 'Golden Hedgehog', emoji: '🦔', bg: '#a9821f', edge: '#4d3b0d' },
      'critter-turtle': { name: 'Golden Turtle', emoji: '🐢', bg: '#a9821f', edge: '#4d3b0d' },
    },
  },
]

export function getUnlockedPackIds(stats) {
  return PACKS.filter(p => p.isUnlocked(stats)).map(p => p.id)
}

export function getActivePackId() {
  try {
    const id = localStorage.getItem(ACTIVE_PACK_KEY)
    if (id && PACKS.some(p => p.id === id)) return id
  } catch { /* storage unavailable */ }
  return 'woodland'
}

export function setActivePackId(id) {
  try { localStorage.setItem(ACTIVE_PACK_KEY, id) } catch { /* storage unavailable */ }
}

// Merges a pack's cosmetic override onto the base card definition —
// every one of the 12 card types can be reskinned, not just the critters.
export function getCardDef(type, packId) {
  const base = CARD_TYPES[type]
  const pack = PACKS.find(p => p.id === packId)
  const override = pack?.cardArt?.[type]
  return override ? { ...base, ...override } : base
}
