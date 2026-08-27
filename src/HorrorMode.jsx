import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { startDrone, playStinger } from './horrorAudio.js'

const SCARE_EMOJI = ['👹', '💀', '👻', '🧟', '😈']

const HorrorModeContext = createContext(false)

// Individual games can read this to layer their own bespoke reskin on top
// of the hub-wide filter — see The Obvious Mario Knockoff, which swaps its
// actual level palettes rather than relying on the filter alone.
export function useHorrorMode() {
  return useContext(HorrorModeContext)
}

// Routes that do their own deeper reskin and opt out of the blanket CSS
// filter. NOTE: a CSS `filter` on an ancestor can't be undone by `filter:
// none` on a descendant — filters composite the whole subtree as one layer
// before it's placed on the page — so exemption has to happen by simply not
// applying the body class while a route on this list is showing, not by a
// CSS override.
const FILTER_EXEMPT_PATHS = ['/obvious-mario-knockoff']

// Routes where H is already spoken for by the game itself (Hangman reads
// raw keydowns to guess letters, and H is a perfectly normal one to guess;
// Avatar binds H to Player 1's second bending move) — the toggle stays
// fully disabled here, though an already-active filter from elsewhere in
// the hub still applies visually.
const TOGGLE_EXEMPT_PATHS = ['/hangman', '/avatar']

// A hub-wide cheat: press H anywhere outside a text field to flip every
// game — canvas, WebGL, or plain DOM, it doesn't matter which — into a
// horror palette via a CSS filter on the whole app, plus a corner badge.
export function HorrorModeProvider({ children }) {
  const [horrorMode, setHorrorMode] = useState(false)
  const location = useLocation()
  const filterActive = horrorMode && !FILTER_EXEMPT_PATHS.includes(location.pathname)

  // The listener below is attached once, so it can't close over a fresh
  // `location` on every navigation — a ref keeps it reading the current
  // route without having to tear down and resubscribe on every route change.
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  const scareRef = useRef(null)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (TOGGLE_EXEMPT_PATHS.includes(pathnameRef.current)) return
      if (e.key.toLowerCase() === 'h') setHorrorMode(v => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('horror-mode', filterActive)
  }, [filterActive])

  // The actually-scary part: a droning ambient hum plus randomly-timed jump
  // scares (a flashed face, a stinger sound, a screen shake). Runs off the
  // raw `horrorMode` flag rather than `filterActive` so it still plays on
  // filter-exempt routes like The Obvious Mario Knockoff — sound and a
  // startle aren't part of the "blanket filter" this file otherwise skips.
  useEffect(() => {
    if (!horrorMode) return
    let stopDrone
    try { stopDrone = startDrone() } catch { stopDrone = null }

    let timeoutId
    function scheduleScare() {
      const delay = 12000 + Math.random() * 16000
      timeoutId = setTimeout(() => {
        try { playStinger() } catch { /* audio unavailable, still do the visual */ }
        const el = scareRef.current
        if (el) {
          el.textContent = SCARE_EMOJI[Math.floor(Math.random() * SCARE_EMOJI.length)]
          el.style.transition = 'none'
          el.style.opacity = '1'
          el.style.transform = 'scale(1)'
          void el.offsetWidth // force reflow so the next transition actually animates
          el.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in'
          setTimeout(() => {
            el.style.opacity = '0'
            el.style.transform = 'scale(1.4)'
          }, 180)
        }
        document.body.classList.add('horror-shake')
        setTimeout(() => document.body.classList.remove('horror-shake'), 450)
        scheduleScare()
      }, delay)
    }
    scheduleScare()

    return () => {
      clearTimeout(timeoutId)
      stopDrone?.()
    }
  }, [horrorMode])

  return (
    <HorrorModeContext.Provider value={horrorMode}>
      {children}
      {createPortal(
        // Portaled straight to <body>, outside #root — #root carries the
        // filter, and `filter` makes an element the containing block for
        // its `position: fixed` descendants, so anything left inside #root
        // would both get hue-shifted itself and stop tracking the viewport.
        <>
          {horrorMode && <div className="horror-badge">🎃 HORROR MODE — press H to undo</div>}
          <div ref={scareRef} className="horror-jumpscare" aria-hidden="true" />
        </>,
        document.body,
      )}
    </HorrorModeContext.Provider>
  )
}
