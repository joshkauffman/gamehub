// ── Brick Breaker — a paddle-and-ball cartridge in the spirit of the
// classic brick-smashing genre. Original code, canvas-drawn shapes only:
// a paddle that steers the bounce angle, bricks that sometimes take two
// hits, and a rare falling power-up.

const W = 640
const H = 520
const PADDLE_Y = H - 30
const PADDLE_W = 90
const PADDLE_H = 12
const BALL_R = 7
const LIVES_START = 3
const BRICK_ROWS = 5
const BRICK_COLS = 10
const BRICK_W = 58
const BRICK_H = 20
const BRICK_GAP = 4
const BRICK_TOP = 60
const ROW_COLORS = ['#ff5d5d', '#ff9d3d', '#ffd23c', '#7be07b', '#5fb8ff']

function buildBricks(level) {
  const bricks = []
  const totalW = BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP
  const originX = (W - totalW) / 2
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const tough = level > 1 && (r + c) % 5 === 0
      bricks.push({
        x: originX + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        hp: tough ? 2 : 1,
        color: ROW_COLORS[r % ROW_COLORS.length],
        alive: true,
      })
    }
  }
  return bricks
}

function freshBall(paddleX) {
  return { x: paddleX, y: PADDLE_Y - BALL_R - PADDLE_H / 2, vx: 0, vy: 0, stuck: true }
}

export const brickBreaker = {
  id: 'brick-breaker',
  title: 'Brick Breaker',
  emoji: '🧱',
  tagline: 'Steer the bounce angle with the paddle and clear every brick before you run out of balls.',
  controls: '← → move · Space / ↑ launch',
  width: W,
  height: H,

  readInput(keys) {
    return {
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
      launch: keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW'),
    }
  },

  createState() {
    return {
      status: 'playing', score: 0, lives: LIVES_START, level: 1,
      paddle: { x: W / 2, w: PADDLE_W },
      ball: freshBall(W / 2),
      bricks: buildBricks(1),
      drops: [],
      frame: 0,
    }
  },

  step(state, input) { stepBrickBreaker(state, input) },
  render(ctx, state) { renderBrickBreaker(ctx, state) },
}

const PADDLE_SPEED = 6.4
const BASE_BALL_SPEED = 5.2

function stepBrickBreaker(state, input) {
  if (state.status !== 'playing') return
  state.frame++

  const pad = state.paddle
  if (input.left) pad.x -= PADDLE_SPEED
  if (input.right) pad.x += PADDLE_SPEED
  pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, pad.x))

  const ball = state.ball
  if (ball.stuck) {
    ball.x = pad.x
    if (input.launch) {
      ball.stuck = false
      ball.vx = BASE_BALL_SPEED * (Math.random() < 0.5 ? -0.4 : 0.4)
      ball.vy = -BASE_BALL_SPEED
    }
  } else {
    ball.x += ball.vx
    ball.y += ball.vy
    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx *= -1 }
    if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx *= -1 }
    if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy *= -1 }

    if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y - PADDLE_H / 2 && ball.y - BALL_R <= PADDLE_Y + PADDLE_H / 2
      && Math.abs(ball.x - pad.x) < pad.w / 2 + BALL_R) {
      const offset = (ball.x - pad.x) / (pad.w / 2)
      const speed = Math.hypot(ball.vx, ball.vy)
      const angle = offset * (Math.PI / 3)
      ball.vx = speed * Math.sin(angle)
      ball.vy = -Math.abs(speed * Math.cos(angle))
      ball.y = PADDLE_Y - PADDLE_H / 2 - BALL_R
    }

    for (const b of state.bricks) {
      if (!b.alive) continue
      if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + BRICK_W && ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H) {
        const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + BRICK_W - (ball.x - BALL_R))
        const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + BRICK_H - (ball.y - BALL_R))
        if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1
        b.hp--
        if (b.hp <= 0) {
          b.alive = false
          state.score += 10
          if (Math.random() < 0.12) state.drops.push({ x: b.x + BRICK_W / 2, y: b.y, vy: 2.4 })
        } else {
          state.score += 5
        }
        break
      }
    }

    if (ball.y - BALL_R > H) {
      state.lives--
      if (state.lives <= 0) { state.status = 'gameover'; return }
      state.ball = freshBall(pad.x)
    }
  }

  state.drops.forEach(d => { d.y += d.vy })
  state.drops = state.drops.filter(d => {
    if (Math.abs(d.x - pad.x) < pad.w / 2 + 10 && d.y > PADDLE_Y - 10 && d.y < PADDLE_Y + 14) {
      pad.w = Math.min(160, pad.w + 24)
      return false
    }
    return d.y < H + 20
  })

  if (state.bricks.every(b => !b.alive)) {
    state.level++
    state.bricks = buildBricks(state.level)
    state.paddle.w = PADDLE_W
    state.ball = freshBall(pad.x)
    state.drops = []
  }
}

function renderBrickBreaker(ctx, state) {
  ctx.fillStyle = '#080418'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText(`SCORE ${state.score}`, 12, 10)
  ctx.fillText(`LEVEL ${state.level}`, W / 2 - 34, 10)
  ctx.fillText('●'.repeat(Math.max(0, state.lives)), W - 60, 10)

  state.bricks.forEach(b => {
    if (!b.alive) return
    ctx.fillStyle = b.hp > 1 ? '#fff' : b.color
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H)
    if (b.hp > 1) {
      ctx.fillStyle = b.color
      ctx.fillRect(b.x + 3, b.y + 3, BRICK_W - 6, BRICK_H - 6)
    }
  })

  ctx.fillStyle = '#7bff8a'
  state.drops.forEach(d => { ctx.beginPath(); ctx.arc(d.x, d.y, 7, 0, Math.PI * 2); ctx.fill() })

  ctx.fillStyle = '#8fe3ff'
  const pad = state.paddle
  ctx.fillRect(pad.x - pad.w / 2, PADDLE_Y - PADDLE_H / 2, pad.w, PADDLE_H)

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2)
  ctx.fill()
}
