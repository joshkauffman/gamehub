// ── The Totally Scary Horror Game — achievements ───────────────────────
// Each check gets { run, journal, progress }: `run` is the live game state
// (or null in the lobby), `journal` the journal including this run so far,
// `progress` the saved profile. Checked a couple of times a second.
import { MONSTER_ORDER, JOURNAL } from './constants.js'

const caught = (j, id) => (j.entries[id]?.caught || 0) > 0
const dodged = (j, id) => (j.entries[id]?.dodged || 0) > 0
const faced = (j, id) => !!j.entries[id]?.faced
const REGULARS = MONSTER_ORDER.filter(id => JOURNAL[id].floor !== 'secret')

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🚪', name: 'First Steps', desc: 'Walk through door 001.', check: ({ run }) => run && run.maxRoom >= 1 && run.startFloor === 1 },
  { id: 'escape', icon: '🌙', name: 'Checked Out', desc: 'Escape the hotel.', check: ({ run }) => run?.won },
  { id: 'elevator', icon: '🛗', name: 'Going Down', desc: 'Ride the elevator down to Floor 2.', check: ({ run }) => run?.ev.elevator.phase === 'arrived' && (run.startFloor === 1 || run.startFloor === 2) },
  { id: 'shopper', icon: '🛍️', name: 'Window Shopper', desc: 'Buy something from Gloria.', check: ({ run }) => run?.bought > 0 },
  { id: 'costume', icon: '🥸', name: 'Dressed for the Job', desc: 'Fool a monster with a costume.', check: ({ run }) => run?.costumeSaves > 0 },
  { id: 'shelf', icon: '🤫', name: 'Shelf Life', desc: 'Find a secret room behind a gift-shop shelf.', check: ({ journal }) => faced(journal, 'mabel') || faced(journal, 'ollie') },
  { id: 'founder', icon: '🔥', name: 'Say Boo', desc: "Find the founder's secret in the lobby.", check: ({ journal }) => faced(journal, 'bea') },
  { id: 'secrets', icon: '🗝️', name: 'Keeper of Secrets', desc: 'Meet Mabel, Ollie, and Grandma Bea.', check: ({ journal }) => ['mabel', 'ollie', 'bea'].every(id => faced(journal, id)) },
  { id: 'listener', icon: '👂', name: 'Good Listener', desc: 'Get caught by 5 different monsters.', check: ({ journal }) => REGULARS.filter(id => caught(journal, id)).length >= 5 },
  { id: 'everyone', icon: '🫂', name: "Everyone's Friend", desc: 'Get caught by every single monster.', check: ({ journal }) => REGULARS.every(id => caught(journal, id)) },
  { id: 'untouchable', icon: '🙈', name: 'Untouchable', desc: 'Escape without getting caught even once.', check: ({ run }) => run?.won && run.catchCount === 0 },
  { id: 'nohide', icon: '🚫', name: 'Nowhere to Hide', desc: 'Escape without ever hiding in a closet.', check: ({ run }) => run?.won && run.hidCount === 0 },
  { id: 'balloons', icon: '🎈', name: 'Balloon Buster', desc: 'Pop 5 of Bubbles\' balloons (over all your runs).', check: ({ run, progress }) => progress.stats.popped + (run?.popped || 0) >= 5 },
  { id: 'rat', icon: '🐀', name: 'Rat Catcher', desc: 'Catch Nibbles and get your tips back.', check: ({ journal }) => caught(journal, 'nibbles') },
  { id: 'rich', icon: '💰', name: 'Big Tipper', desc: 'Hold 100 tips at once.', check: ({ run }) => run?.maxCoins >= 100 },
  { id: 'speedy', icon: '⚡', name: 'Speedy Checkout', desc: 'Escape both floors in under 15 minutes.', check: ({ run }) => run?.won && run.startFloor === 1 && run.elapsed < 900 },
  { id: 'cozy', icon: '🧸', name: 'Cozy Night', desc: 'Escape on Cozy.', check: ({ run }) => run?.won && run.difficulty === 'cozy' },
  { id: 'scary', icon: '😱', name: 'Totally Scary', desc: 'Escape on Totally Scary.', check: ({ run }) => run?.won && run.difficulty === 'scary' },
  { id: 'bats', icon: '🔦', name: 'Lights Out', desc: 'Get past the Gloombats.', check: ({ journal }) => dodged(journal, 'bernadette') },
  { id: 'wiggle', icon: '🧊', name: 'Wiggle Wiggle', desc: "Survive Yolanda's cold snap.", check: ({ journal }) => dodged(journal, 'yolanda') },
  { id: 'upstairs', icon: '🔓', name: 'Upstairs Access', desc: 'Unlock the attic (Floor 3).', check: ({ progress }) => progress.unlocks.floor3 },
  { id: 'rooftop', icon: '🏚️', name: 'Through the Roof', desc: 'Escape the attic onto the rooftop.', check: ({ run }) => run?.won && run.startFloor === 3 },
  { id: 'snail', icon: '🐌', name: 'Faster Than a Snail', desc: 'Escape the attic without Shelly ever catching you.', check: ({ run }) => run?.won && run.startFloor === 3 && !run.catchesById.shelly },
  { id: 'garden', icon: '🌙', name: 'Out of the Woods', desc: 'Escape through the garden gate.', check: ({ run }) => run?.won && run.startFloor === 4 },
  { id: 'harvest', icon: '🎃', name: 'Harvest Moon', desc: 'Defeat the Harvester.', check: ({ run }) => run?.bossDefeated },
  { id: 'flawless', icon: '🔥', name: 'Not a Scratch', desc: 'Defeat the Harvester without losing a single heart.', check: ({ run }) => run?.bossDefeated && run.bossFlawless },
  { id: 'moods', icon: '🧑‍🌾', name: 'Many Moods', desc: 'Get past the Gardener 5 times in one trip.', check: ({ run }) => (run?.dodgesById?.gardener || 0) >= 5 },
  { id: 'shortcut', icon: '🚪', name: 'Shortcut', desc: 'Fall through the back of a closet into a room further on.', check: ({ run }) => (run?.shortcuts || 0) > 0 },
  { id: 'summon', icon: '🌿', name: 'Say His Name', desc: 'Call the Gardener into the lobby. (Why would you do that?)', check: ({ progress }) => !!progress.stats.summoned },
  { id: 'found13', icon: '🩸', name: 'There Is No Floor 13', desc: 'Find the secret floor.', check: ({ progress }) => !!progress.unlocks.floor13 },
  { id: 'staffwing', icon: '🚪', name: 'Staff Only', desc: 'Escape the Staff Wing (Floor 13).', check: ({ run }) => run?.won && run.startFloor === 13 },
  { id: 'allatonce', icon: '😱', name: 'Everyone, All At Once', desc: 'Survive the great hall on Floor 13.', check: ({ run }) => !!run?.ev?.stampede?.done },
  { id: 'perfect13', icon: '💎', name: 'Not Even a Scratch', desc: 'Escape Floor 13 without losing a single heart.', check: ({ run }) => run?.won && run.startFloor === 13 && !run.heartsLost },
  { id: 'subfloor', icon: '⬛', name: 'Below the Bottom', desc: 'Escape Floor -A0001.', check: ({ run }) => run?.won && run.startFloor === -1 },
  { id: 'tea', icon: '🫖', name: 'Thursdays', desc: 'Hear what the Lamplighter has to say about the Gardener.', check: ({ run }) => !!run?.metLamplighter },
  { id: 'ferris', icon: '🎡', name: 'Top of the World', desc: 'Ride the Ferris wheel at the Moonlight Fair all the way to the top.', check: ({ progress }) => !!progress.stats.ferris },
  { id: 'fireworks', icon: '🎆', name: 'Ooooh, Aaaah', desc: 'Set off the fireworks at the Moonlight Fair.', check: ({ progress }) => !!progress.stats.fireworks },
  { id: 'fedworm', icon: '🍕', name: 'Please Stop Feeding the Worm', desc: 'It says so right on the notice board.', check: ({ progress }) => !!progress.stats.fedWorm },
  { id: 'photos', icon: '📷', name: 'Shutterbug', desc: 'Collect 10 monster photos.', check: ({ progress }) => Object.keys(progress.photos).length >= 10 },
  { id: 'album', icon: '🖼️', name: 'Full Album', desc: 'Collect a photo of every monster.', check: ({ progress }) => MONSTER_ORDER.every(id => progress.photos[id]) },
]

// Returns the achievements newly earned (not already in progress).
export function newlyEarned(ctx) {
  const out = []
  for (const a of ACHIEVEMENTS) {
    if (ctx.progress.achievements[a.id]) continue
    try { if (a.check(ctx)) out.push(a) } catch { /* a check that can't run yet just isn't earned */ }
  }
  return out
}
