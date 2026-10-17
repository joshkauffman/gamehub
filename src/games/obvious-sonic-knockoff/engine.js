// ── The Obvious Sonic Knockoff — game engine ──────────────────────────
// Pure state/physics, no rendering. One frame of simulation per
// stepGame call; render.js reads the resulting state to draw it.
// Ground is a list of (possibly sloped) segments rather than a tile
// grid — groundYAt() finds the segment under a given x and interpolates
// its height, which is what gives slopes their speed-up/slow-down feel.

import {
  W, H, HUD_H, GRAVITY, JUMP_V, MAX_GROUND_SPEED, GROUND_ACCEL, GROUND_DECEL, FRICTION,
  AIR_ACCEL, MAX_FALL_SPEED, SLOPE_FACTOR, SPINDASH_CHARGE_STEP, SPINDASH_MAX_CHARGE, SPINDASH_DECAY,
  PLAYER_STAND_SIZE, PLAYER_ROLL_SIZE, LIVES_START, INVINCIBLE_FRAMES, RING_SCATTER_COUNT,
  ENEMY_DEFS, BOSS_HP,
} from './constants.js'
import { ZONES } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function groundYAt(segments, x) {
  for (const s of segments) {
    if (x >= s.x0 && x <= s.x1) {
      const t = s.x1 === s.x0 ? 0 : (x - s.x0) / (s.x1 - s.x0)
      return s.y0 + (s.y1 - s.y0) * t
    }
  }
  return null
}
function slopeAt(segments, x) {
  for (const s of segments) {
    if (x >= s.x0 && x <= s.x1) {
      return s.x1 === s.x0 ? 0 : (s.y1 - s.y0) / (s.x1 - s.x0)
    }
  }
  return 0
}

function freshZoneEntities(zone) {
  return {
    rings: zone.rings.map(([x, y], i) => ({ id: i, x, y, taken: false })),
    enemies: zone.enemies.map(e => ({ ...e, alive: true, dir: 1, squish: 0 })),
    particles: [],
    bossShots: [],
  }
}

function loadZone(state, idx, keepRingsAndLives) {
  const zone = ZONES[idx]
  const ent = freshZoneEntities(zone)
  state.zoneIndex = idx
  state.rings = ent.rings
  state.enemies = ent.enemies
  state.particles = ent.particles
  state.bossShots = ent.bossShots
  state.boss = zone.bossArenaX != null ? {
    x: zone.bossArenaX + 350, y: 200, w: 70, h: 60, hp: BOSS_HP, alive: true, awake: false,
    vx: 1.4, minX: zone.bossArenaX + 150, maxX: zone.width - 120, attackCooldown: 90, invincible: 0,
  } : null
  state.camX = 0
  state.status = 'playing'
  if (!keepRingsAndLives) state.ringCount = 0
  const spawnX = 60
  // Spawn flush with the actual ground height at spawnX, not a guessed
  // y — a mismatch here left the player a few pixels above the surface,
  // so onGround read false for the first frame or two after loading.
  const spawnGroundY = groundYAt(zone.groundSegments, spawnX + PLAYER_STAND_SIZE.w / 2) ?? 460
  state.player = {
    x: spawnX, y: spawnGroundY - PLAYER_STAND_SIZE.h, w: PLAYER_STAND_SIZE.w, h: PLAYER_STAND_SIZE.h, vx: 0, vy: 0,
    onGround: true, facing: 1, rolling: false, spindash: 0, invincible: 60, dead: false,
  }
}

export function freshState() {
  const state = { score: 0, ringCount: 0, lives: LIVES_START, frame: 0, message: '', messageTimer: 0, transitionTimer: 0 }
  loadZone(state, 0, false)
  return state
}

export function currentZone(state) { return ZONES[state.zoneIndex] }

function spawnParticles(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6 - 1, life: 24, color })
  }
}

function showMessage(state, text) { state.message = text; state.messageTimer = 90 }

function scatterRings(state) {
  const p = state.player
  for (let i = 0; i < RING_SCATTER_COUNT && i < state.ringCount; i++) {
    state.particles.push({ x: p.x + p.w / 2, y: p.y, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 7 - 2, life: 40, color: '#ffd93d', ring: true })
  }
  state.ringCount = 0
}

function killPlayer(state) {
  if (state.player.dead) return
  state.lives -= 1
  state.player.dead = true
  state.player.vy = -12
  if (state.lives <= 0) state.status = 'gameover'
}

function respawn(state) { loadZone(state, state.zoneIndex, true) }

function hurtPlayer(state) {
  const p = state.player
  if (p.invincible > 0 || p.dead) return
  if (state.ringCount > 0) {
    scatterRings(state)
    p.invincible = INVINCIBLE_FRAMES
    p.vy = -8
    p.vx = p.facing > 0 ? -4 : 4
  } else {
    killPlayer(state)
  }
}

function startZoneTransition(state, label) {
  state.status = 'zoneTransition'
  state.transitionTimer = 120
  showMessage(state, label)
}

export function stepGame(state, input) {
  if (state.status === 'zoneTransition') {
    state.transitionTimer--
    if (state.transitionTimer <= 0) {
      if (state.zoneIndex + 1 < ZONES.length) loadZone(state, state.zoneIndex + 1, true)
      else state.status = 'win'
    }
    return
  }
  if (state.status !== 'playing') return
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  const zone = currentZone(state)
  const p = state.player
  const segs = zone.groundSegments

  if (p.dead) {
    p.x += p.vx
    p.y += p.vy
    p.vy += GRAVITY
    if (p.y > H + 200) { if (state.lives > 0) respawn(state) }
    return
  }

  // ── Spin-dash: hold Down to duck; while ducking, tapping Jump revs a
  // charge; releasing Down launches you at a speed based on the charge.
  const ducking = input.down && p.onGround
  if (ducking) {
    p.vx *= 0.9
    if (input.jump && !p.prevJumpHeld) {
      p.spindash = Math.min(SPINDASH_MAX_CHARGE, p.spindash + SPINDASH_CHARGE_STEP)
      spawnParticles(state, p.x + p.w / 2, p.y + p.h, '#ffe9a8', 4)
    } else if (p.spindash > 0) {
      p.spindash = Math.max(0, p.spindash - SPINDASH_DECAY)
    }
  } else if (p.spindash > 0) {
    p.vx = p.facing * (6 + p.spindash)
    p.spindash = 0
    spawnParticles(state, p.x + p.w / 2, p.y + p.h / 2, '#fff', 10)
  }

  // ── Ground movement ───────────────────────────────────────────────
  if (p.onGround && !ducking) {
    if (input.left) { p.facing = -1; p.vx -= (p.vx > 0 ? GROUND_DECEL : GROUND_ACCEL) }
    else if (input.right) { p.facing = 1; p.vx += (p.vx < 0 ? GROUND_DECEL : GROUND_ACCEL) }
    else if (p.vx > 0) p.vx = Math.max(0, p.vx - FRICTION)
    else if (p.vx < 0) p.vx = Math.min(0, p.vx + FRICTION)
    p.vx = Math.max(-MAX_GROUND_SPEED * 1.6, Math.min(MAX_GROUND_SPEED * 1.6, p.vx))

    // A slope pulls you the same way gravity would on a real incline:
    // positive grade (ground falling away to the right) accelerates
    // you rightward regardless of which way you're currently moving,
    // and vice versa — that's what makes uphill bleed off speed and
    // downhill build it back.
    const grade = slopeAt(segs, p.x + p.w / 2)
    p.vx += grade * SLOPE_FACTOR
  } else if (!p.onGround) {
    if (input.left) { p.facing = -1; p.vx -= AIR_ACCEL }
    else if (input.right) { p.facing = 1; p.vx += AIR_ACCEL }
    p.vx = Math.max(-MAX_GROUND_SPEED * 1.6, Math.min(MAX_GROUND_SPEED * 1.6, p.vx))
  }

  // Jump (only from standing, not mid-spindash-charge). Shares the one
  // prevJumpHeld edge-tracker with the spin-dash charge above — the two
  // are mutually exclusive via the `ducking` flag, so there's no risk
  // of a single press doing both.
  if (input.jump && !p.prevJumpHeld && p.onGround && !ducking) {
    p.vy = JUMP_V
    p.onGround = false
    spawnParticles(state, p.x + p.w / 2, p.y + p.h, 'rgba(255,255,255,0.6)', 3)
  }
  p.prevJumpHeld = input.jump

  p.rolling = !p.onGround || p.spindash > 0 || (ducking && Math.abs(p.vx) > 2)

  // ── Integrate position ──────────────────────────────────────────────
  p.x += p.vx
  if (p.x < 10) { p.x = 10; p.vx = 0 }
  if (!p.onGround) {
    p.vy += GRAVITY
    if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED
    p.y += p.vy
  }

  const groundY = groundYAt(segs, p.x + p.w / 2)
  // Curling up shrinks the hitbox — re-anchor to the feet (bottom edge)
  // so the shrink doesn't lift the box off the ground and falsely read
  // as airborne the same frame a spin-dash starts charging.
  const h = p.rolling ? PLAYER_ROLL_SIZE.h : PLAYER_STAND_SIZE.h
  if (h !== p.h) p.y += p.h - h
  p.h = h
  if (groundY != null && p.y + h >= groundY && p.vy >= 0) {
    p.y = groundY - h
    p.vy = 0
    p.onGround = true
  } else {
    p.onGround = false
  }

  if (p.y > H + 200) hurtPlayer(state) // fell into a pit

  if (p.invincible > 0) p.invincible--

  // ── Rings ─────────────────────────────────────────────────────────
  for (const r of state.rings) {
    if (!r.taken && aabb(p, { x: r.x - 10, y: r.y - 10, w: 20, h: 20 })) {
      r.taken = true
      state.ringCount++
      state.score += 10
    }
  }

  // ── Particles (rings scattered on hit can be "collected" again) ───
  state.particles.forEach(pt => {
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life--
    if (pt.ring && pt.life < 30 && aabb(p, { x: pt.x - 10, y: pt.y - 10, w: 20, h: 20 })) {
      pt.life = 0
      state.ringCount++
    }
  })
  state.particles = state.particles.filter(pt => pt.life > 0)

  // ── Enemies ──────────────────────────────────────────────────────
  for (const e of state.enemies) {
    if (!e.alive) { if (e.squish > 0) e.squish--; continue }
    const def = ENEMY_DEFS[e.type]
    if (e.type === 'crawler') {
      e.x += def.speed * e.dir
      if (e.x < e.minX || e.x > e.maxX) e.dir *= -1
    } else if (e.type === 'buzzer') {
      e.x += def.speed * e.dir
      if (e.x < e.minX || e.x > e.maxX) e.dir *= -1
      e.y = e.baseY + Math.sin(state.frame * 0.05) * 20
    }
    const rect = { x: e.x, y: e.y, w: def.w, h: def.h }
    if (p.invincible <= 0 && aabb(p, rect)) {
      if (p.rolling) {
        e.alive = false
        e.squish = 20
        p.vy = Math.min(p.vy, -6)
        state.score += 100
        spawnParticles(state, e.x + def.w / 2, e.y, '#ff8a3d', 10)
      } else {
        hurtPlayer(state)
      }
    }
  }

  // ── Boss ─────────────────────────────────────────────────────────
  if (state.boss && state.boss.alive) {
    const b = state.boss
    if (!b.awake && p.x > b.x - 300) b.awake = true
    if (b.invincible > 0) b.invincible--
    if (b.awake) {
      b.x += b.vx
      if (b.x < b.minX || b.x > b.maxX) b.vx *= -1
      b.attackCooldown--
      if (b.attackCooldown <= 0) {
        b.attackCooldown = 100
        state.bossShots.push({ x: b.x + b.w / 2, y: b.y + b.h, vx: 0, vy: 4, w: 10, h: 10 })
      }
    }
    if (p.invincible <= 0 && aabb(p, b)) {
      if (p.rolling && b.invincible <= 0) {
        b.hp--
        b.invincible = 40
        p.vy = -10
        spawnParticles(state, b.x + b.w / 2, b.y + b.h / 2, '#ffd93d', 14)
        if (b.hp <= 0) {
          b.alive = false
          state.score += 1000
          spawnParticles(state, b.x + b.w / 2, b.y + b.h / 2, '#ff6a3d', 40)
          startZoneTransition(state, 'ZONE CLEAR!')
        }
      } else if (!p.rolling) {
        hurtPlayer(state)
      }
    }
  }
  state.bossShots.forEach(s => { s.x += s.vx; s.y += s.vy })
  state.bossShots = state.bossShots.filter(s => {
    if (s.y > H + 50) return false
    if (p.invincible <= 0 && aabb(p, s)) { hurtPlayer(state); return false }
    return true
  })

  if (state.status !== 'playing') return // a boss defeat above may have already started a transition

  // ── Goal signpost (non-boss zones) ─────────────────────────────────
  if (zone.goalX != null && p.x > zone.goalX) {
    startZoneTransition(state, zone.id === ZONES[ZONES.length - 1].id ? 'ZONE CLEAR!' : `${zone.name.toUpperCase()} CLEAR!`)
    return
  }

  const targetCam = Math.max(0, Math.min(zone.width - W, p.x - W / 2.5))
  state.camX += (targetCam - state.camX) * 0.2
}
