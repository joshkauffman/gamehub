import { Link } from 'react-router-dom'
import styles from './Home.module.css'

const GAMES = [
  {
    id: 'ultimate-ttt',
    title: 'Ultimate Tic Tac Toe',
    description: '9 boards in 1. Strategy runs deep.',
    emoji: '⚔️',
    path: '/ultimate-ttt',
  },
]

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.logo}>GameHub</h1>
        <p className={styles.tagline}>Pick a game. Play smart.</p>
      </header>
      <main className={styles.grid}>
        {GAMES.map(game => (
          <Link key={game.id} to={game.path} className={styles.card}>
            <span className={styles.emoji}>{game.emoji}</span>
            <h2 className={styles.cardTitle}>{game.title}</h2>
            <p className={styles.cardDesc}>{game.description}</p>
            <span className={styles.play}>Play →</span>
          </Link>
        ))}
        {Array.from({ length: Math.max(0, 3 - GAMES.length) }).map((_, i) => (
          <div key={i} className={styles.cardPlaceholder}>
            <span className={styles.soon}>Coming Soon</span>
          </div>
        ))}
      </main>
    </div>
  )
}
