import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './SatisfyingToybox.module.css'
import BubbleWrap from './toys/BubbleWrap.jsx'
import Slime from './toys/Slime.jsx'
import Squishy from './toys/Squishy.jsx'
import FidgetSpinner from './toys/FidgetSpinner.jsx'
import SoapCarving from './toys/SoapCarving.jsx'

// ── Satisfying Toybox — a no-score sensory sandbox ──────────────────────
// Five self-contained little toys, each its own component under toys/.
// No win state, no save data — it's a fidget drawer, not a game.
const TOYS = [
  { id: 'bubbles', name: 'Bubble Wrap', emoji: '🫧', Component: BubbleWrap },
  { id: 'slime', name: 'Slime', emoji: '🟢', Component: Slime },
  { id: 'squishy', name: 'Squishy', emoji: '🧸', Component: Squishy },
  { id: 'spinner', name: 'Fidget Spinner', emoji: '🌀', Component: FidgetSpinner },
  { id: 'soap', name: 'Soap Carving', emoji: '🧼', Component: SoapCarving },
]

export default function SatisfyingToybox() {
  const [active, setActive] = useState(TOYS[0].id)
  const Toy = TOYS.find(t => t.id === active)?.Component

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>SATISFYING <span className={styles.accent}>TOYBOX</span></h1>
        <p className={styles.tagline}>Pop it, squish it, spin it. No score, no goal — just mess around.</p>
      </header>

      <nav className={styles.tabs}>
        {TOYS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${active === t.id ? styles.tabActive : ''}`}
            onClick={() => setActive(t.id)}
          >
            <span className={styles.tabEmoji}>{t.emoji}</span>
            {t.name}
          </button>
        ))}
      </nav>

      <main className={styles.stageWrap}>
        {Toy && <Toy />}
      </main>

      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}
