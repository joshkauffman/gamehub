// ── The Obvious Pokémon Knockoff — game engine ────────────────────────
// Pure state/physics, no rendering. Two modes share one state object:
// 'overworld' (real-time top-down movement, same room-grid system as
// The Obvious Zelda Knockoff) and 'battle' (turn-based, driven by
// explicit action calls from the UI rather than held-key input).

import {
  PLAY_X0, PLAY_Y0, TILE, COLS, ROWS, PLAY_W, PLAY_H,
  PLAYER_SIZE, MOVE_SPEED, ENCOUNTER_CHANCE_PER_FRAME, PARTY_MAX,
  SOLID_TILES, GRASS_TILES, typeMultiplier,
} from './constants.js'
import { SPECIES, MOVES, freshCreature } from './creatures.js'
import { WORLDS, PORTALS, TRAINERS, STARTER_ORBS, START_WORLD, START_ROOM_KEY } from './levels.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function tileCol(px) { return Math.floor((px - PLAY_X0) / TILE) }
function tileRow(py) { return Math.floor((py - PLAY_Y0) / TILE) }
function isSolidTile(tiles, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false
  return SOLID_TILES.has(tiles[row][col])
}
function tileCharAt(tiles, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return '#'
  return tiles[row][col]
}

function moveWithTiles(e, tiles) {
  e.x += e.vx
  if (e.vx > 0) {
    const c1 = tileCol(e.x + e.w - 1)
    const r0 = tileRow(e.y), r1 = tileRow(e.y + e.h - 1)
    for (let r = r0; r <= r1; r++) if (isSolidTile(tiles, r, c1)) { e.x = PLAY_X0 + c1 * TILE - e.w; break }
  } else if (e.vx < 0) {
    const c0 = tileCol(e.x)
    const r0 = tileRow(e.y), r1 = tileRow(e.y + e.h - 1)
    for (let r = r0; r <= r1; r++) if (isSolidTile(tiles, r, c0)) { e.x = PLAY_X0 + (c0 + 1) * TILE; break }
  }
  e.y += e.vy
  if (e.vy > 0) {
    const r1 = tileRow(e.y + e.h - 1)
    const c0 = tileCol(e.x), c1 = tileCol(e.x + e.w - 1)
    for (let c = c0; c <= c1; c++) if (isSolidTile(tiles, r1, c)) { e.y = PLAY_Y0 + r1 * TILE - e.h; break }
  } else if (e.vy < 0) {
    const r0 = tileRow(e.y)
    const c0 = tileCol(e.x), c1 = tileCol(e.x + e.w - 1)
    for (let c = c0; c <= c1; c++) if (isSolidTile(tiles, r0, c)) { e.y = PLAY_Y0 + (r0 + 1) * TILE; break }
  }
}

function colToX(col) { return PLAY_X0 + col * TILE }
function rowToY(row) { return PLAY_Y0 + row * TILE }
function fullKey(world, roomKey) { return `${world}:${roomKey}` }

function loadRoom(state, world, roomKey, entrySide, entryPoint) {
  const room = WORLDS[world][roomKey]
  state.world = world
  state.roomKey = roomKey
  state.roomFullKey = fullKey(world, roomKey)
  state.roomName = room.name
  state.biome = room.biome
  state.neighbors = room.neighbors
  state.wildPool = room.wild
  state.visitedRooms.add(state.roomFullKey)
  state.tiles = room.rows.map(r => r.slice())

  const p = state.player
  if (entryPoint) {
    p.x = colToX(entryPoint.col) + TILE / 2 - p.w / 2
    p.y = rowToY(entryPoint.row) + TILE / 2 - p.h / 2
  } else if (entrySide === 'start') {
    // Well clear of the lab doorway's portal trigger (row 5) so the
    // very first frame of the game doesn't immediately warp the player
    // inside it.
    p.x = colToX(12) - p.w / 2
    p.y = rowToY(9) - p.h / 2
  } else if (entrySide === 'left') {
    p.x = PLAY_X0 + TILE * 1.3
    p.y = rowToY(6) - p.h / 2
    p.facing = 'right'
  } else if (entrySide === 'right') {
    p.x = PLAY_X0 + PLAY_W - TILE * 1.3 - p.w
    p.y = rowToY(6) - p.h / 2
    p.facing = 'left'
  } else if (entrySide === 'top') {
    p.y = PLAY_Y0 + TILE * 1.3
    p.x = colToX(11) + TILE - p.w / 2
    p.facing = 'down'
  } else if (entrySide === 'bottom') {
    p.y = PLAY_Y0 + PLAY_H - TILE * 1.3 - p.h
    p.x = colToX(11) + TILE - p.w / 2
    p.facing = 'up'
  }
  p.vx = 0; p.vy = 0
}

export function freshState() {
  const state = {
    frame: 0,
    status: 'playing',
    mode: 'overworld',
    mapOpen: false,
    prevMapHeld: false,
    score: 0,
    message: '', messageTimer: 0,
    visitedRooms: new Set(),
    party: [],
    starterChosen: false,
    caughtSpecies: new Set(),
    defeatedTrainers: new Set(),
    battle: null,
    player: { x: 0, y: 0, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0, facing: 'down' },
  }
  loadRoom(state, START_WORLD, START_ROOM_KEY, 'start')
  return state
}

function showMessage(state, text) { state.message = text; state.messageTimer = 110 }

function findFirstAlive(party) { return party.findIndex(c => c.hp > 0) }

// Tracks a win on whichever creature landed the knockout and evolves
// it once it's racked up enough — appends the evolution lines (if any)
// straight onto the battle's message queue.
function checkEvolution(state, partyIndex, lines) {
  const creature = state.party[partyIndex]
  if (!creature) return
  creature.wins = (creature.wins || 0) + 1
  const def = SPECIES[creature.speciesId]
  if (!def.evolvesTo || creature.wins < def.evolveAt) return
  const nextDef = SPECIES[def.evolvesTo]
  lines.push(`What? ${def.name} is evolving!`)
  creature.speciesId = def.evolvesTo
  creature.maxHp = nextDef.hp
  creature.hp = nextDef.hp
  lines.push(`${def.name} evolved into ${nextDef.name}!`)
}

function computeDamage(atkDef, defDef, move) {
  const mult = typeMultiplier(move.type, defDef.type)
  const base = move.power + atkDef.atk * 0.4 - defDef.def * 0.25
  const variance = 0.9 + Math.random() * 0.2
  return Math.max(1, Math.round(base * mult * variance))
}

function effText(mult) {
  if (mult > 1) return "It's super effective!"
  if (mult < 1) return "It's not very effective..."
  return null
}

function checkHealSpot(state) {
  const p = state.player
  const tile = tileCharAt(state.tiles, tileRow(p.y + p.h / 2), tileCol(p.x + p.w / 2))
  if (tile !== 'H' || state.party.length === 0) return
  const wasHurt = state.party.some(c => c.hp < c.maxHp)
  state.party.forEach(c => { c.hp = c.maxHp })
  if (wasHurt) showMessage(state, 'Your party was fully healed!')
}

function checkWildEncounter(state) {
  const p = state.player
  if (!state.wildPool || state.wildPool.length === 0) return
  if (state.party.length === 0 || findFirstAlive(state.party) === -1) return
  if (p.vx === 0 && p.vy === 0) return
  const tile = tileCharAt(state.tiles, tileRow(p.y + p.h / 2), tileCol(p.x + p.w / 2))
  if (!GRASS_TILES.has(tile)) return
  if (Math.random() > ENCOUNTER_CHANCE_PER_FRAME) return
  startWildBattle(state)
}

function startWildBattle(state) {
  const pool = state.wildPool
  const totalWeight = pool.reduce((s, w) => s + w.weight, 0)
  let roll = Math.random() * totalWeight
  let chosen = pool[0].speciesId
  for (const w of pool) { if (roll < w.weight) { chosen = w.speciesId; break } roll -= w.weight }
  const def = SPECIES[chosen]
  const maxHp = Math.max(8, Math.round(def.hp * (0.85 + Math.random() * 0.3)))
  const activeIndex = findFirstAlive(state.party)
  state.mode = 'battle'
  state.battle = {
    kind: 'wild', trainerId: null, trainerName: null, reward: 0, isBoss: false,
    enemy: { speciesId: chosen, hp: maxHp, maxHp },
    activeIndex,
    phase: 'message', log: [`A wild ${def.name} appeared!`], pendingTimer: 50, outcome: 'continue',
    canCatch: true, canRun: true,
  }
}

function checkTrainers(state) {
  const p = state.player
  if (state.party.length === 0 || findFirstAlive(state.party) === -1) return
  for (const t of TRAINERS) {
    if (t.world !== state.world || t.roomKey !== state.roomKey) continue
    if (state.defeatedTrainers.has(t.id)) continue
    const trigger = { x: colToX(t.col), y: rowToY(t.row), w: TILE, h: TILE }
    if (!aabb(p, trigger)) continue
    const def = SPECIES[t.speciesId]
    const activeIndex = findFirstAlive(state.party)
    state.mode = 'battle'
    state.battle = {
      kind: 'trainer', trainerId: t.id, trainerName: t.name, reward: t.reward, isBoss: !!t.isBoss,
      enemy: freshCreature(t.speciesId),
      activeIndex,
      phase: 'message', log: [`${t.name} wants to battle!`, `${t.name} sent out ${def.name}!`], pendingTimer: 50, outcome: 'continue',
      canCatch: false, canRun: false,
    }
    return
  }
}

function checkStarterOrbs(state) {
  if (state.starterChosen || state.world !== 'lab') return
  const p = state.player
  for (const orb of STARTER_ORBS) {
    const trigger = { x: colToX(orb.col), y: rowToY(orb.row), w: TILE, h: TILE }
    if (!aabb(p, trigger)) continue
    const def = SPECIES[orb.speciesId]
    state.party = [freshCreature(orb.speciesId)]
    state.starterChosen = true
    state.caughtSpecies.add(orb.speciesId)
    showMessage(state, `You chose ${def.name}!`)
    return
  }
}

function checkPortals(state) {
  const p = state.player
  for (const portal of PORTALS) {
    if (portal.fromWorld !== state.world || portal.fromKey !== state.roomKey) continue
    const trigger = { x: colToX(portal.col), y: rowToY(portal.row), w: TILE * 2, h: TILE }
    if (aabb(p, trigger)) {
      loadRoom(state, portal.toWorld, portal.toKey, null, { col: portal.entryCol, row: portal.entryRow })
      return true
    }
  }
  return false
}

function checkRoomTransition(state) {
  const p = state.player
  const n = state.neighbors
  if (p.x + p.w < PLAY_X0 && n.left) { loadRoom(state, state.world, n.left, 'right'); return true }
  if (p.x > PLAY_X0 + PLAY_W && n.right) { loadRoom(state, state.world, n.right, 'left'); return true }
  if (p.y < PLAY_Y0 && n.up) { loadRoom(state, state.world, n.up, 'bottom'); return true }
  if (p.y > PLAY_Y0 + PLAY_H && n.down) { loadRoom(state, state.world, n.down, 'top'); return true }
  return false
}

function endBattle(state) { state.mode = 'overworld'; state.battle = null }

function finishBattleStep(state) {
  const b = state.battle
  if (!b) return
  switch (b.outcome) {
    case 'continue':
      b.phase = 'choose'
      break
    case 'wildFainted':
      state.score += 30
      endBattle(state)
      break
    case 'caught':
      state.score += 80
      endBattle(state)
      break
    case 'fled':
      endBattle(state)
      break
    case 'trainerWin': {
      state.defeatedTrainers.add(b.trainerId)
      state.score += b.reward || 100
      const wasBoss = b.isBoss
      endBattle(state)
      if (wasBoss) state.status = 'win'
      break
    }
    case 'playerLose':
      state.party.forEach(c => { c.hp = c.maxHp })
      endBattle(state)
      loadRoom(state, START_WORLD, START_ROOM_KEY, 'start')
      break
    default:
      break
  }
}

function stepBattleMessageQueue(state) {
  const b = state.battle
  if (!b || b.phase !== 'message') return
  b.pendingTimer--
  if (b.pendingTimer > 0) return
  b.log.shift()
  if (b.log.length > 0) { b.pendingTimer = 50; return }
  finishBattleStep(state)
}

export function chooseMove(state, moveKey) {
  const b = state.battle
  if (!b || b.phase !== 'choose') return
  const playerCreature = state.party[b.activeIndex]
  const playerDef = SPECIES[playerCreature.speciesId]
  const enemyDef = SPECIES[b.enemy.speciesId]
  const playerMove = MOVES[moveKey]
  const enemyMoveKey = enemyDef.moves[Math.floor(Math.random() * enemyDef.moves.length)]
  const enemyMove = MOVES[enemyMoveKey]
  const order = playerDef.spd >= enemyDef.spd ? ['player', 'enemy'] : ['enemy', 'player']

  const lines = []
  let outcome = 'continue'

  for (const who of order) {
    if (who === 'player') {
      const dmg = computeDamage(playerDef, enemyDef, playerMove)
      b.enemy.hp = Math.max(0, b.enemy.hp - dmg)
      lines.push(`${playerDef.name} used ${playerMove.name}!`)
      const eff = effText(typeMultiplier(playerMove.type, enemyDef.type))
      if (eff) lines.push(eff)
      if (b.enemy.hp <= 0) {
        lines.push(`${enemyDef.name} fainted!`)
        outcome = b.kind === 'trainer' ? 'trainerWin' : 'wildFainted'
        checkEvolution(state, b.activeIndex, lines)
        break
      }
    } else {
      const dmg = computeDamage(enemyDef, playerDef, enemyMove)
      playerCreature.hp = Math.max(0, playerCreature.hp - dmg)
      lines.push(`${enemyDef.name} used ${enemyMove.name}!`)
      const eff = effText(typeMultiplier(enemyMove.type, playerDef.type))
      if (eff) lines.push(eff)
      if (playerCreature.hp <= 0) {
        lines.push(`${playerDef.name} fainted!`)
        const nextIdx = findFirstAlive(state.party)
        if (nextIdx === -1) { outcome = 'playerLose'; break }
        b.activeIndex = nextIdx
        lines.push(`Go, ${SPECIES[state.party[nextIdx].speciesId].name}!`)
      }
    }
  }

  b.log = lines
  b.pendingTimer = 50
  b.phase = 'message'
  b.outcome = outcome
}

export function attemptCatch(state) {
  const b = state.battle
  if (!b || b.phase !== 'choose' || !b.canCatch) return
  const enemyDef = SPECIES[b.enemy.speciesId]
  const hpFrac = b.enemy.hp / b.enemy.maxHp
  const chance = Math.min(0.95, Math.max(0.05, enemyDef.catchRate * (1 - hpFrac * 0.6) + 0.1))
  const lines = [`You threw a Catch Orb at ${enemyDef.name}!`]
  let outcome = 'continue'

  if (Math.random() < chance) {
    lines.push(`Gotcha! ${enemyDef.name} was caught!`)
    // Caught at full health, regardless of how much it was weakened
    // down to catch it.
    if (state.party.length < PARTY_MAX) state.party.push({ ...b.enemy, hp: b.enemy.maxHp, wins: 0 })
    state.caughtSpecies.add(b.enemy.speciesId)
    outcome = 'caught'
  } else {
    lines.push(`${enemyDef.name} broke free!`)
    const playerCreature = state.party[b.activeIndex]
    const playerDef = SPECIES[playerCreature.speciesId]
    const enemyMoveKey = enemyDef.moves[Math.floor(Math.random() * enemyDef.moves.length)]
    const enemyMove = MOVES[enemyMoveKey]
    const dmg = computeDamage(enemyDef, playerDef, enemyMove)
    playerCreature.hp = Math.max(0, playerCreature.hp - dmg)
    lines.push(`${enemyDef.name} used ${enemyMove.name}!`)
    if (playerCreature.hp <= 0) {
      lines.push(`${playerDef.name} fainted!`)
      const nextIdx = findFirstAlive(state.party)
      if (nextIdx === -1) { outcome = 'playerLose' } else {
        b.activeIndex = nextIdx
        lines.push(`Go, ${SPECIES[state.party[nextIdx].speciesId].name}!`)
      }
    }
  }

  b.log = lines
  b.pendingTimer = 50
  b.phase = 'message'
  b.outcome = outcome
}

export function attemptRun(state) {
  const b = state.battle
  if (!b || b.phase !== 'choose' || !b.canRun) return
  b.log = ['Got away safely!']
  b.pendingTimer = 50
  b.phase = 'message'
  b.outcome = 'fled'
}

export function stepGame(state, input) {
  if (state.status !== 'playing') return
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  if (state.mode === 'battle') { stepBattleMessageQueue(state); return }

  if (input.map && !state.prevMapHeld) state.mapOpen = !state.mapOpen
  state.prevMapHeld = input.map
  if (state.mapOpen) return

  const p = state.player
  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071 }
  p.vx = vx * MOVE_SPEED
  p.vy = vy * MOVE_SPEED
  if (input.down) p.facing = 'down'
  else if (input.up) p.facing = 'up'
  else if (input.left) p.facing = 'left'
  else if (input.right) p.facing = 'right'

  moveWithTiles(p, state.tiles)
  checkHealSpot(state)
  checkStarterOrbs(state)
  checkWildEncounter(state)
  if (state.mode === 'battle') return
  checkTrainers(state)
  if (state.mode === 'battle') return

  if (state.status !== 'playing') return
  if (checkPortals(state)) return
  checkRoomTransition(state)
}

export function caughtCount(state) { return state.caughtSpecies.size }
export function totalSpeciesCount() {
  return Object.values(SPECIES).filter(s => s.catchRate > 0).length // excludes the two trainer-only aces
}
