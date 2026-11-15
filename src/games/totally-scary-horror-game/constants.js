// ── The Totally Scary Horror Game — shared data ─────────────────────────
// A top-down "haunted hotel" maze. The premise is the whole joke: none
// of the monsters are actually scary. Run from them and they chase
// (half-heartedly). Let one catch you and it doesn't end the game — it
// just sits down and tells you, at length, why it's really doing this
// job (the economy, mostly), before getting back up to resume not
// scaring you. Reach the exit at the north end of the main corridor to
// escape. Same engine/render split as this hub's other canvas games.

export const TILE = 36
export const COLS = 26
export const ROWS = 16
export const PLAY_W = COLS * TILE
export const PLAY_H = ROWS * TILE
export const HUD_H = 56
export const CANVAS_W = PLAY_W
export const CANVAS_H = PLAY_H + HUD_H

export const PLAYER_HALF = 13
export const PLAYER_SPEED = 170 // px/sec — faster than any monster's chase speed, so escaping is always possible

export const MONSTER_HALF = 14
export const NOTICE_RADIUS = 140
export const LOSE_RADIUS = 260
export const CATCH_RADIUS = 26
export const REST_COOLDOWN = 2.5 // seconds a monster ignores the player right after a conversation

// Tile legend: '.' floor, '#' wall, 'E' the exit (walkable, triggers win).
export const SOLID_TILES = new Set(['#'])

// Builds the hotel floor plan: a lobby (bottom-left) that opens directly
// into a long north-south spine corridor, five side rooms branching off
// the spine's east side (one per early monster), and the exit set into
// the north wall at the top of the spine, with the sixth monster
// patrolling the spine itself — the last thing between you and the door.
function buildHotelMap() {
  const rows = []
  for (let r = 0; r < ROWS; r++) rows.push(new Array(COLS).fill('.'))

  for (let c = 0; c < COLS; c++) { rows[0][c] = '#'; rows[ROWS - 1][c] = '#' }
  for (let r = 0; r < ROWS; r++) { rows[r][0] = '#'; rows[r][COLS - 1] = '#' }

  // The exit doorway, set into the north wall at the top of the spine.
  rows[0][11] = 'E'; rows[0][12] = 'E'

  // The rest of the hotel's west wing — not part of this level, just a
  // solid block so the spine/lobby read as carved out of a real building.
  for (let r = 1; r <= 9; r++) for (let c = 1; c <= 10; c++) rows[r][c] = '#'

  // Wall separating the spine/lobby from the east-side rooms, with a
  // door gap into each room.
  for (let r = 1; r <= 14; r++) rows[r][13] = '#'
  const doorRows = [2, 5, 8, 11, 14]
  doorRows.forEach(r => { rows[r][13] = '.' })

  // Horizontal dividers splitting the east side into five stacked rooms.
  const dividerRows = [4, 7, 10, 13]
  dividerRows.forEach(r => { for (let c = 13; c <= 24; c++) rows[r][c] = '#' })

  return rows
}

export const HOTEL_MAP = buildHotelMap()
export const EXIT_TILES = [[0, 11], [0, 12]]

function cellCenter(col, row) { return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 } }

export const PLAYER_SPAWN = cellCenter(3, 13) // in the lobby, a short walk from the spine

// Each monster patrols a short back-and-forth line between patrolA and
// patrolB; when the player comes within noticeRadius it gives chase
// (always slower than PLAYER_SPEED, so running away always works), and
// gives up once the player is past loseRadius. Catching the player opens
// `lines` (first meeting) or `repeatLine` (every meeting after).
export const MONSTER_DEFS = [
  {
    id: 'vampire', name: 'Drakko', icon: '🧛', shape: 'vampire',
    bodyColor: '#3a1030', accentColor: '#b8203a',
    patrolA: cellCenter(16, 2), patrolB: cellCenter(22, 2),
    speed: 75, chaseSpeed: 130,
    lines: [
      'AH HA HA— oh, hold on, let me just— ow, my dentures.',
      "I used to work the night shift at the blood bank, but they switched to an appointment app and let me go.",
      "The hissing's mostly for show, honestly. My throat's dry ever since my landlord raised the coffin rent. He's a werewolf. It's awkward.",
    ],
    repeatLine: "Oh, it's you again. Still haunting this hallway. Still unemployed, since you're asking.",
  },
  {
    id: 'mummy', name: 'Wendell', icon: '🩹', shape: 'mummy',
    bodyColor: '#c9b98a', accentColor: '#8a7a52',
    patrolA: cellCenter(16, 6), patrolB: cellCenter(22, 6),
    speed: 65, chaseSpeed: 115,
    lines: [
      'Mmmph— sorry, hold on, I need both hands to say this properly.',
      'Repetitive strain from decades of wrapping and unwrapping. The bandage factory I worked at closed down years ago.',
      "Between us, I don't even need the whole shuffling thing. I just can't bend my elbows. The wrap's very tight.",
    ],
    repeatLine: "Still here. Still wrapped too tight to wave. Hi again.",
  },
  {
    id: 'ghost', name: 'Pale Steve', icon: '👻', shape: 'ghost',
    bodyColor: '#eef3f8', accentColor: '#9fb0c0',
    patrolA: cellCenter(16, 9), patrolB: cellCenter(22, 9),
    speed: 80, chaseSpeed: 140,
    lines: [
      'WOOOoooo— ugh, sorry, one sec, my throat.',
      "Honestly? I'm just a guy under a sheet. The eye holes are cut too small and I keep walking into the furniture.",
      'The moaning is rough on the vocal cords. My doctor says to stop doing the moaning. I told him I have a contract.',
    ],
    repeatLine: "It's me again. The sheet guy. Still can't see a thing.",
  },
  {
    id: 'werewolf', name: 'Barry', icon: '🐺', shape: 'werewolf',
    bodyColor: '#5a4330', accentColor: '#2e2015',
    patrolA: cellCenter(16, 12), patrolB: cellCenter(22, 12),
    speed: 85, chaseSpeed: 145,
    lines: [
      '*pant pant* okay— hold on— shedding season is brutal this year.',
      "HR won't approve a vacuum budget for the breakroom. I've asked three times. There is fur everywhere.",
      "My landlord's actually the vampire a few rooms over. We don't talk about the lease. It's weird.",
    ],
    repeatLine: "Oh — you. Hi. Still shedding. Still no vacuum.",
  },
  {
    id: 'zombie', name: 'Gary', icon: '🧟', shape: 'zombie',
    bodyColor: '#5a7a4a', accentColor: '#2e3f22',
    patrolA: cellCenter(16, 14), patrolB: cellCenter(22, 14),
    speed: 55, chaseSpeed: 100,
    lines: [
      'Uuuughhh— sorry, bad knee, give me a moment to sit.',
      "The groaning gives me a sore throat every shift. And for the record, I'm vegetarian. The brain-eating is just part of the brand.",
      "I've been trying to start a union. So far it's just me. Turns out we have trouble organizing meetings.",
    ],
    repeatLine: 'Oh, it\'s you. Still vegetarian. Still unionizing. Still just me.',
  },
  {
    id: 'armor', name: 'Sir Reginald', icon: '🛡️', shape: 'armor',
    bodyColor: '#8a8a94', accentColor: '#5a5a62',
    patrolA: { x: 432, y: 54 }, patrolB: { x: 432, y: 306 }, // the spine itself, guarding the final stretch
    speed: 70, chaseSpeed: 120,
    lines: [
      'Oh! Apologies — one moment, let me set my head down properly.',
      "This neck brace is for my HELMET, not my neck, which I don't technically have. It still chafes.",
      'Can I just say — I actually knit. I made this scarf. Nobody ever stays long enough to see it.',
    ],
    repeatLine: 'Hello again! I added a second stripe to the scarf since we last spoke.',
  },
]
