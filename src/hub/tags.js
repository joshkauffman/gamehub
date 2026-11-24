// ── Tags for the home page filter chips ─────────────────────────────────
// Hand-picked; add a game's id to whichever lists fit it. 'new' isn't here —
// it comes from git history (see gameDates.js / scripts/game-dates.mjs).

export const TAGS = [
  { id: '2p', label: '👥 2+ players', hue: 200 },
  { id: 'quick', label: '⚡ Quick (under 5 min)', hue: 50 },
  { id: '3d', label: '🧊 3D', hue: 180 },
  { id: 'little', label: '🧸 Good for little kids', hue: 330 },
  { id: 'kids', label: '🧒 Designed by kids', hue: 120 },
  { id: 'new', label: '🆕 New or updated', hue: 280 },
]

const LISTS = {
  '2p': ['lil-monster-battles', 'wings-of-fire', 'avatar', 'ultimate-ttt', 'hangman', 'ship-captain-crew', 'dungeon-crawler-free-roam', 'hogwarts-spellbound', 'poetry-for-neanderthals', 'chat-lounge', 'snack-squad', 'dice-roller'],
  quick: ['flappy-goose', 'snake-clash', 'obvious-crossyroad-knockoff', 'geometry-rush', 'ultimate-ttt', 'hangman', 'ship-captain-crew', 'dice-roller', 'orbit-maze', 'retro-arcade', 'satisfying-toybox', 'guugle', 'x-marks-the-spot', 'obvious-guitar-hero-knockoff', 'obvious-sonic-knockoff', 'obvious-donkeykong-knockoff'],
  '3d': ['avatar', 'dino-suit-up', 'dungeon-crawler-free-roam', 'lil-monster-battles', 'loot-and-scoot', 'obvious-minecraft-knockoff', 'orbit-maze', 'satisfying-toybox', 'totally-scary-horror-game', 'wings-of-fire', 'world3d'],
  little: ['flappy-goose', 'satisfying-toybox', 'x-marks-the-spot', 'hudson-school-practice', 'lil-monster-battles', 'obvious-crossyroad-knockoff', 'snake-clash', 'dino-suit-up', 'capeville', 'shirby-and-the-forgotten-place', 'obvious-mario-knockoff', 'totally-scary-horror-game', 'easy-game', 'dog-man-dash', 'dice-roller'],
  kids: ['lil-monster-battles', 'totally-scary-horror-game'],
}

const BY_GAME = {}
for (const [tag, ids] of Object.entries(LISTS)) for (const id of ids) (BY_GAME[id] ||= []).push(tag)

export function tagsFor(id) { return BY_GAME[id] || [] }
