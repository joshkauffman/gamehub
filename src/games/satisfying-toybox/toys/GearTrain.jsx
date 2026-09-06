import { useEffect, useRef } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 340
const H = 260
const FRICTION = 0.5

const GEARS = [
  { teeth: 16, r: 46, color: '#6c63ff' },
  { teeth: 10, r: 29, color: '#ff6584' },
  { teeth: 20, r: 58, color: '#5cff8f' },
]
// Lay the gears out left-to-right so each pitch circle just touches the next.
GEARS[0].x = 90
GEARS[1].x = GEARS[0].x + GEARS[0].r + GEARS[1].r
GEARS[2].x = GEARS[1].x + GEARS[1].r + GEARS[2].r
const CY = 150

function drawGear(ctx, cx, cy, r, teeth, angle, color) {
  const toothH = r * 0.16
  const step = (Math.PI * 2) / teeth
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.beginPath()
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step - step * 0.22
    const a1 = i * step - step * 0.14
    const a2 = i * step + step * 0.14
    const a3 = i * step + step * 0.22
    const pt = (a, rad) => [Math.cos(a) * rad, Math.sin(a) * rad]
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r + toothH), [x2, y2] = pt(a2, r + toothH), [x3, y3] = pt(a3, r)
    if (i === 0) ctx.moveTo(x0, y0); else ctx.lineTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x3, y3)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + Math.PI / 4
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.07, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()
  }
  ctx.restore()
}

export default function GearTrain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const drive = { angle: 0, vel: 0, dragging: false, lastAngle: 0, lastT: 0, lastClickAt: 0 }

    function pointerAngle(e) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (W / rect.width) - GEARS[0].x
      const y = (e.clientY - rect.top) * (H / rect.height) - CY
      return Math.atan2(y, x)
    }
    function onDown(e) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (W / rect.width)
      const y = (e.clientY - rect.top) * (H / rect.height)
      if (Math.hypot(x - GEARS[0].x, y - CY) > GEARS[0].r + 10) return
      drive.dragging = true
      drive.lastAngle = pointerAngle(e)
      drive.lastT = performance.now()
      drive.vel = 0
      canvas.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      if (!drive.dragging) return
      const a = pointerAngle(e)
      const now = performance.now()
      let delta = a - drive.lastAngle
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      const dt = Math.max(1, now - drive.lastT) / 1000
      drive.vel = delta / dt
      drive.angle += delta
      drive.lastAngle = a
      drive.lastT = now
    }
    function onUp() { drive.dragging = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!drive.dragging) {
        drive.angle += drive.vel * dt
        drive.vel *= Math.max(0, 1 - FRICTION * dt)
        if (Math.abs(drive.vel) < 0.02) drive.vel = 0
      }
      // Meshing gears spin opposite directions, at a rate inverse to their
      // own tooth count relative to the driver — so a 16↔10 mesh spins the
      // smaller gear 1.6x faster, exactly like real gears.
      const angleA = drive.angle
      const angleB = -angleA * (GEARS[0].teeth / GEARS[1].teeth)
      const angleC = -angleB * (GEARS[1].teeth / GEARS[2].teeth)

      if (Math.abs(drive.vel) > 0.5 && now - drive.lastClickAt > 90) {
        drive.lastClickAt = now
        playClick(500, 0.02)
      }

      ctx.clearRect(0, 0, W, H)
      drawGear(ctx, GEARS[0].x, CY, GEARS[0].r, GEARS[0].teeth, angleA, GEARS[0].color)
      drawGear(ctx, GEARS[1].x, CY, GEARS[1].r, GEARS[1].teeth, angleB, GEARS[1].color)
      drawGear(ctx, GEARS[2].x, CY, GEARS[2].r, GEARS[2].teeth, angleC, GEARS[2].color)
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
        <span className={styles.toyStat}>Drag the big gear in a circle to spin the whole train</span>
      </div>
      <div className={styles.gearStage}>
        <canvas ref={canvasRef} className={styles.gearCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
