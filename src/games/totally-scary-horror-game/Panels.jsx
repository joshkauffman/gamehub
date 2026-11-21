import { useState } from 'react'
import styles from './TotallyScaryHorrorGame.module.css'
import { MONSTER_DEFS, MONSTER_ORDER, JOURNAL, DIFFICULTIES, FLOOR3_PRICE } from './constants.js'
import { ACHIEVEMENTS } from './achievements.js'

// ── Lobby panels: elevator (start a run), trophy case, photo album,
// and the scoreboard. They share the shop/journal overlay styling. ──

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), t = Math.floor((sec * 10) % 10)
  return `${m}:${String(s).padStart(2, '0')}.${t}`
}

function Panel({ title, right, onClose, children, wide }) {
  return (
    <div className={`${styles.shopWrap} ${styles.journalWrap}`} onClick={onClose}>
      <div className={`${styles.shopBox} ${styles.journalBox} ${wide ? styles.panelWide : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.shopHead}>
          <span className={styles.shopTitle}>{title}</span>
          {right && <span className={styles.shopCoins}>{right}</span>}
        </div>
        {children}
        <button className={styles.dialogueBtn} onClick={onClose}>Close (E)</button>
      </div>
    </div>
  )
}

const FLOORS = {
  1: { icon: '🏨', name: 'Floor 1', desc: 'The whole hotel: 100 doors, both floors.' },
  2: { icon: '⛏️', name: 'Floor 2', desc: 'Skip straight down to the basement & mines.' },
  3: { icon: '🏚️', name: 'Floor 3', desc: 'Up to the attic: 50 dusty doors, then the rooftop.' },
  4: { icon: '🌙', name: 'Floor 4', desc: 'Outside, into the garden. Only one person works out there.' },
}

export function ElevatorPanel({ settings, perks, wallet, unlocked3, unlocked4, onUnlock, onGo, onClose }) {
  const startable = (f) => (f === 3 ? unlocked3 : f === 4 ? unlocked4 : true)
  const [floor, setFloor] = useState(startable(settings.startFloor || 1) ? settings.startFloor || 1 : 1)
  const [diff, setDiff] = useState(settings.difficulty || 'normal')
  return (
    <Panel title="🛗 The Elevator" onClose={onClose}>
      <div className={styles.journalFloor}>Where to?</div>
      <div className={styles.choiceRow}>
        {[1, 2, 3, 4].map(f => {
          const locked = !startable(f)
          return (
            <button key={f} className={`${styles.choice} ${floor === f ? styles.choiceOn : ''} ${locked ? styles.choiceLocked : ''}`} onClick={() => setFloor(f)}>
              <b>{locked ? '🔒' : FLOORS[f].icon} {FLOORS[f].name}</b>
              <span>{locked ? (f === 3 ? `Costs 🪙 ${FLOOR3_PRICE} tips to unlock (once).` : 'Escape the attic to unlock.') : FLOORS[f].desc}</span>
            </button>
          )
        })}
      </div>
      <p className={styles.shopGreet}>🫙 Tip jar: <b>🪙 {wallet}</b> — every tip you carry out of the hotel lands here.</p>
      <div className={styles.journalFloor}>How scary?</div>
      <div className={styles.choiceRow}>
        {Object.values(DIFFICULTIES).map(d => (
          <button key={d.id} className={`${styles.choice} ${diff === d.id ? styles.choiceOn : ''}`} onClick={() => setDiff(d.id)}>
            <b>{d.icon} {d.name}</b>
            <span>{d.desc}</span>
          </button>
        ))}
      </div>
      {perks.allowance && <p className={styles.shopGreet}>👵 Grandma Bea left you a little allowance at the front desk for this stay.</p>}
      {floor === 4 && !unlocked4 ? (
        <button className={styles.bigBtn} disabled>🔒 Escape the attic first</button>
      ) : floor === 3 && !unlocked3 ? (
        <button className={styles.bigBtn} disabled={wallet < FLOOR3_PRICE} onClick={onUnlock}>
          {wallet >= FLOOR3_PRICE ? `🔓 Unlock the attic (🪙 ${FLOOR3_PRICE})` : `Need 🪙 ${FLOOR3_PRICE - wallet} more tips`}
        </button>
      ) : (
        <button className={styles.bigBtn} onClick={() => onGo({ floor, difficulty: diff })}>▶ {floor === 4 ? 'Out to the garden…' : `Going ${floor === 2 ? 'down' : 'up'}!`}</button>
      )}
    </Panel>
  )
}

export function AchievementsPanel({ progress, onClose }) {
  const got = ACHIEVEMENTS.filter(a => progress.achievements[a.id]).length
  return (
    <Panel title="🏆 Trophy Case" right={`${got} / ${ACHIEVEMENTS.length}`} onClose={onClose} wide>
      <div className={styles.trophyGrid}>
        {ACHIEVEMENTS.map(a => {
          const on = !!progress.achievements[a.id]
          return (
            <div key={a.id} className={`${styles.trophy} ${on ? styles.trophyOn : ''}`}>
              <div className={styles.trophyIcon}>{on ? a.icon : '🔒'}</div>
              <div>
                <b>{a.name}</b>
                <div className={styles.journalStat}>{a.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

const RARITY = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '🎃🎃🎃🎃', secret: '🌟🌟🌟' }

export function AlbumPanel({ progress, onClose }) {
  const [big, setBig] = useState(null)
  const have = MONSTER_ORDER.filter(id => progress.photos[id]).length
  return (
    <Panel title="📷 Photo Album" right={`${have} / ${MONSTER_ORDER.length} cards`} onClose={onClose} wide>
      {!big && (
        <>
          <div className={styles.cardGrid}>
            {MONSTER_ORDER.map(id => {
              const photo = progress.photos[id]
              const def = MONSTER_DEFS[id]
              const secret = JOURNAL[id].floor === 'secret'
              return (
                <button key={id} className={`${styles.card} ${secret ? styles.cardGold : ''} ${photo ? '' : styles.metUnknown}`} disabled={!photo} onClick={() => setBig(id)}>
                  {photo ? <img src={photo} alt={def.name} className={styles.cardImg} /> : <div className={styles.cardBlank}>{secret ? '🔒' : '❔'}</div>}
                  <div className={styles.cardName}>{photo ? `${def.icon} ${def.name}` : '???'}</div>
                  <div className={styles.cardRarity}>{RARITY[JOURNAL[id].floor]}</div>
                </button>
              )
            })}
          </div>
          <p className={styles.shopGreet}>A photo gets snapped automatically whenever a monster sits down to talk with you. Secret ones are gold!</p>
        </>
      )}
      {big && (
        <div className={styles.journalPage}>
          <img src={progress.photos[big]} alt={MONSTER_DEFS[big].name} className={styles.cardImgBig} />
          <div className={styles.journalName}>{MONSTER_DEFS[big].icon} {MONSTER_DEFS[big].name} <span className={styles.cardRarity}>{RARITY[JOURNAL[big].floor]}</span></div>
          <div className={styles.dialogueTitle}>{MONSTER_DEFS[big].title}</div>
          <button className={styles.secondaryBtn} onClick={() => setBig(null)}>← All cards</button>
        </div>
      )}
    </Panel>
  )
}

export function RecordsPanel({ progress, onClose }) {
  const [floor, setFloor] = useState(1)
  const rows = progress.records.filter(r => r.startFloor === floor).sort((a, b) => a.seconds - b.seconds).slice(0, 10)
  return (
    <Panel title="⏱️ Fastest Checkouts" right={`${progress.stats.escapes} escape${progress.stats.escapes === 1 ? '' : 's'}`} onClose={onClose} wide>
      <div className={styles.choiceRow}>
        {[1, 2, 3, 4].map(f => (
          <button key={f} className={`${styles.choice} ${styles.choiceSmall} ${floor === f ? styles.choiceOn : ''}`} onClick={() => setFloor(f)}>
            <b>{f === 1 ? '🏨 Full run (Floor 1 start)' : f === 2 ? '⛏️ Floor 2 only' : f === 3 ? '🏚️ The attic' : '🌙 The garden'}</b>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={styles.shopGreet}>No escapes here yet. Be the first name on the board!</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.recordTable}>
            <thead><tr><th>#</th><th>Name</th><th>Time</th><th>Level</th><th>😵</th><th>🏃</th><th>🪙</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td>{r.name || 'Guest'}</td>
                  <td>{fmtTime(r.seconds)}</td>
                  <td>{DIFFICULTIES[r.difficulty]?.icon} {DIFFICULTIES[r.difficulty]?.name}</td>
                  <td>{r.catches}</td>
                  <td>{r.dodges}</td>
                  <td>{r.coins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
