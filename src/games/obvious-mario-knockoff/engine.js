// ── The Obvious Mario Knockoff — game engine ──────────────────────────
// Pure state/physics, no rendering. One frame of simulation per stepGame
// call; render.js reads the resulting state to draw it.

import {
  H, GROUND_Y, GRAVITY, JUMP_V, MOVE_ACCEL, MAX_SPEED, FRICTION,
  LIVES_START, STAR_DURATION, FIRE_COOLDOWN, SMALL_SIZE, BIG_SIZE, TILE, W,
} from './constants.js'
import { LEVELS } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function freshLevelEntities(level) {
  return {
    blocks: level.blocks.map(b => ({ ...b, used: b.kind === 'stair', bump: 0 })),
    pipes: level.pipes.map(p => ({ ...p })),
    enemies: level.enemies.map(e => ({ ...e, alive: true, squish: 0 })),
    coins: level.coins.map(c => ({ ...c, taken: false })),
    boss: level.boss ? { ...level.boss } : null,
  }
}

export function loadLevel(state, idx, preservePower) {
  const level = LEVELS[idx]
  const entities = freshLevelEntities(level)
  state.levelIndex = idx
  state.blocks = entities.blocks
  state.pipes = entities.pipes
  state.enemies = entities.enemies
  state.coins = entities.coins
  state.boss = entities.boss
  state.powerups = []
  state.fireballs = []
  state.particles = []
  state.time = level.time
  state.camX = 0
  state.status = 'playing'
  const prevPower = preservePower ? state.player?.powerState : 'small'
  const size = prevPower === 'small' ? SMALL_SIZE : BIG_SIZE
  state.player = {
    x: 60, y: GROUND_Y - size.h, w: size.w, h: size.h, vx: 0, vy: 0, onGround: false,
    powerState: prevPower, starTimer: 0, facing: 1, invincible: 60, dead: false, fireCooldown: 0,
  }
}

export function freshState() {
  const state = {
    score: 0, coinCount: 0, lives: LIVES_START, frame: 0,
    message: '', messageTimer: 0, transitionTimer: 0, transitionLabel: '',
  }
  loadLevel(state, 0, false)
  return state
}

export function currentLevel(state) { return LEVELS[state.levelIndex] }

function solidsNear(state) {
  const level = currentLevel(state)
  const solids = []
  for (const seg of level.groundSegments) solids.push({ x: seg.x0, y: GROUND_Y, w: seg.x1 - seg.x0, h: H - GROUND_Y })
  for (const p of state.pipes) solids.push(p)
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

function killPlayer(state) {
  if (state.player.dead) return
  state.lives -= 1
  state.player.dead = true
  state.player.vy = -13
  state.player.vx = 0
  if (state.lives <= 0) state.status = 'gameover'
}

function respawn(state) { loadLevel(state, state.levelIndex, false) }

function startLevelTransition(state, label = 'COURSE CLEAR! (Legally distinct course)') {
  state.status = 'levelTransition'
  state.transitionTimer = 120
  state.transitionLabel = label
  state.score += state.time * 2
}

function showMessage(state, text) { state.message = text; state.messageTimer = 90 }

function shrinkOrDie(state) {
  const p = state.player
  if (p.powerState === 'fire') {
    p.powerState = 'big'
    p.invincible = 100
    showMessage(state, 'Lost the fire. Still big-boned, though.')
  } else if (p.powerState === 'big') {
    p.powerState = 'small'
    const size = SMALL_SIZE
    p.y += p.h - size.h
    p.w = size.w; p.h = size.h
    p.invincible = 100
    showMessage(state, 'Ouch! (that hurt your brand)')
  } else {
    killPlayer(state)
  }
}

function grow(state) {
  const p = state.player
  if (p.powerState === 'small') {
    p.powerState = 'big'
    const size = BIG_SIZE
    p.y -= size.h - p.h
    p.w = size.w; p.h = size.h
  }
}

// A boss taking a hit: shrink its HP, give it a brief invincibility window
// (so one stomp/fireball doesn't chain into three), and clear the level if
// that was the last point of health.
function hurtBoss(state, boss, amount, particleColor) {
  if (boss.invincible > 0) return
  boss.hp -= amount
  boss.invincible = 45
  spawnParticles(state, boss.x + boss.w / 2, boss.y, particleColor, 10)
  if (boss.hp <= 0) {
    boss.alive = false
    state.score += 2000
    showMessage(state, 'Boss defeated! (No lawsuits were filed)')
    startLevelTransition(state, 'BOSS DEFEATED! (Totally an original character)')
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
  if (state.frame % 60 === 0) state.time -= 1
  if (state.time <= 0 && !state.player.dead) killPlayer(state)

  const p = state.player
  if (!p.dead) {
    const speedMult = p.starTimer > 0 ? 1.3 : 1
    if (input.left) { p.vx -= MOVE_ACCEL; p.facing = -1 }
    if (input.right) { p.vx += MOVE_ACCEL; p.facing = 1 }
    if (!input.left && !input.right) p.vx *= FRICTION
    p.vx = Math.max(-MAX_SPEED * speedMult, Math.min(MAX_SPEED * speedMult, p.vx))
    if (input.jump && p.onGround) p.vy = JUMP_V
    if (input.fire && p.powerState === 'fire' && p.fireCooldown <= 0) {
      const aliveCount = state.fireballs.filter(f => !f.dead && f.owner !== 'boss').length
      if (aliveCount < 2) {
        state.fireballs.push({ x: p.x + p.w / 2, y: p.y + p.h * 0.35, w: 12, h: 12, vx: p.facing * 7, vy: 2, bounces: 0, dead: false, owner: 'player' })
        p.fireCooldown = FIRE_COOLDOWN
      }
    }
  }
  if (p.fireCooldown > 0) p.fireCooldown--
  p.vy += GRAVITY
  if (p.vy > 16) p.vy = 16

  // A dead player free-falls straight through the world (no collisions) —
  // otherwise a death bounce that lands back on the same solid ground it
  // just died on would set onGround again and never fall past H+150,
  // softlocking the respawn/game-over check below.
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
      if (block.contents === 'coin') {
        state.score += 10; state.coinCount += 1
        spawnParticles(state, block.x + TILE / 2, block.y, '#ffd873', 6)
      } else {
        state.powerups.push({ x: block.x, y: block.y - TILE, w: TILE, h: TILE, vx: block.contents === 'star' ? 2.2 : 1.4, vy: 0, type: block.contents })
      }
    } else if (block.kind === 'brick') {
      if (p.powerState !== 'small') {
        block.used = true
        spawnParticles(state, block.x + TILE / 2, block.y + TILE / 2, '#a5652f', 10)
        state.score += 50
      } else {
        block.bump = 6
      }
    }
  })

  if (p.x < 0) p.x = 0
  if (p.y > H + 100) killPlayer(state)

  state.blocks.forEach(b => { if (b.bump > 0) b.bump -= 1 })

  // Powerups drift, fall with gravity, collide with the world; stars bounce.
  state.powerups.forEach(pu => {
    pu.vy += GRAVITY * 0.6
    moveWithCollisions(pu, solids, () => { pu.vy = pu.type === 'star' ? -9 : 0 })
    if (pu.x <= 0) pu.vx = Math.abs(pu.vx)
  })
  state.powerups = state.powerups.filter(pu => {
    if (aabb(pu, p)) {
      if (pu.type === 'mushroom') { grow(state); state.score += 1000; showMessage(state, 'Definitely Not A Mushroom acquired!') }
      else if (pu.type === 'fireflower') { grow(state); p.powerState = 'fire'; state.score += 1000; showMessage(state, 'Suspiciously Fire-Colored Flower acquired!') }
      else if (pu.type === 'star') { p.starTimer = STAR_DURATION; state.score += 1000; showMessage(state, "You feel Legally Distinct and Invincible!") }
      else if (pu.type === '1up') { state.lives += 1; showMessage(state, '1-UP! (Trademark not pending)') }
      return false
    }
    return true
  })

  // Fireballs bounce along the ground; player-thrown ones defeat enemies
  // and hurt the boss, boss-thrown ones hurt the player.
  state.fireballs.forEach(fb => {
    fb.vy += GRAVITY * 0.5
    fb.x += fb.vx
    fb.y += fb.vy
    for (const s of solids) {
      if (aabb(fb, s) && fb.vy > 0) { fb.y = s.y - fb.h; fb.vy = -7; fb.bounces++ }
    }
    if (fb.bounces >= 3) fb.dead = true
    if (fb.owner === 'boss' && !p.dead && p.invincible <= 0 && p.starTimer <= 0 && aabb(fb, p)) {
      fb.dead = true
      shrinkOrDie(state)
    }
  })

  // Enemies patrol, get squished from above, get fireballed, or hurt the
  // player on contact (unless the player is starred, in which case it's
  // the enemy having a bad day).
  state.enemies.forEach(e => {
    if (!e.alive) return
    if (e.squish > 0) { e.squish--; return }
    e.x += e.vx
    if (e.x < e.min || e.x + e.w > e.max) e.vx *= -1

    for (const fb of state.fireballs) {
      if (fb.owner !== 'boss' && !fb.dead && aabb(fb, e)) {
        e.alive = false; e.squish = 20; fb.dead = true
        state.score += 100
        spawnParticles(state, e.x + e.w / 2, e.y, '#ff8a3d', 8)
      }
    }
    if (!e.alive) return

    if (!p.dead && p.invincible <= 0 && aabb(p, e)) {
      if (p.starTimer > 0) {
        e.alive = false; e.squish = 20
        state.score += 100
        spawnParticles(state, e.x + e.w / 2, e.y, '#ffd873', 8)
        return
      }
      const stomp = p.vy > 2 && (p.y + p.h - e.y) < 18
      if (stomp) {
        e.alive = false
        e.squish = 20
        p.vy = -9
        state.score += 100
        spawnParticles(state, e.x + e.w / 2, e.y, '#7a4a22', 6)
      } else {
        shrinkOrDie(state)
      }
    }
  })
  state.enemies = state.enemies.filter(e => e.alive || e.squish > 0)

  // Boss: patrols its arena, lobs projectiles, and can be hurt by a stomp,
  // a player fireball, or (for free) a starred touch.
  if (state.boss && state.boss.alive) {
    const boss = state.boss
    if (boss.invincible > 0) boss.invincible--
    boss.x += boss.vx
    if (boss.x < boss.minX || boss.x > boss.maxX) boss.vx *= -1
    boss.attackCooldown--
    if (boss.attackCooldown <= 0) {
      boss.attackCooldown = 110
      const dir = p.x < boss.x ? -1 : 1
      state.fireballs.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h * 0.4, w: 14, h: 14, vx: dir * 5, vy: -4, bounces: 0, dead: false, owner: 'boss' })
    }

    for (const fb of state.fireballs) {
      if (fb.owner !== 'boss' && !fb.dead && aabb(fb, boss)) {
        fb.dead = true
        state.score += 100
        hurtBoss(state, boss, 1, '#ffd93d')
      }
    }

    if (boss.alive && !p.dead && p.invincible <= 0 && aabb(p, boss)) {
      if (p.starTimer > 0) {
        p.vy = -6
        hurtBoss(state, boss, 1, '#ffd873')
      } else {
        const stomp = p.vy > 2 && (p.y + p.h - boss.y) < 22
        if (stomp) {
          p.vy = -10
          state.score += 200
          hurtBoss(state, boss, 1, '#ffd873')
        } else {
          shrinkOrDie(state)
        }
      }
    }
  }

  state.fireballs = state.fireballs.filter(fb => !fb.dead && fb.x > state.camX - 60 && fb.x < state.camX + W + 60)

  // Loose coins.
  state.coins.forEach(c => {
    if (!c.taken && aabb(p, c)) { c.taken = true; state.score += 10; state.coinCount += 1 }
  })

  // Particles.
  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)

  if (p.invincible > 0) p.invincible--
  if (p.starTimer > 0) p.starTimer--
  if (state.messageTimer > 0) state.messageTimer--

  if (state.status !== 'playing') return // a boss defeat above may have already started a transition

  // Flagpole — a trigger, not a solid, so touching it (from any angle)
  // clears the level. Boss levels have no flag (flagX is null); beating
  // the boss is what clears those instead.
  const level = currentLevel(state)
  if (level.flagX != null && !p.dead && p.x + p.w > level.flagX && p.x < level.flagX + 16 && p.y + p.h > GROUND_Y - 300) {
    startLevelTransition(state)
    return
  }

  const targetCam = Math.max(0, Math.min(level.width - W, p.x - W / 2.5))
  state.camX += (targetCam - state.camX) * 0.2
}
