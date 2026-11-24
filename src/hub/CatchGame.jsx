import { useEffect, useRef, useState } from 'react'
import styles from './Hub.module.css'
import { Modal } from './HubWidgets.jsx'
import { BACKGROUNDS, SPEEDS } from './creations.js'
import { sfx } from './sound.js'

// ── A tiny catch-and-dodge game ──────────────────────────────────────────
// Powers both the Konami-code secret (Emoji Catcher) and every mini-game
// made in the Mini-Game Maker. Things travel along one axis ("u", 0 → 1)
// and the hero slides along the other ("v"):
//   mode 'fall': things drop from the top, you move left/right at the bottom
//   mode 'fly':  things fly in from the right, you move up/down on the left
// goal: { type: 'endless' } | { type: 'score', n } | { type: 'survive', n (seconds) }

const HIT_U = 0.89

export default function CatchGame({ cfg, best = 0, onScore, onClose, title }) {
  const boxRef = useRef(null)
  const st = useRef(null)
  const [hud, setHud] = useState({ score: 0, lives: 3, t: 0, over: false, won: false })
  const [run, setRun] = useState(0)
  const fly = cfg.mode === 'fly'
  const speedK = SPEEDS[cfg.speed]?.k ?? 1
  const goal = cfg.goal || { type: 'endless' }

  useEffect(() => {
    const s = { p: 0.5, items: [], score: 0, lives: 3, t: 0, over: false, won: false, spawn: 0.3, keys: {}, pointer: null }
    st.current = s
    setHud({ score: 0, lives: 3, t: 0, over: false, won: false })
    let raf, last = performance.now()
    const minus = fly ? ['ArrowUp', 'w'] : ['ArrowLeft', 'a']
    const plus = fly ? ['ArrowDown', 's'] : ['ArrowRight', 'd']
    const onKey = (e) => {
      if ([...minus, ...plus].includes(e.key)) { s.keys[e.key] = e.type === 'keydown'; e.preventDefault() }
    }
    const finish = (won) => {
      s.over = true
      s.won = won
      sfx(won ? 'win' : 'boom')
      onScore?.(s.score, won)
    }
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      if (!s.over) {
        s.t += dt
        const ramp = 1 + s.t / 30
        const dir = (plus.some(k => s.keys[k]) ? 1 : 0) - (minus.some(k => s.keys[k]) ? 1 : 0)
        if (dir) { s.p += dir * dt * 0.95; s.pointer = null }
        if (s.pointer != null) s.p += (s.pointer - s.p) * Math.min(1, dt * 14)
        s.p = Math.max(0.06, Math.min(0.94, s.p))
        s.spawn -= dt
        if (s.spawn <= 0) {
          s.spawn = Math.max(0.25, (0.85 - s.t / 70) / speedK)
          const bad = cfg.bad.length > 0 && Math.random() < Math.min(0.34, 0.14 + s.t / 200)
          const gold = !bad && Math.random() < 0.07
          const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
          s.items.push({ u: -0.05, v: 0.06 + Math.random() * 0.88, vel: (0.22 + Math.random() * 0.12) * ramp * speedK, e: bad ? pick(cfg.bad) : gold ? '🌟' : pick(cfg.good), bad, gold, id: Math.random() })
        }
        for (const it of s.items) it.u += it.vel * dt
        for (const it of s.items) {
          if (it.u > HIT_U - 0.05 && it.u < HIT_U + 0.06 && Math.abs(it.v - s.p) < 0.085) {
            it.dead = true
            if (it.bad) { s.lives -= 1; sfx('boom') } else { s.score += it.gold ? 5 : 1; sfx(it.gold ? 'heart' : 'tick') }
          }
        }
        s.items = s.items.filter(it => !it.dead && it.u < 1.05)
        if (s.lives <= 0) finish(false)
        else if (goal.type === 'score' && s.score >= goal.n) finish(true)
        else if (goal.type === 'survive' && s.t >= goal.n) finish(true)
        setHud({ score: s.score, lives: s.lives, t: s.t, over: s.over, won: s.won })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = st.current
  const pos = (u, v) => (fly ? { left: `${(1 - u) * 100}%`, top: `${v * 100}%` } : { left: `${v * 100}%`, top: `${u * 100}%` })
  function onMove(e) {
    const r = boxRef.current?.getBoundingClientRect()
    if (r && s) s.pointer = fly ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width
  }
  const bg = BACKGROUNDS[cfg.bg]
  const goalText = goal.type === 'score' ? `Catch ${goal.n} to win` : goal.type === 'survive' ? `Survive ${goal.n}s to win` : 'Get the best score you can'
  return (
    <Modal title={title || `${cfg.hero} ${cfg.name}`} onClose={onClose} wide>
      <div className={styles.catchHud}>
        <span>{goal.type === 'survive' ? <>⏱️ <b>{Math.min(goal.n, Math.floor(hud.t))}/{goal.n}s</b> · </> : null}Score <b>{hud.score}</b>{goal.type === 'score' ? ` / ${goal.n}` : ''}</span>
        <span>{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(3 - Math.max(0, hud.lives))}</span>
        <span>Best <b>{Math.max(best, hud.over ? hud.score : 0)}</b></span>
      </div>
      <div ref={boxRef} className={`${styles.catchBox} ${bg && !bg.dark ? styles.catchLight : ''}`} style={bg ? { background: bg.css } : undefined} onPointerMove={onMove} onPointerDown={onMove}>
        {s?.items.map(it => <span key={it.id} className={styles.fall} style={pos(it.u, it.v)}>{it.e}</span>)}
        <span className={styles.basket} style={pos(HIT_U, s?.p ?? 0.5)}>{cfg.hero}</span>
        {hud.over && (
          <div className={styles.catchOver}>
            <div className={styles.slotTitle}>{hud.won ? '🎉 You win! 🎉' : 'Game over!'} {!hud.won && hud.score > best ? '⭐ New best!' : ''}</div>
            <div className={styles.row}>
              <button className={styles.primary} onClick={() => setRun(r => r + 1)}>Play again</button>
              <button className={styles.ghost} onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
      <p className={styles.small}>
        {goalText}. Move with the mouse (or {fly ? '↑ ↓' : '← →'}). Catch {cfg.good.slice(0, 4).join(' ')}{cfg.good.length > 4 ? '…' : ''}, 🌟 is worth 5{cfg.bad.length ? <>, dodge {cfg.bad.join(' ')}</> : ''}!
      </p>
    </Modal>
  )
}
