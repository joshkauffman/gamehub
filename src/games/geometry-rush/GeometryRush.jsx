import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './GeometryRush.module.css'
import { createGameState, resetRun, stepGame, PLAYER_SIZE } from './engine.js'

// ── Geometry Rush — a Geometry Dash-style auto-runner ───────────────────
// Canvas 2D, fixed logical resolution (scaled to fit via CSS aspect-ratio
// so there's no resize/DPR bookkeeping to get wrong). The player sits at
// a fixed screen x; the world scrolls underneath by translating every
// draw call by -(distance) + PLAYER_SCREEN_X. See engine.js for the pure
// gameplay state machine (cube/ship/ball modes, procedural obstacles).

const LW = 900, LH = 460
const GROUND_Y = 400 // screen y of world-y=0 (the ground baseline)
const PLAYER_SCREEN_X = 190

const MODE_COLOR = { cube: '#00e5ff', ship: '#ff9500', ball: '#ff2ec4' }
const PORTAL_COLOR = { cube: '#00e5ff', ship: '#ff9500', ball: '#ff2ec4' }

function rand(a, b) { return a + Math.random() * (b - a) }
function worldToScreenX(x, distance) { return PLAYER_SCREEN_X + (x - distance) }

function drawBackground(ctx, distance) {
  const hue = (distance * 0.015) % 360
  const grad = ctx.createLinearGradient(0, 0, 0, LH)
  grad.addColorStop(0, `hsl(${hue}, 45%, 12%)`)
  grad.addColorStop(1, `hsl(${hue + 35}, 55%, 20%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, LW, LH)

  // Slow parallax grid — pure background motion cue, purely decorative.
  ctx.strokeStyle = `hsla(${hue + 30}, 70%, 70%, 0.08)`
  ctx.lineWidth = 1
  const offset = (distance * 0.25) % 60
  for (let x = -offset; x < LW; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LH); ctx.stroke()
  }

  // Distant parallax triangles.
  ctx.fillStyle = `hsla(${hue + 20}, 50%, 30%, 0.35)`
  const pOffset = (distance * 0.12) % 220
  for (let x = -pOffset; x < LW + 220; x += 220) {
    ctx.beginPath()
    ctx.moveTo(x, GROUND_Y)
    ctx.lineTo(x + 110, GROUND_Y - 90)
    ctx.lineTo(x + 220, GROUND_Y)
    ctx.closePath()
    ctx.fill()
  }
}

function drawGround(ctx, obstacles, distance) {
  // Ground is a continuous strip except where an active 'gap' obstacle
  // punches a hole in it — draw the strip as a sequence of segments,
  // skipping over gap ranges so pits read as bottomless.
  const gaps = obstacles.filter(o => o.type === 'gap').sort((a, b) => a.x - b.x)
  let cursor = distance - 300
  const segs = []
  for (const g of gaps) {
    if (g.x > cursor) segs.push([cursor, g.x])
    cursor = Math.max(cursor, g.x + g.w)
  }
  segs.push([cursor, distance + LW])

  for (const [wx0, wx1] of segs) {
    const x0 = worldToScreenX(wx0, distance), x1 = worldToScreenX(wx1, distance)
    if (x1 < 0 || x0 > LW) continue
    const grad = ctx.createLinearGradient(0, GROUND_Y, 0, LH)
    grad.addColorStop(0, '#1c1c2e')
    grad.addColorStop(1, '#0a0a14')
    ctx.fillStyle = grad
    ctx.fillRect(Math.max(0, x0), GROUND_Y, Math.min(LW, x1) - Math.max(0, x0), LH - GROUND_Y)
    ctx.strokeStyle = '#6c63ff'
    ctx.shadowColor = '#6c63ff'
    ctx.shadowBlur = 8
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(Math.max(0, x0), GROUND_Y); ctx.lineTo(Math.min(LW, x1), GROUND_Y); ctx.stroke()
    ctx.shadowBlur = 0
  }
}

function drawObstacle(ctx, o, distance) {
  const sx = worldToScreenX(o.x, distance)
  const w = o.w ?? 20
  if (sx + w < -20 || sx > LW + 20) return

  if (o.type === 'spike') {
    const top = GROUND_Y - o.top, bottom = GROUND_Y - o.bottom
    ctx.save()
    ctx.shadowColor = '#ff3366'
    ctx.shadowBlur = 12
    const grad = ctx.createLinearGradient(sx, top, sx, bottom)
    grad.addColorStop(0, '#ff6b9d')
    grad.addColorStop(1, '#c81d5f')
    ctx.fillStyle = grad
    ctx.beginPath()
    if (o.dir === 'down') {
      ctx.moveTo(sx, top); ctx.lineTo(sx + w, top); ctx.lineTo(sx + w / 2, bottom)
    } else if (o.dir === 'diamond') {
      const midY = (top + bottom) / 2
      ctx.moveTo(sx + w / 2, top); ctx.lineTo(sx + w, midY); ctx.lineTo(sx + w / 2, bottom); ctx.lineTo(sx, midY)
    } else {
      ctx.moveTo(sx, bottom); ctx.lineTo(sx + w, bottom); ctx.lineTo(sx + w / 2, top)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  } else if (o.type === 'block') {
    const top = GROUND_Y - o.top, bottom = GROUND_Y - o.bottom
    ctx.save()
    ctx.shadowColor = '#6c63ff'
    ctx.shadowBlur = 10
    const grad = ctx.createLinearGradient(sx, top, sx, bottom)
    grad.addColorStop(0, '#8b7fff')
    grad.addColorStop(1, '#453c9c')
    ctx.fillStyle = grad
    ctx.fillRect(sx, top, w, bottom - top)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(sx + 3, top + 3, w - 6, bottom - top - 6)
    ctx.restore()
  } else if (o.type === 'orb') {
    const cy = GROUND_Y - o.y
    const pulse = 1 + Math.sin(performance.now() / 160) * 0.12
    ctx.save()
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 16
    ctx.fillStyle = o.consumed ? 'rgba(255,215,0,0.35)' : '#ffd700'
    ctx.beginPath(); ctx.arc(sx, cy, 13 * pulse, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(sx, cy, 18 * pulse, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  } else if (o.type === 'pad') {
    const top = GROUND_Y - o.top, bottom = GROUND_Y - o.bottom
    ctx.save()
    ctx.shadowColor = '#5cff8f'
    ctx.shadowBlur = 12
    ctx.fillStyle = o.consumed ? 'rgba(92,255,143,0.35)' : '#5cff8f'
    ctx.beginPath()
    ctx.moveTo(sx, bottom); ctx.lineTo(sx + w, bottom); ctx.lineTo(sx + w / 2, top)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  } else if (o.type === 'portal') {
    ctx.save()
    const color = PORTAL_COLOR[o.mode] || '#ffffff'
    const grad = ctx.createLinearGradient(sx, 0, sx, LH)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, color)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.shadowColor = color
    ctx.shadowBlur = 24
    ctx.globalAlpha = 0.85
    ctx.fillRect(sx, 0, w, LH)
    ctx.restore()
  }
}

function drawPlayer(ctx, state, deathAnim) {
  if (deathAnim) return
  const cx = PLAYER_SCREEN_X + PLAYER_SIZE / 2
  const cy = GROUND_Y - state.y - PLAYER_SIZE / 2
  const color = MODE_COLOR[state.mode]

  ctx.save()
  ctx.translate(cx, cy)
  if (state.mode !== 'ship') ctx.rotate(state.rotation)
  ctx.shadowColor = color
  ctx.shadowBlur = 20

  if (state.mode === 'cube') {
    const s = PLAYER_SIZE
    const grad = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, color)
    ctx.fillStyle = grad
    roundRect(ctx, -s / 2, -s / 2, s, s, 7)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2
    roundRect(ctx, -s / 2 + 5, -s / 2 + 5, s - 10, s - 10, 4)
    ctx.stroke()
  } else if (state.mode === 'ball') {
    const r = PLAYER_SIZE / 2
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, color)
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke()
  } else {
    const s = PLAYER_SIZE
    const grad = ctx.createLinearGradient(-s / 2, 0, s / 2, 0)
    grad.addColorStop(0, color)
    grad.addColorStop(1, '#ffffff')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(-s / 2, -s / 3)
    ctx.lineTo(s / 2, 0)
    ctx.lineTo(-s / 2, s / 3)
    ctx.lineTo(-s / 4, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawTrail(ctx, state) {
  for (const p of state.particles) {
    const t = p.age / p.life
    const sx = worldToScreenX(p.x, state.distance)
    const sy = GROUND_Y - p.y
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.5
    ctx.fillStyle = MODE_COLOR[p.mode]
    ctx.beginPath(); ctx.arc(sx, sy, 5 * (1 - t), 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawDeathShards(ctx, shards) {
  for (const s of shards) {
    const t = s.age / s.life
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - t)
    ctx.translate(s.x, s.y)
    ctx.rotate(s.rot * s.age)
    ctx.fillStyle = s.color
    ctx.shadowColor = s.color
    ctx.shadowBlur = 10
    ctx.fillRect(-4, -4, 8, 8)
    ctx.restore()
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function GeometryRush() {
  const canvasRef = useRef(null)
  const jumpHeldRef = useRef(false)
  const [hud, setHud] = useState({ status: 'ready', score: 0, best: 0, mode: 'cube' })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = LW * dpr
    canvas.height = LH * dpr
    ctx.scale(dpr, dpr)

    const state = createGameState()
    let raf = null
    let wasHeld = false
    let prevStatus = state.status
    let shards = []
    const clock = { last: performance.now() }

    function onKeyDown(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jumpHeldRef.current = true }
    }
    function onKeyUp(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') jumpHeldRef.current = false
    }
    function onPointerDown(e) { e.preventDefault(); jumpHeldRef.current = true }
    function onPointerUp() { jumpHeldRef.current = false }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - clock.last) / 1000, 0.05)
      clock.last = now

      const held = jumpHeldRef.current
      const pressedEdge = held && !wasHeld
      wasHeld = held

      if (state.status !== 'running' && pressedEdge) resetRun(state)
      if (state.status === 'running') stepGame(state, { jump: held }, dt)

      if (prevStatus === 'running' && state.status === 'dead') {
        const cx = PLAYER_SCREEN_X + PLAYER_SIZE / 2
        const cy = GROUND_Y - state.y - PLAYER_SIZE / 2
        const color = MODE_COLOR[state.mode]
        shards = Array.from({ length: 18 }, () => ({
          x: cx, y: cy, vx: rand(-260, 260), vy: rand(-380, -40),
          age: 0, life: rand(0.5, 0.9), rot: rand(-8, 8), color,
        }))
      }
      prevStatus = state.status
      setHud({ status: state.status, score: state.score, best: state.best, mode: state.mode })

      for (const s of shards) { s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt }
      shards = shards.filter(s => s.age < s.life)

      draw()
    }

    function draw() {
      let shakeX = 0, shakeY = 0
      if (shards.length) { shakeX = rand(-4, 4); shakeY = rand(-4, 4) }
      ctx.save()
      ctx.translate(shakeX, shakeY)
      drawBackground(ctx, state.distance)
      drawGround(ctx, state.obstacles, state.distance)
      for (const o of state.obstacles) drawObstacle(ctx, o, state.distance)
      drawTrail(ctx, state)
      drawPlayer(ctx, state, state.status === 'dead' && shards.length > 0)
      drawDeathShards(ctx, shards)
      ctx.restore()
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.hudBar}>
        <span className={styles.hudScore}>DIST {hud.score}</span>
        <span className={styles.hudBest}>BEST {hud.best}</span>
      </header>
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} style={{ aspectRatio: `${LW} / ${LH}` }} />
        {hud.status === 'running' && (
          <div className={styles.modeTag} data-mode={hud.mode}>{hud.mode.toUpperCase()}</div>
        )}
        {hud.status !== 'running' && (
          <div className={styles.overlay}>
            {hud.status === 'ready' && (
              <>
                <h1 className={styles.title}>GEOMETRY <span className={styles.rush}>RUSH</span></h1>
                <p className={styles.blurb}>Tap, click, or press SPACE to jump — hold it down. Fly through portals to switch modes.</p>
                <p className={styles.hint}>SPACE / CLICK / TAP TO START</p>
              </>
            )}
            {hud.status === 'dead' && (
              <>
                <h1 className={styles.title}>💥 CRASHED</h1>
                <p className={styles.blurb}>Distance {hud.score} · Best {hud.best}</p>
                <p className={styles.hint}>SPACE / CLICK / TAP TO RETRY</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className={styles.controls}>SPACE / click / tap to jump, thrust, or flip · portals swap your mode</div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}
