// ── Kaboom Corral — rules engine ──────────────────────────────────────
// A from-scratch card game in the spirit of Exploding Kittens, reskinned
// with an original woodland-critter theme. Pure, framework-agnostic state
// machine: every mutation goes through applyAction(state, action) and
// returns a brand new state (plus optional private info meant for exactly
// one player's eyes, e.g. a Peek result). No React, no networking — those
// layers call in from KaboomCorral.jsx / network.js.
//
// Only ONE copy of this engine ever runs per game: the local device in
// Local/CPU modes, or the host's device in Online mode. Everyone else only
// ever renders a redacted "view" of the host's state (see buildView) and
// sends back action intents — this sidesteps an entire class of
// state-sync bugs since there is exactly one source of truth.

// bg/edge give every card type its own printed-card color scheme (a
// top-to-bottom gradient plus a matching border), so the deck reads like a
// real illustrated card set rather than a pile of identical gray buttons.
export const CARD_TYPES = {
  kaboom: { name: 'KABOOM!', emoji: '💥', blurb: "You're out — unless you have a Shield.", bg: '#c0392b', edge: '#4a0e08' },
  shield: { name: 'Shield', emoji: '🛡️', blurb: 'Defuses a KABOOM. Hide it back in the deck.', bg: '#2f6fa8', edge: '#0f2a40' },
  skip: { name: 'Skip', emoji: '⏭️', blurb: 'End your turn without drawing.', bg: '#2f9e8f', edge: '#0f3d37' },
  attack: { name: 'Double', emoji: '⚔️', blurb: 'Skip your draw. Next player takes 2 turns.', bg: '#d9691f', edge: '#5c2a0c' },
  shuffle: { name: 'Shuffle', emoji: '🔀', blurb: 'Shuffle the draw pile.', bg: '#8352c9', edge: '#2f1a52' },
  peek: { name: 'Peek', emoji: '🔮', blurb: 'Look at the top 3 cards of the deck.', bg: '#5b4fc4', edge: '#211a4d' },
  swap: { name: 'Swap', emoji: '🤝', blurb: 'Take a random card from another player.', bg: '#c9a227', edge: '#4d3b0d' },
  'critter-fox': { name: 'Fox', emoji: '🦊', blurb: 'Match 2 to steal a card from someone.', bg: '#c97a3d', edge: '#5c3517' },
  'critter-owl': { name: 'Owl', emoji: '🦉', blurb: 'Match 2 to steal a card from someone.', bg: '#8c6b45', edge: '#3d2c17' },
  'critter-squirrel': { name: 'Squirrel', emoji: '🐿️', blurb: 'Match 2 to steal a card from someone.', bg: '#b5842a', edge: '#4a3510' },
  'critter-hedgehog': { name: 'Hedgehog', emoji: '🦔', blurb: 'Match 2 to steal a card from someone.', bg: '#7a6a52', edge: '#332c1f' },
  'critter-turtle': { name: 'Turtle', emoji: '🐢', blurb: 'Match 2 to steal a card from someone.', bg: '#3d8c5a', edge: '#173d26' },
}
export const CRITTER_TYPES = ['critter-fox', 'critter-owl', 'critter-squirrel', 'critter-hedgehog', 'critter-turtle']
export const AVATARS = ['🦊', '🦉', '🐿️', '🦔', '🐢', '🦝', '🐇', '🦫']

let uid = 0
function nextId() { uid += 1; return `c${uid}` }
function makeCard(type) { return { id: nextId(), type } }

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Deck construction & dealing (mirrors the classic EK setup ritual:
// deal a regular hand + 1 guaranteed Shield to each player, then shuffle
// the leftovers plus (playerCount - 1) KABOOMs into the draw pile) ──────
function buildActionPool() {
  const counts = { skip: 4, attack: 4, shuffle: 4, peek: 5, swap: 4 }
  const pool = []
  Object.entries(counts).forEach(([type, n]) => { for (let i = 0; i < n; i++) pool.push(makeCard(type)) })
  CRITTER_TYPES.forEach(type => { for (let i = 0; i < 4; i++) pool.push(makeCard(type)) })
  return pool
}

export function createGame(players) {
  const pool = shuffle(buildActionPool())
  const hands = players.map(() => [])
  const HAND_SIZE = 7
  for (let i = 0; i < HAND_SIZE; i++) {
    players.forEach((_, pi) => { const card = pool.pop(); if (card) hands[pi].push(card) })
  }
  const shields = shuffle(Array.from({ length: 6 }, () => makeCard('shield')))
  players.forEach((_, pi) => { const s = shields.pop(); if (s) hands[pi].push(s) })
  const kabooms = Array.from({ length: Math.max(1, players.length - 1) }, () => makeCard('kaboom'))
  const drawPile = shuffle([...pool, ...shields, ...kabooms])

  return {
    players: players.map((p, i) => ({ ...p, hand: hands[i], alive: true })),
    drawPile,
    discardPile: [],
    activeIndex: 0,
    owed: 1,
    pending: null, // { type: 'insertKaboom', playerId, kaboomCard }
    log: [`${players[0].name} goes first.`],
    winnerId: null,
    turn: 0,
  }
}

function clone(state) {
  return {
    ...state,
    players: state.players.map(p => ({ ...p, hand: p.hand.slice() })),
    drawPile: state.drawPile.slice(),
    discardPile: state.discardPile.slice(),
    log: state.log.slice(),
  }
}

function pushLog(state, line) { state.log.push(line); if (state.log.length > 40) state.log.shift() }

function findPlayer(state, id) { return state.players.find(p => p.id === id) }
function alivePlayers(state) { return state.players.filter(p => p.alive) }

function nextAliveIndex(state, fromIndex) {
  const n = state.players.length
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n
    if (state.players[idx].alive) return idx
  }
  return fromIndex
}

// Ends the current draw-obligation cycle: if more draws are owed, the same
// player goes again; otherwise play passes to the next living player.
function settleTurn(state, drawsJustConsumed = 1) {
  state.owed = Math.max(0, state.owed - drawsJustConsumed)
  if (state.owed > 0) return
  if (alivePlayers(state).length <= 1) return
  state.activeIndex = nextAliveIndex(state, state.activeIndex)
  state.owed = 1
  state.turn += 1
}

function checkForWinner(state) {
  const alive = alivePlayers(state)
  if (alive.length === 1) state.winnerId = alive[0].id
}

function removeCard(hand, cardId) {
  const idx = hand.findIndex(c => c.id === cardId)
  if (idx === -1) return null
  return hand.splice(idx, 1)[0]
}

function stealRandomCard(state, fromId, toId) {
  const from = findPlayer(state, fromId)
  const to = findPlayer(state, toId)
  if (!from || !to || from.hand.length === 0) return null
  const idx = Math.floor(Math.random() * from.hand.length)
  const [card] = from.hand.splice(idx, 1)
  to.hand.push(card)
  return card
}

// action: { type, playerId, ...payload }
// Returns { state, private } — `private` is { forPlayerId, kind, payload }
// for information (like a Peek result) that must never be broadcast to
// anyone but the acting player.
export function applyAction(prevState, action) {
  const state = clone(prevState)
  const actor = findPlayer(state, action.playerId)
  let priv = null

  if (state.winnerId) return { state: prevState, private: null, error: 'Game already over.' }
  if (!actor || !actor.alive) return { state: prevState, private: null, error: 'Unknown or eliminated player.' }

  if (state.pending) {
    if (action.type !== 'INSERT_POSITION' || state.pending.playerId !== action.playerId) {
      return { state: prevState, private: null, error: 'A defuse placement is pending.' }
    }
  } else if (state.players[state.activeIndex].id !== action.playerId) {
    return { state: prevState, private: null, error: "It's not your turn." }
  }

  switch (action.type) {
    case 'PLAY_CARD': {
      const card = removeCard(actor.hand, action.cardId)
      if (!card) return { state: prevState, private: null, error: 'Card not in hand.' }
      if (!['skip', 'attack', 'shuffle', 'peek'].includes(card.type)) {
        actor.hand.push(card)
        return { state: prevState, private: null, error: 'That card needs a target — use the matching action.' }
      }
      state.discardPile.push(card)
      if (card.type === 'skip') {
        pushLog(state, `${actor.name} played Skip.`)
        settleTurn(state, 1)
      } else if (card.type === 'attack') {
        pushLog(state, `${actor.name} played Double — the next player is in for two turns!`)
        state.owed = 0
        if (alivePlayers(state).length > 1) {
          state.activeIndex = nextAliveIndex(state, state.activeIndex)
          state.owed = 2
          state.turn += 1
        }
      } else if (card.type === 'shuffle') {
        state.drawPile = shuffle(state.drawPile)
        pushLog(state, `${actor.name} shuffled the draw pile.`)
      } else if (card.type === 'peek') {
        const cards = state.drawPile.slice(-3).slice().reverse()
        pushLog(state, `${actor.name} peeked at the draw pile.`)
        priv = { forPlayerId: actor.id, kind: 'peek', payload: cards.map(c => c.type) }
      }
      break
    }

    case 'PLAY_SWAP': {
      const card = removeCard(actor.hand, action.cardId)
      if (!card || card.type !== 'swap') { if (card) actor.hand.push(card); return { state: prevState, private: null, error: 'Invalid Swap card.' } }
      const target = findPlayer(state, action.targetPlayerId)
      if (!target || !target.alive || target.id === actor.id) { actor.hand.push(card); return { state: prevState, private: null, error: 'Invalid target.' } }
      state.discardPile.push(card)
      const stolen = stealRandomCard(state, target.id, actor.id)
      pushLog(state, stolen
        ? `${actor.name} used Swap on ${target.name}.`
        : `${actor.name} used Swap on ${target.name}, but they had nothing to give!`)
      break
    }

    case 'PLAY_PAIR': {
      const a = findCardInHand(actor.hand, action.cardIdA)
      const b = findCardInHand(actor.hand, action.cardIdB)
      if (!a || !b || a.id === b.id || a.type !== b.type || !CRITTER_TYPES.includes(a.type)) {
        return { state: prevState, private: null, error: 'Need two matching critter cards.' }
      }
      const target = findPlayer(state, action.targetPlayerId)
      if (!target || !target.alive || target.id === actor.id) return { state: prevState, private: null, error: 'Invalid target.' }
      removeCard(actor.hand, a.id)
      removeCard(actor.hand, b.id)
      state.discardPile.push(a, b)
      const stolen = stealRandomCard(state, target.id, actor.id)
      pushLog(state, stolen
        ? `${actor.name} played a ${CARD_TYPES[a.type].name} pair and stole a card from ${target.name}.`
        : `${actor.name} played a ${CARD_TYPES[a.type].name} pair on ${target.name}, but they had nothing to give!`)
      break
    }

    case 'DRAW': {
      if (state.drawPile.length === 0) {
        if (state.discardPile.length === 0) return { state: prevState, private: null, error: 'No cards left anywhere.' }
        state.drawPile = shuffle(state.discardPile)
        state.discardPile = []
        pushLog(state, 'The draw pile ran out — the discard pile was reshuffled in.')
      }
      const card = state.drawPile.pop()
      if (card.type === 'kaboom') {
        const shieldIdx = actor.hand.findIndex(c => c.type === 'shield')
        if (shieldIdx !== -1) {
          const [shieldCard] = actor.hand.splice(shieldIdx, 1)
          state.discardPile.push(shieldCard)
          state.pending = { type: 'insertKaboom', playerId: actor.id, kaboomCard: card }
          pushLog(state, `${actor.name} drew a KABOOM but defused it with a Shield!`)
        } else {
          actor.alive = false
          state.discardPile.push(card, ...actor.hand.splice(0))
          pushLog(state, `💥 ${actor.name} drew the KABOOM and is out!`)
          checkForWinner(state)
          if (!state.winnerId) {
            state.activeIndex = nextAliveIndex(state, state.activeIndex)
            state.owed = 1
            state.turn += 1
          }
        }
      } else {
        actor.hand.push(card)
        pushLog(state, `${actor.name} drew a card.`)
        settleTurn(state, 1)
      }
      break
    }

    case 'INSERT_POSITION': {
      if (!state.pending || state.pending.playerId !== actor.id) return { state: prevState, private: null, error: 'Nothing to place.' }
      const { kaboomCard } = state.pending
      const pos = Math.max(0, Math.min(state.drawPile.length, Math.floor(action.position ?? 0)))
      state.drawPile.splice(state.drawPile.length - pos, 0, kaboomCard)
      state.pending = null
      pushLog(state, `${actor.name} slid the KABOOM back into the deck.`)
      settleTurn(state, 1)
      break
    }

    default:
      return { state: prevState, private: null, error: 'Unknown action.' }
  }

  return { state, private: priv }
}

function findCardInHand(hand, id) { return hand.find(c => c.id === id) || null }

// ── Redacted per-viewer view — this (not the raw state) is what gets
// rendered/broadcast. Every other player's hand is collapsed to a count so
// nobody can see anyone else's cards.
export function buildView(state, viewerId) {
  return {
    ...state,
    players: state.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, isCPU: p.isCPU, alive: p.alive,
      handCount: p.hand.length,
      hand: p.id === viewerId ? p.hand : undefined,
    })),
    drawCount: state.drawPile.length,
    drawPile: undefined,
    discardTop: state.discardPile[state.discardPile.length - 1] || null,
    discardPile: undefined,
  }
}

// ── Simple heuristic AI ──────────────────────────────────────────────
// Runs with full (non-redacted) state access, same as any local game AI —
// it just decides on an action object for the caller to feed into
// applyAction, exactly like a real player's move would be.
export function chooseCPUAction(state, playerId) {
  const me = findPlayer(state, playerId)
  if (!me) return { type: 'DRAW', playerId }

  if (state.pending && state.pending.playerId === playerId) {
    return { type: 'INSERT_POSITION', playerId, position: Math.floor(Math.random() * (state.drawPile.length + 1)) }
  }

  // Always cash in a free matching pair if we have one.
  for (const type of CRITTER_TYPES) {
    const matches = me.hand.filter(c => c.type === type)
    if (matches.length >= 2) {
      const target = pickTarget(state, playerId)
      if (target) return { type: 'PLAY_PAIR', playerId, cardIdA: matches[0].id, cardIdB: matches[1].id, targetPlayerId: target.id }
    }
  }

  // If we can see the top of the deck is a KABOOM (via a Peek we already
  // took, tracked ad-hoc by just checking the real pile — this AI doesn't
  // bother playing Peek itself, just avoids obviously bad draws when it
  // can) and we hold an escape card, use it.
  const topIsKaboom = state.drawPile[state.drawPile.length - 1]?.type === 'kaboom'
  if (topIsKaboom) {
    const skip = me.hand.find(c => c.type === 'skip')
    if (skip) return { type: 'PLAY_CARD', playerId, cardId: skip.id }
    const attack = me.hand.find(c => c.type === 'attack')
    if (attack) return { type: 'PLAY_CARD', playerId, cardId: attack.id }
  }

  // Occasionally play Swap for value.
  const swap = me.hand.find(c => c.type === 'swap')
  if (swap && Math.random() < 0.35) {
    const target = pickTarget(state, playerId)
    if (target) return { type: 'PLAY_SWAP', playerId, cardId: swap.id, targetPlayerId: target.id }
  }

  return { type: 'DRAW', playerId }
}

function pickTarget(state, exceptId) {
  const others = alivePlayers(state).filter(p => p.id !== exceptId)
  if (others.length === 0) return null
  return others.reduce((best, p) => (p.hand.length > best.hand.length ? p : best), others[0])
}
