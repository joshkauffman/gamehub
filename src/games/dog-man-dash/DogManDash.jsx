import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import styles from './DogManDash.module.css'

export default function DogManDash() {
  const iframeRef = useRef(null)

  useEffect(() => {
    const handleKey = e => {
      if (e.key === 'Escape') return
      iframeRef.current?.contentWindow?.focus()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>← GameHub</Link>
      <iframe
        ref={iframeRef}
        src="/games/dog-man-dash/index.html"
        className={styles.frame}
        title="Dog Man Dash"
        allow="autoplay"
      />
    </div>
  )
}
