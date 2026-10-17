// ── The Obvious Pokémon Knockoff — rendering ──────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates
// it. The battle move/catch/run buttons are plain DOM, laid out by the
// React component — this file only draws the two creatures, their HP
// bars, and the message box.

import { W, H, HUD_H, PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, BIOMES } from './constants.js'
import { SPECIES } from './creatures.js'
import { WORLDS, PORTALS, TRAINERS, STARTER_ORBS } from './levels.js'

function drawBackground(ctx, biome) {
  const t = BIOMES[biome] || BIOMES.route
  ctx.fillStyle = t.ground
  ctx.fillRect(0, 0, W, H)
}

function drawTiles(ctx, tiles, biome, frame) {
  const t = BIOMES[biome] || BIOMES.route
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = tiles[r][c]
      const x = PLAY_X0 + c * TILE, y = PLAY_Y0 + r * TILE
      if ((r + c) % 2 === 0) { ctx.fillStyle = t.groundAlt; ctx.fillRect(x, y, TILE, TILE) }
      if (ch === '#') {
        ctx.fillStyle = t.wall
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
      } else if (ch === 'G') {
        ctx.fillStyle = '#2f7a2a'
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = '#3f9a38'; ctx.lineWidth = 2
        const sway = Math.sin(frame * 0.08 + c * 1.3 + r) * 2
        for (let i = 0; i < 3; i++) {
          const bx = x + 8 + i * 11
          ctx.beginPath()
          ctx.moveTo(bx, y + TILE - 4)
          ctx.lineTo(bx + sway, y + TILE - 20)
          ctx.stroke()
        }
      } else if (ch === 'H') {
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06)
        ctx.fillStyle = `rgba(255,220,120,${0.3 + pulse * 0.25})`
        ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, 16, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#ffdc78'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, 10, 0, Math.PI * 2); ctx.stroke()
      }
    }
  }
}

function drawPortals(ctx, state) {
  const pulse = 0.5 + 0.5 * Math.sin(state.frame * 0.08)
  for (const portal of PORTALS) {
    if (portal.fromWorld !== state.world || portal.fromKey !== state.roomKey) continue
    const cx = PLAY_X0 + (portal.col + 1) * TILE, cy = PLAY_Y0 + portal.row * TILE + TILE / 2
    ctx.save()
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26)
    g.addColorStop(0, `rgba(255,232,160,${0.5 + pulse * 0.3})`)
    g.addColorStop(1, 'rgba(255,232,160,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
}

function drawTrainers(ctx, state) {
  for (const t of TRAINERS) {
    if (t.world !== state.world || t.roomKey !== state.roomKey) continue
    if (state.defeatedTrainers.has(t.id)) continue
    const x = PLAY_X0 + t.col * TILE, y = PLAY_Y0 + t.row * TILE
    const cx = x + TILE / 2
    ctx.fillStyle = t.isBoss ? '#c23a3a' : '#3a5ac2'
    ctx.fillRect(x + 8, y + 10, TILE - 16, TILE - 14)
    ctx.fillStyle = '#f2c89a'
    ctx.beginPath(); ctx.arc(cx, y + 10, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('!', cx, y - 4)
  }
}

function drawStarterOrbs(ctx, state) {
  if (state.world !== 'lab' || state.starterChosen) return
  for (const orb of STARTER_ORBS) {
    const def = SPECIES[orb.speciesId]
    const cx = PLAY_X0 + orb.col * TILE + TILE / 2, cy = PLAY_Y0 + orb.row * TILE + TILE / 2 + Math.sin(state.frame * 0.08) * 4
    ctx.save()
    ctx.shadowColor = def.color
    ctx.shadowBlur = 14
    ctx.fillStyle = def.color
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(def.name, cx, cy + 28)
  }
}

function drawPlayer(ctx, p) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  ctx.fillStyle = '#d83a5a'
  ctx.fillRect(p.x + 2, p.y + p.h * 0.3, p.w - 4, p.h * 0.55)
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(p.x + 2, p.y + p.h * 0.72, p.w - 4, p.h * 0.18)
  ctx.fillStyle = '#f2c89a'
  ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.22, p.w * 0.36, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#5a3a2a'
  ctx.beginPath(); ctx.arc(cx, p.y + p.h * 0.1, p.w * 0.38, Math.PI, 0); ctx.fill()
  ctx.fillStyle = '#2a1f14'
  const eyeDX = p.facing === 'left' ? -3 : p.facing === 'right' ? 3 : 0
  const eyeDY = p.facing === 'up' ? -2 : p.facing === 'down' ? 2 : 0
  ctx.fillRect(cx - 5 + eyeDX, p.y + p.h * 0.23 + eyeDY, 3, 3)
  ctx.fillRect(cx + 2 + eyeDX, p.y + p.h * 0.23 + eyeDY, 3, 3)
  ctx.fillStyle = '#3a2a1f'
  ctx.fillRect(p.x + 2, p.y + p.h - 6, p.w * 0.36, 6)
  ctx.fillRect(p.x + p.w - p.w * 0.36 - 2, p.y + p.h - 6, p.w * 0.36, 6)
}

const WORLD_LABELS = { overworld: 'OVERWORLD', lab: 'LAB', gym: 'GYM', cave: 'DUSK CAVE' }

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
    ctx.fillStyle = isCurrent ? '#5cf0ff' : 'rgba(157,255,176,0.55)'
    ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8)
    ctx.strokeStyle = isCurrent ? '#fff' : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = isCurrent ? 2 : 1
    ctx.strokeRect(x + 4, y + 4, cell - 8, cell - 8)
  }
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(10,8,5,0.92)'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.moveTo(0, HUD_H); ctx.lineTo(W, HUD_H); ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 12px monospace'
  ctx.fillStyle = '#ffd54a'
  ctx.fillText(`PARTY ${state.party.length}/3`, 16, 20)
  ctx.font = '11px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const names = state.party.map(c => SPECIES[c.speciesId].name.split(' ')[0]).join(', ') || '—'
  ctx.fillText(names, 16, 38)

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

// ── Battle scene ────────────────────────────────────────────────────

function drawCreatureBlob(ctx, cx, cy, def, size, frame) {
  const bob = Math.sin(frame * 0.07) * 3
  ctx.save()
  ctx.translate(cx, cy + bob)
  ctx.fillStyle = def.color
  if (def.shape === 'square') {
    ctx.beginPath()
    ctx.moveTo(-size, -size * 0.7)
    ctx.lineTo(size, -size * 0.7)
    ctx.lineTo(size, size * 0.8)
    ctx.lineTo(-size, size * 0.8)
    ctx.closePath()
    ctx.fill()
  } else if (def.shape === 'wing') {
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.7, size * 0.6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(-size * 0.9, -size * 0.1, size * 0.5, size * 0.3, 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(size * 0.9, -size * 0.1, size * 0.5, size * 0.3, -0.4, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.beginPath(); ctx.arc(-size * 0.28, -size * 0.1, size * 0.1, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(size * 0.28, -size * 0.1, size * 0.1, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawHpBar(ctx, x, y, w, hp, maxHp, name) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x, y, w, 36)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 35)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(name, x + 8, y + 16)
  const pct = Math.max(0, hp / maxHp)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(x + 8, y + 22, w - 16, 8)
  ctx.fillStyle = pct > 0.5 ? '#5cff8a' : pct > 0.2 ? '#ffd54a' : '#ff5c5c'
  ctx.fillRect(x + 8, y + 22, (w - 16) * pct, 8)
}

export function drawBattle(ctx, state) {
  const b = state.battle
  if (!b) return
  const t = BIOMES.route
  const g = ctx.createLinearGradient(0, HUD_H, 0, H)
  g.addColorStop(0, '#bfe4ff')
  g.addColorStop(1, t.ground)
  ctx.fillStyle = g
  ctx.fillRect(0, HUD_H, W, H - HUD_H)

  const enemyDef = SPECIES[b.enemy.speciesId]
  drawCreatureBlob(ctx, W * 0.72, 210, enemyDef, 44, state.frame)
  drawHpBar(ctx, W * 0.56, 120, 260, b.enemy.hp, b.enemy.maxHp, b.kind === 'trainer' ? `${b.trainerName}'s ${enemyDef.name}` : enemyDef.name)

  const playerCreature = state.party[b.activeIndex]
  if (playerCreature) {
    const playerDef = SPECIES[playerCreature.speciesId]
    drawCreatureBlob(ctx, W * 0.26, 310, playerDef, 50, state.frame)
    drawHpBar(ctx, W * 0.1, 362, 260, playerCreature.hp, playerCreature.maxHp, playerDef.name)
  }

  // message box
  const boxY = H - 120
  ctx.fillStyle = 'rgba(10,8,5,0.92)'
  ctx.fillRect(20, boxY, W - 40, 100)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.strokeRect(20.5, boxY + 0.5, W - 41, 99)
  if (b.log.length > 0) {
    ctx.fillStyle = '#fff'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(b.log[0], 40, boxY + 40)
  }
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, W, H)
  if (state.mode === 'battle') {
    drawBattle(ctx, state)
  } else {
    drawBackground(ctx, state.biome)
    drawTiles(ctx, state.tiles, state.biome, state.frame)
    drawPortals(ctx, state)
    drawStarterOrbs(ctx, state)
    drawTrainers(ctx, state)
    drawPlayer(ctx, state.player)
  }
  drawHUD(ctx, state)
  if (state.mode !== 'battle') drawMessage(ctx, state)
  if (state.mapOpen) drawMap(ctx, state)
}
