import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'

const SIZE = 300
const CX = SIZE / 2
const CY = SIZE / 2
const COLORS = ['#6c63ff', '#ff6584', '#5cff8f', '#ffd700', '#00e5ff']
const FRICTION = 0.55 // per second decay factor

export default function FidgetSpinner() {
  const canvasRef = useRef(null)
  const [color, setColor] = useState(COLORS[0])
  const colorRef = useRef(color)
  colorRef.current = color

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    ctx.scale(dpr, dpr)

    const spin = { angle: 0, vel: 0, dragging: false, lastAngle: 0, lastT: 0 }

    function pointerAngle(e) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (SIZE / rect.width) - CX
      const y = (e.clientY - rect.top) * (SIZE / rect.height) - CY
      return Math.atan2(y, x)
    }

    function onDown(e) {
      spin.dragging = true
      spin.lastAngle = pointerAngle(e)
      spin.lastT = performance.now()
      spin.vel = 0
      canvas.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      if (!spin.dragging) return
      const a = pointerAngle(e)
      const now = performance.now()
      let delta = a - spin.lastAngle
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      const dt = Math.max(1, now - spin.lastT) / 1000
      spin.vel = delta / dt
      spin.angle += delta
      spin.lastAngle = a
      spin.lastT = now
    }
    function onUp() { spin.dragging = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!spin.dragging) {
        spin.angle += spin.vel * dt
        spin.vel *= Math.max(0, 1 - FRICTION * dt)
        if (Math.abs(spin.vel) < 0.03) spin.vel = 0
      }
      draw(spin.angle, Math.abs(spin.vel))
    }

    function draw(angle, speed) {
      ctx.clearRect(0, 0, SIZE, SIZE)
      const color = colorRef.current
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(angle)
      ctx.shadowColor = color
      ctx.shadowBlur = 16 + Math.min(20, speed * 3)

      for (let i = 0; i < 3; i++) {
        ctx.save()
        ctx.rotate((Math.PI * 2 / 3) * i)
        ctx.fillStyle = color
        ctx.fillRect(-13, 0, 26, 82)
        const grad = ctx.createRadialGradient(-10, 76, 4, 0, 82, 48)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(1, color)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 84, 42, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      const bgrad = ctx.createRadialGradient(-9, -9, 2, 0, 0, 28)
      bgrad.addColorStop(0, '#ffffff')
      bgrad.addColorStop(1, '#333344')
      ctx.fillStyle = bgrad
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
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
        <span className={styles.toyStat}>Drag in a circle, then let go to flick it</span>
        <div className={styles.swatchRow}>
          {COLORS.map(c => (
            <button key={c} className={styles.swatch} style={{ background: c }} onClick={() => setColor(c)} aria-label="spinner color" />
          ))}
        </div>
      </div>
      <div className={styles.spinnerStage}>
        <canvas ref={canvasRef} className={styles.spinnerCanvas} style={{ aspectRatio: '1 / 1' }} />
      </div>
    </div>
  )
}
