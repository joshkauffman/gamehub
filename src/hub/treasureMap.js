// ── The secret treasure map ──────────────────────────────────────────────
// Six torn map pieces are hidden inside six games, one after another: a
// piece only shows up (briefly, somewhere on the screen) in the game the
// previous clue points to. Collect all six, then click the X on the map at
// home to dig up the treasure: the secret Treasure Dig game. Per player.
import { pkey } from './profiles.js'

export const FIRST_CLUE = 'The first piece is hiding where a goose wears a propeller hat. 🪿'
export const PIECES = [
  { game: 'flappy-goose', clue: 'Piece 2 is where a long snake eats fruit in the ocean. 🐍' },
  { game: 'snake-clash', clue: 'Piece 3: hop over roads and rivers… and watch out for the hawk. 🐔' },
  { game: 'obvious-crossyroad-knockoff', clue: 'Piece 4: tilt the whole board and let gravity roll the ball. 🔮' },
  { game: 'orbit-maze', clue: 'Piece 5: roll some dice! Any dice. Even a d100. 🎲' },
  { game: 'dice-roller', clue: 'The last piece: X marks the spot… 🏝️' },
  { game: 'x-marks-the-spot', clue: 'That’s every piece! Go back to the GameHub and open the 🗺️ treasure map.' },
]

const KEY = 'gamehub-map'
export function loadMap(pid) {
  try { return { started: false, found: 0, solved: false, ...JSON.parse(localStorage.getItem(pkey(KEY, pid))) } } catch { return { started: false, found: 0, solved: false } }
}
export function saveMap(m) {
  try { localStorage.setItem(pkey(KEY), JSON.stringify(m)) } catch { /* storage unavailable */ }
}
// Which game the next piece is in (null when all found).
export function nextPieceGame(m = loadMap()) { return PIECES[m.found]?.game || null }
export function collectPiece() {
  const m = loadMap()
  const next = { ...m, started: true, found: Math.min(PIECES.length, m.found + 1) }
  saveMap(next)
  return next
}
export function currentClue(m) { return m.found === 0 ? FIRST_CLUE : PIECES[m.found - 1].clue }
