// ── Star Guard — a marching-formation shooter cartridge in the spirit of
// the granddaddy of the genre. Original code, canvas-drawn shapes only:
// a formation that steps side to side and descends, destructible
// bunkers you can hide behind (and erode by accident), and a fire rate
// that ramps up as the formation thins out.

const W = 560
const H = 640
const ROWS = 5
const COLS = 8
const SPACING_X = 52
const SPACING_Y = 42
const INVADER_R = 14
const FORMATION_TOP = 70
const PLAYER_Y = H - 50
const LIVES_START = 3
const STEP_X = 12
const DROP_Y = 22

const BUNKER_COLS = 8
const BUNKER_ROWS = 5
const CELL = 6
const BUNKER_W = BUNKER_COLS * CELL
const BUNKER_H = BUNKER_ROWS * CELL

function buildBunkers() {
  const count = 4
  const bunkers = []
  for (let i = 0; i < count; i++) {
    const cx = (W / (count + 1)) * (i + 1)
    const cells = new Set()
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        const isArch = r >= BUNKER_ROWS - 2 && c >= BUNKER_COLS / 2 - 1 && c <= BUNKER_COLS / 2
        if (!isArch) cells.add(`${c},${r}`)
      }
    }
    bunkers.push({ x: cx - BUNKER_W / 2, y: PLAYER_Y - 90, cells })
  }
  return bunkers
}

function buildFormation() {
  const invaders = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) invaders.push({ row: r, col: c, alive: true })
  }
  return invaders
}

export const starGuard = {
  id: 'star-guard',
  title: 'Star Guard',
  emoji: '👾',
  tagline: 'Hold the line against a marching formation before it lands. Bunkers help, until they don\'t.',
  controls: '← → move · Space fire (one shot at a time)',
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
      player: { x: W / 2, cooldown: 0, invuln: 60 },
      bullet: null,
      enemyBullets: [],
      invaders: buildFormation(),
      formationX: 0, formationY: 0, dir: 1,
      stepTimer: 46,
      bunkers: buildBunkers(),
      fireTimer: 60,
      frame: 0,
      respawnTimer: 0,
    }
  },

  step(state, input) { stepStarGuard(state, input) },
  render(ctx, state) { renderStarGuard(ctx, state) },
}

const PLAYER_SPEED = 4.6

function aliveInvaders(state) { return state.invaders.filter(v => v.alive) }

function invaderPos(state, v) {
  return { x: 40 + v.col * SPACING_X + state.formationX, y: FORMATION_TOP + v.row * SPACING_Y + state.formationY }
}

function stepInterval(aliveCount, total) {
  const ratio = aliveCount / total
  return Math.max(6, Math.round(6 + 42 * ratio))
}

function stepStarGuard(state, input) {
  if (state.status !== 'playing') return
  state.frame++

  if (state.respawnTimer > 0) {
    state.respawnTimer--
    if (state.respawnTimer === 0) state.player = { x: W / 2, cooldown: 0, invuln: 60 }
  } else {
    const p = state.player
    if (p.invuln > 0) p.invuln--
    if (input.left) p.x -= PLAYER_SPEED
    if (input.right) p.x += PLAYER_SPEED
    p.x = Math.max(20, Math.min(W - 20, p.x))
    if (p.cooldown > 0) p.cooldown--
    if (input.fire && p.cooldown === 0 && !state.bullet) {
      p.cooldown = 10
      state.bullet = { x: p.x, y: PLAYER_Y - 18 }
    }
  }

  const alive = aliveInvaders(state)
  if (alive.length === 0) {
    state.wave++
    state.invaders = buildFormation()
    state.formationX = 0; state.formationY = 0; state.dir = 1
    state.bunkers = buildBunkers()
    state.stepTimer = 46
    return
  }

  state.stepTimer--
  if (state.stepTimer <= 0) {
    state.stepTimer = stepInterval(alive.length, ROWS * COLS)
    const xs = alive.map(v => invaderPos(state, v).x)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    if ((state.dir > 0 && maxX > W - 50) || (state.dir < 0 && minX < 50)) {
      state.dir *= -1
      state.formationY += DROP_Y
    } else {
      state.formationX += STEP_X * state.dir
    }
  }

  const lowestY = Math.max(...alive.map(v => invaderPos(state, v).y))
  if (lowestY > PLAYER_Y - 30) { state.status = 'gameover'; return }

  state.fireTimer--
  if (state.fireTimer <= 0) {
    state.fireTimer = Math.max(18, 60 - state.wave * 4)
    const cols = [...new Set(alive.map(v => v.col))]
    const col = cols[Math.floor(Math.random() * cols.length)]
    const shooter = alive.filter(v => v.col === col).sort((a, b) => b.row - a.row)[0]
    const pos = invaderPos(state, shooter)
    state.enemyBullets.push({ x: pos.x, y: pos.y, vy: 3.6 + state.wave * 0.2 })
  }

  if (state.bullet) {
    state.bullet.y -= 9
    if (state.bullet.y < 0) state.bullet = null
  }
  state.enemyBullets.forEach(b => { b.y += b.vy })
  state.enemyBullets = state.enemyBullets.filter(b => b.y < H + 10)

  resolveStarGuardCollisions(state)
}

function hitBunker(state, x, y) {
  for (const bunker of state.bunkers) {
    if (x < bunker.x || x > bunker.x + BUNKER_W || y < bunker.y || y > bunker.y + BUNKER_H) continue
    const cc = Math.floor((x - bunker.x) / CELL)
    const cr = Math.floor((y - bunker.y) / CELL)
    let hit = false
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const key = `${cc + dc},${cr + dr}`
        if (bunker.cells.has(key)) { bunker.cells.delete(key); hit = true }
      }
    }
    if (hit) return true
  }
  return false
}

function resolveStarGuardCollisions(state) {
  if (state.bullet) {
    if (hitBunker(state, state.bullet.x, state.bullet.y)) {
      state.bullet = null
    } else {
      for (const v of state.invaders) {
        if (!v.alive) continue
        const pos = invaderPos(state, v)
        const dx = pos.x - state.bullet.x, dy = pos.y - state.bullet.y
        if (dx * dx + dy * dy < INVADER_R * INVADER_R) {
          v.alive = false
          state.score += (ROWS - v.row) * 10
          state.bullet = null
          break
        }
      }
    }
  }

  state.enemyBullets = state.enemyBullets.filter(b => !hitBunker(state, b.x, b.y))

  if (state.respawnTimer > 0) return
  const p = state.player
  if (p.invuln > 0) return
  const hitIdx = state.enemyBullets.findIndex(b => Math.abs(b.x - p.x) < 14 && Math.abs(b.y - PLAYER_Y) < 16)
  if (hitIdx !== -1) {
    state.enemyBullets.splice(hitIdx, 1)
    state.lives--
    if (state.lives <= 0) { state.status = 'gameover'; return }
    state.respawnTimer = 60
  }
}

function renderStarGuard(ctx, state) {
  ctx.fillStyle = '#04050f'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText(`SCORE ${state.score}`, 12, 10)
  ctx.fillText(`WAVE ${state.wave}`, W / 2 - 34, 10)
  ctx.fillText('▲'.repeat(Math.max(0, state.lives)), W - 80, 10)

  ctx.fillStyle = '#5fb85f'
  state.bunkers.forEach(b => {
    b.cells.forEach(key => {
      const [c, r] = key.split(',').map(Number)
      ctx.fillRect(b.x + c * CELL, b.y + r * CELL, CELL, CELL)
    })
  })

  const rowColors = ['#ff6f8f', '#ffb84d', '#ffe08a', '#7be0ff', '#b98cff']
  state.invaders.forEach(v => {
    if (!v.alive) return
    const pos = invaderPos(state, v)
    const legSpread = Math.floor(state.frame / 20) % 2 === 0 ? 0 : 2
    ctx.fillStyle = rowColors[v.row % rowColors.length]
    ctx.beginPath(); ctx.arc(pos.x, pos.y, INVADER_R, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#04050f'
    ctx.beginPath(); ctx.arc(pos.x - 5, pos.y - 2, 3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(pos.x + 5, pos.y - 2, 3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = rowColors[v.row % rowColors.length]
    ctx.fillRect(pos.x - INVADER_R - legSpread, pos.y + INVADER_R - 4, 4, 6)
    ctx.fillRect(pos.x + INVADER_R - 4 + legSpread, pos.y + INVADER_R - 4, 4, 6)
  })

  ctx.fillStyle = '#fff'
  if (state.bullet) ctx.fillRect(state.bullet.x - 2, state.bullet.y - 8, 4, 14)
  ctx.fillStyle = '#ff6f6f'
  state.enemyBullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 6, 4, 12))

  if (state.respawnTimer === 0) {
    const p = state.player
    const blink = p.invuln > 0 && Math.floor(state.frame / 4) % 2 === 0
    if (!blink) {
      ctx.fillStyle = '#8fe3ff'
      ctx.fillRect(p.x - 16, PLAYER_Y - 6, 32, 10)
      ctx.fillRect(p.x - 4, PLAYER_Y - 16, 8, 12)
    }
  }
}
