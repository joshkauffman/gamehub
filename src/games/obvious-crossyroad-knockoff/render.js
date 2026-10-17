// ── The Obvious Crossy Road Knockoff — canvas rendering ────────────────
// Pure drawing: reads state only. Everything is procedurally drawn
// shapes — no sprites or copied assets.

import {
  W, H, HUD_H, PLAY_Y0, TILE, COLS, ROWS, PLAY_W,
  PLAYER_SIZE, HOP_FRAMES, LANE_COLORS, HAWK_TELEGRAPH_FRAMES,
} from './constants.js'
import { rowToScreenY } from './engine.js'

function drawTree(ctx, cx, cy) {
  ctx.fillStyle = '#5a3a1f'
  ctx.fillRect(cx - 3, cy, 6, TILE / 2 - 4)
  ctx.fillStyle = '#2a7a28'
  ctx.beginPath(); ctx.arc(cx, cy - TILE * 0.1, TILE * 0.32, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3a9a38'
  ctx.beginPath(); ctx.arc(cx - 6, cy - TILE * 0.18, TILE * 0.16, 0, Math.PI * 2); ctx.fill()
}

function drawRock(ctx, cx, cy) {
  ctx.fillStyle = '#8a8a92'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 4, 14, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9a9aa2'
  ctx.beginPath(); ctx.ellipse(cx - 4, cy, 7, 5, 0, 0, Math.PI * 2); ctx.fill()
}

function drawVehicle(ctx, v, y, dir, frame) {
  const cx = v.x + v.w / 2, cy = y + TILE / 2
  const hue = 200 + v.colorSeed * 140
  ctx.save()
  ctx.translate(cx, cy)
  if (dir < 0) ctx.scale(-1, 1)
  ctx.fillStyle = `hsl(${hue}, 60%, 48%)`
  ctx.fillRect(-v.w / 2, -12, v.w, 24)
  ctx.fillStyle = `hsl(${hue}, 60%, 62%)`
  ctx.fillRect(v.w / 2 - 16, -9, 12, 18) // windshield end (front, since we scale for direction)
  ctx.fillStyle = '#fff2b0'
  ctx.fillRect(v.w / 2 - 4, -8, 4, 5) // headlight
  ctx.fillStyle = '#2a2a2a'
  ctx.beginPath(); ctx.arc(-v.w / 2 + 10, 12, 5, 0, Math.PI * 2); ctx.arc(v.w / 2 - 10, 12, 5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawLog(ctx, l, y) {
  const cy = y + TILE / 2
  ctx.fillStyle = '#8a5a2a'
  ctx.fillRect(l.x, cy - 11, l.w, 22)
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  for (let gx = l.x + 8; gx < l.x + l.w - 4; gx += 14) {
    ctx.beginPath(); ctx.moveTo(gx, cy - 11); ctx.lineTo(gx, cy + 11); ctx.stroke()
  }
  ctx.fillStyle = '#6a4218'
  ctx.beginPath(); ctx.ellipse(l.x + 5, cy, 5, 10, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(l.x + l.w - 5, cy, 5, 10, 0, 0, Math.PI * 2); ctx.fill()
}

function drawRailTies(ctx, y) {
  ctx.fillStyle = '#6a5a3a'
  for (let x = 4; x < PLAY_W; x += 24) ctx.fillRect(x, y + 6, 14, TILE - 12)
  ctx.fillStyle = '#c8c8ce'
  ctx.fillRect(0, y + TILE * 0.32, PLAY_W, 4)
  ctx.fillRect(0, y + TILE * 0.64, PLAY_W, 4)
}

function drawTrain(ctx, y, frame) {
  const cy = y + TILE / 2
  ctx.fillStyle = '#3a3a44'
  ctx.fillRect(0, cy - 16, PLAY_W, 32)
  ctx.fillStyle = '#6ac8ff'
  const scroll = (frame * 6) % 60
  for (let x = -scroll; x < PLAY_W; x += 60) ctx.fillRect(x + 10, cy - 9, 30, 14)
  ctx.fillStyle = '#ffd94a'
  ctx.fillRect(0, cy - 18, PLAY_W, 3)
  ctx.fillRect(0, cy + 15, PLAY_W, 3)
}

function drawLanes(ctx, state) {
  const loRow = Math.floor(state.camera.row) - 1
  const hiRow = Math.ceil(state.camera.row) + ROWS
  for (let r = loRow; r <= hiRow; r++) {
    const lane = state.lanes[r]
    if (!lane) continue
    const y = rowToScreenY(state, r)
    const colors = LANE_COLORS[lane.type]
    ctx.fillStyle = r % 2 === 0 ? colors.base : colors.alt
    ctx.fillRect(0, y, PLAY_W, TILE)

    if (lane.type === 'grass') {
      for (const col of lane.obstacles) {
        const cx = col * TILE + TILE / 2, cy = y + TILE / 2
        if ((col + r) % 2 === 0) drawTree(ctx, cx, cy); else drawRock(ctx, cx, cy)
      }
    } else if (lane.type === 'road') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (let x = 0; x < PLAY_W; x += 36) ctx.fillRect(x, y + TILE / 2 - 2, 20, 4)
      for (const v of lane.vehicles) drawVehicle(ctx, v, y, lane.dir, state.frame)
    } else if (lane.type === 'river') {
      const shimmer = 0.5 + 0.5 * Math.sin(state.frame * 0.06 + r)
      ctx.fillStyle = `rgba(255,255,255,${0.06 + shimmer * 0.05})`
      ctx.fillRect(0, y, PLAY_W, TILE)
      for (const l of lane.logs) drawLog(ctx, l, y)
    } else if (lane.type === 'rail') {
      drawRailTies(ctx, y)
      const warning = lane.phase > 0 && lane.phase <= lane.warnFrames
      const active = lane.phase <= 0 && lane.phase > -lane.activeFrames
      if (warning && Math.floor(state.frame / 6) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,60,40,0.4)'
        ctx.fillRect(0, y, PLAY_W, TILE)
      }
      if (active) drawTrain(ctx, y, state.frame)
    }
  }
}

function drawCritterBody(ctx, character, squashX, squashY) {
  const colors = character
  ctx.save()
  ctx.scale(squashX, squashY)

  // legs
  ctx.fillStyle = colors.legColor
  ctx.fillRect(-9, 6, 6, 8)
  ctx.fillRect(3, 6, 6, 8)

  // body
  ctx.fillStyle = colors.bodyColor
  ctx.beginPath(); ctx.ellipse(0, -2, 13, 12, 0, 0, Math.PI * 2); ctx.fill()

  // id-specific silhouette details
  if (character.id === 'bunny') {
    ctx.fillStyle = colors.bodyColor
    ctx.beginPath(); ctx.ellipse(-5, -18, 3.5, 10, -0.15, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(5, -18, 3.5, 10, 0.15, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = colors.accentColor
    ctx.beginPath(); ctx.ellipse(-5, -18, 1.6, 7, -0.15, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(5, -18, 1.6, 7, 0.15, 0, Math.PI * 2); ctx.fill()
  } else if (character.id === 'chicken') {
    ctx.fillStyle = colors.accentColor
    ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(3, -12); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.arc(-6, -13, 3, 0, Math.PI * 2); ctx.arc(6, -13, 3, 0, Math.PI * 2); ctx.fill()
  } else if (character.id === 'frog') {
    ctx.fillStyle = colors.bodyColor
    ctx.beginPath(); ctx.arc(-6, -12, 5, 0, Math.PI * 2); ctx.arc(6, -12, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a2a14'
    ctx.beginPath(); ctx.arc(-6, -12, 2, 0, Math.PI * 2); ctx.arc(6, -12, 2, 0, Math.PI * 2); ctx.fill()
  } else if (character.id === 'penguin') {
    ctx.fillStyle = '#f2f2f2'
    ctx.beginPath(); ctx.ellipse(0, 1, 8, 9, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = colors.accentColor
    ctx.beginPath(); ctx.moveTo(-2.5, -3); ctx.lineTo(2.5, -3); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill()
  }

  // eyes (skip frog, drawn above already)
  if (character.id !== 'frog') {
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI * 2); ctx.arc(5, -5, 2, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function drawPlayer(ctx, state) {
  const p = state.player
  const character = state.character
  const hopProgress = p.hopTimer > 0 ? 1 - p.hopTimer / HOP_FRAMES : 1
  const arc = Math.sin(Math.min(1, hopProgress) * Math.PI) * 14
  const squashX = 1 + 0.12 * Math.sin(Math.min(1, hopProgress) * Math.PI)
  const squashY = 1 - 0.1 * Math.sin(Math.min(1, hopProgress) * Math.PI)

  const cx = p.x + PLAYER_SIZE.w / 2
  const cy = rowToScreenY(state, p.displayRow) + TILE / 2 - arc

  ctx.save()
  ctx.globalAlpha = state.status === 'dead' ? 0.35 : 1
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(cx, rowToScreenY(state, p.displayRow) + TILE - 6, 12 - arc * 0.15, 5 - arc * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.translate(cx, cy)
  if (p.facing === 'left') ctx.scale(-1, 1)
  drawCritterBody(ctx, character, squashX, squashY)
  ctx.restore()
}

function drawHawk(ctx, state) {
  const hawk = state.hawk
  if (!hawk) return
  const t = 1 - hawk.timer / hawk.totalFrames
  const targetY = rowToScreenY(state, hawk.targetRow) + TILE / 2

  // Growing warning shadow on the ground at the dive target.
  const shadowR = 8 + t * 18
  ctx.save()
  ctx.globalAlpha = 0.35 + 0.3 * t
  ctx.fillStyle = '#1a1208'
  ctx.beginPath(); ctx.ellipse(hawk.targetX, targetY + 8, shadowR, shadowR * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // The hawk itself, swooping down from above the screen toward the target.
  const hawkY = -40 + t * (targetY + 40)
  ctx.save()
  ctx.translate(hawk.targetX, hawkY)
  ctx.fillStyle = '#3a2a1f'
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 16, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#5a4230'
  const flap = Math.sin(state.frame * 0.6) * 10
  ctx.beginPath(); ctx.ellipse(-16, flap, 14, 5, 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(16, flap, 14, 5, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffb81a'
  ctx.beginPath(); ctx.moveTo(-3, 12); ctx.lineTo(3, 12); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill()
  ctx.restore()
}

function drawParticles(ctx, particles) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 24)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(10,14,8,0.88)'
  ctx.fillRect(0, 0, W, HUD_H)

  ctx.font = '700 22px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(`${state.maxRowReached}m`, 18, HUD_H / 2)

  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillStyle = '#ffd93d'
  ctx.textAlign = 'right'
  ctx.fillText(`BEST ${state.highScore}m`, W - 18, HUD_H / 2)
}

export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = LANE_COLORS.grass.base
  ctx.fillRect(0, PLAY_Y0, W, H - PLAY_Y0)

  drawLanes(ctx, state)
  drawPlayer(ctx, state)
  drawHawk(ctx, state)
  drawParticles(ctx, state.particles)
  drawHUD(ctx, state)
}
