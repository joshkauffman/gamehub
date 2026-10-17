// ── The Obvious Zelda Knockoff — rendering ────────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, HUD_H, PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, BIOMES, ITEM_DEFS, SWORD_ACTIVE_FRAMES, SWORD_REACH } from './constants.js'
import { WORLDS, PORTALS } from './levels.js'

// A glowing patch over every portal trigger in the current room — the
// only visible hint for where a cave mouth or dungeon doorway actually
// leads, since the tile underneath it looks like ordinary ground.
function drawPortals(ctx, state) {
  const pulse = 0.5 + 0.5 * Math.sin(state.frame * 0.08)
  for (const portal of PORTALS) {
    if (portal.fromWorld !== state.world || portal.fromKey !== state.roomKey) continue
    const cx = PLAY_X0 + (portal.col + 1) * TILE, cy = PLAY_Y0 + portal.row * TILE + TILE / 2
    ctx.save()
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30)
    g.addColorStop(0, `rgba(255,232,160,${0.55 + pulse * 0.3})`)
    g.addColorStop(1, 'rgba(255,232,160,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
}

function drawBackground(ctx, biome) {
  const t = BIOMES[biome] || BIOMES.field
  ctx.fillStyle = t.ground
  ctx.fillRect(0, 0, W, H)
}

function drawTiles(ctx, tiles, biome, frame) {
  const t = BIOMES[biome] || BIOMES.field
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = tiles[r][c]
      const x = PLAY_X0 + c * TILE, y = PLAY_Y0 + r * TILE
      if ((r + c) % 2 === 0) { ctx.fillStyle = t.groundAlt; ctx.fillRect(x, y, TILE, TILE) }
      if (ch === '.') continue
      if (ch === '#') {
        ctx.fillStyle = t.wall
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
      } else if (ch === 'T') {
        ctx.fillStyle = '#5a3a1f'
        ctx.fillRect(x + TILE / 2 - 3, y + TILE / 2, 6, TILE / 2 - 2)
        ctx.fillStyle = '#2a7a28'
        ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE * 0.38, TILE * 0.46, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#3a9a38'
        ctx.beginPath(); ctx.arc(x + TILE / 2 - 6, y + TILE * 0.3, TILE * 0.22, 0, Math.PI * 2); ctx.fill()
      } else if (ch === 'W') {
        const shimmer = 0.5 + 0.5 * Math.sin(frame * 0.05 + c * 0.7 + r)
        ctx.fillStyle = `rgba(60,${130 + shimmer * 40},${210 + shimmer * 30},1)`
        ctx.fillRect(x, y, TILE, TILE)
      } else if (ch === 'B') {
        ctx.fillStyle = '#6a5a4a'
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = '#3a2f24'; ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + TILE / 2, y + TILE / 2); ctx.lineTo(x + TILE - 8, y + 10)
        ctx.moveTo(x + TILE / 2, y + TILE / 2); ctx.lineTo(x + 10, y + TILE - 6)
        ctx.stroke()
      } else if (ch === 'K') {
        ctx.fillStyle = '#5a4a6a'
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
        ctx.fillStyle = '#ffd54a'
        ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2 - 3, 4, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(x + TILE / 2 - 1.5, y + TILE / 2, 3, 7)
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
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawPlayer(ctx, p, frame) {
  ctx.save()
  const flashing = p.invincible > 0 && Math.floor(frame / 4) % 2 === 0
  ctx.globalAlpha = flashing ? 0.45 : 1
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2

  // Original shapes, deliberately shaped to read as "that kind of
  // green-tunic hero" — a cap, a tunic, boots, and a sword that swings
  // in the direction you're facing.
  ctx.fillStyle = '#2a7a3a'
  ctx.fillRect(p.x + 2, p.y + p.h * 0.3, p.w - 4, p.h * 0.55)
  ctx.fillStyle = '#8a5a2a'
  ctx.fillRect(p.x + 2, p.y + p.h * 0.72, p.w - 4, p.h * 0.18)
  // belt buckle
  ctx.fillStyle = '#ffd54a'
  ctx.fillRect(cx - 3, p.y + p.h * 0.74, 6, 6)
  // head + cap
  ctx.fillStyle = '#f2c89a'
  ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.22, p.w * 0.36, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#2a7a3a'
  ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.14, p.w * 0.4, Math.PI, 0); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - p.w * 0.1, p.y + p.h * 0.1)
  ctx.lineTo(cx + (p.facing === 'left' ? -p.w * 0.55 : p.w * 0.1), p.y - p.h * 0.18)
  ctx.lineTo(cx + p.w * 0.2, p.y + p.h * 0.08)
  ctx.closePath(); ctx.fill()
  // eyes hint at facing
  ctx.fillStyle = '#2a1f14'
  const eyeDX = p.facing === 'left' ? -3 : p.facing === 'right' ? 3 : 0
  const eyeDY = p.facing === 'up' ? -2 : p.facing === 'down' ? 2 : 0
  ctx.fillRect(cx - 5 + eyeDX, p.y + p.h * 0.23 + eyeDY, 3, 3)
  ctx.fillRect(cx + 2 + eyeDX, p.y + p.h * 0.23 + eyeDY, 3, 3)
  // boots
  ctx.fillStyle = '#5a3a1f'
  ctx.fillRect(p.x + 2, p.y + p.h - 6, p.w * 0.36, 6)
  ctx.fillRect(p.x + p.w - p.w * 0.36 - 2, p.y + p.h - 6, p.w * 0.36, 6)

  // An actual sword, swept through an arc centered on the facing
  // direction — not just a motion-line flash.
  if (p.swordSwing > 0) {
    const t = 1 - p.swordSwing / SWORD_ACTIVE_FRAMES // 0 at the start of the swing, 1 at the end
    const sweep = (t - 0.5) * Math.PI * 0.95
    const angle = facingAngle(p.facing) + sweep
    const hilt = 6, blade = SWORD_REACH + 12

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    // handle
    ctx.fillStyle = '#5a3a1f'
    ctx.fillRect(0, -2.5, hilt, 5)
    // crossguard
    ctx.fillStyle = '#ffd54a'
    ctx.fillRect(hilt - 2, -5.5, 3, 11)
    // blade
    ctx.fillStyle = '#e8e8f0'
    ctx.fillRect(hilt + 1, -2, blade, 4)
    ctx.beginPath()
    ctx.moveTo(hilt + 1 + blade, -2)
    ctx.lineTo(hilt + 1 + blade + 7, 0)
    ctx.lineTo(hilt + 1 + blade, 2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(hilt + 1, -2, blade, 4)
    ctx.restore()
  }
  ctx.restore()
}

function facingAngle(facing) {
  if (facing === 'right') return 0
  if (facing === 'down') return Math.PI / 2
  if (facing === 'left') return Math.PI
  return -Math.PI / 2 // up
}

function drawEnemy(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2
  const flash = e.hitFlash > 0
  if (e.type === 'blob') {
    ctx.fillStyle = flash ? '#fff' : '#4a6fd8'
    ctx.beginPath(); ctx.ellipse(cx, cy + 3, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(cx - 4, cy, 2.5, 0, Math.PI * 2); ctx.arc(cx + 4, cy, 2.5, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === 'bat') {
    ctx.fillStyle = flash ? '#fff' : '#6a4a7a'
    ctx.beginPath(); ctx.arc(cx, cy, e.w / 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx - 10, cy, 7, 4, 0.3, 0, Math.PI * 2); ctx.ellipse(cx + 10, cy, 7, 4, -0.3, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === 'skeleton') {
    ctx.fillStyle = flash ? '#fff' : '#d8d2c0'
    ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, e.h - 8)
    ctx.fillStyle = '#2a1f14'
    ctx.fillRect(cx - 5, e.y + 8, 3, 3); ctx.fillRect(cx + 2, e.y + 8, 3, 3)
  } else if (e.type === 'pebblefoot') {
    ctx.fillStyle = flash ? '#fff' : '#8a6a4a'
    ctx.beginPath(); ctx.arc(cx, cy, e.w / 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5a4428'
    ctx.beginPath(); ctx.arc(cx, cy, e.w / 2 - 6, 0, Math.PI * 2); ctx.fill()
  }
}

function drawBoss(ctx, b) {
  if (!b) return
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  ctx.save()
  if (b.flash > 0) ctx.globalAlpha = 0.6
  const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, b.w / 2)
  g.addColorStop(0, '#c86bff')
  g.addColorStop(1, '#3a0a4a')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(cx, cy, b.w / 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(cx - 14, cy - 6, 9, 0, Math.PI * 2); ctx.arc(cx + 14, cy - 6, 9, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a0522'
  ctx.beginPath(); ctx.arc(cx - 14, cy - 6, 4, 0, Math.PI * 2); ctx.arc(cx + 14, cy - 6, 4, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  const barW = 140
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(cx - barW / 2, b.y - 18, barW, 8)
  ctx.fillStyle = '#ff5c5c'
  ctx.fillRect(cx - barW / 2, b.y - 18, barW * Math.max(0, b.hp / b.maxHp), 8)
}

function drawProjectiles(ctx, state) {
  if (state.boomerang) {
    const bm = state.boomerang
    ctx.save()
    ctx.translate(bm.x, bm.y)
    ctx.rotate(state.frame * 0.6)
    ctx.fillStyle = '#5bc8ff'
    ctx.fillRect(-8, -2, 16, 4)
    ctx.fillRect(-2, -8, 4, 16)
    ctx.restore()
  }
  ctx.fillStyle = '#c99a5b'
  state.arrows.forEach(a => ctx.fillRect(a.x, a.y, a.w, a.h))
  ctx.fillStyle = '#8a6a4a'
  state.enemyShots.forEach(es => { ctx.beginPath(); ctx.arc(es.x, es.y, es.w / 2, 0, Math.PI * 2); ctx.fill() })
  state.bombs.forEach(bm => {
    const pulse = bm.fuse % 10 < 5
    ctx.fillStyle = pulse ? '#ffe35c' : '#333'
    ctx.beginPath(); ctx.arc(bm.x + bm.w / 2, bm.y + bm.h / 2, bm.w / 2, 0, Math.PI * 2); ctx.fill()
  })
}

function drawParticles(ctx, particles) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 20)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

function drawHearts(ctx, p) {
  const total = p.maxHearts / 2
  for (let i = 0; i < total; i++) {
    const cx = 24 + i * 22, cy = 24
    const filled = p.hearts >= (i + 1) * 2
    const half = !filled && p.hearts > i * 2
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    drawHeartShape(ctx, cx, cy, 9)
    if (filled || half) {
      ctx.save()
      if (half) { ctx.beginPath(); ctx.rect(cx - 10, cy - 10, 10, 20); ctx.clip() }
      ctx.fillStyle = '#ff4d6a'
      drawHeartShape(ctx, cx, cy, 9)
      ctx.restore()
    }
  }
}
function drawHeartShape(ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.8)
  ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.6, cx - r * 0.5, cy - r * 1.3, cx, cy - r * 0.4)
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.3, cx + r * 1.4, cy - r * 0.6, cx, cy + r * 0.8)
  ctx.fill()
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(10,8,5,0.92)'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.moveTo(0, HUD_H); ctx.lineTo(W, HUD_H); ctx.stroke()

  drawHearts(ctx, state.player)

  const p = state.player
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const abilityIcons = [['sword', '🗡'], ['boomerang', '➰'], ['bow', '🏹'], ['bombs', '●']]
  let ax = 230
  abilityIcons.forEach(([key, icon]) => {
    ctx.fillStyle = p.abilities[key] ? '#ffd54a' : 'rgba(255,255,255,0.2)'
    ctx.font = '14px sans-serif'
    ctx.fillText(icon, ax, 28)
    ax += 24
  })
  if (p.smallKeys > 0) {
    ctx.fillStyle = '#ffd54a'
    ctx.font = 'bold 12px monospace'
    ctx.fillText(`KEYS ${p.smallKeys}`, ax + 6, 28)
  }

  ctx.textAlign = 'center'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(state.roomName || '', W / 2, 18)
  ctx.font = '10px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('press M for map', W / 2, 34)

  ctx.textAlign = 'right'
  ctx.font = 'bold 12px monospace'
  ctx.fillStyle = '#fff'
  ctx.fillText(`SCORE ${state.score}`, W - 14, 24)
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0) return
  const alpha = Math.min(1, state.messageTimer / 30)
  ctx.globalAlpha = alpha
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  const pad = 20
  const w = Math.min(W - 40, ctx.measureText(state.message).width + pad * 2)
  ctx.fillStyle = 'rgba(10,8,5,0.85)'
  ctx.fillRect(W / 2 - w / 2, H - 60, w, 32)
  ctx.fillStyle = '#ffd54a'
  ctx.fillText(state.message, W / 2, H - 44)
  ctx.globalAlpha = 1
}

const WORLD_LABELS = { overworld: 'OVERWORLD', cave: 'CAVE', dungeon: 'DUNGEON' }

function drawMap(ctx, state) {
  ctx.fillStyle = 'rgba(2,4,10,0.92)'
  ctx.fillRect(0, 0, W, H)
  const world = WORLDS[state.world]
  const keys = Object.keys(world)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const k of keys) {
    const r = world[k]
    minX = Math.min(minX, r.gx); maxX = Math.max(maxX, r.gx)
    minY = Math.min(minY, r.gy); maxY = Math.max(maxY, r.gy)
  }
  const cell = 70
  const gw = (maxX - minX + 1) * cell, gh = (maxY - minY + 1) * cell
  const ox = W / 2 - gw / 2, oy = H / 2 - gh / 2 + 10

  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.fillText(WORLD_LABELS[state.world] || 'MAP', W / 2, 36)
  ctx.font = '12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('press M to close', W / 2, 56)

  for (const k of keys) {
    const r = world[k]
    const fullKey = `${state.world}:${k}`
    if (!state.visitedRooms.has(fullKey)) continue
    const x = ox + (r.gx - minX) * cell, y = oy + (r.gy - minY) * cell
    const isCurrent = k === state.roomKey
    ctx.fillStyle = isCurrent ? '#5cf0ff' : (r.isBoss ? '#ff5c5c' : 'rgba(157,255,176,0.55)')
    ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8)
    ctx.strokeStyle = isCurrent ? '#fff' : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = isCurrent ? 2 : 1
    ctx.strokeRect(x + 4, y + 4, cell - 8, cell - 8)
    for (const dir of ['up', 'down', 'left', 'right']) {
      const nk = r.neighbors[dir]
      if (!nk || !state.visitedRooms.has(`${state.world}:${nk}`)) continue
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
  drawPortals(ctx, state)
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
