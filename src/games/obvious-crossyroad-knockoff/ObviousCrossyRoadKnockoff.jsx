import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousCrossyRoadKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame } from './engine.js'
import { renderGame } from './render.js'
import { CHARACTERS } from './characters.js'

// ── The Obvious Crossy Road Knockoff ──────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: hop a critter forward across an
// endless procedurally generated stretch of grass, roads, rivers, and
// rail crossings, as far as you can get before traffic, drowning, a
// train, or a stalling-too-long hawk ends the run. Any resemblance to
// a certain endless lane-hopping mobile game is extremely on purpose
// and also legally just vibes.

const DEATH_LINES = {
  squashed: 'Squashed flat by traffic.',
  drowned: 'Swept away — should have found a log.',
  train: 'Flattened by a train. Rail crossings do not mess around.',
  hawk: 'Snatched by a hawk for standing still too long.',
  fell: 'Carried off the edge by the current.',
}

function DeathIcon() { return <span aria-hidden="true">💥</span> }

function CritterPreview({ character }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, 120, 120)
    const g = ctx.createLinearGradient(0, 0, 0, 120)
    g.addColorStop(0, '#5fa83f'); g.addColorStop(1, '#2a5a1f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 120, 120)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(60, 92, 16, 6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.save()
    ctx.translate(60, 70)
    ctx.scale(2.4, 2.4)
    // reuse the same body-drawing look as in-game by hand here (kept tiny and self-contained
    // rather than importing render.js's internal helper, which isn't exported)
    ctx.fillStyle = character.legColor
    ctx.fillRect(-9, 6, 6, 8); ctx.fillRect(3, 6, 6, 8)
    ctx.fillStyle = character.bodyColor
    ctx.beginPath(); ctx.ellipse(0, -2, 13, 12, 0, 0, Math.PI * 2); ctx.fill()
    if (character.id === 'bunny') {
      ctx.beginPath(); ctx.ellipse(-5, -18, 3.5, 10, -0.15, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(5, -18, 3.5, 10, 0.15, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = character.accentColor
      ctx.beginPath(); ctx.ellipse(-5, -18, 1.6, 7, -0.15, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(5, -18, 1.6, 7, 0.15, 0, Math.PI * 2); ctx.fill()
    } else if (character.id === 'chicken') {
      ctx.fillStyle = character.accentColor
      ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(3, -12); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.arc(-6, -13, 3, 0, Math.PI * 2); ctx.arc(6, -13, 3, 0, Math.PI * 2); ctx.fill()
    } else if (character.id === 'frog') {
      ctx.fillStyle = character.bodyColor
      ctx.beginPath(); ctx.arc(-6, -12, 5, 0, Math.PI * 2); ctx.arc(6, -12, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a2a14'
      ctx.beginPath(); ctx.arc(-6, -12, 2, 0, Math.PI * 2); ctx.arc(6, -12, 2, 0, Math.PI * 2); ctx.fill()
    } else if (character.id === 'penguin') {
      ctx.fillStyle = '#f2f2f2'
      ctx.beginPath(); ctx.ellipse(0, 1, 8, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = character.accentColor
      ctx.beginPath(); ctx.moveTo(-2.5, -3); ctx.lineTo(2.5, -3); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill()
    }
    if (character.id !== 'frog') {
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI * 2); ctx.arc(5, -5, 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }, [character])
  return <canvas ref={canvasRef} width={120} height={120} className={styles.previewCanvas} />
}

function CharacterSelect({ onPick }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>Pick Your Critter</h1>
      <p className={styles.blurb}>Purely cosmetic — everyone hops, dodges, and drowns exactly the same.</p>
      <div className={styles.characterGrid}>
        {CHARACTERS.map(ch => (
          <button key={ch.id} className={styles.characterCard} onClick={() => onPick(ch.id)}>
            <CritterPreview character={ch} />
            <div className={styles.characterName}>{ch.emoji} {ch.name}</div>
          </button>
        ))}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function GameCanvas({ characterId, onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const finishedRef = useRef(false)
  if (!stateRef.current) stateRef.current = freshState(characterId)

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
        up: k.has('ArrowUp') || k.has('KeyW'),
        down: k.has('ArrowDown') || k.has('KeyS'),
        left: k.has('ArrowLeft') || k.has('KeyA'),
        right: k.has('ArrowRight') || k.has('KeyD'),
      }
      const state = stateRef.current
      stepGame(state, input)
      renderGame(ctx, state)

      if (state.status === 'dead' && !finishedRef.current) {
        finishedRef.current = true
        setTimeout(() => onFinish(state.maxRowReached, state.highScore, state.deathReason, state.newRecord), 1100)
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

export default function ObviousCrossyRoadKnockoff() {
  const [screen, setScreen] = useState('title')
  const [characterId, setCharacterId] = useState(CHARACTERS[0].id)
  const [result, setResult] = useState({ score: 0, highScore: 0, reason: null, newRecord: false })
  const [gameKey, setGameKey] = useState(0)

  function handlePick(id) {
    setCharacterId(id)
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  function handleFinish(score, highScore, reason, newRecord) {
    setResult({ score, highScore, reason, newRecord })
    setScreen('dead')
  }

  function playAgain() {
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🐔 The Obvious Crossy Road Knockoff</h1>
          <p className={styles.blurb}>
            Hop forward across an endless stretch of grass, roads, rivers, and rail crossings.
            Dodge traffic, ride logs instead of swimming, watch for trains, and don't just stand
            there — a hawk gets curious if you dawdle too long. How far can you get? Any
            resemblance to a certain endless lane-hopping mobile game is <em>extremely</em> on
            purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>← → ↑ ↓ (or WASD) to hop, one tile at a time</p>
          <button className={styles.bigBtn} onClick={() => setScreen('select')}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && <CharacterSelect onPick={handlePick} />}

      {screen === 'playing' && <GameCanvas key={gameKey} characterId={characterId} onFinish={handleFinish} />}

      {screen === 'dead' && (
        <div className={styles.center}>
          <h1 className={styles.title}><DeathIcon /> {result.score}m</h1>
          <p className={styles.blurb}>
            {DEATH_LINES[result.reason] || 'Run over.'}
            {result.newRecord ? ' New best distance!' : ` Best distance: ${result.highScore}m.`}
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Try Again</button>
            <button className={styles.smallBtn} onClick={() => setScreen('select')}>Change critter</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
