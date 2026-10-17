import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousMegaManKnockoff.module.css'
import { W, H } from './constants.js'
import { BOSSES, WEAPONS } from './bossData.js'
import { freshState, stepGame } from './engine.js'
import { render } from './render.js'

// ── The Obvious Mega Man Knockoff ──────────────────────────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly: pick any Robot Master stage in any
// order, blast through with an infinite buster, beat the boss, and
// steal their signature weapon — which happens to be exactly what the
// next boss on the list can't stand. Any resemblance to a certain
// blue bomber and his rogues' gallery is extremely on purpose and
// also legally just vibes.
//
// See bossData.js for the Robot Masters/weapons/weakness loop,
// levels.js for the four stage courses, engine.js for the platforming
// + run-and-gun physics, and render.js for everything drawn to canvas.

function GameCanvas({ stageId, progress, onClear }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const progressRef = useRef(progress)
  progressRef.current = progress
  if (!stateRef.current) stateRef.current = freshState(stageId, progress)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function onKeyDown(e) {
      const blocked = ['ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)
      if (blocked) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const weaponKeys = { Digit1: 'buster', Digit2: WEAPONS.fire.id, Digit3: WEAPONS.volt.id, Digit4: WEAPONS.saw.id, Digit5: WEAPONS.ice.id }

    function loop() {
      const k = keysRef.current
      let weaponSelect = null
      for (const [code, wid] of Object.entries(weaponKeys)) if (k.has(code)) { weaponSelect = wid; break }
      const input = {
        left: k.has('ArrowLeft') || k.has('KeyA'),
        right: k.has('ArrowRight') || k.has('KeyD'),
        jump: k.has('ArrowUp') || k.has('KeyW') || k.has('Space'),
        shoot: k.has('KeyZ') || k.has('KeyX'),
        weaponSelect,
      }
      const state = stateRef.current
      stepGame(state, input)
      render(ctx, state)

      if (state.status === 'retry' && state.transitionTimer <= 0) {
        stateRef.current = freshState(stageId, progressRef.current)
      } else if (state.status === 'clear' && state.transitionTimer <= 0) {
        onClear(state.rewardWeaponId, stageId)
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
  }, [stageId, onClear])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

function StageSelect({ progress, defeated, onPick }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>🤖 Select a Stage</h1>
      <p className={styles.blurb}>
        Pick any Robot Master, in any order. Beating one steals their weapon — and every weapon
        happens to be exactly what the next boss can't stand.
      </p>
      <div className={styles.bossGrid}>
        {BOSSES.map(boss => {
          const done = defeated.has(boss.id)
          return (
            <button key={boss.id} className={`${styles.bossCard} ${done ? styles.bossDone : ''}`} onClick={() => onPick(boss.stageId)}>
              <div className={styles.bossPortrait} style={{ background: boss.color }}>
                {done && <span className={styles.checkmark}>✓</span>}
              </div>
              <div className={styles.bossName}>{boss.name}</div>
              <div className={styles.stageName}>{boss.stageName}</div>
            </button>
          )
        })}
      </div>
      <div className={styles.weaponRow}>
        <span className={styles.fieldLabel}>Weapons:</span>
        {[...progress.weapons].map(wid => (
          <span key={wid} className={styles.weaponChip} style={{ borderColor: WEAPONS[wid].color, color: WEAPONS[wid].color }}>
            {WEAPONS[wid].name}
          </span>
        ))}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

export default function ObviousMegaManKnockoff() {
  const [screen, setScreen] = useState('title')
  const [stageId, setStageId] = useState(null)
  const [progress, setProgress] = useState({ weapons: new Set(['buster']), equippedWeapon: 'buster' })
  const [defeated, setDefeated] = useState(new Set())

  function handleClear(rewardWeaponId, finishedStageId) {
    const nextDefeated = new Set(defeated)
    const boss = BOSSES.find(b => b.stageId === finishedStageId)
    if (boss) nextDefeated.add(boss.id)
    setDefeated(nextDefeated)
    setProgress(prev => {
      const weapons = new Set(prev.weapons)
      weapons.add(rewardWeaponId)
      return { weapons, equippedWeapon: prev.equippedWeapon }
    })
    if (nextDefeated.size >= BOSSES.length) setScreen('win')
    else setScreen('select')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🔵 The Obvious Mega Man Knockoff</h1>
          <p className={styles.blurb}>
            Four Robot Masters, in whatever order you like. Run and gun through each stage with an
            infinite buster, take down the boss at the end, and steal their signature weapon — the
            trick is figuring out which weapon each boss actually hates. Any resemblance to a
            certain blue bomber and his rogues' gallery is <em>extremely</em> on purpose and also
            legally just vibes.
          </p>
          <p className={styles.controls}>
            ← → move · ↑ / Space jump · Z or X shoot · 1–5 switch weapon (once you've got more than
            the buster)
          </p>
          <button className={styles.bigBtn} onClick={() => setScreen('select')}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && <StageSelect progress={progress} defeated={defeated} onPick={id => { setStageId(id); setScreen('playing') }} />}

      {screen === 'playing' && <GameCanvas key={stageId} stageId={stageId} progress={progress} onClear={handleClear} />}

      {screen === 'win' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🏆 All Robot Masters Defeated!</h1>
          <p className={styles.blurb}>Every weakness, exploited. The lab is secure — nice work.</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => { setDefeated(new Set()); setProgress({ weapons: new Set(['buster']), equippedWeapon: 'buster' }); setScreen('select') }}>
              🔁 Play Again
            </button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
