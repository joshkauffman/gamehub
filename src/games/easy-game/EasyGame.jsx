import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './EasyGame.module.css'
import { WINS, TOTAL_WINS, DENIALS, getWin, loadWins, saveWins, clearWins } from './wins.js'

// ── Easy Game ────────────────────────────────────────────────────────────
// A trophy sits on a pedestal. Clicking it is the obvious move, and it
// never works — it just tells you to find other ways to win. The actual
// game is a long list of secret wins hidden in how you can interact with
// the page: mouse buttons and modifier keys on the trophy itself, timing
// windows (too fast / too slow / just right), the keyboard, the window,
// the scrollbar, the browser chrome, and simply walking away.
//
// Deliberately no hint system, and nothing on screen ever shows how many
// wins exist in total — found wins are listed as they're discovered with
// no placeholders for the rest, so the count stays a secret until the
// victory screen reveals it as the final payoff.
//
// Plain DOM/CSS rather than canvas or Three.js — every win here IS a
// browser interaction, so the browser's own event model is the game
// engine. wins.js holds the win data and save helpers; this file owns
// the detectors.
//
// One deliberate backdoor: typing "cheater" opens a cheat sheet listing
// every win and how to trigger it. It doesn't count as a win itself and
// doesn't touch `found` — it's an escape hatch for anyone stuck, gated
// behind its own secret code rather than a visible "hints" button, so
// it doesn't contradict the no-hints-during-normal-play rule.

const IDLE_WIN_MS = 20000
const HOLD_WIN_MS = 2600
const GOLDILOCKS_MIN_MS = 900
const GOLDILOCKS_MAX_MS = 1250
const DRAG_WIN_PX = 110
const CLICK_SLOP_PX = 8
const SHAKE_WINDOW_MS = 800
const SHAKE_WIN_PX = 2600
const RESIZE_WIN_PX = 60
const BASEMENT_SCROLL_PX = 260
const ROUND_TRIP_MS = 4000
const TRIPLE_CLICK_WINDOW_MS = 650
const HOVER_WIN_MS = 6000
const RAGE_CLICK_GOAL = 6
const RAGE_WINDOW_MS = 1200
const BLANK_CLICK_GOAL = 7
const ESCAPE_WINDOW_MS = 2000
const AWAY_WIN_MS = 4000
const DEVTOOLS_GAP_PX = 160
const DEVTOOLS_MIN_WIDTH = 600

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA',
]
const SPELL_CODES = ['KeyI', 'KeyW', 'KeyI', 'KeyN']
const CHEATER_CODES = ['KeyC', 'KeyH', 'KeyE', 'KeyA', 'KeyT', 'KeyE', 'KeyR']

export default function EasyGame() {
  const [found, setFound] = useState(() => loadWins())
  const [started, setStarted] = useState(false)
  const [denial, setDenial] = useState(null)
  const [toast, setToast] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [tabBtnFound, setTabBtnFound] = useState(false)
  const [secretWordValue, setSecretWordValue] = useState('')
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false)

  // Long-lived listeners below are attached once per `started` flip, so
  // they can't close over fresh state — refs carry the live values.
  const foundRef = useRef(new Set(found))
  const scrollRef = useRef(null)
  const trophyClicksRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const toastTimerRef = useRef(null)
  const pressRef = useRef(null) // { id, startX, startY, moved, holdTimer, downAt, alt, ctrl, shift, consumed }
  const shakeRef = useRef({ dist: 0, since: 0, lastX: null, lastY: null })
  const keyBufRef = useRef([])
  const escapeTimesRef = useRef([])
  const tripleClickRef = useRef([])
  const rageRef = useRef([])
  const blankClickRef = useRef(0)
  const hoverTimerRef = useRef(null)
  const basementAtRef = useRef(null)
  const hiddenAtRef = useRef(null)
  const startSizeRef = useRef(null)

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

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        addWin('ctrlS')
        return
      }

      if (e.code === 'Escape') {
        const arr = escapeTimesRef.current
        const now = performance.now()
        arr.push(now)
        while (arr.length && now - arr[0] > ESCAPE_WINDOW_MS) arr.shift()
        if (arr.length >= 3) { addWin('escape3'); arr.length = 0 }
        return
      }

      const buf = keyBufRef.current
      buf.push(e.code)
      if (buf.length > 24) buf.shift()

      if (KONAMI.every((code, i) => buf[buf.length - KONAMI.length + i] === code)) {
        addWin('konami')
        keyBufRef.current = []
        return
      }
      const lastFour = buf.slice(-SPELL_CODES.length)
      if (lastFour.length === SPELL_CODES.length && lastFour.every((c, i) => c === SPELL_CODES[i])) {
        addWin('spell')
      }

      // "cheater" is not a win — it's a toggleable escape hatch for
      // anyone stuck, kept out of `found`/localStorage entirely.
      const lastSeven = buf.slice(-CHEATER_CODES.length)
      if (lastSeven.length === CHEATER_CODES.length && lastSeven.every((c, i) => c === CHEATER_CODES[i])) {
        setCheatSheetOpen(v => !v)
        keyBufRef.current = []
      }
    }

    function onAnyPointerDown(e) {
      markActivity()
      if (e.button !== 0) return
      const arr = rageRef.current
      const now = performance.now()
      arr.push(now)
      while (arr.length && now - arr[0] > RAGE_WINDOW_MS) arr.shift()
      if (arr.length >= RAGE_CLICK_GOAL) { addWin('rage'); arr.length = 0 }
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

    function onVisibility() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current) {
        const elapsed = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
        if (elapsed >= AWAY_WIN_MS) addWin('away')
        markActivity()
      }
    }

    const pollTimer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_WIN_MS) addWin('idle')
      if (
        window.innerWidth > DEVTOOLS_MIN_WIDTH &&
        (window.outerWidth - window.innerWidth > DEVTOOLS_GAP_PX || window.outerHeight - window.innerHeight > DEVTOOLS_GAP_PX)
      ) {
        addWin('devtools')
      }
    }, 1000)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onAnyPointerDown)
    window.addEventListener('wheel', markActivity, { passive: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(pollTimer)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onAnyPointerDown)
      window.removeEventListener('wheel', markActivity)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [started, addWin, markActivity])

  // ── Trophy: one element serving many wins (ten-click persistence,
  // right/middle click, Alt/Ctrl/Shift+click, triple-click, a long hold,
  // a goldilocks-duration hold, dragging it off the pedestal, and simply
  // hovering) — pointer events are handled by hand rather than onClick,
  // since a drag or a hold must NOT also count as a click, and a
  // modified click must NOT also advance the plain-click denial counter.
  function onTrophyPointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return
    e.preventDefault()
    clearTimeout(hoverTimerRef.current)
    e.currentTarget.setPointerCapture?.(e.pointerId)

    if (e.button === 1) {
      if (started) addWin('middleclick')
      pressRef.current = null
      return
    }

    const holdTimer = started
      ? setTimeout(() => { addWin('hold'); if (pressRef.current) pressRef.current.consumed = true }, HOLD_WIN_MS)
      : null
    pressRef.current = {
      id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: 0, holdTimer, consumed: false,
      downAt: performance.now(), alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey,
    }
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

    if (p.alt) { addWin('altclick'); return }
    if (p.ctrl) { addWin('ctrlclick'); return }
    if (p.shift) { addWin('shiftclick'); return }

    const heldMs = performance.now() - p.downAt
    const arr = tripleClickRef.current
    const now = performance.now()
    arr.push(now)
    while (arr.length && now - arr[0] > TRIPLE_CLICK_WINDOW_MS) arr.shift()
    if (arr.length >= 3) { addWin('tripleclick'); arr.length = 0 }
    if (heldMs >= GOLDILOCKS_MIN_MS && heldMs <= GOLDILOCKS_MAX_MS) addWin('goldilocks')

    trophyClicksRef.current += 1
    const n = trophyClicksRef.current
    setDenial(DENIALS[Math.min(n - 1, DENIALS.length - 1)])
    if (n >= 10) addWin('persist')
  }

  function onTrophyContextMenu(e) {
    e.preventDefault()
    if (started) addWin('rightclick')
  }

  function onTrophyPointerEnter() {
    if (!started) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => addWin('hover'), HOVER_WIN_MS)
  }

  function onTrophyPointerLeave() {
    clearTimeout(hoverTimerRef.current)
  }

  function onScroll(e) {
    markActivity()
    if (!started) return
    const top = e.currentTarget.scrollTop
    if (top > BASEMENT_SCROLL_PX) {
      if (!basementAtRef.current) basementAtRef.current = Date.now()
      addWin('basement')
    } else if (top < 20 && basementAtRef.current) {
      if (Date.now() - basementAtRef.current <= ROUND_TRIP_MS) addWin('roundtrip')
      basementAtRef.current = null
    }
  }

  // A click landing directly on the stage's own background (not any
  // child — text, buttons, the trophy) counts toward clicking on nothing.
  function onStageClick(e) {
    if (!started || e.target !== e.currentTarget) return
    blankClickRef.current += 1
    if (blankClickRef.current >= BLANK_CLICK_GOAL) addWin('blank')
  }

  function onTitleDoubleClick() { if (started) addWin('title') }

  function onHiddenButton() {
    setTabBtnFound(true)
    if (started) addWin('tab')
  }

  function onSecretWordChange(e) {
    const v = e.target.value
    setSecretWordValue(v)
    if (started && v.trim().toLowerCase() === 'please') addWin('secretword')
  }

  function resetEverything() {
    clearWins()
    foundRef.current = new Set()
    trophyClicksRef.current = 0
    keyBufRef.current = []
    escapeTimesRef.current = []
    tripleClickRef.current = []
    rageRef.current = []
    blankClickRef.current = 0
    basementAtRef.current = null
    hiddenAtRef.current = null
    clearTimeout(hoverTimerRef.current)
    setFound([])
    setStarted(false)
    setDenial(null)
    setToast(null)
    setTabBtnFound(false)
    setSecretWordValue('')
    setCheatSheetOpen(false)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className={styles.page} ref={scrollRef} onScroll={onScroll}>
      <Link to="/" className={styles.backLink}>← GameHub</Link>

      <main className={styles.stage} onClick={onStageClick}>
        <h1 className={styles.title} onDoubleClick={onTitleDoubleClick}>EASY GAME</h1>
        <p className={styles.tagline}>
          {started ? 'There are secret wins hidden all over this page. Good luck.' : "Click the trophy. That's the whole game."}
        </p>

        <div className={styles.pedestalWrap}>
          <button
            className={`${styles.trophy} ${dragging ? styles.trophyDragging : ''}`}
            style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
            onPointerDown={onTrophyPointerDown}
            onPointerMove={onTrophyPointerMove}
            onPointerUp={onTrophyPointerUp}
            onPointerCancel={onTrophyPointerUp}
            onPointerEnter={onTrophyPointerEnter}
            onPointerLeave={onTrophyPointerLeave}
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
            <p className={styles.foundCount}>🏆 Secret wins found: {found.length}</p>

            {found.length > 0 && (
              <div className={styles.winGrid}>
                {[...found].reverse().map(id => {
                  const win = getWin(id)
                  if (!win) return null
                  return (
                    <div key={id} className={styles.winCard}>
                      <span className={styles.winName}>✅ {win.name}</span>
                      <span className={styles.winText}>{win.blurb}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className={styles.btnRow}>
              <button className={styles.secondaryBtn} onClick={resetEverything}>Start over</button>
            </div>
          </>
        )}
      </main>

      {/* Off-screen until focused — Tab is the only way to find it. */}
      <button className={styles.hiddenBtn} onClick={onHiddenButton}>
        {tabBtnFound ? 'You already found me!' : 'A button the mouse cannot see. Press it.'}
      </button>

      {/* A second thing Tab can reach, further along — it wants a word. */}
      <input
        className={styles.hiddenInput}
        value={secretWordValue}
        onChange={onSecretWordChange}
        placeholder="..."
        aria-label="A second thing the mouse cannot see — it wants a word"
      />

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
          <span className={styles.toastTitle}>🎉 Secret win: {toast.name}</span>
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

      {cheatSheetOpen && (
        <div className={styles.cheatOverlay} onClick={() => setCheatSheetOpen(false)}>
          <div className={styles.cheatBox} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.cheatTitle}>🗒️ Cheat Sheet</h2>
            <p className={styles.cheatSub}>You typed "cheater." No judgment. Here's everything.</p>
            <div className={styles.cheatList}>
              {WINS.map(win => {
                const got = found.includes(win.id)
                return (
                  <div key={win.id} className={`${styles.cheatRow} ${got ? styles.cheatRowDone : ''}`}>
                    <span className={styles.cheatName}>{got ? '✅' : '▫️'} {win.name}</span>
                    <span className={styles.cheatHow}>{win.cheat}</span>
                  </div>
                )
              })}
            </div>
            <div className={styles.btnRow}>
              <button className={styles.secondaryBtn} onClick={() => setCheatSheetOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
