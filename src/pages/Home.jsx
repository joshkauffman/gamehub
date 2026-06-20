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
  {
    id: 'dog-man-dash',
    title: 'Dog Man Dash',
    description: 'Side-scrolling chaos with Dog Man and the gang.',
    emoji: '🐾',
    path: '/dog-man-dash',
  },
  {
    id: 'poetry-for-neanderthals',
    title: 'Poetry for Neanderthals',
    description: 'One syllable or bust. Digital card deck for the party game.',
    emoji: '🦴',
    path: '/poetry-for-neanderthals',
  },
  {
    id: 'dice-roller',
    title: 'Dice Roller',
    description: 'Roll any combination of dice. d4 through d100, built for D&D.',
    emoji: '🎲',
    path: '/dice-roller',
  },
  {
    id: 'hangman',
    title: 'Hangman',
    description: 'One player sets the word, the other guesses. Classic.',
    emoji: '🪢',
    path: '/hangman',
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
