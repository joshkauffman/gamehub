import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousMarioKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame } from './engine.js'
import { render, drawPlayer } from './render.js'
import { LEVELS } from './levels.js'
import { CHARACTERS } from './characters.js'
import { useHorrorMode } from '../../HorrorMode.jsx'

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

function GameCanvas({ characterId, onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  if (!stateRef.current) stateRef.current = freshState(characterId)

  // The hub-wide H toggle lives above this component (see HorrorMode.jsx) —
  // this just mirrors its current value into engine state each frame so
  // render.js can swap the actual course palettes, on top of the CSS filter
  // this page opts out of via the horror-exempt class below.
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
        fire: k.has('KeyF'),
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

// A tiny standing-still preview of a character, drawn with the real game's
// drawPlayer routine so the pick actually matches what you'll see in play.
function CharacterPreview({ character }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, 70, 84)
    const p = {
      x: 19, y: 12, w: 32, h: 60, vx: 0, vy: 0, onGround: true,
      powerState: 'big', starTimer: 0, facing: 1, invincible: 0, dead: false,
      fireCooldown: 0, sneakerTimer: 0, shield: false,
    }
    drawPlayer(ctx, p, 0, 0, character)
  }, [character])
  return <canvas ref={canvasRef} width={70} height={84} />
}

export default function ObviousMarioKnockoff() {
  const [screen, setScreen] = useState('title')
  const [finalScore, setFinalScore] = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const [characterId, setCharacterId] = useState(CHARACTERS[0].id)

  function handleFinish(status, score) {
    setFinalScore(score)
    setScreen(status)
  }

  function startWith(id) {
    setCharacterId(id)
    setGameKey(k => k + 1)
    setScreen('playing')
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
            A mustachioed plumber-guy (or one of his friends) runs across {worldCount}
            legally-distinct worlds, jumps on grumpy mushroom guys, dodges chomping ground
            hazards, and grabs flagpoles — then throws hands with a spiky boss at the end of
            each world. Grow big, catch fire, go invincible, zoom around in suspiciously
            speedy sneakers, glide on a cape feather, or bubble-shield a hit. Any resemblance
            to a certain plumber-based franchise is <em>extremely</em> on purpose and also
            legally just vibes.
          </p>
          <p className={styles.controls}>← → move · ↑ / Space jump · ↓ enter a glowing pipe · F shoot fireballs (once on fire) or flick a tongue (Yoshi) · H toggle horror mode</p>
          <button className={styles.bigBtn} onClick={() => setScreen('select')}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && (
        <div className={styles.center}>
          <h1 className={styles.title}>Pick Your Guy</h1>
          <p className={styles.blurb}>Same jumps, same physics — everyone plays the same underneath the outfit, except one of them has an actual gimmick.</p>
          <div className={styles.charGrid}>
            {CHARACTERS.map(c => (
              <button key={c.id} className={styles.charCard} onClick={() => startWith(c.id)}>
                <CharacterPreview character={c} />
                <span className={styles.charName}>{c.name}</span>
                {c.tagline && <span className={styles.charTagline}>{c.tagline}</span>}
              </button>
            ))}
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} characterId={characterId} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 You "Saved" The "Princess"!</h1>
          <p className={styles.blurb}>Final score: {finalScore}. All {worldCount} legally-distinct worlds and their bosses, cleared.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Play Again</button>
            <button className={styles.bigBtn} onClick={() => setScreen('select')}>🧑 Pick A Different Guy</button>
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
            <button className={styles.bigBtn} onClick={() => setScreen('select')}>🧑 Pick A Different Guy</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
