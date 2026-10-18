import { useEffect, useRef, useState } from 'react'
import styles from './Guugle.module.css'
import DoodleGameFrame from './DoodleGameFrame.jsx'
import { freshState, stepGame, clickHole, HOLES } from './doodleWhack.js'

// ── A tiny playable "whack-a-mole" doodle game ─────────────────────────
// Items pop up into a random hole in a 3x3 grid and sit briefly before
// vanishing unclaimed. Click a hole while it's occupied to score.

const CANVAS_W = 420
const CANVAS_H = 420
const COLS = 3
const PAD = 40
const CELL = (CANVAS_W - PAD * 2) / COLS

function holeCenter(idx) {
  const col = idx % COLS, row = Math.floor(idx / COLS)
  return { x: PAD + CELL * col + CELL / 2, y: PAD + 30 + CELL * row + CELL / 2 }
}

function render(ctx, state) {
  const { skin } = state
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  grad.addColorStop(0, skin.bg[0])
  grad.addColorStop(1, skin.bg[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  for (let i = 0; i < HOLES; i++) {
    const { x, y } = holeCenter(i)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(x, y + 18, CELL * 0.33, CELL * 0.14, 0, 0, Math.PI * 2)
    ctx.fill()
    const h = state.holes[i]
    if (h) {
      ctx.font = '36px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(h.emoji, x, y)
    }
  }

  ctx.textAlign = 'left'
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(`Score: ${state.score}`, 12, 24)
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.ceil(state.timeLeft / 60)}s`, CANVAS_W - 12, 24)
}

export default function WhackGame({ skin, onExit, onMore }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const doneRef = useRef(false)
  const [done, setDone] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  if (!stateRef.current) stateRef.current = freshState(skin)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onPointerDown(e) {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W
      const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H
      let bestIdx = -1, bestDist = Infinity
      for (let i = 0; i < HOLES; i++) {
        const c = holeCenter(i)
        const d = (c.x - x) ** 2 + (c.y - y) ** 2
        if (d < bestDist) { bestDist = d; bestIdx = i }
      }
      if (bestDist < (CELL * 0.5) ** 2) clickHole(stateRef.current, bestIdx)
    }
    canvas.addEventListener('pointerdown', onPointerDown)

    function loop() {
      const state = stateRef.current
      stepGame(state)
      render(ctx, state)
      if (state.status === 'done' && !doneRef.current) {
        doneRef.current = true
        setFinalScore(state.score)
        setDone(true)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function playAgain() {
    stateRef.current = freshState(skin)
    doneRef.current = false
    setDone(false)
  }

  return (
    <DoodleGameFrame
      title={skin.title}
      hint={`Tap an item before it vanishes. Dodge the ${skin.bad}.`}
      canvas={<canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className={styles.doodleCanvas} />}
      canvasW={CANVAS_W}
      canvasH={CANVAS_H}
      done={done}
      finalScore={finalScore}
      onPlayAgain={playAgain}
      onExit={onExit}
      onMore={onMore}
    />
  )
}
