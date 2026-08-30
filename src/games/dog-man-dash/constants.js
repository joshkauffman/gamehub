// ── Dog Man Dash 3D — shared data ───────────────────────────────────────
// One open, free-roam city (Three.js) instead of a forced-scroll lane or
// a flat 2D canvas. Same cast, same power-ups as the original — reused
// verbatim as camera-facing billboards standing in real 3D geometry —
// but now you walk (and mouse-look) anywhere across three connected
// districts instead of running a fixed track.
const ASSET_BASE = '/games/dog-man-dash'

export const CHARACTERS = [
  { key: 'dogman', name: 'DOG MAN', desc: 'Loyal & Brave', color: '#1565C0', proj: 'bone', texture: `${ASSET_BASE}/dogman.png` },
  { key: 'lilpetey', name: "LIL' PETEY", desc: 'Smart & Sneaky', color: '#880E4F', proj: 'yarn', texture: `${ASSET_BASE}/lilpetey.png` },
  { key: '80hd', name: '80-HD', desc: 'Robot Warrior', color: '#1B5E20', proj: 'laser', texture: `${ASSET_BASE}/80hd.png`, unlockKey: 'char_80hd', unlockHint: 'Score 1,000 in a run' },
  { key: 'molly', name: 'MOLLY', desc: 'Super Sleuth', color: '#6A1B9A', proj: 'speech', texture: `${ASSET_BASE}/Molly.png`, unlockKey: 'char_molly', unlockHint: 'Score 3,000 in a run' },
  { key: 'petey', name: 'PETEY', desc: 'Super Villain!', color: '#B71C1C', proj: 'laser', texture: `${ASSET_BASE}/Petey.png`, unlockKey: 'char_petey', unlockHint: 'Score 8,000 in a run' },
]

export const ENEMY_TYPES = [
  { key: 'crunky', texture: `${ASSET_BASE}/crunky.png` },
  { key: 'bub', texture: `${ASSET_BASE}/bub.png` },
  { key: 'piggy', texture: `${ASSET_BASE}/piggy.png` },
]

export const CHIEF_TEXTURE = `${ASSET_BASE}/chief.png`

// The final boss — a giant robot dinosaur guarding the far end of the
// Hideout. Spawns once TARGET_CAPTURES is reached (see worldEngine.js);
// beating it down is what actually ends the run in a win.
export const BOSS_NAME = 'ROBO-BRONTO'
export const BOSS_TEXTURE = `${ASSET_BASE}/robo-bronto.jpeg`
export const BOSS_ARENA = { x: 0, z: -66 }

// Score thresholds, checked continuously (not tied to "finishing" anything
// — there's no finish line in an open world), highest-ever single-run
// score.
export const UNLOCKS = [
  { key: 'char_80hd', name: '80-HD', score: 1000 },
  { key: 'char_molly', name: 'MOLLY', score: 3000 },
  { key: 'char_petey', name: 'PETEY', score: 8000 },
]

// One continuous map split into three districts by world-Z position.
// z > DOCKS_START is the Docks, z < HIDEOUT_START is the Hideout, and
// everything between is the City. Fog/ground color blend smoothly across
// the boundaries (see worldEngine.js districtBlend / DogManDash.jsx).
export const MAP_HALF = 72
export const DOCKS_START = 24
export const HIDEOUT_START = -24

export const DISTRICTS = {
  city: { name: 'THE CITY', ground: '#2e2e3a', fog: '#7a8ab8', buildings: [0x3a3a52, 0x4a3a52, 0x2a3a4a] },
  docks: { name: 'THE DOCKS', ground: '#3a3226', fog: '#b98a6a', buildings: [0x5a4a34, 0x6a5a3a, 0x4a4030] },
  hideout: { name: 'THE HIDEOUT', ground: '#1a1622', fog: '#2a2438', buildings: [0x241c30, 0x2e2038, 0x1c1826] },
}

export function districtAt(z) {
  if (z > DOCKS_START) return DISTRICTS.docks
  if (z < HIDEOUT_START) return DISTRICTS.hideout
  return DISTRICTS.city
}

// A fixed home-base shop planted in the Hideout district (see the cabin
// mesh in DogManDash.jsx and the building-free clearing kept around this
// point in worldEngine.js's generateBuildings). Walk within SHOP_RADIUS
// and press E to spend run coins on gear.
export const HOME_BASE = { x: 0, z: -48 }
export const SHOP_RADIUS = 3.5

export const SHOP_ITEMS = [
  { key: 'weapon', name: 'Trusty Weapon', icon: '🎯', cost: 3, desc: 'A ready throw, matched to your officer.' },
  { key: 'star', name: 'Star Power', icon: '⭐', cost: 5, desc: '7 seconds of invincible smashing.' },
  { key: 'life', name: 'Extra Life', icon: '❤️', cost: 8, desc: 'One more chance if you get caught.' },
]

// Shown on the victory screen once the case is closed (see TARGET_CAPTURES
// in worldEngine.js).
export const CHIEF_WIN_QUOTES = [
  'GREAT JUMPING BISCUITS! You actually won! I mean... I KNEW you could. Totally.',
  "Wow. Just WOW. Now please stop wagging your tail, you're knocking my mug over.",
  "I'm not crying. There's just something in BOTH of my eyes. Go away.",
  'You did it! I KNEW you could! ...I did not know you could. But still!',
  "By the power of my toupee, I declare YOU the winner! Don't touch the toupee.",
  'Good gravy! That was INCREDIBLE! And kinda gross. Mostly incredible.',
  "You're a hero, Dog Man! Now stop drooling on my trophy case.",
  'Atta boy! Now please get off my chair. And my desk. And my sandwich.',
  'You saved the city AGAIN! Do you ever take a day off? Also, sit. STAY.',
  'That was AMAZING! Now go bury the bad guys somewhere quiet.',
  "You're a GOOD BOY! I mean officer. OFFICER. ...same difference.",
  'THAT WAS A GIANT ROBOT DINOSAUR! And you just walked up and decked it. Incredible. Slightly terrifying.',
  "Robo-Bronto is scrap metal and you're a HERO! Somebody get this dog a trophy. And a bath.",
]

// Shown on the game-over screen when you run out of lives before closing
// the case.
export const CHIEF_LOSE_QUOTES = [
  "Well, that didn't go so hot. Try not to trip over your own leash next time.",
  'The bad guys got away! Good gravy, get back out there and try again!',
  "Down but not out, officer. Go grab a snack and give it another go.",
  "Oh for corn's sake! Back to obedience school with you. Kidding! Mostly.",
  "You'll get 'em next time. Probably. Hopefully. Go try again.",
  "That's alright, that's alright! Even good boys have off days.",
]

const SAVE_KEY = 'dogman-dash-3d-v2'
const DEFAULT_SAVE = { unlocks: {}, bestScore: 0, totalScore: 0 }

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { ...DEFAULT_SAVE, unlocks: {} }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SAVE, ...parsed, unlocks: { ...parsed.unlocks } }
  } catch {
    return { ...DEFAULT_SAVE, unlocks: {} }
  }
}

function persist(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* storage unavailable */ }
}

export function isCharUnlocked(char, save) {
  return !char.unlockKey || !!save.unlocks[char.unlockKey]
}

// Called continuously as the score climbs during a run — returns the
// (possibly updated) save plus any newly-crossed unlocks this call.
export function checkScoreUnlocks(score, save) {
  let next = save
  const newlyUnlocked = []
  for (const u of UNLOCKS) {
    if (score >= u.score && !next.unlocks[u.key]) {
      next = { ...next, unlocks: { ...next.unlocks, [u.key]: true } }
      newlyUnlocked.push(u.name)
    }
  }
  if (newlyUnlocked.length) persist(next)
  return { save: next, newlyUnlocked }
}

export function recordRunScore(score) {
  const save = loadSave()
  const updated = { ...save, totalScore: save.totalScore + score, bestScore: Math.max(save.bestScore, score) }
  persist(updated)
  return updated
}
