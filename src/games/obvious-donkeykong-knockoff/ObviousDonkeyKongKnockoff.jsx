import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousDonkeyKongKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame, nextStageState, restartRun } from './engine.js'
import { renderGame } from './render.js'

// ── The Obvious Donkey Kong Knockoff ──────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: climb girders, dodge rolling barrels,
// swing a hammer, and rescue Biscuit the dog from Krunk the ape across
// three single-screen stages. Any resemblance to a certain barrel-
// throwing arcade classic is extremely on purpose and also legally
// just vibes.

function GameCanvas({ initialState, onCleared, onGameOver }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(initialState)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const advancedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault()
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
        up: k.has('ArrowUp') || k.has('KeyW'),
        down: k.has('ArrowDown') || k.has('KeyS'),
        jump: k.has('Space') || k.has('KeyZ'),
      }
      const state = stateRef.current
      stepGame(state, input)
      renderGame(ctx, state)

      if (!advancedRef.current && state.status === 'cleared') {
        advancedRef.current = true
        setTimeout(() => onCleared(state), 1200)
      } else if (!advancedRef.current && state.status === 'gameover') {
        advancedRef.current = true
        setTimeout(() => onGameOver(state), 1500)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

export default function ObviousDonkeyKongKnockoff() {
  const [screen, setScreen] = useState('title')
  const [runState, setRunState] = useState(null)
  const [finalScore, setFinalScore] = useState(0)

  function handleStart() {
    setRunState(freshState(0))
    setScreen('playing')
  }
  function handleCleared(clearedState) {
    const next = nextStageState(clearedState)
    if (next) {
      setRunState(next)
      setScreen('playing')
    } else {
      setFinalScore(clearedState.score)
      setScreen('win')
    }
  }
  function handleGameOver(deadState) {
    setFinalScore(deadState.score)
    setScreen('gameover')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🦍 The Obvious Donkey Kong Knockoff</h1>
          <p className={styles.blurb}>
            Krunk the ape has snatched Biscuit the dog and he is <em>not</em> giving them back.
            Climb the girders, dodge the barrels he keeps rolling down at you, grab the hammer when
            you see it, and work your way up through three stages to get Biscuit home. Any
            resemblance to a certain barrel-throwing arcade classic is <em>extremely</em> on purpose
            and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → move · ↑ / ↓ climb ladders · Space jump
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={handleStart}>Start Knocking Off</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && runState && (
        <GameCanvas key={runState.stageIndex} initialState={runState} onCleared={handleCleared} onGameOver={handleGameOver} />
      )}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🐶 Biscuit is home!</h1>
          <p className={styles.blurb}>Krunk gave up after three stages. Final score: {finalScore}.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => { setRunState(restartRun()); setScreen('playing') }}>
              Play Again
            </button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>Krunk wins this round.</h1>
          <p className={styles.blurb}>Final score: {finalScore}.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => { setRunState(restartRun()); setScreen('playing') }}>
              Try Again
            </button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
