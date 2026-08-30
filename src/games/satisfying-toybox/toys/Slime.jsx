import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playSquish, playClick } from '../sound.js'

const SIZE = 320
const CX = SIZE / 2
const CY = SIZE / 2
const REST_R = 100
const POINT_COUNT = 32
const INFLUENCE_ANGLE = 1.15
const STIFFNESS = 0.16
const DAMPING = 0.8
const MAX_STRETCH = 145 // stays inside the canvas half-size (160) so a big drag never clips at the edge

const COLORS = ['#5ce65c', '#5cc9ff', '#ff7fd6', '#b98cff', '#ffb84d']

function angleDiff(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

export default function Slime() {
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

    const points = Array.from({ length: POINT_COUNT }, (_, i) => ({
      angle: (i / POINT_COUNT) * Math.PI * 2,
      radius: REST_R,
      vel: 0,
    }))

    const drag = { active: false, downAt: 0, downDist: 0, angle: 0, dist: REST_R }

    function localPoint(e) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (SIZE / rect.width) - CX
      const y = (e.clientY - rect.top) * (SIZE / rect.height) - CY
      return { angle: Math.atan2(y, x), dist: Math.min(MAX_STRETCH, Math.hypot(x, y)) }
    }

    function onDown(e) {
      const { angle, dist } = localPoint(e)
      drag.active = true
      drag.downAt = performance.now()
      drag.downDist = dist
      drag.angle = angle
      drag.dist = dist
      canvas.setPointerCapture(e.pointerId)
      playSquish(180 + Math.random() * 40, 0.15)
    }
    function onMove(e) {
      if (!drag.active) return
      const { angle, dist } = localPoint(e)
      drag.angle = angle
      drag.dist = dist
    }
    function onUp(e) {
      if (!drag.active) return
      drag.active = false
      const elapsed = performance.now() - drag.downAt
      if (elapsed < 160 && drag.downDist < 40) {
        // A quick tap in the middle — poke it and let it jiggle back.
        const { angle } = localPoint(e)
        for (const p of points) {
          const infl = Math.max(0, 1 - angleDiff(p.angle, angle) / INFLUENCE_ANGLE)
          p.vel -= infl * 10
        }
        playClick(300, 0.06)
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    let t = 0
    function tick() {
      raf = requestAnimationFrame(tick)
      t += 1 / 60

      for (const p of points) {
        let target = REST_R + Math.sin(t * 1.6 + p.angle * 3) * 2.5
        if (drag.active) {
          const infl = Math.max(0, 1 - angleDiff(p.angle, drag.angle) / INFLUENCE_ANGLE)
          if (infl > 0) target = target + (drag.dist - target) * infl
        }
        p.vel += (target - p.radius) * STIFFNESS
        p.vel *= DAMPING
        p.radius += p.vel
      }

      draw()
    }

    function draw() {
      ctx.clearRect(0, 0, SIZE, SIZE)

      const pts = points.map(p => ({
        x: CX + Math.cos(p.angle) * p.radius,
        y: CY + Math.sin(p.angle) * p.radius,
      }))

      // Soft shadow beneath the blob.
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(CX, CY + REST_R * 0.55, REST_R * 0.85, REST_R * 0.28, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.filter = 'blur(8px)'
      ctx.fill()
      ctx.restore()

      ctx.beginPath()
      const first = pts[0], last = pts[pts.length - 1]
      ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2)
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i], next = pts[(i + 1) % pts.length]
        const midX = (cur.x + next.x) / 2, midY = (cur.y + next.y) / 2
        ctx.quadraticCurveTo(cur.x, cur.y, midX, midY)
      }
      ctx.closePath()

      const grad = ctx.createRadialGradient(CX - 35, CY - 45, 8, CX, CY, REST_R * 1.6)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.35, colorRef.current)
      grad.addColorStop(1, shade(colorRef.current))
      ctx.save()
      ctx.shadowColor = colorRef.current
      ctx.shadowBlur = 18
      ctx.fillStyle = grad
      ctx.globalAlpha = 0.94
      ctx.fill()
      ctx.restore()

      // Specular highlight.
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(CX - REST_R * 0.35, CY - REST_R * 0.4, 20, 12, -0.5, 0, Math.PI * 2)
      ctx.fill()
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
        <span className={styles.toyStat}>Drag to stretch it, tap to poke it</span>
        <div className={styles.swatchRow}>
          {COLORS.map(c => (
            <button key={c} className={styles.swatch} style={{ background: c }} onClick={() => setColor(c)} aria-label="slime color" />
          ))}
        </div>
      </div>
      <div className={styles.slimeStage}>
        <canvas ref={canvasRef} className={styles.slimeCanvas} style={{ aspectRatio: '1 / 1' }} />
      </div>
    </div>
  )
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (n >> 16) - 60)
  const g = Math.max(0, ((n >> 8) & 0xff) - 60)
  const b = Math.max(0, (n & 0xff) - 60)
  return `rgb(${r},${g},${b})`
}
