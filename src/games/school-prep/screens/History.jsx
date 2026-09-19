import styles from './History.module.css'

const SUBJECT_LABEL = { math: 'Math', english: 'English', french: 'Français' }

export default function History({ history, onBack }) {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>History</h2>
      <p className={styles.subtitle}>Saved on this device only — {history.length} round{history.length === 1 ? '' : 's'}.</p>

      {history.length === 0 ? (
        <p className={styles.empty}>No rounds yet.</p>
      ) : (
        <ul className={styles.list}>
          {history.map((entry, i) => (
            <li key={i} className={styles.row}>
              <div>
                <div className={styles.subject}>{SUBJECT_LABEL[entry.subject] || entry.subject}</div>
                <div className={styles.date}>{new Date(entry.date).toLocaleString()}</div>
              </div>
              <div className={styles.score}>{entry.score}/{entry.total} ({entry.percent}%)</div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.backBtn} onClick={onBack}>← Back to setup</button>
    </div>
  )
}
