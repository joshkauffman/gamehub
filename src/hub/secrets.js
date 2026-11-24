// ── Hub secrets ──────────────────────────────────────────────────────────
// Easter eggs on the home page. Which ones a profile has found (and when)
// is saved so the footer can count them and the daily challenge can hint
// at the next one. Nothing typed here may contain an "h": H anywhere on the
// home page flips the hub-wide Horror Mode (see HorrorMode.jsx).
import { useEffect, useRef } from 'react'
import { pkey } from './profiles.js'
import { dayKey } from './playStats.js'

export const HUB_SECRETS = [
  { id: '123secret', name: 'The secret games', hint: 'Type 1, 2, 3 and then a word that means "hidden"… anywhere on this page.' },
  { id: 'logo', name: 'The logo door', hint: 'The big GameHub logo at the top is a door. Click it!' },
  { id: 'konami', name: 'The famous code', hint: 'The most famous cheat code ever works here: ↑ ↑ ↓ ↓ ← → ← → B A' },
  { id: 'disco', name: 'Disco time', hint: 'Click the "🎮 games" bubble under the logo 10 times in a row.' },
  { id: 'gravity', name: 'Gravity', hint: 'Type the word for the thing that makes everything fall down. (Starts with G!)' },
  { id: 'flip', name: 'Topsy-turvy', hint: 'Type a 4-letter word that means "turn over" (like a pancake).' },
]

const KEY = 'gamehub-hub-secrets'
export function loadFound(pid) {
  try { return JSON.parse(localStorage.getItem(pkey(KEY, pid))) || {} } catch { return {} }
}
// Returns true the first time this profile finds it.
export function markFound(id, date = dayKey()) {
  const f = loadFound()
  if (f[id]) return false
  try { localStorage.setItem(pkey(KEY), JSON.stringify({ ...f, [id]: date })) } catch { /* storage unavailable */ }
  return true
}

const WORDS = ['gravity', 'flip']
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

// Calls onSecret('gravity' | 'flip' | 'konami') when one is typed (not
// while typing in a text box).
export function useTypedSecrets(onSecret) {
  const cb = useRef(onSecret)
  cb.current = onSecret
  useEffect(() => {
    let typed = ''
    let keys = []
    function onKey(e) {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      keys = [...keys, k].slice(-KONAMI.length)
      if (keys.join() === KONAMI.join()) { keys = []; cb.current('konami'); return }
      if (e.key.length !== 1) return
      typed = (typed + k).slice(-12)
      const w = WORDS.find(w => typed.endsWith(w))
      if (w) { typed = ''; cb.current(w) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
