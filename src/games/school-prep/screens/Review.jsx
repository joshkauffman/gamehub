import { useState } from 'react'
import styles from './Review.module.css'

function statusLabel(status, answered) {
  if (status === 'flagged') return 'Flagged for review'
  if (!answered) return 'Blank — no answer yet'
  if (status === 'unsure') return 'Answered (was unsure)'
  return 'Answered'
}

export default function Review({ round, onEdit, onSubmit }) {
  const [confirming, setConfirming] = useState(false)

  const blankCount = round.questions.filter(q => round.answers[q.id] == null).length

  function handleSubmitClick() {
    if (blankCount > 0) setConfirming(true)
    else onSubmit()
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Review before you submit</h2>
      <p className={styles.subtitle}>Tap any question to change your answer. There is no penalty for guessing — never leave a blank.</p>

      <ul className={styles.list}>
        {round.questions.map((q, i) => {
          const answered = round.answers[q.id] != null
          const status = round.status[q.id]
          const blank = !answered
          return (
            <li key={q.id}>
              <button type="button" className={`${styles.row} ${blank ? styles.blankRow : ''}`} onClick={() => onEdit(i)}>
                <span className={styles.num}>{i + 1}</span>
                <span className={styles.prompt}>{q.prompt}</span>
                <span className={`${styles.status} ${status === 'flagged' ? styles.flaggedStatus : ''} ${blank ? styles.blankStatus : ''}`}>
                  {statusLabel(status, answered)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <button type="button" className={styles.submitBtn} onClick={handleSubmitClick}>
        Final submit →
      </button>

      {confirming && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <p>You have {blankCount} blank question{blankCount === 1 ? '' : 's'}. There's no penalty for guessing — want to fill them in first?</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setConfirming(false)}>Go back and answer</button>
              <button type="button" className={styles.primaryBtn} onClick={onSubmit}>Submit anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
