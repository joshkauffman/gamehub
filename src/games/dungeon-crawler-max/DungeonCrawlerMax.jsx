import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './DungeonCrawlerMax.module.css'

// ── Dungeon Crawler Max ──────────────────────────────────────────────────
// A kid-safe riff on the "trapped in a monster-filled dungeon game show"
// premise: a floating game-show host narrates, a talking pet hamster
// heckles supportively, floors escalate toward a boss, and loot/XP/levels
// drive progress. Getting knocked out has zero real stakes — it's a "free
// respawn" gag, not a death, since this is built for a 6-year-old.
//
// Everything lives in one plain object (`g`) mutated in place every frame
// and drawn straight to canvas — same pattern as this hub's other 2D
// canvas games (see snake-clash/SnakeClash.jsx): refs hold state so the
// render loop never fights React re-renders, and React only owns the
// intro/win overlay screens.

const TILE = 40
const COLS = 34
const ROWS = 20
const PLAYER_R = 14
const PLAYER_SPEED = 3.1
const ATTACK_REACH = 46
const ATTACK_ARC_R = 34
const ATTACK_DURATION = 10
const ATTACK_COOLDOWN = 22
const POTION_COOLDOWN = 40
const INVULN_FRAMES = 55
const KNOCKOUT_INVULN = 90

const MAX_MANA = 40
const MANA_REGEN = 0.084
const SPELL_SPEED = 9
const SPELL_RADIUS = 10
const MAX_SPELL_LEVEL = 5

// ── Content ──────────────────────────────────────────────────────────
const FLOOR_THEMES = [
  { name: 'The Slime Pits', wallColor: '#2b1810', floorColor: '#4a3222', accent: '#e0b060', monsterPool: ['slime', 'rat', 'fly'], boss: 'oozeking' },
  { name: 'The Goblin Den', wallColor: '#241a35', floorColor: '#3a2b52', accent: '#b39dff', monsterPool: ['goblin', 'kobold', 'rat'], boss: 'goblinking' },
  { name: 'The Bat Belfry', wallColor: '#161b2b', floorColor: '#232c47', accent: '#7fa6ff', monsterPool: ['bat', 'spider', 'fly'], boss: 'bartholomew' },
  { name: 'The Bone Crypts', wallColor: '#1c1c1c', floorColor: '#333333', accent: '#e8dcb8', monsterPool: ['skeleton', 'ghost', 'kobold'], boss: 'bonesmcgee' },
  { name: "The Ogre's Hold", wallColor: '#2a1020', floorColor: '#451a35', accent: '#ff9fcf', monsterPool: ['skeleton', 'goblin', 'bat', 'ghost'], boss: 'ogrewarlord' },
  { name: 'The Treasure Vault', wallColor: '#2a2a1c', floorColor: '#3a3a26', accent: '#f0c040', monsterPool: ['golem', 'rat', 'slime'], boss: 'coinsmasher' },
  { name: 'The Sewer Depths', wallColor: '#1c2a2a', floorColor: '#243a3a', accent: '#8fe0e0', monsterPool: ['sewerworm', 'goblin', 'kobold'], boss: 'spincycle' },
  { name: 'The Arcane Ruins', wallColor: '#150f2a', floorColor: '#221a3f', accent: '#ff5fd1', monsterPool: ['wisp', 'fly', 'rat'], boss: 'highscorehog' },
  { name: 'The Overgrown Grove', wallColor: '#132015', floorColor: '#1f3322', accent: '#7fe08a', monsterPool: ['vine', 'spider', 'kobold'], boss: 'manfern' },
  { name: 'The Frozen Caverns', wallColor: '#1a2430', floorColor: '#28394a', accent: '#bfe8ff', monsterPool: ['frostimp', 'ghost', 'fly'], boss: 'frostbite' },
  { name: 'The Golem Scrapyard', wallColor: '#2a2018', floorColor: '#3d2f22', accent: '#e0a060', monsterPool: ['scrapgolem', 'rat', 'skeleton'], boss: 'rustyrecliner' },
  { name: 'The Harpy Cliffs', wallColor: '#1a2438', floorColor: '#28374f', accent: '#cfe0ff', monsterPool: ['harpy', 'bat', 'fly'], boss: 'biggulliver' },
  { name: 'The Molten Forge', wallColor: '#241414', floorColor: '#3a2020', accent: '#ff9a6b', monsterPool: ['fireimp', 'ghost', 'spider'], boss: 'steamsalot' },
  { name: "The Beastmaster's Menagerie", wallColor: '#22200f', floorColor: '#39351c', accent: '#ffe08a', monsterPool: ['direwolf', 'kobold', 'goblin'], boss: 'nibbles' },
  { name: 'The Mimic Archive', wallColor: '#1a1610', floorColor: '#2b2418', accent: '#d8c090', monsterPool: ['mimic', 'ghost', 'bat'], boss: 'lastlibrarian' },
  { name: 'The Shade Theater', wallColor: '#2a1428', floorColor: '#3f1f3d', accent: '#ff9fe0', monsterPool: ['doppelganger', 'skeleton', 'goblin'], boss: 'understudy' },
  { name: 'The Banshee Court', wallColor: '#141f18', floorColor: '#1f3527', accent: '#8affc0', monsterPool: ['banshee', 'ghost', 'skeleton'], boss: 'divadeluxe' },
  { name: "The Dragon's Spire", wallColor: '#0c0c14', floorColor: '#181824', accent: '#ffd34d', monsterPool: ['banshee', 'doppelganger', 'skeleton'], boss: 'producer' },
]

const MONSTER_DEFS = {
  slime: { name: 'Slime', kind: 'ooze', color: '#6BE86B', accent: '#2E7D32', r: 15, hp: 16, atk: 3, speed: 1.6, xp: 8 },
  rat: { name: 'Giant Rat', kind: 'beast', color: '#8a7460', accent: '#3a2f26', r: 13, hp: 12, atk: 2, speed: 2.6, xp: 7 },
  fly: { name: 'Carrion Fly', kind: 'flyer', variant: 'insect', color: '#4a4a5a', accent: '#9ad1ff', r: 11, hp: 9, atk: 2, speed: 2.2, xp: 6 },
  goblin: { name: 'Goblin', kind: 'humanoid', variant: 'goblin', color: '#5fae4a', accent: '#2f5c26', r: 15, hp: 20, atk: 4, speed: 1.7, xp: 10 },
  kobold: { name: 'Kobold', kind: 'humanoid', variant: 'small', color: '#b0603e', accent: '#6e3620', r: 13, hp: 11, atk: 2, speed: 2.8, xp: 6 },
  bat: { name: 'Cave Bat', kind: 'flyer', variant: 'bat', color: '#4a3a5a', accent: '#c9a6ff', r: 13, hp: 14, atk: 3, speed: 3.0, xp: 9 },
  spider: { name: 'Giant Spider', kind: 'arachnid', color: '#2a1f30', accent: '#ff5566', r: 13, hp: 13, atk: 3, speed: 2.0, xp: 8 },
  skeleton: { name: 'Skeleton Warrior', kind: 'humanoid', variant: 'bone', color: '#e8dcc0', accent: '#2a2a2a', r: 16, hp: 24, atk: 5, speed: 1.5, xp: 12 },
  ghost: { name: 'Restless Spirit', kind: 'spectral', color: '#cfe8ff', accent: '#7fa6ff', r: 15, hp: 18, atk: 4, speed: 1.8, xp: 10 },
  golem: { name: 'Stone Golem', kind: 'golem', color: '#8a8a8a', accent: '#8fd3ff', r: 16, hp: 22, atk: 4, speed: 1.4, xp: 9 },
  sewerworm: { name: 'Giant Worm', kind: 'serpent', color: '#7a9a5a', accent: '#3d4f2c', r: 12, hp: 14, atk: 3, speed: 2.0, xp: 8 },
  wisp: { name: "Will-o'-Wisp", kind: 'orb', color: '#8fd3ff', accent: '#ffffff', r: 12, hp: 13, atk: 3, speed: 3.2, xp: 9 },
  vine: { name: 'Grasping Vine', kind: 'plant', color: '#3f7a3f', accent: '#8fe08a', r: 14, hp: 19, atk: 4, speed: 1.2, xp: 10 },
  frostimp: { name: 'Frost Imp', kind: 'imp', variant: 'frost', color: '#7fd0ff', accent: '#eaffff', r: 13, hp: 15, atk: 3, speed: 2.4, xp: 9 },
  scrapgolem: { name: 'Rust Golem', kind: 'golem', variant: 'rust', color: '#a05a30', accent: '#ffcf80', r: 16, hp: 23, atk: 5, speed: 1.6, xp: 11 },
  harpy: { name: 'Harpy', kind: 'flyer', variant: 'harpy', color: '#a08050', accent: '#e0c090', r: 11, hp: 12, atk: 2, speed: 3.6, xp: 8 },
  fireimp: { name: 'Fire Imp', kind: 'imp', variant: 'fire', color: '#ff6b4a', accent: '#ffd34d', r: 13, hp: 17, atk: 4, speed: 2.6, xp: 10 },
  direwolf: { name: 'Dire Wolf', kind: 'beast', variant: 'wolf', color: '#4a4a52', accent: '#e8e8e8', r: 15, hp: 20, atk: 4, speed: 2.2, xp: 10 },
  mimic: { name: 'Mimic', kind: 'mimic', color: '#7a4a2a', accent: '#ffe08a', r: 13, hp: 16, atk: 3, speed: 1.8, xp: 9 },
  doppelganger: { name: 'Doppelganger', kind: 'humanoid', variant: 'shadow', color: '#3a2a4a', accent: '#c9a6ff', r: 15, hp: 21, atk: 5, speed: 2.0, xp: 11 },
  banshee: { name: 'Banshee', kind: 'spectral', variant: 'banshee', color: '#d8e8ff', accent: '#8fd3ff', r: 13, hp: 18, atk: 4, speed: 3.0, xp: 10 },
}

const BOSS_DEFS = {
  oozeking: { name: 'Glutton, the Ooze King', kind: 'ooze', color: '#6BE86B', accent: '#FFD34D', crown: true, r: 30, hp: 120, atk: 7, speed: 1.3, xp: 70 },
  goblinking: { name: 'The Goblin King', kind: 'humanoid', variant: 'goblin', color: '#4a8f3a', accent: '#FFD34D', crown: true, r: 30, hp: 160, atk: 9, speed: 1.5, xp: 110 },
  bartholomew: { name: 'Bartholomew, the Elder Bat', kind: 'flyer', variant: 'bat', color: '#3a2a4a', accent: '#c9a6ff', r: 30, hp: 190, atk: 10, speed: 2.4, xp: 150 },
  bonesmcgee: { name: 'Bones McGee, the Bone Reaper', kind: 'humanoid', variant: 'bone', color: '#e8dcc0', accent: '#2a2a2a', scythe: true, r: 32, hp: 220, atk: 12, speed: 1.6, xp: 190 },
  ogrewarlord: { name: 'The Ogre Warlord', kind: 'humanoid', variant: 'ogre', color: '#6a7a4a', accent: '#2f3a20', bulky: true, r: 34, hp: 300, atk: 15, speed: 1.7, xp: 300 },
  coinsmasher: { name: 'Coinsmasher, the Vault Golem', kind: 'golem', variant: 'gold', color: '#9a9a9a', accent: '#FFD34D', r: 32, hp: 345, atk: 17, speed: 1.4, xp: 207 },
  spincycle: { name: 'The Sewer Hydra', kind: 'serpent', heads: 3, color: '#5a7a3a', accent: '#c9e08a', r: 32, hp: 390, atk: 19, speed: 2.0, xp: 234 },
  highscorehog: { name: 'The Arcane Eye', kind: 'orb', variant: 'eye', color: '#c96bff', accent: '#ffffff', r: 32, hp: 435, atk: 21, speed: 2.6, xp: 261 },
  manfern: { name: 'The Bramble Horror', kind: 'plant', color: '#2f5c2f', accent: '#ff5566', r: 33, hp: 480, atk: 23, speed: 1.2, xp: 288 },
  frostbite: { name: 'Frostbite, the Ice Troll', kind: 'humanoid', variant: 'ice', color: '#9fd8ff', accent: '#e9fbff', bulky: true, r: 33, hp: 525, atk: 25, speed: 1.8, xp: 315 },
  rustyrecliner: { name: 'The Scrap Titan', kind: 'golem', variant: 'rust', color: '#a05a30', accent: '#ffcf80', r: 34, hp: 570, atk: 27, speed: 1.3, xp: 342 },
  biggulliver: { name: 'The Harpy Queen', kind: 'flyer', variant: 'harpy', color: '#c09050', accent: '#ffe9b8', crown: true, r: 34, hp: 615, atk: 29, speed: 3.0, xp: 369 },
  steamsalot: { name: 'The Forge Demon', kind: 'imp', variant: 'fire', demon: true, color: '#ff5533', accent: '#ffd34d', r: 34, hp: 660, atk: 31, speed: 1.7, xp: 396 },
  nibbles: { name: 'The Chimera', kind: 'beast', variant: 'wolf', chimera: true, color: '#8a6a3a', accent: '#e0c090', r: 35, hp: 705, atk: 33, speed: 2.2, xp: 423 },
  lastlibrarian: { name: 'The Mimic Lord', kind: 'mimic', color: '#7a4a2a', accent: '#ffe08a', r: 35, hp: 750, atk: 35, speed: 1.6, xp: 450 },
  understudy: { name: 'The Shade Sovereign', kind: 'humanoid', variant: 'shadow', color: '#2a1a3a', accent: '#c9a6ff', crown: true, r: 35, hp: 795, atk: 37, speed: 2.1, xp: 477 },
  divadeluxe: { name: 'The Banshee Queen', kind: 'spectral', variant: 'banshee', color: '#e8f0ff', accent: '#8fd3ff', crown: true, r: 36, hp: 840, atk: 39, speed: 2.4, xp: 504 },
  producer: { name: 'The Dragon King', kind: 'dragon', color: '#6b2ab8', accent: '#ff5566', r: 40, hp: 1700, atk: 55, speed: 2.0, xp: 1000 },
}

const WEAPONS = [
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
const ARMORS = [
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

const SPELLS = [
  { id: 'bolt', name: 'Magic Bolt', emoji: '🔮', kind: 'projectile', baseCost: 14, cooldown: 30, baseDamage: 6, splash: 0 },
  { id: 'fireball', name: 'Fireball', emoji: '🔥', kind: 'projectile', baseCost: 22, cooldown: 66, baseDamage: 14, splash: 40 },
  { id: 'ice', name: 'Ice Shard', emoji: '❄️', kind: 'projectile', baseCost: 16, cooldown: 42, baseDamage: 7, splash: 0, slowMult: 0.4, slowFrames: 120 },
  { id: 'chainzap', name: 'Chain Zap', emoji: '⚡', kind: 'projectile', baseCost: 20, cooldown: 54, baseDamage: 5, splash: 70 },
  { id: 'snackheal', name: 'Snack Heal', emoji: '🧃', kind: 'heal', baseCost: 18, cooldown: 96, baseHeal: 14 },
]

const CLASSES = [
  { id: 'warrior', name: 'Warrior', emoji: '⚔️', desc: 'Melee-focused: more attack, more health.', atk: 3, def: 1, hp: 10, mana: 0 },
  { id: 'mage', name: 'Mage', emoji: '🪄', desc: 'A glass-cannon spellcaster: huge mana pool, less health.', atk: -1, def: 0, hp: -6, mana: 20 },
  { id: 'rogue', name: 'Rogue', emoji: '🗡️', desc: 'Fast and balanced, with a little extra mana.', atk: 1, def: 0, hp: 0, mana: 5, speedMult: 1.15 },
  { id: 'cleric', name: 'Cleric', emoji: '💖', desc: 'Tanky support with solid defense and mana.', atk: 0, def: 2, hp: 6, mana: 10 },
]
const RACES = [
  { id: 'human', name: 'Human', emoji: '🧑', desc: 'Balanced all-rounder.', atk: 1, def: 1, hp: 4, mana: 4 },
  { id: 'elf', name: 'Elf', emoji: '🧝', desc: 'Extra mana and speed, but fragile.', atk: 0, def: 0, hp: -4, mana: 12, speedMult: 1.1 },
  { id: 'dwarf', name: 'Dwarf', emoji: '🧔', desc: 'Tough and tanky, but a little slow.', atk: 0, def: 2, hp: 10, mana: 0, speedMult: 0.92 },
  { id: 'hamsterkin', name: 'Hamsterkin', emoji: '🐹', desc: 'Fast and lucky with gold, but a lighter hitter.', atk: -1, def: 0, hp: 0, mana: 0, speedMult: 1.2, goldMult: 1.2 },
]

const ACHIEVEMENTS = [
  { id: 'contestant', name: 'Chosen Contestant', desc: 'Step into the dungeon.' },
  { id: 'firstblood', name: 'Slime Time', desc: 'Defeat your first monster.' },
  { id: 'lootgoblin', name: 'Loot Goblin', desc: 'Open 5 chests.' },
  { id: 'goblinslayer', name: 'Goblin Slayer', desc: 'Defeat a Goblin.' },
  { id: 'snackbreak', name: 'Snack Break', desc: 'Drink a potion.' },
  { id: 'bossbeat1', name: 'Big Boss Energy', desc: 'Defeat a floor boss.' },
  { id: 'geared', name: 'Fashionably Equipped', desc: 'Equip a weapon and armor.' },
  { id: 'spellcaster', name: 'Wand Enthusiast', desc: 'Cast your first spell.' },
  { id: 'spellbound', name: 'Spellbound', desc: 'Learn all 5 spells.' },
  { id: 'archmage', name: 'Archmage', desc: 'Level a spell up to level 5.' },
  { id: 'oof', name: 'Free Respawn', desc: 'Get knocked out (it happens to everyone).' },
  { id: 'richkid', name: 'Pocket Full of Gold', desc: 'Collect 200 gold.' },
  { id: 'champion', name: 'Dungeon Champion', desc: 'Beat the whole dungeon!' },
]

const PET_LINES = {
  intro: ['Wait, why can I talk?! Also why are we in a dungeon?', 'This seems fine. This seems totally fine.', 'If there are cheese puffs down here, I call dibs.'],
  floorStart: ['Ooh, new floor smell.', "I've got a good feeling about this one. Probably.", "Try not to trip. I'm watching. Judging, a little."],
  lowHp: ["You're looking a little squishy. Maybe drink something?", 'That is a LOT of ouch. Potion time?', "I would not survive that. Good thing it's you and not me."],
  bossIntro: ["That thing looks like it eats hamsters. I'll be over here.", "Big. Scary. Round. You've got this. Probably.", 'On the count of three, you go first. One, two — go!'],
  levelUp: ['Look at you go! Very impressive, for a non-hamster.', "Stronger AND still hasn't found snacks. Bold strategy.", 'Level up! I take full credit for the moral support.'],
  idle: ['Do dungeons have a snack bar? Asking for a friend.', "I've decided my job here is 'vibes'.", 'Statistically, we should be more scared than we are.', 'Is it just me, or does that wall look suspicious?'],
  victory: ['WE did it. Well, YOU did it. I cheered very hard.', 'Put that on my resume: Professional Boss Witness.', 'Ten out of ten, would get zapped into a dungeon again.'],
}
const ANNOUNCER_LINES = {
  welcome: ['Welcome, contestant, to the greatest game show never legally reviewed by anyone!', "Ratings are through the roof, folks — let's get this dungeon started!"],
  floorStart: ['Floor cleared? On to the next one — the crowd demands more!', 'New floor, new monsters, same excellent snack sponsorship!'],
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
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

// ── Map generation ───────────────────────────────────────────────────
function isWalkable(tiles, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false
  return tiles[ty * COLS + tx] === 1
}
function circleWalkable(tiles, x, y, r) {
  const pts = [[x - r, y], [x + r, y], [x, y - r], [x, y + r], [x, y]]
  for (const [px, py] of pts) {
    if (!isWalkable(tiles, Math.floor(px / TILE), Math.floor(py / TILE))) return false
  }
  return true
}
function setFloor(tiles, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return
  tiles[y * COLS + x] = 1
}
function carveH(tiles, x1, x2, y) {
  const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1]
  for (let x = lo; x <= hi; x++) { setFloor(tiles, x, y); setFloor(tiles, x, y + 1) }
}
function carveV(tiles, y1, y2, x) {
  const [lo, hi] = y1 < y2 ? [y1, y2] : [y2, y1]
  for (let y = lo; y <= hi; y++) { setFloor(tiles, x, y); setFloor(tiles, x + 1, y) }
}
function rectsOverlapPad(a, b, pad) {
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y)
}
function roomCenterTile(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 } }
function tileToWorld(pt) { return { x: pt.x * TILE, y: pt.y * TILE } }
function rectToWorldBounds(r) { return { x0: r.x * TILE, y0: r.y * TILE, x1: (r.x + r.w) * TILE, y1: (r.y + r.h) * TILE } }
function boundsCenter(b) { return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 } }
function pointInBounds(px, py, b) { return px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1 }
function randomPointInRoom(room) {
  const tx = room.x + 1 + Math.random() * Math.max(0.01, room.w - 2)
  const ty = room.y + 1 + Math.random() * Math.max(0.01, room.h - 2)
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }
}

function createMonster(type, x, y, floorIndex, id) {
  const def = MONSTER_DEFS[type]
  const mult = 1 + floorIndex * 0.35
  return {
    id, type, name: def.name, kind: def.kind, variant: def.variant || null,
    color: def.color, accent: def.accent, x, y, r: def.r,
    hp: Math.round(def.hp * mult), maxHp: Math.round(def.hp * mult),
    atk: Math.round(def.atk * mult), speed: def.speed, xp: Math.round(def.xp * mult),
    wanderDir: { x: 0, y: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockY: 0, knockTimer: 0, slowMult: 1, slowTimer: 0,
    dead: false, removeMe: false, isBoss: false,
  }
}
function createBoss(bossId, x, y, id) {
  const def = BOSS_DEFS[bossId]
  return {
    id, type: bossId, name: def.name, kind: def.kind, variant: def.variant || null,
    color: def.color, accent: def.accent, x, y, r: def.r,
    crown: !!def.crown, bulky: !!def.bulky, chimera: !!def.chimera,
    heads: def.heads || 1, demon: !!def.demon, scythe: !!def.scythe,
    hp: def.hp, maxHp: def.hp, atk: def.atk, speed: def.speed, xp: def.xp,
    wanderDir: { x: 0, y: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockY: 0, knockTimer: 0, slowMult: 1, slowTimer: 0,
    dead: false, removeMe: false, isBoss: true,
  }
}

function generateFloor(floorIndex) {
  const theme = FLOOR_THEMES[floorIndex]
  const tiles = new Uint8Array(COLS * ROWS)
  const rooms = []
  let attempts = 0
  const roomCount = 5 + Math.floor(Math.random() * 3)
  while (rooms.length < roomCount && attempts < 200) {
    attempts++
    const w = 3 + Math.floor(Math.random() * 4)
    const h = 3 + Math.floor(Math.random() * 4)
    const x = 1 + Math.floor(Math.random() * (COLS - w - 2))
    const y = 1 + Math.floor(Math.random() * (ROWS - h - 2))
    const room = { x, y, w, h }
    if (rooms.some(r => rectsOverlapPad(r, room, 1))) continue
    rooms.push(room)
  }
  if (rooms.length < 2) {
    rooms.length = 0
    rooms.push({ x: 2, y: 2, w: 4, h: 4 })
    rooms.push({ x: COLS - 6, y: ROWS - 6, w: 4, h: 4 })
  }
  for (const r of rooms) {
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) tiles[ty * COLS + tx] = 1
  }
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCenterTile(rooms[i - 1])
    const b = roomCenterTile(rooms[i])
    const ax = Math.round(a.x), ay = Math.round(a.y), bx = Math.round(b.x), by = Math.round(b.y)
    if (Math.random() < 0.5) { carveH(tiles, ax, bx, ay); carveV(tiles, ay, by, bx) }
    else { carveV(tiles, ay, by, ax); carveH(tiles, ax, bx, by) }
  }

  const playerSpawn = tileToWorld(roomCenterTile(rooms[0]))
  const bossRoom = rectToWorldBounds(rooms[rooms.length - 1])

  const monsters = []
  let idCounter = 0
  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i]
    const count = 1 + Math.floor(Math.random() * 2) + Math.floor(floorIndex / 2)
    for (let k = 0; k < count; k++) {
      const type = pick(theme.monsterPool)
      const p = randomPointInRoom(room)
      monsters.push(createMonster(type, p.x, p.y, floorIndex, idCounter++))
    }
  }

  const chests = []
  for (let i = 1; i < rooms.length - 1; i++) {
    if (Math.random() < 0.7) {
      const p = randomPointInRoom(rooms[i])
      chests.push({ x: p.x, y: p.y, opened: false })
    }
  }

  return { theme, tiles, rooms, playerSpawn, bossRoom, monsters, chests }
}

// ── Player ───────────────────────────────────────────────────────────
function mkPlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, r: PLAYER_R, facing: { x: 0, y: 1 },
    level: 1, xp: 0, xpNext: 30,
    baseAtk: 4, baseDef: 0, weaponAtk: 0, armorDef: 0,
    atk: 4, def: 0,
    maxHp: 40, hp: 40,
    maxMana: MAX_MANA, mana: MAX_MANA, spellCooldown: 0,
    spells: [{ id: 'bolt', level: 1 }], equippedSpellId: 'bolt',
    classId: null, raceId: null, speedMult: 1, goldMult: 1,
    gold: 0, potions: 1,
    weaponName: null, armorName: null,
    attackCooldown: 0, attackTimer: 0, hitIds: new Set(),
    potionCooldown: 0, invuln: 0,
  }
}

function mkInitialState(twoPlayer = false) {
  const floorIndex = 0
  const floor = generateFloor(floorIndex)
  const player = mkPlayer(floor.playerSpawn)
  // Player 2 object always exists (keeps every player2-touching helper
  // free of null checks) but only actively moves/fights/renders when
  // twoPlayer is true — see activePlayers()/nearestPlayer() below.
  const player2 = mkPlayer({ x: floor.playerSpawn.x + 20, y: floor.playerSpawn.y })
  return {
    floorIndex, theme: floor.theme, tiles: floor.tiles, rooms: floor.rooms,
    bossRoom: floor.bossRoom, monsters: floor.monsters, chests: floor.chests,
    exit: null, bossSpawned: false, bossActive: false, chestsOpened: 0,
    player, player2, twoPlayer, playerSpawn: floor.playerSpawn,
    projectiles: [],
    particles: [], bannerQueue: [], banner: null, bannerTimer: 0,
    petText: pick(PET_LINES.intro), petTimer: 260,
    announcerText: pick(ANNOUNCER_LINES.welcome), announcerTimer: 260,
    achievements: new Set(),
    camera: { x: floor.playerSpawn.x, y: floor.playerSpawn.y },
    shake: 0, frame: 0,
    attackPressed: false, potionPressed: false, spellPressed: false,
    attackPressed2: false, potionPressed2: false, spellPressed2: false,
  }
}

// Active players, in a fixed order — used anywhere co-op-aware logic
// needs to check or update whichever players actually exist this game.
// In solo mode Player 2 is inert (never moved, never rendered), so every
// one of these call sites should only ever see Player 1.
function activePlayers(g) { return g.twoPlayer ? [g.player, g.player2] : [g.player] }
function nearestPlayer(g, m) {
  if (!g.twoPlayer) return g.player
  const p1 = g.player, p2 = g.player2
  const d1 = Math.hypot(p1.x - m.x, p1.y - m.y)
  const d2 = Math.hypot(p2.x - m.x, p2.y - m.y)
  return d1 <= d2 ? p1 : p2
}

// ── Event helpers ────────────────────────────────────────────────────
function pushBanner(g, icon, text, color) { g.bannerQueue.push({ icon, text, color: color || '#fff' }) }
function petSay(g, key) { g.petText = pick(PET_LINES[key]); g.petTimer = 260 }
function announcerSay(g, key) { g.announcerText = pick(ANNOUNCER_LINES[key]); g.announcerTimer = 260 }
function shakeCamera(g, amt) { g.shake = Math.max(g.shake, amt) }
function grantAchievement(g, id) {
  if (g.achievements.has(id)) return
  g.achievements.add(id)
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (def) pushBanner(g, '🏅', `Achievement: ${def.name}`, '#FFD34D')
}
function computeSpellPower(spellDef, level) {
  const mult = 1 + 0.3 * (level - 1)
  const costMult = Math.max(0.68, 1 - 0.08 * (level - 1))
  return {
    cost: Math.round(spellDef.baseCost * costMult),
    damage: spellDef.baseDamage != null ? Math.round(spellDef.baseDamage * mult) : 0,
    heal: spellDef.baseHeal != null ? Math.round(spellDef.baseHeal * mult) : 0,
  }
}
function equipSpell(g, player, id) {
  if (!player.spells.some(s => s.id === id)) return
  player.equippedSpellId = id
}
function learnOrLevelSpell(g, player, id) {
  const def = SPELLS.find(s => s.id === id)
  const known = player.spells.find(s => s.id === id)
  if (!known) {
    player.spells.push({ id, level: 1 })
    pushBanner(g, def.emoji, `Learned a new spell: ${def.name}!`, '#C9A6FF')
    if (player.spells.length === SPELLS.length) grantAchievement(g, 'spellbound')
  } else if (known.level < MAX_SPELL_LEVEL) {
    known.level += 1
    pushBanner(g, def.emoji, `${def.name} leveled up! Now level ${known.level}.`, '#C9A6FF')
    if (known.level === MAX_SPELL_LEVEL) grantAchievement(g, 'archmage')
  } else {
    const gold = Math.round((20 + known.level * 10) * player.goldMult)
    player.gold += gold
    pushBanner(g, '💰', `Already mastered ${def.name} — sold the spare scroll for ${gold} gold`, '#FFD34D')
  }
}
function chooseClassRace(g, player, classId, raceId) {
  if (player.classId) return
  const cls = CLASSES.find(c => c.id === classId)
  const race = RACES.find(r => r.id === raceId)
  if (!cls || !race) return
  const p = player
  p.classId = classId
  p.raceId = raceId
  p.baseAtk += cls.atk + race.atk
  p.baseDef += cls.def + race.def
  p.maxHp += cls.hp + race.hp
  p.maxMana += cls.mana + race.mana
  p.atk = p.baseAtk + p.weaponAtk
  p.def = p.baseDef + p.armorDef
  p.hp = p.maxHp
  p.mana = p.maxMana
  p.speedMult = (cls.speedMult || 1) * (race.speedMult || 1)
  p.goldMult = (cls.goldMult || 1) * (race.goldMult || 1)
  pushBanner(g, cls.emoji, `You are now a ${cls.name} ${race.name}!`, '#FFD34D')
}
function spawnBurst(g, x, y, count, colors) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = rand(1, 3.2)
    g.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 28, maxLife: 28, color: pick(colors) })
  }
}

function tryMoveEntity(g, e, dx, dy) {
  if (dx !== 0) { const nx = e.x + dx; if (circleWalkable(g.tiles, nx, e.y, e.r)) e.x = nx }
  if (dy !== 0) { const ny = e.y + dy; if (circleWalkable(g.tiles, e.x, ny, e.r)) e.y = ny }
}

function knockoutPlayer(g, player) {
  pushBanner(g, '💫', 'Knocked out! Free respawn, contestant!', '#FF9E6B')
  announcerSay(g, 'knockout')
  grantAchievement(g, 'oof')
  player.gold = Math.floor(player.gold * 0.8)
  player.x = g.playerSpawn.x
  player.y = g.playerSpawn.y
  player.hp = Math.floor(player.maxHp * 0.6)
  player.invuln = KNOCKOUT_INVULN
}

function checkLevelUp(g, player) {
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext
    player.level += 1
    player.maxHp += 8
    player.hp = player.maxHp
    player.baseAtk += 1
    player.atk = player.baseAtk + player.weaponAtk
    if (player.level % 2 === 0) { player.baseDef += 1; player.def = player.baseDef + player.armorDef }
    player.xpNext = Math.floor(player.xpNext * 1.35) + 10
    pushBanner(g, '🎉', `Level Up! You are now Level ${player.level}`, '#8FD3FF')
    announcerSay(g, 'levelUp')
    petSay(g, 'levelUp')
  }
}

function onMonsterDeath(g, player, m) {
  spawnBurst(g, m.x, m.y, m.isBoss ? 26 : 12, ['#FFD34D', '#FF8FD3', '#8FD3FF', '#B6FF6B'])
  player.xp += m.xp
  player.gold += Math.round(rand(m.xp * 0.6, m.xp * 1.3) * player.goldMult)
  if (!g.achievements.has('firstblood')) grantAchievement(g, 'firstblood')
  if (m.type === 'goblin') grantAchievement(g, 'goblinslayer')
  if (Math.random() < 0.1) { player.potions = Math.min(5, player.potions + 1); pushBanner(g, '🧃', 'A snack potion fell out!', '#7CFF6B') }
  if (m.isBoss) {
    grantAchievement(g, 'bossbeat1')
    pushBanner(g, '🏆', `${m.name} defeated!`, '#FFD34D')
    announcerSay(g, 'bossDefeat')
    petSay(g, 'victory')
    g.bossActive = false
    g.exit = { x: m.x, y: m.y }
  }
  if (player.gold >= 200) grantAchievement(g, 'richkid')
  checkLevelUp(g, player)
  m.removeMe = true
}

function damageMonster(g, player, m, dmg) {
  m.hp -= dmg
  if (m.hp <= 0 && !m.dead) { m.dead = true; onMonsterDeath(g, player, m) }
}

function openChest(g, player, c) {
  c.opened = true
  spawnBurst(g, c.x, c.y, 10, ['#FFD34D', '#FFE9B8'])
  g.chestsOpened += 1
  if (g.chestsOpened === 5) grantAchievement(g, 'lootgoblin')
  const roll = Math.random()
  const rollDepth = g.floorIndex + 1 + Math.floor(Math.random() * 2)
  if (roll < 0.3) {
    const amt = Math.round((8 + Math.floor(Math.random() * 10) * (g.floorIndex + 1)) * player.goldMult)
    player.gold += amt
    pushBanner(g, '🪙', `Found ${amt} gold!`, '#FFD34D')
  } else if (roll < 0.5) {
    player.potions = Math.min(5, player.potions + 1)
    pushBanner(g, '🧃', 'Found a snack potion!', '#7CFF6B')
  } else if (roll < 0.65) {
    const tier = Math.min(WEAPONS.length - 1, rollDepth)
    const w = WEAPONS[tier]
    if (w.atk > player.weaponAtk) {
      player.weaponAtk = w.atk; player.weaponName = w.name
      player.atk = player.baseAtk + player.weaponAtk
      pushBanner(g, w.emoji, `Equipped ${w.name}! (+${w.atk} ATK)`, '#8FD3FF')
      if (player.weaponName && player.armorName) grantAchievement(g, 'geared')
    } else {
      const gold = Math.round(w.atk * 3 * player.goldMult)
      player.gold += gold
      pushBanner(g, '💰', `Found ${w.name}, sold for ${gold} gold`, '#FFD34D')
    }
  } else if (roll < 0.8) {
    const tier = Math.min(ARMORS.length - 1, rollDepth)
    const a = ARMORS[tier]
    if (a.def > player.armorDef) {
      player.armorDef = a.def; player.armorName = a.name
      player.def = player.baseDef + player.armorDef
      pushBanner(g, a.emoji, `Equipped ${a.name}! (+${a.def} DEF)`, '#8FD3FF')
      if (player.weaponName && player.armorName) grantAchievement(g, 'geared')
    } else {
      const gold = Math.round(a.def * 3 * player.goldMult)
      player.gold += gold
      pushBanner(g, '💰', `Found ${a.name}, sold for ${gold} gold`, '#FFD34D')
    }
  } else {
    learnOrLevelSpell(g, player, pick(SPELLS).id)
  }
  if (player.gold >= 200) grantAchievement(g, 'richkid')
}

function spawnBoss(g) {
  g.bossSpawned = true
  g.bossActive = true
  const c = boundsCenter(g.bossRoom)
  g.monsters.push(createBoss(g.theme.boss, c.x, c.y, 9999))
  const def = BOSS_DEFS[g.theme.boss]
  pushBanner(g, '⚠️', `${def.name} appears!`, '#FF6B6B')
  announcerSay(g, 'bossIntro')
  petSay(g, 'bossIntro')
}

function updateMonsterAI(g, m) {
  if (m.atkCooldown > 0) m.atkCooldown -= 1
  if (m.slowTimer > 0) m.slowTimer -= 1
  const spd = m.speed * (m.slowTimer > 0 ? m.slowMult : 1)
  if (m.knockTimer > 0) { tryMoveEntity(g, m, m.knockX, m.knockY); m.knockTimer -= 1; return }
  const target = nearestPlayer(g, m)
  const dx0 = target.x - m.x, dy0 = target.y - m.y
  const d = Math.hypot(dx0, dy0)
  const aggro = m.isBoss ? 999999 : 230
  if (d < aggro && d > 0.001) {
    tryMoveEntity(g, m, (dx0 / d) * spd, (dy0 / d) * spd)
    if (d < m.r + PLAYER_R + 8 && m.atkCooldown <= 0 && target.invuln <= 0) {
      target.hp -= m.atk
      target.invuln = INVULN_FRAMES
      shakeCamera(g, 5)
      m.atkCooldown = 55
      if (target.hp <= 0) knockoutPlayer(g, target)
    }
  } else {
    m.wanderTimer -= 1
    if (m.wanderTimer <= 0) {
      const a = Math.random() * Math.PI * 2
      m.wanderDir = { x: Math.cos(a), y: Math.sin(a) }
      m.wanderTimer = 60 + Math.random() * 90
    }
    tryMoveEntity(g, m, m.wanderDir.x * spd * 0.4, m.wanderDir.y * spd * 0.4)
  }
}

function advanceFloor(g, helpers) {
  const nextIndex = g.floorIndex + 1
  if (nextIndex >= FLOOR_THEMES.length) {
    grantAchievement(g, 'champion')
    announcerSay(g, 'win')
    helpers.setWinStats({
      level: g.player.level,
      gold: g.player.gold,
      achievements: ACHIEVEMENTS.filter(a => g.achievements.has(a.id)).map(a => a.name),
      totalAchievements: ACHIEVEMENTS.length,
    })
    helpers.setPhase('win')
    return
  }
  const floor = generateFloor(nextIndex)
  g.floorIndex = nextIndex
  g.theme = floor.theme
  g.tiles = floor.tiles
  g.rooms = floor.rooms
  g.bossRoom = floor.bossRoom
  g.monsters = floor.monsters
  g.chests = floor.chests
  g.exit = null
  g.bossSpawned = false
  g.bossActive = false
  g.player.x = floor.playerSpawn.x
  g.player.y = floor.playerSpawn.y
  if (g.twoPlayer) {
    g.player2.x = floor.playerSpawn.x + 20
    g.player2.y = floor.playerSpawn.y
  }
  g.playerSpawn = floor.playerSpawn
  g.camera.x = floor.playerSpawn.x
  g.camera.y = floor.playerSpawn.y
  g.frame = 0
  pushBanner(g, '🚪', `Floor ${nextIndex + 1}: ${floor.theme.name}`, floor.theme.accent)
  announcerSay(g, 'floorStart')
  petSay(g, 'floorStart')
  if (nextIndex === 2 && !g.player.classId) helpers.setPhase('classPick')
}

// ── Per-frame update ─────────────────────────────────────────────────
function movePlayerFromKeys(g, player, keys, up, down, left, right) {
  let mx = 0, my = 0
  if (keys[up]) my -= 1
  if (keys[down]) my += 1
  if (keys[left]) mx -= 1
  if (keys[right]) mx += 1
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my)
    mx /= len; my /= len
    player.facing = { x: mx, y: my }
    tryMoveEntity(g, player, mx * PLAYER_SPEED * player.speedMult, my * PLAYER_SPEED * player.speedMult)
  }
}

function updatePlayerActions(g, player, pressed) {
  if (player.attackCooldown > 0) player.attackCooldown -= 1
  if (pressed.attack && player.attackCooldown <= 0) {
    player.attackCooldown = ATTACK_COOLDOWN
    player.attackTimer = ATTACK_DURATION
    player.hitIds = new Set()
  }
  if (player.attackTimer > 0) {
    player.attackTimer -= 1
    const hbx = player.x + player.facing.x * ATTACK_REACH
    const hby = player.y + player.facing.y * ATTACK_REACH
    for (const m of g.monsters) {
      if (m.dead || player.hitIds.has(m.id)) continue
      const dd = (hbx - m.x) ** 2 + (hby - m.y) ** 2
      if (dd < (ATTACK_ARC_R + m.r) ** 2) {
        player.hitIds.add(m.id)
        const dmg = Math.max(1, player.atk + Math.floor(rand(-1, 2)))
        damageMonster(g, player, m, dmg)
        spawnBurst(g, m.x, m.y, 5, ['#ffffff', '#ffe9b8'])
        const kl = Math.hypot(m.x - player.x, m.y - player.y) || 1
        m.knockX = ((m.x - player.x) / kl) * 6
        m.knockY = ((m.y - player.y) / kl) * 6
        m.knockTimer = 8
      }
    }
  }

  if (player.spellCooldown > 0) player.spellCooldown -= 1
  player.mana = Math.min(player.maxMana, player.mana + MANA_REGEN)
  if (pressed.spell) {
    const spellDef = SPELLS.find(s => s.id === player.equippedSpellId)
    const known = player.spells.find(s => s.id === player.equippedSpellId)
    if (spellDef && known && player.spellCooldown <= 0) {
      const power = computeSpellPower(spellDef, known.level)
      if (player.mana >= power.cost) {
        player.spellCooldown = spellDef.cooldown
        player.mana -= power.cost
        grantAchievement(g, 'spellcaster')
        if (spellDef.kind === 'heal') {
          player.hp = Math.min(player.maxHp, player.hp + power.heal)
          pushBanner(g, spellDef.emoji, `${spellDef.name}! HP restored.`, '#7CFF6B')
        } else {
          g.projectiles.push({
            x: player.x + player.facing.x * 20, y: player.y + player.facing.y * 20,
            vx: player.facing.x * SPELL_SPEED, vy: player.facing.y * SPELL_SPEED,
            life: 90, dmg: power.damage, splash: spellDef.splash || 0,
            slowMult: spellDef.slowMult, slowFrames: spellDef.slowFrames,
            emoji: spellDef.emoji, hitIds: new Set(), dead: false, owner: player,
          })
        }
      }
    }
  }

  if (player.potionCooldown > 0) player.potionCooldown -= 1
  if (pressed.potion) {
    if (player.potionCooldown <= 0 && player.potions > 0 && player.hp < player.maxHp) {
      player.potionCooldown = POTION_COOLDOWN
      player.potions -= 1
      player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.4))
      pushBanner(g, '🧃', 'Snack break! HP restored.', '#7CFF6B')
      grantAchievement(g, 'snackbreak')
    }
  }

  if (player.invuln > 0) player.invuln -= 1
}

function update(g, keys, helpers) {
  g.frame += 1

  movePlayerFromKeys(g, g.player, keys, 'KeyW', 'KeyS', 'KeyA', 'KeyD')
  if (g.twoPlayer) {
    movePlayerFromKeys(g, g.player2, keys, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')
  } else {
    // Solo play: Arrow keys are a free alias for the same single player,
    // matching this game's original (pre-co-op) controls.
    movePlayerFromKeys(g, g.player, keys, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')
  }

  updatePlayerActions(g, g.player, { attack: g.attackPressed, spell: g.spellPressed, potion: g.potionPressed })
  g.attackPressed = false; g.spellPressed = false; g.potionPressed = false
  if (g.twoPlayer) {
    updatePlayerActions(g, g.player2, { attack: g.attackPressed2, spell: g.spellPressed2, potion: g.potionPressed2 })
    g.attackPressed2 = false; g.spellPressed2 = false; g.potionPressed2 = false
  }

  if (g.frame % 240 === 0 && activePlayers(g).some(p => p.hp < p.maxHp * 0.25)) petSay(g, 'lowHp')

  for (const m of g.monsters) { if (!m.dead) updateMonsterAI(g, m) }
  g.monsters = g.monsters.filter(m => !m.removeMe)

  for (const pr of g.projectiles) {
    if (pr.dead) continue
    pr.x += pr.vx; pr.y += pr.vy; pr.life -= 1
    if (pr.life <= 0 || !circleWalkable(g.tiles, pr.x, pr.y, SPELL_RADIUS)) { pr.dead = true; continue }
    for (const m of g.monsters) {
      if (m.dead || pr.hitIds.has(m.id)) continue
      const dd = (pr.x - m.x) ** 2 + (pr.y - m.y) ** 2
      if (dd < (SPELL_RADIUS + m.r) ** 2) {
        pr.hitIds.add(m.id)
        const splashR = pr.splash + SPELL_RADIUS
        for (const m2 of g.monsters) {
          if (m2.dead) continue
          const dd2 = (pr.x - m2.x) ** 2 + (pr.y - m2.y) ** 2
          if (dd2 < (splashR + m2.r) ** 2) {
            damageMonster(g, pr.owner, m2, pr.dmg)
            spawnBurst(g, m2.x, m2.y, 5, ['#c9a6ff', '#8fd3ff', '#ffffff'])
            if (pr.slowMult) { m2.slowMult = pr.slowMult; m2.slowTimer = pr.slowFrames }
          }
        }
        pr.dead = true
        break
      }
    }
  }
  g.projectiles = g.projectiles.filter(pr => !pr.dead)

  for (const c of g.chests) {
    if (c.opened) continue
    const opener = activePlayers(g).find(p => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < (PLAYER_R + 18) ** 2)
    if (opener) openChest(g, opener, c)
  }

  if (g.bossRoom && !g.bossSpawned && activePlayers(g).some(p => pointInBounds(p.x, p.y, g.bossRoom))) spawnBoss(g)

  if (g.exit) {
    const reached = activePlayers(g).some(p => (p.x - g.exit.x) ** 2 + (p.y - g.exit.y) ** 2 < (PLAYER_R + 20) ** 2)
    if (reached) { g.exit = null; advanceFloor(g, helpers); return }
  }

  for (const p of g.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1 }
  g.particles = g.particles.filter(p => p.life > 0)

  g.shake = Math.max(0, g.shake - 0.6)

  if (!g.banner && g.bannerQueue.length) { g.banner = g.bannerQueue.shift(); g.bannerTimer = 140 }
  if (g.banner) { g.bannerTimer -= 1; if (g.bannerTimer <= 0) g.banner = null }
  if (g.petTimer > 0) g.petTimer -= 1
  if (g.announcerTimer > 0) g.announcerTimer -= 1
  if (g.petTimer <= 0 && Math.random() < 0.003) petSay(g, 'idle')
  if (g.announcerTimer <= 0 && Math.random() < 0.0015) announcerSay(g, 'idle')

  const mapW = COLS * TILE, mapH = ROWS * TILE
  const camTargetX = g.twoPlayer ? (g.player.x + g.player2.x) / 2 : g.player.x
  const camTargetY = g.twoPlayer ? (g.player.y + g.player2.y) / 2 : g.player.y
  g.camera.x += (camTargetX - g.camera.x) * 0.15
  g.camera.y += (camTargetY - g.camera.y) * 0.15
}

// ── Monster & player sprite rendering (procedural shapes, no emoji) ──
function drawEyes(ctx, cx, cy, gap, rad, pupilColor) {
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(cx + s * gap, cy, rad, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.beginPath(); ctx.arc(cx + s * gap, cy, rad * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = pupilColor; ctx.fill()
  }
}
function drawGlowEyes(ctx, cx, cy, gap, rad, color) {
  ctx.fillStyle = color
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * gap, cy, rad, 0, Math.PI * 2); ctx.fill() }
}
function drawCrown(ctx, cy, w) {
  ctx.fillStyle = '#FFD34D'
  ctx.beginPath()
  ctx.moveTo(-w, cy); ctx.lineTo(-w, cy - w * 0.5)
  ctx.lineTo(-w * 0.5, cy - w * 0.1); ctx.lineTo(0, cy - w * 0.7)
  ctx.lineTo(w * 0.5, cy - w * 0.1); ctx.lineTo(w, cy - w * 0.5)
  ctx.lineTo(w, cy); ctx.closePath(); ctx.fill()
}

function drawCreature(ctx, m, t) {
  const r = m.r, color = m.color, accent = m.accent, variant = m.variant || ''
  const bob = Math.sin(t * 0.08 + m.id * 0.9) * (m.isBoss ? 1.5 : 2)
  ctx.save()
  ctx.translate(m.x, m.y + bob)

  if (m.isBoss) {
    ctx.save()
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 0.1 + m.id)
    ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2)
    ctx.fillStyle = accent; ctx.fill()
    ctx.restore()
  }

  switch (m.kind) {
    case 'ooze': {
      const wob = Math.sin(t * 0.12 + m.id) * r * 0.08
      ctx.beginPath()
      ctx.moveTo(-r, r * 0.6)
      ctx.quadraticCurveTo(-r - wob, -r * 0.15, -r * 0.5, -r * 0.75)
      ctx.quadraticCurveTo(0, -r * 0.95, r * 0.5, -r * 0.75)
      ctx.quadraticCurveTo(r + wob, -r * 0.15, r, r * 0.6)
      ctx.quadraticCurveTo(0, r * 0.85, -r, r * 0.6)
      ctx.closePath()
      ctx.globalAlpha = 0.85; ctx.fillStyle = color; ctx.fill()
      ctx.globalAlpha = 1; ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke()
      drawEyes(ctx, 0, -r * 0.1, r * 0.28, r * 0.14, '#1a1a1a')
      if (m.crown) drawCrown(ctx, -r * 0.85, r * 0.35)
      break
    }
    case 'beast': {
      ctx.fillStyle = color
      ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.85, r * 0.55, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.18
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * r * 0.5, r * 0.5); ctx.lineTo(s * r * 0.55, r * 0.98); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(s * r * 0.1, r * 0.55); ctx.lineTo(s * r * 0.15, r * 1.02); ctx.stroke()
      }
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.14
      ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.1); ctx.quadraticCurveTo(-r * 1.35, -r * 0.15, -r * 1.15, -r * 0.55); ctx.stroke()
      ctx.beginPath(); ctx.arc(r * 0.68, -r * 0.2, r * 0.42, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.55); ctx.lineTo(r * 0.62, -r * 0.9); ctx.lineTo(r * 0.78, -r * 0.55); ctx.closePath(); ctx.fill()
      drawEyes(ctx, r * 0.75, -r * 0.25, r * 0.14, r * 0.08, '#1a1a1a')
      if (variant === 'wolf') {
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.02); ctx.lineTo(r * 0.6, r * 0.18); ctx.lineTo(r * 0.65, r * 0.02); ctx.closePath(); ctx.fill()
      }
      if (m.chimera) {
        ctx.strokeStyle = accent; ctx.lineWidth = r * 0.09
        ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.5); ctx.lineTo(-r * 0.55, -r * 0.85); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.55); ctx.lineTo(0, -r * 0.92); ctx.stroke()
        ctx.fillStyle = accent
        ctx.beginPath(); ctx.arc(-r * 1.05, -r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fill()
      }
      break
    }
    case 'flyer': {
      const flap = Math.sin(t * 0.4 + m.id) * 0.5 + 0.5
      ctx.fillStyle = color
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1)
        ctx.beginPath()
        ctx.moveTo(r * 0.15, 0)
        ctx.quadraticCurveTo(r * 1.3, -r * (0.5 + flap * 0.5), r * 1.5, r * 0.1)
        ctx.quadraticCurveTo(r * 0.8, r * 0.15, r * 0.15, r * 0.3)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.5, r * 0.4, 0, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      if (variant === 'harpy') {
        ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
        drawEyes(ctx, 0, -r * 0.4, r * 0.13, r * 0.07, '#1a1a1a')
        ctx.fillStyle = '#e8c060'
        ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(r * 0.15, -r * 0.15); ctx.lineTo(-r * 0.02, -r * 0.12); ctx.closePath(); ctx.fill()
      } else if (variant === 'bat') {
        drawGlowEyes(ctx, 0, -r * 0.05, r * 0.16, r * 0.09, accent)
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.2); ctx.lineTo(-r * 0.15, r * 0.35); ctx.lineTo(-r * 0.02, r * 0.22); ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.2); ctx.lineTo(r * 0.15, r * 0.35); ctx.lineTo(r * 0.02, r * 0.22); ctx.closePath(); ctx.fill()
      } else {
        drawEyes(ctx, 0, r * 0.05, r * 0.2, r * 0.14, '#1a1a1a')
      }
      if (m.crown) drawCrown(ctx, -r * 0.65, r * 0.3)
      break
    }
    case 'humanoid': {
      const bulky = m.bulky || variant === 'ogre' || variant === 'ice'
      const w = bulky ? r * 0.95 : r * 0.6
      ctx.fillStyle = color
      ctx.beginPath(); ctx.moveTo(-w * 0.55, r * 0.9); ctx.lineTo(-w * 0.4, -r * 0.1)
      ctx.lineTo(w * 0.4, -r * 0.1); ctx.lineTo(w * 0.55, r * 0.9); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = r * (bulky ? 0.24 : 0.16)
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.3, r * 0.9); ctx.lineTo(s * w * 0.32, r * 1.3); ctx.stroke() }
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.5, r * 0.05); ctx.lineTo(s * w * 0.85, r * 0.45); ctx.stroke() }
      ctx.beginPath(); ctx.arc(0, -r * 0.4, r * (bulky ? 0.55 : 0.42), 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      if (variant === 'bone') {
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.42, r * 0.09, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.42, r * 0.09, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(-r * 0.12, -r * 0.22, r * 0.24, r * 0.08)
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.18, r * 0.05); ctx.lineTo(i * r * 0.18, r * 0.55); ctx.stroke() }
      } else if (variant === 'shadow') {
        ctx.globalAlpha = 0.75
        drawGlowEyes(ctx, 0, -r * 0.42, r * 0.16, r * 0.09, accent)
        ctx.globalAlpha = 1
      } else {
        drawEyes(ctx, 0, -r * 0.42, r * 0.15, r * 0.08, '#1a1a1a')
        if (variant === 'goblin' || !variant) {
          ctx.fillStyle = accent
          ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.55); ctx.lineTo(-r * 0.65, -r * 0.85); ctx.lineTo(-r * 0.35, -r * 0.65); ctx.closePath(); ctx.fill()
          ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.55); ctx.lineTo(r * 0.65, -r * 0.85); ctx.lineTo(r * 0.35, -r * 0.65); ctx.closePath(); ctx.fill()
        }
      }
      ctx.strokeStyle = m.scythe ? '#c9c9c9' : (accent || '#c9c9c9')
      ctx.lineWidth = r * 0.12
      ctx.beginPath(); ctx.moveTo(w * 0.7, r * 0.1); ctx.lineTo(w * (m.scythe ? 1.3 : 1.05), -r * (m.scythe ? 0.8 : 0.5)); ctx.stroke()
      if (m.crown) drawCrown(ctx, -r * 0.85, r * 0.3)
      break
    }
    case 'arachnid': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.1
      for (let i = 0; i < 4; i++) {
        const ang = -0.5 + i * 0.35
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, 0)
          ctx.quadraticCurveTo(s * r * Math.cos(ang) * 0.8, r * 0.1, s * r * (0.9 + i * 0.1), r * (0.5 - i * 0.15))
          ctx.stroke()
        }
      }
      ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.55, r * 0.45, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      drawGlowEyes(ctx, 0, -r * 0.4, r * 0.15, r * 0.06, accent)
      drawGlowEyes(ctx, 0, -r * 0.28, r * 0.09, r * 0.045, accent)
      break
    }
    case 'spectral': {
      const wob = Math.sin(t * 0.1 + m.id) * r * 0.1
      ctx.globalAlpha = 0.75
      ctx.beginPath()
      ctx.moveTo(-r * 0.7, r * 0.4)
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.5, 0, -r * 0.85)
      ctx.quadraticCurveTo(r * 0.9, -r * 0.5, r * 0.7, r * 0.4)
      ctx.quadraticCurveTo(r * 0.4 + wob, r * 0.75, r * 0.15, r * 0.5)
      ctx.quadraticCurveTo(0, r * 0.7, -r * 0.15, r * 0.5)
      ctx.quadraticCurveTo(-r * 0.4 - wob, r * 0.75, -r * 0.7, r * 0.4)
      ctx.closePath()
      ctx.fillStyle = color; ctx.fill()
      ctx.globalAlpha = 1
      if (variant === 'banshee') {
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.6); ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, -r * 0.5, r * 0.2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.6); ctx.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.5, r * 0.2); ctx.stroke()
        ctx.fillStyle = '#3a2030'
        ctx.beginPath(); ctx.ellipse(0, r * 0.05, r * 0.14, r * 0.2, 0, 0, Math.PI * 2); ctx.fill()
      }
      drawGlowEyes(ctx, 0, -r * 0.35, r * 0.18, r * 0.09, accent)
      if (m.crown) drawCrown(ctx, -r * 0.75, r * 0.3)
      break
    }
    case 'golem': {
      ctx.fillStyle = color
      ctx.fillRect(-r * 0.75, -r * 0.15, r * 1.5, r * 1.0)
      ctx.fillRect(-r * 0.4, -r * 0.75, r * 0.8, r * 0.65)
      for (const s of [-1, 1]) ctx.fillRect(s > 0 ? r * 0.85 : -r * 1.1, -r * 0.05, r * 0.25, r * 0.55)
      ctx.strokeStyle = accent; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.1); ctx.lineTo(0, r * 0.3); ctx.lineTo(r * 0.3, -r * 0.05); ctx.stroke()
      drawGlowEyes(ctx, 0, -r * 0.45, r * 0.14, r * 0.08, accent)
      break
    }
    case 'serpent': {
      const heads = m.heads || 1
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.5; ctx.lineCap = 'round'
      const spread = heads > 1 ? r * 0.5 : 0
      for (let h = 0; h < heads; h++) {
        const off = heads > 1 ? (h - (heads - 1) / 2) * spread : 0
        ctx.beginPath()
        ctx.moveTo(0, r * 0.7)
        ctx.quadraticCurveTo(off * 0.6, r * 0.1, off, -r * 0.6)
        ctx.stroke()
        ctx.beginPath(); ctx.arc(off, -r * 0.65, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
        drawGlowEyes(ctx, off, -r * 0.7, r * 0.12, r * 0.06, accent)
      }
      ctx.lineCap = 'butt'
      break
    }
    case 'orb': {
      const pulse = 1 + Math.sin(t * 0.15 + m.id) * 0.08
      ctx.save(); ctx.scale(pulse, pulse)
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
      ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.1, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#1a1a1a'; ctx.fill()
      ctx.restore()
      break
    }
    case 'plant': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.22
      const sway = Math.sin(t * 0.06 + m.id) * r * 0.2
      ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.quadraticCurveTo(sway, 0, 0, -r * 0.6); ctx.stroke()
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, r * 0.3); ctx.quadraticCurveTo(s * r * 0.7, r * 0.1, s * r * 0.9 + sway * 0.5, -r * 0.3); ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.55); ctx.quadraticCurveTo(0, -r * 0.25, r * 0.3, -r * 0.55); ctx.quadraticCurveTo(0, -r * 0.4, -r * 0.3, -r * 0.55); ctx.fill()
      drawGlowEyes(ctx, 0, -r * 0.85, r * 0.14, r * 0.07, '#ffffff')
      break
    }
    case 'imp': {
      ctx.fillStyle = color
      ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.8); ctx.lineTo(-r * 0.35, -r * 0.05); ctx.lineTo(r * 0.35, -r * 0.05); ctx.lineTo(r * 0.4, r * 0.8); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.4, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.65); ctx.lineTo(-r * 0.45, -r * 1.0); ctx.lineTo(-r * 0.12, -r * 0.75); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.65); ctx.lineTo(r * 0.45, -r * 1.0); ctx.lineTo(r * 0.12, -r * 0.75); ctx.closePath(); ctx.fill()
      const flap = Math.sin(t * 0.3 + m.id) * 0.3 + 0.7
      ctx.fillStyle = accent
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1)
        ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.1)
        ctx.quadraticCurveTo(r * 1.0, -r * 0.2 * flap, r * 0.9, r * 0.4)
        ctx.quadraticCurveTo(r * 0.5, r * 0.2, r * 0.3, r * 0.15)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      drawGlowEyes(ctx, 0, -r * 0.42, r * 0.14, r * 0.07, variant === 'frost' ? '#ffffff' : '#ffe08a')
      if (m.demon) {
        ctx.strokeStyle = accent; ctx.lineWidth = r * 0.1
        ctx.beginPath(); ctx.moveTo(0, r * 0.75); ctx.quadraticCurveTo(r * 0.3, r * 1.1, r * 0.15, r * 1.35); ctx.stroke()
      }
      break
    }
    case 'mimic': {
      ctx.fillStyle = color
      ctx.fillRect(-r * 0.9, -r * 0.1, r * 1.8, r * 0.85)
      ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.1); ctx.quadraticCurveTo(0, -r * 0.7, r * 0.9, -r * 0.1); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = accent; ctx.lineWidth = 2
      ctx.strokeRect(-r * 0.9, -r * 0.1, r * 1.8, r * 0.85)
      const bite = Math.sin(t * 0.15 + m.id) * 0.5 + 0.5
      ctx.fillStyle = '#2a1a10'
      ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.55, r * 0.12 + bite * r * 0.08, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.18, r * 0.02); ctx.lineTo(i * r * 0.18 + r * 0.06, r * 0.02); ctx.lineTo(i * r * 0.12, r * 0.14); ctx.closePath(); ctx.fill()
      }
      drawGlowEyes(ctx, 0, -r * 0.35, r * 0.2, r * 0.08, accent)
      break
    }
    case 'dragon': {
      const flap = Math.sin(t * 0.2 + m.id) * 0.4 + 0.6
      ctx.fillStyle = color
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1)
        ctx.beginPath()
        ctx.moveTo(r * 0.1, -r * 0.1)
        ctx.quadraticCurveTo(r * 1.4, -r * (0.6 + flap * 0.5), r * 1.7, r * 0.15)
        ctx.quadraticCurveTo(r * 1.0, r * 0.25, r * 0.5, r * 0.1)
        ctx.quadraticCurveTo(r * 0.9, -r * 0.05, r * 1.15, r * (0.15 + flap * 0.3))
        ctx.quadraticCurveTo(r * 0.6, r * 0.35, r * 0.1, r * 0.15)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.28
      ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(-r * 1.1, r * 0.7, -r * 1.4, r * 0.2); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.65, r * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.4, r * 0.32, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.6); ctx.lineTo(-r * 0.25, -r * 0.95); ctx.lineTo(0, -r * 0.7); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.15, -r * 0.6); ctx.lineTo(r * 0.25, -r * 0.95); ctx.lineTo(0, -r * 0.7); ctx.closePath(); ctx.fill()
      drawGlowEyes(ctx, 0, -r * 0.4, r * 0.16, r * 0.08, accent)
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.25); ctx.lineTo(r * 0.6, -r * 0.15); ctx.lineTo(r * 0.3, -r * 0.05); ctx.closePath(); ctx.fill()
      break
    }
    default: {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      drawEyes(ctx, 0, -r * 0.1, r * 0.2, r * 0.1, '#1a1a1a')
    }
  }

  ctx.restore()
}

function drawPlayerSprite(ctx, p, t) {
  const cls = CLASSES.find(c => c.id === p.classId)
  const race = RACES.find(rc => rc.id === p.raceId)
  const bodyColors = { warrior: '#8a5a3a', mage: '#6b4aa8', rogue: '#2f4a3a', cleric: '#e8dcc0' }
  const bodyColor = cls ? bodyColors[cls.id] : '#3a7a4a'
  const skinColor = race?.id === 'hamsterkin' ? '#d9a860' : '#e8c090'
  const r = PLAYER_R
  ctx.save()
  ctx.translate(p.x, p.y)
  if (p.facing.x < 0) ctx.scale(-1, 1)

  ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = r * 0.22
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.25, r * 0.6); ctx.lineTo(s * r * 0.3, r * 1.15); ctx.stroke() }

  ctx.fillStyle = bodyColor
  ctx.beginPath()
  ctx.moveTo(-r * 0.5, r * 0.7); ctx.lineTo(-r * 0.45, -r * 0.15)
  ctx.lineTo(r * 0.45, -r * 0.15); ctx.lineTo(r * 0.5, r * 0.7); ctx.closePath(); ctx.fill()

  ctx.strokeStyle = bodyColor; ctx.lineWidth = r * 0.2
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.5, r * 0.05); ctx.lineTo(s * r * 0.8, r * 0.4); ctx.stroke() }

  ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.45, 0, Math.PI * 2); ctx.fillStyle = skinColor; ctx.fill()

  if (race?.id === 'elf') {
    ctx.fillStyle = skinColor
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.6); ctx.lineTo(-r * 0.65, -r * 0.7); ctx.lineTo(-r * 0.35, -r * 0.45); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.6); ctx.lineTo(r * 0.65, -r * 0.7); ctx.lineTo(r * 0.35, -r * 0.45); ctx.closePath(); ctx.fill()
  }
  if (race?.id === 'dwarf') {
    ctx.fillStyle = '#a06a3a'
    ctx.beginPath()
    ctx.moveTo(-r * 0.32, -r * 0.4); ctx.lineTo(-r * 0.3, r * 0.05); ctx.lineTo(0, r * 0.15)
    ctx.lineTo(r * 0.3, r * 0.05); ctx.lineTo(r * 0.32, -r * 0.4); ctx.closePath(); ctx.fill()
  }
  if (race?.id === 'hamsterkin') {
    ctx.fillStyle = skinColor
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.35, -r * 0.9, r * 0.2, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.7); ctx.quadraticCurveTo(-r * 0.8, r * 0.6, -r * 0.7, r * 0.35); ctx.stroke()
  }

  ctx.fillStyle = '#2a1a10'
  ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.55, r * 0.07, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.55, r * 0.07, 0, Math.PI * 2); ctx.fill()

  if (cls?.id === 'mage') {
    ctx.fillStyle = bodyColor
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(0, -r * 1.5); ctx.lineTo(r * 0.5, -r * 0.75); ctx.closePath(); ctx.fill()
  } else if (cls?.id === 'rogue') {
    ctx.fillStyle = bodyColor
    ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.5, Math.PI, Math.PI * 2); ctx.fill()
  } else if (cls?.id === 'cleric') {
    ctx.fillStyle = '#ffd34d'
    ctx.beginPath(); ctx.arc(0, -r * 1.05, r * 0.12, 0, Math.PI * 2); ctx.fill()
  } else if (cls?.id === 'warrior') {
    ctx.fillStyle = '#c9c9c9'
    ctx.fillRect(-r * 0.5, -r * 0.85, r, r * 0.2)
  }

  ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = r * 0.16
  ctx.beginPath(); ctx.moveTo(r * 0.75, r * 0.35); ctx.lineTo(r * 1.15, -r * 0.55); ctx.stroke()
  if (cls?.id === 'mage') {
    ctx.fillStyle = '#c9a6ff'
    ctx.beginPath(); ctx.arc(r * 1.15, -r * 0.55, r * 0.14, 0, Math.PI * 2); ctx.fill()
  }

  ctx.restore()
}

// ── Drawing ──────────────────────────────────────────────────────────
function draw(g, ctx, W, H) {
  const mapW = COLS * TILE, mapH = ROWS * TILE
  const camX = mapW > W ? clamp(g.camera.x, W / 2, mapW - W / 2) : mapW / 2
  const camY = mapH > H ? clamp(g.camera.y, H / 2, mapH - H / 2) : mapH / 2
  const shakeX = (Math.random() - 0.5) * g.shake
  const shakeY = (Math.random() - 0.5) * g.shake

  ctx.save()
  ctx.fillStyle = g.theme.wallColor
  ctx.fillRect(0, 0, W, H)
  ctx.translate(Math.round(W / 2 - camX + shakeX), Math.round(H / 2 - camY + shakeY))

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (g.tiles[ty * COLS + tx] === 1) {
        ctx.fillStyle = g.theme.floorColor
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE)
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.strokeRect(tx * TILE, ty * TILE, TILE, TILE)
      }
    }
  }

  if (g.bossActive) {
    ctx.fillStyle = 'rgba(255,60,60,0.08)'
    ctx.fillRect(g.bossRoom.x0, g.bossRoom.y0, g.bossRoom.x1 - g.bossRoom.x0, g.bossRoom.y1 - g.bossRoom.y0)
  }

  if (g.exit) {
    ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🌀', g.exit.x, g.exit.y)
  }
  for (const c of g.chests) {
    if (c.opened) continue
    ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🎁', c.x, c.y)
  }

  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = p.color
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1

  for (const pr of g.projectiles) {
    if (pr.dead) continue
    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(pr.emoji, pr.x, pr.y)
  }

  for (const m of g.monsters) {
    if (m.dead) continue
    drawCreature(ctx, m, g.frame)
    if (m.isBoss || m.hp < m.maxHp) {
      const bw = m.isBoss ? 70 : 34
      const by = m.y - (m.isBoss ? 46 : 24)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(m.x - bw / 2, by, bw, 6)
      ctx.fillStyle = m.isBoss ? '#FF5566' : '#8BFF6B'
      ctx.fillRect(m.x - bw / 2, by, bw * Math.max(0, m.hp / m.maxHp), 6)
    }
    if (m.isBoss) {
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fff'
      ctx.fillText(m.name, m.x, m.y - 60)
    }
  }

  for (const p of activePlayers(g)) {
    ctx.save()
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.4
    drawPlayerSprite(ctx, p, g.frame)
    ctx.restore()

    if (p.attackTimer > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(p.x + p.facing.x * ATTACK_REACH, p.y + p.facing.y * ATTACK_REACH, ATTACK_ARC_R, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()

  drawHUD(g, ctx, W, H)
}

function drawPlayerStatsBox(ctx, p, barX, barY, label) {
  const barW = 200, barH = 16

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(barX - 8, barY - 8, barW + 90, label ? 112 : 96)

  if (label) {
    ctx.fillStyle = '#FFD34D'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillText(label, barX, barY - 10)
    barY += 16
  }

  ctx.fillStyle = '#3a0f0f'; ctx.fillRect(barX, barY, barW, barH)
  ctx.fillStyle = '#FF5566'; ctx.fillRect(barX, barY, barW * Math.max(0, p.hp / p.maxHp), barH)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(barX, barY, barW, barH)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(`❤️ ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, barX + 6, barY + barH / 2)

  const xpY = barY + barH + 6
  ctx.fillStyle = '#1a1a3a'; ctx.fillRect(barX, xpY, barW, 10)
  ctx.fillStyle = '#8FD3FF'; ctx.fillRect(barX, xpY, barW * clamp(p.xp / p.xpNext, 0, 1), 10)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(barX, xpY, barW, 10)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'
  ctx.fillText(`Lv.${p.level}`, barX + barW + 8, xpY + 5)

  const manaY = xpY + 14
  ctx.fillStyle = '#1a1030'; ctx.fillRect(barX, manaY, barW, 8)
  ctx.fillStyle = '#C9A6FF'; ctx.fillRect(barX, manaY, barW * clamp(p.mana / p.maxMana, 0, 1), 8)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(barX, manaY, barW, 8)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'
  const equippedSpell = SPELLS.find(s => s.id === p.equippedSpellId)
  ctx.fillText(`${equippedSpell ? equippedSpell.emoji : '🔮'} ${Math.floor(p.mana)}/${p.maxMana}`, barX + barW + 8, manaY + 4)

  const rowY = manaY + 24
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(`🪙 ${p.gold}`, barX, rowY)
  ctx.fillText(`🧃 x${p.potions}`, barX + 90, rowY)
}

function drawHUD(g, ctx, W, H) {
  drawPlayerStatsBox(ctx, g.player, 16, 16, g.twoPlayer ? 'P1' : null)
  if (g.twoPlayer) drawPlayerStatsBox(ctx, g.player2, 16, 140, 'P2')

  ctx.textAlign = 'center'
  ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(`Floor ${g.floorIndex + 1}: ${g.theme.name}`, W / 2, 20)

  if (g.banner) {
    const alpha = g.bannerTimer > 20 ? 1 : g.bannerTimer / 20
    ctx.globalAlpha = alpha
    ctx.font = 'bold 18px sans-serif'
    const text = `${g.banner.icon} ${g.banner.text}`
    const tw = ctx.measureText(text).width
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(W / 2 - tw / 2 - 16, 34, tw + 32, 32)
    ctx.fillStyle = g.banner.color
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, W / 2, 50)
    ctx.globalAlpha = 1
  }

  if (g.announcerTimer > 0) {
    const alpha = g.announcerTimer > 30 ? 1 : g.announcerTimer / 30
    ctx.globalAlpha = alpha * 0.9
    ctx.font = 'italic 13px sans-serif'; ctx.fillStyle = '#E9D8FF'
    ctx.textAlign = 'center'
    ctx.fillText(`🔮 MC Marv: "${g.announcerText}"`, W / 2, H - 70)
    ctx.globalAlpha = 1
  }

  if (g.petTimer > 0) {
    const alpha = g.petTimer > 30 ? 1 : g.petTimer / 30
    ctx.globalAlpha = alpha
    const text = `🐹 Biscuit: "${g.petText}"`
    ctx.font = '13px sans-serif'
    const tw = Math.min(340, ctx.measureText(text).width + 20)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(12, H - 56, tw, 34)
    ctx.fillStyle = '#FFE9B8'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(text, 22, H - 39)
    ctx.globalAlpha = 1
  }

  const boss = g.monsters.find(m => m.isBoss && !m.dead)
  if (boss) {
    const bw = Math.min(260, W * 0.35)
    const bx = W - bw - 16, by = 16
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 4, by - 4, bw + 8, 34)
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillText(boss.name, bx, by + 8)
    ctx.fillStyle = '#3a0f0f'; ctx.fillRect(bx, by + 12, bw, 10)
    ctx.fillStyle = '#FF5566'; ctx.fillRect(bx, by + 12, bw * Math.max(0, boss.hp / boss.maxHp), 10)
  }

  if (g.floorIndex === 0 && g.frame < 600) {
    ctx.globalAlpha = Math.min(1, (600 - g.frame) / 60)
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    const hint = g.twoPlayer
      ? 'P1: WASD move · Space attack · F magic · E potion — P2: Arrows move · / attack · . magic · , potion — I spellbook'
      : 'WASD / Arrows to move · Space to attack · F to cast a spell · E to drink a potion · I for spellbook'
    ctx.fillText(hint, W / 2, H - 16)
    ctx.globalAlpha = 1
  }
}

// ── Component ────────────────────────────────────────────────────────
export default function DungeonCrawlerMax() {
  const [phase, setPhaseState] = useState('intro')
  const phaseRef = useRef('intro')
  const [winStats, setWinStats] = useState(null)
  const canvasRef = useRef(null)
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight })
  const keysRef = useRef({})
  const gRef = useRef(null)
  const rafRef = useRef(null)

  const [twoPlayer, setTwoPlayer] = useState(false)
  const [spellSnapshot, setSpellSnapshot] = useState(null)
  const [spellTab, setSpellTab] = useState('p1')
  const emptyPick = () => ({ classId: null, raceId: null })
  const [classPick, setClassPick] = useState({ p1: emptyPick(), p2: emptyPick() })

  function setPhase(p) { phaseRef.current = p; setPhaseState(p) }
  function snapshotSpells(p) { return { spells: [...p.spells], equippedSpellId: p.equippedSpellId } }
  function refreshSpellSnapshot() {
    const g = gRef.current
    if (!g) return
    setSpellSnapshot({ p1: snapshotSpells(g.player), p2: g.twoPlayer ? snapshotSpells(g.player2) : null })
  }
  function activeSpellPlayer() {
    return spellTab === 'p2' ? gRef.current.player2 : gRef.current.player
  }
  function handleEquipSpell(id) {
    equipSpell(gRef.current, activeSpellPlayer(), id)
    refreshSpellSnapshot()
  }
  function confirmClassRace() {
    const { p1, p2 } = classPick
    const solo = !gRef.current.twoPlayer
    if (!p1.classId || !p1.raceId || (!solo && (!p2.classId || !p2.raceId))) return
    chooseClassRace(gRef.current, gRef.current.player, p1.classId, p1.raceId)
    if (!solo) chooseClassRace(gRef.current, gRef.current.player2, p2.classId, p2.raceId)
    setClassPick({ p1: emptyPick(), p2: emptyPick() })
    setPhase('playing')
  }

  useEffect(() => {
    const canvas = canvasRef.current
    function onResize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      keysRef.current[e.code] = true
      if (e.code === 'Space') { e.preventDefault(); if (gRef.current) gRef.current.attackPressed = true }
      if (e.code === 'KeyE') { if (gRef.current) gRef.current.potionPressed = true }
      if (e.code === 'KeyF') { if (gRef.current) gRef.current.spellPressed = true }
      if (e.code === 'Slash') { e.preventDefault(); if (gRef.current?.twoPlayer) gRef.current.attackPressed2 = true }
      if (e.code === 'Comma') { if (gRef.current?.twoPlayer) gRef.current.potionPressed2 = true }
      if (e.code === 'Period') { if (gRef.current?.twoPlayer) gRef.current.spellPressed2 = true }
      if (e.code === 'KeyI') {
        if (phaseRef.current === 'playing') { setSpellTab('p1'); refreshSpellSnapshot(); setPhase('spellbook') }
        else if (phaseRef.current === 'spellbook') setPhase('playing')
      }
    }
    const onKeyUp = (e) => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const helpers = { setPhase, setWinStats }

    function step() {
      const { w: W, h: H } = sizeRef.current
      const g = gRef.current
      if (phaseRef.current === 'playing' && g) update(g, keysRef.current, helpers)
      ctx.clearRect(0, 0, W, H)
      if (phaseRef.current === 'playing' && g) {
        draw(g, ctx, W, H)
      } else {
        ctx.fillStyle = '#140a1f'
        ctx.fillRect(0, 0, W, H)
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  function startGame() {
    const g = mkInitialState(twoPlayer)
    grantAchievement(g, 'contestant')
    gRef.current = g
    setSpellSnapshot(null)
    setClassPick({ p1: emptyPick(), p2: emptyPick() })
    setPhase('playing')
  }

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>

      {phase === 'intro' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>{twoPlayer ? '🧒 🧑 🐹 🔮' : '🧒 🐹 🔮'}</div>
            <h1 className={styles.title}>Dungeon Crawler Max</h1>
            <p className={styles.tagline}>A Game Show... For Kids!</p>
            <p className={styles.story}>
              Congratulations, contestant{twoPlayer ? 's' : ''}! You{twoPlayer ? ' and a friend' : ''} — and your
              hamster, Biscuit — have just been zapped into THE DUNGEON, a magical game show broadcast to
              who-knows-where. Floating host MC Marv will explain the rules while a crowd (somewhere)
              cheers: clear every floor, bonk fearsome monsters, grab loot, and get stronger. You'll{twoPlayer ? ' both ' : ' '}
              pick a class and race on floor 3, and spell scrolls found in chests can be leveled up and
              equipped from your spellbook. Don't worry about getting hurt — this game show has excellent
              insurance. 18 floors stand between you and the mysterious Dragon King at the top.
            </p>
            <p className={styles.pickLabel}>Players</p>
            <div className={styles.pickRow}>
              <button
                className={`${styles.pickCard} ${!twoPlayer ? styles.pickCardActive : ''}`}
                onClick={() => setTwoPlayer(false)}
              >
                <span className={styles.pickCardEmoji}>🧍</span>
                <span className={styles.pickCardName}>1 Player</span>
                <span className={styles.pickCardDesc}>Just you, WASD or Arrows.</span>
              </button>
              <button
                className={`${styles.pickCard} ${twoPlayer ? styles.pickCardActive : ''}`}
                onClick={() => setTwoPlayer(true)}
              >
                <span className={styles.pickCardEmoji}>🧑‍🤝‍🧑</span>
                <span className={styles.pickCardName}>2 Player</span>
                <span className={styles.pickCardDesc}>Share the keyboard — P2 takes the arrow-key cluster.</span>
              </button>
            </div>
            <div className={styles.controls}>
              <span><b>{twoPlayer ? 'P1 Move' : 'Move'}</b> — WASD{twoPlayer ? '' : ' / Arrows'}</span>
              <span><b>{twoPlayer ? 'P1 Attack' : 'Attack'}</b> — Space</span>
              <span><b>{twoPlayer ? 'P1 Magic' : 'Magic'}</b> — F</span>
              <span><b>{twoPlayer ? 'P1 Potion' : 'Potion'}</b> — E</span>
              {twoPlayer && <span><b>P2 Move</b> — Arrow keys</span>}
              {twoPlayer && <span><b>P2 Attack</b> — /</span>}
              {twoPlayer && <span><b>P2 Magic</b> — .</span>}
              {twoPlayer && <span><b>P2 Potion</b> — ,</span>}
              <span><b>Spellbook</b> — I</span>
            </div>
            <button className={styles.startButton} onClick={startGame}>Step Into The Dungeon →</button>
          </div>
        </div>
      )}

      {phase === 'classPick' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>Choose Your Class &amp; Race</h1>
            <p className={styles.tagline}>Floor 3 awaits — pick your path before you go in.</p>

            {(twoPlayer ? [['p1', 'Player 1'], ['p2', 'Player 2']] : [['p1', null]]).map(([key, label]) => (
              <div key={key} className={styles.pickPlayerBlock}>
                {label && <h2 className={styles.pickPlayerHeading}>{label}</h2>}
                <p className={styles.pickLabel}>Class</p>
                <div className={styles.pickRow}>
                  {CLASSES.map(c => (
                    <button
                      key={c.id}
                      className={`${styles.pickCard} ${classPick[key].classId === c.id ? styles.pickCardActive : ''}`}
                      onClick={() => setClassPick(cp => ({ ...cp, [key]: { ...cp[key], classId: c.id } }))}
                    >
                      <span className={styles.pickCardEmoji}>{c.emoji}</span>
                      <span className={styles.pickCardName}>{c.name}</span>
                      <span className={styles.pickCardDesc}>{c.desc}</span>
                    </button>
                  ))}
                </div>
                <p className={styles.pickLabel}>Race</p>
                <div className={styles.pickRow}>
                  {RACES.map(r => (
                    <button
                      key={r.id}
                      className={`${styles.pickCard} ${classPick[key].raceId === r.id ? styles.pickCardActive : ''}`}
                      onClick={() => setClassPick(cp => ({ ...cp, [key]: { ...cp[key], raceId: r.id } }))}
                    >
                      <span className={styles.pickCardEmoji}>{r.emoji}</span>
                      <span className={styles.pickCardName}>{r.name}</span>
                      <span className={styles.pickCardDesc}>{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              className={styles.startButton}
              disabled={!classPick.p1.classId || !classPick.p1.raceId || (twoPlayer && (!classPick.p2.classId || !classPick.p2.raceId))}
              onClick={confirmClassRace}
            >
              Confirm →
            </button>
          </div>
        </div>
      )}

      {phase === 'spellbook' && spellSnapshot && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>📖 Spellbook</h1>
            <p className={styles.tagline}>Pick which spell is equipped — press I to close.</p>
            {twoPlayer && (
              <div className={styles.gearTabs}>
                <button className={`${styles.gearTabBtn} ${spellTab === 'p1' ? styles.gearTabActive : ''}`} onClick={() => setSpellTab('p1')}>Player 1</button>
                <button className={`${styles.gearTabBtn} ${spellTab === 'p2' ? styles.gearTabActive : ''}`} onClick={() => setSpellTab('p2')}>Player 2</button>
              </div>
            )}
            <div className={styles.gearList}>
              {(spellTab === 'p2' ? spellSnapshot.p2 : spellSnapshot.p1).spells.map(s => {
                const def = SPELLS.find(d => d.id === s.id)
                const equipped = (spellTab === 'p2' ? spellSnapshot.p2 : spellSnapshot.p1).equippedSpellId === s.id
                return (
                  <button
                    key={s.id}
                    className={`${styles.gearItem} ${equipped ? styles.gearItemActive : ''}`}
                    onClick={() => handleEquipSpell(s.id)}
                    disabled={equipped}
                  >
                    <span className={styles.gearItemEmoji}>{def.emoji}</span>
                    <span className={styles.gearItemName}>{def.name} (Lv.{s.level})</span>
                    {equipped && <span className={styles.equippedTag}>Equipped</span>}
                  </button>
                )
              })}
            </div>
            <button className={styles.startButton} onClick={() => setPhase('playing')}>Back To The Dungeon →</button>
          </div>
        </div>
      )}

      {phase === 'win' && winStats && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>🏆 You Win The Game Show!</h1>
            <p className={styles.story}>MC Marv: "Ladies, gentlemen, and hamsters everywhere — we have a CHAMPION!"</p>
            <div className={styles.statsList}>
              <div>Final Level: <b>{winStats.level}</b></div>
              <div>Gold Collected: <b>{winStats.gold}</b> 🪙</div>
              <div>Achievements: <b>{winStats.achievements.length}/{winStats.totalAchievements}</b></div>
            </div>
            <ul className={styles.achList}>
              {winStats.achievements.map(name => (<li key={name}>🏅 {name}</li>))}
            </ul>
            <button className={styles.startButton} onClick={startGame}>Play Again</button>
          </div>
        </div>
      )}
    </div>
  )
}
