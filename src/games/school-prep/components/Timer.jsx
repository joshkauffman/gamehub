import styles from './Timer.module.css'

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

export default function Timer({ secondsLeft, visible, low }) {
  if (!visible) return <div className={styles.hidden}>Timer hidden — still running</div>
  return (
    <div className={`${styles.timer} ${low ? styles.low : ''}`}>
      {formatTime(secondsLeft)}
    </div>
  )
}
