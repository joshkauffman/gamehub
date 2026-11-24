import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Home.module.css'
import { useSecretUnlock } from './useSecretUnlock.js'
import { loadStats, summarize, fmtDuration } from '../hub/playStats.js'
import { readShelf } from '../hub/trophies.js'
import { PREVIEW_FRAMES } from '../hub/previews.js'
import { loadProfiles, pkey, setActive, addProfile, editProfile, deleteProfile } from '../hub/profiles.js'
import { loadFavorites, toggleFavorite, loadRatings, rate, forgetProfileRatings, averageOf, loadRateSkips, skipRating, weekIndex, loadVotes, castVote, gameOfWeek, freshness } from '../hub/social.js'
import { TAGS, tagsFor } from '../hub/tags.js'
import { loadSound, saveSound, startMusic, stopMusic, sfx, unlockAudio } from '../hub/sound.js'
import { todaysChallenge, progressOf, completeToday, challengeStreak, secretHint } from '../hub/daily.js'
import { HUB_SECRETS, loadFound, markFound, useTypedSecrets } from '../hub/secrets.js'
import { ProfileChip, ProfilePicker, SurpriseSpin, RatingDialog, StarChip, VoteDialog, DailyCard, Confetti } from '../hub/HubWidgets.jsx'
import extras from '../hub/Extras.module.css'
import CatchGame from '../hub/CatchGame.jsx'
import { loadWallet, earn, earnedToday, buy, equip, spend, ownedAvatars } from '../hub/coins.js'
import { loadBadges, checkBadges, BADGES } from '../hub/badges.js'
import { loadPet, peekPet, petInfo, savePet, feed, TREAT_PRICE } from '../hub/pet.js'
import { PRESETS, DEFAULT_CUSTOM, loadCustom, saveCustom, themeVars } from '../hub/themes.js'
import { specialDay } from '../hub/seasons.js'
import { JOKES, ghostClicks, addGhostClick } from '../hub/ghost.js'
import { loadGallery, deletePhoto } from '../hub/gallery.js'
import { loadMap, saveMap, FIRST_CLUE, PIECES, currentClue } from '../hub/treasureMap.js'
import { loadIdeas, saveIdea, deleteIdea, toggleLike, loadMiniGames, saveMiniGame, deleteMiniGame, recordMiniBest } from '../hub/creations.js'
import { Floaters, SeasonBanner, Ghost, CoinChip, ShopDialog, BadgeBook, PlayerCard, ThemeStudio, PetWidget, PetDialog } from '../hub/Extras.jsx'
import { PhotoStrip, PhotoViewer, MapDialog, IdeaBox, IdeaCard, MakerDialog, MiniGameCard, NEW_MINI } from '../hub/Creations.jsx'

// Hidden until "123secret" is typed anywhere on this page (see
// useSecretUnlock.js) — not part of CATEGORIES so it never renders, isn't
// searchable, and isn't in the normal grid until unlocked.
export const SECRET_GAMES = [
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
  {
    // Not part of the 123secret unlock: dug up by solving the treasure map (src/hub/treasureMap.js).
    id: 'treasure-dig',
    title: 'Treasure Dig',
    description: 'The prize at the end of the secret treasure map. Dig for buried chests on four islands — every hole tells you if you’re getting hotter or colder.',
    emoji: '🏴‍☠️',
    path: '/treasure-dig',
    requires: 'map',
  },
]

export const CATEGORIES = [
  {
    name: 'Knock Offs',
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
        id: 'obvious-metroid-knockoff',
        title: 'The Obvious Metroid Knockoff',
        description: "A bounty hunter in a knockoff power suit drops onto a crumbling alien world, finding upgrades that unlock new ground on the way down to whatever's guarding the reactor core. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🛰️',
        path: '/obvious-metroid-knockoff',
      },
      {
        id: 'obvious-zelda-knockoff',
        title: 'The Obvious Zelda Knockoff',
        description: "Pick your hero — Knight, Rogue, or Pyromancer — then wander a small overworld collecting a completely different arsenal depending on who you chose, on the way to a short dungeon. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🗡️',
        path: '/obvious-zelda-knockoff',
      },
      {
        id: 'obvious-pokemon-knockoff',
        title: 'The Obvious Pokémon Knockoff',
        description: "A suspiciously generous lab hands out starter critters, then it's off to find wild ones in the tall grass, catch them with a Catch Orb, and challenge the Gym Leader. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🔴',
        path: '/obvious-pokemon-knockoff',
      },
      {
        id: 'obvious-sonic-knockoff',
        title: 'The Obvious Sonic Knockoff',
        description: "A blue speedster runs, rolls, and spin-dashes across three short zones, grabbing rings and flattening badniks on the way to a hovering boss pod. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '💨',
        path: '/obvious-sonic-knockoff',
      },
      {
        id: 'obvious-megaman-knockoff',
        title: 'The Obvious Mega Man Knockoff',
        description: 'Pick any Robot Master stage in any order, run and gun to the boss, and steal their signature weapon — which happens to be exactly what the next boss on the list can’t stand. It’s a knockoff. It knows it’s a knockoff. That’s the whole bit.',
        emoji: '🔵',
        path: '/obvious-megaman-knockoff',
      },
      {
        id: 'obvious-pvz-knockoff',
        title: 'The Obvious Plants vs. Zombies Knockoff',
        description: 'Plant Sprout Shooters, Sunblooms, Husk Guards, and more across a 5-row lawn, manage the sun economy, and hold off eight waves of shufflers and bucket heads before they reach the house. It’s a knockoff. It knows it’s a knockoff. That’s the whole bit.',
        emoji: '🌻',
        path: '/obvious-pvz-knockoff',
      },
      {
        id: 'obvious-guitar-hero-knockoff',
        title: 'The Obvious Guitar Hero Knockoff',
        description: 'Five frets, three original synthesized tracks, zero audio files — hit the right key as each note crosses the line to keep your combo alive. It’s a knockoff. It knows it’s a knockoff. That’s the whole bit.',
        emoji: '🎸',
        path: '/obvious-guitar-hero-knockoff',
      },
      {
        id: 'obvious-portal-knockoff',
        title: 'The Obvious Portal Knockoff',
        description: 'Four test chambers, a blue hole and an orange hole in reality, and a Weighted Something-or-Other. Shoot, walk through, keep your momentum. It’s a knockoff. It knows it’s a knockoff. That’s the whole bit.',
        emoji: '🌀',
        path: '/obvious-portal-knockoff',
      },
      {
        id: 'obvious-minecraft-knockoff',
        title: 'The Obvious Minecraft Knockoff',
        description: "A real first-person voxel world. Mine your way from wood to stone to iron to diamond tools, smelt ore at a furnace, build with what you collect, and survive the shamblers that show up after dark. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '⛏️',
        path: '/obvious-minecraft-knockoff',
      },
      {
        id: 'obvious-donkeykong-knockoff',
        title: 'The Obvious Donkey Kong Knockoff',
        description: 'Krunk the ape has snatched Biscuit the dog. Climb the girders, dodge the rolling barrels, grab the hammer, and work up through three single-screen stages to bring Biscuit home. It’s a knockoff. It knows it’s a knockoff. That’s the whole bit.',
        emoji: '🦍',
        path: '/obvious-donkeykong-knockoff',
      },
      {
        id: 'obvious-crossyroad-knockoff',
        title: 'The Obvious Crossy Road Knockoff',
        description: 'Hop a critter forward across an endless, procedurally generated stretch of grass, roads, rivers, and rail crossings. Dodge traffic, ride logs instead of swimming, and don’t dawdle — a hawk gets curious. It’s a knockoff. It knows it’s a knockoff. That’s the whole bit.',
        emoji: '🐔',
        path: '/obvious-crossyroad-knockoff',
      },
      {
        id: 'guugle',
        title: 'Guugle',
        description: "The worst search engine ever. Ask it anything and it confidently answers with the opposite of the truth, with 13 playable doodle games, gaming-site and false-history-site results, and one real link back here hiding in plain sight. It's a knockoff. It knows it's a knockoff. That's the whole bit.",
        emoji: '🔮',
        path: '/guugle',
      },
    ],
  },
  {
    name: 'Action & Arcade',
    games: [
      {
        id: 'capeville',
        title: 'Capeville',
        description: 'Design your own superhero — name, catchphrase, suit colors, emblem, cape, mask, and one real power — then take them out on patrol around an original city to try it for real.',
        emoji: '🦸',
        path: '/capeville',
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
      {
        id: 'dino-suit-up',
        title: 'Dino Suit Up',
        description: "You're a dinosaur roaming an open world. Chop wood, mine stone, and track down bone, iron, crystal, and tech scrap to craft a suit — but each new tier needs its boss defeated first, all the way up to the final Cyborg Suit.",
        emoji: '🦖',
        path: '/dino-suit-up',
      },
      {
        id: 'totally-scary-horror-game',
        title: 'The Totally Scary Horror Game',
        description: "A 3D crawl through a haunted hotel: 50 numbered doors of Floor 1, then an elevator down to Floor 2's basement and mine tunnels for 50 more. Hide, sneak, look (or don't), pick the right door, and spend your tips at Gloria's gift shops. None of the 20 monsters are actually scary, a Monster Journal keeps track of every one you face, the gift shops might be hiding something, the attic (Floor 3) unlocks for 30 tips, and a walkable lobby has achievements, a photo album, costumes, difficulty levels and a speedrun scoreboard — get caught and they just pull up a stool and explain why they really need this job.",
        emoji: '🏨',
        path: '/totally-scary-horror-game',
      },
    ],
  },
  {
    name: 'Cards, Puzzles & Party Games',
    games: [
      {
        id: 'easy-game',
        title: 'Easy Game',
        description: "Click the trophy to win. That's the whole game — except the trophy refuses, and tells you to find other ways. A long list of secret wins is hidden in how you can poke at the page itself. No hints, and no way to tell how many there are.",
        emoji: '🏆',
        path: '/easy-game',
      },
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
        description: "A game-show dungeon crawl through 18 floors. Bonk monsters, loot chests, cast spells you level up over time, pick a class and race on floor 3, and fight a floor boss all the way to the mysterious Producer, while your hamster sidekick heckles supportively.",
        emoji: '🏰',
        path: '/dungeon-crawler-max',
      },
      {
        id: 'dungeon-crawler-free-roam',
        title: 'Dungeon Crawler Max: Free Roam',
        description: "The game show goes 3D open-world — now with local two-player! Each contestant rolls Strength/Dexterity/Intelligence/Constitution/Charisma at creation, wields melee or ranged weapons, and roams a wide-open field finding spell scrolls and gear to equip along the way.",
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
    name: 'Learning',
    games: [
      {
        id: 'hudson-school-practice',
        title: 'Hudson School Practice',
        description: 'Math practice for grades 1–6, made for Hudson. Multiple choice, no timer, and "I have no idea" is always a real answer.',
        emoji: '🧮',
        path: '/hudson-school-practice',
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

// Look for each section: an icon and a hue that tints its cards.
const CATEGORY_STYLE = {
  'Knock Offs': { icon: '🎭', hue: 280 },
  'Action & Arcade': { icon: '🕹️', hue: 340 },
  'Cards, Puzzles & Party Games': { icon: '🃏', hue: 200 },
  'Exploration': { icon: '🧭', hue: 150 },
  'Learning': { icon: '📚', hue: 45 },
  'Tools & Hangouts': { icon: '🛠️', hue: 20 },
  Secret: { icon: '🔓', hue: 50 },
}

// Every card gets its own colour, nudged around its section's hue so a
// section reads as a family but no two neighbours look identical.
function hueFor(game, category) {
  let h = 0
  for (const ch of game.id) h = (h * 31 + ch.charCodeAt(0)) % 997
  const base = CATEGORY_STYLE[category]?.hue ?? 260
  return (base + (h % 150) - 75 + 360) % 360
}

const THEMES = [
  { id: 'midnight', label: '🌙 Midnight' },
  { id: 'daylight', label: '☀️ Daylight' },
  { id: 'arcade', label: '🕹️ Arcade' },
  { id: 'spooky', label: '🎃 Spooky' },
]
const THEME_KEY = 'gamehub-theme'
// Built-in themes, shop themes (PRESETS) or 'custom'. Whether a shop theme
// is still owned is checked against the wallet when it's used.
function loadTheme() {
  try { return localStorage.getItem(pkey(THEME_KEY)) || 'midnight' } catch { return 'midnight' }
}

const RECENT_KEY = 'gamehub-recently-played'
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(pkey(RECENT_KEY))) || [] } catch { return [] }
}
function saveRecent(ids) {
  try { localStorage.setItem(pkey(RECENT_KEY), JSON.stringify(ids)) } catch { /* storage unavailable */ }
}

// Asked "who's playing?" once per browser tab session when there's more than one player.
const PICKED_KEY = 'gamehub-picked-this-session'
function pickedThisSession() {
  try { return sessionStorage.getItem(PICKED_KEY) === '1' } catch { return true }
}
function markPicked() {
  try { sessionStorage.setItem(PICKED_KEY, '1') } catch { /* storage unavailable */ }
}

// Everything below the profile switch re-mounts (key) when the player
// changes, so each piece of per-player state reloads from that player's keys.
export default function Home() {
  const [profiles, setProfiles] = useState(loadProfiles)
  const refresh = useCallback(() => setProfiles(loadProfiles()), [])
  return <HomeForPlayer key={profiles.active} profiles={profiles} refreshProfiles={refresh} />
}

function HomeForPlayer({ profiles, refreshProfiles }) {
  const pid = profiles.active
  const profile = profiles.list.find(p => p.id === pid)
  const profilesById = useMemo(() => Object.fromEntries(profiles.list.map(p => [p.id, p])), [profiles])
  const { unlocked, justUnlocked } = useSecretUnlock()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [tags, setTags] = useState([])
  const [recent, setRecent] = useState(loadRecent)
  const [favorites, setFavorites] = useState(loadFavorites)
  const [ratings, setRatings] = useState(loadRatings)
  const [votes, setVotes] = useState(loadVotes)
  const [sound, setSound] = useState(loadSound)
  const [found, setFound] = useState(() => loadFound())
  const [modal, setModal] = useState(() => (profiles.list.length > 1 && !pickedThisSession() ? { kind: 'profiles' } : null))
  const [toast, setToast] = useState(null)
  const [confetti, setConfetti] = useState(0)
  const [fx, setFx] = useState({ disco: false, gravity: false, flip: false })
  const [wallet, setWallet] = useState(() => loadWallet())
  const [coinBump, setCoinBump] = useState(0)
  const [badges, setBadges] = useState(() => loadBadges())
  const [pet, setPet] = useState(loadPet)
  const [custom, setCustom] = useState(loadCustom)
  const [preview, setPreview] = useState(null) // theme studio's live preview
  const [photos, setPhotos] = useState(loadGallery)
  const [map, setMap] = useState(() => loadMap())
  const [ideas, setIdeas] = useState(loadIdeas)
  const [minis, setMinis] = useState(loadMiniGames)
  const [ghostCount, setGhostCount] = useState(() => ghostClicks())
  const season = useMemo(() => specialDay(profiles), [profiles])
  const searchRef = useRef(null)
  const [theme, setTheme] = useState(loadTheme)
  function pickTheme(t) {
    setTheme(t)
    sfx('click')
    try { localStorage.setItem(pkey(THEME_KEY), t) } catch { /* storage unavailable */ }
  }

  const sections = useMemo(() => {
    const base = CATEGORIES.map(c => ({ name: c.name, games: c.games }))
    const secret = SECRET_GAMES.filter(g => (g.requires === 'map' ? map.solved : unlocked))
    if (secret.length) base.push({ name: 'Secret', games: secret, secret: true })
    return base
  }, [unlocked, map.solved])
  const allGames = useMemo(() => sections.flatMap(sec => sec.games.map(g => ({ ...g, category: sec.name, secret: !!sec.secret }))), [sections])
  const total = CATEGORIES.reduce((n, c) => n + c.games.length, 0)
  const catalog = useMemo(() => Object.fromEntries(allGames.map(g => [g.id, g])), [allGames])
  // Everyday pool for Surprise Me, Game of the Week and the daily challenge: no secret or external games.
  const pool = useMemo(() => allGames.filter(g => !g.secret && !g.external), [allGames])
  const sectionsByName = useMemo(() => Object.fromEntries(sections.map(s => [s.name, s.games])), [sections])
  // Read once per visit to the home page (they only change while you're off playing).
  const statsRaw = useMemo(() => loadStats(), [])
  const stats = useMemo(() => summarize(statsRaw, catalog), [statsRaw, catalog])
  const shelf = useMemo(() => readShelf(catalog), [catalog])

  // ── Toasts + celebrations ──
  // Toasts queue up, so two rewards at once (a trophy and a badge) both get seen.
  const toastQueue = useRef([])
  const toastTimer = useRef(null)
  const nextToast = useCallback(() => {
    const t = toastQueue.current.shift()
    setToast(t || null)
    toastTimer.current = t ? setTimeout(nextToast, toastQueue.current.length ? 2600 : 3800) : null
  }, [])
  const showToast = useCallback((text, kind = 'info') => {
    toastQueue.current.push({ text, kind, id: Date.now() + Math.random() })
    if (!toastTimer.current) nextToast()
  }, [nextToast])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // ── Coins ── pays each reward key once; several at once share one toast.
  const grant = useCallback((list, quiet) => {
    let got = 0
    const why = []
    let w = null
    for (const [key, n, reason] of list) {
      const next = earn(key, n)
      if (next) { w = next; got += n; if (reason) why.push(reason) }
    }
    if (!w) return 0
    setWallet(w)
    setCoinBump(b => b + 1)
    if (!quiet) showToast(`+${got} 🪙${why.length ? ` for ${why.length > 2 ? `${why.slice(0, 2).join(', ')} and more` : why.join(' and ')}` : ''}!`, 'win')
    return got
  }, [showToast])

  // ── Hub secrets ──
  const foundSecret = useCallback((id) => {
    if (!markFound(id)) return
    const f = loadFound()
    setFound(f)
    sfx('secret')
    setConfetti(n => n + 1)
    showToast(`🥚 Hub secret found: ${HUB_SECRETS.find(s => s.id === id).name}! (${Object.keys(f).length}/${HUB_SECRETS.length}) +15 🪙`, 'secret')
    grant([[`secret:${id}`, 15]], true)
  }, [showToast, grant])
  useEffect(() => { if (justUnlocked) { setQuery(''); foundSecret('123secret') } }, [justUnlocked, foundSecret])
  // Unlocked before secrets were counted: credit it, but not as "found today".
  useEffect(() => { if (unlocked && !loadFound()['123secret']) { markFound('123secret', '0000-00-00'); setFound(loadFound()) } }, [unlocked])

  const fallTimer = useRef(null)
  useTypedSecrets(useCallback((id) => {
    if (id === 'konami') { setModal({ kind: 'catcher' }); foundSecret('konami') }
    if (id === 'gravity') { dropEverything(); setFx(f => ({ ...f, gravity: true })); sfx('boom'); foundSecret('gravity') }
    if (id === 'flip') {
      setFx(f => ({ ...f, flip: true }))
      clearTimeout(fallTimer.current)
      fallTimer.current = setTimeout(() => setFx(f => ({ ...f, flip: false })), 6000)
      foundSecret('flip')
    }
  }, [foundSecret]))
  useEffect(() => () => clearTimeout(fallTimer.current), [])

  const chipClicks = useRef({ n: 0, at: 0 })
  function clickGamesChip() {
    const now = Date.now()
    const c = chipClicks.current
    c.n = now - c.at < 1500 ? c.n + 1 : 1
    c.at = now
    sfx('tick')
    if (c.n >= 10) {
      c.n = 0
      setFx(f => ({ ...f, disco: !f.disco }))
      foundSecret('disco')
    }
  }

  // ── Sound ──
  function changeSound(next) {
    unlockAudio()
    setSound(next)
    saveSound(next)
  }
  useEffect(() => {
    if (!sound.music) { stopMusic(); return }
    startMusic(theme, fx.disco ? 1.5 : 1)
    return () => stopMusic()
  }, [sound.music, theme, fx.disco])
  useEffect(() => {
    // Saved "music on" from last time can't start until the first click on the page.
    const onFirst = () => { unlockAudio(); window.removeEventListener('pointerdown', onFirst) }
    window.addEventListener('pointerdown', onFirst)
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [])

  // ── Daily challenge ──
  const [daily, setDaily] = useState(() => todaysChallenge(pid, pool, sections.filter(sec => !sec.secret)))
  const [dailyPop, setDailyPop] = useState(false)
  const progress = useMemo(
    () => progressOf(daily.today, pid, sectionsByName),
    [daily, pid, sectionsByName, ratings, favorites, found], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => {
    if (!progress.done || daily.today.done) return
    const next = completeToday()
    if (!next) return
    setDaily(next)
    setDailyPop(true)
    setConfetti(n => n + 1)
    sfx('win')
    showToast('🧩 Daily challenge complete! ⭐ +10 🪙', 'win')
    grant([[`daily:${next.today.date}`, 10]], true)
  }, [progress.done, daily.today.done, showToast, grant])
  const dailyStreak = useMemo(() => challengeStreak(daily.doneDays || []), [daily])
  const dailyGame = daily.today.ch.game && catalog[daily.today.ch.game]

  // ── Rate the game you just came back from ──
  useEffect(() => {
    if (modal) return
    const [id, g] = Object.entries(statsRaw.games).sort((a, b) => b[1].last - a[1].last)[0] || []
    if (!id || !catalog[id] || Date.now() - g.last > 3 * 3600 * 1000 || g.seconds < 30) return
    if (loadRatings()[id]?.[pid] || loadRateSkips().includes(id)) return
    setModal({ kind: 'rate', game: catalog[id], afterPlay: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  function saveRating(game, stars, note) {
    setRatings(rate(game.id, pid, stars, note))
    setModal(null)
    sfx('win')
    if (!grant([[`rate:${game.id}`, 2, 'rating a game']])) showToast(`${'⭐'.repeat(stars)} saved for ${game.title}`)
  }

  // ── Game of the week ──
  const week = weekIndex()
  const gotw = useMemo(() => gameOfWeek(pool, week), [pool, week, votes]) // eslint-disable-line react-hooks/exhaustive-deps
  function vote(gameId) { setVotes(castVote(week + 1, pid, gameId)) }

  // ── Trophy + birthday coins (checked each visit) ──
  useEffect(() => {
    const pay = { bronze: 5, silver: 10, gold: 20 }
    const list = shelf.map(t => [`trophy:${t.id}:${t.medal}`, pay[t.medal], `a ${t.medal} trophy`])
    if (season?.birthday) list.push([`birthday:${new Date().getFullYear()}`, 25, 'your birthday 🎂'])
    grant(list)
    if (season?.birthday) setConfetti(n => n + 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The pet ──
  const petNow = useMemo(() => petInfo(pet), [pet])
  function feedPet() {
    const w = spend(TREAT_PRICE)
    if (!w) return
    setWallet(w)
    setPet(feed(pet))
    sfx('heart')
  }

  // ── Badges ── re-checked whenever something they look at changes.
  const myPhotos = photos.filter(p => p.by === pid).length
  const badgeCtx = {
    stats,
    dailyDone: (daily.doneDays || []).length,
    secrets: HUB_SECRETS.filter(x => found[x.id]).length,
    secretsTotal: HUB_SECRETS.length,
    rated: Object.values(ratings).filter(r => r[pid]).length,
    favs: favorites.length,
    golds: shelf.filter(t => t.medal === 'gold').length,
    trophies: shelf.length,
    coinsTotal: wallet.total,
    owned: wallet.owned.length,
    petStage: petNow.stage,
    photos: myPhotos,
    ideas: ideas.filter(i => i.by === pid).length,
    made: minis.filter(m => m.by === pid).length,
    customTheme: !!custom,
    mapSolved: map.solved,
    ghostClicks: ghostCount,
    birthdayToday: !!season?.birthday,
  }
  const badgeSig = JSON.stringify(badgeCtx)
  useEffect(() => {
    const fresh = checkBadges(badgeCtx)
    if (!fresh.length) return
    setBadges(loadBadges())
    sfx('secret')
    setConfetti(n => n + 1)
    grant(fresh.map(b => [`badge:${b.id}`, 10]), true)
    showToast(`🏅 New badge${fresh.length > 1 ? 's' : ''}: ${fresh.map(b => `${b.icon} ${b.name}`).join(', ')} · +${fresh.length * 10} 🪙`, 'secret')
  }, [badgeSig]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The ghost ── first click starts the treasure map; after that a joke, a hint or a coin.
  function ghostMessage() {
    setGhostCount(addGhostClick())
    if (!map.started) {
      const m = { ...map, started: true }
      saveMap(m)
      setMap(m)
      return `Psst! I dropped my treasure map and the pieces blew into the games! 🗺️ ${FIRST_CLUE}`
    }
    const r = Math.random()
    if (r < 0.25 && earnedToday('ghost:') < 5) {
      const n = 1 + Math.floor(Math.random() * 3)
      grant([[`ghost:${Date.now()}`, n]], true)
      return `Here, have ${n} 🪙! Shhh, don’t tell anyone. 🤫`
    }
    if (r < 0.55) {
      const hints = []
      if (map.found < PIECES.length) hints.push(`About my map… ${currentClue(map)}`)
      const unfound = HUB_SECRETS.filter(x => !found[x.id])
      if (unfound.length) hints.push(`Want a secret? ${unfound[Math.floor(Math.random() * unfound.length)].hint}`)
      if (!daily.today.done) hints.push(`Have you done today’s challenge? “${daily.today.ch.text}”`)
      if (petNow.mood === 'sleepy') hints.push('Your pet looks sleepy… play a game to wake it up!')
      if (hints.length) return hints[Math.floor(Math.random() * hints.length)]
    }
    return JOKES[Math.floor(Math.random() * JOKES.length)]
  }
  function solveMap() {
    const m = { ...map, solved: true }
    saveMap(m)
    setMap(m)
    sfx('secret')
    setConfetti(n => n + 1)
    grant([['map:solved', 50]], true)
    showToast('🏴‍☠️ You found the treasure! Treasure Dig is unlocked in the Secret section. +50 🪙', 'secret')
  }

  // ── Themes ── built-in ids style themselves in CSS; shop presets and the
  // custom theme come from a config and are applied as inline variables.
  const ownedThemes = Object.keys(PRESETS).filter(id => wallet.owned.includes(`theme:${id}`))
  const themeOk = THEMES.some(t => t.id === theme) || ownedThemes.includes(theme) || (theme === 'custom' && custom)
  const themeId = preview ? 'custom' : themeOk ? theme : 'midnight'
  const themeCfg = preview || (themeId === 'custom' ? custom : PRESETS[themeId]) || null

  // ── Profiles ──
  function pickProfile(id) {
    markPicked()
    sfx('click')
    setModal(null)
    if (id !== pid) { setActive(id); refreshProfiles() }
  }

  // Starting a search (or picking a category) jumps back up so results aren't hidden under the sticky bar.
  const filtering = query.trim() !== '' || tags.length > 0
  useEffect(() => {
    if (window.scrollY > 300) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [filtering, filter])

  // "/" jumps to search, Escape clears it.
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement !== searchRef.current && !modal) { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) { setQuery(''); searchRef.current.blur() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  function played(game) {
    const next = [game.id, ...recent.filter(id => id !== game.id)].slice(0, 6)
    setRecent(next)
    saveRecent(next)
    sfx('click')
  }
  function fav(game) {
    const next = toggleFavorite(game.id)
    setFavorites(next)
    sfx(next.includes(game.id) ? 'heart' : 'unheart')
  }
  function toggleTag(id) {
    sfx('click')
    setTags(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]))
  }

  const q = query.trim().toLowerCase()
  const results = filtering
    ? allGames.filter(g =>
      (!q || `${g.title} ${g.description} ${g.category}`.toLowerCase().includes(q)) &&
      tags.every(t => (t === 'new' ? !!freshness(g) : tagsFor(g.id).includes(t))))
    : null
  const recentGames = recent.map(id => catalog[id]).filter(Boolean).slice(0, 4)
  const favGames = favorites.map(id => catalog[id]).filter(Boolean)
  const shownSections = sections.filter(sec => filter === 'All' || sec.name === filter)
  const familyPicks = Object.entries(ratings)
    .filter(([id, r]) => catalog[id] && Object.keys(r).some(p => profilesById[p]))
    .map(([id, r]) => {
      const mine = Object.fromEntries(Object.entries(r).filter(([p]) => profilesById[p]))
      const latest = Object.entries(mine).filter(([, x]) => x.note).sort((a, b) => b[1].at - a[1].at)[0]
      return { game: catalog[id], avg: averageOf(mine), n: Object.keys(mine).length, raters: Object.keys(mine), latest }
    })
    .sort((a, b) => b.avg - a.avg || b.n - a.n)
    .slice(0, 8)
  const hint = daily.today.ch.type === 'secret' && !found[daily.today.ch.secret] ? secretHint(daily.today.ch.secret) : null
  const foundCount = HUB_SECRETS.filter(s => found[s.id]).length

  const cardProps = (game) => ({
    game,
    onPlay: played,
    fav: favorites.includes(game.id),
    onFav: fav,
    rating: ratings[game.id],
    onRate: () => setModal({ kind: 'rate', game }),
    fresh: freshness(game),
    frame: wallet.frame ? extras['frame_' + wallet.frame.split(':')[1]] : '',
  })

  const pageClass = [styles.page, fx.disco && styles.disco, fx.gravity && styles.gravity, fx.flip && styles.flip].filter(Boolean).join(' ')

  return (
    <div className={pageClass} data-theme={themeCfg ? 'custom' : themeId} data-pattern={themeCfg?.pattern} style={themeCfg ? themeVars(themeCfg) : undefined}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.blobA} />
        <span className={styles.blobB} />
        <span className={styles.blobC} />
        <span className={styles.bats}>
          {[0, 1, 2, 3].map(k => <span key={k} className={styles.bat} style={{ top: `${12 + k * 21}%`, animationDelay: `${-k * 4.7}s`, animationDuration: `${16 + k * 3}s` }}>🦇</span>)}
        </span>
        {themeCfg?.floaters?.length > 0 && <Floaters items={themeCfg.floaters} mode="fly" count={6} />}
        {season && <Floaters items={season.floaters} mode={season.mode} count={10} />}
        {fx.disco && <span className={styles.discoLights} />}
      </div>

      <a href={SUGGESTION_BOX_URL} target="_blank" rel="noopener noreferrer" className={styles.suggestionBar}>
        <span className={styles.suggestionEmoji}>📮</span>
        Found a bug or have an idea? Drop an anonymous suggestion →
      </a>

      <header className={styles.header}>
        {fx.disco && <div className={styles.discoBall} aria-hidden="true">🪩</div>}
        <h1>
          <Link to="/kaboom-corral" className={styles.logo} onClick={() => foundSecret('logo')}>GameHub</Link>
        </h1>
        <p className={styles.tagline}>Pick a game. Play smart.</p>
        {season?.banner && <SeasonBanner text={season.banner} birthday={season.id === 'birthday'} />}
        <div className={styles.stats}>
          <button className={styles.statChip} onClick={clickGamesChip}>🎮 {total} games</button>
          <span>🗂️ {CATEGORIES.length} categories</span>
          <span>🆓 no accounts, no ads</span>
        </div>
        <div className={styles.actions}>
          <ProfileChip profile={profile} onClick={() => { sfx('click'); setModal({ kind: 'card', pid }) }} />
          <CoinChip key={coinBump} balance={wallet.balance} bump={coinBump > 0} onClick={() => { sfx('click'); setModal({ kind: 'shop' }) }} />
          <button className={styles.surpriseBtn} onClick={() => { unlockAudio(); setModal({ kind: 'surprise' }) }}>🎲 Surprise me!</button>
        </div>
        <div className={styles.actions} style={{ marginTop: '0.6rem' }}>
          <button className={styles.iconBtn + ' ' + styles.iconOn} onClick={() => { sfx('click'); setModal({ kind: 'badges' }) }}>🏅<span className={styles.iconLabel}>Badges {Object.keys(badges).length}/{BADGES.length}</span></button>
          <button className={styles.iconBtn + ' ' + styles.iconOn} onClick={() => { sfx('click'); setModal({ kind: 'shop' }) }}>🛍️<span className={styles.iconLabel}>Shop</span></button>
          {map.started && <button className={styles.iconBtn + ' ' + styles.iconOn} onClick={() => { sfx('click'); setModal({ kind: 'map' }) }}>🗺️<span className={styles.iconLabel}>Map {map.solved ? '✓' : `${map.found}/${PIECES.length}`}</span></button>}
          <button className={`${styles.iconBtn} ${sound.music ? styles.iconOn : ''}`} onClick={() => changeSound({ ...sound, music: !sound.music })} aria-pressed={sound.music} title={sound.music ? 'Turn music off' : 'Turn music on'}>
            🎵<span className={styles.iconLabel}>{sound.music ? 'Music on' : 'Music off'}</span>
          </button>
          <button className={`${styles.iconBtn} ${sound.sfx ? styles.iconOn : ''}`} onClick={() => changeSound({ ...sound, sfx: !sound.sfx })} aria-pressed={sound.sfx} title={sound.sfx ? 'Mute click sounds' : 'Turn click sounds on'}>
            {sound.sfx ? '🔊' : '🔇'}<span className={styles.iconLabel}>Sounds</span>
          </button>
        </div>
        <div className={styles.themes} role="radiogroup" aria-label="Theme">
          {[...THEMES, ...ownedThemes.map(id => ({ id, label: PRESETS[id].name })), ...(custom ? [{ id: 'custom', label: custom.name || '🎨 Mine' }] : [])].map(t => (
            <button key={t.id} role="radio" aria-checked={themeId === t.id} className={`${styles.themeBtn} ${themeId === t.id ? styles.themeOn : ''}`} onClick={() => pickTheme(t.id)}>
              {t.label}
            </button>
          ))}
          <button className={styles.themeBtn} onClick={() => { sfx('click'); setPreview(custom || DEFAULT_CUSTOM); setModal({ kind: 'studio' }) }} title="Make your own theme">✏️ Make one</button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search games…"
            aria-label="Search games"
          />
          {query ? <button className={styles.clear} onClick={() => setQuery('')} aria-label="Clear search">✕</button> : <kbd className={styles.kbd}>/</kbd>}
        </label>
        {!filtering && (
          <div className={styles.pills}>
            {['All', ...sections.map(sec => sec.name)].map(name => (
              <button
                key={name}
                className={`${styles.pill} ${filter === name ? styles.pillOn : ''}`}
                style={{ '--h': CATEGORY_STYLE[name]?.hue ?? 255 }}
                onClick={() => { sfx('click'); setFilter(name) }}
              >
                {name === 'All' ? '✨ All' : `${CATEGORY_STYLE[name]?.icon ?? '🎮'} ${name}`}
              </button>
            ))}
          </div>
        )}
        <div className={styles.tagRow}>
          {TAGS.map(t => (
            <button key={t.id} className={`${styles.tagChip} ${tags.includes(t.id) ? styles.tagOn : ''}`} style={{ '--h': t.hue }} onClick={() => toggleTag(t.id)} aria-pressed={tags.includes(t.id)}>
              {t.label}
            </button>
          ))}
          {tags.length > 0 && <button className={styles.tagClear} onClick={() => setTags([])}>✕ clear</button>}
        </div>
      </div>

      <main className={styles.main}>
        {fx.gravity && (
          <button className={styles.putBack} onClick={() => { setFx(f => ({ ...f, gravity: false })); sfx('win') }}>🪂 Put everything back</button>
        )}
        {results ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span>
                {q ? `🔍 ${results.length} result${results.length === 1 ? '' : 's'} for “${query.trim()}”` : `🏷️ ${results.length} game${results.length === 1 ? '' : 's'}`}
                {tags.length > 0 && q ? ' with those tags' : ''}
              </span>
            </h2>
            {results.length ? (
              <div className={styles.grid}>
                {results.map(game => <GameCard key={game.id} {...cardProps(game)} />)}
              </div>
            ) : (
              <div className={styles.empty}>
                <span>🤷</span>
                <p>No games match that. Try a different word, or fewer tags?</p>
              </div>
            )}
          </section>
        ) : (
          <>
            {filter === 'All' && (
              <DailyCard today={daily.today} progress={progress} streak={dailyStreak} hint={hint} gameLink={dailyGame} celebrate={dailyPop} />
            )}

            {filter === 'All' && gotw.game && (
              <div className={styles.gotw} style={{ '--h': hueFor(gotw.game, gotw.game.category) }} data-fall>
                <Link to={gotw.game.path} className={styles.gotwMain} onClick={() => played(gotw.game)}>
                  <span className={styles.featuredBadge}>🏅 Game of the Week{gotw.votes ? ` · ${gotw.votes} vote${gotw.votes > 1 ? 's' : ''}` : ''}</span>
                  <span className={styles.gotwEmoji}>{gotw.game.emoji}</span>
                  <span className={styles.featuredBody}>
                    <span className={styles.featuredTitle}>{gotw.game.title}</span>
                    <span className={styles.featuredDesc}>{gotw.game.description}</span>
                  </span>
                  <span className={styles.featuredPlay}>▶ Play</span>
                </Link>
                <button className={styles.voteBtn} onClick={() => { sfx('click'); setModal({ kind: 'vote' }) }}>
                  🗳️ Vote for next week{votes[week + 1]?.[pid] && catalog[votes[week + 1][pid]] ? ` (you picked ${catalog[votes[week + 1][pid]].emoji})` : ''}
                </button>
              </div>
            )}

            {filter === 'All' && (
              <Link to="/school-prep" className={styles.featured} data-fall>
                <span className={styles.featuredBadge}>⭐ Featured</span>
                <span className={styles.featuredEmoji}>🎓</span>
                <span className={styles.featuredBody}>
                  <span className={styles.featuredTitle}>School Prep</span>
                  <span className={styles.featuredDesc}>Timed RWA entrance-exam practice rounds in Math, English &amp; Français — nothing's marked until you submit.</span>
                </span>
                <span className={styles.featuredPlay}>Practice →</span>
              </Link>
            )}

            {filter === 'All' && favGames.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>❤️ {profile.name}’s Favorites</span><span className={styles.count}>{favGames.length}</span></h2>
                <div className={styles.recentRow}>
                  {favGames.map(game => <MiniTile key={game.id} game={game} onPlay={played} />)}
                </div>
              </section>
            )}

            {filter === 'All' && recentGames.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>⏱️ Jump back in</span></h2>
                <div className={styles.recentRow}>
                  {recentGames.map(game => <MiniTile key={game.id} game={game} onPlay={played} />)}
                </div>
              </section>
            )}

            {filter === 'All' && familyPicks.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>⭐ Family Picks</span><span className={styles.count}>{familyPicks.length}</span></h2>
                <div className={styles.picks}>
                  {familyPicks.map(({ game, avg, n, raters, latest }) => (
                    <Link key={game.id} to={game.path} className={styles.pick} style={{ '--h': hueFor(game, game.category) }} onClick={() => played(game)} data-fall>
                      <span className={styles.pickTop}>
                        <span className={styles.recentEmoji}>{game.emoji}</span>
                        <span className={styles.pickStars}>{'★'.repeat(Math.round(avg))}<span>{'★'.repeat(5 - Math.round(avg))}</span></span>
                      </span>
                      <span className={styles.recentTitle}>{game.title}</span>
                      <span className={styles.pickWho}>{raters.map(r => profilesById[r]?.avatar).join(' ')} · {avg.toFixed(1)} from {n}</span>
                      {latest && <span className={styles.pickQuote}>“{latest[1].note}” — {profilesById[latest[0]]?.name}</span>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {filter === 'All' && photos.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>📸 Photo Gallery</span><span className={styles.count}>{photos.length}</span></h2>
                <PhotoStrip photos={photos} catalog={catalog} profilesById={profilesById} onOpen={i => setModal({ kind: 'photo', index: i })} />
              </section>
            )}

            {filter === 'All' && stats.plays > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>📊 {profile.name}’s Stats</span></h2>
                <div className={styles.statTiles}>
                  <StatTile icon="🎮" value={stats.plays} label={stats.plays === 1 ? 'game played' : 'games played'} />
                  <StatTile icon="🧭" value={`${stats.tried}/${total}`} label="games tried" />
                  <StatTile icon="⏱️" value={fmtDuration(stats.seconds)} label="time played" />
                  <StatTile icon="🔥" value={stats.current} label={`day streak · best ${stats.best}`} />
                  {stats.favorite && catalog[stats.favorite.id] && (
                    <StatTile icon={catalog[stats.favorite.id].emoji} value={<span className={styles.statFav}>{catalog[stats.favorite.id].title}</span>} label={`most played · ${fmtDuration(stats.favorite.seconds)}`} />
                  )}
                </div>
              </section>
            )}

            {filter === 'All' && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <span>🏆 Trophy Shelf</span>
                  {shelf.length > 0 && <span className={styles.count}>{shelf.length}</span>}
                </h2>
                {shelf.length ? (
                  <div className={styles.shelfWrap}>
                    <div className={styles.shelf}>
                      {shelf.map(t => (
                        <Link key={t.id} to={t.game.path} className={styles.trophy} style={{ '--h': hueFor(t.game, t.game.category) }} onClick={() => played(t.game)} data-fall>
                          <span className={styles.trophyTop}>
                            <span className={styles.trophyEmoji}>{t.game.emoji}</span>
                            <span className={styles.trophyMedal}>{{ gold: '🥇', silver: '🥈', bronze: '🥉' }[t.medal]}</span>
                          </span>
                          <span className={styles.trophyName}>{t.game.title}</span>
                          {t.stats.map(st => <span key={st} className={styles.trophyStat}>{st}</span>)}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className={styles.shelfEmpty}>Your best scores and achievements from every game will collect here. Go set some records! 🏅</p>
                )}
              </section>
            )}

            {filter === 'All' && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>🛠️ Made by Us</span>{minis.length > 0 && <span className={styles.count}>{minis.length}</span>}</h2>
                <div className={extras.minis}>
                  {minis.map(g => (
                    <MiniGameCard key={g.id} game={g} profilesById={profilesById} myId={pid}
                      onPlay={game => { sfx('click'); setModal({ kind: 'play', game }) }}
                      onEdit={game => setModal({ kind: 'maker', initial: game })}
                      onDelete={id => setMinis(deleteMiniGame(id))} />
                  ))}
                  <button className={extras.newIdea} onClick={() => { sfx('click'); setModal({ kind: 'maker', initial: NEW_MINI }) }}><span>🛠️</span>Make your own game!</button>
                </div>
              </section>
            )}

            {filter === 'All' && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}><span>🧪 Coming Soon… maybe!</span>{ideas.length > 0 && <span className={styles.count}>{ideas.length}</span>}</h2>
                <div className={extras.ideas}>
                  {ideas.map(i => (
                    <IdeaCard key={i.id} idea={i} profilesById={profilesById} myId={pid}
                      onLike={id => { sfx('heart'); setIdeas(toggleLike(id, pid)) }}
                      onDelete={id => setIdeas(deleteIdea(id))} />
                  ))}
                  <button className={extras.newIdea} onClick={() => { sfx('click'); setModal({ kind: 'idea' }) }}><span>💡</span>Got an idea for a game?</button>
                </div>
              </section>
            )}

            {shownSections.map(sec => (
              <section key={sec.name} className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${sec.secret ? styles.secretTitle : ''}`}>
                  <span>{CATEGORY_STYLE[sec.name]?.icon} {sec.name}</span>
                  <span className={styles.count}>{sec.games.length}</span>
                </h2>
                <div className={styles.grid}>
                  {sec.games.map(game => (
                    <GameCard key={game.id} {...cardProps({ ...game, category: sec.name, secret: !!sec.secret })} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      <footer className={styles.footer}>
        Made for family &amp; friends · press <kbd className={styles.kbd}>/</kbd> to search
        <div className={styles.eggs} title="Hub secrets found by this player">
          🥚 {foundCount}/{HUB_SECRETS.length} hub secrets found{foundCount === HUB_SECRETS.length ? ' — all of them! 🎉' : ''}
        </div>
      </footer>

      {justUnlocked && <div className={styles.secretToast}>🔓 Secret code accepted! New games unlocked below.</div>}
      {toast && !justUnlocked && <div key={toast.id} className={`${styles.secretToast} ${styles['toast_' + toast.kind] || ''}`}>{toast.text}</div>}
      <Confetti burst={confetti} />

      {modal?.kind === 'profiles' && (
        <ProfilePicker
          profiles={profiles}
          extraAvatars={ownedAvatars(wallet)}
          onCard={id => setModal({ kind: 'card', pid: id })}
          onPick={pickProfile}
          onAdd={(name, avatar) => { addProfile(name, avatar); markPicked(); refreshProfiles() }}
          onEdit={(id, changes) => { editProfile(id, changes); refreshProfiles() }}
          onDelete={(id) => { deleteProfile(id); forgetProfileRatings(id); refreshProfiles() }}
          onClose={() => { markPicked(); setModal(null) }}
        />
      )}
      {modal?.kind === 'surprise' && <SurpriseSpin games={pool} onClose={() => setModal(null)} onPlay={played} />}
      {modal?.kind === 'rate' && (
        <RatingDialog
          game={modal.game}
          profile={profile}
          existing={ratings[modal.game.id]?.[pid]}
          family={ratings[modal.game.id]}
          profilesById={profilesById}
          afterPlay={modal.afterPlay}
          onSave={(stars, note) => saveRating(modal.game, stars, note)}
          onSkip={() => { skipRating(modal.game.id); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'vote' && (
        <VoteDialog games={pool} votesNext={votes[week + 1]} profile={profile} profilesById={profilesById} onVote={vote} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'catcher' && (
        <CatcherModal emojis={pool.map(g => g.emoji)} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'shop' && (
        <ShopDialog
          wallet={wallet}
          onBuy={item => { const w = buy(item); if (w) { setWallet(w); sfx('win'); setConfetti(n => n + 1); showToast(`🛍️ You got the ${item.name}!`, 'win') } }}
          onEquip={(field, id) => { setWallet(equip(field, id)); sfx('click') }}
          onUseTheme={id => { pickTheme(id); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'badges' && <BadgeBook earned={badges} onClose={() => setModal(null)} />}
      {modal?.kind === 'card' && (() => {
        const who = profilesById[modal.pid] || profile
        const me = who.id === pid
        const s2 = me ? stats : summarize(loadStats(who.id), catalog)
        const fav = s2.favorite && catalog[s2.favorite.id]
        const otherPet = me ? pet : peekPet(who.id)
        return (
          <PlayerCard
            key={who.id}
            profile={who}
            isMe={me}
            wallet={me ? wallet : loadWallet(who.id)}
            badges={me ? badges : loadBadges(who.id)}
            stats={{ plays: s2.plays, tried: s2.tried, time: fmtDuration(s2.seconds) }}
            favorite={fav}
            topTrophies={shelf.slice(0, 5)}
            pet={otherPet ? (me ? petNow : petInfo(otherPet, who.id)) : null}
            onSave={changes => { editProfile(who.id, changes); refreshProfiles() }}
            onSwitch={() => setModal({ kind: 'profiles' })}
            onClose={() => setModal(null)}
          />
        )
      })()}
      {modal?.kind === 'studio' && (
        <ThemeStudio
          initial={preview || custom || DEFAULT_CUSTOM}
          onPreview={setPreview}
          onSave={cfg => { saveCustom(cfg); setCustom(cfg); setPreview(null); pickTheme('custom'); setModal(null); showToast('🎨 Your theme is saved! Find it with the other themes.', 'win') }}
          onCancel={() => { setPreview(null); setModal(null) }}
        />
      )}
      {modal?.kind === 'pet' && (
        <PetDialog pet={pet} info={petNow} hat={wallet.petHat?.slice(4)} wallet={wallet} onFeed={feedPet}
          onRename={name => { const p2 = { ...pet, name }; savePet(p2); setPet(p2) }}
          onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'photo' && (
        <PhotoViewer photos={photos} index={modal.index} catalog={catalog} profilesById={profilesById}
          onDelete={id => { const next = deletePhoto(id); setPhotos(next); if (!next.length) setModal(null) }}
          onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'map' && <MapDialog map={map} onSolve={solveMap} onClose={() => setModal(null)} />}
      {modal?.kind === 'idea' && (
        <IdeaBox profile={profile} onClose={() => setModal(null)}
          onSave={idea => { setIdeas(saveIdea(idea)); setModal(null); sfx('win'); setConfetti(n => n + 1); showToast(`💡 “${idea.name}” is on the Coming Soon shelf!`, 'win') }} />
      )}
      {modal?.kind === 'maker' && (
        <MakerDialog initial={modal.initial} profile={profile} onClose={() => setModal(null)}
          onTry={game => setModal({ kind: 'play', game, back: game })}
          onSave={game => { setMinis(saveMiniGame(game)); setModal(null); sfx('win'); setConfetti(n => n + 1); showToast(`🛠️ “${game.name}” is saved in Made by Us!`, 'win') }} />
      )}
      {modal?.kind === 'play' && (
        <CatchGame
          cfg={modal.game}
          best={modal.game.best?.[pid] || 0}
          onScore={score => { if (modal.game.id && !modal.back) setMinis(recordMiniBest(modal.game.id, pid, score)) }}
          onClose={() => setModal(modal.back ? { kind: 'maker', initial: modal.back } : null)}
        />
      )}

      <PetWidget info={petNow} hat={wallet.petHat?.slice(4)} onOpen={() => setModal({ kind: 'pet' })} />
      <Ghost getMessage={ghostMessage} often={themeId === 'spooky' || season?.id === 'halloween' || season?.id === 'october'} />
    </div>
  )
}

// Gravity secret: work out how far each tile has to fall to land at the
// bottom of the screen, and stash it in CSS variables for the .gravity rule.
// (Tiles already below the screen just drop a little — nobody sees them.)
function dropEverything() {
  const floor = window.innerHeight
  document.querySelectorAll('[data-fall]').forEach(el => {
    const r = el.getBoundingClientRect()
    el.style.setProperty('--fy', `${Math.max(80, floor - r.bottom - 10 - Math.random() * 50)}px`)
    el.style.setProperty('--fr', `${(Math.random() * 70 - 35).toFixed(1)}deg`)
    el.style.setProperty('--fd', `${(Math.random() * 0.6).toFixed(2)}s`)
  })
}

function CatcherModal({ emojis, onClose }) {
  const key = pkey('gamehub-catcher-best')
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 } })
  function onBest(n) {
    setBest(n)
    try { localStorage.setItem(key, String(n)) } catch { /* storage unavailable */ }
  }
  const cfg = useMemo(() => ({ name: 'Emoji Catcher', hero: '🧺', good: emojis, bad: ['💣'], mode: 'fall', speed: 'medium', goal: { type: 'endless' } }), [emojis])
  return <CatchGame title="🕹️ Secret: Emoji Catcher" cfg={cfg} best={best} onScore={n => { if (n > best) onBest(n) }} onClose={onClose} />
}

function MiniTile({ game, onPlay }) {
  return (
    <Link to={game.path} className={styles.recent} style={{ '--h': hueFor(game, game.category) }} onClick={() => onPlay(game)} onMouseEnter={() => sfx('hover')} data-fall>
      <span className={styles.recentEmoji}>{game.emoji}</span>
      <span className={styles.recentTitle}>{game.title}</span>
    </Link>
  )
}

function StatTile({ icon, value, label }) {
  return (
    <div className={styles.statTile} data-fall>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

// A few real frames of the game, captured ahead of time, cycling while you
// hover. Images only load the first time you hover a card.
function Preview({ id, active }) {
  const frames = PREVIEW_FRAMES[id] || 0
  const [loaded, setLoaded] = useState(false)
  const [frame, setFrame] = useState(0)
  useEffect(() => { if (active) setLoaded(true) }, [active])
  useEffect(() => {
    if (!active || frames < 2) { setFrame(0); return }
    const t = setInterval(() => setFrame(f => (f + 1) % frames), 900)
    return () => clearInterval(t)
  }, [active, frames])
  if (!frames || !loaded) return null
  const base = import.meta.env.BASE_URL
  return (
    <span className={styles.preview} aria-hidden="true">
      {Array.from({ length: frames }, (_, k) => (
        <img key={k} src={`${base}previews/${id}-${k}.jpg`} alt="" className={k === frame ? styles.frameOn : ''} draggable="false" />
      ))}
      <span className={styles.previewBadge}>▶ PREVIEW</span>
    </span>
  )
}

// External entries (e.g. the Suggestion Box, hosted as a separate artifact)
// need a plain <a>, not a router <Link> — everything else keeps navigating
// internally without a full page reload.
function GameCard({ game, onPlay, fav, onFav, rating, onRate, fresh, frame }) {
  const [hover, setHover] = useState(false)
  const className = `${styles.card} ${game.secret ? styles.secretCard : ''} ${frame}`
  const style = { '--h': hueFor(game, game.category) }
  const hoverProps = {
    onMouseEnter: () => { setHover(true); sfx('hover') },
    onMouseLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
  }
  const content = (
    <>
      <span className={styles.art}>
        <span className={styles.emoji}>{game.emoji}</span>
        <Preview id={game.id} active={hover} />
        {fresh && <span className={`${styles.fresh} ${fresh === 'new' ? styles.freshNew : ''}`}>{fresh === 'new' ? '🆕 New' : '✨ Updated'}</span>}
        <button
          className={`${styles.heart} ${fav ? styles.heartOn : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onFav(game) }}
          aria-label={fav ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
          aria-pressed={fav}
        >{fav ? '❤️' : '🤍'}</button>
      </span>
      <span className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{game.title}</h3>
        <p className={styles.cardDesc}>{game.description}</p>
      </span>
      <span className={styles.cardFoot}>
        <span className={styles.tag}>{CATEGORY_STYLE[game.category]?.icon} {game.category}</span>
        {!game.external && <StarChip entry={rating} onClick={onRate} />}
        <span className={styles.play}>{game.external ? 'Open ↗' : '▶ Play'}</span>
      </span>
    </>
  )
  if (game.external) {
    return (
      <a href={game.path} target="_blank" rel="noopener noreferrer" className={className} style={style} {...hoverProps} data-fall data-card>
        {content}
      </a>
    )
  }
  return (
    <Link to={game.path} className={className} style={style} onClick={() => onPlay?.(game)} {...hoverProps} data-fall data-card>
      {content}
    </Link>
  )
}
