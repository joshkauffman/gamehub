import { useState } from 'react'
import styles from './Setup.module.css'
import { ALL_GRADES } from '../engine/roundBuilder.js'

const COUNT_PRESETS = [8, 12, 16]

export default function Setup({ onStart, historyCount, onViewHistory, onViewInsights }) {
  const [count, setCount] = useState(12)
  const [grades, setGrades] = useState(ALL_GRADES)

  function toggleGrade(g) {
    setGrades(prev => {
      if (prev.includes(g)) {
        const next = prev.filter(x => x !== g)
        return next.length ? next : prev // always keep at least one grade selected
      }
      return [...prev, g].sort((a, b) => a - b)
    })
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Hudson School Practice</h1>
      <p className={styles.subtitle}>
        Math practice, grades 1–6. Pick an answer, or tap "I have no idea" — that's always okay. No timer, no pressure.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Number of questions</h2>
        <div className={styles.countRow}>
          {COUNT_PRESETS.map(n => (
            <button
              key={n}
              type="button"
              className={`${styles.countBtn} ${count === n ? styles.active : ''}`}
              onClick={() => setCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Grades to include</h2>
        <div className={styles.gradeRow}>
          {ALL_GRADES.map(g => (
            <button
              key={g}
              type="button"
              className={`${styles.gradeBtn} ${grades.includes(g) ? styles.active : ''}`}
              onClick={() => toggleGrade(g)}
            >
              Grade {g}
            </button>
          ))}
        </div>
        <p className={styles.gradeHint}>Start with all grades checked to see where he lands, then narrow it down later.</p>
      </section>

      <button type="button" className={styles.startBtn} onClick={() => onStart({ count, grades })}>
        Start practice →
      </button>

      <div className={styles.linkRow}>
        <button type="button" className={styles.linkBtn} onClick={onViewInsights}>
          📊 Insights
        </button>
        {historyCount > 0 && (
          <button type="button" className={styles.linkBtn} onClick={onViewHistory}>
            🕐 History ({historyCount})
          </button>
        )}
      </div>
    </div>
  )
}
