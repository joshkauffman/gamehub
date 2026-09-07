// ── Shirby and the Forgotten Place — game engine ──────────────────────
// Pure state/physics, no rendering. One frame of simulation per stepGame
// call; render.js reads the resulting state to draw it. Frame-based
// physics (not dt/seconds), same convention as the Obvious Mario Knockoff
// next door — every constant is added directly per tick at an assumed
// ~60fps via uncorrected requestAnimationFrame.
//
// Shirby never "stomps" anything the way a Mario-shaped hero would —
// contact with an enemy or boss always costs Shirby something (a power, a
// mouthful, or a heart), never the other way around. Damage only ever
// flows outward through an actual attack: a spat star, a copied power's
// attack, or Zap's passive aura. See the cushioning cascade in hitPlayer().

import {
  H, GROUND_Y, GRAVITY, FLOAT_GRAVITY, FLOAT_MAX_VY, JUMP_V, MOVE_ACCEL, MAX_SPEED, FRICTION,
  LIVES_START, MAX_HP, PLAYER_SIZE, INHALE_RANGE, INHALE_PULL, INVULN_FRAMES,
  KNOCKBACK_VX, KNOCKBACK_VY, PROJECTILE_SPEED, PROJECTILE_LIFE,
  BLADE_COOLDOWN, BLADE_REACH, BLADE_ARC_H, EMBER_RANGE, EMBER_TICK, FROST_COOLDOWN,
  ZAP_PULSE_COOLDOWN, ZAP_PULSE_RADIUS, ROCK_COOLDOWN, ROCK_RADIUS, BUBBLE_COOLDOWN,
  ENEMY_DEFS, POWERS, MEGA_POWERS, getPowerDisplay, TILE, W,
} from './constants.js'
import { LEVELS } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }
// Two base power ids, order-independent, as a MEGA_POWERS lookup key.
function comboKey(a, b) { return [a, b].sort().join('+') }

const POWER_QUIPS = {
  blade: '(suspiciously sword-shaped)',
  ember: '(suspiciously fire-shaped)',
  frost: '(suspiciously ice-shaped)',
  zap: '(suspiciously spark-shaped)',
  rock: '(suspiciously rock-shaped)',
  bubble: '(suspiciously bubble-shaped)',
}

function freshLevelEntities(level) {
  return {
    blocks: level.blocks.map(b => ({ ...b, used: false, bump: 0 })),
    enemies: level.enemies.map(e => ({ ...e, alive: true, squish: 0, timer: 40 + Math.random() * 40, spawnX: e.x, spawnY: e.y, respawnTimer: 0 })),
    buttons: level.buttons.map(c => ({ ...c, taken: false })),
    boss: level.boss ? { ...level.boss } : null,
  }
}

export function loadLevel(state, idx, preservePower) {
  const level = LEVELS[idx]
  const entities = freshLevelEntities(level)
  state.levelIndex = idx
  state.blocks = entities.blocks
  state.enemies = entities.enemies
  state.buttons = entities.buttons
  state.boss = entities.boss
  state.projectiles = []
  state.particles = []
  state.camX = 0
  state.status = 'playing'
  const prevPower = preservePower ? state.player?.power : null
  state.player = {
    x: 60, y: GROUND_Y - PLAYER_SIZE.h, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h,
    vx: 0, vy: 0, onGround: false, facing: 1,
    hp: MAX_HP, invincible: 60, dead: false,
    power: prevPower, mouthContent: null, inhaling: false, inhaleTarget: null,
    attackCooldown: 0, attackTimer: 0, emberTick: 0,
    prevJumpHeld: false, prevDownHeld: false, prevAttackHeld: false,
  }
}

export function freshState() {
  const state = {
    score: 0, buttonCount: 0, lives: LIVES_START, frame: 0,
    message: '', messageTimer: 0, transitionTimer: 0, transitionLabel: '',
    horrorMode: false,
  }
  loadLevel(state, 0, false)
  return state
}

export function currentLevel(state) { return LEVELS[state.levelIndex] }

function solidsNear(state) {
  const level = currentLevel(state)
  const solids = []
  for (const seg of level.groundSegments) solids.push({ x: seg.x0, y: GROUND_Y, w: seg.x1 - seg.x0, h: H - GROUND_Y })
  for (const b of state.blocks) if (!(b.kind === 'brick' && b.used)) solids.push(b)
  return solids
}

function moveWithCollisions(entity, solids, onHitFromBelow) {
  entity.x += entity.vx
  for (const s of solids) {
    if (aabb(entity, s)) {
      if (entity.vx > 0) entity.x = s.x - entity.w
      else if (entity.vx < 0) entity.x = s.x + s.w
      entity.vx = 0
    }
  }
  entity.y += entity.vy
  entity.onGround = false
  for (const s of solids) {
    if (aabb(entity, s)) {
      if (entity.vy > 0) { entity.y = s.y - entity.h; entity.vy = 0; entity.onGround = true }
      else if (entity.vy < 0) { entity.y = s.y + s.h; entity.vy = 0; onHitFromBelow?.(s) }
    }
  }
}

function spawnParticles(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6 - 2, life: 24, color })
  }
}

function killEnemy(state, e, score, color) {
  e.alive = false
  e.squish = 20
  if (e.respawnTime) e.respawnTimer = e.respawnTime
  state.score += score
  spawnParticles(state, e.x + e.w / 2, e.y, color, 8)
}

function killPlayer(state) {
  if (state.player.dead) return
  state.lives -= 1
  state.player.dead = true
  state.player.vy = -11
  state.player.vx = 0
  if (state.lives <= 0) state.status = 'gameover'
}

function respawn(state) { loadLevel(state, state.levelIndex, false) }

function startLevelTransition(state, label = 'Place tidied up! (Legally distinct tidying)') {
  state.status = 'levelTransition'
  state.transitionTimer = 120
  state.transitionLabel = label
  state.score += 500
}

function showMessage(state, text) { state.message = text; state.messageTimer = 100 }

// Getting hit cushions through whatever Shirby's currently holding before
// it ever touches HP — same idea as the Mario knockoff's grow/shrink
// chain, just with "equipped power" and "mouthful" as the padding instead
// of "big" and "fire".
function hitPlayer(state, fromX) {
  const p = state.player
  if (p.invincible > 0 || p.dead) return
  const dir = fromX != null ? (p.x < fromX ? -1 : 1) : -p.facing
  if (p.power) {
    showMessage(state, `Lost ${getPowerDisplay(p.power).name}! (still legally distinct)`)
    p.power = null
    p.invincible = INVULN_FRAMES
  } else if (p.mouthContent) {
    showMessage(state, 'Spat it out involuntarily! Rude.')
    p.mouthContent = null
    p.invincible = INVULN_FRAMES
  } else {
    p.hp -= 1
    p.vx = dir * KNOCKBACK_VX
    p.vy = KNOCKBACK_VY
    p.invincible = INVULN_FRAMES
    showMessage(state, 'Ouch!')
    if (p.hp <= 0) killPlayer(state)
  }
}

// A boss taking a hit: shrink its HP, give it a brief invincibility window
// (so one attack tick doesn't chain into three), flip into a faster phase
// 2 at half health, and clear the level if that was the last point.
function hurtBoss(state, boss, amount, color) {
  if (boss.invincible > 0) return
  boss.hp -= amount
  boss.invincible = 40
  spawnParticles(state, boss.x + boss.w / 2, boss.y, color, 10)
  if (!boss.phase2 && boss.hp <= boss.maxHp / 2 && boss.hp > 0) {
    boss.phase2 = true
    showMessage(state, "It's not happy about that. Phase 2!")
  }
  if (boss.hp <= 0) {
    boss.alive = false
    state.score += 3000
    startLevelTransition(state, 'Boss defeated! (No lawsuits were filed)')
  }
}

function spawnStar(state, p, weak) {
  state.projectiles.push({
    kind: 'star', owner: 'player', x: p.x + p.w / 2 + p.facing * 14, y: p.y + p.h / 2, w: 16, h: 16,
    vx: p.facing * (weak ? 5 : PROJECTILE_SPEED), vy: -3, life: PROJECTILE_LIFE, weak, dead: false,
  })
}

// ── Mega power attacks ─────────────────────────────────────────────────
// Every combo has genuinely different mechanics, not a shared reskin —
// three "shapes" built from the same primitives the six base powers
// already use (a melee arc, a radius burst, a fired projectile), plus one
// bespoke pull effect for Magnet Slam. Each combo's own params (reach,
// radius, pierce/bounce/spread/gravity, cooldown/damage tier) are what
// actually make it feel different; see MEGA_POWERS in constants.js.

// Boulder Blade / Storm Blade / Blazing Blade / Frost Blade / Bubble Blade:
// a melee arc like base Blade, optionally bigger (reachMult/arcHMult),
// chaining to nearby enemies (chainRadius), or paired with a follow-up
// projectile (bolt: straight ahead; projectile: a lobbed bubble-style shot).
function megaArcAttack(state, p, atk) {
  const reach = BLADE_REACH * (atk.reachMult || 1)
  const arcH = BLADE_ARC_H * (atk.arcHMult || 1)
  const x0 = p.facing > 0 ? p.x + p.w : p.x - reach
  const x1 = p.facing > 0 ? p.x + p.w + reach : p.x
  const hb = { x: x0, y: p.y + p.h / 2 - arcH / 2, w: x1 - x0, h: arcH }
  let hitPoint = null
  for (const e of state.enemies) {
    if (e.alive && e.squish <= 0 && aabb(hb, e)) {
      killEnemy(state, e, atk.killScore, atk.color)
      hitPoint = hitPoint || { x: e.x, y: e.y }
    }
  }
  if (state.boss?.alive && aabb(hb, state.boss)) hurtBoss(state, state.boss, atk.bossDmg, atk.color)
  if (atk.chainRadius && hitPoint) {
    for (const e of state.enemies) {
      if (!e.alive || e.squish > 0) continue
      if (Math.hypot(e.x - hitPoint.x, e.y - hitPoint.y) < atk.chainRadius) killEnemy(state, e, atk.killScore, atk.color)
    }
  }
  if (atk.bolt) {
    state.projectiles.push({
      kind: 'mega', owner: 'player', x: p.x + p.w / 2 + p.facing * 14, y: p.y + p.h / 2, w: 16, h: 16,
      vx: p.facing * PROJECTILE_SPEED, vy: 0, life: PROJECTILE_LIFE, gravity: 0,
      color: atk.color, bossDmg: atk.bossDmg, killScore: atk.killScore, dead: false,
    })
  }
  if (atk.projectile) {
    state.projectiles.push({
      kind: 'mega', owner: 'player', x: p.x + p.w / 2 + p.facing * 14, y: p.y + p.h * 0.4, w: 16, h: 16,
      vx: p.facing * PROJECTILE_SPEED * 0.75, vy: -2.5, life: PROJECTILE_LIFE, gravity: 0.14,
      color: atk.color, bossDmg: atk.bossDmg, killScore: atk.killScore, dead: false,
    })
  }
}

// Magma Slam / Glacier Smash / Steam Burst: a radius burst around Shirby
// like base Rock's stomp, just bigger — Steam Burst's `launch` also gives
// Shirby a little upward puff, since a steam explosion should send you up.
function megaAoeAttack(state, p, atk) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  for (const e of state.enemies) {
    if (!e.alive || e.squish > 0) continue
    if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < atk.radius) killEnemy(state, e, atk.killScore, atk.color)
  }
  if (state.boss?.alive && Math.hypot(state.boss.x + state.boss.w / 2 - cx, state.boss.y + state.boss.h / 2 - cy) < atk.radius + state.boss.w / 2) {
    hurtBoss(state, state.boss, atk.bossDmg, atk.color)
  }
  if (atk.launch) p.vy = atk.launch
}

// Plasma Storm / Scald Spray / Blizzard Shock / Charged Bubble / Ice
// Bubble / Heavy Bubble: one flexible fired projectile. `count`+
// `spreadAngle` fans out multiple shots; `pierceCount` lets it survive N
// hits instead of dying on the first; `bounces` lets it bounce off solids
// like a spat star instead of dying; `gravity`/`speed`/`life` retune its
// arc, and `burstRadius` damages an area around whatever it first hits
// instead of just that one target.
function megaFireProjectile(state, p, atk) {
  const count = atk.count || 1
  const speed = PROJECTILE_SPEED * (atk.speed || 1)
  for (let i = 0; i < count; i++) {
    const spread = count > 1 ? (i - (count - 1) / 2) * (atk.spreadAngle || 0) : 0
    const size = atk.big ? 24 : 16
    state.projectiles.push({
      kind: 'mega', owner: 'player', x: p.x + p.w / 2 + p.facing * 14, y: p.y + p.h / 2, w: size, h: size,
      vx: Math.cos(spread) * speed * p.facing, vy: Math.sin(spread) * speed - 2,
      life: (atk.life || 1) * PROJECTILE_LIFE, gravity: atk.gravity ?? 0.08,
      color: atk.color, bossDmg: atk.bossDmg, killScore: atk.killScore,
      pierceLeft: atk.pierceCount || 0, bouncesLeft: atk.bounces || 0,
      burstRadius: atk.burstRadius || 0, big: !!atk.big, dead: false,
    })
  }
}

// Magnet Slam: pulls everything within range toward Shirby over the
// attack's active window (same lerp-toward-center math as inhaling),
// crushing anything that gets close — boss damage lands once, immediately,
// on press (see the dispatcher below), same as every other mega's single
// per-press hit.
function megaMagnetTick(state, p, atk) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  for (const e of state.enemies) {
    if (!e.alive || e.squish > 0) continue
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2
    const dist = Math.hypot(ex - cx, ey - cy)
    if (dist > atk.radius) continue
    e.x += ((cx - ex) / (dist || 1)) * 6
    e.y += ((cy - ey) / (dist || 1)) * 6
    if (dist < 22) killEnemy(state, e, atk.killScore, atk.color)
  }
}

function usePowerAttack(state, p, input, attackPressed) {
  const boss = state.boss
  if (p.attackCooldown > 0) p.attackCooldown--
  if (p.attackTimer > 0) p.attackTimer--

  const megaDef = MEGA_POWERS[p.power]
  if (megaDef) {
    const atk = megaDef.attack
    if (attackPressed && p.attackCooldown <= 0) {
      p.attackCooldown = atk.cooldown
      p.attackTimer = atk.shape === 'magnet' ? 20 : 14
      p.invincible = Math.max(p.invincible, atk.shape === 'magnet' ? 26 : 18)
      if (atk.shape === 'arc') megaArcAttack(state, p, atk)
      else if (atk.shape === 'aoe') megaAoeAttack(state, p, atk)
      else if (atk.shape === 'projectile') megaFireProjectile(state, p, atk)
      else if (atk.shape === 'magnet' && boss?.alive && Math.hypot(boss.x + boss.w / 2 - (p.x + p.w / 2), boss.y + boss.h / 2 - (p.y + p.h / 2)) < atk.radius + boss.w / 2) {
        hurtBoss(state, boss, atk.bossDmg, atk.color)
      }
    }
    if (atk.shape === 'magnet' && p.attackTimer > 0) megaMagnetTick(state, p, atk)
    return
  }
  if (p.power === 'blade') {
    if (attackPressed && p.attackCooldown <= 0) {
      p.attackCooldown = BLADE_COOLDOWN
      p.attackTimer = 10
      const x0 = p.facing > 0 ? p.x + p.w : p.x - BLADE_REACH
      const x1 = p.facing > 0 ? p.x + p.w + BLADE_REACH : p.x
      const hb = { x: x0, y: p.y + p.h / 2 - BLADE_ARC_H / 2, w: x1 - x0, h: BLADE_ARC_H }
      for (const e of state.enemies) if (e.alive && e.squish <= 0 && aabb(hb, e)) killEnemy(state, e, 100, '#dcdce8')
      if (boss?.alive && aabb(hb, boss)) hurtBoss(state, boss, 1, '#dcdce8')
    }
    return
  }
  if (p.power === 'ember') {
    if (input.attack) {
      p.emberTick = (p.emberTick || 0) + 1
      if (p.emberTick % EMBER_TICK === 1) {
        const x0 = p.facing > 0 ? p.x + p.w : p.x - EMBER_RANGE
        const x1 = p.facing > 0 ? p.x + p.w + EMBER_RANGE : p.x
        const hb = { x: x0, y: p.y, w: x1 - x0, h: p.h }
        for (const e of state.enemies) if (e.alive && e.squish <= 0 && aabb(hb, e)) killEnemy(state, e, 100, '#ff9a3d')
        if (boss?.alive && aabb(hb, boss)) hurtBoss(state, boss, 1, '#ff9a3d')
      }
    } else {
      p.emberTick = 0
    }
    return
  }
  if (p.power === 'frost') {
    if (attackPressed && p.attackCooldown <= 0) {
      p.attackCooldown = FROST_COOLDOWN
      state.projectiles.push({
        kind: 'frost', owner: 'player', x: p.x + p.w / 2 + p.facing * 12, y: p.y + p.h / 2, w: 14, h: 14,
        vx: p.facing * PROJECTILE_SPEED * 0.8, vy: 0, life: PROJECTILE_LIFE, dead: false,
      })
    }
    return
  }
  if (p.power === 'rock') {
    if (attackPressed && p.attackCooldown <= 0) {
      p.attackCooldown = ROCK_COOLDOWN
      p.attackTimer = 14
      p.invincible = Math.max(p.invincible, 24)
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2
      for (const e of state.enemies) {
        if (!e.alive || e.squish > 0) continue
        if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < ROCK_RADIUS) killEnemy(state, e, 100, '#a89878')
      }
      if (boss?.alive && Math.hypot(boss.x + boss.w / 2 - cx, boss.y + boss.h / 2 - cy) < ROCK_RADIUS + boss.w / 2) hurtBoss(state, boss, 1, '#a89878')
    }
    return
  }
  if (p.power === 'zap') {
    if (attackPressed && p.attackCooldown <= 0) {
      p.attackCooldown = ZAP_PULSE_COOLDOWN
      p.attackTimer = 12
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2
      for (const e of state.enemies) {
        if (!e.alive || e.squish > 0) continue
        if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < ZAP_PULSE_RADIUS) killEnemy(state, e, 100, '#f5e050')
      }
      if (boss?.alive && Math.hypot(boss.x + boss.w / 2 - cx, boss.y + boss.h / 2 - cy) < ZAP_PULSE_RADIUS + boss.w / 2) hurtBoss(state, boss, 1, '#f5e050')
    }
    return
  }
  if (p.power === 'bubble') {
    if (attackPressed && p.attackCooldown <= 0) {
      p.attackCooldown = BUBBLE_COOLDOWN
      state.projectiles.push({
        kind: 'bubble', owner: 'player', x: p.x + p.w / 2 + p.facing * 12, y: p.y + p.h * 0.4, w: 16, h: 16,
        vx: p.facing * PROJECTILE_SPEED * 0.75, vy: -2.5, life: PROJECTILE_LIFE, dead: false,
      })
    }
  }
}

export function stepGame(state, input) {
  if (state.status === 'levelTransition') {
    state.transitionTimer--
    if (state.transitionTimer <= 0) {
      if (state.levelIndex + 1 < LEVELS.length) loadLevel(state, state.levelIndex + 1, true)
      else state.status = 'win'
    }
    return
  }
  if (state.status !== 'playing') return
  state.frame++

  const p = state.player
  if (!p.dead) {
    if (input.left) { p.vx -= MOVE_ACCEL; p.facing = -1 }
    if (input.right) { p.vx += MOVE_ACCEL; p.facing = 1 }
    if (!input.left && !input.right) p.vx *= FRICTION
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx))

    if (input.jump && p.onGround) p.vy = JUMP_V
    p.prevJumpHeld = input.jump
  }

  // Floating: holding jump while airborne trades normal gravity for a
  // much lighter one with a low terminal fall speed — Shirby's answer to
  // precision platforming is "just go around it, from above."
  const floating = !p.dead && input.jump && !p.onGround
  if (floating) {
    p.vy += FLOAT_GRAVITY
    if (p.vy > FLOAT_MAX_VY) p.vy = FLOAT_MAX_VY
  } else {
    p.vy += GRAVITY
    if (p.vy > 14) p.vy = 14
  }

  if (p.dead) {
    p.x += p.vx
    p.y += p.vy
    if (p.y > H + 150) { if (state.lives > 0) respawn(state) }
    return
  }

  const solids = solidsNear(state)
  moveWithCollisions(p, solids, (block) => {
    if (block.kind === 'question' && !block.used) {
      block.used = true
      block.bump = 8
      if (block.contents === 'button') { state.score += 10; state.buttonCount += 1; spawnParticles(state, block.x + TILE / 2, block.y, '#ffd873', 6) }
      else if (block.contents === 'heart') { p.hp = Math.min(MAX_HP, p.hp + 2); showMessage(state, 'Forgotten Heart! +2 HP'); spawnParticles(state, block.x + TILE / 2, block.y, '#ff6f8a', 6) }
      else if (block.contents === '1up') { state.lives += 1; showMessage(state, 'Spare Puff found! +1 life'); spawnParticles(state, block.x + TILE / 2, block.y, '#7bff8a', 6) }
    } else if (block.kind === 'brick') {
      block.bump = 6
    }
  })
  if (p.x < 0) p.x = 0
  if (p.y > H + 100) killPlayer(state)

  state.blocks.forEach(b => { if (b.bump > 0) b.bump -= 1 })

  // ── Inhale / mouth ─────────────────────────────────────────────────
  // `pulled` marks this frame's inhale target so the enemy loop below
  // skips its own patrol/fly/erratic movement (and contact damage) while
  // it's being sucked in — otherwise the enemy's normal AI fights the
  // pull every frame. Once a target is acquired it keeps getting reeled
  // in every frame regardless of the original zone check: the zone (in
  // front of Shirby's face) and the capture distance (from Shirby's
  // *center*) don't overlap, so re-running the zone check every frame
  // would drop the target right as it got close enough to ever capture.
  // Inhaling works whether or not a power is already equipped — swallowing
  // a second, different talented enemy is how two powers fuse into a mega
  // one (see the swallow logic below). Only an already-full mouth blocks
  // it, same restriction as before.
  state.enemies.forEach(e => { e.pulled = false })
  if (input.inhale && !p.mouthContent) {
    p.inhaling = true
    let target = (p.inhaleTarget && p.inhaleTarget.alive && p.inhaleTarget.squish <= 0) ? p.inhaleTarget : null
    if (!target) {
      const x0 = p.facing > 0 ? p.x + p.w : p.x - INHALE_RANGE
      const x1 = p.facing > 0 ? p.x + p.w + INHALE_RANGE : p.x
      let bestD = Infinity
      for (const e of state.enemies) {
        const def = ENEMY_DEFS[e.type]
        if (!e.alive || def.noInhale || e.squish > 0) continue
        const ex = e.x + e.w / 2
        if (ex < x0 || ex > x1) continue
        const d = Math.abs(ex - (p.x + p.w / 2))
        if (d < bestD) { bestD = d; target = e }
      }
    }
    p.inhaleTarget = target
    if (target) {
      target.pulled = true
      const px = p.x + p.w / 2, py = p.y + p.h / 2
      const ex = target.x + target.w / 2, ey = target.y + target.h / 2
      const dx = px - ex, dy = py - ey
      const dist = Math.hypot(dx, dy) || 1
      target.x += (dx / dist) * INHALE_PULL
      target.y += (dy / dist) * INHALE_PULL
      if (dist < 18) {
        p.mouthContent = target.type
        target.alive = false
        if (target.respawnTime) target.respawnTimer = target.respawnTime
        p.inhaleTarget = null
        spawnParticles(state, ex, ey, '#ffffff', 6)
      }
    }
  } else {
    p.inhaling = false
    p.inhaleTarget = null
  }

  const downPressed = input.down && !p.prevDownHeld
  p.prevDownHeld = input.down
  if (downPressed) {
    if (p.mouthContent) {
      const def = ENEMY_DEFS[p.mouthContent]
      if (def.power && p.power && p.power !== def.power) {
        // Two different powers at once fuse into a mega, instead of the
        // new one just overwriting the old — the combo id (e.g.
        // "blade+ember") doubles as both the MEGA_POWERS lookup key and
        // the value stored in p.power, so nothing else needs to know it's
        // a fusion rather than a base power (see getPowerDisplay/
        // usePowerAttack for the two places that do care).
        const key = comboKey(p.power, def.power)
        const mega = MEGA_POWERS[key]
        if (mega) {
          p.power = key
          state.score += 800
          showMessage(state, `MEGA POWER: ${mega.name}! ${mega.emoji} (suspiciously combo-shaped)`)
        } else {
          p.power = def.power
          showMessage(state, `Copied: ${POWERS[def.power].name}! ${POWER_QUIPS[def.power]}`)
        }
      } else if (def.power && p.power === def.power) {
        state.score += 100
        showMessage(state, `Already got ${POWERS[def.power].name} equipped!`)
      } else if (def.power) {
        p.power = def.power
        state.score += 300
        showMessage(state, `Copied: ${POWERS[def.power].name}! ${POWER_QUIPS[def.power]}`)
      } else {
        state.score += 150
        showMessage(state, 'Swallowed! (No powers in this one, just vibes)')
      }
      p.mouthContent = null
    } else if (p.power) {
      spawnStar(state, p, true)
      showMessage(state, `Discarded ${getPowerDisplay(p.power).name}.`)
      p.power = null
    }
  }

  const attackPressed = input.attack && !p.prevAttackHeld
  if (p.mouthContent && attackPressed) {
    spawnStar(state, p, false)
    p.mouthContent = null
  } else if (p.power) {
    usePowerAttack(state, p, input, attackPressed)
  }
  p.prevAttackHeld = input.attack

  // ── Enemies ──────────────────────────────────────────────────────────
  state.enemies.forEach(e => {
    if (!e.alive) {
      // Boss-corridor power sources come back a while after being
      // consumed instead of staying gone for good — losing a copied power
      // mid-fight should mean "walk back down the hall," never "run out."
      if (e.respawnTime) {
        e.respawnTimer--
        if (e.respawnTimer <= 0) { e.alive = true; e.x = e.spawnX; e.y = e.spawnY; e.squish = 0 }
      }
      return
    }
    if (e.squish > 0) { e.squish--; return }
    if (e.pulled) return
    const def = ENEMY_DEFS[e.type]
    if (def.kind === 'ground') {
      e.x += e.vx
      if (e.x < e.min || e.x + e.w > e.max) e.vx *= -1
    } else if (def.kind === 'fly') {
      e.x += e.vx
      if (e.x < e.min || e.x + e.w > e.max) e.vx *= -1
      e.y = e.baseY + Math.sin(state.frame * 0.05 + e.x * 0.02) * 22
    } else if (def.kind === 'erratic') {
      e.timer--
      if (e.timer <= 0) {
        e.timer = 40 + Math.random() * 50
        const targetX = e.min + Math.random() * (e.max - e.min)
        e.vx = targetX > e.x ? 1.7 : -1.7
      }
      e.x = Math.max(e.min, Math.min(e.max, e.x + e.vx))
    } else if (def.kind === 'bob') {
      e.y = e.baseY + Math.sin(state.frame * 0.06 + e.x) * 10
    }

    if (!p.dead && p.invincible <= 0 && aabb(p, e)) {
      if (p.power === 'zap') killEnemy(state, e, 100, '#f5e050')
      else hitPlayer(state, e.x)
    }
  })
  state.enemies = state.enemies.filter(e => e.alive || e.squish > 0 || e.respawnTime)

  // ── Boss ─────────────────────────────────────────────────────────────
  if (state.boss && state.boss.alive) {
    const boss = state.boss
    if (boss.invincible > 0) boss.invincible--
    boss.x += boss.vx
    if (boss.x < boss.minX || boss.x > boss.maxX) boss.vx *= -1
    if (!boss.melee) {
      boss.attackCooldown--
      if (boss.attackCooldown <= 0) {
        boss.attackCooldown = boss.phase2 ? 65 : 110
        const dir = p.x < boss.x ? -1 : 1
        state.projectiles.push({ kind: 'lob', owner: 'boss', x: boss.x + boss.w / 2, y: boss.y + boss.h * 0.4, w: 14, h: 14, vx: dir * 5, vy: -4, life: 200, dead: false })
        if (boss.phase2) state.projectiles.push({ kind: 'lob', owner: 'boss', x: boss.x + boss.w / 2, y: boss.y + boss.h * 0.4, w: 14, h: 14, vx: dir * 3, vy: -6, life: 200, dead: false })
      }
    }
    if (!p.dead && p.invincible <= 0 && aabb(p, boss)) {
      if (p.power === 'zap') { hurtBoss(state, boss, 1, '#f5e050'); p.invincible = 30 }
      else hitPlayer(state, boss.x)
    }
  }

  // ── Projectiles (spat stars, power shots, boss lobs, mega shots) ────
  state.projectiles.forEach(pr => {
    if (pr.dead) return
    pr.x += pr.vx; pr.y += pr.vy
    if (pr.kind === 'bubble') pr.vy += 0.14
    else if (pr.kind === 'star' || pr.kind === 'lob') pr.vy += 0.3
    else if (pr.kind === 'mega') pr.vy += pr.gravity
    pr.life--
    if (pr.life <= 0) { pr.dead = true; return }
    for (const s of solids) {
      if (aabb(pr, s)) {
        if (pr.kind === 'star') pr.vy = -7
        else if (pr.kind === 'mega' && pr.bouncesLeft > 0) { pr.vy = -7; pr.bouncesLeft-- }
        else pr.dead = true
      }
    }
    if (pr.dead) return
    if (pr.owner === 'player') {
      for (const e of state.enemies) {
        if (e.alive && e.squish <= 0 && aabb(pr, e)) {
          const color = pr.kind === 'mega' ? pr.color : pr.kind === 'frost' ? '#8fe0ff' : pr.kind === 'bubble' ? '#7ad0ff' : '#ffe9b8'
          killEnemy(state, e, pr.kind === 'mega' ? pr.killScore : 100, color)
          if (pr.kind === 'mega' && pr.burstRadius) {
            for (const e2 of state.enemies) {
              if (e2.alive && e2.squish <= 0 && e2 !== e && Math.hypot(e2.x - e.x, e2.y - e.y) < pr.burstRadius) killEnemy(state, e2, pr.killScore, color)
            }
          }
          if (pr.kind === 'mega' && pr.pierceLeft > 0) pr.pierceLeft--
          else pr.dead = true
        }
      }
      if (state.boss?.alive && aabb(pr, state.boss)) {
        const color = pr.kind === 'mega' ? pr.color : '#ffe9b8'
        hurtBoss(state, state.boss, pr.kind === 'mega' ? pr.bossDmg : 1, color)
        if (pr.kind === 'mega' && pr.pierceLeft > 0) pr.pierceLeft--
        else pr.dead = true
      }
    } else if (pr.owner === 'boss') {
      if (!p.dead && p.invincible <= 0 && aabb(pr, p)) { hitPlayer(state, pr.x); pr.dead = true }
    }
  })
  state.projectiles = state.projectiles.filter(pr => !pr.dead && pr.x > state.camX - 80 && pr.x < state.camX + W + 80)

  // ── Currency pickups ─────────────────────────────────────────────────
  state.buttons.forEach(c => { if (!c.taken && aabb(p, c)) { c.taken = true; state.score += 10; state.buttonCount += 1 } })

  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)

  if (p.invincible > 0) p.invincible--
  if (state.messageTimer > 0) state.messageTimer--

  if (state.status !== 'playing') return // a boss defeat above may have already started a transition

  const level = currentLevel(state)
  if (level.flagX != null && !p.dead && p.x + p.w > level.flagX && p.x < level.flagX + 20) {
    startLevelTransition(state, 'Tidied up! On to the next forgotten corner.')
    return
  }

  const targetCam = Math.max(0, Math.min(level.width - W, p.x - W / 2.5))
  state.camX += (targetCam - state.camX) * 0.2
}
