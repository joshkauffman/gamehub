import styles from './ProgressStrip.module.css'

// Neutral colours only, per the build guide: dots show answered / flagged /
// skipped state, never whether the answer was right or wrong.
export default function ProgressStrip({ questions, answers, status, currentIndex, maxIndexReached, onJump }) {
  return (
    <div className={styles.strip}>
      {questions.map((q, i) => {
        const st = status[q.id]
        const answered = answers[q.id] != null
        let cls = styles.unvisited
        if (st === 'flagged') cls = styles.flagged
        else if (st === 'unsure') cls = styles.unsure
        else if (answered) cls = styles.answered
        const canJump = onJump && i <= maxIndexReached
        return (
          <button
            key={q.id}
            type="button"
            disabled={!canJump}
            className={`${styles.dot} ${cls} ${i === currentIndex ? styles.current : ''}`}
            onClick={() => canJump && onJump(i)}
            title={`Question ${i + 1}${st ? ` — ${st}` : ''}`}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
