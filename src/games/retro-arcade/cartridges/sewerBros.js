// ── Sewer Bros — a single-screen platform brawler in the spirit of a
// certain plumber duo's very first arcade outing (the one before the
// side-scrolling sequel everybody remembers): bump critters from below
// to flip them on their back, then walk into them to boot them off
// screen. Original code and canvas-drawn shapes throughout, side warps
// included at no extra charge.

const W = 640
const H = 520
const GRAVITY = 0.7
const JUMP_V = -13.4
const MOVE_SPEED = 3.1
const LIVES_START = 3
const STUN_FRAMES = 5 * 60
const PLAYER_HALF_W = 14
const PLAYER_H = 34

// Top to bottom. Each platform is a y-line plus the x-ranges that are solid.
const PLATFORMS = [
  { y: 200, segs: [[0, 240], [400, 640]] },
  { y: 300, segs: [[140, 500]] },
  { y: 400, segs: [[0, 240], [400, 640]] },
  { y: 480, segs: [[0, 640]] },
]
const GROUND_Y = 480
const POW = { x: W / 2, y: GROUND_Y, w: 56, h: 22 }

function inSeg(segs, x, halfW) { return segs.some(([a, b]) => x + halfW > a && x - halfW < b) }

function spawnEnemy(wave) {
  const level = PLATFORMS[Math.floor(Math.random() * (PLATFORMS.length - 1))]
  const seg = level.segs[Math.floor(Math.random() * level.segs.length)]
  const x = (seg[0] + seg[1]) / 2
  return {
    x, y: level.y, seg, dir: Math.random() < 0.5 ? -1 : 1,
    speed: 1.1 + Math.random() * 0.4 + wave * 0.08,
    stunned: 0, angry: false,
  }
}

export const sewerBros = {
  id: 'sewer-bros',
  title: 'Sewer Bros',
  emoji: '🪠',
  tagline: 'Bump the platform from below to flip a critter, then boot it off screen. Side warps included.',
  controls: '← → move · ↑ / Space jump (bump platforms from below) · walk into a flipped critter to kick it',
  width: W,
  height: H,

  readInput(keys) {
    return {
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
      jump: keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space'),
    }
  },

  createState() {
    return {
      status: 'playing', score: 0, lives: LIVES_START, wave: 1,
      player: { x: W / 2, y: GROUND_Y, prevY: GROUND_Y, vy: 0, onGround: true, facing: 1, invuln: 60 },
      enemies: Array.from({ length: 3 }, () => spawnEnemy(1)),
      powCharges: 3,
      jumpHeld: false,
      frame: 0,
      respawnTimer: 0,
    }
  },

  step(state, input) { stepSewerBros(state, input) },
  render(ctx, state) { renderSewerBros(ctx, state) },
}

function platformAt(y) { return PLATFORMS.find(p => p.y === y) }

function stepSewerBros(state, input) {
  if (state.status !== 'playing') return
  state.frame++

  if (state.respawnTimer > 0) {
    state.respawnTimer--
    if (state.respawnTimer === 0) {
      state.player = { x: W / 2, y: GROUND_Y, prevY: GROUND_Y, vy: 0, onGround: true, facing: 1, invuln: 90 }
    }
  } else {
    stepPlayer(state, input)
  }

  state.enemies.forEach(e => stepEnemy(e))
  resolveSewerCollisions(state)

  if (state.enemies.length === 0) {
    state.wave++
    state.powCharges = 3
    state.enemies = Array.from({ length: Math.min(3 + state.wave - 1, 7) }, () => spawnEnemy(state.wave))
  }
}

function stepPlayer(state, input) {
  const p = state.player
  if (p.invuln > 0) p.invuln--
  if (input.left) { p.x -= MOVE_SPEED; p.facing = -1 }
  if (input.right) { p.x += MOVE_SPEED; p.facing = 1 }
  if (p.x < 0) p.x = W; if (p.x > W) p.x = 0

  if (input.jump && !state.jumpHeld && p.onGround) { p.vy = JUMP_V; p.onGround = false }
  state.jumpHeld = input.jump

  p.prevY = p.y
  p.vy += GRAVITY
  p.y += p.vy

  // Bump a platform's underside while rising — checked bottom-up so the
  // nearest ceiling above the player's head is the one that catches it.
  if (p.vy < 0) {
    const headPrev = p.prevY - PLAYER_H
    const headNow = p.y - PLAYER_H
    for (let i = PLATFORMS.length - 1; i >= 0; i--) {
      const plat = PLATFORMS[i]
      if (headPrev >= plat.y && headNow <= plat.y && inSeg(plat.segs, p.x, PLAYER_HALF_W)) {
        p.y = plat.y + PLAYER_H
        p.vy = 0
        flipEnemiesOn(state, plat.y, plat.segs)
        break
      }
    }
  }

  // Land on a platform's top surface while falling.
  if (p.vy >= 0) {
    let landed = false
    for (const plat of PLATFORMS) {
      if (p.prevY <= plat.y && p.y >= plat.y && inSeg(plat.segs, p.x, PLAYER_HALF_W)) {
        p.y = plat.y; p.vy = 0; p.onGround = true; landed = true
        break
      }
    }
    if (!landed) p.onGround = false
  }

  if (p.y > H + 60) { p.y = GROUND_Y; p.vy = 0; p.onGround = true }

  const overPow = p.x > POW.x - POW.w / 2 && p.x < POW.x + POW.w / 2 && p.y >= GROUND_Y - 4
  if (overPow && !p.powTouching && state.powCharges > 0) triggerPow(state)
  p.powTouching = overPow
}

function triggerPow(state) {
  state.powCharges--
  state.enemies.forEach(e => { if (!e.stunned) e.stunned = STUN_FRAMES })
}

function flipEnemiesOn(state, y, segs) {
  state.enemies.forEach(e => {
    if (e.y === y && inSeg(segs, e.x, 14) && !e.stunned) { e.stunned = STUN_FRAMES; e.angry = false }
  })
}

function stepEnemy(e) {
  if (e.stunned > 0) {
    e.stunned--
    if (e.stunned === 0) e.angry = true
    return
  }
  const speed = e.speed * (e.angry ? 1.5 : 1)
  e.x += e.dir * speed
  if (e.x < e.seg[0] + 12) { e.x = e.seg[0] + 12; e.dir = 1 }
  if (e.x > e.seg[1] - 12) { e.x = e.seg[1] - 12; e.dir = -1 }
  if (e.x < 0) e.x = W; if (e.x > W) e.x = 0
}

function resolveSewerCollisions(state) {
  const p = state.player
  const remaining = []
  for (const e of state.enemies) {
    const dx = Math.abs(p.x - e.x), dy = Math.abs(p.y - e.y)
    // Only a real "same platform, walked into it" contact counts — jumping
    // over a critter's row without landing on it is a safe pass, same as
    // the arcade original.
    if (p.onGround && dx < 20 && dy < 6) {
      if (e.stunned > 0) { state.score += 150; continue }
      if (p.invuln === 0 && state.respawnTimer === 0) {
        state.lives--
        if (state.lives <= 0) state.status = 'gameover'
        else state.respawnTimer = 60
      }
    }
    remaining.push(e)
  }
  state.enemies = remaining
}

function renderSewerBros(ctx, state) {
  ctx.fillStyle = '#0a0a1a'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#3355aa'
  PLATFORMS.forEach(plat => {
    plat.segs.forEach(([a, b]) => ctx.fillRect(a, plat.y, b - a, 10))
  })

  if (state.powCharges > 0) {
    ctx.fillStyle = '#ff8f3d'
    ctx.fillRect(POW.x - POW.w / 2, POW.y - POW.h, POW.w, POW.h)
    ctx.fillStyle = '#3d1a00'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('POW', POW.x, POW.y - POW.h / 2 + 4)
    ctx.textAlign = 'left'
  }

  state.enemies.forEach(e => drawCritter(ctx, e))

  if (state.respawnTimer === 0) {
    const p = state.player
    const blink = p.invuln > 0 && Math.floor(state.frame / 4) % 2 === 0
    if (!blink) drawPlumber(ctx, p)
  }

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText(`SCORE ${state.score}`, 12, 10)
  ctx.fillText(`WAVE ${state.wave}`, W / 2 - 34, 10)
  ctx.fillText('❤'.repeat(Math.max(0, state.lives)), W - 90, 10)
}

function drawCritter(ctx, e) {
  ctx.save()
  ctx.translate(e.x, e.y - 12)
  if (e.stunned > 0) ctx.rotate(Math.PI)
  ctx.fillStyle = e.angry ? '#ff5d3d' : '#3dbf5d'
  ctx.beginPath()
  ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(-6, -3, 4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(6, -3, 4, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawPlumber(ctx, p) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(p.facing, 1)
  ctx.fillStyle = '#d94f2b'
  ctx.fillRect(-12, -PLAYER_H, 24, 18)
  ctx.fillStyle = '#2b57d9'
  ctx.fillRect(-12, -PLAYER_H + 18, 24, 16)
  ctx.fillStyle = '#f0c090'
  ctx.fillRect(-8, -PLAYER_H - 6, 16, 10)
  ctx.fillStyle = '#3d2412'
  ctx.fillRect(-9, -PLAYER_H - 8, 18, 4)
  ctx.restore()
}
