// ── Hub badges ───────────────────────────────────────────────────────────
// A sticker book. Each badge checks a snapshot of the player's hub data
// (built in Home.jsx). Once earned, a badge stays earned — it's saved with
// the date — even if, say, a favorite is later removed.
import { pkey } from './profiles.js'

export const BADGES = [
  { id: 'first', icon: '🎮', name: 'First Game', how: 'Play any game', test: c => c.stats.plays >= 1 },
  { id: 'tried5', icon: '🧭', name: 'Explorer', how: 'Try 5 different games', test: c => c.stats.tried >= 5 },
  { id: 'tried10', icon: '🗺️', name: 'Adventurer', how: 'Try 10 different games', test: c => c.stats.tried >= 10 },
  { id: 'tried25', icon: '🌍', name: 'World Traveller', how: 'Try 25 different games', test: c => c.stats.tried >= 25 },
  { id: 'streak3', icon: '🔥', name: 'On Fire', how: 'Play 3 days in a row', test: c => c.stats.best >= 3 },
  { id: 'streak7', icon: '☄️', name: 'Unstoppable', how: 'Play 7 days in a row', test: c => c.stats.best >= 7 },
  { id: 'hour', icon: '⏰', name: 'Hour Power', how: 'Play for 1 hour in total', test: c => c.stats.seconds >= 3600 },
  { id: 'hours10', icon: '🕰️', name: 'Marathon', how: 'Play for 10 hours in total', test: c => c.stats.seconds >= 36000 },
  { id: 'daily1', icon: '🧩', name: 'Challenger', how: 'Finish a daily challenge', test: c => c.dailyDone >= 1 },
  { id: 'daily10', icon: '🏅', name: 'Challenge Champ', how: 'Finish 10 daily challenges', test: c => c.dailyDone >= 10 },
  { id: 'secret1', icon: '🥚', name: 'Egg Hunter', how: 'Find a hub secret', test: c => c.secrets >= 1 },
  { id: 'secretAll', icon: '🐉', name: 'Secret Master', how: 'Find every hub secret', test: c => c.secrets >= c.secretsTotal },
  { id: 'critic', icon: '⭐', name: 'Critic', how: 'Rate 5 games', test: c => c.rated >= 5 },
  { id: 'critic15', icon: '🌟', name: 'Super Critic', how: 'Rate 15 games', test: c => c.rated >= 15 },
  { id: 'fav3', icon: '❤️', name: 'Big Fan', how: 'Have 3 favorite games', test: c => c.favs >= 3 },
  { id: 'gold', icon: '🥇', name: 'Gold!', how: 'Get a gold trophy on the Trophy Shelf', test: c => c.golds >= 1 },
  { id: 'shelf5', icon: '🏆', name: 'Full Shelf', how: 'Have 5 trophies on the shelf', test: c => c.trophies >= 5 },
  { id: 'rich', icon: '💰', name: 'Coin Collector', how: 'Earn 200 coins in total', test: c => c.coinsTotal >= 200 },
  { id: 'shopper', icon: '🛍️', name: 'Shopper', how: 'Buy something in the Hub Shop', test: c => c.owned >= 1 },
  { id: 'hatch', icon: '🐣', name: 'It Hatched!', how: 'Hatch your pet’s egg', test: c => c.petStage >= 1 },
  { id: 'petGrown', icon: '🦚', name: 'All Grown Up', how: 'Grow your pet to Legendary', test: c => c.petStage >= 5 },
  { id: 'photo', icon: '📸', name: 'Photographer', how: 'Take 3 photos in games', test: c => c.photos >= 3 },
  { id: 'inventor', icon: '💡', name: 'Inventor', how: 'Put a game idea in the Idea Box', test: c => c.ideas >= 1 },
  { id: 'maker', icon: '🛠️', name: 'Game Maker', how: 'Make your own mini-game', test: c => c.made >= 1 },
  { id: 'artist', icon: '🎨', name: 'Artist', how: 'Make your own theme', test: c => c.customTheme },
  { id: 'map', icon: '🏴‍☠️', name: 'Treasure Hunter', how: 'Solve the secret treasure map', test: c => c.mapSolved },
  { id: 'ghost', icon: '👻', name: 'Ghost Friend', how: 'Click the hub ghost 10 times', test: c => c.ghostClicks >= 10 },
  { id: 'birthday', icon: '🎂', name: 'Birthday!', how: 'Visit the hub on your birthday', test: c => c.birthdayToday },
]

const KEY = 'gamehub-badges'
export function loadBadges(pid) {
  try { return JSON.parse(localStorage.getItem(pkey(KEY, pid))) || {} } catch { return {} }
}
// Saves and returns the badges newly earned with this snapshot.
export function checkBadges(ctx) {
  const have = loadBadges()
  const fresh = BADGES.filter(b => !have[b.id] && (() => { try { return b.test(ctx) } catch { return false } })())
  if (fresh.length) {
    const now = Date.now()
    try { localStorage.setItem(pkey(KEY), JSON.stringify({ ...have, ...Object.fromEntries(fresh.map(b => [b.id, now])) })) } catch { /* storage unavailable */ }
  }
  return fresh
}
