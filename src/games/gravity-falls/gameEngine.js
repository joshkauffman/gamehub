// ── Gravity Falls: Journal Hunt — pure gameplay state/logic ─────────────
// Framework-agnostic: plain (x, z) world coordinates, no THREE, no DOM —
// same convention as this hub's other 3D games, so it's playtestable
// headlessly with a plain Node script. Three phases: 'explore' (find all
// the pages), 'climax' (all pages found — Bill Cipher is waiting north of
// town), 'victory' (reached him).
import {
  WORLD_HALF, UNIT_RADIUS, NPC_MEET_RADIUS, PAGE_BASE_RADIUS, CLIMAX_RADIUS,
  SHACK_POS, DINER_POS, STORE_POS, WATER_TOWER_POS, CLIMAX_POS,
  getCharacter, PAGES, NPC_DEFS, GNOME_HOME, GNOME_COUNT, GNOME_WANDER_RADIUS, GNOME_TOAST,
} from './constants.js'

const BASE_SPEED = 8.5
const NPC_SPEED = 2.0
const TREE_PAGE_CLEARANCE = 3.2

function rand(a, b) { return a + Math.random() * (b - a) }
function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function collidesAny(rects, x, z, radius) {
  return rects.some(b => x + radius > b.x - b.w / 2 && x - radius < b.x + b.w / 2 && z + radius > b.z - b.d / 2 && z - radius < b.z + b.d / 2)
}

// Building footprints (collidable) plus a scatter of decorative forest
// trees / town clutter (also collidable, so the world doesn't feel hollow
// and pages tucked among trees/buildings feel found rather than just
// stepped on) — same technique as this hub's other open-world games.
export function generateWorld() {
  const buildings = [
    { x: SHACK_POS.x, z: SHACK_POS.z, w: 9, d: 7, kind: 'shack' },
    { x: DINER_POS.x, z: DINER_POS.z, w: 6, d: 5, kind: 'diner' },
    { x: STORE_POS.x, z: STORE_POS.z, w: 6, d: 5, kind: 'store' },
    { x: WATER_TOWER_POS.x, z: WATER_TOWER_POS.z, w: 2, d: 2, kind: 'watertower' },
  ]
  const trees = []
  for (let i = 0; i < 20; i++) {
    let x, z
    do { x = rand(-39, -6); z = rand(-30, 30) } while (
      dist2(x, z, 0, 0) < 6 || PAGES.some(p => dist2(x, z, p.pos.x, p.pos.z) < TREE_PAGE_CLEARANCE)
    )
    trees.push({ x, z, w: 1.1, d: 1.1, h: rand(3.2, 6.2) })
  }
  const clutter = []
  for (let i = 0; i < 12; i++) {
    let x, z
    do {
      x = rand(6, 39); z = rand(-28, 28)
    } while (
      buildings.some(b => dist2(x, z, b.x, b.z) < 6) || PAGES.some(p => dist2(x, z, p.pos.x, p.pos.z) < TREE_PAGE_CLEARANCE)
    )
    clutter.push({ x, z, w: rand(0.8, 1.5), d: rand(0.8, 1.5), h: rand(0.7, 1.4) })
  }
  const colliders = [
    ...buildings.map(b => ({ x: b.x, z: b.z, w: b.w, d: b.d })),
    ...trees.map(t => ({ x: t.x, z: t.z, w: t.w, d: t.d })),
  ]
  return { colliders, buildings, trees, clutter }
}

export function createPlayer(characterKey) {
  const c = getCharacter(characterKey)
  return {
    key: characterKey, x: 0, z: -20,
    speedMult: c.speedMult, pickupRadius: PAGE_BASE_RADIUS * c.pickupMult,
  }
}

export function createNPCs(playerKey) {
  const npcs = []
  NPC_DEFS.filter(d => d.key !== playerKey).forEach(d => {
    npcs.push({
      id: d.id, kind: 'npc', x: d.home.x, z: d.home.z, yaw: 0,
      home: d.home, wanderRadius: d.wanderRadius, wanderTarget: { ...d.home }, wanderTimer: rand(0.5, 2),
      toast: d.toast, met: false,
    })
  })
  for (let i = 0; i < GNOME_COUNT; i++) {
    npcs.push({
      id: `gnome${i}`, kind: 'gnome', x: GNOME_HOME.x + rand(-3, 3), z: GNOME_HOME.z + rand(-3, 3), yaw: 0,
      home: GNOME_HOME, wanderRadius: GNOME_WANDER_RADIUS, wanderTarget: { ...GNOME_HOME }, wanderTimer: rand(0.5, 2),
    })
  }
  return npcs
}

export function createGameState(characterKey) {
  const world = generateWorld()
  return {
    characterKey, world, colliders: world.colliders,
    player: createPlayer(characterKey),
    npcs: createNPCs(characterKey),
    pages: PAGES.map(p => ({ ...p, collected: false })),
    collectedCount: 0, gnomeMet: false,
    phase: 'explore', result: null, toast: null, elapsed: 0,
  }
}

function setToast(state, text, kind = 'info') { state.toast = { text, timer: 3.4, kind } }

// input = { moveX, moveZ }, an already-unit-or-zero world-space direction
// (component owns yaw/camera — mouse-look plus A/D turn both feed into
// the same facing vector before calling this, same convention as this
// hub's other mouse-look-optional open-world games).
function stepPlayer(state, input, dt) {
  const p = state.player
  const speed = BASE_SPEED * p.speedMult
  let nx = p.x + (input.moveX || 0) * speed * dt
  let nz = p.z + (input.moveZ || 0) * speed * dt
  nx = clamp(nx, -WORLD_HALF, WORLD_HALF)
  nz = clamp(nz, -WORLD_HALF, WORLD_HALF)
  if (!collidesAny(state.colliders, nx, p.z, UNIT_RADIUS)) p.x = nx
  if (!collidesAny(state.colliders, p.x, nz, UNIT_RADIUS)) p.z = nz
}

function stepNpc(npc, colliders, dt) {
  npc.wanderTimer -= dt
  const dHome = dist2(npc.x, npc.z, npc.wanderTarget.x, npc.wanderTarget.z)
  if (npc.wanderTimer <= 0 || dHome < 0.5) {
    const r = npc.wanderRadius
    npc.wanderTarget = { x: npc.home.x + rand(-r, r), z: npc.home.z + rand(-r, r) }
    npc.wanderTimer = rand(2, 4.5)
  }
  const dx = npc.wanderTarget.x - npc.x, dz = npc.wanderTarget.z - npc.z
  const d = Math.hypot(dx, dz)
  if (d > 0.3) {
    npc.yaw = Math.atan2(-dx, -dz)
    const nx = npc.x + (dx / d) * NPC_SPEED * dt
    const nz = npc.z + (dz / d) * NPC_SPEED * dt
    if (!collidesAny(colliders, nx, npc.z, UNIT_RADIUS)) npc.x = nx
    if (!collidesAny(colliders, npc.x, nz, UNIT_RADIUS)) npc.z = nz
  }
}

function checkNpcMeetings(state) {
  for (const npc of state.npcs) {
    const d = dist2(state.player.x, state.player.z, npc.x, npc.z)
    if (npc.kind === 'npc' && !npc.met && d < NPC_MEET_RADIUS) {
      npc.met = true
      setToast(state, npc.toast, 'info')
    } else if (npc.kind === 'gnome' && !state.gnomeMet && d < NPC_MEET_RADIUS) {
      state.gnomeMet = true
      setToast(state, GNOME_TOAST, 'info')
    }
  }
}

function checkPickups(state) {
  const pr = UNIT_RADIUS + state.player.pickupRadius
  state.pages.forEach(p => {
    if (p.collected) return
    if (dist2(state.player.x, state.player.z, p.pos.x, p.pos.z) < pr) {
      p.collected = true
      state.collectedCount += 1
      setToast(state, `📖 ${p.title}: "${p.text}"`, 'good')
    }
  })
  if (state.collectedCount >= state.pages.length && state.phase === 'explore') {
    state.phase = 'climax'
    setToast(state, 'The sky ripples gold. Something is watching from everywhere at once...', 'bad')
  }
}

function checkClimax(state) {
  if (state.phase !== 'climax') return
  if (dist2(state.player.x, state.player.z, CLIMAX_POS.x, CLIMAX_POS.z) < CLIMAX_RADIUS) {
    state.phase = 'victory'
    state.result = 'victory'
  }
}

// Nearest uncollected page — used by Dipper's compass perk (rendered
// only for that character, but harmless/cheap to compute for everyone).
export function nearestUncollectedPage(state) {
  let best = null, bestD = Infinity
  state.pages.forEach(p => {
    if (p.collected) return
    const d = dist2(state.player.x, state.player.z, p.pos.x, p.pos.z)
    if (d < bestD) { bestD = d; best = p }
  })
  return best
}

export function stepGame(state, input, dt) {
  if (state.result) return
  stepPlayer(state, input, dt)
  state.npcs.forEach(npc => stepNpc(npc, state.colliders, dt))
  checkNpcMeetings(state)
  checkPickups(state)
  checkClimax(state)
  if (state.toast) { state.toast.timer -= dt; if (state.toast.timer <= 0) state.toast = null }
  state.elapsed += dt
}
