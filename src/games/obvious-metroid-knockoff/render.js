// ── The Obvious Metroid Knockoff — rendering ──────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, HUD_H, PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, BIOMES, ITEM_DEFS, GUN_HEIGHT_FRAC } from './constants.js'
import { WORLD } from './levels.js'

function drawBackground(ctx, biome) {
  const t = BIOMES[biome] || BIOMES.caves
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, t.sky[0])
  g.addColorStop(1, t.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function tileColor(ch, biome) {
  const t = BIOMES[biome] || BIOMES.caves
  if (ch === '#') return t.wall
  if (ch === 'B') return '#8a6a3a'
  if (ch === 'K') return '#5a3a7a'
  if (ch === 'D') return '#2a5a8a'
  if (ch === 'L') return '#c23a1a'
  return null
}

function drawTiles(ctx, tiles, biome, frame) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = tiles[r][c]
      if (ch === '.') continue
      const x = PLAY_X0 + c * TILE, y = PLAY_Y0 + r * TILE
      const color = tileColor(ch, biome)
      ctx.fillStyle = color
      ctx.fillRect(x, y, TILE, TILE)
      if (ch === '#') {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
      } else if (ch === 'B') {
        ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + TILE / 2, y + TILE / 2)
        ctx.lineTo(x + TILE - 8, y + 10); ctx.moveTo(x + TILE / 2, y + TILE / 2)
        ctx.lineTo(x + 10, y + TILE - 6)
        ctx.stroke()
      } else if (ch === 'K') {
        ctx.fillStyle = '#ffb85c'
        ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2); ctx.fill()
      } else if (ch === 'D') {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(x + 4, y + TILE / 2 + i * 10); ctx.lineTo(x + TILE - 4, y + TILE / 2 + i * 10); ctx.stroke()
        }
      } else if (ch === 'L') {
        const glow = 0.5 + 0.5 * Math.sin(frame * 0.1 + c)
        ctx.fillStyle = `rgba(255,${160 + glow * 60},60,${0.5 + glow * 0.3})`
        ctx.fillRect(x, y, TILE, 6)
      }
    }
  }
}

function drawItem(ctx, item, frame) {
  const def = ITEM_DEFS[item.type]
  const bobY = Math.sin(frame * 0.08 + item.bob) * 4
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2 + bobY
  ctx.save()
  ctx.shadowColor = def.color
  ctx.shadowBlur = 12
  ctx.fillStyle = def.color
  ctx.beginPath()
  ctx.arc(cx, cy, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPlayer(ctx, p, frame) {
  ctx.save()
  const flashing = p.invincible > 0 && Math.floor(frame / 4) % 2 === 0
  ctx.globalAlpha = flashing ? 0.45 : 1
  const cx = p.x + p.w / 2
  if (p.morphed) {
    const r = p.w / 2
    const cy = p.y + p.h / 2
    ctx.fillStyle = '#e8661f'
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#7a2d0a'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#ffd54a'
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a0f04'
    ctx.beginPath(); ctx.arc(cx + p.facing * r * 0.3, cy, 2.5, 0, Math.PI * 2); ctx.fill()
  } else {
    // An iconic silhouette, drawn from scratch: a chunky orange-and-red
    // power suit, gold shoulder pauldrons, a domed visor helmet, and a
    // big arm cannon — original shapes, no sprite or copied asset, but
    // deliberately shaped to read instantly as "that kind of hunter".
    const suit = '#e8661f', suitDark = '#a8431a', suitShade = '#7a2d0a'
    const gold = '#ffcf4a', visor = '#5bffb0'
    const gunY = p.y + p.h * GUN_HEIGHT_FRAC

    // legs / boots
    ctx.fillStyle = suitDark
    ctx.fillRect(p.x + 1, p.y + p.h - 13, p.w * 0.4, 13)
    ctx.fillRect(p.x + p.w - p.w * 0.4 - 1, p.y + p.h - 13, p.w * 0.4, 13)

    // torso
    ctx.fillStyle = suit
    ctx.fillRect(p.x, p.y + p.h * 0.3, p.w, p.h * 0.46)
    ctx.fillStyle = suitShade
    ctx.fillRect(p.x, p.y + p.h * 0.64, p.w, p.h * 0.1)

    // shoulder pauldrons — big, rounded, the single most Metroid-ish
    // silhouette cue
    ctx.fillStyle = gold
    ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + p.h * 0.36, p.w * 0.34, p.h * 0.14, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(p.x + p.w - 1, p.y + p.h * 0.36, p.w * 0.34, p.h * 0.14, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = suitDark
    ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + p.h * 0.36, p.w * 0.17, p.h * 0.07, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(p.x + p.w - 1, p.y + p.h * 0.36, p.w * 0.17, p.h * 0.07, 0, 0, Math.PI * 2); ctx.fill()

    // domed helmet with a visor stripe
    ctx.fillStyle = '#f4e8c8'
    ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.17, p.w * 0.5, Math.PI, 0); ctx.fill()
    ctx.fillRect(cx - p.w * 0.5, p.y + p.h * 0.17, p.w, p.h * 0.1)
    ctx.fillStyle = visor
    ctx.beginPath(); ctx.ellipse(cx + p.facing * 2, p.y + p.h * 0.2, p.w * 0.34, p.h * 0.065, 0, 0, Math.PI * 2); ctx.fill()

    // arm cannon — a cylinder with a tip knob, anchored at the same
    // height shots actually spawn from
    ctx.fillStyle = '#d8d8e4'
    const gunLen = 17, gunW = 10
    ctx.fillRect(p.facing > 0 ? p.x + p.w - 3 : p.x + 3 - gunLen, gunY - gunW / 2, gunLen, gunW)
    ctx.fillStyle = '#8a8a9a'
    ctx.beginPath()
    ctx.arc(p.facing > 0 ? p.x + p.w - 3 + gunLen : p.x + 3 - gunLen, gunY, gunW * 0.55, 0, Math.PI * 2)
    ctx.fill()

    // off-hand shoulder/arm stub on the non-cannon side
    ctx.fillStyle = suitDark
    ctx.fillRect(p.facing > 0 ? p.x - 2 : p.x + p.w - 6, p.y + p.h * 0.4, 8, p.h * 0.16)
  }
  ctx.restore()
}

function drawEnemy(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2
  const flash = e.hitFlash > 0
  if (e.type === 'crawler') {
    ctx.fillStyle = flash ? '#fff' : '#d9534f'
    ctx.beginPath(); ctx.ellipse(cx, cy, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a0a08'
    ctx.beginPath(); ctx.arc(e.vx > 0 ? cx + 4 : cx - 4, cy - 4, 2.5, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === 'drifter') {
    ctx.fillStyle = flash ? '#fff' : '#b16bff'
    ctx.beginPath(); ctx.arc(cx, cy, e.w / 2, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, e.w / 2 + 4, 0, Math.PI * 2); ctx.stroke()
  } else if (e.type === 'turret') {
    ctx.fillStyle = flash ? '#fff' : '#6a6a7a'
    ctx.fillRect(e.x, e.y, e.w, e.h)
    ctx.fillStyle = '#ff5c5c'
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()
  }
}

function drawBoss(ctx, b) {
  if (!b) return
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  ctx.save()
  if (b.flash > 0) ctx.globalAlpha = 0.6
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, b.w / 2)
  g.addColorStop(0, '#ff8a8a')
  g.addColorStop(1, '#4a0a0a')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(cx, cy, b.w / 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.3, b.h * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a0505'
  ctx.beginPath(); ctx.arc(cx, cy, b.w * 0.14, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // HP bar
  const barW = 140
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(cx - barW / 2, b.y - 18, barW, 8)
  ctx.fillStyle = '#ff5c5c'
  ctx.fillRect(cx - barW / 2, b.y - 18, barW * Math.max(0, b.hp / b.maxHp), 8)
}

function drawProjectiles(ctx, state) {
  ctx.fillStyle = '#9dffb0'
  state.beams.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h))
  ctx.fillStyle = '#ffb85c'
  state.missiles.forEach(m => { ctx.beginPath(); ctx.ellipse(m.x + m.w / 2, m.y + m.h / 2, m.w / 2, m.h / 2, 0, 0, Math.PI * 2); ctx.fill() })
  ctx.fillStyle = '#ff8a3d'
  state.enemyShots.forEach(es => { ctx.beginPath(); ctx.arc(es.x, es.y, es.w / 2, 0, Math.PI * 2); ctx.fill() })
  state.bombs.forEach(bm => {
    const pulse = bm.fuse % 10 < 5
    ctx.fillStyle = pulse ? '#ffe35c' : '#8a6a1a'
    ctx.beginPath(); ctx.arc(bm.x + bm.w / 2, bm.y + bm.h / 2, bm.w / 2, 0, Math.PI * 2); ctx.fill()
  })
}

function drawParticles(ctx, particles) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 22)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(5,8,16,0.92)'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.moveTo(0, HUD_H); ctx.lineTo(W, HUD_H); ctx.stroke()

  const p = state.player
  ctx.font = 'bold 12px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#9dffb0'
  ctx.textAlign = 'left'
  ctx.fillText('ENERGY', 14, 20)
  const barW = 150, barX = 14, barY = 30
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(barX, barY, barW, 12)
  const pct = Math.max(0, p.energy / p.maxEnergy)
  ctx.fillStyle = pct > 0.3 ? '#5cff8a' : '#ff5c5c'
  ctx.fillRect(barX, barY, barW * pct, 12)
  ctx.fillStyle = '#fff'
  ctx.font = '11px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.ceil(p.energy)}/${p.maxEnergy}`, barX + barW / 2, barY + 6)

  ctx.textAlign = 'left'
  ctx.font = 'bold 12px monospace'
  ctx.fillStyle = '#ffb85c'
  const missileText = p.abilities.missiles ? `MISSILES ${p.missilesCount}/${p.maxMissiles}` : 'MISSILES —'
  ctx.fillText(missileText, 190, 20)

  const abilityIcons = [
    ['morph', '◎'], ['bombs', '✺'], ['highJump', '▲'], ['speedBooster', '»'], ['thermal', '◆'],
  ]
  let ax = 190
  ctx.font = '13px monospace'
  abilityIcons.forEach(([key, icon]) => {
    ctx.fillStyle = p.abilities[key] ? '#5cf0ff' : 'rgba(255,255,255,0.2)'
    ctx.fillText(icon, ax, 36)
    ax += 20
  })

  ctx.textAlign = 'center'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(state.roomName || '', W / 2, 20)
  ctx.font = '11px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('press M for map', W / 2, 38)

  ctx.textAlign = 'right'
  ctx.font = 'bold 12px monospace'
  ctx.fillStyle = '#fff'
  ctx.fillText(`SCORE ${state.score}`, W - 14, 24)
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0) return
  const alpha = Math.min(1, state.messageTimer / 30)
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(5,8,16,0.85)'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  const pad = 20
  const w = Math.min(W - 40, ctx.measureText(state.message).width + pad * 2)
  ctx.fillRect(W / 2 - w / 2, H - 70, w, 34)
  ctx.fillStyle = '#9dffb0'
  ctx.fillText(state.message, W / 2, H - 53)
  ctx.globalAlpha = 1
}

function drawMap(ctx, state) {
  ctx.fillStyle = 'rgba(2,4,10,0.92)'
  ctx.fillRect(0, 0, W, H)
  const keys = Object.keys(WORLD)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const k of keys) {
    const r = WORLD[k]
    minX = Math.min(minX, r.gx); maxX = Math.max(maxX, r.gx)
    minY = Math.min(minY, r.gy); maxY = Math.max(maxY, r.gy)
  }
  const cell = 70
  const gw = (maxX - minX + 1) * cell, gh = (maxY - minY + 1) * cell
  const ox = W / 2 - gw / 2, oy = H / 2 - gh / 2 + 10

  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.fillText('MAP', W / 2, 36)
  ctx.font = '12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('press M to close', W / 2, 56)

  for (const k of keys) {
    const r = WORLD[k]
    if (!state.visitedRooms.has(k)) continue
    const x = ox + (r.gx - minX) * cell, y = oy + (r.gy - minY) * cell
    const isCurrent = k === state.roomKey
    ctx.fillStyle = isCurrent ? '#5cf0ff' : (r.isBoss ? '#ff5c5c' : 'rgba(157,255,176,0.55)')
    ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8)
    ctx.strokeStyle = isCurrent ? '#fff' : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = isCurrent ? 2 : 1
    ctx.strokeRect(x + 4, y + 4, cell - 8, cell - 8)
    for (const dir of ['up', 'down', 'left', 'right']) {
      const nk = r.neighbors[dir]
      if (!nk || !state.visitedRooms.has(nk)) continue
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 3
      ctx.beginPath()
      if (dir === 'up') { ctx.moveTo(x + cell / 2, y + 4); ctx.lineTo(x + cell / 2, y - 4) }
      if (dir === 'down') { ctx.moveTo(x + cell / 2, y + cell - 4); ctx.lineTo(x + cell / 2, y + cell + 4) }
      if (dir === 'left') { ctx.moveTo(x + 4, y + cell / 2); ctx.lineTo(x - 4, y + cell / 2) }
      if (dir === 'right') { ctx.moveTo(x + cell - 4, y + cell / 2); ctx.lineTo(x + cell + 4, y + cell / 2) }
      ctx.stroke()
    }
    if (r.isBoss) {
      ctx.font = '16px sans-serif'
      ctx.fillStyle = '#fff'
      ctx.fillText('☠', x + cell / 2, y + cell / 2 + 6)
    }
  }
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, W, H)
  drawBackground(ctx, state.biome)
  drawTiles(ctx, state.tiles, state.biome, state.frame)
  state.items.forEach(it => drawItem(ctx, it, state.frame))
  state.enemies.forEach(e => drawEnemy(ctx, e))
  drawBoss(ctx, state.boss)
  drawProjectiles(ctx, state)
  drawPlayer(ctx, state.player, state.frame)
  drawParticles(ctx, state.particles)
  drawHUD(ctx, state)
  drawMessage(ctx, state)
  if (state.mapOpen) drawMap(ctx, state)
}
