import styles from './PassagePanel.module.css'

export default function PassagePanel({ passage }) {
  if (!passage) return null
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{passage.title}</h3>
      <p className={styles.text}>{passage.text}</p>
    </div>
  )
}
