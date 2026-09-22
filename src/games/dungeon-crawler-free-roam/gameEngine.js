// ── Dungeon Crawler Max: Free Roam — pure game logic ────────────────────
// No THREE/DOM in here (matches this hub's other 3D games — see
// loot-and-scoot/gameEngine.js, dog-man-dash/worldEngine.js): everything
// is plain data in world (x, z) coordinates, mutated in place each frame.
// The component owns rendering and reads this state straight from refs.
//
// One floor is active at a time: a big, empty, foggy plane (no rooms, no
// walls, no house-shaped buildings) with monsters roaming it, a handful
// of chests, and exactly one staircase hidden far from spawn. Reaching it
// generates a fresh floor and moves you there — see descendStaircase().
// The final floor (TOTAL_FLOORS) has no staircase: its boss guards the
// way out, and beating it wins the show.

import {
  WORLD_HALF, PLAYER_RADIUS, MOVE_SPEED, TURN_SPEED, PITCH_LIMIT,
  ATTACK_REACH, ATTACK_ARC_R, ATTACK_DURATION, ATTACK_COOLDOWN,
  POTION_COOLDOWN, INVULN_TIME, KNOCKOUT_INVULN,
  STAIRCASE_MIN_DIST, STAIRCASE_TRIGGER_R, STAIRCASE_DISCOVERY_R, TOTAL_FLOORS, CLASS_RACE_FLOOR,
  FLOOR_MOB_BASE, FLOOR_MOB_MAX, FLOOR_FLASH_TIME, AUTOSAVE_INTERVAL,
  MAX_MANA, MANA_REGEN, SPELL_SPEED, SPELL_RADIUS, SPELL_LIFE, MAX_SPELL_LEVEL,
  SAFE_ZONE_HOME_RADIUS, CRAWLER_BASE_COUNT, CRAWLER_MAX_COUNT, CRAWLER_AGGRO, CRAWLER_LEASH,
  MINI_DUNGEON_COUNT_BASE, MINI_DUNGEON_COUNT_MAX, MINI_DUNGEON_SIZE, MINI_DUNGEON_WALL_THICKNESS,
  MINI_DUNGEON_DOOR_WIDTH, MINI_DUNGEON_MIN_SEP, MINI_DUNGEON_DISCOVER_R,
  PET_TAME_BASE_COUNT, PET_TAME_MAX_COUNT, PET_TAME_RADIUS, PET_XP_SHARE, PET_FOLLOW_DIST,
  PET_ENGAGE_RADIUS, PET_ATTACK_COOLDOWN, PET_MAX_LEVEL_BONUS_STEPS,
  VILLAGE_START_FLOOR, VILLAGE_MIN_DIST, VILLAGE_MAX_DIST, VILLAGE_SAFE_RADIUS, VILLAGE_MIN_SEP_FROM_OTHER,
} from './constants.js'

const EMPTY_RECTS = []

// ── Content ──────────────────────────────────────────────────────────
// Each floor's flavor (colors, monster pool, boss) cycles through this
// list, looping back to the start if TOTAL_FLOORS ever grows past it —
// but the difficulty (tierMult, loot tier) always scales with the floor
// number itself, never wraps, so floor 19 is never weaker than floor 18.
export const DUNGEON_THEMES = [
  { name: 'The Slime Pits', wallColor: '#6b4a30', floorColor: '#4a3222', accent: '#e0b060', monsterPool: ['slime', 'rat', 'fly'], boss: 'oozeking' },
  { name: 'The Goblin Den', wallColor: '#4a3a6b', floorColor: '#3a2b52', accent: '#b39dff', monsterPool: ['goblin', 'kobold', 'rat'], boss: 'goblinking' },
  { name: 'The Bat Belfry', wallColor: '#333d5c', floorColor: '#232c47', accent: '#7fa6ff', monsterPool: ['bat', 'spider', 'fly'], boss: 'bartholomew' },
  { name: 'The Bone Crypts', wallColor: '#4a4a4a', floorColor: '#333333', accent: '#e8dcb8', monsterPool: ['skeleton', 'ghost', 'kobold'], boss: 'bonesmcgee' },
  { name: "The Ogre's Hold", wallColor: '#6b3050', floorColor: '#451a35', accent: '#ff9fcf', monsterPool: ['skeleton', 'goblin', 'bat', 'ghost'], boss: 'ogrewarlord' },
  { name: 'The Beast Pit', wallColor: '#5c2a3a', floorColor: '#3a1a26', accent: '#ff6b8a', monsterPool: ['boar', 'rat', 'fly'], boss: 'boarchampion' },
  { name: 'The Hall of Mirrors', wallColor: '#3a4a6b', floorColor: '#232f47', accent: '#9fd6ff', monsterPool: ['mirrorwraith', 'bat', 'ghost'], boss: 'mirrorqueen' },
  { name: 'The Crystal Grotto', wallColor: '#6b3a6b', floorColor: '#452a45', accent: '#ffb3ec', monsterPool: ['crystalsprite', 'slime', 'kobold'], boss: 'crystalwarden' },
  { name: 'The Rusted Battlements', wallColor: '#4a4a3a', floorColor: '#2f2f22', accent: '#d4c07a', monsterPool: ['ironwheel', 'skeleton', 'spider'], boss: 'ironwraith' },
  { name: 'The Sunken Grotto', wallColor: '#1a4a5c', floorColor: '#0f2f3a', accent: '#5cd6e8', monsterPool: ['reefsprite', 'fly', 'kobold'], boss: 'krakenspawn' },
  { name: 'The Stampede Flats', wallColor: '#3a3a3a', floorColor: '#232323', accent: '#ffcf40', monsterPool: ['wildcharger', 'rat', 'boar'], boss: 'brambleroller' },
  { name: 'The Haunted Hayride', wallColor: '#4a3020', floorColor: '#2f1e14', accent: '#ff9a4d', monsterPool: ['scarecrow', 'ghost', 'skeleton'], boss: 'scarecrowsovereign' },
  { name: 'The Ember Vault', wallColor: '#2a2a4a', floorColor: '#1a1a2f', accent: '#ffe45c', monsterPool: ['sparkimp', 'bat', 'crystalsprite'], boss: 'emberwarden' },
  { name: 'The Hall of Shattered Glass', wallColor: '#5c2a5c', floorColor: '#3a1a3a', accent: '#ff5cf0', monsterPool: ['glarewisp', 'spider', 'mirrorwraith'], boss: 'glarewraith' },
  { name: "The Beastmaster's Arena", wallColor: '#3a5c2a', floorColor: '#233a1a', accent: '#c8ff5c', monsterPool: ['arenabeast', 'goblin', 'crystalsprite'], boss: 'arenachampion' },
  { name: 'The Vault of Champions', wallColor: '#5c4a1a', floorColor: '#3a2f0f', accent: '#ffd700', monsterPool: ['guardianstatue', 'skeleton', 'ironwheel'], boss: 'silverguardian' },
  { name: "The Watcher's Spire", wallColor: '#1a2a3a', floorColor: '#0f1a24', accent: '#5c9aff', monsterPool: ['spyingeye', 'ghost', 'glarewisp'], boss: 'allseeingeye' },
  { name: "The World Serpent's Lair", wallColor: '#3a1a4a', floorColor: '#24102f', accent: '#ffffff', monsterPool: ['spyingeye', 'guardianstatue', 'arenabeast'], boss: 'worldserpent' },
]

export const MONSTER_DEFS = {
  slime: { name: 'Slime', kind: 'ooze', color: '#6BE86B', accent: '#2E7D32', r: 0.7, hp: 16, atk: 3, speed: 2.4, xp: 8 },
  rat: { name: 'Giant Rat', kind: 'beast', color: '#8a7460', accent: '#3a2f26', r: 0.6, hp: 12, atk: 2, speed: 4.2, xp: 7 },
  fly: { name: 'Carrion Fly', kind: 'flyer', variant: 'insect', color: '#4a4a5a', accent: '#9ad1ff', r: 0.5, hp: 9, atk: 2, speed: 3.6, xp: 6 },
  goblin: { name: 'Goblin', kind: 'humanoid', variant: 'goblin', color: '#5fae4a', accent: '#2f5c26', r: 0.7, hp: 20, atk: 4, speed: 2.6, xp: 10 },
  kobold: { name: 'Kobold', kind: 'humanoid', variant: 'small', color: '#b0603e', accent: '#6e3620', r: 0.6, hp: 11, atk: 2, speed: 4.6, xp: 6 },
  bat: { name: 'Cave Bat', kind: 'flyer', variant: 'bat', color: '#4a3a5a', accent: '#c9a6ff', r: 0.6, hp: 14, atk: 3, speed: 5.0, xp: 9 },
  spider: { name: 'Giant Spider', kind: 'arachnid', color: '#2a1f30', accent: '#ff5566', r: 0.6, hp: 13, atk: 3, speed: 3.2, xp: 8 },
  skeleton: { name: 'Skeleton Warrior', kind: 'humanoid', variant: 'bone', color: '#e8dcc0', accent: '#2a2a2a', r: 0.75, hp: 24, atk: 5, speed: 2.3, xp: 12 },
  ghost: { name: 'Restless Spirit', kind: 'spectral', color: '#cfe8ff', accent: '#7fa6ff', r: 0.7, hp: 18, atk: 4, speed: 2.8, xp: 10 },
  boar: { name: 'Wild Boar', kind: 'beast', variant: 'boar', color: '#7a5238', accent: '#e8e8e8', r: 0.7, hp: 18, atk: 4, speed: 4.0, xp: 9 },
  mirrorwraith: { name: 'Mirror Wraith', kind: 'spectral', variant: 'mirror', color: '#cfe0ff', accent: '#ffffff', r: 0.6, hp: 14, atk: 3, speed: 3.4, xp: 8 },
  crystalsprite: { name: 'Crystal Sprite', kind: 'orb', color: '#ff9fe0', accent: '#ffffff', r: 0.6, hp: 15, atk: 3, speed: 3.0, xp: 9 },
  ironwheel: { name: 'Iron Wheel Construct', kind: 'golem', variant: 'rust', color: '#a05a30', accent: '#ffcf80', r: 0.75, hp: 22, atk: 4, speed: 2.2, xp: 10 },
  reefsprite: { name: 'Reef Sprite', kind: 'flyer', variant: 'insect', color: '#2a8fa0', accent: '#bff5ff', r: 0.5, hp: 11, atk: 2, speed: 4.4, xp: 7 },
  wildcharger: { name: 'Wild Charger', kind: 'beast', variant: 'wolf', color: '#4a4a52', accent: '#e8e8e8', r: 0.7, hp: 19, atk: 4, speed: 5.2, xp: 10 },
  scarecrow: { name: 'Animated Scarecrow', kind: 'humanoid', variant: 'scarecrow', color: '#c9a860', accent: '#8a5a30', r: 0.75, hp: 23, atk: 5, speed: 2.4, xp: 11 },
  sparkimp: { name: 'Spark Imp', kind: 'imp', variant: 'fire', color: '#ff6b4a', accent: '#ffd34d', r: 0.6, hp: 16, atk: 4, speed: 3.6, xp: 10 },
  glarewisp: { name: 'Glare Wisp', kind: 'orb', color: '#c96bff', accent: '#ffffff', r: 0.55, hp: 14, atk: 3, speed: 4.0, xp: 9 },
  arenabeast: { name: 'Arena Beast', kind: 'beast', color: '#c08a3a', accent: '#5a3a1a', r: 0.8, hp: 25, atk: 5, speed: 2.6, xp: 12 },
  guardianstatue: { name: 'Guardian Statue', kind: 'golem', color: '#8a8a8a', accent: '#ffd700', r: 0.75, hp: 23, atk: 5, speed: 2.5, xp: 12 },
  spyingeye: { name: 'Spying Eye', kind: 'orb', variant: 'eye', color: '#5c9aff', accent: '#ffffff', r: 0.6, hp: 17, atk: 4, speed: 3.2, xp: 10 },
}

export const BOSS_DEFS = {
  oozeking: { name: 'Glutton, the Ooze King', kind: 'ooze', color: '#6BE86B', accent: '#FFD34D', crown: true, r: 1.5, hp: 120, atk: 7, speed: 2.0, xp: 70 },
  goblinking: { name: 'The Goblin King', kind: 'humanoid', variant: 'goblin', color: '#4a8f3a', accent: '#FFD34D', crown: true, r: 1.5, hp: 160, atk: 9, speed: 2.3, xp: 110 },
  bartholomew: { name: 'Bartholomew, the Elder Bat', kind: 'flyer', variant: 'bat', color: '#3a2a4a', accent: '#c9a6ff', r: 1.5, hp: 190, atk: 10, speed: 3.6, xp: 150 },
  bonesmcgee: { name: 'Bones McGee, the Bone Reaper', kind: 'humanoid', variant: 'bone', color: '#e8dcc0', accent: '#2a2a2a', scythe: true, r: 1.6, hp: 220, atk: 12, speed: 2.4, xp: 190 },
  ogrewarlord: { name: 'The Ogre Warlord', kind: 'humanoid', variant: 'ogre', color: '#6a7a4a', accent: '#2f3a20', bulky: true, r: 1.7, hp: 300, atk: 15, speed: 2.6, xp: 300 },
  boarchampion: { name: 'The Tusked Champion', kind: 'beast', variant: 'boar', color: '#7a5238', accent: '#ffffff', r: 1.5, hp: 345, atk: 17, speed: 3.8, xp: 207 },
  mirrorqueen: { name: 'The Shattered Reflection', kind: 'humanoid', variant: 'shadow', color: '#cfe0ff', accent: '#ffffff', crown: true, r: 1.5, hp: 390, atk: 19, speed: 2.6, xp: 234 },
  crystalwarden: { name: 'The Crystal Warden', kind: 'golem', variant: 'crystal', color: '#e08fd0', accent: '#ffffff', r: 1.6, hp: 435, atk: 21, speed: 2.2, xp: 261 },
  ironwraith: { name: 'The Iron Wraith', kind: 'golem', variant: 'rust', color: '#8a5a2a', accent: '#ffcf80', r: 1.7, hp: 480, atk: 23, speed: 2.0, xp: 288 },
  krakenspawn: { name: 'The Kraken Spawn', kind: 'serpent', heads: 4, color: '#1a6b7a', accent: '#8fe8ff', r: 1.6, hp: 525, atk: 25, speed: 2.8, xp: 315 },
  brambleroller: { name: 'The Bramble Roller', kind: 'plant', variant: 'tumbleweed', color: '#8a6a30', accent: '#c8ff5c', r: 1.5, hp: 570, atk: 27, speed: 4.2, xp: 342 },
  scarecrowsovereign: { name: 'The Scarecrow Sovereign', kind: 'humanoid', variant: 'scarecrow', color: '#c9a860', accent: '#8a5a30', bulky: true, r: 1.7, hp: 615, atk: 29, speed: 2.4, xp: 369 },
  emberwarden: { name: 'The Ember Warden', kind: 'imp', variant: 'fire', demon: true, color: '#ff5533', accent: '#ffd34d', r: 1.6, hp: 660, atk: 31, speed: 3.0, xp: 396 },
  glarewraith: { name: 'The Glare Wraith', kind: 'orb', variant: 'eye', color: '#c96bff', accent: '#ffffff', r: 1.6, hp: 705, atk: 33, speed: 3.2, xp: 423 },
  arenachampion: { name: 'The Arena Champion', kind: 'beast', variant: 'wolf', chimera: true, color: '#c08a3a', accent: '#5a3a1a', r: 1.8, hp: 750, atk: 35, speed: 2.4, xp: 450 },
  silverguardian: { name: 'The Silver Guardian', kind: 'golem', variant: 'gold', color: '#9a9aa5', accent: '#cfe8ff', r: 1.7, hp: 795, atk: 37, speed: 2.6, xp: 477 },
  allseeingeye: { name: 'The All-Seeing Eye', kind: 'orb', variant: 'eye', color: '#5c9aff', accent: '#ffffff', r: 1.7, hp: 840, atk: 39, speed: 2.8, xp: 504 },
  worldserpent: { name: 'The World Serpent', kind: 'serpent', heads: 5, color: '#6b2ab8', accent: '#ff5566', r: 2.0, hp: 1700, atk: 55, speed: 3.0, xp: 950 },
}

export const WEAPONS = [
  { name: 'Wobbly Stick', emoji: '🥢', atk: 2 },
  { name: 'Rusty Spoon', emoji: '🥄', atk: 4 },
  { name: 'Squeaky Wand', emoji: '🪄', atk: 6 },
  { name: 'Foam Sword', emoji: '🗡️', atk: 9 },
  { name: 'Laser Pointer', emoji: '🔦', atk: 13 },
  { name: 'Giant Serving Spoon', emoji: '🍴', atk: 18 },
  { name: 'Star Wand of Destiny', emoji: '✨', atk: 24 },
  { name: 'Frying Pan of Justice', emoji: '🍳', atk: 31 },
  { name: 'Boomerang Spatula', emoji: '🪃', atk: 39 },
  { name: 'Confetti Cannon', emoji: '🎉', atk: 48 },
  { name: 'Nunchaku of Pool Noodles', emoji: '🏊', atk: 58 },
  { name: 'The Mop of Many Legends', emoji: '🧹', atk: 69 },
  { name: 'Inflatable Comet Hammer', emoji: '☄️', atk: 81 },
  { name: 'Disco Ball Mace', emoji: '🪩', atk: 94 },
  { name: 'Rubber Chicken of Doom', emoji: '🐔', atk: 108 },
  { name: 'The Grand Piano Gauntlet', emoji: '🎹', atk: 123 },
  { name: 'Kazoo of Ultimate Destiny', emoji: '🎺', atk: 139 },
  { name: "The Producer's Golden Microphone", emoji: '🎤', atk: 156 },
]
export const ARMORS = [
  { name: 'Fuzzy Pajamas', emoji: '🩳', def: 1 },
  { name: 'Rubber Raincoat', emoji: '🧥', def: 2 },
  { name: 'Cooking Pot Helmet', emoji: '🥘', def: 4 },
  { name: 'Trash Can Lid Shield', emoji: '🛡️', def: 6 },
  { name: 'Bubble Wrap Armor', emoji: '🫧', def: 9 },
  { name: 'Cardboard Knight Armor', emoji: '📦', def: 13 },
  { name: 'Golden Nightlight Armor', emoji: '🌟', def: 18 },
  { name: 'Oven Mitt Gauntlets', emoji: '🧤', def: 24 },
  { name: 'Traffic Cone Helmet', emoji: '🚧', def: 31 },
  { name: 'Bubble Machine Barrier', emoji: '🎐', def: 39 },
  { name: 'Party Balloon Shield', emoji: '🎈', def: 48 },
  { name: 'Bounce House Bodysuit', emoji: '🏰', def: 58 },
  { name: 'Kevlar Pool Noodle Vest', emoji: '🏊', def: 69 },
  { name: 'Mirror Ball Mail', emoji: '🪩', def: 81 },
  { name: 'Velvet Rope Barrier', emoji: '🎀', def: 94 },
  { name: 'VIP Laminate Armor', emoji: '🪪', def: 108 },
  { name: "The Producer's Velvet Robe", emoji: '🥋', def: 123 },
]

// A spell's cost/heal/damage scale with its own level (separate from
// character level) — see levelScale()/manaScale() below. `bolt` is the
// free starter spell (matches this game's original single-spell magic
// bolt exactly); the rest are found as scrolls and learned/leveled up.
// `flavor` is the banner text shown when a cast lands, one entry per power
// tier (novice: level < SPELL_TIER_POTENT, potent: < SPELL_TIER_LEGENDARY,
// legendary: the rest) — the same spell reads as a completely different
// event depending how leveled up it is, e.g. a level-1 Fireball is "a
// little flame" but a maxed one is described as erupting like a volcano.
export const SPELLS = [
  {
    id: 'bolt', name: 'Magic Bolt', emoji: '🔮', kind: 'projectile', baseCost: 14, cooldown: 0.5, baseDamage: 6, splashRadius: 0,
    flavor: ['A faint spark of arcane force.', 'A crackling bolt punches clean through.', '⚡ A lightning-mage\'s ultimate strike!'],
  },
  {
    id: 'fireball', name: 'Fireball', emoji: '🔥', kind: 'projectile', baseCost: 22, cooldown: 1.1, baseDamage: 14, splashRadius: 1.4,
    flavor: ['A little flame — barely a singe.', 'A raging fireball explosion!', '🌋 An eruption fit to wake a volcano!'],
    legendaryEmoji: '🌋',
  },
  {
    id: 'ice', name: 'Ice Shard', emoji: '❄️', kind: 'projectile', baseCost: 16, cooldown: 0.7, baseDamage: 7, splashRadius: 0, slowMult: 0.4, slowTime: 2.0,
    flavor: ['A chilly little shard.', 'A biting lance of glacial ice.', '🧊 An ice age, compressed into one shot!'],
    legendaryEmoji: '🧊',
  },
  {
    id: 'chainzap', name: 'Chain Zap', emoji: '⚡', kind: 'projectile', baseCost: 20, cooldown: 0.9, baseDamage: 5, splashRadius: 2.6,
    flavor: ['A faint, harmless zap.', 'Arcs of chain lightning leap between foes.', '🌩️ A storm-god\'s judgment falls!'],
    legendaryEmoji: '🌩️',
  },
  {
    id: 'snackheal', name: 'Snack Heal', emoji: '🧃', kind: 'heal', baseCost: 18, cooldown: 1.6, baseHeal: 14,
    flavor: ['A small nibble of health.', 'A hearty feast of healing.', '✨ A feast fit for the gods!'],
    legendaryEmoji: '✨',
  },
]
// Cast-based leveling tiers — separate from (but capped by) MAX_SPELL_LEVEL.
export const SPELL_TIER_POTENT = 7
export const SPELL_TIER_LEGENDARY = 14
export function spellTierIndex(level) {
  if (level >= SPELL_TIER_LEGENDARY) return 2
  if (level >= SPELL_TIER_POTENT) return 1
  return 0
}
// XP needed to go from `level` to `level + 1` by casting — grows with
// level so early levels come quickly and the run to 20 is a real grind.
function spellXpNextFor(level) { return 5 + level * 2 }
const SPELL_CAST_XP = 2
function mkSpellEntry(id) { return { id, level: 1, xp: 0, xpNext: spellXpNextFor(1) } }
// Any direct level change (a chest scroll, the Enchanter) resets cast
// progress toward the *next* level rather than leaving stale xp/xpNext
// numbers from before the jump.
function resetSpellXp(known) { known.xp = 0; known.xpNext = spellXpNextFor(known.level) }
function grantSpellTierAchievements(state, level) {
  if (level >= SPELL_TIER_LEGENDARY) grantAchievement(state, 'spellmaster')
  if (level >= MAX_SPELL_LEVEL) grantAchievement(state, 'archmage')
}

// Ten classes, ten races — a hundred possible combinations. Deltas are
// flat additions to the player's base stats, applied once in
// chooseClassRace() below.
export const CLASSES = [
  { id: 'warrior', name: 'Warrior', emoji: '⚔️', desc: 'Melee-focused — extra attack, extra HP.', atk: 3, def: 1, hp: 10, mana: 0, speedMult: 1 },
  { id: 'mage', name: 'Mage', emoji: '🪄', desc: 'Glass-cannon spellcaster — big mana pool, less HP.', atk: -1, def: 0, hp: -6, mana: 20, speedMult: 1 },
  { id: 'rogue', name: 'Rogue', emoji: '🗡️', desc: 'Fast and balanced, with a little mana to spare.', atk: 1, def: 0, hp: 0, mana: 5, speedMult: 1.15 },
  { id: 'cleric', name: 'Cleric', emoji: '💖', desc: 'Tanky support — extra defense and mana.', atk: 0, def: 2, hp: 6, mana: 10, speedMult: 1 },
  { id: 'ranger', name: 'Ranger', emoji: '🏹', desc: 'Quick and precise — solid attack with a dash of mana.', atk: 2, def: 0, hp: 2, mana: 6, speedMult: 1.1 },
  { id: 'paladin', name: 'Paladin', emoji: '🛡️', desc: 'Holy tank — heavy defense, a little magic to spare.', atk: 1, def: 3, hp: 8, mana: 6, speedMult: 0.95 },
  { id: 'necromancer', name: 'Necromancer', emoji: '💀', desc: 'Commands dark magic — huge mana pool, very fragile.', atk: 0, def: -1, hp: -8, mana: 24, speedMult: 1 },
  { id: 'bard', name: 'Bard', emoji: '🎵', desc: 'Charismatic all-rounder — decent mana and speed.', atk: 0, def: 0, hp: 2, mana: 14, speedMult: 1.1 },
  { id: 'monk', name: 'Monk', emoji: '🥋', desc: 'Disciplined brawler — fast, balanced, hits hard.', atk: 2, def: 1, hp: 4, mana: 2, speedMult: 1.2 },
  { id: 'berserker', name: 'Berserker', emoji: '🪓', desc: 'All offense, no defense — huge attack, fragile.', atk: 5, def: -2, hp: 4, mana: 0, speedMult: 1.05 },
]
export const RACES = [
  { id: 'human', name: 'Human', emoji: '🧑', desc: 'Balanced all-around.', atk: 1, def: 1, hp: 4, mana: 4, speedMult: 1, goldMult: 1 },
  { id: 'elf', name: 'Elf', emoji: '🧝', desc: 'Extra mana and speed, but fragile.', atk: 0, def: 0, hp: -4, mana: 12, speedMult: 1.1, goldMult: 1 },
  { id: 'dwarf', name: 'Dwarf', emoji: '🧔', desc: 'Tanky and tough, but a little slow.', atk: 0, def: 2, hp: 10, mana: 0, speedMult: 0.92, goldMult: 1 },
  { id: 'hamsterkin', name: 'Hamsterkin', emoji: '🐹', desc: 'Fast and lucky with gold — small, quick, and always finds the shiny stuff.', atk: -1, def: 0, hp: 0, mana: 0, speedMult: 1.2, goldMult: 1.2 },
  { id: 'orc', name: 'Orc', emoji: '🟢', desc: 'Powerful and tough, but a bit slower.', atk: 3, def: 1, hp: 6, mana: 0, speedMult: 0.95, goldMult: 1 },
  { id: 'gnome', name: 'Gnome', emoji: '🎩', desc: 'Clever and quick with plenty of mana, but frail.', atk: -1, def: 0, hp: -4, mana: 14, speedMult: 1.1, goldMult: 1 },
  { id: 'catfolk', name: 'Catfolk', emoji: '🐱', desc: 'Quick and agile — extra attack and speed, a bit fragile.', atk: 2, def: 0, hp: -2, mana: 2, speedMult: 1.25, goldMult: 1 },
  { id: 'turtlefolk', name: 'Turtlefolk', emoji: '🐢', desc: 'Extremely tough and defensive, but very slow.', atk: 0, def: 4, hp: 14, mana: 0, speedMult: 0.8, goldMult: 1 },
  { id: 'fairy', name: 'Fairy', emoji: '🧚', desc: 'Tiny and magical — huge mana, very fragile.', atk: -1, def: -1, hp: -8, mana: 16, speedMult: 1.15, goldMult: 1.1 },
  { id: 'golemkin', name: 'Golemkin', emoji: '🗿', desc: 'Built like a tank — high attack and defense, slow.', atk: 2, def: 3, hp: 12, mana: 0, speedMult: 0.85, goldMult: 1 },
]

export const ACHIEVEMENTS = [
  { id: 'contestant', name: 'Chosen Contestant', desc: 'Step into the world.' },
  { id: 'firstblood', name: 'Slime Time', desc: 'Defeat your first monster.' },
  { id: 'lootgoblin', name: 'Loot Goblin', desc: 'Open 5 chests.' },
  { id: 'goblinslayer', name: 'Goblin Slayer', desc: 'Defeat a Goblin.' },
  { id: 'snackbreak', name: 'Snack Break', desc: 'Drink a potion.' },
  { id: 'stairmaster', name: 'Stairmaster', desc: 'Find your first hidden staircase.' },
  { id: 'bossbeat1', name: 'Big Boss Energy', desc: 'Defeat a floor boss.' },
  { id: 'geared', name: 'Fashionably Equipped', desc: 'Equip a weapon and armor.' },
  { id: 'spellcaster', name: 'Wand Enthusiast', desc: 'Cast your first spell.' },
  { id: 'spellbound', name: 'Spellbound', desc: 'Learn all 5 spells.' },
  { id: 'spellmaster', name: 'Spellmaster', desc: 'Grow a spell into its Legendary tier (level 14).' },
  { id: 'archmage', name: 'Archmage', desc: 'Max out a spell at level 20.' },
  { id: 'oof', name: 'Free Respawn', desc: 'Get knocked out (it happens to everyone).' },
  { id: 'richkid', name: 'Pocket Full of Gold', desc: 'Collect 200 gold.' },
  { id: 'rivalslayer', name: 'Rival Elimination', desc: 'Defeat another contestant.' },
  { id: 'ruinexplorer', name: 'Ruin Explorer', desc: 'Step inside a mini dungeon.' },
  { id: 'mythichunter', name: 'Mythic Hunter', desc: 'Open a Mythic chest.' },
  { id: 'bossbox', name: 'Spoils Of War', desc: 'Open a Boss Box.' },
  { id: 'petpal', name: 'New Best Friend', desc: 'Tame your first pet.' },
  { id: 'petmaxed', name: 'Show Stopper', desc: "Level a pet up to level 10." },
  { id: 'villager', name: 'Welcome To Town', desc: 'Find a village.' },
  { id: 'questdone', name: 'Bounty Hunter', desc: 'Complete a village quest.' },
  { id: 'champion', name: 'Dungeon Champion', desc: 'Defeat the final floor boss and win the show!' },
]

// Other contestants crawling the same floors — hostile to you AND to each
// other, not just scenery. A random pick of these names + a color from
// CRAWLER_COLORS gives each one a distinct look and a name label, same
// visual treatment as a boss.
export const CRAWLER_NAMES = [
  'Big Steve', 'Turbo Greg', 'Dr. Nacho', 'The Great Bethany', 'Kevin the Bold',
  'Sir Reginald', 'Lightning Linda', 'Chad Thunderpants', 'Madame Zsa Zsa', 'Uncle Dave',
  'Countess Waffles', 'Barry the Blade', 'Nova the Ninja', 'Grandpa Gauntlet', 'Pixie Punch',
]
const CRAWLER_COLORS = [
  ['#e0765a', '#7a3020'], ['#5a9ee0', '#20487a'], ['#e0c85a', '#7a6a20'], ['#8a5ae0', '#3a207a'],
  ['#5ae0a0', '#207a4a'], ['#e05a9e', '#7a2050'], ['#a0e05a', '#4a7a20'], ['#e0a05a', '#7a5020'],
]

// ── Pets ─────────────────────────────────────────────────────────────
// Found wandering wild on a floor (see wild-pet generation in
// generateFloor) and tamed just by walking up — no fighting required, a
// deliberately kid-friendly capture mechanic. `role: 'fight'` pets chase
// down nearby threats and deal damage; `role: 'support'` pets never
// leave your side and passively apply their `effect` instead. Both level
// up the same way (see checkPetLevelUp), scaling whichever number
// matters for their role. Reuses the same procedural creature art as
// monsters (see getCreatureTexture in the component) — no new art needed.
export const PET_DEFS = [
  { id: 'sparkling', name: 'Sparkling', kind: 'imp', variant: 'fire', color: '#ff6b4a', accent: '#ffd34d', role: 'fight', baseAtk: 3, speed: 5.5, desc: 'A tiny fire imp that nips at nearby enemies.' },
  { id: 'chomp', name: 'Chomp', kind: 'beast', variant: 'boar', color: '#7a5238', accent: '#e8e8e8', role: 'fight', baseAtk: 5, speed: 4.0, desc: 'A stubborn little boar with a big bite.' },
  { id: 'featherling', name: 'Featherling', kind: 'flyer', variant: 'bat', color: '#4a3a5a', accent: '#c9a6ff', role: 'fight', baseAtk: 2, speed: 6.5, desc: 'Fast and flighty — lands a lot of quick hits.' },
  { id: 'chip', name: 'Chip', kind: 'golem', color: '#8a8a8a', accent: '#ffd700', role: 'fight', baseAtk: 4, speed: 2.6, desc: 'A pebble-sized golem that bonks surprisingly hard.' },
  { id: 'puddle', name: 'Puddle', kind: 'ooze', color: '#6BE86B', accent: '#2E7D32', role: 'support', effect: 'regen', baseAmount: 1.6, desc: 'Slowly heals you just by being nearby.' },
  { id: 'glimmer', name: 'Glimmer', kind: 'orb', color: '#5c9aff', accent: '#ffffff', role: 'support', effect: 'mana', baseAmount: 2.2, desc: 'A drifting orb that speeds up your mana regen.' },
  { id: 'mossy', name: 'Mossy', kind: 'plant', color: '#3d6b34', accent: '#7cff9e', role: 'support', effect: 'defense', baseAmount: 2, desc: 'Its leafy aura softens every hit you take.' },
  { id: 'wisp', name: 'Wisp', kind: 'spectral', color: '#cfe8ff', accent: '#7fa6ff', role: 'support', effect: 'speed', baseAmount: 0.15, desc: 'A friendly spirit that makes your feet lighter.' },
]

// ── Villages ─────────────────────────────────────────────────────────
export const VILLAGE_NAMES = [
  'Snackhaven', 'Port Confetti', 'Lantern Hollow', 'Mudflat Junction', 'New Marvton',
  'Glitterbrook', 'Hushwick', 'Copper Landing', 'Fizzlewood', 'Last Chance Depot',
]

// Fixed-price purchases at the General Store and Blacksmith — separate
// from chest loot's random rolls so a village always offers *something*
// reliable to spend gold on, at whatever tier the current floor allows
// (see lootTierFor). The Enchanter reuses the SPELLS table directly.
export const SHOP_POTION_COST = 15
export const SHOP_PET_TRAIN_COST = 25 // gold per training session for the active pet

export const QUEST_TEMPLATES = [
  { id: 'slay', verb: 'Defeat', noun: 'monsters on this floor', min: 6, max: 12, goldPer: 9, xpPer: 5 },
  { id: 'loot', verb: 'Open', noun: 'chests', min: 2, max: 4, goldPer: 22, xpPer: 9 },
  { id: 'rivals', verb: 'Defeat', noun: 'rival crawlers', min: 1, max: 3, goldPer: 28, xpPer: 12 },
]

export const ANNOUNCER_LINES = {
  welcome: ['Welcome, contestant, to the greatest game show never legally reviewed by anyone!', "Ratings are through the roof, folks — let's get this dungeon crawl started!"],
  floorStart: ['Down another level — the crowd demands more!', 'New floor, new monsters, same excellent snack sponsorship!'],
  bossIntro: ["Ladies and gentlemen, tonight's main event has entered the arena!", 'This is the part viewers wrote in about. Good luck out there!'],
  bossDefeat: ["AND THAT'S A KNOCKOUT! What a show!", 'The crowd goes wild! Somewhere. Probably.'],
  levelUp: ['Our contestant just got stronger — the sponsors are thrilled!', 'Level up! This game show does love a glow-up.'],
  win: ['WE HAVE A CHAMPION, FOLKS!', 'Ladies, gentlemen, and hamsters everywhere — a CHAMPION!'],
  knockout: ['Ooh, that’s gotta sting — but don’t worry, this game show has EXCELLENT insurance!', 'No permanent damage, folks — contestant safety is our SEVENTH priority!'],
  idle: ['This floor is sponsored by Non-Threatening Snacks™.', 'Remember, contestants: hydrate, stretch, and bonk responsibly.', 'Somewhere, a scoreboard is definitely keeping track of this.', 'That staircase won’t find itself, folks!'],
}

// ── Small math helpers ───────────────────────────────────────────────
function rand(a, b) { return a + Math.random() * (b - a) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

// Deterministic PRNG (mulberry32) — each floor is generated from a seed
// derived from its own floor number, so reloading a save regenerates the
// exact same floor layout (monster/chest/staircase placement) instead of
// needing to serialize all of that into the save file.
function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function randR(rng, a, b) { return a + rng() * (b - a) }
function pickR(rng, arr) { return arr[Math.floor(rng() * arr.length)] }

export function pointInBoundsXZ(x, z, b) { return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 }
export function boundsCenterXZ(b) { return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 } }

function createMonster(type, x, z, tierMult, id) {
  const def = MONSTER_DEFS[type]
  return {
    id, type, name: def.name, kind: def.kind, variant: def.variant || null,
    color: def.color, accent: def.accent, x, z, r: def.r,
    hp: Math.round(def.hp * tierMult), maxHp: Math.round(def.hp * tierMult),
    atk: Math.round(def.atk * tierMult), speed: def.speed, xp: Math.round(def.xp * tierMult),
    wanderDir: { x: 0, z: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockZ: 0, knockTimer: 0, slowMult: 1, slowTimer: 0,
    dead: false, removeMe: false, isBoss: false,
    walls: EMPTY_RECTS, homeX: x, homeZ: z, leash: 16, aggro: 14,
  }
}
function createBoss(bossId, x, z, id) {
  const def = BOSS_DEFS[bossId]
  return {
    id, type: bossId, name: def.name, kind: def.kind, variant: def.variant || null,
    color: def.color, accent: def.accent, x, z, r: def.r,
    crown: !!def.crown, bulky: !!def.bulky, chimera: !!def.chimera,
    heads: def.heads || 1, demon: !!def.demon, scythe: !!def.scythe,
    hp: def.hp, maxHp: def.hp, atk: def.atk, speed: def.speed, xp: def.xp,
    wanderDir: { x: 0, z: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockZ: 0, knockTimer: 0, slowMult: 1, slowTimer: 0,
    dead: false, removeMe: false, isBoss: true,
    walls: EMPTY_RECTS, homeX: x, homeZ: z, leash: 999999, aggro: 999999,
  }
}

// A rival contestant — lives in the same `floor.monsters` array as
// everything else (so player attacks/spells and the death/loot pipeline
// just work on it for free), but is driven by updateCrawlerAI instead of
// updateMonsterAI: it hunts players AND other crawlers, never regular
// monsters, so it doesn't disturb this hub's already-tuned monster AI.
function createCrawler(x, z, tierMult, seedIndex, rng) {
  const name = CRAWLER_NAMES[Math.floor(rng() * CRAWLER_NAMES.length)]
  const [color, accent] = CRAWLER_COLORS[seedIndex % CRAWLER_COLORS.length]
  return {
    id: 0, type: 'crawler', name, kind: 'humanoid', variant: 'rival',
    color, accent, x, z, r: 0.85,
    hp: Math.round(34 * tierMult), maxHp: Math.round(34 * tierMult),
    atk: Math.round(5 * tierMult), speed: 3.0, xp: Math.round(18 * tierMult),
    wanderDir: { x: 0, z: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockZ: 0, knockTimer: 0, slowMult: 1, slowTimer: 0,
    dead: false, removeMe: false, isBoss: false, isCrawler: true,
    walls: EMPTY_RECTS, homeX: x, homeZ: z, leash: CRAWLER_LEASH, aggro: CRAWLER_AGGRO,
  }
}

// ── Floor generation ─────────────────────────────────────────────────
// One big empty plane per floor: no rooms, no walls, no house-shaped
// buildings — just monsters, a few chests, and (except on the final
// floor) exactly one staircase hidden well away from the spawn point.
// The whole floor is seeded off its own floor number, so it regenerates
// identically every time you're on it (fresh visit or reloaded save).
function difficultyMultFor(floorIndex) { return 1 + (floorIndex - 1) * 0.32 }
export function lootTierFor(floorIndex) { return Math.min(WEAPONS.length - 1, floorIndex) }

// ── Loot box tiers ───────────────────────────────────────────────────
// Every chest rolls one of these on generation (see rollChestTier below),
// independent of the floor-based gear tier from lootTierFor — this is a
// rarity/reward-size multiplier layered on top, not a replacement for it.
// Order (and names) as specified: low to high value.
export const CHEST_TIERS = [
  { id: 'bronze', name: 'Bronze', color: '#cd7f32', weight: 42, lootMult: 1.0, gearBonus: 0 },
  { id: 'silver', name: 'Silver', color: '#c7c7d1', weight: 27, lootMult: 1.3, gearBonus: 0 },
  { id: 'gold', name: 'Gold', color: '#ffd700', weight: 16, lootMult: 1.7, gearBonus: 1 },
  { id: 'legendary', name: 'Legendary', color: '#ff8c3a', weight: 9, lootMult: 2.2, gearBonus: 2 },
  { id: 'platinum', name: 'Platinum', color: '#8fe3ff', weight: 4, lootMult: 2.8, gearBonus: 3 },
  { id: 'mythic', name: 'Mythic', color: '#ff5cf0', weight: 2, lootMult: 3.6, gearBonus: 4 },
]
// Weighted pick, optionally restricted to tiers at or above `minIdx` (used
// by the mini dungeon's guaranteed chest so it's always at least Gold).
function rollChestTier(rng, minIdx = 0) {
  const pool = CHEST_TIERS.slice(minIdx)
  const total = pool.reduce((sum, t) => sum + t.weight, 0)
  let roll = rng() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= pool[i].weight
    if (roll <= 0) return minIdx + i
  }
  return CHEST_TIERS.length - 1
}

// A chest's theme decides WHAT kind of reward it guarantees — tier (above)
// decides how good that reward is. The boss theme is never rolled here; a
// boss box is pushed directly onto floor.chests on boss defeat instead.
export const CHEST_THEMES = [
  { id: 'weapon', name: 'Weapon Box', emoji: '⚔️' },
  { id: 'armor', name: 'Armor Box', emoji: '🛡️' },
  { id: 'magic', name: 'Magic Box', emoji: '📜' },
  { id: 'treasure', name: 'Treasure Box', emoji: '💰' },
  { id: 'boss', name: 'Boss Box', emoji: '👑' },
]
const ROLLABLE_THEME_IDS = ['weapon', 'armor', 'magic', 'treasure']
function rollChestTheme(rng, ids = ROLLABLE_THEME_IDS) {
  return ids[Math.floor(rng() * ids.length)]
}

function randomFarPoint(rng, minDist, maxDist) {
  const angle = rng() * Math.PI * 2
  const dist = minDist + rng() * (maxDist - minDist)
  return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist }
}
// A random point kept at least `minSep` from every point already in
// `avoidPoints` — used for mini-dungeon placement so they don't overlap
// each other, the safe zone, or the staircase/boss guard point. Falls
// back to whatever the last attempt found if it can't satisfy that
// within a reasonable number of tries, rather than looping forever.
function pickSeparatedPoint(rng, avoidPoints, minSep, edgeMargin) {
  let x = 0, z = 0, tries = 0
  do {
    x = randR(rng, -WORLD_HALF + edgeMargin, WORLD_HALF - edgeMargin)
    z = randR(rng, -WORLD_HALF + edgeMargin, WORLD_HALF - edgeMargin)
    tries++
  } while (avoidPoints.some(p => Math.hypot(x - p.x, z - p.z) < minSep) && tries < 40)
  return { x, z }
}

// A small open-air ruin: four walls with a doorway gap in one side —
// real collision (see rectBlocked/tryMoveEntity), just far simpler than
// the old full room-and-corridor maze. `w`/`d` are full width/depth,
// `x`/`z` the rect's own center — the same shape rectBlocked expects.
function buildMiniDungeonWalls(cx, cz) {
  const half = MINI_DUNGEON_SIZE / 2
  const t = MINI_DUNGEON_WALL_THICKNESS
  const doorHalf = MINI_DUNGEON_DOOR_WIDTH / 2
  const sideLen = half - doorHalf
  return [
    { x: cx, z: cz - half, w: MINI_DUNGEON_SIZE + t, d: t }, // back wall
    { x: cx + half, z: cz, w: t, d: MINI_DUNGEON_SIZE + t }, // right wall
    { x: cx - half, z: cz, w: t, d: MINI_DUNGEON_SIZE + t }, // left wall
    // front wall, split around the doorway
    { x: cx - (doorHalf + sideLen / 2), z: cz + half, w: sideLen, d: t },
    { x: cx + (doorHalf + sideLen / 2), z: cz + half, w: sideLen, d: t },
  ]
}

function generateFloor(floorIndex) {
  const rng = mulberry32(floorIndex * 104729 + 17)
  const theme = DUNGEON_THEMES[(floorIndex - 1) % DUNGEON_THEMES.length]
  const tierMult = difficultyMultFor(floorIndex)
  const isFinal = floorIndex === TOTAL_FLOORS
  const safeMargin = SAFE_ZONE_HOME_RADIUS + 6

  // The final floor has no staircase — its boss guards the way out, and
  // beating it wins the show instead of moving you further down. Computed
  // before mini dungeons below so they can steer clear of it.
  let staircase = null
  let bossGuardPoint
  if (isFinal) {
    bossGuardPoint = randomFarPoint(rng, STAIRCASE_MIN_DIST * 0.6, WORLD_HALF - 60)
  } else {
    staircase = randomFarPoint(rng, STAIRCASE_MIN_DIST, WORLD_HALF - 40)
    bossGuardPoint = staircase
  }

  // Mini dungeons: build these before anything else gets scattered, so
  // monsters/crawlers/chests below can avoid spawning inside their walls.
  const miniDungeonCount = Math.min(MINI_DUNGEON_COUNT_MAX, MINI_DUNGEON_COUNT_BASE + Math.floor((floorIndex - 1) / 3))
  const miniDungeons = []
  const wallRects = []
  const monsters = []
  const chests = []
  const dungeonAvoid = [{ x: 0, z: 0 }, bossGuardPoint]
  for (let i = 0; i < miniDungeonCount; i++) {
    const p = pickSeparatedPoint(rng, dungeonAvoid, MINI_DUNGEON_MIN_SEP, MINI_DUNGEON_SIZE)
    dungeonAvoid.push(p)
    const walls = buildMiniDungeonWalls(p.x, p.z)
    wallRects.push(...walls)
    miniDungeons.push({ x: p.x, z: p.z, walls, discovered: false })

    // A guaranteed better chest guarded by a couple of tougher monsters —
    // the actual reward for finding one of these, rather than just
    // scenery. Always at least Gold tier (see rollChestTier's minIdx).
    chests.push({
      x: p.x, z: p.z, opened: false, tierIdx: rollChestTier(rng, 2), guaranteed: true,
      // Never a Treasure Box here — a mini dungeon's one guaranteed chest
      // promises real gear or a spell, not a gold/potion consolation.
      theme: rollChestTheme(rng, ['weapon', 'armor', 'magic']),
    })
    const guardCount = 2
    for (let g = 0; g < guardCount; g++) {
      const a = (g / guardCount) * Math.PI * 2 + rng() * 0.6
      const gr = MINI_DUNGEON_SIZE / 2 - 2.5
      const type = pickR(rng, theme.monsterPool)
      const guard = createMonster(type, p.x + Math.cos(a) * gr, p.z + Math.sin(a) * gr, tierMult * 1.5, 0)
      guard.leash = MINI_DUNGEON_SIZE; guard.aggro = 16
      guard.homeX = p.x; guard.homeZ = p.z
      guard.walls = wallRects
      monsters.push(guard)
    }
  }

  // A village — from VILLAGE_START_FLOOR on, every floor has exactly one.
  // Unlike the staircase, this is meant to be *found*: closer to spawn, no
  // fog-defeating trickery needed. It's just a safe zone (see isInSafeZone)
  // with a few decorative shop buildings — see buildVillageShops below for
  // what's actually purchasable there.
  let village = null
  if (floorIndex >= VILLAGE_START_FLOOR) {
    const avoid = [bossGuardPoint, ...miniDungeons]
    let p = { x: 0, z: 0 }, tries = 0
    do {
      p = randomFarPoint(rng, VILLAGE_MIN_DIST, VILLAGE_MAX_DIST)
      tries++
    } while (avoid.some(q => Math.hypot(p.x - q.x, p.z - q.z) < VILLAGE_MIN_SEP_FROM_OTHER) && tries < 40)
    village = { x: p.x, z: p.z, name: pickR(rng, VILLAGE_NAMES), discovered: false }
  }

  const blockedByWalls = (x, z) => rectBlocked(wallRects, x, z, 2)
  const blockedByVillage = (x, z) => village && Math.hypot(x - village.x, z - village.z) < VILLAGE_SAFE_RADIUS + 8

  // Wild, untamed pets — walk up to one to tame it (see tamePet), no
  // fighting required. Fewer than monsters, and never hostile.
  const wildPetCount = Math.min(PET_TAME_MAX_COUNT, PET_TAME_BASE_COUNT + Math.floor((floorIndex - 1) / 3))
  const wildPets = []
  for (let i = 0; i < wildPetCount; i++) {
    let x = 0, z = 0, tries = 0
    do {
      x = randR(rng, -WORLD_HALF + 20, WORLD_HALF - 20)
      z = randR(rng, -WORLD_HALF + 20, WORLD_HALF - 20)
      tries++
    } while ((Math.hypot(x, z) < safeMargin || blockedByWalls(x, z) || blockedByVillage(x, z)) && tries < 30)
    const def = pickR(rng, PET_DEFS)
    wildPets.push({ id: 0, defId: def.id, x, z, tamed: false })
  }

  const monsterCount = Math.min(FLOOR_MOB_MAX, FLOOR_MOB_BASE + (floorIndex - 1) * 4)
  for (let i = 0; i < monsterCount; i++) {
    let x = 0, z = 0, tries = 0
    do {
      x = randR(rng, -WORLD_HALF + 20, WORLD_HALF - 20)
      z = randR(rng, -WORLD_HALF + 20, WORLD_HALF - 20)
      tries++
    } while ((Math.hypot(x, z) < safeMargin || blockedByWalls(x, z)) && tries < 30)
    const type = pickR(rng, theme.monsterPool)
    const m = createMonster(type, x, z, tierMult * randR(rng, 0.85, 1.15), 0)
    m.leash = 22; m.aggro = 12
    m.walls = wallRects
    monsters.push(m)
  }

  // Rival contestants — hostile to players AND to each other. They share
  // the same `monsters` array as everything else (see createCrawler's own
  // comment for why), placed the same way, just fewer of them.
  const crawlerCount = Math.min(CRAWLER_MAX_COUNT, CRAWLER_BASE_COUNT + Math.floor((floorIndex - 1) / 3))
  for (let i = 0; i < crawlerCount; i++) {
    let x = 0, z = 0, tries = 0
    do {
      x = randR(rng, -WORLD_HALF + 25, WORLD_HALF - 25)
      z = randR(rng, -WORLD_HALF + 25, WORLD_HALF - 25)
      tries++
    } while ((Math.hypot(x, z) < safeMargin + 20 || blockedByWalls(x, z)) && tries < 30)
    const crawler = createCrawler(x, z, tierMult * randR(rng, 0.9, 1.2), i, rng)
    crawler.walls = wallRects
    monsters.push(crawler)
  }

  const chestCount = 8 + Math.floor(rng() * 5)
  for (let i = 0; i < chestCount; i++) {
    let x = 0, z = 0, tries = 0
    do {
      x = randR(rng, -WORLD_HALF + 30, WORLD_HALF - 30)
      z = randR(rng, -WORLD_HALF + 30, WORLD_HALF - 30)
      tries++
    } while ((Math.hypot(x, z) < safeMargin || blockedByWalls(x, z)) && tries < 30)
    chests.push({ x, z, opened: false, tierIdx: rollChestTier(rng), guaranteed: false, theme: rollChestTheme(rng) })
  }

  return {
    index: floorIndex, theme, tierMult, isFinal,
    monsters, chests, staircase, bossGuardPoint, miniDungeons, wallRects, village, wildPets,
    bossSpawned: false, bossActive: false, cleared: false, discovered: false,
  }
}

function buildSafeZones(floor) {
  const zones = [{ x: 0, z: 0, r: SAFE_ZONE_HOME_RADIUS, name: 'Home Base' }]
  if (floor.village) zones.push({ x: floor.village.x, z: floor.village.z, r: VILLAGE_SAFE_RADIUS, name: floor.village.name })
  return zones
}
export function isInSafeZone(x, z, safeZones) {
  return safeZones.some(s => Math.hypot(x - s.x, z - s.z) < s.r)
}

// ── Player ───────────────────────────────────────────────────────────
function mkPlayer() {
  return {
    x: 0, z: 0, r: PLAYER_RADIUS, facing: { x: 0, z: -1 },
    level: 1, xp: 0, xpNext: 30,
    baseAtk: 4, baseDef: 0, weaponAtk: 0, armorDef: 0,
    atk: 4, def: 0,
    maxHp: 40, hp: 40,
    maxMana: MAX_MANA, mana: MAX_MANA, spellCooldown: 0,
    spells: [mkSpellEntry('bolt')], equippedSpellId: 'bolt',
    classId: null, raceId: null, speedMult: 1, goldMult: 1,
    gold: 0, potions: 1,
    weaponName: null, armorName: null, weapons: [], armors: [],
    attackCooldown: 0, attackTimer: 0, hitIds: new Set(),
    potionCooldown: 0, invuln: 0,
    pets: [], activePetId: null, nextPetId: 1,
    quest: null, questsCompleted: 0,
  }
}

// ── Save / load ──────────────────────────────────────────────────────
// Only durable player progress is saved — floor layout regenerates
// deterministically from the floor number (see generateFloor above), so
// there's no need to serialize monster/chest/staircase positions. This
// also means resuming a save always drops you onto a *fresh* copy of
// whatever floor you'd reached, in case you'd half-cleared it.
const SAVE_KEY = 'dungeon-crawler-free-roam-save-v1'

function serializePlayer(p) {
  return {
    level: p.level, xp: p.xp, xpNext: p.xpNext,
    baseAtk: p.baseAtk, baseDef: p.baseDef, weaponAtk: p.weaponAtk, armorDef: p.armorDef,
    atk: p.atk, def: p.def,
    maxHp: p.maxHp, hp: p.hp, maxMana: p.maxMana, mana: p.mana,
    spells: p.spells.map(s => ({ ...s })), equippedSpellId: p.equippedSpellId,
    classId: p.classId, raceId: p.raceId, speedMult: p.speedMult, goldMult: p.goldMult,
    gold: p.gold, potions: p.potions,
    weaponName: p.weaponName, armorName: p.armorName,
    weapons: p.weapons.map(w => ({ ...w })), armors: p.armors.map(a => ({ ...a })),
    // Only the durable fields — a pet's live x/z/atkCooldown are runtime
    // state, reset fresh (see activePetInfo's lazy-init) the moment it's
    // active again after a load.
    pets: p.pets.map(pet => ({ id: pet.id, defId: pet.defId, level: pet.level, xp: pet.xp, xpNext: pet.xpNext })),
    activePetId: p.activePetId, nextPetId: p.nextPetId,
    quest: p.quest ? { ...p.quest } : null, questsCompleted: p.questsCompleted,
  }
}
function applySavedPlayer(player, saved) {
  if (!saved) return
  Object.assign(player, saved)
  // A save from before spell-casting-xp existed has entries missing
  // xp/xpNext — backfill them here rather than at every place a spell
  // gets cast, so the rest of the code can assume they're always present.
  player.spells = (saved.spells || [mkSpellEntry('bolt')]).map(s => ({
    ...s, xp: s.xp ?? 0, xpNext: s.xpNext ?? spellXpNextFor(s.level || 1),
  }))
  player.weapons = (saved.weapons || []).map(w => ({ ...w }))
  player.armors = (saved.armors || []).map(a => ({ ...a }))
  player.pets = (saved.pets || []).map(pet => ({ ...pet }))
  player.nextPetId = saved.nextPetId || (player.pets.length + 1)
  player.quest = saved.quest ? { ...saved.quest } : null
  player.questsCompleted = saved.questsCompleted || 0
  player.hitIds = new Set()
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      floorIndex: state.floor.index,
      twoPlayer: state.twoPlayer,
      player: serializePlayer(state.player),
      player2: state.twoPlayer ? serializePlayer(state.player2) : null,
      achievements: [...state.achievements],
      chestsOpened: state.chestsOpened,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch { /* storage unavailable */ }
}
export function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.floorIndex !== 'number') return null
    return data
  } catch { return null }
}
export function hasSavedGame() { return loadSavedGame() != null }
export function clearSavedGame() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* storage unavailable */ }
}

export function mkInitialState(twoPlayer = true, saved = null) {
  const floorIndex = saved ? clamp(saved.floorIndex, 1, TOTAL_FLOORS) : 1
  const floor = generateFloor(floorIndex)
  const safeZones = buildSafeZones(floor)
  let nextId = 0
  for (const m of floor.monsters) m.id = nextId++
  for (const wp of floor.wildPets) wp.id = nextId++

  const twoP = saved ? !!saved.twoPlayer : twoPlayer
  const player = mkPlayer()
  const player2 = mkPlayer()
  player2.x = 1.2
  if (saved) {
    applySavedPlayer(player, saved.player)
    if (twoP && saved.player2) applySavedPlayer(player2, saved.player2)
  }

  const state = {
    floor, player, player2, twoPlayer: twoP, safeZones, inSafeZone: false, inVillage: false,
    floorChanged: true, teleportFlash: 0,
    projectiles: [],
    pendingClassPick: false,
    yaw: 0, pitch: 0.28, nextId,
    particles: [], bannerQueue: [], banner: null, bannerTimer: 0,
    announcerText: pick(ANNOUNCER_LINES.welcome), announcerTimer: 9, announcerIdleCD: 20,
    achievements: new Set(saved ? saved.achievements : []),
    chestsOpened: saved ? (saved.chestsOpened || 0) : 0,
    compass: null, elapsed: 0, autosaveTimer: AUTOSAVE_INTERVAL,
  }
  if (floorIndex >= CLASS_RACE_FLOOR && !player.classId) state.pendingClassPick = true
  return state
}

// Both active players, in a fixed order — used anywhere two-player-aware
// logic needs to check or reposition both at once. In solo mode Player 2
// is inert (never moved, never rendered), so every one of these call
// sites should only ever see Player 1.
export function players(state) { return state.twoPlayer ? [state.player, state.player2] : [state.player] }
function nearestPlayer(state, m) {
  if (!state.twoPlayer) return state.player
  const p1 = state.player, p2 = state.player2
  const d1 = Math.hypot(p1.x - m.x, p1.z - m.z)
  const d2 = Math.hypot(p2.x - m.x, p2.z - m.z)
  return d1 <= d2 ? p1 : p2
}

// ── Event helpers ────────────────────────────────────────────────────
function pushBanner(state, icon, text, color) { state.bannerQueue.push({ icon, text, color: color || '#fff' }) }
function announcerSay(state, key) { state.announcerText = pick(ANNOUNCER_LINES[key]); state.announcerTimer = 7 }
function grantAchievement(state, id) {
  if (state.achievements.has(id)) return
  state.achievements.add(id)
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (def) pushBanner(state, '🏅', `Achievement: ${def.name}`, '#FFD34D')
}
function spawnBurst(state, x, z, count, colors) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = rand(1.5, 4)
    state.particles.push({ x, y: 1.0, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rand(2, 4.5), life: 0.6, maxLife: 0.6, color: pick(colors) })
  }
}

export function markContestant(state) { grantAchievement(state, 'contestant') }

function rectBlocked(rects, x, z, r) {
  for (const b of rects) {
    if (x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 && z + r > b.z - b.d / 2 && z - r < b.z + b.d / 2) return true
  }
  return false
}
function tryMoveEntity(walls, e, dx, dz) {
  if (dx !== 0) { const nx = clamp(e.x + dx, -WORLD_HALF, WORLD_HALF); if (!rectBlocked(walls, nx, e.z, e.r)) e.x = nx }
  if (dz !== 0) { const nz = clamp(e.z + dz, -WORLD_HALF, WORLD_HALF); if (!rectBlocked(walls, e.x, nz, e.r)) e.z = nz }
}

function knockoutPlayer(state, player) {
  pushBanner(state, '💫', 'Knocked out! Free respawn, contestant!', '#FF9E6B')
  announcerSay(state, 'knockout')
  grantAchievement(state, 'oof')
  const p = player
  p.gold = Math.floor(p.gold * 0.8)
  p.x = 0; p.z = 0
  p.hp = Math.floor(p.maxHp * 0.6)
  p.invuln = KNOCKOUT_INVULN
}

function checkLevelUp(state, player) {
  const p = player
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext
    p.level += 1
    p.maxHp += 8
    p.hp = p.maxHp
    p.baseAtk += 1
    p.atk = p.baseAtk + p.weaponAtk
    if (p.level % 2 === 0) { p.baseDef += 1; p.def = p.baseDef + p.armorDef }
    p.xpNext = Math.floor(p.xpNext * 1.35) + 10
    pushBanner(state, '🎉', `Level Up! You are now Level ${p.level}`, '#8FD3FF')
    announcerSay(state, 'levelUp')
  }
}

function triggerWin(state, helpers) {
  grantAchievement(state, 'champion')
  announcerSay(state, 'win')
  helpers.setWinStats({
    level: state.player.level,
    gold: state.player.gold,
    floor: state.floor.index,
    achievements: ACHIEVEMENTS.filter(a => state.achievements.has(a.id)).map(a => a.name),
    totalAchievements: ACHIEVEMENTS.length,
  })
  helpers.setPhase('win')
  clearSavedGame() // the run is complete — the next "Continue" should start fresh
}

function onMonsterDeath(state, player, m, helpers) {
  spawnBurst(state, m.x, m.z, m.isBoss ? 26 : 12, ['#FFD34D', '#FF8FD3', '#8FD3FF', '#B6FF6B'])
  const p = player
  p.xp += m.xp
  p.gold += Math.round(rand(m.xp * 0.6, m.xp * 1.3) * p.goldMult)
  grantPetXp(state, p, m.xp)
  if (!state.achievements.has('firstblood')) grantAchievement(state, 'firstblood')
  if (m.type === 'goblin') grantAchievement(state, 'goblinslayer')
  if (m.isCrawler) {
    grantAchievement(state, 'rivalslayer')
    pushBanner(state, '⚔️', `${m.name} is out of the running!`, '#FF9E6B')
    progressQuest(state, p, 'rivals', 1)
  } else if (!m.isBoss) {
    progressQuest(state, p, 'slay', 1)
  }
  if (Math.random() < 0.1) { p.potions = Math.min(5, p.potions + 1); pushBanner(state, '🧃', 'A snack potion fell out!', '#7CFF6B') }
  if (m.isBoss) {
    const floor = state.floor
    floor.cleared = true
    floor.bossActive = false
    grantAchievement(state, 'bossbeat1')
    pushBanner(state, '🏆', `${m.name} defeated!`, '#FFD34D')
    announcerSay(state, 'bossDefeat')
    // A boss always drops its own Boss Box, right where it fell — always
    // Mythic tier, so it's never a coin-flip whether the fight was worth it.
    floor.chests.push({ x: m.x, z: m.z, opened: false, guaranteed: true, tierIdx: CHEST_TIERS.length - 1, theme: 'boss' })
    if (floor.isFinal) triggerWin(state, helpers)
  }
  if (p.gold >= 200) grantAchievement(state, 'richkid')
  checkLevelUp(state, p)
  m.removeMe = true
}

function damageMonster(state, player, m, dmg, helpers) {
  m.hp -= dmg
  if (m.hp <= 0 && !m.dead) { m.dead = true; onMonsterDeath(state, player, m, helpers) }
}

// Found gear goes to the player's inventory rather than auto-equipping —
// equipping is a deliberate choice made from the Gear panel (see
// equipWeapon/equipArmor below), so the player picks their own loadout
// instead of the chest silently swapping it for them. A duplicate of
// something already owned is just sold on the spot.
function grantWeaponLoot(state, p, floor, tier) {
  const tierBoost = tier.gearBonus + Math.floor(Math.random() * 2)
  const gearTier = Math.min(WEAPONS.length - 1, lootTierFor(floor.index) + tierBoost)
  const w = WEAPONS[gearTier]
  if (p.weapons.some(x => x.name === w.name)) {
    const gold = Math.round(w.atk * 3 * p.goldMult); p.gold += gold
    pushBanner(state, '💰', `Already own ${w.name} — sold the spare for ${gold} gold`, '#FFD34D')
  } else {
    p.weapons.push(w)
    pushBanner(state, w.emoji, `Found ${w.name}! Open Gear (I) to equip it.`, '#8FD3FF')
  }
}
function grantArmorLoot(state, p, floor, tier) {
  const tierBoost = tier.gearBonus + Math.floor(Math.random() * 2)
  const gearTier = Math.min(ARMORS.length - 1, lootTierFor(floor.index) + tierBoost)
  const a = ARMORS[gearTier]
  if (p.armors.some(x => x.name === a.name)) {
    const gold = Math.round(a.def * 3 * p.goldMult); p.gold += gold
    pushBanner(state, '💰', `Already own ${a.name} — sold the spare for ${gold} gold`, '#FFD34D')
  } else {
    p.armors.push(a)
    pushBanner(state, a.emoji, `Found ${a.name}! Open Gear (I) to equip it.`, '#8FD3FF')
  }
}
// A scroll teaches an unknown spell, levels up a known one (by more levels
// at once for a higher chest tier), or — once that spell is already maxed
// — is sold for gold instead (mirrors the weapon/armor "sell the spare"
// branch above).
function grantSpellLoot(state, p, tier) {
  const spell = pick(SPELLS)
  const known = p.spells.find(s => s.id === spell.id)
  if (!known) {
    p.spells.push(mkSpellEntry(spell.id))
    pushBanner(state, spell.emoji, `Learned a new spell: ${spell.name}! Open Gear (I) to equip it.`, '#C9A6FF')
    if (p.spells.length === SPELLS.length) grantAchievement(state, 'spellbound')
  } else if (known.level < MAX_SPELL_LEVEL) {
    known.level = Math.min(MAX_SPELL_LEVEL, known.level + 1 + tier.gearBonus)
    resetSpellXp(known)
    pushBanner(state, spell.emoji, `${spell.name} leveled up! Now level ${known.level}.`, '#C9A6FF')
    grantSpellTierAchievements(state, known.level)
  } else {
    const gold = Math.round((20 + known.level * 10) * p.goldMult); p.gold += gold
    pushBanner(state, '💰', `${spell.name} is already maxed — sold the spare scroll for ${gold} gold`, '#FFD34D')
  }
}
function grantTreasureLoot(state, p, floor, tier) {
  if (Math.random() < 0.6) {
    const amt = Math.round((8 + Math.floor(Math.random() * 10) * (1 + floor.index * 0.5)) * p.goldMult * tier.lootMult)
    p.gold += amt
    pushBanner(state, '🪙', `Found ${amt} gold!`, '#FFD34D')
  } else {
    p.potions = Math.min(5, p.potions + 1)
    pushBanner(state, '🧃', 'Found a snack potion!', '#7CFF6B')
  }
}

function openChest(state, player, c, floor) {
  c.opened = true
  const tier = CHEST_TIERS[c.tierIdx ?? 0]
  const theme = CHEST_THEMES.find(t => t.id === c.theme) || CHEST_THEMES.find(t => t.id === 'treasure')
  spawnBurst(state, c.x, c.z, 8 + (c.tierIdx ?? 0) * 3, ['#FFD34D', '#FFE9B8', tier.color])
  state.chestsOpened += 1
  if (state.chestsOpened === 5) grantAchievement(state, 'lootgoblin')
  if (tier.id === 'mythic') grantAchievement(state, 'mythichunter')
  if (theme.id === 'boss') grantAchievement(state, 'bossbox')
  const p = player
  progressQuest(state, p, 'loot', 1)
  if ((c.tierIdx ?? 0) >= 2) pushBanner(state, theme.emoji, `${tier.name} ${theme.name}!`, tier.color)
  switch (theme.id) {
    case 'weapon':
      grantWeaponLoot(state, p, floor, tier)
      break
    case 'armor':
      grantArmorLoot(state, p, floor, tier)
      break
    case 'magic':
      grantSpellLoot(state, p, tier)
      break
    case 'boss': {
      // The grand prize — a surprise pick among the three "real reward"
      // themes, plus a flat gold bonus on top since this is the boss's
      // own drop rather than just another floor find.
      const pickThemeId = pick(['weapon', 'armor', 'magic'])
      if (pickThemeId === 'weapon') grantWeaponLoot(state, p, floor, tier)
      else if (pickThemeId === 'armor') grantArmorLoot(state, p, floor, tier)
      else grantSpellLoot(state, p, tier)
      const bonus = Math.round((40 + floor.index * 12) * p.goldMult)
      p.gold += bonus
      pushBanner(state, '🪙', `Bonus ${bonus} gold from the boss box!`, '#FFD34D')
      break
    }
    default:
      grantTreasureLoot(state, p, floor, tier)
  }
  if (p.gold >= 200) grantAchievement(state, 'richkid')
}

// Called from the UI when the player picks an owned item from the Gear
// panel — deliberate, player-driven equipping instead of chests
// auto-swapping gear for them.
export function equipWeapon(state, player, item) {
  const p = player
  if (p.weaponName === item.name) return
  p.weaponAtk = item.atk
  p.weaponName = item.name
  p.atk = p.baseAtk + p.weaponAtk
  pushBanner(state, item.emoji, `Equipped ${item.name}! (+${item.atk} ATK)`, '#8FD3FF')
  if (p.weaponName && p.armorName) grantAchievement(state, 'geared')
}
export function equipArmor(state, player, item) {
  const p = player
  if (p.armorName === item.name) return
  p.armorDef = item.def
  p.armorName = item.name
  p.def = p.baseDef + p.armorDef
  pushBanner(state, item.emoji, `Equipped ${item.name}! (+${item.def} DEF)`, '#8FD3FF')
  if (p.weaponName && p.armorName) grantAchievement(state, 'geared')
}
export function equipSpell(state, player, id) {
  const p = player
  if (p.equippedSpellId === id) return
  const spell = SPELLS.find(s => s.id === id)
  p.equippedSpellId = id
  pushBanner(state, spell.emoji, `${spell.name} equipped!`, '#C9A6FF')
}

// The one-time character-creation pick, gated behind reaching
// CLASS_RACE_FLOOR (see descendStaircase/mkInitialState) — applies flat
// stat deltas into the player's *base* stats once, then fully heals to
// the new max so the pick always feels like a power-up, never a surprise
// HP/mana cut. Called once per player (each player picks independently).
export function chooseClassRace(state, player, classId, raceId) {
  const p = player
  if (p.classId) return
  const cls = CLASSES.find(c => c.id === classId)
  const race = RACES.find(r => r.id === raceId)
  p.classId = classId
  p.raceId = raceId
  p.baseAtk += cls.atk + race.atk
  p.baseDef += cls.def + race.def
  p.atk = p.baseAtk + p.weaponAtk
  p.def = p.baseDef + p.armorDef
  p.maxHp += cls.hp + race.hp
  p.hp = p.maxHp
  p.maxMana += cls.mana + race.mana
  p.mana = p.maxMana
  p.speedMult = cls.speedMult * race.speedMult
  p.goldMult = race.goldMult
  pushBanner(state, `${cls.emoji}${race.emoji}`, `You are now a ${race.name} ${cls.name}!`, '#FFD34D')
  saveGame(state)
}

// ── Pets ─────────────────────────────────────────────────────────────
// A level's worth of scaling steps, capped so a pet's numbers don't grow
// forever — matches the spirit of MAX_SPELL_LEVEL capping spells.
function petLevelScale(level) { return 1 + 0.12 * Math.min(level - 1, PET_MAX_LEVEL_BONUS_STEPS) }

export function activePetInfo(player) {
  if (!player.activePetId) return null
  const pet = player.pets.find(p => p.id === player.activePetId)
  if (!pet) return null
  const def = PET_DEFS.find(d => d.id === pet.defId)
  if (!def) return null
  return { pet, def }
}
// Small per-frame/per-hit getters, called from wherever the relevant
// stat is actually used (movement speed, incoming damage) rather than
// baked into the player's cached stats — keeps the pet as the single
// source of truth for its own bonus instead of two things to keep in sync.
export function petSpeedBonus(player) {
  const info = activePetInfo(player)
  return (info && info.def.effect === 'speed') ? info.def.baseAmount * petLevelScale(info.pet.level) : 0
}
export function petDefenseBonus(player) {
  const info = activePetInfo(player)
  return (info && info.def.effect === 'defense') ? info.def.baseAmount * petLevelScale(info.pet.level) : 0
}

function checkPetLevelUp(state, player, pet) {
  const def = PET_DEFS.find(d => d.id === pet.defId)
  let leveled = false
  while (pet.xp >= pet.xpNext) {
    pet.xp -= pet.xpNext
    pet.level += 1
    pet.xpNext = Math.floor(pet.xpNext * 1.3) + 8
    leveled = true
  }
  if (leveled) {
    pushBanner(state, '⭐', `${pet.name || def.name} leveled up! Now level ${pet.level}.`, '#B6FF6B')
    if (pet.level >= 10) grantAchievement(state, 'petmaxed')
  }
}
// Awards a share of a monster kill's xp to a player's active pet — called
// from onMonsterDeath right alongside the player's own xp gain.
function grantPetXp(state, player, xpAmount) {
  const info = activePetInfo(player)
  if (!info) return
  info.pet.xp += Math.round(xpAmount * PET_XP_SHARE)
  checkPetLevelUp(state, player, info.pet)
}

function tamePet(state, player, wildPet) {
  const def = PET_DEFS.find(d => d.id === wildPet.defId)
  const pet = { id: player.nextPetId++, defId: def.id, name: def.name, level: 1, xp: 0, xpNext: 20 }
  player.pets.push(pet)
  if (!player.activePetId) player.activePetId = pet.id
  wildPet.tamed = true
  wildPet.removeMe = true
  grantAchievement(state, 'petpal')
  pushBanner(state, '🐾', `${def.name} the ${def.role === 'fight' ? 'fighter' : 'helper'} joined you!`, '#7CFF9E')
}
// Called from the Gear panel when the player picks an owned pet to make
// active — same deliberate, player-driven pattern as equipWeapon/Armor.
export function setActivePet(state, player, petId) {
  if (!player.pets.some(p => p.id === petId)) return
  player.activePetId = petId
  saveGame(state)
}

function updatePetAI(state, player, dt, helpers) {
  const info = activePetInfo(player)
  if (!info) return
  const { pet, def } = info
  if (pet.x == null) { pet.x = player.x; pet.z = player.z; pet.atkCooldown = 0 }
  if (pet.atkCooldown > 0) pet.atkCooldown -= dt

  if (def.effect === 'regen') player.hp = Math.min(player.maxHp, player.hp + def.baseAmount * petLevelScale(pet.level) * dt)
  if (def.effect === 'mana') player.mana = Math.min(player.maxMana, player.mana + def.baseAmount * petLevelScale(pet.level) * dt)

  let target = null, bd = Infinity
  if (def.role === 'fight') {
    for (const m of state.floor.monsters) {
      if (m.dead) continue
      const d = Math.hypot(m.x - player.x, m.z - player.z)
      if (d < PET_ENGAGE_RADIUS && d < bd) { bd = d; target = m }
    }
  }

  if (target) {
    const dx = target.x - pet.x, dz = target.z - pet.z
    const d = Math.hypot(dx, dz) || 1
    pet.x += (dx / d) * Math.min(def.speed * dt, d)
    pet.z += (dz / d) * Math.min(def.speed * dt, d)
    if (d < target.r + 0.9 && pet.atkCooldown <= 0) {
      pet.atkCooldown = PET_ATTACK_COOLDOWN
      const dmg = Math.max(1, Math.round(def.baseAtk * petLevelScale(pet.level)))
      damageMonster(state, player, target, dmg, helpers)
      pet.xp += 1
      checkPetLevelUp(state, player, pet)
    }
  } else {
    const followX = player.x - player.facing.x * PET_FOLLOW_DIST, followZ = player.z - player.facing.z * PET_FOLLOW_DIST
    const dx = followX - pet.x, dz = followZ - pet.z
    const d = Math.hypot(dx, dz)
    if (d > 0.3) {
      const spd = def.role === 'fight' ? def.speed : 4.5
      pet.x += (dx / d) * Math.min(spd * dt, d)
      pet.z += (dz / d) * Math.min(spd * dt, d)
    }
  }
}

// ── Villages: shops & quests ─────────────────────────────────────────
export function isInVillage(state, player) {
  const v = state.floor.village
  return !!v && Math.hypot(player.x - v.x, player.z - v.z) < VILLAGE_SAFE_RADIUS
}
export function shopBuyPotion(state, player) {
  if (player.gold < SHOP_POTION_COST || player.potions >= 5) return
  player.gold -= SHOP_POTION_COST
  player.potions += 1
  pushBanner(state, '🧃', 'Bought a snack potion!', '#7CFF6B')
  saveGame(state)
}
export function shopBuyWeapon(state, player, floor, index) {
  const w = WEAPONS[index]
  if (!w || index > lootTierFor(floor.index)) return
  const cost = w.atk * 4
  if (player.gold < cost || player.weapons.some(x => x.name === w.name)) return
  player.gold -= cost
  player.weapons.push(w)
  pushBanner(state, w.emoji, `Bought ${w.name}! Open Gear (I) to equip it.`, '#8FD3FF')
  saveGame(state)
}
export function shopBuyArmor(state, player, floor, index) {
  const a = ARMORS[index]
  if (!a || index > lootTierFor(floor.index)) return
  const cost = a.def * 4
  if (player.gold < cost || player.armors.some(x => x.name === a.name)) return
  player.gold -= cost
  player.armors.push(a)
  pushBanner(state, a.emoji, `Bought ${a.name}! Open Gear (I) to equip it.`, '#8FD3FF')
  saveGame(state)
}
export function shopLearnOrLevelSpell(state, player, spellId) {
  const spell = SPELLS.find(s => s.id === spellId)
  const known = player.spells.find(s => s.id === spellId)
  const cost = known ? (known.level + 1) * 12 : 25
  if (known && known.level >= MAX_SPELL_LEVEL) return
  if (player.gold < cost) return
  player.gold -= cost
  if (known) {
    known.level += 1
    resetSpellXp(known)
    pushBanner(state, spell.emoji, `${spell.name} leveled up! Now level ${known.level}.`, '#C9A6FF')
    grantSpellTierAchievements(state, known.level)
  } else {
    player.spells.push(mkSpellEntry(spellId))
    pushBanner(state, spell.emoji, `Learned ${spell.name}! Open Gear (I) to equip it.`, '#C9A6FF')
    if (player.spells.length === SPELLS.length) grantAchievement(state, 'spellbound')
  }
  saveGame(state)
}
export function shopTrainPet(state, player) {
  const info = activePetInfo(player)
  if (!info || player.gold < SHOP_PET_TRAIN_COST) return
  player.gold -= SHOP_PET_TRAIN_COST
  info.pet.xp += 15
  checkPetLevelUp(state, player, info.pet)
  pushBanner(state, '🐾', `${info.pet.name} trained a little!`, '#7CFF9E')
  saveGame(state)
}

export function acceptQuest(state, player) {
  if (player.quest) return
  const t = pick(QUEST_TEMPLATES)
  const target = t.min + Math.floor(Math.random() * (t.max - t.min + 1))
  player.quest = { templateId: t.id, verb: t.verb, noun: t.noun, target, progress: 0, goldPer: t.goldPer, xpPer: t.xpPer }
  pushBanner(state, '📜', `New bounty: ${t.verb} ${target} ${t.noun}!`, '#FFD34D')
}
function progressQuest(state, player, templateId, amount) {
  const q = player.quest
  if (!q || q.templateId !== templateId) return
  q.progress = Math.min(q.target, q.progress + amount)
  if (q.progress >= q.target) {
    const gold = q.target * q.goldPer, xp = q.target * q.xpPer
    player.gold += gold
    player.xp += xp
    player.questsCompleted += 1
    grantAchievement(state, 'questdone')
    pushBanner(state, '🏆', `Bounty complete! +${gold} gold, +${xp} xp`, '#FFD34D')
    player.quest = null
    checkLevelUp(state, player)
  }
}

function spawnFloorBoss(state, floor) {
  floor.bossSpawned = true
  floor.bossActive = true
  const { x, z } = floor.bossGuardPoint
  const boss = createBoss(floor.theme.boss, x, z, state.nextId++)
  boss.homeX = x; boss.homeZ = z
  boss.walls = floor.wallRects
  floor.monsters.push(boss)
  const def = BOSS_DEFS[floor.theme.boss]
  pushBanner(state, '⚠️', `${def.name} appears, guarding the way ${floor.isFinal ? 'out' : 'down'}!`, '#FF6B6B')
  announcerSay(state, 'bossIntro')
}

// No monster/crawler may stand inside a safe zone — push it back out to
// the rim, same idea as a wall it can't cross.
function evictFromSafeZones(state, m) {
  for (const zone of state.safeZones) {
    const zx = m.x - zone.x, zz = m.z - zone.z
    const zd = Math.hypot(zx, zz)
    const minD = zone.r + m.r + 0.3
    if (zd < minD) {
      const push = zd > 0.001 ? minD / zd : 1
      m.x = zone.x + zx * push
      m.z = zone.z + zz * push
    }
  }
}
// Shared "nothing to chase" behavior: wander near home, or head back if
// leashed too far away — used by both monsters and crawlers.
function wanderOrReturnHome(state, m, spd, dt) {
  const homeDist = Math.hypot(m.x - m.homeX, m.z - m.homeZ)
  if (homeDist > m.leash) {
    tryMoveEntity(m.walls, m, ((m.homeX - m.x) / homeDist) * spd * 0.6 * dt, ((m.homeZ - m.z) / homeDist) * spd * 0.6 * dt)
  } else {
    m.wanderTimer -= dt
    if (m.wanderTimer <= 0) {
      const a = Math.random() * Math.PI * 2
      m.wanderDir = { x: Math.cos(a), z: Math.sin(a) }
      m.wanderTimer = 1 + Math.random() * 1.6
    }
    tryMoveEntity(m.walls, m, m.wanderDir.x * spd * 0.35 * dt, m.wanderDir.z * spd * 0.35 * dt)
  }
}

function updateMonsterAI(state, m, dt) {
  if (m.atkCooldown > 0) m.atkCooldown -= dt
  if (m.slowTimer > 0) { m.slowTimer -= dt; if (m.slowTimer <= 0) m.slowMult = 1 }
  if (m.knockTimer > 0) {
    tryMoveEntity(m.walls, m, m.knockX * dt, m.knockZ * dt)
    m.knockTimer -= dt
    return
  }
  const spd = m.speed * m.slowMult
  // A monster always chases/attacks whichever player is currently closer
  // — no persistent target memory, just re-picked fresh every frame.
  // Regular monsters never target crawlers — see updateCrawlerAI's own
  // comment for why that's a deliberate one-way relationship.
  const target = nearestPlayer(state, m)
  const playerSafe = isInSafeZone(target.x, target.z, state.safeZones)
  const dx0 = target.x - m.x, dz0 = target.z - m.z
  const d = Math.hypot(dx0, dz0)
  if (d < m.aggro && d > 0.001 && !playerSafe) {
    tryMoveEntity(m.walls, m, (dx0 / d) * spd * dt, (dz0 / d) * spd * dt)
    if (d < m.r + PLAYER_RADIUS + 0.6 && m.atkCooldown <= 0 && target.invuln <= 0) {
      target.hp -= Math.max(1, m.atk - petDefenseBonus(target))
      target.invuln = INVULN_TIME
      m.atkCooldown = 0.9
      if (target.hp <= 0) knockoutPlayer(state, target)
    }
  } else {
    wanderOrReturnHome(state, m, spd, dt)
  }
  evictFromSafeZones(state, m)
}

// The nearest thing a crawler is willing to fight: whichever player or
// *other* crawler is closest. Deliberately excludes regular monsters in
// both directions — crawlers ignoring them (and vice versa) keeps this
// hub's already-tuned monster AI completely untouched, while still
// delivering "attacks you and each other" between rival contestants.
function nearestHostileToCrawler(state, self) {
  let best = null, bd = Infinity
  for (const p of players(state)) {
    const d = Math.hypot(p.x - self.x, p.z - self.z)
    if (d < bd) { bd = d; best = { entity: p, isPlayer: true, x: p.x, z: p.z } }
  }
  for (const o of state.floor.monsters) {
    if (o === self || o.dead || !o.isCrawler) continue
    const d = Math.hypot(o.x - self.x, o.z - self.z)
    if (d < bd) { bd = d; best = { entity: o, isPlayer: false, x: o.x, z: o.z } }
  }
  return best ? { ...best, dist: bd } : null
}

function updateCrawlerAI(state, m, dt) {
  if (m.atkCooldown > 0) m.atkCooldown -= dt
  if (m.slowTimer > 0) { m.slowTimer -= dt; if (m.slowTimer <= 0) m.slowMult = 1 }
  if (m.knockTimer > 0) {
    tryMoveEntity(m.walls, m, m.knockX * dt, m.knockZ * dt)
    m.knockTimer -= dt
    return
  }
  const spd = m.speed * m.slowMult
  const hit = nearestHostileToCrawler(state, m)
  const targetSafe = hit && hit.isPlayer && isInSafeZone(hit.x, hit.z, state.safeZones)
  if (hit && hit.dist < m.aggro && hit.dist > 0.001 && !targetSafe) {
    const dx0 = hit.x - m.x, dz0 = hit.z - m.z
    tryMoveEntity(m.walls, m, (dx0 / hit.dist) * spd * dt, (dz0 / hit.dist) * spd * dt)
    const reach = m.r + (hit.isPlayer ? PLAYER_RADIUS : hit.entity.r) + 0.6
    if (hit.dist < reach && m.atkCooldown <= 0) {
      if (hit.isPlayer) {
        const target = hit.entity
        if (target.invuln <= 0) {
          target.hp -= Math.max(1, m.atk - petDefenseBonus(target))
          target.invuln = INVULN_TIME
          m.atkCooldown = 0.9
          if (target.hp <= 0) knockoutPlayer(state, target)
        }
      } else {
        const rival = hit.entity
        rival.hp -= m.atk
        m.atkCooldown = 0.9
        if (rival.hp <= 0 && !rival.dead) {
          rival.dead = true
          rival.removeMe = true
          spawnBurst(state, rival.x, rival.z, 10, ['#ffffff', '#ffcccc'])
        }
      }
    }
  } else {
    wanderOrReturnHome(state, m, spd, dt)
  }
  evictFromSafeZones(state, m)
}

// ── Descending to the next floor ────────────────────────────────────
function resetPlayersToSpawn(state) {
  state.player.x = 0; state.player.z = 0
  if (state.twoPlayer) { state.player2.x = 1.2; state.player2.z = 0 }
  state.yaw = 0
}

function descendStaircase(state, helpers) {
  if (!state.achievements.has('stairmaster')) grantAchievement(state, 'stairmaster')
  const nextIndex = state.floor.index + 1
  state.floor = generateFloor(nextIndex)
  for (const m of state.floor.monsters) m.id = state.nextId++
  for (const wp of state.floor.wildPets) wp.id = state.nextId++
  state.safeZones = buildSafeZones(state.floor)
  resetPlayersToSpawn(state)
  state.teleportFlash = FLOOR_FLASH_TIME
  state.floorChanged = true
  pushBanner(state, '🪜', `Descending to Floor ${nextIndex}: ${state.floor.theme.name}`, state.floor.theme.accent)
  announcerSay(state, 'floorStart')
  if (nextIndex >= CLASS_RACE_FLOOR && !state.player.classId) state.pendingClassPick = true
  saveGame(state)
}

function updateFloor(state, dt, helpers) {
  const floor = state.floor
  for (const m of floor.monsters) { if (!m.dead) (m.isCrawler ? updateCrawlerAI : updateMonsterAI)(state, m, dt) }
  floor.monsters = floor.monsters.filter(m => !m.removeMe)

  for (const c of floor.chests) {
    if (c.opened) continue
    const opener = players(state).find(p => (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (PLAYER_RADIUS + 2.2) ** 2)
    if (opener) openChest(state, opener, c, floor)
  }

  for (const dungeon of floor.miniDungeons) {
    if (dungeon.discovered) continue
    const found = players(state).some(p => Math.hypot(p.x - dungeon.x, p.z - dungeon.z) < MINI_DUNGEON_DISCOVER_R)
    if (found) { dungeon.discovered = true; grantAchievement(state, 'ruinexplorer') }
  }

  for (const wp of floor.wildPets) {
    if (wp.tamed) continue
    const tamer = players(state).find(p => Math.hypot(p.x - wp.x, p.z - wp.z) < PET_TAME_RADIUS)
    if (tamer) tamePet(state, tamer, wp)
  }
  floor.wildPets = floor.wildPets.filter(wp => !wp.removeMe)

  if (floor.village && !floor.village.discovered) {
    const found = players(state).some(p => Math.hypot(p.x - floor.village.x, p.z - floor.village.z) < VILLAGE_SAFE_RADIUS)
    if (found) { floor.village.discovered = true; grantAchievement(state, 'villager') }
  }

  if (!floor.bossSpawned) {
    const near = players(state).some(p => Math.hypot(p.x - floor.bossGuardPoint.x, p.z - floor.bossGuardPoint.z) < STAIRCASE_DISCOVERY_R)
    if (near) spawnFloorBoss(state, floor)
  }

  if (floor.staircase) {
    const hit = players(state).some(p => (p.x - floor.staircase.x) ** 2 + (p.z - floor.staircase.z) ** 2 < STAIRCASE_TRIGGER_R ** 2)
    if (hit) descendStaircase(state, helpers)
  } else if (floor.isFinal && floor.cleared) {
    // Safety net: triggerWin() already fires from onMonsterDeath the instant
    // the final boss dies, but re-checking here means a stale/loaded state
    // that's somehow already `cleared` still resolves to the win screen.
    triggerWin(state, helpers)
  }
}

// Melee/spell/potion handling — identical for either player once movement
// has already set `player.facing` for the frame. Not shared with movement
// itself since Player 1 (tank-turn off the shared camera yaw) and Player 2
// (moves relative to wherever that camera currently faces) genuinely need
// different movement math, not just different input sources.
function updatePlayerCombat(state, player, input, dt, helpers) {
  if (player.attackCooldown > 0) player.attackCooldown -= dt
  if (input.attackPressed && player.attackCooldown <= 0) {
    player.attackCooldown = ATTACK_COOLDOWN
    player.attackTimer = ATTACK_DURATION
    player.hitIds = new Set()
  }
  input.attackPressed = false
  if (player.attackTimer > 0) {
    player.attackTimer -= dt
    const hbx = player.x + player.facing.x * ATTACK_REACH
    const hbz = player.z + player.facing.z * ATTACK_REACH
    for (const m of state.floor.monsters) {
      if (m.dead || player.hitIds.has(m.id)) continue
      const dd = (hbx - m.x) ** 2 + (hbz - m.z) ** 2
      if (dd < (ATTACK_ARC_R + m.r) ** 2) {
        player.hitIds.add(m.id)
        const dmg = Math.max(1, player.atk + Math.floor(rand(-1, 2)))
        damageMonster(state, player, m, dmg, helpers)
        spawnBurst(state, m.x, m.z, 5, ['#ffffff', '#ffe9b8'])
        const kl = Math.hypot(m.x - player.x, m.z - player.z) || 1
        m.knockX = ((m.x - player.x) / kl) * 14
        m.knockZ = ((m.z - player.z) / kl) * 14
        m.knockTimer = 0.16
      }
    }
  }

  if (player.spellCooldown > 0) player.spellCooldown -= dt
  player.mana = Math.min(player.maxMana, player.mana + MANA_REGEN * dt)
  if (input.spellPressed) {
    input.spellPressed = false
    const spell = SPELLS.find(s => s.id === player.equippedSpellId)
    const known = player.spells.find(s => s.id === spell.id)
    const level = known ? known.level : 1
    // Level scaling: damage/heal grows 30%/level, cost shrinks 8%/level
    // (floored at 68% of base) — cooldown stays fixed so pacing at high
    // level doesn't turn into spam.
    const cost = Math.round(spell.baseCost * Math.max(0.68, 1 - 0.08 * (level - 1)))
    if (player.spellCooldown <= 0 && player.mana >= cost) {
      player.spellCooldown = spell.cooldown
      player.mana -= cost
      grantAchievement(state, 'spellcaster')
      // A little extra oomph beyond straight-line scaling — by level 20 a
      // spell is meant to feel categorically different from level 1, not
      // just "the same fireball but bigger numbers".
      const scale = 1 + 0.35 * (level - 1) + 0.02 * (level - 1) ** 2
      const tierIdx = spellTierIndex(level)
      const flavorColor = tierIdx === 2 ? '#FF8C3A' : tierIdx === 1 ? '#FFD34D' : '#C9A6FF'
      const bannerEmoji = tierIdx === 2 && spell.legendaryEmoji ? spell.legendaryEmoji : spell.emoji
      if (spell.kind === 'heal') {
        const healAmt = Math.round(spell.baseHeal * scale)
        player.hp = Math.min(player.maxHp, player.hp + healAmt)
        pushBanner(state, bannerEmoji, `${spell.flavor[tierIdx]} (+${healAmt} HP)`, flavorColor)
      } else {
        // Splash-capable spells grow a genuinely bigger blast radius at
        // higher level too, not just more damage — a maxed Fireball should
        // visibly engulf a wider area, not just hit harder in the same spot.
        const splashRadius = spell.splashRadius ? spell.splashRadius * (1 + 0.15 * (level - 1)) : 0
        state.projectiles.push({
          x: player.x + player.facing.x * 1.0, z: player.z + player.facing.z * 1.0,
          vx: player.facing.x * SPELL_SPEED, vz: player.facing.z * SPELL_SPEED,
          life: SPELL_LIFE, dmg: Math.round(spell.baseDamage * scale),
          splashRadius, slowMult: spell.slowMult, slowTime: spell.slowTime,
          owner: player, hitIds: new Set(), dead: false,
          visualScale: 1 + 0.06 * (level - 1), tierIdx,
        })
        // Silent at novice tier (matches the original no-banner-per-hit
        // feel for a plain attack spell) — but once a spell's grown into
        // something dramatic, that drama shows up on every cast, not just
        // the one time it leveled into the tier.
        if (tierIdx > 0) pushBanner(state, bannerEmoji, spell.flavor[tierIdx], flavorColor)
      }
      if (known) {
        known.xp += SPELL_CAST_XP
        while (known.level < MAX_SPELL_LEVEL && known.xp >= known.xpNext) {
          known.xp -= known.xpNext
          known.level += 1
          known.xpNext = spellXpNextFor(known.level)
          pushBanner(state, spell.emoji, `${spell.name} leveled up! Now level ${known.level}.`, '#C9A6FF')
          grantSpellTierAchievements(state, known.level)
        }
        if (known.level >= MAX_SPELL_LEVEL) known.xp = 0
      }
    }
  }

  if (player.potionCooldown > 0) player.potionCooldown -= dt
  if (input.potionPressed) {
    input.potionPressed = false
    if (player.potionCooldown <= 0 && player.potions > 0 && player.hp < player.maxHp) {
      player.potionCooldown = POTION_COOLDOWN
      player.potions -= 1
      player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.4))
      pushBanner(state, '🧃', 'Snack break! HP restored.', '#7CFF6B')
      grantAchievement(state, 'snackbreak')
    }
  }

  if (player.invuln > 0) player.invuln -= dt
}

// ── Per-frame update ─────────────────────────────────────────────────
// `input1`/`input2` are plain objects the component mutates from
// keyboard/mouse events; this function drains their one-shot fields
// (attackPressed, potionPressed, spellPressed, and input1's yawDelta/
// pitchDelta) back to their rest state. Player 1 steers the shared camera
// (tank-turn + optional mouse-look, exactly as before two-player support);
// Player 2 has no camera control and simply moves relative to wherever
// that camera is currently facing.
export function update(state, input1, input2, dt, helpers) {
  state.elapsed += dt
  state.floorChanged = false
  if (state.teleportFlash > 0) state.teleportFlash = Math.max(0, state.teleportFlash - dt)

  state.yaw += input1.yawDelta
  state.pitch = clamp(state.pitch + input1.pitchDelta, -PITCH_LIMIT, PITCH_LIMIT)
  input1.yawDelta = 0
  input1.pitchDelta = 0
  if (input1.left) state.yaw += TURN_SPEED * dt
  if (input1.right) state.yaw -= TURN_SPEED * dt

  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw)
  const player = state.player
  player.facing = { x: fx, z: fz }
  let mv = 0
  if (input1.forward) mv += 1
  if (input1.back) mv -= 1
  if (mv !== 0) {
    const spd = MOVE_SPEED * player.speedMult * (1 + petSpeedBonus(player))
    const dx = fx * mv * spd * dt, dz = fz * mv * spd * dt
    tryMoveEntity(state.floor.wallRects, player, dx, dz)
  }

  if (state.twoPlayer) {
    const player2 = state.player2
    const rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw)
    let p2fwd = 0, p2str = 0
    if (input2.forward) p2fwd += 1
    if (input2.back) p2fwd -= 1
    if (input2.right) p2str += 1
    if (input2.left) p2str -= 1
    if (p2fwd !== 0 || p2str !== 0) {
      let mx = fx * p2fwd + rx * p2str, mz = fz * p2fwd + rz * p2str
      const len = Math.hypot(mx, mz) || 1
      mx /= len; mz /= len
      player2.facing = { x: mx, z: mz }
      const spd2 = MOVE_SPEED * player2.speedMult * (1 + petSpeedBonus(player2))
      const dx = mx * spd2 * dt, dz = mz * spd2 * dt
      tryMoveEntity(state.floor.wallRects, player2, dx, dz)
    }
    updatePlayerCombat(state, player2, input2, dt, helpers)
    updatePetAI(state, player2, dt, helpers)
  }

  updatePlayerCombat(state, player, input1, dt, helpers)
  updatePetAI(state, player, dt, helpers)

  updateFloor(state, dt, helpers)

  state.inSafeZone = isInSafeZone(player.x, player.z, state.safeZones) ||
    (state.twoPlayer && isInSafeZone(state.player2.x, state.player2.z, state.safeZones))
  state.inVillage = isInVillage(state, player) || (state.twoPlayer && isInVillage(state, state.player2))

  for (const pr of state.projectiles) {
    if (pr.dead) continue
    pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.life -= dt
    if (pr.life <= 0 || rectBlocked(state.floor.wallRects, pr.x, pr.z, SPELL_RADIUS)) { pr.dead = true; continue }
    // On first contact, damage every monster within splashRadius of the
    // impact point (radius 0 behaves exactly like a single-target hit)
    // and apply the spell's slow if it has one, instead of stopping at
    // just the one monster the bolt's own radius touched.
    for (const m of state.floor.monsters) {
      if (m.dead || pr.hitIds.has(m.id)) continue
      const dd = (pr.x - m.x) ** 2 + (pr.z - m.z) ** 2
      if (dd < (SPELL_RADIUS + m.r) ** 2) {
        pr.hitIds.add(m.id)
        const splash = pr.splashRadius || 0
        for (const m2 of state.floor.monsters) {
          if (m2.dead) continue
          const dd2 = (pr.x - m2.x) ** 2 + (pr.z - m2.z) ** 2
          // SPELL_RADIUS is always included so splash=0 reduces to exactly
          // the same single-target hit test the outer loop already used —
          // splash only ever *adds* extra reach, never subtracts it.
          if (dd2 > (SPELL_RADIUS + splash + m2.r) ** 2) continue
          damageMonster(state, pr.owner, m2, pr.dmg, helpers)
          spawnBurst(state, m2.x, m2.z, 6, ['#c9a6ff', '#8fd3ff', '#ffffff'])
          if (pr.slowMult != null) { m2.slowMult = pr.slowMult; m2.slowTimer = pr.slowTime }
        }
        // A potent/legendary cast gets its own bigger impact burst on top
        // of the usual per-monster hit sparks — the whole point of leveling
        // a spell up is that landing it *looks* like a much bigger deal.
        if (pr.tierIdx === 1) spawnBurst(state, pr.x, pr.z, 14, ['#ffd34d', '#fff2c9', '#ffffff'])
        else if (pr.tierIdx === 2) spawnBurst(state, pr.x, pr.z, 32, ['#ff5c3a', '#ffb347', '#fff2c9'])
        pr.dead = true
        break
      }
    }
  }
  state.projectiles = state.projectiles.filter(pr => !pr.dead)

  for (const pt of state.particles) {
    pt.x += pt.vx * dt; pt.z += pt.vz * dt; pt.y += pt.vy * dt
    pt.vy -= 6 * dt
    pt.life -= dt
  }
  state.particles = state.particles.filter(pt => pt.life > 0)

  if (!state.banner && state.bannerQueue.length) { state.banner = state.bannerQueue.shift(); state.bannerTimer = 3.4 }
  if (state.banner) { state.bannerTimer -= dt; if (state.bannerTimer <= 0) state.banner = null }
  if (state.announcerTimer > 0) state.announcerTimer -= dt
  state.announcerIdleCD -= dt
  if (state.announcerIdleCD <= 0) { announcerSay(state, 'idle'); state.announcerIdleCD = 22 + Math.random() * 14 }

  // Periodic safety-net autosave, on top of the explicit saves already
  // triggered by floor descent and the class/race pick — covers anything
  // that happens to a save-worthy state (leveling up, looting) between
  // those two events, in case the tab closes without a clean unmount.
  state.autosaveTimer -= dt
  if (state.autosaveTimer <= 0) { state.autosaveTimer = AUTOSAVE_INTERVAL; saveGame(state) }
}
