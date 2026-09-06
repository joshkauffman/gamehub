import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 380
const H = 260

function drawScreen(ctx) {
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#dfe3e6')
  grad.addColorStop(1, '#c7ccd1')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

export default function EtchASketch() {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const [shaking, setShaking] = useState(false)
  const runtime = useRef({ dragging: false, lastX: 0, lastY: 0, lastSound: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    drawScreen(ctx)

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
      ctx.strokeStyle = '#4a4a4a'
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(rt.lastX, rt.lastY)
      ctx.lineTo(x, y)
      ctx.stroke()
      rt.lastX = x; rt.lastY = y
      const now = performance.now()
      if (now - rt.lastSound > 90) { rt.lastSound = now; playClick(1400 + Math.random() * 200, 0.015) }
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

  function shake() {
    setShaking(true)
    setTimeout(() => {
      drawScreen(canvasRef.current.getContext('2d'))
      setShaking(false)
    }, 420)
  }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Drag to draw a line</span>
        <button className={styles.toyBtn} onClick={shake}>Shake to Clear</button>
      </div>
      <div ref={frameRef} className={`${styles.etchFrame} ${shaking ? styles.etchShaking : ''}`}>
        <canvas ref={canvasRef} className={styles.etchCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
        <div className={styles.etchKnobRow}>
          <span className={styles.etchKnob} />
          <span className={styles.etchKnob} />
        </div>
      </div>
    </div>
  )
}
