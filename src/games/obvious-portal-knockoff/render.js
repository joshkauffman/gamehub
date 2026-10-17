// ── The Obvious Portal Knockoff — canvas rendering ────────────────────
// Pure drawing: reads state only, no mutation. Everything is
// procedurally drawn shapes — no sprites or copied assets.

import { W, H, HUD_H, PLAY_Y0, TILE, COLS, ROWS } from './constants.js'
import { chamberById } from './levels.js'

function cellRect(row, col) { return { x: col * TILE, y: PLAY_Y0 + row * TILE, w: TILE, h: TILE } }

function drawTiles(ctx, state) {
  const chamber = chamberById(state.chamberId)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = state.tiles[r][c]
      if (ch === '.') continue
      const { x, y } = cellRect(r, c)
      if (ch === 'D') {
        const id = chamber.doors.find(d => d.cells.some(([dr, dc]) => dr === r && dc === c))?.id
        const open = id && state.openDoors.has(id)
        ctx.fillStyle = open ? 'rgba(90,200,255,0.18)' : '#2a3140'
        ctx.fillRect(x, y, TILE, TILE)
        if (!open) {
          ctx.strokeStyle = '#ffb347'
          ctx.lineWidth = 2
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6)
        }
        continue
      }
      ctx.fillStyle = ch === 'P' ? '#d8dde6' : '#454c5c'
      ctx.fillRect(x, y, TILE, TILE)
      ctx.strokeStyle = ch === 'P' ? '#aab2c2' : '#30353f'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
      if (ch === 'P') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(x + 6, y + 6, TILE - 12, 4)
      }
    }
  }
}

function drawButtonsAndGoal(ctx, state) {
  const chamber = chamberById(state.chamberId)
  for (const btn of chamber.buttons) {
    const { x, y } = cellRect(btn.row, btn.col)
    const pressed = state.openDoors.has(btn.doorId)
    ctx.fillStyle = pressed ? '#ff8a3d' : '#c44a1f'
    ctx.beginPath()
    ctx.ellipse(x + TILE / 2, y + TILE - 6, TILE / 2 - 4, 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const g = chamber.goal
  const { x, y } = cellRect(g.row, g.col)
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220)
  ctx.save()
  ctx.globalAlpha = 0.5 + pulse * 0.4
  ctx.fillStyle = '#7CFC9A'
  ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8)
  ctx.restore()
  ctx.strokeStyle = '#2fae5a'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8)
}

function drawPortal(ctx, portal, color) {
  if (!portal) return
  const cx = portal.col * TILE + TILE / 2
  const cy = PLAY_Y0 + portal.row * TILE + TILE / 2
  const horizontal = portal.normal.y !== 0
  const rx = horizontal ? TILE / 2 - 3 : 7
  const ry = horizontal ? 7 : TILE / 2 - 3
  ctx.save()
  const glow = 0.6 + 0.4 * Math.sin(Date.now() / 180)
  ctx.shadowColor = color === 'blue' ? '#4ab8ff' : '#ff9a3d'
  ctx.shadowBlur = 14 * glow
  ctx.fillStyle = color === 'blue' ? '#1fa3ff' : '#ff7a1f'
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = color === 'blue' ? '#bfe8ff' : '#ffd9b0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function drawCube(ctx, cube) {
  ctx.fillStyle = '#e8b84a'
  ctx.fillRect(cube.x, cube.y, cube.w, cube.h)
  ctx.strokeStyle = '#8a6a1f'
  ctx.lineWidth = 2
  ctx.strokeRect(cube.x + 1, cube.y + 1, cube.w - 2, cube.h - 2)
  ctx.beginPath()
  ctx.moveTo(cube.x + 4, cube.y + 4); ctx.lineTo(cube.x + cube.w - 4, cube.y + cube.h - 4)
  ctx.moveTo(cube.x + cube.w - 4, cube.y + 4); ctx.lineTo(cube.x + 4, cube.y + cube.h - 4)
  ctx.strokeStyle = 'rgba(138,106,31,0.5)'
  ctx.stroke()
}

function drawPlayer(ctx, p) {
  ctx.fillStyle = '#e8734a'
  ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6)
  ctx.fillStyle = '#f4c89a'
  ctx.beginPath()
  ctx.arc(p.x + p.w / 2, p.y + 6, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a2f3a'
  const eyeX = p.x + p.w / 2 + p.facing * 3
  ctx.fillRect(eyeX - 1.5, p.y + 4, 3, 3)
  ctx.fillStyle = '#9aa3b2'
  ctx.fillRect(p.x + (p.facing > 0 ? p.w - 4 : 0), p.y + 10, 4, 14)
}

function drawCrosshair(ctx, aim) {
  if (!aim) return
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(aim.x - 7, aim.y); ctx.lineTo(aim.x + 7, aim.y)
  ctx.moveTo(aim.x, aim.y - 7); ctx.lineTo(aim.x, aim.y + 7)
  ctx.stroke()
}

function drawHUD(ctx, state, chamberIndex) {
  ctx.fillStyle = '#181c24'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.fillStyle = '#d8dde6'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(`Chamber ${chamberIndex + 1}: ${chamberById(state.chamberId).name}`, 14, HUD_H / 2)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#8891a3'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('Left click: blue portal   Right click: orange portal   R: reset', W - 14, HUD_H / 2)
  ctx.textAlign = 'left'

  if (state.messageTimer > 0 && state.message) {
    ctx.save()
    ctx.font = '600 20px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(state.message, W / 2, PLAY_Y0 + 40)
    ctx.restore()
  }
}

export function renderGame(ctx, state, chamberIndex, aim) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#10121a'
  ctx.fillRect(0, PLAY_Y0, W, H - PLAY_Y0)

  drawTiles(ctx, state)
  drawButtonsAndGoal(ctx, state)
  drawPortal(ctx, state.portals.blue, 'blue')
  drawPortal(ctx, state.portals.orange, 'orange')
  for (const cube of state.cubes) drawCube(ctx, cube)
  drawPlayer(ctx, state.player)
  drawCrosshair(ctx, aim)
  drawHUD(ctx, state, chamberIndex)

  if (state.lastShotFizzled && state.fizzleTimer > 0) {
    ctx.save()
    ctx.globalAlpha = state.fizzleTimer / 14
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 16px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText("Won't stick there.", W / 2, PLAY_Y0 + 70)
    ctx.restore()
  }
}
