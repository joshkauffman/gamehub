import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './EasyGame.module.css'
import {
  WINS, TOTAL_WINS, DENIALS, getWin, loadWins, saveWins, clearWins,
} from './wins.js'

// ── Easy Game ────────────────────────────────────────────────────────────
// A trophy sits on a pedestal. Clicking it is the obvious move, and it
// never works — it just tells you to find other ways to win. The actual
// game is the twelve secret wins hidden in how you can interact with the
// page: the right mouse button, a long press, dragging the trophy off its
// stand, the Konami code, typing what you want, tabbing to a button the
// mouse can't see, scrolling past the end of the page, resizing the
// window, and simply doing nothing for a while.
//
// Plain DOM/CSS rather than canvas or Three.js — every win here IS a
// browser interaction, so the browser's own event model is the game
// engine. wins.js holds the win data and save helpers; this file owns the
// detectors.

const IDLE_WIN_MS = 20000
const HOLD_WIN_MS = 2500
const DRAG_WIN_PX = 110
const CLICK_SLOP_PX = 8
const SHAKE_WINDOW_MS = 800
const SHAKE_WIN_PX = 2600
const RESIZE_WIN_PX = 60
const BASEMENT_SCROLL_PX = 260

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA',
]

export default function EasyGame() {
  const [found, setFound] = useState(() => loadWins())
  const [started, setStarted] = useState(false)
  const [denial, setDenial] = useState(null)
  const [toast, setToast] = useState(null)
  const [showHints, setShowHints] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [tabBtnFound, setTabBtnFound] = useState(false)

  // Long-lived listeners below are attached once per `started` flip, so
  // they can't close over fresh state — refs carry the live values.
  const foundRef = useRef(new Set(found))
  const startedRef = useRef(started)
  const scrollRef = useRef(null)
  const trophyClicksRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const toastTimerRef = useRef(null)
  const pressRef = useRef(null) // { id, startX, startY, moved, holdTimer }
  const shakeRef = useRef({ dist: 0, since: 0, lastX: null, lastY: null })
  const keyBufRef = useRef([])
  const startSizeRef = useRef(null)

  startedRef.current = started
  const allFound = found.length === TOTAL_WINS

  const addWin = useCallback((id) => {
    if (foundRef.current.has(id)) return
    foundRef.current.add(id)
    const ids = [...foundRef.current]
    setFound(ids)
    saveWins(ids)
    const win = getWin(id)
    setToast({ id, name: win.name, blurb: win.blurb, n: ids.length })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 4200)
  }, [])

  const markActivity = useCallback(() => { lastActivityRef.current = Date.now() }, [])

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  // ── Global detectors — only armed once the player has clicked the
  // trophy at least once, so the intro screen stays calm and nothing can
  // be "discovered" before the player knows there's anything to find.
  useEffect(() => {
    if (!started) return

    startSizeRef.current = { w: window.innerWidth, h: window.innerHeight }
    lastActivityRef.current = Date.now()

    function onKeyDown(e) {
      markActivity()
      const buf = keyBufRef.current
      buf.push(e.code)
      if (buf.length > 24) buf.shift()

      if (KONAMI.every((code, i) => buf[buf.length - KONAMI.length + i] === code)) {
        addWin('konami')
        keyBufRef.current = []
        return
      }
      const typed = buf.slice(-3).join(',')
      if (typed === 'KeyW,KeyI,KeyN') addWin('spell')
    }

    function onPointerMove(e) {
      markActivity()
      const s = shakeRef.current
      const now = performance.now()
      if (now - s.since > SHAKE_WINDOW_MS) { s.since = now; s.dist = 0 }
      if (s.lastX != null) s.dist += Math.hypot(e.clientX - s.lastX, e.clientY - s.lastY)
      s.lastX = e.clientX; s.lastY = e.clientY
      if (s.dist > SHAKE_WIN_PX) { s.dist = 0; addWin('shake') }
    }

    function onResize() {
      markActivity()
      const start = startSizeRef.current
      if (!start) return
      if (Math.abs(window.innerWidth - start.w) + Math.abs(window.innerHeight - start.h) > RESIZE_WIN_PX) {
        addWin('resize')
      }
    }

    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_WIN_MS) addWin('idle')
    }, 1000)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', markActivity)
    window.addEventListener('wheel', markActivity, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      clearInterval(idleTimer)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', markActivity)
      window.removeEventListener('wheel', markActivity)
      window.removeEventListener('resize', onResize)
    }
  }, [started, addWin, markActivity])

  // ── Trophy: one element serving three different wins (click-to-ten,
  // long press, drag off the pedestal), so pointer events are handled by
  // hand rather than with onClick — a drag or a hold must NOT also count
  // as a click.
  function onTrophyPointerDown(e) {
    if (e.button !== 0) return // right/middle press is its own win, not a click or a hold
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const holdTimer = started
      ? setTimeout(() => { addWin('hold'); if (pressRef.current) pressRef.current.consumed = true }, HOLD_WIN_MS)
      : null
    pressRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: 0, holdTimer, consumed: false }
  }

  function onTrophyPointerMove(e) {
    const p = pressRef.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.startX, dy = e.clientY - p.startY
    p.moved = Math.max(p.moved, Math.hypot(dx, dy))
    if (p.moved > CLICK_SLOP_PX) {
      clearTimeout(p.holdTimer)
      p.holdTimer = null
      setDragging(true)
      setDragOffset({ x: dx, y: dy })
      if (started && p.moved > DRAG_WIN_PX && !p.consumed) { p.consumed = true; addWin('drag') }
    }
  }

  function onTrophyPointerUp(e) {
    const p = pressRef.current
    pressRef.current = null
    setDragging(false)
    setDragOffset({ x: 0, y: 0 })
    if (!p || p.id !== e.pointerId) return
    clearTimeout(p.holdTimer)
    if (p.moved > CLICK_SLOP_PX || p.consumed) return // a drag or a hold, not a click

    if (!started) { setStarted(true); setDenial(DENIALS[0]); trophyClicksRef.current = 1; return }
    trophyClicksRef.current += 1
    const n = trophyClicksRef.current
    setDenial(DENIALS[Math.min(n - 1, DENIALS.length - 1)])
    if (n >= 10) addWin('persist')
  }

  function onTrophyContextMenu(e) {
    e.preventDefault()
    if (started) addWin('rightclick')
  }

  function onScroll(e) {
    markActivity()
    if (started && e.currentTarget.scrollTop > BASEMENT_SCROLL_PX) addWin('basement')
  }

  function onTitleDoubleClick() { if (started) addWin('title') }

  function onHiddenButton() {
    setTabBtnFound(true)
    if (started) addWin('tab')
  }

  function resetEverything() {
    clearWins()
    foundRef.current = new Set()
    trophyClicksRef.current = 0
    keyBufRef.current = []
    setFound([])
    setStarted(false)
    setDenial(null)
    setToast(null)
    setTabBtnFound(false)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className={styles.page} ref={scrollRef} onScroll={onScroll}>
      <Link to="/" className={styles.backLink}>← GameHub</Link>

      <main className={styles.stage}>
        <h1 className={styles.title} onDoubleClick={onTitleDoubleClick}>EASY GAME</h1>
        <p className={styles.tagline}>
          {started ? 'Twelve secret wins are hidden in this page.' : "Click the trophy. That's the whole game."}
        </p>

        <div className={styles.pedestalWrap}>
          <button
            className={`${styles.trophy} ${dragging ? styles.trophyDragging : ''}`}
            style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
            onPointerDown={onTrophyPointerDown}
            onPointerMove={onTrophyPointerMove}
            onPointerUp={onTrophyPointerUp}
            onPointerCancel={onTrophyPointerUp}
            onContextMenu={onTrophyContextMenu}
            aria-label="The trophy"
          >
            🏆
          </button>
          <div className={styles.pedestal} />
        </div>

        {denial && <p className={styles.denial} key={denial}>{denial}</p>}
        {!started && <p className={styles.subtle}>(It's right there. This will be easy.)</p>}

        {started && (
          <>
            <div className={styles.progressRow}>
              <span className={styles.progressLabel}>Secret wins</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${(found.length / TOTAL_WINS) * 100}%` }} />
              </div>
              <span className={styles.progressCount}>{found.length} / {TOTAL_WINS}</span>
            </div>

            <div className={styles.winGrid}>
              {WINS.map(win => {
                const got = foundRef.current.has(win.id)
                return (
                  <div key={win.id} className={`${styles.winCard} ${got ? styles.winCardFound : ''}`}>
                    <span className={styles.winName}>{got ? `✅ ${win.name}` : '🔒 ? ? ?'}</span>
                    <span className={styles.winText}>
                      {got ? win.blurb : (showHints ? win.hint : 'Undiscovered.')}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className={styles.btnRow}>
              <button className={styles.secondaryBtn} onClick={() => setShowHints(h => !h)}>
                {showHints ? 'Hide hints' : 'Show hints'}
              </button>
              <button className={styles.secondaryBtn} onClick={resetEverything}>Start over</button>
            </div>
          </>
        )}
      </main>

      {/* Off-screen until focused — Tab is the only way to find it. */}
      <button className={styles.hiddenBtn} onClick={onHiddenButton}>
        {tabBtnFound ? 'You already found me!' : 'A button the mouse cannot see. Press it.'}
      </button>

      <div className={styles.gap} aria-hidden="true" />

      <section className={styles.basement}>
        <h2 className={styles.basementTitle}>🕸️ The Basement</h2>
        <p className={styles.basementText}>
          Nothing down here but the stuff the game didn't need. An unused trophy. Some
          leftover semicolons. A note that says <em>"remember to delete this before shipping."</em>
        </p>
        <span className={styles.basementTrophy}>🏆</span>
      </section>

      {toast && (
        <div className={styles.toast} key={toast.id}>
          <span className={styles.toastTitle}>🎉 Secret win {toast.n}/{TOTAL_WINS}: {toast.name}</span>
          <span className={styles.toastBlurb}>{toast.blurb}</span>
        </div>
      )}

      {allFound && (
        <div className={styles.victory}>
          <div className={styles.victoryBox}>
            <h2 className={styles.victoryTitle}>🏆 YOU ACTUALLY WIN</h2>
            <p className={styles.victoryText}>
              All {TOTAL_WINS} secret wins found. The trophy was never the point — though you
              did also take it off the pedestal at one stage, which we're choosing not to discuss.
            </p>
            <div className={styles.btnRow}>
              <button className={styles.bigBtn} onClick={resetEverything}>↻ Play again</button>
              <Link to="/" className={styles.secondaryBtn}>← Back to GameHub</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
