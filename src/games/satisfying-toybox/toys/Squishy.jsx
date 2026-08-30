import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playSquish } from '../sound.js'

const COLORS = ['#ffb3c6', '#b3e5ff', '#c9ffb3', '#ffe6a3', '#d9b3ff']
const STIFFNESS = 210
const DAMPING = 14

export default function Squishy() {
  const [color, setColor] = useState(COLORS[0])
  const elRef = useRef(null)
  const pressedRef = useRef(false)
  const springRef = useRef({ x: 1, y: 1, vx: 0, vy: 0 })

  useEffect(() => {
    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const s = springRef.current
      const targetX = pressedRef.current ? 1.3 : 1
      const targetY = pressedRef.current ? 0.7 : 1

      s.vx += (targetX - s.x) * STIFFNESS * dt
      s.vx *= Math.max(0, 1 - DAMPING * dt)
      s.x += s.vx * dt

      s.vy += (targetY - s.y) * STIFFNESS * dt
      s.vy *= Math.max(0, 1 - DAMPING * dt)
      s.y += s.vy * dt

      if (elRef.current) elRef.current.style.transform = `scale(${s.x}, ${s.y})`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function onDown() {
    pressedRef.current = true
    playSquish(200 + Math.random() * 60, 0.18)
  }
  function onUp() { pressedRef.current = false }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Press and hold to squish</span>
        <div className={styles.swatchRow}>
          {COLORS.map(c => (
            <button key={c} className={styles.swatch} style={{ background: c }} onClick={() => setColor(c)} aria-label="squishy color" />
          ))}
        </div>
      </div>
      <div className={styles.squishyStage}>
        <div
          ref={elRef}
          className={styles.squishyBlob}
          style={{ background: color }}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
        >
          <div className={styles.squishyFace}>
            <span className={styles.squishyEye} />
            <span className={styles.squishyEye} />
            <span className={styles.squishyMouth} />
          </div>
        </div>
      </div>
    </div>
  )
}
