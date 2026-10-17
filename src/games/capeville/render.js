// ── Capeville — rendering ──────────────────────────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates
// it. drawHero() is the important one — it builds the hero entirely out
// of the player's customization choices (colors, emblem, cape, mask).

import { W, H, HUD_H, CITY_W, CITY_H, VILLAIN_HP } from './constants.js'
import { BUILDINGS, PARKS } from './cityData.js'
import { rescueProgress } from './engine.js'

const ROAD_COLOR = '#5a5a66'
const ROAD_LINE = '#d8d840'
const SIDEWALK = '#8a8a98'

function drawCity(ctx, camX, camY) {
  ctx.fillStyle = ROAD_COLOR
  ctx.fillRect(-camX, -camY + HUD_H, CITY_W, CITY_H)

  for (const park of PARKS) {
    const x = park.x - camX, y = park.y - camY + HUD_H
    if (x > W || y > H || x + park.w < 0 || y + park.h < 0) continue
    ctx.fillStyle = '#3f8c30'
    ctx.fillRect(x, y, park.w, park.h)
    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    for (let i = 0; i < park.w; i += 40) ctx.fillRect(x + i, y, 2, park.h)
  }

  for (const b of BUILDINGS) {
    const x = b.x - camX, y = b.y - camY + HUD_H
    if (x > W || y > H || x + b.w < 0 || y + b.h < 0) continue
    ctx.fillStyle = SIDEWALK
    ctx.fillRect(x - 6, y - 6, b.w + 12, b.h + 12)
    const shade = 40 + (b.stories % 5) * 8
    ctx.fillStyle = `rgb(${90 - shade / 3},${95 - shade / 3},${110 - shade / 3})`
    ctx.fillRect(x, y, b.w, b.h)
    ctx.fillStyle = 'rgba(255,230,150,0.55)'
    const cols = Math.max(2, Math.floor(b.w / 34))
    const rows = Math.max(2, Math.floor(b.h / 34))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 3 === 0) continue
        ctx.fillRect(x + 10 + c * (b.w - 20) / cols, y + 10 + r * (b.h - 20) / rows, 10, 10)
      }
    }
  }

  // road-center dashes along the main avenues
  ctx.fillStyle = ROAD_LINE
  for (let gx = 0; gx < CITY_W; gx += 400) {
    for (let gy = 0; gy < CITY_H; gy += 20) {
      const x = gx - camX, y = gy - camY + HUD_H
      if (x > -4 && x < W) ctx.fillRect(x - 1, y, 2, 10)
    }
  }
}

// `inDanger` tracks the paired villain's alive state — true means still
// cowering (blue), false means just rescued (green, waving).
function drawCitizen(ctx, x, y, inDanger) {
  ctx.fillStyle = '#f2c89a'
  ctx.beginPath(); ctx.arc(x, y - 10, 7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = inDanger ? '#4a7adf' : '#5cd85c'
  ctx.fillRect(x - 6, y - 3, 12, 16)
  if (!inDanger) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x - 10, y - 18); ctx.lineTo(x - 4, y - 24); ctx.stroke()
  }
}

function drawVillain(ctx, v) {
  if (!v.alive) return
  const bob = Math.sin(v.bobPhase) * 3
  ctx.fillStyle = v.hitFlash > 0 ? '#fff' : '#4a2a52'
  ctx.fillRect(v.x, v.y + bob, v.w, v.h)
  ctx.fillStyle = v.hitFlash > 0 ? '#fff' : '#d8303a'
  ctx.fillRect(v.x, v.y + bob - 8, v.w, 8)
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(v.x + v.w * 0.3, v.y + bob + 6, 2.5, 0, Math.PI * 2)
  ctx.arc(v.x + v.w * 0.7, v.y + bob + 6, 2.5, 0, Math.PI * 2); ctx.fill()

  // HP bar — only shown once the villain has taken a hit, so a fresh
  // crime scene doesn't look cluttered before the fight even starts.
  if (v.hp < VILLAIN_HP) {
    const barW = v.w
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(v.x, v.y + bob - 14, barW, 4)
    ctx.fillStyle = '#e8503a'
    ctx.fillRect(v.x, v.y + bob - 14, barW * Math.max(0, v.hp / VILLAIN_HP), 4)
  }
}

function drawEmblem(ctx, cx, cy, shape, color, scale = 1) {
  ctx.fillStyle = color
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  if (shape === 'star') {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      const a2 = a + Math.PI / 5
      ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8)
      ctx.lineTo(Math.cos(a2) * 3.5, Math.sin(a2) * 3.5)
    }
    ctx.closePath(); ctx.fill()
  } else if (shape === 'bolt') {
    ctx.beginPath()
    ctx.moveTo(-2, -9); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.lineTo(3, 9); ctx.lineTo(-5, 0); ctx.lineTo(-1, 0)
    ctx.closePath(); ctx.fill()
  } else if (shape === 'shield') {
    ctx.beginPath()
    ctx.moveTo(0, -9); ctx.lineTo(7, -5); ctx.lineTo(6, 4); ctx.lineTo(0, 9); ctx.lineTo(-6, 4); ctx.lineTo(-7, -5)
    ctx.closePath(); ctx.fill()
  } else if (shape === 'flame') {
    ctx.beginPath()
    ctx.moveTo(0, 9); ctx.quadraticCurveTo(-8, 2, -3, -4); ctx.quadraticCurveTo(-4, -8, 0, -9)
    ctx.quadraticCurveTo(2, -4, 5, -2); ctx.quadraticCurveTo(8, 3, 0, 9)
    ctx.closePath(); ctx.fill()
  } else if (shape === 'paw') {
    ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fill()
    for (const [dx, dy] of [[-5, -5], [0, -7], [5, -5]]) { ctx.beginPath(); ctx.arc(dx, dy, 2.4, 0, Math.PI * 2); ctx.fill() }
  } else if (shape === 'atom') {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6
    for (const rot of [0, 1.05, 2.1]) {
      ctx.save(); ctx.rotate(rot)
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill()
  } else if (shape === 'wings') {
    ctx.beginPath(); ctx.ellipse(-5, 0, 6, 3, 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(5, 0, 6, 3, -0.3, 0, Math.PI * 2); ctx.fill()
  } else { // spiral
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.beginPath()
    for (let a = 0; a < 14; a += 0.3) ctx.lineTo(Math.cos(a) * (a * 0.6), Math.sin(a) * (a * 0.6))
    ctx.stroke()
  }
  ctx.restore()
}

export function drawHero(ctx, hero, p, frame) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  const facingDX = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0

  if (p.flying) {
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.ellipse(cx, cy + p.h / 2 + 14, p.w * 0.5, 6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // cape, drawn behind the body, trailing opposite of facing
  if (hero.cape) {
    const trail = facingDX !== 0 ? -facingDX : (p.facing === 'up' ? 0 : 1)
    const sway = Math.sin(frame * 0.15) * 3
    ctx.fillStyle = hero.capeColor || hero.accentColor
    ctx.beginPath()
    ctx.moveTo(cx - p.w * 0.3, p.y + p.h * 0.25)
    ctx.quadraticCurveTo(cx + trail * 16 + sway, cy + 6, cx + trail * 10, p.y + p.h + 10)
    ctx.quadraticCurveTo(cx + trail * 4, cy + 4, cx + p.w * 0.3, p.y + p.h * 0.25)
    ctx.closePath()
    ctx.fill()
  }

  // legs
  ctx.fillStyle = hero.accentColor
  ctx.fillRect(p.x + 4, p.y + p.h - 9, p.w * 0.32, 9)
  ctx.fillRect(p.x + p.w - p.w * 0.32 - 4, p.y + p.h - 9, p.w * 0.32, 9)

  // body
  ctx.fillStyle = hero.primaryColor
  ctx.beginPath()
  ctx.moveTo(p.x + 4, p.y + p.h * 0.3)
  ctx.lineTo(p.x + p.w - 4, p.y + p.h * 0.3)
  ctx.lineTo(p.x + p.w - 6, p.y + p.h - 9)
  ctx.lineTo(p.x + 6, p.y + p.h - 9)
  ctx.closePath()
  ctx.fill()

  // belt
  ctx.fillStyle = hero.accentColor
  ctx.fillRect(p.x + 4, p.y + p.h * 0.62, p.w - 8, 5)

  // emblem on chest
  drawEmblem(ctx, cx, p.y + p.h * 0.46, hero.emblem, hero.accentColor, 0.85)

  const headY = p.y + p.h * 0.16, headR = p.w * 0.34
  const showHair = hero.mask !== 'full' && hero.hairStyle && hero.hairStyle !== 'bald'

  // hair, back layer — long hair hangs as two side locks that extend
  // well past the head's bottom edge, so they stay clearly visible
  // once the head disc is drawn on top (a halo alone would mostly
  // disappear under it).
  if (showHair && hero.hairStyle === 'long') {
    ctx.fillStyle = hero.hairColor
    ctx.beginPath(); ctx.arc(cx, headY, headR * 1.1, Math.PI * 0.95, Math.PI * 2.05); ctx.fill()
    ctx.fillRect(cx - headR * 1.15, headY - headR * 0.2, headR * 0.5, headR * 1.7)
    ctx.fillRect(cx + headR * 0.65, headY - headR * 0.2, headR * 0.5, headR * 1.7)
  }

  // head
  ctx.fillStyle = hero.skinTone || '#f2c89a'
  ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill()

  // hair, front/top layer
  if (showHair) {
    ctx.fillStyle = hero.hairColor
    if (hero.hairStyle === 'short' || hero.hairStyle === 'ponytail') {
      ctx.beginPath(); ctx.arc(cx, headY, headR * 1.03, Math.PI * 1.08, Math.PI * 1.92); ctx.fill()
    } else if (hero.hairStyle === 'mohawk') {
      ctx.beginPath()
      ctx.moveTo(cx - 2.6, headY - headR * 1.15)
      ctx.lineTo(cx + 2.6, headY - headR * 1.15)
      ctx.lineTo(cx + 1.6, headY + headR * 0.4)
      ctx.lineTo(cx - 1.6, headY + headR * 0.4)
      ctx.closePath(); ctx.fill()
    }
    if (hero.hairStyle === 'ponytail') {
      const dir = facingDX !== 0 ? -facingDX : 1
      ctx.beginPath()
      ctx.ellipse(cx + dir * headR * 1.15, headY + headR * 0.7, headR * 0.32, headR * 0.95, dir * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // mask
  if (hero.mask === 'full') {
    ctx.fillStyle = hero.primaryColor
    ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.16, p.w * 0.36, Math.PI * 1.05, Math.PI * 1.95); ctx.fill()
    ctx.fillRect(p.x + p.w * 0.14, p.y + p.h * 0.02, p.w * 0.72, p.h * 0.1)
  } else if (hero.mask === 'domino') {
    ctx.fillStyle = hero.accentColor
    ctx.fillRect(cx - p.w * 0.3, p.y + p.h * 0.1, p.w * 0.6, 6)
  }

  // eyes hint at facing
  if (hero.mask !== 'full') {
    ctx.fillStyle = hero.eyeColor || '#1a1a1a'
    const ex = facingDX * 2.5
    ctx.fillRect(cx - 5 + ex, p.y + p.h * 0.17, 2.6, 2.6)
    ctx.fillRect(cx + 2 + ex, p.y + p.h * 0.17, 2.6, 2.6)
  } else {
    ctx.fillStyle = '#fff'
    const ex = facingDX * 2.5
    ctx.fillRect(cx - 5 + ex, p.y + p.h * 0.17, 3, 2)
    ctx.fillRect(cx + 2 + ex, p.y + p.h * 0.17, 3, 2)
  }

  // punch swing, in front of the hero on the side they're facing
  if (p.punchTimer > 0) {
    const dir = facingDX !== 0 ? facingDX : (p.facing === 'up' ? 0 : 1)
    const t = p.punchTimer / 10
    ctx.save()
    ctx.globalAlpha = t
    ctx.strokeStyle = hero.accentColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx + dir * p.w * 0.5, cy, 10 + (1 - t) * 6, -0.9, 0.9)
    ctx.stroke()
    ctx.restore()
  }

  // carried prop floats above the head
  if (p.carrying != null) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(cx, p.y - 8, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
  }
}

function drawProp(ctx, prop) {
  ctx.save()
  ctx.translate(prop.x, prop.y)
  if (prop.kind === 'car') {
    ctx.fillStyle = '#c23a3a'
    ctx.fillRect(-20, -10, 40, 20)
    ctx.fillStyle = '#8a2020'
    ctx.fillRect(-12, -14, 24, 10)
  } else {
    ctx.fillStyle = '#6a7a4a'
    ctx.fillRect(-14, -16, 28, 32)
    ctx.fillStyle = '#4a5a30'
    ctx.fillRect(-14, -18, 28, 4)
  }
  ctx.restore()
}

function drawProjectile(ctx, pr) {
  ctx.save()
  ctx.shadowColor = pr.glow
  ctx.shadowBlur = 14
  ctx.fillStyle = pr.color
  ctx.beginPath(); ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w / 2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawParticles(ctx, particles) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 26)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(10,10,25,0.6)'
  ctx.fillRect(0, 0, W, HUD_H)
  const { done, total } = rescueProgress(state)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(state.hero.name || 'Unnamed Hero', 14, 24)
  ctx.font = '12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(`Crime scenes stopped: ${done}/${total}`, 14, 42)
  ctx.textAlign = 'right'
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(`SCORE ${state.score}`, W - 14, 27)
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0) return
  ctx.globalAlpha = Math.min(1, state.messageTimer / 30)
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  const pad = 20
  const w = Math.min(W - 40, ctx.measureText(state.message).width + pad * 2)
  ctx.fillStyle = 'rgba(10,10,25,0.85)'
  ctx.fillRect(W / 2 - w / 2, H - 56, w, 32)
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(state.message, W / 2, H - 40)
  ctx.globalAlpha = 1
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, W, H)
  const { camX, camY, player: p } = state
  drawCity(ctx, camX, camY)

  for (const v of state.villains) {
    drawCitizen(ctx, v.citizenX - camX, v.citizenY - camY + HUD_H, v.alive)
    drawVillain(ctx, { ...v, x: v.x - camX, y: v.y - camY + HUD_H })
  }
  for (const prop of state.props) if (!prop.taken || prop.thrown) drawProp(ctx, { x: prop.x - camX, y: prop.y - camY + HUD_H, kind: prop.kind })
  state.projectiles.forEach(pr => drawProjectile(ctx, { ...pr, x: pr.x - camX, y: pr.y - camY + HUD_H }))
  drawHero(ctx, state.hero, { ...p, x: p.x - camX, y: p.y - camY + HUD_H }, state.frame)
  if (p.carrying != null) {
    const prop = state.props.find(pr => pr.id === p.carrying)
    if (prop) drawProp(ctx, { x: prop.x - camX, y: prop.y - camY + HUD_H - 18, kind: prop.kind })
  }
  drawParticles(ctx, state.particles.map(pt => ({ ...pt, x: pt.x - camX, y: pt.y - camY + HUD_H })))
  drawHUD(ctx, state)
  drawMessage(ctx, state)
}
