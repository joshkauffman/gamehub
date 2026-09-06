import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import styles from './OrbitMaze.module.css'
import {
  BALL_RADIUS, HOLE_VISUAL_RADIUS, GOAL_VISUAL_RADIUS, WALL_HEIGHT,
  RANDOM_CFG, todaySeedString, loadBestTimes, saveBestTime,
} from './constants.js'
import {
  LEVELS, createGameState, stepGame, isGateOpen,
  applyKeyTilt, decayTilt, tiltFromDrag, tiltFromDeviceAngles, generateProceduralLevel,
} from './gameEngine.js'

// A level "spec" is how the UI names which level to play — a fixed
// hand-authored index, or a seed for a procedurally generated one (daily
// = same seed for everyone today; random = a fresh seed each time). Both
// procedural levels are built via gameEngine.js's validated generator, so
// they arrive already guaranteed fair, in the exact same shape as the
// hand-picked LEVELS — no special-casing needed anywhere else.
function specKey(spec) {
  if (spec.kind === 'fixed') return String(spec.index)
  if (spec.kind === 'daily') return `daily-${spec.seed}`
  return `random-${spec.seed}`
}
function specToLevel(spec) {
  if (spec.kind === 'fixed') return LEVELS[spec.index]
  if (spec.kind === 'daily') {
    return generateProceduralLevel(spec.seed, 'Daily Challenge', 'One shared board for today — everyone gets the same layout. A new one tomorrow.', RANDOM_CFG)
  }
  return generateProceduralLevel(spec.seed, 'Random Maze', 'A freshly generated board — different every time you spin one up.', RANDOM_CFG)
}

// ── Orbit Maze ────────────────────────────────────────────────────────
// A top-down tilting-board labyrinth, styled after the classic wooden
// gravity-maze toy: a marble rolls across a flat wood board seen from
// above, and you never touch it directly — you tilt the whole board (drag,
// arrow keys, or on a phone, physically tilt it) and gravity does the
// rolling. Holes are cut into the board; rolling into one drops the ball
// back to its last checkpoint. Some boards add a timed gate: a section of
// wall that's only passable while its light is green.

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
// billboards toward the camera automatically even though the board itself
// tilts, same trick as this hub's other label sprites.
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
  sprite.scale.set(0.7, 0.7, 1)
  sprite.renderOrder = 8
  return sprite
}

// A radial-gradient disc texture standing in for a hole cut into the
// board: dark center, fading out through a red warning rim.
function makeHoleTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const c = size / 2
  const grad = ctx.createRadialGradient(c, c, size * 0.04, c, c, size * 0.5)
  grad.addColorStop(0, 'rgba(4,2,2,1)')
  grad.addColorStop(0.72, 'rgba(12,6,5,1)')
  grad.addColorStop(0.85, 'rgba(255,80,55,0.95)')
  grad.addColorStop(1, 'rgba(255,80,55,0)')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(c, c, size / 2, 0, Math.PI * 2); ctx.fill()
  return new THREE.CanvasTexture(canvas)
}

// ── Reusable burst particle system (hole drops / goal confetti) — a
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

// Physics runs in board-plane {x,y} coordinates with (0,0) at a corner —
// the render layer maps that to world (X,Z) centered on the origin, with
// world Y as "up" (board height). Everything (walls, holes, ball, goal)
// lives inside `tiltGroup`, which is the piece that actually rotates for
// the visual tilt feedback — one rigid board, exactly like the real toy.
function toWorld(level, p, y = 0) {
  return { x: p.x - level.width / 2, y, z: p.y - level.height / 2 }
}

function buildBoardGroup(level) {
  const group = new THREE.Group()

  const boardGeo = new THREE.BoxGeometry(level.width + 0.6, 0.2, level.height + 0.6)
  const board = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.85, metalness: 0.05 }))
  board.position.y = -0.1
  board.receiveShadow = true
  group.add(board)

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(level.width + 0.7, 0.42, level.height + 0.7),
    new THREE.MeshStandardMaterial({ color: 0x5c3a20, roughness: 0.9 }),
  )
  rim.position.y = -0.31
  group.add(rim)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6, metalness: 0.05 })
  const wallMeshes = []
  const gateMeshes = [] // { mesh, wall }
  level.walls.forEach(wall => {
    const cx = wall.x + wall.w / 2 - level.width / 2
    const cz = wall.y + wall.h / 2 - level.height / 2
    if (wall.gate) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, WALL_HEIGHT, wall.h), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 0.5, roughness: 0.4 }))
      mesh.position.set(cx, WALL_HEIGHT / 2, cz)
      mesh.castShadow = true
      group.add(mesh)
      gateMeshes.push({ mesh, wall })
      return
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, WALL_HEIGHT, wall.h), wallMat)
    mesh.position.set(cx, WALL_HEIGHT / 2, cz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    wallMeshes.push(mesh)
  })

  // A "pit" is drawn as a flat disc with a radial-gradient texture (dark
  // center fading through a red warning rim) rather than actual recessed
  // geometry — the board is a single solid box, so real depth would need a
  // hole cut into that mesh (CSG); a flush textured disc reads just as
  // clearly as a hole from this near-top-down angle without the z-fighting
  // a buried cylinder gets from the solid board surface sitting above it.
  const holeTex = makeHoleTexture()
  const holeMeshes = []
  level.holes.forEach(hole => {
    const w = toWorld(level, hole.pos)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(HOLE_VISUAL_RADIUS * 1.25, 28),
      new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.set(w.x, 0.008, w.z)
    disc.renderOrder = 2
    group.add(disc)
    holeMeshes.push(disc)
  })

  level.checkpoints.forEach((cp, i) => {
    const w = toWorld(level, cp.pos)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x7bff8a, emissive: 0x2a7a35, emissiveIntensity: 0.6, roughness: 0.4 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.set(w.x, 0.02, w.z)
    group.add(ring)
    const badge = makeBadge(String(i + 1), '#7bff8a')
    badge.position.set(w.x, 0.35, w.z)
    group.add(badge)
  })

  const startW = toWorld(level, level.start)
  const startBadge = makeBadge('S', '#6fb8ff')
  startBadge.position.set(startW.x, 0.35, startW.z)
  group.add(startBadge)

  const goalW = toWorld(level, level.goal)
  const goalRing = new THREE.Mesh(
    new THREE.TorusGeometry(GOAL_VISUAL_RADIUS, 0.05, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb300, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.3 }),
  )
  goalRing.rotation.x = Math.PI / 2
  goalRing.position.set(goalW.x, 0.03, goalW.z)
  group.add(goalRing)
  const goalBadge = makeBadge('⚑', '#ffd166')
  goalBadge.position.set(goalW.x, 0.35, goalW.z)
  group.add(goalBadge)

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xff2a44, emissive: 0x4a0010, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.85 }),
  )
  ball.castShadow = true
  group.add(ball)

  const trailPool = Array.from({ length: 14 }, () => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS * 0.55, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a44, transparent: true, opacity: 0 }),
    )
    group.add(dot)
    return dot
  })

  const dropBurst = createBurstSystem(40, 0.3, [{ r: 1, g: 0.3, b: 0.15 }, { r: 1, g: 0.55, b: 0.1 }, { r: 0.6, g: 0.1, b: 0.1 }])
  const confetti = createBurstSystem(90, 0.26, [{ r: 1, g: 0.82, b: 0.4 }, { r: 0.5, g: 0.85, b: 1 }, { r: 1, g: 1, b: 1 }, { r: 0.55, g: 1, b: 0.6 }])
  group.add(dropBurst.points)
  group.add(confetti.points)

  return { group, ball, holeMeshes, goalRing, gateMeshes, trailPool, dropBurst, confetti }
}

function GameCanvas({ level, onHud, onWin, muted, tiltEnabled, recenterSignal }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onWinRef = useRef(onWin); onWinRef.current = onWin
  const mutedRef = useRef(muted); mutedRef.current = muted
  const tiltEnabledRef = useRef(tiltEnabled); tiltEnabledRef.current = tiltEnabled
  const recenterSignalRef = useRef(recenterSignal); recenterSignalRef.current = recenterSignal

  useEffect(() => {
    const mount = mountRef.current
    let raf = null

    const state = createGameState(level)
    const audio = createAudio()
    audio.setMuted(mutedRef.current)
    let lastSeenSeq = state.eventSeq
    let lastMuted = mutedRef.current

    const boardMax = Math.max(level.width, level.height)
    const camDist = boardMax * 1.55 + 3
    const camera = new THREE.PerspectiveCamera(36, mount.clientWidth / mount.clientHeight, 0.1, 300)
    camera.position.set(0, camDist, camDist * 0.18)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x14101c)
    scene.environment = envRT.texture
    scene.add(new THREE.AmbientLight(0x8fa0ff, 0.55))
    const key = new THREE.DirectionalLight(0xfff2d8, 1.15)
    key.position.set(boardMax * 0.4, boardMax * 1.3, boardMax * 0.25)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    const sh = boardMax * 0.85
    key.shadow.camera.left = -sh; key.shadow.camera.right = sh
    key.shadow.camera.top = sh; key.shadow.camera.bottom = -sh
    key.shadow.camera.near = 0.5; key.shadow.camera.far = boardMax * 3
    scene.add(key)
    scene.add(new THREE.DirectionalLight(0x6a7fff, 0.3))

    const tiltGroup = new THREE.Group()
    const { group: boardGroup, ball, holeMeshes, goalRing, gateMeshes, trailPool, dropBurst, confetti } = buildBoardGroup(level)
    tiltGroup.add(boardGroup)
    scene.add(tiltGroup)

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Drag-to-tilt: think of it as a virtual joystick standing in for the
    // toy's two knobs — drag away from the press point tilts the board
    // that way, harder the farther you drag; letting go eases it flat.
    const DRAG_MAX_PX = 90
    let dragging = false
    let originX = 0, originY = 0
    const dragVec = { x: 0, y: 0 }
    function onPointerDown(e) {
      dragging = true
      originX = e.clientX; originY = e.clientY
      dragVec.x = 0; dragVec.y = 0
      renderer.domElement.setPointerCapture(e.pointerId)
      audio.ensure(); audio.resume()
    }
    function onPointerMove(e) {
      if (!dragging) return
      dragVec.x = e.clientX - originX
      dragVec.y = e.clientY - originY
    }
    function onPointerUp(e) {
      dragging = false
      dragVec.x = 0; dragVec.y = 0
      try { renderer.domElement.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)

    // Device-tilt control — the most literal match for this game: the
    // board's tilt IS the phone's tilt, not a rate you steer with.
    // `tiltRaw` just mirrors the latest sensor reading; baseline
    // calibration and smoothing happen once a frame in tick(), not per
    // event, so it stays independent of how often the sensor fires.
    let tiltBaseline = null
    const tiltRaw = { beta: 0, gamma: 0 }
    const tiltSmooth = { beta: 0, gamma: 0 }
    let tiltWasActive = false
    let lastRecenterSignal = recenterSignalRef.current
    function onDeviceOrientation(e) {
      if (e.beta == null || e.gamma == null) return
      tiltRaw.beta = e.beta
      tiltRaw.gamma = e.gamma
    }
    window.addEventListener('deviceorientation', onDeviceOrientation)

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const MAX_VISUAL_TILT = 0.26 // radians the board visibly leans, cosmetic only
    const clock = new THREE.Clock()
    let wonFired = false
    let trailCursor = 0
    let trailAccum = 0

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const k = keysRef.current

      if (tiltEnabledRef.current) {
        if (!tiltWasActive || recenterSignalRef.current !== lastRecenterSignal) {
          tiltBaseline = { beta: tiltRaw.beta, gamma: tiltRaw.gamma }
          tiltSmooth.beta = tiltRaw.beta
          tiltSmooth.gamma = tiltRaw.gamma
        }
        tiltWasActive = true
        lastRecenterSignal = recenterSignalRef.current
        const smoothing = 0.25
        tiltSmooth.beta += (tiltRaw.beta - tiltSmooth.beta) * smoothing
        tiltSmooth.gamma += (tiltRaw.gamma - tiltSmooth.gamma) * smoothing
        state.tilt = tiltFromDeviceAngles(tiltSmooth.beta - tiltBaseline.beta, tiltSmooth.gamma - tiltBaseline.gamma)
      } else {
        tiltWasActive = false
        if (dragging) {
          state.tilt = tiltFromDrag(dragVec.x, dragVec.y, DRAG_MAX_PX)
        } else {
          const turnX = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0)
          const turnY = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0)
          if (turnX || turnY) { state.tilt = applyKeyTilt(state.tilt, turnX, turnY, dt); audio.ensure() }
          else state.tilt = decayTilt(state.tilt, dt)
        }
      }

      if (mutedRef.current !== lastMuted) { lastMuted = mutedRef.current; audio.setMuted(lastMuted) }

      stepGame(state, dt)
      tiltGroup.rotation.z = -state.tilt.x * MAX_VISUAL_TILT
      tiltGroup.rotation.x = state.tilt.y * MAX_VISUAL_TILT

      if (state.eventSeq !== lastSeenSeq) {
        lastSeenSeq = state.eventSeq
        const ev = state.lastEvent
        if (ev?.type === 'checkpoint') { audio.playCheckpoint() }
        else if (ev?.type === 'trap') {
          audio.playTrap()
          if (ev.pos) dropBurst.spawn(toWorld(level, ev.pos, 0.1), 26, [1.8, 4.5], [0.4, 0.8])
        } else if (ev?.type === 'goal') {
          audio.playWin()
          confetti.spawn(toWorld(level, state.level.goal, 0.4), 80, [1.5, 4.2], [0.8, 1.6])
        }
      }

      const trapped = state.ball.status === 'trapped'
      const scale = trapped ? Math.max(0.05, state.ball.trapTimer) : 1
      ball.scale.setScalar(scale)
      if (!trapped) {
        const w = toWorld(level, state.ball.pos, BALL_RADIUS)
        ball.position.set(w.x, w.y, w.z)
        const speed = Math.hypot(state.ball.vel.x, state.ball.vel.y)
        if (speed > 0.05) {
          const axis = new THREE.Vector3(state.ball.vel.y, 0, -state.ball.vel.x)
          axis.normalize()
          ball.rotateOnWorldAxis(axis, (speed * dt) / BALL_RADIUS)
        }
        trailAccum += dt
        if (trailAccum > 0.06 && speed > 0.4) {
          trailAccum = 0
          const dot = trailPool[trailCursor]
          trailCursor = (trailCursor + 1) % trailPool.length
          dot.position.copy(ball.position)
          dot.userData.life = 0.5
          dot.material.opacity = 0.45
        }
      }
      trailPool.forEach(dot => {
        if (dot.userData.life > 0) {
          dot.userData.life -= dt
          dot.material.opacity = Math.max(0, dot.userData.life / 0.5) * 0.45
        }
      })

      goalRing.rotation.z += dt * 0.6
      goalRing.position.y = 0.03 + Math.sin(t * 3) * 0.02
      holeMeshes.forEach((ring, i) => { ring.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.05) })

      gateMeshes.forEach(({ mesh, wall }) => {
        const open = isGateOpen(wall.gate, state.ball.elapsed)
        mesh.material.color.setHex(open ? 0x3dff8f : 0xff3b3b)
        mesh.material.emissive.setHex(open ? 0x3dff8f : 0xff3b3b)
        const s2 = open ? 0.08 : 1
        mesh.scale.y = s2
        mesh.position.y = (WALL_HEIGHT * s2) / 2
      })

      dropBurst.update(dt, -2.4)
      confetti.update(dt, -2.0)

      audio.updateRoll(Math.hypot(state.ball.vel.x, state.ball.vel.y), state.ball.status === 'playing')

      renderer.render(scene, camera)

      const totalStations = level.checkpoints.length + 1
      const station = state.result === 'won' ? totalStations : state.reached.size
      onHudRef.current({
        elapsed: state.ball.elapsed,
        drops: state.ball.drops,
        trapped,
        won: state.result === 'won',
        station,
        totalStations,
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
      window.removeEventListener('deviceorientation', onDeviceOrientation)
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
        Tilt the whole board — drag with your mouse/finger, use the arrow keys, or on a phone tap
        📱 Tilt in the HUD and steer by physically tilting the phone — and let gravity roll the
        ball through the corridors, top-down, just like the wooden marble-labyrinth toy. Watch for
        holes: some lurk down dead-end branches, others sit right on your route, so tilt carefully
        to ease around them. Checkpoints save your spot if you fall in. Some boards add a timed
        gate — red is shut, green is open.
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
          <span className={styles.levelBlurb}>One shared board for {dailySeed} — everyone gets the same layout today.</span>
          <span className={styles.levelBest}>{best[dailyKey] !== undefined ? `Best: ${best[dailyKey].toFixed(1)}s` : 'Not played yet'}</span>
        </button>
        <button
          className={`${styles.levelCard} ${styles.specialCard}`}
          onClick={() => onPlay({ kind: 'random', seed: Date.now() + Math.floor(Math.random() * 1e6) })}
        >
          <span className={styles.levelNum}>🔀</span>
          <span className={styles.levelName}>Random Maze</span>
          <span className={styles.levelBlurb}>A freshly generated board — different every time, always fair.</span>
          <span className={styles.levelBest}>Endless variety</span>
        </button>
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function Hud({ hud, levelName, muted, onToggleMute, onReplay, onMenu, tiltSupported, tiltEnabled, onToggleTilt, onRecenter }) {
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
      {tiltEnabled && <div className={styles.tiltMsg}>📱 Tilt control on — hold flat where you want "neutral," then tilt to steer.</div>}
      <div className={styles.hudBottom}>
        <button className={styles.smallBtn} onClick={onToggleMute}>{muted ? '🔇' : '🔊'}</button>
        {tiltSupported && (
          <button className={styles.smallBtn} onClick={onToggleTilt}>{tiltEnabled ? '📱 Tilt: On' : '📱 Tilt: Off'}</button>
        )}
        {tiltEnabled && <button className={styles.smallBtn} onClick={onRecenter}>🎯 Recenter</button>}
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
        <h2 className={styles.modalTitle}>🏆 Board Complete!</h2>
        <p className={styles.resultLine}>Time: {result.time.toFixed(1)}s{isNewBest && <span className={styles.newBest}> — New Best!</span>}</p>
        <p className={styles.resultLine}>Drops into holes: {result.drops}</p>
        <div className={styles.modalBtnRow}>
          {showNext && <button className={styles.bigBtn} onClick={onNext}>▶ Next Board</button>}
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
  const [tiltSupported] = useState(() => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window)
  const [tiltEnabled, setTiltEnabled] = useState(false)
  const [recenterSignal, setRecenterSignal] = useState(0)

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

  // iOS 13+ gates motion sensors behind an explicit permission prompt that
  // must be triggered directly by a user gesture (this click handler) —
  // requesting it from anywhere else (e.g. on mount) silently fails.
  // Android/desktop browsers have no such API and just start reporting.
  async function toggleTilt() {
    if (tiltEnabled) { setTiltEnabled(false); return }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result !== 'granted') return
      }
      setTiltEnabled(true)
    } catch { /* sensor unavailable or permission denied — stay in drag mode */ }
  }
  function recenterTilt() { setRecenterSignal(s => s + 1) }

  function replay() { play(levelSpec) }
  function next() { if (levelSpec.kind === 'fixed') play({ kind: 'fixed', index: Math.min(levelSpec.index + 1, LEVELS.length - 1) }) }
  function newRandom() { play({ kind: 'random', seed: Date.now() + Math.floor(Math.random() * 1e6) }) }
  function toMenu() { setScreen('select') }

  return (
    <div className={styles.page}>
      {screen === 'select' && <LevelSelect onPlay={play} best={best} />}
      {screen === 'playing' && (
        <>
          <GameCanvas
            key={canvasKey}
            level={currentLevel}
            onHud={setHud}
            onWin={handleWin}
            muted={muted}
            tiltEnabled={tiltEnabled}
            recenterSignal={recenterSignal}
          />
          <Hud
            hud={hud}
            levelName={currentLevel.name}
            muted={muted}
            onToggleMute={toggleMute}
            onReplay={replay}
            onMenu={toMenu}
            tiltSupported={tiltSupported}
            tiltEnabled={tiltEnabled}
            onToggleTilt={toggleTilt}
            onRecenter={recenterTilt}
          />
          {winResult && (
            <WinOverlay result={winResult} levelSpec={levelSpec} best={best} onNext={next} onReplay={replay} onMenu={toMenu} onNewRandom={newRandom} />
          )}
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}
    </div>
  )
}
