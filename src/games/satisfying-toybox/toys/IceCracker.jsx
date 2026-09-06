import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playCrack } from '../sound.js'

const W = 420
const H = 260
const SHATTER_AT = 6

function drawPane(ctx) {
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#eafcff')
  grad.addColorStop(0.5, '#bfeeff')
  grad.addColorStop(1, '#8fd6f0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  // A soft diagonal shine so it reads as glass/ice, not flat blue.
  const shine = ctx.createLinearGradient(0, 0, W, H)
  shine.addColorStop(0, 'rgba(255,255,255,0.5)')
  shine.addColorStop(0.25, 'rgba(255,255,255,0.05)')
  shine.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  shine.addColorStop(1, 'rgba(255,255,255,0.05)')
  ctx.fillStyle = shine
  ctx.fillRect(0, 0, W, H)
}

function crackBranch(ctx, x, y, angle, length, depth) {
  if (depth <= 0 || length < 4) return
  const x2 = x + Math.cos(angle) * length
  const y2 = y + Math.sin(angle) * length
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke()
  const branches = Math.random() < 0.6 ? 1 : 2
  for (let i = 0; i < branches; i++) {
    const a2 = angle + (Math.random() - 0.5) * 1.4
    crackBranch(ctx, x2, y2, a2, length * (0.55 + Math.random() * 0.25), depth - 1)
  }
}

function crackAt(ctx, x, y, rays, depth, length) {
  ctx.save()
  ctx.strokeStyle = 'rgba(40,70,90,0.55)'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  for (let i = 0; i < rays; i++) {
    crackBranch(ctx, x, y, Math.random() * Math.PI * 2, length, depth)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 0.9
  for (let i = 0; i < rays; i++) {
    crackBranch(ctx, x, y, Math.random() * Math.PI * 2, length, depth)
  }
  ctx.restore()
}

export default function IceCracker() {
  const canvasRef = useRef(null)
  const [hits, setHits] = useState(0)
  const [shattered, setShattered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    drawPane(ctx)
  }, [])

  function onTap(e) {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (W / rect.width)
    const y = (e.clientY - rect.top) * (H / rect.height)

    if (shattered) {
      drawPane(ctx)
      setShattered(false)
      setHits(0)
      return
    }

    crackAt(ctx, x, y, 6, 5, 26)
    playCrack(110 + Math.random() * 70, 0.13)
    const next = hits + 1
    setHits(next)
    if (next >= SHATTER_AT) {
      for (let i = 0; i < 5; i++) {
        crackAt(ctx, Math.random() * W, Math.random() * H, 5, 5, 22)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(0, 0, W, H)
      playCrack(70, 0.3)
      setShattered(true)
    }
  }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>{shattered ? 'Shattered! Tap for a fresh pane' : `Tap the ice to crack it (${hits}/${SHATTER_AT})`}</span>
        <button className={styles.toyBtn} onClick={() => { drawPane(canvasRef.current.getContext('2d')); setShattered(false); setHits(0) }}>New Pane</button>
      </div>
      <div className={styles.iceTray}>
        <canvas ref={canvasRef} className={styles.iceCanvas} style={{ aspectRatio: `${W} / ${H}` }} onPointerDown={onTap} />
      </div>
      {shattered && <p className={styles.toyMsg}>💥 Shattered! Tap the ice for a brand new pane.</p>}
    </div>
  )
}
