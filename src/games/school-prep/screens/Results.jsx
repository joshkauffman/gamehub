import styles from './Results.module.css'
import { strandLabel } from '../engine/labels.js'
import Visual from '../components/Visual.jsx'

function formatTime(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

const CONFIDENCE_ORDER = ['Sure and right', 'Sure but wrong', 'Flagged', 'Guessed and right', 'Guessed and wrong', 'Guessed']

export default function Results({ score, onRestart, onViewHistory }) {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Results</h2>
      <div className={styles.scoreCard}>
        <div className={styles.scoreBig}>{score.correctCount} / {score.total}</div>
        <div className={styles.scorePercent}>{score.percent}%</div>
        <div className={styles.time}>Time used: {formatTime(score.timeUsedSeconds)}</div>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>Breakdown by topic</h3>
        <div className={styles.topicList}>
          {score.byTopic.map(t => (
            <div key={t.strand} className={styles.topicRow}>
              <span className={styles.topicName}>{strandLabel(t.strand)}</span>
              <span className={styles.topicScore}>{t.correct}/{t.total}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>Breakdown by confidence</h3>
        <p className={styles.hint}>"Sure but wrong" is the most useful number — it flags overconfidence.</p>
        <div className={styles.confidenceGrid}>
          {CONFIDENCE_ORDER.filter(k => score.byConfidence[k]).map(k => (
            <div key={k} className={`${styles.confidenceCard} ${k === 'Sure but wrong' ? styles.emphasize : ''}`}>
              <div className={styles.confidenceCount}>{score.byConfidence[k]}</div>
              <div className={styles.confidenceLabel}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>Full answer review</h3>
        <p className={styles.hint}>
          {score.total - score.correctCount === 0
            ? 'Every answer was right. 🎉'
            : `${score.total - score.correctCount} missed question${score.total - score.correctCount === 1 ? ' is' : 's are'} highlighted in red.`}
        </p>
        <div className={styles.answerList}>
          {score.results.map((r, i) => (
            <div key={r.question.id} className={`${styles.answerRow} ${r.correct ? '' : styles.wrongRow}`}>
              {!r.correct && (
                <span className={styles.wrongBadge}>{r.answerIndex == null ? '✗ Not answered' : '✗ Wrong'}</span>
              )}
              <p className={styles.answerPrompt}>{i + 1}. {r.question.prompt}</p>
              <Visual visual={r.question.visual} />
              <p className={styles.answerLine}>
                Your answer: <strong className={r.correct ? '' : styles.wrongText}>{r.answerIndex != null ? r.question.choices[r.answerIndex] : '(blank)'}</strong>
                {' · '}Correct answer: <strong>{r.question.choices[r.question.answerIndex]}</strong>
              </p>
              <p className={styles.explanation}>{r.question.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} onClick={onRestart}>Practice again</button>
        <button type="button" className={styles.secondaryBtn} onClick={onViewHistory}>View history</button>
      </div>
    </div>
  )
}
