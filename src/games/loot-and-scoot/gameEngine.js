// ── Loot & Scoot — pure gameplay state/logic ────────────────────────────
// Framework-agnostic: plain (x, z) world coordinates, no THREE, no DOM.
// The React component's Three.js scene reads this each frame and maps it
// onto meshes/camera, same engine/render split as this hub's other 3D
// games (see worldEngine.js in dog-man-dash for the sibling pattern this
// was built from).
import { MAP_HALF, TARGET_NAMES, BOSS_TARGET, MISSION_BASE_TIME, BOSS_MISSION_TIME } from './constants.js'

export const GRAVITY = -34
export const JUMP_V = 10.5
const PLAYER_RADIUS = 0.55
const GUARD_RADIUS = 0.5
const AIRBORNE_SAFE_Y = 1.6 // above this, guards can neither notice nor catch you — you're climbing

// ── Boss tower ───────────────────────────────────────────────────────
// A special job: instead of a hollow room, one tower in the target pool
// is a solid, climbable structure — an exterior switchback fire escape
// leads to a rooftop boss guarding the loot.
const BOSS_TOWER_SIZE = 7
const BOSS_TOWER_HEIGHT = 10
const CLIMB_STEP_HEIGHT = 0.85
const CLIMB_ZIGZAG = 1.0
const CLIMB_STEP_SIZE = 2.0
const ROOF_SIZE = 11 // generous overlap with the top fire-escape step so there's no gap to fall through
const BOSS_HP = 4
const BOSS_WINDUP = 0.7
const BOSS_CYCLE_MIN = 2.0
const BOSS_CYCLE_MAX = 3.2
const BOSS_SWIPE_RANGE = 2.6
const BOSS_KNOCKBACK = 4.5
const BOSS_ATTACK_RANGE = 2.8
const BOSS_ATTACK_COOLDOWN = 0.45

// ── HQ ───────────────────────────────────────────────────────────────
// The hideout is a real building now — you spawn inside it, with the
// Fence and Shop as two stations under one roof, and a wide front door
// out to the city.
const HQ_X = 0, HQ_Z = -3, HQ_W = 20, HQ_D = 16, HQ_H = 5
const HQ_DOOR_WIDTH = 5

const BASE_MOVE_SPEED = 6.0
const SPEED_PER_TIER = 1.3
const CROUCH_MULT = 0.55

const BASE_DETECT_RADIUS = 9
const STEALTH_REDUCTION_PER_TIER = 1.8
const MIN_DETECT_RADIUS = 3
const CROUCH_DETECT_MULT = 0.55

const TIME_BONUS_PER_TIER = 20
const LOOT_MULT_PER_TIER = 0.25
const CLEAN_BONUS_MULT = 1.25

const GUARD_WANDER_SPEED = 1.3
const GUARD_CHASE_SPEED = 5.5
const SUSPICION_RISE = 1 / 2.0
const SUSPICION_DECAY = 1 / 1.3
const CATCH_RADIUS = 1.3
const LOOT_RADIUS = 1.5
const INTERACT_RADIUS = 3.2

// ── Minions ──────────────────────────────────────────────────────────
// Recruitable helpers — you can own several at once and they all pitch
// in passively/reactively during a job.
const CAT_DISTRACT_RADIUS = 12
const CAT_COOLDOWN = 14
const CAT_SUSPICION_THRESHOLD = 0.15
const RAVEN_DECAY_MULT = 1.9
const RACCOON_LOOT_RADIUS = 3.6
const PUP_SLOW_DURATION = 3
const PUP_SLOW_MULT = 0.5

function hasMinion(state, key) { return state.minions.includes(key) }

const DOOR_WIDTH = 2.4
const WALL_THICK = 0.4
const INTERIOR_MARGIN = 1.3 // how far in from the walls guards/loot stay

export const FENCE_POS = { x: 7, z: -6 }
export const SHOP_POS = { x: -7, z: -6 }
const SPAWN_POS = { x: 0, z: 0 }

function rand(a, b) { return a + Math.random() * (b - a) }
function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz) }

function collidesAny(rects, x, z, radius) {
  return rects.some(b => x + radius > b.x - b.w / 2 && x - radius < b.x + b.w / 2 && z + radius > b.z - b.d / 2 && z - radius < b.z + b.d / 2)
}

// A target building isn't one solid box — it's four walls around a hollow
// room with a gap in one of them, so the player can actually walk inside
// to reach the loot. doorSide: 0 = +Z, 1 = -Z, 2 = +X, 3 = -X.
function buildWalls(b, doorWidth = DOOR_WIDTH) {
  const { x, z, w, d, doorSide } = b
  const walls = []
  function seg(cx, cz, ww, dd) { walls.push({ x: cx, z: cz, w: ww, d: dd }) }
  function splitWall(side, cx, cz, full) {
    if (doorSide !== side) { seg(cx, cz, side < 2 ? full : WALL_THICK, side < 2 ? WALL_THICK : full); return }
    const half = (full - doorWidth) / 2
    if (side < 2) {
      seg(cx - (doorWidth / 2 + half / 2), cz, half, WALL_THICK)
      seg(cx + (doorWidth / 2 + half / 2), cz, half, WALL_THICK)
    } else {
      seg(cx, cz - (doorWidth / 2 + half / 2), WALL_THICK, half)
      seg(cx, cz + (doorWidth / 2 + half / 2), WALL_THICK, half)
    }
  }
  splitWall(1, x, z - d / 2, w) // back
  splitWall(0, x, z + d / 2, w) // front
  splitWall(3, x - w / 2, z, d) // left
  splitWall(2, x + w / 2, z, d) // right
  return walls
}

// An exterior switchback fire escape: a stack of small platforms zigzagging
// up one face of the tower, ending in a rooftop deck. Attached just outside
// the tower's own footprint so it never conflicts with the tower's solid
// ground-level collider.
function buildClimb(tower) {
  const platforms = []
  const steps = Math.ceil(tower.h / CLIMB_STEP_HEIGHT)
  const px = tower.x - tower.w / 2 - 1.4
  for (let i = 1; i <= steps; i++) {
    const zOff = i % 2 === 0 ? CLIMB_ZIGZAG : -CLIMB_ZIGZAG
    platforms.push({ x: px, z: tower.z + zOff, y: Math.min(tower.h, i * CLIMB_STEP_HEIGHT), w: CLIMB_STEP_SIZE, d: CLIMB_STEP_SIZE })
  }
  platforms.push({ x: tower.x, z: tower.z, y: tower.h, w: ROOF_SIZE, d: ROOF_SIZE })
  return platforms
}

const BUILDING_COLORS = [0x3a3a52, 0x4a3a3a, 0x3a4a3a, 0x4a3a52, 0x39465a]

// Decorative buildings + the pool of heist-eligible "houses" (with real,
// walkable interiors), generated once per session and shared verbatim
// between the engine (collision + mission logic) and the renderer
// (meshes) so the two never drift apart.
export function generateWorld() {
  const buildings = []
  const targets = []
  const shuffledNames = [...TARGET_NAMES].sort(() => Math.random() - 0.5)
  const targetCount = 6

  function place(minR, avoid) {
    let x, z
    do {
      x = rand(-MAP_HALF + 6, MAP_HALF - 6)
      z = rand(-MAP_HALF + 6, MAP_HALF - 6)
    } while (Math.hypot(x, z) < minR || (avoid && Math.hypot(x - avoid.x, z - avoid.z) < avoid.r))
    return { x, z }
  }

  // The boss tower: a solid, climbable structure rather than a hollow
  // room — its "walls" is really just its one solid ground-level footprint,
  // which drops it straight into the same collider list as everything else.
  // Placed first so every other building can be kept off its roof footprint
  // below — that footprint's collision is height-blind, so anything landing
  // under it would wall the player off from the boss up there.
  let tower
  {
    const { x, z } = place(20)
    tower = {
      x, z, w: BOSS_TOWER_SIZE, d: BOSS_TOWER_SIZE, h: BOSS_TOWER_HEIGHT,
      color: 0x22212e,
      name: BOSS_TARGET.name, baseReward: BOSS_TARGET.reward, guardCount: BOSS_TARGET.guards,
      isBoss: true,
    }
    tower.walls = [{ x, z, w: BOSS_TOWER_SIZE, d: BOSS_TOWER_SIZE }]
    tower.platforms = buildClimb(tower)
    targets.push(tower)
  }
  const towerClearance = { x: tower.x, z: tower.z, r: ROOF_SIZE / 2 + 5 }

  for (let i = 0; i < targetCount; i++) {
    const { x, z } = place(16, towerClearance)
    const def = shuffledNames[i % shuffledNames.length]
    const w = rand(7, 10), d = rand(7, 10)
    const building = {
      x, z, w, d, h: rand(4, 6),
      color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
      name: def.name, baseReward: def.reward, guardCount: def.guards,
      doorSide: Math.floor(Math.random() * 4),
    }
    building.walls = buildWalls(building)
    targets.push(building)
  }

  for (let i = 0; i < 34; i++) {
    const { x, z } = place(15, towerClearance)
    buildings.push({
      x, z, w: rand(4, 8), d: rand(4, 8), h: rand(3, 12),
      color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
    })
  }

  const hq = { x: HQ_X, z: HQ_Z, w: HQ_W, d: HQ_D, h: HQ_H, doorSide: 0 }
  hq.walls = buildWalls(hq, HQ_DOOR_WIDTH)

  return { buildings, targets, hq }
}

export function createGameState(world, save) {
  return {
    x: SPAWN_POS.x, z: SPAWN_POS.z, y: 0, vy: 0, onGround: true, crouching: false,
    buildings: world.buildings,
    targets: world.targets,
    hq: world.hq,
    colliders: [...world.buildings, ...world.targets.flatMap(t => t.walls), ...world.hq.walls],
    cash: save.cash,
    gear: { ...save.gear },
    minions: [...save.minions],
    catCooldown: 0,
    catPulse: null, // { x, z, timer } — transient, for the cat's dart-and-back visual
    dirty: false,
    mission: null, // { targetIdx, timeLeft, alerted, name, reward, isBoss }
    guards: [],
    lootPos: null, lootY: 0, lootReady: false,
    climbPlatforms: [], // the active boss tower's fire-escape steps + roof, while that job is on
    climbTowerWall: null, // the boss tower's own solid footprint — ignored once you're up on its roof
    boss: null, // { x, z, hp, maxHp, mode, timer, roofY, defeated }
    attackCooldown: 0, lastAttack: false,
    nearFence: false, nearShop: false,
    toast: null, // { text, timer, kind }
    lastInteract: false,
    frame: 0,
  }
}

function moveSpeed(state) {
  const base = BASE_MOVE_SPEED + state.gear.speed * SPEED_PER_TIER
  return state.crouching ? base * CROUCH_MULT : base
}

function detectRadius(state) {
  const base = Math.max(MIN_DETECT_RADIUS, BASE_DETECT_RADIUS - state.gear.stealth * STEALTH_REDUCTION_PER_TIER)
  return state.crouching ? base * CROUCH_DETECT_MULT : base
}

function missionTime(state) { return MISSION_BASE_TIME + state.gear.time * TIME_BONUS_PER_TIER }
function bossMissionTime(state) { return BOSS_MISSION_TIME + state.gear.time * TIME_BONUS_PER_TIER }
function lootMultiplier(state) { return 1 + state.gear.lootMult * LOOT_MULT_PER_TIER }
function suspicionDecayRate(state) { return hasMinion(state, 'raven') ? SUSPICION_DECAY * RAVEN_DECAY_MULT : SUSPICION_DECAY }
function lootPickupRadius(state) { return hasMinion(state, 'raccoon') ? RACCOON_LOOT_RADIUS : LOOT_RADIUS }

function setToast(state, text, kind = 'info') { state.toast = { text, timer: 3.2, kind } }

// Guards patrol inside the house now that there's a real room to guard —
// they wander within the interior (walls minus a margin) around the loot.
// The boss tower has no interior (it's solid), so its guards instead
// patrol a ring around the outside.
function guardWanderBounds(building) {
  if (building.isBoss) { const r = building.w / 2 + 5; return { ix: r, iz: r } }
  return { ix: Math.max(1, building.w / 2 - INTERIOR_MARGIN), iz: Math.max(1, building.d / 2 - INTERIOR_MARGIN) }
}

function spawnGuardsFor(building) {
  const guards = []
  for (let i = 0; i < building.guardCount; i++) {
    let gx, gz
    if (building.isBoss) {
      // Ring placement guarantees they start outside the tower's solid
      // footprint (random-square placement could occasionally land inside).
      const ang = (i / building.guardCount) * Math.PI * 2
      gx = building.x + Math.cos(ang) * (building.w / 2 + 4)
      gz = building.z + Math.sin(ang) * (building.d / 2 + 4)
    } else {
      const { ix, iz } = guardWanderBounds(building)
      gx = building.x + rand(-ix, ix)
      gz = building.z + rand(-iz, iz)
    }
    guards.push({ id: i, x: gx, z: gz, homeX: building.x, homeZ: building.z, target: { x: gx, z: gz }, wanderTimer: rand(1, 3), state: 'patrol', suspicion: 0, slowTimer: 0 })
  }
  return guards
}

// One-way platform landing, same technique as World3D.jsx's surfaceHeightAt
// — only a platform at or just below the player's current height counts,
// so you don't get yanked upward into ones you're still jumping toward.
function groundHeightAt(state, x, z) {
  let best = 0
  for (const p of state.climbPlatforms) {
    if (x > p.x - p.w / 2 && x < p.x + p.w / 2 && z > p.z - p.d / 2 && z < p.z + p.d / 2) {
      if (p.y <= state.y + 0.4 && p.y > best) best = p.y
    }
  }
  return best
}

export function startMission(state) {
  if (state.mission) return
  const targetIdx = Math.floor(Math.random() * state.targets.length)
  const building = state.targets[targetIdx]
  const isBoss = !!building.isBoss
  const totalTime = isBoss ? bossMissionTime(state) : missionTime(state)
  state.mission = { targetIdx, timeLeft: totalTime, totalTime, alerted: false, name: building.name, reward: building.baseReward, isBoss }
  state.guards = spawnGuardsFor(building)
  state.lootPos = { x: building.x, z: building.z }
  if (isBoss) {
    state.lootY = building.h
    state.lootReady = false
    state.climbPlatforms = building.platforms
    state.climbTowerWall = building.walls[0]
    state.boss = { x: building.x, z: building.z, hp: BOSS_HP, maxHp: BOSS_HP, mode: 'idle', timer: rand(BOSS_CYCLE_MIN, BOSS_CYCLE_MAX), roofY: building.h, defeated: false }
    setToast(state, `Job accepted: ${building.name} — scale the tower and take down the boss!`, 'info')
  } else {
    state.lootY = 0
    state.lootReady = true
    state.climbPlatforms = []
    state.climbTowerWall = null
    state.boss = null
    setToast(state, `Job accepted: ${building.name} — get inside and grab the loot!`, 'info')
  }
}

function endMission(state) {
  state.mission = null
  state.guards = []
  state.lootPos = null
  state.lootY = 0
  state.lootReady = false
  state.climbPlatforms = []
  state.climbTowerWall = null
  state.boss = null
  state.catPulse = null
}

function failMission(state, reason) {
  setToast(state, reason, 'bad')
  endMission(state)
  state.x = SPAWN_POS.x
  state.z = SPAWN_POS.z
  state.y = 0
  state.vy = 0
  state.onGround = true
}

function completeMission(state) {
  const m = state.mission
  const payout = Math.round(m.reward * lootMultiplier(state) * (m.alerted ? 1 : CLEAN_BONUS_MULT))
  state.cash += payout
  state.dirty = true
  setToast(state, m.alerted ? `Job done! +$${payout}` : `Clean getaway! +$${payout} (bonus!)`, 'good')
  endMission(state)
}

export function stepGame(state, input, dt) {
  state.frame++

  // Movement (axis-separated against building AABBs, same technique as
  // Dog Man Dash's open world).
  state.crouching = !!input.crouch
  const speed = moveSpeed(state)
  const moveLen = Math.hypot(input.moveX || 0, input.moveZ || 0)
  // Once you're up on the boss tower's roof, its own ground-floor footprint
  // (a horizontal-only collider, blind to height) would otherwise still
  // wall you off from the boss standing at its center.
  const onTowerRoof = state.climbTowerWall && state.y >= state.lootY - 0.5
  const colliders = onTowerRoof ? state.colliders.filter(c => c !== state.climbTowerWall) : state.colliders
  if (moveLen > 0.001) {
    const nx = state.x + (input.moveX / moveLen) * speed * dt
    if (!collidesAny(colliders, nx, state.z, PLAYER_RADIUS)) state.x = nx
    const nz = state.z + (input.moveZ / moveLen) * speed * dt
    if (!collidesAny(colliders, state.x, nz, PLAYER_RADIUS)) state.z = nz
  }
  state.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, state.x))
  state.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, state.z))

  if (input.jump && state.onGround) { state.vy = JUMP_V; state.onGround = false }
  state.vy += GRAVITY * dt
  state.y += state.vy * dt
  const groundY = groundHeightAt(state, state.x, state.z)
  if (state.y <= groundY) { state.y = groundY; state.vy = 0; state.onGround = true }
  else state.onGround = false

  // Attacking the boss (only meaningful while one exists) and its own
  // telegraphed swipe both live here so they tick every frame regardless
  // of mission state, same as the interact-edge tracking below.
  if (state.attackCooldown > 0) state.attackCooldown -= dt
  if (state.boss && !state.boss.defeated) {
    const boss = state.boss
    const nearBoss = state.y > boss.roofY - 3
    if (input.attack && !state.lastAttack && state.attackCooldown <= 0 && nearBoss && dist(state.x, state.z, boss.x, boss.z) < BOSS_ATTACK_RANGE) {
      state.attackCooldown = BOSS_ATTACK_COOLDOWN
      boss.hp--
      if (boss.hp <= 0) {
        boss.defeated = true
        state.lootReady = true
        setToast(state, '💥 The boss is down! Grab the loot!', 'good')
      } else {
        setToast(state, `Hit! Boss HP ${boss.hp}/${boss.maxHp}`, 'good')
      }
    }
    boss.timer -= dt
    if (boss.mode === 'idle' && boss.timer <= 0) { boss.mode = 'windup'; boss.timer = BOSS_WINDUP }
    else if (boss.mode === 'windup' && boss.timer <= 0) {
      if (nearBoss && dist(state.x, state.z, boss.x, boss.z) < BOSS_SWIPE_RANGE) {
        const dx = state.x - boss.x, dz = state.z - boss.z, len = Math.hypot(dx, dz) || 1
        state.x += (dx / len) * BOSS_KNOCKBACK
        state.z += (dz / len) * BOSS_KNOCKBACK
        state.vy = 5
        state.onGround = false
        setToast(state, 'The boss swipes you back!', 'bad')
      }
      boss.mode = 'idle'
      boss.timer = rand(BOSS_CYCLE_MIN, BOSS_CYCLE_MAX)
    }
  }
  state.lastAttack = !!input.attack

  state.nearFence = dist(state.x, state.z, FENCE_POS.x, FENCE_POS.z) < INTERACT_RADIUS
  state.nearShop = dist(state.x, state.z, SHOP_POS.x, SHOP_POS.z) < INTERACT_RADIUS

  if (input.interact && !state.lastInteract) {
    if (state.nearFence && !state.mission) startMission(state)
  }
  state.lastInteract = !!input.interact

  if (state.toast) {
    state.toast.timer -= dt
    if (state.toast.timer <= 0) state.toast = null
  }

  if (state.mission) {
    state.mission.timeLeft -= dt
    if (state.mission.timeLeft <= 0) { failMission(state, `Out of time at ${state.mission.name}!`); return }

    const building = state.targets[state.mission.targetIdx]
    const { ix, iz } = guardWanderBounds(building)
    const dRadius = detectRadius(state)
    const decayRate = suspicionDecayRate(state)
    // Once you're up on the fire escape or roof, ground-bound guards can
    // neither notice nor catch you — they just pace the base waiting.
    const playerReachable = state.y < AIRBORNE_SAFE_Y
    for (const g of state.guards) {
      const dToPlayer = dist(g.x, g.z, state.x, state.z)
      if (g.state === 'chase') {
        if (g.slowTimer > 0) g.slowTimer -= dt
        const chaseSpeed = g.slowTimer > 0 ? GUARD_CHASE_SPEED * PUP_SLOW_MULT : GUARD_CHASE_SPEED
        const dx = state.x - g.x, dz = state.z - g.z, len = Math.hypot(dx, dz) || 1
        const gnx = g.x + (dx / len) * chaseSpeed * dt
        if (!collidesAny(state.colliders, gnx, g.z, GUARD_RADIUS)) g.x = gnx
        const gnz = g.z + (dz / len) * chaseSpeed * dt
        if (!collidesAny(state.colliders, g.x, gnz, GUARD_RADIUS)) g.z = gnz
        if (playerReachable && dToPlayer < CATCH_RADIUS) { failMission(state, `Busted at ${state.mission.name}!`); return }
      } else {
        if (playerReachable && dToPlayer < dRadius) {
          g.suspicion = Math.min(1, g.suspicion + SUSPICION_RISE * dt)
          if (g.suspicion >= 1) {
            g.state = 'chase'
            g.slowTimer = hasMinion(state, 'pup') ? PUP_SLOW_DURATION : 0
            state.mission.alerted = true
            setToast(state, hasMinion(state, 'pup') ? '🐶 Biscuit barks! SPOTTED — but they\'re startled!' : 'SPOTTED! Run!', 'bad')
          }
        } else {
          g.suspicion = Math.max(0, g.suspicion - decayRate * dt)
        }
        g.wanderTimer -= dt
        const dHome = dist(g.x, g.z, g.target.x, g.target.z)
        if (g.wanderTimer <= 0 || dHome < 0.4) {
          g.target = { x: building.x + rand(-ix, ix), z: building.z + rand(-iz, iz) }
          g.wanderTimer = rand(2, 4)
        }
        const dx = g.target.x - g.x, dz = g.target.z - g.z, len = Math.hypot(dx, dz) || 1
        const gnx = g.x + (dx / len) * GUARD_WANDER_SPEED * dt
        if (!collidesAny(state.colliders, gnx, g.z, GUARD_RADIUS)) g.x = gnx
        const gnz = g.z + (dz / len) * GUARD_WANDER_SPEED * dt
        if (!collidesAny(state.colliders, g.x, gnz, GUARD_RADIUS)) g.z = gnz
      }
    }

    if (hasMinion(state, 'cat')) {
      state.catCooldown -= dt
      if (state.catCooldown <= 0) {
        const target = state.guards
          .filter(g => g.state === 'patrol' && g.suspicion > CAT_SUSPICION_THRESHOLD && dist(g.x, g.z, state.x, state.z) < CAT_DISTRACT_RADIUS)
          .sort((a, b) => b.suspicion - a.suspicion)[0]
        if (target) {
          target.suspicion = 0
          state.catCooldown = CAT_COOLDOWN
          state.catPulse = { x: target.x, z: target.z, timer: 1.2 }
          setToast(state, '🐱 Shadow distracted a guard!', 'good')
        }
      }
    }
    if (state.catPulse) {
      state.catPulse.timer -= dt
      if (state.catPulse.timer <= 0) state.catPulse = null
    }

    if (state.lootPos && state.lootReady
      && dist(state.x, state.z, state.lootPos.x, state.lootPos.z) < lootPickupRadius(state)
      && Math.abs(state.y - state.lootY) < 2.5) {
      completeMission(state)
    }
  }
}

// Mutates the live engine state directly (same style as the rest of this
// file) so a purchase takes effect immediately — no separate "save" copy
// to keep in sync with what's actually being played.
export function tryBuyGear(state, key, cost, nextTier) {
  if (state.cash < cost) return false
  state.cash -= cost
  state.gear = { ...state.gear, [key]: nextTier }
  state.dirty = true
  return true
}

export function tryRecruitMinion(state, key, cost) {
  if (state.cash < cost || state.minions.includes(key)) return false
  state.cash -= cost
  state.minions = [...state.minions, key]
  state.dirty = true
  return true
}
