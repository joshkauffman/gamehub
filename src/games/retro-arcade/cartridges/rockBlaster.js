// ── Rock Blaster — a vector-style space-rock shooter cartridge, original
// code and canvas-drawn polygons throughout. Wrap-around screen, drifty
// zero-friction flight, and rocks that split when you crack them — the
// shape of a genre, not anyone's specific asset.

const W = 720
const H = 540
const LIVES_START = 3
const MAX_SPEED = 6.2
const THRUST_ACCEL = 0.14
const DAMPING = 0.995
const ROT_SPEED = 0.065
const BULLET_SPEED = 7.5
const BULLET_LIFE = 55
const FIRE_COOLDOWN = 11
const RESPAWN_INVULN = 120
const SAUCER_INTERVAL = 16 * 60

function wrap(v, max) { return ((v % max) + max) % max }
function rand(a, b) { return a + Math.random() * (b - a) }

function makeAsteroidShape() {
  const points = 10 + Math.floor(Math.random() * 4)
  const verts = []
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    verts.push({ a, r: rand(0.72, 1.25) })
  }
  return verts
}

function spawnAsteroid(size, x, y) {
  const radius = size === 3 ? 42 : size === 2 ? 24 : 12
  const speed = rand(0.6, 1.8) * (4 - size) * 0.5 + 0.6
  const angle = rand(0, Math.PI * 2)
  return {
    x, y, size, radius,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    rot: rand(0, Math.PI * 2), spin: rand(-0.02, 0.02),
    shape: makeAsteroidShape(),
  }
}

function spawnEdgeAsteroid(size) {
  const side = Math.floor(Math.random() * 4)
  const x = side === 0 ? 0 : side === 1 ? W : rand(0, W)
  const y = side === 2 ? 0 : side === 3 ? H : rand(0, H)
  return spawnAsteroid(size, x, y)
}

function newWave(wave) {
  const count = Math.min(3 + wave, 9)
  return Array.from({ length: count }, () => spawnEdgeAsteroid(3))
}

export const rockBlaster = {
  id: 'rock-blaster',
  title: 'Rock Blaster',
  emoji: '☄️',
  tagline: 'Drift through open space blasting rocks into smaller, angrier rocks.',
  controls: '← → rotate · ↑ thrust · Space fire',
  width: W,
  height: H,

  readInput(keys) {
    return {
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
      thrust: keys.has('ArrowUp') || keys.has('KeyW'),
      fire: keys.has('Space'),
    }
  },

  createState() {
    return {
      status: 'playing', score: 0, lives: LIVES_START, wave: 1,
      ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, cooldown: 0, invuln: RESPAWN_INVULN },
      bullets: [],
      enemyBullets: [],
      asteroids: newWave(1),
      saucer: null,
      saucerTimer: SAUCER_INTERVAL,
      thrusting: false,
      frame: 0,
      respawnTimer: 0,
    }
  },

  step(state, input) { stepRockBlaster(state, input) },
  render(ctx, state) { renderRockBlaster(ctx, state) },
}

function stepRockBlaster(state, input) {
  if (state.status !== 'playing') return
  state.frame++

  if (state.respawnTimer > 0) {
    state.respawnTimer--
    if (state.respawnTimer === 0) {
      if (state.lives <= 0) { state.status = 'gameover'; return }
      state.ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, cooldown: 0, invuln: RESPAWN_INVULN }
    }
  } else {
    stepShip(state, input)
  }

  state.bullets.forEach(b => { b.x = wrap(b.x + b.vx, W); b.y = wrap(b.y + b.vy, H); b.life-- })
  state.bullets = state.bullets.filter(b => b.life > 0)

  state.enemyBullets.forEach(b => { b.x += b.vx; b.y += b.vy; b.life-- })
  state.enemyBullets = state.enemyBullets.filter(b => b.life > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10)

  state.asteroids.forEach(a => {
    a.x = wrap(a.x + a.vx, W); a.y = wrap(a.y + a.vy, H); a.rot += a.spin
  })

  stepSaucer(state)
  resolveCollisions(state)

  if (state.asteroids.length === 0 && !state.saucer) {
    state.wave++
    state.asteroids = newWave(state.wave)
  }
}

function stepShip(state, input) {
  const s = state.ship
  if (s.invuln > 0) s.invuln--
  if (input.left) s.angle -= ROT_SPEED
  if (input.right) s.angle += ROT_SPEED
  state.thrusting = !!input.thrust
  if (input.thrust) {
    s.vx += Math.cos(s.angle) * THRUST_ACCEL
    s.vy += Math.sin(s.angle) * THRUST_ACCEL
  }
  s.vx *= DAMPING; s.vy *= DAMPING
  const speed = Math.hypot(s.vx, s.vy)
  if (speed > MAX_SPEED) { s.vx = s.vx / speed * MAX_SPEED; s.vy = s.vy / speed * MAX_SPEED }
  s.x = wrap(s.x + s.vx, W); s.y = wrap(s.y + s.vy, H)

  if (s.cooldown > 0) s.cooldown--
  if (input.fire && s.cooldown === 0) {
    s.cooldown = FIRE_COOLDOWN
    state.bullets.push({
      x: s.x, y: s.y,
      vx: Math.cos(s.angle) * BULLET_SPEED + s.vx * 0.3,
      vy: Math.sin(s.angle) * BULLET_SPEED + s.vy * 0.3,
      life: BULLET_LIFE,
    })
  }
}

function stepSaucer(state) {
  if (!state.saucer) {
    state.saucerTimer--
    if (state.saucerTimer <= 0) {
      state.saucerTimer = SAUCER_INTERVAL
      const fromLeft = Math.random() < 0.5
      state.saucer = { x: fromLeft ? -20 : W + 20, y: rand(60, H - 60), vx: fromLeft ? 1.8 : -1.8, cooldown: 70 }
    }
    return
  }
  const sc = state.saucer
  sc.x += sc.vx
  sc.cooldown--
  if (sc.cooldown <= 0) {
    sc.cooldown = 75
    const s = state.ship
    const angle = Math.atan2(s.y - sc.y, s.x - sc.x) + rand(-0.18, 0.18)
    state.enemyBullets.push({ x: sc.x, y: sc.y, vx: Math.cos(angle) * 4.4, vy: Math.sin(angle) * 4.4, life: 90 })
  }
  if (sc.x < -40 || sc.x > W + 40) state.saucer = null
}

function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy }

function splitAsteroid(state, a) {
  if (a.size === 1) return []
  const nextSize = a.size - 1
  return [spawnAsteroid(nextSize, a.x, a.y), spawnAsteroid(nextSize, a.x, a.y)]
}

const ASTEROID_SCORE = { 3: 20, 2: 50, 1: 100 }

function resolveCollisions(state) {
  const survivors = []
  for (const a of state.asteroids) {
    let hit = null
    for (const b of state.bullets) {
      if (dist2(a.x, a.y, b.x, b.y) < a.radius * a.radius) { hit = b; break }
    }
    if (hit) {
      state.bullets = state.bullets.filter(b => b !== hit)
      state.score += ASTEROID_SCORE[a.size]
      survivors.push(...splitAsteroid(state, a))
      continue
    }
    survivors.push(a)
  }
  state.asteroids = survivors

  if (state.saucer) {
    const hitBullet = state.bullets.find(b => dist2(state.saucer.x, state.saucer.y, b.x, b.y) < 18 * 18)
    if (hitBullet) {
      state.bullets = state.bullets.filter(b => b !== hitBullet)
      state.score += 300
      state.saucer = null
    }
  }

  if (state.respawnTimer > 0) return
  const s = state.ship
  if (s.invuln === 0) {
    const shipHit = state.asteroids.some(a => dist2(a.x, a.y, s.x, s.y) < (a.radius + 9) * (a.radius + 9))
      || state.enemyBullets.some(b => dist2(b.x, b.y, s.x, s.y) < 12 * 12)
      || (state.saucer && dist2(state.saucer.x, state.saucer.y, s.x, s.y) < 22 * 22)
    if (shipHit) {
      state.lives--
      state.respawnTimer = 90
    }
  }
}

function renderRockBlaster(ctx, state) {
  ctx.fillStyle = '#04040c'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText(`SCORE ${state.score}`, 12, 10)
  ctx.fillText(`WAVE ${state.wave}`, W / 2 - 36, 10)
  ctx.fillText('▲'.repeat(Math.max(0, state.lives)), W - 90, 10)

  ctx.strokeStyle = '#d8d8ff'
  ctx.lineWidth = 2
  state.asteroids.forEach(a => {
    ctx.save()
    ctx.translate(a.x, a.y)
    ctx.rotate(a.rot)
    ctx.beginPath()
    a.shape.forEach((v, i) => {
      const x = Math.cos(v.a) * a.radius * v.r
      const y = Math.sin(v.a) * a.radius * v.r
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  })

  ctx.fillStyle = '#fff'
  state.bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2); ctx.fill() })
  ctx.fillStyle = '#ff6f6f'
  state.enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2); ctx.fill() })

  if (state.saucer) {
    const sc = state.saucer
    ctx.strokeStyle = '#7bffb0'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.ellipse(sc.x, sc.y, 20, 9, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(sc.x, sc.y - 6, 9, 6, 0, Math.PI, Math.PI * 2); ctx.stroke()
  }

  if (state.respawnTimer === 0) {
    const s = state.ship
    const blink = s.invuln > 0 && Math.floor(state.frame / 5) % 2 === 0
    if (!blink) {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.angle)
      ctx.strokeStyle = '#8fe3ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(14, 0)
      ctx.lineTo(-10, 9)
      ctx.lineTo(-5, 0)
      ctx.lineTo(-10, -9)
      ctx.closePath()
      ctx.stroke()
      if (state.thrusting && state.frame % 4 < 2) {
        ctx.strokeStyle = '#ffb84d'
        ctx.beginPath()
        ctx.moveTo(-5, 0); ctx.lineTo(-16, 0)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}
