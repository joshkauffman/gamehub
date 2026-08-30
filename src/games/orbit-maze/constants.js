// ── Orbit Maze — shared data ─────────────────────────────────────────────
// A 3D tube-maze puzzle in the spirit of hand-held gravity mazes: a ball
// rolls through a twisting tube track embedded in a transparent sphere.
// You don't move the ball directly — you rotate the whole sphere (drag or
// arrow keys) and gravity (always "down" on screen) does the rolling.
// The track is a graph of nodes/edges rather than one flat path so a level
// can branch: at a fork the ball naturally rolls into whichever branch is
// steepest-downhill given the sphere's current orientation, same as the
// physical toy. Framework-agnostic (plain {x,y,z} objects, no THREE, no
// DOM) so gameEngine.js can be playtested headlessly with a Node script.

const DEG = Math.PI / 180

export function v3(x, y, z) { return { x, y, z } }
export function vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z } }
export function vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } }
export function vecScale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s } }
export function vecDot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z }
export function vecCross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
export function vecLength(a) { return Math.hypot(a.x, a.y, a.z) }
export function vecNormalize(a) {
  const len = vecLength(a) || 1
  return { x: a.x / len, y: a.y / len, z: a.z / len }
}
export function vecLerp(a, b, t) { return vecAdd(a, vecScale(vecSub(b, a), t)) }
export function vecDist(a, b) { return vecLength(vecSub(a, b)) }

// A point on the track sphere from spherical coordinates: theta = azimuth
// around Y (degrees), phi = polar angle from the +Y pole (degrees, 0=top).
export function sph(r, thetaDeg, phiDeg) {
  const theta = thetaDeg * DEG, phi = phiDeg * DEG
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  }
}

// Builds a winding polyline between two nodes: a corkscrew offset around
// the straight line from pA to pB, tapering to zero at both ends (via a
// sine envelope) so it always lands exactly on the node positions while
// bulging out into a twisty tube in between.
export function makeEdgeWaypoints(pA, pB, { turns = 1.2, amp = 1.0, segments = 22 } = {}) {
  const axis = vecSub(pB, pA)
  const len = vecLength(axis) || 1
  const dir = vecScale(axis, 1 / len)
  const upGuess = Math.abs(dir.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0)
  const right = vecNormalize(vecCross(dir, upGuess))
  const up2 = vecNormalize(vecCross(right, dir))

  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const base = vecLerp(pA, pB, t)
    const envelope = Math.sin(t * Math.PI) * amp
    const angle = t * turns * Math.PI * 2
    const offset = vecAdd(vecScale(right, Math.cos(angle) * envelope), vecScale(up2, Math.sin(angle) * envelope))
    points.push(vecAdd(base, offset))
  }
  points[0] = { ...pA }
  points[points.length - 1] = { ...pB }
  return points
}

export const SPHERE_RADIUS = 9
export const TRACK_RADIUS = 6.5
export const TRAP_RADIUS = 5.3 // traps dip inward from the main shell, reading as a dropped-into hole
export const BALL_RADIUS = 0.3
export const TUBE_RADIUS = 0.36

export const GRAVITY = 11
export const FRICTION = 0.55
export const MAX_SPEED = 9
export const TRAP_TIME = 1.0

// ── Levels ────────────────────────────────────────────────────────────
// Each node has an id, a pos ({x,y,z}) and a type: 'start' | 'checkpoint'
// | 'normal' (a plain pass-through, or a fork if it has 3+ edges) |
// 'trap' (dead end — falling here sends the ball back to the last
// checkpoint) | 'goal' (dead end — reaching it wins the level).
// Each edge connects two node ids; turns/amp control how twisty/wide its
// corkscrew waypoints are.

function level(name, blurb, nodes, edges) {
  const nodesById = Object.fromEntries(nodes.map(n => [n.id, n]))
  const builtEdges = edges.map(e => ({
    ...e,
    points: makeEdgeWaypoints(nodesById[e.a].pos, nodesById[e.b].pos, { turns: e.turns, amp: e.amp, segments: e.segments }),
  }))
  return { name, blurb, nodes, edges: builtEdges }
}

// The ordered "stations" of a level (start, checkpoints, goal) — used to
// render numbered checkpoint tags like the physical toy's stations, and to
// show progress as "station N of M". Node authoring order is already
// roughly path order, so no graph walk is needed.
export function getStations(level) {
  return level.nodes.filter(n => n.type === 'start' || n.type === 'checkpoint' || n.type === 'goal')
}

export const LEVELS = [
  level(
    'Warm-Up Spiral',
    'One simple winding path, pole to pole. Get a feel for tilting the globe.',
    [
      { id: 'n0', pos: sph(TRACK_RADIUS, 0, 15), type: 'start' },
      { id: 'n1', pos: sph(TRACK_RADIUS, 80, 55), type: 'checkpoint' },
      { id: 'n2', pos: sph(TRACK_RADIUS, 200, 95), type: 'checkpoint' },
      { id: 'n3', pos: sph(TRACK_RADIUS, 300, 135), type: 'checkpoint' },
      { id: 'n4', pos: sph(TRACK_RADIUS, 40, 168), type: 'goal' },
    ],
    [
      { id: 'e0', a: 'n0', b: 'n1', turns: 1.4, amp: 1.0 },
      { id: 'e1', a: 'n1', b: 'n2', turns: 1.4, amp: 1.0 },
      { id: 'e2', a: 'n2', b: 'n3', turns: 1.4, amp: 1.0 },
      { id: 'e3', a: 'n3', b: 'n4', turns: 1.2, amp: 0.8 },
    ],
  ),
  level(
    'Fork & Trap',
    'Two forks now try to sucker you into a dead-end hole. Tilt away from the traps.',
    [
      { id: 'n0', pos: sph(TRACK_RADIUS, 0, 12), type: 'start' },
      { id: 'n1', pos: sph(TRACK_RADIUS, 70, 50), type: 'checkpoint' },
      { id: 'n2', pos: sph(TRACK_RADIUS, 150, 85), type: 'normal' },
      { id: 'n3', pos: sph(TRAP_RADIUS, 150, 108), type: 'trap' },
      { id: 'n4', pos: sph(TRACK_RADIUS, 230, 120), type: 'checkpoint' },
      { id: 'n5', pos: sph(TRACK_RADIUS, 300, 150), type: 'checkpoint' },
      { id: 'n6', pos: sph(TRACK_RADIUS, 20, 165), type: 'normal' },
      { id: 'n7', pos: sph(TRAP_RADIUS, 20, 178), type: 'trap' },
      { id: 'n8', pos: sph(TRACK_RADIUS, 90, 172), type: 'goal' },
    ],
    [
      { id: 'e0', a: 'n0', b: 'n1', turns: 1.3, amp: 1.0 },
      { id: 'e1', a: 'n1', b: 'n2', turns: 1.3, amp: 1.0 },
      { id: 'e2', a: 'n2', b: 'n3', turns: 0.7, amp: 0.6 },
      { id: 'e3', a: 'n2', b: 'n4', turns: 1.4, amp: 1.1 },
      { id: 'e4', a: 'n4', b: 'n5', turns: 1.3, amp: 1.0 },
      { id: 'e5', a: 'n5', b: 'n6', turns: 1.3, amp: 1.0 },
      { id: 'e6', a: 'n6', b: 'n7', turns: 0.7, amp: 0.6 },
      { id: 'e7', a: 'n6', b: 'n8', turns: 1.0, amp: 0.7 },
    ],
  ),
  level(
    'Full Gauntlet',
    'Longer, twistier, two forks with traps. Watch your speed into the last stretch.',
    [
      { id: 'n0', pos: sph(TRACK_RADIUS, 0, 10), type: 'start' },
      { id: 'n1', pos: sph(TRACK_RADIUS, 55, 38), type: 'checkpoint' },
      { id: 'n2', pos: sph(TRACK_RADIUS, 120, 65), type: 'normal' },
      { id: 'n3', pos: sph(TRAP_RADIUS, 120, 88), type: 'trap' },
      { id: 'n4', pos: sph(TRACK_RADIUS, 170, 82), type: 'checkpoint' },
      { id: 'n5', pos: sph(TRACK_RADIUS, 230, 108), type: 'checkpoint' },
      { id: 'n6', pos: sph(TRACK_RADIUS, 285, 128), type: 'normal' },
      { id: 'n7', pos: sph(TRAP_RADIUS, 285, 150), type: 'trap' },
      { id: 'n8', pos: sph(TRACK_RADIUS, 330, 148), type: 'checkpoint' },
      { id: 'n9', pos: sph(TRACK_RADIUS, 20, 165), type: 'checkpoint' },
      { id: 'n10', pos: sph(TRACK_RADIUS, 80, 176), type: 'goal' },
    ],
    [
      { id: 'e0', a: 'n0', b: 'n1', turns: 1.8, amp: 1.1 },
      { id: 'e1', a: 'n1', b: 'n2', turns: 1.8, amp: 1.1 },
      { id: 'e2', a: 'n2', b: 'n3', turns: 0.8, amp: 0.6 },
      { id: 'e3', a: 'n2', b: 'n4', turns: 1.6, amp: 1.2 },
      { id: 'e4', a: 'n4', b: 'n5', turns: 1.8, amp: 1.2 },
      { id: 'e5', a: 'n5', b: 'n6', turns: 1.8, amp: 1.2 },
      { id: 'e6', a: 'n6', b: 'n7', turns: 0.8, amp: 0.6 },
      { id: 'e7', a: 'n6', b: 'n8', turns: 1.6, amp: 1.1 },
      { id: 'e8', a: 'n8', b: 'n9', turns: 1.6, amp: 1.0 },
      { id: 'e9', a: 'n9', b: 'n10', turns: 1.2, amp: 0.8 },
    ],
  ),
  level(
    "Gatekeeper's Gauntlet",
    'Two timed gates now block the tube on a cycle — red is shut, green is open. Time your tilt to arrive when it opens, plus a fork with a trap.',
    [
      { id: 'n0', pos: sph(TRACK_RADIUS, 0, 10), type: 'start' },
      { id: 'n1', pos: sph(TRACK_RADIUS, 60, 42), type: 'checkpoint' },
      { id: 'n2', pos: sph(TRACK_RADIUS, 130, 70), type: 'checkpoint' },
      { id: 'n3', pos: sph(TRACK_RADIUS, 190, 95), type: 'normal' },
      { id: 'n4', pos: sph(TRAP_RADIUS, 190, 118), type: 'trap' },
      { id: 'n5', pos: sph(TRACK_RADIUS, 250, 110), type: 'checkpoint' },
      { id: 'n6', pos: sph(TRACK_RADIUS, 310, 140), type: 'checkpoint' },
      { id: 'n7', pos: sph(TRACK_RADIUS, 20, 162), type: 'checkpoint' },
      { id: 'n8', pos: sph(TRACK_RADIUS, 80, 175), type: 'goal' },
    ],
    [
      { id: 'e0', a: 'n0', b: 'n1', turns: 2.0, amp: 1.1 },
      { id: 'e1', a: 'n1', b: 'n2', turns: 2.0, amp: 1.1, gate: { frac: 0.55, period: 3.0, openFraction: 0.45 } },
      { id: 'e2', a: 'n2', b: 'n3', turns: 1.8, amp: 1.1 },
      { id: 'e3', a: 'n3', b: 'n4', turns: 0.8, amp: 0.6 },
      { id: 'e4', a: 'n3', b: 'n5', turns: 1.8, amp: 1.2 },
      { id: 'e5', a: 'n5', b: 'n6', turns: 1.8, amp: 1.1, gate: { frac: 0.45, period: 2.6, openFraction: 0.5, phase: 1.3 } },
      { id: 'e6', a: 'n6', b: 'n7', turns: 1.6, amp: 1.0 },
      { id: 'e7', a: 'n7', b: 'n8', turns: 1.2, amp: 0.8 },
    ],
  ),
]

// ── Procedural levels (Daily Challenge / Random Maze) ──────────────────
// Same node/edge shape as the hand-authored LEVELS above, built by the
// same `level()` helper — so the engine and renderer need zero special
// casing for a generated level. The walk is a single monotonically
// descending (in phi) chain from start to goal with optional trap forks
// and gates hanging off it, the same template as the hand-built levels —
// which guarantees the main chain is always traversable by construction
// (a fork only ever adds an optional dead-end, never blocks the route).
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStringToSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// A stable per-day seed string, e.g. "2026-08-29" — same for everyone who
// plays "today", so a Daily Challenge is genuinely shared.
export function todaySeedString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A single candidate — not guaranteed fair (a fork's trap branch can end
// up more "downhill" than the correct one by pure chance of random
// angles). gameEngine.js's generateProceduralLevel() wraps this with a
// solvability check and retries with a different seed until one passes —
// import this raw version directly only if you're doing that validation
// yourself.
export function buildProceduralCandidate(seed, name, blurb) {
  const rand = mulberry32(typeof seed === 'number' ? seed : hashStringToSeed(String(seed)))
  const numCheckpoints = 4 + Math.floor(rand() * 3) // 4..6 mid-stations

  const nodes = []
  const edges = []
  let nodeSeq = 0, edgeSeq = 0
  const nextNodeId = () => `n${nodeSeq++}`
  const nextEdgeId = () => `e${edgeSeq++}`

  let phi = 8 + rand() * 6
  let theta = rand() * 360
  const startId = nextNodeId()
  nodes.push({ id: startId, pos: sph(TRACK_RADIUS, theta, phi), type: 'start' })

  const phiStep = (170 - phi) / (numCheckpoints + 1)
  let prevId = startId
  for (let i = 0; i < numCheckpoints; i++) {
    phi += phiStep * (0.7 + rand() * 0.6)
    theta += 50 + rand() * 120
    const id = nextNodeId()
    nodes.push({ id, pos: sph(TRACK_RADIUS, theta, phi), type: 'checkpoint' })
    const gate = rand() < 0.3
      ? { frac: 0.3 + rand() * 0.4, period: 2.2 + rand() * 1.6, openFraction: 0.35 + rand() * 0.25, phase: rand() * 2 }
      : undefined
    edges.push({ id: nextEdgeId(), a: prevId, b: id, turns: 1.3 + rand() * 1.0, amp: 0.9 + rand() * 0.5, ...(gate ? { gate } : {}) })
    prevId = id

    if (i < numCheckpoints - 1 && rand() < 0.4) {
      const trapId = nextNodeId()
      const trapTheta = theta + (rand() < 0.5 ? -1 : 1) * (20 + rand() * 30)
      const trapPhi = Math.min(178, phi + 8 + rand() * 12)
      nodes.push({ id: trapId, pos: sph(TRAP_RADIUS, trapTheta, trapPhi), type: 'trap' })
      edges.push({ id: nextEdgeId(), a: id, b: trapId, turns: 0.7, amp: 0.6 })
    }
  }

  theta += 40 + rand() * 80
  const goalId = nextNodeId()
  nodes.push({ id: goalId, pos: sph(TRACK_RADIUS, theta, 177), type: 'goal' })
  edges.push({ id: nextEdgeId(), a: prevId, b: goalId, turns: 1.0 + rand() * 0.6, amp: 0.7 })

  return level(name, blurb, nodes, edges)
}

const BEST_KEY = 'orbit-maze-best-times'

export function loadBestTimes() {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveBestTime(key, seconds) {
  try {
    const best = loadBestTimes()
    if (best[key] === undefined || seconds < best[key]) {
      best[key] = seconds
      localStorage.setItem(BEST_KEY, JSON.stringify(best))
    }
    return best[key]
  } catch { return seconds }
}
