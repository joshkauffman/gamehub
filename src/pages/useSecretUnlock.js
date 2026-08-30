import { useEffect, useState } from 'react'

// Type "123secret" anywhere on the Home page (no field to click into —
// just start typing) to permanently reveal the hidden Secret section
// below. Persisted per-browser so it only needs to be entered once.
const CODE = '123secret'
const STORAGE_KEY = 'gamehub-secrets-unlocked'

export function useSecretUnlock() {
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    if (unlocked) return
    let buffer = ''
    function onKeyDown(e) {
      if (e.key.length !== 1) return // ignore Shift/Enter/arrows/etc.
      buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length)
      if (buffer === CODE) {
        try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* storage unavailable */ }
        setUnlocked(true)
        setJustUnlocked(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [unlocked])

  return { unlocked, justUnlocked }
}
