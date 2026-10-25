// ── Dino Suit Up — pure gameplay state/logic ────────────────────────────
// Framework-agnostic: plain (x, z) world coordinates, no THREE, no DOM.
// One continuous open world: gather resources, craft suits in strict
// tier order, and defeat the boss guarding each tier's "core" before
// that tier becomes craftable. Same tank-style turn+thrust movement and
// toast/effect-queue conventions as this hub's other original 3D games
// (see Avatar: Elemental Grounds' gameEngine.js).
import {
  WORLD_HALF, UNIT_RADIUS, BASE_SPEED, TURN_SPEED,
  ATTACK_RANGE, ATTACK_DURATION, ATTACK_COOLDOWN,
  BOSS_AGGRO_RANGE, BOSS_LEASH_RANGE, BOSS_CONTACT_RANGE, BOSS_CONTACT_COOLDOWN,
  INVULN_TIME, RESOURCE_RESPAWN_TIME, RESOURCE_HIT_YIELD,
  SUIT_TIERS, RESOURCE_KINDS, BOSSES,
} from './constants.js'

function rand(a, b) { return a + Math.random() * (b - a) }
function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function facingVec(yaw) { return { fx: -Math.sin(yaw), fz: -Math.cos(yaw) } }
function randInt(a, b) { return Math.floor(rand(a, b + 1)) }

// ── World generation ─────────────────────────────────────────────────────
// Resources and bosses are placed deterministically-random once per game
// (via Math.random() at creation, like Avatar's generateWorld) so the
// engine's state is the single source of truth the renderer mirrors.
export function generateWorld() {
  const resources = []
  let nextId = 1
  RESOURCE_KINDS.forEach(def => {
    for (let i = 0; i < def.count; i++) {
      const ang = rand(0, Math.PI * 2)
      const r = rand(def.rMin, def.rMax)
      resources.push({
        id: nextId++, kind: def.kind,
        x: Math.cos(ang) * r, z: Math.sin(ang) * r,
        hitsLeft: def.hits, maxHits: def.hits,
        alive: true, respawnTimer: 0,
      })
    }
  })

  const bosses = BOSSES.map((def, idx) => {
    const ang = (idx / BOSSES.length) * Math.PI * 2 + rand(-0.3, 0.3)
    const x = Math.cos(ang) * def.dist, z = Math.sin(ang) * def.dist
    return {
      defIdx: idx, id: def.id, x, z, homeX: x, homeZ: z,
      hp: def.hp, maxHp: def.hp, yaw: 0, radius: def.radius,
      state: 'guard', alive: true, defeated: false,
      hitCooldown: 0, hitFlash: 0,
      wanderTarget: { x, z }, wanderTimer: rand(1, 3),
    }
  })

  return { resources, bosses }
}

// ── Player ───────────────────────────────────────────────────────────────
export function mkPlayer() {
  const tier = SUIT_TIERS[0]
  return {
    x: 0, z: 0, yaw: 0,
    suitTier: 0,
    hp: tier.maxHp, maxHp: tier.maxHp,
    atk: tier.atk, def: tier.def, speedMult: tier.speedMult,
    materials: { wood: 0, stone: 0, bone: 0, iron: 0, crystal: 0, tech: 0 },
    cores: { stone: false, bone: false, iron: false, crystal: false, tech: false },
    attackTimer: 0, attackCooldown: 0, hitIds: new Set(),
    invuln: 0, hitFlash: 0,
  }
}

export function createGame() {
  const world = generateWorld()
  return {
    player: mkPlayer(),
    world,
    toast: null, effects: [],
    won: false, elapsed: 0, bossesDefeated: 0,
  }
}

function setToast(state, text, kind = 'info') { state.toast = { text, timer: 2.6, kind } }
function pushEffect(state, x, z, color, radius, life, kind = 'hit') {
  state.effects.push({ x, z, color, radius, life, maxLife: life, kind })
}

// ── Crafting ─────────────────────────────────────────────────────────────
export function canCraft(player, tierIdx) {
  if (tierIdx !== player.suitTier + 1) return false
  if (tierIdx < 0 || tierIdx >= SUIT_TIERS.length) return false
  const tier = SUIT_TIERS[tierIdx]
  if (tier.requiresCore && !player.cores[tier.requiresCore]) return false
  return Object.entries(tier.cost).every(([k, v]) => (player.materials[k] || 0) >= v)
}

export function craftSuit(state, tierIdx) {
  const player = state.player
  if (!canCraft(player, tierIdx)) return false
  const tier = SUIT_TIERS[tierIdx]
  for (const [k, v] of Object.entries(tier.cost)) player.materials[k] -= v
  player.suitTier = tierIdx
  player.maxHp = tier.maxHp
  player.hp = tier.maxHp
  player.atk = tier.atk
  player.def = tier.def
  player.speedMult = tier.speedMult
  pushEffect(state, player.x, player.z, 0xffffff, 2.2, 0.6, 'buff')
  setToast(state, `Crafted the ${tier.name}!`, 'good')
  if (tierIdx === SUIT_TIERS.length - 1) {
    state.won = true
    setToast(state, `The Cyborg Suit is complete. You win!`, 'good')
  }
  return true
}

// ── Combat / resource resolution ────────────────────────────────────────
function applyDamageToBoss(state, boss, amount) {
  boss.hp -= amount
  boss.hitFlash = 0.25
  if (boss.hp <= 0 && boss.alive) {
    boss.hp = 0
    boss.alive = false
    boss.defeated = true
    const def = BOSSES[boss.defIdx]
    state.player.cores[def.coreId] = true
    state.bossesDefeated += 1
    setToast(state, `Defeated ${def.name}! Core obtained.`, 'good')
    pushEffect(state, boss.x, boss.z, def.color, 4, 0.8, 'burst')
  }
}

function resolveHarvest(state, node) {
  node.hitsLeft -= 1
  const gained = randInt(RESOURCE_HIT_YIELD[0], RESOURCE_HIT_YIELD[1])
  state.player.materials[node.kind] = (state.player.materials[node.kind] || 0) + gained
  pushEffect(state, node.x, node.z, 0xffffff, 0.8, 0.3, 'hit')
  if (node.hitsLeft <= 0) {
    node.alive = false
    node.respawnTimer = RESOURCE_RESPAWN_TIME
  }
}

function resolvePlayerAttack(state, dt) {
  const player = state.player
  if (player.attackTimer <= 0) return
  const { fx, fz } = facingVec(player.yaw)
  const tipX = player.x + fx * 1.4, tipZ = player.z + fz * 1.4

  state.world.resources.forEach(node => {
    if (!node.alive || player.hitIds.has('r' + node.id)) return
    if (dist2(tipX, tipZ, node.x, node.z) < ATTACK_RANGE) {
      player.hitIds.add('r' + node.id)
      resolveHarvest(state, node)
    }
  })

  state.world.bosses.forEach(boss => {
    if (!boss.alive || player.hitIds.has('b' + boss.id)) return
    if (dist2(tipX, tipZ, boss.x, boss.z) < ATTACK_RANGE + boss.radius) {
      player.hitIds.add('b' + boss.id)
      applyDamageToBoss(state, boss, player.atk)
      pushEffect(state, boss.x, boss.z, 0xffffff, 0.9, 0.3, 'hit')
    }
  })
}

// ── Boss AI ──────────────────────────────────────────────────────────────
function stepBoss(state, boss, dt) {
  if (!boss.alive) return
  const player = state.player
  const d = dist2(boss.x, boss.z, player.x, player.z)

  if (boss.state === 'guard' && d < BOSS_AGGRO_RANGE) boss.state = 'chase'
  else if (boss.state === 'chase' && d > BOSS_LEASH_RANGE) boss.state = 'guard'

  const def = BOSSES[boss.defIdx]
  let tx = boss.x, tz = boss.z, speedMult = 1

  if (boss.state === 'chase') {
    tx = player.x; tz = player.z
  } else {
    boss.wanderTimer -= dt
    const dHome = dist2(boss.x, boss.z, boss.wanderTarget.x, boss.wanderTarget.z)
    if (boss.wanderTimer <= 0 || dHome < 0.6) {
      const ang = rand(0, Math.PI * 2), rad = rand(3, 9)
      boss.wanderTarget = { x: boss.homeX + Math.cos(ang) * rad, z: boss.homeZ + Math.sin(ang) * rad }
      boss.wanderTimer = rand(2, 4)
    }
    tx = boss.wanderTarget.x; tz = boss.wanderTarget.z
    speedMult = 0.4
  }

  const dx = tx - boss.x, dz = tz - boss.z, len = Math.hypot(dx, dz) || 1
  if (len > 0.1) {
    boss.x += (dx / len) * def.speed * speedMult * dt
    boss.z += (dz / len) * def.speed * speedMult * dt
    boss.yaw = Math.atan2(-(dx), -(dz))
  }

  if (boss.hitCooldown > 0) boss.hitCooldown -= dt
  if (boss.hitFlash > 0) boss.hitFlash -= dt

  if (boss.hitCooldown <= 0 && player.invuln <= 0 && dist2(boss.x, boss.z, player.x, player.z) < BOSS_CONTACT_RANGE + boss.radius) {
    const dmg = Math.max(1, Math.round(def.atk - player.def))
    player.hp -= dmg
    player.invuln = INVULN_TIME
    player.hitFlash = 0.3
    boss.hitCooldown = BOSS_CONTACT_COOLDOWN
    setToast(state, `${def.name} hits you for ${dmg}!`, 'bad')
    pushEffect(state, player.x, player.z, 0xff3a3a, 0.9, 0.3, 'hit')
  }
}

// ── Resource respawn ─────────────────────────────────────────────────────
function stepResources(state, dt) {
  state.world.resources.forEach(node => {
    if (node.alive) return
    node.respawnTimer -= dt
    if (node.respawnTimer <= 0) { node.alive = true; node.hitsLeft = node.maxHits }
  })
}

// ── Player death / respawn (soft — no punishment beyond a trip home) ────
function stepPlayerDeath(state) {
  const player = state.player
  if (player.hp > 0) return
  player.x = 0; player.z = 0
  player.hp = player.maxHp
  player.invuln = INVULN_TIME
  setToast(state, 'Knocked out! Back to base, fully healed.', 'bad')
}

// ── Main step ────────────────────────────────────────────────────────────
// input: { turn: -1..1, thrust: -1..1, attack: bool }
export function stepGame(state, input, dt) {
  const player = state.player
  state.elapsed += dt

  player.yaw += (input.turn || 0) * TURN_SPEED * dt
  const { fx, fz } = facingVec(player.yaw)
  const speed = BASE_SPEED * player.speedMult
  let nx = player.x + fx * (input.thrust || 0) * speed * dt
  let nz = player.z + fz * (input.thrust || 0) * speed * dt
  nx = clamp(nx, -WORLD_HALF, WORLD_HALF)
  nz = clamp(nz, -WORLD_HALF, WORLD_HALF)
  player.x = nx; player.z = nz

  if (player.attackCooldown > 0) player.attackCooldown -= dt
  if (player.attackTimer > 0) player.attackTimer -= dt
  if (player.invuln > 0) player.invuln -= dt
  if (player.hitFlash > 0) player.hitFlash -= dt

  if (input.attack && player.attackCooldown <= 0 && player.attackTimer <= 0) {
    player.attackTimer = ATTACK_DURATION
    player.attackCooldown = ATTACK_COOLDOWN
    player.hitIds.clear()
  }
  resolvePlayerAttack(state, dt)

  state.world.bosses.forEach(boss => stepBoss(state, boss, dt))
  stepResources(state, dt)
  stepPlayerDeath(state)

  state.effects = state.effects.filter(e => { e.life -= dt; return e.life > 0 })
  if (state.toast) { state.toast.timer -= dt; if (state.toast.timer <= 0) state.toast = null }
}

// ── Save / load ──────────────────────────────────────────────────────────
export function serializeState(state) {
  return {
    player: {
      x: state.player.x, z: state.player.z, yaw: state.player.yaw,
      suitTier: state.player.suitTier, hp: state.player.hp,
      materials: { ...state.player.materials }, cores: { ...state.player.cores },
    },
    bosses: state.world.bosses.map(b => ({ id: b.id, alive: b.alive, defeated: b.defeated })),
    resources: state.world.resources.map(r => ({ id: r.id, alive: r.alive, hitsLeft: r.hitsLeft, respawnTimer: r.respawnTimer })),
    bossesDefeated: state.bossesDefeated, won: state.won, elapsed: state.elapsed,
  }
}

export function applySavedState(state, saved) {
  if (!saved) return state
  const tier = SUIT_TIERS[saved.player.suitTier] || SUIT_TIERS[0]
  Object.assign(state.player, {
    x: saved.player.x, z: saved.player.z, yaw: saved.player.yaw,
    suitTier: saved.player.suitTier, hp: saved.player.hp,
    maxHp: tier.maxHp, atk: tier.atk, def: tier.def, speedMult: tier.speedMult,
    materials: { ...state.player.materials, ...saved.player.materials },
    cores: { ...state.player.cores, ...saved.player.cores },
  })
  saved.bosses?.forEach(sb => {
    const boss = state.world.bosses.find(b => b.id === sb.id)
    if (boss) { boss.alive = sb.alive; boss.defeated = sb.defeated; if (!boss.alive) boss.hp = 0 }
  })
  saved.resources?.forEach(sr => {
    const node = state.world.resources.find(r => r.id === sr.id)
    if (node) { node.alive = sr.alive; node.hitsLeft = sr.hitsLeft; node.respawnTimer = sr.respawnTimer }
  })
  state.bossesDefeated = saved.bossesDefeated || 0
  state.won = !!saved.won
  state.elapsed = saved.elapsed || 0
  return state
}

export function saveGame(state) {
  try {
    localStorage.setItem('dino-suit-up-save-v1', JSON.stringify(serializeState(state)))
  } catch { /* storage unavailable (private mode, quota) — fail silently */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem('dino-suit-up-save-v1')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearSave() {
  try { localStorage.removeItem('dino-suit-up-save-v1') } catch { /* noop */ }
}
