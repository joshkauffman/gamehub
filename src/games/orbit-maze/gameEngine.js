// ── Orbit Maze — pure gameplay state/logic ──────────────────────────────
// Framework-agnostic: plain {x,y,z} points and a plain {x,y,z,w} quaternion,
// no THREE, no DOM — testable headlessly with a Node script (see this
// hub's other 3D games for the same convention/reasoning).
//
// The track is a graph (nodes + edges), each edge a precomputed polyline
// (from constants.js's makeEdgeWaypoints). The ball's position is a single
// scalar `sFromA` (arc-length distance from the edge's `a` end) on its
// current edge, plus a signed `speed` (positive = increasing sFromA).
// Every frame: sample the edge's local tangent at the ball, rotate it into
// world space by the current orientation quaternion, and accelerate the
// ball by how much that world tangent points "downhill" (aligned with
// fixed world gravity (0,-1,0)) — the maze rotates, gravity doesn't, same
// as tilting a hand-held gravity maze.
//
// At a node the ball crosses, the outgoing edge is picked by the same
// downhill test applied to each candidate's entry tangent — the ball rolls
// into whichever branch is steepest-downhill given the current tilt, no
// explicit "choice" needed. That's what makes forks a real puzzle: tilt
// the globe to bias which way gravity carries the ball.
import {
  GRAVITY, FRICTION, MAX_SPEED, TRAP_TIME, vecSub, vecScale, vecNormalize, vecDist,
  buildProceduralCandidate,
} from './constants.js'

// ── Quaternion math (minimal, just what rotation control needs) ────────
export function qIdentity() { return { x: 0, y: 0, z: 0, w: 1 } }
export function qNormalize(q) {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len }
}
export function qFromAxisAngle(axis, angle) {
  const half = angle / 2
  const s = Math.sin(half)
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) }
}
// Hamilton product a*b — applying the result rotates by b, then by a.
export function qMultiply(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}
// Shortest-arc quaternion rotating unit vector `from` onto unit vector
// `to` — used only by the solvability check below (an omniscient
// "instantly orient however's most downhill" solver, not a real control
// scheme) to test whether a level is fair for a real player.
function qBetweenVectors(from, to) {
  const f = vecNormalize(from), t = vecNormalize(to)
  const d = f.x * t.x + f.y * t.y + f.z * t.z
  if (d > 0.99999) return qIdentity()
  if (d < -0.99999) {
    // f and t point opposite ways — any axis perpendicular to f gives a
    // valid 180° rotation; cross with X unless f is nearly parallel to X.
    const notParallel = Math.abs(f.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
    const axis = vecNormalize({ x: f.y * notParallel.z - f.z * notParallel.y, y: f.z * notParallel.x - f.x * notParallel.z, z: f.x * notParallel.y - f.y * notParallel.x })
    return { x: axis.x, y: axis.y, z: axis.z, w: 0 }
  }
  const axis = { x: f.y * t.z - f.z * t.y, y: f.z * t.x - f.x * t.z, z: f.x * t.y - f.y * t.x }
  return qNormalize({ x: axis.x, y: axis.y, z: axis.z, w: 1 + d })
}

export function qRotateVec(q, v) {
  // v' = q * (v,0) * conjugate(q), expanded without allocating quaternions
  const { x: qx, y: qy, z: qz, w: qw } = q
  const uvx = qy * v.z - qz * v.y, uvy = qz * v.x - qx * v.z, uvz = qx * v.y - qy * v.x
  const uuvx = qy * uvz - qz * uvy, uuvy = qz * uvx - qx * uvz, uuvz = qx * uvy - qy * uvx
  return {
    x: v.x + 2 * (qw * uvx + uuvx),
    y: v.y + 2 * (qw * uvy + uuvy),
    z: v.z + 2 * (qw * uvz + uuvz),
  }
}

const ROT_DRAG_SPEED = 0.006
const ROT_KEY_SPEED = 1.6 // radians/sec equivalent, fed in as a synthetic drag delta

// Drag deltas (screen pixels) rotate the group around fixed world axes —
// the camera never moves, so world X/Y are always screen right/up.
export function applyDragRotation(q, dx, dy) {
  let nq = qMultiply(qFromAxisAngle({ x: 0, y: 1, z: 0 }, dx * ROT_DRAG_SPEED), q)
  nq = qMultiply(qFromAxisAngle({ x: 1, y: 0, z: 0 }, dy * ROT_DRAG_SPEED), nq)
  return qNormalize(nq)
}
export function applyKeyRotation(q, turnX, turnY, dt) {
  if (!turnX && !turnY) return q
  return applyDragRotation(q, turnY * ROT_KEY_SPEED * dt / ROT_DRAG_SPEED, turnX * ROT_KEY_SPEED * dt / ROT_DRAG_SPEED)
}
export function applyRoll(q, dir, dt) {
  if (!dir) return q
  return qNormalize(qMultiply(qFromAxisAngle({ x: 0, y: 0, z: 1 }, dir * 2.0 * dt), q))
}

const GRAVITY_WORLD = { x: 0, y: -1, z: 0 }

// ── Track runtime (polylines + adjacency) built once per level ─────────
function buildPolylineData(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + vecDist(points[i - 1], points[i]))
  return { points, cum, length: cum[cum.length - 1] }
}

export function buildRuntime(level) {
  const nodesById = {}
  level.nodes.forEach(n => { nodesById[n.id] = n })
  const adjacency = {}
  level.nodes.forEach(n => { adjacency[n.id] = [] })
  const edgesById = {}
  level.edges.forEach(e => {
    const pl = buildPolylineData(e.points)
    const gate = e.gate ? { ...e.gate, s: (e.gate.frac ?? 0.5) * pl.length } : null
    edgesById[e.id] = { ...e, ...pl, gate }
    adjacency[e.a].push(e.id)
    adjacency[e.b].push(e.id)
  })
  const startNode = level.nodes.find(n => n.type === 'start')
  return { nodesById, edgesById, adjacency, startNodeId: startNode.id }
}

// A gated edge blocks passage on a duty-cycle: open for `openFraction` of
// each `period` seconds (offset by `phase`), shut the rest of the time.
// Timed against the ball's own elapsed clock so it keeps cycling even
// while the ball is trapped/waiting — you have to watch it and time your
// tilt, same as a real toy's rotating gate obstacle.
export function isGateOpen(edge, time) {
  if (!edge.gate) return true
  const { period, openFraction, phase = 0 } = edge.gate
  const cyclePos = ((time + phase) % period + period) % period
  return cyclePos < period * openFraction
}

function tangentFieldAt(edge, s) {
  const { points, cum } = edge
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < s) i++
  const p0 = points[i], p1 = points[i + 1]
  return vecNormalize(vecSub(p1, p0))
}

// Exposed for the render layer: gate flaps and the ball's rolling-spin
// animation both need the track's tangent direction, not just its point.
export function sampleTangentAt(edge, s) {
  return tangentFieldAt(edge, Math.max(0, Math.min(edge.length, s)))
}

export function samplePointAt(edge, s) {
  const { points, cum, length } = edge
  const clamped = Math.max(0, Math.min(length, s))
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < clamped) i++
  const segLen = cum[i + 1] - cum[i] || 1
  const t = (clamped - cum[i]) / segLen
  const p0 = points[i], p1 = points[i + 1]
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, z: p0.z + (p1.z - p0.z) * t }
}

// Direction of travel entering `edge` while moving away from `arrivalNodeId`.
function travelDirIntoEdge(edge, arrivalNodeId) {
  if (edge.a === arrivalNodeId) return tangentFieldAt(edge, 0)
  const t = tangentFieldAt(edge, edge.length - 1e-4)
  return vecScale(t, -1)
}

function downhillScore(rotation, localDir) {
  const worldDir = qRotateVec(rotation, localDir)
  return -worldDir.y // dot(GRAVITY_WORLD, worldDir), GRAVITY_WORLD = (0,-1,0)
}

// ── Ball state ───────────────────────────────────────────────────────
export function createBallState(runtime) {
  const startId = runtime.startNodeId
  const firstEdgeId = runtime.adjacency[startId][0]
  const edge = runtime.edgesById[firstEdgeId]
  const sFromA = edge.a === startId ? 0 : edge.length
  return {
    edgeId: firstEdgeId, sFromA, speed: 0,
    status: 'playing', trapTimer: 0, elapsed: 0, drops: 0,
    checkpoint: { edgeId: firstEdgeId, sFromA }, checkpointNodeId: startId,
  }
}

// `level` is a level data object (from constants.js's LEVELS, or one built
// on the fly by generateProceduralLevel) — the engine doesn't care which.
export function createGameState(level) {
  const runtime = buildRuntime(level)
  return {
    level, runtime,
    rotation: qIdentity(),
    ball: createBallState(runtime),
    result: null,
    lastEvent: null, eventSeq: 0,
  }
}

// A one-shot notification for the render layer (SFX/particle triggers) —
// consumed by watching `eventSeq` for changes, so each real transition
// fires exactly once no matter how many frames re-render the same state.
function emit(state, type, extra) {
  state.lastEvent = { type, ...extra }
  state.eventSeq += 1
}

function resolveArrival(state, arrivalNodeId, overflow, arrivedFromEdgeId) {
  const ball = state.ball
  const node = state.runtime.nodesById[arrivalNodeId]

  if (node.type === 'goal') {
    ball.status = 'won'
    state.result = 'won'
    emit(state, 'goal', { nodeId: arrivalNodeId })
    return
  }
  if (node.type === 'trap') {
    ball.status = 'trapped'
    ball.trapTimer = TRAP_TIME
    ball.drops += 1
    emit(state, 'trap', { nodeId: arrivalNodeId })
    return
  }

  const allEdges = state.runtime.adjacency[arrivalNodeId]
  let candidates = allEdges.filter(id => id !== arrivedFromEdgeId)
  if (candidates.length === 0) candidates = [arrivedFromEdgeId]

  let chosenId = candidates[0]
  if (candidates.length > 1) {
    let bestScore = -Infinity
    for (const id of candidates) {
      const edge = state.runtime.edgesById[id]
      const score = downhillScore(state.rotation, travelDirIntoEdge(edge, arrivalNodeId))
      if (score > bestScore) { bestScore = score; chosenId = id }
    }
  }

  const chosen = state.runtime.edgesById[chosenId]
  const speedMag = Math.abs(ball.speed)
  if (chosen.a === arrivalNodeId) {
    ball.speed = speedMag
    ball.sFromA = Math.max(0, Math.min(chosen.length, overflow))
  } else {
    ball.speed = -speedMag
    ball.sFromA = Math.max(0, Math.min(chosen.length, chosen.length - overflow))
  }
  ball.edgeId = chosenId

  if (node.type === 'checkpoint' || node.type === 'start') {
    ball.checkpoint = { edgeId: ball.edgeId, sFromA: ball.sFromA }
    ball.checkpointNodeId = arrivalNodeId
    if (node.type === 'checkpoint') emit(state, 'checkpoint', { nodeId: arrivalNodeId })
  }
}

function stepBall(state, dt) {
  const ball = state.ball
  ball.elapsed += dt
  if (ball.status === 'won') return

  if (ball.status === 'trapped') {
    ball.trapTimer -= dt
    if (ball.trapTimer <= 0) {
      ball.status = 'playing'
      ball.edgeId = ball.checkpoint.edgeId
      ball.sFromA = ball.checkpoint.sFromA
      ball.speed = 0
    }
    return
  }

  const edge = state.runtime.edgesById[ball.edgeId]
  const localTangent = tangentFieldAt(edge, Math.max(0, Math.min(edge.length, ball.sFromA)))
  const worldTangent = qRotateVec(state.rotation, localTangent)
  const accel = -worldTangent.y * GRAVITY // dot(GRAVITY_WORLD, worldTangent)

  ball.speed += accel * dt
  ball.speed *= Math.max(0, 1 - FRICTION * dt)
  ball.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, ball.speed))

  let news = ball.sFromA + ball.speed * dt

  // A closed gate is a hard wall at its point on the edge — clamp to it and
  // zero out speed (every frame while shut, so the ball can't creep past
  // one tiny step at a time) until isGateOpen lets it through untouched.
  if (edge.gate && !isGateOpen(edge, ball.elapsed)) {
    const gs = edge.gate.s
    if (ball.sFromA <= gs && news > gs) { news = gs; ball.speed = 0 }
    else if (ball.sFromA >= gs && news < gs) { news = gs; ball.speed = 0 }
  }

  if (news > edge.length) resolveArrival(state, edge.b, news - edge.length, ball.edgeId)
  else if (news < 0) resolveArrival(state, edge.a, -news, ball.edgeId)
  else ball.sFromA = news
}

export function stepGame(state, dt) {
  if (state.result) return
  stepBall(state, dt)
}

export function getBallLocalPosition(state) {
  const edge = state.runtime.edgesById[state.ball.edgeId]
  return samplePointAt(edge, state.ball.sFromA)
}

// An omniscient "instantly orient however's most downhill for the current
// edge" solver — much stronger than any real player, but cheap and good
// enough to catch the one failure mode procedural forks actually have: a
// trap branch that happens to look more downhill than the correct one, so
// the greedy player-like heuristic gets stuck looping into it forever. If
// this can't finish in `maxSeconds` of simulated time, treat the level as
// unfair rather than merely "needs a cleverer player".
export function isLikelySolvable(level, maxSeconds = 20) {
  const state = createGameState(level)
  const dt = 1 / 60
  const maxSteps = Math.round(maxSeconds / dt)
  for (let i = 0; i < maxSteps; i++) {
    if (state.result === 'won') return true
    const edge = state.runtime.edgesById[state.ball.edgeId]
    const tangent = tangentFieldAt(edge, Math.max(0, Math.min(edge.length, state.ball.sFromA)))
    state.rotation = qBetweenVectors(tangent, { x: 0, y: -1, z: 0 })
    stepGame(state, dt)
  }
  return state.result === 'won'
}

// Public procedural-level API: generate a candidate and validate it with
// isLikelySolvable, retrying with a derived seed until one passes (or a
// generous attempt budget runs out, in which case the last candidate is
// returned anyway — vanishingly unlikely given each attempt's independent
// ~1-in-3 pass rate). Deterministic per input seed, so a Daily Challenge
// seed always converges to the same accepted level for every player.
export function generateProceduralLevel(seed, name, blurb, maxAttempts = 40) {
  let candidate = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = typeof seed === 'number' ? seed + attempt * 7919 : `${seed}::${attempt}`
    candidate = buildProceduralCandidate(attemptSeed, name, blurb)
    if (isLikelySolvable(candidate)) return candidate
  }
  return candidate
}
