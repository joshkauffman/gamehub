import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousPvZKnockoff.module.css'
import { W, H, GRID_X0, GRID_Y0, ROWS, COLS, CELL_W, CELL_H } from './constants.js'
import { PLANTS, PLANT_ORDER } from './plantData.js'
import { freshState, stepGame, selectPlant, handleCanvasClick, waveProgress } from './engine.js'
import { render } from './render.js'

// ── The Obvious Plants vs. Zombies Knockoff ────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: plant a lawn's worth of original
// defenders in a 5x9 grid, collect falling sun to afford more of them,
// and hold off eight waves of shufflers, cone heads, bucket heads, and
// sprinters before they reach the house. Any resemblance to a certain
// sun-powered tower-defense classic is extremely on purpose and also
// legally just vibes.
//
// See plantData.js / zombieData.js for the roster, engine.js for the
// grid simulation (click-driven, no held keys), and render.js for
// everything drawn to the canvas. The seed-packet shop bar below is
// plain DOM so cooldown fills and disabled states are easy to show.

function getCanvasPos(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }
}

function ShopBar({ state, onSelect }) {
  return (
    <div className={styles.shopBar}>
      <div className={styles.sunCounter}>☀️ {state.sun}</div>
      <div className={styles.packets}>
        {PLANT_ORDER.map(id => {
          const def = PLANTS[id]
          const cooldownFrames = Math.round(def.cooldown * 60)
          const remaining = state.plantCooldowns[id] || 0
          const cdPct = cooldownFrames > 0 ? remaining / cooldownFrames : 0
          const affordable = state.sun >= def.cost
          const disabled = !affordable || remaining > 0
          const selected = state.selectedPlant === id
          return (
            <button
              key={id}
              className={`${styles.packet} ${selected ? styles.packetSelected : ''} ${disabled ? styles.packetDisabled : ''}`}
              style={{ borderColor: def.color }}
              onClick={() => onSelect(id)}
              title={def.desc}
            >
              <span className={styles.packetSwatch} style={{ background: def.color }} />
              <span className={styles.packetCost}>{def.cost}</span>
              {cdPct > 0 && <span className={styles.packetCooldown} style={{ height: `${cdPct * 100}%` }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GameCanvas({ onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const hoverRef = useRef(null)
  const rafRef = useRef(null)
  const [, setTick] = useState(0)
  if (!stateRef.current) stateRef.current = freshState()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onClick(e) {
      const pos = getCanvasPos(canvas, e.clientX, e.clientY)
      handleCanvasClick(stateRef.current, pos.x, pos.y)
    }
    function onMove(e) {
      const pos = getCanvasPos(canvas, e.clientX, e.clientY)
      const col = Math.floor((pos.x - GRID_X0) / CELL_W)
      const row = Math.floor((pos.y - GRID_Y0) / CELL_H)
      hoverRef.current = (row >= 0 && row < ROWS && col >= 0 && col < COLS) ? { row, col } : null
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)

    function loop() {
      const state = stateRef.current
      stepGame(state)
      render(ctx, state, state.selectedPlant ? hoverRef.current : null)
      setTick(t => t + 1)
      if (state.status === 'win' || state.status === 'gameover') {
        onFinish(state.status, state.score)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onFinish])

  const state = stateRef.current
  const { current, total } = waveProgress(state)

  return (
    <div className={styles.canvasWrap}>
      <ShopBar state={state} onSelect={id => selectPlant(state, id)} />
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
      <div className={styles.waveBar}>Wave {current}/{total}</div>
    </div>
  )
}

export default function ObviousPvZKnockoff() {
  const [screen, setScreen] = useState('title')
  const [result, setResult] = useState({ score: 0 })
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(status, score) {
    setResult({ score })
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
          <h1 className={styles.title}>🌻 The Obvious Plants vs. Zombies Knockoff</h1>
          <p className={styles.blurb}>
            A 5-row lawn, a slow shuffling horde, and a sun economy to manage — plant Sprout
            Shooters, Sunblooms, Husk Guards, Twin Shooters, Frost Shooters, and the occasional
            Boom Spud across the grid, keep the sun flowing, and hold off eight waves before
            anything reaches the house. Any resemblance to a certain sun-powered tower-defense
            classic is <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            Click a seed packet to arm it, then click an empty lawn square to plant it · click
            falling suns to collect them · each lawnmower saves one row, once
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && <GameCanvas key={gameKey} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 The Lawn Held!</h1>
          <p className={styles.blurb}>Score: {result.score}. Eight waves, zero zombies inside.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Play Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🧟 They Got In</h1>
          <p className={styles.blurb}>Score: {result.score}. The lawn needed one more shooter.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={startGame}>🔁 Try Again</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
