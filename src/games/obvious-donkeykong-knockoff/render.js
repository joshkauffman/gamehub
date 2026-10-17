// ── The Obvious Donkey Kong Knockoff — canvas rendering ────────────────
// Pure drawing: reads state only. Everything is procedurally drawn
// shapes — no sprites or copied assets. Girders are flat tiles under
// the hood, but drawn with a diagonal plank texture so they still read
// as the classic slanted girder look.

import { W, H, HUD_H, PLAY_Y0, TILE, COLS, ROWS, LIVES_START } from './constants.js'

function cellX(col) { return col * TILE }
function cellY(row) { return PLAY_Y0 + row * TILE }

function drawGirders(ctx, state) {
  const tiles = state.tiles
  for (let r = 0; r < ROWS; r++) {
    let runStart = -1
    for (let c = 0; c <= COLS; c++) {
      const solid = c < COLS && (tiles[r][c] === '#' || tiles[r][c] === 'X')
      if (solid && runStart === -1) runStart = c
      if (!solid && runStart !== -1) {
        drawGirderRun(ctx, runStart, c - 1, r)
        runStart = -1
      }
    }
  }
}

function drawGirderRun(ctx, c0, c1, row) {
  const x0 = cellX(c0), x1 = cellX(c1) + TILE, y = cellY(row)
  ctx.fillStyle = '#c06a2a'
  ctx.fillRect(x0, y, x1 - x0, 10)
  ctx.fillStyle = '#8a4a1a'
  ctx.fillRect(x0, y + 10, x1 - x0, 3)
  // diagonal rivet/plank hatching, purely cosmetic
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 2
  for (let x = x0 + 4; x < x1; x += 14) {
    ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + 8, y); ctx.stroke()
  }
}

function drawLadders(ctx, state) {
  const tiles = state.tiles
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tiles[r][c] !== 'L' && tiles[r][c] !== 'X') continue
      const x = cellX(c), y = cellY(r)
      ctx.strokeStyle = '#e8c850'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 5, y + TILE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x + TILE - 5, y); ctx.lineTo(x + TILE - 5, y + TILE); ctx.stroke()
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x + 4, y + TILE / 2); ctx.lineTo(x + TILE - 4, y + TILE / 2); ctx.stroke()
    }
  }
}

function drawRivet(ctx, col, row, taken) {
  if (taken) return
  const x = cellX(col) + TILE / 2, y = cellY(row) - 7
  ctx.fillStyle = '#d8d8e0'
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8a8a98'
  ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill()
}

function drawHammer(ctx, col, row, taken) {
  if (taken) return
  const x = cellX(col) + TILE / 2, y = cellY(row) - 14
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.5)
  ctx.fillStyle = '#8a5a2a'
  ctx.fillRect(-2, -2, 4, 18)
  ctx.fillStyle = '#9a9aa2'
  ctx.fillRect(-9, -12, 18, 10)
  ctx.restore()
}

function drawBarrel(ctx, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((b.rollPhase % (Math.PI * 2)))
  ctx.fillStyle = '#9a5a2a'
  ctx.beginPath(); ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#5a3414'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, b.w / 2 - 1, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-b.w / 2, -2); ctx.lineTo(b.w / 2, -2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-b.w / 2, 3); ctx.lineTo(b.w / 2, 3); ctx.stroke()
  ctx.restore()
}

function drawApe(ctx, col, row, frame) {
  const x = cellX(col), y = cellY(row) - TILE
  const bob = Math.sin(frame * 0.08) * 2
  ctx.fillStyle = '#6a4226'
  ctx.fillRect(x - 4, y - 28 + bob, 34, 30)
  ctx.beginPath(); ctx.arc(x + 13, y - 30 + bob, 15, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#c89a6a'
  ctx.beginPath(); ctx.arc(x + 13, y - 28 + bob, 8, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(x + 8, y - 31 + bob, 3, 3)
  ctx.fillRect(x + 15, y - 31 + bob, 3, 3)
}

function drawGoal(ctx, col, row) {
  const x = cellX(col) + TILE / 2, y = cellY(row) - 10
  // a little cage with a dog inside — the thing you're climbing up to rescue
  ctx.strokeStyle = '#aaa'
  ctx.lineWidth = 2
  for (let i = -10; i <= 10; i += 5) { ctx.beginPath(); ctx.moveTo(x + i, y - 14); ctx.lineTo(x + i, y + 6); ctx.stroke() }
  ctx.fillStyle = '#e8b870'
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8a5a28'
  ctx.fillRect(x - 7, y - 3, 5, 4)
  ctx.fillRect(x + 2, y - 3, 5, 4)
}

function drawPlayer(ctx, p, frame) {
  const x = p.x, y = p.y
  ctx.save()
  if (p.invulnTimer > 0 && Math.floor(p.invulnTimer / 4) % 2 === 0) ctx.globalAlpha = 0.4

  ctx.fillStyle = p.hammerTimer > 0 ? '#e8503a' : '#3a6ea8'
  if (p.climbing) {
    ctx.fillRect(x + 2, y + 4, p.w - 4, p.h - 8)
    const swing = Math.sin(frame * 0.4) * 4
    ctx.strokeStyle = '#e8b870'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, y + 8 + swing); ctx.lineTo(x + p.w, y + 8 - swing); ctx.stroke()
  } else {
    ctx.fillRect(x + 2, y + 8, p.w - 4, p.h - 8)
    const stride = p.onGround && Math.abs(p.vx) > 0.1 ? Math.sin(frame * 0.5) * 3 : 0
    ctx.fillStyle = '#2a4a78'
    ctx.fillRect(x + 3, y + p.h - 6, 4, 6 + stride)
    ctx.fillRect(x + p.w - 7, y + p.h - 6, 4, 6 - stride)
  }
  // head
  ctx.fillStyle = '#e8b870'
  ctx.beginPath(); ctx.arc(x + p.w / 2, y + 6, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(x + p.w / 2 + (p.facing > 0 ? 1 : -3), y + 4, 2, 2)

  if (p.hammerTimer > 0 && !p.climbing) {
    const swing = Math.sin(frame * 0.6) * 0.6
    ctx.save()
    ctx.translate(x + p.w / 2 + p.facing * 6, y + 10)
    ctx.rotate(swing * p.facing)
    ctx.fillStyle = '#8a5a2a'
    ctx.fillRect(-2, -2, 4, 16)
    ctx.fillStyle = '#9a9aa2'
    ctx.fillRect(-9, -12, 18, 10)
    ctx.restore()
  }
  ctx.restore()
}

function drawHUD(ctx, state) {
  ctx.fillStyle = '#14121f'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.fillStyle = '#fff'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(state.stage.name, 14, HUD_H / 2)

  ctx.font = '13px system-ui, sans-serif'
  ctx.fillStyle = '#ffd93d'
  ctx.textAlign = 'center'
  ctx.fillText(`SCORE ${state.score}`, W / 2, HUD_H / 2)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  for (let i = 0; i < LIVES_START; i++) {
    const x = W - 16 - i * 18
    ctx.fillStyle = i < state.lives ? '#e8503a' : 'rgba(255,255,255,0.2)'
    ctx.beginPath(); ctx.arc(x, HUD_H / 2, 6, 0, Math.PI * 2); ctx.fill()
  }
  ctx.textAlign = 'left'

  if (state.player.hammerTimer > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillText('HAMMER TIME', 14, HUD_H - 8)
  }
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0 || !state.message) return
  ctx.save()
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const textW = ctx.measureText(state.message).width
  ctx.fillStyle = 'rgba(10,8,18,0.85)'
  ctx.fillRect(W / 2 - textW / 2 - 16, PLAY_Y0 + 16, textW + 32, 30)
  ctx.fillStyle = '#ffd93d'
  ctx.fillText(state.message, W / 2, PLAY_Y0 + 36)
  ctx.restore()
  ctx.textAlign = 'left'
}

export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#1a1420'
  ctx.fillRect(0, PLAY_Y0, W, H - PLAY_Y0)

  drawLadders(ctx, state)
  drawGirders(ctx, state)
  for (const h of state.hammersLeft) drawHammer(ctx, h.col, h.row, h.taken)
  for (const r of state.rivets) drawRivet(ctx, r.col, r.row, r.taken)
  if (state.stage.goal) drawGoal(ctx, state.stage.goal.col, state.stage.goal.row)
  drawApe(ctx, state.stage.ape.col, state.stage.ape.row, state.frame)
  for (const b of state.barrels) drawBarrel(ctx, b)
  drawPlayer(ctx, state.player, state.frame)

  drawHUD(ctx, state)
  drawMessage(ctx, state)
}
