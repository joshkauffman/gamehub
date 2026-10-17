// ── The Obvious Sonic Knockoff — rendering ────────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, HUD_H, ENEMY_DEFS } from './constants.js'
import { currentZone } from './engine.js'

const THEMES = {
  green: { sky: ['#6ec8ff', '#d8f4ff'], ground: '#3fae3f', groundDeep: '#1f6a1f', accent: '#8ae08a' },
  rust: { sky: ['#e0a860', '#f5d8a0'], ground: '#a85a2a', groundDeep: '#5a2a10', accent: '#d88a4a' },
  core: { sky: ['#3a0a1a', '#7a1a2a'], ground: '#4a1a1a', groundDeep: '#200808', accent: '#ff6a3d' },
}

function drawBackground(ctx, theme, camX) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, theme.sky[0])
  g.addColorStop(1, theme.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // parallax hill blobs
  ctx.fillStyle = theme.accent
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 8; i++) {
    const x = ((i * 260 - camX * 0.3) % (W + 260) + (W + 260)) % (W + 260) - 130
    ctx.beginPath(); ctx.arc(x, 470, 90, Math.PI, 0); ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawGround(ctx, zone, theme, camX) {
  for (const s of zone.groundSegments) {
    const x0 = s.x0 - camX, x1 = s.x1 - camX
    if (x1 < 0 || x0 > W) continue
    ctx.beginPath()
    ctx.moveTo(x0, s.y0)
    ctx.lineTo(x1, s.y1)
    ctx.lineTo(x1, H)
    ctx.lineTo(x0, H)
    ctx.closePath()
    ctx.fillStyle = theme.groundDeep
    ctx.fill()
    ctx.fillStyle = theme.ground
    ctx.beginPath()
    ctx.moveTo(x0, s.y0)
    ctx.lineTo(x1, s.y1)
    ctx.lineTo(x1, s.y1 + 14)
    ctx.lineTo(x0, s.y0 + 14)
    ctx.closePath()
    ctx.fill()
  }
}

function drawRing(ctx, x, y, frame) {
  const wobble = Math.sin(frame * 0.1 + x) * 2
  ctx.strokeStyle = '#ffd93d'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(x, y + wobble, 9, 11, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function drawPlayer(ctx, p, frame) {
  const flashing = p.invincible > 0 && Math.floor(frame / 3) % 2 === 0
  ctx.save()
  ctx.globalAlpha = flashing ? 0.4 : 1
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  if (p.rolling) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(frame * 0.5 * p.facing)
    const r = p.w / 2
    ctx.fillStyle = '#3a5fe0'
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1f3fae'
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.22, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else {
    // body
    ctx.fillStyle = '#3a5fe0'
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, p.w * 0.5, p.h * 0.42, 0, 0, Math.PI * 2); ctx.fill()
    // belly
    ctx.fillStyle = '#e8c89a'
    ctx.beginPath(); ctx.ellipse(cx, cy + p.h * 0.18, p.w * 0.32, p.h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
    // head
    ctx.fillStyle = '#3a5fe0'
    ctx.beginPath(); ctx.arc(cx + p.facing * 2, p.y + p.h * 0.18, p.w * 0.42, 0, Math.PI * 2); ctx.fill()
    // quills (trailing opposite of facing)
    ctx.fillStyle = '#2a4fc0'
    for (let i = 0; i < 3; i++) {
      const qx = cx - p.facing * (p.w * 0.3 + i * 6)
      const qy = p.y + p.h * 0.1 + i * 7
      ctx.beginPath()
      ctx.moveTo(cx - p.facing * p.w * 0.1, qy - 4)
      ctx.lineTo(qx, qy)
      ctx.lineTo(cx - p.facing * p.w * 0.1, qy + 4)
      ctx.closePath()
      ctx.fill()
    }
    // eye
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(cx + p.facing * 9, p.y + p.h * 0.15, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath(); ctx.arc(cx + p.facing * 11, p.y + p.h * 0.15, 3, 0, Math.PI * 2); ctx.fill()
    // shoes
    ctx.fillStyle = '#e03a3a'
    ctx.fillRect(p.x + 1, p.y + p.h - 9, p.w * 0.4, 9)
    ctx.fillRect(p.x + p.w - p.w * 0.4 - 1, p.y + p.h - 9, p.w * 0.4, 9)
  }
  // spin-dash charge dust
  if (p.spindash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    for (let i = 0; i < 3; i++) {
      const a = frame * 0.6 + i * 2.1
      ctx.beginPath()
      ctx.arc(cx - p.facing * (14 + Math.sin(a) * 4), cy + Math.cos(a) * 6, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawEnemy(ctx, e, def, camX) {
  const x = e.x - camX, y = e.y
  if (x < -40 || x > W + 40) return
  if (!e.alive) return
  if (e.type === 'crawler') {
    ctx.fillStyle = '#7a4acf'
    ctx.beginPath(); ctx.ellipse(x + def.w / 2, y + def.h / 2, def.w / 2, def.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#4a2a8a'
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 7, y + def.h - 4, 4, 6)
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(x + def.w * (e.dir > 0 ? 0.75 : 0.25), y + def.h * 0.35, 4, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = '#cf4a7a'
    ctx.beginPath(); ctx.arc(x + def.w / 2, y + def.h / 2, def.w / 2, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#8a2a4a'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x + def.w / 2, y); ctx.lineTo(x + def.w / 2, y - 10); ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(x + def.w * (e.dir > 0 ? 0.7 : 0.3), y + def.h * 0.4, 4, 0, Math.PI * 2); ctx.fill()
  }
}

function drawBoss(ctx, boss, camX) {
  if (!boss || !boss.alive) return
  const x = boss.x - camX
  const flash = boss.invincible > 0 && Math.floor(boss.invincible / 4) % 2 === 0
  ctx.save()
  if (flash) ctx.globalAlpha = 0.5
  ctx.fillStyle = '#3a3a4a'
  ctx.fillRect(x, boss.y, boss.w, boss.h)
  ctx.fillStyle = '#ffd93d'
  ctx.beginPath(); ctx.arc(x + boss.w / 2, boss.y + boss.h / 2, 14, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a2a'
  ctx.beginPath(); ctx.arc(x + boss.w / 2, boss.y + boss.h / 2, 6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // HP pips
  const barW = 120
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(x + boss.w / 2 - barW / 2, boss.y - 18, barW, 8)
  ctx.fillStyle = '#ff5c5c'
  ctx.fillRect(x + boss.w / 2 - barW / 2, boss.y - 18, barW * Math.max(0, boss.hp / 5), 8)
}

function drawParticles(ctx, particles, camX) {
  particles.forEach(pt => {
    const x = pt.x - camX
    ctx.globalAlpha = Math.max(0, pt.life / (pt.ring ? 40 : 24))
    if (pt.ring) {
      ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(x, pt.y, 7, 9, 0, 0, Math.PI * 2); ctx.stroke()
    } else {
      ctx.fillStyle = pt.color
      ctx.fillRect(x - 2, pt.y - 2, 4, 4)
    }
  })
  ctx.globalAlpha = 1
}

function drawGoal(ctx, zone, camX) {
  if (zone.goalX == null) return
  const x = zone.goalX - camX
  if (x < -40 || x > W + 40) return
  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(x - 2, 180, 4, 280)
  ctx.fillStyle = '#ffd93d'
  ctx.beginPath(); ctx.arc(x, 190, 16, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a2a'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('★', x, 196)
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(10,10,20,0.55)'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(`◎ ${state.ringCount}`, 16, 27)
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = '#fff'
  ctx.fillText(`SCORE ${state.score}`, 150, 27)
  ctx.textAlign = 'right'
  ctx.fillText(`LIVES ${state.lives}`, W - 16, 27)
  ctx.textAlign = 'center'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillText(currentZone(state).name, W / 2, 27)
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0) return
  ctx.globalAlpha = Math.min(1, state.messageTimer / 30)
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillText(state.message, W / 2 + 2, H / 2 + 2)
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(state.message, W / 2, H / 2)
  ctx.globalAlpha = 1
}

export function render(ctx, state) {
  const zone = currentZone(state)
  const theme = THEMES[zone.theme] || THEMES.green
  const camX = state.camX
  ctx.clearRect(0, 0, W, H)
  drawBackground(ctx, theme, camX)
  drawGround(ctx, zone, theme, camX)
  state.rings.forEach(r => { if (!r.taken) drawRing(ctx, r.x - camX, r.y, state.frame) })
  drawGoal(ctx, zone, camX)
  state.enemies.forEach(e => drawEnemy(ctx, e, ENEMY_DEFS[e.type], camX))
  drawBoss(ctx, state.boss, camX)
  const p = state.player
  drawPlayer(ctx, { ...p, x: p.x - camX }, state.frame)
  drawParticles(ctx, state.particles, camX)
  drawHUD(ctx, state)
  drawMessage(ctx, state)
}
