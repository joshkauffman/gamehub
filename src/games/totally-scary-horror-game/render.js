// ── The Totally Scary Horror Game — pure canvas rendering ───────────────
// No game state is mutated here — draws the current engine state each
// frame. The dialogue text itself is rendered as a DOM overlay (easier
// text wrapping); this file only draws the hotel, the player, and the
// monsters (including a seated, deflated pose once caught).
import { TILE, COLS, ROWS, HUD_H, PLAY_W, HOTEL_MAP, EXIT_TILES, PLAYER_HALF, MONSTER_HALF } from './constants.js'

function drawFloorAndWalls(ctx) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE + HUD_H
      const tile = HOTEL_MAP[r][c]
      if (tile === '#') {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#3a2e24' : '#352a21'
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
      } else {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#4a1a22' : '#431820'
        ctx.fillRect(x, y, TILE, TILE)
        if (tile === 'E') {
          ctx.fillStyle = '#d8a84a'
          ctx.fillRect(x + 4, y - 6, TILE - 8, TILE + 6)
        }
      }
    }
  }
}

function drawExitSign(ctx) {
  const col0 = EXIT_TILES[0][1], col1 = EXIT_TILES[EXIT_TILES.length - 1][1]
  const cx = ((col0 + col1 + 1) / 2) * TILE
  ctx.save()
  ctx.font = 'bold 16px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffd76b'
  ctx.shadowColor = '#ffd76b'
  ctx.shadowBlur = 10
  ctx.fillText('EXIT', cx, HUD_H + 14)
  ctx.restore()
}

function drawPlayer(ctx, player) {
  const y = player.y + HUD_H
  // A faint flashlight cone in the facing direction.
  ctx.save()
  ctx.translate(player.x, y)
  const angles = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }
  ctx.rotate(angles[player.facing] ?? Math.PI / 2)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, 70, -0.5, 0.5)
  ctx.closePath()
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 70)
  grad.addColorStop(0, 'rgba(255,240,180,0.22)')
  grad.addColorStop(1, 'rgba(255,240,180,0)')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#2a7fd4'
  ctx.beginPath()
  ctx.arc(player.x, y, PLAYER_HALF, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#0a2a4a'
  ctx.lineWidth = 2
  ctx.stroke()

  // Eyes, so the facing direction reads clearly.
  const eyeOffsets = {
    up: [[-4, -4], [4, -4]], down: [[-4, 4], [4, 4]],
    left: [[-6, 0], [-2, 0]], right: [[2, 0], [6, 0]],
  }
  ctx.fillStyle = '#fff'
  for (const [ox, oy] of eyeOffsets[player.facing] ?? eyeOffsets.down) {
    ctx.beginPath()
    ctx.arc(player.x + ox, y + oy, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawVampire(ctx, m, sitting) {
  ctx.fillStyle = m.accentColor
  ctx.beginPath()
  ctx.moveTo(-MONSTER_HALF - 4, 10)
  ctx.lineTo(0, -MONSTER_HALF - 2)
  ctx.lineTo(MONSTER_HALF + 4, 10)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = m.bodyColor
  ctx.beginPath()
  ctx.arc(0, 0, MONSTER_HALF, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-1, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(3, 2); ctx.lineTo(1, 6); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill()
}

function drawMummy(ctx, m) {
  ctx.fillStyle = m.bodyColor
  ctx.beginPath()
  ctx.arc(0, 0, MONSTER_HALF, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = m.accentColor
  ctx.lineWidth = 2
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(-MONSTER_HALF, i * 5)
    ctx.lineTo(MONSTER_HALF, i * 5 + 4)
    ctx.stroke()
  }
}

function drawGhost(ctx, m) {
  ctx.fillStyle = m.bodyColor
  ctx.beginPath()
  ctx.arc(0, -2, MONSTER_HALF, Math.PI, 0)
  ctx.lineTo(MONSTER_HALF, MONSTER_HALF)
  for (let i = 0; i < 3; i++) {
    const x0 = MONSTER_HALF - (i * (2 * MONSTER_HALF) / 3)
    ctx.quadraticCurveTo(x0 - MONSTER_HALF / 3, MONSTER_HALF + 5, x0 - (2 * MONSTER_HALF) / 3, MONSTER_HALF)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = m.accentColor
  ctx.beginPath(); ctx.arc(-4, -3, 2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(4, -3, 2, 0, Math.PI * 2); ctx.fill()
}

function drawWerewolf(ctx, m) {
  ctx.fillStyle = m.bodyColor
  ctx.beginPath(); ctx.arc(0, 0, MONSTER_HALF, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-MONSTER_HALF + 2, -MONSTER_HALF + 2); ctx.lineTo(-MONSTER_HALF - 4, -MONSTER_HALF - 6); ctx.lineTo(-2, -MONSTER_HALF + 4); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(MONSTER_HALF - 2, -MONSTER_HALF + 2); ctx.lineTo(MONSTER_HALF + 4, -MONSTER_HALF - 6); ctx.lineTo(2, -MONSTER_HALF + 4); ctx.closePath(); ctx.fill()
  ctx.fillStyle = m.accentColor
  ctx.beginPath(); ctx.ellipse(0, 6, 6, 4, 0, 0, Math.PI * 2); ctx.fill()
}

function drawZombie(ctx, m) {
  ctx.fillStyle = m.bodyColor
  ctx.fillRect(-MONSTER_HALF, -MONSTER_HALF, MONSTER_HALF * 2, MONSTER_HALF * 2)
  ctx.fillStyle = m.accentColor
  ctx.fillRect(-MONSTER_HALF, MONSTER_HALF - 6, 8, 6)
  ctx.fillRect(MONSTER_HALF - 10, MONSTER_HALF - 4, 10, 4)
  ctx.fillStyle = '#d8ff9a'
  ctx.beginPath(); ctx.arc(-4, -2, 1.8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(4, -4, 1.8, 0, Math.PI * 2); ctx.fill()
}

function drawArmor(ctx, m) {
  ctx.fillStyle = m.bodyColor
  ctx.fillRect(-MONSTER_HALF, -MONSTER_HALF + 4, MONSTER_HALF * 2, MONSTER_HALF * 2 - 4)
  ctx.fillStyle = m.accentColor
  ctx.fillRect(-MONSTER_HALF - 2, -MONSTER_HALF + 2, MONSTER_HALF * 2 + 4, 5)
  // The head, carried under one arm rather than attached.
  ctx.fillStyle = m.bodyColor
  ctx.beginPath()
  ctx.arc(MONSTER_HALF + 6, 8, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(MONSTER_HALF + 2, 6, 8, 2)
}

const SHAPE_DRAWERS = {
  vampire: drawVampire, mummy: drawMummy, ghost: drawGhost,
  werewolf: drawWerewolf, zombie: drawZombie, armor: drawArmor,
}

function drawMonster(ctx, m, t) {
  const sitting = m.mode === 'sitting'
  const y = m.y + HUD_H
  ctx.save()
  ctx.translate(m.x, y)
  if (sitting) ctx.scale(1.15, 0.6)

  const draw = SHAPE_DRAWERS[m.shape] || drawGhost
  draw(ctx, m, sitting)
  ctx.restore()

  if (m.mode === 'chase') {
    ctx.save()
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe066'
    ctx.fillText('!', m.x, y - MONSTER_HALF - 10 + Math.sin(t * 10) * 2)
    ctx.restore()
  } else if (sitting) {
    ctx.save()
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('💬', m.x, y - MONSTER_HALF - 6)
    ctx.restore()
  }
}

export function render(ctx, state, t) {
  ctx.clearRect(0, 0, PLAY_W, HUD_H)
  ctx.fillStyle = '#1a0f14'
  ctx.fillRect(0, 0, PLAY_W, HUD_H)
  ctx.font = 'bold 16px "Courier New", monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ff9ad4'
  ctx.fillText('🏨 THE TOTALLY SCARY HORROR GAME', 14, 24)
  ctx.font = '12px "Courier New", monospace'
  ctx.fillStyle = '#c9c2e8'
  ctx.fillText(`Monsters met: ${state.metCount}/6  ·  Times caught: ${state.catchCount}`, 14, 42)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#c9c2e8'
  ctx.fillText(`${Math.floor(state.elapsed)}s`, PLAY_W - 14, 24)

  drawFloorAndWalls(ctx)
  drawExitSign(ctx)
  state.monsters.forEach(m => drawMonster(ctx, m, t))
  drawPlayer(ctx, state.player)
}
