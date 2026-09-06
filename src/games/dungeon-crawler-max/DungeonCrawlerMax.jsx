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

// ── Content ──────────────────────────────────────────────────────────
const FLOOR_THEMES = [
  { name: 'The Snack Cellar', wallColor: '#2b1810', floorColor: '#4a3222', accent: '#e0b060', monsterPool: ['slime', 'rat', 'fly'], boss: 'gummyking' },
  { name: 'Sock Puppet Hallway', wallColor: '#241a35', floorColor: '#3a2b52', accent: '#b39dff', monsterPool: ['sock', 'bunny', 'rat'], boss: 'lintlord' },
  { name: 'The Bat Belfry', wallColor: '#161b2b', floorColor: '#232c47', accent: '#7fa6ff', monsterPool: ['bat', 'spider', 'fly'], boss: 'bartholomew' },
  { name: 'Skeleton Crew Break Room', wallColor: '#1c1c1c', floorColor: '#333333', accent: '#e8dcb8', monsterPool: ['skeleton', 'ghost', 'bunny'], boss: 'bonesmcgee' },
  { name: "The Landlord's Office", wallColor: '#2a1020', floorColor: '#451a35', accent: '#ff9fcf', monsterPool: ['skeleton', 'sock', 'bat', 'ghost'], boss: 'landlord' },
]

const MONSTER_DEFS = {
  slime: { name: 'Wobblin', emoji: '🫠', r: 15, hp: 16, atk: 3, speed: 1.6, xp: 8 },
  rat: { name: 'Rat Burglar', emoji: '🐀', r: 13, hp: 12, atk: 2, speed: 2.6, xp: 7 },
  fly: { name: 'Dust Fly', emoji: '🪰', r: 11, hp: 9, atk: 2, speed: 2.2, xp: 6 },
  sock: { name: 'Sock Puppet', emoji: '🧦', r: 15, hp: 20, atk: 4, speed: 1.7, xp: 10 },
  bunny: { name: 'Dust Bunny', emoji: '🐇', r: 13, hp: 11, atk: 2, speed: 2.8, xp: 6 },
  bat: { name: 'Belfry Bat', emoji: '🦇', r: 13, hp: 14, atk: 3, speed: 3.0, xp: 9 },
  spider: { name: 'Corner Spider', emoji: '🕷️', r: 13, hp: 13, atk: 3, speed: 2.0, xp: 8 },
  skeleton: { name: 'Skeleton Intern', emoji: '💀', r: 16, hp: 24, atk: 5, speed: 1.5, xp: 12 },
  ghost: { name: 'Office Ghost', emoji: '👻', r: 15, hp: 18, atk: 4, speed: 1.8, xp: 10 },
}

const BOSS_DEFS = {
  gummyking: { name: 'Gordo the Gummy King', emoji: '🍮', r: 30, hp: 120, atk: 7, speed: 1.3, xp: 70 },
  lintlord: { name: 'The Lint Lord', emoji: '🧦', r: 30, hp: 160, atk: 9, speed: 1.5, xp: 110 },
  bartholomew: { name: 'Bartholomew the Belfry Bat', emoji: '🦇', r: 30, hp: 190, atk: 10, speed: 2.4, xp: 150 },
  bonesmcgee: { name: 'Bones McGee, Shift Supervisor', emoji: '💀', r: 32, hp: 220, atk: 12, speed: 1.6, xp: 190 },
  landlord: { name: 'The Landlord', emoji: '👹', r: 34, hp: 300, atk: 15, speed: 1.7, xp: 300 },
}

const WEAPONS = [
  { name: 'Wobbly Stick', emoji: '🥢', atk: 2 },
  { name: 'Rusty Spoon', emoji: '🥄', atk: 4 },
  { name: 'Squeaky Wand', emoji: '🪄', atk: 6 },
  { name: 'Foam Sword', emoji: '🗡️', atk: 9 },
  { name: 'Laser Pointer', emoji: '🔦', atk: 13 },
  { name: 'Giant Serving Spoon', emoji: '🍴', atk: 18 },
  { name: 'Star Wand of Destiny', emoji: '✨', atk: 24 },
]
const ARMORS = [
  { name: 'Fuzzy Pajamas', emoji: '🩳', def: 1 },
  { name: 'Rubber Raincoat', emoji: '🧥', def: 2 },
  { name: 'Cooking Pot Helmet', emoji: '🥘', def: 4 },
  { name: 'Trash Can Lid Shield', emoji: '🛡️', def: 6 },
  { name: 'Bubble Wrap Armor', emoji: '🫧', def: 9 },
  { name: 'Cardboard Knight Armor', emoji: '📦', def: 13 },
  { name: 'Golden Nightlight Armor', emoji: '🌟', def: 18 },
]

const ACHIEVEMENTS = [
  { id: 'contestant', name: 'Chosen Contestant', desc: 'Step into the dungeon.' },
  { id: 'firstblood', name: 'Slime Time', desc: 'Defeat your first monster.' },
  { id: 'lootgoblin', name: 'Loot Goblin', desc: 'Open 5 chests.' },
  { id: 'sockit', name: 'Sock It To Me', desc: 'Defeat a Sock Puppet.' },
  { id: 'snackbreak', name: 'Snack Break', desc: 'Drink a potion.' },
  { id: 'bossbeat1', name: 'Big Boss Energy', desc: 'Defeat a floor boss.' },
  { id: 'geared', name: 'Fashionably Equipped', desc: 'Equip a weapon and armor.' },
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
    id, type, name: def.name, emoji: def.emoji, x, y, r: def.r,
    hp: Math.round(def.hp * mult), maxHp: Math.round(def.hp * mult),
    atk: Math.round(def.atk * mult), speed: def.speed, xp: Math.round(def.xp * mult),
    wanderDir: { x: 0, y: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockY: 0, knockTimer: 0,
    dead: false, removeMe: false, isBoss: false,
  }
}
function createBoss(bossId, x, y, id) {
  const def = BOSS_DEFS[bossId]
  return {
    id, type: bossId, name: def.name, emoji: def.emoji, x, y, r: def.r,
    hp: def.hp, maxHp: def.hp, atk: def.atk, speed: def.speed, xp: def.xp,
    wanderDir: { x: 0, y: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockY: 0, knockTimer: 0,
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
    gold: 0, potions: 1,
    weaponName: null, armorName: null,
    attackCooldown: 0, attackTimer: 0, hitIds: new Set(),
    potionCooldown: 0, invuln: 0,
  }
}

function mkInitialState() {
  const floorIndex = 0
  const floor = generateFloor(floorIndex)
  const player = mkPlayer(floor.playerSpawn)
  return {
    floorIndex, theme: floor.theme, tiles: floor.tiles, rooms: floor.rooms,
    bossRoom: floor.bossRoom, monsters: floor.monsters, chests: floor.chests,
    exit: null, bossSpawned: false, bossActive: false, chestsOpened: 0,
    player, playerSpawn: floor.playerSpawn,
    particles: [], bannerQueue: [], banner: null, bannerTimer: 0,
    petText: pick(PET_LINES.intro), petTimer: 260,
    announcerText: pick(ANNOUNCER_LINES.welcome), announcerTimer: 260,
    achievements: new Set(),
    camera: { x: floor.playerSpawn.x, y: floor.playerSpawn.y },
    shake: 0, frame: 0,
    attackPressed: false, potionPressed: false,
  }
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

function knockoutPlayer(g) {
  pushBanner(g, '💫', 'Knocked out! Free respawn, contestant!', '#FF9E6B')
  announcerSay(g, 'knockout')
  grantAchievement(g, 'oof')
  g.player.gold = Math.floor(g.player.gold * 0.8)
  g.player.x = g.playerSpawn.x
  g.player.y = g.playerSpawn.y
  g.player.hp = Math.floor(g.player.maxHp * 0.6)
  g.player.invuln = KNOCKOUT_INVULN
}

function checkLevelUp(g) {
  while (g.player.xp >= g.player.xpNext) {
    g.player.xp -= g.player.xpNext
    g.player.level += 1
    g.player.maxHp += 8
    g.player.hp = g.player.maxHp
    g.player.baseAtk += 1
    g.player.atk = g.player.baseAtk + g.player.weaponAtk
    if (g.player.level % 2 === 0) { g.player.baseDef += 1; g.player.def = g.player.baseDef + g.player.armorDef }
    g.player.xpNext = Math.floor(g.player.xpNext * 1.35) + 10
    pushBanner(g, '🎉', `Level Up! You are now Level ${g.player.level}`, '#8FD3FF')
    announcerSay(g, 'levelUp')
    petSay(g, 'levelUp')
  }
}

function onMonsterDeath(g, m) {
  spawnBurst(g, m.x, m.y, m.isBoss ? 26 : 12, ['#FFD34D', '#FF8FD3', '#8FD3FF', '#B6FF6B'])
  g.player.xp += m.xp
  g.player.gold += Math.round(rand(m.xp * 0.6, m.xp * 1.3))
  if (!g.achievements.has('firstblood')) grantAchievement(g, 'firstblood')
  if (m.type === 'sock') grantAchievement(g, 'sockit')
  if (Math.random() < 0.1) { g.player.potions = Math.min(5, g.player.potions + 1); pushBanner(g, '🧃', 'A snack potion fell out!', '#7CFF6B') }
  if (m.isBoss) {
    grantAchievement(g, 'bossbeat1')
    pushBanner(g, '🏆', `${m.name} defeated!`, '#FFD34D')
    announcerSay(g, 'bossDefeat')
    petSay(g, 'victory')
    g.bossActive = false
    g.exit = { x: m.x, y: m.y }
  }
  if (g.player.gold >= 200) grantAchievement(g, 'richkid')
  checkLevelUp(g)
  m.removeMe = true
}

function damageMonster(g, m, dmg) {
  m.hp -= dmg
  if (m.hp <= 0 && !m.dead) { m.dead = true; onMonsterDeath(g, m) }
}

function openChest(g, c) {
  c.opened = true
  spawnBurst(g, c.x, c.y, 10, ['#FFD34D', '#FFE9B8'])
  g.chestsOpened += 1
  if (g.chestsOpened === 5) grantAchievement(g, 'lootgoblin')
  const roll = Math.random()
  if (roll < 0.35) {
    const amt = 8 + Math.floor(Math.random() * 10) * (g.floorIndex + 1)
    g.player.gold += amt
    pushBanner(g, '🪙', `Found ${amt} gold!`, '#FFD34D')
  } else if (roll < 0.6) {
    g.player.potions = Math.min(5, g.player.potions + 1)
    pushBanner(g, '🧃', 'Found a snack potion!', '#7CFF6B')
  } else {
    const tier = Math.min(WEAPONS.length - 1, g.floorIndex + 1 + Math.floor(Math.random() * 2))
    if (Math.random() < 0.5) {
      const w = WEAPONS[tier]
      if (w.atk > g.player.weaponAtk) {
        g.player.weaponAtk = w.atk; g.player.weaponName = w.name
        g.player.atk = g.player.baseAtk + g.player.weaponAtk
        pushBanner(g, w.emoji, `Equipped ${w.name}! (+${w.atk} ATK)`, '#8FD3FF')
        if (g.player.weaponName && g.player.armorName) grantAchievement(g, 'geared')
      } else {
        const gold = w.atk * 3
        g.player.gold += gold
        pushBanner(g, '💰', `Found ${w.name}, sold for ${gold} gold`, '#FFD34D')
      }
    } else {
      const a = ARMORS[tier]
      if (a.def > g.player.armorDef) {
        g.player.armorDef = a.def; g.player.armorName = a.name
        g.player.def = g.player.baseDef + g.player.armorDef
        pushBanner(g, a.emoji, `Equipped ${a.name}! (+${a.def} DEF)`, '#8FD3FF')
        if (g.player.weaponName && g.player.armorName) grantAchievement(g, 'geared')
      } else {
        const gold = a.def * 3
        g.player.gold += gold
        pushBanner(g, '💰', `Found ${a.name}, sold for ${gold} gold`, '#FFD34D')
      }
    }
  }
  if (g.player.gold >= 200) grantAchievement(g, 'richkid')
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
  if (m.knockTimer > 0) { tryMoveEntity(g, m, m.knockX, m.knockY); m.knockTimer -= 1; return }
  const dx0 = g.player.x - m.x, dy0 = g.player.y - m.y
  const d = Math.hypot(dx0, dy0)
  const aggro = m.isBoss ? 999999 : 230
  if (d < aggro && d > 0.001) {
    tryMoveEntity(g, m, (dx0 / d) * m.speed, (dy0 / d) * m.speed)
    if (d < m.r + PLAYER_R + 8 && m.atkCooldown <= 0 && g.player.invuln <= 0) {
      g.player.hp -= m.atk
      g.player.invuln = INVULN_FRAMES
      shakeCamera(g, 5)
      m.atkCooldown = 55
      if (g.player.hp <= 0) knockoutPlayer(g)
    }
  } else {
    m.wanderTimer -= 1
    if (m.wanderTimer <= 0) {
      const a = Math.random() * Math.PI * 2
      m.wanderDir = { x: Math.cos(a), y: Math.sin(a) }
      m.wanderTimer = 60 + Math.random() * 90
    }
    tryMoveEntity(g, m, m.wanderDir.x * m.speed * 0.4, m.wanderDir.y * m.speed * 0.4)
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
  g.playerSpawn = floor.playerSpawn
  g.camera.x = floor.playerSpawn.x
  g.camera.y = floor.playerSpawn.y
  g.frame = 0
  pushBanner(g, '🚪', `Floor ${nextIndex + 1}: ${floor.theme.name}`, floor.theme.accent)
  announcerSay(g, 'floorStart')
  petSay(g, 'floorStart')
}

// ── Per-frame update ─────────────────────────────────────────────────
function update(g, keys, helpers) {
  g.frame += 1

  let mx = 0, my = 0
  if (keys['KeyW'] || keys['ArrowUp']) my -= 1
  if (keys['KeyS'] || keys['ArrowDown']) my += 1
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my)
    mx /= len; my /= len
    g.player.facing = { x: mx, y: my }
    tryMoveEntity(g, g.player, mx * PLAYER_SPEED, my * PLAYER_SPEED)
  }

  if (g.player.attackCooldown > 0) g.player.attackCooldown -= 1
  if (g.attackPressed && g.player.attackCooldown <= 0) {
    g.player.attackCooldown = ATTACK_COOLDOWN
    g.player.attackTimer = ATTACK_DURATION
    g.player.hitIds = new Set()
  }
  g.attackPressed = false
  if (g.player.attackTimer > 0) {
    g.player.attackTimer -= 1
    const hbx = g.player.x + g.player.facing.x * ATTACK_REACH
    const hby = g.player.y + g.player.facing.y * ATTACK_REACH
    for (const m of g.monsters) {
      if (m.dead || g.player.hitIds.has(m.id)) continue
      const dd = (hbx - m.x) ** 2 + (hby - m.y) ** 2
      if (dd < (ATTACK_ARC_R + m.r) ** 2) {
        g.player.hitIds.add(m.id)
        const dmg = Math.max(1, g.player.atk + Math.floor(rand(-1, 2)))
        damageMonster(g, m, dmg)
        spawnBurst(g, m.x, m.y, 5, ['#ffffff', '#ffe9b8'])
        const kl = Math.hypot(m.x - g.player.x, m.y - g.player.y) || 1
        m.knockX = ((m.x - g.player.x) / kl) * 6
        m.knockY = ((m.y - g.player.y) / kl) * 6
        m.knockTimer = 8
      }
    }
  }

  if (g.player.potionCooldown > 0) g.player.potionCooldown -= 1
  if (g.potionPressed) {
    g.potionPressed = false
    if (g.player.potionCooldown <= 0 && g.player.potions > 0 && g.player.hp < g.player.maxHp) {
      g.player.potionCooldown = POTION_COOLDOWN
      g.player.potions -= 1
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + Math.floor(g.player.maxHp * 0.4))
      pushBanner(g, '🧃', 'Snack break! HP restored.', '#7CFF6B')
      grantAchievement(g, 'snackbreak')
    }
  }

  if (g.player.invuln > 0) g.player.invuln -= 1
  if (g.player.hp < g.player.maxHp * 0.25 && g.frame % 240 === 0) petSay(g, 'lowHp')

  for (const m of g.monsters) { if (!m.dead) updateMonsterAI(g, m) }
  g.monsters = g.monsters.filter(m => !m.removeMe)

  for (const c of g.chests) {
    if (c.opened) continue
    const dd = (g.player.x - c.x) ** 2 + (g.player.y - c.y) ** 2
    if (dd < (PLAYER_R + 18) ** 2) openChest(g, c)
  }

  if (g.bossRoom && !g.bossSpawned && pointInBounds(g.player.x, g.player.y, g.bossRoom)) spawnBoss(g)

  if (g.exit) {
    const dd = (g.player.x - g.exit.x) ** 2 + (g.player.y - g.exit.y) ** 2
    if (dd < (PLAYER_R + 20) ** 2) { const ex = g.exit; g.exit = null; advanceFloor(g, helpers); if (ex) return }
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
  g.camera.x += (g.player.x - g.camera.x) * 0.15
  g.camera.y += (g.player.y - g.camera.y) * 0.15
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

  for (const m of g.monsters) {
    if (m.dead) continue
    ctx.font = (m.isBoss ? '54px' : '30px') + ' serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(m.emoji, m.x, m.y)
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

  ctx.save()
  if (g.player.invuln > 0 && Math.floor(g.player.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.4
  ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('🧒', g.player.x, g.player.y)
  ctx.restore()

  if (g.player.attackTimer > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(g.player.x + g.player.facing.x * ATTACK_REACH, g.player.y + g.player.facing.y * ATTACK_REACH, ATTACK_ARC_R, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  drawHUD(g, ctx, W, H)
}

function drawHUD(g, ctx, W, H) {
  const p = g.player
  const barX = 16, barY = 16, barW = 200, barH = 16

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(barX - 8, barY - 8, barW + 90, 78)

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

  const rowY = xpY + 24
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(`🪙 ${p.gold}`, barX, rowY)
  ctx.fillText(`🧃 x${p.potions}`, barX + 90, rowY)

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
    ctx.fillText('WASD / Arrows to move · Space to attack · E to drink a potion', W / 2, H - 16)
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

  function setPhase(p) { phaseRef.current = p; setPhaseState(p) }

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
    const g = mkInitialState()
    grantAchievement(g, 'contestant')
    gRef.current = g
    setPhase('playing')
  }

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>

      {phase === 'intro' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>🧒 🐹 🔮</div>
            <h1 className={styles.title}>Dungeon Crawler Max</h1>
            <p className={styles.tagline}>A Game Show... For Kids!</p>
            <p className={styles.story}>
              Congratulations, contestant! You — and your hamster, Biscuit — have just been zapped into
              THE DUNGEON, a magical game show broadcast to who-knows-where. Floating host MC Marv will
              explain the rules while a crowd (somewhere) cheers: clear every floor, bonk silly monsters,
              grab loot, and get stronger. Don't worry about getting hurt — this game show has excellent
              insurance.
            </p>
            <div className={styles.controls}>
              <span><b>Move</b> — WASD / Arrows</span>
              <span><b>Attack</b> — Space</span>
              <span><b>Potion</b> — E</span>
            </div>
            <button className={styles.startButton} onClick={startGame}>Step Into The Dungeon →</button>
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
