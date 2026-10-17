// ── The Obvious Guitar Hero Knockoff — rendering ──────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import {
  W, H, HUD_H, LANES, LANE_COUNT, HIGHWAY_X0, LANE_W, HIT_Y, NOTE_TRAVEL_SECONDS, NOTE_R,
  HEALTH_MAX,
} from './constants.js'

function laneX(lane) { return HIGHWAY_X0 + lane * LANE_W + LANE_W / 2 }

function drawHighway(ctx, state) {
  const g = ctx.createLinearGradient(0, HUD_H, 0, H)
  g.addColorStop(0, '#1a0a2a')
  g.addColorStop(1, '#0a0515')
  ctx.fillStyle = g
  ctx.fillRect(0, HUD_H, W, H - HUD_H)

  for (let i = 0; i <= LANE_COUNT; i++) {
    const x = HIGHWAY_X0 + i * LANE_W
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath(); ctx.moveTo(x, HUD_H); ctx.lineTo(x, H); ctx.stroke()
  }
  // subtle scrolling rungs for a sense of speed
  const scroll = (state.songTime * 240) % 40
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  for (let y = HUD_H - scroll; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(HIGHWAY_X0, y); ctx.lineTo(HIGHWAY_X0 + LANE_COUNT * LANE_W, y); ctx.stroke()
  }

  for (const lane of LANES) {
    const x = laneX(lane.id)
    const flash = state.laneFlash[lane.id] > 0
    ctx.save()
    ctx.globalAlpha = flash ? 1 : 0.8
    ctx.fillStyle = flash ? '#fff' : lane.color
    ctx.beginPath(); ctx.arc(x, HIT_Y, NOTE_R + (flash ? 6 : 0), 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = lane.color
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, HIT_Y, NOTE_R + 8, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(lane.label, x, HIT_Y)
  }
}

function drawNotes(ctx, state) {
  for (const n of state.notes) {
    if (n.judged) continue
    const dt = n.time - state.songTime
    const progress = 1 - dt / NOTE_TRAVEL_SECONDS
    if (progress < -0.05 || progress > 1.15) continue
    const y = HUD_H + progress * (HIT_Y - HUD_H)
    const x = laneX(n.lane)
    const lane = LANES[n.lane]
    ctx.save()
    ctx.shadowColor = lane.color
    ctx.shadowBlur = 8
    ctx.fillStyle = lane.color
    ctx.beginPath(); ctx.arc(x, y, NOTE_R * 0.8, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath(); ctx.arc(x - 5, y - 5, NOTE_R * 0.25, 0, Math.PI * 2); ctx.fill()
  }
}

function drawHUD(ctx, state) {
  ctx.fillStyle = 'rgba(8,4,16,0.8)'
  ctx.fillRect(0, 0, W, HUD_H)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 16px monospace'
  ctx.fillStyle = '#fff'
  ctx.fillText(`SCORE ${state.score}`, 14, 20)
  ctx.font = '12px sans-serif'
  ctx.fillStyle = state.combo > 0 ? '#ffd93d' : 'rgba(255,255,255,0.5)'
  ctx.fillText(state.combo > 1 ? `${state.combo}x combo` : '', 14, 38)

  // health bar
  const barX = W - 220, barW = 200
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(barX, 18, barW, 14)
  const pct = Math.max(0, state.health / HEALTH_MAX)
  ctx.fillStyle = pct > 0.5 ? '#5cff8a' : pct > 0.2 ? '#ffd93d' : '#ff5c5c'
  ctx.fillRect(barX, 18, barW * pct, 14)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.strokeRect(barX + 0.5, 18.5, barW - 1, 13)
}

function drawJudgment(ctx, state) {
  if (state.judgmentTimer <= 0 || !state.judgment) return
  ctx.globalAlpha = Math.min(1, state.judgmentTimer / 12)
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = state.judgment === 'Miss' ? '#ff5c5c' : state.judgment === 'PERFECT!' ? '#ffd93d' : '#9dffb0'
  ctx.fillText(state.judgment, W / 2, HIT_Y - 70)
  ctx.globalAlpha = 1
}

export function render(ctx, state) {
  ctx.clearRect(0, 0, W, H)
  drawHighway(ctx, state)
  drawNotes(ctx, state)
  drawHUD(ctx, state)
  drawJudgment(ctx, state)
}
