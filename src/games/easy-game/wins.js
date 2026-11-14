// ── Easy Game — the secret wins ─────────────────────────────────────────
// The premise: a trophy sits right there, begging to be clicked. Clicking
// it never wins — it just tells you to find other ways. The real game is
// discovering the secret wins hidden in the ways you can interact with
// the page itself: mouse buttons and modifiers, timing windows, the
// keyboard, the window, the scrollbar, even leaving and coming back.
// Deliberately no hint system and no visible total during normal play —
// EasyGame.jsx never renders a placeholder for an unfound win or a
// "x / N" count, so the only way to know how many there are is to find
// all of them. The one deliberate backdoor: typing "cheater" opens a
// cheat sheet built from each win's `cheat` field below — an explicit,
// secret-code-gated escape hatch for anyone who's stuck, in the same
// spirit as the Konami code itself, not a contradiction of the no-hints
// rule for normal play.
//
// Pure data + localStorage helpers, no React and no DOM-event logic —
// EasyGame.jsx owns the detectors, this file owns what they're detecting,
// how a found win is described back to the player (`blurb`), and how to
// pull it off if you ask nicely (`cheat`).

export const SAVE_KEY = 'easy-game-wins-v1'

export const WINS = [
  {
    id: 'persist',
    name: 'Sheer Persistence',
    blurb: 'You were told, repeatedly, that the trophy was not the answer. You clicked it ten times anyway. Respect.',
    cheat: 'Click the trophy. Ten times, plain clicks, no modifier keys.',
  },
  {
    id: 'rightclick',
    name: 'The Other Button',
    blurb: 'Right-clicking: the oldest secret passage in software.',
    cheat: 'Right-click the trophy.',
  },
  {
    id: 'middleclick',
    name: 'The Button Nobody Uses',
    blurb: "Your mouse has a third button and you found a use for it. We're as surprised as you are.",
    cheat: "Click the trophy with your mouse's middle (scroll-wheel) button.",
  },
  {
    id: 'altclick',
    name: 'Alt Ending',
    blurb: 'Alt plus a click. A whole different outcome, for the price of one extra finger.',
    cheat: 'Hold Alt and click the trophy.',
  },
  {
    id: 'ctrlclick',
    name: 'Admin Override',
    blurb: 'Ctrl (or Cmd, we see you, Mac users) plus a click. You went around the front door entirely.',
    cheat: 'Hold Ctrl (Cmd on a Mac) and click the trophy.',
  },
  {
    id: 'shiftclick',
    name: 'Shift Work',
    blurb: 'Shift plus a click. Somewhere, a manager is impressed.',
    cheat: 'Hold Shift and click the trophy.',
  },
  {
    id: 'tripleclick',
    name: 'Triple Threat',
    blurb: 'Three clicks, fast, no gap. Not angry — just thorough.',
    cheat: 'Click the trophy three times fast, within about half a second.',
  },
  {
    id: 'hold',
    name: 'The Long Press',
    blurb: 'You held on. The trophy got uncomfortable. You win.',
    cheat: 'Press down on the trophy and hold it for about 3 seconds.',
  },
  {
    id: 'goldilocks',
    name: 'Just Right',
    blurb: "Not a quick click. Not a long hold. You found the one duration in between that actually does something.",
    cheat: "Press the trophy and hold for about 1 second — longer than a click, well short of the long-press win — then let go.",
  },
  {
    id: 'drag',
    name: 'Trophy Thief',
    blurb: "You simply dragged the trophy off its pedestal and took it. Nobody stopped you.",
    cheat: 'Press the trophy and drag it well clear of its pedestal before releasing.',
  },
  {
    id: 'shake',
    name: 'Shake It Loose',
    blurb: 'You shook the cursor so hard something fell out of the page.',
    cheat: 'Shake the mouse rapidly back and forth anywhere on the page for a second or so.',
  },
  {
    id: 'hover',
    name: 'Window Shopping',
    blurb: "You hovered over the trophy for a long time without ever clicking it. The trophy noticed. It's flattered.",
    cheat: 'Rest the cursor on the trophy without pressing anything, for about 6 seconds.',
  },
  {
    id: 'spell',
    name: 'Spell It Out',
    blurb: 'You just typed what you wanted and the game obliged. Direct communication works.',
    cheat: 'Type the letters I, W, I, N, in that order.',
  },
  {
    id: 'konami',
    name: 'The Old Code',
    blurb: 'Up Up Down Down Left Right Left Right B A. It still works. It will always work.',
    cheat: '↑ ↑ ↓ ↓ ← → ← → B A.',
  },
  {
    id: 'escape3',
    name: 'Tactical Retreat',
    blurb: 'You hit Escape three times, fast, like something was actually chasing you. Nothing was. You still won.',
    cheat: 'Press Escape three times fast, within about 2 seconds.',
  },
  {
    id: 'ctrlS',
    name: 'Nothing To Save',
    blurb: "You tried to save the page. There was nothing to save. The gesture alone counted.",
    cheat: 'Press Ctrl+S (Cmd+S on a Mac) anywhere on the page.',
  },
  {
    id: 'title',
    name: 'Read It Twice',
    blurb: 'You double-clicked the title. The title double-clicked back.',
    cheat: 'Double-click the "EASY GAME" title.',
  },
  {
    id: 'tab',
    name: 'The Invisible Button',
    blurb: 'There was a button there the whole time. Tab found it. It just needed pressing.',
    cheat: 'Press Tab repeatedly until a hidden button appears on screen, then press Enter or Space.',
  },
  {
    id: 'secretword',
    name: 'The Magic Word',
    blurb: 'Tab found a second invisible thing. You typed the word it wanted. Manners, it turns out, matter.',
    cheat: "Keep pressing Tab past the hidden button, until a hidden text field appears, and type \"please\" into it.",
  },
  {
    id: 'basement',
    name: 'The Basement',
    blurb: 'You scrolled past the end of the game and found where it keeps its junk.',
    cheat: 'Scroll all the way down, past the end of the visible game.',
  },
  {
    id: 'roundtrip',
    name: 'There and Back Again',
    blurb: 'All the way down, all the way back up, before you could change your mind. A round trip, timed.',
    cheat: 'Scroll down to the basement, then scroll all the way back to the top within about 4 seconds.',
  },
  {
    id: 'resize',
    name: 'Reshape Reality',
    blurb: 'You resized the window. The game, technically, had no defense against this.',
    cheat: 'Resize the browser window noticeably — bigger or smaller.',
  },
  {
    id: 'blank',
    name: 'Nihilist',
    blurb: "You clicked on nothing. Repeatedly. On purpose. There was never anything there. That was the point.",
    cheat: 'Click on empty background space (not the trophy, not any text or button) seven times.',
  },
  {
    id: 'rage',
    name: 'Rage Quit',
    blurb: "You clicked fast and a lot, like the game owed you money. It noticed. It respects the energy.",
    cheat: 'Click anywhere on the page six times, fast, within about a second and a half.',
  },
  {
    id: 'away',
    name: 'The Return',
    blurb: 'You left. Properly left — another tab, another app. Then you came back. The game waited.',
    cheat: 'Switch to another browser tab or app for at least 4 seconds, then come back to this one.',
  },
  {
    id: 'devtools',
    name: 'We See You',
    blurb: "You opened the inspector to peek behind the curtain. We know. We've always known.",
    cheat: "Open your browser's developer tools / inspector panel.",
  },
  {
    id: 'idle',
    name: 'Patience',
    blurb: 'You stopped touching anything at all and the game blinked first.',
    cheat: "Don't touch the mouse, keyboard, or scrollbar at all for 20 seconds.",
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
