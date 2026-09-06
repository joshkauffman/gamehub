import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick, playCrack } from '../sound.js'

const W = 300
const H = 260
const TIP = { x: W / 2, y: 210 }
const BODY_H = 120
const BODY_W = 86
const MAX_SPIN = 26
const FRICTION = 0.42
const FALL_SPIN = 2.4
const COLORS = ['#6c63ff', '#ff6584', '#5cff8f', '#ffd700', '#00e5ff']

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

export default function SpinningTop() {
  const canvasRef = useRef(null)
  const [color, setColor] = useState(COLORS[0])
  const colorRef = useRef(color)
  colorRef.current = color
  const state = useRef({ spin: 0, angle: 0, wobblePhase: 0, fallProgress: 1, falling: false })

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    function launch() {
      const s = state.current
      s.spin = MAX_SPIN
      s.falling = false
      s.fallProgress = 0
      playClick(300, 0.08)
    }
    function onDown() { launch() }
    canvas.addEventListener('pointerdown', onDown)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const s = state.current

      if (s.fallProgress < 1) {
        s.spin *= Math.max(0, 1 - FRICTION * dt)
        s.angle += s.spin * dt
        s.wobblePhase += dt * 9
        if (s.spin < FALL_SPIN && !s.falling) {
          s.falling = true
          playCrack(90, 0.2)
        }
        if (s.falling) {
          s.fallProgress = clamp(s.fallProgress + dt * 1.6, 0, 1)
        }
      }

      const wobbleAmp = s.falling ? 0 : clamp(1 - s.spin / MAX_SPIN, 0, 1) * 14
      const tiltX = Math.sin(s.wobblePhase) * wobbleAmp
      const fallEase = s.fallProgress * s.fallProgress * (3 - 2 * s.fallProgress)

      ctx.clearRect(0, 0, W, H)
      // table + contact shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath(); ctx.ellipse(TIP.x, TIP.y + 4, 60, 10, 0, 0, Math.PI * 2); ctx.fill()

      ctx.save()
      ctx.translate(TIP.x, TIP.y)
      ctx.rotate(fallEase * (Math.PI / 2))
      const topX = tiltX * (1 - fallEase)
      const topY = -BODY_H

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(-BODY_W * 0.5, -BODY_H * 0.35, topX - BODY_W * 0.5, topY + BODY_H * 0.25, topX, topY)
      ctx.bezierCurveTo(topX + BODY_W * 0.5, topY + BODY_H * 0.25, BODY_W * 0.5, -BODY_H * 0.35, 0, 0)
      ctx.closePath()
      const grad = ctx.createLinearGradient(-BODY_W / 2, 0, BODY_W / 2, 0)
      grad.addColorStop(0, '#00000033')
      grad.addColorStop(0.5, colorRef.current)
      grad.addColorStop(1, '#ffffff33')
      ctx.fillStyle = grad
      ctx.fill()

      // Spin highlight streak — the one cue that reads as "still spinning".
      ctx.save()
      ctx.clip()
      const shineX = Math.sin(s.angle) * BODY_W * 0.32
      const shineGrad = ctx.createLinearGradient(shineX - 10, 0, shineX + 10, 0)
      shineGrad.addColorStop(0, 'rgba(255,255,255,0)')
      shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.55)')
      shineGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = shineGrad
      ctx.fillRect(-BODY_W, topY - 10, BODY_W * 2, BODY_H + 20)
      ctx.restore()
      ctx.restore()
    }
    raf = requestAnimationFrame(tick)

    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onDown) }
  }, [])

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Click the top to launch it</span>
        <div className={styles.swatchRow}>
          {COLORS.map(c => (
            <button key={c} className={styles.swatch} style={{ background: c }} onClick={() => setColor(c)} aria-label="top color" />
          ))}
        </div>
      </div>
      <div className={styles.topStage}>
        <canvas ref={canvasRef} className={styles.topCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
