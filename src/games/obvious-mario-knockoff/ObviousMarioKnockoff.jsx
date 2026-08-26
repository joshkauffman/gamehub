import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousMarioKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame } from './engine.js'
import { render } from './render.js'
import { LEVELS } from './levels.js'

// ── The Obvious Mario Knockoff ──────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: a mustachioed plumber-guy jumps on
// grumpy mushroom guys, bonks question blocks, fights a spiky boss at the
// end of each world, and grabs flagpoles, because that shape of game is
// bigger than any one company's characters.
//
// See levels.js for the level roster, engine.js for the physics/rules
// state machine, and render.js for everything drawn to the canvas.

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
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)
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
        fire: k.has('KeyF'),
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

export default function ObviousMarioKnockoff() {
  const [screen, setScreen] = useState('title')
  const [finalScore, setFinalScore] = useState(0)
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(status, score) {
    setFinalScore(score)
    setScreen(status)
  }

  function playAgain() {
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  const worldCount = new Set(LEVELS.map(l => l.id.split('-')[0])).size

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🍄 The Obvious Mario Knockoff</h1>
          <p className={styles.blurb}>
            A mustachioed plumber-guy runs across {worldCount} legally-distinct worlds, jumps
            on grumpy mushroom guys, and grabs flagpoles — then throws hands with a spiky
            boss at the end of each world. Grow big, catch fire, go invincible. Any
            resemblance to a certain plumber-based franchise is <em>extremely</em> on purpose
            and also legally just vibes.
          </p>
          <p className={styles.controls}>← → move · ↑ / Space jump · F shoot fireballs (once you're on fire)</p>
          <button className={styles.bigBtn} onClick={() => { setGameKey(k => k + 1); setScreen('playing') }}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 You "Saved" The "Princess"!</h1>
          <p className={styles.blurb}>Final score: {finalScore}. All {worldCount} legally-distinct worlds and their bosses, cleared.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Play Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>💀 Game Over, Knockoff-Style</h1>
          <p className={styles.blurb}>Final score: {finalScore}. Out of extremely-not-mushroom lives.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Try Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
