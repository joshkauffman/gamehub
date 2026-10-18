import { useEffect, useRef, useState } from 'react'
import styles from './Guugle.module.css'
import { freshState, stepGame, CANVAS_W, CANVAS_H, BASKET_Y } from './doodleGame.js'

// ── A tiny playable "catch the falling things" doodle game ────────────
// One shared engine (doodleGame.js) reskinned per holiday/season via
// `skin` ({ title, good: [emoji...], bad: emoji, bg: [color,color] }).
// Pure canvas rendering here, same pattern as every other game in this
// repo: engine owns state, this component just draws it and feeds
// pointer/keyboard input in.

function render(ctx, state) {
  const { skin } = state
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  grad.addColorStop(0, skin.bg[0])
  grad.addColorStop(1, skin.bg[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.font = '28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const it of state.items) ctx.fillText(it.emoji, it.x, it.y)

  // basket
  ctx.font = '40px sans-serif'
  ctx.fillText('🧺', state.basketX, BASKET_Y + 6)

  // HUD
  ctx.textAlign = 'left'
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(`Score: ${state.score}`, 12, 24)
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.ceil(state.timeLeft / 60)}s`, CANVAS_W - 12, 24)
}

export default function DoodleGame({ skin, onExit, onMore }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const pointerXRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const doneRef = useRef(false)
  const [done, setDone] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  if (!stateRef.current) stateRef.current = freshState(skin)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function canvasX(clientX) {
      const rect = canvas.getBoundingClientRect()
      return ((clientX - rect.left) / rect.width) * CANVAS_W
    }
    function onPointerMove(e) { pointerXRef.current = canvasX(e.clientX) }
    function onTouchMove(e) {
      if (e.touches[0]) pointerXRef.current = canvasX(e.touches[0].clientX)
      e.preventDefault()
    }
    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop() {
      const state = stateRef.current
      const input = pointerXRef.current != null
        ? { targetX: pointerXRef.current }
        : { left: keysRef.current.has('ArrowLeft'), right: keysRef.current.has('ArrowRight') }
      stepGame(state, input)
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
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function playAgain() {
    stateRef.current = freshState(skin)
    doneRef.current = false
    setDone(false)
  }

  return (
    <div className={styles.doodleGameWrap}>
      <h1 className={styles.doodleGameTitle}>{skin.title}</h1>
      <p className={styles.doodleGameHint}>Move the basket — mouse, touch, or ← →. Dodge the {skin.bad}.</p>
      <div className={styles.doodleCanvasWrap}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className={styles.doodleCanvas} />
        {done && (
          <div className={styles.doodleOverlay}>
            <div className={styles.doodleOverlayScore}>Final Score: {finalScore}</div>
            <div className={styles.doodleOverlayRow}>
              <button className={styles.btn} onClick={playAgain}>Play Again</button>
              <button className={styles.btn} onClick={() => onExit(finalScore)}>Back to Guugle</button>
            </div>
            {onMore && (
              <button className={styles.smallExitBtn} onClick={onMore}>🎮 Play another doodle</button>
            )}
          </div>
        )}
      </div>
      {!done && (
        <div className={styles.doodleExitRow}>
          <button className={styles.smallExitBtn} onClick={() => onExit(null)}>Exit</button>
          {onMore && <button className={styles.smallExitBtn} onClick={onMore}>🎮 Play another doodle</button>}
        </div>
      )}
    </div>
  )
}
