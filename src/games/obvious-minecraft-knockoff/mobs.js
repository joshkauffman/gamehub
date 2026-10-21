// ── The Obvious Minecraft Knockoff — hostile mobs ──────────────────────
// Pure state + AI, no Three.js — a mob is a plain object; stepMob
// mutates it given the world (for ground-following) and the player's
// position. No rendering here at all.

export const MOB_SPEED = 1.6
export const MOB_CHASE_SPEED = 2.3
export const MOB_HP = 6
export const MOB_DETECT_RANGE = 11
export const MOB_CONTACT_RANGE = 0.9
export const MOB_CONTACT_DAMAGE = 1
export const MOB_HIT_COOLDOWN = 0.9 // seconds between contact hits on the player
export const MAX_MOBS = 8
export const MOB_DESPAWN_RANGE = 40
export const MOB_HALF_W = 0.3
export const MOB_HEIGHT = 1.8

let nextMobId = 1
export function freshMob(x, y, z) {
  return {
    id: nextMobId++,
    x, y, z,
    hp: MOB_HP,
    state: 'wander',
    wanderTarget: null,
    wanderTimer: 0,
    hitCooldown: 0,
    alive: true,
  }
}

function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz
  return Math.hypot(dx, dz)
}

// world is only used for groundHeightBelow (ground-following, no real
// physics) — pass the same { groundHeightBelow } style object the
// voxel world module exports, or any object with that shape.
export function stepMob(mob, groundHeightBelowFn, playerPos, dt) {
  if (!mob.alive) return

  const d = dist2D(mob.x, mob.z, playerPos.x, playerPos.z)

  if (d < MOB_DETECT_RANGE) {
    mob.state = 'chase'
  } else if (mob.state === 'chase') {
    mob.state = 'wander'
    mob.wanderTarget = null
  }

  let speed = MOB_SPEED
  let targetX = mob.x, targetZ = mob.z

  if (mob.state === 'chase') {
    speed = MOB_CHASE_SPEED
    targetX = playerPos.x
    targetZ = playerPos.z
  } else {
    mob.wanderTimer -= dt
    if (!mob.wanderTarget || mob.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2
      const radius = 2 + Math.random() * 4
      mob.wanderTarget = { x: mob.x + Math.cos(angle) * radius, z: mob.z + Math.sin(angle) * radius }
      mob.wanderTimer = 2 + Math.random() * 3
    }
    targetX = mob.wanderTarget.x
    targetZ = mob.wanderTarget.z
  }

  const dx = targetX - mob.x, dz = targetZ - mob.z
  const len = Math.hypot(dx, dz)
  if (len > 0.1) {
    mob.x += (dx / len) * speed * dt
    mob.z += (dz / len) * speed * dt
  }

  mob.y = groundHeightBelowFn(mob.x, mob.z, mob.y + 1)

  if (mob.hitCooldown > 0) mob.hitCooldown -= dt
}

// Returns true if this mob should deal contact damage right now (and
// resets its cooldown) — called once per frame per mob by the caller,
// which is responsible for actually applying the damage to the player.
export function mobTouchesPlayer(mob, playerPos) {
  if (!mob.alive || mob.hitCooldown > 0) return false
  const d = dist2D(mob.x, mob.z, playerPos.x, playerPos.z)
  const dy = Math.abs((mob.y + MOB_HEIGHT / 2) - (playerPos.y + 0.9))
  if (d < MOB_CONTACT_RANGE && dy < 1.4) {
    mob.hitCooldown = MOB_HIT_COOLDOWN
    return true
  }
  return false
}

export function damageMob(mob, amount) {
  mob.hp -= amount
  if (mob.hp <= 0) mob.alive = false
}

// Nearest living mob whose position lies close enough to the aim ray
// (origin + t*dir) within maxDist, used for "did my attack hit a mob"
// — a simple point-vs-ray distance check, not a real hitbox.
export function raycastMobs(mobs, origin, dir, maxDist, hitRadius = 0.6) {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len
  let best = null
  let bestT = Infinity
  for (const mob of mobs) {
    if (!mob.alive) continue
    const cx = mob.x, cy = mob.y + MOB_HEIGHT / 2, cz = mob.z
    const ox = cx - origin.x, oy = cy - origin.y, oz = cz - origin.z
    const t = ox * dx + oy * dy + oz * dz
    if (t < 0 || t > maxDist) continue
    const px = origin.x + dx * t, py = origin.y + dy * t, pz = origin.z + dz * t
    const d = Math.hypot(px - cx, py - cy, pz - cz)
    if (d < hitRadius && t < bestT) { best = mob; bestT = t }
  }
  return best
}

// New mobs only spawn at night, capped at MAX_MOBS, placed on solid
// ground a little away from the player (not literally on top of
// them) — returns a fresh mob or null.
export function trySpawnMob(groundHeightBelowFn, playerPos, currentMobCount, isNight) {
  if (!isNight || currentMobCount >= MAX_MOBS) return null
  const angle = Math.random() * Math.PI * 2
  const radius = 14 + Math.random() * 10
  const x = playerPos.x + Math.cos(angle) * radius
  const z = playerPos.z + Math.sin(angle) * radius
  const y = groundHeightBelowFn(x, z, playerPos.y + 10)
  return freshMob(x, y, z)
}
