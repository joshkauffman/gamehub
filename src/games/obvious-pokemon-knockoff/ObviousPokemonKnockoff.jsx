import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousPokemonKnockoff.module.css'
import { W, H } from './constants.js'
import { SPECIES, MOVES } from './creatures.js'
import { freshState, stepGame, chooseMove, attemptCatch, attemptRun, caughtCount, totalSpeciesCount } from './engine.js'
import { render } from './render.js'

// ── The Obvious Pokémon Knockoff ───────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: pick a starter from a suspiciously
// familiar lab, wander a tiny region finding wild critters in the tall
// grass, catch them with a Catch Orb instead of anything trademarked,
// battle a rival once, and challenge the Gym Leader at the end. Any
// resemblance to a certain pocket-monster franchise is extremely on
// purpose and also legally just vibes.
//
// See levels.js for the overworld/lab/gym rooms and portals,
// creatures.js for the species/moves/type chart, engine.js for the
// overworld-plus-turn-based-battle state machine, and render.js for
// everything drawn to the canvas (the battle menu buttons below are
// plain DOM, laid over the canvas).

function GameCanvas({ onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const [, setTick] = useState(0)
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
        map: k.has('KeyM'),
      }
      const state = stateRef.current
      stepGame(state, input)
      render(ctx, state)
      setTick(t => t + 1)
      if (state.status === 'win' || state.status === 'gameover') {
        onFinish(state.status, state.score, caughtCount(state))
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

  const state = stateRef.current
  const battle = state.battle
  const showMenu = state.mode === 'battle' && battle && battle.phase === 'choose'
  const activeCreature = showMenu ? state.party[battle.activeIndex] : null
  const activeDef = activeCreature ? SPECIES[activeCreature.speciesId] : null

  return (
    <div className={styles.canvasWrap}>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      {showMenu && activeDef && (
        <div className={styles.battleMenu}>
          {activeDef.moves.map(moveKey => (
            <button key={moveKey} className={styles.moveBtn} onClick={() => chooseMove(state, moveKey)}>
              {MOVES[moveKey].name}
            </button>
          ))}
          {battle.canCatch && (
            <button className={`${styles.moveBtn} ${styles.catchBtn}`} onClick={() => attemptCatch(state)}>
              🔴 Catch Orb
            </button>
          )}
          {battle.canRun && (
            <button className={`${styles.moveBtn} ${styles.runBtn}`} onClick={() => attemptRun(state)}>
              Run
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ObviousPokemonKnockoff() {
  const [screen, setScreen] = useState('title')
  const [result, setResult] = useState({ score: 0, caught: 0 })
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(status, score, caught) {
    setResult({ score, caught })
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
          <h1 className={styles.title}>🔴 The Obvious Pokémon Knockoff</h1>
          <p className={styles.blurb}>
            A research lab is, suspiciously, handing out starter critters today — pick one, then
            wander a small region finding wild ones hiding in the tall grass. Weaken one in battle
            and throw a Catch Orb to add it to your party (up to 3), battle a rival once along the
            way, and challenge the Gym Leader at the end. Any resemblance to a certain
            pocket-monster franchise is <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → ↑ ↓ move · walk into tall grass for wild encounters · M toggle map · battle moves
            are clickable buttons
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 Gym Leader Defeated</h1>
          <p className={styles.blurb}>
            Score: {result.score}. Species caught: {result.caught}/{totalSpeciesCount()}.
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
            Score: {result.score}. Species caught: {result.caught}/{totalSpeciesCount()}.
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
