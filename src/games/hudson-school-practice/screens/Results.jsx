import styles from './Results.module.css'
import { topicLabel } from '../engine/labels.js'

export default function Results({ score, onRestart, onViewHistory, onViewInsights }) {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Nice work!</h2>
      <div className={styles.scoreCard}>
        <div className={styles.scoreBig}>{score.correctCount} / {score.total}</div>
        <div className={styles.scorePercent}>{score.percent}% correct</div>
        <div className={styles.breakdownRow}>
          <span>✗ {score.wrongCount} wrong</span>
          <span>🤷 {score.idkCount} no idea</span>
        </div>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>By grade level</h3>
        <div className={styles.groupList}>
          {score.byGrade.map(g => (
            <div key={g.key} className={styles.groupRow}>
              <span className={styles.groupName}>Grade {g.key}</span>
              <span className={styles.groupScore}>{g.correct}/{g.total} correct{g.idk > 0 ? ` · ${g.idk} no idea` : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionLabel}>By topic</h3>
        <div className={styles.groupList}>
          {score.byTopic.map(t => (
            <div key={t.key} className={styles.groupRow}>
              <span className={styles.groupName}>{topicLabel(t.key)}</span>
              <span className={styles.groupScore}>{t.correct}/{t.total} correct{t.idk > 0 ? ` · ${t.idk} no idea` : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} onClick={onRestart}>Practice again</button>
        <button type="button" className={styles.secondaryBtn} onClick={onViewInsights}>View insights</button>
        <button type="button" className={styles.secondaryBtn} onClick={onViewHistory}>View history</button>
      </div>
    </div>
  )
}
