// ── Dog Man Dash 3D — open-world gameplay state/logic ──────────────────
// Framework-agnostic: everything is plain (x, z) world coordinates. The
// React component's Three.js scene reads this state each frame and maps
// it onto meshes/camera — this file never touches THREE or the DOM, same
// engine/render split as the other games in this hub. The component is
// responsible for turning mouse-look + WASD into a camera-relative
// {moveX, moveZ} direction before calling stepWorld — this file doesn't
// know about the camera at all.
import { ENEMY_TYPES, MAP_HALF, DOCKS_START, HIDEOUT_START, DISTRICTS, districtAt, HOME_BASE, SHOP_ITEMS, BOSS_ARENA } from './constants.js'

export const GRAVITY = -34
export const JUMP_V = 12
const MOVE_SPEED = 6.4
const PLAYER_RADIUS = 0.55
const MELEE_COOLDOWN = 0.35
const MELEE_ACTIVE = 0.14
const MELEE_RANGE = 2.6
const TOUCH_RANGE = 1.5
const PICKUP_RANGE = 1.6
const PROJ_SPEED = 20
const PROJ_RANGE = 22
export const BUFF_DURATION = 7
const HIT_STUN = 0.6
const LIVES_START = 3
export const MAX_LIVES = 5

const ENEMY_COUNT = 16
const ENEMY_AGGRO_RADIUS = 9
const ENEMY_CHASE_SPEED = 2.6
const ENEMY_WANDER_SPEED = 1.0
const ENEMY_RESPAWN_DELAY = 6

const COIN_COUNT = 26
const COIN_RESPAWN_DELAY = 5

const POWERUP_COUNT = 3
const POWERUP_RESPAWN_DELAY = 14

export const SCORE_ENEMY = 250
export const SCORE_COIN = 50
export const SCORE_BOSS = 2000

// Nab this many bad guys and Robo-Bronto wakes up in its lair at
// BOSS_ARENA (see constants.js) — beating it is the actual win condition.
// Enemies respawn (see ENEMY_RESPAWN_DELAY) so this is always reachable.
export const TARGET_CAPTURES = 12

const BOSS_HP = 5
const BOSS_TOUCH_RANGE = 2.4
const BOSS_AGGRO_RADIUS = 20
const BOSS_CHASE_SPEED = 2.0
const BOSS_HIT_COOLDOWN = 0.5

function rand(a, b) { return a + Math.random() * (b - a) }
function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz) }

// Keeps a generous walkable clearing around spawn (0,0) so the player
// never respawns nose-to-nose with a hazard.
function randomMapPoint(minDistFromOrigin = 8) {
  let x, z
  do {
    x = rand(-MAP_HALF + 6, MAP_HALF - 6)
    z = rand(-MAP_HALF + 6, MAP_HALF - 6)
  } while (Math.hypot(x, z) < minDistFromOrigin)
  return { x, z }
}

function spawnEnemy(id) {
  const { x, z } = randomMapPoint(10)
  const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)].key
  return { id, type, x, z, homeX: x, homeZ: z, target: { x, z }, state: 'wander', wanderTimer: rand(1, 3), alive: true, respawnTimer: 0 }
}

function spawnCoin(id) {
  const { x, z } = randomMapPoint(4)
  return { id, x, z, alive: true, respawnTimer: 0 }
}

function spawnPowerup(id, projType) {
  const { x, z } = randomMapPoint(10)
  const ptype = Math.random() < 0.4 ? 'star' : projType
  return { id, x, z, ptype, alive: true, respawnTimer: 0 }
}

const BUILDING_COUNTS = { hideout: 16, city: 20, docks: 14 }

// Generated once per session and shared verbatim between the engine (for
// player-vs-building collision) and the renderer (for the actual meshes)
// so the two never drift apart — see DogManDash.jsx.
export function generateBuildings() {
  const buildings = []
  function scatter(zMin, zMax, colors, count, avoidPoints) {
    for (let i = 0; i < count; i++) {
      const x = rand(-MAP_HALF + 5, MAP_HALF - 5)
      const z = rand(zMin + 5, zMax - 5)
      if (avoidPoints.some(p => Math.hypot(x - p.x, z - p.z) < p.r)) continue
      buildings.push({ x, z, w: rand(4, 8), d: rand(4, 8), h: rand(4, 13), color: colors[Math.floor(Math.random() * colors.length)] })
    }
  }
  // Spawn (0,0) and the HOME_BASE shop each keep a building-free clearing
  // so neither ever generates boxed in.
  scatter(-MAP_HALF, HIDEOUT_START, DISTRICTS.hideout.buildings, BUILDING_COUNTS.hideout, [{ x: HOME_BASE.x, z: HOME_BASE.z, r: 11 }])
  scatter(HIDEOUT_START, DOCKS_START, DISTRICTS.city.buildings, BUILDING_COUNTS.city, [{ x: 0, z: 0, r: 11 }])
  scatter(DOCKS_START, MAP_HALF, DISTRICTS.docks.buildings, BUILDING_COUNTS.docks, [])
  return buildings
}

function collidesBuilding(buildings, x, z, radius) {
  return buildings.some(b => x + radius > b.x - b.w / 2 && x - radius < b.x + b.w / 2 && z + radius > b.z - b.d / 2 && z - radius < b.z + b.d / 2)
}

export function createWorldState(charProjType, carry, buildings) {
  return {
    status: 'running', // running | hit | dead | won
    x: 0, z: 0, y: 0, vy: 0, onGround: true,
    buildings: buildings || [],
    lives: carry?.lives ?? LIVES_START,
    score: carry?.score ?? 0,
    coins: carry?.coins ?? 0,
    captures: carry?.captures ?? 0,
    boss: carry?.boss ?? null,
    heldItem: null,
    buff: null, // { type, timer }
    laserTimer: 0, laserZap: null,
    meleeCooldown: 0, meleeActive: 0,
    hitTimer: 0, invuln: 1.0,
    projectiles: [],
    enemies: Array.from({ length: ENEMY_COUNT }, (_, i) => spawnEnemy(i)),
    coinPool: Array.from({ length: COIN_COUNT }, (_, i) => spawnCoin(i)),
    powerups: Array.from({ length: POWERUP_COUNT }, (_, i) => spawnPowerup(i, charProjType)),
    projType: charProjType,
    lastJumpHeld: false, lastAttackHeld: false,
  }
}

function edge(input, key, state, flag) {
  const held = !!input[key]
  const was = state[flag]
  state[flag] = held
  return held && !was
}

export function stepWorld(state, input, dt) {
  if (state.status === 'dead' || state.status === 'won') return

  if (state.hitTimer > 0) {
    state.hitTimer -= dt
    state.vy += GRAVITY * dt
    state.y = Math.max(0, state.y + state.vy * dt)
    if (state.y === 0) { state.vy = 0; state.onGround = true }
    if (state.hitTimer <= 0) {
      state.hitTimer = 0
      state.status = state.lives > 0 ? 'running' : 'dead'
    }
    tickPools(state, dt)
    return
  }

  // Axis-separated movement against building AABBs — lets the player
  // slide along a wall instead of just stopping dead against it.
  const moveLen = Math.hypot(input.moveX || 0, input.moveZ || 0)
  if (moveLen > 0.001) {
    const nx = state.x + (input.moveX / moveLen) * MOVE_SPEED * dt
    if (!collidesBuilding(state.buildings, nx, state.z, PLAYER_RADIUS)) state.x = nx
    const nz = state.z + (input.moveZ / moveLen) * MOVE_SPEED * dt
    if (!collidesBuilding(state.buildings, state.x, nz, PLAYER_RADIUS)) state.z = nz
  }
  state.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, state.x))
  state.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, state.z))

  if (edge(input, 'jump', state, 'lastJumpHeld') && state.onGround) {
    state.vy = JUMP_V
    state.onGround = false
  }
  state.vy += GRAVITY * dt
  state.y += state.vy * dt
  if (state.y <= 0) { state.y = 0; state.vy = 0; state.onGround = true }

  if (state.invuln > 0) state.invuln -= dt
  if (state.meleeCooldown > 0) state.meleeCooldown -= dt
  if (state.meleeActive > 0) state.meleeActive -= dt
  if (state.buff) {
    state.buff.timer -= dt
    if (state.buff.timer <= 0) state.buff = null
  }

  if (edge(input, 'attack', state, 'lastAttackHeld')) {
    if (state.heldItem) {
      const [dx, dz] = facingVector(input)
      state.projectiles.push({ x: state.x, z: state.z, startX: state.x, startZ: state.z, dx, dz, type: state.heldItem })
      state.heldItem = null
    } else if (state.meleeCooldown <= 0) {
      state.meleeCooldown = MELEE_COOLDOWN
      state.meleeActive = MELEE_ACTIVE
    }
  }

  // Projectiles fly in whatever direction the player was last moving (or
  // straight ahead of the camera if standing still — see facingVector).
  state.projectiles.forEach(p => { p.x += p.dx * PROJ_SPEED * dt; p.z += p.dz * PROJ_SPEED * dt })
  state.projectiles = state.projectiles.filter(p => dist(p.x, p.z, p.startX, p.startZ) < PROJ_RANGE)

  for (const p of state.projectiles) {
    for (const e of state.enemies) {
      if (!e.alive || p.hit) continue
      if (dist(e.x, e.z, p.x, p.z) < TOUCH_RANGE) { defeatEnemy(state, e); p.hit = true }
    }
    if (!p.hit && state.boss?.alive && dist(state.boss.x, state.boss.z, p.x, p.z) < TOUCH_RANGE) {
      damageBoss(state); p.hit = true
    }
  }
  state.projectiles = state.projectiles.filter(p => !p.hit)

  const starred = state.buff?.type === 'star'
  const speechOn = state.buff?.type === 'speech'
  const laserOn = state.buff?.type === 'laser'

  if (laserOn) {
    state.laserTimer -= dt
    if (state.laserTimer <= 0) {
      state.laserTimer = 0.9
      const candidates = state.enemies.filter(e => e.alive && dist(e.x, e.z, state.x, state.z) < 20)
      if (state.boss?.alive && dist(state.boss.x, state.boss.z, state.x, state.z) < 24) candidates.push(state.boss)
      const target = candidates.sort((a, b) => dist(a.x, a.z, state.x, state.z) - dist(b.x, b.z, state.x, state.z))[0]
      if (target) {
        state.laserZap = { x: target.x, z: target.z }
        if (target === state.boss) damageBoss(state); else defeatEnemy(state, target)
      } else state.laserZap = null
    }
  } else {
    state.laserZap = null
  }

  // Enemy AI + collision
  for (const e of state.enemies) {
    if (!e.alive) continue
    const dToPlayer = dist(e.x, e.z, state.x, state.z)
    if (speechOn) {
      // Flee — Molly's speech buff scares everyone off for its duration.
      const fx = e.x - state.x, fz = e.z - state.z, flen = Math.hypot(fx, fz) || 1
      e.x += (fx / flen) * ENEMY_CHASE_SPEED * 1.4 * dt
      e.z += (fz / flen) * ENEMY_CHASE_SPEED * 1.4 * dt
    } else if (dToPlayer < ENEMY_AGGRO_RADIUS) {
      const dx = state.x - e.x, dz = state.z - e.z, len = Math.hypot(dx, dz) || 1
      e.x += (dx / len) * ENEMY_CHASE_SPEED * dt
      e.z += (dz / len) * ENEMY_CHASE_SPEED * dt
    } else {
      e.wanderTimer -= dt
      const dHome = dist(e.x, e.z, e.target.x, e.target.z)
      if (e.wanderTimer <= 0 || dHome < 0.5) {
        e.target = { x: e.homeX + rand(-8, 8), z: e.homeZ + rand(-8, 8) }
        e.wanderTimer = rand(2, 4)
      }
      const dx = e.target.x - e.x, dz = e.target.z - e.z, len = Math.hypot(dx, dz) || 1
      e.x += (dx / len) * ENEMY_WANDER_SPEED * dt
      e.z += (dz / len) * ENEMY_WANDER_SPEED * dt
    }

    if (!speechOn && dToPlayer < TOUCH_RANGE) {
      if (starred || state.meleeActive > 0) defeatEnemy(state, e)
      else if (state.invuln <= 0) hitPlayer(state)
    }
  }

  // Melee also reaches a little further than plain contact.
  if (state.meleeActive > 0) {
    for (const e of state.enemies) {
      if (e.alive && dist(e.x, e.z, state.x, state.z) < MELEE_RANGE) defeatEnemy(state, e)
    }
  }

  // The boss (see defeatEnemy, which spawns it once TARGET_CAPTURES is
  // hit) needs BOSS_HP separate hits rather than the one-hit kills that
  // clear regular enemies — damageBoss's own hitCooldown stops a single
  // melee swing (active for several frames) from registering more than
  // one hit.
  if (state.boss?.alive) {
    const b = state.boss
    if (b.hitCooldown > 0) b.hitCooldown -= dt
    const dToBoss = dist(b.x, b.z, state.x, state.z)
    if (dToBoss < BOSS_AGGRO_RADIUS) {
      const dx = state.x - b.x, dz = state.z - b.z, len = Math.hypot(dx, dz) || 1
      b.x += (dx / len) * BOSS_CHASE_SPEED * dt
      b.z += (dz / len) * BOSS_CHASE_SPEED * dt
    }
    if (dToBoss < BOSS_TOUCH_RANGE && state.invuln <= 0) hitPlayer(state)
    if ((starred || state.meleeActive > 0) && dToBoss < MELEE_RANGE) damageBoss(state)
  }

  for (const c of state.coinPool) {
    if (c.alive && dist(c.x, c.z, state.x, state.z) < PICKUP_RANGE) {
      c.alive = false; c.respawnTimer = COIN_RESPAWN_DELAY
      state.score += SCORE_COIN; state.coins++
    }
  }

  for (const pu of state.powerups) {
    if (pu.alive && dist(pu.x, pu.z, state.x, state.z) < PICKUP_RANGE) {
      pu.alive = false; pu.respawnTimer = POWERUP_RESPAWN_DELAY
      if (pu.ptype === 'star' || pu.ptype === 'laser' || pu.ptype === 'speech') state.buff = { type: pu.ptype, timer: BUFF_DURATION }
      else state.heldItem = pu.ptype
    }
  }

  tickPools(state, dt)
}

function tickPools(state, dt) {
  for (const e of state.enemies) {
    if (e.alive) continue
    e.respawnTimer -= dt
    if (e.respawnTimer <= 0) Object.assign(e, spawnEnemy(e.id))
  }
  for (const c of state.coinPool) {
    if (c.alive) continue
    c.respawnTimer -= dt
    if (c.respawnTimer <= 0) Object.assign(c, spawnCoin(c.id))
  }
  for (const pu of state.powerups) {
    if (pu.alive) continue
    pu.respawnTimer -= dt
    if (pu.respawnTimer <= 0) Object.assign(pu, spawnPowerup(pu.id, state.projType))
  }
}

function facingVector(input) {
  const len = Math.hypot(input.moveX || 0, input.moveZ || 0)
  if (len > 0.001) return [input.moveX / len, input.moveZ / len]
  return [input.facingX ?? 0, input.facingZ ?? 1]
}

function defeatEnemy(state, e) {
  e.alive = false
  e.respawnTimer = ENEMY_RESPAWN_DELAY
  state.score += SCORE_ENEMY
  state.captures++
  if (state.captures >= TARGET_CAPTURES && !state.boss) {
    state.boss = { x: BOSS_ARENA.x, z: BOSS_ARENA.z, hp: BOSS_HP, maxHp: BOSS_HP, hitCooldown: 0, alive: true }
  }
}

function damageBoss(state) {
  const b = state.boss
  if (!b || !b.alive || b.hitCooldown > 0) return
  b.hp--
  b.hitCooldown = BOSS_HIT_COOLDOWN
  if (b.hp <= 0) {
    b.alive = false
    state.score += SCORE_BOSS
    state.status = 'won'
  }
}

function hitPlayer(state) {
  state.lives--
  state.status = 'hit'
  state.hitTimer = HIT_STUN
  state.invuln = HIT_STUN + 1.2
  state.vy = 6
  state.onGround = false
  state.heldItem = null
}

export function currentDistrictName(state) {
  return districtAt(state.z).name
}

// Spends run coins on a SHOP_ITEMS entry. Returns false (no-op, no coins
// spent) if unaffordable or if the item wouldn't do anything right now
// (already holding a weapon, already at max lives) — the component uses
// this to grey out buttons.
export function buyShopItem(state, key) {
  const item = SHOP_ITEMS.find(i => i.key === key)
  if (!item || state.coins < item.cost) return false
  if (key === 'weapon') {
    if (state.heldItem) return false
    state.heldItem = state.projType
  } else if (key === 'star') {
    state.buff = { type: 'star', timer: BUFF_DURATION }
  } else if (key === 'life') {
    if (state.lives >= MAX_LIVES) return false
    state.lives++
  } else {
    return false
  }
  state.coins -= item.cost
  return true
}
