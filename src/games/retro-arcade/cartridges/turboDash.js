// ── Turbo Dash — an endless-runner cartridge in the spirit of a certain
// suspiciously fast blue critter. Original code and canvas shapes only:
// an auto-scrolling world, a ring-cushion hit system (get clipped with
// rings and you just scatter them; get clipped bare and you lose a
// life), pits to hop and overhangs to duck under.

const W = 800
const H = 420
const GROUND_Y = 320
const PLAYER_SCREEN_X = 150
const STAND_HALF_H = 22
const DUCK_HALF_H = 12
const HALF_W = 14
const GRAVITY = 0.75
const JUMP_V = -13.5
const BASE_SPEED = 4.4
const SPEED_GROWTH = 0.0011
const MAX_SPEED = 10.5
const LIVES_START = 3
const AHEAD_DISTANCE = 1100
const BEHIND_MARGIN = 200

function rand(a, b) { return a + Math.random() * (b - a) }

function generateAhead(state) {
  while (state.nextSpawnX < state.cameraX + AHEAD_DISTANCE) {
    const roll = Math.random()
    const x = state.nextSpawnX
    if (roll < 0.3) {
      const width = rand(70, 130)
      state.pits.push({ startX: x, endX: x + width })
      state.nextSpawnX = x + width + rand(140, 220)
      addRingArc(state, x - 60, GROUND_Y - 70, 3)
    } else if (roll < 0.55) {
      const width = 34
      state.spikes.push({ startX: x, endX: x + width })
      state.nextSpawnX = x + width + rand(180, 300)
    } else if (roll < 0.75) {
      const width = 90
      state.overhangs.push({ startX: x, endX: x + width, bottom: GROUND_Y - 46 })
      state.nextSpawnX = x + width + rand(180, 300)
    } else {
      addRingArc(state, x, GROUND_Y - rand(60, 130), 5)
      state.nextSpawnX = x + rand(220, 340)
    }
  }
}

function addRingArc(state, startX, peakY, count) {
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1 || 1)
    state.ringObjs.push({ x: startX + i * 26, y: GROUND_Y - 20 - Math.sin(t * Math.PI) * (GROUND_Y - 20 - peakY) })
  }
}

export const turboDash = {
  id: 'turbo-dash',
  title: 'Turbo Dash',
  emoji: '💨',
  tagline: 'Auto-scrolling speed run: hop pits, duck overhangs, and hoard rings as your cushion against hits.',
  controls: '↑ / Space jump · ↓ duck · rings save you from one hit',
  width: W,
  height: H,

  readInput(keys) {
    return {
      jump: keys.has('ArrowUp') || keys.has('Space') || keys.has('KeyW'),
      duck: keys.has('ArrowDown') || keys.has('KeyS'),
    }
  },

  createState() {
    const state = {
      status: 'playing', score: 0, lives: LIVES_START,
      cameraX: 0, speed: BASE_SPEED,
      player: { y: GROUND_Y - STAND_HALF_H, vy: 0, onGround: true, ducking: false },
      pits: [], spikes: [], overhangs: [], ringObjs: [], rings: 0,
      nextSpawnX: 300,
      frame: 0, jumpHeld: false, invuln: 0, respawnTimer: 0,
    }
    generateAhead(state)
    return state
  },

  step(state, input) { stepTurboDash(state, input) },
  render(ctx, state) { renderTurboDash(ctx, state) },
}

function playerWorldX(state) { return state.cameraX + PLAYER_SCREEN_X }

function stepTurboDash(state, input) {
  if (state.status !== 'playing') return
  state.frame++
  if (state.invuln > 0) state.invuln--

  if (state.respawnTimer > 0) {
    state.respawnTimer--
    return
  }

  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.frame * SPEED_GROWTH)
  state.cameraX += state.speed
  state.score = Math.floor(state.cameraX / 8) + state.rings * 5

  const p = state.player
  const wx = playerWorldX(state)
  const inPit = state.pits.some(pit => wx + HALF_W > pit.startX && wx - HALF_W < pit.endX)

  p.ducking = input.duck && p.onGround
  const halfH = p.ducking ? DUCK_HALF_H : STAND_HALF_H

  if (input.jump && !state.jumpHeld && p.onGround && !inPit) { p.vy = JUMP_V; p.onGround = false }
  state.jumpHeld = input.jump

  p.vy += GRAVITY
  p.y += p.vy

  if (!inPit && p.y + halfH >= GROUND_Y && p.vy >= 0) {
    p.y = GROUND_Y - halfH
    p.vy = 0
    p.onGround = true
  } else {
    p.onGround = false
  }

  if (p.y - halfH > H + 60) {
    loseLife(state, true)
    return
  }

  const headTop = p.y - halfH
  const footBottom = p.y + halfH
  if (state.invuln === 0) {
    const hitSpike = state.spikes.some(s => wx + HALF_W > s.startX && wx - HALF_W < s.endX && footBottom >= GROUND_Y - 4)
    const hitOverhang = state.overhangs.some(o => wx + HALF_W > o.startX && wx - HALF_W < o.endX && headTop < o.bottom)
    if (hitSpike || hitOverhang) loseLife(state, false)
  }

  state.ringObjs = state.ringObjs.filter(r => {
    if (Math.abs(r.x - wx) < 20 && Math.abs(r.y - p.y) < 24) { state.rings++; return false }
    return true
  })

  generateAhead(state)
  const cutoff = state.cameraX - BEHIND_MARGIN
  state.pits = state.pits.filter(o => o.endX > cutoff)
  state.spikes = state.spikes.filter(o => o.endX > cutoff)
  state.overhangs = state.overhangs.filter(o => o.endX > cutoff)
  state.ringObjs = state.ringObjs.filter(o => o.x > cutoff)
}

function loseLife(state, fromFall) {
  if (!fromFall && state.rings > 0) {
    state.rings = 0
    state.invuln = 70
    return
  }
  state.lives--
  if (state.lives <= 0) { state.status = 'gameover'; return }
  state.respawnTimer = 45
  state.invuln = 100
  state.player.y = GROUND_Y - STAND_HALF_H
  state.player.vy = 0
  state.player.onGround = true
  if (fromFall) state.cameraX += 160
}

function renderTurboDash(ctx, state) {
  ctx.fillStyle = '#0d2b4a'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 5; i++) {
    const x = ((i * 220 - state.cameraX * 0.3) % (W + 200) + (W + 200)) % (W + 200) - 100
    ctx.beginPath(); ctx.ellipse(x, 80 + i * 18, 70, 22, 0, 0, Math.PI * 2); ctx.fill()
  }

  const camX = state.cameraX
  ctx.fillStyle = '#2a8c4a'
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  ctx.fillStyle = '#1d6636'
  state.pits.forEach(pit => {
    ctx.clearRect(pit.startX - camX, GROUND_Y, pit.endX - pit.startX, H - GROUND_Y)
    ctx.fillStyle = '#04121f'
    ctx.fillRect(pit.startX - camX, GROUND_Y, pit.endX - pit.startX, H - GROUND_Y)
    ctx.fillStyle = '#1d6636'
  })

  ctx.fillStyle = '#c0392b'
  state.spikes.forEach(s => {
    const x = s.startX - camX
    ctx.beginPath()
    ctx.moveTo(x, GROUND_Y)
    ctx.lineTo(x + (s.endX - s.startX) / 2, GROUND_Y - 26)
    ctx.lineTo(x + (s.endX - s.startX), GROUND_Y)
    ctx.closePath()
    ctx.fill()
  })

  ctx.fillStyle = '#7a4a2a'
  state.overhangs.forEach(o => {
    ctx.fillRect(o.startX - camX, 0, o.endX - o.startX, o.bottom)
  })

  ctx.fillStyle = '#ffd23c'
  state.ringObjs.forEach(r => {
    ctx.beginPath()
    ctx.arc(r.x - camX, r.y, 9, 0, Math.PI * 2)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffd23c'
    ctx.stroke()
  })

  if (state.respawnTimer === 0 || state.frame % 6 < 3) {
    const p = state.player
    const halfH = p.ducking ? DUCK_HALF_H : STAND_HALF_H
    const blink = state.invuln > 0 && Math.floor(state.frame / 4) % 2 === 0
    if (!blink) {
      ctx.fillStyle = '#3d7ac9'
      ctx.beginPath()
      ctx.ellipse(PLAYER_SCREEN_X, p.y, HALF_W + 4, halfH, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffe0c0'
      ctx.beginPath()
      ctx.arc(PLAYER_SCREEN_X + 10, p.y - halfH * 0.3, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textBaseline = 'top'
  ctx.fillText(`SCORE ${state.score}`, 12, 10)
  ctx.fillText(`RINGS ${state.rings}`, W / 2 - 40, 10)
  ctx.fillText('▲'.repeat(Math.max(0, state.lives)), W - 90, 10)
}
