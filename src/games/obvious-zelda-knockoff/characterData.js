// ── The Obvious Zelda Knockoff — playable characters ───────────────────
// Each character maps the same four action slots (melee + item1/2/3) onto
// a different concrete weapon from weapons.js. The pickup locations in
// levels.js are unchanged and slot-based ('weapon_melee', 'weapon_item1',
// etc.) — same world, same order of discovery, but what you actually find
// at each spot depends on who you picked at the start. Only clothing
// colors differ visually; the head/skin stays the same hero silhouette.

export const CHARACTERS = [
  {
    id: 'knight',
    name: 'Rook the Knight',
    emoji: '🛡️',
    tagline: 'The classic kit: sword, boomerang, bow, and bombs.',
    colors: { tunic: '#2a7a3a', cap: '#2a7a3a', accent: '#ffd54a', boots: '#5a3a1f' },
    weapons: { melee: 'sword', item1: 'boomerang', item2: 'bow', item3: 'bombs' },
  },
  {
    id: 'rogue',
    name: 'Vale the Rogue',
    emoji: '🔪',
    tagline: 'A stabbing dagger-dash, knives that pierce a whole line of enemies, a knockback crossbow, and a lobbed smoke bomb.',
    colors: { tunic: '#4a2a6a', cap: '#4a2a6a', accent: '#c86aff', boots: '#2a1a3a' },
    weapons: { melee: 'dagger', item1: 'knives', item2: 'crossbow', item3: 'smokebomb' },
  },
  {
    id: 'pyromancer',
    name: 'Ember the Pyromancer',
    emoji: '🔥',
    tagline: 'A burning flame cone you stand in, a bursting fire orb, bolts that set enemies ablaze, and a firebomb that leaves the ground burning.',
    colors: { tunic: '#8a2a1f', cap: '#8a2a1f', accent: '#ffb84a', boots: '#3a1a12' },
    weapons: { melee: 'flamerod', item1: 'fireorb', item2: 'scorchbolt', item3: 'firebomb' },
  },
]

export function characterById(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]
}
