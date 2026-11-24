// ── The Totally Scary Horror Game — pure gameplay state/logic ──────────
// Framework-agnostic: plain meters, no THREE, no DOM, so it can be
// driven headlessly. generateHotel() lays out the whole run of rooms
// (walls, furniture, drawers, closets) as data; stepGame() moves the
// player, resolves collision, and runs each monster's "mechanic". When a
// mechanic is failed, triggerCatch() opens a dialogue instead of ending
// the game, and the monster's event wraps up once the player has heard
// it out.
//
// Yaw convention: forward = (-sin yaw, -cos yaw), so yaw 0 looks toward
// -Z, the direction the hotel runs. Facing a point: yaw = atan2(-dx, -dz).
import {
  WALL_T, GAP_HALF, PLAYER_RADIUS, WALK_SPEED, SNEAK_SPEED, INTERACT_RANGE,
  KEY_TURN_SPEED, TOTAL_ROOMS, HALT_ROOM, SEEK_EYES_ROOMS, CHASE_ROOMS,
  LIBRARY_ROOM, FORCED_DARK_ROOMS, FORCE_RUSH_ROOM, FORCE_EYES_ROOM,
  RUSH_WARNING, RUSH_SPEED, EYES_LOOK_LIMIT, EYES_LOOK_ANGLE, SCREECH_WINDOW,
  SCREECH_LOOK_ANGLE, HALT_GOAL, HALT_CUE_EVERY, HALT_SPEED, HALT_WRAP_MARGIN,
  SEEK_SPEED, SEEK_CATCH, FIGURE_PATROL_SPEED, FIGURE_HUNT_SPEED,
  FIGURE_HEAR_WALK, FIGURE_HEAR_SNEAK, FIGURE_CATCH, FIGURE_REST, PAGES_NEEDED,
  EYE_H, MONSTER_DEFS, SHOP_ROOM, FORCE_DUPE_ROOMS, FORCE_GUS_ROOM, FORCE_AMBUSH_ROOM,
  FORCE_SPIDER_ROOM, QUIET_ROOMS, WES_POPS, WES_WINDOW, WES_LOOK_ANGLE, WES_CHANCE, AMBUSH_WARNING, AMBUSH_SPEED, AMBUSH_PAUSE, GUS_SPEED,
  GUS_WATCH_ANGLE, GUS_CATCH, HIDE_LIMIT, HIDE_LIMIT_OCCUPIED, HIDE_WARNING, BOOST_TIME,
  BOOST_MULT, SHOP_ITEMS, ELEVATOR_ROOM, FLOOR2_START, SHOP2_ROOM, CHASE2_ROOMS, BOILER_ROOM,
  FORCED_DARK_ROOMS_2, FORCE_HANK_ROOM, FORCE_DOUG_ROOM, FORCE_BATS_ROOM, VALVES_NEEDED,
  ELEVATOR_RIDE, HANK_DROP_RADIUS, DOUG_TRIGGER, DOUG_RUMBLE, DOUG_CATCH, BATS_WARNING, BATS_SWARM,
  FORCE_PUFF_ROOM, FORCE_TWIRL_ROOM, FORCE_BUMPUS_FROM, PUFF_WARNING, PUFF_BLAST, TWIRL_WIND, TWIRL_DANCE,
  BUMPUS_WARNING, BUMPUS_SPEED, RAIL_HALF, DIFFICULTIES, COSTUME_LINES,
  FLOOR3_ELEVATOR, FLOOR3_START, TOTAL_ROOMS_F3, SHOP3_ROOM, FORCE_COCO_ROOM, FORCE_MIRROR_ROOM,
  SHELLY_SPEED, SHELLY_NAP, COCO_TIME, MIRROR_GRACE,
  FLOOR4_ELEVATOR, FLOOR4_START, BOSS_ROOM, TOTAL_ROOMS_F4, GARDENER_MOODS, GARD_HEAR_WALK, GARD_HEAR_SNEAK,
  GARD_CHASE_SPEED, GARD_WATCH_SPEED, GARD_HIDE_GIVEUP, GARD_MOWER_SPEED, GARD_WHISPER_TIME,
  BOSS_HEARTS, BOSS_BRAZIERS, BOSS_SPEED, BOSS_WINDUP, BOSS_COOLDOWN, STAFF_TOTAL, STAFF_HEARTS, STAMPEDE_INV, SUB_TOTAL, LAMP_MOODS, NIBBLES_TIME, NIBBLES_SPEED, NIBBLES_BONUS, BUBBLES_TIME,
  BUBBLES_POP_ANGLE, BUBBLES_POP_RANGE, COLD_TIME, COLD_FREEZE, SECRET_CLICKS, SECRET_REWARD, SECRET_NPC,
} from './constants.js'

const T = WALL_T

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// Difficulty scaling: W stretches/shrinks warning windows, S monster speeds.
const W = (state, v) => v * state.diff.warn
const S = (state, v) => v * state.diff.speed

// ── World generation ────────────────────────────────────────────────────

function roomTypeFor(i, total, mode) {
  if (mode === -1) return i === 0 ? 'elevator' : i === total - 1 ? 'exit' : i === total - 2 ? 'meeting' : 'normal'
  if (mode === 13) return i === 0 ? 'elevator' : i === total - 1 ? 'exit' : i === total - 2 ? 'stampede' : 'normal'
  const attic = mode >= 3 && mode !== 13
  if (i === 0) return 'lobby'
  if (i === total - 1) return 'exit'
  if (mode === 4 && i === FLOOR4_ELEVATOR) return 'elevator'
  if (mode === 4 && i === BOSS_ROOM) return 'boss'
  if (mode === 4 && i === BOSS_ROOM - 1) return 'overgrown'
  if (mode === 4 && i >= FLOOR4_START) return 'garden'
  if (attic && i === FLOOR3_ELEVATOR) return 'elevator'
  if (attic && i === SHOP3_ROOM) return 'shop'
  if (i === HALT_ROOM) return 'halt'
  if (CHASE_ROOMS.includes(i) || CHASE2_ROOMS.includes(i)) return 'chase'
  if (i === LIBRARY_ROOM) return 'library'
  if (i === SHOP_ROOM || i === SHOP2_ROOM) return 'shop'
  if (i === ELEVATOR_ROOM) return 'elevator'
  if (i === BOILER_ROOM) return 'boiler'
  return 'normal'
}

function dimsFor(type, rng) {
  switch (type) {
    case 'lobby': return { hw: 5, len: 10 }
    case 'exit': return { hw: 6, len: 12 }
    case 'halt': return { hw: 1.6, len: 30 }
    case 'chase': return { hw: 2.2, len: 14 }
    case 'library': return { hw: 8, len: 20 }
    case 'shop': return { hw: 5, len: 12 }
    case 'elevator': return { hw: 1.4, len: 2.6 }
    case 'boiler': return { hw: 7, len: 16 }
    case 'garden': return { hw: 4.2 + rng() * 1.8, len: 9 + rng() * 5 }
    case 'boss': return { hw: 11, len: 24 }
    case 'overgrown': return { hw: 6.5, len: 22 }
    case 'stampede': return { hw: 10, len: 48 }
    case 'meeting': return { hw: 4.5, len: 12 }
    default: return { hw: 4 + rng() * 1.6, len: 8 + rng() * 5 }
  }
}

// Along-the-wall length, how far it sticks out into the room, height.
export const FURN = {
  closet: { len: 1.3, depth: 0.65, h: 2.1 },
  dresser: { len: 1.2, depth: 0.5, h: 0.95 },
  nightstand: { len: 0.55, depth: 0.45, h: 0.6 },
  bed: { len: 1.6, depth: 2.1, h: 0.55 },
  plant: { len: 0.6, depth: 0.6, h: 1.3 },
  chair: { len: 0.75, depth: 0.75, h: 0.95 },
  sofa: { len: 2.0, depth: 0.85, h: 0.85 },
  flowerbed: { len: 2.0, depth: 0.9, h: 0.4 },
  bench: { len: 1.6, depth: 0.6, h: 0.9 },
  topiary: { len: 0.9, depth: 0.9, h: 1.8 },
  gpot: { len: 0.6, depth: 0.6, h: 0.8 },
}

function addSolid(room, minX, maxX, minZ, maxZ, extra) {
  room.solids.push({ minX, maxX, minZ, maxZ, ...extra })
}

// Places a closet against a wall at (cx, cz) whose open side faces `faceYaw`.
function addCloset(room, id, cx, cz, faceYaw, alongX) {
  const { len, depth } = FURN.closet
  const fx = -Math.sin(faceYaw), fz = -Math.cos(faceYaw)
  const item = { kind: 'closet', cx, cz, len, depth, h: FURN.closet.h, faceYaw, alongX: !!alongX }
  room.furniture.push(item)
  if (alongX) addSolid(room, cx - len / 2, cx + len / 2, cz - depth / 2, cz + depth / 2)
  else addSolid(room, cx - depth / 2, cx + depth / 2, cz - len / 2, cz + len / 2)
  room.interactables.push({
    id, kind: 'closet', room: room.index,
    x: cx + fx * (depth / 2), z: cz + fz * (depth / 2), y: 1.2,
    insideX: cx, insideZ: cz, faceYaw,
  })
}

// Lines both side walls with furniture, front-to-back, leaving the first
// 2.0m / last 1.4m of the room clear so the openings are always reachable,
// and never sticking out more than FURN.bed.depth so the middle stays open.
function furnishSides(room, rng, opts) {
  const pool = opts.pool
  let bedPlaced = false
  let n = 0
  const sides = rng() < 0.5 ? [-1, 1] : [1, -1]
  for (const side of sides) {
    let z = room.z0 - 2.0 // extra room past the open door leaves on the entry side
    for (;;) {
      let kind
      if (opts.needCloset && !room.furniture.some(f => f.kind === 'closet')) kind = 'closet'
      else if (opts.needDresser && !room.furniture.some(f => f.kind === 'dresser')) kind = 'dresser'
      else {
        kind = pool[Math.floor(rng() * pool.length)]
        if (kind === 'bed' && (bedPlaced || room.hw < 4.5)) kind = 'dresser'
      }
      const spec = FURN[kind]
      if (z - spec.len < room.z1 + 1.4) break
      const cz = z - spec.len / 2
      const cx = side < 0 ? -room.hw + spec.depth / 2 : room.hw - spec.depth / 2
      const faceYaw = side * Math.PI / 2 // looking out from the wall into the room
      const id = `r${room.index}-${n++}`
      if (kind === 'closet') {
        addCloset(room, id, cx, cz, faceYaw, false)
      } else {
        room.furniture.push({ kind, cx, cz, len: spec.len, depth: spec.depth, h: spec.h, faceYaw, side })
        addSolid(room, cx - spec.depth / 2, cx + spec.depth / 2, cz - spec.len / 2, cz + spec.len / 2)
        const frontX = cx - side * (spec.depth / 2)
        if (kind === 'dresser') {
          for (const dz of [-0.3, 0.3]) {
            room.interactables.push({ id: `${id}-${dz < 0 ? 'a' : 'b'}`, kind: 'drawer', room: room.index, x: frontX, z: cz + dz, y: 0.7, side, contents: null, opened: false })
          }
        } else if (kind === 'nightstand') {
          room.interactables.push({ id: `${id}-a`, kind: 'drawer', room: room.index, x: frontX, z: cz, y: 0.45, side, contents: null, opened: false })
        }
        if (kind === 'bed') bedPlaced = true
      }
      z -= spec.len + 0.3 + rng() * 1.0
    }
  }
}

function buildWalls(room, next) {
  const { hw, z0, z1, exitX } = room
  const W = Math.max(hw, next ? next.hw : hw)
  // North wall (shared with the next room), with the opening.
  addSolid(room, -W - T, exitX - GAP_HALF, z1 - T, z1, { wall: true, north: true })
  addSolid(room, exitX + GAP_HALF, W + T, z1 - T, z1, { wall: true, north: true })
  // Side walls.
  addSolid(room, -hw - T, -hw, z1 - T, z0, { wall: true })
  if (room.secret) {
    // east wall with a door-sized gap behind the secret shelf
    addSolid(room, hw, hw + T, z1 - T, room.secret.z - GAP_HALF, { wall: true })
    addSolid(room, hw, hw + T, room.secret.z + GAP_HALF, z0, { wall: true })
  } else {
    addSolid(room, hw, hw + T, z1 - T, z0, { wall: true })
  }
  if (room.index === 0) addSolid(room, -hw - T, hw + T, z0, z0 + T, { wall: true })
  room.wallW = W
}

function buildLibrary(room, rng) {
  const { hw, z0, z1 } = room
  const segs = [[-hw + 1.1, -4.4], [-3.2, -1.2], [1.2, 3.2], [4.4, hw - 1.1]]
  const shelves = []
  for (let zr = z0 - 3.5; zr > z1 + 3; zr -= 3.2) {
    for (const [a, b] of segs) {
      shelves.push({ minX: a, maxX: b, z: zr })
      room.furniture.push({ kind: 'shelf', cx: (a + b) / 2, cz: zr, len: b - a, depth: 0.6, h: 2.2 })
      addSolid(room, a, b, zr - 0.3, zr + 0.3)
    }
  }
  // Three guest-book pages tucked onto three different shelves.
  const picks = []
  while (picks.length < PAGES_NEEDED) {
    const s = Math.floor(rng() * shelves.length)
    if (!picks.includes(s)) picks.push(s)
  }
  picks.forEach((s, k) => {
    const sh = shelves[s]
    const face = rng() < 0.5 ? -1 : 1
    room.interactables.push({
      id: `page-${k}`, kind: 'page', room: room.index,
      x: sh.minX + 0.4 + rng() * (sh.maxX - sh.minX - 0.8), z: sh.z + face * 0.33, y: 1.15,
      face, taken: false,
    })
  })
  // Four closets, one in each corner, against the south/north walls.
  const cxs = [-(hw - 1.2), hw - 1.2]
  cxs.forEach((cx, k) => addCloset(room, `lib-s${k}`, cx, z0 - FURN.closet.depth / 2, 0, true))
  cxs.forEach((cx, k) => addCloset(room, `lib-n${k}`, cx, z1 + FURN.closet.depth / 2, Math.PI, true))
}

// Gift shop: Gloria's counter along the west wall, shelves of souvenirs east.
function buildShop(room, rng) {
  const { hw, z0, z1 } = room
  const zc = (z0 + z1) / 2
  // One of the three souvenir shelves hides a door into a secret room
  // (built off the east wall, outside every other room's footprint).
  const secretDz = [-3, 0, 3][Math.floor(rng() * 3)]
  const sz = zc + secretDz
  const x0 = hw + T, x1 = hw + T + 6
  room.secret = { z: sz, x0, x1, zA: sz - 2.5, zB: sz + 2.5, clicks: 0, opened: false, doorOpen: false, npc: SECRET_NPC[room.index], talked: false }
  room.furniture.push({ kind: 'counter', cx: -hw + 1.55, cz: zc, len: 4, depth: 0.7, h: 1.05, faceYaw: -Math.PI / 2 })
  addSolid(room, -hw + 1.2, -hw + 1.9, zc - 2, zc + 2)
  addSolid(room, -hw, -hw + 1.2, zc - 2, zc + 2) // behind the counter is staff only
  room.shopkeeper = { x: -hw + 0.65, z: zc }
  room.interactables.push({ id: 'shop', kind: 'shop', room: room.index, x: -hw + 1.9, z: zc, y: 1.1 })
  for (const dz of [-3, 0, 3]) {
    const secret = dz === secretDz
    room.furniture.push({ kind: 'giftshelf', cx: hw - 0.3, cz: zc + dz, len: 2, depth: 0.6, h: 1.8, faceYaw: Math.PI / 2, secret })
    addSolid(room, hw - 0.6, hw, zc + dz - 1, zc + dz + 1, secret ? { secretShelf: true } : undefined)
    // No on-screen prompt for these — you have to think to click them.
    room.interactables.push({ id: `shelf-${room.index}-${dz}`, kind: 'giftshelf', secret, room: room.index, x: hw - 0.65, z: zc + dz, y: 1.1 })
  }
  // where the shelf ends up once it swings open (hinged at its north end)
  addSolid(room, hw - 2.3, hw, sz - 1.3, sz - 0.7, { secretSwing: true })
  // the secret door in the gap behind the shelf, and the room beyond it
  room.interactables.push({ id: `secretdoor-${room.index}`, kind: 'secretdoor', room: room.index, x: hw - 0.25, z: sz, y: 1.2 })
  addSolid(room, hw, hw + T, sz - GAP_HALF, sz + GAP_HALF, { secretDoor: true })
  addSolid(room, x1, x1 + T, sz - 2.5 - T, sz + 2.5 + T, { wall: true, secretRoom: true })
  addSolid(room, x0, x1, sz - 2.5 - T, sz - 2.5, { wall: true, secretRoom: true })
  addSolid(room, x0, x1, sz + 2.5, sz + 2.5 + T, { wall: true, secretRoom: true })
  const npcX = x1 - 1.2
  room.secret.npcPos = { x: npcX, z: sz }
  room.furniture.push({ kind: 'desk', cx: x1 - 2.1, cz: sz, len: 2.2, depth: 0.9, h: 0.8, faceYaw: Math.PI / 2 })
  addSolid(room, x1 - 2.55, x1 - 1.65, sz - 1.1, sz + 1.1)
  room.interactables.push({ id: `npc-${room.index}`, kind: 'npc', npc: room.secret.npc, room: room.index, x: x1 - 2.6, z: sz, y: 1.2 })
}

// The boiler room (Floor 2's library): a huge boiler in the middle, pipes,
// and three stuck valves to turn before the way on opens.
function buildBoiler(room, rng) {
  const { hw, z0, z1 } = room
  const zc = (z0 + z1) / 2
  room.furniture.push({ kind: 'boiler', cx: 0, cz: zc, len: 4, depth: 5, h: 2.8 })
  addSolid(room, -2, 2, zc - 2.5, zc + 2.5)
  // pipe runs / tanks along the side walls
  for (const sx of [-1, 1]) for (const dz of [-4, 4]) {
    room.furniture.push({ kind: 'tank', cx: sx * (hw - 0.6), cz: zc + dz, len: 1.2, depth: 1.2, h: 2.2 })
    addSolid(room, sx * (hw - 0.6) - 0.6, sx * (hw - 0.6) + 0.6, zc + dz - 0.6, zc + dz + 0.6)
  }
  // valves: one on each long side of the boiler + one on the far wall
  const spots = [
    { x: -2.05, z: zc + (rng() - 0.5) * 3, face: -1, axis: 'x' },
    { x: 2.05, z: zc + (rng() - 0.5) * 3, face: 1, axis: 'x' },
    { x: (rng() < 0.5 ? -1 : 1) * (hw - 1.8), z: zc, face: 0, axis: 'x' },
  ]
  spots[2].face = spots[2].x < 0 ? 1 : -1
  spots[2].x = spots[2].x < 0 ? -hw + 0.1 : hw - 0.1 // on the wall, in the tank-free stretch between the tanks
  spots.forEach((sp, k) => room.interactables.push({ id: `valve-${k}`, kind: 'valve', room: room.index, x: sp.x, z: sp.z, y: 1.2, face: sp.face, turned: false }))
  for (const [k, cx] of [[0, -(hw - 1.2)], [1, hw - 1.2]]) addCloset(room, `boil-s${k}`, cx, z0 - FURN.closet.depth / 2, 0, true)
}

// Dirt mounds in mine tunnels — Doug lives under one of them. Kept off the
// walls so they never block the way through.
function addMounds(room, rng) {
  const n = 2 + Math.floor(rng() * 3)
  room.mounds = []
  for (let k = 0; k < n; k++) {
    const x = (rng() * 2 - 1) * Math.max(0.5, room.hw - 2.4)
    const z = room.z0 - 2.6 - rng() * (room.len - 5)
    if (room.mounds.some(m => Math.hypot(m.x - x, m.z - z) < 1.8)) continue
    room.mounds.push({ x, z, phase: 'idle', t: 0 })
  }
}

// The great hall at the end of the Staff Wing: a long room with pillars to
// weave between. Everyone comes out of the walls at once.
function buildStampedeHall(room, rng) {
  const { hw, z0, z1 } = room
  for (let z = z0 - 9; z > z1 + 5; z -= 6.5) {
    for (const x of [-6, -2, 2, 6]) {
      const jx = x + (rng() - 0.5) * 1.2
      room.furniture.push({ kind: 'pillar', cx: jx, cz: z, len: 0.9, depth: 0.9, h: 3 })
      addSolid(room, jx - 0.45, jx + 0.45, z - 0.45, z + 0.45)
    }
  }
  void hw
}

// Door 199: everyone the Gardener has "kept" — every other monster in the
// hotel — sitting in two rows along the hedges, overgrown with vines.
// Their spots are plain data; the render loop puts the actual models there.
export const OVERGROWN_CAST = ['barry', 'steve', 'drakko', 'wendell', 'gary', 'reginald', 'doris', 'mildred', 'tim', 'frank', 'gus',
  'hank', 'bernadette', 'doug', 'puff', 'twirl', 'bumpus', 'nibbles', 'bubbles', 'wes', 'yolanda', 'shelly', 'coco', 'marvin',
  'gloria', 'mabel', 'ollie', 'hoot', 'bea']
function buildOvergrown(room) {
  const { hw, z0, z1 } = room
  const slots = []
  const perRow = Math.ceil(OVERGROWN_CAST.length / 4)
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      for (let k = 0; k < perRow; k++) {
        const z = z0 - 3 - k * ((room.len - 6) / (perRow - 1)) - (row ? 1.3 : 0)
        slots.push({ x: side * (hw - 1.0 - row * 1.7), z, faceYaw: -side * Math.PI / 2 })
      }
    }
  }
  room.statues = OVERGROWN_CAST.map((id, k) => ({ id, ...slots[k] }))
  for (const st of room.statues) addSolid(room, st.x - 0.45, st.x + 0.45, st.z - 0.45, st.z + 0.45)
}

// The courtyard where the Gardener stops pretending: four braziers to
// light, and a bell by the gate.
function buildCourtyard(room) {
  const { z0, z1 } = room
  const spots = [[-7, z0 - 5], [7, z0 - 5], [-7, z1 + 5], [7, z1 + 5]]
  spots.forEach(([x, z], k) => {
    addSolid(room, x - 0.35, x + 0.35, z - 0.35, z + 0.35)
    room.interactables.push({ id: `brazier-${k}`, kind: 'brazier', room: room.index, x, z, y: 1.0, lit: false })
  })
  const bx = room.exitX + 1.6, bz = z1 + 0.6
  addSolid(room, bx - 0.15, bx + 0.15, bz - 0.15, bz + 0.15)
  room.bell = { x: bx, z: bz }
  room.interactables.push({ id: 'bell', kind: 'bell', room: room.index, x: bx, z: bz + 0.2, y: 1.5 })
  room.locked = true
  room.lockKind = 'boss'
  // thorny vines seal the way you came in once the fight starts
  addSolid(room, room.entryX - GAP_HALF, room.entryX + GAP_HALF, z0 - 0.15, z0, { back: true })
}

// Frank's rooms: the real way on is a CLOSED door with the next number on
// it; a second closed door on the same wall has the wrong number, and Frank
// is standing behind it.
function makeDupe(room, rng) {
  const lim = room.hw - 1.2
  let fakeX = null
  for (let tries = 0; tries < 30 && fakeX === null; tries++) {
    const x = (rng() * 2 - 1) * lim
    if (Math.abs(x - room.exitX) >= 2.4) fakeX = x
  }
  if (fakeX === null) return false
  const real = room.index + 1
  const wrong = [real + 1, real + 2, real - 2, real + 10, real - 1].filter(n => n > 0 && n !== real)
  room.locked = true
  room.lockKind = 'dupe'
  room.fakeX = fakeX
  room.fakeNum = wrong[Math.floor(rng() * wrong.length)]
  room.interactables.push({ id: `door-${room.index}`, kind: 'door', real: true, num: real, room: room.index, x: room.exitX, z: room.z1 + 0.2, y: 1.2 })
  room.interactables.push({ id: `fake-${room.index}`, kind: 'door', real: false, num: room.fakeNum, room: room.index, x: fakeX, z: room.z1 + 0.2, y: 1.2 })
  return true
}

function buildChase(room, rng) {
  const { hw, z0 } = room
  room.path = []
  let side = rng() < 0.5 ? -1 : 1
  for (let k = 1; k <= 3; k++) {
    const zc = z0 - k * 3.5
    const minX = side < 0 ? -hw : hw - 2.0
    const maxX = side < 0 ? -hw + 2.0 : hw
    room.furniture.push({ kind: 'toppled', cx: (minX + maxX) / 2, cz: zc, len: 2.0, depth: 0.7, h: 1.0, side })
    addSolid(room, minX, maxX, zc - 0.35, zc + 0.35)
    room.path.push({ x: side < 0 ? 1.0 : -1.0, z: zc })
    side = -side
  }
}

// mode 3 builds the longer hotel used for attic trips (doors 101–150);
// mode 4 is longer still, out into the garden (doors 151–200).
export function generateHotel(rng, mode = 1) {
  const rooms = []
  let z0 = 0
  const total = mode === -1 ? SUB_TOTAL : mode === 13 ? STAFF_TOTAL : mode === 4 ? TOTAL_ROOMS_F4 : mode === 3 ? TOTAL_ROOMS_F3 : TOTAL_ROOMS
  for (let i = 0; i < total; i++) {
    const type = roomTypeFor(i, total, mode)
    const { hw, len } = dimsFor(type, rng)
    const floor = mode === -1 ? -1 : mode === 13 ? 13 : mode === 4 && i >= FLOOR4_ELEVATOR ? 4 : mode >= 3 && i >= FLOOR3_ELEVATOR ? 3 : i >= FLOOR2_START ? 2 : 1
    rooms.push({
      index: i, type, hw, len, z0, z1: z0 - len, floor,
      theme: floor === -1 ? 'sub' : floor === 13 ? 'staff' : floor === 4 ? 'garden' : floor === 3 ? 'attic' : floor === 1 ? 'hotel' : type === 'chase' ? 'mine' : type === 'boiler' ? 'boiler' : type === 'normal' ? (i === FORCE_DOUG_ROOM || rng() < 0.5 ? 'mine' : 'basement') : 'basement',
      solids: [], furniture: [], interactables: [],
      dark: false, locked: false, unlocked: false, lockKind: null, seekEyes: SEEK_EYES_ROOMS.includes(i),
    })
    z0 = z0 - len - T
  }

  rooms[0].entryX = 0
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i], b = rooms[i + 1]
    let lim = Math.min(a.hw, b.hw) - 1.2
    if (a.type === 'library' || b.type === 'library' || a.type === 'boiler' || b.type === 'boiler' || a.type === 'boss' || b.type === 'boss' || a.type === 'overgrown' || b.type === 'overgrown' || a.type === 'stampede' || b.type === 'stampede') lim = Math.min(lim, 2.5)
    if (a.type === 'chase' || b.type === 'chase') lim = Math.min(lim, 0.3)
    const x = (rng() * 2 - 1) * Math.max(0, lim)
    a.exitX = x
    b.entryX = x
  }
  rooms[rooms.length - 1].exitX = 0

  for (const room of rooms) {
    const i = room.index
    if (room.type === 'normal' && room.floor === -1) {
      // the sub-basement: every room is pitch black
      room.dark = true
      room.locked = i > 2 && rng() < 0.15
      furnishSides(room, rng, { needCloset: true, needDresser: room.locked, pool: ['closet', 'dresser', 'nightstand', 'bed', 'chair', 'plant'] })
    } else if (room.type === 'meeting') {
      const zc = (room.z0 + room.z1) / 2
      room.dark = true
      room.furniture.push({ kind: 'candletable', cx: 0, cz: zc, len: 1.6, depth: 1.0, h: 0.8 })
      addSolid(room, -0.8, 0.8, zc - 0.5, zc + 0.5)
      room.seat = { x: 0, z: zc - 1.0 }
      addSolid(room, -0.35, 0.35, zc - 1.35, zc - 0.65)
      room.locked = true
      room.lockKind = 'meeting'
    } else if (room.type === 'normal' && room.floor === 13) {
      // the Staff Wing: no closets. Anywhere.
      room.dark = i > 2 && rng() < 0.35
      room.locked = i > 2 && rng() < 0.2
      furnishSides(room, rng, { needDresser: room.locked, pool: ['dresser', 'dresser', 'nightstand', 'bed', 'plant', 'chair'] })
    } else if (room.type === 'stampede') {
      buildStampedeHall(room, rng)
    } else if (room.type === 'normal') {
      const wantDupe = FORCE_DUPE_ROOMS.includes(i) || (i >= 7 && i !== FLOOR2_START && i !== FLOOR3_START && rng() < 0.1)
      const forcedDark = room.floor === 1 ? FORCED_DARK_ROOMS.includes(i) : FORCED_DARK_ROOMS_2.includes(i)
      room.dark = !wantDupe && i >= 4 && i !== FLOOR2_START && i !== FLOOR3_START && (forcedDark || rng() < (room.floor === 2 ? 0.28 : 0.22))
      room.locked = !wantDupe && i >= 2 && i !== FORCE_RUSH_ROOM && i !== LIBRARY_ROOM - 1 && rng() < 0.25
      furnishSides(room, rng, {
        needCloset: true, needDresser: room.locked || i === FORCE_SPIDER_ROOM,
        pool: ['closet', 'dresser', 'dresser', 'nightstand', 'bed', 'bed', 'plant', 'chair'],
      })
      if (wantDupe) makeDupe(room, rng)
      // A few closets are already Mildred's.
      for (const it of room.interactables) if (it.kind === 'closet' && i >= 10 && rng() < 0.15) it.occupied = true
      if (room.theme === 'mine' && i >= FORCE_DOUG_ROOM && (i === FORCE_DOUG_ROOM || rng() < 0.6)) addMounds(room, rng)
    } else if (room.type === 'shop') {
      buildShop(room, rng)
    } else if (room.type === 'boiler') {
      buildBoiler(room, rng)
      room.dark = true
      room.locked = true
      room.lockKind = 'valves'
    } else if (room.type === 'elevator') {
      room.locked = true
      room.lockKind = 'elevator'
      // the doors behind you close for the ride
      addSolid(room, room.entryX - GAP_HALF, room.entryX + GAP_HALF, room.z0 - 0.15, room.z0, { back: true })
    } else if (room.type === 'lobby' || room.type === 'exit') {
      furnishSides(room, rng, { pool: ['sofa', 'plant', 'chair', 'dresser'] })
      if (room.type === 'lobby') addSolid(room, -3.9, -1.3, room.z0 - 1.5, room.z0 - 0.9) // front desk
    } else if (room.type === 'library') {
      buildLibrary(room, rng)
      room.locked = true
      room.lockKind = 'pages'
    } else if (room.type === 'chase') {
      buildChase(room, rng)
    } else if (room.type === 'garden') {
      furnishSides(room, rng, { needCloset: true, pool: ['flowerbed', 'flowerbed', 'bench', 'topiary', 'gpot', 'closet'] })
    } else if (room.type === 'boss') {
      buildCourtyard(room)
    } else if (room.type === 'overgrown') {
      buildOvergrown(room)
    }

    if (room.locked && !room.lockKind) {
      room.lockKind = 'pass'
      const drawers = room.interactables.filter(it => it.kind === 'drawer')
      drawers[Math.floor(rng() * drawers.length)].contents = 'pass'
    }
    for (const it of room.interactables) {
      if (it.kind === 'drawer' && it.contents === null) {
        const r = rng()
        it.contents = i >= 5 && r < 0.05 && room.floor !== 13 && room.floor !== -1 ? 'spider' : r < 0.5 ? { coins: 1 + Math.floor(rng() * 6) } : 'empty'
      }
    }
    if (i === FORCE_SPIDER_ROOM && room.floor !== 13 && room.floor !== -1) {
      const d = room.interactables.find(it => it.kind === 'drawer' && it.contents !== 'pass')
      if (d) d.contents = 'spider'
    }
    if (room.locked) {
      addSolid(room, room.exitX - GAP_HALF, room.exitX + GAP_HALF, room.z1 - T, room.z1 + 0.15, { rope: true })
      if (room.lockKind === 'pass') {
        room.interactables.push({ id: `rope-${i}`, kind: 'rope', room: i, x: room.exitX, z: room.z1 + 0.2, y: 1.0 })
      }
    }
    buildWalls(room, rooms[i + 1])
  }

  // Every opening has a pair of numbered hotel doors, swung open flat into
  // the next room (each leaf is half the opening, so it never reaches the
  // furniture, which starts 1.4m in from the wall).
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i]
    if (room.type === 'elevator') continue
    for (const s of [-1, 1]) {
      const x = room.entryX + s * GAP_HALF
      addSolid(room, s > 0 ? x : x - 0.07, s > 0 ? x + 0.07 : x, room.z0 - GAP_HALF, room.z0, { door: true })
    }
  }

  // A few closets (lockers, garden sheds…) have a loose back wall. No hints.
  for (const room of rooms) {
    for (const it of room.interactables) if (it.kind === 'closet' && !it.occupied && rng() < 0.07) it.shortcut = true
  }

  const lib = rooms[LIBRARY_ROOM]
  if (lib) lib.grid = buildNavGrid(lib)
  return rooms
}

// ── Library navigation grid (for the blind knight) ──────────────────────

const CELL = 0.5
function buildNavGrid(room) {
  const nx = Math.floor((room.hw * 2) / CELL)
  const nz = Math.floor(room.len / CELL)
  const free = new Uint8Array(nx * nz)
  const r = 0.4
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = -room.hw + (ix + 0.5) * CELL
      const z = room.z1 + (iz + 0.5) * CELL
      let ok = x > -room.hw + r && x < room.hw - r && z > room.z1 + r && z < room.z0 - r
      if (ok) {
        for (const s of room.solids) {
          if (x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r) { ok = false; break }
        }
      }
      free[iz * nx + ix] = ok ? 1 : 0
    }
  }
  return { nx, nz, free, x0: -room.hw, z0: room.z1 }
}

function cellOf(grid, x, z) {
  const ix = clamp(Math.floor((x - grid.x0) / CELL), 0, grid.nx - 1)
  const iz = clamp(Math.floor((z - grid.z0) / CELL), 0, grid.nz - 1)
  return iz * grid.nx + ix
}
function cellCenter(grid, c) {
  const ix = c % grid.nx, iz = Math.floor(c / grid.nx)
  return { x: grid.x0 + (ix + 0.5) * CELL, z: grid.z0 + (iz + 0.5) * CELL }
}
function nearestFree(grid, c) {
  if (grid.free[c]) return c
  const { x, z } = cellCenter(grid, c)
  let best = -1, bd = Infinity
  for (let k = 0; k < grid.free.length; k++) {
    if (!grid.free[k]) continue
    const p = cellCenter(grid, k)
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < bd) { bd = d; best = k }
  }
  return best
}

export function gridPath(grid, fx, fz, tx, tz) {
  const start = nearestFree(grid, cellOf(grid, fx, fz))
  const goal = nearestFree(grid, cellOf(grid, tx, tz))
  if (start < 0 || goal < 0) return []
  const prev = new Int32Array(grid.free.length).fill(-1)
  prev[start] = start
  const queue = [start]
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi]
    if (c === goal) break
    const ix = c % grid.nx, iz = Math.floor(c / grid.nx)
    const nbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [ddx, ddz] of nbrs) {
      const jx = ix + ddx, jz = iz + ddz
      if (jx < 0 || jz < 0 || jx >= grid.nx || jz >= grid.nz) continue
      const n = jz * grid.nx + jx
      if (!grid.free[n] || prev[n] !== -1) continue
      prev[n] = c
      queue.push(n)
    }
  }
  if (prev[goal] === -1) return []
  const out = []
  for (let c = goal; c !== start; c = prev[c]) out.push(cellCenter(grid, c))
  return out.reverse()
}

// ── Queries ─────────────────────────────────────────────────────────────

export function roomIndexAt(rooms, z) {
  if (z > rooms[0].z0) return 0
  for (const r of rooms) if (z > r.z1 - T) return r.index
  return rooms.length - 1
}

function blocked(state, x, z, r) {
  const idx = roomIndexAt(state.rooms, z)
  for (let k = Math.max(0, idx - 1); k <= Math.min(state.rooms.length - 1, idx + 1); k++) {
    const room = state.rooms[k]
    for (const s of room.solids) {
      if (s.rope && room.unlocked) continue
      if (s.back && !room.backClosed) continue
      if (room.secret) {
        if (s.secretShelf && room.secret.opened) continue
        if (s.secretSwing && !room.secret.opened) continue
        if (s.secretDoor && room.secret.doorOpen) continue
      }
      if (x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r) return true
    }
  }
  return false
}

// Angle between where the player is looking and the direction to a point.
export function lookAngle(p, tx, ty, tz) {
  const eyeY = p.eyeY ?? EYE_H
  const vx = tx - p.x, vy = ty - eyeY, vz = tz - p.z
  const len = Math.hypot(vx, vy, vz) || 1
  const cp = Math.cos(p.pitch)
  const dx = -Math.sin(p.yaw) * cp, dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * cp
  return Math.acos(clamp((vx * dx + vy * dy + vz * dz) / len, -1, 1))
}

function polylineLength(path) {
  let L = 0
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z)
  return L
}
function pointAlong(path, s) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const seg = Math.hypot(b.x - a.x, b.z - a.z)
    if (s <= seg || i === path.length - 1) {
      const t = seg > 0 ? clamp(s / seg, 0, 1) : 1
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dirX: b.x - a.x, dirZ: b.z - a.z }
    }
    s -= seg
  }
  const last = path[path.length - 1]
  return { x: last.x, z: last.z, dirX: 0, dirZ: -1 }
}

// ── State ───────────────────────────────────────────────────────────────

export function createGame(seed = (Math.random() * 2 ** 32) >>> 0, { startFloor = 1, difficulty = 'normal', startCoins = 0, baseCoins = null } = {}) {
  const rng = mulberry32(seed)
  const rooms = generateHotel(rng, startFloor >= 3 || startFloor === -1 ? startFloor : 1)
  addWesWindows(rooms, seed)
  const elevatorRoom = startFloor === 13 || startFloor === -1 ? 0 : startFloor === 4 ? FLOOR4_ELEVATOR : startFloor === 3 ? FLOOR3_ELEVATOR : ELEVATOR_ROOM
  const state = {
    elevatorRoom,
    seed, rng, rooms,
    player: {
      x: 0, z: rooms[0].z0 - 2.5, yaw: 0, pitch: 0, eyeY: EYE_H,
      room: 0, hidden: null, moving: false, sneaking: false, bob: 0, hideT: 0, boostT: 0, lightOn: true,
    },
    maxRoom: 0,
    coins: 0, hasPass: false, pages: 0, valves: 0,
    inventory: Object.fromEntries(SHOP_ITEMS.map(it => [it.id, 0])),
    difficulty, diff: DIFFICULTIES[difficulty] || DIFFICULTIES.normal, startFloor,
    lampBag: [], lastLampRoom: 0, lightOut: 0,
    gardBag: [], lastGardMood: null, lastGardRoom: 0, bossDefeated: false,
    hidCount: 0, bought: 0, costumeSaves: 0, maxCoins: 0, popped: 0,
    shopOpen: false,
    ev: {
      rush: null, eyes: null, screech: null, ambush: null, gus: null, mildred: null,
      shelly: null, coco: null, mirror: null, gard: null, boss: null, lamp: null, meet: null,
      hank: null, bats: null, wes: null, puff: null, twirl: null, bumpus: null, nibbles: null, bubbles: null, cold: null, elevator: { phase: 'idle', t: 0 },
      seek2: { phase: 'idle', s: 0, path: null, x: 0, z: 0 },
      halt: { phase: 'idle', progress: 0, dir: -1, nextCue: HALT_CUE_EVERY, wendell: null },
      seek: { phase: 'idle', s: 0, path: null, x: 0, z: 0 },
      figure: null,
    },
    roomsSinceRush: 0,
    screechRooms: new Set(),
    flicker: false,
    hypno: 0,
    turnCue: 0,
    focus: null,
    dialogue: null,
    sitting: null,
    caption: null,
    metIds: new Set(),
    encountered: new Set(), // every entity you've run into, caught or not (feeds the journal)
    catchesById: {},
    talkedById: {},
    dodgesById: {},
    paused: false,
    catchCount: 0,
    dodges: 0,
    won: false,
    elapsed: 0,
  }
  setCaption(state, 'Find your way out of the hotel. Search drawers with E, and duck into a closet if the lights start flickering.', 6)
  if (startFloor >= 2 || startFloor === -1) {
    // Skip straight to the elevator, with a few tips for the shop.
    const el = rooms[elevatorRoom]
    state.player.x = el.entryX
    state.player.z = el.z0 - 1.4
    state.player.room = elevatorRoom
    state.maxRoom = elevatorRoom
    state.coins = 20
    state.caption = null
  }
  if (startFloor === 13) {
    // it's always Totally Scary in the Staff Wing, and you only get three hearts
    state.hardcore = true
    state.hearts = STAFF_HEARTS
    state.diff = DIFFICULTIES.scary
  }
  if (baseCoins != null) state.coins = baseCoins
  if (startCoins) state.coins += startCoins
  return state
}

function encounter(state, id) { state.encountered.add(id) }
function dodged(state, id) {
  encounter(state, id)
  state.dodges += 1
  state.dodgesById[id] = (state.dodgesById[id] || 0) + 1
}

export function setCaption(state, text, secs = 3.5, tone = 'info') {
  state.caption = { text, t: secs, tone }
}

// ── Player ──────────────────────────────────────────────────────────────

function movePlayer(state, input, dt) {
  const p = state.player
  p.yaw += (input.yawDelta || 0) + ((input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0)) * KEY_TURN_SPEED * dt
  p.pitch = clamp(p.pitch + (input.pitchDelta || 0), -1.3, 1.3)
  p.sneaking = !!input.sneak
  p.moving = false
  if (p.hidden) return

  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const s = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (f === 0 && s === 0) return
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw)
  let dx = fx * f + rx * s, dz = fz * f + rz * s
  const len = Math.hypot(dx, dz) || 1
  dx /= len; dz /= len
  const speed = (p.sneaking ? SNEAK_SPEED : WALK_SPEED) * (p.boostT > 0 ? BOOST_MULT : 1)
  const ox = p.x, oz = p.z
  const nx = p.x + dx * speed * dt
  if (!blocked(state, nx, p.z, PLAYER_RADIUS)) p.x = nx
  const nz = p.z + dz * speed * dt
  if (!blocked(state, p.x, nz, PLAYER_RADIUS)) p.z = nz
  const moved = Math.hypot(p.x - ox, p.z - oz)
  p.moving = moved > speed * dt * 0.2
  p.bob += moved * 2.6
}

function nearbyInteractables(state) {
  const out = []
  const i = state.player.room
  for (let k = Math.max(0, i - 1); k <= Math.min(state.rooms.length - 1, i + 1); k++) out.push(...state.rooms[k].interactables)
  return out
}

function computeFocus(state) {
  const p = state.player
  if (p.hidden) return state.rooms[p.room].interactables.find(it => it.id === p.hidden) || null
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
  let best = null, bestD = Infinity
  for (const it of nearbyInteractables(state)) {
    if (it.opened || it.taken || it.turned || it.lit) continue
    if (it.kind === 'bell' && state.ev.boss?.phase !== 'weak') continue
    if ((it.kind === 'rope' || it.kind === 'door') && state.rooms[it.room].unlocked) continue
    if (it.kind === 'secretdoor' && (!state.rooms[it.room].secret.opened || state.rooms[it.room].secret.doorOpen)) continue
    if (it.kind === 'giftshelf' && it.secret && state.rooms[it.room].secret.opened) continue
    const dx = it.x - p.x, dz = it.z - p.z
    const d = Math.hypot(dx, dz)
    if (d > (it.kind === 'npc' ? 3.4 : INTERACT_RANGE)) continue // you can chat across a desk
    const cos = (dx * fx + dz * fz) / (d || 1)
    if (d > 0.4 && cos < 0.64) continue
    if (d < bestD) { bestD = d; best = it }
  }
  return best
}

export function promptFor(state, it) {
  if (!it) return null
  if (state.player.hidden) return '[E] Step out of the closet'
  switch (it.kind) {
    case 'drawer': return '[E] Open drawer'
    case 'closet': return '[E] Hide in closet'
    case 'page': return '[E] Take guest-book page'
    case 'rope':
      if (state.hasPass) return '[E] Unclip the velvet rope (use Staff Pass)'
      if (state.inventory.lockpick > 0) return `[E] Pick the rope's clip (🗝️ ${state.inventory.lockpick} left)`
      return 'Roped off — find a Staff Pass in a drawer'
    case 'door': return `[E] Open door ${String(it.num).padStart(3, '0')}`
    case 'shop': return '[E] Shop with Gloria'
    case 'valve': return '[E] Turn the valve'
    case 'brazier': return '[E] Light the brazier 🔥'
    case 'bell': return state.ev.boss?.phase === 'weak' ? '[E] RING THE GARDEN BELL' : null
    case 'giftshelf': return null // a secret: no hint that these do anything
    case 'secretdoor': return state.rooms[it.room].secret?.opened ? '[E] Open the secret door ???' : null
    case 'npc': return `[E] Talk to ${MONSTER_DEFS[it.npc].name}`
    default: return null
  }
}

const SOUVENIRS = [
  'A snow globe of the hotel. It is snowing indoors in there too.',
  'A mug that says "I SURVIVED THE TOTALLY SCARY HOTEL". Bold claim.',
  'A plush werewolf. It sheds. Somehow.',
  'Glow-in-the-dark vampire teeth. Two for one.',
  'A keychain shaped like a tiny door. Cute.',
]

const EMPTY_FINDS = ['Empty. Just a single sock.', 'Empty, except for a very old mint.', 'Nothing but a hotel pen that doesn\'t work.', 'Empty. Someone left a note: "brb".', 'A tiny hotel shampoo. Not useful. Kept it anyway.']

function leaveCloset(state) {
  const p = state.player
  const c = state.rooms[p.room].interactables.find(x => x.id === p.hidden)
  p.hidden = null
  p.hideT = 0
  state.ev.mildred = null
  if (c) {
    const fx = -Math.sin(c.faceYaw), fz = -Math.cos(c.faceYaw)
    p.x = c.x + fx * 0.45; p.z = c.z + fz * 0.45
  }
}

function interact(state) {
  const p = state.player
  const it = state.focus
  if (p.hidden) {
    if (state.ev.mildred?.phase === 'warning') {
      dodged(state, 'mildred')
      setCaption(state, 'Mildred: "Thank you, dear. It\'s a one-skeleton closet."', 3, 'good')
    }
    leaveCloset(state)
    return
  }
  if (!it) return
  if (it.kind === 'drawer') {
    it.opened = true
    if (it.contents === 'spider') {
      triggerCatch(state, 'tim', it.x, it.z)
    } else if (it.contents === 'pass') {
      state.hasPass = true
      setCaption(state, '🎫 You found a Staff Pass! It\'ll get you past a velvet rope.', 3.5, 'good')
    } else if (it.contents && it.contents.coins) {
      state.coins += it.contents.coins
      setCaption(state, `🪙 +${it.contents.coins} tip${it.contents.coins > 1 ? 's' : ''}`, 2, 'good')
    } else {
      setCaption(state, EMPTY_FINDS[Math.floor(state.rng() * EMPTY_FINDS.length)], 2.2)
    }
  } else if (it.kind === 'closet') {
    p.hidden = it.id
    p.hideT = 0
    state.hidCount += 1
    if (it.shortcut) state.ev.shortcut = { t: 1.4, from: it.id }
    p.x = it.insideX; p.z = it.insideZ
    p.yaw = it.faceYaw; p.pitch = 0
  } else if (it.kind === 'page') {
    it.taken = true
    state.pages += 1
    if (state.pages >= PAGES_NEEDED) {
      state.rooms[LIBRARY_ROOM].unlocked = true
      setCaption(state, '📖 All 3 guest-book pages! The rope at the far end of the library drops.', 4, 'good')
    } else {
      setCaption(state, `📖 Guest-book page (${state.pages}/${PAGES_NEEDED})`, 2.5, 'good')
    }
  } else if (it.kind === 'rope') {
    if (state.hasPass) {
      state.hasPass = false
      state.rooms[it.room].unlocked = true
      setCaption(state, 'You unclip the velvet rope. Onward.', 2.5, 'good')
    } else if (state.inventory.lockpick > 0) {
      state.inventory.lockpick -= 1
      state.rooms[it.room].unlocked = true
      setCaption(state, '🗝️ *click* The lockpick pops the rope\'s clip.', 2.5, 'good')
    } else {
      setCaption(state, 'Roped off. There\'s a Staff Pass in one of this room\'s drawers.', 3)
    }
  } else if (it.kind === 'door') {
    it.opened = true
    if (it.real) {
      state.rooms[it.room].unlocked = true
      if (!state.rooms[it.room].interactables.some(d => d.kind === 'door' && !d.real && d.opened)) dodged(state, 'frank')
      setCaption(state, `Door ${String(it.num).padStart(3, '0')} swings open. Right number!`, 2.5, 'good')
    } else {
      triggerCatch(state, 'frank', it.x, it.z)
    }
  } else if (it.kind === 'shop') {
    state.shopOpen = true
  } else if (it.kind === 'giftshelf') {
    const sec = state.rooms[it.room].secret
    if (it.secret) {
      sec.clicks += 1
      it.wobble = (it.wobble || 0) + 1
      if (sec.clicks >= SECRET_CLICKS) {
        sec.opened = true
        setCaption(state, '🤫 *CREEEAK* The whole shelf swings open like a door… and behind it is a SECRET DOOR!', 4.5, 'good')
      } else {
        setCaption(state, sec.clicks === 1 ? '*clunk*… that shelf wobbled. Weird.' : '*CLUNK* There\'s definitely something behind this shelf…', 2.5)
      }
    } else {
      setCaption(state, SOUVENIRS[Math.floor(state.rng() * SOUVENIRS.length)], 2.5)
    }
  } else if (it.kind === 'secretdoor') {
    state.rooms[it.room].secret.doorOpen = true
    encounter(state, state.rooms[it.room].secret.npc)
    setCaption(state, 'The ??? door creaks open. Someone is in there…', 3, 'good')
  } else if (it.kind === 'npc') {
    const sec = state.rooms[it.room].secret
    talkTo(state, it.npc, sec.npcPos.x, sec.npcPos.z, !sec.talked)
    sec.talked = true
  } else if (it.kind === 'brazier') {
    lightBrazier(state, it)
  } else if (it.kind === 'bell') {
    ringBell(state)
  } else if (it.kind === 'valve') {
    it.turned = true
    state.valves += 1
    if (state.valves >= VALVES_NEEDED) {
      state.rooms[it.room].unlocked = true
      setCaption(state, '🔧 All 3 valves turned! The boiler hisses happily and the way on opens.', 4, 'good')
    } else {
      setCaption(state, `🔧 *squeeeak* Valve turned (${state.valves}/${VALVES_NEEDED})`, 2.5, 'good')
    }
  }
}

// ── Shop ────────────────────────────────────────────────────────────────

export function buyItem(state, id) {
  const item = SHOP_ITEMS.find(x => x.id === id)
  if (!item) return false
  if (state.coins < item.price || state.inventory[id] >= item.max) return false
  state.coins -= item.price
  state.inventory[id] += 1
  state.bought += 1
  return true
}

export function closeShop(state) { state.shopOpen = false }

// ── Catches & dialogue ──────────────────────────────────────────────────

export function triggerCatch(state, id, mx, mz) {
  const p = state.player
  // A costume fools its monster once: no catch, the event just ends.
  const costume = SHOP_ITEMS.find(it => it.costume?.includes(id) && state.inventory[it.id] > 0)
  if (costume) {
    state.inventory[costume.id] -= 1
    state.costumeSaves += 1
    dodged(state, id)
    finishCatch(state, id)
    setCaption(state, `${costume.icon} ${COSTUME_LINES[costume.id]}`, 4.5, 'good')
    return
  }
  if (p.hidden) leaveCloset(state)
  let dx = mx - p.x, dz = mz - p.z
  let d = Math.hypot(dx, dz)
  if (d < 0.5) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); d = 1 }
  dx /= d; dz /= d
  const room = state.rooms[p.room]
  const sx = clamp(p.x + dx * 2.1, -room.hw + 0.4, room.hw - 0.4)
  const sz = clamp(p.z + dz * 2.1, room.z1 + 0.4, room.z0 - 0.4)
  state.sitting = { id, x: sx, z: sz, faceYaw: Math.atan2(p.x - sx, p.z - sz) }
  p.yaw = Math.atan2(-(sx - p.x), -(sz - p.z))
  p.pitch = -0.1

  const def = MONSTER_DEFS[id]
  const firstTime = !state.metIds.has(id)
  if (firstTime) state.metIds.add(id)
  state.catchCount += 1
  state.catchesById[id] = (state.catchesById[id] || 0) + 1
  if (state.hardcore && id !== 'nibbles') loseHeart(state) // catching Nibbles is a good thing
  encounter(state, id)
  const lines = def.caughtLines ? [def.caughtLines[Math.floor(state.rng() * def.caughtLines.length)]] : firstTime ? def.lines : [def.repeatLine]
  state.dialogue = { monsterId: id, lines, lineIndex: 0 }
  state.flicker = false
  state.hypno = 0
  state.turnCue = 0
}

// A friendly conversation (secret rooms): same sit-down dialogue as a
// catch, but it isn't a catch — and the first visit pays a reward.
function talkTo(state, id, mx, mz, first) {
  const p = state.player
  const def = MONSTER_DEFS[id]
  state.sitting = { id, x: mx, z: mz, faceYaw: Math.atan2(p.x - mx, p.z - mz) }
  p.yaw = Math.atan2(-(mx - p.x), -(mz - p.z))
  p.pitch = -0.1
  encounter(state, id)
  state.metIds.add(id)
  state.talkedById[id] = (state.talkedById[id] || 0) + 1
  state.dialogue = { monsterId: id, lines: first ? def.lines : [def.repeatLine], lineIndex: 0, reward: first ? SECRET_REWARD : 0, talk: true }
}

function finishCatch(state, id) {
  const ev = state.ev
  if (id === 'barry') { ev.rush = null; state.roomsSinceRush = 0 }
  else if (id === 'steve') ev.screech = null
  else if (id === 'drakko') ev.eyes = null
  else if (id === 'wendell') { ev.halt.phase = 'done'; ev.halt.wendell = null }
  else if (id === 'gary') { if (ev.seek2.phase === 'active') ev.seek2.phase = 'done'; else ev.seek.phase = 'done' }
  else if (id === 'hank') ev.hank = null
  else if (id === 'bernadette') ev.bats = null
  else if (id === 'puff') ev.puff = null
  else if (id === 'shelly' && ev.shelly) { ev.shelly.s = Math.max(0, ev.shelly.s - SHELLY_NAP); ev.shelly.warned = false; setCaption(state, '🐌 Shelly takes a little nap to recover. She\'ll be back…', 3) }
  else if (id === 'coco') ev.coco = null
  else if (id === 'gardener') {
    // it goes dark, and you wake up back at the archway you came in through
    ev.gard = null
    const p = state.player, room = state.rooms[p.room]
    p.x = room.entryX; p.z = room.z0 - 0.8; p.yaw = 0; p.pitch = 0
    setCaption(state, '…you wake up at the garden archway. Your head is full of the smell of roses.', 4, 'warn')
  }
  else if (id === 'lamplighter') {
    ev.lamp = null
    const p = state.player, room = state.rooms[p.room]
    p.x = room.entryX; p.z = room.z0 - 0.8; p.yaw = 0; p.pitch = 0
    state.lightOut = 2.5
    setCaption(state, '…you wake up at the doorway. Your light sputters. You hear a lantern creak, somewhere.', 4, 'warn')
  }
  else if (id === 'harvester' && ev.boss) {
    const b = ev.boss, p = state.player, room = state.rooms[BOSS_ROOM]
    b.hearts = BOSS_HEARTS; b.attack = null; b.cd = 3; b.inv = 2
    b.x = 0; b.z = (room.z0 + room.z1) / 2
    p.x = room.entryX; p.z = room.z0 - 1.2; p.yaw = 0; p.pitch = 0
    setCaption(state, '…the roots drag you back to the courtyard gate. Your braziers are still burning. Try again!', 4, 'warn')
  }
  else if (id === 'marvin') ev.mirror = null
  else if (id === 'nibbles') { if (ev.nibbles) { state.coins += ev.nibbles.stolen + NIBBLES_BONUS; setCaption(state, `🐀 Got your ${ev.nibbles.stolen} tips back, plus ${NIBBLES_BONUS} extra!`, 3, 'good') } ev.nibbles = null }
  else if (id === 'bubbles') ev.bubbles = null
  else if (id === 'wes') ev.wes = null
  else if (id === 'yolanda') ev.cold = null
  else if (id === 'twirl') ev.twirl = null
  else if (id === 'bumpus') ev.bumpus = null
  else if (id === 'doug') { for (const m of state.rooms[state.player.room].mounds || []) if (m.phase === 'rumble') { m.phase = 'cooldown'; m.t = 4 } }
  else if (id === 'reginald' && ev.figure) { ev.figure.rest = FIGURE_REST; ev.figure.mode = 'patrol'; ev.figure.path = [] }
  else if (id === 'doris') { ev.ambush = null; state.roomsSinceRush = 0 }
  else if (id === 'gus') ev.gus = null
  else if (id === 'mildred') ev.mildred = null
}

export function advanceDialogue(state) {
  const dlg = state.dialogue
  if (!dlg) return
  dlg.lineIndex += 1
  if (dlg.lineIndex >= dlg.lines.length) {
    state.dialogue = null
    state.sitting = null
    if (dlg.talk) {
      if (dlg.onDone === 'meet') {
        const room = state.rooms.find(r => r.type === 'meeting')
        room.unlocked = true
        state.ev.meet.phase = 'done'
        dodged(state, 'lamplighter')
        state.metLamplighter = true
        setCaption(state, '🕯️ He nods toward the back of the room. A narrow staircase leads up, out of the dark.', 5, 'good')
        return
      }
      if (dlg.reward) { state.coins += dlg.reward; setCaption(state, `🤫 ${MONSTER_DEFS[dlg.monsterId].name} slips you ${dlg.reward} tips. Secret found!`, 4, 'good') }
      return
    }
    finishCatch(state, dlg.monsterId)
    if (state.hardcore && state.hearts <= 0) state.lost = true
  }
}

function loseHeart(state) {
  state.hearts -= 1
  state.heartsLost = (state.heartsLost || 0) + 1
  state.hurtT = 0.6
}

// ── Events ──────────────────────────────────────────────────────────────

function onEnterRoom(state, idx) {
  const room = state.rooms[idx]
  const ev = state.ev
  if (state.landedQuiet === idx) { state.landedQuiet = null; return } // you tumbled in through a closet; give it a second
  if (room.floor === 4) { gardenEnter(state, idx); return } // out here, there's only him
  if (room.floor === 13) { staffEnter(state, idx); return }
  if (room.floor === -1) { subEnter(state, idx); return }
  state.roomsSinceRush += 1
  const busy = ev.rush || ev.eyes || ev.ambush || ev.gus
  if (room.type === 'normal' && !busy && !QUIET_ROOMS.includes(idx)) {
    const r = state.rng()
    if (idx === FORCE_RUSH_ROOM && !state.metIds.has('barry')) startRush(state, idx)
    else if (idx === FORCE_EYES_ROOM && !ev.eyesSeen) startEyes(state, idx)
    else if (idx === FORCE_GUS_ROOM && !ev.gusSeen) startGus(state, idx)
    else if (idx === FORCE_AMBUSH_ROOM && !ev.ambushSeen) startAmbush(state, idx)
    else {
      // Each entity owns its own slice of the roll, so one being on cooldown
      // doesn't hand its share to the next one down the list.
      const rested = state.roomsSinceRush >= 3
      if (r < 0.2) { if (idx >= 3 && rested) startRush(state, idx) }
      else if (r < 0.29) { if (idx >= 14 && rested) startAmbush(state, idx) }
      else if (r < 0.39) { if (idx >= 5) startEyes(state, idx) }
      else if (r < 0.48) { if (idx >= 12) startGus(state, idx) }
    }
  }
  if (room.floor === 2 && room.type === 'normal' && !QUIET_ROOMS.includes(idx) && !ev.hank && !ev.rush && !ev.ambush) {
    if (idx === FORCE_HANK_ROOM || state.rng() < 0.15) startHank(state, idx)
  }
  if (room.wesWindows && !ev.rush && !ev.ambush && !ev.eyes) startWes(state, idx)
  const anyBusy = ev.rush || ev.ambush || ev.eyes || ev.gus || ev.puff || ev.twirl || ev.bumpus || ev.nibbles || ev.bubbles || ev.cold || ev.wes
  if (room.type === 'normal' && !QUIET_ROOMS.includes(idx) && !anyBusy && !room.dark && !room.lockKind) {
    const r = state.rng()
    if (idx >= 8 && state.coins >= 4 && (r < 0.1 || (idx >= 12 && !ev.nibblesSeen && state.coins >= 6))) startNibbles(state, idx)
    else if (room.floor === 1 && idx >= 6 && (r > 0.9 || (idx === 23 && !ev.bubblesSeen))) startBubbles(state, idx)
    else if (room.floor === 2 && idx >= 58 && (r > 0.88 || (idx === 72 && !ev.coldSeen))) startCold(state, idx)
  }
  const f2busy = ev.nibbles || ev.bubbles || ev.cold || ev.rush || ev.ambush || ev.eyes || ev.gus || ev.puff || ev.twirl || ev.bumpus
  if (room.floor === 2 && room.type === 'normal' && !QUIET_ROOMS.includes(idx) && !f2busy && !room.dark) {
    const r = state.rng()
    if (idx === FORCE_PUFF_ROOM && !ev.puffSeen) startPuff(state, idx)
    else if (idx === FORCE_TWIRL_ROOM && !ev.twirlSeen) startTwirl(state, idx)
    else if (room.theme === 'mine' && idx >= FORCE_BUMPUS_FROM && (!ev.bumpusSeen || r < 0.25)) startBumpus(state, idx)
    else if (room.theme === 'basement' && idx > FORCE_PUFF_ROOM && r < 0.16) startPuff(state, idx)
    else if (idx > FORCE_TWIRL_ROOM && r > 0.86) startTwirl(state, idx)
  }
  if (room.floor === 2 && room.dark && (idx === FORCE_BATS_ROOM || state.rng() < 0.55)) {
    state.screechRooms.add(idx) // the bats scare Pale Steve off
    ev.screech = null
    ev.bats = { phase: 'waiting', room: idx, t: 1.5 + state.rng() * 2 }
  }
  if (idx === FLOOR3_START && state.startFloor === 3) {
    setCaption(state, '🏚️ Floor 3: the attic. Something slow and patient is following you up here… keep moving!', 6, 'warn')
    startShelly(state)
  }
  if (room.floor === 3 && room.type === 'normal' && !QUIET_ROOMS.includes(idx) && !room.dark && !room.lockKind && !ev.coco && !ev.mirror && !ev.rush && !ev.ambush && !ev.eyes && !ev.gus && !ev.nibbles) {
    const r = state.rng()
    if (idx === FORCE_COCO_ROOM || (idx > FORCE_COCO_ROOM && r < 0.16)) startCoco(state, idx)
    else if (idx === FORCE_MIRROR_ROOM || (idx > FORCE_MIRROR_ROOM && r > 0.86)) startMirror(state, idx)
  }
  if (idx === FLOOR2_START) setCaption(state, '🛗 Floor 2: the basement. Mind the ceiling, the dirt mounds, and the dark. (F turns your light off and on.)', 6, 'warn')
  if (room.type === 'boiler') setCaption(state, '🔧 The boiler room. Turn all 3 stuck valves to open the way on.', 5, 'warn')
  if (room.lockKind === 'dupe') encounter(state, 'frank')
  if (room.lockKind === 'dupe') setCaption(state, 'Two doors… only one has the right number on it. Check before you open!', 4.5, 'warn')
  if (room.type === 'shop') setCaption(state, '🛍️ The gift shop! Talk to Gloria at the counter to spend your tips.', 5, 'good')
  if (room.dark && !state.screechRooms.has(idx)) {
    state.screechRooms.add(idx)
    ev.screech = { phase: 'waiting', room: idx, t: 2.5 + state.rng() * 2.5, x: 0, z: 0 }
  }
  if (room.locked && room.lockKind === 'pass') setCaption(state, 'The way forward is roped off. Search the drawers for a Staff Pass.', 4)
  if (room.type === 'library') setCaption(state, 'Shh. A blind knight guards the library — he hunts by sound. Hold SHIFT to sneak, and find 3 guest-book pages.', 7, 'warn')
  if (room.dark && !(ev.rush)) setCaption(state, 'The lights are out in here…', 2.5)
}

function startRush(state, idx) {
  encounter(state, 'barry')
  state.ev.rush = { phase: 'warning', t: W(state, RUSH_WARNING), room: idx, path: null, s: 0, x: 0, z: 0, dirX: 0, dirZ: -1, sawHidden: false }
  state.flicker = true
  setCaption(state, 'The lights are flickering… something is sprinting this way! Hide in a closet!', W(state, RUSH_WARNING), 'warn')
}

function stepRush(state, dt) {
  const rush = state.ev.rush
  if (!rush) return
  const p = state.player
  if (rush.phase === 'warning') {
    rush.t -= dt
    if (rush.t <= 0) {
      const rooms = state.rooms
      const base = p.room
      const a = Math.max(0, base - 1), b = Math.min(rooms.length - 1, base + 1)
      const path = [{ x: rooms[a].entryX, z: rooms[a].z0 - 0.5 }]
      for (let k = a; k <= b; k++) path.push({ x: rooms[k].exitX, z: rooms[k].z1 - T / 2 })
      rush.path = path
      rush.len = polylineLength(path)
      rush.phase = 'running'
      rush.rooms = [a, b]
      state.flicker = false
    }
    return
  }
  rush.s += RUSH_SPEED * dt
  const pos = pointAlong(rush.path, rush.s)
  rush.x = pos.x; rush.z = pos.z; rush.dirX = pos.dirX; rush.dirZ = pos.dirZ
  const barryRoom = roomIndexAt(state.rooms, rush.z)
  if (barryRoom === p.room) {
    if (p.hidden || (state.hardcore && inDoorway(state, p))) rush.sawHidden = true
    else { triggerCatch(state, 'barry', rush.x, rush.z); return }
  }
  if (rush.s >= rush.len) {
    if (rush.sawHidden) {
      dodged(state, 'barry')
      setCaption(state, 'Barry thunders past without seeing you. (He totally saw you. He waved.)', 3.5, 'good')
    }
    state.ev.rush = null
    state.roomsSinceRush = 0
  }
}

function startEyes(state, idx) {
  const room = state.rooms[idx]
  encounter(state, 'drakko')
  state.ev.eyesSeen = true
  if (state.inventory.garlic > 0) {
    state.inventory.garlic -= 1
    dodged(state, 'drakko')
    setCaption(state, '🧄 Drakko floats in, sniffs, and floats right back out. "Is that GARLIC? Ugh. Fine."', 4, 'good')
    return
  }
  state.ev.eyes = { room: idx, x: 0, y: 1.9, z: (room.z0 + room.z1) / 2, look: 0 }
  setCaption(state, "A vampire is floating in here. Whatever you do, don't look into his eyes!", 4, 'warn')
}

// ── Doris: like Barry, but she makes several laps back and forth ──
function startAmbush(state, idx) {
  encounter(state, 'doris')
  state.ev.ambushSeen = true
  state.ev.ambush = { phase: 'warning', t: W(state, AMBUSH_WARNING), room: idx, passes: 3 + Math.floor(state.rng() * 2), pass: 0, s: 0, x: 0, z: 0, dirX: 0, dirZ: -1, sawHidden: false }
  state.flicker = true
  setCaption(state, 'The lights flicker green and a vacuum cleaner is whining somewhere… HIDE, and stay hidden — she makes more than one lap!', W(state, AMBUSH_WARNING), 'warn')
}

function stepAmbush(state, dt) {
  const a = state.ev.ambush
  if (!a) return
  const p = state.player
  if (a.phase === 'warning' || a.phase === 'pause') {
    a.t -= dt
    if (a.t > 0) return
    if (a.phase === 'warning') {
      const rooms = state.rooms
      const lo = Math.max(0, p.room - 1), hi = Math.min(rooms.length - 1, p.room + 1)
      const path = [{ x: rooms[lo].entryX, z: rooms[lo].z0 - 0.5 }]
      for (let k = lo; k <= hi; k++) path.push({ x: rooms[k].exitX, z: rooms[k].z1 - T / 2 })
      a.path = path
      a.len = polylineLength(path)
      state.flicker = false
    }
    a.phase = 'running'
    a.s = 0
    return
  }
  a.s += S(state, AMBUSH_SPEED) * dt
  const fwd = a.pass % 2 === 0
  const pos = pointAlong(a.path, fwd ? a.s : a.len - a.s)
  a.x = pos.x; a.z = pos.z
  a.dirX = fwd ? pos.dirX : -pos.dirX; a.dirZ = fwd ? pos.dirZ : -pos.dirZ
  if (roomIndexAt(state.rooms, a.z) === p.room) {
    if (p.hidden || (state.hardcore && inDoorway(state, p))) a.sawHidden = true
    else { triggerCatch(state, 'doris', a.x, a.z); return }
  }
  if (a.s >= a.len) {
    a.pass += 1
    if (a.pass >= a.passes) {
      if (a.sawHidden) { dodged(state, 'doris'); setCaption(state, 'The vacuum whine fades away. Doris has finished her laps. (Safe to come out!)', 3.5, 'good') }
      state.ev.ambush = null
      state.roomsSinceRush = 0
    } else {
      a.phase = 'pause'
      a.t = AMBUSH_PAUSE
      setCaption(state, '…she\'s turning around. Stay hidden!', AMBUSH_PAUSE + 0.8, 'warn')
    }
  }
}

// ── Gus: a gargoyle that only moves while you're not looking at him ──
function startGus(state, idx) {
  encounter(state, 'gus')
  const room = state.rooms[idx]
  state.ev.gusSeen = true
  const x = (state.rng() * 2 - 1) * (room.hw - 1.6)
  state.ev.gus = { room: idx, x, z: room.z1 + 1.0, faceYaw: 0, moving: false, hiddenT: 0 }
  setCaption(state, "There's a gargoyle statue at the far end of this room… did it just move? Keep your eyes on it!", 4.5, 'warn')
}

function stepGus(state, dt) {
  const gus = state.ev.gus
  if (!gus) return
  const p = state.player
  if (p.room >= gus.room + 2 || p.room < gus.room - 1) { state.ev.gus = null; return }
  gus.moving = false
  if (p.hidden) {
    gus.hiddenT += dt
    if (gus.hiddenT > 3) { state.ev.gus = null; setCaption(state, 'Gus got bored and went back to being a statue somewhere else.', 3, 'good'); dodged(state, 'gus') }
    return
  }
  const watched = Math.abs(p.room - gus.room) <= 1 && lookAngle(p, gus.x, 1.0, gus.z) < GUS_WATCH_ANGLE
  if (watched) return
  const dx = p.x - gus.x, dz = p.z - gus.z, d = Math.hypot(dx, dz)
  if (d < GUS_CATCH) { triggerCatch(state, 'gus', gus.x, gus.z); return }
  const step = S(state, GUS_SPEED) * dt
  const nx = gus.x + dx / d * step, nz = gus.z + dz / d * step
  if (!blocked(state, nx, gus.z, 0.3)) gus.x = nx
  if (!blocked(state, gus.x, nz, 0.3)) gus.z = nz
  gus.faceYaw = Math.atan2(dx, dz)
  gus.moving = true
}

// ── Mildred: stay in a closet too long (or pick hers) and she wants it back ──
function stepMildred(state, dt) {
  const p = state.player
  if (state.rooms[p.room].floor === 4 || state.rooms[p.room].floor === -1) return // nobody else lives in these closets
  if (!p.hidden) { state.ev.mildred = null; return }
  if (state.ev.rush || state.ev.ambush) return // she understands, something's coming
  const closet = state.rooms[p.room].interactables.find(x => x.id === p.hidden)
  p.hideT += dt
  const limit = closet?.occupied ? HIDE_LIMIT_OCCUPIED : HIDE_LIMIT
  if (!state.ev.mildred && p.hideT >= limit) {
    state.ev.mildred = { phase: 'warning', t: W(state, HIDE_WARNING) }
    encounter(state, 'mildred')
    setCaption(state, '*rattle rattle* …someone else is in this closet with you. GET OUT! (E)', W(state, HIDE_WARNING), 'danger')
  }
  const m = state.ev.mildred
  if (m) {
    m.t -= dt
    if (m.t <= 0) {
      const fx = -Math.sin(closet.faceYaw), fz = -Math.cos(closet.faceYaw)
      triggerCatch(state, 'mildred', closet.x + fx * 3, closet.z + fz * 3)
    }
  }
}

function stepEyes(state, dt) {
  const e = state.ev.eyes
  state.hypno = 0
  if (!e) return
  const p = state.player
  if (p.room >= e.room + 2) { state.ev.eyes = null; return }
  const looking = !p.hidden && Math.abs(p.room - e.room) <= 1 && lookAngle(p, e.x, e.y, e.z) < EYES_LOOK_ANGLE
  e.look = looking ? e.look + dt : Math.max(0, e.look - dt * 0.6)
  state.hypno = e.look / W(state, EYES_LOOK_LIMIT)
  if (e.look >= W(state, EYES_LOOK_LIMIT)) triggerCatch(state, 'drakko', e.x, e.z)
}

function stepScreech(state, dt) {
  const sc = state.ev.screech
  if (!sc) return
  const p = state.player
  if (sc.phase === 'waiting') {
    if (p.room !== sc.room) { state.ev.screech = null; return }
    if (p.hidden || state.ev.rush) return
    sc.t -= dt
    if (sc.t > 0) return
    // Pop up somewhere behind the player, inside the room.
    const room = state.rooms[sc.room]
    const offs = [0, 0.6, -0.6, 1.1, -1.1, 1.6, -1.6]
    let spot = null
    for (const o of offs) {
      const a = p.yaw + Math.PI + o
      const x = p.x - Math.sin(a) * 1.8, z = p.z - Math.cos(a) * 1.8
      if (x > -room.hw + 0.4 && x < room.hw - 0.4 && z < room.z0 - 0.4 && z > room.z1 + 0.4 && !blocked(state, x, z, 0.2)) { spot = { x, z }; break }
    }
    if (!spot) spot = { x: clamp(p.x, -room.hw + 0.5, room.hw - 0.5), z: p.z + 1.5 }
    sc.x = spot.x; sc.z = spot.z
    sc.phase = 'active'
    encounter(state, 'steve')
    sc.t = W(state, SCREECH_WINDOW)
    setCaption(state, '*psst*', W(state, SCREECH_WINDOW), 'warn')
    return
  }
  if (p.hidden) { state.ev.screech = null; return }
  if (lookAngle(p, sc.x, 1.5, sc.z) < SCREECH_LOOK_ANGLE) {
    dodged(state, 'steve')
    state.ev.screech = null
    setCaption(state, 'Pale Steve: "Ohh, your light. Thank you. Okay. Good night." *flutter*', 3, 'good')
    return
  }
  sc.t -= dt
  if (sc.t <= 0) triggerCatch(state, 'steve', sc.x, sc.z)
}

function stepHalt(state, dt, prevZ) {
  const h = state.ev.halt
  const p = state.player
  const room = state.rooms[HALT_ROOM]
  if (!room || room.type !== 'halt') return
  if (h.phase === 'idle') {
    if (p.room === HALT_ROOM && p.z < room.z0 - (HALT_WRAP_MARGIN + 0.5)) {
      h.phase = 'active'
      encounter(state, 'wendell')
      setCaption(state, 'This hallway feels… long. Keep walking. If you\'re told to turn around, TURN AROUND.', 4.5, 'warn')
    }
    return
  }
  if (h.phase !== 'active') { state.turnCue = 0; return }

  h.progress = Math.max(0, h.progress + (p.z - prevZ) * h.dir)
  const D = room.len - 2 * HALT_WRAP_MARGIN
  let shift = 0
  if (p.z > room.z0 - HALT_WRAP_MARGIN) shift = -D
  else if (p.z < room.z1 + HALT_WRAP_MARGIN) shift = D
  if (shift) { p.z += shift; if (h.wendell) h.wendell.z += shift }

  if (h.progress >= HALT_GOAL && h.dir === -1) {
    h.phase = 'done'
    h.wendell = null
    dodged(state, 'wendell')
    setCaption(state, 'Wendell: "Fine, fine. Go on ahead. My elbows need ice."', 3.5, 'good')
    return
  }
  if (h.progress >= h.nextCue) {
    h.nextCue += HALT_CUE_EVERY
    h.wendell = { x: 0, z: p.z + h.dir * 5.5, t: 0 }
    h.dir = -h.dir
    state.turnCue = 1.8
  }
  const w = h.wendell
  if (w) {
    w.t += dt
    const dz = p.z - w.z
    w.z += Math.sign(dz) * S(state, HALT_SPEED) * dt
    w.x = p.x * 0.5
    if (Math.abs(p.z - w.z) < 1.0) { triggerCatch(state, 'wendell', w.x, w.z); return }
    if (w.t > 4) h.wendell = null
  }
}

function stepSeek(state, dt, sk, chaseRooms) {
  const p = state.player
  const rooms = state.rooms
  const first = rooms[chaseRooms[0]], last = rooms[chaseRooms[chaseRooms.length - 1]]
  const cart = chaseRooms === CHASE2_ROOMS
  if (!first || first.type !== 'chase') return
  if (sk.phase === 'idle') {
    if (p.room === first.index && p.z < first.z0 - 1.5) {
      const before = rooms[first.index - 1]
      const path = [{ x: (before.entryX + before.exitX) / 2, z: (before.z0 + before.z1) / 2 }, { x: before.exitX, z: before.z1 - T / 2 }]
      for (const i of chaseRooms) {
        path.push(...rooms[i].path)
        path.push({ x: rooms[i].exitX, z: rooms[i].z1 - T / 2 })
      }
      sk.path = path
      sk.len = polylineLength(path)
      sk.s = 0
      sk.phase = 'active'
      encounter(state, 'gary')
      setCaption(state, cart ? 'RUN!! Gary found a MINECART and he is coming for you!' : 'RUN!! Gary the zombie is chasing you!', 3.5, 'danger')
    }
    return
  }
  if (sk.phase !== 'active') return
  sk.s = Math.min(sk.len, sk.s + Math.min(WALK_SPEED * 0.97, S(state, SEEK_SPEED) * (cart ? 1.08 : 1)) * dt)
  const pos = pointAlong(sk.path, sk.s)
  sk.x = pos.x; sk.z = pos.z; sk.dirX = pos.dirX; sk.dirZ = pos.dirZ
  if (Math.hypot(sk.x - p.x, sk.z - p.z) < SEEK_CATCH) { triggerCatch(state, 'gary', sk.x, sk.z); return }
  if (p.z < last.z1 - T - 0.5) {
    sk.phase = 'done'
    dodged(state, 'gary')
    setCaption(state, cart
      ? 'Gary\'s minecart runs out of track. "Okay, that was actually really fun. Go on ahead."'
      : 'Gary stops to rest his knee. "Go on ahead… I\'ll catch up… (I won\'t.)"', 4, 'good')
  }
}

// ── The elevator down to Floor 2 ──
function stepElevator(state, dt) {
  const el = state.ev.elevator
  const room = state.rooms[state.elevatorRoom]
  const up = state.elevatorRoom === FLOOR3_ELEVATOR
  const garden = state.elevatorRoom === FLOOR4_ELEVATOR
  const staff = state.startFloor === 13
  const sub = state.startFloor === -1
  const p = state.player
  if (el.phase === 'idle') {
    if (p.room === state.elevatorRoom && p.z < room.z0 - 0.8) {
      el.phase = 'ride'
      el.t = ELEVATOR_RIDE
      room.backClosed = true
      if (sub) { setCaption(state, '🛗 Going DOWN. Past the basement. Past the mines. Past where the buttons stop.', ELEVATOR_RIDE, 'danger'); return }
      if (staff) { setCaption(state, "🛗 The doors close. There's no button lit. The elevator goes… sideways?", ELEVATOR_RIDE, 'danger'); return }
      setCaption(state, garden ? '🛗 The service lift creaks down to the grounds. It smells like cut grass… and something else.' : `🛗 *ding* The doors close behind you… going ${up ? 'UP' : 'DOWN'}.`, ELEVATOR_RIDE, 'warn')
    }
    return
  }
  if (el.phase === 'ride') {
    el.t -= dt
    if (el.t <= 0) {
      el.phase = 'arrived'
      room.unlocked = true
      if (sub) { setCaption(state, '🛗 …Floor -A0001. The elevator light goes out as the doors open.', 4, 'danger'); return }
      if (staff) { setCaption(state, '🛗 Floor 13. The Staff Wing. STAFF ONLY. (There are no closets here. You have 3 hearts.)', 5, 'danger'); return }
      setCaption(state, garden ? '🛗 …the doors open onto the garden. It is very quiet out here.' : up ? '🛗 *ding* Floor 3: the attic.' : '🛗 *ding* Floor 2.', 3, garden ? 'warn' : 'good')
    }
  }
}

// ── Hank: hangs from the ceiling, drops on anyone who walks right under him ──
function startHank(state, idx) {
  encounter(state, 'hank')
  const room = state.rooms[idx]
  const t = 0.35 + state.rng() * 0.3
  state.ev.hank = { room: idx, x: room.entryX + (room.exitX - room.entryX) * t, z: room.z0 + (room.z1 - room.z0) * t }
  setCaption(state, '*hee hee hee*… something is giggling up on the ceiling. Look up, and don\'t walk under it!', 4.5, 'warn')
}

function stepHank(state) {
  const h = state.ev.hank
  if (!h) return
  const p = state.player
  if (p.room > h.room + 1) { state.ev.hank = null; return }
  if (!p.hidden && Math.hypot(p.x - h.x, p.z - h.z) < HANK_DROP_RADIUS) triggerCatch(state, 'hank', h.x, h.z)
}

// ── Doug: rumbling dirt mounds in the mines ──
function stepDoug(state, dt) {
  const p = state.player
  const room = state.rooms[p.room]
  if (!room.mounds) return
  for (const m of room.mounds) {
    const d = Math.hypot(p.x - m.x, p.z - m.z)
    if (m.phase === 'cooldown') { m.t -= dt; if (m.t <= 0) m.phase = 'idle'; continue }
    if (m.phase === 'idle') {
      if (d < DOUG_TRIGGER) {
        m.phase = 'rumble'; m.t = W(state, DOUG_RUMBLE)
        encounter(state, 'doug')
        setCaption(state, 'The ground is RUMBLING under you! Step off the dirt!', W(state, DOUG_RUMBLE) + 0.5, 'danger')
      }
      continue
    }
    m.t -= dt
    if (m.t > 0) continue
    if (d < DOUG_CATCH && !p.hidden) { triggerCatch(state, 'doug', m.x, m.z); return }
    m.phase = 'cooldown'; m.t = 4
    dodged(state, 'doug')
    setCaption(state, 'A big worm pokes out, looks around, and goes back down. Phew.', 2.5, 'good')
  }
}

// ── Puff: steam blasts through the room at head height — duck! ──
function startPuff(state, idx) {
  encounter(state, 'puff')
  state.ev.puffSeen = true
  state.ev.puff = { phase: 'warning', t: W(state, PUFF_WARNING), room: idx, s: 0 }
  setCaption(state, '🫖 The pipes are HISSING… steam is coming! DUCK! (hold Shift)', W(state, PUFF_WARNING), 'danger')
}

function stepPuff(state, dt) {
  const pf = state.ev.puff
  if (!pf) return
  const p = state.player
  pf.t -= dt
  if (pf.phase === 'warning') {
    if (pf.t <= 0) { pf.phase = 'blast'; pf.t = PUFF_BLAST; pf.room = p.room } // it blasts through wherever you are now
    return
  }
  pf.s = 1 - pf.t / PUFF_BLAST // 0→1 progress of the steam cloud through the room
  if (p.room === pf.room && !p.sneaking && !p.hidden) {
    const room = state.rooms[pf.room]
    const cz = room.z0 + (room.z1 - room.z0) * pf.s
    if (Math.abs(cz - p.z) < 1.6) { triggerCatch(state, 'puff', p.x, cz); return }
  }
  if (pf.t <= 0) {
    state.ev.puff = null
    if (p.room === pf.room) { dodged(state, 'puff'); setCaption(state, 'The steam whooshes right over your head. Puff: "Oh, good ducking, dear!"', 3, 'good') }
  }
}

// ── Madame Twirl: freeze while the music box plays ──
function startTwirl(state, idx) {
  const room = state.rooms[idx]
  encounter(state, 'twirl')
  state.ev.twirlSeen = true
  state.ev.twirl = { phase: 'wind', t: W(state, TWIRL_WIND), room: idx, x: (room.entryX + room.exitX) / 2, z: room.z1 + 1.3, rounds: 2 }
  setCaption(state, '🩰 *click click click* A music box is winding up… when the music plays, FREEZE!', W(state, TWIRL_WIND), 'warn')
}

function stepTwirl(state, dt) {
  const tw = state.ev.twirl
  if (!tw) return
  const p = state.player
  if (p.room > tw.room + 1) { state.ev.twirl = null; return }
  tw.t -= dt
  if (tw.phase === 'wind') {
    if (tw.t <= 0) { tw.phase = 'dance'; tw.t = TWIRL_DANCE; setCaption(state, '🎶 FREEZE! Don\'t move until the music stops! 🎶', TWIRL_DANCE, 'danger') }
    return
  }
  if (tw.phase === 'dance') {
    if (p.moving && !p.hidden && Math.abs(p.room - tw.room) <= 1) { triggerCatch(state, 'twirl', tw.x, tw.z); return }
    if (tw.t <= 0) {
      tw.rounds -= 1
      if (tw.rounds > 0) { tw.phase = 'rest'; tw.t = 2.2 + state.rng() * 1.5; setCaption(state, 'The music stops. Move! (She might dance again…)', 2, 'good') }
      else {
        state.ev.twirl = null
        dodged(state, 'twirl')
        setCaption(state, 'Madame Twirl curtsies. "Bravo! What a perfectly still audience." She clicks shut.', 3.5, 'good')
      }
    }
    return
  }
  if (tw.phase === 'rest' && tw.t <= 0) { tw.phase = 'wind'; tw.t = 1.2; setCaption(state, '*click click*… she\'s winding up again!', 1.2, 'warn') }
}

// ── Bumpus: a runaway minecart down the middle of a mine tunnel ──
function startBumpus(state, idx) {
  encounter(state, 'bumpus')
  state.ev.bumpusSeen = true
  const room = state.rooms[idx]
  state.ev.bumpus = { phase: 'warning', t: W(state, BUMPUS_WARNING), room: idx, z: room.z1, dir: 1 }
  setCaption(state, '🛒 HONK HONK! Something is rolling down the tracks — get OFF the rails!', W(state, BUMPUS_WARNING), 'danger')
}

function stepBumpus(state, dt) {
  const b = state.ev.bumpus
  if (!b) return
  const p = state.player
  const room = state.rooms[b.room]
  if (b.phase === 'warning') {
    b.t -= dt
    if (b.t <= 0) { b.phase = 'run'; b.z = room.z1 - 0.5 }
    return
  }
  // rolls from the far end of the tunnel back toward the entrance (toward the player)
  b.z += BUMPUS_SPEED * dt
  if (p.room === b.room && !p.hidden && Math.abs(p.x) < RAIL_HALF && Math.abs(b.z - p.z) < 0.9) { triggerCatch(state, 'bumpus', 0, b.z); return }
  if (b.z > room.z0 + 0.5) {
    state.ev.bumpus = null
    if (p.room === b.room) { dodged(state, 'bumpus'); setCaption(state, 'WHOOSH! The minecart rattles past. "Thanks for moving! No brakes!"', 3, 'good') }
  }
}

// ── Nibbles: snatches your tips and runs — this time YOU chase HIM ──
function startNibbles(state, idx) {
  const p = state.player
  const room = state.rooms[idx]
  encounter(state, 'nibbles')
  state.ev.nibblesSeen = true
  const stolen = Math.min(state.coins, 4 + Math.floor(state.rng() * 5))
  state.coins -= stolen
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
  const x = clamp(p.x + fx * 1.6 + fz * 0.8, -room.hw + 0.5, room.hw - 0.5)
  const z = clamp(p.z + fz * 1.6, room.z1 + 0.6, room.z0 - 0.6)
  state.ev.nibbles = { room: idx, x, z, t: NIBBLES_TIME, stolen, faceYaw: 0, jig: state.rng() * 6 }
  setCaption(state, `🐀 A RAT just grabbed ${stolen} of your tips! CATCH HIM before he gets away!`, 3.5, 'danger')
}

function stepNibbles(state, dt) {
  const n = state.ev.nibbles
  if (!n) return
  const p = state.player
  const room = state.rooms[n.room]
  n.t -= dt
  const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz) || 1
  if (!p.hidden && d < 0.85) { triggerCatch(state, 'nibbles', n.x, n.z); return }
  if (n.t <= 0 || p.room !== n.room) {
    state.ev.nibbles = null
    setCaption(state, `🐀 Nibbles squeezes into a mousehole with your ${n.stolen} tips. "Thanks! For the cheese shop!"`, 3.5)
    return
  }
  // flee directly away from you, with a little zig-zag, sliding along walls
  n.jig += dt * 7
  let mx = dx / d + Math.cos(n.jig) * 0.35, mz = dz / d + Math.sin(n.jig) * 0.35
  const ml = Math.hypot(mx, mz) || 1
  const step = S(state, NIBBLES_SPEED) * dt
  const nx = clamp(n.x + mx / ml * step, -room.hw + 0.35, room.hw - 0.35)
  const nz = clamp(n.z + mz / ml * step, room.z1 + 0.35, room.z0 - 0.35)
  if (!blocked(state, nx, n.z, 0.2)) n.x = nx
  if (!blocked(state, n.x, nz, 0.2)) n.z = nz
  n.faceYaw = Math.atan2(mx, mz)
}

// ── Bubbles: pop his balloon (look at it + click/E) before it goes BANG ──
// ── Window Wes: the face in the window ────────────────────────────────
// Some Floor 1 / attic rooms get four windows (decided once, from the seed,
// with its own rng so the rest of the hotel is unchanged). Entering one, a
// silhouette pops up in a window; look straight at it and it ducks, then
// pops up in another. Spot it WES_POPS times. Miss one and he climbs in.
function addWesWindows(rooms, seed) {
  const rng = mulberry32((seed ^ 0x5eed5) >>> 0)
  let n = 0
  for (const room of rooms) {
    if (n >= 4) break // a few per stay is plenty
    if (room.type !== 'normal' || room.dark || room.lockKind || QUIET_ROOMS.includes(room.index)) continue
    if ((room.floor !== 1 && room.floor !== 3) || room.index < 7 || room.len < 6) continue
    if (rng() > WES_CHANCE) continue
    room.wesWindows = []
    n++
    for (const side of [-1, 1]) for (const f of [0.38, 0.68]) room.wesWindows.push({ x: side * (room.hw - 0.03), z: room.z0 - room.len * f, side })
  }
}

function startWes(state, idx) {
  state.ev.wes = { room: idx, phase: 'waiting', t: 1.4, cur: -1, pops: 0 }
  encounter(state, 'wes')
  setCaption(state, '🪟 Windows… and someone is watching you through one. Look straight at the face each time it appears!', 4.5, 'warn')
}

function stepWes(state, dt) {
  const w = state.ev.wes
  if (!w) return
  const p = state.player
  const room = state.rooms[w.room]
  if (p.room !== w.room) {
    // walked out while he was watching? He saw you leave without noticing him.
    if (w.phase === 'watching' && !p.hidden) { const s = room.wesWindows[w.cur]; triggerCatch(state, 'wes', s.x - s.side * 0.9, s.z); return }
    state.ev.wes = null // otherwise he goes back to his squeegee
    return
  }
  if (p.hidden || state.dialogue) return
  w.t -= dt
  if (w.phase === 'waiting') {
    if (w.t > 0) return
    // pop up in a different window — preferably one you're not already looking at
    const opts = room.wesWindows.map((s, k) => k).filter(k => k !== w.cur)
    opts.sort((a, b) => lookAngle(p, room.wesWindows[b].x, 1.75, room.wesWindows[b].z) - lookAngle(p, room.wesWindows[a].x, 1.75, room.wesWindows[a].z))
    w.cur = opts[Math.floor(state.rng() * Math.min(2, opts.length))]
    w.phase = 'watching'
    w.t = W(state, WES_WINDOW)
    return
  }
  const s = room.wesWindows[w.cur]
  if (lookAngle(p, s.x, 1.75, s.z) < WES_LOOK_ANGLE) {
    w.pops += 1
    if (w.pops >= WES_POPS) {
      dodged(state, 'wes')
      state.ev.wes = null
      setCaption(state, 'Window Wes: "You noticed! Every time! Nobody ever notices the windows." *squeak squeak*', 3.5, 'good')
      return
    }
    w.phase = 'waiting'
    w.t = 0.5 + state.rng() * 0.9
    setCaption(state, w.pops === 1 ? 'It ducked! …where did it go?' : 'Once more…', 1.5, 'warn')
    return
  }
  if (w.t <= 0) triggerCatch(state, 'wes', s.x - s.side * 0.9, s.z)
}

function startBubbles(state, idx) {
  const room = state.rooms[idx]
  encounter(state, 'bubbles')
  state.ev.bubblesSeen = true
  state.ev.bubbles = { room: idx, x: (room.entryX + room.exitX) / 2, z: room.z1 + 1.5, t: W(state, BUBBLES_TIME) }
  setCaption(state, '🎈 *fwoo… fwoo…* A clown is blowing up a balloon! Look at it and CLICK to pop it before it bursts!', 4, 'warn')
}

function stepBubbles(state, dt, input) {
  const b = state.ev.bubbles
  if (!b) return
  const p = state.player
  if (p.room > b.room + 1) { state.ev.bubbles = null; return }
  b.t -= dt
  // he drifts toward you as the balloon grows
  const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1
  if (d > 2.5) { b.x += dx / d * 0.7 * dt; b.z += dz / d * 0.7 * dt }
  b.size = clamp(1 - b.t / W(state, BUBBLES_TIME), 0, 1)
  const by = 2.1 + b.size * 0.3
  if (input.interact && !p.hidden && d < BUBBLES_POP_RANGE && lookAngle(p, b.x, by, b.z) < BUBBLES_POP_ANGLE + b.size * 0.15) {
    input.interact = false // the click was used up on the balloon
    state.ev.bubbles = null
    dodged(state, 'bubbles')
    setCaption(state, '🎈 *POP!* Bubbles giggles. "Oh, nice shot!" and floats away to find another balloon.', 3, 'good')
    state.popped = (state.popped || 0) + 1
    return
  }
  if (b.t <= 0) triggerCatch(state, 'bubbles', b.x, b.z)
}

// ── Yolanda: the room freezes — keep moving or become a popsicle ──
function startCold(state, idx) {
  encounter(state, 'yolanda')
  state.ev.coldSeen = true
  state.ev.cold = { room: idx, t: COLD_TIME, still: 0 }
  setCaption(state, '🧊 Brrrr! The room is FREEZING over! KEEP MOVING or you\'ll turn into a popsicle!', 3.5, 'danger')
}

function stepCold(state, dt) {
  const c = state.ev.cold
  if (!c) return
  const p = state.player
  c.t -= dt
  c.still = p.moving && !p.hidden ? Math.max(0, c.still - dt * 1.5) : c.still + dt
  state.frost = Math.min(1, c.still / W(state, COLD_FREEZE))
  if (c.still >= W(state, COLD_FREEZE)) {
    state.frost = 0
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
    triggerCatch(state, 'yolanda', p.x + fx * 2, p.z + fz * 2)
    return
  }
  if (c.t <= 0) {
    state.ev.cold = null
    state.frost = 0
    dodged(state, 'yolanda')
    setCaption(state, '🧊 The frost melts away. Somewhere, a yeti sighs. "Good wiggling!"', 3, 'good')
  }
}

// ── Shelly: a snail who follows the whole length of the attic, never stopping ──
function startShelly(state) {
  const rooms = state.rooms
  const path = []
  const staff = state.startFloor === 13
  for (let k = staff ? 0 : FLOOR3_ELEVATOR; k < rooms.length - (staff ? 2 : 0); k++) {
    const r = rooms[k]
    path.push({ x: r.entryX, z: r.z0 - 0.3 }, { x: r.exitX, z: r.z1 - T / 2 })
  }
  encounter(state, 'shelly')
  state.ev.shelly = { path, len: polylineLength(path), s: 0, x: path[0].x, z: path[0].z, dirX: 0, dirZ: -1, warned: false }
}

function stepShelly(state, dt) {
  const sh = state.ev.shelly
  if (!sh) return
  const p = state.player
  sh.s = Math.min(sh.len, sh.s + S(state, SHELLY_SPEED) * dt)
  const pos = pointAlong(sh.path, sh.s)
  sh.x = pos.x; sh.z = pos.z; sh.dirX = pos.dirX; sh.dirZ = pos.dirZ
  const d = Math.hypot(sh.x - p.x, sh.z - p.z)
  if (d < 6 && !sh.warned) { sh.warned = true; setCaption(state, '🐌 *squelch… squelch…* Shelly is catching up! Keep moving!', 3, 'danger') }
  if (d > 10) sh.warned = false
  if (d < 0.9 && !p.hidden) triggerCatch(state, 'shelly', sh.x, sh.z)
}

// ── Coco: the cuckoo clock strikes — be standing in a doorway ──
function startCoco(state, idx) {
  const room = state.rooms[idx]
  encounter(state, 'coco')
  state.ev.coco = { room: idx, t: W(state, COCO_TIME), x: (room.entryX + room.exitX) / 2 > 0 ? -room.hw + 0.05 : room.hw - 0.05, z: (room.z0 + room.z1) / 2 }
  setCaption(state, '🕰️ *tick… tock…* A cuckoo clock is about to strike! Get into a DOORWAY!', 4, 'warn')
}

export function inDoorway(state, p) {
  const room = state.rooms[p.room]
  const near = (gx, wallZ) => Math.abs(p.x - gx) < GAP_HALF + 0.15 && Math.abs(p.z - wallZ) < 0.95
  if (near(room.exitX, room.z1 - T / 2)) return true
  if (room.index > 0 && near(room.entryX, room.z0 + T / 2)) return true
  return false
}

function stepCoco(state, dt) {
  const c = state.ev.coco
  if (!c) return
  const p = state.player
  c.t -= dt // the chime carries through the whole attic — walking off doesn't help
  if (c.t > 0) return
  if (inDoorway(state, p)) {
    state.ev.coco = null
    dodged(state, 'coco')
    setCaption(state, '🕰️ CUCKOO! …from somewhere far away. You were safe in the doorway!', 3, 'good')
  } else {
    triggerCatch(state, 'coco', c.x, c.z)
  }
}

// ── Mirror Marvin: walk backwards through his room or he copies you into a bump ──
function startMirror(state, idx) {
  const room = state.rooms[idx]
  encounter(state, 'marvin')
  const side = state.rng() < 0.5 ? -1 : 1
  state.ev.mirror = { room: idx, grace: W(state, MIRROR_GRACE), x: side * (room.hw - 0.3), z: (room.z0 + room.z1) / 2, side }
  setCaption(state, "🪞 A tall mirror… and the reflection isn't yours. Mirror Marvin copies everything — walk BACKWARDS (S) through this room!", 5, 'warn')
}

function stepMirror(state, dt, input) {
  const m = state.ev.mirror
  if (!m) return
  const p = state.player
  if (p.room > m.room) { state.ev.mirror = null; dodged(state, 'marvin'); setCaption(state, '🪞 Marvin gets all twisted up and waves you off. "Backwards?! Not fair!"', 3, 'good'); return }
  if (p.room !== m.room) return
  if (m.grace > 0) { m.grace -= dt; return }
  if (input.forward && p.moving && !p.hidden) triggerCatch(state, 'marvin', m.x, m.z)
}

// ── Shortcut closets: fall through the back wall into a closet a few doors on ──
function shortcutTarget(state, fromIdx) {
  const rooms = state.rooms
  const from = rooms[fromIdx]
  const ok = []
  for (let k = fromIdx + 2; k <= fromIdx + 5 && k < rooms.length - 1; k++) {
    const r = rooms[k]
    if (r.floor !== from.floor) break // never skip an elevator
    if (r.type !== 'normal' && r.type !== 'garden') continue
    const c = r.interactables.find(i => i.kind === 'closet' && !i.occupied)
    if (c) ok.push(c)
  }
  return ok.length ? ok[Math.floor(state.rng() * ok.length)] : null
}

function stepShortcut(state, dt) {
  const sc = state.ev.shortcut
  if (!sc) return
  const p = state.player
  if (p.hidden !== sc.from) { state.ev.shortcut = null; return } // stepped out in time
  sc.t -= dt
  if (sc.t > 0) return
  state.ev.shortcut = null
  const target = shortcutTarget(state, p.room)
  if (!target) return
  // the doors in between count as passed, quietly — nothing in them wakes up
  state.maxRoom = Math.max(state.maxRoom, target.room - 1)
  p.hidden = target.id
  p.hideT = 0
  p.x = target.insideX; p.z = target.insideZ
  p.yaw = target.faceYaw; p.pitch = 0
  p.room = target.room
  state.shortcuts = (state.shortcuts || 0) + 1
  state.landedQuiet = target.room
  setCaption(state, `😮 You lean back… the back wall gives way… and you tumble out somewhere else! Door ${String(target.room).padStart(3, '0')}!`, 4.5, 'good')
}

// ── The Gardener: one man, a different trick every time ─────────────────

function gardenEnter(state, idx) {
  const room = state.rooms[idx]
  if (idx === FLOOR4_START) setCaption(state, "🌙 The garden. There's only one person who works out here. He knows you're here.", 6, 'warn')
  if (room.type === 'boss') { startBoss(state, idx); return }
  if (room.type === 'overgrown') {
    setCaption(state, '…everyone is here. Every single one of them. Sitting in rows, covered in vines, glowing faintly. Nobody moves. Nobody says a word.', 8, 'warn')
    return
  }
  if (room.type !== 'garden' || state.ev.gard) return
  if (idx === FLOOR4_START + 1 || (idx - state.lastGardRoom >= 3 && state.rng() < 0.55)) startGardener(state, idx)
}

function nextMood(state) {
  if (!state.gardBag.length) {
    const bag = GARDENER_MOODS.slice()
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(state.rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]] }
    if (bag[0] === state.lastGardMood) bag.push(bag.shift())
    state.gardBag = bag
  }
  state.lastGardMood = state.gardBag.shift()
  return state.lastGardMood
}

export function startGardener(state, idx, mood = nextMood(state)) {
  const room = state.rooms[idx]
  const p = state.player
  const mid = (room.z0 + room.z1) / 2
  const far = { x: (room.entryX + room.exitX) / 2, z: room.z1 + 1.4 }
  state.lastGardRoom = idx
  encounter(state, 'gardener')
  const g = { mood, room: idx, x: far.x, z: far.z, faceYaw: 0, t: 0, phase: 'on', moving: false }
  if (mood === 'prune') {
    const side = state.rng() < 0.5 ? -1 : 1
    g.x = side * (room.hw - 0.8); g.z = mid; g.faceYaw = side * Math.PI / 2; g.heard = false
    setCaption(state, '✂️ *snip… snip…* The Gardener is trimming a hedge with his back to you. SNEAK past him (hold Shift).', 5, 'warn')
  } else if (mood === 'watch') {
    // off to one side of the far archway, so you can get past without brushing him
    g.x = clamp(room.exitX + (room.exitX > 0 ? -2.4 : 2.4), -room.hw + 0.6, room.hw - 0.6)
    setCaption(state, "👁️ He's standing at the far end, just… staring. He only moves while you LOOK at him. Don't look.", 5, 'warn')
  } else if (mood === 'chase') {
    g.x = room.entryX; g.z = room.z0 + 0.6; g.phase = 'warn'; g.t = W(state, 3.5); g.hiddenT = 0; g.total = 0
    setCaption(state, "*snip… snip…* …it's coming from BEHIND you. He has the sickle out. HIDE in a garden shed!", 4, 'danger')
  } else if (mood === 'scarecrows') {
    const lim = room.hw - 1.5
    // spread through the middle of the room, well clear of both archways
    g.crows = [0.3, 0.43, 0.57, 0.7].map((f, k) => ({ x: (k % 2 ? 1 : -1) * (0.8 + state.rng() * Math.max(0, lim - 0.8)), z: room.z0 - room.len * f, yaw: 0 }))
    const ok = g.crows.map((c, k) => k).filter(k => {
      const c = g.crows[k]
      return Math.hypot(c.x - room.entryX, c.z - room.z0) > 3 && Math.hypot(c.x - room.exitX, c.z - room.z1) > 3
    })
    g.real = ok.length ? ok[Math.floor(state.rng() * ok.length)] : 1
    setCaption(state, "🌾 Four scarecrows. One of them is him. Watch for the one that turns its head… and don't get close to it.", 5.5, 'warn')
  } else if (mood === 'mower') {
    g.pass = 0; g.phase = 'warn'; g.t = W(state, 2.2); g.lane = clamp(p.x, -room.hw + 0.8, room.hw - 0.8); g.z = room.z1 - 0.5
    setCaption(state, '🚜 *VRRRMMM* A lawnmower is coming down the glowing lane! Get OUT of the stripe!', 3.5, 'danger')
  } else if (mood === 'whisper') {
    const a = p.yaw
    g.x = clamp(p.x + Math.sin(a) * 2.6, -room.hw + 0.5, room.hw - 0.5); g.z = clamp(p.z + Math.cos(a) * 2.6, room.z1 + 0.5, room.z0 - 0.5)
    g.t = W(state, GARD_WHISPER_TIME)
    setCaption(state, "*whisper* …psst… I'm right behind you… turn around… (DON'T.)", 4, 'danger')
  } else if (mood === 'wave') {
    g.away = 0
    setCaption(state, '…someone is waving at you from the far end of the garden.', 3)
  }
  state.ev.gard = g
}

function gardDone(state, msg, dodge = true) {
  state.ev.gard = null
  if (dodge) dodged(state, 'gardener')
  if (msg) setCaption(state, msg, 3.5, dodge ? 'good' : 'info')
}

function moveToward(state, g, tx, tz, speed, dt) {
  const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz)
  if (d < 0.01) return d
  const st = Math.min(d, speed * dt)
  g.x += dx / d * st; g.z += dz / d * st
  g.faceYaw = Math.atan2(dx, dz)
  g.moving = true
  return d
}

function stepGardener(state, dt) {
  const g = state.ev.gard
  if (!g) return
  const p = state.player
  const room = state.rooms[g.room]
  const d = Math.hypot(p.x - g.x, p.z - g.z)
  g.moving = false
  const catchIf = (cond) => { if (cond && !p.hidden) { triggerCatch(state, 'gardener', g.x, g.z); return true } return false }
  const leftRoom = p.room > g.room

  switch (g.mood) {
    case 'prune': {
      if (!g.heard) {
        const hearR = (p.sneaking ? GARD_HEAR_SNEAK : GARD_HEAR_WALK) * (state.inventory.sneakers ? 0.5 : 1)
        if (p.moving && !p.hidden && p.room === g.room && d < hearR) { g.heard = true; setCaption(state, '✂️ The snipping stops. He heard you. He is turning around…', 2.5, 'danger') }
      } else if (p.room === g.room) moveToward(state, g, p.x, p.z, S(state, GARD_CHASE_SPEED) * 0.9, dt)
      if (catchIf(d < 1.0)) return
      if (leftRoom) gardDone(state, g.heard ? 'You made it out of the hedge room. Behind you, the snipping starts again.' : 'He never looked up. *snip… snip…*')
      return
    }
    case 'watch': {
      const looking = !p.hidden && Math.abs(p.room - g.room) <= 1 && lookAngle(p, g.x, 1.6, g.z) < 0.6
      if (looking) moveToward(state, g, p.x, p.z, S(state, GARD_WATCH_SPEED), dt)
      else g.faceYaw = Math.atan2(p.x - g.x, p.z - g.z)
      if (catchIf(d < 0.9)) return
      if (leftRoom) gardDone(state, 'You walk past without looking. You can feel him watching you go.')
      return
    }
    case 'chase': {
      if (g.phase === 'warn') { g.t -= dt; if (g.t <= 0) g.phase = 'run'; return }
      g.total += dt
      if (p.hidden) {
        g.hiddenT += dt
        if (d > 2.2) moveToward(state, g, p.x, p.z, S(state, GARD_CHASE_SPEED) * 0.6, dt)
        if (g.hiddenT >= W(state, GARD_HIDE_GIVEUP)) { gardDone(state, 'He stands outside the shed for a long time. Then the footsteps walk away.'); return }
        return
      }
      g.hiddenT = 0
      // follow you through the archways, room to room
      const gr = roomIndexAt(state.rooms, g.z)
      let tx = p.x, tz = p.z
      if (gr < p.room) { const r = state.rooms[gr]; tx = r.exitX; tz = r.z1 - T - 0.4 }
      else if (gr > p.room) { const r = state.rooms[gr]; tx = r.entryX; tz = r.z0 + 0.4 }
      moveToward(state, g, tx, tz, S(state, GARD_CHASE_SPEED), dt)
      if (catchIf(d < 1.0)) return
      if (g.total > 30) gardDone(state, "The footsteps stop. He's… gone. For now.")
      return
    }
    case 'scarecrows': {
      for (const c of g.crows) c.yaw = 0
      const real = g.crows[g.real]
      real.yaw = Math.atan2(p.x - real.x, p.z - real.z) // the real one turns to follow you
      g.x = real.x; g.z = real.z
      if (p.room === g.room && catchIf(Math.hypot(p.x - real.x, p.z - real.z) < 1.3)) return
      if (leftRoom) gardDone(state, "You got past the scarecrows. One of them is still turning to watch you leave.")
      return
    }
    case 'mower': {
      if (g.phase === 'warn') { g.t -= dt; if (g.t <= 0) { g.phase = 'run'; g.z = room.z1 - 0.5 } return }
      g.z += S(state, GARD_MOWER_SPEED) * dt
      g.x = g.lane; g.faceYaw = 0; g.moving = true
      if (p.room === g.room && catchIf(Math.abs(p.x - g.lane) < 0.8 && Math.abs(g.z - p.z) < 0.9)) return
      if (g.z > room.z0 + 0.5) {
        g.pass += 1
        if (g.pass >= 2 || p.room !== g.room) { gardDone(state, 'The mower sputters off into the dark. The grass smells freshly cut.'); return }
        g.phase = 'warn'; g.t = W(state, 1.6); g.lane = clamp(p.x, -room.hw + 0.8, room.hw - 0.8)
        setCaption(state, '🚜 He\'s turning around for another lane — MOVE!', 2.2, 'danger')
      }
      return
    }
    case 'whisper': {
      g.t -= dt
      g.faceYaw = Math.atan2(p.x - g.x, p.z - g.z)
      if (lookAngle(p, g.x, 1.6, g.z) < 0.7 && catchIf(true)) return
      if (g.t <= 0) gardDone(state, "The whispering stops. You didn't look. Good.")
      return
    }
    case 'wave': {
      g.faceYaw = Math.atan2(p.x - g.x, p.z - g.z)
      if (lookAngle(p, g.x, 1.6, g.z) > 1.0) g.away += dt
      if (g.away > 0.6 || d < 5 || leftRoom) gardDone(state, '…he\'s gone.', false)
      return
    }
  }
}

// ── Floor -A0001: the Lamplighter ────────────────────────────────────────
function subEnter(state, idx) {
  const room = state.rooms[idx]
  if (idx === 1) setCaption(state, '🕯️ Floor -A0001. It is very, very dark. Something down here is awake.', 6, 'warn')
  if (room.type === 'meeting') {
    state.ev.lamp = null
    state.ev.meet = { phase: 'wait' }
    setCaption(state, '🕯️ A single candle on a table. Someone tall is sitting there. Waiting.', 5, 'warn')
    return
  }
  if (room.type !== 'normal' || state.ev.lamp) return
  if (idx === 2 || (idx - state.lastLampRoom >= 2 && state.rng() < 0.6)) startLamp(state, idx)
}

function nextLampMood(state) {
  if (!state.lampBag.length) {
    const bag = LAMP_MOODS.slice()
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(state.rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]] }
    if (bag[0] === state.lastLampMood) bag.push(bag.shift())
    state.lampBag = bag
  }
  state.lastLampMood = state.lampBag.shift()
  return state.lastLampMood
}

export function startLamp(state, idx, mood = nextLampMood(state)) {
  const room = state.rooms[idx]
  const p = state.player
  const mid = (room.z0 + room.z1) / 2
  state.lastLampRoom = idx
  encounter(state, 'lamplighter')
  const g = { mood, room: idx, x: 0, z: mid, faceYaw: 0, t: 0, moving: false, seen: 0 }
  if (mood === 'snuff') {
    g.phase = 'pre'; g.t = 1.4
    g.x = p.x + Math.sin(p.yaw) * 1.4; g.z = p.z + Math.cos(p.yaw) * 1.4
    setCaption(state, '…a cold breath on the back of your neck.', 2, 'danger')
  } else if (mood === 'lantern') {
    g.x = -room.hw + 1; g.dir = 1; g.r = 2.3
    setCaption(state, '🏮 A blue lantern is moving through the room. DON\'T step into its light.', 5, 'warn')
  } else if (mood === 'stalk') {
    g.x = room.entryX; g.z = room.z0 + 0.4; g.backed = false
    setCaption(state, '…footsteps behind you. They stop when you stop. Turn around and SHINE your light on him.', 5, 'danger')
  } else if (mood === 'doorway') {
    g.x = room.exitX; g.z = room.z1 + 0.35; g.faceYaw = 0
    setCaption(state, '🚪 He is standing in the doorway you need. He only sees LIGHT — turn yours OFF (F) and slip past.', 5.5, 'danger')
  } else if (mood === 'chair') {
    const side = state.rng() < 0.5 ? -1 : 1
    g.x = side * (room.hw - 1.4); g.faceYaw = side * Math.PI / 2 // facing the wall
    setCaption(state, '🪑 Someone is sitting in a chair, facing the wall. Don\'t shine your light on him.', 5, 'warn')
  }
  state.ev.lamp = g
}

function lampDone(state, msg, dodge = true) {
  state.ev.lamp = null
  if (dodge) dodged(state, 'lamplighter')
  if (msg) setCaption(state, msg, 3.5, dodge ? 'good' : 'info')
}

function stepLamp(state, dt, input) {
  const g = state.ev.lamp
  if (!g) return
  const p = state.player
  const room = state.rooms[g.room]
  const d = Math.hypot(p.x - g.x, p.z - g.z)
  const left = p.room > g.room
  const caught = () => { if (!p.hidden) { triggerCatch(state, 'lamplighter', g.x, g.z); return true } return false }
  g.moving = false
  const lit = p.lightOn && !(state.lightOut > 0) && !p.hidden
  switch (g.mood) {
    case 'snuff': {
      if (g.phase === 'pre') {
        g.t -= dt
        if (g.t <= 0) { g.phase = 'dark'; g.t = W(state, 6.5); g.grace = 0.8; state.lightOut = g.t; setCaption(state, 'Your light goes OUT. Something is right next to you. Do. Not. Move.', 4, 'danger') }
        return
      }
      g.grace -= dt; g.t -= dt
      // he circles you in the dark
      const a = state.elapsed * 0.9
      g.x = p.x + Math.cos(a) * 1.5; g.z = p.z + Math.sin(a) * 1.5; g.faceYaw = Math.atan2(p.x - g.x, p.z - g.z); g.moving = true
      if (g.grace <= 0 && p.moving && caught()) return
      if (g.t <= 0) { state.lightOut = 0; lampDone(state, 'Your light flickers back on. Nobody is there.') }
      return
    }
    case 'lantern': {
      g.x += g.dir * S(state, 1.2) * dt
      if (Math.abs(g.x) > room.hw - 1) g.dir *= -1
      g.faceYaw = g.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      g.moving = true
      if (p.room === g.room && d < g.r && caught()) return
      if (left) lampDone(state, 'The blue light drifts on behind you, looking for someone else.')
      return
    }
    case 'stalk': {
      const facing = lit && d < 8 && lookAngle(p, g.x, 1.8, g.z) < 0.5
      const dx = p.x - g.x, dz = p.z - g.z
      if (facing) {
        if (!g.backed) { g.backed = true; setCaption(state, 'He steps back into the dark. He is still there.', 2.5, 'warn') }
        const nx = g.x - dx / (d || 1) * S(state, 2.4) * dt, nz = g.z - dz / (d || 1) * S(state, 2.4) * dt
        if (!blocked(state, nx, g.z, 0.3)) g.x = nx
        if (!blocked(state, g.x, nz, 0.3) && roomIndexAt(state.rooms, nz) === g.room) g.z = nz
      } else if (d > 0.01) {
        const st = S(state, 3.0) * dt
        const nx = g.x + dx / d * st, nz = g.z + dz / d * st
        if (!blocked(state, nx, g.z, 0.3)) g.x = nx
        if (!blocked(state, g.x, nz, 0.3)) g.z = nz
        g.moving = true
      }
      g.faceYaw = Math.atan2(dx, dz)
      if (d < 0.95 && caught()) return
      if (left) lampDone(state, 'The footsteps stop at the doorway behind you.')
      return
    }
    case 'doorway': {
      g.faceYaw = 0
      if (p.room === g.room && lit && d < 7) g.seen += dt
      else g.seen = Math.max(0, g.seen - dt)
      if (g.seen > W(state, 1.2) && caught()) return
      if (left) lampDone(state, 'You slip past him in the dark. You feel him turn his head to follow you.')
      return
    }
    case 'chair': {
      if (p.room === g.room && lit && d < 7 && lookAngle(p, g.x, 1.3, g.z) < 0.4) g.seen += dt
      else g.seen = Math.max(0, g.seen - dt * 0.5)
      if (g.seen > W(state, 2.5) && caught()) return
      if (left) lampDone(state, '…when you glance back, the chair is empty.', false)
      return
    }
  }
}

function stepMeet(state) {
  const m = state.ev.meet
  if (!m || m.phase !== 'wait') return
  const p = state.player
  const room = state.rooms[p.room]
  if (room.type !== 'meeting' || p.z > room.z0 - 3) return
  m.phase = 'talk'
  const seat = room.seat
  encounter(state, 'lamplighter')
  state.metIds.add('lamplighter')
  state.sitting = { id: 'lamplighter', x: seat.x, z: seat.z, faceYaw: Math.atan2(p.x - seat.x, p.z - seat.z) }
  p.yaw = Math.atan2(-(seat.x - p.x), -(seat.z - p.z)); p.pitch = -0.05
  state.dialogue = { monsterId: 'lamplighter', lines: MONSTER_DEFS.lamplighter.meetLines, lineIndex: 0, talk: true, reward: 0, onDone: 'meet' }
}

// ── Floor 13: the Staff Wing ─────────────────────────────────────────────
// Everyone works here. No closets. Something in almost every room.
const STAFF_POOL = ['rush', 'ambush', 'eyes', 'gus', 'nibbles', 'bubbles', 'cold', 'coco', 'mirror', 'puff', 'twirl', 'hank', 'gardener']
const NO_CLOSET_LINE = "No closets here… squeeze into a DOORWAY (stand in one of the archways)!"

function staffEnter(state, idx) {
  const room = state.rooms[idx]
  const ev = state.ev
  if (idx === 1) { startShelly(state); return }
  if (room.type === 'stampede') { startStampede(state, idx); return }
  if (room.type !== 'normal') return
  if (room.dark) {
    if (state.rng() < 0.5) ev.bats = { phase: 'waiting', room: idx, t: 1.2 + state.rng() * 1.5 }
    else ev.screech = { phase: 'waiting', room: idx, t: 1.5 + state.rng() * 2, x: 0, z: 0 }
  }
  const busy = ev.rush || ev.ambush || ev.eyes || ev.gus || ev.nibbles || ev.bubbles || ev.cold || ev.coco || ev.mirror || ev.puff || ev.twirl || ev.gard
  if (busy || state.rng() > 0.72) return
  const pool = STAFF_POOL.filter(k => !(k === 'nibbles' && state.coins < 4) && !(room.lockKind && (k === 'mirror' || k === 'coco')))
  const pick = pool[Math.floor(state.rng() * pool.length)]
  switch (pick) {
    case 'rush': startRush(state, idx); setCaption(state, '💡 The lights flicker… ' + NO_CLOSET_LINE, RUSH_WARNING, 'danger'); break
    case 'ambush': startAmbush(state, idx); setCaption(state, '🧹 Vacuum whine… ' + NO_CLOSET_LINE + ' She does laps!', AMBUSH_WARNING, 'danger'); break
    case 'eyes': startEyes(state, idx); break
    case 'gus': startGus(state, idx); break
    case 'nibbles': startNibbles(state, idx); break
    case 'bubbles': startBubbles(state, idx); break
    case 'cold': startCold(state, idx); break
    case 'coco': startCoco(state, idx); break
    case 'mirror': startMirror(state, idx); break
    case 'puff': startPuff(state, idx); break
    case 'twirl': startTwirl(state, idx); break
    case 'hank': startHank(state, idx); break
    case 'gardener': {
      const moods = ['prune', 'watch', 'scarecrows', 'mower', 'whisper']
      startGardener(state, idx, moods[Math.floor(state.rng() * moods.length)])
      break
    }
  }
}

// ── Everyone, All At Once ────────────────────────────────────────────────
export const STAMPEDE_CAST = ['barry', 'steve', 'drakko', 'wendell', 'gary', 'reginald', 'doris', 'mildred', 'tim', 'frank', 'gus',
  'hank', 'bernadette', 'doug', 'puff', 'twirl', 'bumpus', 'nibbles', 'bubbles', 'wes', 'yolanda', 'shelly', 'coco', 'marvin',
  'gloria', 'mabel', 'ollie', 'hoot', 'bea', 'gardener', 'harvester', 'lamplighter']
const DASHERS = ['barry', 'doris', 'bumpus']

function startStampede(state, idx) {
  const room = state.rooms[idx]
  const rng = state.rng
  state.hearts = STAFF_HEARTS // one last fresh start
  for (const k of ['rush', 'ambush', 'eyes', 'gus', 'nibbles', 'bubbles', 'cold', 'coco', 'mirror', 'puff', 'twirl', 'hank', 'gard', 'bats', 'screech', 'shelly']) state.ev[k] = null
  state.flicker = false
  const ents = STAMPEDE_CAST.map((id, k) => {
    encounter(state, id)
    const dasher = DASHERS.includes(id)
    // they burst out of the walls all down the hall, a few from behind
    const side = k % 2 ? 1 : -1
    const behind = k % 7 === 0
    const z = behind ? room.z0 - 1 - rng() * 2 : room.z0 - 6 - rng() * (room.len - 10)
    const x = behind ? (rng() - 0.5) * 6 : side * (room.hw - 0.6)
    const speed = id === 'harvester' ? 1.6 : id === 'shelly' ? 1.3 : id === 'gus' ? 2.3 : 1.5 + rng() * 1.0
    // the ones behind you crawl out of the entrance a few seconds after you've started running
    return { id, x, z, faceYaw: 0, speed, dasher, wake: behind ? 3.2 + rng() * 1.5 : 0.6 + rng() * 2.2, moving: false, hitR: id === 'harvester' ? 1.6 : 0.8,
      lane: null, cd: 1.5 + rng() * 4 }
  })
  state.ev.stampede = { room: idx, ents, t: 0, inv: 0, done: false }
  setCaption(state, "😱 EVERYONE IS HERE. Every single one of them. They're ALL coming for you — RUN for the far door!", 5, 'danger')
}

function stampedeHit(state, e) {
  const st = state.ev.stampede, p = state.player
  if (st.inv > 0) return
  st.inv = STAMPEDE_INV
  loseHeart(state)
  state.catchCount += 1
  state.catchesById[e.id] = (state.catchesById[e.id] || 0) + 1
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1
  for (let k = 0; k < 8; k++) {
    const nx = p.x + dx / d * 0.25, nz = p.z + dz / d * 0.25
    if (!blocked(state, nx, nz, PLAYER_RADIUS)) { p.x = nx; p.z = nz }
  }
  if (state.hearts <= 0) { state.lost = true; return }
  setCaption(state, `💥 ${MONSTER_DEFS[e.id]?.name ?? 'Gloria'} got you! ${'❤️'.repeat(state.hearts)} left — keep running!`, 2, 'danger')
}

function stepStampede(state, dt) {
  const st = state.ev.stampede
  if (!st || st.done) return
  const p = state.player
  const room = state.rooms[st.room]
  st.t += dt
  st.inv = Math.max(0, st.inv - dt)
  if (p.room > st.room) {
    st.done = true
    dodged(state, 'stampede')
    setCaption(state, "🚪 You SLAM the door behind you. On the other side, thirty voices say \"aww.\"", 4, 'good')
    return
  }
  for (const e of st.ents) {
    e.moving = false
    if (st.t < e.wake) continue
    if (e.dasher) {
      // dash across the hall along a glowing lane, a few steps ahead of you
      if (!e.lane) {
        e.cd -= dt
        if (e.cd <= 0) {
          const lz = clamp(p.z - 3 - state.rng() * 4, room.z1 + 1, room.z0 - 1)
          const from = state.rng() < 0.5 ? -1 : 1
          e.lane = { z: lz, from, t: 1.6, x: from * (room.hw - 0.4) }
          e.x = e.lane.x; e.z = lz
        }
        continue
      }
      const L = e.lane
      if (L.t > 0) { L.t -= dt; continue }
      e.x -= L.from * (e.id === 'doris' ? 16 : e.id === 'bumpus' ? 12 : 14) * dt
      e.faceYaw = Math.atan2(-L.from, 0)
      e.moving = true
      if (Math.abs(p.z - L.z) < 0.8 && Math.abs(p.x - e.x) < 0.9) stampedeHit(state, e)
      if (Math.abs(e.x) > room.hw + 1) { e.lane = null; e.cd = 1.2 + state.rng() * 2.5 }
      continue
    }
    if (e.id === 'gus' && lookAngle(p, e.x, 1.0, e.z) < 0.6) continue // only when you're not looking
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz)
    if (d < e.hitR) { stampedeHit(state, e); continue }
    const stp = e.speed * dt
    const nx = e.x + dx / d * stp, nz = e.z + dz / d * stp
    if (!blocked(state, nx, e.z, 0.35)) e.x = nx
    if (!blocked(state, e.x, nz, 0.35)) e.z = nz
    e.faceYaw = Math.atan2(dx, dz)
    e.moving = true
  }
}

// ── The Harvester: the boss fight in the courtyard ───────────────────────

function startBoss(state, idx) {
  const room = state.rooms[idx]
  encounter(state, 'harvester')
  state.ev.gard = null
  state.ev.boss = {
    phase: 'intro', t: 5, x: 0, z: (room.z0 + room.z1) / 2, faceYaw: 0,
    hearts: BOSS_HEARTS, lit: 0, attack: null, cd: 2.5, inv: 0, flawless: true, hitFlash: 0, strikeFlash: 0,
  }
  setCaption(state, '"You found me," says the Gardener. "You\'ve been so patient. Let me show you what I really am."', 5, 'danger')
}

function bossHit(state) {
  const b = state.ev.boss, p = state.player
  if (b.inv > 0) return
  b.hearts -= 1
  b.inv = 1.6
  b.flawless = false
  b.hitFlash = 0.5
  // knocked back away from him
  const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1
  const arena = state.rooms[BOSS_ROOM]
  for (let k = 0; k < 10; k++) {
    const nx = p.x + dx / d * 0.25, nz = p.z + dz / d * 0.25
    if (nz > arena.z0 - 0.5 || nz < arena.z1 + 0.5) break
    if (!blocked(state, nx, nz, PLAYER_RADIUS)) { p.x = nx; p.z = nz }
  }
  if (b.hearts <= 0) triggerCatch(state, 'harvester', b.x, b.z)
  else setCaption(state, `💔 OUCH! ${b.hearts} heart${b.hearts === 1 ? '' : 's'} left!`, 2, 'danger')
}

function stepBoss(state, dt) {
  const b = state.ev.boss
  if (!b) return
  const p = state.player
  const room = state.rooms[BOSS_ROOM]
  b.hitFlash = Math.max(0, b.hitFlash - dt)
  b.strikeFlash = Math.max(0, b.strikeFlash - dt)
  if (b.phase === 'intro') {
    b.t -= dt
    if (b.t <= 0) {
      b.phase = 'fight'
      room.backClosed = true
      setCaption(state, '🔥 THE HARVESTER! Light all 4 braziers (E) — and stay OUT of the red marks!', 5, 'danger')
    }
    return
  }
  if (b.phase !== 'fight') return
  b.inv = Math.max(0, b.inv - dt)
  const inArena = p.room === BOSS_ROOM
  const d = Math.hypot(p.x - b.x, p.z - b.z)
  b.moving = false
  if (!b.attack && inArena && d > 2.2) {
    const sp = S(state, BOSS_SPEED) * (1 + 0.22 * b.lit)
    const dx = p.x - b.x, dz = p.z - b.z
    b.x = clamp(b.x + dx / d * sp * dt, -room.hw + 1.5, room.hw - 1.5)
    b.z = clamp(b.z + dz / d * sp * dt, room.z1 + 1.5, room.z0 - 1.5)
    b.moving = true
  }
  if (inArena) b.faceYaw = Math.atan2(p.x - b.x, p.z - b.z)
  if (inArena && d < 1.6) bossHit(state)
  if (state.dialogue) return

  if (!b.attack) {
    b.cd -= dt
    if (b.cd <= 0 && inArena) {
      const windup = W(state, BOSS_WINDUP) * (1 - 0.08 * b.lit)
      if (d < 6 && state.rng() < 0.65) {
        b.attack = { kind: 'sweep', t: windup, total: windup, x: b.x, z: b.z, ang: Math.atan2(p.x - b.x, p.z - b.z), r: 5.2, half: 1.1 }
        setCaption(state, '⚠️ HE RAISES THE SICKLE!', windup, 'danger')
      } else {
        const spots = [{ x: p.x, z: p.z }]
        for (let k = 0; k < 2 + b.lit; k++) {
          const a = state.rng() * Math.PI * 2, r = 1.5 + state.rng() * 3
          spots.push({ x: clamp(p.x + Math.cos(a) * r, -room.hw + 1, room.hw - 1), z: clamp(p.z + Math.sin(a) * r, room.z1 + 1, room.z0 - 1) })
        }
        b.attack = { kind: 'thorns', t: windup * 1.1, total: windup * 1.1, spots, r: 1.35 }
        setCaption(state, '⚠️ THORNS! The ground is cracking under you!', windup, 'danger')
      }
    }
    return
  }
  const a = b.attack
  a.t -= dt
  if (a.t > 0) return
  // strike!
  let hit = false
  if (a.kind === 'sweep') {
    const dx = p.x - a.x, dz = p.z - a.z, dd = Math.hypot(dx, dz)
    let diff = Math.atan2(dx, dz) - a.ang
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    hit = dd < a.r && Math.abs(diff) < a.half
  } else {
    hit = a.spots.some(sp => Math.hypot(p.x - sp.x, p.z - sp.z) < a.r)
  }
  b.strikeFlash = 0.4
  b.lastStrike = a
  b.attack = null
  b.cd = Math.max(0.9, W(state, BOSS_COOLDOWN) - 0.28 * b.lit)
  if (hit && inArena) bossHit(state)
}

function lightBrazier(state, it) {
  const b = state.ev.boss
  if (!b || b.phase !== 'fight') { setCaption(state, "It won't light. Not yet.", 2); return }
  it.lit = true
  b.lit += 1
  b.attack = null
  b.cd = 1.5
  if (b.lit >= BOSS_BRAZIERS) {
    b.phase = 'weak'
    setCaption(state, '🔥 All four fires are burning! He is COLLAPSING — RING THE GARDEN BELL by the gate! (E)', 6, 'good')
  } else {
    setCaption(state, `🔥 The brazier ROARS to life and the Harvester SHRIEKS! (${b.lit}/${BOSS_BRAZIERS}) …he's getting angrier.`, 3.5, 'warn')
  }
}

function ringBell(state) {
  const b = state.ev.boss
  if (!b || b.phase !== 'weak') return
  b.phase = 'done'
  state.bossDefeated = true
  state.bossFlawless = b.flawless
  dodged(state, 'harvester')
  state.rooms[BOSS_ROOM].unlocked = true
  // he shrinks back into the little man in the straw hat, and finally talks
  const p = state.player
  state.sitting = { id: 'gardener', x: b.x, z: b.z, faceYaw: Math.atan2(p.x - b.x, p.z - b.z) }
  p.yaw = Math.atan2(-(b.x - p.x), -(b.z - p.z)); p.pitch = -0.1
  state.metIds.add('gardener')
  state.dialogue = { monsterId: 'gardener', lines: MONSTER_DEFS.harvester.defeatLines, lineIndex: 0, talk: true, reward: 0 }
}

// ── The Gloombats: swirl around anyone carrying a light in the dark ──
function stepBats(state, dt) {
  const b = state.ev.bats
  if (!b) return
  const p = state.player
  if (b.phase === 'waiting') {
    if (p.room !== b.room) { state.ev.bats = null; return }
    b.t -= dt
    if (b.t <= 0) {
      b.phase = 'warning'; b.t = W(state, BATS_WARNING)
      encounter(state, 'bernadette')
      setCaption(state, '🦇 Flapping in the dark… turn your light OFF! (F)', W(state, BATS_WARNING), 'danger')
    }
    return
  }
  b.t -= dt
  if (b.phase === 'warning') {
    if (b.t <= 0) { b.phase = 'swarm'; b.t = BATS_SWARM; setCaption(state, '🦇 Shhh… the Gloombats are swirling all around you. Keep that light off…', BATS_SWARM, 'warn') }
    return
  }
  if (p.lightOn && !p.hidden) { triggerCatch(state, 'bernadette', p.x - Math.sin(p.yaw) * 2, p.z - Math.cos(p.yaw) * 2); return }
  if (b.t <= 0) {
    state.ev.bats = null
    dodged(state, 'bernadette')
    setCaption(state, 'The Gloombats flutter off to rehearse somewhere else. Light back on with F.', 3.5, 'good')
  }
}

function stepFigure(state, dt) {
  const p = state.player
  const lib = state.rooms[LIBRARY_ROOM]
  if (!lib || lib.type !== 'library') return
  if (!state.ev.figure) {
    if (p.room !== LIBRARY_ROOM) return
    encounter(state, 'reginald')
    state.ev.figure = { x: 0, z: lib.z1 + 4, mode: 'patrol', path: [], repath: 0, rest: 0, listen: 0, faceYaw: 0, target: null }
  }
  const f = state.ev.figure
  if (p.room > LIBRARY_ROOM + 1) return
  const grid = lib.grid

  if (f.rest > 0) f.rest -= dt
  const d = Math.hypot(p.x - f.x, p.z - f.z)
  const hearR = (p.sneaking ? FIGURE_HEAR_SNEAK : FIGURE_HEAR_WALK) * (state.inventory.sneakers ? 0.5 : 1)
  if (f.rest <= 0 && !p.hidden && p.moving && p.room === LIBRARY_ROOM && d < hearR) {
    if (f.mode !== 'hunt') setCaption(state, 'Sir Reginald heard you! Sneak (SHIFT) or hide in a closet!', 2.5, 'danger')
    f.mode = 'hunt'
    f.target = { x: p.x, z: p.z }
    f.repath = 0
  }

  if (!f.target) {
    let c
    do { c = Math.floor(state.rng() * grid.free.length) } while (!grid.free[c])
    f.target = cellCenter(grid, c)
    f.repath = 0
  }
  f.repath -= dt
  if (f.repath <= 0) { f.path = gridPath(grid, f.x, f.z, f.target.x, f.target.z); f.repath = 0.5 }

  if (f.listen > 0) { f.listen -= dt } else {
    const speed = f.mode === 'hunt' ? S(state, FIGURE_HUNT_SPEED) : S(state, FIGURE_PATROL_SPEED)
    let step = speed * dt
    while (step > 0 && f.path.length) {
      const wp = f.path[0]
      const dx = wp.x - f.x, dz = wp.z - f.z, dd = Math.hypot(dx, dz)
      if (dd <= step) { f.x = wp.x; f.z = wp.z; step -= dd; f.path.shift() }
      else { f.x += dx / dd * step; f.z += dz / dd * step; f.faceYaw = Math.atan2(dx, dz); step = 0 }
    }
    if (!f.path.length && Math.hypot(f.target.x - f.x, f.target.z - f.z) < 0.6) {
      if (f.mode === 'hunt') { f.mode = 'patrol'; f.listen = 1.5 }
      f.target = null
    }
  }

  if (f.rest <= 0 && !p.hidden && Math.hypot(p.x - f.x, p.z - f.z) < FIGURE_CATCH) triggerCatch(state, 'reginald', f.x, f.z)
}

// ── Main step ───────────────────────────────────────────────────────────

export function stepGame(state, input, dt) {
  if (state.won || state.paused || state.lost) return
  if (state.hurtT > 0) state.hurtT -= dt
  if (state.coins > state.maxCoins) state.maxCoins = state.coins
  state.elapsed += dt
  if (state.caption) { state.caption.t -= dt; if (state.caption.t <= 0) state.caption = null }
  if (state.turnCue > 0) state.turnCue -= dt

  if (state.dialogue) {
    if (input.advance || input.interact) advanceDialogue(state)
    return
  }
  if (state.shopOpen || state.paused) return

  const p = state.player
  if (p.boostT > 0) p.boostT -= dt
  stepShortcut(state, dt)
  if (state.lightOut > 0) state.lightOut -= dt
  if (input.toggleLight && !(state.lightOut > 0)) p.lightOn = !p.lightOn
  if (input.useItem && state.inventory.vitamins > 0 && p.boostT <= 0) {
    state.inventory.vitamins -= 1
    p.boostT = BOOST_TIME
    setCaption(state, '💊 Vitamins! Zoom zoom.', 2, 'good')
  }
  const prevZ = p.z
  movePlayer(state, input, dt)
  p.eyeY = p.hidden ? 1.5 : (p.sneaking ? 1.15 : EYE_H)
  p.room = roomIndexAt(state.rooms, p.z)
  while (state.maxRoom < p.room) onEnterRoom(state, ++state.maxRoom)

  const steps = [
    () => stepHalt(state, dt, prevZ),
    () => stepRush(state, dt),
    () => stepEyes(state, dt),
    () => stepScreech(state, dt),
    () => stepSeek(state, dt, state.ev.seek, CHASE_ROOMS),
    () => stepSeek(state, dt, state.ev.seek2, CHASE2_ROOMS),
    () => stepElevator(state, dt),
    () => stepHank(state, dt),
    () => stepDoug(state, dt),
    () => stepBats(state, dt),
    () => stepPuff(state, dt),
    () => stepTwirl(state, dt),
    () => stepBumpus(state, dt),
    () => stepNibbles(state, dt),
    () => stepBubbles(state, dt, input),
    () => stepWes(state, dt),
    () => stepCold(state, dt),
    () => stepShelly(state, dt),
    () => stepCoco(state, dt),
    () => stepMirror(state, dt, input),
    () => stepGardener(state, dt),
    () => stepBoss(state, dt),
    () => stepStampede(state, dt),
    () => stepLamp(state, dt, input),
    () => stepMeet(state),
    () => stepFigure(state, dt),
    () => stepAmbush(state, dt),
    () => stepGus(state, dt),
    () => stepMildred(state, dt),
  ]
  for (const s of steps) { s(); if (state.dialogue) return }
  p.room = roomIndexAt(state.rooms, p.z)

  state.focus = computeFocus(state)
  if (input.interact) interact(state)

  const last = state.rooms[state.rooms.length - 1]
  if (p.z < last.z1 - T - 0.3) state.won = true
}
