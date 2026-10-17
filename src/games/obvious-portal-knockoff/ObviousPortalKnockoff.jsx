import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousPortalKnockoff.module.css'
import { W, H } from './constants.js'
import { CHAMBERS } from './levels.js'
import { freshState, stepGame, shootPortal, resetChamber } from './engine.js'
import { renderGame } from './render.js'

// ── The Obvious Portal Knockoff ────────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: aim a blue and an orange hole in
// reality at portal-able panels, walk through one, and keep your
// momentum out the other. A Weighted Something-or-Other is involved.

function canvasToGame(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = W / rect.width, scaleY = H / rect.height
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
}

function GameCanvas({ chamberIndex, onCleared }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const aimRef = useRef(null)
  const rafRef = useRef(null)
  const chamber = CHAMBERS[chamberIndex]
  if (!stateRef.current || stateRef.current.chamberId !== chamber.id) stateRef.current = freshState(chamber.id)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
      if (e.code === 'KeyR') stateRef.current = resetChamber(stateRef.current)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    function onMouseMove(e) { aimRef.current = canvasToGame(canvas, e.clientX, e.clientY) }
    function onMouseDown(e) {
      e.preventDefault()
      const pos = canvasToGame(canvas, e.clientX, e.clientY)
      const p = stateRef.current.player
      const fromX = p.x + p.w / 2, fromY = p.y + p.h / 2
      const color = e.button === 2 ? 'orange' : 'blue'
      shootPortal(stateRef.current, color, fromX, fromY, pos.x, pos.y)
    }
    function onContextMenu(e) { e.preventDefault() }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('contextmenu', onContextMenu)

    function loop() {
      const k = keysRef.current
      const input = {
        left: k.has('ArrowLeft') || k.has('KeyA'),
        right: k.has('ArrowRight') || k.has('KeyD'),
        jump: k.has('ArrowUp') || k.has('KeyW') || k.has('Space'),
      }
      const state = stateRef.current
      stepGame(state, input)
      renderGame(ctx, state, chamberIndex, aimRef.current)

      if (state.status === 'cleared') {
        setTimeout(() => onCleared(), 900)
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('contextmenu', onContextMenu)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [chamberIndex, onCleared])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

function ChamberSelect({ cleared, onPick }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>🌀 Select a Chamber</h1>
      <p className={styles.blurb}>Clear them in order, or jump to any chamber you've already unlocked.</p>
      <div className={styles.chamberGrid}>
        {CHAMBERS.map((ch, i) => {
          const unlocked = i === 0 || cleared.has(CHAMBERS[i - 1].id)
          const done = cleared.has(ch.id)
          return (
            <button
              key={ch.id}
              className={`${styles.chamberCard} ${done ? styles.chamberDone : ''}`}
              disabled={!unlocked}
              onClick={() => onPick(i)}
            >
              <div className={styles.chamberNum}>{i + 1}</div>
              <div className={styles.chamberName}>{ch.name}</div>
              {done && <span className={styles.checkmark}>✓</span>}
              {!unlocked && <span className={styles.lockHint}>Locked</span>}
            </button>
          )
        })}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

export default function ObviousPortalKnockoff() {
  const [screen, setScreen] = useState('title')
  const [chamberIndex, setChamberIndex] = useState(0)
  const [cleared, setCleared] = useState(new Set())

  function handleCleared() {
    const ch = CHAMBERS[chamberIndex]
    setCleared(prev => new Set(prev).add(ch.id))
    if (chamberIndex + 1 < CHAMBERS.length) setScreen('select')
    else setScreen('win')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🌀 The Obvious Portal Knockoff</h1>
          <p className={styles.blurb}>
            Four test chambers. Shoot a blue hole and an orange hole into portal-able panels, walk
            through one, and come out the other with your speed intact. There is a Weighted
            Something-or-Other. Any resemblance to a certain testing facility is <em>extremely</em>{' '}
            on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → move · ↑ / Space jump · Left click blue portal · Right click orange portal · R reset
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => setScreen('select')}>Start Knocking Off</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && (
        <ChamberSelect cleared={cleared} onPick={(i) => { setChamberIndex(i); setScreen('playing') }} />
      )}

      {screen === 'playing' && (
        <GameCanvas chamberIndex={chamberIndex} onCleared={handleCleared} />
      )}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>The cake metaphor was right there.</h1>
          <p className={styles.blurb}>All four chambers cleared. The science is, in fact, done.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => { setCleared(new Set()); setScreen('title') }}>
              Play Again
            </button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
