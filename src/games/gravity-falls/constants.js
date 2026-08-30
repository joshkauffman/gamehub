// ── Gravity Falls: Journal Hunt — shared data ───────────────────────────
// An open-world explore-and-collect game inspired by Gravity Falls: pick
// a character and roam the town (Mystery Shack, the forest, downtown)
// finding torn Journal 3 pages, each with its own one-line mystery entry.
// Forest gnomes, the Multi-Bear, and the rest of the cast are flavor —
// wandering NPCs with a one-time greeting, not enemies — matching the
// "collect, don't fight" loop this game was built around. Find every page
// and the finale triggers: the sky ripples, and Bill Cipher is waiting in
// the clearing north of town.

export const WORLD_HALF = 42
export const UNIT_RADIUS = 0.6
export const NPC_MEET_RADIUS = 3.2
export const PAGE_BASE_RADIUS = 1.6
export const CLIMAX_RADIUS = 4

export const SHACK_POS = { x: 0, z: -30 }
export const DINER_POS = { x: 20, z: 12 }
export const STORE_POS = { x: 29, z: -7 }
export const WATER_TOWER_POS = { x: 16, z: -19 }
export const GNOME_HOME = { x: -22, z: 6 }
export const MULTIBEAR_POS = { x: -33, z: -5 }
export const CLIMAX_POS = { x: 0, z: 34 }

// Each playable character is a small stat/perk variant, not a combat
// build — this is an explore-and-collect game, so the differentiation is
// all movement speed, pickup radius, or a QoL perk (Dipper's compass).
// Model appearance (outfit colors, hair, hat) lives in GravityFalls.jsx's
// CHAR_SPECS, not here — this file stays pure gameplay data.
export const CHARACTERS = [
  {
    key: 'dipper', name: 'Dipper', icon: '🧭',
    speedMult: 1.0, pickupMult: 1.0, hasCompass: true,
    desc: 'The Shack\'s resident skeptic-turned-believer. His notebook practically points itself toward the next mystery — a compass to the nearest unfound page.',
  },
  {
    key: 'mabel', name: 'Mabel', icon: '🦄',
    speedMult: 1.2, pickupMult: 1.0, hasCompass: false,
    desc: 'Unstoppable, uncomplicated, and always sprinting toward the next weird thing. The fastest on foot, no contest.',
  },
  {
    key: 'stan', name: 'Stan', icon: '🎩',
    speedMult: 0.9, pickupMult: 1.4, hasCompass: false,
    desc: 'Doesn\'t move fast, but everything interesting somehow ends up within arm\'s reach — a much wider grab radius on pages.',
  },
  {
    key: 'wendy', name: 'Wendy', icon: '🪓',
    speedMult: 1.12, pickupMult: 1.0, hasCompass: false,
    desc: 'Knows these woods better than anyone. Quick, and never winded.',
  },
  {
    key: 'soos', name: 'Soos', icon: '🔧',
    speedMult: 0.95, pickupMult: 1.25, hasCompass: false,
    desc: 'Handy, cheerful, and somehow always standing right next to the thing you needed. Solid grab radius.',
  },
]

export function getCharacter(key) { return CHARACTERS.find(c => c.key === key) }

// Torn Journal 3 pages scattered across the map — the core collectible.
// Each has a short in-world flavor entry, revealed as a toast on pickup.
export const PAGES = [
  { id: 'p1', pos: { x: 5, z: -25 }, zone: 'shack', title: 'A Torn Page', text: 'Tucked behind the vending machine: "TRUST NO ONE. Except the person who gave you this book."' },
  { id: 'p2', pos: { x: -4, z: -25 }, zone: 'shack', title: 'Gift Shop Oddity', text: "Behind a shelf of snow globes: a page about a jackalope that isn't just a taxidermy prank." },
  { id: 'p3', pos: { x: 8, z: -33 }, zone: 'shack', title: 'Attic Find', text: 'Dust-covered in the attic: a sketch of a six-fingered hand, circled twice.' },
  { id: 'p4', pos: { x: -20, z: 8 }, zone: 'forest', title: 'Gnome Territory', text: 'Near a cluster of tiny footprints: "They are stronger together. Never approach the whole colony."' },
  { id: 'p5', pos: { x: -28, z: 18 }, zone: 'forest', title: 'Mushroom Ring', text: 'A perfect ring of mushrooms glows faintly at dusk. The page just says: "Do not accept their tea."' },
  { id: 'p6', pos: { x: -33, z: -12 }, zone: 'forest', title: 'Cave Mouth', text: 'Left just outside a cave: "He has many heads and one very good singing voice."' },
  { id: 'p7', pos: { x: -15, z: -16 }, zone: 'forest', title: 'Hollow Log', text: 'Inside a hollow log, water-warped: notes on a bottomless lake and something that lives in it.' },
  { id: 'p8', pos: { x: 25, z: 16 }, zone: 'town', title: "Greasy's Booth", text: "Wedged under a diner booth: a coffee-stained note about a waitress's uncanny sixth sense." },
  { id: 'p9', pos: { x: 33, z: -7 }, zone: 'town', title: 'General Store Shelf', text: 'Behind a shelf of tourist tat: "Real. Fake. Real. Does it matter if it sells?"' },
  { id: 'p10', pos: { x: 16, z: -22 }, zone: 'town', title: 'Water Tower', text: 'Carved into the water tower ladder: a triangle with one eye, and the words "HE IS WATCHING."' },
]

export const TOTAL_PAGES = PAGES.length

// Wandering flavor NPCs — a one-time greeting on first approach, no
// gameplay effect. Whichever one matches the player's chosen character is
// left out of the world (see createNPCs in gameEngine.js).
export const NPC_DEFS = [
  { id: 'stan_npc', key: 'stan', home: { x: 2, z: -31 }, wanderRadius: 3, toast: "Stan grumbles about tourists and eyes your notebook. \"Whatever. Just don't touch the register.\"" },
  { id: 'wendy_npc', key: 'wendy', home: { x: 15, z: -19 }, wanderRadius: 10, toast: "Wendy's leaning against the water tower, flipping her axe. \"Oh hey. Doing the mystery thing?\"" },
  { id: 'soos_npc', key: 'soos', home: { x: 22, z: 4 }, wanderRadius: 12, toast: 'Soos gives you a thumbs up. "Dude, this town is WILD, and I love it."' },
  { id: 'waddles_npc', key: 'waddles', home: { x: -2, z: -26 }, wanderRadius: 6, toast: 'You found Waddles! He oinks happily and trots along behind you for a bit.' },
  { id: 'multibear_npc', key: 'multibear', home: MULTIBEAR_POS, wanderRadius: 2, toast: 'The Multi-Bear watches you from his cave, all ten heads politely nodding in unison.' },
]

export const GNOME_COUNT = 4
export const GNOME_WANDER_RADIUS = 9
export const GNOME_TOAST = 'The gnomes mutter something about their queen and scurry deeper into the brush.'

const BEST_KEY = 'gravity-falls-best'
export function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
export function saveBest(key, seconds) {
  try {
    const best = loadBest()
    if (best[key] === undefined || seconds < best[key]) {
      best[key] = seconds
      localStorage.setItem(BEST_KEY, JSON.stringify(best))
    }
    return best[key]
  } catch { return seconds }
}
