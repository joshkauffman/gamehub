import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import styles from './PrintWorksheet.module.css'
import { buildRound } from '../engine/roundBuilder.js'
import { strandLabel } from '../engine/labels.js'

const SUBJECT_LABEL = { math: 'Math', english: 'English', french: 'Français' }
const LETTERS = ['A', 'B', 'C', 'D']

export default function PrintWorksheet() {
  const [params] = useSearchParams()
  const subject = params.get('subject') || 'math'
  const count = Math.min(100, Math.max(1, Number(params.get('count')) || 15))
  const topicFilter = params.get('topic') || null

  // Built once on load, not on every render — a worksheet should stay put
  // while the parent tab prints it, even though buildRound is randomized.
  const [round] = useState(() => buildRound({ subject, count, timerOn: false, topicFilter }))
  const [printed, setPrinted] = useState(false)

  useEffect(() => {
    if (printed) return
    const t = setTimeout(() => {
      window.print()
      setPrinted(true)
    }, 400)
    return () => clearTimeout(t)
  }, [printed])

  // Only the first question of each passage should show its text — computed
  // as a pure derivation of round.questions (not a mutated ref/ during
  // render), since React re-invokes render functions under StrictMode.
  const passageByQuestionId = useMemo(() => {
    const seen = new Set()
    const map = new Map()
    for (const q of round.questions) {
      if (q.passageId && !seen.has(q.passageId)) {
        seen.add(q.passageId)
        map.set(q.id, round.passages.find(p => p.id === q.passageId))
      }
    }
    return map
  }, [round])

  function passageFor(q) {
    return passageByQuestionId.get(q.id) || null
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <Link to="/school-prep" className={styles.backLink}>← Back to School Prep</Link>
        <button type="button" className={styles.printAgainBtn} onClick={() => window.print()}>
          🖨️ Print / Save as PDF
        </button>
      </div>

      <header className={styles.header}>
        <h1>School Prep — {SUBJECT_LABEL[subject] || subject} Practice</h1>
        {topicFilter && <p className={styles.topicNote}>Topic: {strandLabel(topicFilter)}</p>}
        <div className={styles.infoLine}>
          <span>Name: ______________________</span>
          <span>Date: __________</span>
          <span>Score: _____ / {round.questions.length}</span>
        </div>
      </header>

      <ol className={styles.questionList}>
        {round.questions.map((q, i) => {
          const passage = passageFor(q)
          return (
            <li key={q.id} className={styles.questionBlock}>
              {passage && (
                <div className={styles.passage}>
                  <h3>{passage.title}</h3>
                  <p>{passage.text}</p>
                </div>
              )}
              <p className={styles.prompt}><span className={styles.qNum}>{i + 1}.</span> {q.prompt}</p>
              <div className={styles.choices}>
                {q.choices.map((choice, ci) => (
                  <div key={ci} className={styles.choice}>
                    <span className={styles.choiceCircle}>{LETTERS[ci]}</span> {choice}
                  </div>
                ))}
              </div>
            </li>
          )
        })}
      </ol>

      <div className={styles.answerKey}>
        <h2>Answer Key</h2>
        <div className={styles.answerGrid}>
          {round.questions.map((q, i) => (
            <div key={q.id} className={styles.answerRow}>
              <strong>{i + 1}.</strong> {LETTERS[q.answerIndex]} — {q.choices[q.answerIndex]}
              <div className={styles.answerExplanation}>{q.explanation}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
