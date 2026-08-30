import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import styles from './OrbitMaze.module.css'
import { LEVELS, SPHERE_RADIUS, BALL_RADIUS, TUBE_RADIUS, getStations, todaySeedString, loadBestTimes, saveBestTime } from './constants.js'
import {
  createGameState, stepGame, getBallLocalPosition, sampleTangentAt, isGateOpen,
  applyDragRotation, applyKeyRotation, applyRoll, generateProceduralLevel,
} from './gameEngine.js'

// A level "spec" is how the UI names which level to play — a fixed
// hand-authored index, or a seed for a procedurally generated one (daily
// = same seed for everyone today; random = a fresh seed each time). Both
// procedural levels are built via gameEngine.js's validated generator, so
// they arrive already guaranteed fair, in the exact same node/edge shape
// as the hand-authored LEVELS — no special-casing needed anywhere else.
function specKey(spec) {
  if (spec.kind === 'fixed') return String(spec.index)
  if (spec.kind === 'daily') return `daily-${spec.seed}`
  return `random-${spec.seed}`
}
function specToLevel(spec) {
  if (spec.kind === 'fixed') return LEVELS[spec.index]
  if (spec.kind === 'daily') {
    return generateProceduralLevel(spec.seed, 'Daily Challenge', 'One shared maze for today — everyone gets the same layout. A new one tomorrow.')
  }
  return generateProceduralLevel(spec.seed, 'Random Maze', 'A freshly generated maze — different every time you spin one up.')
}

// ── Orbit Maze ────────────────────────────────────────────────────────
// A gravity-maze puzzle styled after the physical hand-held toy it's
// inspired by: a faceted, geodesic-paneled transparent globe with a chrome
// ball rolling through a twisting tube track. You never touch the ball
// directly — you rotate the whole sphere (drag, or arrow keys + Q/E to
// roll) and fixed world gravity does the rolling. Camera never moves;
// "down" on screen is always down in the world, so the only feedback loop
// is watching which way the track tilts. Timed gates (level 4) add a
// rotating-obstacle mechanic on top of the fork-and-trap puzzle from
// earlier levels: a gate is a hard wall at its point on the tube while
// shut, so you have to watch its cycle and time your tilt to slip through.

const NODE_COLORS = {
  start: 0x6fb8ff,
  checkpoint: 0x7bff8a,
  trap: 0x2a1018,
  goal: 0xffd166,
  normal: 0x8a8aa0,
}

// ── Lightweight synthesized SFX (no external assets) — every call is
// defensive, so a browser blocking/lacking Web Audio just goes silent
// rather than breaking the game. ────────────────────────────────────────
function createAudio() {
  let muted = false
  try { muted = localStorage.getItem('orbit-maze-muted') === '1' } catch { /* localStorage unavailable */ }
  let ctx = null, masterGain = null, rollOsc = null, rollGain = null, rollFilter = null

  function ensure() {
    if (ctx) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      ctx = new Ctx()
      masterGain = ctx.createGain()
      masterGain.gain.value = muted ? 0 : 1
      masterGain.connect(ctx.destination)
      rollOsc = ctx.createOscillator()
      rollOsc.type = 'triangle'
      rollFilter = ctx.createBiquadFilter()
      rollFilter.type = 'lowpass'
      rollFilter.frequency.value = 500
      rollGain = ctx.createGain()
      rollGain.gain.value = 0
      rollOsc.connect(rollFilter); rollFilter.connect(rollGain); rollGain.connect(masterGain)
      rollOsc.start()
    } catch { /* Web Audio unavailable — game stays fully playable without sound */ }
  }
  function resume() { try { ctx?.state === 'suspended' && ctx.resume() } catch { /* ignore */ } }
  function setMuted(m) {
    muted = m
    try { localStorage.setItem('orbit-maze-muted', m ? '1' : '0') } catch { /* ignore */ }
    try { masterGain?.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05) } catch { /* ignore */ }
  }
  function updateRoll(speedAbs, active) {
    if (!ctx) return
    try {
      rollGain.gain.setTargetAtTime(active ? Math.min(0.05, speedAbs * 0.007) : 0, ctx.currentTime, 0.08)
      rollOsc.frequency.setTargetAtTime(65 + speedAbs * 15, ctx.currentTime, 0.08)
    } catch { /* ignore */ }
  }
  function blip(freq, dur = 0.12, type = 'sine', vol = 0.16, delay = 0) {
    if (!ctx) return
    try {
      const t0 = ctx.currentTime + delay
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t0)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      osc.connect(g); g.connect(masterGain)
      osc.start(t0); osc.stop(t0 + dur + 0.02)
    } catch { /* ignore */ }
  }
  function playCheckpoint() { blip(880, 0.12, 'sine', 0.16) }
  function playTrap() {
    if (!ctx) return
    try {
      const t0 = ctx.currentTime
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, t0); osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.35)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      osc.connect(g); g.connect(masterGain); osc.start(t0); osc.stop(t0 + 0.42)
    } catch { /* ignore */ }
  }
  function playWin() { blip(523, 0.15, 'sine', 0.18, 0); blip(659, 0.15, 'sine', 0.18, 0.12); blip(784, 0.24, 'sine', 0.2, 0.24) }

  return { ensure, resume, setMuted, updateRoll, playCheckpoint, playTrap, playWin, isMuted: () => muted }
}

// ── Small canvas-sprite badge (station numbers, "S", finish flag) —
// billboards toward the camera automatically even as a child of the
// rotating maze group, same trick as this hub's other label sprites.
function makeBadge(text, bg) {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.arc(32, 32, 29, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.stroke()
  ctx.fillStyle = '#0a0a18'
  ctx.font = 'bold 28px "Courier New", monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 32, 35)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.scale.set(0.85, 0.85, 1)
  sprite.renderOrder = 8
  return sprite
}

// A trap's danger marker has to read from any angle even though the maze
// tumbles freely under a fixed camera — a 3D ring oriented radially looks
// like a full halo only from some rotations and a near-invisible sliver
// edge-on from most others. A billboard sprite (like the station badges)
// sidesteps that entirely by always facing the camera.
function makeTrapIcon() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1a0508'
  ctx.beginPath(); ctx.arc(32, 32, 25, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6
  ctx.beginPath(); ctx.arc(32, 32, 25, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#ff5a5a'
  ctx.font = 'bold 30px "Courier New", monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('!', 32, 35)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.scale.set(1.0, 1.0, 1)
  sprite.renderOrder = 9
  return sprite
}

// ── Reusable burst particle system (trap sparks / goal confetti) — a
// fixed-size pool of points so spawning never allocates. Dead particles
// park off-screen instead of being removed, keeping the buffer sizes
// (and therefore the draw call) constant. ───────────────────────────────
function createBurstSystem(count, size, colors) {
  const positions = new Float32Array(count * 3)
  const colorAttr = new Float32Array(count * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3))
  const mat = new THREE.PointsMaterial({
    size, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  const particles = Array.from({ length: count }, () => ({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 0, g: 0, b: 0 }))

  function spawn(origin, n, speedRange, lifeRange) {
    let spawned = 0
    for (let i = 0; i < count && spawned < n; i++) {
      const p = particles[i]
      if (p.life > 0) continue
      const dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1
      const len = Math.hypot(dx, dy, dz) || 1
      const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0])
      p.x = origin.x; p.y = origin.y; p.z = origin.z
      p.vx = (dx / len) * speed; p.vy = (dy / len) * speed; p.vz = (dz / len) * speed
      p.life = p.maxLife = lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0])
      const c = colors[Math.floor(Math.random() * colors.length)]
      p.r = c.r; p.g = c.g; p.b = c.b
      spawned++
    }
  }
  function update(dt, gravityY) {
    const posAttr = geo.attributes.position, colAttr = geo.attributes.color
    for (let i = 0; i < count; i++) {
      const p = particles[i]
      if (p.life > 0) {
        p.life -= dt
        p.vy += gravityY * dt
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
        const f = Math.max(0, p.life / p.maxLife)
        posAttr.setXYZ(i, p.x, p.y, p.z)
        colAttr.setXYZ(i, p.r * f, p.g * f, p.b * f)
      } else {
        posAttr.setXYZ(i, 0, -9999, 0)
      }
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  }
  return { points, spawn, update }
}

function buildMazeGroup(level, runtime) {
  const group = new THREE.Group()

  // Faceted geodesic shell — the toy's signature look — via a low-detail
  // icosahedron with flat shading plus an edge-line overlay for the
  // seamed-panel appearance, instead of a smooth sphere.
  const shellGeo = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 2)
  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.25, metalness: 0,
      flatShading: true, side: THREE.DoubleSide, clearcoat: 0.6,
    }),
  )
  group.add(shell)
  const shellEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeo, 1),
    new THREE.LineBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.35 }),
  )
  group.add(shellEdges)

  const tubeMat = new THREE.MeshPhysicalMaterial({
    color: 0x7fc8ff, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2,
  })
  Object.values(runtime.edgesById).forEach(edge => {
    const pts = edge.points.map(p => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 3), TUBE_RADIUS, 8, false), tubeMat)
    group.add(tube)
  })

  const stations = getStations(level)
  const stationLabel = n => {
    const i = stations.indexOf(n)
    if (n.type === 'start') return 'S'
    if (n.type === 'goal') return '⚑'
    return String(i)
  }

  const goalMeshes = []
  const trapIcons = []
  const gateFlaps = [] // { mesh, edge }
  level.nodes.forEach(n => {
    const isGoal = n.type === 'goal'
    const isTrap = n.type === 'trap'
    let mesh
    if (isGoal) {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(TUBE_RADIUS * 2.1, 0),
        new THREE.MeshStandardMaterial({ color: NODE_COLORS.goal, emissive: NODE_COLORS.goal, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.4 }),
      )
      goalMeshes.push(mesh)
    } else if (isTrap) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(TUBE_RADIUS * 1.4, 14, 12), new THREE.MeshBasicMaterial({ color: NODE_COLORS.trap }))
      const icon = makeTrapIcon()
      const nodeDist = Math.hypot(n.pos.x, n.pos.y, n.pos.z) || 1
      const dir = new THREE.Vector3(n.pos.x, n.pos.y, n.pos.z).divideScalar(nodeDist)
      icon.position.copy(dir.multiplyScalar(nodeDist + 0.55))
      group.add(icon)
      trapIcons.push(icon)
    } else {
      const size = n.type === 'checkpoint' ? TUBE_RADIUS * 1.15 : TUBE_RADIUS * 0.85
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 14, 12),
        new THREE.MeshStandardMaterial({ color: NODE_COLORS[n.type] || NODE_COLORS.normal, emissive: NODE_COLORS[n.type] || 0, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.2 }),
      )
    }
    mesh.position.set(n.pos.x, n.pos.y, n.pos.z)
    group.add(mesh)

    if (n.type === 'start' || n.type === 'checkpoint' || n.type === 'goal') {
      const badge = makeBadge(stationLabel(n), isGoal ? '#ffd166' : n.type === 'start' ? '#6fb8ff' : '#7bff8a')
      const nodeDist = Math.hypot(n.pos.x, n.pos.y, n.pos.z) || 1
      const dir = new THREE.Vector3(n.pos.x, n.pos.y, n.pos.z).divideScalar(nodeDist)
      badge.position.copy(dir.multiplyScalar(nodeDist + 0.75))
      group.add(badge)
    }
  })

  Object.values(runtime.edgesById).forEach(edge => {
    if (!edge.gate) return
    const gatePos = (() => {
      const { points, cum, length } = edge
      const s = edge.gate.s
      let i = 0
      while (i < cum.length - 2 && cum[i + 1] < s) i++
      const segLen = cum[i + 1] - cum[i] || 1
      const t = (s - cum[i]) / segLen
      const p0 = points[i], p1 = points[i + 1]
      return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, z: p0.z + (p1.z - p0.z) * t, len: length }
    })()
    const tangent = sampleTangentAt(edge, edge.gate.s)
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(TUBE_RADIUS * 1.9, TUBE_RADIUS * 1.9, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 0.6, roughness: 0.4 }),
    )
    flap.position.set(gatePos.x, gatePos.y, gatePos.z)
    flap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(tangent.x, tangent.y, tangent.z))
    group.add(flap)
    gateFlaps.push({ mesh: flap, edge })
  })

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xff2a44, emissive: 0x4a0010, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.85 }),
  )
  ball.renderOrder = 5
  group.add(ball)

  const trailPool = Array.from({ length: 14 }, () => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS * 0.6, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a44, transparent: true, opacity: 0 }),
    )
    group.add(dot)
    return dot
  })

  const trapBurst = createBurstSystem(40, 0.35, [{ r: 1, g: 0.3, b: 0.15 }, { r: 1, g: 0.55, b: 0.1 }, { r: 0.6, g: 0.1, b: 0.1 }])
  const confetti = createBurstSystem(90, 0.3, [{ r: 1, g: 0.82, b: 0.4 }, { r: 0.5, g: 0.85, b: 1 }, { r: 1, g: 1, b: 1 }, { r: 0.55, g: 1, b: 0.6 }])
  group.add(trapBurst.points)
  group.add(confetti.points)

  return { group, ball, goalMeshes, trapIcons, gateFlaps, trailPool, trapBurst, confetti }
}

function GameCanvas({ level, onHud, onWin, muted }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onWinRef = useRef(onWin); onWinRef.current = onWin
  const mutedRef = useRef(muted); mutedRef.current = muted

  useEffect(() => {
    const mount = mountRef.current
    let raf = null
    let dragging = false
    let lastX = 0, lastY = 0

    const state = createGameState(level)
    const audio = createAudio()
    audio.setMuted(mutedRef.current)
    let lastSeenSeq = state.eventSeq
    let lastMuted = mutedRef.current

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 200)
    camera.position.set(0, 0, 16.5)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a18)
    scene.environment = envRT.texture
    scene.add(new THREE.AmbientLight(0x8fa0ff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(4, 8, 6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x6a7fff, 0.4)
    fill.position.set(-6, -3, -4)
    scene.add(fill)

    // Faint starfield for depth — static, not part of the rotating group.
    const starGeo = new THREE.BufferGeometry()
    const starCount = 300
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 60 + Math.random() * 60
      const theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * 2 - 1)
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPos[i * 3 + 1] = r * Math.cos(phi)
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaac4ff, size: 0.35, transparent: true, opacity: 0.5, sizeAttenuation: true })))

    // Decorative stand ring, like the toy's base — static in camera space.
    const stand = new THREE.Mesh(
      new THREE.TorusGeometry(SPHERE_RADIUS * 0.55, 0.18, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.5, metalness: 0.6 }),
    )
    stand.position.y = -(SPHERE_RADIUS + 1.6)
    stand.rotation.x = Math.PI / 2 - 0.35
    scene.add(stand)

    const { group, ball, goalMeshes, trapIcons, gateFlaps, trailPool, trapBurst, confetti } = buildMazeGroup(state.level, state.runtime)
    scene.add(group)

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function onPointerDown(e) {
      dragging = true
      lastX = e.clientX; lastY = e.clientY
      renderer.domElement.setPointerCapture(e.pointerId)
      audio.ensure(); audio.resume()
    }
    function onPointerMove(e) {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      state.rotation = applyDragRotation(state.rotation, dx, dy)
    }
    function onPointerUp(e) {
      dragging = false
      try { renderer.domElement.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()
    let wonFired = false
    let trailCursor = 0
    let trailAccum = 0

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const k = keysRef.current

      const turnX = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0)
      const turnY = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0)
      if (turnX || turnY) { state.rotation = applyKeyRotation(state.rotation, turnX, turnY, dt); audio.ensure() }
      const rollDir = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0)
      if (rollDir) { state.rotation = applyRoll(state.rotation, rollDir, dt); audio.ensure() }

      if (mutedRef.current !== lastMuted) { lastMuted = mutedRef.current; audio.setMuted(lastMuted) }

      stepGame(state, dt)
      group.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w)

      // Fire any new one-shot event (checkpoint/trap/goal) exactly once.
      if (state.eventSeq !== lastSeenSeq) {
        lastSeenSeq = state.eventSeq
        const ev = state.lastEvent
        const node = ev && state.runtime.nodesById[ev.nodeId]
        const worldPos = node ? new THREE.Vector3(node.pos.x, node.pos.y, node.pos.z) : null
        if (ev?.type === 'checkpoint') { audio.playCheckpoint() }
        else if (ev?.type === 'trap') { audio.playTrap(); if (worldPos) trapBurst.spawn(worldPos, 26, [2, 5], [0.4, 0.8]) }
        else if (ev?.type === 'goal') { audio.playWin(); if (worldPos) confetti.spawn(worldPos, 80, [1.5, 4.5], [0.8, 1.6]) }
      }

      const trapped = state.ball.status === 'trapped'
      const scale = trapped ? Math.max(0.05, state.ball.trapTimer) : 1
      ball.scale.setScalar(scale)
      if (!trapped) {
        const edge = state.runtime.edgesById[state.ball.edgeId]
        const p = getBallLocalPosition(state)
        ball.position.set(p.x, p.y, p.z)
        const tangent = sampleTangentAt(edge, state.ball.sFromA)
        const spinAxis = new THREE.Vector3(tangent.z, 0, -tangent.x)
        if (spinAxis.lengthSq() > 1e-6) {
          spinAxis.normalize()
          ball.rotateOnWorldAxis(spinAxis, (state.ball.speed * dt) / BALL_RADIUS)
        }

        // Lay a fading trail dot every ~60ms while actually rolling.
        trailAccum += dt
        if (trailAccum > 0.06 && Math.abs(state.ball.speed) > 0.3) {
          trailAccum = 0
          const dot = trailPool[trailCursor]
          trailCursor = (trailCursor + 1) % trailPool.length
          dot.position.copy(ball.position)
          dot.userData.life = 0.5
          dot.material.opacity = 0.5
        }
      }
      trailPool.forEach(dot => {
        if (dot.userData.life > 0) {
          dot.userData.life -= dt
          dot.material.opacity = Math.max(0, dot.userData.life / 0.5) * 0.5
        }
      })

      goalMeshes.forEach(m => {
        m.scale.setScalar(1 + Math.sin(t * 4) * 0.08)
        m.rotation.y += dt * 0.8
        m.rotation.x += dt * 0.5
      })
      trapIcons.forEach((icon, i) => { icon.scale.setScalar(1.0 + Math.sin(t * 5 + i) * 0.12) })

      gateFlaps.forEach(({ mesh, edge }) => {
        const open = isGateOpen(edge, state.ball.elapsed)
        mesh.material.color.setHex(open ? 0x3dff8f : 0xff3b3b)
        mesh.material.emissive.setHex(open ? 0x3dff8f : 0xff3b3b)
        const panelScale = open ? 0.15 : 1
        mesh.scale.set(panelScale, panelScale, 1)
      })

      trapBurst.update(dt, -1.5)
      confetti.update(dt, -2.2)

      audio.updateRoll(Math.abs(state.ball.speed), state.ball.status === 'playing')

      renderer.render(scene, camera)

      const stations = getStations(state.level)
      const stationIndex = Math.max(0, stations.findIndex(n => n.id === state.ball.checkpointNodeId))
      onHudRef.current({
        elapsed: state.ball.elapsed,
        drops: state.ball.drops,
        trapped,
        won: state.result === 'won',
        station: stationIndex,
        totalStations: stations.length - 1,
      })
      if (state.result === 'won' && !wonFired) {
        wonFired = true
        onWinRef.current({ time: state.ball.elapsed, drops: state.ball.drops })
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerUp)
      pmrem.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [level])

  return <div ref={mountRef} className={styles.canvasWrap} />
}

function LevelSelect({ onPlay, best }) {
  const dailySeed = todaySeedString()
  const dailyKey = `daily-${dailySeed}`
  return (
    <div className={styles.overlayScreen}>
      <h1 className={styles.title}>🔮 Orbit Maze</h1>
      <p className={styles.blurb}>
        Tilt the whole globe — drag with your mouse/finger, or use the arrow keys (Q/E to roll) —
        and let gravity roll the ball through the tube maze. Watch for forks: the ball rolls into
        whichever branch you tilt downhill, so tilt away from the dark trap holes. Checkpoints save
        your spot if you fall in. Some levels add timed gates — red is shut, green is open.
      </p>
      <div className={styles.levelGrid}>
        {LEVELS.map((lvl, i) => (
          <button key={i} className={styles.levelCard} onClick={() => onPlay({ kind: 'fixed', index: i })}>
            <span className={styles.levelNum}>{i + 1}</span>
            <span className={styles.levelName}>{lvl.name}</span>
            <span className={styles.levelBlurb}>{lvl.blurb}</span>
            <span className={styles.levelBest}>{best[i] !== undefined ? `Best: ${best[i].toFixed(1)}s` : 'Not played yet'}</span>
          </button>
        ))}
        <button className={`${styles.levelCard} ${styles.specialCard}`} onClick={() => onPlay({ kind: 'daily', seed: dailySeed })}>
          <span className={styles.levelNum}>🎲</span>
          <span className={styles.levelName}>Daily Challenge</span>
          <span className={styles.levelBlurb}>One shared maze for {dailySeed} — everyone gets the same layout today.</span>
          <span className={styles.levelBest}>{best[dailyKey] !== undefined ? `Best: ${best[dailyKey].toFixed(1)}s` : 'Not played yet'}</span>
        </button>
        <button
          className={`${styles.levelCard} ${styles.specialCard}`}
          onClick={() => onPlay({ kind: 'random', seed: Date.now() + Math.floor(Math.random() * 1e6) })}
        >
          <span className={styles.levelNum}>🔀</span>
          <span className={styles.levelName}>Random Maze</span>
          <span className={styles.levelBlurb}>A freshly generated maze — different every time, always fair.</span>
          <span className={styles.levelBest}>Endless variety</span>
        </button>
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function Hud({ hud, levelName, muted, onToggleMute, onReplay, onMenu }) {
  if (!hud) return null
  return (
    <div className={styles.hud}>
      <div className={styles.hudTop}>
        <span className={styles.levelTag}>{levelName}</span>
        <span className={styles.timer}>⏱ {hud.elapsed.toFixed(1)}s</span>
        <span className={styles.station}>🚩 {hud.station}/{hud.totalStations}</span>
        {hud.drops > 0 && <span className={styles.drops}>🕳 {hud.drops}</span>}
      </div>
      {hud.trapped && <div className={styles.trapMsg}>Into the hole! Respawning at your last checkpoint…</div>}
      <div className={styles.hudBottom}>
        <button className={styles.smallBtn} onClick={onToggleMute}>{muted ? '🔇' : '🔊'}</button>
        <button className={styles.smallBtn} onClick={onReplay}>↺ Replay</button>
        <button className={styles.smallBtn} onClick={onMenu}>☰ Levels</button>
      </div>
    </div>
  )
}

function WinOverlay({ result, levelSpec, best, onNext, onReplay, onMenu, onNewRandom }) {
  const key = specKey(levelSpec)
  const bestTime = best[key]
  const isNewBest = bestTime !== undefined && Math.abs(bestTime - result.time) < 0.001
  const isFixed = levelSpec.kind === 'fixed'
  const showNext = isFixed && levelSpec.index < LEVELS.length - 1
  const showNewRandom = levelSpec.kind === 'random'
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>🏆 Level Complete!</h2>
        <p className={styles.resultLine}>Time: {result.time.toFixed(1)}s{isNewBest && <span className={styles.newBest}> — New Best!</span>}</p>
        <p className={styles.resultLine}>Drops into traps: {result.drops}</p>
        <div className={styles.modalBtnRow}>
          {showNext && <button className={styles.bigBtn} onClick={onNext}>▶ Next Level</button>}
          {showNewRandom && <button className={styles.bigBtn} onClick={onNewRandom}>🔀 New Random Maze</button>}
          <button className={styles.ghostBtn} onClick={onReplay}>↺ Replay</button>
          <button className={styles.ghostBtn} onClick={onMenu}>☰ Level Select</button>
        </div>
      </div>
    </div>
  )
}

export default function OrbitMaze() {
  const [screen, setScreen] = useState('select')
  const [levelSpec, setLevelSpec] = useState({ kind: 'fixed', index: 0 })
  const [canvasKey, setCanvasKey] = useState(0)
  const [hud, setHud] = useState(null)
  const [winResult, setWinResult] = useState(null)
  const [best, setBest] = useState(() => loadBestTimes())
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('orbit-maze-muted') === '1' } catch { return false }
  })

  const currentLevel = useMemo(() => specToLevel(levelSpec), [levelSpec.kind, levelSpec.index, levelSpec.seed])

  function play(spec) {
    setLevelSpec(spec)
    setWinResult(null)
    setHud(null)
    setCanvasKey(k => k + 1)
    setScreen('playing')
  }

  function handleWin({ time, drops }) {
    const key = specKey(levelSpec)
    const updatedBest = saveBestTime(key, time)
    setBest(b => ({ ...b, [key]: updatedBest }))
    setWinResult({ time, drops })
  }

  function toggleMute() {
    setMuted(m => {
      const next = !m
      try { localStorage.setItem('orbit-maze-muted', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  function replay() { play(levelSpec) }
  function next() { if (levelSpec.kind === 'fixed') play({ kind: 'fixed', index: Math.min(levelSpec.index + 1, LEVELS.length - 1) }) }
  function newRandom() { play({ kind: 'random', seed: Date.now() + Math.floor(Math.random() * 1e6) }) }
  function toMenu() { setScreen('select') }

  return (
    <div className={styles.page}>
      {screen === 'select' && <LevelSelect onPlay={play} best={best} />}
      {screen === 'playing' && (
        <>
          <GameCanvas key={canvasKey} level={currentLevel} onHud={setHud} onWin={handleWin} muted={muted} />
          <Hud hud={hud} levelName={currentLevel.name} muted={muted} onToggleMute={toggleMute} onReplay={replay} onMenu={toMenu} />
          {winResult && (
            <WinOverlay result={winResult} levelSpec={levelSpec} best={best} onNext={next} onReplay={replay} onMenu={toMenu} onNewRandom={newRandom} />
          )}
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}
    </div>
  )
}
