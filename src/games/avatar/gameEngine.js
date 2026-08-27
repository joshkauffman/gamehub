// ── Avatar: Elemental Grounds — pure gameplay state/logic ───────────────
// Framework-agnostic: plain (x, z) world coordinates, no THREE, no DOM.
// Two phases share one continuous world instead of separate scenes:
// 'explore' (free-roam, find your opponent) and 'battle' (once a pair
// gets close enough, they're held near the spot they met and combat
// unlocks — same claw + cooldown-based special-attack resolution as
// Wings of Fire's flight combat, just ground-based with no vertical axis).
// Each bender now has two independent bending moves (see constants.js's
// `moves` doc comment for the 'projectile'/'self'/'burst' kinds) plus the
// claw, each on its own cooldown. `state.effects` is a transient queue of
// one-shot visual events (cast flashes, impacts, buff pulses) — pure data,
// consumed and rendered by Avatar.jsx same as projectiles.
import {
  WORLD_HALF, TRIGGER_RADIUS, BATTLE_RING_RADIUS, UNIT_RADIUS,
  BENDERS, getBender, WAVES, HEAL_BETWEEN_WAVES, MONUMENTS,
} from './constants.js'

const TURN_SPEED = 2.6
const BASE_SPEED = 7.5
const WANDER_SPEED = 2.2
const MAX_ARMOR = 0.85

function rand(a, b) { return a + Math.random() * (b - a) }
function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function facingVec(yaw) { return { fx: -Math.sin(yaw), fz: -Math.cos(yaw) } }

function collidesAny(rects, x, z, radius) {
  return rects.some(b => x + radius > b.x - b.w / 2 && x - radius < b.x + b.w / 2 && z + radius > b.z - b.d / 2 && z - radius < b.z + b.d / 2)
}

// Decorative monument footprints plus a scatter of rock/pillar props —
// generated once per game so the engine (collision) and renderer (meshes)
// never drift apart, same technique as Loot & Scoot's generateWorld().
export function generateWorld() {
  const colliders = MONUMENTS.map(m => ({ x: m.x, z: m.z, w: 5, d: 5, element: m.element }))
  const props = []
  for (let i = 0; i < 16; i++) {
    let x, z
    do {
      x = rand(-WORLD_HALF + 5, WORLD_HALF - 5)
      z = rand(-WORLD_HALF + 5, WORLD_HALF - 5)
    } while (dist2(x, z, 0, 0) < 10 || MONUMENTS.some(m => dist2(x, z, m.x, m.z) < 9))
    const size = rand(1.2, 2.4)
    props.push({ x, z, w: size, d: size, h: rand(1, 2.6) })
  }
  return { colliders: [...colliders, ...props], monuments: MONUMENTS, props }
}

export function createUnit(id, elementKey, x, z, yaw, isCPU) {
  const b = getBender(elementKey)
  return {
    id, element: elementKey, x, z, yaw,
    hp: b.maxHp, maxHp: b.maxHp,
    clawCooldown: 0, moveCooldowns: b.moves.map(() => 0),
    slowTimer: 0, slowMult: 1,
    dotTimer: 0, dotDps: 0,
    camoTimer: 0, hitFlash: 0,
    armorBonus: 0, armorBonusTimer: 0,
    speedBonusMult: 1, speedBonusTimer: 0,
    alive: true, isCPU: !!isCPU,
    engaged: false,
    wanderTarget: { x, z }, wanderTimer: rand(1, 3),
    aiJitter: rand(-1, 1),
  }
}

function randomSpawnPoint(minDistFrom) {
  let x, z
  do {
    x = rand(-WORLD_HALF + 6, WORLD_HALF - 6)
    z = rand(-WORLD_HALF + 6, WORLD_HALF - 6)
  } while (minDistFrom && dist2(x, z, minDistFrom.x, minDistFrom.z) < 14)
  return { x, z }
}

function spawnWaveOpponent(state) {
  const w = WAVES[state.wave]
  const b = getBender(w.element)
  const player = state.units.find(u => u.id === 'p1')
  const { x, z } = randomSpawnPoint(player)
  const opp = createUnit('cpu', w.element, x, z, rand(0, Math.PI * 2), true)
  opp.maxHp = Math.round(b.maxHp * w.hpMult)
  opp.hp = opp.maxHp
  state.units.push(opp)
}

export function createSoloState(playerElementKey) {
  const world = generateWorld()
  const player = createUnit('p1', playerElementKey, 0, 0, 0, false)
  const state = {
    mode: 'solo', phase: 'explore', wave: 0,
    units: [player], projectiles: [], effects: [], colliders: world.colliders, world,
    battleCenter: null, result: null, toast: null,
  }
  spawnWaveOpponent(state)
  return state
}

export function createDuelState(elementA, elementB) {
  const world = generateWorld()
  // Face each other, not away — yaw uses the same convention as facingVec
  // (fx,fz) = (-sin(yaw), -cos(yaw)), so facing the other spawn point from
  // (-14,-14) toward (14,14) is -3π/4, not +3π/4 (a mirrored sign here
  // previously sent both players walking away from each other on pure
  // "forward" — same class of bug documented for Lil' Monster Battles).
  const p1 = createUnit('p1', elementA, -14, -14, -Math.PI * 0.75, false)
  const p2 = createUnit('p2', elementB, 14, 14, Math.PI * 0.25, false)
  return {
    mode: 'duel', phase: 'explore', wave: 0,
    units: [p1, p2], projectiles: [], effects: [], colliders: world.colliders, world,
    battleCenter: null, result: null, toast: null,
  }
}

function setToast(state, text, kind = 'info') { state.toast = { text, timer: 2.8, kind } }

// A transient one-shot visual event — cast flash, impact ring, buff pulse.
// Pure data; Avatar.jsx renders and expires these the same way it does
// projectiles, via a pooled-mesh sync each frame.
function pushEffect(state, x, z, color, radius, life, kind = 'hit') {
  state.effects.push({ x, z, color, radius, life, maxLife: life, kind })
}

function effectiveSpeed(unit, bender, base) {
  const slowMult = unit.slowTimer > 0 ? unit.slowMult : 1
  const boostMult = unit.speedBonusTimer > 0 ? unit.speedBonusMult : 1
  return base * bender.speedMult * slowMult * boostMult
}

function applyDamage(state, target, amount, tag) {
  const bender = getBender(target.element)
  const totalArmor = Math.min(MAX_ARMOR, (bender.armor || 0) + (target.armorBonus || 0))
  const dmg = amount * (1 - totalArmor)
  target.hp -= dmg
  target.hitFlash = 0.25
  if (target.hp <= 0 && target.alive) { target.hp = 0; target.alive = false }
}

// Before engagement, an unengaged CPU just wanders near its spawn point —
// same patrol shape as Loot & Scoot's guards, but yaw-driven so it turns
// to face where it's walking (the render layer uses that to orient meshes).
function wanderInput(state, unit, dt) {
  unit.wanderTimer -= dt
  const dHome = dist2(unit.x, unit.z, unit.wanderTarget.x, unit.wanderTarget.z)
  if (unit.wanderTimer <= 0 || dHome < 0.6) {
    unit.wanderTarget = { x: unit.x + rand(-8, 8), z: unit.z + rand(-8, 8) }
    unit.wanderTimer = rand(2, 4)
  }
  const desiredYaw = Math.atan2(-(unit.wanderTarget.x - unit.x), -(unit.wanderTarget.z - unit.z))
  let diff = desiredYaw - unit.yaw
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  const wanderThrust = (WANDER_SPEED / BASE_SPEED)
  return { turn: clamp(diff / (TURN_SPEED * dt || 1), -1, 1), thrust: dHome > 0.6 ? wanderThrust : 0, claw: false, moves: [] }
}

// Once engaged, CPU fights back — same shape as Wings of Fire's aiInputFor:
// ranged benders hold a preferred distance and fire when facing, everyone
// claws when close. With two moves now available, the AI just tries each
// in order and uses the first one that's off cooldown and applicable.
function battleAiInput(state, unit, dt) {
  const target = state.units.find(u => u.id !== unit.id && u.alive)
  const bender = getBender(unit.element)
  const input = { turn: 0, thrust: 0, claw: false, moves: bender.moves.map(() => false) }
  if (!target) return input

  let desiredYaw = Math.atan2(-(target.x - unit.x), -(target.z - unit.z))
  if (target.camoTimer > 0) desiredYaw += unit.aiJitter * 0.5
  let diff = desiredYaw - unit.yaw
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  input.turn = clamp(diff / (TURN_SPEED * dt || 1), -1, 1)

  const d = dist2(unit.x, unit.z, target.x, target.z)
  const preferred = 10
  input.thrust = d > preferred ? 1 : (d < preferred - 4 ? -0.4 : 0)

  const facingOk = Math.abs(diff) < 0.35
  if (d < (bender.claw.range + 0.5) && unit.clawCooldown <= 0) {
    input.claw = true
  } else {
    for (let i = 0; i < bender.moves.length; i++) {
      const move = bender.moves[i]
      if (unit.moveCooldowns[i] > 0) continue
      const usable = move.kind === 'projectile' ? (facingOk && d < move.speed * move.life * 0.6)
        : move.kind === 'burst' ? d < move.radius
        : true // 'self'
      if (usable) { input.moves[i] = true; break }
    }
  }

  return input
}

function resolveMove(state, unit, bender, move, idx, fx, fz) {
  if (move.kind === 'projectile') {
    // No cast-time toast here — with cooldowns as short as ~1s on some
    // filler moves, that would spam the toast constantly. The meaningful
    // moment is the hit, toasted from stepProjectiles when it lands.
    state.projectiles.push({
      x: unit.x + fx * (bender.claw.range - 0.5), z: unit.z + fz * (bender.claw.range - 0.5),
      vx: fx * move.speed, vz: fz * move.speed,
      life: move.life, radius: move.radius, damage: move.damage, tag: move.tag,
      dot: move.dot || null, slow: move.slow || null, knockback: move.knockback || 0, camo: move.camo || 0,
      ownerId: unit.id, ownerIsCPU: unit.isCPU, moveName: move.name, color: move.color,
    })
    if (move.camo) unit.camoTimer = move.camo
    pushEffect(state, unit.x + fx * 1.1, unit.z + fz * 1.1, move.color, 0.7, 0.3, 'cast')
  } else if (move.kind === 'self') {
    if (move.heal) unit.hp = Math.min(unit.maxHp, unit.hp + move.heal)
    if (move.armorBonus) { unit.armorBonus = move.armorBonus.amount; unit.armorBonusTimer = move.armorBonus.duration }
    if (move.speedBonus) { unit.speedBonusMult = 1 + move.speedBonus.mult; unit.speedBonusTimer = move.speedBonus.duration }
    pushEffect(state, unit.x, unit.z, move.color, 1.3, 0.6, 'buff')
    setToast(state, `${bender.name} uses ${move.name}!`, unit.isCPU ? 'bad' : 'good')
  } else if (move.kind === 'burst') {
    const hits = state.units.filter(o => o.id !== unit.id && o.alive && dist2(unit.x, unit.z, o.x, o.z) < move.radius)
    hits.forEach(t => {
      applyDamage(state, t, move.damage, move.tag)
      if (t.alive) {
        if (move.slow) { t.slowTimer = move.slow.duration; t.slowMult = move.slow.mult }
        if (move.knockback) {
          const dx = t.x - unit.x, dz = t.z - unit.z, len = Math.hypot(dx, dz) || 1
          t.x += (dx / len) * move.knockback
          t.z += (dz / len) * move.knockback
        }
      }
    })
    pushEffect(state, unit.x, unit.z, move.color, move.radius, 0.4, 'burst')
    if (hits.length) setToast(state, `${bender.name}'s ${move.name} hits!`, unit.isCPU ? 'bad' : 'good')
  }
  unit.moveCooldowns[idx] = move.cooldown
}

function stepUnit(state, unit, input, dt) {
  if (!unit.alive) return
  const bender = getBender(unit.element)

  unit.yaw += input.turn * TURN_SPEED * dt
  const { fx, fz } = facingVec(unit.yaw)
  const speed = effectiveSpeed(unit, bender, BASE_SPEED)
  let nx = unit.x + fx * input.thrust * speed * dt
  let nz = unit.z + fz * input.thrust * speed * dt

  if (state.phase === 'battle' && unit.engaged && state.battleCenter) {
    const { x: cx, z: cz } = state.battleCenter
    const dFromCenter = dist2(nx, nz, cx, cz)
    if (dFromCenter > BATTLE_RING_RADIUS) {
      const dx = nx - cx, dz = nz - cz, len = Math.hypot(dx, dz) || 1
      nx = cx + (dx / len) * BATTLE_RING_RADIUS
      nz = cz + (dz / len) * BATTLE_RING_RADIUS
    }
  } else {
    nx = clamp(nx, -WORLD_HALF, WORLD_HALF)
    nz = clamp(nz, -WORLD_HALF, WORLD_HALF)
  }
  if (!collidesAny(state.colliders, nx, unit.z, UNIT_RADIUS)) unit.x = nx
  if (!collidesAny(state.colliders, unit.x, nz, UNIT_RADIUS)) unit.z = nz

  if (unit.clawCooldown > 0) unit.clawCooldown -= dt
  for (let i = 0; i < unit.moveCooldowns.length; i++) if (unit.moveCooldowns[i] > 0) unit.moveCooldowns[i] -= dt
  if (unit.hitFlash > 0) unit.hitFlash -= dt
  if (unit.slowTimer > 0) { unit.slowTimer -= dt; if (unit.slowTimer <= 0) unit.slowMult = 1 }
  if (unit.camoTimer > 0) unit.camoTimer -= dt
  if (unit.armorBonusTimer > 0) { unit.armorBonusTimer -= dt; if (unit.armorBonusTimer <= 0) unit.armorBonus = 0 }
  if (unit.speedBonusTimer > 0) { unit.speedBonusTimer -= dt; if (unit.speedBonusTimer <= 0) unit.speedBonusMult = 1 }
  if (unit.dotTimer > 0) { unit.dotTimer -= dt; applyDamage(state, unit, unit.dotDps * dt, 'dot') }

  if (!unit.engaged || state.phase !== 'battle') return // no attacking before engagement

  if (input.claw && unit.clawCooldown <= 0 && unit.alive) {
    const targets = state.units.filter(o => o.id !== unit.id && o.alive)
    const hit = targets.find(o => dist2(unit.x, unit.z, o.x, o.z) < bender.claw.range)
    if (hit) {
      applyDamage(state, hit, bender.claw.damage, null)
      pushEffect(state, hit.x, hit.z, 0xffffff, 0.7, 0.3, 'hit')
      setToast(state, `${bender.name} strikes for ${bender.claw.damage}!`, unit.isCPU ? 'bad' : 'good')
    }
    unit.clawCooldown = bender.claw.cooldown
  }

  bender.moves.forEach((move, idx) => {
    if (input.moves?.[idx] && unit.moveCooldowns[idx] <= 0 && unit.alive) {
      resolveMove(state, unit, bender, move, idx, fx, fz)
    }
  })
}

function stepProjectiles(state, dt) {
  state.projectiles = state.projectiles.filter(p => {
    p.x += p.vx * dt; p.z += p.vz * dt
    p.life -= dt
    if (p.life <= 0) return false
    if (Math.abs(p.x) > WORLD_HALF + 10 || Math.abs(p.z) > WORLD_HALF + 10) return false
    const target = state.units.find(u => u.id !== p.ownerId && u.alive && dist2(u.x, u.z, p.x, p.z) < p.radius + UNIT_RADIUS)
    if (target) {
      applyDamage(state, target, p.damage, p.tag)
      if (p.dot) { target.dotTimer = p.dot.duration; target.dotDps = p.dot.damage }
      if (p.slow) { target.slowTimer = p.slow.duration; target.slowMult = p.slow.mult }
      if (p.knockback) {
        const dx = target.x - p.x, dz = target.z - p.z, len = Math.hypot(dx, dz) || 1
        target.x += (dx / len) * p.knockback
        target.z += (dz / len) * p.knockback
      }
      pushEffect(state, p.x, p.z, p.color, Math.max(0.8, p.radius * 1.8), 0.4, 'hit')
      setToast(state, `${p.moveName} hits for ${Math.round(p.damage)}!`, p.ownerIsCPU ? 'bad' : 'good')
      return false
    }
    return true
  })
}

function stepEffects(state, dt) {
  state.effects = state.effects.filter(e => { e.life -= dt; return e.life > 0 })
}

function checkEngagement(state) {
  if (state.phase !== 'explore') return
  const units = state.units.filter(u => u.alive)
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j]
      if (dist2(a.x, a.z, b.x, b.z) < TRIGGER_RADIUS) {
        state.phase = 'battle'
        a.engaged = true; b.engaged = true
        state.battleCenter = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
        const cpuUnit = a.isCPU ? a : (b.isCPU ? b : null)
        const label = cpuUnit ? getBender(cpuUnit.element).name : 'Your opponent'
        setToast(state, `${label} encountered — fight!`, 'info')
        return
      }
    }
  }
}

export function stepGame(state, inputsById, dt) {
  if (state.result) return

  for (const unit of state.units) {
    if (!unit.alive) continue
    let input
    if (unit.isCPU) input = unit.engaged ? battleAiInput(state, unit, dt) : wanderInput(state, unit, dt)
    else input = inputsById[unit.id] || { turn: 0, thrust: 0, claw: false, moves: [] }
    stepUnit(state, unit, input, dt)
  }
  stepProjectiles(state, dt)
  stepEffects(state, dt)
  checkEngagement(state)

  if (state.toast) { state.toast.timer -= dt; if (state.toast.timer <= 0) state.toast = null }

  if (state.mode === 'solo') {
    const player = state.units.find(u => u.id === 'p1')
    const enemy = state.units.find(u => u.id === 'cpu')
    if (!player.alive) { state.result = 'defeat'; return }
    if (enemy && !enemy.alive) {
      state.units = state.units.filter(u => u.id !== 'cpu')
      state.phase = 'explore'
      state.battleCenter = null
      player.engaged = false
      if (state.wave + 1 >= WAVES.length) {
        state.result = 'victory'
      } else {
        state.wave += 1
        player.hp = Math.min(player.maxHp, player.hp + HEAL_BETWEEN_WAVES)
        spawnWaveOpponent(state)
        setToast(state, `Wave ${state.wave + 1}: a ${getBender(WAVES[state.wave].element).name} approaches!`, 'good')
      }
    }
  } else if (state.mode === 'duel') {
    const p1 = state.units.find(u => u.id === 'p1')
    const p2 = state.units.find(u => u.id === 'p2')
    if (!p1.alive) state.result = 'p2'
    else if (!p2.alive) state.result = 'p1'
  }
}
