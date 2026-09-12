import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ShirbyAndTheForgottenPlace.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame } from './engine.js'
import { render } from './render.js'
import { LEVELS } from './levels.js'
import { useHorrorMode } from '../../HorrorMode.jsx'

// ── Shirby and the Forgotten Place ────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: a small pink puffball inhales forgotten
// creatures, copies their powers by swallowing them, floats wherever
// jumping won't reach, and works its way toward whoever's really running
// this place. Any resemblance to a certain star-riding hero is extremely
// on purpose and also legally just vibes.
//
// See levels.js for the world roster, engine.js for the physics/rules
// state machine, and render.js for everything drawn to the canvas.

function GameCanvas({ onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  if (!stateRef.current) stateRef.current = freshState()

  const horrorMode = useHorrorMode()
  const horrorModeRef = useRef(horrorMode)
  horrorModeRef.current = horrorMode

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)
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
        jump: k.has('ArrowUp') || k.has('KeyW') || k.has('Space'),
        down: k.has('ArrowDown') || k.has('KeyS'),
        inhale: k.has('KeyZ'),
        attack: k.has('KeyX'),
      }
      const state = stateRef.current
      state.horrorMode = horrorModeRef.current
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

export default function ShirbyAndTheForgottenPlace() {
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

  const worldCount = new Set(LEVELS.map(l => l.id.split('-')[0])).size

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🩷 Shirby and the Forgotten Place</h1>
          <p className={styles.blurb}>
            A small pink puffball inhales things and copies their powers, because that's simply
            how this works now. Wander {worldCount} increasingly strange corners of a place where
            lost and forgotten things pile up and come to life, swallow the talented ones to copy
            Blade, Ember, Frost, Zap, Rock, Bubble, or Gust, and float clean over anything jumping
            won't reach. Already got a power equipped? Swallow a <em>different</em> talented one
            anyway — the two fuse into a mega power on the spot. Keep an eye out for a Forgotten
            Star, too — a few seconds of speed and invincibility, no swallowing required. Any
            resemblance to a certain star-riding hero (and his own combo-copy-ability spinoff) is
            <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → move · ↑ / Space jump (hold in the air to float) · Z hold to inhale, tap ↓ to
            swallow (or discard an equipped power) · X spit a mouthful or use a copied power · H
            toggle horror mode
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 The Forgotten Place Remembers You</h1>
          <p className={styles.blurb}>Final score: {finalScore}. All {worldCount} corners of the Forgotten Place, tidied up.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Play Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>💨 Puffed Out</h1>
          <p className={styles.blurb}>Final score: {finalScore}. Out of spare puffs.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Try Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
