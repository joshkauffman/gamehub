// ── Easy Game — the secret wins ─────────────────────────────────────────
// The premise: a trophy sits right there, begging to be clicked. Clicking
// it never wins — it just tells you to find other ways. The real game is
// discovering the twelve secret wins hidden in the ways you can interact
// with the page itself: the mouse's other button, the keyboard, the
// window, the scrollbar, the passage of time.
//
// Pure data + localStorage helpers, no React and no DOM-event logic —
// EasyGame.jsx owns the detectors, this file owns what they're detecting
// and how a found win is described back to the player.

export const SAVE_KEY = 'easy-game-wins-v1'

export const WINS = [
  {
    id: 'persist',
    name: 'Sheer Persistence',
    hint: 'No means no. Ask ten times anyway.',
    blurb: 'You were told, repeatedly, that the trophy was not the answer. You clicked it ten times. Respect.',
  },
  {
    id: 'rightclick',
    name: 'The Other Button',
    hint: 'Your mouse has more than one button.',
    blurb: 'Right-clicking: the oldest secret passage in software.',
  },
  {
    id: 'hold',
    name: 'The Long Press',
    hint: 'Some things open only if you press and wait.',
    blurb: 'You held on. The trophy got uncomfortable. You win.',
  },
  {
    id: 'drag',
    name: 'Trophy Thief',
    hint: "It's not actually nailed down, you know.",
    blurb: 'You simply dragged the trophy off its pedestal and took it. Nobody stopped you.',
  },
  {
    id: 'shake',
    name: 'Shake It Loose',
    hint: 'Try moving the mouse like you mean it.',
    blurb: 'You shook the cursor so hard something fell out of the page.',
  },
  {
    id: 'spell',
    name: 'Spell It Out',
    hint: 'Say what you want. Letter by letter.',
    blurb: 'You just typed what you wanted and the game obliged. Direct communication works.',
  },
  {
    id: 'konami',
    name: 'The Old Code',
    hint: 'Up, up, and away — you know the rest.',
    blurb: 'Up Up Down Down Left Right Left Right B A. It still works. It will always work.',
  },
  {
    id: 'title',
    name: 'Read It Twice',
    hint: 'The name of the game. Twice, quickly.',
    blurb: 'You double-clicked the title. The title double-clicked back.',
  },
  {
    id: 'tab',
    name: 'The Invisible Button',
    hint: 'Keyboard users can reach things the mouse never sees.',
    blurb: 'There was a button there the whole time. Tab found it. It just needed pressing.',
  },
  {
    id: 'basement',
    name: 'The Basement',
    hint: 'There is more page below than there appears to be.',
    blurb: 'You scrolled past the end of the game and found where it keeps its junk.',
  },
  {
    id: 'resize',
    name: 'Reshape Reality',
    hint: 'The window is not a fixed and permanent thing.',
    blurb: 'You resized the window. The game, technically, had no defense against this.',
  },
  {
    id: 'idle',
    name: 'Patience',
    hint: 'Do nothing at all. Really nothing. For a while.',
    blurb: 'You stopped touching anything for twenty seconds and the game blinked first.',
  },
]

export const TOTAL_WINS = WINS.length

export function getWin(id) { return WINS.find(w => w.id === id) }

export function loadWins() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    const ids = raw ? JSON.parse(raw) : []
    // Drop ids from older builds so a renamed win can't inflate the count.
    return Array.isArray(ids) ? ids.filter(id => WINS.some(w => w.id === id)) : []
  } catch { return [] }
}

export function saveWins(ids) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(ids)) } catch { /* storage unavailable */ }
}

export function clearWins() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* storage unavailable */ }
}

// Clicking the trophy never wins — it just escalates. The last line is
// reached on the tenth click, which is also where the 'persist' win fires.
export const DENIALS = [
  'Find other ways to win.',
  'Still the trophy? There are other ways.',
  'The trophy is not the win. The finding is the win.',
  'You can keep clicking. It will keep not working.',
  'Genuinely, there is nothing in here for you.',
  'Try the rest of the page. The whole page.',
  'Your mouse does other things. Your keyboard exists.',
  'This is the eighth time. I have been counting.',
  'One more and I am giving you something just to make it stop.',
  'FINE. Take it. You have earned this through sheer attrition.',
]
