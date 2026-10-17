import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousSonicKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame } from './engine.js'
import { render } from './render.js'

// ── The Obvious Sonic Knockoff ─────────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: a blue speedster runs, rolls, and
// spin-dashes across three short zones, collecting rings that scatter
// instead of hurting you directly, curling into a ball to flatten
// badniks, and squaring off with a hovering boss pod at the end. Any
// resemblance to a certain blue, impatient, ring-collecting mascot is
// extremely on purpose and also legally just vibes.
//
// See levels.js for the zone courses (ground segments, rings, badniks,
// goal signposts), engine.js for the momentum/slope physics and
// spin-dash state machine, and render.js for everything drawn to the
// canvas.

function GameCanvas({ onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  if (!stateRef.current) stateRef.current = freshState()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Space'].includes(e.code)
      if (blocked) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop() {
      const k = keysRef.current
      const input = {
        left: k.has('ArrowLeft') || k.has('KeyA'),
        right: k.has('ArrowRight') || k.has('KeyD'),
        down: k.has('ArrowDown') || k.has('KeyS'),
        jump: k.has('ArrowUp') || k.has('KeyW') || k.has('Space'),
      }
      const state = stateRef.current
      stepGame(state, input)
      render(ctx, state)
      if (state.status === 'win' || state.status === 'gameover') {
        onFinish(state.status, state.score)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onFinish])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

export default function ObviousSonicKnockoff() {
  const [screen, setScreen] = useState('title')
  const [finalScore, setFinalScore] = useState(0)
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(status, score) {
    setFinalScore(score)
    setScreen(status)
  }

  function startGame() {
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>💨 The Obvious Sonic Knockoff</h1>
          <p className={styles.blurb}>
            A blue speedster built for momentum, not patience — run, roll, and spin-dash through
            three short zones, grabbing rings along the way (they scatter instead of hurting you,
            as long as you're still holding at least one when something clips you), curling into a
            ball to flatten badniks, and squaring off with a hovering boss pod at the end. Any
            resemblance to a certain blue, impatient, ring-collecting mascot is <em>extremely</em>{' '}
            on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → run · ↑ / Space jump (curls you into a roll) · hold ↓ to duck, tap Jump while
            ducking to rev a spin-dash, release ↓ to launch
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 Zones Cleared!</h1>
          <p className={styles.blurb}>Final score: {finalScore}.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Play Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>💥 Ran Out of Lives</h1>
          <p className={styles.blurb}>Final score: {finalScore}.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Try Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
