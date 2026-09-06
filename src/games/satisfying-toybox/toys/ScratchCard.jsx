import { useEffect, useRef, useState } from 'react'
import styles from '../SatisfyingToybox.module.css'
import { playClick, playChime } from '../sound.js'

const W = 420
const H = 260
const REVEAL_AT = 65

const PRIZES = [
  ['#ff6b8b', '#ffd166', '#5cff8f', '#63d4ff', '#c17dff'],
  ['#ffd166', '#ff9f43', '#ff6b8b', '#c17dff', '#63d4ff'],
  ['#5cff8f', '#63d4ff', '#c17dff', '#ffd166', '#ff6b8b'],
]

function drawPrize(ctx, palette) {
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, H)
  palette.forEach((c, i) => grad.addColorStop(i / (palette.length - 1), c))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  let seed = Math.floor(Math.random() * 100000)
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (let i = 0; i < 22; i++) {
    const x = rand() * W, y = rand() * H, r = 6 + rand() * 16
    ctx.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.25})`
    ctx.beginPath()
    for (let p = 0; p < 5; p++) {
      const a = (Math.PI * 2 * p) / 5 - Math.PI / 2
      const a2 = a + Math.PI / 5
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🎉 YOU FOUND IT 🎉', W / 2, H / 2)
}

function drawFoil(ctx) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#d8dee6')
  grad.addColorStop(0.35, '#f4f7fb')
  grad.addColorStop(0.5, '#aab2bd')
  grad.addColorStop(0.65, '#f4f7fb')
  grad.addColorStop(1, '#c3cad3')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(90,100,115,0.8)'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✨ SCRATCH HERE ✨', W / 2, H / 2)
}

export default function ScratchCard() {
  const prizeRef = useRef(null)
  const foilRef = useRef(null)
  const [percent, setPercent] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const runtime = useRef({ dragging: false, lastX: 0, lastY: 0, scratchCount: 0, dpr: 1, revealed: false })

  function newCard() {
    const palette = PRIZES[Math.floor(Math.random() * PRIZES.length)]
    drawPrize(prizeRef.current.getContext('2d'), palette)
    drawFoil(foilRef.current.getContext('2d'))
    setPercent(0)
    setRevealed(false)
    runtime.current.revealed = false
    runtime.current.scratchCount = 0
  }

  useEffect(() => {
    const prize = prizeRef.current
    const foil = foilRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    runtime.current.dpr = dpr
    ;[prize, foil].forEach(c => { c.width = W * dpr; c.height = H * dpr })
    const prizeCtx = prize.getContext('2d')
    const foilCtx = foil.getContext('2d', { willReadFrequently: true })
    prizeCtx.scale(dpr, dpr)
    foilCtx.scale(dpr, dpr)
    drawPrize(prizeCtx, PRIZES[0])
    drawFoil(foilCtx)

    function toLocal(e) {
      const rect = foil.getBoundingClientRect()
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }
    }
    function scratchAt(x, y) {
      foilCtx.globalCompositeOperation = 'destination-out'
      const grad = foilCtx.createRadialGradient(x, y, 0, x, y, 20)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      foilCtx.fillStyle = grad
      foilCtx.beginPath(); foilCtx.arc(x, y, 20, 0, Math.PI * 2); foilCtx.fill()
    }
    function samplePercent() {
      const dprNow = runtime.current.dpr
      let clear = 0
      const cols = 16, rows = 10
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = Math.floor(((c + 0.5) / cols) * W * dprNow)
          const py = Math.floor(((r + 0.5) / rows) * H * dprNow)
          const data = foilCtx.getImageData(px, py, 1, 1).data
          if (data[3] < 40) clear++
        }
      }
      return Math.round((clear / (cols * rows)) * 100)
    }

    function onDown(e) {
      if (runtime.current.revealed) return
      const rt = runtime.current
      rt.dragging = true
      const { x, y } = toLocal(e)
      rt.lastX = x; rt.lastY = y
      scratchAt(x, y)
      foil.setPointerCapture(e.pointerId)
    }
    function onMove(e) {
      const rt = runtime.current
      if (!rt.dragging || rt.revealed) return
      const { x, y } = toLocal(e)
      const dist = Math.hypot(x - rt.lastX, y - rt.lastY)
      const steps = Math.max(1, Math.floor(dist / 8))
      for (let i = 1; i <= steps; i++) scratchAt(rt.lastX + (x - rt.lastX) * (i / steps), rt.lastY + (y - rt.lastY) * (i / steps))
      rt.lastX = x; rt.lastY = y
      rt.scratchCount++
      if (rt.scratchCount % 4 === 0) {
        playClick(900 + Math.random() * 200, 0.02)
        const pct = samplePercent()
        setPercent(pct)
        if (pct >= REVEAL_AT && !rt.revealed) {
          rt.revealed = true
          foilCtx.clearRect(0, 0, W, H)
          setPercent(100)
          setRevealed(true)
          playChime(880, 0.4)
        }
      }
    }
    function onUp() { runtime.current.dragging = false }

    foil.addEventListener('pointerdown', onDown)
    foil.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      foil.removeEventListener('pointerdown', onDown)
      foil.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>{revealed ? 'Fully revealed!' : `${percent}% scratched off`}</span>
        <button className={styles.toyBtn} onClick={newCard}>New Card</button>
      </div>
      <div className={styles.scratchTray}>
        <canvas ref={prizeRef} className={styles.scratchCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
        <canvas ref={foilRef} className={styles.scratchFoilCanvas} style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
      {revealed && <p className={styles.toyMsg}>🎉 Fully revealed! Hit "New Card" to scratch another.</p>}
    </div>
  )
}
