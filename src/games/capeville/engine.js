// ── Capeville — city patrol engine ────────────────────────────────────
// Pure state/physics, no rendering. Top-down, no gravity. Villains have
// real HP — contact alone does nothing. Every hero can throw a basic
// punch up close (Strength hits harder), and each power's signature
// move via the ability button is also a real attack, with a thrown
// car/dumpster landing a one-hit finisher.

import {
  W, H, HUD_H, CITY_W, CITY_H, MOVE_SPEED, SPEED_POWER_MULT, FLIGHT_MULT,
  DASH_SPEED, DASH_FRAMES, DASH_COOLDOWN, PROJECTILE_SPEED, PROJECTILE_COOLDOWN,
  THROW_SPEED, PUNCH_RANGE, PUNCH_COOLDOWN, PICKUP_RANGE, HERO_SIZE,
  VILLAIN_HP, PUNCH_DAMAGE, STRENGTH_PUNCH_DAMAGE, DASH_DAMAGE, PROJECTILE_DAMAGE, THROW_DAMAGE,
} from './constants.js'
import { BUILDINGS, CRIME_SCENES, PROPS, HQ_SPAWN } from './cityData.js'
import { ELEMENTS } from './heroData.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function facingVector(facing) {
  if (facing === 'left') return { x: -1, y: 0 }
  if (facing === 'right') return { x: 1, y: 0 }
  if (facing === 'up') return { x: 0, y: -1 }
  return { x: 0, y: 1 }
}

function rectHitsBuildings(rect) {
  for (const b of BUILDINGS) if (aabb(rect, b)) return true
  return false
}

function moveWithBuildings(e, ignoreBuildings) {
  if (ignoreBuildings) { e.x += e.vx; e.y += e.vy; return }
  const next = { ...e, x: e.x + e.vx }
  if (!rectHitsBuildings(next)) e.x = next.x
  const next2 = { ...e, y: e.y + e.vy }
  if (!rectHitsBuildings(next2)) e.y = next2.y
}

export function freshState(hero) {
  const state = {
    hero,
    frame: 0,
    score: 0,
    message: '', messageTimer: 0,
    allClear: false,
    player: {
      x: HQ_SPAWN.x - HERO_SIZE.w / 2, y: HQ_SPAWN.y - HERO_SIZE.h / 2,
      w: HERO_SIZE.w, h: HERO_SIZE.h, vx: 0, vy: 0, facing: 'down',
      flying: false, dashTimer: 0, dashCooldown: 0, dashHitIds: new Set(), carrying: null,
      blastCooldown: 0, punchCooldown: 0, punchTimer: 0, prevAbilityHeld: false,
    },
    camX: 0, camY: 0,
    hintShown: false,
    villains: CRIME_SCENES.map(cs => ({
      id: cs.id, x: cs.x - 14, y: cs.y - 60, w: 26, h: 30, alive: true, hp: VILLAIN_HP, hitFlash: 0,
      citizenX: cs.x + 16, citizenY: cs.y - 10, bobPhase: Math.random() * Math.PI * 2,
    })),
    props: PROPS.map((p, i) => ({ ...p, id: i, held: false, thrown: false, taken: false })),
    projectiles: [],
    particles: [],
  }
  return state
}

function showMessage(state, text) { state.message = text; state.messageTimer = 130 }

function spawnParticles(state, x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 26, color })
  }
}

function resolveRescue(state, villain) {
  villain.alive = false
  state.score += 100
  const def = state.hero
  spawnParticles(state, villain.x, villain.y, '#ffd93d', 16)
  const phrase = def.catchphrase ? ` "${def.catchphrase}"` : ''
  showMessage(state, `Rescued!${phrase}`)
  if (state.villains.every(v => !v.alive) && !state.allClear) {
    state.allClear = true
    showMessage(state, `${def.name || 'Your hero'} cleared every crime scene in Capeville!`)
  }
}

// Shared damage entry point for every attack type (punch, dash,
// projectile, thrown prop) — knocks a little hit-flash/particle
// feedback in regardless of what finishes the villain off, and only
// ever resolves the rescue once.
function damageVillain(state, villain, dmg) {
  if (!villain.alive) return
  villain.hp -= dmg
  villain.hitFlash = 10
  spawnParticles(state, villain.x + villain.w / 2, villain.y + villain.h / 2, '#fff', 6)
  if (villain.hp <= 0) resolveRescue(state, villain)
}

export function stepGame(state, input) {
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  const p = state.player
  const hero = state.hero
  const powerId = hero.powerId

  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071 }

  p.flying = powerId === 'flight' && input.ability
  let speed = MOVE_SPEED
  if (powerId === 'speed') speed *= SPEED_POWER_MULT
  if (p.flying) speed *= FLIGHT_MULT

  if (p.dashTimer > 0) {
    p.dashTimer--
  } else {
    p.vx = vx * speed
    p.vy = vy * speed
  }
  if (vx !== 0 || vy !== 0) {
    if (Math.abs(vx) > Math.abs(vy)) p.facing = vx > 0 ? 'right' : 'left'
    else p.facing = vy > 0 ? 'down' : 'up'
  }

  // ── Ability button (edge-triggered where that makes sense) ─────────
  // Every hero can throw a basic punch on anyone within range — Super
  // Strength hits harder — regardless of their chosen power; a punch
  // in range always takes priority over the power's own signature
  // move (except Strength mid-carry, which throws instead).
  const abilityPressed = input.ability && !p.prevAbilityHeld
  if (p.dashCooldown > 0) p.dashCooldown--
  if (p.blastCooldown > 0) p.blastCooldown--
  if (p.punchCooldown > 0) p.punchCooldown--
  if (p.punchTimer > 0) p.punchTimer--

  if (abilityPressed) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2
    const carryingProp = powerId === 'strength' && p.carrying != null
    const nearVillain = carryingProp ? null
      : state.villains.find(v => v.alive && Math.hypot((v.x + v.w / 2) - cx, (v.y + v.h / 2) - cy) < PUNCH_RANGE)

    if (carryingProp) {
      const prop = state.props.find(pr => pr.id === p.carrying)
      if (prop) {
        const fv = facingVector(p.facing)
        prop.held = false
        prop.thrown = true
        prop.vx = fv.x * THROW_SPEED
        prop.vy = fv.y * THROW_SPEED
      }
      p.carrying = null
    } else if (nearVillain && p.punchCooldown <= 0) {
      const dmg = powerId === 'strength' ? STRENGTH_PUNCH_DAMAGE : PUNCH_DAMAGE
      damageVillain(state, nearVillain, dmg)
      p.punchCooldown = PUNCH_COOLDOWN
      p.punchTimer = 10
      spawnParticles(state, cx, cy, hero.accentColor, 6)
    } else if (powerId === 'speed' && p.dashCooldown <= 0) {
      const fv = facingVector(p.facing)
      p.vx = fv.x * DASH_SPEED
      p.vy = fv.y * DASH_SPEED
      p.dashTimer = DASH_FRAMES
      p.dashCooldown = DASH_COOLDOWN
      p.dashHitIds = new Set()
      spawnParticles(state, cx, cy, '#fff', 12)
    } else if (powerId === 'blast' && p.blastCooldown <= 0) {
      p.blastCooldown = PROJECTILE_COOLDOWN
      const fv = facingVector(p.facing)
      const el = ELEMENTS.find(e => e.id === hero.elementId) || ELEMENTS[0]
      state.projectiles.push({
        x: p.x + p.w / 2 - 6, y: p.y + p.h / 2 - 6, w: 12, h: 12,
        vx: fv.x * PROJECTILE_SPEED, vy: fv.y * PROJECTILE_SPEED, color: el.color, glow: el.glow,
      })
    } else if (powerId === 'strength') {
      const near = state.props.find(pr => !pr.taken && Math.hypot(pr.x - cx, pr.y - cy) < PICKUP_RANGE)
      if (near) { near.held = true; near.taken = true; p.carrying = near.id }
    }
  }
  p.prevAbilityHeld = input.ability

  // ── Move + collide ───────────────────────────────────────────────
  moveWithBuildings(p, p.flying)
  p.x = Math.max(0, Math.min(CITY_W - p.w, p.x))
  p.y = Math.max(0, Math.min(CITY_H - p.h, p.y))

  // Super Speed's dash damages anything it passes through — once per
  // villain per dash, not once per frame it happens to overlap.
  if (p.dashTimer > 0) {
    for (const v of state.villains) {
      if (v.alive && !p.dashHitIds.has(v.id) && aabb(p, { x: v.x, y: v.y, w: v.w, h: v.h })) {
        damageVillain(state, v, DASH_DAMAGE)
        p.dashHitIds.add(v.id)
      }
    }
  }

  // Carried prop follows the hero.
  if (p.carrying != null) {
    const prop = state.props.find(pr => pr.id === p.carrying)
    if (prop) { prop.x = p.x + p.w / 2; prop.y = p.y - 10 }
  }

  // ── Thrown props ────────────────────────────────────────────────
  for (const prop of state.props) {
    if (!prop.thrown) continue
    prop.x += prop.vx; prop.y += prop.vy
    let settled = prop.x < -50 || prop.x > CITY_W + 50 || prop.y < -50 || prop.y > CITY_H + 50
    if (!settled) {
      for (const v of state.villains) {
        if (v.alive && Math.hypot(prop.x - (v.x + v.w / 2), prop.y - (v.y + v.h / 2)) < 30) {
          damageVillain(state, v, THROW_DAMAGE)
          settled = true
          break
        }
      }
    }
    if (settled) {
      // Back to its spot on the street, ready to be picked up again.
      prop.thrown = false
      prop.taken = false
      prop.x = PROPS[prop.id].x
      prop.y = PROPS[prop.id].y
    }
  }

  // ── Projectiles ─────────────────────────────────────────────────
  state.projectiles.forEach(pr => {
    pr.x += pr.vx; pr.y += pr.vy
    if (rectHitsBuildings(pr)) pr.dead = true
    for (const v of state.villains) {
      if (v.alive && aabb(pr, { x: v.x, y: v.y, w: v.w, h: v.h })) { damageVillain(state, v, PROJECTILE_DAMAGE); pr.dead = true }
    }
    if (pr.x < 0 || pr.x > CITY_W || pr.y < 0 || pr.y > CITY_H) pr.dead = true
  })
  state.projectiles = state.projectiles.filter(pr => !pr.dead)

  // ── Villains: idle bob, hit-flash decay, and a one-time nudge the
  // first time the player bumps into one without attacking (contact
  // alone no longer resolves a crime scene — you have to fight).
  for (const v of state.villains) {
    if (!v.alive) continue
    v.bobPhase += 0.05
    if (v.hitFlash > 0) v.hitFlash--
    if (!state.hintShown && aabb(p, { x: v.x, y: v.y, w: v.w, h: v.h })) {
      state.hintShown = true
      showMessage(state, 'Get close and press the ability button to attack!')
    }
  }

  // ── Particles ───────────────────────────────────────────────────
  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)

  // ── Camera ──────────────────────────────────────────────────────
  state.camX = Math.max(0, Math.min(CITY_W - W, p.x + p.w / 2 - W / 2))
  state.camY = Math.max(0, Math.min(CITY_H - (H - HUD_H), p.y + p.h / 2 - (H - HUD_H) / 2))
}

export function rescueProgress(state) {
  const total = state.villains.length
  const done = state.villains.filter(v => !v.alive).length
  return { done, total }
}
