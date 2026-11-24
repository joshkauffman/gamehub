import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './TreasureDig.module.css'

// ── Treasure Dig ─────────────────────────────────────────────────────────
// The prize for solving the GameHub's secret treasure map. Somewhere on the
// island a chest is buried. Every hole you dig tells you how close you are
// (hot or cold). Find it before you run out of digs and the tide comes in.

export const LEVELS = [
  { id: 'beach', name: 'Sunny Beach', icon: '🏖️', size: 6, digs: 10, sand: '#f3d99b', water: '#4fc3f7' },
  { id: 'jungle', name: 'Jungle Cove', icon: '🌴', size: 8, digs: 12, sand: '#d9c27c', water: '#26a69a' },
  { id: 'skull', name: 'Skull Island', icon: '💀', size: 9, digs: 13, sand: '#bfae8a', water: '#37474f' },
  { id: 'volcano', name: 'Volcano Rock', icon: '🌋', size: 10, digs: 14, sand: '#a1887f', water: '#bf360c' },
]
const SAVE = 'treasure-dig-v1'
const FINDS = ['🦀', '🐚', '🦴', '🪙', '🥾', '🪱', '🐌', '🍾', '⚓', '🪨']

function loadSave() {
  try { return { stars: {}, ...JSON.parse(localStorage.getItem(SAVE)) } } catch { return { stars: {} } }
}
function heat(d) {
  if (d === 0) return { label: '💰 TREASURE!', color: '#ffd700' }
  if (d === 1) return { label: '🔥 Boiling hot!', color: '#ff3d00' }
  if (d === 2) return { label: '♨️ Hot!', color: '#ff7a00' }
  if (d === 3) return { label: '☀️ Warm', color: '#ffc400' }
  if (d <= 5) return { label: '🌥️ Cool', color: '#64b5f6' }
  return { label: '🧊 Freezing!', color: '#1e88e5' }
}

function newRound(level) {
  const n = level.size
  const chest = { r: Math.floor(Math.random() * n), c: Math.floor(Math.random() * n) }
  // A few palm trees you can't dig under (never on the chest).
  const palms = new Set()
  while (palms.size < Math.floor(n / 2)) {
    const r = Math.floor(Math.random() * n), c = Math.floor(Math.random() * n)
    if (r !== chest.r || c !== chest.c) palms.add(`${r},${c}`)
  }
  return { chest, palms, dug: {}, left: level.digs, state: 'playing', last: null }
}

export default function TreasureDig() {
  const [save, setSave] = useState(loadSave)
  const [levelIdx, setLevelIdx] = useState(null)
  const [round, setRound] = useState(null)
  const level = levelIdx == null ? null : LEVELS[levelIdx]

  useEffect(() => {
    try { localStorage.setItem(SAVE, JSON.stringify(save)) } catch { /* storage unavailable */ }
  }, [save])

  function start(i) { setLevelIdx(i); setRound(newRound(LEVELS[i])) }

  function dig(r, c) {
    if (round.state !== 'playing' || round.dug[`${r},${c}`] || round.palms.has(`${r},${c}`)) return
    const d = Math.max(Math.abs(r - round.chest.r), Math.abs(c - round.chest.c))
    const find = d === 0 ? '🧰' : Math.random() < 0.3 ? FINDS[Math.floor(Math.random() * FINDS.length)] : ''
    const dug = { ...round.dug, [`${r},${c}`]: { d, find } }
    const left = round.left - 1
    let state = 'playing'
    if (d === 0) {
      state = 'won'
      const used = level.digs - left
      const stars = used <= Math.ceil(level.digs / 3) ? 3 : used <= Math.ceil((level.digs * 2) / 3) ? 2 : 1
      setSave(s => ({ ...s, stars: { ...s.stars, [level.id]: Math.max(stars, s.stars[level.id] || 0) } }))
      setRound({ ...round, dug, left, state, last: { r, c, d }, stars })
      return
    }
    if (left <= 0) state = 'lost'
    setRound({ ...round, dug, left, state, last: { r, c, d } })
  }

  const unlockedUpTo = LEVELS.findIndex(l => !save.stars[l.id])

  if (!level) {
    return (
      <div className={styles.page}>
        <div className={styles.top}><Link to="/" className={styles.back}>← GameHub</Link></div>
        <h1 className={styles.title}>🏴‍☠️ Treasure Dig</h1>
        <p className={styles.sub}>You solved the map! Now find the buried chests. Every hole tells you if you’re hot 🔥 or cold 🧊.</p>
        <div className={styles.levels}>
          {LEVELS.map((l, i) => {
            const locked = unlockedUpTo !== -1 && i > unlockedUpTo
            const st = save.stars[l.id] || 0
            return (
              <button key={l.id} className={styles.level} disabled={locked} onClick={() => start(i)} style={{ '--sand': l.sand, '--water': l.water }}>
                <span className={styles.levelIcon}>{locked ? '🔒' : l.icon}</span>
                <b>{l.name}</b>
                <span className={styles.levelInfo}>{l.size}×{l.size} · {l.digs} digs</span>
                <span className={styles.stars}>{'★'.repeat(st)}<i>{'★'.repeat(3 - st)}</i></span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const h = round.last ? heat(round.last.d) : null
  return (
    <div className={styles.page} style={{ '--sand': level.sand, '--water': level.water }}>
      <div className={styles.top}>
        <button className={styles.back} onClick={() => setLevelIdx(null)}>← Islands</button>
        <span className={styles.digs}>🪏 {round.left} dig{round.left === 1 ? '' : 's'} left</span>
      </div>
      <h1 className={styles.title}>{level.icon} {level.name}</h1>
      <div className={styles.hint} style={{ color: h?.color }}>{h ? h.label : 'Pick a spot and dig!'}</div>
      <div className={styles.sea}>
        <div className={styles.island} style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}>
          {Array.from({ length: level.size * level.size }, (_, k) => {
            const r = Math.floor(k / level.size), c = k % level.size, key = `${r},${c}`
            const hole = round.dug[key]
            const palm = round.palms.has(key)
            const showChest = round.state === 'lost' && r === round.chest.r && c === round.chest.c
            return (
              <button
                key={key}
                className={`${styles.cell} ${hole ? styles.hole : ''} ${palm ? styles.palm : ''} ${showChest ? styles.reveal : ''}`}
                style={hole ? { '--heat': heat(hole.d).color } : undefined}
                onClick={() => dig(r, c)}
                disabled={round.state !== 'playing' || !!hole || palm}
                aria-label={palm ? 'palm tree' : hole ? heat(hole.d).label : `dig row ${r + 1} column ${c + 1}`}
              >
                {palm ? '🌴' : hole ? (hole.find || '') : showChest ? '🧰' : ''}
              </button>
            )
          })}
        </div>
      </div>
      {round.state === 'won' && (
        <div className={styles.result}>
          <div className={styles.chest}>💰</div>
          <b>You found the treasure!</b>
          <span className={styles.stars}>{'★'.repeat(round.stars)}<i>{'★'.repeat(3 - round.stars)}</i></span>
          <div className={styles.buttons}>
            {levelIdx < LEVELS.length - 1 && <button className={styles.btn} onClick={() => start(levelIdx + 1)}>Next island →</button>}
            <button className={styles.btn2} onClick={() => start(levelIdx)}>Dig again</button>
          </div>
        </div>
      )}
      {round.state === 'lost' && (
        <div className={styles.result}>
          <div className={styles.chest}>🌊</div>
          <b>The tide came in! The chest was right there…</b>
          <div className={styles.buttons}><button className={styles.btn} onClick={() => start(levelIdx)}>Try again</button></div>
        </div>
      )}
    </div>
  )
}
