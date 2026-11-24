import { useState } from 'react'
import styles from './TotallyScaryHorrorGame.module.css'
import { MONSTER_DEFS, MONSTER_ORDER, JOURNAL } from './constants.js'

// ── The monster journal ────────────────────────────────────────────────
// A page per entity. Unfaced ones stay a mystery; faced ones show how to
// get past them and your record against them; their full backstory
// unlocks once they've actually caught you (that's the whole point of
// getting caught in this game).

export default function Journal({ journal, onClose }) {
  const [openId, setOpenId] = useState(null)
  const entries = journal?.entries ?? {}
  const facedCount = MONSTER_ORDER.filter(id => entries[id]?.faced).length
  const open = openId ? MONSTER_DEFS[openId] : null
  const oe = openId ? entries[openId] : null

  return (
    <div className={`${styles.shopWrap} ${styles.journalWrap}`} onClick={onClose}>
      <div className={`${styles.shopBox} ${styles.journalBox}`} onClick={e => e.stopPropagation()}>
        <div className={styles.shopHead}>
          <span className={styles.shopTitle}>📖 Monster Journal</span>
          <span className={styles.shopCoins}>{facedCount} / {MONSTER_ORDER.length} faced</span>
        </div>

        {!open && (
          <>
            {[1, 2, 3, 4, -1, 'secret'].map(floor => (
              <div key={floor}>
                <div className={styles.journalFloor}>{floor === 'secret' ? '🤫 Secret' : floor === -1 ? 'Floor -A0001 — the dark' : `Floor ${floor} — ${['', 'the hotel', 'the basement & mines', 'the attic', 'the garden'][floor]}`}</div>
                <div className={styles.journalGrid}>
                  {MONSTER_ORDER.filter(id => JOURNAL[id].floor === floor).map(id => {
                    const e = entries[id]
                    const faced = !!e?.faced
                    return (
                      <button key={id} className={`${styles.journalCard} ${faced ? '' : styles.metUnknown}`} disabled={!faced} onClick={() => setOpenId(id)} title={!faced && JOURNAL[id].hint ? JOURNAL[id].hint : undefined}>
                        <div className={styles.metIcon}>{faced ? MONSTER_DEFS[id].icon : floor === 'secret' ? '🔒' : '❔'}</div>
                        <div className={styles.metName}>{faced ? MONSTER_DEFS[id].name : '???'}</div>
                        {!faced && JOURNAL[id].hint && <div className={styles.journalStat}>{JOURNAL[id].hint}</div>}
                        {faced && floor !== 'secret' && <div className={styles.journalStat}>😵 {e.caught || 0} · 🏃 {e.dodged || 0}</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className={styles.shopGreet}>Face a monster to add its page. Get caught by it to hear its whole story. (😵 = times it caught you · 🏃 = times you got past it)</p>
          </>
        )}

        {open && (
          <div className={styles.journalPage}>
            <div className={styles.journalPageHead}>
              <span className={styles.journalBigIcon}>{open.icon}</span>
              <div>
                <div className={styles.journalName}>{open.name}</div>
                <div className={styles.dialogueTitle}>{open.title} · {JOURNAL[openId].floor === 'secret' ? 'Secret' : JOURNAL[openId].floor === -1 ? 'Floor -A0001' : `Floor ${JOURNAL[openId].floor}`}</div>
              </div>
            </div>
            <div className={styles.journalTip}>💡 {JOURNAL[openId].tip}</div>
            {JOURNAL[openId].floor !== 'secret' && <div className={styles.journalStat}>Caught you {oe.caught || 0} time{oe.caught === 1 ? '' : 's'} · you got past {oe.dodged || 0} time{oe.dodged === 1 ? '' : 's'}</div>}
            {oe.caught > 0 || JOURNAL[openId].floor === 'secret' ? (
              <div className={styles.journalStory}>
                <b>Their story:</b>
                {open.lines.map((l, i) => <p key={i}>“{l}”</p>)}
              </div>
            ) : (
              <div className={styles.journalStory}><i>🔒 Get caught by {open.name} to hear their side of the story.</i></div>
            )}
            <button className={styles.secondaryBtn} onClick={() => setOpenId(null)}>← All monsters</button>
          </div>
        )}

        <button className={styles.dialogueBtn} onClick={onClose}>Close journal (J)</button>
      </div>
    </div>
  )
}
