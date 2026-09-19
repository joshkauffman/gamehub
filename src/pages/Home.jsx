import { Link } from 'react-router-dom'
import styles from './Home.module.css'
import { useSecretUnlock } from './useSecretUnlock.js'

// Hidden until "123secret" is typed anywhere on this page (see
// useSecretUnlock.js) — not part of CATEGORIES so it never renders, isn't
// searchable, and isn't in the normal grid until unlocked.
const SECRET_GAMES = [
  {
    id: 'geometry-rush',
    title: 'Geometry Rush',
    description: 'A neon auto-runner. Tap to jump, hold to fly, tap to flip gravity — portals swap you between cube, ship, and ball modes as the course gets faster.',
    emoji: '🔷',
    path: '/geometry-rush',
  },
  {
    id: 'satisfying-toybox',
    title: 'Satisfying Toybox',
    description: 'No score, no goal — 17 fidget toys including bubble wrap, slime, a turnable 3D Rubik’s Cube, kinetic sand, a lava lamp, an Etch A Sketch, a gear train, a spinning top, and a marble labyrinth.',
    emoji: '🫧',
    path: '/satisfying-toybox',
  },
  {
    id: 'snack-squad',
    title: 'Snack Squad',
    description: "Buy packs of snack-food trading cards, flip through the pull, and stash new finds in your binder. Sell duplicates for coins, or meet a real friend online at the Trading Post to trade cards or fight a turn-based card battle.",
    emoji: '🍪',
    path: '/snack-squad',
  },
]

const CATEGORIES = [
  {
    name: 'Action & Arcade',
    games: [
      {
        id: 'obvious-mario-knockoff',
        title: 'The Obvious Mario Knockoff',
        description: "A mustachioed plumber-guy runs, jumps on grumpy mushroom guys, and grabs a flagpole. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🍄',
        path: '/obvious-mario-knockoff',
      },
      {
        id: 'shirby-and-the-forgotten-place',
        title: 'Shirby and the Forgotten Place',
        description: "A small pink puffball inhales forgotten creatures and copies their powers — Blade, Ember, Frost, Zap, Rock, or Bubble. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🩷',
        path: '/shirby-and-the-forgotten-place',
      },
      {
        id: 'retro-arcade',
        title: 'Retro Arcade',
        description: 'A cabinet of 9 arcade classics reimagined: maze-chase, rock shooter, bug formation dive, speed run, platform brawler, brick-breaker, invasion, road-hopper, and a falling-block puzzle.',
        emoji: '🕹️',
        path: '/retro-arcade',
      },
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
      {
        id: 'lil-monster-battles',
        title: "Lil' Monster Battles",
        description: 'Mix-and-match animal monsters throw down in themed arenas. Solo vs the computer or 2 players on one keyboard.',
        emoji: '🐲',
        path: '/lil-monster-battles',
      },
      {
        id: 'wings-of-fire',
        title: 'Wings of Fire: Talon Clash',
        description: 'Pick a dragon tribe — SkyWing, IceWing, SandWing, SeaWing, MudWing, or RainWing — and fight with claws and a signature breath attack in a free 3D sky arena. Solo vs CPU waves or 2-player duel.',
        emoji: '🐉',
        path: '/wings-of-fire',
      },
      {
        id: 'avatar',
        title: 'Avatar: Elemental Grounds',
        description: 'Pick a bending style — Air, Water, Earth, Fire, or the rarer Lava, Metal, Sand, and Lightning — and roam an open-world proving grounds until you find your opponent, then fight. Solo vs CPU waves or 2-player duel.',
        emoji: '🌏',
        path: '/avatar',
      },
    ],
  },
  {
    name: 'Cards, Puzzles & Party Games',
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
      {
        id: 'intergalactic-poker',
        title: 'Intergalactic Poker',
        description: "Locked in a strange cell after Weirdmageddon, Bill Cipher teaches you his own five-card-draw variant — dimension suits, one wild card, and a dealer who bluffs like it's a sport.",
        emoji: '👁',
        path: '/intergalactic-poker',
      },
      {
        id: 'orbit-maze',
        title: 'Orbit Maze',
        description: "A top-down gravity-maze puzzle — tilt the whole board and let gravity roll the ball through the corridors, past holes both hidden and right on your route, to the goal.",
        emoji: '🔮',
        path: '/orbit-maze',
      },
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
      {
        id: 'ship-captain-crew',
        title: 'Ship Captain Crew',
        description: 'Roll a 6, a 5, then a 4 in order — whatever\'s left in your hand is cargo. Soft watercolor nautical dice game for 1 or 2 players, 3 selectable themes.',
        emoji: '⚓',
        path: '/ship-captain-crew',
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
      {
        id: 'dog-man-dash',
        title: 'Dog Man Dash',
        description: 'Three game modes with Dog Man and the gang: side-scrolling Classic levels, endless-wave Survivor Island, and top-down Tower Defense at H.Q. Unlock 80-HD, Molly, and Petey as you go.',
        emoji: '🐾',
        path: '/dog-man-dash',
      },
      {
        id: 'loot-and-scoot',
        title: 'Loot & Scoot',
        description: 'An open-world 3D heist game. Take jobs from the Fence, sneak past guards to grab the loot, then spend your cash at the Shop on better gear.',
        emoji: '🥷',
        path: '/loot-and-scoot',
      },
      {
        id: 'dungeon-crawler-max',
        title: 'Dungeon Crawler Max',
        description: "A kid-safe game-show dungeon crawl through 18 floors. Bonk monsters, loot chests, cast spells you level up over time, pick a class and race on floor 3, and fight a floor boss all the way to the mysterious Producer, while your hamster sidekick heckles supportively.",
        emoji: '🏰',
        path: '/dungeon-crawler-max',
      },
      {
        id: 'dungeon-crawler-free-roam',
        title: 'Dungeon Crawler Max: Free Roam',
        description: "The game show goes 3D open-world — now with local two-player! Roam a wide-open field with 18 dungeons scattered around, each guarded by its own boss, finding spell scrolls and gear to equip and picking a class and race along the way.",
        emoji: '🗺️',
        path: '/dungeon-crawler-free-roam',
      },
      {
        id: 'hogwarts-spellbound',
        title: 'Hogwarts: Spellbound',
        description: "A three-act crawl through 21 corridors of Hogwarts, solo or local two-player. Duel dangerous creatures and Death Eaters, loot chests, learn real spells like Incendio and Expelliarmus, get Sorted into a House and pick a wand core, then face Lord Voldemort himself.",
        emoji: '🧙',
        path: '/hogwarts-spellbound',
      },
      {
        id: 'x-marks-the-spot',
        title: 'X Marks the Spot',
        description: "A peaceful pirate scavenger hunt — an island, a compass, and a trail of clues leading to buried treasure. Each clue points to the next, and the last one leads straight to gold. The trail reshuffles every time you play.",
        emoji: '🏴‍☠️',
        path: '/x-marks-the-spot',
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

const SUGGESTION_BOX_URL = 'https://claude.ai/code/artifact/5183c891-667a-40dd-be69-644253b10454'

export default function Home() {
  const { unlocked, justUnlocked } = useSecretUnlock()

  return (
    <div className={styles.page}>
      <a
        href={SUGGESTION_BOX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.suggestionBar}
      >
        <span className={styles.suggestionEmoji}>📮</span>
        Found a bug or have an idea? Drop an anonymous suggestion →
      </a>
      <header className={styles.header}>
        <h1>
          <Link to="/kaboom-corral" className={styles.logo}>GameHub</Link>
        </h1>
        <p className={styles.tagline}>Pick a game. Play smart.</p>
      </header>

      <Link to="/school-prep" className={styles.featured}>
        <span className={styles.featuredEmoji}>🎓</span>
        <span className={styles.featuredBody}>
          <span className={styles.featuredTitle}>School Prep</span>
          <span className={styles.featuredDesc}>Timed RWA entrance-exam practice rounds in Math, English &amp; Français — nothing's marked until you submit.</span>
        </span>
        <span className={styles.featuredPlay}>Practice →</span>
      </Link>

      <main className={styles.categories}>
        {CATEGORIES.map(category => (
          <section key={category.name} className={styles.section}>
            <h2 className={styles.sectionTitle}>{category.name}</h2>
            <div className={styles.grid}>
              {category.games.map(game => <GameCard key={game.id} game={game} />)}
            </div>
          </section>
        ))}

        {unlocked && (
          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} ${styles.secretTitle}`}>🔓 Secret</h2>
            <div className={styles.grid}>
              {SECRET_GAMES.map(game => (
                <GameCard key={game.id} game={game} extraClassName={styles.secretCard} />
              ))}
            </div>
          </section>
        )}
      </main>

      {justUnlocked && <div className={styles.secretToast}>🔓 Secret code accepted! New games unlocked below.</div>}
    </div>
  )
}

// External entries (e.g. the Suggestion Box, hosted as a separate artifact)
// need a plain <a>, not a router <Link> — everything else keeps navigating
// internally without a full page reload.
function GameCard({ game, extraClassName }) {
  const className = `${styles.card} ${extraClassName || ''}`
  const content = (
    <>
      <span className={styles.emoji}>{game.emoji}</span>
      <h3 className={styles.cardTitle}>{game.title}</h3>
      <p className={styles.cardDesc}>{game.description}</p>
      <span className={styles.play}>{game.external ? 'Open →' : 'Play →'}</span>
    </>
  )
  if (game.external) {
    return (
      <a href={game.path} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    )
  }
  return (
    <Link to={game.path} className={className}>
      {content}
    </Link>
  )
}
