// ── Easy Game — the secret wins ─────────────────────────────────────────
// The premise: a trophy sits right there, begging to be clicked. Clicking
// it never wins — it just tells you to find other ways. The real game is
// discovering the secret wins hidden in the ways you can interact with
// the page itself: mouse buttons and modifiers, timing windows, the
// keyboard, the window, the scrollbar, even leaving and coming back.
// Deliberately no hint system and no visible total — EasyGame.jsx never
// renders a placeholder for an unfound win or a "x / N" count, so the
// only way to know how many there are is to find all of them.
//
// Pure data + localStorage helpers, no React and no DOM-event logic —
// EasyGame.jsx owns the detectors, this file owns what they're detecting
// and how a found win is described back to the player.

export const SAVE_KEY = 'easy-game-wins-v1'

export const WINS = [
  {
    id: 'persist',
    name: 'Sheer Persistence',
    blurb: 'You were told, repeatedly, that the trophy was not the answer. You clicked it ten times anyway. Respect.',
  },
  {
    id: 'rightclick',
    name: 'The Other Button',
    blurb: 'Right-clicking: the oldest secret passage in software.',
  },
  {
    id: 'middleclick',
    name: 'The Button Nobody Uses',
    blurb: "Your mouse has a third button and you found a use for it. We're as surprised as you are.",
  },
  {
    id: 'altclick',
    name: 'Alt Ending',
    blurb: 'Alt plus a click. A whole different outcome, for the price of one extra finger.',
  },
  {
    id: 'ctrlclick',
    name: 'Admin Override',
    blurb: 'Ctrl (or Cmd, we see you, Mac users) plus a click. You went around the front door entirely.',
  },
  {
    id: 'shiftclick',
    name: 'Shift Work',
    blurb: 'Shift plus a click. Somewhere, a manager is impressed.',
  },
  {
    id: 'tripleclick',
    name: 'Triple Threat',
    blurb: 'Three clicks, fast, no gap. Not angry — just thorough.',
  },
  {
    id: 'hold',
    name: 'The Long Press',
    blurb: 'You held on. The trophy got uncomfortable. You win.',
  },
  {
    id: 'goldilocks',
    name: 'Just Right',
    blurb: "Not a quick click. Not a long hold. You found the one duration in between that actually does something.",
  },
  {
    id: 'drag',
    name: 'Trophy Thief',
    blurb: "You simply dragged the trophy off its pedestal and took it. Nobody stopped you.",
  },
  {
    id: 'shake',
    name: 'Shake It Loose',
    blurb: 'You shook the cursor so hard something fell out of the page.',
  },
  {
    id: 'hover',
    name: 'Window Shopping',
    blurb: "You hovered over the trophy for a long time without ever clicking it. The trophy noticed. It's flattered.",
  },
  {
    id: 'spell',
    name: 'Spell It Out',
    blurb: 'You just typed what you wanted and the game obliged. Direct communication works.',
  },
  {
    id: 'konami',
    name: 'The Old Code',
    blurb: 'Up Up Down Down Left Right Left Right B A. It still works. It will always work.',
  },
  {
    id: 'escape3',
    name: 'Tactical Retreat',
    blurb: 'You hit Escape three times, fast, like something was actually chasing you. Nothing was. You still won.',
  },
  {
    id: 'ctrlS',
    name: 'Nothing To Save',
    blurb: "You tried to save the page. There was nothing to save. The gesture alone counted.",
  },
  {
    id: 'title',
    name: 'Read It Twice',
    blurb: 'You double-clicked the title. The title double-clicked back.',
  },
  {
    id: 'tab',
    name: 'The Invisible Button',
    blurb: 'There was a button there the whole time. Tab found it. It just needed pressing.',
  },
  {
    id: 'secretword',
    name: 'The Magic Word',
    blurb: 'Tab found a second invisible thing. You typed the word it wanted. Manners, it turns out, matter.',
  },
  {
    id: 'basement',
    name: 'The Basement',
    blurb: 'You scrolled past the end of the game and found where it keeps its junk.',
  },
  {
    id: 'roundtrip',
    name: 'There and Back Again',
    blurb: 'All the way down, all the way back up, before you could change your mind. A round trip, timed.',
  },
  {
    id: 'resize',
    name: 'Reshape Reality',
    blurb: 'You resized the window. The game, technically, had no defense against this.',
  },
  {
    id: 'blank',
    name: 'Nihilist',
    blurb: "You clicked on nothing. Repeatedly. On purpose. There was never anything there. That was the point.",
  },
  {
    id: 'rage',
    name: 'Rage Quit',
    blurb: "You clicked fast and a lot, like the game owed you money. It noticed. It respects the energy.",
  },
  {
    id: 'away',
    name: 'The Return',
    blurb: 'You left. Properly left — another tab, another app. Then you came back. The game waited.',
  },
  {
    id: 'devtools',
    name: 'We See You',
    blurb: "You opened the inspector to peek behind the curtain. We know. We've always known.",
  },
  {
    id: 'idle',
    name: 'Patience',
    blurb: 'You stopped touching anything at all and the game blinked first.',
  },
]

export const TOTAL_WINS = WINS.length

export function getWin(id) { return WINS.find(w => w.id === id) }

export function loadWins() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    const ids = raw ? JSON.parse(raw) : []
    // Drop ids from older builds so a renamed/removed win can't inflate
    // the count or crash getWin() lookups on an id that no longer exists.
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
