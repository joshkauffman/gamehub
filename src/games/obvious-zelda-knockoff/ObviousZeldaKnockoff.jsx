import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousZeldaKnockoff.module.css'
import { W, H } from './constants.js'
import { freshState, stepGame, itemsCollectedCount, totalItemsCount } from './engine.js'
import { render, drawPlayer } from './render.js'
import { CHARACTERS } from './characterData.js'
import { WEAPON_DEFS } from './weapons.js'

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

function GameCanvas({ characterId, onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  if (!stateRef.current) stateRef.current = freshState(characterId)

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
        melee: k.has('KeyZ'),
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

// A small live preview of the hero in this character's colors, standing
// idle — reuses the exact same drawPlayer() the real game uses, so the
// preview can never visually drift from what you'll actually play as.
function CharacterPreview({ character }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, 120, 130)
    const g = ctx.createLinearGradient(0, 0, 0, 130)
    g.addColorStop(0, '#2a3a1a')
    g.addColorStop(1, '#0f1508')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 120, 130)
    ctx.save()
    ctx.translate(18, 18)
    ctx.scale(2.6, 2.6)
    const p = { x: 0, y: 0, w: 26, h: 26, facing: 'down', invincible: 0, meleeSwing: 0, meleeWeaponId: null }
    drawPlayer(ctx, p, 0, character)
    ctx.restore()
  }, [character])
  return <canvas ref={canvasRef} width={120} height={130} className={styles.previewCanvas} />
}

function CharacterSelect({ onPick }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>Choose Your Hero</h1>
      <p className={styles.blurb}>
        Same overworld, same dungeon — but who you pick decides what you actually find out there.
      </p>
      <div className={styles.characterGrid}>
        {CHARACTERS.map(ch => (
          <button key={ch.id} className={styles.characterCard} onClick={() => onPick(ch.id)}>
            <CharacterPreview character={ch} />
            <div className={styles.characterName}>{ch.emoji} {ch.name}</div>
            <div className={styles.characterTagline}>{ch.tagline}</div>
            <div className={styles.weaponRow}>
              {['melee', 'item1', 'item2', 'item3'].map(slot => {
                const def = WEAPON_DEFS[ch.weapons[slot]]
                return <span key={slot} className={styles.weaponChip} title={def.label}>{def.icon} {def.label}</span>
              })}
            </div>
          </button>
        ))}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

export default function ObviousZeldaKnockoff() {
  const [screen, setScreen] = useState('title')
  const [characterId, setCharacterId] = useState(CHARACTERS[0].id)
  const [result, setResult] = useState({ score: 0, items: 0 })
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(status, score, items) {
    setResult({ score, items })
    setScreen(status)
  }

  function startGame(pickedId) {
    setCharacterId(pickedId)
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🗡️ The Obvious Zelda Knockoff</h1>
          <p className={styles.blurb}>
            A hero wakes up in a quiet meadow with nothing to their name. Pick who that hero is —
            each one finds a completely different set of weapons on the way through. From there:
            wander the overworld, collect Heart Containers, then head into the one dungeon around
            here with a locked door, a Small Key, and something waiting in the last room. Any
            resemblance to a certain triangle-obsessed fantasy series is <em>extremely</em> on
            purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → ↑ ↓ move · Z melee attack · X / C / V your other weapons · M toggle map
          </p>
          <button className={styles.bigBtn} onClick={() => setScreen('select')}>▶ Choose Your Hero</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && <CharacterSelect onPick={startGame} />}

      {screen === 'playing' && <GameCanvas key={gameKey} characterId={characterId} onFinish={handleFinish} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 The Realm (Such As It Is) Is Safe</h1>
          <p className={styles.blurb}>
            Score: {result.score}. Treasures found: {result.items}/{totalItemsCount()}.
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => startGame(characterId)}>🔁 Play Again</button>
            <button className={styles.smallBtn} onClick={() => setScreen('select')}>Choose a different hero</button>
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
            <button className={styles.bigBtn} onClick={() => startGame(characterId)}>🔁 Try Again</button>
            <button className={styles.smallBtn} onClick={() => setScreen('select')}>Choose a different hero</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
