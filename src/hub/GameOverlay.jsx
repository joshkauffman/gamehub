import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './Extras.module.css'
import { gameIdForPath } from './usePlayTracker.js'
import { activeProfile } from './profiles.js'
import { snapScreen, addPhoto } from './gallery.js'
import { loadMap, nextPieceGame, collectPiece, PIECES } from './treasureMap.js'
import { earn } from './coins.js'
import { sfx } from './sound.js'

// ── Hub layer on top of every game page ──────────────────────────────────
// A small 📸 button (saves a photo to the home page gallery) and, in the
// right game, a torn treasure-map piece that peeks out now and then.
// Everything here is marked data-hub-overlay so photos leave it out.

const NO_CAMERA = ['chat-lounge']

export default function GameOverlay() {
  const { pathname } = useLocation()
  const game = gameIdForPath(pathname)
  if (!game) return null
  return <Overlay key={game} game={game} />
}

function Overlay({ game }) {
  const [flash, setFlash] = useState(false)
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const noteTimer = useRef(null)
  const say = (text, ms = 3500) => {
    setNote(text)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), ms)
  }
  useEffect(() => () => clearTimeout(noteTimer.current), [])

  async function snap(e) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      const src = await snapScreen()
      addPhoto({ id: Date.now().toString(36), game, at: Date.now(), by: activeProfile()?.id, src })
      setFlash(true)
      setTimeout(() => setFlash(false), 350)
      sfx('click')
      say('📸 Saved to the GameHub photo gallery!')
    } catch {
      say('📸 Couldn’t take a photo of this game, sorry!')
    }
    setBusy(false)
  }

  // ── Treasure map piece ──
  const [piece, setPiece] = useState(null) // { x, y } while showing
  const isPieceGame = nextPieceGame() === game && loadMap().started
  useEffect(() => {
    if (!isPieceGame) return
    let t
    const show = () => {
      setPiece({ x: 8 + Math.random() * 78, y: 14 + Math.random() * 66 })
      t = setTimeout(hide, 9000)
    }
    const hide = () => { setPiece(null); t = setTimeout(show, 22000) }
    t = setTimeout(show, 9000)
    return () => clearTimeout(t)
  }, [isPieceGame])
  function grab(e) {
    e.preventDefault()
    e.stopPropagation()
    const m = collectPiece()
    earn(`map:${m.found}`, 5)
    setPiece(null)
    sfx('secret')
    say(`🗺️ Map piece ${m.found}/${PIECES.length}! ${PIECES[m.found - 1].clue}`, 9000)
  }

  return (
    <div data-hub-overlay className={styles.overlayRoot}>
      {!NO_CAMERA.includes(game) && (
        <button className={styles.camera} onClick={snap} onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} title="Take a photo for the GameHub gallery" aria-label="Take a photo">
          {busy ? '⏳' : '📸'}
        </button>
      )}
      {piece && (
        <button
          className={styles.mapPiece}
          style={{ left: `${piece.x}%`, top: `${piece.y}%` }}
          onPointerDown={grab}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          aria-label="A torn piece of a treasure map!"
        >🗺️</button>
      )}
      {flash && <div className={styles.flash} />}
      {note && <div className={styles.overlayNote}>{note}</div>}
    </div>
  )
}
