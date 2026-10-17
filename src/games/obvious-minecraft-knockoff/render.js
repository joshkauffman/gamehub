// ── The Obvious Minecraft Knockoff — canvas rendering ──────────────────
// Pure drawing: reads state only. Everything is procedurally drawn
// shapes — no sprites or copied assets.

import {
  W, H, HUD_H, PLAY_Y0, TILE, WORLD_COLS, WORLD_ROWS, BLOCKS, ITEM_META,
  HOTBAR_SIZE, RECIPES, PLAYER_MAX_HP, REACH,
} from './constants.js'
import { isNight, dayProgress, currentHotbarItem } from './engine.js'

export function cameraFor(state) {
  const p = state.player
  let camX = p.x + p.w / 2 - W / 2
  let camY = p.y + p.h / 2 - (H - HUD_H) / 2
  camX = Math.max(0, Math.min(WORLD_COLS * TILE - W, camX))
  camY = Math.max(0, Math.min(WORLD_ROWS * TILE - (H - HUD_H), camY))
  return { x: camX, y: camY }
}

function skyColors(state) {
  const t = dayProgress(state) // 0..1, 0=dawn start of day .. DAY..NIGHT..wraps
  const night = isNight(state)
  if (!night) {
    return { top: '#5fb3e8', bottom: '#bfe6f5' }
  }
  return { top: '#0a0e2a', bottom: '#1c2550' }
}

function drawBlock(ctx, screenX, screenY, block, speck) {
  ctx.fillStyle = block.color
  ctx.fillRect(screenX, screenY, TILE, TILE)
  if (block.topColor) {
    ctx.fillStyle = block.topColor
    ctx.fillRect(screenX, screenY, TILE, 5)
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(screenX + 0.5, screenY + 0.5, TILE - 1, TILE - 1)
  if (speck) {
    ctx.fillStyle = speck
    const cx = screenX + TILE / 2, cy = screenY + TILE / 2
    ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 2.6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 4, cy + 4, 2.2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 2, cy - 5, 1.8, 0, Math.PI * 2); ctx.fill()
  }
}

function drawTerrain(ctx, state, cam) {
  const c0 = Math.max(0, Math.floor(cam.x / TILE))
  const c1 = Math.min(WORLD_COLS - 1, Math.ceil((cam.x + W) / TILE))
  const r0 = Math.max(0, Math.floor(cam.y / TILE))
  const r1 = Math.min(WORLD_ROWS - 1, Math.ceil((cam.y + (H - HUD_H)) / TILE))
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const id = state.tiles[r][c]
      if (id === 'air') continue
      const block = BLOCKS[id]
      const sx = c * TILE - cam.x, sy = PLAY_Y0 + r * TILE - cam.y
      drawBlock(ctx, sx, sy, block, block.speck)
    }
  }
}

function drawMiningOverlay(ctx, state, cam) {
  if (!state.mining) return
  const sx = state.mining.col * TILE - cam.x, sy = PLAY_Y0 + state.mining.row * TILE - cam.y
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2)
  const pct = Math.min(1, state.mining.progress / Math.max(0.001, state.mining.need))
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillRect(sx + 2, sy + TILE - 5, (TILE - 4), 3)
  ctx.fillStyle = '#2fbf4a'
  ctx.fillRect(sx + 2, sy + TILE - 5, (TILE - 4) * pct, 3)
}

function drawPlayer(ctx, state, cam) {
  const p = state.player
  const sx = p.x - cam.x, sy = p.y - cam.y
  const flicker = p.invulnTimer > 0 && Math.floor(p.invulnTimer / 4) % 2 === 0
  ctx.save()
  if (flicker) ctx.globalAlpha = 0.4
  ctx.fillStyle = '#3a6ea8'
  ctx.fillRect(sx, sy + 10, p.w, p.h - 10)
  ctx.fillStyle = '#e8b48a'
  ctx.fillRect(sx + 2, sy, p.w - 4, 12)
  ctx.fillStyle = '#2a2f3a'
  const eyeX = p.facing > 0 ? sx + p.w - 6 : sx + 3
  ctx.fillRect(eyeX, sy + 4, 3, 3)
  // held item
  const item = currentHotbarItem(state)
  if (item) {
    const meta = ITEM_META[item]
    const hx = p.facing > 0 ? sx + p.w : sx - 6
    drawHeldItem(ctx, hx, sy + 16, item, meta)
  }
  ctx.restore()
}

function drawHeldItem(ctx, x, y, item, meta) {
  if (!meta) return
  if (meta.shape === 'pickaxe') {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + 6, y); ctx.stroke()
    ctx.strokeStyle = meta.head; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 10, y + 2); ctx.stroke()
  } else if (meta.shape === 'sword') {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + 3, y + 4); ctx.stroke()
    ctx.strokeStyle = meta.blade; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 8, y - 6); ctx.stroke()
  } else {
    ctx.fillStyle = meta.color
    ctx.fillRect(x, y, 8, 8)
  }
}

function drawEnemies(ctx, state, cam) {
  for (const en of state.enemies) {
    const sx = en.x - cam.x, sy = en.y - cam.y
    ctx.fillStyle = '#3a6a3a'
    ctx.fillRect(sx, sy, en.w, en.h)
    ctx.fillStyle = '#1a2a1a'
    ctx.fillRect(sx + 3, sy + 4, en.w - 6, 5)
    // hp bar
    const pct = Math.max(0, en.hp / 6)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(sx, sy - 7, en.w, 4)
    ctx.fillStyle = '#e8503a'
    ctx.fillRect(sx, sy - 7, en.w * pct, 4)
  }
}

function drawCrosshair(ctx, aim, cam, inReach) {
  if (!aim) return
  const x = aim.x - cam.x, y = aim.y - cam.y
  ctx.strokeStyle = inReach ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y)
  ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7)
  ctx.stroke()
}

function drawItemIcon(ctx, x, y, size, item) {
  const block = BLOCKS[item]
  const meta = ITEM_META[item]
  if (block) {
    ctx.fillStyle = block.color
    ctx.fillRect(x, y, size, size)
    if (block.topColor) { ctx.fillStyle = block.topColor; ctx.fillRect(x, y, size, 3) }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1)
    return
  }
  if (!meta) return
  ctx.save()
  ctx.translate(x + size / 2, y + size / 2)
  if (meta.shape === 'stick') {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, -8); ctx.stroke()
  } else if (meta.shape === 'lump') {
    ctx.fillStyle = meta.color
    ctx.beginPath(); ctx.arc(0, 0, size / 2 - 3, 0, Math.PI * 2); ctx.fill()
    if (meta.speck) { ctx.fillStyle = meta.speck; ctx.beginPath(); ctx.arc(-3, -2, 2, 0, Math.PI * 2); ctx.fill() }
  } else if (meta.shape === 'ingot') {
    ctx.fillStyle = meta.color
    ctx.fillRect(-9, -5, 18, 10)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(-9, -5, 18, 10)
  } else if (meta.shape === 'gem') {
    ctx.fillStyle = meta.color
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 0); ctx.lineTo(0, 9); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill()
  } else if (meta.shape === 'pickaxe') {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(2, -3); ctx.stroke()
    ctx.strokeStyle = meta.head; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(8, 2); ctx.stroke()
  } else if (meta.shape === 'sword') {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(0, 3); ctx.stroke()
    ctx.strokeStyle = meta.blade; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(7, -9); ctx.stroke()
  } else {
    ctx.fillStyle = meta.color
    ctx.fillRect(-8, -8, 16, 16)
  }
  ctx.restore()
}

function drawHUD(ctx, state) {
  ctx.fillStyle = '#14171f'
  ctx.fillRect(0, 0, W, HUD_H)

  // Health hearts
  const p = state.player
  for (let i = 0; i < PLAYER_MAX_HP; i++) {
    const full = i < p.hp
    ctx.fillStyle = full ? '#e8503a' : '#3a2a28'
    const hx = 10 + i * 14, hy = 8
    ctx.beginPath()
    ctx.moveTo(hx + 4, hy + 2)
    ctx.bezierCurveTo(hx, hy - 2, hx - 5, hy + 4, hx + 4, hy + 11)
    ctx.bezierCurveTo(hx + 13, hy + 4, hx + 8, hy - 2, hx + 4, hy + 2)
    ctx.fill()
  }

  // Hotbar
  const slotSize = 40, gap = 4
  const totalW = HOTBAR_SIZE * (slotSize + gap) - gap
  const startX = W / 2 - totalW / 2
  const y = HUD_H - slotSize - 4
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const x = startX + i * (slotSize + gap)
    ctx.fillStyle = i === state.selectedSlot ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'
    ctx.fillRect(x, y, slotSize, slotSize)
    ctx.strokeStyle = i === state.selectedSlot ? '#fff' : 'rgba(255,255,255,0.25)'
    ctx.lineWidth = i === state.selectedSlot ? 2 : 1
    ctx.strokeRect(x + 0.5, y + 0.5, slotSize - 1, slotSize - 1)
    const slot = state.inventory[i]
    if (slot) {
      drawItemIcon(ctx, x + 6, y + 6, slotSize - 12, slot.item)
      ctx.fillStyle = '#fff'
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(String(slot.count), x + slotSize - 3, y + slotSize - 3)
      ctx.textAlign = 'left'
    }
  }

  // Day/night indicator
  ctx.fillStyle = '#ccc'
  ctx.font = '12px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(isNight(state) ? 'Night' : 'Day', W - 10, 16)
  ctx.textAlign = 'left'
}

function drawToast(ctx, state) {
  if (!state.toast) return
  const alpha = Math.min(1, state.toast.timer / 30)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const textW = ctx.measureText(state.toast.text).width
  ctx.fillStyle = 'rgba(10,12,18,0.85)'
  ctx.fillRect(W / 2 - textW / 2 - 14, PLAY_Y0 + 14, textW + 28, 28)
  ctx.fillStyle = '#ffe9a8'
  ctx.fillText(state.toast.text, W / 2, PLAY_Y0 + 33)
  ctx.restore()
  ctx.textAlign = 'left'
}

function craftableNow(state, recipe) {
  if (recipe.needsFurnace) {
    // visual hint only; actual gate is enforced by craftItem()
  }
  for (const inp of recipe.inputs) {
    const have = state.inventory.reduce((n, s) => n + (s && s.item === inp.item ? s.count : 0), 0)
    if (have < inp.count) return false
  }
  return true
}

export function drawCraftingPanel(ctx, state) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)
  const panelW = 560, panelH = 440
  const px = W / 2 - panelW / 2, py = H / 2 - panelH / 2
  ctx.fillStyle = '#1b1e28'
  ctx.fillRect(px, py, panelW, panelH)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1)
  ctx.fillStyle = '#fff'
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText('Crafting  (press C to close)', px + 16, py + 28)

  const rowH = 34
  RECIPES.forEach((r, i) => {
    const ry = py + 46 + i * rowH
    const ok = craftableNow(state, r)
    ctx.fillStyle = ok ? 'rgba(80,200,120,0.12)' : 'rgba(255,255,255,0.04)'
    ctx.fillRect(px + 12, ry, panelW - 24, rowH - 4)
    ctx.fillStyle = ok ? '#fff' : 'rgba(255,255,255,0.4)'
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.fillText(r.label, px + 20, ry + 20)
    const costText = r.inputs.map(inp => `${inp.count} ${ITEM_META[inp.item]?.label || BLOCKS[inp.item]?.id}`).join(' + ')
      + (r.needsFurnace ? '  (near furnace)' : '')
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)'
    ctx.fillText(costText, px + 230, ry + 20)
  })
  ctx.restore()
}

export function renderGame(ctx, state, aim) {
  const cam = cameraFor(state)
  const sky = skyColors(state)
  const grad = ctx.createLinearGradient(0, PLAY_Y0, 0, H)
  grad.addColorStop(0, sky.top); grad.addColorStop(1, sky.bottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, PLAY_Y0, W, H - PLAY_Y0)

  drawTerrain(ctx, state, cam)
  drawEnemies(ctx, state, cam)
  drawPlayer(ctx, state, cam)
  drawMiningOverlay(ctx, state, cam)

  if (isNight(state)) {
    ctx.fillStyle = 'rgba(10,10,30,0.28)'
    ctx.fillRect(0, PLAY_Y0, W, H - PLAY_Y0)
  }

  let inReach = false
  if (aim) {
    const p = state.player
    inReach = Math.hypot((p.x + p.w / 2) - aim.x, (p.y + p.h / 2) - aim.y) <= REACH
  }
  drawCrosshair(ctx, aim ? { x: aim.x, y: aim.y } : null, cam, inReach)

  drawHUD(ctx, state)
  drawToast(ctx, state)

  if (state.uiPanel === 'craft') drawCraftingPanel(ctx, state)
}
