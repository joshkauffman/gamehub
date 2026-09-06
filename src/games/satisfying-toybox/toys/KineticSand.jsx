import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 420
const H = 260

function drawSand(ctx, seed) {
  ctx.clearRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#e8c98a')
  grad.addColorStop(1, '#c9a15f')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  // Baked-in speckle texture, reseeded on every reset for a fresh tray.
  let s = seed
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < 900; i++) {
    const x = rand() * W, y = rand() * H
    ctx.fillStyle = rand() < 0.5 ? 'rgba(140,100,50,0.18)' : 'rgba(255,240,210,0.25)'
    ctx.fillRect(x, y, 1.5, 1.5)
  }
}

function rakeSegment(ctx, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const tines = [-9, -4.5, 0, 4.5, 9]
  for (const off of tines) {
    const ax = x0 + nx * off, ay = y0 + ny * off
    const bx = x1 + nx * off, by = y1 + ny * off
    ctx.strokeStyle = 'rgba(100,68,32,0.4)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,235,195,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ax - nx * 1.4, ay - ny * 1.4)
    ctx.lineTo(bx - nx * 1.4, by - ny * 1.4)
    ctx.stroke()
  }
}

export default function KineticSand() {
  const canvasRef = useRef(null)
  const [strokes, setStrokes] = useState(0)
  const runtime = useRef({ dragging: false, lastX: 0, lastY: 0, lastSound: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    drawSand(ctx, Math.floor(Math.random() * 100000))

    function toLocal(e) {
      const rect = canvas.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }
    function onDown(e) {
      const rt = runtime.current
      rt.dragging = true
      const { x, y } = toLocal(e)
      rt.lastX = x; rt.lastY = y
      canvas.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      const rt = runtime.current
      if (!rt.dragging) return
      const { x, y } = toLocal(e)
      rakeSegment(ctx, rt.lastX, rt.lastY, x, y)
      rt.lastX = x; rt.lastY = y
      setStrokes(n => n + 1)
      const now = performance.now()
      if (now - rt.lastSound > 70) {
        rt.lastSound = now
        playClick(180 + Math.random() * 50, 0.035)
      }
    }
    function onUp() { runtime.current.dragging = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  function smooth() {
    const canvas = canvasRef.current
    drawSand(canvas.getContext('2d'), Math.floor(Math.random() * 100000))
    setStrokes(0)
  }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Drag your finger through the sand to rake it</span>
        <button className={styles.toyBtn} onClick={smooth}>Smooth Sand</button>
      </div>
      <div className={styles.sandTray}>
        <canvas ref={canvasRef} className={styles.sandCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
      {strokes > 40 && <p className={styles.toyMsg}>✨ Nice raking — smooth it out and start a new pattern any time.</p>}
    </div>
  )
}
