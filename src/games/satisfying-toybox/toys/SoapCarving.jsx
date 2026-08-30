import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'

const W = 420
const H = 260

const COLORS = [
  { fill: '#ffe28a', shade: '#e0b84f' },
  { fill: '#b8f2ff', shade: '#7fd6ea' },
  { fill: '#ffc2e0', shade: '#e88bb5' },
  { fill: '#c9ffd6', shade: '#8fe0a3' },
]

function drawBar(ctx, color) {
  ctx.clearRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.18, color.fill)
  grad.addColorStop(1, color.shade)
  ctx.fillStyle = grad
  const r = 26
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(W, 0, W, H, r)
  ctx.arcTo(W, H, 0, H, r)
  ctx.arcTo(0, H, 0, 0, r)
  ctx.arcTo(0, 0, W, 0, r)
  ctx.closePath()
  ctx.fill()
}

export default function SoapCarving() {
  const soapRef = useRef(null)
  const shaveRef = useRef(null)
  const [colorIdx, setColorIdx] = useState(0)
  const [carved, setCarved] = useState(0)
  const runtime = useRef({ color: COLORS[0], carveCount: 0, particles: [], dragging: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    const soap = soapRef.current
    const shave = shaveRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ;[soap, shave].forEach(c => { c.width = W * dpr; c.height = H * dpr })
    const soapCtx = soap.getContext('2d')
    const shaveCtx = shave.getContext('2d')
    soapCtx.scale(dpr, dpr)
    shaveCtx.scale(dpr, dpr)
    drawBar(soapCtx, runtime.current.color)

    function toLocal(e) {
      const rect = soap.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }

    function carveAt(x, y) {
      soapCtx.globalCompositeOperation = 'destination-out'
      const grad = soapCtx.createRadialGradient(x, y, 0, x, y, 16)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      soapCtx.fillStyle = grad
      soapCtx.beginPath(); soapCtx.arc(x, y, 16, 0, Math.PI * 2); soapCtx.fill()

      const rt = runtime.current
      rt.carveCount++
      if (rt.carveCount % 3 === 0) {
        rt.particles.push({
          x, y, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 40,
          age: 0, life: 0.6 + Math.random() * 0.3, rot: (Math.random() - 0.5) * 8, color: rt.color.shade,
        })
      }
      if (rt.carveCount % 8 === 0) setCarved(c => Math.min(100, c + 1))
    }

    function onDown(e) {
      const rt = runtime.current
      rt.dragging = true
      const { x, y } = toLocal(e)
      rt.lastX = x; rt.lastY = y
      carveAt(x, y)
      soap.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      const rt = runtime.current
      if (!rt.dragging) return
      const { x, y } = toLocal(e)
      const dist = Math.hypot(x - rt.lastX, y - rt.lastY)
      const steps = Math.max(1, Math.floor(dist / 6))
      for (let i = 1; i <= steps; i++) {
        carveAt(rt.lastX + (x - rt.lastX) * (i / steps), rt.lastY + (y - rt.lastY) * (i / steps))
      }
      rt.lastX = x; rt.lastY = y
    }
    function onUp() { runtime.current.dragging = false }

    soap.addEventListener('pointerdown', onDown)
    soap.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let raf
    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const rt = runtime.current
      for (const p of rt.particles) { p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt }
      rt.particles = rt.particles.filter(p => p.age < p.life)

      shaveCtx.clearRect(0, 0, W, H)
      for (const p of rt.particles) {
        const t = p.age / p.life
        shaveCtx.save()
        shaveCtx.globalAlpha = Math.max(0, 1 - t)
        shaveCtx.translate(p.x, p.y)
        shaveCtx.rotate(p.rot * p.age)
        shaveCtx.fillStyle = p.color
        shaveCtx.fillRect(-4, -2, 8, 4)
        shaveCtx.restore()
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      soap.removeEventListener('pointerdown', onDown)
      soap.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  function newBar(idx) {
    const color = COLORS[idx]
    runtime.current.color = color
    runtime.current.carveCount = 0
    runtime.current.particles = []
    setCarved(0)
    setColorIdx(idx)
    const soap = soapRef.current
    if (soap) drawBar(soap.getContext('2d'), color)
  }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>{carved}% carved — drag across the bar</span>
        <div className={styles.swatchRow}>
          {COLORS.map((c, i) => (
            <button key={i} className={styles.swatch} style={{ background: c.fill }} onClick={() => newBar(i)} aria-label="soap color" />
          ))}
        </div>
        <button className={styles.toyBtn} onClick={() => newBar(colorIdx)}>New Bar</button>
      </div>
      <div className={styles.soapTray}>
        <canvas ref={soapRef} className={styles.soapCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
        <canvas ref={shaveRef} className={styles.soapShaveCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
    </div>
  )
}
