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
// rail crossings, grabbing power-ups along the way, as far as you can
// get before traffic, drowning, a train, or a stalling-too-long hawk
// ends the run — solo, or split-screen with a second player on the
// same shared world. Any resemblance to a certain endless lane-hopping
// mobile game is extremely on purpose and also legally just vibes.

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

function CharacterSelect({ heading, sub, onPick, onBack }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>{heading}</h1>
      <p className={styles.blurb}>{sub}</p>
      <div className={styles.characterGrid}>
        {CHARACTERS.map(ch => (
          <button key={ch.id} className={styles.characterCard} onClick={() => onPick(ch.id)}>
            <CritterPreview character={ch} />
            <div className={styles.characterName}>{ch.emoji} {ch.name}</div>
          </button>
        ))}
      </div>
      {onBack
        ? <button className={styles.smallBtn} onClick={onBack}>← Back</button>
        : <Link to="/" className={styles.backLink}>← Back to GameHub</Link>}
    </div>
  )
}

function ModeSelect({ onPick }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>How Many Hoppers?</h1>
      <div className={styles.row}>
        <button className={styles.modeCard} onClick={() => onPick(1)}>
          <span className={styles.modeIcon}>🐾</span>
          <span className={styles.modeName}>1 Player</span>
          <span className={styles.modeDesc}>← → ↑ ↓ or WASD</span>
        </button>
        <button className={styles.modeCard} onClick={() => onPick(2)}>
          <span className={styles.modeIcon}>🐾🐾</span>
          <span className={styles.modeName}>2 Players</span>
          <span className={styles.modeDesc}>Split screen — P1: arrows, P2: WASD</span>
        </button>
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

// Player 1 always answers to the arrow keys; Player 2 (2-player mode
// only) always answers to WASD. In solo play, either set works for the
// one player so it doesn't matter which you reach for.
function readInputs(keys, twoPlayer) {
  const input1 = twoPlayer
    ? { up: keys.has('ArrowUp'), down: keys.has('ArrowDown'), left: keys.has('ArrowLeft'), right: keys.has('ArrowRight') }
    : {
      up: keys.has('ArrowUp') || keys.has('KeyW'),
      down: keys.has('ArrowDown') || keys.has('KeyS'),
      left: keys.has('ArrowLeft') || keys.has('KeyA'),
      right: keys.has('ArrowRight') || keys.has('KeyD'),
    }
  const input2 = twoPlayer
    ? { up: keys.has('KeyW'), down: keys.has('KeyS'), left: keys.has('KeyA'), right: keys.has('KeyD') }
    : undefined
  return [input1, input2]
}

function GameCanvas({ character1Id, character2Id, onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const finishedRef = useRef(false)
  const twoPlayer = !!character2Id
  if (!stateRef.current) stateRef.current = freshState(character1Id, character2Id)

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
      const [input1, input2] = readInputs(keysRef.current, twoPlayer)
      const state = stateRef.current
      stepGame(state, input1, input2)
      renderGame(ctx, state)

      if (state.status === 'dead' && !finishedRef.current) {
        finishedRef.current = true
        setTimeout(() => onFinish(state), 1100)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onFinish, twoPlayer])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

function ResultCard({ label, result }) {
  return (
    <div className={styles.resultCard}>
      {label && <div className={styles.resultLabel}>{label}</div>}
      <div className={styles.resultScore}>{result.score}m</div>
      <div className={styles.resultReason}>{DEATH_LINES[result.reason] || 'Run over.'}</div>
      {result.newRecord && <div className={styles.resultBadge}>New best!</div>}
    </div>
  )
}

export default function ObviousCrossyRoadKnockoff() {
  const [screen, setScreen] = useState('title')
  const [twoPlayer, setTwoPlayer] = useState(false)
  const [char1, setChar1] = useState(CHARACTERS[0].id)
  const [char2, setChar2] = useState(CHARACTERS[1].id)
  const [result, setResult] = useState(null)
  const [gameKey, setGameKey] = useState(0)

  function pickMode(count) {
    setTwoPlayer(count === 2)
    setScreen(count === 2 ? 'select-p1' : 'select-solo')
  }

  function startGame(c1, c2) {
    setChar1(c1)
    if (c2) setChar2(c2)
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  function handleFinish(state) {
    setResult({
      twoPlayer: state.twoPlayer,
      highScore: state.highScore,
      players: state.players.map(p => ({ score: p.maxRowReached, reason: p.deathReason, newRecord: p.newRecord })),
    })
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
            Dodge traffic, ride logs instead of swimming, watch for trains, grab power-ups, and
            don't just stand there — a hawk gets curious if you dawdle too long. Play solo or
            split-screen with a friend. How far can you get? Any resemblance to a certain endless
            lane-hopping mobile game is <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            🛡️ Shield · ⚡ Speed Boost · ❄️ Freeze · ❤️ Extra Life — hop onto one to grab it
          </p>
          <button className={styles.bigBtn} onClick={() => setScreen('mode')}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'mode' && <ModeSelect onPick={pickMode} />}

      {screen === 'select-solo' && (
        <CharacterSelect
          heading="Pick Your Critter"
          sub="Purely cosmetic — everyone hops, dodges, and drowns exactly the same."
          onPick={id => startGame(id, null)}
          onBack={() => setScreen('mode')}
        />
      )}

      {screen === 'select-p1' && (
        <CharacterSelect
          heading="Player 1: Pick Your Critter"
          sub="Arrow keys to hop."
          onPick={id => { setChar1(id); setScreen('select-p2') }}
          onBack={() => setScreen('mode')}
        />
      )}

      {screen === 'select-p2' && (
        <CharacterSelect
          heading="Player 2: Pick Your Critter"
          sub="WASD to hop."
          onPick={id => startGame(char1, id)}
          onBack={() => setScreen('select-p1')}
        />
      )}

      {screen === 'playing' && (
        <GameCanvas
          key={gameKey}
          character1Id={char1}
          character2Id={twoPlayer ? char2 : null}
          onFinish={handleFinish}
        />
      )}

      {screen === 'dead' && result && (
        <div className={styles.center}>
          <h1 className={styles.title}><DeathIcon /> Run Over</h1>
          {!result.twoPlayer ? (
            <ResultCard result={result.players[0]} />
          ) : (
            <div className={styles.row}>
              <ResultCard label="Player 1" result={result.players[0]} />
              <ResultCard label="Player 2" result={result.players[1]} />
            </div>
          )}
          <p className={styles.blurb}>Best distance ever: {result.highScore}m.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Try Again</button>
            <button className={styles.smallBtn} onClick={() => setScreen('mode')}>Change mode</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
