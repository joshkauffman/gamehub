import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'

const W = 220
const H = 340
const BLOB_COUNT = 6
const COLORS = [
  { glow: '#ff6b8b', dim: '#7a1f38' },
  { glow: '#ffb454', dim: '#7a4a10' },
  { glow: '#63d4ff', dim: '#0f4a63' },
  { glow: '#5cff8f', dim: '#0f5c30' },
  { glow: '#c17dff', dim: '#3f1f6b' },
]

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

function mkBlobs() {
  return Array.from({ length: BLOB_COUNT }, () => ({
    x: 40 + Math.random() * (W - 80),
    y: 40 + Math.random() * (H - 80),
    r: 20 + Math.random() * 16,
    vy: (Math.random() - 0.5) * 6,
    phase: Math.random() * Math.PI * 2,
  }))
}

export default function LavaLamp() {
  const canvasRef = useRef(null)
  const [colorIdx, setColorIdx] = useState(0)
  const colorRef = useRef(COLORS[0])
  colorRef.current = COLORS[colorIdx]
  const blobsRef = useRef(mkBlobs())

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    function onDown(e) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (W / rect.width)
      const y = (e.clientY - rect.top) * (H / rect.height)
      let nearest = null, best = Infinity
      for (const b of blobsRef.current) {
        const d = Math.hypot(b.x - x, b.y - y)
        if (d < best) { best = d; nearest = b }
      }
      if (nearest) nearest.vy -= 26 * Math.sign(nearest.y - y || -1)
    }
    canvas.addEventListener('pointerdown', onDown)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      ctx.clearRect(0, 0, W, H)
      ctx.save()
      // Lamp glass silhouette
      const r = 44
      ctx.beginPath()
      ctx.moveTo(r, 4)
      ctx.arcTo(W - 4, 4, W - 4, H - 4, r)
      ctx.arcTo(W - 4, H - 4, 4, H - 4, r)
      ctx.arcTo(4, H - 4, 4, 4, r)
      ctx.arcTo(4, 4, W - 4, 4, r)
      ctx.closePath()
      ctx.clip()

      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#1a1420')
      bg.addColorStop(1, '#2a1810')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      const color = colorRef.current
      for (const b of blobsRef.current) {
        b.vy += (Math.random() - 0.5) * 7 * dt
        b.vy = clamp(b.vy, -16, 16)
        b.y += b.vy * dt * 6
        b.phase += dt * 0.5
        b.x += Math.sin(b.phase) * 0.25
        if (b.y < b.r + 6) { b.y = b.r + 6; b.vy = Math.abs(b.vy) }
        if (b.y > H - b.r - 6) { b.y = H - b.r - 6; b.vy = -Math.abs(b.vy) }
        b.x = clamp(b.x, b.r + 4, W - b.r - 4)
      }

      ctx.globalCompositeOperation = 'lighter'
      ctx.filter = 'blur(5px)'
      for (const b of blobsRef.current) {
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        grad.addColorStop(0, color.glow)
        grad.addColorStop(1, color.dim)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-over'

      const glassShine = ctx.createLinearGradient(0, 0, W, 0)
      glassShine.addColorStop(0, 'rgba(255,255,255,0.12)')
      glassShine.addColorStop(0.3, 'rgba(255,255,255,0)')
      glassShine.addColorStop(0.7, 'rgba(255,255,255,0)')
      glassShine.addColorStop(1, 'rgba(255,255,255,0.08)')
      ctx.fillStyle = glassShine
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onDown) }
  }, [])

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Click a blob to give it a nudge</span>
        <div className={styles.swatchRow}>
          {COLORS.map((c, i) => (
            <button key={i} className={styles.swatch} style={{ background: c.glow }} onClick={() => setColorIdx(i)} aria-label="lava lamp color" />
          ))}
        </div>
      </div>
      <div className={styles.lavaStage}>
        <canvas ref={canvasRef} className={styles.lavaCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
