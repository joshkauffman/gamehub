// ── The Obvious Mario Knockoff — rendering ────────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, GROUND_Y, THEMES } from './constants.js'
import { LEVELS } from './levels.js'
import { currentLevel } from './engine.js'

function drawBackground(ctx, theme, camX) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, theme.sky[0])
  g.addColorStop(1, theme.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  if (theme.clouds) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 8; i++) {
      const x = ((i * 300 - camX * 0.3) % (W + 300) + (W + 300)) % (W + 300) - 150
      const y = 60 + (i % 3) * 40
      ctx.beginPath()
      ctx.arc(x, y, 22, 0, Math.PI * 2)
      ctx.arc(x + 26, y - 8, 17, 0, Math.PI * 2)
      ctx.arc(x + 46, y + 2, 19, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (theme.hills) {
    ctx.fillStyle = 'rgba(70,150,60,0.55)'
    for (let i = 0; i < 6; i++) {
      const x = ((i * 420 - camX * 0.6) % (W + 200) + (W + 200)) % (W + 200) - 100
      ctx.beginPath()
      ctx.arc(x, GROUND_Y + 10, 60, Math.PI, 0)
      ctx.fill()
    }
  }
  if (theme.lava) {
    ctx.fillStyle = 'rgba(255,90,20,0.12)'
    for (let i = 0; i < 5; i++) {
      const x = ((i * 260 - camX * 0.4) % (W + 200) + (W + 200)) % (W + 200) - 100
      ctx.beginPath(); ctx.arc(x, H - 20, 90, Math.PI, 0); ctx.fill()
    }
  }
}

function drawGround(ctx, theme, level, camX) {
  // Void under any gap gets the theme's tint (lava-red for the castle,
  // sky-blue for the sky world) so pits read as a hazard, not a glitch.
  ctx.fillStyle = theme.void
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  for (const seg of level.groundSegments) {
    const x0 = seg.x0 - camX, x1 = seg.x1 - camX
    if (x1 < 0 || x0 > W) continue
    ctx.fillStyle = theme.ground
    ctx.fillRect(x0, GROUND_Y, x1 - x0, H - GROUND_Y)
    ctx.fillStyle = theme.groundTop
    ctx.fillRect(x0, GROUND_Y, x1 - x0, 12)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    for (let x = Math.max(x0, 0); x < x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 12); ctx.lineTo(x, H); ctx.stroke() }
  }
}

function drawBlock(ctx, theme, b, camX) {
  const x = b.x - camX, y = b.y - (b.bump > 0 ? Math.sin(b.bump / 8 * Math.PI) * 8 : 0)
  if (x < -50 || x > W + 50) return
  if (b.kind === 'question') {
    ctx.fillStyle = b.used ? '#8a6a3a' : theme.block
    ctx.fillRect(x, y, b.w, b.h)
    ctx.strokeStyle = '#5c3d17'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2)
    if (!b.used) {
      ctx.fillStyle = '#fff8e0'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('?', x + b.w / 2, y + b.h / 2 + 1)
    }
  } else if (b.kind === 'brick' || b.kind === 'stair') {
    if (b.kind === 'brick' && b.used) return
    ctx.fillStyle = theme.brick
    ctx.fillRect(x, y, b.w, b.h)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5
    ctx.strokeRect(x + 2, y + 2, b.w - 4, b.h - 4)
  }
}

function drawPipe(ctx, p, camX) {
  const x = p.x - camX
  if (x < -100 || x > W + 100) return
  ctx.fillStyle = '#2f9e4a'
  ctx.fillRect(x, p.y, p.w, p.h)
  ctx.fillStyle = '#3fc75f'
  ctx.fillRect(x, p.y, 10, p.h)
  ctx.fillStyle = '#1f7a35'
  ctx.fillRect(x - 6, p.y, p.w + 12, 16)
  ctx.fillStyle = '#3fc75f'
  ctx.fillRect(x - 6, p.y, 10, 16)
}

function drawEnemy(ctx, e, camX) {
  const x = e.x - camX
  if (x < -40 || x > W + 40) return
  const squished = e.squish > 0
  ctx.save()
  ctx.translate(x + e.w / 2, e.y + e.h)
  if (squished) ctx.scale(1.3, 0.35)
  ctx.fillStyle = '#8a5a3a'
  ctx.beginPath()
  ctx.ellipse(0, -e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  if (!squished) {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(-6, -e.h / 2 - 2, 4, 0, Math.PI * 2); ctx.arc(6, -e.h / 2 - 2, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(-6, -e.h / 2 - 2, 2, 0, Math.PI * 2); ctx.arc(6, -e.h / 2 - 2, 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#4a2f1a'
    ctx.fillRect(-e.w / 2, -e.h + 4, e.w, 6)
  }
  ctx.restore()
}

// A big spiky shell-backed boss — bigger, angrier cousin of the regular
// enemies, with back spikes and horns instead of a smooth shell. Flashes
// white briefly after taking a hit.
function drawBoss(ctx, boss, camX) {
  if (!boss.alive) return
  const x = boss.x - camX
  if (x < -100 || x > W + 100) return
  const flash = boss.invincible > 0 && Math.floor(boss.invincible / 4) % 2 === 0
  ctx.save()
  ctx.translate(x + boss.w / 2, boss.y + boss.h)
  ctx.fillStyle = flash ? '#ffffff' : '#3a6b2f'
  ctx.beginPath()
  ctx.ellipse(0, -boss.h * 0.55, boss.w * 0.5, boss.h * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = flash ? '#dddddd' : '#1f4a1a'
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * boss.w * 0.16, -boss.h * 0.95)
    ctx.lineTo(i * boss.w * 0.16 - 6, -boss.h * 0.7)
    ctx.lineTo(i * boss.w * 0.16 + 6, -boss.h * 0.7)
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = '#f0d060'
  ;[-1, 1].forEach(s => {
    ctx.beginPath()
    ctx.moveTo(s * boss.w * 0.3, -boss.h * 0.85)
    ctx.lineTo(s * boss.w * 0.42, -boss.h * 1.05)
    ctx.lineTo(s * boss.w * 0.2, -boss.h * 0.8)
    ctx.closePath(); ctx.fill()
  })
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(-boss.w * 0.15, -boss.h * 0.6, 7, 0, Math.PI * 2); ctx.arc(boss.w * 0.15, -boss.h * 0.6, 7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#c0272d'
  ctx.beginPath(); ctx.arc(-boss.w * 0.15, -boss.h * 0.6, 3.5, 0, Math.PI * 2); ctx.arc(boss.w * 0.15, -boss.h * 0.6, 3.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawCoin(ctx, c, camX, frame) {
  if (c.taken) return
  const x = c.x - camX
  if (x < -30 || x > W + 30) return
  const s = Math.abs(Math.sin(frame * 0.08 + c.x))
  ctx.save()
  ctx.translate(x + c.w / 2, c.y + c.h / 2)
  ctx.scale(0.3 + s * 0.7, 1)
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd93d'; ctx.fill()
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()
}

function drawPowerup(ctx, pu, camX, frame) {
  const x = pu.x - camX
  if (x < -50 || x > W + 50) return
  if (pu.type === 'star') {
    const hue = (frame * 6) % 360
    ctx.fillStyle = `hsl(${hue},90%,60%)`
    ctx.save()
    ctx.translate(x + pu.w / 2, pu.y + pu.h / 2)
    ctx.rotate(frame * 0.15)
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2
      const a2 = a1 + Math.PI / 5
      ctx.lineTo(Math.cos(a1) * 14, Math.sin(a1) * 14)
      ctx.lineTo(Math.cos(a2) * 6, Math.sin(a2) * 6)
    }
    ctx.closePath(); ctx.fill()
    ctx.restore()
    return
  }
  if (pu.type === '1up') {
    ctx.fillStyle = '#3fae4a'
    ctx.beginPath(); ctx.arc(x + pu.w / 2, pu.y + pu.h * 0.4, pu.w / 2, Math.PI, 0); ctx.fill()
    ctx.fillStyle = '#fff2d9'; ctx.fillRect(x + 4, pu.y + pu.h * 0.4, pu.w - 8, pu.h * 0.4)
    ctx.fillStyle = '#fff'
    ;[0.28, 0.72].forEach(f => { ctx.beginPath(); ctx.arc(x + pu.w * f, pu.y + pu.h * 0.25, 4, 0, Math.PI * 2); ctx.fill() })
    return
  }
  const capColor = pu.type === 'fireflower' ? '#ff5a3c' : '#e8503c'
  ctx.fillStyle = capColor
  ctx.beginPath(); ctx.arc(x + pu.w / 2, pu.y + pu.h * 0.4, pu.w / 2, Math.PI, 0)
  ctx.fill()
  if (pu.type === 'fireflower') {
    ctx.fillStyle = '#ffd93d'
    ;[0.3, 0.5, 0.7].forEach(f => { ctx.beginPath(); ctx.arc(x + pu.w * f, pu.y + pu.h * 0.28, 4, 0, Math.PI * 2); ctx.fill() })
  }
  ctx.fillStyle = '#fff2d9'
  ctx.fillRect(x + 4, pu.y + pu.h * 0.4, pu.w - 8, pu.h * 0.4)
  ctx.fillStyle = '#fff'
  ;[0.28, 0.72].forEach(f => { ctx.beginPath(); ctx.arc(x + pu.w * f, pu.y + pu.h * 0.25, 4, 0, Math.PI * 2); ctx.fill() })
}

function drawFireball(ctx, fb, camX, frame) {
  const x = fb.x - camX
  ctx.save()
  ctx.translate(x, fb.y)
  ctx.rotate(frame * 0.5)
  ctx.fillStyle = fb.owner === 'boss' ? '#a04ad0' : '#ff7a1a'
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = fb.owner === 'boss' ? '#e0b8ff' : '#ffd93d'
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawFlag(ctx, level, camX) {
  if (level.flagX == null) return
  const x = level.flagX - camX
  ctx.fillStyle = '#c9c9c9'
  ctx.fillRect(x, GROUND_Y - 300, 6, 300)
  ctx.fillStyle = '#e8503c'
  ctx.beginPath()
  ctx.moveTo(x + 6, GROUND_Y - 290)
  ctx.lineTo(x + 46, GROUND_Y - 278)
  ctx.lineTo(x + 6, GROUND_Y - 262)
  ctx.closePath()
  ctx.fill()
  // A little castle-ish shape past the pole, purely decorative.
  const cx = x + 140
  ctx.fillStyle = '#8f8f8f'
  ctx.fillRect(cx, GROUND_Y - 140, 220, 140)
  ctx.fillRect(cx - 20, GROUND_Y - 100, 30, 100)
  ctx.fillRect(cx + 210, GROUND_Y - 100, 30, 100)
  ctx.fillStyle = '#6b6b6b'
  ctx.fillRect(cx + 80, GROUND_Y - 200, 60, 60)
  ctx.fillStyle = '#3a2a18'
  ctx.fillRect(cx + 95, GROUND_Y - 70, 30, 70)
}

// A side-view plumber-guy, drawn as layered rounded shapes rather than a
// pixel bitmap — cap+brim, poofy sideburn hair, big nose, mustache,
// overalls with a bib button, one visible sleeve/glove, and two-tone shoes.
// Recolors for the fire form (white overalls, red shirt) and flashes
// through a color cycle while starred.
function drawPlayer(ctx, p, camX, frame) {
  if (p.invincible > 0 && p.starTimer <= 0 && Math.floor(p.invincible / 4) % 2 === 0 && !p.dead) return
  const x = p.x - camX
  const w = p.w, h = p.h
  ctx.save()
  ctx.translate(x + w / 2, p.y + h / 2)
  if (p.dead) ctx.rotate(Math.PI)
  ctx.scale(p.facing, 1)

  const starColors = ['#ff4d4d', '#ffd93d', '#4dd2ff', '#7bff4d', '#ff4dde']
  const starred = p.starTimer > 0
  const capColor = starred ? starColors[Math.floor(frame / 4) % starColors.length] : '#d43a2f'
  const overallColor = p.powerState === 'fire' ? '#f4f0e6' : '#2f6fd0'
  const overallDark = p.powerState === 'fire' ? '#d8d0bc' : '#1f4a90'
  const skin = '#f2c299'
  const hairMustache = '#4a2f18'

  const headH = h * 0.34
  const bodyH = h * 0.5
  const legH = h * 0.16
  const bodyW = w * 0.82

  // legs — a light walk-cycle wiggle while moving
  const walking = Math.abs(p.vx) > 0.3 && p.onGround
  const stride = walking ? Math.sin(frame * 0.5) * (w * 0.12) : 0
  ctx.fillStyle = hairMustache
  ctx.fillRect(-bodyW / 2 - stride * 0.3, h / 2 - legH, bodyW * 0.42, legH)
  ctx.fillRect(bodyW / 2 - bodyW * 0.42 + stride * 0.3, h / 2 - legH, bodyW * 0.42, legH)

  // body / overalls
  const bodyY = h / 2 - legH - bodyH
  ctx.fillStyle = overallColor
  ctx.beginPath()
  ctx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 6)
  ctx.fill()
  // bib + strap
  ctx.fillStyle = overallDark
  ctx.fillRect(-bodyW * 0.12, bodyY, bodyW * 0.36, bodyH * 0.42)
  ctx.fillRect(bodyW * 0.08, bodyY - 3, bodyW * 0.12, 8)
  ctx.fillStyle = '#ffd93d'
  ctx.beginPath(); ctx.arc(bodyW * 0.06, bodyY + bodyH * 0.2, 2.6, 0, Math.PI * 2); ctx.fill()
  // shirt sleeve (front arm) + glove
  const armSwing = walking ? Math.sin(frame * 0.5 + Math.PI) * 6 : (p.onGround ? 0 : -14)
  ctx.fillStyle = starred ? capColor : '#d43a2f'
  if (p.powerState === 'fire') ctx.fillStyle = starred ? capColor : '#e8503c'
  ctx.save()
  ctx.translate(bodyW * 0.3, bodyY + bodyH * 0.12)
  ctx.rotate((armSwing * Math.PI) / 180)
  ctx.fillRect(-4, 0, 9, bodyH * 0.42)
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(0.5, bodyH * 0.42, 5.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // back sleeve peek
  ctx.fillStyle = p.powerState === 'fire' ? '#e8503c' : '#d43a2f'
  ctx.fillRect(-bodyW / 2 - 2, bodyY, 8, bodyH * 0.32)

  // head
  const headY = bodyY - headH * 0.72
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.roundRect(-w * 0.34, headY, w * 0.68, headH, 8)
  ctx.fill()
  // sideburn / hair poof at the back of the head
  ctx.fillStyle = hairMustache
  ctx.beginPath(); ctx.arc(-w * 0.22, headY + headH * 0.55, w * 0.14, 0, Math.PI * 2); ctx.fill()
  // cap dome + brim
  ctx.fillStyle = capColor
  ctx.beginPath()
  ctx.roundRect(-w * 0.36, headY - headH * 0.5, w * 0.72, headH * 0.62, 7)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(w * 0.02, headY - headH * 0.06, w * 0.42, headH * 0.22, 4)
  ctx.fill()
  // nose
  ctx.fillStyle = skin
  ctx.beginPath(); ctx.arc(w * 0.3, headY + headH * 0.6, w * 0.13, 0, Math.PI * 2); ctx.fill()
  // eye
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath(); ctx.arc(w * 0.08, headY + headH * 0.42, 2.4, 0, Math.PI * 2); ctx.fill()
  // mustache
  ctx.fillStyle = hairMustache
  ctx.beginPath()
  ctx.ellipse(w * 0.16, headY + headH * 0.78, w * 0.24, headH * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawParticles(ctx, particles, camX) {
  particles.forEach(pt => {
    ctx.fillStyle = pt.color
    ctx.globalAlpha = Math.max(0, pt.life / 24)
    ctx.fillRect(pt.x - camX - 2, pt.y - 2, 4, 4)
    ctx.globalAlpha = 1
  })
}

function drawHUD(ctx, state) {
  const level = currentLevel(state)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, W, 40)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(`SCORE ${String(state.score).padStart(6, '0')}`, 16, 20)
  ctx.fillText(`COINS x${state.coinCount}`, 220, 20)
  ctx.fillText(`LIVES x${Math.max(0, state.lives)}`, 380, 20)
  ctx.fillText(`TIME ${state.time}`, 520, 20)
  ctx.fillText(`WORLD ${level.id}`, 660, 20)

  if (state.boss && state.boss.alive) {
    const boss = state.boss
    ctx.textAlign = 'center'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('BOSS', W / 2, 54)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(W / 2 - 100, 60, 200, 14)
    ctx.fillStyle = '#e8503c'
    ctx.fillRect(W / 2 - 98, 62, 196 * Math.max(0, boss.hp / boss.maxHp), 10)
    ctx.strokeStyle = '#fff'; ctx.strokeRect(W / 2 - 100, 60, 200, 14)
  }

  if (state.messageTimer > 0) {
    ctx.textAlign = 'center'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = '#fff8e0'
    ctx.fillText(state.message, W / 2, 88)
  }
  if (state.status === 'levelTransition') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, H / 2 - 50, W, 100)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText(state.transitionLabel, W / 2, H / 2 - 10)
    ctx.font = '16px sans-serif'
    const next = LEVELS[state.levelIndex + 1]
    ctx.fillText(next ? `Loading World ${next.id}...` : 'Loading the ending...', W / 2, H / 2 + 20)
  }
}

export function render(ctx, state) {
  const level = currentLevel(state)
  const theme = THEMES[level.theme]
  drawBackground(ctx, theme, state.camX)
  drawGround(ctx, theme, level, state.camX)
  state.pipes.forEach(p => drawPipe(ctx, p, state.camX))
  state.blocks.forEach(b => drawBlock(ctx, theme, b, state.camX))
  state.coins.forEach(c => drawCoin(ctx, c, state.camX, state.frame))
  state.powerups.forEach(pu => drawPowerup(ctx, pu, state.camX, state.frame))
  state.fireballs.forEach(fb => drawFireball(ctx, fb, state.camX, state.frame))
  state.enemies.forEach(e => drawEnemy(ctx, e, state.camX))
  if (state.boss) drawBoss(ctx, state.boss, state.camX)
  drawFlag(ctx, level, state.camX)
  drawPlayer(ctx, state.player, state.camX, state.frame)
  drawParticles(ctx, state.particles, state.camX)
  drawHUD(ctx, state)
}
