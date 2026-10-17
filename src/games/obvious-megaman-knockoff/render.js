// ── The Obvious Mega Man Knockoff — rendering ─────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, HUD_H, GROUND_Y, WEAPON_AMMO_MAX } from './constants.js'
import { stageById } from './levels.js'
import { WEAPONS, bossForStage } from './bossData.js'

const THEMES = {
  ember: { sky: ['#3a1208', '#8a3818'], ground: '#5a2a14', groundTop: '#c85a2a', plat: '#8a4a2a' },
  circuit: { sky: ['#0a2a1a', '#1a5a3a'], ground: '#1a3a2a', groundTop: '#3fae6a', plat: '#2a6a4a' },
  scrap: { sky: ['#2a2a32', '#5a5a66'], ground: '#3a3a42', groundTop: '#8a8a98', plat: '#5a5a66' },
  glacier: { sky: ['#1a3a5a', '#bfe8ff'], ground: '#2a4a6a', groundTop: '#8adfff', plat: '#5a8ab0' },
}

function drawBackground(ctx, theme, camX) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, theme.sky[0])
  g.addColorStop(1, theme.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.25
  ctx.fillStyle = theme.groundTop
  for (let i = 0; i < 6; i++) {
    const x = ((i * 300 - camX * 0.3) % (W + 300) + (W + 300)) % (W + 300) - 150
    ctx.fillRect(x, 420, 60, 120)
  }
  ctx.globalAlpha = 1
}

function drawStage(ctx, stage, theme, camX) {
  ctx.fillStyle = '#05070c'
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  for (const [x0, x1] of stage.groundSegments) {
    const x = x0 - camX, w = x1 - x0
    if (x + w < 0 || x > W) continue
    ctx.fillStyle = theme.ground
    ctx.fillRect(x, GROUND_Y, w, H - GROUND_Y)
    ctx.fillStyle = theme.groundTop
    ctx.fillRect(x, GROUND_Y, w, 10)
  }
  for (const p of stage.platforms) {
    const x = p.x - camX
    if (x + p.w < 0 || x > W) continue
    ctx.fillStyle = theme.plat
    ctx.fillRect(x, p.y, p.w, p.h)
    ctx.fillStyle = theme.groundTop
    ctx.fillRect(x, p.y, p.w, 4)
  }
}

function drawPlayer(ctx, p, weaponId, frame) {
  const flashing = p.invincible > 0 && Math.floor(frame / 3) % 2 === 0
  ctx.save()
  ctx.globalAlpha = flashing ? 0.4 : 1
  const cx = p.x + p.w / 2
  ctx.fillStyle = '#3a6fd8'
  ctx.fillRect(p.x + 3, p.y + p.h * 0.28, p.w - 6, p.h * 0.5)
  ctx.fillStyle = '#1f4aae'
  ctx.fillRect(p.x + 3, p.y + p.h * 0.55, p.w - 6, p.h * 0.18)
  ctx.fillStyle = '#e8e8f4'
  ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.18, p.w * 0.46, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#143a8a'
  ctx.beginPath(); ctx.arc(cx + p.facing * 2, p.y + p.h * 0.18, p.w * 0.24, 0, Math.PI * 2); ctx.fill()
  const weaponDef = WEAPONS[weaponId]
  ctx.fillStyle = weaponDef.color
  const armY = p.y + p.h * 0.42
  ctx.fillRect(p.facing > 0 ? p.x + p.w - 2 : p.x - 12, armY, 14, 8)
  ctx.fillStyle = '#2a3a6a'
  ctx.fillRect(p.x + 2, p.y + p.h - 9, p.w * 0.38, 9)
  ctx.fillRect(p.x + p.w - p.w * 0.38 - 2, p.y + p.h - 9, p.w * 0.38, 9)
  ctx.restore()
}

function drawEnemy(ctx, e, camX) {
  if (!e.alive) return
  const x = e.x - camX, y = e.y
  if (x < -40 || x > W + 40) return
  const flash = e.hitFlash > 0
  if (e.type === 'walker') {
    ctx.fillStyle = flash ? '#fff' : '#b85a9a'
    ctx.fillRect(x, y, e.w, e.h)
    ctx.fillStyle = '#6a2a52'
    ctx.fillRect(x + 4, y + e.h - 6, e.w - 8, 6)
  } else if (e.type === 'flyer') {
    ctx.fillStyle = flash ? '#fff' : '#5ac8d8'
    ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = flash ? '#fff' : '#8a8a4a'
    ctx.fillRect(x, y, e.w, e.h)
  }
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(x + e.w * 0.5, y + e.h * 0.35, 3, 0, Math.PI * 2); ctx.fill()
}

function drawBoss(ctx, boss, bossDef, camX) {
  if (!boss || !boss.alive) return
  const x = boss.x - camX
  const flash = boss.invincible > 0 && Math.floor(boss.invincible / 3) % 2 === 0
  ctx.save()
  if (flash) ctx.globalAlpha = 0.55
  ctx.fillStyle = bossDef.color
  if (bossDef.shape === 'round') {
    ctx.beginPath(); ctx.arc(x + boss.w / 2, boss.y + boss.h / 2, boss.w / 2, 0, Math.PI * 2); ctx.fill()
  } else if (bossDef.shape === 'wing') {
    ctx.beginPath(); ctx.ellipse(x + boss.w / 2, boss.y + boss.h / 2, boss.w / 2, boss.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(x - 6, boss.y + boss.h * 0.3, 20, 10, 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(x + boss.w + 6, boss.y + boss.h * 0.3, 20, 10, -0.3, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillRect(x, boss.y, boss.w, boss.h)
  }
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(x + boss.w * 0.5, boss.y + boss.h * 0.3, 5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a2a'
  ctx.beginPath(); ctx.arc(x + boss.w * 0.5, boss.y + boss.h * 0.3, 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  const barW = 140
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(x + boss.w / 2 - barW / 2, boss.y - 18, barW, 8)
  ctx.fillStyle = '#ff5c5c'
  ctx.fillRect(x + boss.w / 2 - barW / 2, boss.y - 18, barW * Math.max(0, boss.hp / boss.maxHp), 8)
}

function drawProjectiles(ctx, state, camX) {
  state.playerShots.forEach(s => {
    ctx.save()
    ctx.shadowColor = s.glow; ctx.shadowBlur = 10
    ctx.fillStyle = s.color
    ctx.fillRect(s.x - camX, s.y, s.w, s.h)
    ctx.restore()
  })
  ctx.fillStyle = '#ff5c5c'
  state.enemyShots.forEach(s => {
    ctx.beginPath(); ctx.arc(s.x - camX, s.y, s.w / 2, 0, Math.PI * 2); ctx.fill()
  })
}

function drawParticles(ctx, particles, camX) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 22)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - camX - 2, pt.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(8,8,16,0.75)'
  ctx.fillRect(0, 0, W, HUD_H)
  const p = state.player
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = '#9dffb0'
  ctx.fillText('ENERGY', 12, 16)
  const barW = 140
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(12, 24, barW, 10)
  const pct = Math.max(0, p.energy / p.maxEnergy)
  ctx.fillStyle = pct > 0.3 ? '#5cff8a' : '#ff5c5c'
  ctx.fillRect(12, 24, barW * pct, 10)

  const weaponDef = WEAPONS[state.equippedWeapon]
  ctx.fillStyle = weaponDef.color
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(weaponDef.name, 170, 16)
  if (state.equippedWeapon !== 'buster') {
    const ammo = state.weaponAmmo[state.equippedWeapon] || 0
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillRect(170, 24, 100, 8)
    ctx.fillStyle = weaponDef.color
    ctx.fillRect(170, 24, 100 * (ammo / WEAPON_AMMO_MAX), 8)
  }

  if (state.bossActive && state.boss && state.boss.alive) {
    ctx.textAlign = 'center'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText('BOSS', W / 2, 16)
  }

  ctx.textAlign = 'right'
  ctx.font = 'bold 12px monospace'
  ctx.fillStyle = '#fff'
  ctx.fillText(`SCORE ${state.score}`, W - 12, 20)
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0) return
  const alpha = Math.min(1, state.messageTimer / 30)
  ctx.globalAlpha = alpha
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillText(state.message, W / 2 + 2, H / 2 + 2)
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(state.message, W / 2, H / 2)
  ctx.globalAlpha = 1
}

export function render(ctx, state) {
  const stage = stageById(state.stageId)
  const theme = THEMES[stage.theme] || THEMES.ember
  const bossDef = bossForStage(state.stageId)
  const camX = state.camX
  ctx.clearRect(0, 0, W, H)
  drawBackground(ctx, theme, camX)
  drawStage(ctx, stage, theme, camX)
  state.enemies.forEach(e => drawEnemy(ctx, e, camX))
  drawBoss(ctx, state.boss, bossDef, camX)
  drawProjectiles(ctx, state, camX)
  const p = state.player
  drawPlayer(ctx, { ...p, x: p.x - camX }, state.equippedWeapon, state.frame)
  drawParticles(ctx, state.particles, camX)
  drawHUD(ctx, state)
  drawMessage(ctx, state)
}
