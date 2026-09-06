import { useEffect, useRef } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 420
const H = 260
const COLS = 34
const ROWS = 21
const CELL = W / COLS
const BRUSH_R = 26

export default function PinArt() {
  const canvasRef = useRef(null)
  const runtime = useRef({ pressing: false, px: -999, py: -999, firstPress: true })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const heights = new Float32Array(COLS * ROWS)

    function toLocal(e) {
      const rect = canvas.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }
    function onDown(e) {
      const rt = runtime.current
      rt.pressing = true
      const { x, y } = toLocal(e)
      rt.px = x; rt.py = y
      canvas.setPointerCapture(e.pointerId)
      if (rt.firstPress) { rt.firstPress = false; playClick(500, 0.05) }
    }
    function onMove(e) {
      const rt = runtime.current
      if (!rt.pressing) return
      const { x, y } = toLocal(e)
      rt.px = x; rt.py = y
    }
    function onUp() { runtime.current.pressing = false; runtime.current.px = -999; runtime.current.py = -999 }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    function tick() {
      raf = requestAnimationFrame(tick)
      const rt = runtime.current
      ctx.clearRect(0, 0, W, H)
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cx = col * CELL + CELL / 2
          const cy = row * CELL + CELL / 2
          const i = row * COLS + col
          const d = Math.hypot(cx - rt.px, cy - rt.py)
          const target = rt.pressing && d < BRUSH_R ? Math.max(0, 1 - d / BRUSH_R) : 0
          const h = heights[i]
          heights[i] = h + (target - h) * (target > h ? 0.55 : 0.035)

          const shade = Math.round(205 - heights[i] * 120)
          const r = (CELL / 2 - 1.2) * (1 - heights[i] * 0.22)
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${shade},${shade},${shade + 6})`
          ctx.fill()
          if (heights[i] < 0.85) {
            ctx.beginPath()
            ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - heights[i])})`
            ctx.fill()
          }
        }
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
        <span className={styles.toyStat}>Press and drag to leave an impression — it fades slowly</span>
      </div>
      <div className={styles.pinBoard}>
        <canvas ref={canvasRef} className={styles.pinCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
