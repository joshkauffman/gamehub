import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './RetroArcade.module.css'
import { dotMuncher } from './cartridges/dotMuncher.js'
import { rockBlaster } from './cartridges/rockBlaster.js'
import { bugSwarm } from './cartridges/bugSwarm.js'
import { turboDash } from './cartridges/turboDash.js'
import { sewerBros } from './cartridges/sewerBros.js'
import { brickBreaker } from './cartridges/brickBreaker.js'
import { starGuard } from './cartridges/starGuard.js'
import { riverHopper } from './cartridges/riverHopper.js'
import { fallingBlocks } from './cartridges/fallingBlocks.js'
import { loadHighScores, recordScore } from './highScores.js'

// ── Retro Arcade — a cabinet of original cartridges, each one an homage
// to a different classic arcade or console shape (maze-chase, vector
// shooter, fixed formation-shooter, auto-runner, single-screen platform
// brawler, brick-breaker, marching-invasion shooter, lane-crossing
// hopper, line-clearing puzzle). Every cartridge is original code and
// canvas-drawn shapes — no sprites, no copied assets, no copyrighted
// names — following the same "obvious knockoff" spirit as this hub's
// other original-but-inspired games. Each cartridge exports a small,
// uniform interface (see cartridges/*.js):
// { width, height, readInput(keys), createState(), step(state, input),
// render(ctx, state) } — status is 'playing' until it flips to
// 'gameover', which is the only end-state every one of these classic
// score-attack games actually has.
const CARTRIDGES = [
  dotMuncher, rockBlaster, bugSwarm, turboDash, sewerBros,
  brickBreaker, starGuard, riverHopper, fallingBlocks,
]

// Menu-only accent color per cartridge — purely cosmetic, keyed by id so it
// never has to touch each cartridge module's own game logic.
const ACCENTS = {
  'dot-muncher': '#ffd23c',
  'rock-blaster': '#8fe3ff',
  'bug-swarm': '#7be07b',
  'turbo-dash': '#4dd0ff',
  'sewer-bros': '#ff8f5c',
  'brick-breaker': '#ff5d5d',
  'star-guard': '#c77dff',
  'river-hopper': '#3dbf5d',
  'falling-blocks': '#ffd23c',
}

function GameCanvas({ cartridge, onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  if (!stateRef.current) stateRef.current = cartridge.createState()

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop() {
      const input = cartridge.readInput(keysRef.current)
      const state = stateRef.current
      cartridge.step(state, input)
      cartridge.render(ctx, state)
      if (state.status === 'gameover') { onFinish(state.score); return }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cartridge, onFinish])

  return (
    <div className={styles.screenBezel}>
      <div className={styles.screenInner}>
        <canvas ref={canvasRef} width={cartridge.width} height={cartridge.height} className={styles.canvas} />
      </div>
    </div>
  )
}

function CabinetScreen({ onPlay, highScores }) {
  return (
    <div className={styles.center}>
      <h1 className={styles.title}>🕹️ Retro Arcade</h1>
      <p className={styles.blurb}>
        {CARTRIDGES.length} cartridges, each in the spirit of a different arcade or console
        classic — maze-chases, shooters, a puzzle, a speed run, a platform brawler, and more.
        Every shape, sound, and rule here is original; the resemblance is the whole joke.
      </p>
      <div className={styles.grid}>
        {CARTRIDGES.map(c => (
          <button
            key={c.id}
            className={styles.cartridge}
            style={{ '--accent': ACCENTS[c.id] || '#ffb066' }}
            onClick={() => onPlay(c.id)}
          >
            <span className={styles.cartBadge}>{c.emoji}</span>
            <span className={styles.cartTitle}>{c.title}</span>
            <span className={styles.cartTagline}>{c.tagline}</span>
            <span className={styles.cartControls}>{c.controls}</span>
            {highScores[c.id] > 0 && <span className={styles.cartHigh}>HIGH {highScores[c.id]}</span>}
          </button>
        ))}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function ResultScreen({ cartridge, score, isNewBest, highScore, onPlayAgain, onBack }) {
  return (
    <div className={styles.center}>
      <h1 className={styles.title}>💀 Game Over</h1>
      <p className={styles.blurb}>{cartridge.emoji} {cartridge.title} — final score: {score}</p>
      {isNewBest ? (
        <p className={styles.newBest}>🏆 New high score!</p>
      ) : (
        <p className={styles.blurb}>High score: {highScore}</p>
      )}
      <div className={styles.row}>
        <button className={styles.bigBtn} onClick={onPlayAgain}>🔁 Play Again</button>
        <button className={styles.backBtn} onClick={onBack}>🕹️ Back to Cabinet</button>
      </div>
    </div>
  )
}

export default function RetroArcade() {
  const [screen, setScreen] = useState('cabinet')
  const [activeId, setActiveId] = useState(null)
  const [gameKey, setGameKey] = useState(0)
  const [lastScore, setLastScore] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [highScores, setHighScores] = useState(() => loadHighScores())

  const cartridge = CARTRIDGES.find(c => c.id === activeId)

  function play(id) {
    setActiveId(id)
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  function handleFinish(score) {
    const { scores, isNewBest: best } = recordScore(activeId, score)
    setHighScores(scores)
    setLastScore(score)
    setIsNewBest(best)
    setScreen('result')
  }

  function playAgain() { setGameKey(k => k + 1); setScreen('playing') }
  function backToCabinet() { setScreen('cabinet') }

  return (
    <div className={styles.page}>
      {screen === 'cabinet' && <CabinetScreen onPlay={play} highScores={highScores} />}
      {screen === 'playing' && cartridge && <GameCanvas key={gameKey} cartridge={cartridge} onFinish={handleFinish} />}
      {screen === 'result' && cartridge && (
        <ResultScreen
          cartridge={cartridge}
          score={lastScore}
          isNewBest={isNewBest}
          highScore={highScores[activeId] || 0}
          onPlayAgain={playAgain}
          onBack={backToCabinet}
        />
      )}
    </div>
  )
}
