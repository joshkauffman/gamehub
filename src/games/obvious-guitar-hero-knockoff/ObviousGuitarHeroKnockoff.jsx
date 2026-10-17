import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ObviousGuitarHeroKnockoff.module.css'
import { W, H, LANES, NOTE_TRAVEL_SECONDS } from './constants.js'
import { SONGS } from './songData.js'
import { freshState, stepGame, accuracy } from './engine.js'
import { render } from './render.js'
import { getAudioContext, scheduleSong, playStrum } from './audioEngine.js'

// ── The Obvious Guitar Hero Knockoff ──────────────────────────────────
// Everything here is original: no sprites, no copied songs, no audio
// files. The three backing tracks are synthesized at runtime from
// oscillators and noise bursts (see audioEngine.js) from the same beat
// grid that generates each note chart (songData.js), so sound and
// visuals are always in sync. The "knockoff" is entirely the joke,
// worn openly — any resemblance to a certain fret-button rhythm game
// is extremely on purpose and also legally just vibes.

const LEAD_IN = NOTE_TRAVEL_SECONDS + 0.4

function GameCanvas({ song, onFinish }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const heldRef = useRef(new Set())
  const prevHeldRef = useRef(new Set())
  const startTimeRef = useRef(null)
  const rafRef = useRef(null)
  if (!stateRef.current) stateRef.current = freshState(song)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const audioCtx = getAudioContext()
    startTimeRef.current = audioCtx.currentTime + LEAD_IN
    scheduleSong(song, startTimeRef.current)

    const keyToLane = {}
    LANES.forEach(l => { keyToLane[l.key] = l.id })

    function onKeyDown(e) {
      const lane = keyToLane[e.code]
      if (lane == null) return
      e.preventDefault()
      heldRef.current.add(lane)
    }
    function onKeyUp(e) {
      const lane = keyToLane[e.code]
      if (lane == null) return
      heldRef.current.delete(lane)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function loop() {
      const state = stateRef.current
      const songTime = audioCtx.currentTime - startTimeRef.current
      const pressed = []
      for (const lane of heldRef.current) if (!prevHeldRef.current.has(lane)) pressed.push(lane)
      prevHeldRef.current = new Set(heldRef.current)
      if (pressed.length) for (const lane of pressed) playStrum(lane)

      stepGame(state, songTime, pressed)
      render(ctx, state)

      if (state.status !== 'playing') {
        onFinish(state)
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
  }, [song, onFinish])

  return <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />
}

function SongSelect({ onPick }) {
  return (
    <div className={styles.selectWrap}>
      <h1 className={styles.title}>🎸 Select a Track</h1>
      <div className={styles.songGrid}>
        {SONGS.map(song => (
          <button key={song.id} className={styles.songCard} onClick={() => onPick(song)}>
            <div className={styles.songName}>{song.name}</div>
            <div className={styles.songMeta}>{song.bpm} BPM · {song.notes.length} notes · {Math.round(song.duration)}s</div>
          </button>
        ))}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

export default function ObviousGuitarHeroKnockoff() {
  const [screen, setScreen] = useState('title')
  const [song, setSong] = useState(null)
  const [result, setResult] = useState(null)
  const [gameKey, setGameKey] = useState(0)

  function handleFinish(finalState) {
    setResult({ status: finalState.status, score: finalState.score, maxCombo: finalState.maxCombo, accuracy: accuracy(finalState) })
    setScreen(finalState.status)
  }

  function pickSong(s) {
    setSong(s)
    setGameKey(k => k + 1)
    setScreen('playing')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🎸 The Obvious Guitar Hero Knockoff</h1>
          <p className={styles.blurb}>
            Five frets, three original tracks, zero audio files — every drumbeat and bassline here
            is synthesized live from scratch and the note chart is generated from that same beat
            grid, so they're always in sync. Hit the right fret key as each note crosses the line
            to keep your combo (and the band) alive. Any resemblance to a certain fret-button
            rhythm game is <em>extremely</em> on purpose and also legally just vibes.
          </p>
          <p className={styles.controls}>A · S · D · F · Space — one key per fret, timed to the beat</p>
          <button className={styles.bigBtn} onClick={() => setScreen('select')}>▶ Start Knocking Off</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && <SongSelect onPick={pickSong} />}

      {screen === 'playing' && <GameCanvas key={gameKey} song={song} onFinish={handleFinish} />}

      {(screen === 'cleared' || screen === 'failed') && result && (
        <div className={styles.center}>
          <h1 className={styles.title}>{screen === 'cleared' ? '🏆 Track Cleared!' : '💥 The Crowd Groans'}</h1>
          <p className={styles.blurb}>
            Score: {result.score} · Max combo: {result.maxCombo} · Accuracy: {result.accuracy}%
          </p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={() => pickSong(song)}>🔁 Retry Track</button>
            <button className={styles.secondaryBtn} onClick={() => setScreen('select')}>🎵 Pick Another Track</button>
            <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
          </div>
        </div>
      )}
    </div>
  )
}
