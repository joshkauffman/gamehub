import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

const W = 420
const H = 200
const N = 14
const SPACING = 27
const START_X = 34
const BASE_Y = 168
const DOM_W = 11
const DOM_H = 78
const STAGGER = 85
const FALL_DURATION = 220

const COLORS = ['#6c63ff', '#ff6584', '#5cff8f', '#ffd700', '#00e5ff']

export default function DominoRally() {
  const canvasRef = useRef(null)
  const [standing, setStanding] = useState(true)
  const runtime = useRef({ triggerTime: null, landed: new Array(N).fill(false) })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    let raf
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const rt = runtime.current
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(0, BASE_Y + 2, W, 4)

      for (let i = 0; i < N; i++) {
        const x = START_X + i * SPACING
        let fall = 0
        if (rt.triggerTime != null) {
          const local = now - rt.triggerTime - i * STAGGER
          fall = Math.max(0, Math.min(1, local / FALL_DURATION))
          if (fall >= 1 && !rt.landed[i]) { rt.landed[i] = true; playClick(220 - i * 4, 0.05) }
        }
        const eased = fall * fall * (3 - 2 * fall)
        ctx.save()
        ctx.translate(x, BASE_Y)
        ctx.rotate(eased * (Math.PI / 2.15))
        ctx.fillStyle = COLORS[i % COLORS.length]
        ctx.fillRect(-DOM_W / 2, -DOM_H, DOM_W, DOM_H)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(-DOM_W / 2, -DOM_H, DOM_W, 6)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        for (let d = 0; d < 3; d++) {
          ctx.beginPath()
          ctx.arc(0, -DOM_H * 0.3 - d * DOM_H * 0.22, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function push() {
    if (!standing) return
    runtime.current.triggerTime = performance.now()
    runtime.current.landed = new Array(N).fill(false)
    setStanding(false)
  }
  function reset() {
    runtime.current.triggerTime = null
    runtime.current.landed = new Array(N).fill(false)
    setStanding(true)
  }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Push the first domino and watch the chain reaction</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.toyBtn} onClick={push} disabled={!standing}>Push</button>
          <button className={styles.toyBtn} onClick={reset}>Stand Up</button>
        </div>
      </div>
      <div className={styles.dominoTray}>
        <canvas
          ref={canvasRef}
          className={styles.dominoCanvas}
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={push}
        />
      </div>
    </div>
  )
}
