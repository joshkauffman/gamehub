// ── Bug Swarm — a fixed-shooter cartridge in the spirit of a certain
// insectoid arcade formation-flyer. Original code: a formation that
// breezes side to side, bugs that peel off in a swooping dive and loop
// back, and canvas-drawn shapes only.

const W = 560
const H = 680
const COLS = 6
const ROWS = 4
const LIVES_START = 3

const PLAYER_SPEED = 5.2
const PLAYER_COOLDOWN = 16
const BULLET_SPEED = 9

const SCORE = { droneFormation: 10, droneDive: 50, eliteFormation: 40, eliteDive: 150 }

function formationSlots() {
  const slots = []
  const gapX = 64, gapY = 54
  const originX = (W - (COLS - 1) * gapX) / 2
  const originY = 90
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      slots.push({ fx: originX + c * gapX, fy: originY + r * gapY, row: r, col: c })
    }
  }
  return slots
}

function spawnWave(wave) {
  const slots = formationSlots()
  return slots.map((slot, i) => ({
    ...slot,
    id: i,
    elite: slot.row === 0,
    hp: slot.row === 0 ? 2 : 1,
    x: slot.fx, y: -60 - slot.row * 24 - slot.col * 6,
    mode: 'entering', delay: (slot.row * COLS + slot.col) * 3,
    diveFrames: 0, diveDir: 1, diveStartX: slot.fx,
  }))
}

export const bugSwarm = {
  id: 'bug-swarm',
  title: 'Bug Swarm',
  emoji: '🐛',
  tagline: 'Hold the formation off with everything you\'ve got before they dive-bomb you.',
  controls: '← → move · Space fire',
  width: W,
  height: H,

  readInput(keys) {
    return {
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
      fire: keys.has('Space'),
    }
  },

  createState() {
    return {
      status: 'playing', score: 0, lives: LIVES_START, wave: 1,
      player: { x: W / 2, y: H - 50, cooldown: 0, invuln: 90 },
      bullets: [],
      enemyBullets: [],
      enemies: spawnWave(1),
      frame: 0,
      diveTimer: 90,
      respawnTimer: 0,
    }
  },

  step(state, input) { stepBugSwarm(state, input) },
  render(ctx, state) { renderBugSwarm(ctx, state) },
}

function diveCap(wave) { return Math.min(1 + Math.floor(wave / 2), 3) }
function diveInterval(wave) { return Math.max(38, 100 - wave * 6) }
function enemyBulletSpeed(wave) { return Math.min(4 + wave * 0.3, 7.5) }

function stepBugSwarm(state, input) {
  if (state.status !== 'playing') return
  state.frame++

  if (state.respawnTimer > 0) {
    state.respawnTimer--
    if (state.respawnTimer === 0) {
      if (state.lives <= 0) { state.status = 'gameover'; return }
      state.player = { x: W / 2, y: H - 50, cooldown: 0, invuln: 90 }
    }
  } else {
    stepPlayer(state, input)
  }

  state.enemies.forEach(e => stepEnemy(state, e))

  state.diveTimer--
  if (state.diveTimer <= 0) {
    state.diveTimer = diveInterval(state.wave)
    const divers = state.enemies.filter(e => e.mode === 'diving').length
    if (divers < diveCap(state.wave)) {
      const candidates = state.enemies.filter(e => e.mode === 'formation')
      if (candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        pick.mode = 'diving'; pick.diveFrames = 0; pick.diveStartX = pick.x; pick.diveDir = Math.random() < 0.5 ? -1 : 1
      }
    }
  }

  state.bullets.forEach(b => { b.y -= BULLET_SPEED })
  state.bullets = state.bullets.filter(b => b.y > -10)
  state.enemyBullets.forEach(b => { b.y += b.speed })
  state.enemyBullets = state.enemyBullets.filter(b => b.y < H + 10)

  resolveBugCollisions(state)

  if (state.enemies.length === 0) {
    state.wave++
    state.enemies = spawnWave(state.wave)
  }
}

function stepPlayer(state, input) {
  const p = state.player
  if (p.invuln > 0) p.invuln--
  if (input.left) p.x -= PLAYER_SPEED
  if (input.right) p.x += PLAYER_SPEED
  p.x = Math.max(24, Math.min(W - 24, p.x))
  if (p.cooldown > 0) p.cooldown--
  if (input.fire && p.cooldown === 0 && state.bullets.length < 2) {
    p.cooldown = PLAYER_COOLDOWN
    state.bullets.push({ x: p.x, y: p.y - 20 })
  }
}

function stepEnemy(state, e) {
  if (e.mode === 'entering') {
    if (e.delay > 0) { e.delay--; return }
    e.y += 3.2
    e.x = e.fx + Math.sin(e.y * 0.05) * 30
    if (e.y >= e.fy) { e.y = e.fy; e.x = e.fx; e.mode = 'formation' }
    return
  }
  if (e.mode === 'formation') {
    e.x = e.fx + Math.sin(state.frame * 0.02 + e.col * 0.4) * 26
    e.y = e.fy + Math.sin(state.frame * 0.03 + e.row) * 3
    return
  }
  if (e.mode === 'diving') {
    e.diveFrames++
    e.x = e.diveStartX + Math.sin(e.diveFrames * 0.06) * 90 * e.diveDir
    e.y = e.fy + e.diveFrames * (2.4 + state.wave * 0.15)
    if (state.frame % 55 === 0) {
      const speed = enemyBulletSpeed(state.wave)
      const dx = state.player.x - e.x, dy = state.player.y - e.y
      const len = Math.hypot(dx, dy) || 1
      state.enemyBullets.push({ x: e.x, y: e.y, speed, vx: dx / len, vy: dy / len })
    }
    if (e.y > H + 40) { e.mode = 'returning'; e.y = -40; e.x = e.fx }
    return
  }
  if (e.mode === 'returning') {
    e.y += 4
    if (e.y >= e.fy) { e.y = e.fy; e.x = e.fx; e.mode = 'formation' }
  }
}

function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy }

function resolveBugCollisions(state) {
  const remaining = []
  for (const e of state.enemies) {
    const hitBullet = state.bullets.find(b => dist2(e.x, e.y, b.x, b.y) < 17 * 17)
    if (hitBullet) {
      state.bullets = state.bullets.filter(b => b !== hitBullet)
      e.hp--
      if (e.hp <= 0) {
        state.score += e.elite
          ? (e.mode === 'diving' ? SCORE.eliteDive : SCORE.eliteFormation)
          : (e.mode === 'diving' ? SCORE.droneDive : SCORE.droneFormation)
        continue
      }
    }
    remaining.push(e)
  }
  state.enemies = remaining

  if (state.respawnTimer > 0) return
  const p = state.player
  if (p.invuln > 0) return

  const hitByBullet = state.enemyBullets.some(b => dist2(b.x, b.y, p.x, p.y) < 12 * 12)
  const hitByDiver = state.enemies.some(e => e.mode === 'diving' && dist2(e.x, e.y, p.x, p.y) < 18 * 18)
  if (hitByBullet || hitByDiver) {
    if (hitByDiver) state.enemies = state.enemies.filter(e => !(e.mode === 'diving' && dist2(e.x, e.y, p.x, p.y) < 18 * 18))
    state.lives--
    state.respawnTimer = 80
  }
}

function renderBugSwarm(ctx, state) {
  ctx.fillStyle = '#050318'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText(`SCORE ${state.score}`, 12, 10)
  ctx.fillText(`WAVE ${state.wave}`, W / 2 - 34, 10)
  ctx.fillText('▲'.repeat(Math.max(0, state.lives)), W - 80, 10)

  ctx.fillStyle = '#ffe08a'
  state.bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 8, 4, 14))
  ctx.fillStyle = '#ff6f8f'
  state.enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, Math.PI * 2); ctx.fill() })

  state.enemies.forEach(e => drawBug(ctx, e))

  if (state.respawnTimer === 0) {
    const p = state.player
    const blink = p.invuln > 0 && Math.floor(state.frame / 5) % 2 === 0
    if (!blink) drawPlayerShip(ctx, p.x, p.y)
  }
}

function drawBug(ctx, e) {
  const r = e.elite ? 16 : 13
  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.fillStyle = e.elite ? (e.hp > 1 ? '#ff5d8f' : '#ffb0c8') : '#7be07b'
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0a0a1a'
  ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = e.elite ? '#ff5d8f' : '#7be07b'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.9); ctx.lineTo(-r * 1.1, -r * 1.5); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.9); ctx.lineTo(r * 1.1, -r * 1.5); ctx.stroke()
  ctx.restore()
}

function drawPlayerShip(ctx, x, y) {
  ctx.fillStyle = '#8fe3ff'
  ctx.beginPath()
  ctx.moveTo(x, y - 20)
  ctx.lineTo(x + 16, y + 16)
  ctx.lineTo(x, y + 8)
  ctx.lineTo(x - 16, y + 16)
  ctx.closePath()
  ctx.fill()
}
