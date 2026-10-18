// ── The Obvious Crossy Road Knockoff — canvas rendering ────────────────
// Pure drawing: reads state only. Everything is procedurally drawn
// shapes — no sprites or copied assets.
//
// Single-player renders one full-canvas "viewport"; 2-player splits the
// canvas into two horizontal halves, each clipped to its own band and
// drawing from its own camera — but both halves read the exact same
// shared `state.lanes`/`state.particles`, so a player who wanders into
// the other player's visible row range shows up there too.

import {
  W, H, TILE, PLAY_W,
  PLAYER_SIZE, LANE_COLORS,
  SHIELD_DURATION, SPEED_DURATION,
  HUD_H, PLAY_Y0, ROWS,
  SPLIT_HUD_H, SPLIT_VIEW_H, SPLIT_ROWS, SPLIT_PLAY_Y0,
  POWERUP_ICON_SIZE,
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

const POWERUP_COLORS = { shield: '#9ad8ff', speed: '#ffe35c', freeze: '#bfe8ff', life: '#ff6a8a' }
const POWERUP_ICONS = { shield: '🛡️', speed: '⚡', freeze: '❄️', life: '❤️' }

function drawPowerup(ctx, cx, cy, type, frame) {
  const bob = Math.sin(frame * 0.08) * 3
  const pulse = 0.6 + 0.4 * Math.sin(frame * 0.15)
  ctx.save()
  ctx.shadowColor = POWERUP_COLORS[type]
  ctx.shadowBlur = 10 * pulse
  ctx.fillStyle = POWERUP_COLORS[type]
  ctx.globalAlpha = 0.35
  ctx.beginPath(); ctx.arc(cx, cy + bob, POWERUP_ICON_SIZE * 0.7, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.font = `${POWERUP_ICON_SIZE}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(POWERUP_ICONS[type], cx, cy + bob)
  ctx.restore()
}

function drawVehicle(ctx, v, y, dir) {
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

function drawLanes(ctx, state, viewport) {
  const loRow = Math.floor(viewport.cameraRow) - 1
  const hiRow = Math.ceil(viewport.cameraRow) + viewport.rows
  const frozen = state.freezeTimer > 0
  for (let r = loRow; r <= hiRow; r++) {
    const lane = state.lanes[r]
    if (!lane) continue
    const y = rowToScreenY(viewport, r)
    const colors = LANE_COLORS[lane.type]
    ctx.fillStyle = r % 2 === 0 ? colors.base : colors.alt
    ctx.fillRect(0, y, PLAY_W, TILE)

    if (lane.type === 'grass') {
      for (const col of lane.obstacles) {
        const cx = col * TILE + TILE / 2, cy = y + TILE / 2
        if ((col + r) % 2 === 0) drawTree(ctx, cx, cy); else drawRock(ctx, cx, cy)
      }
      if (lane.powerup && !lane.powerup.taken) {
        drawPowerup(ctx, lane.powerup.col * TILE + TILE / 2, y + TILE / 2, lane.powerup.type, state.frame)
      }
    } else if (lane.type === 'road') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (let x = 0; x < PLAY_W; x += 36) ctx.fillRect(x, y + TILE / 2 - 2, 20, 4)
      for (const v of lane.vehicles) drawVehicle(ctx, v, y, lane.dir)
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
  if (frozen) {
    ctx.save()
    ctx.globalAlpha = 0.14 + 0.05 * Math.sin(state.frame * 0.25)
    ctx.fillStyle = '#bfe8ff'
    ctx.fillRect(0, viewport.y0, PLAY_W, viewport.rows * TILE)
    ctx.restore()
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

function drawPlayer(ctx, state, viewport, player) {
  const p = player
  const hopProgress = p.hopTimer > 0 ? 1 - p.hopTimer / p.hopTotalFrames : 1
  const arc = Math.sin(Math.min(1, hopProgress) * Math.PI) * 14
  const squashX = 1 + 0.12 * Math.sin(Math.min(1, hopProgress) * Math.PI)
  const squashY = 1 - 0.1 * Math.sin(Math.min(1, hopProgress) * Math.PI)

  const groundY = rowToScreenY(viewport, p.displayRow)
  const cx = p.x + PLAYER_SIZE.w / 2
  const cy = groundY + TILE / 2 - arc

  ctx.save()
  ctx.globalAlpha = !p.alive ? 0.3 : 1
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(cx, groundY + TILE - 6, 12 - arc * 0.15, 5 - arc * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()

  // speed-boost motion trail, drawn behind the critter
  if (p.speedTimer > 0 && p.alive) {
    ctx.save()
    ctx.globalAlpha *= 0.35
    ctx.fillStyle = '#ffe35c'
    for (let i = 1; i <= 2; i++) {
      const trailY = cy + i * 5
      ctx.beginPath(); ctx.ellipse(cx, trailY, 11 - i * 2, 9 - i * 2, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  // shield glow ring
  if (p.shieldTimer > 0 && p.alive) {
    const fade = Math.min(1, p.shieldTimer / 40)
    ctx.save()
    ctx.globalAlpha *= 0.55 + 0.25 * Math.sin(state.frame * 0.3)
    ctx.strokeStyle = '#9ad8ff'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy - 2, 20, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha *= fade
    ctx.restore()
  }
  // respawn grace flicker
  const flashing = p.respawnInvuln > 0 && Math.floor(state.frame / 4) % 2 === 0
  if (flashing) ctx.globalAlpha *= 0.4

  ctx.translate(cx, cy)
  if (p.facing === 'left') ctx.scale(-1, 1)
  drawCritterBody(ctx, p.character, squashX, squashY)
  ctx.restore()
}

function drawHawk(ctx, state, viewport, player) {
  const hawk = player.hawk
  if (!hawk) return
  const t = 1 - hawk.timer / hawk.totalFrames
  const targetY = rowToScreenY(viewport, hawk.targetRow) + TILE / 2

  // Growing warning shadow on the ground at the dive target.
  const shadowR = 8 + t * 18
  ctx.save()
  ctx.globalAlpha = 0.35 + 0.3 * t
  ctx.fillStyle = '#1a1208'
  ctx.beginPath(); ctx.ellipse(hawk.targetX, targetY + 8, shadowR, shadowR * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // The hawk itself, swooping down from above the viewport toward the target.
  const hawkY = (viewport.y0 - 40) + t * (targetY + 40 - (viewport.y0 - 40))
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

function drawParticles(ctx, viewport, particles) {
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life / 24)
    ctx.fillStyle = pt.color
    const y = rowToScreenY(viewport, pt.row) + TILE / 2 + pt.dy
    ctx.fillRect(pt.x - 2, y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
}

const HEART_ICON = '❤️'

function drawLives(ctx, x, y, size, lives) {
  ctx.font = `${size}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < lives; i++) ctx.fillText(HEART_ICON, x + i * (size * 0.85), y)
}

function drawToasts(ctx, state, viewport, playerId) {
  const mine = state.toasts.filter(t => t.playerId === playerId)
  mine.forEach((t, i) => {
    const alpha = Math.min(1, t.timer / 24)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = '700 15px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const y = viewport.y0 + viewport.rows * TILE * 0.35 - i * 22
    const w = ctx.measureText(t.text).width + 24
    ctx.fillStyle = 'rgba(10,10,10,0.75)'
    ctx.fillRect(W / 2 - w / 2, y - 14, w, 26)
    ctx.fillStyle = '#ffe35c'
    ctx.fillText(t.text, W / 2, y)
    ctx.restore()
  })
}

function drawSingleHUD(ctx, state, player) {
  ctx.fillStyle = 'rgba(10,14,8,0.88)'
  ctx.fillRect(0, 0, W, HUD_H)

  ctx.font = '700 22px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(`${player.maxRowReached}m`, 18, 22)
  drawLives(ctx, 18, 44, 16, player.lives)

  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillStyle = '#ffd93d'
  ctx.textAlign = 'right'
  ctx.fillText(`BEST ${state.highScore}m`, W - 18, HUD_H / 2)

  drawEffectBadges(ctx, state, player, W - 18, 16)
}

function drawSplitHUD(ctx, state, viewport, player, label) {
  ctx.fillStyle = 'rgba(10,14,8,0.88)'
  ctx.fillRect(0, viewport.y0 - SPLIT_HUD_H, W, SPLIT_HUD_H)

  ctx.font = '700 15px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(`${label} ${player.maxRowReached}m`, 12, viewport.y0 - SPLIT_HUD_H / 2)
  drawLives(ctx, 110, viewport.y0 - SPLIT_HUD_H / 2, 12, player.lives)

  drawEffectBadges(ctx, state, player, W - 12, viewport.y0 - SPLIT_HUD_H / 2)
}

function drawEffectBadges(ctx, state, player, rightX, y) {
  const badges = []
  if (player.shieldTimer > 0) badges.push(['🛡️', player.shieldTimer, SHIELD_DURATION])
  if (player.speedTimer > 0) badges.push(['⚡', player.speedTimer, SPEED_DURATION])
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '13px sans-serif'
  let x = rightX
  for (const [icon] of badges) { ctx.fillText(icon, x, y); x -= 22 }
}

function viewportFor(state, idx) {
  if (!state.twoPlayer) return { y0: PLAY_Y0, rows: ROWS, cameraRow: state.players[0].camera.row }
  return { y0: SPLIT_PLAY_Y0[idx], rows: SPLIT_ROWS, cameraRow: state.players[idx].camera.row }
}

function renderOneViewport(ctx, state, viewport, ownerPlayer, label) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, viewport.y0, W, viewport.rows * TILE)
  ctx.clip()

  ctx.fillStyle = LANE_COLORS.grass.base
  ctx.fillRect(0, viewport.y0, W, viewport.rows * TILE)
  drawLanes(ctx, state, viewport)
  drawHawk(ctx, state, viewport, ownerPlayer)
  drawPlayer(ctx, state, viewport, ownerPlayer)
  drawParticles(ctx, viewport, state.particles)
  drawToasts(ctx, state, viewport, ownerPlayer.id)
  ctx.restore()

  if (state.twoPlayer) drawSplitHUD(ctx, state, viewport, ownerPlayer, label)
  else drawSingleHUD(ctx, state, ownerPlayer)
}

export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, W, H)

  if (!state.twoPlayer) {
    renderOneViewport(ctx, state, viewportFor(state, 0), state.players[0], null)
    return
  }

  renderOneViewport(ctx, state, viewportFor(state, 0), state.players[0], 'P1')
  renderOneViewport(ctx, state, viewportFor(state, 1), state.players[1], 'P2')
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, SPLIT_VIEW_H); ctx.lineTo(W, SPLIT_VIEW_H); ctx.stroke()
}
