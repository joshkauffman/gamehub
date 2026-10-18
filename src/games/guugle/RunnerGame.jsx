import { useEffect, useRef, useState } from 'react'
import styles from './Guugle.module.css'
import DoodleGameFrame from './DoodleGameFrame.jsx'
import { freshState, stepGame, CANVAS_W, CANVAS_H, GROUND_Y, PLAYER_X } from './doodleRunner.js'

// ── A tiny playable "jump the obstacle" doodle game ────────────────────
// Press space / tap / click to jump incoming obstacles. Timing, not
// positioning — the player's x position never changes.

function render(ctx, state) {
  const { skin } = state
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  grad.addColorStop(0, skin.bg[0])
  grad.addColorStop(1, skin.bg[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 14); ctx.lineTo(CANVAS_W, GROUND_Y + 14); ctx.stroke()

  ctx.font = '34px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const o of state.obstacles) ctx.fillText(skin.obstacle, o.x, GROUND_Y)

  ctx.font = '36px sans-serif'
  ctx.fillText('🏃', PLAYER_X, state.y)

  ctx.textAlign = 'left'
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(`Score: ${state.score}`, 12, 24)
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.ceil(state.timeLeft / 60)}s`, CANVAS_W - 12, 24)
}

export default function RunnerGame({ skin, onExit, onMore }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const jumpRef = useRef(false)
  const rafRef = useRef(null)
  const doneRef = useRef(false)
  const [done, setDone] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  if (!stateRef.current) stateRef.current = freshState(skin)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jumpRef.current = true }
    }
    function onKeyUp(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') jumpRef.current = false
    }
    function onPointerDown() { jumpRef.current = true }
    function onPointerUp() { jumpRef.current = false }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)

    function loop() {
      const state = stateRef.current
      stepGame(state, { jump: jumpRef.current })
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
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
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
      hint="Press space, or tap/click, to jump. Clear each one in the air."
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
