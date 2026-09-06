import { useEffect, useRef } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 340
const H = 220
const N = 5
const BALL_R = 17
const SPACING = BALL_R * 2 + 2
const PIVOT_Y = 30
const LEN = 130
const G_OVER_L = 12.5
const DAMPING = 0.09
const MAX_ANGLE = 1.15

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

export default function NewtonsCradle() {
  const canvasRef = useRef(null)
  const state = useRef({ angleL: 0, velL: 0, angleR: 0, velR: 0, dragging: null })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const startX = W / 2 - ((N - 1) / 2) * SPACING
    const pivotX = i => startX + i * SPACING

    function stepSide(side, dt) {
      const s = state.current
      const key = side === 'L' ? 'angleL' : 'angleR'
      const vkey = side === 'L' ? 'velL' : 'velR'
      if (s.dragging === side) return
      let angle = s[key], vel = s[vkey]
      if (Math.abs(angle) < 0.008 && Math.abs(vel) < 0.02) { s[key] = 0; s[vkey] = 0; return }
      const accel = -G_OVER_L * Math.sin(angle) - DAMPING * vel
      vel += accel * dt
      const newAngle = clamp(angle + vel * dt, -MAX_ANGLE, MAX_ANGLE)
      const crossing = angle !== 0 && Math.sign(newAngle) !== Math.sign(angle)
      s[key] = newAngle
      s[vkey] = vel
      if (crossing) {
        const otherKey = side === 'L' ? 'angleR' : 'angleL'
        const otherVkey = side === 'L' ? 'velR' : 'velL'
        const speed = Math.abs(vel) * 0.985
        s[key] = 0; s[vkey] = 0
        s[otherKey] = 0
        s[otherVkey] = (side === 'L' ? 1 : -1) * speed
        if (speed > 0.4) playClick(620 + Math.random() * 60, 0.04)
      }
    }

    function ballPos(i, angle) {
      const px = pivotX(i)
      return { x: px + Math.sin(angle) * LEN, y: PIVOT_Y + Math.cos(angle) * LEN }
    }

    function hitSide(x, y) {
      const s = state.current
      const l = ballPos(0, s.angleL)
      const r = ballPos(N - 1, s.angleR)
      if (Math.hypot(x - l.x, y - l.y) < BALL_R + 10) return 'L'
      if (Math.hypot(x - r.x, y - r.y) < BALL_R + 10) return 'R'
      return null
    }

    function toLocal(e) {
      const rect = canvas.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }
    function onDown(e) {
      const { x, y } = toLocal(e)
      const side = hitSide(x, y)
      if (!side) return
      state.current.dragging = side
      state.current[side === 'L' ? 'velL' : 'velR'] = 0
      canvas.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      const s = state.current
      if (!s.dragging) return
      const { x } = toLocal(e)
      const i = s.dragging === 'L' ? 0 : N - 1
      const dx = x - pivotX(i)
      let angle = Math.atan2(dx, LEN)
      angle = s.dragging === 'L' ? clamp(angle, -MAX_ANGLE, 0) : clamp(angle, 0, MAX_ANGLE)
      s[s.dragging === 'L' ? 'angleL' : 'angleR'] = angle
    }
    function onUp() { state.current.dragging = null }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      stepSide('L', dt)
      stepSide('R', dt)

      const s = state.current
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = '#4a4a5a'
      ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(startX - 30, PIVOT_Y - 14); ctx.lineTo(startX + (N - 1) * SPACING + 30, PIVOT_Y - 14); ctx.stroke()
      ctx.fillStyle = '#3a3a48'
      ctx.fillRect(startX - 36, PIVOT_Y - 20, 10, H - PIVOT_Y - 6)
      ctx.fillRect(startX + (N - 1) * SPACING + 26, PIVOT_Y - 20, 10, H - PIVOT_Y - 6)

      for (let i = 0; i < N; i++) {
        const angle = i === 0 ? s.angleL : i === N - 1 ? s.angleR : 0
        const p = ballPos(i, angle)
        ctx.strokeStyle = 'rgba(220,220,230,0.7)'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(pivotX(i), PIVOT_Y); ctx.lineTo(p.x, p.y); ctx.stroke()

        const grad = ctx.createRadialGradient(p.x - 6, p.y - 8, 2, p.x, p.y, BALL_R)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.35, '#cfd6e0')
        grad.addColorStop(1, '#7a8494')
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
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
        <span className={styles.toyStat}>Pull an end ball back and let go</span>
      </div>
      <div className={styles.cradleStage}>
        <canvas ref={canvasRef} className={styles.cradleCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
