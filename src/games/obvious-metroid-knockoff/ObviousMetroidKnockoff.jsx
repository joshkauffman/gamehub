import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousMetroidKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame, itemsCollectedCount, totalItemsCount } from './engine.js'
import { render } from './render.js'

// ── The Obvious Metroid Knockoff ──────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: a bounty hunter in a knockoff power
// suit explores a cave world one screen at a time, finds upgrades that
// unlock new ground, and works down toward whatever's guarding the
// reactor. Any resemblance to a certain visor-wearing, ball-curling
// space hunter is extremely on purpose and also legally just vibes.
//
// See levels.js for the world map and how rooms/doors are built,
// engine.js for the physics/rules state machine, and render.js for
// everything drawn to the canvas.

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
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyM'].includes(e.code)
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
        shoot: k.has('KeyZ'),
        action: k.has('KeyX'),
        map: k.has('KeyM'),
      }
      const state = stateRef.current
      stepGame(state, input)
      render(ctx, state)
      if (state.status === 'win' || state.status === 'gameover') {
        onFinish(state.status, state.score, itemsCollectedCount(state))
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

export default function ObviousMetroidKnockoff() {
  const [screen, setScreen] = useState('title')
  const [result, setResult] = useState({ score: 0, items: 0 })
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(status, score, items) {
    setResult({ score, items })
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
          <h1 className={styles.title}>🛰️ The Obvious Metroid Knockoff</h1>
          <p className={styles.blurb}>
            A lone hunter in a knockoff power suit drops onto a crumbling alien world, one screen
            at a time. Shoot a beam, find a missile launcher, and eventually a ball-curling morph
            suit and bombs to squeeze through gaps nothing else fits — then work your way down,
            floor by floor, toward whatever's guarding the reactor core. Explore each depth fully
            before you drop to the next one — the way down is a one-way trip. Any resemblance to a
            certain visor-wearing, ball-curling space hunter is <em>extremely</em> on purpose and
            also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → move · ↑ / Space jump · ↓ (once found) curl into Morph Ball, ↓ / ↑ to stand back up
            · Z shoot beam · X fire missile (or drop a bomb while morphed) · M toggle map
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 Reactor Secured</h1>
          <p className={styles.blurb}>
            Score: {result.score}. Upgrades found: {result.items}/{totalItemsCount()}.
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Play Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>💥 Suit Breach</h1>
          <p className={styles.blurb}>
            Score: {result.score}. Upgrades found: {result.items}/{totalItemsCount()}.
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Try Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
