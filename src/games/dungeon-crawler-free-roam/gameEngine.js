// ── Dungeon Crawler Max: Free Roam — pure game logic ────────────────────
// No THREE/DOM in here (matches this hub's other 3D games — see
// loot-and-scoot/gameEngine.js, dog-man-dash/worldEngine.js): everything
// is plain data in world (x, z) coordinates, mutated in place each frame.
// The component owns rendering and reads this state straight from refs.
//
// Two modes: 'overworld' (one big field, five dungeon buildings scattered
// around it, weaker mobs wandering between them) and 'dungeon' (a single
// active site's interior maze — teleported into on approaching a
// building's door, teleported back out on reaching the exit disc).

import {
  WORLD_HALF, TILE, SITE_COLS, SITE_ROWS, SITE_RADIUS,
  PLAYER_RADIUS, MOVE_SPEED, TURN_SPEED, PITCH_LIMIT,
  ATTACK_REACH, ATTACK_ARC_R, ATTACK_DURATION, ATTACK_COOLDOWN,
  POTION_COOLDOWN, INVULN_TIME, KNOCKOUT_INVULN, OVERWORLD_MOB_COUNT,
  BUILDING_RADIUS, DOOR_TRIGGER_R, EXIT_TRIGGER_R, TELEPORT_FLASH_TIME,
  MAX_MANA, MANA_REGEN, SPELL_SPEED, SPELL_RADIUS, SPELL_LIFE, MAX_SPELL_LEVEL,
  SAFE_ZONE_HOME_RADIUS, SAFE_ZONE_REST_RADIUS,
} from './constants.js'

const EMPTY_RECTS = []

// ── Content ──────────────────────────────────────────────────────────
// Sites 1-5 are the original 5 dungeons. Sites 6-18 are Free Roam's own
// "game show goes to the carnival" expansion — distinct from Dungeon
// Crawler Max's indoor-building floors 6-18, though both story arcs
// converge on the same shadowy figure behind the whole show.
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
export const SPELLS = [
  { id: 'bolt', name: 'Magic Bolt', emoji: '🔮', kind: 'projectile', baseCost: 14, cooldown: 0.5, baseDamage: 6, splashRadius: 0 },
  { id: 'fireball', name: 'Fireball', emoji: '🔥', kind: 'projectile', baseCost: 22, cooldown: 1.1, baseDamage: 14, splashRadius: 1.4 },
  { id: 'ice', name: 'Ice Shard', emoji: '❄️', kind: 'projectile', baseCost: 16, cooldown: 0.7, baseDamage: 7, splashRadius: 0, slowMult: 0.4, slowTime: 2.0 },
  { id: 'chainzap', name: 'Chain Zap', emoji: '⚡', kind: 'projectile', baseCost: 20, cooldown: 0.9, baseDamage: 5, splashRadius: 2.6 },
  { id: 'snackheal', name: 'Snack Heal', emoji: '🧃', kind: 'heal', baseCost: 18, cooldown: 1.6, baseHeal: 14 },
]

export const CLASSES = [
  { id: 'warrior', name: 'Warrior', emoji: '⚔️', desc: 'Melee-focused — extra attack, extra HP.', atk: 3, def: 1, hp: 10, mana: 0, speedMult: 1 },
  { id: 'mage', name: 'Mage', emoji: '🪄', desc: 'Glass-cannon spellcaster — big mana pool, less HP.', atk: -1, def: 0, hp: -6, mana: 20, speedMult: 1 },
  { id: 'rogue', name: 'Rogue', emoji: '🗡️', desc: 'Fast and balanced, with a little mana to spare.', atk: 1, def: 0, hp: 0, mana: 5, speedMult: 1.15 },
  { id: 'cleric', name: 'Cleric', emoji: '💖', desc: 'Tanky support — extra defense and mana.', atk: 0, def: 2, hp: 6, mana: 10, speedMult: 1 },
]
export const RACES = [
  { id: 'human', name: 'Human', emoji: '🧑', desc: 'Balanced all-around.', atk: 1, def: 1, hp: 4, mana: 4, speedMult: 1, goldMult: 1 },
  { id: 'elf', name: 'Elf', emoji: '🧝', desc: 'Extra mana and speed, but fragile.', atk: 0, def: 0, hp: -4, mana: 12, speedMult: 1.1, goldMult: 1 },
  { id: 'dwarf', name: 'Dwarf', emoji: '🧔', desc: 'Tanky and tough, but a little slow.', atk: 0, def: 2, hp: 10, mana: 0, speedMult: 0.92, goldMult: 1 },
  { id: 'hamsterkin', name: 'Hamsterkin', emoji: '🐹', desc: 'Fast and lucky with gold — small, quick, and always finds the shiny stuff.', atk: -1, def: 0, hp: 0, mana: 0, speedMult: 1.2, goldMult: 1.2 },
]

export const ACHIEVEMENTS = [
  { id: 'contestant', name: 'Chosen Contestant', desc: 'Step into the world.' },
  { id: 'firstblood', name: 'Slime Time', desc: 'Defeat your first monster.' },
  { id: 'lootgoblin', name: 'Loot Goblin', desc: 'Open 5 chests.' },
  { id: 'goblinslayer', name: 'Goblin Slayer', desc: 'Defeat a Goblin.' },
  { id: 'snackbreak', name: 'Snack Break', desc: 'Drink a potion.' },
  { id: 'bossbeat1', name: 'Big Boss Energy', desc: 'Defeat a dungeon boss.' },
  { id: 'geared', name: 'Fashionably Equipped', desc: 'Equip a weapon and armor.' },
  { id: 'spellcaster', name: 'Wand Enthusiast', desc: 'Cast your first spell.' },
  { id: 'spellbound', name: 'Spellbound', desc: 'Learn all 5 spells.' },
  { id: 'archmage', name: 'Archmage', desc: 'Level a spell up to level 5.' },
  { id: 'oof', name: 'Free Respawn', desc: 'Get knocked out (it happens to everyone).' },
  { id: 'richkid', name: 'Pocket Full of Gold', desc: 'Collect 200 gold.' },
  { id: 'champion', name: 'Dungeon Champion', desc: 'Clear every dungeon in the world!' },
]

export const ANNOUNCER_LINES = {
  welcome: ['Welcome, contestant, to the greatest game show never legally reviewed by anyone!', "Ratings are through the roof, folks — let's get this dungeon crawl started!"],
  floorStart: ['Through the door they go — the crowd demands more!', 'New dungeon, new monsters, same excellent snack sponsorship!'],
  bossIntro: ["Ladies and gentlemen, tonight's main event has entered the arena!", 'This is the part viewers wrote in about. Good luck out there!'],
  bossDefeat: ["AND THAT'S A KNOCKOUT! What a show!", 'The crowd goes wild! Somewhere. Probably.'],
  levelUp: ['Our contestant just got stronger — the sponsors are thrilled!', 'Level up! This game show does love a glow-up.'],
  win: ['WE HAVE A CHAMPION, FOLKS!', 'Ladies, gentlemen, and hamsters everywhere — a CHAMPION!'],
  knockout: ['Ooh, that’s gotta sting — but don’t worry, this game show has EXCELLENT insurance!', 'No permanent damage, folks — contestant safety is our SEVENTH priority!'],
  idle: ['This dungeon is sponsored by Non-Threatening Snacks™.', 'Remember, contestants: hydrate, stretch, and bonk responsibly.', 'Somewhere, a scoreboard is definitely keeping track of this.'],
}

// ── Small math helpers ───────────────────────────────────────────────
function rand(a, b) { return a + Math.random() * (b - a) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

// ── World generation ─────────────────────────────────────────────────
function rectsOverlapPad(a, b, pad) {
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y)
}
function isFloorTile(tiles, tx, ty) {
  return tx >= 0 && ty >= 0 && tx < SITE_COLS && ty < SITE_ROWS && tiles[ty * SITE_COLS + tx] === 1
}
function setFloor(tiles, x, y) {
  if (x < 0 || y < 0 || x >= SITE_COLS || y >= SITE_ROWS) return
  tiles[y * SITE_COLS + x] = 1
}
function carveH(tiles, x1, x2, y) {
  const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1]
  for (let x = lo; x <= hi; x++) { setFloor(tiles, x, y); setFloor(tiles, x, y + 1) }
}
function carveV(tiles, y1, y2, x) {
  const [lo, hi] = y1 < y2 ? [y1, y2] : [y2, y1]
  for (let y = lo; y <= hi; y++) { setFloor(tiles, x, y); setFloor(tiles, x + 1, y) }
}
function roomCenterTile(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 } }
function randomPointInRoomTile(room) {
  const tx = room.x + 1 + Math.random() * Math.max(0.01, room.w - 2)
  const ty = room.y + 1 + Math.random() * Math.max(0.01, room.h - 2)
  return { x: tx, y: ty }
}
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
    siteIndex: null, walls: EMPTY_RECTS, homeX: x, homeZ: z, leash: 16, aggro: 14,
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
    siteIndex: null, walls: EMPTY_RECTS, homeX: x, homeZ: z, leash: 24, aggro: 999999,
  }
}

// A site is generated in two layers: the *interior* maze (rooms/corridors/
// walls/monsters/chests/boss — only built as 3D geometry when entered) and
// a small set of *exterior* facts (door position + facing) so the
// overworld only ever needs to show a solid building, never the maze.
function generateSite(themeIndex, centerX, centerZ) {
  const theme = DUNGEON_THEMES[themeIndex]
  const tiles = new Uint8Array(SITE_COLS * SITE_ROWS)
  const rooms = []
  let attempts = 0
  const roomCount = 5 + Math.floor(Math.random() * 3)
  while (rooms.length < roomCount && attempts < 200) {
    attempts++
    const w = 3 + Math.floor(Math.random() * 4)
    const h = 3 + Math.floor(Math.random() * 4)
    const x = 1 + Math.floor(Math.random() * (SITE_COLS - w - 2))
    const y = 1 + Math.floor(Math.random() * (SITE_ROWS - h - 2))
    const room = { x, y, w, h }
    if (rooms.some(r => rectsOverlapPad(r, room, 1))) continue
    rooms.push(room)
  }
  if (rooms.length < 2) {
    rooms.length = 0
    rooms.push({ x: 2, y: 2, w: 4, h: 4 })
    rooms.push({ x: SITE_COLS - 6, y: SITE_ROWS - 6, w: 4, h: 4 })
  }
  for (const r of rooms) {
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) tiles[ty * SITE_COLS + tx] = 1
  }
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCenterTile(rooms[i - 1])
    const b = roomCenterTile(rooms[i])
    const ax = Math.round(a.x), ay = Math.round(a.y), bx = Math.round(b.x), by = Math.round(b.y)
    if (Math.random() < 0.5) { carveH(tiles, ax, bx, ay); carveV(tiles, ay, by, bx) }
    else { carveV(tiles, ay, by, ax); carveH(tiles, ax, bx, by) }
  }

  const originX = centerX - (SITE_COLS * TILE) / 2
  const originZ = centerZ - (SITE_ROWS * TILE) / 2
  const tileToWorld = (tx, ty) => ({ x: originX + tx * TILE + TILE / 2, z: originZ + ty * TILE + TILE / 2 })

  const wallRects = []
  for (let ty = 0; ty < SITE_ROWS; ty++) {
    for (let tx = 0; tx < SITE_COLS; tx++) {
      if (tiles[ty * SITE_COLS + tx] === 1) continue
      const adjacent = isFloorTile(tiles, tx - 1, ty) || isFloorTile(tiles, tx + 1, ty) || isFloorTile(tiles, tx, ty - 1) || isFloorTile(tiles, tx, ty + 1)
      if (!adjacent) continue
      const w = tileToWorld(tx, ty)
      wallRects.push({ x: w.x, z: w.z, w: TILE, d: TILE })
    }
  }

  const roomWorldBounds = (room) => ({
    x0: originX + room.x * TILE, z0: originZ + room.y * TILE,
    x1: originX + (room.x + room.w) * TILE, z1: originZ + (room.y + room.h) * TILE,
  })
  const randomPointInRoomWorld = (room) => {
    const t = randomPointInRoomTile(room)
    return { x: originX + t.x * TILE, z: originZ + t.y * TILE }
  }

  const entrance = tileToWorld(roomCenterTile(rooms[0]).x, roomCenterTile(rooms[0]).y)
  const exitDisc = { x: entrance.x, z: entrance.z + 5 }
  const bossRoom = roomWorldBounds(rooms[rooms.length - 1])
  const tierMult = 1 + themeIndex * 0.35

  const monsters = []
  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i]
    const count = 1 + Math.floor(Math.random() * 2) + Math.floor(themeIndex / 2)
    for (let k = 0; k < count; k++) {
      const type = pick(theme.monsterPool)
      const p = randomPointInRoomWorld(room)
      const m = createMonster(type, p.x, p.z, tierMult, 0)
      m.walls = wallRects
      m.homeX = p.x; m.homeZ = p.z
      monsters.push(m)
    }
  }

  const chests = []
  for (let i = 1; i < rooms.length - 1; i++) {
    if (Math.random() < 0.7) {
      const p = randomPointInRoomWorld(rooms[i])
      chests.push({ x: p.x, z: p.z, opened: false })
    }
  }

  const floorBounds = { x0: originX, z0: originZ, x1: originX + SITE_COLS * TILE, z1: originZ + SITE_ROWS * TILE }

  // Exterior facade: a solid circular obstacle in the overworld, with a
  // door on the side facing back toward the world's spawn point.
  const angle = Math.atan2(centerZ, centerX)
  const doorDirX = -Math.cos(angle), doorDirZ = -Math.sin(angle)
  const doorX = centerX + doorDirX * BUILDING_RADIUS
  const doorZ = centerZ + doorDirZ * BUILDING_RADIUS

  return {
    theme, themeIndex, index: themeIndex, centerX, centerZ,
    doorX, doorZ, doorDirX, doorDirZ, doorAngle: angle,
    wallRects, floorBounds, entrance, exitDisc, bossRoom, monsters, chests,
    cleared: false, bossSpawned: false, bossActive: false,
  }
}

function generateWorld() {
  const sites = []
  for (let i = 0; i < DUNGEON_THEMES.length; i++) {
    const angle = (i / DUNGEON_THEMES.length) * Math.PI * 2 - Math.PI / 2
    const cx = Math.cos(angle) * SITE_RADIUS
    const cz = Math.sin(angle) * SITE_RADIUS
    sites.push(generateSite(i, cx, cz))
  }
  return sites
}

function pointInsideAnySite(x, z, sites, margin) {
  return sites.some(s => Math.hypot(x - s.centerX, z - s.centerZ) < BUILDING_RADIUS + margin)
}

// Safe zones are always at the same fixed spots relative to the (also
// fixed) ring of dungeon sites — one big "Home Base" at the world's spawn
// point, plus a couple of smaller "Rest Stop" waypoints tucked into two of
// the gaps between sites, so a long trek across the field has somewhere to
// pause. No monster can stand inside one, and the player can't be hit
// while inside one either — see isInSafeZone() and its call sites below.
function buildSafeZones(sites) {
  const zones = [{ x: 0, z: 0, r: SAFE_ZONE_HOME_RADIUS, name: 'Home Base' }]
  // Scale the number of rest stops with the size of the world instead of
  // two fixed gaps — a ring of 18 sites needs more waypoints than 5 does.
  const restStopCount = Math.max(2, Math.floor(sites.length / 5))
  const gapStep = sites.length / restStopCount
  const restGapIndices = Array.from({ length: restStopCount }, (_, i) => Math.floor(i * gapStep))
  for (const i of restGapIndices) {
    const a = (i / sites.length) * Math.PI * 2 - Math.PI / 2
    const b = ((i + 1) / sites.length) * Math.PI * 2 - Math.PI / 2
    const mid = (a + b) / 2
    const r = SITE_RADIUS * 0.55
    zones.push({ x: Math.cos(mid) * r, z: Math.sin(mid) * r, r: SAFE_ZONE_REST_RADIUS, name: 'Rest Stop' })
  }
  return zones
}
export function isInSafeZone(x, z, safeZones) {
  return safeZones.some(s => Math.hypot(x - s.x, z - s.z) < s.r)
}
function pointInsideAnySafeZone(x, z, safeZones, margin) {
  return safeZones.some(s => Math.hypot(x - s.x, z - s.z) < s.r + margin)
}

function generateOverworldMobs(sites, safeZones) {
  const mobs = []
  const pool = ['slime', 'rat', 'kobold', 'fly']
  for (let i = 0; i < OVERWORLD_MOB_COUNT; i++) {
    let x = 0, z = 0, tries = 0
    do {
      x = rand(-WORLD_HALF + 30, WORLD_HALF - 30)
      z = rand(-WORLD_HALF + 30, WORLD_HALF - 30)
      tries++
    } while ((pointInsideAnySite(x, z, sites, 14) || pointInsideAnySafeZone(x, z, safeZones, 4)) && tries < 30)
    const m = createMonster(pick(pool), x, z, 0.7, 0)
    m.leash = 24; m.aggro = 10
    mobs.push(m)
  }
  return mobs
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
    spells: [{ id: 'bolt', level: 1 }], equippedSpellId: 'bolt',
    classId: null, raceId: null, speedMult: 1, goldMult: 1,
    gold: 0, potions: 1,
    weaponName: null, armorName: null, weapons: [], armors: [],
    attackCooldown: 0, attackTimer: 0, hitIds: new Set(),
    potionCooldown: 0, invuln: 0,
  }
}

export function mkInitialState(twoPlayer = true) {
  const sites = generateWorld()
  let nextId = 0
  for (const s of sites) for (const m of s.monsters) m.id = nextId++
  const safeZones = buildSafeZones(sites)
  const overworldMobs = generateOverworldMobs(sites, safeZones)
  for (const m of overworldMobs) m.id = nextId++

  // Player 2 object always exists (keeps every player2-touching helper
  // below free of null checks) but only actively moves/fights/renders
  // when twoPlayer is true — see players()/nearestPlayer() and the
  // `if (state.twoPlayer)` guards in update() below. A second person can
  // pick up the arrow-key cluster at any time once 2-player is chosen.
  const player = mkPlayer()
  const player2 = mkPlayer()
  player2.x = 1.2

  return {
    sites, overworldMobs, player, player2, twoPlayer, safeZones, inSafeZone: false,
    mode: 'overworld', activeSite: null, justTeleported: null, teleportFlash: 0,
    projectiles: [],
    distinctSitesEntered: new Set(), pendingClassPick: false,
    yaw: 0, pitch: 0.28, nextId,
    particles: [], bannerQueue: [], banner: null, bannerTimer: 0,
    announcerText: pick(ANNOUNCER_LINES.welcome), announcerTimer: 9, announcerIdleCD: 20,
    achievements: new Set(), chestsOpened: 0,
    compass: null, elapsed: 0,
  }
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
function moveAgainstBuildings(sites, e, dx, dz) {
  const blocked = (x, z) => sites.some(s => Math.hypot(x - s.centerX, z - s.centerZ) < BUILDING_RADIUS + e.r)
  if (dx !== 0) { const nx = clamp(e.x + dx, -WORLD_HALF, WORLD_HALF); if (!blocked(nx, e.z)) e.x = nx }
  if (dz !== 0) { const nz = clamp(e.z + dz, -WORLD_HALF, WORLD_HALF); if (!blocked(e.x, nz)) e.z = nz }
}
function allMonsters(state) {
  if (state.mode === 'dungeon') return state.sites[state.activeSite].monsters
  return state.overworldMobs
}

function knockoutPlayer(state, player) {
  pushBanner(state, '💫', 'Knocked out! Free respawn, contestant!', '#FF9E6B')
  announcerSay(state, 'knockout')
  grantAchievement(state, 'oof')
  const p = player
  p.gold = Math.floor(p.gold * 0.8)
  if (state.mode === 'dungeon') {
    const site = state.sites[state.activeSite]
    p.x = site.entrance.x; p.z = site.entrance.z
  } else {
    p.x = 0; p.z = 0
  }
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

function checkWin(state, helpers) {
  if (state.sites.every(s => s.cleared)) {
    grantAchievement(state, 'champion')
    announcerSay(state, 'win')
    helpers.setWinStats({
      level: state.player.level,
      gold: state.player.gold,
      achievements: ACHIEVEMENTS.filter(a => state.achievements.has(a.id)).map(a => a.name),
      totalAchievements: ACHIEVEMENTS.length,
    })
    helpers.setPhase('win')
  }
}

function onMonsterDeath(state, player, m, helpers) {
  spawnBurst(state, m.x, m.z, m.isBoss ? 26 : 12, ['#FFD34D', '#FF8FD3', '#8FD3FF', '#B6FF6B'])
  const p = player
  p.xp += m.xp
  p.gold += Math.round(rand(m.xp * 0.6, m.xp * 1.3) * p.goldMult)
  if (!state.achievements.has('firstblood')) grantAchievement(state, 'firstblood')
  if (m.type === 'goblin') grantAchievement(state, 'goblinslayer')
  if (Math.random() < 0.1) { p.potions = Math.min(5, p.potions + 1); pushBanner(state, '🧃', 'A snack potion fell out!', '#7CFF6B') }
  if (m.isBoss) {
    const site = state.sites[m.siteIndex]
    site.cleared = true
    site.bossActive = false
    grantAchievement(state, 'bossbeat1')
    pushBanner(state, '🏆', `${m.name} defeated! ${site.theme.name} cleared!`, '#FFD34D')
    announcerSay(state, 'bossDefeat')
    checkWin(state, helpers)
  }
  if (p.gold >= 200) grantAchievement(state, 'richkid')
  checkLevelUp(state, p)
  m.removeMe = true
}

function damageMonster(state, player, m, dmg, helpers) {
  m.hp -= dmg
  if (m.hp <= 0 && !m.dead) { m.dead = true; onMonsterDeath(state, player, m, helpers) }
}

function openChest(state, player, c, site) {
  c.opened = true
  spawnBurst(state, c.x, c.z, 10, ['#FFD34D', '#FFE9B8'])
  state.chestsOpened += 1
  if (state.chestsOpened === 5) grantAchievement(state, 'lootgoblin')
  const p = player
  const roll = Math.random()
  if (roll < 0.3) {
    const amt = Math.round((8 + Math.floor(Math.random() * 10) * (site.themeIndex + 1)) * p.goldMult)
    p.gold += amt
    pushBanner(state, '🪙', `Found ${amt} gold!`, '#FFD34D')
  } else if (roll < 0.5) {
    p.potions = Math.min(5, p.potions + 1)
    pushBanner(state, '🧃', 'Found a snack potion!', '#7CFF6B')
  } else if (roll < 0.8) {
    // Found gear goes to the player's inventory rather than auto-equipping
    // — equipping is a deliberate choice made from the Gear panel (see
    // equipWeapon/equipArmor below), so the player picks their own loadout
    // instead of the chest silently swapping it for them. A duplicate of
    // something already owned is just sold on the spot.
    const tier = Math.min(WEAPONS.length - 1, site.themeIndex + 1 + Math.floor(Math.random() * 2))
    if (Math.random() < 0.5) {
      const w = WEAPONS[tier]
      if (p.weapons.some(x => x.name === w.name)) {
        const gold = Math.round(w.atk * 3 * p.goldMult); p.gold += gold
        pushBanner(state, '💰', `Already own ${w.name} — sold the spare for ${gold} gold`, '#FFD34D')
      } else {
        p.weapons.push(w)
        pushBanner(state, w.emoji, `Found ${w.name}! Open Gear (I) to equip it.`, '#8FD3FF')
      }
    } else {
      const a = ARMORS[tier]
      if (p.armors.some(x => x.name === a.name)) {
        const gold = Math.round(a.def * 3 * p.goldMult); p.gold += gold
        pushBanner(state, '💰', `Already own ${a.name} — sold the spare for ${gold} gold`, '#FFD34D')
      } else {
        p.armors.push(a)
        pushBanner(state, a.emoji, `Found ${a.name}! Open Gear (I) to equip it.`, '#8FD3FF')
      }
    }
  } else {
    // A scroll teaches an unknown spell, levels up a known one, or — once
    // that spell is already maxed — is sold for gold instead (mirrors the
    // weapon/armor "sell the spare" branch above).
    const spell = pick(SPELLS)
    const known = p.spells.find(s => s.id === spell.id)
    if (!known) {
      p.spells.push({ id: spell.id, level: 1 })
      pushBanner(state, spell.emoji, `Learned a new spell: ${spell.name}! Open Gear (I) to equip it.`, '#C9A6FF')
      if (p.spells.length === SPELLS.length) grantAchievement(state, 'spellbound')
    } else if (known.level < MAX_SPELL_LEVEL) {
      known.level += 1
      pushBanner(state, spell.emoji, `${spell.name} leveled up! Now level ${known.level}.`, '#C9A6FF')
      if (known.level === MAX_SPELL_LEVEL) grantAchievement(state, 'archmage')
    } else {
      const gold = Math.round((20 + known.level * 10) * p.goldMult); p.gold += gold
      pushBanner(state, '💰', `${spell.name} is already maxed — sold the spare scroll for ${gold} gold`, '#FFD34D')
    }
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

// The one-time character-creation pick, gated behind the 3rd distinct
// dungeon entered (see enterSite below) — applies flat stat deltas into
// the player's *base* stats once, then fully heals to the new max so the
// pick always feels like a power-up, never a surprise HP/mana cut. Called
// once per player (each player picks their own class/race independently).
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
}

function spawnBoss(state, site) {
  site.bossSpawned = true
  site.bossActive = true
  const c = boundsCenterXZ(site.bossRoom)
  const boss = createBoss(site.theme.boss, c.x, c.z, state.nextId++)
  boss.siteIndex = site.index
  boss.walls = site.wallRects
  boss.homeX = c.x; boss.homeZ = c.z
  site.monsters.push(boss)
  const def = BOSS_DEFS[site.theme.boss]
  pushBanner(state, '⚠️', `${def.name} appears!`, '#FF6B6B')
  announcerSay(state, 'bossIntro')
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
  const target = nearestPlayer(state, m)
  const playerSafe = state.mode === 'overworld' && isInSafeZone(target.x, target.z, state.safeZones)
  const dx0 = target.x - m.x, dz0 = target.z - m.z
  const d = Math.hypot(dx0, dz0)
  if (d < m.aggro && d > 0.001 && !playerSafe) {
    tryMoveEntity(m.walls, m, (dx0 / d) * spd * dt, (dz0 / d) * spd * dt)
    if (d < m.r + PLAYER_RADIUS + 0.6 && m.atkCooldown <= 0 && target.invuln <= 0) {
      target.hp -= m.atk
      target.invuln = INVULN_TIME
      m.atkCooldown = 0.9
      if (target.hp <= 0) knockoutPlayer(state, target)
    }
  } else {
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

  // No monster may stand inside a safe zone — push it back out to the
  // rim, same idea as a wall it can't cross.
  if (state.mode === 'overworld') {
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
}

// ── Teleport between overworld and a dungeon interior ───────────────────
function enterSite(state, index) {
  const site = state.sites[index]
  state.mode = 'dungeon'
  state.activeSite = index
  state.player.x = site.entrance.x
  state.player.z = site.entrance.z
  if (state.twoPlayer) { state.player2.x = site.entrance.x + 1; state.player2.z = site.entrance.z }
  state.yaw = 0
  state.teleportFlash = TELEPORT_FLASH_TIME
  state.justTeleported = 'in'
  pushBanner(state, '🌀', `Entering ${site.theme.name}...`, site.theme.accent)
  announcerSay(state, 'floorStart')

  // Free Roam has no linear "floor 3" — the closest equivalent in a
  // non-linear open world is the 3rd *distinct* dungeon entered (revisits
  // don't count), which triggers the one-time class/race pick.
  state.distinctSitesEntered.add(index)
  if (state.distinctSitesEntered.size === 3 && !state.player.classId) {
    state.pendingClassPick = true
  }
}
function exitSite(state) {
  const site = state.sites[state.activeSite]
  const pushDist = DOOR_TRIGGER_R + 1.5
  state.player.x = site.doorX + site.doorDirX * pushDist
  state.player.z = site.doorZ + site.doorDirZ * pushDist
  if (state.twoPlayer) { state.player2.x = state.player.x + 1; state.player2.z = state.player.z }
  // Face back toward the building (not away from it) — the chase camera
  // sits behind the player, so facing away would put the camera inside
  // the solid building mesh.
  state.yaw = Math.atan2(site.doorDirX, site.doorDirZ)
  state.mode = 'overworld'
  state.activeSite = null
  state.teleportFlash = TELEPORT_FLASH_TIME
  state.justTeleported = 'out'
  pushBanner(state, '🌀', 'Back in the open world!', '#8FD3FF')
}

function updateOverworld(state, dt) {
  for (const m of state.overworldMobs) { if (!m.dead) updateMonsterAI(state, m, dt) }
  state.overworldMobs = state.overworldMobs.filter(m => !m.removeMe)

  for (const s of state.sites) {
    const hit = players(state).some(p => (p.x - s.doorX) ** 2 + (p.z - s.doorZ) ** 2 < DOOR_TRIGGER_R ** 2)
    if (hit) { enterSite(state, s.index); break }
  }

  const uncleared = state.sites.filter(s => !s.cleared)
  if (uncleared.length) {
    let best = null, bd = Infinity
    for (const s of uncleared) {
      const d = Math.hypot(s.doorX - state.player.x, s.doorZ - state.player.z)
      if (d < bd) { bd = d; best = s }
    }
    state.compass = { bearing: Math.atan2(best.doorX - state.player.x, best.doorZ - state.player.z), dist: bd, name: best.theme.name }
  } else {
    state.compass = null
  }
}

function updateDungeon(state, dt, helpers) {
  const site = state.sites[state.activeSite]
  for (const m of site.monsters) { if (!m.dead) updateMonsterAI(state, m, dt) }
  site.monsters = site.monsters.filter(m => !m.removeMe)

  for (const c of site.chests) {
    if (c.opened) continue
    const opener = players(state).find(p => (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (PLAYER_RADIUS + 2.2) ** 2)
    if (opener) openChest(state, opener, c, site)
  }

  if (!site.bossSpawned && players(state).some(p => pointInBoundsXZ(p.x, p.z, site.bossRoom))) spawnBoss(state, site)

  const exitHit = players(state).some(p => (p.x - site.exitDisc.x) ** 2 + (p.z - site.exitDisc.z) ** 2 < EXIT_TRIGGER_R ** 2)
  if (exitHit) exitSite(state)

  state.compass = null
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
    for (const m of allMonsters(state)) {
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
      const scale = 1 + 0.3 * (level - 1)
      if (spell.kind === 'heal') {
        const healAmt = Math.round(spell.baseHeal * scale)
        player.hp = Math.min(player.maxHp, player.hp + healAmt)
        pushBanner(state, spell.emoji, `${spell.name}! +${healAmt} HP`, '#7CFF6B')
      } else {
        state.projectiles.push({
          x: player.x + player.facing.x * 1.0, z: player.z + player.facing.z * 1.0,
          vx: player.facing.x * SPELL_SPEED, vz: player.facing.z * SPELL_SPEED,
          life: SPELL_LIFE, dmg: Math.round(spell.baseDamage * scale),
          splashRadius: spell.splashRadius || 0,
          slowMult: spell.slowMult, slowTime: spell.slowTime,
          owner: player, hitIds: new Set(), dead: false,
        })
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
  state.justTeleported = null
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
    const dx = fx * mv * MOVE_SPEED * player.speedMult * dt, dz = fz * mv * MOVE_SPEED * player.speedMult * dt
    if (state.mode === 'dungeon') tryMoveEntity(state.sites[state.activeSite].wallRects, player, dx, dz)
    else moveAgainstBuildings(state.sites, player, dx, dz)
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
      const dx = mx * MOVE_SPEED * player2.speedMult * dt, dz = mz * MOVE_SPEED * player2.speedMult * dt
      if (state.mode === 'dungeon') tryMoveEntity(state.sites[state.activeSite].wallRects, player2, dx, dz)
      else moveAgainstBuildings(state.sites, player2, dx, dz)
    }
    updatePlayerCombat(state, player2, input2, dt, helpers)
  }

  updatePlayerCombat(state, player, input1, dt, helpers)

  if (state.mode === 'overworld') updateOverworld(state, dt)
  else updateDungeon(state, dt, helpers)

  state.inSafeZone = state.mode === 'overworld' &&
    (isInSafeZone(player.x, player.z, state.safeZones) ||
      (state.twoPlayer && isInSafeZone(state.player2.x, state.player2.z, state.safeZones)))

  const activeWalls = state.mode === 'dungeon' ? state.sites[state.activeSite].wallRects : EMPTY_RECTS
  for (const pr of state.projectiles) {
    if (pr.dead) continue
    pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.life -= dt
    if (pr.life <= 0 || rectBlocked(activeWalls, pr.x, pr.z, SPELL_RADIUS)) { pr.dead = true; continue }
    // On first contact, damage every monster within splashRadius of the
    // impact point (radius 0 behaves exactly like a single-target hit)
    // and apply the spell's slow if it has one, instead of stopping at
    // just the one monster the bolt's own radius touched.
    for (const m of allMonsters(state)) {
      if (m.dead || pr.hitIds.has(m.id)) continue
      const dd = (pr.x - m.x) ** 2 + (pr.z - m.z) ** 2
      if (dd < (SPELL_RADIUS + m.r) ** 2) {
        pr.hitIds.add(m.id)
        const splash = pr.splashRadius || 0
        for (const m2 of allMonsters(state)) {
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
}
