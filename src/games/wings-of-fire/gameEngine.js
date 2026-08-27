// ── Wings of Fire: Talon Clash — pure gameplay state/logic ──────────────
// Framework-agnostic: plain (x, y, z) world coordinates, no THREE, no DOM.
// Same engine/render split as this hub's other 3D games. Movement is the
// same yaw-turn + forward/back scheme as Loot & Scoot, with a free vertical
// axis added for flight (no gravity — dragons hover). Breath attacks fire
// flat along the shooter's horizontal facing at its current altitude, so
// matching altitude with your target is itself a real tactic.
import { MAP_HALF, ARENA_MIN_Y, ARENA_MAX_Y, TRIBES, getTribe, WAVES, HEAL_BETWEEN_WAVES } from './constants.js'

const TURN_SPEED = 2.3
const BASE_SPEED = 11
const CLIMB_SPEED = 9
const DRAGON_RADIUS = 1.3

function rand(a, b) { return a + Math.random() * (b - a) }
function dist3(ax, ay, az, bx, by, bz) { return Math.hypot(ax - bx, ay - by, az - bz) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function createDragon(id, tribeKey, x, y, z, yaw, isCPU) {
  const tribe = getTribe(tribeKey)
  return {
    id, tribe: tribeKey, x, y, z, yaw,
    hp: tribe.maxHp, maxHp: tribe.maxHp,
    clawCooldown: 0, breathCooldown: 0,
    charging: false, chargeTimer: 0, chargeHit: false,
    slowTimer: 0, slowMult: 1,
    poisonTimer: 0, poisonDps: 0,
    camoTimer: 0, hitFlash: 0,
    alive: true, isCPU: !!isCPU,
    aiTargetId: null, aiJitter: rand(-1, 1),
  }
}

function spawnWaveEnemy(state) {
  const w = WAVES[state.wave]
  const tribe = getTribe(w.tribe)
  const angle = rand(0, Math.PI * 2)
  const radius = 26
  const enemy = createDragon('cpu', w.tribe, Math.cos(angle) * radius, rand(8, 16), Math.sin(angle) * radius, angle + Math.PI, true)
  enemy.maxHp = Math.round(tribe.maxHp * w.hpMult)
  enemy.hp = enemy.maxHp
  state.dragons.push(enemy)
}

export function createSoloState(playerTribeKey) {
  const player = createDragon('p1', playerTribeKey, 0, 12, 0, 0, false)
  const state = {
    mode: 'solo',
    dragons: [player],
    projectiles: [],
    wave: 0,
    result: null, // null | 'victory' | 'defeat'
    toast: null,
  }
  spawnWaveEnemy(state)
  return state
}

export function createDuelState(tribeA, tribeB) {
  const p1 = createDragon('p1', tribeA, -16, 12, 0, -Math.PI / 2, false)
  const p2 = createDragon('p2', tribeB, 16, 12, 0, Math.PI / 2, false)
  return { mode: 'duel', dragons: [p1, p2], projectiles: [], result: null, toast: null }
}

// A practice arena: the player plus one stationary, effectively-unkillable
// training dummy (isCPU: false, so it never receives AI input and just
// sits there) — lets a new player try every control without any pressure.
export function createTutorialState(tribeKey) {
  const player = createDragon('p1', tribeKey, 0, 12, 8, 0, false)
  const dummy = createDragon('dummy', 'mudwing', 0, 12, -8, Math.PI, false)
  dummy.maxHp = 9999
  dummy.hp = 9999
  return { mode: 'tutorial', dragons: [player, dummy], projectiles: [], result: null, toast: null }
}

function setToast(state, text, kind = 'info') { state.toast = { text, timer: 2.8, kind } }

function facingVec(yaw) { return { fx: -Math.sin(yaw), fz: -Math.cos(yaw) } }

function effectiveSpeed(dragon, tribe) {
  let mult = tribe.speedMult * (dragon.slowTimer > 0 ? dragon.slowMult : 1)
  if (dragon.charging) mult *= tribe.charge.speedMult
  return BASE_SPEED * mult
}

function applyDamage(state, target, amount, tag) {
  const tribe = getTribe(target.tribe)
  let dmg = amount
  if (tag === 'fire' && tribe.fireResist) dmg *= (1 - tribe.fireResist)
  target.hp -= dmg
  target.hitFlash = 0.25
  if (target.hp <= 0 && target.alive) {
    target.hp = 0
    target.alive = false
  }
}

function aiInputFor(state, dragon, dt) {
  const others = state.dragons.filter(d => d.id !== dragon.id && d.alive)
  const target = others[0]
  const input = { turn: 0, thrust: 0, vertical: 0, claw: false, breath: false }
  if (!target) return input

  let desiredYaw = Math.atan2(-(target.x - dragon.x), -(target.z - dragon.z))
  // A camouflaged target is much harder to aim at — the AI's intended
  // heading gets a persistent random skew for the duration.
  if (target.camoTimer > 0) desiredYaw += dragon.aiJitter * 0.5
  let diff = desiredYaw - dragon.yaw
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  input.turn = clamp(diff / (TURN_SPEED * dt || 1), -1, 1)

  const d = dist3(dragon.x, dragon.y, dragon.z, target.x, target.y, target.z)
  const tribe = getTribe(dragon.tribe)
  if (tribe.breath) {
    // Ranged tribes hover at a preferred firing distance instead of
    // closing all the way in.
    const preferred = 13
    input.thrust = d > preferred ? 1 : (d < preferred - 5 ? -0.4 : 0)
  } else {
    // Melee-only (charge) tribes have no reason to keep distance — always
    // close in, or they can never get within charge range.
    input.thrust = d > 2.5 ? 1 : 0
  }
  input.vertical = target.y > dragon.y + 1 ? 1 : (target.y < dragon.y - 1 ? -1 : 0)

  const facingOk = Math.abs(diff) < 0.35
  if (d < (tribe.claw.range + 0.5) && dragon.clawCooldown <= 0) input.claw = true
  else if (facingOk && dragon.breathCooldown <= 0 && d < (tribe.breath ? tribe.breath.speed * tribe.breath.life * 0.6 : tribe.charge.range + 2)) input.breath = true

  return input
}

function stepDragon(state, dragon, input, dt) {
  if (!dragon.alive) return
  const tribe = getTribe(dragon.tribe)

  dragon.yaw += input.turn * TURN_SPEED * dt
  const { fx, fz } = facingVec(dragon.yaw)
  const speed = effectiveSpeed(dragon, tribe)
  // A charge is a committed lunge — it drives the dragon forward on its
  // own, whether or not the forward key happens to be held.
  const thrust = dragon.charging ? 1 : input.thrust
  dragon.x += fx * thrust * speed * dt
  dragon.z += fz * thrust * speed * dt
  dragon.y += input.vertical * CLIMB_SPEED * dt
  dragon.x = clamp(dragon.x, -MAP_HALF, MAP_HALF)
  dragon.z = clamp(dragon.z, -MAP_HALF, MAP_HALF)
  dragon.y = clamp(dragon.y, ARENA_MIN_Y, ARENA_MAX_Y)

  if (dragon.clawCooldown > 0) dragon.clawCooldown -= dt
  if (dragon.breathCooldown > 0) dragon.breathCooldown -= dt
  if (dragon.hitFlash > 0) dragon.hitFlash -= dt
  if (dragon.slowTimer > 0) { dragon.slowTimer -= dt; if (dragon.slowTimer <= 0) dragon.slowMult = 1 }
  if (dragon.camoTimer > 0) dragon.camoTimer -= dt
  if (dragon.poisonTimer > 0) {
    dragon.poisonTimer -= dt
    applyDamage(state, dragon, dragon.poisonDps * dt, 'poison')
  }
  if (dragon.charging) {
    dragon.chargeTimer -= dt
    if (dragon.chargeTimer <= 0) { dragon.charging = false; dragon.chargeHit = false }
  }

  if (input.claw && dragon.clawCooldown <= 0 && dragon.alive) {
    const targets = state.dragons.filter(o => o.id !== dragon.id && o.alive)
    const hit = targets.find(o => dist3(dragon.x, dragon.y, dragon.z, o.x, o.y, o.z) < tribe.claw.range)
    if (hit) {
      applyDamage(state, hit, tribe.claw.damage, null)
      setToast(state, `${tribe.name} claws for ${tribe.claw.damage}!`, dragon.isCPU ? 'bad' : 'good')
    }
    dragon.clawCooldown = tribe.claw.cooldown
  }

  if (input.breath && dragon.breathCooldown <= 0 && dragon.alive) {
    if (tribe.breath) {
      const b = tribe.breath
      state.projectiles.push({
        x: dragon.x + fx * (tribe.claw.range - 0.5), y: dragon.y, z: dragon.z + fz * (tribe.claw.range - 0.5),
        vx: fx * b.speed, vy: 0, vz: fz * b.speed,
        life: b.life, radius: b.radius, damage: b.damage, tag: b.tag,
        dot: b.dot || null, slow: b.slow || null, knockback: b.knockback || 0, camo: b.camo || 0,
        ownerId: dragon.id, color: b.color,
      })
      if (b.camo) dragon.camoTimer = b.camo
    } else if (tribe.charge) {
      dragon.charging = true
      dragon.chargeTimer = tribe.charge.duration
      dragon.chargeHit = false
    }
    dragon.breathCooldown = tribe.charge ? tribe.charge.cooldown : tribe.breath.cooldown
  }

  if (dragon.charging && !dragon.chargeHit) {
    const targets = state.dragons.filter(o => o.id !== dragon.id && o.alive)
    const hit = targets.find(o => dist3(dragon.x, dragon.y, dragon.z, o.x, o.y, o.z) < tribe.charge.range)
    if (hit) {
      applyDamage(state, hit, tribe.charge.damage, null)
      dragon.chargeHit = true
      setToast(state, `${tribe.name} slams for ${tribe.charge.damage}!`, dragon.isCPU ? 'bad' : 'good')
    }
  }
}

function stepProjectiles(state, dt) {
  state.projectiles = state.projectiles.filter(p => {
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
    p.life -= dt
    if (p.life <= 0) return false
    if (Math.abs(p.x) > MAP_HALF + 10 || Math.abs(p.z) > MAP_HALF + 10) return false
    const target = state.dragons.find(d => d.id !== p.ownerId && d.alive && dist3(d.x, d.y, d.z, p.x, p.y, p.z) < p.radius + DRAGON_RADIUS)
    if (target) {
      applyDamage(state, target, p.damage, p.tag)
      if (p.dot) { target.poisonTimer = p.dot.duration; target.poisonDps = p.dot.damage }
      if (p.slow) { target.slowTimer = p.slow.duration; target.slowMult = p.slow.mult }
      if (p.knockback) {
        const dx = target.x - p.x, dz = target.z - p.z, len = Math.hypot(dx, dz) || 1
        target.x += (dx / len) * p.knockback
        target.z += (dz / len) * p.knockback
      }
      return false
    }
    return true
  })
}

export function stepGame(state, inputsById, dt) {
  if (state.result) return

  for (const dragon of state.dragons) {
    if (!dragon.alive) continue
    const input = dragon.isCPU ? aiInputFor(state, dragon, dt) : (inputsById[dragon.id] || { turn: 0, thrust: 0, vertical: 0, claw: false, breath: false })
    stepDragon(state, dragon, input, dt)
  }
  stepProjectiles(state, dt)

  if (state.toast) { state.toast.timer -= dt; if (state.toast.timer <= 0) state.toast = null }

  if (state.mode === 'solo') {
    const player = state.dragons.find(d => d.id === 'p1')
    const enemy = state.dragons.find(d => d.id === 'cpu')
    if (!player.alive) { state.result = 'defeat'; return }
    if (enemy && !enemy.alive) {
      state.dragons = state.dragons.filter(d => d.id !== 'cpu')
      if (state.wave + 1 >= WAVES.length) {
        state.result = 'victory'
      } else {
        state.wave += 1
        player.hp = Math.min(player.maxHp, player.hp + HEAL_BETWEEN_WAVES)
        spawnWaveEnemy(state)
        setToast(state, `Wave ${state.wave + 1}: a ${getTribe(WAVES[state.wave].tribe).name} approaches!`, 'good')
      }
    }
  } else if (state.mode === 'duel') {
    const p1 = state.dragons.find(d => d.id === 'p1')
    const p2 = state.dragons.find(d => d.id === 'p2')
    if (!p1.alive) state.result = 'p2'
    else if (!p2.alive) state.result = 'p1'
  }
}
