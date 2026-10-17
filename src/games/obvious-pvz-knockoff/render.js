// ── The Obvious Plants vs. Zombies Knockoff — rendering ───────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, SHOP_H, GRID_X0, GRID_Y0, ROWS, COLS, CELL_W, CELL_H } from './constants.js'
import { PLANTS } from './plantData.js'
import { ZOMBIES } from './zombieData.js'

function drawLawn(ctx) {
  ctx.fillStyle = '#2a5a1f'
  ctx.fillRect(0, SHOP_H, W, H - SHOP_H)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GRID_X0 + c * CELL_W, y = GRID_Y0 + r * CELL_H
      ctx.fillStyle = (r + c) % 2 === 0 ? '#3f8c30' : '#357a2a'
      ctx.fillRect(x, y, CELL_W, CELL_H)
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(GRID_X0 + 0.5, GRID_Y0 + 0.5, COLS * CELL_W - 1, ROWS * CELL_H - 1)
}

function drawHoverHighlight(ctx, hover) {
  if (!hover) return
  const x = GRID_X0 + hover.col * CELL_W, y = GRID_Y0 + hover.row * CELL_H
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(x, y, CELL_W, CELL_H)
}

function drawMower(ctx, mower, row) {
  if (mower.state === 'used') return
  const y = GRID_Y0 + row * CELL_H + CELL_H / 2
  ctx.fillStyle = '#c8c8d8'
  ctx.fillRect(mower.x - 16, y - 12, 32, 20)
  ctx.fillStyle = '#5a5a6a'
  ctx.beginPath(); ctx.arc(mower.x - 10, y + 10, 6, 0, Math.PI * 2); ctx.arc(mower.x + 10, y + 10, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e03a3a'
  ctx.fillRect(mower.x - 4, y - 20, 8, 10)
}

function drawPlant(ctx, p) {
  const def = PLANTS[p.type]
  const bob = Math.sin((p.x + p.y) * 0.02) * 2
  ctx.save()
  ctx.translate(p.x, p.y + bob)
  ctx.fillStyle = '#2a5a1a'
  ctx.fillRect(-3, 14, 6, 10)
  ctx.fillStyle = def.color
  if (p.type === 'wall') {
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 26, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = def.accent
    ctx.beginPath(); ctx.arc(-6, -4, 2.5, 0, Math.PI * 2); ctx.arc(6, -4, 2.5, 0, Math.PI * 2); ctx.fill()
  } else if (p.type === 'mine') {
    const armed = p.armTimer <= 0
    ctx.fillStyle = armed ? '#ff5c2a' : def.color
    ctx.beginPath(); ctx.ellipse(0, 6, 16, 10, 0, 0, Math.PI * 2); ctx.fill()
    if (!armed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(0, 6, 14, -Math.PI / 2, -Math.PI / 2 + (1 - p.armTimer / def.armFrames) * Math.PI * 2); ctx.stroke()
    }
  } else {
    // stem + head, generic for shooters/sunbloom
    ctx.fillStyle = '#3a8a2a'
    ctx.fillRect(-4, -10, 8, 24)
    ctx.fillStyle = def.color
    ctx.beginPath(); ctx.arc(0, -16, 16, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = def.accent
    ctx.beginPath(); ctx.arc(-5, -18, 3, 0, Math.PI * 2); ctx.fill()
    if (p.type === 'twin') { ctx.beginPath(); ctx.arc(5, -18, 3, 0, Math.PI * 2); ctx.fill() }
    if (p.type === 'sun') {
      ctx.fillStyle = '#ffe98a'
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath(); ctx.arc(Math.cos(a) * 22, -16 + Math.sin(a) * 22, 5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = def.color
      ctx.beginPath(); ctx.arc(0, -16, 14, 0, Math.PI * 2); ctx.fill()
    }
  }
  // health sliver if damaged
  if (p.hp < p.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(-20, 26, 40, 5)
    ctx.fillStyle = '#5cff8a'
    ctx.fillRect(-20, 26, 40 * Math.max(0, p.hp / p.maxHp), 5)
  }
  ctx.restore()
}

function drawZombie(ctx, z) {
  const def = ZOMBIES[z.type]
  ctx.save()
  ctx.translate(z.x, z.y)
  const limp = Math.sin(z.x * 0.1) * 3
  ctx.fillStyle = def.color
  ctx.fillRect(-12, -6, 24, 34)
  ctx.fillStyle = '#5a6a4a'
  ctx.fillRect(-12 + limp * 0.3, 28, 10, 10)
  ctx.fillRect(2 - limp * 0.3, 28, 10, 10)
  ctx.fillStyle = def.headColor
  ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill()
  if (def.hat === 'cone') {
    ctx.fillStyle = '#e8862a'
    ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(10, -22); ctx.lineTo(0, -46); ctx.closePath(); ctx.fill()
  } else if (def.hat === 'bucket') {
    ctx.fillStyle = '#9a9aa8'
    ctx.fillRect(-12, -38, 24, 18)
  }
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath(); ctx.arc(-4, -17, 2, 0, Math.PI * 2); ctx.arc(4, -17, 2, 0, Math.PI * 2); ctx.fill()
  if (z.slowTimer > 0) {
    ctx.fillStyle = 'rgba(92,200,255,0.35)'
    ctx.fillRect(-14, -24, 28, 50)
  }
  ctx.restore()
  // health bar
  const barW = 30
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(z.x - barW / 2, z.y - 40, barW, 5)
  ctx.fillStyle = '#ff5c5c'
  ctx.fillRect(z.x - barW / 2, z.y - 40, barW * Math.max(0, z.hp / z.maxHp), 5)
}

function drawProjectile(ctx, pr) {
  ctx.fillStyle = pr.type === 'frostpea' ? '#5cc8ff' : '#7adf3f'
  ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill()
}

function drawSun(ctx, s) {
  ctx.save()
  ctx.shadowColor = '#ffd93d'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#ffd93d'
  ctx.beginPath(); ctx.arc(s.x, s.y, 16, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#fff3b0'
  ctx.beginPath(); ctx.arc(s.x - 4, s.y - 4, 6, 0, Math.PI * 2); ctx.fill()
}

function drawParticles(ctx, particles) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 22)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0) return
  ctx.globalAlpha = Math.min(1, state.messageTimer / 30)
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(W / 2 - 220, H - 50, 440, 32)
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(state.message, W / 2, H - 28)
  ctx.globalAlpha = 1
}

export function render(ctx, state, hover) {
  ctx.clearRect(0, 0, W, H)
  drawLawn(ctx)
  drawHoverHighlight(ctx, hover)
  for (let r = 0; r < ROWS; r++) drawMower(ctx, state.mowers[r], r)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (state.grid[r][c]) drawPlant(ctx, state.grid[r][c])
  state.zombies.forEach(z => drawZombie(ctx, z))
  state.projectiles.forEach(pr => drawProjectile(ctx, pr))
  state.suns.forEach(s => drawSun(ctx, s))
  drawParticles(ctx, state.particles)
  drawMessage(ctx, state)
}
