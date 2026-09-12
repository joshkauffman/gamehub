// ── Shirby and the Forgotten Place — rendering ────────────────────────
// Pure canvas drawing. Reads state produced by engine.js; never mutates it.

import { W, H, GROUND_Y, THEMES, ENEMY_DEFS, POWERS, MEGA_POWERS, getPowerDisplay } from './constants.js'
import { LEVELS } from './levels.js'
import { currentLevel } from './engine.js'

const BOSS_NAMES = {
  teddy: 'The Moth-Eaten Teddy',
  gnome: 'Gnome Gargantuan',
  cabinet: 'Cabinet Colossus',
  lostfound: 'The Lost & Found',
  lurker: 'The Closet Lurker',
}

function drawBackground(ctx, theme, camX, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, theme.sky[0])
  g.addColorStop(1, theme.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  if (theme.clouds) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 8; i++) {
      const x = ((i * 300 - camX * 0.3) % (W + 300) + (W + 300)) % (W + 300) - 150
      const y = 60 + (i % 3) * 40
      ctx.beginPath()
      ctx.arc(x, y, 22, 0, Math.PI * 2)
      ctx.arc(x + 26, y - 8, 17, 0, Math.PI * 2)
      ctx.arc(x + 46, y + 2, 19, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (theme.hills) {
    ctx.fillStyle = 'rgba(60,140,60,0.5)'
    for (let i = 0; i < 6; i++) {
      const x = ((i * 420 - camX * 0.6) % (W + 200) + (W + 200)) % (W + 200) - 100
      ctx.beginPath(); ctx.arc(x, GROUND_Y + 10, 60, Math.PI, 0); ctx.fill()
    }
  }
  if (theme.dust) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    for (let i = 0; i < 30; i++) {
      const x = ((i * 137 - camX * 0.4) % (W + 60) + (W + 60)) % (W + 60) - 30
      const y = (i * 71 + Math.sin(frame * 0.01 + i) * 20) % H
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill()
    }
  }
  if (theme.glow) {
    ctx.strokeStyle = 'rgba(180,120,255,0.12)'
    ctx.lineWidth = 2
    for (let y = 0; y < H; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  }
  if (theme.haze) {
    ctx.fillStyle = 'rgba(180,160,100,0.12)'
    for (let i = 0; i < 5; i++) {
      const x = ((i * 260 - camX * 0.4) % (W + 200) + (W + 200)) % (W + 200) - 100
      ctx.beginPath(); ctx.arc(x, H - 20, 90, Math.PI, 0); ctx.fill()
    }
  }
  if (theme.eyes) {
    // pairs of glowing eyes in the dark, blinking in and out — something's
    // always watching in the Under-the-Bed Deep, never quite where you
    // just looked.
    for (let i = 0; i < 6; i++) {
      const x = ((i * 240 - camX * 0.35) % (W + 200) + (W + 200)) % (W + 200) - 100
      const y = 90 + (i % 4) * 80
      if (Math.sin(frame * 0.02 + i * 3) > -0.8) {
        ctx.fillStyle = '#ffcf60'
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.arc(x + 15, y, 3, 0, Math.PI * 2); ctx.fill()
      }
    }
  }
}

function drawGround(ctx, theme, level, camX) {
  ctx.fillStyle = theme.void
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
  for (const seg of level.groundSegments) {
    const x0 = seg.x0 - camX, x1 = seg.x1 - camX
    if (x1 < 0 || x0 > W) continue
    ctx.fillStyle = theme.ground
    ctx.fillRect(x0, GROUND_Y, x1 - x0, H - GROUND_Y)
    ctx.fillStyle = theme.groundTop
    ctx.fillRect(x0, GROUND_Y, x1 - x0, 12)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    for (let x = Math.max(x0, 0); x < x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 12); ctx.lineTo(x, H); ctx.stroke() }
  }
}

function drawBlock(ctx, theme, b, camX) {
  const x = b.x - camX, y = b.y - (b.bump > 0 ? Math.sin(b.bump / 8 * Math.PI) * 8 : 0)
  if (x < -50 || x > W + 50) return
  if (b.kind === 'question') {
    ctx.fillStyle = b.used ? '#8a6a3a' : '#e0a94e'
    ctx.fillRect(x, y, b.w, b.h)
    ctx.strokeStyle = '#5c3d17'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2)
    if (!b.used) {
      ctx.fillStyle = '#fff8e0'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('?', x + b.w / 2, y + b.h / 2 + 1)
    }
  } else if (b.kind === 'brick') {
    ctx.fillStyle = theme.groundTop
    ctx.fillRect(x, y, b.w, b.h)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5
    ctx.strokeRect(x + 2, y + 2, b.w - 4, b.h - 4)
  }
}

function drawEyes(ctx, cx, cy, spread, size) {
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(cx - spread, cy, size, 0, Math.PI * 2); ctx.arc(cx + spread, cy, size, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath(); ctx.arc(cx - spread, cy, size * 0.5, 0, Math.PI * 2); ctx.arc(cx + spread, cy, size * 0.5, 0, Math.PI * 2); ctx.fill()
}

function drawEnemy(ctx, e, camX, frame) {
  const x = e.x - camX
  if (x < -50 || x > W + 50) return
  const def = ENEMY_DEFS[e.type]
  const squished = e.squish > 0
  ctx.save()
  ctx.translate(x + e.w / 2, e.y + e.h)
  if (squished) ctx.scale(1.3, 0.35)

  if (def.kind === 'fly') {
    // moth: body + a pair of wings that flap
    const flap = Math.sin(frame * 0.4) * 0.5 + 0.5
    ctx.fillStyle = def.color
    ctx.save(); ctx.scale(1, flap * 0.6 + 0.4)
    ctx.beginPath(); ctx.ellipse(-e.w * 0.4, -e.h * 0.5, e.w * 0.32, e.h * 0.4, 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(e.w * 0.4, -e.h * 0.5, e.w * 0.32, e.h * 0.4, -0.3, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.beginPath(); ctx.ellipse(0, -e.h / 2, e.w * 0.32, e.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    if (e.type === 'whirlwindwisp') {
      // a little spinning cyclone swirl, always turning
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        const a = frame * 0.3 + i * 2.1
        const rr = 6 + i * 4
        ctx.beginPath(); ctx.arc(0, -e.h / 2, rr, a, a + 3.6); ctx.stroke()
      }
    }
    if (e.type === 'lintghost') {
      // a fuzzy dust-bunny-like tuft trailing off the body
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + Math.sin(frame * 0.1 + i) * 0.3
        ctx.beginPath(); ctx.arc(Math.cos(a) * e.w * 0.3, -e.h / 2 + Math.sin(a) * e.h * 0.35, 3, 0, Math.PI * 2); ctx.fill()
      }
    }
  } else if (def.kind === 'bob') {
    ctx.fillStyle = 'rgba(150,220,255,0.25)'
    ctx.beginPath(); ctx.arc(0, -e.h / 2, e.w * 0.75, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = def.color
    ctx.beginPath(); ctx.ellipse(0, -e.h / 2, e.w / 2, e.h / 2.4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = def.color
    ctx.beginPath(); ctx.moveTo(-e.w / 2, -e.h / 2); ctx.lineTo(-e.w * 0.8, -e.h / 2 - 6); ctx.lineTo(-e.w * 0.8, -e.h / 2 + 6); ctx.closePath(); ctx.fill()
  } else if (e.type === 'spikeball') {
    ctx.fillStyle = def.color
    ctx.beginPath(); ctx.arc(0, -e.h / 2, e.w / 2, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#111'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + frame * 0.05
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * e.w * 0.4, -e.h / 2 + Math.sin(a) * e.w * 0.4)
      ctx.lineTo(Math.cos(a) * e.w * 0.7, -e.h / 2 + Math.sin(a) * e.w * 0.7)
      ctx.stroke()
    }
  } else if (def.kind === 'erratic') {
    // a flickery, glitchy little blob — jitters its own outline
    const jit = () => (Math.random() - 0.5) * 3
    ctx.fillStyle = def.color
    ctx.globalAlpha = 0.7 + Math.random() * 0.3
    ctx.beginPath(); ctx.ellipse(jit(), -e.h / 2 + jit(), e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    if (e.type === 'sockpuppet') {
      // a floppy toe-end flapping loose off the top, like a sock with a
      // mind of its own
      ctx.fillStyle = def.color
      const flop = Math.sin(frame * 0.3) * 6
      ctx.beginPath(); ctx.ellipse(flop, -e.h * 0.95, e.w * 0.28, e.h * 0.22, flop * 0.05, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.ellipse(0, -e.h * 0.15, e.w * 0.3, e.h * 0.12, 0, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.fillStyle = def.color
    ctx.beginPath(); ctx.ellipse(0, -e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    if (e.type === 'bladebeetle') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath(); ctx.moveTo(e.w * 0.3, -e.h * 0.7); ctx.lineTo(e.w * 0.9, -e.h * 1.1); ctx.lineTo(e.w * 0.55, -e.h * 0.55); ctx.closePath(); ctx.fill()
    }
    if (e.type === 'pebblegolem') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.beginPath(); ctx.arc(-e.w * 0.15, -e.h * 0.65, 4, 0, Math.PI * 2); ctx.arc(e.w * 0.1, -e.h * 0.4, 3, 0, Math.PI * 2); ctx.fill()
    }
    if (e.type === 'staticsock') {
      ctx.strokeStyle = '#fff8b0'; ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        const a = frame * 0.2 + i * 2
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * e.w * 0.6, -e.h / 2 + Math.sin(a) * e.h * 0.6); ctx.lineTo(Math.cos(a) * e.w * 0.9, -e.h / 2 + Math.sin(a) * e.h * 0.9); ctx.stroke()
      }
    }
    if (e.type === 'bedspring') {
      // a coiled zigzag poking up out of the body, like a mattress spring
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 4; i++) {
        const sx = (i % 2 === 0 ? -1 : 1) * e.w * 0.22
        ctx.lineTo(sx, -e.h * (0.55 + i * 0.16))
      }
      ctx.stroke()
    }
  }
  if (!squished && def.kind !== 'erratic') drawEyes(ctx, 0, -e.h / 2 - e.h * 0.05, e.w * 0.16, 4)
  ctx.restore()
}

// Bosses are drawn as a big round body plus a per-boss "hat/prop" so each
// one reads as its own character without needing four unrelated shapes.
function drawBoss(ctx, boss, camX, frame) {
  if (!boss.alive) return
  const x = boss.x - camX
  if (x < -120 || x > W + 120) return
  const flash = boss.invincible > 0 && Math.floor(boss.invincible / 4) % 2 === 0
  const theme = THEMES[
    boss.shape === 'teddy' ? 'attic' : boss.shape === 'gnome' ? 'garden' : boss.shape === 'cabinet' ? 'arcade'
      : boss.shape === 'lurker' ? 'underbed' : 'landfill'
  ]
  ctx.save()
  ctx.translate(x + boss.w / 2, boss.y + boss.h)
  ctx.fillStyle = flash ? '#ffffff' : theme.groundTop
  ctx.beginPath(); ctx.ellipse(0, -boss.h * 0.55, boss.w * 0.5, boss.h * 0.5, 0, 0, Math.PI * 2); ctx.fill()

  if (boss.shape === 'teddy') {
    ctx.fillStyle = flash ? '#eee' : '#7a5030'
    ctx.beginPath(); ctx.arc(-boss.w * 0.36, -boss.h * 0.95, boss.w * 0.16, 0, Math.PI * 2); ctx.arc(boss.w * 0.36, -boss.h * 0.95, boss.w * 0.16, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#4a3020'
    ctx.beginPath(); ctx.ellipse(0, -boss.h * 0.4, boss.w * 0.14, boss.h * 0.1, 0, 0, Math.PI * 2); ctx.fill()
  } else if (boss.shape === 'gnome') {
    ctx.fillStyle = flash ? '#eee' : '#c9503a'
    ctx.beginPath()
    ctx.moveTo(-boss.w * 0.32, -boss.h * 0.85); ctx.lineTo(0, -boss.h * 1.45); ctx.lineTo(boss.w * 0.32, -boss.h * 0.85)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.ellipse(0, -boss.h * 0.5, boss.w * 0.22, boss.h * 0.14, 0, 0, Math.PI * 2); ctx.fill()
  } else if (boss.shape === 'cabinet') {
    ctx.fillStyle = flash ? '#eee' : '#1a1030'
    ctx.fillRect(-boss.w * 0.34, -boss.h * 1.05, boss.w * 0.68, boss.h * 0.4)
    ctx.fillStyle = flash ? '#fff' : '#5c9aff'
    ctx.fillRect(-boss.w * 0.26, -boss.h * 0.98, boss.w * 0.52, boss.h * 0.26)
  } else if (boss.shape === 'lostfound') {
    ctx.fillStyle = flash ? '#eee' : '#6b5a2f'
    ctx.beginPath()
    ctx.moveTo(-boss.w * 0.5, -boss.h * 0.85); ctx.lineTo(-boss.w * 0.3, -boss.h * 1.25); ctx.lineTo(boss.w * 0.3, -boss.h * 1.25); ctx.lineTo(boss.w * 0.5, -boss.h * 0.85)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#1a1408'
    ctx.beginPath(); ctx.ellipse(0, -boss.h * 0.55, boss.w * 0.3, boss.h * 0.18, 0, 0, Math.PI); ctx.fill()
  } else if (boss.shape === 'lurker') {
    // a ragged dark cloak-shape looming up out of the closet, with far too
    // many eyes for one thing to reasonably have
    ctx.fillStyle = flash ? '#eee' : '#140a1e'
    ctx.beginPath()
    ctx.moveTo(-boss.w * 0.52, -boss.h * 0.75)
    ctx.lineTo(-boss.w * 0.42, -boss.h * 1.35); ctx.lineTo(-boss.w * 0.2, -boss.h * 1.1)
    ctx.lineTo(0, -boss.h * 1.5); ctx.lineTo(boss.w * 0.2, -boss.h * 1.1)
    ctx.lineTo(boss.w * 0.42, -boss.h * 1.35); ctx.lineTo(boss.w * 0.52, -boss.h * 0.75)
    ctx.closePath(); ctx.fill()
    if (!flash) {
      ctx.fillStyle = '#ffcf60'
      const extraEyes = [[-0.28, -0.9], [0.3, -0.95], [-0.14, -1.15], [0.16, -1.12]]
      for (const [ex, ey] of extraEyes) {
        ctx.beginPath(); ctx.arc(boss.w * ex, boss.h * ey, 2.4, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  drawEyes(ctx, 0, -boss.h * 0.58, boss.w * 0.16, boss.shape === 'lostfound' || boss.shape === 'lurker' ? 6 : 5)
  ctx.restore()
}

function drawProjectile(ctx, pr, camX, frame) {
  const x = pr.x - camX
  ctx.save()
  ctx.translate(x, pr.y)
  if (pr.kind === 'star') {
    ctx.rotate(frame * 0.4)
    ctx.fillStyle = pr.weak ? '#c9a6ff' : '#ffd93d'
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2, a2 = a1 + Math.PI / 5
      ctx.lineTo(Math.cos(a1) * 10, Math.sin(a1) * 10)
      ctx.lineTo(Math.cos(a2) * 4.5, Math.sin(a2) * 4.5)
    }
    ctx.closePath(); ctx.fill()
  } else if (pr.kind === 'frost') {
    ctx.fillStyle = '#8fe0ff'
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke() }
  } else if (pr.kind === 'bubble') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.fillStyle = 'rgba(150,220,255,0.35)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  } else if (pr.kind === 'lob') {
    ctx.fillStyle = '#a04ad0'
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill()
  } else if (pr.kind === 'mega') {
    // Each projectile "family" (see pshape in megaFireProjectile, engine.js)
    // gets a genuinely different silhouette, not just a recolored orb.
    const r = pr.big ? 12 : 8
    ctx.fillStyle = pr.color
    if (pr.pshape === 'pierce') {
      // an elongated streak, oriented along its actual flight direction
      const ang = Math.atan2(pr.vy, pr.vx)
      ctx.rotate(ang)
      ctx.globalAlpha = 0.4
      ctx.beginPath(); ctx.ellipse(0, 0, r * 2.6, r * 0.7, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill()
    } else if (pr.pshape === 'bounce') {
      // a core dot plus a trailing comic-swoosh arc, like a ball with spin
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = pr.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.6
      ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 1.6, 0.3, 2.2); ctx.stroke()
      ctx.globalAlpha = 1
    } else if (pr.pshape === 'burst') {
      // a core with a wide, faint pulsing danger-ring around it
      const pulse = 1 + Math.sin(frame * 0.3) * 0.15
      ctx.globalAlpha = 0.25
      ctx.beginPath(); ctx.arc(0, 0, r * 2.4 * pulse, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    } else if (pr.pshape === 'fall') {
      // a heavy teardrop with a short trail, falling-rock silhouette
      ctx.beginPath()
      ctx.moveTo(0, -r * 1.6)
      ctx.quadraticCurveTo(r * 1.3, 0, 0, r * 1.1)
      ctx.quadraticCurveTo(-r * 1.3, 0, 0, -r * 1.6)
      ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke()
    } else if (pr.pshape === 'spread') {
      // a small plain dot — already reads as distinct by arriving in 3s
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.globalAlpha = 0.35
      ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke()
    }
  }
  ctx.restore()
}

function drawButton(ctx, c, camX, frame) {
  if (c.taken) return
  const x = c.x - camX
  if (x < -30 || x > W + 30) return
  const s = Math.abs(Math.sin(frame * 0.08 + c.x))
  ctx.save()
  ctx.translate(x + c.w / 2, c.y + c.h / 2)
  ctx.scale(0.3 + s * 0.7, 1)
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2)
  ctx.fillStyle = '#ff8fc4'; ctx.fill()
  ctx.strokeStyle = '#b8467e'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()
}

function drawParticles(ctx, particles, camX) {
  particles.forEach(pt => {
    ctx.fillStyle = pt.color
    ctx.globalAlpha = Math.max(0, pt.life / 24)
    ctx.fillRect(pt.x - camX - 2, pt.y - 2, 4, 4)
    ctx.globalAlpha = 1
  })
}

// Shirby: a round pink puff with stub arms/feet, big eyes, and blush —
// wears a small hat matching whatever power is equipped (color from
// POWERS[...].hatColor), same "cosmetic overlay on a shared body" idea as
// the Mario knockoff's cape/shield, just built into the one body here.
export function drawPlayer(ctx, p, camX, frame) {
  // A Forgotten Star keeps p.invincible topped up for its whole duration
  // (see stepGame) — without this guard that would read as Shirby just
  // endlessly blinking out instead of a deliberate sparkly-invincible
  // window, so the hit-flicker is suppressed for as long as it's running.
  if (p.invincible > 0 && p.starTimer <= 0 && Math.floor(p.invincible / 4) % 2 === 0 && !p.dead) return
  const x = p.x - camX
  const w = p.w, h = p.h
  ctx.save()
  ctx.translate(x + w / 2, p.y + h / 2)
  if (p.dead) ctx.rotate(Math.PI)
  ctx.scale(p.facing, 1)

  const squash = p.onGround && Math.abs(p.vy) < 1 ? 1 : Math.max(0.82, 1 - Math.abs(p.vy) * 0.01)
  ctx.save()
  ctx.scale(1 / squash, squash)

  // feet
  const walking = Math.abs(p.vx) > 0.3 && p.onGround
  const stride = walking ? Math.sin(frame * 0.5) * 4 : 0
  ctx.fillStyle = '#e0507a'
  ctx.beginPath(); ctx.ellipse(-w * 0.22 - stride, h * 0.42, w * 0.16, h * 0.12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(w * 0.22 + stride, h * 0.42, w * 0.16, h * 0.12, 0, 0, Math.PI * 2); ctx.fill()

  // body
  ctx.fillStyle = '#ff8fc4'
  ctx.beginPath(); ctx.arc(0, 0, w * 0.48, 0, Math.PI * 2); ctx.fill()

  // stub arms
  const armSwing = walking ? Math.sin(frame * 0.5 + Math.PI) * 8 : 0
  ctx.fillStyle = '#ff8fc4'
  ctx.beginPath(); ctx.ellipse(-w * 0.42, armSwing * 0.1, w * 0.14, h * 0.16, 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(w * 0.42, -armSwing * 0.1, w * 0.14, h * 0.16, -0.3, 0, Math.PI * 2); ctx.fill()

  // blush + eyes
  ctx.fillStyle = 'rgba(255,90,140,0.5)'
  ctx.beginPath(); ctx.ellipse(-w * 0.28, h * 0.08, w * 0.08, h * 0.05, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(w * 0.28, h * 0.08, w * 0.08, h * 0.05, 0, 0, Math.PI * 2); ctx.fill()

  const inhalingWide = p.inhaling
  drawEyes(ctx, w * 0.1, -h * 0.08, w * 0.09, inhalingWide ? 4.6 : 3.2)

  // mouth: an inhale pulls into a big "o", otherwise a small smile
  if (inhalingWide) {
    ctx.fillStyle = '#7a1030'
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.16, w * 0.1, 0, Math.PI * 2); ctx.fill()
  } else if (p.mouthContent) {
    ctx.fillStyle = '#7a1030'
    ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.16, w * 0.09, h * 0.05, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.strokeStyle = '#a5335c'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(w * 0.28, h * 0.12, w * 0.08, 0.15, Math.PI - 0.5); ctx.stroke()
  }

  // hat, if a power is equipped. A mega combo gets a genuinely different
  // look from any base power or any other combo — not just a different
  // color: a two-tone hat split between its two parents' actual colors
  // (never blended into a muddy average), a silhouette that varies by
  // tier (heavy = tall and broad, fast = short and sleek, balanced = the
  // standard wedge), and its own unique emoji worn on top. Three
  // independent signals, so no two of the 15 combos read the same.
  const powDisplay = getPowerDisplay(p.power)
  if (powDisplay?.mega) {
    const [aId, bId] = p.power.split('+')
    const a = POWERS[aId], b = POWERS[bId]
    const atk = MEGA_POWERS[p.power].attack
    const peakH = atk.tier === 'heavy' ? 0.85 : atk.tier === 'fast' ? 0.58 : 0.7
    const baseW = atk.tier === 'heavy' ? 0.36 : atk.tier === 'fast' ? 0.24 : 0.3
    ctx.fillStyle = a.hatColor
    ctx.beginPath()
    ctx.moveTo(-w * baseW, -h * 0.32); ctx.lineTo(0, -h * 0.32)
    ctx.lineTo(0, -h * peakH); ctx.lineTo(-w * baseW * 0.4, -h * (peakH - 0.06))
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = b.hatColor
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.32); ctx.lineTo(w * baseW, -h * 0.32)
    ctx.lineTo(w * baseW * 0.4, -h * (peakH - 0.06)); ctx.lineTo(0, -h * peakH)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = a.accent
    ctx.fillRect(-w * baseW - w * 0.02, -h * 0.36, w * baseW + w * 0.02, h * 0.08)
    ctx.fillStyle = b.accent
    ctx.fillRect(0, -h * 0.36, w * baseW + w * 0.02, h * 0.08)
    // The combo's own emoji, worn on top — un-mirror it (via a second
    // facing-scale that cancels the body's own ctx.scale(p.facing, 1)
    // from earlier) so it never reads backwards facing left.
    ctx.save()
    ctx.translate(0, -h * peakH - h * 0.2)
    ctx.scale(p.facing, 1)
    ctx.font = `${Math.round(w * 0.55)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(powDisplay.emoji, 0, 0)
    ctx.restore()
  } else if (powDisplay) {
    ctx.fillStyle = powDisplay.hatColor
    ctx.beginPath()
    ctx.moveTo(-w * 0.3, -h * 0.32)
    ctx.lineTo(w * 0.3, -h * 0.32)
    ctx.lineTo(w * 0.14, -h * 0.7)
    ctx.lineTo(-w * 0.14, -h * 0.7)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = powDisplay.accent
    ctx.fillRect(-w * 0.32, -h * 0.36, w * 0.64, h * 0.08)
  }

  // an in-progress power attack gets a quick visual flourish — a mega's
  // flourish varies by its attack shape (see MEGA_POWERS in constants.js)
  // instead of always being the same plain white ring, so it reads as a
  // different move, not just a different color.
  const megaAtk = powDisplay?.mega ? MEGA_POWERS[p.power]?.attack : null
  if (p.attackTimer > 0) {
    if (megaAtk?.shape === 'arc') {
      ctx.strokeStyle = megaAtk.color; ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(w * 0.5, 0, w * (0.7 + (megaAtk.reachMult ? 0.4 : 0)), -0.7, 0.7); ctx.stroke()
    } else if (megaAtk?.shape === 'magnet') {
      ctx.strokeStyle = megaAtk.color; ctx.lineWidth = 3
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.8 - i * 0.25
        ctx.beginPath(); ctx.arc(0, 0, w * (0.6 + i * 0.35) * (p.attackTimer / 20), 0, Math.PI * 2); ctx.stroke()
      }
      ctx.globalAlpha = 1
    } else if (megaAtk?.shape === 'dash') {
      // three motion-streak lines trailing behind the dash, instead of a
      // ring — the attack IS the movement here, so the flourish should
      // read as "fast," not "a shape drawn around Shirby."
      ctx.strokeStyle = megaAtk.color; ctx.lineWidth = 3
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.7 - i * 0.2
        const yy = (i - 1) * h * 0.28
        ctx.beginPath(); ctx.moveTo(-w * 0.5, yy); ctx.lineTo(-w * (1.1 + i * 0.35), yy); ctx.stroke()
      }
      ctx.globalAlpha = 1
    } else if (megaAtk) {
      ctx.strokeStyle = megaAtk.color; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(0, 0, w * 1.4 * (1 - p.attackTimer / 16), 0, Math.PI * 2); ctx.stroke()
    } else if (p.power === 'blade') {
      ctx.strokeStyle = '#dcdce8'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(w * 0.5, 0, w * 0.7, -0.6, 0.6); ctx.stroke()
    } else if (p.power === 'zap') {
      ctx.strokeStyle = 'rgba(245,224,80,0.7)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(0, 0, w * 0.9 * (1 - p.attackTimer / 12), 0, Math.PI * 2); ctx.stroke()
    } else if (p.power === 'rock') {
      ctx.strokeStyle = 'rgba(168,152,120,0.7)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(0, h * 0.4, w * 1.1 * (1 - p.attackTimer / 14), 0, Math.PI * 2); ctx.stroke()
    } else if (p.power === 'gust') {
      ctx.strokeStyle = 'rgba(216,240,255,0.75)'; ctx.lineWidth = 3
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.7 - i * 0.2
        const yy = (i - 1) * h * 0.26
        ctx.beginPath(); ctx.moveTo(-w * 0.45, yy); ctx.lineTo(-w * (1.0 + i * 0.3), yy); ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }
  if (p.power === 'ember' && p.emberTick > 0) {
    ctx.fillStyle = 'rgba(255,120,50,0.55)'
    ctx.beginPath(); ctx.ellipse(w * 0.7, 0, w * 0.55, h * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  }
  if (p.power === 'zap') {
    ctx.strokeStyle = 'rgba(245,224,80,0.35)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, w * 0.62, 0, Math.PI * 2); ctx.stroke()
  }
  if (p.starTimer > 0) {
    // a ring of little orbiting sparkles instead of the plain hit-flicker
    // this invincibility window would otherwise reuse — Forgotten Star is
    // a pickup, not damage, so it should look celebratory, not hurt.
    const n = 5
    for (let i = 0; i < n; i++) {
      const a = frame * 0.12 + (i / n) * Math.PI * 2
      const sx = Math.cos(a) * w * 0.85, sy = Math.sin(a) * h * 0.55
      ctx.fillStyle = i % 2 === 0 ? '#ffe873' : '#ffffff'
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a * 2)
      ctx.beginPath()
      for (let k = 0; k < 5; k++) {
        const a1 = (k / 5) * Math.PI * 2 - Math.PI / 2, a2 = a1 + Math.PI / 5
        ctx.lineTo(Math.cos(a1) * 4, Math.sin(a1) * 4)
        ctx.lineTo(Math.cos(a2) * 1.8, Math.sin(a2) * 1.8)
      }
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }
  }

  ctx.restore()
  ctx.restore()
}

function drawHUD(ctx, state) {
  const level = currentLevel(state)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, W, 40)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(`SCORE ${String(state.score).padStart(6, '0')}`, 16, 20)
  ctx.fillText(`🔘 x${state.buttonCount}`, 240, 20)
  ctx.fillText(`LIVES x${Math.max(0, state.lives)}`, 380, 20)
  ctx.fillText(`WORLD ${level.id}`, 560, 20)

  // hearts
  const p = state.player
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i < p.hp ? '#ff5577' : 'rgba(255,255,255,0.2)'
    ctx.font = '16px sans-serif'
    ctx.fillText('❤', 700 + i * 18, 20)
  }

  if (state.boss && state.boss.alive) {
    const boss = state.boss
    ctx.textAlign = 'center'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText(BOSS_NAMES[boss.shape] || 'BOSS', W / 2, 54)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(W / 2 - 100, 60, 200, 14)
    ctx.fillStyle = '#e8503c'
    ctx.fillRect(W / 2 - 98, 62, 196 * Math.max(0, boss.hp / boss.maxHp), 10)
    ctx.strokeStyle = '#fff'; ctx.strokeRect(W / 2 - 100, 60, 200, 14)
  }

  if (state.messageTimer > 0) {
    ctx.textAlign = 'center'
    ctx.font = 'bold 17px sans-serif'
    ctx.fillStyle = '#fff8e0'
    ctx.fillText(state.message, W / 2, 88)
  }
  if (state.status === 'levelTransition') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, H / 2 - 50, W, 100)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText(state.transitionLabel, W / 2, H / 2 - 10)
    ctx.font = '15px sans-serif'
    const next = LEVELS[state.levelIndex + 1]
    ctx.fillText(next ? `Wandering into World ${next.id}...` : 'The Forgotten Place goes quiet...', W / 2, H / 2 + 20)
  }
}

export function render(ctx, state) {
  const level = currentLevel(state)
  const theme = state.horrorMode ? THEMES.horror : THEMES[level.theme]
  drawBackground(ctx, theme, state.camX, state.frame)
  drawGround(ctx, theme, level, state.camX)
  state.blocks.forEach(b => drawBlock(ctx, theme, b, state.camX))
  state.buttons.forEach(c => drawButton(ctx, c, state.camX, state.frame))
  state.enemies.forEach(e => drawEnemy(ctx, e, state.camX, state.frame))
  if (state.boss) drawBoss(ctx, state.boss, state.camX, state.frame)
  state.projectiles.forEach(pr => drawProjectile(ctx, pr, state.camX, state.frame))
  drawPlayer(ctx, state.player, state.camX, state.frame)
  drawParticles(ctx, state.particles, state.camX)
  drawHUD(ctx, state)
}
