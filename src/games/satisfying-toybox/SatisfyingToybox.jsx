import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './SatisfyingToybox.module.css'
import BubbleWrap from './toys/BubbleWrap.jsx'
import Slime from './toys/Slime.jsx'
import Squishy from './toys/Squishy.jsx'
import FidgetSpinner from './toys/FidgetSpinner.jsx'
import SoapCarving from './toys/SoapCarving.jsx'
import KineticSand from './toys/KineticSand.jsx'
import IceCracker from './toys/IceCracker.jsx'
import PinArt from './toys/PinArt.jsx'
import ScratchCard from './toys/ScratchCard.jsx'
import LavaLamp from './toys/LavaLamp.jsx'
import NewtonsCradle from './toys/NewtonsCradle.jsx'
import RubiksCube from './toys/RubiksCube.jsx'
import EtchASketch from './toys/EtchASketch.jsx'
import GearTrain from './toys/GearTrain.jsx'
import SpinningTop from './toys/SpinningTop.jsx'
import MarbleLabyrinth from './toys/MarbleLabyrinth.jsx'
import DominoRally from './toys/DominoRally.jsx'

// ── Satisfying Toybox — a no-score sensory sandbox ──────────────────────
// Seventeen self-contained little toys, each its own component under
// toys/. No win state, no save data — it's a fidget drawer, not a game.
const TOYS = [
  { id: 'bubbles', name: 'Bubble Wrap', emoji: '🫧', Component: BubbleWrap },
  { id: 'slime', name: 'Slime', emoji: '🟢', Component: Slime },
  { id: 'squishy', name: 'Squishy', emoji: '🧸', Component: Squishy },
  { id: 'spinner', name: 'Fidget Spinner', emoji: '🌀', Component: FidgetSpinner },
  { id: 'soap', name: 'Soap Carving', emoji: '🧼', Component: SoapCarving },
  { id: 'sand', name: 'Kinetic Sand', emoji: '🏖️', Component: KineticSand },
  { id: 'ice', name: 'Ice Cracker', emoji: '🧊', Component: IceCracker },
  { id: 'pinart', name: 'Pin Art', emoji: '📌', Component: PinArt },
  { id: 'scratch', name: 'Scratch Card', emoji: '🎫', Component: ScratchCard },
  { id: 'lava', name: 'Lava Lamp', emoji: '🔮', Component: LavaLamp },
  { id: 'cradle', name: "Newton's Cradle", emoji: '🎱', Component: NewtonsCradle },
  { id: 'rubiks', name: "Rubik's Cube", emoji: '🧩', Component: RubiksCube },
  { id: 'etch', name: 'Etch A Sketch', emoji: '✏️', Component: EtchASketch },
  { id: 'gears', name: 'Gear Train', emoji: '⚙️', Component: GearTrain },
  { id: 'top', name: 'Spinning Top', emoji: '🔺', Component: SpinningTop },
  { id: 'labyrinth', name: 'Marble Labyrinth', emoji: '🔵', Component: MarbleLabyrinth },
  { id: 'dominoes', name: 'Domino Rally', emoji: '🟫', Component: DominoRally },
]

export default function SatisfyingToybox() {
  const [active, setActive] = useState(TOYS[0].id)
  const Toy = TOYS.find(t => t.id === active)?.Component

  return (
    <div className={styles.page}>
      <div className={styles.bgFloaters} aria-hidden="true">
        {['🫧', '✨', '🧦', '💫', '🟢', '🎈'].map((e, i) => (
          <span key={i} className={styles.floater} style={{ '--i': i }}>{e}</span>
        ))}
      </div>

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
