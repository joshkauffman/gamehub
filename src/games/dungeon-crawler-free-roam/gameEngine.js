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
  MAX_MANA, MANA_REGEN, SPELL_COST, SPELL_COOLDOWN, SPELL_SPEED, SPELL_RADIUS, SPELL_LIFE,
  SAFE_ZONE_HOME_RADIUS, SAFE_ZONE_REST_RADIUS,
} from './constants.js'

const EMPTY_RECTS = []

// ── Content — same universe as Dungeon Crawler Max ──────────────────────
export const DUNGEON_THEMES = [
  { name: 'The Snack Cellar', wallColor: '#6b4a30', floorColor: '#4a3222', accent: '#e0b060', monsterPool: ['slime', 'rat', 'fly'], boss: 'gummyking' },
  { name: 'Sock Puppet Hallway', wallColor: '#4a3a6b', floorColor: '#3a2b52', accent: '#b39dff', monsterPool: ['sock', 'bunny', 'rat'], boss: 'lintlord' },
  { name: 'The Bat Belfry', wallColor: '#333d5c', floorColor: '#232c47', accent: '#7fa6ff', monsterPool: ['bat', 'spider', 'fly'], boss: 'bartholomew' },
  { name: 'Skeleton Crew Break Room', wallColor: '#4a4a4a', floorColor: '#333333', accent: '#e8dcb8', monsterPool: ['skeleton', 'ghost', 'bunny'], boss: 'bonesmcgee' },
  { name: "The Landlord's Office", wallColor: '#6b3050', floorColor: '#451a35', accent: '#ff9fcf', monsterPool: ['skeleton', 'sock', 'bat', 'ghost'], boss: 'landlord' },
]

export const MONSTER_DEFS = {
  slime: { name: 'Wobblin', emoji: '🫠', r: 0.7, hp: 16, atk: 3, speed: 2.4, xp: 8 },
  rat: { name: 'Rat Burglar', emoji: '🐀', r: 0.6, hp: 12, atk: 2, speed: 4.2, xp: 7 },
  fly: { name: 'Dust Fly', emoji: '🪰', r: 0.5, hp: 9, atk: 2, speed: 3.6, xp: 6 },
  sock: { name: 'Sock Puppet', emoji: '🧦', r: 0.7, hp: 20, atk: 4, speed: 2.6, xp: 10 },
  bunny: { name: 'Dust Bunny', emoji: '🐇', r: 0.6, hp: 11, atk: 2, speed: 4.6, xp: 6 },
  bat: { name: 'Belfry Bat', emoji: '🦇', r: 0.6, hp: 14, atk: 3, speed: 5.0, xp: 9 },
  spider: { name: 'Corner Spider', emoji: '🕷️', r: 0.6, hp: 13, atk: 3, speed: 3.2, xp: 8 },
  skeleton: { name: 'Skeleton Intern', emoji: '💀', r: 0.75, hp: 24, atk: 5, speed: 2.3, xp: 12 },
  ghost: { name: 'Office Ghost', emoji: '👻', r: 0.7, hp: 18, atk: 4, speed: 2.8, xp: 10 },
}

export const BOSS_DEFS = {
  gummyking: { name: 'Gordo the Gummy King', emoji: '🍮', r: 1.5, hp: 120, atk: 7, speed: 2.0, xp: 70 },
  lintlord: { name: 'The Lint Lord', emoji: '🧦', r: 1.5, hp: 160, atk: 9, speed: 2.3, xp: 110 },
  bartholomew: { name: 'Bartholomew the Belfry Bat', emoji: '🦇', r: 1.5, hp: 190, atk: 10, speed: 3.6, xp: 150 },
  bonesmcgee: { name: 'Bones McGee, Shift Supervisor', emoji: '💀', r: 1.6, hp: 220, atk: 12, speed: 2.4, xp: 190 },
  landlord: { name: 'The Landlord', emoji: '👹', r: 1.7, hp: 300, atk: 15, speed: 2.6, xp: 300 },
}

export const WEAPONS = [
  { name: 'Wobbly Stick', emoji: '🥢', atk: 2 },
  { name: 'Rusty Spoon', emoji: '🥄', atk: 4 },
  { name: 'Squeaky Wand', emoji: '🪄', atk: 6 },
  { name: 'Foam Sword', emoji: '🗡️', atk: 9 },
  { name: 'Laser Pointer', emoji: '🔦', atk: 13 },
  { name: 'Giant Serving Spoon', emoji: '🍴', atk: 18 },
  { name: 'Star Wand of Destiny', emoji: '✨', atk: 24 },
]
export const ARMORS = [
  { name: 'Fuzzy Pajamas', emoji: '🩳', def: 1 },
  { name: 'Rubber Raincoat', emoji: '🧥', def: 2 },
  { name: 'Cooking Pot Helmet', emoji: '🥘', def: 4 },
  { name: 'Trash Can Lid Shield', emoji: '🛡️', def: 6 },
  { name: 'Bubble Wrap Armor', emoji: '🫧', def: 9 },
  { name: 'Cardboard Knight Armor', emoji: '📦', def: 13 },
  { name: 'Golden Nightlight Armor', emoji: '🌟', def: 18 },
]

export const ACHIEVEMENTS = [
  { id: 'contestant', name: 'Chosen Contestant', desc: 'Step into the world.' },
  { id: 'firstblood', name: 'Slime Time', desc: 'Defeat your first monster.' },
  { id: 'lootgoblin', name: 'Loot Goblin', desc: 'Open 5 chests.' },
  { id: 'sockit', name: 'Sock It To Me', desc: 'Defeat a Sock Puppet.' },
  { id: 'snackbreak', name: 'Snack Break', desc: 'Drink a potion.' },
  { id: 'bossbeat1', name: 'Big Boss Energy', desc: 'Defeat a dungeon boss.' },
  { id: 'geared', name: 'Fashionably Equipped', desc: 'Equip a weapon and armor.' },
  { id: 'spellcaster', name: 'Wand Enthusiast', desc: 'Cast your first spell.' },
  { id: 'oof', name: 'Free Respawn', desc: 'Get knocked out (it happens to everyone).' },
  { id: 'richkid', name: 'Pocket Full of Gold', desc: 'Collect 200 gold.' },
  { id: 'champion', name: 'Dungeon Champion', desc: 'Clear every dungeon in the world!' },
]

export const PET_LINES = {
  intro: ['Wait, why can I talk?! Also why is there a whole world out here?', 'This seems fine. This seems totally fine.', 'If there are cheese puffs out here, I call dibs.'],
  floorStart: ["Ooh, inside a real building. Fancy.", "New dungeon smell.", "Try not to trip. I'm watching. Judging, a little."],
  lowHp: ["You're looking a little squishy. Maybe drink something?", 'That is a LOT of ouch. Potion time?', "I would not survive that. Good thing it's you and not me."],
  bossIntro: ["That thing looks like it eats hamsters. I'll be over here.", "Big. Scary. Round. You've got this. Probably.", 'On the count of three, you go first. One, two — go!'],
  levelUp: ['Look at you go! Very impressive, for a non-hamster.', "Stronger AND still hasn't found snacks. Bold strategy.", 'Level up! I take full credit for the moral support.'],
  idle: ['Do dungeons have a snack bar? Asking for a friend.', "I've decided my job here is 'vibes'.", 'Statistically, we should be more scared than we are.', 'This field is very large and I am very small.'],
  victory: ['WE did it. Well, YOU did it. I cheered very hard.', 'Put that on my resume: Professional Boss Witness.', 'Ten out of ten, would get zapped into a dungeon again.'],
}
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
    id, type, name: def.name, emoji: def.emoji, x, z, r: def.r,
    hp: Math.round(def.hp * tierMult), maxHp: Math.round(def.hp * tierMult),
    atk: Math.round(def.atk * tierMult), speed: def.speed, xp: Math.round(def.xp * tierMult),
    wanderDir: { x: 0, z: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockZ: 0, knockTimer: 0,
    dead: false, removeMe: false, isBoss: false,
    siteIndex: null, walls: EMPTY_RECTS, homeX: x, homeZ: z, leash: 16, aggro: 14,
  }
}
function createBoss(bossId, x, z, id) {
  const def = BOSS_DEFS[bossId]
  return {
    id, type: bossId, name: def.name, emoji: def.emoji, x, z, r: def.r,
    hp: def.hp, maxHp: def.hp, atk: def.atk, speed: def.speed, xp: def.xp,
    wanderDir: { x: 0, z: 0 }, wanderTimer: 0, atkCooldown: 0,
    knockX: 0, knockZ: 0, knockTimer: 0,
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
  const restGapIndices = [0, 2]
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
  const pool = ['slime', 'rat', 'bunny', 'fly']
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
    gold: 0, potions: 1,
    weaponName: null, armorName: null, weapons: [], armors: [],
    attackCooldown: 0, attackTimer: 0, hitIds: new Set(),
    potionCooldown: 0, invuln: 0,
  }
}

export function mkInitialState() {
  const sites = generateWorld()
  let nextId = 0
  for (const s of sites) for (const m of s.monsters) m.id = nextId++
  const safeZones = buildSafeZones(sites)
  const overworldMobs = generateOverworldMobs(sites, safeZones)
  for (const m of overworldMobs) m.id = nextId++

  return {
    sites, overworldMobs, player: mkPlayer(), safeZones, inSafeZone: false,
    mode: 'overworld', activeSite: null, justTeleported: null, teleportFlash: 0,
    projectiles: [],
    yaw: 0, pitch: 0.28, nextId,
    particles: [], bannerQueue: [], banner: null, bannerTimer: 0,
    petText: pick(PET_LINES.intro), petTimer: 9, petIdleCD: 14,
    announcerText: pick(ANNOUNCER_LINES.welcome), announcerTimer: 9, announcerIdleCD: 20,
    achievements: new Set(), chestsOpened: 0, lowHpTimer: 0,
    compass: null, elapsed: 0,
  }
}

// ── Event helpers ────────────────────────────────────────────────────
function pushBanner(state, icon, text, color) { state.bannerQueue.push({ icon, text, color: color || '#fff' }) }
function petSay(state, key) { state.petText = pick(PET_LINES[key]); state.petTimer = 7 }
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

function knockoutPlayer(state) {
  pushBanner(state, '💫', 'Knocked out! Free respawn, contestant!', '#FF9E6B')
  announcerSay(state, 'knockout')
  grantAchievement(state, 'oof')
  const p = state.player
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

function checkLevelUp(state) {
  const p = state.player
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
    petSay(state, 'levelUp')
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

function onMonsterDeath(state, m, helpers) {
  spawnBurst(state, m.x, m.z, m.isBoss ? 26 : 12, ['#FFD34D', '#FF8FD3', '#8FD3FF', '#B6FF6B'])
  const p = state.player
  p.xp += m.xp
  p.gold += Math.round(rand(m.xp * 0.6, m.xp * 1.3))
  if (!state.achievements.has('firstblood')) grantAchievement(state, 'firstblood')
  if (m.type === 'sock') grantAchievement(state, 'sockit')
  if (Math.random() < 0.1) { p.potions = Math.min(5, p.potions + 1); pushBanner(state, '🧃', 'A snack potion fell out!', '#7CFF6B') }
  if (m.isBoss) {
    const site = state.sites[m.siteIndex]
    site.cleared = true
    site.bossActive = false
    grantAchievement(state, 'bossbeat1')
    pushBanner(state, '🏆', `${m.name} defeated! ${site.theme.name} cleared!`, '#FFD34D')
    announcerSay(state, 'bossDefeat')
    petSay(state, 'victory')
    checkWin(state, helpers)
  }
  if (p.gold >= 200) grantAchievement(state, 'richkid')
  checkLevelUp(state)
  m.removeMe = true
}

function damageMonster(state, m, dmg, helpers) {
  m.hp -= dmg
  if (m.hp <= 0 && !m.dead) { m.dead = true; onMonsterDeath(state, m, helpers) }
}

function openChest(state, c, site) {
  c.opened = true
  spawnBurst(state, c.x, c.z, 10, ['#FFD34D', '#FFE9B8'])
  state.chestsOpened += 1
  if (state.chestsOpened === 5) grantAchievement(state, 'lootgoblin')
  const p = state.player
  const roll = Math.random()
  if (roll < 0.35) {
    const amt = 8 + Math.floor(Math.random() * 10) * (site.themeIndex + 1)
    p.gold += amt
    pushBanner(state, '🪙', `Found ${amt} gold!`, '#FFD34D')
  } else if (roll < 0.6) {
    p.potions = Math.min(5, p.potions + 1)
    pushBanner(state, '🧃', 'Found a snack potion!', '#7CFF6B')
  } else {
    // Found gear goes to the player's inventory rather than auto-equipping
    // — equipping is a deliberate choice made from the Gear panel (see
    // equipWeapon/equipArmor below), so the player picks their own loadout
    // instead of the chest silently swapping it for them. A duplicate of
    // something already owned is just sold on the spot.
    const tier = Math.min(WEAPONS.length - 1, site.themeIndex + 1 + Math.floor(Math.random() * 2))
    if (Math.random() < 0.5) {
      const w = WEAPONS[tier]
      if (p.weapons.some(x => x.name === w.name)) {
        const gold = w.atk * 3; p.gold += gold
        pushBanner(state, '💰', `Already own ${w.name} — sold the spare for ${gold} gold`, '#FFD34D')
      } else {
        p.weapons.push(w)
        pushBanner(state, w.emoji, `Found ${w.name}! Open Gear (I) to equip it.`, '#8FD3FF')
      }
    } else {
      const a = ARMORS[tier]
      if (p.armors.some(x => x.name === a.name)) {
        const gold = a.def * 3; p.gold += gold
        pushBanner(state, '💰', `Already own ${a.name} — sold the spare for ${gold} gold`, '#FFD34D')
      } else {
        p.armors.push(a)
        pushBanner(state, a.emoji, `Found ${a.name}! Open Gear (I) to equip it.`, '#8FD3FF')
      }
    }
  }
  if (p.gold >= 200) grantAchievement(state, 'richkid')
}

// Called from the UI when the player picks an owned item from the Gear
// panel — deliberate, player-driven equipping instead of chests
// auto-swapping gear for them.
export function equipWeapon(state, item) {
  const p = state.player
  if (p.weaponName === item.name) return
  p.weaponAtk = item.atk
  p.weaponName = item.name
  p.atk = p.baseAtk + p.weaponAtk
  pushBanner(state, item.emoji, `Equipped ${item.name}! (+${item.atk} ATK)`, '#8FD3FF')
  if (p.weaponName && p.armorName) grantAchievement(state, 'geared')
}
export function equipArmor(state, item) {
  const p = state.player
  if (p.armorName === item.name) return
  p.armorDef = item.def
  p.armorName = item.name
  p.def = p.baseDef + p.armorDef
  pushBanner(state, item.emoji, `Equipped ${item.name}! (+${item.def} DEF)`, '#8FD3FF')
  if (p.weaponName && p.armorName) grantAchievement(state, 'geared')
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
  petSay(state, 'bossIntro')
}

function updateMonsterAI(state, m, dt) {
  if (m.atkCooldown > 0) m.atkCooldown -= dt
  if (m.knockTimer > 0) {
    tryMoveEntity(m.walls, m, m.knockX * dt, m.knockZ * dt)
    m.knockTimer -= dt
    return
  }
  const playerSafe = state.mode === 'overworld' && isInSafeZone(state.player.x, state.player.z, state.safeZones)
  const dx0 = state.player.x - m.x, dz0 = state.player.z - m.z
  const d = Math.hypot(dx0, dz0)
  if (d < m.aggro && d > 0.001 && !playerSafe) {
    tryMoveEntity(m.walls, m, (dx0 / d) * m.speed * dt, (dz0 / d) * m.speed * dt)
    if (d < m.r + PLAYER_RADIUS + 0.6 && m.atkCooldown <= 0 && state.player.invuln <= 0) {
      state.player.hp -= m.atk
      state.player.invuln = INVULN_TIME
      m.atkCooldown = 0.9
      if (state.player.hp <= 0) knockoutPlayer(state)
    }
  } else {
    const homeDist = Math.hypot(m.x - m.homeX, m.z - m.homeZ)
    if (homeDist > m.leash) {
      tryMoveEntity(m.walls, m, ((m.homeX - m.x) / homeDist) * m.speed * 0.6 * dt, ((m.homeZ - m.z) / homeDist) * m.speed * 0.6 * dt)
    } else {
      m.wanderTimer -= dt
      if (m.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2
        m.wanderDir = { x: Math.cos(a), z: Math.sin(a) }
        m.wanderTimer = 1 + Math.random() * 1.6
      }
      tryMoveEntity(m.walls, m, m.wanderDir.x * m.speed * 0.35 * dt, m.wanderDir.z * m.speed * 0.35 * dt)
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
  state.yaw = 0
  state.teleportFlash = TELEPORT_FLASH_TIME
  state.justTeleported = 'in'
  pushBanner(state, '🌀', `Entering ${site.theme.name}...`, site.theme.accent)
  announcerSay(state, 'floorStart')
  petSay(state, 'floorStart')
}
function exitSite(state) {
  const site = state.sites[state.activeSite]
  const pushDist = DOOR_TRIGGER_R + 1.5
  state.player.x = site.doorX + site.doorDirX * pushDist
  state.player.z = site.doorZ + site.doorDirZ * pushDist
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
    const dd = (state.player.x - s.doorX) ** 2 + (state.player.z - s.doorZ) ** 2
    if (dd < DOOR_TRIGGER_R ** 2) { enterSite(state, s.index); break }
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
    const dd = (state.player.x - c.x) ** 2 + (state.player.z - c.z) ** 2
    if (dd < (PLAYER_RADIUS + 2.2) ** 2) openChest(state, c, site)
  }

  if (!site.bossSpawned && pointInBoundsXZ(state.player.x, state.player.z, site.bossRoom)) spawnBoss(state, site)

  const dd = (state.player.x - site.exitDisc.x) ** 2 + (state.player.z - site.exitDisc.z) ** 2
  if (dd < EXIT_TRIGGER_R ** 2) exitSite(state)

  state.compass = null
}

// ── Per-frame update ─────────────────────────────────────────────────
// `input` is a plain object the component mutates from keyboard/mouse
// events; this function drains the one-shot fields (attackPressed,
// potionPressed, yawDelta, pitchDelta) back to their rest state.
export function update(state, input, dt, helpers) {
  state.elapsed += dt
  state.justTeleported = null
  if (state.teleportFlash > 0) state.teleportFlash = Math.max(0, state.teleportFlash - dt)

  state.yaw += input.yawDelta
  state.pitch = clamp(state.pitch + input.pitchDelta, -PITCH_LIMIT, PITCH_LIMIT)
  input.yawDelta = 0
  input.pitchDelta = 0
  if (input.left) state.yaw += TURN_SPEED * dt
  if (input.right) state.yaw -= TURN_SPEED * dt

  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw)
  const player = state.player
  player.facing = { x: fx, z: fz }
  let mv = 0
  if (input.forward) mv += 1
  if (input.back) mv -= 1
  if (mv !== 0) {
    const dx = fx * mv * MOVE_SPEED * dt, dz = fz * mv * MOVE_SPEED * dt
    if (state.mode === 'dungeon') tryMoveEntity(state.sites[state.activeSite].wallRects, player, dx, dz)
    else moveAgainstBuildings(state.sites, player, dx, dz)
  }

  if (player.attackCooldown > 0) player.attackCooldown -= dt
  if (input.attackPressed && player.attackCooldown <= 0) {
    player.attackCooldown = ATTACK_COOLDOWN
    player.attackTimer = ATTACK_DURATION
    player.hitIds = new Set()
  }
  input.attackPressed = false
  if (player.attackTimer > 0) {
    player.attackTimer -= dt
    const hbx = player.x + fx * ATTACK_REACH
    const hbz = player.z + fz * ATTACK_REACH
    for (const m of allMonsters(state)) {
      if (m.dead || player.hitIds.has(m.id)) continue
      const dd = (hbx - m.x) ** 2 + (hbz - m.z) ** 2
      if (dd < (ATTACK_ARC_R + m.r) ** 2) {
        player.hitIds.add(m.id)
        const dmg = Math.max(1, player.atk + Math.floor(rand(-1, 2)))
        damageMonster(state, m, dmg, helpers)
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
    if (player.spellCooldown <= 0 && player.mana >= SPELL_COST) {
      player.spellCooldown = SPELL_COOLDOWN
      player.mana -= SPELL_COST
      grantAchievement(state, 'spellcaster')
      state.projectiles.push({
        x: player.x + fx * 1.0, z: player.z + fz * 1.0,
        vx: fx * SPELL_SPEED, vz: fz * SPELL_SPEED,
        life: SPELL_LIFE, dmg: Math.max(2, Math.round(player.atk * 0.85)),
        hitIds: new Set(), dead: false,
      })
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
  state.lowHpTimer -= dt
  if (player.hp < player.maxHp * 0.25 && state.lowHpTimer <= 0) { petSay(state, 'lowHp'); state.lowHpTimer = 6 }

  if (state.mode === 'overworld') updateOverworld(state, dt)
  else updateDungeon(state, dt, helpers)

  state.inSafeZone = state.mode === 'overworld' && isInSafeZone(player.x, player.z, state.safeZones)

  const activeWalls = state.mode === 'dungeon' ? state.sites[state.activeSite].wallRects : EMPTY_RECTS
  for (const pr of state.projectiles) {
    if (pr.dead) continue
    pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.life -= dt
    if (pr.life <= 0 || rectBlocked(activeWalls, pr.x, pr.z, SPELL_RADIUS)) { pr.dead = true; continue }
    for (const m of allMonsters(state)) {
      if (m.dead || pr.hitIds.has(m.id)) continue
      const dd = (pr.x - m.x) ** 2 + (pr.z - m.z) ** 2
      if (dd < (SPELL_RADIUS + m.r) ** 2) {
        pr.hitIds.add(m.id)
        damageMonster(state, m, pr.dmg, helpers)
        spawnBurst(state, m.x, m.z, 6, ['#c9a6ff', '#8fd3ff', '#ffffff'])
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
  if (state.petTimer > 0) state.petTimer -= dt
  if (state.announcerTimer > 0) state.announcerTimer -= dt
  state.petIdleCD -= dt
  if (state.petIdleCD <= 0) { petSay(state, 'idle'); state.petIdleCD = 14 + Math.random() * 10 }
  state.announcerIdleCD -= dt
  if (state.announcerIdleCD <= 0) { announcerSay(state, 'idle'); state.announcerIdleCD = 22 + Math.random() * 14 }
}
