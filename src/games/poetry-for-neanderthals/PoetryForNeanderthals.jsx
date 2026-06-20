import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import styles from './PoetryForNeanderthals.module.css'
import { cards } from './cards.js'

const DECKS = [
  { id: 'all', label: 'All Cards' },
  { id: 'base', label: 'Base Game' },
  { id: 'expansion', label: 'Expansion' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(filter) {
  const filtered = filter === 'all' ? cards : cards.filter(c => c.deck === filter)
  return shuffle(filtered)
}

export default function PoetryForNeanderthals() {
  const [deckFilter, setDeckFilter] = useState('all')
  const [deck, setDeck] = useState(() => buildDeck('all'))
  const [index, setIndex] = useState(0)

  const currentCard = deck[index] ?? null
  const remaining = deck.length - index
  const progress = deck.length > 0 ? (index / deck.length) * 100 : 0

  function handleFilterChange(id) {
    setDeckFilter(id)
    setDeck(buildDeck(id))
    setIndex(0)
  }

  function handleNext() {
    if (index < deck.length - 1) setIndex(i => i + 1)
  }

  function handleReshuffle() {
    setDeck(buildDeck(deckFilter))
    setIndex(0)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/" className={styles.backBtn}>
          ← Home
        </Link>
        <span className={styles.counter}>
          {remaining > 0 ? `${remaining} card${remaining !== 1 ? 's' : ''} left` : 'Deck done'}
        </span>
      </div>

      <h1 className={styles.title}>Poetry for Neanderthals</h1>
      <p className={styles.subtitle}>ONE SYLLABLE OR BUST</p>

      <div className={styles.deckFilters}>
        {DECKS.map(d => (
          <button
            key={d.id}
            className={`${styles.filterBtn}${deckFilter === d.id ? ' ' + styles.active : ''}`}
            onClick={() => handleFilterChange(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className={styles.cardArea}>
        {currentCard ? (
          <div className={styles.card}>
            <div className={`${styles.cardSection} ${styles.threePoint}`}>
              <div className={styles.pointBadge}>3</div>
              <div className={styles.word}>{currentCard.threePoint}</div>
            </div>
            <div className={styles.divider} />
            <div className={`${styles.cardSection} ${styles.onePoint}`}>
              <div className={styles.pointBadge}>1</div>
              <div className={styles.word}>{currentCard.onePoint}</div>
            </div>
          </div>
        ) : (
          <div className={`${styles.card} ${styles.emptyState}`}>
            <span className={styles.emptyEmoji}>🦴</span>
            <p className={styles.emptyText}>Deck empty — reshuffle to play again!</p>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={!currentCard || index >= deck.length - 1}
        >
          Next Card →
        </button>
        <button className={styles.reshuffleBtn} onClick={handleReshuffle}>
          Reshuffle Deck
        </button>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
