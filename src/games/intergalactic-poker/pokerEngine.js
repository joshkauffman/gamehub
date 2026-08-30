// ── Intergalactic Poker — pure card/hand/AI logic ───────────────────────
// A 5-card-draw poker variant, reskinned with an original "dimension"
// theme instead of standard suits, plus one wild card. Framework-agnostic
// (plain data, no React) so it can be playtested headlessly with a Node
// script — poker hand evaluation is exactly the kind of fiddly, easy-to-
// get-subtly-wrong logic this hub's other games extract into a pure,
// testable module for.
//
// Standard poker hand rankings and 5-card-draw structure are public-
// domain game rules — the "dimension" suits, the wild Eye card, the
// betting-limit numbers, and the AI heuristics here are original.

export const SUITS = [
  { key: 'rift', icon: '🔺', label: 'Rift', color: '#ff5d3d' },
  { key: 'eye', icon: '👁', label: 'Eye', color: '#8a4fff' },
  { key: 'warp', icon: '🌀', label: 'Warp', color: '#4fc3ff' },
  { key: 'static', icon: '⚡', label: 'Static', color: '#ffd23f' },
]
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]))
export function rankValue(r) { return RANK_VALUE[r] }

export const HAND_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush',
  'Full House', 'Four of a Kind', 'Straight Flush', 'Five of a Kind',
]

export const ANTE = 10
export const BET_UNIT = 20
export const MAX_RAISES = 3
export const STARTING_STACK = 300
export const MAX_DISCARDS = 3

export function buildDeck() {
  const deck = []
  SUITS.forEach(s => RANKS.forEach(r => deck.push({ id: `${s.key}-${r}`, rank: r, suit: s.key, wild: false })))
  deck.push({ id: 'eye-wild', rank: null, suit: null, wild: true })
  return deck
}

export function shuffle(deck) {
  const d = deck.slice()
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// Evaluates exactly 5 non-wild cards. Returns { category (0-9), tiebreak: [values...] }.
function evaluateFiveCards(cards) {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a)
  const isFlush = cards.every(c => c.suit === cards[0].suit)
  const counts = {}
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v)
  const uniqueSorted = [...new Set(values)].sort((a, b) => b - a)

  let isStraight = false, straightHigh = 0
  if (uniqueSorted.length === 5) {
    if (uniqueSorted[0] - uniqueSorted[4] === 4) { isStraight = true; straightHigh = uniqueSorted[0] }
    else if (uniqueSorted.join(',') === '14,5,4,3,2') { isStraight = true; straightHigh = 5 } // wheel: A-2-3-4-5
  }

  const pattern = groups.map(g => g.c).join('')
  if (pattern === '5') return { category: 9, tiebreak: [groups[0].v] }
  if (isStraight && isFlush) return { category: 8, tiebreak: [straightHigh] }
  if (pattern === '41') return { category: 7, tiebreak: [groups[0].v, groups[1].v] }
  if (pattern === '32') return { category: 6, tiebreak: [groups[0].v, groups[1].v] }
  if (isFlush) return { category: 5, tiebreak: values }
  if (isStraight) return { category: 4, tiebreak: [straightHigh] }
  if (pattern === '311') return { category: 3, tiebreak: [groups[0].v, ...groups.slice(1).map(g => g.v)] }
  if (pattern === '221') return { category: 2, tiebreak: [groups[0].v, groups[1].v, groups[2].v] }
  if (pattern === '2111') return { category: 1, tiebreak: [groups[0].v, ...groups.slice(1).map(g => g.v)] }
  return { category: 0, tiebreak: values }
}

export function compareEval(a, b) {
  if (a.category !== b.category) return a.category - b.category
  const len = Math.max(a.tiebreak.length, b.tiebreak.length)
  for (let i = 0; i < len; i++) {
    const av = a.tiebreak[i] || 0, bv = b.tiebreak[i] || 0
    if (av !== bv) return av - bv
  }
  return 0
}

// A hand may include one wild card — try every real substitution and keep
// the best result. 52 trials is trivial at this scale (a handful of
// evaluations per betting decision, not a hot loop).
export function evaluateHand(cards) {
  const wildIdx = cards.findIndex(c => c.wild)
  if (wildIdx === -1) return evaluateFiveCards(cards)
  let best = null
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const trial = cards.slice()
      trial[wildIdx] = { rank, suit: suit.key, wild: false }
      const result = evaluateFiveCards(trial)
      if (!best || compareEval(result, best) > 0) best = result
    }
  }
  return best
}

// Normalized 0..1 strength estimate for AI decisions — doesn't need to be
// perfectly calibrated, just a reasonable heuristic for a fun minigame.
export function handStrength(evalResult) {
  return Math.min(1, (evalResult.category + (evalResult.tiebreak[0] || 0) / 14) / 9)
}

// Which of Bill's cards to discard: always keep the wild, keep anything
// that's part of a pair/trip/quad, and among the rest discard the lowest
// (up to MAX_DISCARDS) — a simple, standard 5-card-draw heuristic.
export function billDiscardChoice(hand) {
  const counts = {}
  hand.forEach(c => { if (!c.wild) counts[c.rank] = (counts[c.rank] || 0) + 1 })
  const singles = hand
    .map((c, i) => ({ i, c }))
    .filter(({ c }) => !c.wild && counts[c.rank] === 1)
    .sort((a, b) => rankValue(a.c.rank) - rankValue(b.c.rank))
  const discardIdx = new Set(singles.slice(0, MAX_DISCARDS).map(x => x.i))
  return hand.map((_, i) => discardIdx.has(i))
}

// Bill's betting decision. `toCall` = chips he'd need to add to match the
// player's contribution this betting round; 0 means it's a fresh action
// (check-or-bet spot). BLUFF_CHANCE governs how often he bets/calls with
// a weak hand — his whole personality is being an unreliable narrator.
const BLUFF_CHANCE = 0.15
export function billBetDecision({ strength, toCall, raises }) {
  const bluff = Math.random() < BLUFF_CHANCE
  if (toCall === 0) {
    if (strength > 0.55 || bluff) return 'bet'
    return 'check'
  }
  if (strength > 0.8 && raises < MAX_RAISES) return Math.random() < 0.6 ? 'raise' : 'call'
  if (strength > 0.32 || bluff) return 'call'
  return 'fold'
}

// Hard mode: tighter, more aggressive thresholds — bets and raises with
// hands the normal AI would just call with, and is much harder to bluff
// off a decent hand. Same rules, same bet sizes, just sharper reads.
const HARD_BLUFF_CHANCE = 0.2
export function billBetDecisionHard({ strength, toCall, raises }) {
  const bluff = Math.random() < HARD_BLUFF_CHANCE
  if (toCall === 0) {
    if (strength > 0.4 || bluff) return 'bet'
    return 'check'
  }
  if (strength > 0.62 && raises < MAX_RAISES) return Math.random() < 0.75 ? 'raise' : 'call'
  if (strength > 0.22 || bluff) return 'call'
  return 'fold'
}

// Hard mode's discard choice: on top of keeping pairs/trips/the wild, also
// recognizes a 4-card flush or open-ended straight draw (something the
// normal heuristic doesn't look for at all) and draws to it instead of
// just shedding low singles — a meaningfully stronger read on the hand.
export function billDiscardChoiceHard(hand) {
  const counts = {}
  hand.forEach(c => { if (!c.wild) counts[c.rank] = (counts[c.rank] || 0) + 1 })
  const hasPairOrBetter = Object.values(counts).some(c => c >= 2)
  const wildIdx = hand.findIndex(c => c.wild)
  const nonWild = hand.map((c, i) => ({ c, i })).filter(({ c }) => !c.wild)

  if (!hasPairOrBetter) {
    const bySuit = {}
    nonWild.forEach(({ c, i }) => { (bySuit[c.suit] = bySuit[c.suit] || []).push(i) })
    const bestSuitGroup = Object.values(bySuit).sort((a, b) => b.length - a.length)[0]
    if (bestSuitGroup && bestSuitGroup.length >= 4) {
      const keep = new Set(bestSuitGroup)
      if (wildIdx !== -1) keep.add(wildIdx)
      return hand.map((_, i) => !keep.has(i))
    }
    const sortedVals = nonWild.map(({ c, i }) => ({ v: rankValue(c.rank), i })).sort((a, b) => a.v - b.v)
    const uniqueVals = [...new Map(sortedVals.map(x => [x.v, x])).values()]
    for (let start = 0; start + 3 < uniqueVals.length; start++) {
      const window = uniqueVals.slice(start, start + 4)
      if (window[3].v - window[0].v === 3) {
        const keep = new Set(window.map(w => w.i))
        if (wildIdx !== -1) keep.add(wildIdx)
        return hand.map((_, i) => !keep.has(i))
      }
    }
  }
  return billDiscardChoice(hand)
}

// ── Solo-mode Bill flavor text ──────────────────────────────────────────
// billAiTurn is solo-only (online opponent actions always flow through
// applyOpponentAction directly with generic "Opponent ..." text, since
// there's a real person on the other end) — safe to bake Bill's voice in
// here without it ever leaking into a match against a friend.
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

const BILL_LINES = {
  normal: {
    bet: ['Bill bets {amt}. "Care to find out?"', 'Bill slides {amt} in without even looking at his cards.', 'Bill bets {amt}, grinning wider than is physically reasonable.'],
    raise: ['Bill raises! "Getting nervous yet?"', 'Bill raises. "This is the fun part."', 'Bill raises, laughing in at least three octaves at once.'],
    call: ['Bill calls. "I\'m listening."', 'Bill calls without a flicker of hesitation.'],
    check: ['Bill checks. "Your move."', 'Bill checks, humming something off-key and off-dimension.'],
    fold: ['Bill folds. "...This round doesn\'t count."', 'Bill folds, muttering something about "rigged" dimensions.'],
  },
  hard: {
    bet: ['Bill bets {amt}. He isn\'t smiling anymore.', 'Bill bets {amt} flatly, eye narrowed to a slit.', 'Bill bets {amt}. "Sit down. Adults are talking."'],
    raise: ['Bill raises. "You\'re not ready for this."', 'Bill raises without a word — that\'s worse than the talking.', 'Bill raises. The static in the air gets sharper.'],
    call: ['Bill calls instantly. He already knows.', 'Bill calls. "Cute."'],
    check: ['Bill checks. Patient. Precise. Furious.', 'Bill checks, tracking every card you\'ve touched.'],
    fold: ['Bill folds — barely. "Next one\'s mine."', 'Bill folds, and the temperature in the cell drops a few degrees.'],
  },
}

// ── Table state machine ─────────────────────────────────────────────────
// Mode-agnostic: the same functions drive solo-vs-Bill (opponent actions
// chosen by billBetDecision/billDiscardChoice) and online play (opponent
// actions arrive over the network as plain {type,...} messages and get
// applied through the exact same appliers) — the only difference is WHO
// decides the opponent's move, never how it's resolved. "player" always
// means "the person running this table locally"; in online play that's
// the host's own seat, and the guest's table is a perspective-swapped
// mirror of the host's (see perspectiveSwap) so the same fields always
// mean "you" vs "them" regardless of which human is on which side.
export function newTable(stacks, round, difficulty = 'normal') {
  const deck = shuffle(buildDeck())
  const playerHand = deck.splice(0, 5)
  const billHand = deck.splice(0, 5)
  const s = { ...stacks }
  const postP = Math.min(ANTE, s.player)
  const postB = Math.min(ANTE, s.bill)
  s.player -= postP; s.bill -= postB
  return {
    round, difficulty, stacks: s, deck, playerHand, billHand,
    pot: postP + postB,
    contrib: { player: 0, bill: 0 },
    acted: { player: false, bill: false },
    drawn: { player: false, bill: false },
    raises: 0,
    phase: 'bet1', turn: 'player',
    handsRevealed: false,
    playerEval: null, billEval: null,
    log: [{ text: `Round ${round}: new hand dealt. Ante of ${ANTE} posted.`, kind: 'info', id: Math.random() }],
  }
}

export function withLog(table, text, kind = 'info') {
  return { ...table, log: [{ text, kind, id: Math.random() }, ...table.log].slice(0, 6) }
}

// A player who's hit 0 chips can't act again — no side pots here, so once
// either side is all-in, the round is over no matter what the other side
// still owes (a short-stacked bet/raise capped below a full call is
// otherwise a state neither side can ever "complete" through normal
// matching, since the short side literally has nothing left to add).
function roundComplete(t) {
  if (t.stacks.player <= 0 || t.stacks.bill <= 0) return true
  return t.contrib.player === t.contrib.bill && t.acted.player && t.acted.bill
}

function startDraw(t) {
  return withLog(
    {
      ...t, phase: 'draw', turn: null, drawn: { player: false, bill: false },
      raises: 0, contrib: { player: 0, bill: 0 }, acted: { player: false, bill: false },
    },
    'Betting settled. Time to trade cards — pick up to 3 to swap.',
  )
}

export function startShowdown(t) {
  const playerEval = evaluateHand(t.playerHand)
  const billEval = evaluateHand(t.billHand)
  const cmp = compareEval(playerEval, billEval)
  const stacks = { ...t.stacks }
  let text, kind
  if (cmp > 0) {
    stacks.player += t.pot
    text = `You win with a ${HAND_NAMES[playerEval.category]}! (Opponent had a ${HAND_NAMES[billEval.category]}.) Pot: ${t.pot} Secrets.`
    kind = 'good'
  } else if (cmp < 0) {
    stacks.bill += t.pot
    text = `Opponent wins with a ${HAND_NAMES[billEval.category]}. (You had a ${HAND_NAMES[playerEval.category]}.) Pot: ${t.pot} Secrets.`
    kind = 'bad'
  } else {
    const half = Math.floor(t.pot / 2)
    stacks.player += half; stacks.bill += t.pot - half
    text = `Tie! Both show a ${HAND_NAMES[playerEval.category]}. Pot splits.`
    kind = 'info'
  }
  return withLog({ ...t, stacks, pot: 0, phase: 'handOver', playerEval, billEval, handsRevealed: true }, text, kind)
}

function afterBettingAction(t) {
  if (!roundComplete(t)) return t
  if (t.phase === 'bet1') return startDraw(t)
  if (t.phase === 'bet2') return startShowdown(t)
  return t
}

export function resolveFold(t, who) {
  const winner = who === 'player' ? 'bill' : 'player'
  const stacks = { ...t.stacks, [winner]: t.stacks[winner] + t.pot }
  const text = who === 'player' ? `You fold. Opponent takes the pot of ${t.pot}.` : `Opponent folds! You take the pot of ${t.pot}.`
  return withLog({ ...t, stacks, pot: 0, phase: 'handOver' }, text, who === 'player' ? 'bad' : 'good')
}

// ── "Player" (the local seat) betting actions ───────────────────────────
export function playerCheck(t) {
  if (t.contrib.player !== t.contrib.bill) return t
  return withLog({ ...t, acted: { ...t.acted, player: true }, turn: 'bill' }, 'You check.')
}
export function playerBet(t) {
  if (t.contrib.player !== 0 || t.contrib.bill !== 0) return t
  const amt = Math.min(BET_UNIT, t.stacks.player)
  const next = {
    ...t,
    stacks: { ...t.stacks, player: t.stacks.player - amt },
    contrib: { ...t.contrib, player: t.contrib.player + amt },
    pot: t.pot + amt,
    acted: { player: true, bill: false },
    turn: 'bill',
  }
  return afterBettingAction(withLog(next, `You bet ${amt} Secrets.`))
}
export function playerCall(t) {
  const need = t.contrib.bill - t.contrib.player
  if (need <= 0) return t
  const amt = Math.min(need, t.stacks.player)
  const next = {
    ...t,
    stacks: { ...t.stacks, player: t.stacks.player - amt },
    contrib: { ...t.contrib, player: t.contrib.player + amt },
    pot: t.pot + amt,
    acted: { ...t.acted, player: true },
    turn: 'bill',
  }
  return afterBettingAction(withLog(next, 'You call.'))
}
export function playerRaise(t) {
  if (t.raises >= MAX_RAISES) return t
  const need = (t.contrib.bill - t.contrib.player) + BET_UNIT
  const amt = Math.min(need, t.stacks.player)
  const next = {
    ...t,
    stacks: { ...t.stacks, player: t.stacks.player - amt },
    contrib: { ...t.contrib, player: t.contrib.player + amt },
    pot: t.pot + amt,
    raises: t.raises + 1,
    acted: { player: true, bill: false },
    turn: 'bill',
  }
  return afterBettingAction(withLog(next, `You raise to ${t.contrib.bill + amt}!`))
}
export function playerFold(t) { return resolveFold(t, 'player') }

// ── Opponent-side action resolution (mode-agnostic) ─────────────────────
// `action` is one of 'check'|'bet'|'call'|'raise'|'fold', however it was
// decided (AI heuristic for solo play, or a network message in online
// play). This function only resolves it — it never decides it.
export function applyOpponentAction(t, action) {
  if (action === 'fold') return resolveFold(t, 'bill')
  if (action === 'check') {
    if (t.contrib.player !== t.contrib.bill) return t
    return afterBettingAction(withLog({ ...t, acted: { ...t.acted, bill: true }, turn: 'player' }, 'Opponent checks.'))
  }
  if (action === 'bet') {
    if (t.contrib.player !== 0 || t.contrib.bill !== 0) return t
    const amt = Math.min(BET_UNIT, t.stacks.bill)
    const next = {
      ...t,
      stacks: { ...t.stacks, bill: t.stacks.bill - amt },
      contrib: { ...t.contrib, bill: t.contrib.bill + amt },
      pot: t.pot + amt,
      acted: { player: false, bill: true },
      turn: 'player',
    }
    return afterBettingAction(withLog(next, `Opponent bets ${amt} Secrets.`, 'bad'))
  }
  if (action === 'call') {
    const toCall = t.contrib.player - t.contrib.bill
    if (toCall <= 0) return t
    const amt = Math.min(toCall, t.stacks.bill)
    const next = {
      ...t,
      stacks: { ...t.stacks, bill: t.stacks.bill - amt },
      contrib: { ...t.contrib, bill: t.contrib.bill + amt },
      pot: t.pot + amt,
      acted: { ...t.acted, bill: true },
      turn: 'player',
    }
    return afterBettingAction(withLog(next, 'Opponent calls.'))
  }
  if (action === 'raise') {
    if (t.raises >= MAX_RAISES) return t
    const toCall = t.contrib.player - t.contrib.bill
    const amt = Math.min(toCall + BET_UNIT, t.stacks.bill)
    const next = {
      ...t,
      stacks: { ...t.stacks, bill: t.stacks.bill - amt },
      contrib: { ...t.contrib, bill: t.contrib.bill + amt },
      pot: t.pot + amt,
      raises: t.raises + 1,
      acted: { player: false, bill: true },
      turn: 'player',
    }
    return afterBettingAction(withLog(next, 'Opponent raises!', 'bad'))
  }
  return t
}

// The AI's whole turn: decide, then resolve through the same applier a
// network opponent's move would go through, then swap in Bill's own voice
// for the log line this action just produced (safe to do here specifically
// — billAiTurn only ever runs in solo mode; a real online opponent's moves
// never pass through it).
export function billAiTurn(t) {
  if (t.phase !== 'bet1' && t.phase !== 'bet2') return t
  const difficulty = t.difficulty === 'hard' ? 'hard' : 'normal'
  const strength = handStrength(evaluateHand(t.billHand))
  const toCall = t.contrib.player - t.contrib.bill
  const decide = difficulty === 'hard' ? billBetDecisionHard : billBetDecision
  const action = decide({ strength, toCall, raises: t.raises })
  const next = applyOpponentAction(t, action)
  if (next === t) return next
  const pool = BILL_LINES[difficulty][action]
  if (!pool) return next
  let text = pick(pool)
  if (action === 'bet') text = text.replace('{amt}', String(Math.min(BET_UNIT, t.stacks.bill)))
  else if (action === 'raise') text = text.replace('{amt}', String(Math.min(toCall + BET_UNIT, t.stacks.bill)))
  else if (action === 'fold') text = `${text} You take the pot of ${t.pot}.`
  return { ...next, log: [{ ...next.log[0], text }, ...next.log.slice(1)] }
}

// ── Draw phase (mode-agnostic) ──────────────────────────────────────────
function maybeStartBet2(t) {
  if (t.drawn.player && t.drawn.bill) return { ...t, phase: 'bet2', turn: 'player' }
  return t
}
export function applyPlayerDraw(t, discardIndices) {
  const deck = t.deck.slice()
  const playerHand = t.playerHand.map((c, i) => (discardIndices.has(i) ? deck.shift() : c))
  const n = discardIndices.size
  const next = { ...t, deck, playerHand, drawn: { ...t.drawn, player: true } }
  return maybeStartBet2(withLog(next, `You trade ${n} card${n === 1 ? '' : 's'}.`))
}
export function applyOpponentDraw(t, discardIndices) {
  const deck = t.deck.slice()
  const billHand = t.billHand.map((c, i) => (discardIndices.has(i) ? deck.shift() : c))
  const n = discardIndices.size
  const next = { ...t, deck, billHand, drawn: { ...t.drawn, bill: true } }
  return maybeStartBet2(withLog(next, `Opponent trades ${n} card${n === 1 ? '' : 's'}.`))
}
// Solo mode: resolve both draws in one synchronous step (AI doesn't need
// to "wait its turn" the way a network opponent does).
export function resolveSoloDraw(t, playerDiscardIndices) {
  let next = applyPlayerDraw(t, playerDiscardIndices)
  const discardFn = t.difficulty === 'hard' ? billDiscardChoiceHard : billDiscardChoice
  const billMask = discardFn(next.billHand)
  const billIndices = new Set(billMask.map((v, i) => (v ? i : null)).filter(v => v !== null))
  next = applyOpponentDraw(next, billIndices)
  return next
}

// ── Online play: perspective + redaction ────────────────────────────────
// The host's table is authoritative; everything above resolves actions
// from the host's own point of view ("player" = host, "bill" = opponent).
// The guest never runs any of that — it only ever displays a redacted,
// perspective-swapped copy of whatever the host broadcasts, and sends its
// chosen actions back as plain messages for the host to resolve.

// Hides the host's own hand from what gets sent to the guest, unless the
// hand has been revealed (showdown). The guest's own hand (stored in
// `billHand` from the host's point of view) is always sent in full — the
// guest has no deck of its own; the host dealt those cards.
export function redactForGuest(t) {
  if (t.handsRevealed) return t
  return { ...t, playerHand: t.playerHand.map(c => ({ id: c.id, hidden: true })) }
}

// Swaps every "player"/"bill" pair so the guest's local table means the
// same thing solo/host tables do: `playerHand` is always "my own hand".
export function perspectiveSwap(t) {
  return {
    ...t,
    stacks: { player: t.stacks.bill, bill: t.stacks.player },
    contrib: { player: t.contrib.bill, bill: t.contrib.player },
    acted: { player: t.acted.bill, bill: t.acted.player },
    drawn: { player: t.drawn.bill, bill: t.drawn.player },
    turn: t.turn === 'player' ? 'bill' : t.turn === 'bill' ? 'player' : t.turn,
    playerHand: t.billHand,
    billHand: t.playerHand,
    playerEval: t.billEval,
    billEval: t.playerEval,
  }
}
