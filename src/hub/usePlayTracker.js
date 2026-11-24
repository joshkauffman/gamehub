import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { CATEGORIES, SECRET_GAMES } from '../pages/Home.jsx'
import { recordPlay, addTime } from './playStats.js'

// Which game (if any) a URL belongs to — by its first path segment.
const GAME_BY_SEGMENT = new Map()
for (const g of [...CATEGORIES.flatMap(c => c.games), ...SECRET_GAMES]) {
  if (!g.external && g.path?.startsWith('/')) GAME_BY_SEGMENT.set(g.path.split('/')[1], g.id)
}
export function gameIdForPath(pathname) { return GAME_BY_SEGMENT.get(pathname.split('/')[1]) || null }

// Mounted once in App: counts a play whenever you open a game, and adds up
// visible time spent on its page.
export function usePlayTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    const id = gameIdForPath(pathname)
    if (!id) return
    recordPlay(id)
    let since = document.hidden ? null : performance.now()
    const flush = () => {
      if (since == null) return
      addTime(id, (performance.now() - since) / 1000)
      since = document.hidden ? null : performance.now()
    }
    const onVis = () => { if (document.hidden) flush(); else since = performance.now() }
    const timer = setInterval(flush, 20000)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      flush()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
    }
  }, [pathname])
}
