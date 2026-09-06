import { useEffect, useRef } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 340
const H = 260
const MARBLE_R = 8
const ACCEL = 380
const FRICTION = 1.1

const WALLS = [
  { x: 30, y: 30, w: 140, h: 14 },
  { x: 250, y: 30, w: 60, h: 14 },
  { x: 296, y: 30, w: 14, h: 100 },
  { x: 30, y: 30, w: 14, h: 130 },
  { x: 90, y: 90, w: 14, h: 90 },
  { x: 90, y: 166, w: 130, h: 14 },
  { x: 150, y: 90, w: 100, h: 14 },
  { x: 236, y: 90, w: 14, h: 60 },
  { x: 30, y: 216, w: 180, h: 14 },
  { x: 250, y: 160, w: 60, h: 14 },
]

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

function collideCircleRect(m, r) {
  const closestX = clamp(m.x, r.x, r.x + r.w)
  const closestY = clamp(m.y, r.y, r.y + r.h)
  const dx = m.x - closestX, dy = m.y - closestY
  const distSq = dx * dx + dy * dy
  if (distSq >= m.r * m.r) return false
  const dist = Math.sqrt(distSq) || 0.0001
  const nx = dx / dist, ny = dy / dist
  m.x += nx * (m.r - dist)
  m.y += ny * (m.r - dist)
  const vDotN = m.vx * nx + m.vy * ny
  if (vDotN < 0) { m.vx -= 1.5 * vDotN * nx; m.vy -= 1.5 * vDotN * ny }
  return true
}

export default function MarbleLabyrinth() {
  const canvasRef = useRef(null)
  const runtime = useRef({ pressing: false, tiltX: 0, tiltY: 0, downX: 0, downY: 0, lastBonk: 0 })
  const marble = useRef({ x: 60, y: 60, vx: 0, vy: 0, r: MARBLE_R })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    function toLocal(e) {
      const rect = canvas.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }
    function onDown(e) {
      const rt = runtime.current
      const { x, y } = toLocal(e)
      rt.pressing = true
      rt.downX = x; rt.downY = y
      canvas.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      const rt = runtime.current
      if (!rt.pressing) return
      const { x, y } = toLocal(e)
      rt.tiltX = clamp((x - rt.downX) / 70, -1, 1)
      rt.tiltY = clamp((y - rt.downY) / 70, -1, 1)
    }
    function onUp() { const rt = runtime.current; rt.pressing = false; rt.tiltX = 0; rt.tiltY = 0 }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      const rt = runtime.current
      const m = marble.current

      m.vx += rt.tiltX * ACCEL * dt
      m.vy += rt.tiltY * ACCEL * dt
      m.vx *= Math.max(0, 1 - FRICTION * dt)
      m.vy *= Math.max(0, 1 - FRICTION * dt)
      m.x += m.vx * dt
      m.y += m.vy * dt

      let bonk = false
      if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx) * 0.5; bonk = true }
      if (m.x > W - m.r) { m.x = W - m.r; m.vx = -Math.abs(m.vx) * 0.5; bonk = true }
      if (m.y < m.r) { m.y = m.r; m.vy = Math.abs(m.vy) * 0.5; bonk = true }
      if (m.y > H - m.r) { m.y = H - m.r; m.vy = -Math.abs(m.vy) * 0.5; bonk = true }
      for (const w of WALLS) { if (collideCircleRect(m, w)) bonk = true }
      const speed = Math.hypot(m.vx, m.vy)
      if (bonk && speed > 40 && now - rt.lastBonk > 90) {
        rt.lastBonk = now
        playClick(300 + Math.random() * 120, 0.035)
      }

      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#caa06a')
      bg.addColorStop(1, '#a67c46')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      for (const w of WALLS) {
        ctx.fillStyle = '#5c4022'
        ctx.fillRect(w.x, w.y, w.w, w.h)
        ctx.fillStyle = 'rgba(255,230,190,0.25)'
        ctx.fillRect(w.x, w.y, w.w, 3)
      }

      ctx.beginPath(); ctx.ellipse(m.x, m.y + m.r * 0.7, m.r * 0.9, m.r * 0.4, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fill()

      const grad = ctx.createRadialGradient(m.x - 3, m.y - 3, 1, m.x, m.y, m.r)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.5, '#8fd3ff')
      grad.addColorStop(1, '#2a6fa8')
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Press and drag to tilt the board and roll the marble</span>
      </div>
      <div className={styles.labyrinthTray}>
        <canvas ref={canvasRef} className={styles.labyrinthCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
