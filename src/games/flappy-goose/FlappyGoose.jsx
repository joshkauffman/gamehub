import { useEffect, useRef, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './FlappyGoose.module.css'

// ── Fixed constants ──────────────────────────────────────────────────
const GRAVITY    = 0.44
const FLAP_VEL   = -8.8
const PIPE_W     = 54
const PIPE_SPEED = 2.7
const GROUND_H   = 68
const GOOSE_X    = 92
const TRACK_LEFT = 90
const BUILDER_TOP_MARGIN = 96
const BUILDER_BOTTOM_MARGIN = 90

// ── Skins ────────────────────────────────────────────────────────────
const SKINS = [
  { id:'classic', name:'Classic',       unlockScore:0,
    colors:{ WH:'#f4f4f4', WG:'#d0d0d0', TG:'#e4e4e4', HR:'#cc1111', DR:'#881111', HW:'#f5f5f5', PR:'#FF3333', PB:'#3366ff', HH:'#888888', BK:'#1a1a1a' } },
  { id:'navy',    name:'Sailor Blue',   unlockScore:5,
    colors:{ WH:'#88bbf8', WG:'#5588d8', TG:'#aacfff', HR:'#1144cc', DR:'#003388', HW:'#cce0ff', PR:'#ff6633', PB:'#ffcc00', HH:'#334477', BK:'#0a1a3a' } },
  { id:'gold',    name:'Golden Goose',  unlockScore:10,
    colors:{ WH:'#f5d060', WG:'#dba820', TG:'#f8dc80', HR:'#996600', DR:'#664400', HW:'#fff0a0', PR:'#cc2200', PB:'#0044cc', HH:'#cc9900', BK:'#3a2a00' } },
  { id:'lava',    name:'Lava Goose',    unlockScore:20,
    colors:{ WH:'#ff7744', WG:'#ee4422', TG:'#ff9966', HR:'#330000', DR:'#110000', HW:'#ff6600', PR:'#ffee00', PB:'#ff8800', HH:'#440000', BK:'#220000' } },
  { id:'cosmic',  name:'Cosmic Goose',  unlockScore:35,
    colors:{ WH:'#9966ee', WG:'#7744cc', TG:'#bb88ff', HR:'#220044', DR:'#110022', HW:'#dd88ff', PR:'#ff44ff', PB:'#44ffff', HH:'#442266', BK:'#110022' } },
  { id:'rainbow', name:'Rainbow Goose', unlockScore:50, colors:null, rainbow:true },
]

function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100
  const c = (1 - Math.abs(2*l - 1)) * s
  const x = c * (1 - Math.abs((h/60) % 2 - 1))
  const m = l - c/2
  let r, g, b
  if      (h < 60)  { r=c; g=x; b=0 } else if (h < 120) { r=x; g=c; b=0 }
  else if (h < 180) { r=0; g=c; b=x } else if (h < 240) { r=0; g=x; b=c }
  else if (h < 300) { r=x; g=0; b=c } else               { r=c; g=0; b=x }
  const hex = v => Math.round((v+m)*255).toString(16).padStart(2,'0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function getSkinColors(skin, frame) {
  if (!skin.rainbow) return skin.colors
  const h = (frame * 3) % 360
  return { WH:hslHex(h,80,65), WG:hslHex(h+40,70,55), TG:hslHex(h+20,75,70),
           HR:hslHex(h+120,90,35), DR:hslHex(h+150,90,22), HW:'#ffffff',
           PR:hslHex(h+180,95,55), PB:hslHex(h+240,95,60), HH:'#888888', BK:'#1a1a1a' }
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Built-in curated levels ─────────────────────────────────────────
// obstacle x/gapY/y/width are fractions or level-space distance units;
// gapY/y are 0..1 fractions of playable height, gapH/amp are fractions too.
const BUILTIN_LEVELS = [
  {
    id: 'meadow', name: 'Sunny Meadow', difficulty: 'Easy', builtin: true, length: 4300,
    obstacles: [
      { type:'pipe', x:500,  gapY:0.35, gapH:0.30 },
      { type:'pipe', x:920,  gapY:0.60, gapH:0.30 },
      { type:'coin', x:1150, y:0.60 },
      { type:'pipe', x:1360, gapY:0.30, gapH:0.29 },
      { type:'pipe', x:1780, gapY:0.65, gapH:0.28 },
      { type:'pipe', x:2200, gapY:0.45, gapH:0.28 },
      { type:'coin', x:2430, y:0.45 },
      { type:'pipe', x:2640, gapY:0.25, gapH:0.27 },
      { type:'pipe', x:3060, gapY:0.60, gapH:0.27 },
      { type:'pipe', x:3480, gapY:0.40, gapH:0.26 },
      { type:'coin', x:3700, y:0.40 },
      { type:'pipe', x:3900, gapY:0.55, gapH:0.26 },
    ],
  },
  {
    id: 'windy', name: 'Windy Cliffs', difficulty: 'Medium', builtin: true, length: 5700,
    obstacles: [
      { type:'pipe', x:500,  gapY:0.40, gapH:0.27 },
      { type:'pipe', x:920,  gapY:0.62, gapH:0.26 },
      { type:'wind', x:1150, width:520, force:-0.16 },
      { type:'pipe', x:1400, gapY:0.30, gapH:0.25 },
      { type:'pipe', x:1820, gapY:0.58, gapH:0.25 },
      { type:'coin', x:2020, y:0.58 },
      { type:'pipe', x:2240, gapY:0.35, gapH:0.24 },
      { type:'pipe', x:2660, gapY:0.62, gapH:0.24 },
      { type:'wind', x:2900, width:560, force:0.18 },
      { type:'pipe', x:3160, gapY:0.42, gapH:0.23 },
      { type:'pipe', x:3580, gapY:0.24, gapH:0.23 },
      { type:'coin', x:3800, y:0.24 },
      { type:'pipe', x:4000, gapY:0.58, gapH:0.23 },
      { type:'pipe', x:4420, gapY:0.38, gapH:0.22 },
      { type:'wind', x:4650, width:500, force:-0.14 },
      { type:'pipe', x:4900, gapY:0.55, gapH:0.22 },
      { type:'pipe', x:5300, gapY:0.35, gapH:0.22 },
    ],
  },
  {
    id: 'night', name: 'Night Flight', difficulty: 'Hard', builtin: true, length: 6700, theme:'night',
    obstacles: [
      { type:'pipe',   x:600,  gapY:0.40, gapH:0.24 },
      { type:'pipe',   x:1020, gapY:0.58, gapH:0.23 },
      { type:'moving', x:1480, gapY:0.35, gapH:0.22, amp:0.15, speed:1.2 },
      { type:'coin',   x:1780, y:0.50 },
      { type:'pipe',   x:1960, gapY:0.60, gapH:0.22 },
      { type:'pipe',   x:2360, gapY:0.30, gapH:0.21 },
      { type:'moving', x:2820, gapY:0.50, gapH:0.21, amp:0.18, speed:1.5 },
      { type:'coin',   x:3120, y:0.50 },
      { type:'pipe',   x:3300, gapY:0.40, gapH:0.20 },
      { type:'pipe',   x:3700, gapY:0.62, gapH:0.20 },
      { type:'moving', x:4160, gapY:0.35, gapH:0.20, amp:0.20, speed:1.3 },
      { type:'pipe',   x:4560, gapY:0.55, gapH:0.19 },
      { type:'coin',   x:4820, y:0.30 },
      { type:'pipe',   x:4980, gapY:0.30, gapH:0.19 },
      { type:'moving', x:5440, gapY:0.50, gapH:0.19, amp:0.22, speed:1.6 },
      { type:'pipe',   x:5840, gapY:0.40, gapH:0.19 },
      { type:'pipe',   x:6240, gapY:0.60, gapH:0.18 },
    ],
  },
  {
    id: 'chaos', name: 'Chaos Canyon', difficulty: 'Extreme', builtin: true, length: 8200, theme:'sunset',
    obstacles: [
      { type:'pipe',   x:600,  gapY:0.40, gapH:0.24 },
      { type:'moving', x:1020, gapY:0.55, gapH:0.22, amp:0.16, speed:1.4 },
      { type:'wind',   x:1300, width:500, force:0.2 },
      { type:'pipe',   x:1560, gapY:0.30, gapH:0.21 },
      { type:'coin',   x:1820, y:0.30 },
      { type:'moving', x:1980, gapY:0.60, gapH:0.20, amp:0.20, speed:1.6 },
      { type:'pipe',   x:2400, gapY:0.40, gapH:0.20 },
      { type:'wind',   x:2650, width:520, force:-0.22 },
      { type:'moving', x:2920, gapY:0.30, gapH:0.19, amp:0.18, speed:1.8 },
      { type:'pipe',   x:3340, gapY:0.60, gapH:0.19 },
      { type:'coin',   x:3600, y:0.60 },
      { type:'pipe',   x:3760, gapY:0.35, gapH:0.18 },
      { type:'moving', x:4180, gapY:0.55, gapH:0.18, amp:0.22, speed:1.7 },
      { type:'wind',   x:4450, width:560, force:0.2 },
      { type:'pipe',   x:4720, gapY:0.30, gapH:0.18 },
      { type:'moving', x:5140, gapY:0.55, gapH:0.17, amp:0.2, speed:2.0 },
      { type:'coin',   x:5420, y:0.40 },
      { type:'pipe',   x:5580, gapY:0.40, gapH:0.17 },
      { type:'wind',   x:5850, width:500, force:-0.2 },
      { type:'moving', x:6120, gapY:0.35, gapH:0.17, amp:0.22, speed:2.1 },
      { type:'pipe',   x:6540, gapY:0.60, gapH:0.17 },
      { type:'coin',   x:6800, y:0.50 },
      { type:'moving', x:6960, gapY:0.45, gapH:0.16, amp:0.24, speed:2.2 },
      { type:'pipe',   x:7380, gapY:0.35, gapH:0.16 },
      { type:'pipe',   x:7780, gapY:0.55, gapH:0.16 },
    ],
  },
]

function computeGap(o, playableH, dist, animate) {
  const M = playableH * 0.09
  const gapH = Math.max(0.12, Math.min(0.5, o.gapH ?? 0.27)) * playableH
  let gapTop = M + (o.gapY ?? 0.5) * (playableH - 2*M - gapH)
  if (animate && o.type === 'moving') {
    const amp = (o.amp ?? 0.15) * playableH
    gapTop += Math.sin(dist * 0.01 * (o.speed ?? 1) + o.x * 0.01) * amp
  }
  gapTop = Math.max(M, Math.min(playableH - M - gapH, gapTop))
  return { gapTop, gapBottom: gapTop + gapH, gapH }
}

// ── Draw helpers ─────────────────────────────────────────────────────

function drawSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H - GROUND_H)
  g.addColorStop(0, '#52aad4'); g.addColorStop(1, '#b6dcf2')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H - GROUND_H)
}

function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.beginPath()
  ctx.arc(x,          y,        20*s, 0, Math.PI*2)
  ctx.arc(x + 24*s,   y - 6*s,  15*s, 0, Math.PI*2)
  ctx.arc(x + 42*s,   y + 2*s,  17*s, 0, Math.PI*2)
  ctx.arc(x + 18*s,   y + 9*s,  12*s, 0, Math.PI*2)
  ctx.fill()
}

function drawGround(ctx, off, W, H) {
  const gy = H - GROUND_H
  ctx.fillStyle = '#5d8a3c'; ctx.fillRect(0, gy, W, GROUND_H)
  ctx.fillStyle = '#6db548'; ctx.fillRect(0, gy, W, 10)
  ctx.fillStyle = '#518c30'
  for (let x = -(off % 36); x < W; x += 36) ctx.fillRect(x, gy + 12, 18, 4)
  ctx.fillStyle = '#8b6340'; ctx.fillRect(0, gy + 22, W, GROUND_H - 22)
}

function drawPipe(ctx, x, gapTop, gapBottom, H) {
  const CAP = 22, EX = 7, gy = H - GROUND_H
  const bG = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
  bG.addColorStop(0,'#2a7d2a'); bG.addColorStop(0.3,'#4cc04c'); bG.addColorStop(0.7,'#3a9e3a'); bG.addColorStop(1,'#1e6b1e')
  const cG = ctx.createLinearGradient(x - EX, 0, x + PIPE_W + EX, 0)
  cG.addColorStop(0,'#1e6b1e'); cG.addColorStop(0.2,'#3a9e3a'); cG.addColorStop(0.5,'#5ed05e'); cG.addColorStop(0.8,'#3a9e3a'); cG.addColorStop(1,'#1e6b1e')
  ctx.fillStyle = bG; ctx.fillRect(x, 0, PIPE_W, gapTop - CAP)
  ctx.fillStyle = cG; ctx.fillRect(x - EX, gapTop - CAP, PIPE_W + EX*2, CAP)
  ctx.fillStyle = bG; ctx.fillRect(x, gapBottom + CAP, PIPE_W, gy - gapBottom - CAP)
  ctx.fillStyle = cG; ctx.fillRect(x - EX, gapBottom, PIPE_W + EX*2, CAP)
}

function drawCoin(ctx, x, y, frame) {
  const s = 1 + Math.sin(frame * 0.15 + x * 0.01) * 0.1
  ctx.save()
  ctx.translate(x, y); ctx.scale(s, 1)
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2)
  ctx.fillStyle = '#FFD700'; ctx.fill()
  ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = '#FFF3B0'
  ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawWindBand(ctx, x1, x2, yTop, yBottom, force, frame) {
  const w = x2 - x1
  if (w <= 0) return
  const up = force < 0
  ctx.fillStyle = up ? 'rgba(140,220,255,0.16)' : 'rgba(255,170,110,0.16)'
  ctx.fillRect(x1, yTop, w, yBottom - yTop)
  ctx.strokeStyle = up ? 'rgba(210,245,255,0.6)' : 'rgba(255,205,150,0.6)'
  ctx.lineWidth = 2.5
  const cycle = 46
  const shift = ((frame * (up ? -1.4 : 1.4)) % cycle + cycle) % cycle
  for (let yy = yTop - cycle + shift; yy < yBottom + cycle; yy += cycle) {
    for (let xx = x1 + 14; xx < x2 - 6; xx += 30) {
      const y0 = yy, y1 = yy + (up ? -14 : 14)
      ctx.beginPath()
      ctx.moveTo(xx - 5, y0); ctx.lineTo(xx, y1); ctx.lineTo(xx + 5, y0)
      ctx.stroke()
    }
  }
}

function drawFinishFlag(ctx, x, gy) {
  ctx.fillStyle = '#8b6340'; ctx.fillRect(x - 3, gy - 90, 6, 90)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#111111' : '#ffffff'
      ctx.fillRect(x + 3 + c * 10, gy - 88 + r * 10, 10, 10)
    }
  }
}

function drawPillButton(ctx, rect, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2)
}

function drawGoosePixel(ctx, cx, cy, vel, propAngle, colors) {
  const P = 3
  ctx.save()
  ctx.translate(Math.round(cx), Math.round(cy))
  ctx.imageSmoothingEnabled = false
  ctx.rotate(Math.min(Math.max(vel * 0.042, -0.42), 0.82))

  function b(c, r, w, h, clr) { ctx.fillStyle = clr; ctx.fillRect(c*P, r*P, w*P, h*P) }

  const { WH, WG, TG, HR, DR, HW, PR, PB, HH, BK } = colors
  const OO = '#ff8800', DO = '#c05200'

  // Tail
  b(-9,-1,1,3,TG); b(-10,-1,2,1,TG); b(-10,0,2,1,WH); b(-10,1,2,1,TG); b(-11,0,1,1,TG)
  b(-11,-1,3,1,BK); b(-11,1,3,1,BK); b(-12,0,1,1,BK); b(-9,-2,1,4,BK)

  // Body
  b(-5,-4,10,1,BK)
  b(-5,-3,1,1,BK); b(4,-3,1,1,BK); b(-4,-3,8,1,WH)
  b(-7,-3,1,1,BK); b(-6,-3,1,1,BK); b(-7,-2,1,3,BK); b(4,-2,1,3,BK)
  b(-6,-2,10,1,WH); b(-6,-1,10,1,WH); b(-6,0,10,1,WH)
  b(-6,1,1,1,BK); b(3,1,1,1,BK); b(-5,1,8,1,WH)
  b(-4,2,1,1,BK); b(2,2,1,1,BK); b(-3,2,5,1,WH); b(-4,3,7,1,BK)
  b(-5,-1,4,2,WG)

  // Neck staircase
  b(1,-4,1,1,BK); b(4,-4,1,1,BK); b(2,-4,2,1,WH)
  b(2,-5,1,1,BK); b(5,-5,1,1,BK); b(3,-5,2,1,WH)
  b(3,-6,1,1,BK); b(6,-6,1,1,BK); b(4,-6,2,1,WH)
  b(4,-7,1,1,BK); b(7,-7,1,1,BK); b(5,-7,2,1,WH)

  // Head
  b(4,-13,7,1,BK); b(3,-12,1,4,BK); b(11,-12,1,4,BK); b(4,-8,7,1,BK)
  b(4,-12,7,1,WH); b(4,-11,7,1,WH); b(4,-10,7,1,WH); b(4,-9,7,1,WH)
  b(6,-11,2,2,'#080808'); b(7,-12,1,1,'#ffffff')

  // Beak
  b(11,-12,4,1,DO); b(11,-11,5,1,OO); b(15,-11,1,1,DO)
  b(11,-10,4,1,OO); b(14,-10,1,1,DO); b(11,-9,1,1,BK)

  // Hat
  b(3,-14,9,1,DR); b(4,-17,7,3,HR); b(4,-15,7,1,HW)
  b(3,-17,1,3,DR); b(10,-17,1,3,DR); b(3,-18,9,1,BK)

  // Feet
  b(-2,4,2,2,OO); b(2,4,2,2,OO); b(-4,6,5,1,OO); b(2,6,4,1,OO)
  b(-5,6,1,1,DO); b(5,6,1,1,DO)

  // Propeller
  ctx.save()
  ctx.translate(7*P, -19*P); ctx.rotate(propAngle); ctx.imageSmoothingEnabled = false
  ctx.fillStyle = PR; ctx.fillRect(2*P,-P,6*P,2*P)
  ctx.fillStyle = PB; ctx.fillRect(-7*P,-P,6*P,2*P)
  ctx.fillStyle = HH; ctx.fillRect(-P,-P,3*P,2*P)
  ctx.fillStyle = BK; ctx.fillRect(0,0,P,P)
  ctx.restore()
  ctx.restore()
}

function uiText(ctx, text, x, y, size, color, shadowA = 0.38) {
  ctx.font = `bold ${size}px 'Arial Black', Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillStyle = `rgba(0,0,0,${shadowA})`; ctx.fillText(text, x + 3, y + 3)
  ctx.fillStyle = color; ctx.fillText(text, x, y)
}

// ── Level select screen ─────────────────────────────────────────────

function drawLevelSelectScreen(ctx, W, H, hotspots, lvl, best, confirmingDelete) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a4a6c'); bg.addColorStop(1, '#0a2438')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  uiText(ctx, 'LEVELS', W / 2, H * 0.14, 42, '#ffffff', 0.4)

  const back = { x: 16, y: 16, w: 90, h: 32 }
  hotspots.back = back
  drawPillButton(ctx, back, '← Back')

  const cy = H * 0.46
  ctx.fillStyle = 'rgba(0,0,0,0.42)'
  ctx.fillRect(W / 2 - 190, cy - 110, 380, 240)

  ctx.font = 'bold 22px Arial Black, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(lvl.name, W / 2, cy - 64)

  ctx.font = '12px Arial'; ctx.fillStyle = '#9be7ff'
  ctx.fillText(`${lvl.difficulty || (lvl.endless ? 'Endless' : 'Custom')}   •   ${Math.round(lvl.length)} distance   •   ${(lvl.obstacles || []).length} obstacles`, W / 2, cy - 38)

  const stripY = cy - 4, stripW = 320, stripH = 56
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(W / 2 - stripW / 2, stripY, stripW, stripH)
  for (const o of (lvl.obstacles || [])) {
    if (o.type === 'wind') continue
    const px = W / 2 - stripW / 2 + Math.min(1, o.x / lvl.length) * stripW
    const fracY = o.type === 'coin' ? (o.y ?? 0.5) : (o.gapY ?? 0.5)
    const py = stripY + fracY * stripH
    ctx.fillStyle = o.type === 'coin' ? '#FFD700' : o.type === 'moving' ? '#ff9c3c' : '#4fd06a'
    ctx.beginPath(); ctx.arc(px, py, o.type === 'coin' ? 2.5 : 3.5, 0, Math.PI * 2); ctx.fill()
  }

  ctx.font = '13px Arial'; ctx.fillStyle = '#FFD700'
  ctx.fillText(best > 0 ? `Best score: ${best}` : 'Not played yet', W / 2, cy + 66)

  ctx.font = 'bold 22px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('◀', W / 2 - 160, cy)
  ctx.fillText('▶', W / 2 + 160, cy)

  if (!lvl.builtin) {
    const editBtn = { x: W / 2 - 190, y: cy + 92, w: 90, h: 28 }
    const delBtn  = { x: W / 2 + 100, y: cy + 92, w: 90, h: 28 }
    hotspots.editBtn = editBtn; hotspots.deleteBtn = delBtn
    drawPillButton(ctx, editBtn, '✎ Edit')
    drawPillButton(ctx, delBtn, confirmingDelete ? 'Tap again!' : '🗑 Delete')
  } else {
    hotspots.editBtn = null; hotspots.deleteBtn = null
  }

  const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 480)
  ctx.font = '15px Arial'; ctx.fillStyle = `rgba(255,255,255,${pulse})`
  ctx.fillText('tap center to fly', W / 2, H * 0.86)
}

// ── Builder screen ───────────────────────────────────────────────────

function drawBuilderScreen(ctx, W, H, b, frame) {
  const top = BUILDER_TOP_MARGIN, bottom = H - BUILDER_BOTTOM_MARGIN
  ctx.fillStyle = '#0d2438'; ctx.fillRect(0, 0, W, H)
  const skyG = ctx.createLinearGradient(0, top, 0, bottom)
  skyG.addColorStop(0, '#3f7ea8'); skyG.addColorStop(1, '#8fc0dd')
  ctx.fillStyle = skyG; ctx.fillRect(0, top, W, bottom - top)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, top - 2, W, 2)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, bottom, W, 2)

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
  ctx.font = '10px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  const startMark = Math.floor(b.scrollX / 500) * 500
  for (let m = startMark; m <= b.scrollX + W + 500; m += 500) {
    const sx = TRACK_LEFT + (m - b.scrollX)
    if (sx < TRACK_LEFT - 10 || sx > W) continue
    ctx.beginPath(); ctx.moveTo(sx, top); ctx.lineTo(sx, bottom); ctx.stroke()
    ctx.fillText(String(m), sx, top - 8)
  }

  const startSX = TRACK_LEFT + (0 - b.scrollX)
  if (startSX > -20 && startSX < W + 20) {
    ctx.font = '22px Arial'; ctx.textBaseline = 'middle'
    ctx.fillText('🪿', startSX, top + (bottom - top) * 0.5)
    ctx.font = '10px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('START', startSX, bottom + 14)
  }
  const finSX = TRACK_LEFT + (b.length - b.scrollX)
  if (finSX > -20 && finSX < W + 20) {
    drawFinishFlag(ctx, finSX, bottom)
    ctx.font = '10px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('FINISH', finSX, bottom + 14)
  }

  for (let i = 0; i < b.obstacles.length; i++) {
    const o = b.obstacles[i]
    const sx = TRACK_LEFT + (o.x - b.scrollX)
    const selected = i === b.selected
    if (o.type === 'wind') {
      const sx2 = TRACK_LEFT + (o.x + o.width - b.scrollX)
      if (sx2 < 0 || sx > W) continue
      drawWindBand(ctx, Math.max(sx, 0), Math.min(sx2, W), top, bottom, o.force, frame)
      if (selected) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.setLineDash([5, 4])
        ctx.strokeRect(Math.max(sx, 0), top + 2, Math.min(sx2, W) - Math.max(sx, 0), bottom - top - 4)
        ctx.setLineDash([])
      }
    } else if (o.type === 'coin') {
      if (sx < -20 || sx > W + 20) continue
      const sy = top + (o.y ?? 0.5) * (bottom - top)
      drawCoin(ctx, sx, sy, frame)
      if (selected) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2); ctx.stroke()
      }
    } else {
      if (sx < -60 || sx > W + 60) continue
      const { gapTop, gapBottom } = computeGap(o, bottom - top, o.x, false)
      const gT = top + gapTop, gB = top + gapBottom
      ctx.fillStyle = o.type === 'moving' ? 'rgba(255,150,60,0.85)' : 'rgba(60,180,90,0.85)'
      ctx.fillRect(sx - 16, top, 32, gT - top)
      ctx.fillRect(sx - 16, gB, 32, bottom - gB)
      if (o.type === 'moving') {
        const ampPx = (o.amp ?? 0.15) * (bottom - top)
        ctx.strokeStyle = 'rgba(255,220,140,0.7)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(sx - 20, gT - ampPx); ctx.lineTo(sx + 20, gT - ampPx)
        ctx.moveTo(sx - 20, gB + ampPx); ctx.lineTo(sx + 20, gB + ampPx); ctx.stroke()
        ctx.setLineDash([])
      }
      if (selected) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.setLineDash([5, 4])
        ctx.strokeRect(sx - 18, gT - 3, 36, gB - gT + 6)
        ctx.setLineDash([])
      }
    }
  }

  const mmY = H - 34, mmH = 18
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(20, mmY, W - 40, mmH)
  const viewLen = Math.max(1, W - TRACK_LEFT)
  const viewFrac0 = Math.max(0, b.scrollX / b.length)
  const viewFrac1 = Math.min(1, (b.scrollX + viewLen) / b.length)
  ctx.fillStyle = 'rgba(255,215,0,0.55)'
  ctx.fillRect(20 + viewFrac0 * (W - 40), mmY, Math.max(4, (viewFrac1 - viewFrac0) * (W - 40)), mmH)
  for (const o of b.obstacles) {
    const px = 20 + Math.min(1, o.x / b.length) * (W - 40)
    ctx.fillStyle = o.type === 'coin' ? '#FFD700' : o.type === 'wind' ? '#7fd6ff' : o.type === 'moving' ? '#ff9c3c' : '#4fd06a'
    ctx.fillRect(px - 1, mmY, 2, mmH)
  }

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.font = '12px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(`${b.obstacles.length} obstacles  •  length ${Math.round(b.length)}  •  click empty track to place  •  drag to move  •  wheel/drag empty to scroll`, 16, H - 46)
}

function ObstacleFields({ obstacle, onChange }) {
  const set = (k, v) => { obstacle[k] = v; onChange() }
  if (obstacle.type === 'pipe') return (
    <label className={styles.builderLabel}>Gap
      <input type="range" min={0.14} max={0.5} step={0.01} defaultValue={obstacle.gapH}
        onChange={e => set('gapH', parseFloat(e.target.value))} />
    </label>
  )
  if (obstacle.type === 'moving') return (
    <>
      <label className={styles.builderLabel}>Gap
        <input type="range" min={0.14} max={0.5} step={0.01} defaultValue={obstacle.gapH}
          onChange={e => set('gapH', parseFloat(e.target.value))} />
      </label>
      <label className={styles.builderLabel}>Amp
        <input type="range" min={0.05} max={0.35} step={0.01} defaultValue={obstacle.amp}
          onChange={e => set('amp', parseFloat(e.target.value))} />
      </label>
      <label className={styles.builderLabel}>Speed
        <input type="range" min={0.2} max={3} step={0.1} defaultValue={obstacle.speed}
          onChange={e => set('speed', parseFloat(e.target.value))} />
      </label>
    </>
  )
  if (obstacle.type === 'wind') return (
    <>
      <label className={styles.builderLabel}>Width
        <input type="range" min={200} max={1500} step={50} defaultValue={obstacle.width}
          onChange={e => set('width', parseFloat(e.target.value))} />
      </label>
      <label className={styles.builderLabel}>Force
        <input type="range" min={-0.3} max={0.3} step={0.01} defaultValue={obstacle.force}
          onChange={e => set('force', parseFloat(e.target.value))} />
      </label>
    </>
  )
  return null
}

// ── Component ─────────────────────────────────────────────────────────

export default function FlappyGoose() {
  const canvasRef   = useRef(null)
  const rafRef      = useRef(null)
  const highRef     = useRef(0)
  const sizeRef     = useRef({ w: window.innerWidth, h: window.innerHeight })
  const skinIdxRef  = useRef(0)
  const unlockedRef = useRef(['classic'])

  const customLevelsRef  = useRef([])
  const levelBestsRef    = useRef({})
  const levelIdxRef      = useRef(0)
  const confirmDeleteRef = useRef(0)
  const currentLevelDefRef = useRef(null)
  const hotspotsRef      = useRef({})
  const dragRef          = useRef(null)
  const statusRef        = useRef('')
  const statusTimerRef   = useRef(null)

  const builderRef = useRef({
    name: 'My Level', length: 6000, obstacles: [], selected: -1, tool: 'pipe', scrollX: 0, editingId: null,
  })

  const [, setTick] = useState(0)
  const bump = useCallback(() => setTick(t => t + 1), [])
  const setPhase = useCallback((p) => { gameRef.current.state = p; setTick(t => t + 1) }, [])

  const gameRef = useRef({
    state: 'idle', y: window.innerHeight / 2, vel: 0,
    propAngle: 0, propSpeed: 0.07,
    pipes: [], score: 0, frame: 0, groundOff: 0, dist: 0,
    flashTimer: 0, newUnlock: null, bannerTimer: 0, testMode: false,
    level: { id: 'classic', endless: true, length: 0, obstacles: [], pending: [], active: [] },
    clouds: [],
  })

  function allLevels() { return [...BUILTIN_LEVELS, ...customLevelsRef.current] }

  // Load persisted data
  useEffect(() => {
    try {
      highRef.current = parseInt(localStorage.getItem('flappyGooseHigh') || '0')
      const skins = JSON.parse(localStorage.getItem('flappyGooseSkins') || '["classic"]')
      unlockedRef.current = Array.isArray(skins) ? skins : ['classic']
      const savedId = localStorage.getItem('flappyGooseSkin')
      const idx = SKINS.findIndex(s => s.id === savedId && unlockedRef.current.includes(s.id))
      if (idx >= 0) skinIdxRef.current = idx
      const cl = JSON.parse(localStorage.getItem('flappyGooseCustomLevels') || '[]')
      customLevelsRef.current = Array.isArray(cl) ? cl : []
      const lb = JSON.parse(localStorage.getItem('flappyGooseLevelBests') || '{}')
      levelBestsRef.current = (lb && typeof lb === 'object') ? lb : {}
    } catch {}
  }, [])

  // Full-screen canvas + resize
  useEffect(() => {
    const canvas = canvasRef.current
    function resize() {
      const w = window.innerWidth, h = window.innerHeight
      canvas.width = w; canvas.height = h
      sizeRef.current = { w, h }
      const g = gameRef.current
      if (g.state !== 'playing') g.y = h / 2
      g.clouds = Array.from({ length: 8 }, (_, i) => ({
        x: (i / 7) * w + randInt(-30, 30),
        y: randInt(40, Math.round(h * 0.36)),
        spd: 0.18 + Math.random() * 0.3,
        s: 0.7 + Math.random() * 0.6,
      }))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function prevSkin() {
    const unl = unlockedRef.current
    let idx = skinIdxRef.current, tries = SKINS.length
    do { idx = (idx - 1 + SKINS.length) % SKINS.length; tries-- } while (!unl.includes(SKINS[idx].id) && tries > 0)
    skinIdxRef.current = idx
    try { localStorage.setItem('flappyGooseSkin', SKINS[idx].id) } catch {}
  }

  function nextSkin() {
    const unl = unlockedRef.current
    let idx = skinIdxRef.current, tries = SKINS.length
    do { idx = (idx + 1) % SKINS.length; tries-- } while (!unl.includes(SKINS[idx].id) && tries > 0)
    skinIdxRef.current = idx
    try { localStorage.setItem('flappyGooseSkin', SKINS[idx].id) } catch {}
  }

  function prevLevel() { const n = allLevels().length; levelIdxRef.current = (levelIdxRef.current - 1 + n) % n; confirmDeleteRef.current = 0 }
  function nextLevel() { const n = allLevels().length; levelIdxRef.current = (levelIdxRef.current + 1) % n; confirmDeleteRef.current = 0 }

  function startLevel(levelDef, { test = false } = {}) {
    const g = gameRef.current
    const { h: H } = sizeRef.current
    currentLevelDefRef.current = levelDef
    Object.assign(g, {
      state: 'playing', y: H / 2, vel: FLAP_VEL, propSpeed: 0.32,
      frame: 0, groundOff: 0, dist: 0, flashTimer: 0, newUnlock: null, bannerTimer: 0,
      score: 0, testMode: test, pipes: [],
      level: {
        id: levelDef.id, name: levelDef.name, length: levelDef.length,
        endless: !!levelDef.endless, theme: levelDef.theme || null,
        obstacles: levelDef.obstacles || [],
        pending: (levelDef.obstacles || []).filter(o => o.type !== 'wind').slice().sort((a, b) => a.x - b.x),
        active: [],
      },
    })
    setPhase('playing')
  }

  function openBuilder() { setPhase('builder') }

  function playSelectedLevel() {
    const lvl = allLevels()[levelIdxRef.current]
    if (lvl) startLevel(lvl, { test: false })
  }

  function editSelectedLevel() {
    const lvl = allLevels()[levelIdxRef.current]
    if (!lvl || lvl.builtin) return
    builderRef.current = { name: lvl.name, length: lvl.length, obstacles: lvl.obstacles.map(o => ({ ...o })), selected: -1, tool: 'pipe', scrollX: 0, editingId: lvl.id }
    setPhase('builder')
  }

  function deleteSelectedLevel() {
    const now = Date.now()
    if (now - confirmDeleteRef.current < 2200) {
      const lvl = allLevels()[levelIdxRef.current]
      if (!lvl || lvl.builtin) return
      customLevelsRef.current = customLevelsRef.current.filter(l => l.id !== lvl.id)
      try { localStorage.setItem('flappyGooseCustomLevels', JSON.stringify(customLevelsRef.current)) } catch {}
      levelIdxRef.current = Math.max(0, levelIdxRef.current - 1)
      confirmDeleteRef.current = 0
    } else {
      confirmDeleteRef.current = now
    }
  }

  function flashStatus(msg) {
    statusRef.current = msg
    bump()
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => { statusRef.current = ''; bump() }, 2200)
  }

  function testBuilderLevel() {
    const b = builderRef.current
    if (!b.obstacles.length) { flashStatus('Add at least one obstacle first'); return }
    const def = { id: b.editingId || 'draft', name: b.name || 'Test Level', length: b.length, obstacles: b.obstacles.map(o => ({ ...o })) }
    startLevel(def, { test: true })
  }

  function saveBuilderLevel() {
    const b = builderRef.current
    if (!b.obstacles.length) { flashStatus('Add at least one obstacle first'); return }
    const name = (b.name || '').trim() || 'Untitled Level'
    const list = customLevelsRef.current.slice()
    if (b.editingId) {
      const i = list.findIndex(l => l.id === b.editingId)
      const updated = { id: b.editingId, name, length: b.length, difficulty: 'Custom', builtin: false, obstacles: b.obstacles.map(o => ({ ...o })) }
      if (i >= 0) list[i] = updated; else list.push(updated)
    } else {
      const id = 'custom-' + Date.now().toString(36)
      b.editingId = id
      list.push({ id, name, length: b.length, difficulty: 'Custom', builtin: false, obstacles: b.obstacles.map(o => ({ ...o })) })
    }
    customLevelsRef.current = list
    try { localStorage.setItem('flappyGooseCustomLevels', JSON.stringify(list)) } catch {}
    flashStatus('Saved!')
  }

  const flap = useCallback(() => {
    const g = gameRef.current
    if (g.state === 'idle') {
      startLevel({ id: 'classic', endless: true, length: 0, obstacles: [] }, { test: false })
    } else if (g.state === 'playing') {
      g.vel = FLAP_VEL; g.propSpeed = 0.32
    } else if (g.state === 'dead' || g.state === 'levelComplete') {
      if (g.state === 'dead' && g.flashTimer > 0) return
      if (g.testMode) { setPhase('builder'); return }
      if (g.level && !g.level.endless && currentLevelDefRef.current) { startLevel(currentLevelDefRef.current, { test: false }); return }
      setPhase('idle')
    }
  }, [setPhase])

  const handleClick = useCallback((e) => {
    const g = gameRef.current
    const { w: W } = sizeRef.current
    const phase = g.state
    const hs = hotspotsRef.current

    function hit(rect) { return rect && e.clientX >= rect.x && e.clientX <= rect.x + rect.w && e.clientY >= rect.y && e.clientY <= rect.y + rect.h }

    if (phase === 'builder') return

    if (phase === 'idle') {
      if (hit(hs.levelsBtn)) { setPhase('levelSelect'); return }
      if (hit(hs.buildBtn)) { openBuilder(); return }
      if (e.clientX < W * 0.18) { prevSkin(); return }
      if (e.clientX > W * 0.82) { nextSkin(); return }
      flap(); return
    }
    if (phase === 'levelSelect') {
      if (hit(hs.back)) { setPhase('idle'); return }
      if (hit(hs.editBtn)) { editSelectedLevel(); return }
      if (hit(hs.deleteBtn)) { deleteSelectedLevel(); return }
      if (e.clientX < W * 0.18) { prevLevel(); return }
      if (e.clientX > W * 0.82) { nextLevel(); return }
      playSelectedLevel(); return
    }
    if (phase === 'playing') { flap(); return }
    if (phase === 'dead' || phase === 'levelComplete') {
      if (hit(hs.changeLevel)) { setPhase('levelSelect'); return }
      flap(); return
    }
  }, [flap, setPhase])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function addScore(g, n) {
      g.score += n
      const sk = SKINS.find(s => g.score >= s.unlockScore && !unlockedRef.current.includes(s.id))
      if (sk) {
        unlockedRef.current = [...unlockedRef.current, sk.id]
        try { localStorage.setItem('flappyGooseSkins', JSON.stringify(unlockedRef.current)) } catch {}
        g.newUnlock = sk; g.bannerTimer = 150
      }
    }

    function recordScore(g) {
      if (g.level.endless) {
        if (g.score > highRef.current) {
          highRef.current = g.score
          try { localStorage.setItem('flappyGooseHigh', String(g.score)) } catch {}
        }
      } else if (!g.testMode) {
        const id = g.level.id
        const cur = levelBestsRef.current[id] || 0
        if (g.score > cur) {
          levelBestsRef.current = { ...levelBestsRef.current, [id]: g.score }
          try { localStorage.setItem('flappyGooseLevelBests', JSON.stringify(levelBestsRef.current)) } catch {}
        }
      }
    }

    function die(g) {
      if (g.state === 'dead') return
      g.state = 'dead'; g.flashTimer = 14; g.vel = -4
      recordScore(g)
    }

    function completeLevel(g) {
      if (g.state === 'levelComplete') return
      g.state = 'levelComplete'; g.vel = 0
      recordScore(g)
    }

    function step() {
      const g = gameRef.current
      const { w: W, h: H } = sizeRef.current

      if (g.state === 'levelSelect') {
        const lvl = allLevels()[levelIdxRef.current] || BUILTIN_LEVELS[0]
        const best = lvl.endless ? highRef.current : (levelBestsRef.current[lvl.id] || 0)
        const confirming = Date.now() - confirmDeleteRef.current < 2200
        drawLevelSelectScreen(ctx, W, H, hotspotsRef.current, lvl, best, confirming)
        rafRef.current = requestAnimationFrame(step)
        return
      }
      if (g.state === 'builder') {
        drawBuilderScreen(ctx, W, H, builderRef.current, g.frame)
        g.frame++
        rafRef.current = requestAnimationFrame(step)
        return
      }

      const gy        = H - GROUND_H
      const PIPE_GAP   = Math.round(H * 0.27)
      const PIPE_SPAWN = Math.round(285 / PIPE_SPEED)
      const PIPE_MIN   = Math.round(H * 0.10)
      const PIPE_MAX   = gy - PIPE_GAP - PIPE_MIN

      // Update
      if (g.state === 'playing') {
        g.vel = Math.min(g.vel + GRAVITY, 11); g.y += g.vel
        g.frame++; g.groundOff += PIPE_SPEED
        g.propSpeed = Math.max(0.07, g.propSpeed - 0.003)
        if (g.bannerTimer > 0) g.bannerTimer--

        if (g.level.endless) {
          if (g.frame % PIPE_SPAWN === 0)
            g.pipes.push({ x: W + 14, gapTop: randInt(PIPE_MIN, PIPE_MAX), scored: false })
          for (let i = g.pipes.length - 1; i >= 0; i--) {
            const p = g.pipes[i]
            p.x -= PIPE_SPEED
            if (!p.scored && p.x + PIPE_W < GOOSE_X) { p.scored = true; addScore(g, 1) }
            if (p.x < -PIPE_W - 20) { g.pipes.splice(i, 1); continue }
            const HIT = 11, pL = p.x - 7, pR = p.x + PIPE_W + 7
            if (GOOSE_X + HIT > pL && GOOSE_X - HIT < pR)
              if (g.y - HIT < p.gapTop || g.y + HIT > p.gapTop + PIPE_GAP) { die(g); break }
          }
        } else {
          const level = g.level
          g.dist += PIPE_SPEED
          if (g.dist >= level.length) {
            completeLevel(g)
          } else {
            while (level.pending.length && level.pending[0].x - g.dist <= W + 80)
              level.active.push({ def: level.pending.shift(), scored: false, collected: false })

            for (let i = level.active.length - 1; i >= 0; i--) {
              const o = level.active[i]
              const screenX = GOOSE_X + (o.def.x - g.dist)
              if (o.def.type === 'coin') {
                if (!o.collected) {
                  const cy = 40 + (o.def.y ?? 0.5) * (gy - 80)
                  const dx = screenX - GOOSE_X, dy = cy - g.y
                  if (dx*dx + dy*dy < 27*27) { o.collected = true; addScore(g, 5) }
                }
                if (screenX < -60) level.active.splice(i, 1)
              } else {
                const { gapTop, gapBottom } = computeGap(o.def, gy, g.dist, true)
                if (!o.scored && screenX + PIPE_W < GOOSE_X) { o.scored = true; addScore(g, 1) }
                const HIT = 11, pL = screenX - 7, pR = screenX + PIPE_W + 7
                if (GOOSE_X + HIT > pL && GOOSE_X - HIT < pR)
                  if (g.y - HIT < gapTop || g.y + HIT > gapBottom) { die(g); break }
                if (screenX < -PIPE_W - 40) level.active.splice(i, 1)
              }
            }
            for (const def of level.obstacles) {
              if (def.type === 'wind' && g.dist >= def.x && g.dist <= def.x + def.width) g.vel += def.force * 0.06
            }
          }
        }

        if (g.y + 18 >= gy) die(g)
        if (g.y - 58 <= 0)  die(g)

      } else if (g.state === 'dead') {
        if (g.y < gy) { g.vel = Math.min(g.vel + GRAVITY, 11); g.y = Math.min(g.y + g.vel, gy - 1) }
        g.propSpeed = Math.max(0.01, g.propSpeed - 0.002)
        if (g.flashTimer > 0) g.flashTimer--
      } else if (g.state === 'levelComplete') {
        g.y += Math.sin(Date.now() / 300) * 0.15
      } else {
        g.y = H/2 + Math.sin(Date.now()/450) * 8
        g.propSpeed = 0.07 + 0.03 * Math.abs(Math.sin(Date.now()/700))
      }

      g.propAngle += g.propSpeed
      if (g.state === 'playing')
        for (const c of g.clouds) { c.x -= c.spd; if (c.x < -90) c.x = W + 90 }

      // Draw
      ctx.imageSmoothingEnabled = false
      const skin   = SKINS[skinIdxRef.current] || SKINS[0]
      const colors = getSkinColors(skin, g.frame)

      drawSky(ctx, W, H)
      if (g.level && !g.level.endless && g.level.theme) {
        ctx.fillStyle = g.level.theme === 'night' ? 'rgba(10,10,45,0.42)' : 'rgba(255,110,40,0.18)'
        ctx.fillRect(0, 0, W, gy)
      }
      for (const c of g.clouds) drawCloud(ctx, c.x, c.y, c.s)

      if (g.level.endless) {
        for (const p of g.pipes) drawPipe(ctx, p.x, p.gapTop, p.gapTop + PIPE_GAP, H)
      } else {
        for (const def of g.level.obstacles) {
          if (def.type !== 'wind') continue
          const sx1 = GOOSE_X + (def.x - g.dist), sx2 = GOOSE_X + (def.x + def.width - g.dist)
          if (sx2 < -50 || sx1 > W + 50) continue
          drawWindBand(ctx, Math.max(sx1, -50), Math.min(sx2, W + 50), 0, gy, def.force, g.frame)
        }
        for (const o of g.level.active) {
          const screenX = GOOSE_X + (o.def.x - g.dist)
          if (o.def.type === 'coin') {
            if (!o.collected) drawCoin(ctx, screenX, 40 + (o.def.y ?? 0.5) * (gy - 80), g.frame)
          } else {
            const { gapTop, gapBottom } = computeGap(o.def, gy, g.dist, true)
            drawPipe(ctx, screenX, gapTop, gapBottom, H)
          }
        }
        const fx = GOOSE_X + (g.level.length - g.dist)
        if (fx > -40 && fx < W + 40) drawFinishFlag(ctx, fx, gy)
      }

      drawGround(ctx, g.groundOff, W, H)

      if (g.state === 'dead' && g.flashTimer > 0) {
        ctx.fillStyle = `rgba(255,255,255,${g.flashTimer/14})`; ctx.fillRect(0, 0, W, H)
      }

      drawGoosePixel(ctx, GOOSE_X, g.y, g.vel, g.propAngle, colors)

      // Score HUD
      if (g.state === 'playing') {
        uiText(ctx, g.score, W/2, 56, 46, '#ffffff')
        if (!g.level.endless) {
          const barW = 160, barX = W/2 - barW/2, barY = 14
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(barX, barY, barW, 10)
          const prog = Math.min(1, g.dist / g.level.length)
          ctx.fillStyle = '#FFD700'; ctx.fillRect(barX, barY, barW*prog, 10)
          ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
          ctx.fillText(g.level.name, W/2, barY - 4)
        }
      }

      // Unlock banner (in-game)
      if (g.bannerTimer > 0 && g.newUnlock) {
        const a = Math.min(1, g.bannerTimer/20) * Math.min(1, (150 - g.bannerTimer + 20)/20)
        ctx.fillStyle = `rgba(0,0,0,${0.72*a})`
        ctx.fillRect(W/2 - 190, 12, 380, 48)
        ctx.font = 'bold 15px Arial Black, Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,215,0,${a})`
        ctx.fillText(`🔓  Unlocked: ${g.newUnlock.name}!`, W/2, 42)
      }

      // Idle screen
      if (g.state === 'idle') {
        uiText(ctx, 'FLAPPY', W/2, H/2 - 92, 52, '#ffffff', 0.35)
        uiText(ctx, 'GOOSE',  W/2, H/2 - 42, 52, '#FFD700', 0.45)
        ctx.font = '17px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText('🪿  propeller-powered adventure', W/2+1, H/2-3)
        ctx.fillStyle = '#ffffff';           ctx.fillText('🪿  propeller-powered adventure', W/2,   H/2-4)
        if (highRef.current > 0) {
          ctx.font = 'bold 19px Arial'; ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText(`Best: ${highRef.current}`, W/2+1, H/2+25)
          ctx.fillStyle = '#FFD700'; ctx.fillText(`Best: ${highRef.current}`, W/2, H/2+24)
        }
        const pulse = 0.55 + 0.45 * Math.sin(Date.now()/480)
        ctx.font = '15px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,255,255,${pulse})`
        ctx.fillText('tap / click / space  to start', W/2, H/2+56)

        // Skin selector
        const selY = H/2 + 112
        const activeSkin = SKINS[skinIdxRef.current] || SKINS[0]
        const unl = unlockedRef.current
        ctx.fillStyle = 'rgba(0,0,0,0.44)'
        ctx.fillRect(W/2 - 150, selY - 30, 300, 54)
        ctx.font = '11px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillText('SKIN  (◀ / ▶ to change)', W/2, selY - 16)
        ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillText('◀', W/2 - 116, selY + 12)
        ctx.fillText('▶', W/2 + 116, selY + 12)
        ctx.font = 'bold 17px Arial Black, Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText(activeSkin.name, W/2+1, selY+13)
        ctx.fillStyle = colors.WH || '#ffffff'; ctx.fillText(activeSkin.name, W/2, selY+12)

        // Next unlock hint
        const nextSk = SKINS.find(s => !unl.includes(s.id))
        if (nextSk) {
          ctx.font = '12px Arial'; ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(255,255,255,0.38)'
          ctx.fillText(`Score ${nextSk.unlockScore} → ${nextSk.name}`, W/2, selY + 34)
        }

        // Progress dots
        const dotY = selY + 54
        const spacing = 20
        const startDotX = W/2 - ((SKINS.length-1) * spacing) / 2
        for (let i = 0; i < SKINS.length; i++) {
          const unlocked = unl.includes(SKINS[i].id)
          const selected = i === skinIdxRef.current
          ctx.beginPath()
          ctx.arc(startDotX + i*spacing, dotY, selected ? 5.5 : 3.5, 0, Math.PI*2)
          ctx.fillStyle = unlocked ? (selected ? '#FFD700' : 'rgba(255,255,255,0.72)') : 'rgba(255,255,255,0.2)'
          ctx.fill()
        }

        // Levels / Build buttons
        const btnY = H - 46, btnH = 30
        const levelsBtnRect = { x: W/2 - 150, y: btnY, w: 140, h: btnH }
        const buildBtnRect  = { x: W/2 + 10,  y: btnY, w: 140, h: btnH }
        hotspotsRef.current.levelsBtn = levelsBtnRect
        hotspotsRef.current.buildBtn  = buildBtnRect
        drawPillButton(ctx, levelsBtnRect, '🗺 LEVELS')
        drawPillButton(ctx, buildBtnRect, '🛠 BUILD')
      }

      // Dead screen
      if (g.state === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.46)'; ctx.fillRect(0, 0, W, H)
        uiText(ctx, 'HONK!', W/2, H/2 - 78, 62, '#FF6B00', 0.5)
        uiText(ctx, `Score: ${g.score}`, W/2, H/2 - 12, 38, '#ffffff')
        if (g.newUnlock) {
          uiText(ctx, `🔓 ${g.newUnlock.name} unlocked!`, W/2, H/2 + 28, 21, '#FFD700', 0.25)
        } else if (g.level.endless && g.score > 0 && g.score >= highRef.current) {
          uiText(ctx, '🏆 New Record!', W/2, H/2 + 28, 22, '#FFD700', 0.3)
        } else if (g.level.endless) {
          uiText(ctx, `Best: ${highRef.current}`, W/2, H/2 + 28, 22, '#cccc88', 0.25)
        } else {
          const best = levelBestsRef.current[g.level.id] || 0
          uiText(ctx, g.score >= best && g.score > 0 ? '🏆 New Best!' : `Best: ${best}`, W/2, H/2 + 28, 22, '#cccc88', 0.25)
        }
        if (g.level.endless) {
          const next = SKINS.find(s => !unlockedRef.current.includes(s.id))
          if (next) {
            ctx.font = '13px Arial'; ctx.textAlign = 'center'
            ctx.fillStyle = 'rgba(255,255,255,0.44)'
            ctx.fillText(`Score ${next.unlockScore} to unlock ${next.name}`, W/2, H/2 + 58)
          }
        }
        const p2 = 0.5 + 0.5 * Math.sin(Date.now()/520)
        ctx.font = '15px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,255,255,${p2})`
        ctx.fillText(g.testMode ? 'tap to return to builder' : 'tap to try again', W/2, H/2 + 82)

        if (!g.level.endless && !g.testMode) {
          const rect = { x: W/2 - 70, y: H/2 + 104, w: 140, h: 30 }
          hotspotsRef.current.changeLevel = rect
          drawPillButton(ctx, rect, '🗺 Select Level')
        } else {
          hotspotsRef.current.changeLevel = null
        }
      }

      // Level complete screen
      if (g.state === 'levelComplete') {
        ctx.fillStyle = 'rgba(0,0,20,0.5)'; ctx.fillRect(0, 0, W, H)
        uiText(ctx, '🏁 LEVEL COMPLETE!', W/2, H/2 - 80, 38, '#7CFF9E', 0.5)
        uiText(ctx, `Score: ${g.score}`, W/2, H/2 - 20, 34, '#ffffff')
        const best = g.testMode ? 0 : (levelBestsRef.current[g.level.id] || 0)
        ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = g.score >= best ? '#FFD700' : '#cccc88'
        ctx.fillText(!g.testMode && g.score >= best ? '🏆 New Best!' : (g.testMode ? 'Test run' : `Best: ${best}`), W/2, H/2 + 16)
        if (g.newUnlock) uiText(ctx, `🔓 ${g.newUnlock.name} unlocked!`, W/2, H/2 + 48, 18, '#FFD700', 0.25)
        const p2 = 0.5 + 0.5 * Math.sin(Date.now()/520)
        ctx.font = '15px Arial'; ctx.fillStyle = `rgba(255,255,255,${p2})`
        ctx.fillText(g.testMode ? 'tap to return to builder' : 'tap to continue', W/2, H/2 + 78)

        if (!g.testMode) {
          const rect = { x: W/2 - 70, y: H/2 + 100, w: 140, h: 30 }
          hotspotsRef.current.changeLevel = rect
          drawPillButton(ctx, rect, '🗺 Select Level')
        } else {
          hotspotsRef.current.changeLevel = null
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // Builder mouse interaction (mousedown/move/up/wheel), no-op outside 'builder' phase
  useEffect(() => {
    const canvas = canvasRef.current

    function levelXY(cx, cy) {
      const { h: H } = sizeRef.current
      const top = BUILDER_TOP_MARGIN, bottom = H - BUILDER_BOTTOM_MARGIN
      const x = builderRef.current.scrollX + (cx - TRACK_LEFT)
      const frac = Math.max(0.04, Math.min(0.96, (cy - top) / (bottom - top)))
      return { x: Math.max(0, x), frac }
    }

    function hitObstacle(cx, cy) {
      const { h: H } = sizeRef.current
      const b = builderRef.current
      const top = BUILDER_TOP_MARGIN, bottom = H - BUILDER_BOTTOM_MARGIN
      for (let i = b.obstacles.length - 1; i >= 0; i--) {
        const o = b.obstacles[i]
        const sx = TRACK_LEFT + (o.x - b.scrollX)
        if (o.type === 'wind') {
          const sx2 = TRACK_LEFT + (o.x + o.width - b.scrollX)
          if (cx >= sx && cx <= sx2 && cy >= top && cy <= bottom) return i
          continue
        }
        const fracY = o.type === 'coin' ? (o.y ?? 0.5) : (o.gapY ?? 0.5)
        const sy = top + fracY * (bottom - top)
        if (Math.abs(cx - sx) < 28 && Math.abs(cy - sy) < 32) return i
      }
      return -1
    }

    function placeObstacle(b, x, frac) {
      const type = b.tool
      const base = { type, x: Math.round(x) }
      let o
      if (type === 'pipe') o = { ...base, gapY: frac, gapH: 0.27 }
      else if (type === 'moving') o = { ...base, gapY: frac, gapH: 0.24, amp: 0.18, speed: 1.1 }
      else if (type === 'coin') o = { ...base, y: frac }
      else if (type === 'wind') o = { ...base, width: 500, force: -0.15 }
      else return
      b.obstacles.push(o)
      b.obstacles.sort((a, z) => a.x - z.x)
      b.selected = b.obstacles.indexOf(o)
      if (o.x + (o.width || 0) + 600 > b.length) b.length = o.x + (o.width || 0) + 600
    }

    function onDown(e) {
      if (gameRef.current.state !== 'builder') return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const { h: H } = sizeRef.current
      const b = builderRef.current
      const mmY = H - 34
      if (cy >= mmY && cy <= mmY + 18) {
        const frac = Math.max(0, Math.min(1, (cx - 20) / (sizeRef.current.w - 40)))
        b.scrollX = Math.max(0, frac * b.length - (sizeRef.current.w - TRACK_LEFT) / 2)
        bump(); return
      }
      const idx = hitObstacle(cx, cy)
      if (idx >= 0) {
        b.selected = idx
        dragRef.current = { idx, startX: cx, startY: cy, panning: false }
        bump()
      } else {
        b.selected = -1
        dragRef.current = { idx: -1, startX: cx, startY: cy, startScroll: b.scrollX, panning: true }
        bump()
      }
    }

    function onMove(e) {
      if (gameRef.current.state !== 'builder' || !dragRef.current) return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const b = builderRef.current
      const d = dragRef.current
      if (d.panning) {
        b.scrollX = Math.max(0, d.startScroll - (cx - d.startX))
        bump(); return
      }
      if (d.idx >= 0) {
        const o = b.obstacles[d.idx]
        const { x, frac } = levelXY(cx, cy)
        o.x = Math.max(0, Math.round(x))
        if (o.type === 'coin') o.y = frac
        else if (o.type !== 'wind') o.gapY = frac
        if (o.x + (o.width || 0) + 500 > b.length) b.length = o.x + (o.width || 0) + 500
        bump()
      }
    }

    function onUp(e) {
      if (gameRef.current.state !== 'builder') return
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const d = dragRef.current
      const b = builderRef.current
      if (d && d.panning) {
        const moved = Math.abs(cx - d.startX) + Math.abs(cy - d.startY)
        if (moved < 6) {
          const { x, frac } = levelXY(cx, cy)
          placeObstacle(b, x, frac)
          bump()
        }
      }
      dragRef.current = null
    }

    function onWheel(e) {
      if (gameRef.current.state !== 'builder') return
      e.preventDefault()
      const b = builderRef.current
      b.scrollX = Math.max(0, Math.min(b.length, b.scrollX + (e.deltaX || e.deltaY)))
      bump()
    }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [bump])

  useEffect(() => {
    function onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      const g = gameRef.current
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap() }
      if (e.code === 'ArrowLeft')  { if (g.state === 'idle') prevSkin(); else if (g.state === 'levelSelect') prevLevel() }
      if (e.code === 'ArrowRight') { if (g.state === 'idle') nextSkin(); else if (g.state === 'levelSelect') nextLevel() }
      if (e.code === 'Enter' && g.state === 'levelSelect') playSelectedLevel()
      if (e.code === 'Escape' && g.state === 'levelSelect') setPhase('idle')
      if (e.code === 'Escape' && g.state === 'builder') { builderRef.current.selected = -1; bump() }
      if ((e.code === 'Delete' || e.code === 'Backspace') && g.state === 'builder') {
        e.preventDefault()
        const b = builderRef.current
        if (b.selected >= 0) { b.obstacles.splice(b.selected, 1); b.selected = -1; bump() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap, setPhase, bump])

  useEffect(() => {
    const canvas = canvasRef.current
    function onTouch(e) {
      if (gameRef.current.state === 'builder') return
      e.preventDefault()
      const touch = e.touches[0]
      if (!touch) return
      const g = gameRef.current
      const { w: W } = sizeRef.current
      if (g.state === 'idle') {
        if (touch.clientX < W * 0.18) { prevSkin(); return }
        if (touch.clientX > W * 0.82) { nextSkin(); return }
      }
      flap()
    }
    canvas.addEventListener('touchstart', onTouch, { passive: false })
    return () => canvas.removeEventListener('touchstart', onTouch)
  }, [flap])

  const b = builderRef.current
  const selectedObstacle = b.selected >= 0 ? b.obstacles[b.selected] : null

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} onClick={handleClick} />
      {gameRef.current.state !== 'builder' && gameRef.current.state !== 'levelSelect' && (
        <Link to="/" className={styles.homeLink}>← GameHub</Link>
      )}
      {gameRef.current.state === 'builder' && (
        <div className={styles.builderBar}>
          <input className={styles.builderInput} style={{ width: 140 }} placeholder="Level name"
            defaultValue={b.name}
            onBlur={e => { b.name = e.target.value || 'Untitled Level' }} />
          <span className={styles.builderLabel}>Length</span>
          <input className={styles.builderInput} style={{ width: 70 }} type="number" min={1500} max={20000} step={100}
            defaultValue={b.length}
            onBlur={e => { b.length = Math.max(1500, parseInt(e.target.value, 10) || b.length); bump() }} />
          <div className={styles.builderDivider} />
          {[['pipe', '🟢 Pipe'], ['moving', '🟠 Moving'], ['coin', '🪙 Coin'], ['wind', '💨 Wind']].map(([id, label]) => (
            <button key={id}
              className={`${styles.builderBtn} ${b.tool === id ? styles.builderBtnActive : ''}`}
              onClick={() => { b.tool = id; bump() }}>{label}</button>
          ))}
          <div className={styles.builderDivider} />
          {selectedObstacle && (
            <ObstacleFields key={b.selected} obstacle={selectedObstacle} onChange={bump} />
          )}
          <button className={styles.builderBtn} disabled={b.selected < 0}
            onClick={() => { if (b.selected >= 0) { b.obstacles.splice(b.selected, 1); b.selected = -1; bump() } }}>🗑 Delete</button>
          <div className={styles.builderSpacer} />
          {statusRef.current && <span className={styles.builderStatus}>{statusRef.current}</span>}
          <button className={styles.builderBtn}
            onClick={() => { builderRef.current = { name: 'My Level', length: 6000, obstacles: [], selected: -1, tool: 'pipe', scrollX: 0, editingId: null }; bump() }}>🆕 New</button>
          <button className={styles.builderBtn} onClick={testBuilderLevel}>▶ Test</button>
          <button className={`${styles.builderBtn} ${styles.builderBtnPrimary}`} onClick={saveBuilderLevel}>💾 Save</button>
          <button className={styles.builderBtn} onClick={() => setPhase('idle')}>✕ Close</button>
        </div>
      )}
    </div>
  )
}
