// ── The Obvious Mega Man Knockoff — game engine ───────────────────────
// Pure state/physics, no rendering. One frame of simulation per
// stepGame call; render.js reads the resulting state to draw it.
// Side-scrolling platformer physics (same family as The Obvious Mario
// Knockoff) plus a weapon-switching run-and-gun layer.

import {
  W, H, GROUND_Y, GRAVITY, JUMP_V, MOVE_ACCEL, MAX_SPEED, FRICTION,
  PLAYER_SIZE, ENERGY_START, INVINCIBLE_FRAMES, CONTACT_DAMAGE,
  BUSTER_COOLDOWN, BUSTER_SPEED, BUSTER_DAMAGE,
  WEAPON_COOLDOWN, WEAPON_SPEED, WEAPON_AMMO_MAX, WEAPON_DAMAGE, WEAKNESS_MULT,
  BOSS_HP, BOSS_CONTACT_DAMAGE, ENEMY_DEFS,
} from './constants.js'
import { stageById } from './levels.js'
import { BOSSES, bossForStage, WEAPONS } from './bossData.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function solidsFor(stage) {
  const solids = []
  for (const [x0, x1] of stage.groundSegments) solids.push({ x: x0, y: GROUND_Y, w: x1 - x0, h: H - GROUND_Y })
  for (const p of stage.platforms) solids.push(p)
  return solids
}

function moveWithCollisions(e, solids) {
  e.x += e.vx
  for (const s of solids) {
    if (aabb(e, s)) {
      if (e.vx > 0) e.x = s.x - e.w
      else if (e.vx < 0) e.x = s.x + s.w
      e.vx = 0
    }
  }
  e.y += e.vy
  e.onGround = false
  for (const s of solids) {
    if (aabb(e, s)) {
      if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; e.onGround = true }
      else if (e.vy < 0) { e.y = s.y + s.h; e.vy = 0 }
    }
  }
}

function spawnParticles(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5 - 1, life: 22, color })
  }
}

function makeEnemy(def) {
  const base = ENEMY_DEFS[def.type]
  return {
    type: def.type, x: def.x, y: def.y, w: base.w, h: base.h,
    minX: def.minX, maxX: def.maxX, baseY: def.baseY,
    facing: def.facing || 'left',
    hp: base.hp, alive: true, hitFlash: 0, vx: base.speed, dir: 1, attackCooldown: 60 + Math.random() * 60,
  }
}

function freshPlayer(stageId) {
  return {
    x: 60, y: GROUND_Y - PLAYER_SIZE.h, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0,
    onGround: false, facing: 1, energy: ENERGY_START, maxEnergy: ENERGY_START,
    invincible: 50, dead: false, shootCooldown: 0, stageId,
  }
}

export function freshState(stageId, progress) {
  const stage = stageById(stageId)
  const state = {
    stageId, status: 'playing', frame: 0, score: 0,
    message: '', messageTimer: 0, transitionTimer: 0,
    weapons: progress.weapons, equippedWeapon: progress.equippedWeapon,
    weaponAmmo: {},
    camX: 0,
    player: freshPlayer(stageId),
    enemies: stage.enemies.map(makeEnemy),
    enemyShots: [], playerShots: [], particles: [],
    boss: null, bossActive: false, rewardWeaponId: null,
  }
  for (const w of progress.weapons) if (w !== 'buster') state.weaponAmmo[w] = WEAPON_AMMO_MAX
  return state
}

function showMessage(state, text, frames = 90) { state.message = text; state.messageTimer = frames }

function killPlayer(state) {
  if (state.player.dead) return
  state.player.dead = true
  state.player.vy = -11
  state.status = 'retry'
  state.transitionTimer = 90
  showMessage(state, 'Mission failed — retrying the stage...', 200)
}

function hurtPlayer(state, amount) {
  const p = state.player
  if (p.invincible > 0 || p.dead) return
  p.energy -= amount
  p.invincible = INVINCIBLE_FRAMES
  spawnParticles(state, p.x + p.w / 2, p.y + p.h / 2, '#ff5c5c', 8)
  if (p.energy <= 0) { p.energy = 0; killPlayer(state) }
}

function currentWeaponDamageTo(state, isWeakness) {
  if (state.equippedWeapon === 'buster') return BUSTER_DAMAGE
  return isWeakness ? WEAPON_DAMAGE * WEAKNESS_MULT : WEAPON_DAMAGE
}

function fireShot(state) {
  const p = state.player
  if (p.shootCooldown > 0) return
  const weaponId = state.equippedWeapon
  if (weaponId !== 'buster') {
    const ammo = state.weaponAmmo[weaponId] || 0
    if (ammo <= 0) { state.equippedWeapon = 'buster'; return fireShot(state) }
    state.weaponAmmo[weaponId] = ammo - 1
    p.shootCooldown = WEAPON_COOLDOWN
  } else {
    p.shootCooldown = BUSTER_COOLDOWN
  }
  const def = WEAPONS[weaponId]
  const speed = weaponId === 'buster' ? BUSTER_SPEED : WEAPON_SPEED
  state.playerShots.push({
    x: p.facing > 0 ? p.x + p.w : p.x - 10, y: p.y + p.h * 0.42, w: 10, h: 6,
    vx: p.facing * speed, weaponId, color: def.color, glow: def.glow,
  })
}

function startBossIntro(state) {
  const stage = stageById(state.stageId)
  const bossDef = bossForStage(state.stageId)
  state.boss = {
    id: bossDef.id, x: stage.width - 160, y: GROUND_Y - 70, w: 60, h: 70,
    hp: BOSS_HP, maxHp: BOSS_HP, alive: true, invincible: 0,
    vx: 1.6, minX: stage.width - 420, maxX: stage.width - 100, attackCooldown: 70,
  }
  state.bossActive = true
  showMessage(state, `${bossDef.name} appears!`, 110)
}

function finishStage(state) {
  const bossDef = bossForStage(state.stageId)
  state.status = 'clear'
  state.rewardWeaponId = bossDef.weaponId
  state.score += 2000
  showMessage(state, `${bossDef.name} defeated! ${WEAPONS[bossDef.weaponId].name} acquired!`, 160)
}

export function stepGame(state, input) {
  if (state.status === 'retry' || state.status === 'clear') {
    state.transitionTimer--
    return
  }
  if (state.status !== 'playing') return
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  const stage = stageById(state.stageId)
  const p = state.player
  const solids = solidsFor(stage)

  if (p.dead) {
    p.x += p.vx; p.y += p.vy; p.vy += GRAVITY
    return
  }

  if (input.left) { p.facing = -1; p.vx -= MOVE_ACCEL }
  else if (input.right) { p.facing = 1; p.vx += MOVE_ACCEL }
  else p.vx *= FRICTION
  p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx))

  if (input.jump && p.onGround) p.vy = JUMP_V
  p.vy += GRAVITY
  if (p.vy > 16) p.vy = 16

  if (p.shootCooldown > 0) p.shootCooldown--
  if (input.shoot) fireShot(state)

  if (input.weaponSelect != null) {
    const wid = input.weaponSelect
    if (wid === 'buster' || state.weapons.has(wid)) state.equippedWeapon = wid
  }

  moveWithCollisions(p, solids)
  p.x = Math.max(0, Math.min(stage.width - p.w, p.x))
  // Falling into a pit always ends the attempt — bypasses invincibility
  // frames on purpose, since otherwise getting knocked into a pit right
  // after taking a hit would just free-fall forever with no way to die.
  if (p.y > H + 150) killPlayer(state)
  if (p.invincible > 0) p.invincible--

  // ── Enemies ──────────────────────────────────────────────────────
  for (const e of state.enemies) {
    if (!e.alive) { if (e.hitFlash > 0) e.hitFlash--; continue }
    if (e.hitFlash > 0) e.hitFlash--
    if (e.type === 'walker') {
      e.x += e.vx * e.dir
      if (e.x < e.minX || e.x > e.maxX) e.dir *= -1
    } else if (e.type === 'flyer') {
      e.x += e.vx * e.dir
      if (e.x < e.minX || e.x > e.maxX) e.dir *= -1
      e.y = e.baseY + Math.sin(state.frame * 0.05) * 18
    } else if (e.type === 'turret') {
      e.attackCooldown--
      if (e.attackCooldown <= 0) {
        e.attackCooldown = 110
        const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[e.facing] || [-1, 0]
        state.enemyShots.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, w: 8, h: 8, vx: dir[0] * 4, vy: dir[1] * 4 })
      }
    }
    if (p.invincible <= 0 && aabb(p, e)) hurtPlayer(state, ENEMY_DEFS[e.type].contactDamage)
  }

  // ── Boss trigger / AI ────────────────────────────────────────────
  if (!state.bossActive && state.boss == null && p.x + p.w > stage.bossX) startBossIntro(state)
  if (state.boss && state.boss.alive) {
    const b = state.boss
    if (b.invincible > 0) b.invincible--
    b.x += b.vx
    if (b.x < b.minX || b.x > b.maxX) b.vx *= -1
    b.attackCooldown--
    if (b.attackCooldown <= 0) {
      b.attackCooldown = 95
      const dir = p.x < b.x ? -1 : 1
      state.enemyShots.push({ x: b.x + b.w / 2, y: b.y + b.h * 0.4, w: 12, h: 12, vx: dir * 4.5, vy: -2, boss: true })
    }
    if (p.invincible <= 0 && aabb(p, b)) hurtPlayer(state, BOSS_CONTACT_DAMAGE)
  }

  // ── Enemy shots ──────────────────────────────────────────────────
  state.enemyShots.forEach(s => {
    s.vy += s.boss ? 0.25 : 0
    s.x += s.vx; s.y += s.vy
    if (p.invincible <= 0 && aabb(p, s)) { hurtPlayer(state, s.boss ? 2 : 1); s.dead = true }
  })
  state.enemyShots = state.enemyShots.filter(s => !s.dead && s.x > -30 && s.x < stage.width + 30 && s.y < H + 30)

  // ── Player shots ─────────────────────────────────────────────────
  const bossDef = bossForStage(state.stageId)
  state.playerShots.forEach(s => {
    s.x += s.vx
    for (const sld of solids) if (aabb(s, sld)) s.dead = true
    for (const e of state.enemies) {
      if (e.alive && aabb(s, e)) {
        e.hp -= currentWeaponDamageTo(state, false)
        e.hitFlash = 8
        s.dead = true
        spawnParticles(state, e.x + e.w / 2, e.y, s.color, 6)
        if (e.hp <= 0) { e.alive = false; state.score += 50 }
      }
    }
    if (!s.dead && state.boss && state.boss.alive && aabb(s, state.boss)) {
      if (state.boss.invincible <= 0) {
        const isWeak = s.weaponId === bossDef.weakTo
        state.boss.hp -= currentWeaponDamageTo(state, isWeak)
        state.boss.invincible = 12
        spawnParticles(state, state.boss.x + state.boss.w / 2, state.boss.y + state.boss.h / 2, isWeak ? '#fff' : s.color, isWeak ? 16 : 8)
        if (state.boss.hp <= 0) { state.boss.alive = false; finishStage(state) }
      }
      s.dead = true
    }
  })
  state.playerShots = state.playerShots.filter(s => !s.dead && s.x > -20 && s.x < stage.width + 20)

  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)

  if (state.status !== 'playing') return

  const targetCam = Math.max(0, Math.min(stage.width - W, p.x - W / 2.5))
  state.camX += (targetCam - state.camX) * 0.2
}
