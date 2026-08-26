import { Link } from 'react-router-dom'
import styles from './Home.module.css'

const CATEGORIES = [
  {
    name: 'Platformers',
    games: [
      {
        id: 'dog-man-dash',
        title: 'Dog Man Dash',
        description: 'Side-scrolling chaos with Dog Man and the gang.',
        emoji: '🐾',
        path: '/dog-man-dash',
      },
      {
        id: 'obvious-mario-knockoff',
        title: 'The Obvious Mario Knockoff',
        description: "A mustachioed plumber-guy runs, jumps on grumpy mushroom guys, and grabs a flagpole. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🍄',
        path: '/obvious-mario-knockoff',
      },
    ],
  },
  {
    name: 'Arcade',
    games: [
      {
        id: 'snake-clash',
        title: 'Snake Clash',
        description: 'Slither through the ocean, eat fruit, grow massive, and outlast 8 rivals.',
        emoji: '🐍',
        path: '/snake-clash',
      },
      {
        id: 'flappy-goose',
        title: 'Flappy Goose',
        description: 'A goose with a propeller hat. Tap to flap. Try not to honk into a pipe.',
        emoji: '🪿',
        path: '/flappy-goose',
      },
    ],
  },
  {
    name: 'Cards & Strategy',
    games: [
      {
        id: 'ultimate-ttt',
        title: 'Ultimate Tic Tac Toe',
        description: '9 boards in 1. Strategy runs deep.',
        emoji: '⚔️',
        path: '/ultimate-ttt',
      },
      {
        id: 'simpsons-tcg',
        title: 'Simpsons TCG Pocket',
        description: 'Pick a Simpson, build a deck, battle through Springfield.',
        emoji: '🍩',
        path: '/simpsons-tcg',
      },
      {
        id: 'treehouse-tcg',
        title: 'Treehouse of Horror TCG',
        description: 'Battle Kang, Dracula Burns, Zombie Ned, and more Halloween nightmares.',
        emoji: '🎃',
        path: '/treehouse-tcg',
      },
    ],
  },
  {
    name: 'Party & Word Games',
    games: [
      {
        id: 'poetry-for-neanderthals',
        title: 'Poetry for Neanderthals',
        description: 'One syllable or bust. Digital card deck for the party game.',
        emoji: '🦴',
        path: '/poetry-for-neanderthals',
      },
      {
        id: 'hangman',
        title: 'Hangman',
        description: 'One player sets the word, the other guesses. Classic.',
        emoji: '🪢',
        path: '/hangman',
      },
    ],
  },
  {
    name: 'Battle Arenas',
    games: [
      {
        id: 'lil-monster-battles',
        title: "Lil' Monster Battles",
        description: 'Mix-and-match animal monsters throw down in themed arenas. Solo vs the computer or 2 players on one keyboard.',
        emoji: '🐲',
        path: '/lil-monster-battles',
      },
    ],
  },
  {
    name: 'Exploration',
    games: [
      {
        id: 'world3d',
        title: 'Skylight',
        description: 'A dusky first-person world. Gather light to fuel flight, then free the spirits you find to unlock new maps to explore.',
        emoji: '✨',
        path: '/world3d',
      },
    ],
  },
  {
    name: 'Tools & Hangouts',
    games: [
      {
        id: 'dice-roller',
        title: 'Dice Roller',
        description: 'Roll any combination of dice. d4 through d100, built for D&D.',
        emoji: '🎲',
        path: '/dice-roller',
      },
      {
        id: 'chat-lounge',
        title: 'Chat Lounge',
        description: 'Start a private chat and invite people with a short room code, or join one someone shared with you. No accounts, no server — just the room.',
        emoji: '💬',
        path: '/chat-lounge',
      },
    ],
  },
]

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>
          <Link to="/kaboom-corral" className={styles.logo}>GameHub</Link>
        </h1>
        <p className={styles.tagline}>Pick a game. Play smart.</p>
      </header>
      <main className={styles.categories}>
        {CATEGORIES.map(category => (
          <section key={category.name} className={styles.section}>
            <h2 className={styles.sectionTitle}>{category.name}</h2>
            <div className={styles.grid}>
              {category.games.map(game => (
                <Link key={game.id} to={game.path} className={styles.card}>
                  <span className={styles.emoji}>{game.emoji}</span>
                  <h3 className={styles.cardTitle}>{game.title}</h3>
                  <p className={styles.cardDesc}>{game.description}</p>
                  <span className={styles.play}>Play →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
