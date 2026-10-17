import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousZeldaKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame, itemsCollectedCount, totalItemsCount } from './engine.js'
import { render } from './render.js'

// ── The Obvious Zelda Knockoff ─────────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: a hero in a green cap wakes up in a
// meadow, gets handed a sword in a nearby cave because that's simply how
// this works now, and wanders a small overworld collecting a boomerang,
// a bow, and bombs on the way to a short dungeon and whatever's waiting
// in its last room. Any resemblance to a certain triangle-obsessed
// fantasy series is extremely on purpose and also legally just vibes.
//
// See levels.js for the three small worlds (overworld, sword cave,
// dungeon) and how rooms/doors/portals are built, engine.js for the
// physics/rules state machine, and render.js for everything drawn to
// the canvas.

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
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyM'].includes(e.code)
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
        up: k.has('ArrowUp') || k.has('KeyW'),
        down: k.has('ArrowDown') || k.has('KeyS'),
        sword: k.has('KeyZ'),
        item1: k.has('KeyX'),
        item2: k.has('KeyC'),
        item3: k.has('KeyV'),
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

export default function ObviousZeldaKnockoff() {
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
          <h1 className={styles.title}>🗡️ The Obvious Zelda Knockoff</h1>
          <p className={styles.blurb}>
            A hero in a green cap wakes up in a quiet meadow with nothing to their name. An old
            man in a nearby cave is, suspiciously, handing out swords today. From there: wander
            the overworld, find a boomerang, a bow, and bombs, collect Heart Containers, then head
            into the one dungeon around here with a locked door, a Small Key, and something
            waiting in the last room. Any resemblance to a certain triangle-obsessed fantasy
            series is <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → ↑ ↓ move · Z swing sword · X throw boomerang · C fire an arrow · V drop a bomb ·
            M toggle map
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 The Realm (Such As It Is) Is Safe</h1>
          <p className={styles.blurb}>
            Score: {result.score}. Treasures found: {result.items}/{totalItemsCount()}.
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Play Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>💀 Game Over</h1>
          <p className={styles.blurb}>
            Score: {result.score}. Treasures found: {result.items}/{totalItemsCount()}.
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
