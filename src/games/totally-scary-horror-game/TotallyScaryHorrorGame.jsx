import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './TotallyScaryHorrorGame.module.css'
import { CANVAS_W, CANVAS_H, MONSTER_DEFS } from './constants.js'
import { createGame, stepGame, advanceDialogue } from './engine.js'
import { render } from './render.js'

// ── The Totally Scary Horror Game ───────────────────────────────────────
// A top-down haunted-hotel maze. Running from the monsters is always
// possible (every monster's chase speed is slower than the player), but
// getting caught isn't a fail state — the monster just sits down and
// explains, in a few lines, why it's actually doing this job (spoiler:
// the economy). Reach the glowing EXIT at the top of the main corridor
// to escape. Plain 2D canvas + a DOM dialogue overlay for the wrapped
// text, same split as this hub's other canvas games.

const KEY_MAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
}
const ALL_GAME_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter']

function readInput(keys) {
  const held = (names) => names.some(n => keys.has(n))
  return { up: held(KEY_MAP.up), down: held(KEY_MAP.down), left: held(KEY_MAP.left), right: held(KEY_MAP.right) }
}

function GameCanvas({ onHud, advanceRef }) {
  const canvasRef = useRef(null)
  const keysRef = useRef(new Set())
  const onHudRef = useRef(onHud); onHudRef.current = onHud

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = null

    const state = createGame()
    advanceRef.current = () => advanceDialogue(state)

    function onKeyDown(e) {
      if (ALL_GAME_CODES.includes(e.code)) e.preventDefault()
      if (e.code === 'Space' || e.code === 'Enter') { advanceDialogue(state); return }
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let last = performance.now()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (!state.won) stepGame(state, readInput(keysRef.current), dt)

      render(ctx, state, now / 1000)

      onHudRef.current({
        dialogue: state.dialogue
          ? { ...state.dialogue, monster: MONSTER_DEFS.find(m => m.id === state.dialogue.monsterId) }
          : null,
        won: state.won,
        metCount: state.metCount,
        catchCount: state.catchCount,
        elapsed: state.elapsed,
      })
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className={styles.canvas} />
}

function DialogueBox({ dialogue, onAdvance }) {
  if (!dialogue) return null
  const line = dialogue.lines[dialogue.lineIndex]
  const isLast = dialogue.lineIndex >= dialogue.lines.length - 1
  return (
    <div className={styles.dialogueWrap}>
      <div className={styles.dialogueBox}>
        <div className={styles.dialogueHead}>
          <span className={styles.dialogueIcon}>{dialogue.monster?.icon}</span>
          <span className={styles.dialogueName}>{dialogue.monster?.name}</span>
        </div>
        <p className={styles.dialogueText}>{line}</p>
        <button className={styles.dialogueBtn} onClick={onAdvance}>
          {isLast ? 'Let them get back to it (Space)' : 'Continue (Space)'}
        </button>
      </div>
    </div>
  )
}

export default function TotallyScaryHorrorGame() {
  const [screen, setScreen] = useState('intro') // intro | playing
  const [hud, setHud] = useState(null)
  const advanceRef = useRef(() => {})
  const [runKey, setRunKey] = useState(0)

  function startGame() { setScreen('playing') }
  function playAgain() { setRunKey(k => k + 1); setHud(null) }

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🏨 The Totally Scary<span className={styles.subtitle}>Horror Game</span></h1>
          <p className={styles.blurb}>
            You're walking through a hotel at night. It is, allegedly, haunted. Six monsters
            roam the halls, and the goal is simple: reach the exit without getting caught.
          </p>
          <p className={styles.blurb}>
            Here's the thing — none of them are actually scary. If one catches you, it doesn't
            end the game. It just sits down and tells you, at some length, why it's really doing
            this job (it's almost always the economy).
          </p>
          <p className={styles.blurb}>
            WASD or arrow keys to move. Space to get through a monster's explanation faster.
            Every monster is slower than you — you can always outrun them if you actually try.
          </p>
          <button className={styles.bigBtn} onClick={startGame}>▶ Enter the Hotel</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && (
        <div className={styles.playWrap} key={runKey}>
          <GameCanvas onHud={setHud} advanceRef={advanceRef} />
          <DialogueBox dialogue={hud?.dialogue} onAdvance={() => advanceRef.current()} />
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>

          {hud?.won && (
            <div className={styles.overlayScreen}>
              <h2 className={styles.title2}>🚪 You Escaped!</h2>
              <p className={styles.blurb}>
                You made it out of the hotel in {Math.floor(hud.elapsed)} seconds, meeting{' '}
                {hud.metCount} of 6 monsters along the way ({hud.catchCount} total catches).
                Every single one of them was, in the end, just a guy with a job.
              </p>
              <div className={styles.btnRow}>
                <button className={styles.bigBtn} onClick={playAgain}>↻ Walk Through Again</button>
                <Link to="/" className={styles.secondaryBtn}>← Back to GameHub</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
