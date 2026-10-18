import { useEffect, useRef, useState } from 'react'
import styles from './Guugle.module.css'
import DoodleGameFrame from './DoodleGameFrame.jsx'
import { freshState, stepGame, attemptHit, markerPos, CANVAS_W, CANVAS_H, BAR_Y, BAR_W, BAR_X } from './doodleTiming.js'

// ── A tiny playable "timing / reflex" doodle game ──────────────────────
// A marker sweeps a bar holding a good zone and a bad zone that move
// after every attempt. Tap/click/space at the right instant to score.

const FLASH_TEXT = { good: '+1!', bad: '-1', miss: 'Miss' }
const FLASH_COLOR = { good: '#6fdc8c', bad: '#ff6b6b', miss: 'rgba(255,255,255,0.6)' }

function render(ctx, state) {
  const { skin } = state
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  grad.addColorStop(0, skin.bg[0])
  grad.addColorStop(1, skin.bg[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // bar
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(BAR_X, BAR_Y - 8, BAR_W, 16)

  const { good, bad } = state.zones
  ctx.fillStyle = 'rgba(100,220,140,0.85)'
  ctx.fillRect(BAR_X + good[0], BAR_Y - 8, good[1] - good[0], 16)
  ctx.fillStyle = 'rgba(255,90,90,0.85)'
  ctx.fillRect(BAR_X + bad[0], BAR_Y - 8, bad[1] - bad[0], 16)

  const mx = BAR_X + markerPos(state)
  ctx.font = '30px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(skin.marker, mx, BAR_Y)

  if (state.flash) {
    ctx.globalAlpha = Math.max(0, state.flash.ttl / 20)
    ctx.fillStyle = FLASH_COLOR[state.flash.result]
    ctx.font = '700 22px system-ui, sans-serif'
    ctx.fillText(FLASH_TEXT[state.flash.result], CANVAS_W / 2, BAR_Y - 46)
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'left'
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(`Score: ${state.score}`, 12, 24)
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.ceil(state.timeLeft / 60)}s`, CANVAS_W - 12, 24)
}

export default function TimingGame({ skin, onExit, onMore }) {
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

    function onPointerDown() { attemptHit(stateRef.current) }
    function onKeyDown(e) {
      if (e.code === 'Space') { e.preventDefault(); attemptHit(stateRef.current) }
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

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
      window.removeEventListener('keydown', onKeyDown)
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
      hint="Tap, click, or press space when the marker hits the green zone. Avoid red."
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
