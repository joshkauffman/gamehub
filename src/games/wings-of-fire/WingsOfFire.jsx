import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './WingsOfFire.module.css'
import { TRIBES, getTribe, WAVES, MAP_HALF } from './constants.js'
import { createSoloState, createDuelState, createTutorialState, stepGame } from './gameEngine.js'

// ── Wings of Fire: Talon Clash ───────────────────────────────────────────
// An original dragon-tribe combat game inspired by Wings of Fire: pick a
// tribe, fly Scarlet's Arena — a fire-lit gladiator colosseum — and fight
// with a basic claw plus one tribe-specific breath attack. Same
// engine/render split as this hub's other 3D games — every dragon is
// procedural low-poly geometry built from primitives, no external art.
//
// Movement convention (matches every other open-world game in this hub):
// at yaw=0 a dragon's facing direction is (fx,fz) = (-sin(yaw), -cos(yaw)),
// i.e. world -Z. The model below is built with its head toward local -Z so
// mesh.rotation.y = state.yaw lines the snout up with the travel direction
// directly, with no extra offset needed.

const toonGradient = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 4; canvas.height = 1
  const ctx = canvas.getContext('2d')
  const shades = ['#4d4d4d', '#8a8a8a', '#c2c2c2', '#ffffff']
  shades.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1) })
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
})()

// Cheap inverted-hull cartoon outline: an enlarged, BackSide-only copy of
// a mesh's geometry, added as a sibling so only the silhouette peeking out
// around the original mesh's edges renders. Only worth it on chunky primary
// volumes — thin/rod-like parts (horns, tail, legs) get a giant wedge
// artifact when viewed end-on, so those are deliberately skipped.
function addOutline(parent, mesh, scale = 1.09) {
  const outline = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x120c14, side: THREE.BackSide }))
  outline.position.copy(mesh.position)
  outline.rotation.copy(mesh.rotation)
  outline.scale.copy(mesh.scale).multiplyScalar(scale)
  parent.add(outline)
}

// A stylized tapered wing membrane, authored spanning local x:[0.1, 2.1]
// (root to tip) — mirrored via scale.x for the left side. Rotating flat
// (-90° around X) maps local +Y to world -Z, so the shape's "leading edge"
// (larger local Y) lands toward the front of the dragon, matching the
// head-at--Z convention above.
function makeWingGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0.1, 0.3)
  shape.quadraticCurveTo(1.0, 0.68, 2.1, 0.4)
  shape.quadraticCurveTo(1.7, 0.0, 1.3, -0.38)
  shape.quadraticCurveTo(0.6, -0.52, 0.1, -0.2)
  shape.closePath()
  return new THREE.ShapeGeometry(shape, 8)
}
const sharedWingGeo = makeWingGeometry()

function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
function gaussianBump(x, mu, sigma) { const d = (x - mu) / sigma; return Math.exp(-0.5 * d * d) }

// The body's cross-section radius varies along its length instead of being
// one uniform stretched sphere: it narrows into the neck at the front
// (zt near -1), bulges through the ribcage, pinches at the waist, bulges
// again at the haunches, then narrows into the tail base (zt near +1).
function bodyProfile(zt) {
  const neckTaper = 0.5 + 0.5 * smoothstep(-1, -0.5, zt)
  const chestBulge = 1 + 0.32 * gaussianBump(zt, -0.15, 0.22)
  const waistPinch = 1 - 0.26 * gaussianBump(zt, 0.4, 0.13)
  const haunchBulge = 1 + 0.36 * gaussianBump(zt, 0.7, 0.16)
  return neckTaper * chestBulge * waistPinch * haunchBulge
}

function makeBodyGeometry() {
  const geo = new THREE.SphereGeometry(0.9, 20, 16)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const p = bodyProfile(v.z / 0.9)
    pos.setX(i, v.x * p)
    pos.setY(i, v.y * p * 0.92)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}
const sharedBodyGeo = makeBodyGeometry()

function makeDragonModel(tribeKey) {
  const tribe = getTribe(tribeKey)
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshToonMaterial({ color: tribe.color, gradientMap: toonGradient })
  const accentMat = new THREE.MeshToonMaterial({ color: tribe.accent, gradientMap: toonGradient })
  const bellyColor = new THREE.Color(tribe.color).lerp(new THREE.Color(0xffffff), 0.55)
  const bellyMat = new THREE.MeshToonMaterial({ color: bellyColor, gradientMap: toonGradient })

  const bulk = tribeKey === 'mudwing' ? 1.18 : 1

  const body = new THREE.Mesh(sharedBodyGeo, bodyMat)
  body.scale.set(1 * bulk, 0.85 * bulk, 1.9)
  g.add(body)
  addOutline(g, body)

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), bellyMat)
  belly.scale.set(0.85 * bulk, 0.55 * bulk, 1.55)
  belly.position.set(0, -0.45, 0.1)
  g.add(belly)

  // Belly scutes — small overlapping plates along the underside.
  const scuteGeo = new THREE.BoxGeometry(0.5 * bulk, 0.08, 0.32)
  for (let i = 0; i < 5; i++) {
    const scute = new THREE.Mesh(scuteGeo, bellyMat)
    scute.position.set(0, -0.68 * bulk, -0.9 + i * 0.5)
    g.add(scute)
  }

  // Shoulder bulges where the wings root into the body.
  const shoulderGeo = new THREE.SphereGeometry(0.32, 8, 6)
  const shoulders = [-1, 1].map(side => {
    const shoulder = new THREE.Mesh(shoulderGeo, bodyMat)
    shoulder.scale.set(1, 0.85, 1.2)
    shoulder.position.set(side * 0.55 * bulk, 0.1, -0.15)
    g.add(shoulder)
    return shoulder
  })

  // A distinct, visibly thinner neck bridges the tucked-in front of the
  // body to the head — a real segment, not just a gentle blend.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46 * bulk, 1.05, 10), bodyMat)
  neck.rotation.x = -Math.PI / 2
  neck.position.set(0, 0.22, -1.55)
  g.add(neck)
  addOutline(g, neck)

  // Head toward -Z (front).
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 10), bodyMat)
  head.scale.set(0.85, 0.8, 1.05)
  head.position.set(0, 0.38, -2.05)
  g.add(head)
  addOutline(g, head)

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 8), bodyMat)
  snout.rotation.x = -Math.PI / 2
  snout.position.set(0, 0.25, -2.55)
  g.add(snout)

  const hornGeo = new THREE.ConeGeometry(0.08, 0.42, 6)
  ;[-1, 1].forEach(side => {
    const horn = new THREE.Mesh(hornGeo, accentMat)
    horn.position.set(side * 0.22, 0.75, -1.85)
    horn.rotation.z = side * 0.35
    g.add(horn)
  })

  const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe98a })
  ;[-1, 1].forEach(side => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(side * 0.3, 0.48, -2.35)
    g.add(eye)
  })

  // Spine ridge — small spikes from behind the head to the base of the
  // tail. SeaWing gets a taller, more dramatic dorsal fin row.
  const ridgeGeo = new THREE.ConeGeometry(0.1, 0.3, 4)
  const ridgeScale = tribeKey === 'seawing' ? 1.9 : 1
  for (let i = 0; i < 6; i++) {
    const z = -1.0 + i * 0.5
    const taper = 1 - Math.abs(i - 2.5) / 4
    const fin = new THREE.Mesh(ridgeGeo, accentMat)
    fin.scale.setScalar(ridgeScale * Math.max(0.5, taper))
    fin.position.set(0, 0.7 * bulk, z)
    g.add(fin)
  }

  // Tail toward +Z (back).
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 8), bodyMat)
  tail.rotation.x = Math.PI / 2
  tail.position.set(0, -0.05, 2.0)
  g.add(tail)

  if (tribeKey === 'sandwing') {
    const barb = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), accentMat)
    barb.rotation.x = Math.PI / 2
    barb.position.set(0, -0.05, 3.05)
    g.add(barb)
  }

  const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18)
  ;[[-0.55, -0.7], [0.55, -0.7], [-0.5, 0.6], [0.5, 0.6]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, accentMat)
    leg.position.set(x, -0.5, z)
    g.add(leg)
  })

  const wingMat = new THREE.MeshToonMaterial({ color: tribe.accent, gradientMap: toonGradient, side: THREE.DoubleSide, transparent: true, opacity: 0.94 })
  const wingPivots = [-1, 1].map(side => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.3, 0.15, 0.05)
    const wing = new THREE.Mesh(sharedWingGeo, wingMat)
    wing.rotation.x = -Math.PI / 2
    wing.scale.x = side
    pivot.add(wing)
    addOutline(pivot, wing, 1.12)
    g.add(pivot)
    return pivot
  })
  g.userData.wingPivots = wingPivots
  g.userData.bodyMeshes = [body, head, snout, neck, ...shoulders]
  g.userData.baseColor = tribe.color
  return g
}

function makeProjectileMesh(color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 }),
  )
  mesh.visible = false
  return mesh
}

// Scarlet's Arena: a fire-lit gladiator colosseum — sandy floor, a glowing
// lava moat, tiered stone stands, torches, banners, and Scarlet's own
// raised throne box, matching the arena from the books where dragonets
// were forced to fight for the SkyWing queen's entertainment.
function buildArenaScene() {
  const scene = new THREE.Scene()
  const skyColor = 0x2a1420
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.Fog(skyColor, 55, 260)

  scene.add(new THREE.HemisphereLight(0xffb37a, 0x2a1018, 1.05))
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.0)
  sun.position.set(40, 60, 15)
  scene.add(sun)

  const floorR = MAP_HALF * 1.15
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(floorR, 40),
    new THREE.MeshStandardMaterial({ color: 0xc99a5c, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // Sandy floor scuff rings for texture/scale.
  const scuffMat = new THREE.MeshBasicMaterial({ color: 0xb5854a, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(10 + i * 9, 10.6 + i * 9, 40), scuffMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.01
    scene.add(ring)
  }

  // Glowing lava moat at the base of the colosseum wall.
  const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3300, emissiveIntensity: 1.15, roughness: 1, side: THREE.DoubleSide })
  const lava = new THREE.Mesh(new THREE.RingGeometry(floorR, floorR + 5, 48), lavaMat)
  lava.rotation.x = -Math.PI / 2
  lava.position.y = 0.03
  scene.add(lava)
  const lavaGlow = new THREE.PointLight(0xff5a1f, 2.2, 90, 2)
  lavaGlow.position.set(0, 4, 0)
  scene.add(lavaGlow)

  // Tiered stone colosseum wall, stepping outward and up.
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1, side: THREE.DoubleSide })
  const wallBaseR = floorR + 8
  const tierH = 6.5
  for (let i = 0; i < 4; i++) {
    const rBottom = wallBaseR + i * 7
    const rTop = rBottom + 7
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, tierH, 48, 1, true), stoneMat)
    ring.position.y = i * tierH + tierH / 2
    scene.add(ring)
  }

  // Torches ringing the arena, with a subtle per-torch flicker driven from
  // the render loop.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  const torchLights = []
  const torchFlames = []
  const torchCount = 18
  for (let i = 0; i < torchCount; i++) {
    const angle = (i / torchCount) * Math.PI * 2
    const r = wallBaseR - 1.5
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3, 6), poleMat)
    pole.position.set(Math.cos(angle) * r, 1.5, Math.sin(angle) * r)
    scene.add(pole)
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), flameMat)
    flame.position.set(Math.cos(angle) * r, 3.2, Math.sin(angle) * r)
    scene.add(flame)
    const light = new THREE.PointLight(0xffaa33, 1.3, 24, 2)
    light.position.copy(flame.position)
    scene.add(light)
    torchLights.push(light)
    torchFlames.push(flame)
  }

  // Red-and-gold banners hanging between the torches.
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0xaa1a2a, roughness: 1, side: THREE.DoubleSide })
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + 0.3
    const r = wallBaseR - 0.5
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.5), bannerMat)
    banner.position.set(Math.cos(angle) * r, 4.5, Math.sin(angle) * r)
    banner.rotation.y = angle + Math.PI / 2
    scene.add(banner)
  }

  // Scarlet's throne — a raised royal box jutting from the wall, the
  // arena's namesake landmark.
  const throneMat = new THREE.MeshStandardMaterial({ color: 0x6a1a1a, roughness: 0.85 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x5a4310, emissiveIntensity: 0.4 })
  const throneGroup = new THREE.Group()
  const platform = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 6), throneMat)
  throneGroup.add(platform)
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.4, 0.7), throneMat)
  backrest.position.set(0, 2.8, -2.3)
  throneGroup.add(backrest)
  ;[-1.5, 1.5].forEach(x => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.3, 6), goldMat)
    spike.position.set(x, 5.2, -2.3)
    throneGroup.add(spike)
  })
  const throneLight = new THREE.PointLight(0xffaa66, 1.5, 30, 2)
  throneLight.position.set(0, 6, -(wallBaseR - 4))
  scene.add(throneLight)
  throneGroup.position.set(0, 5, -(wallBaseR - 3))
  scene.add(throneGroup)

  return { scene, torchLights, torchFlames }
}

function rand(a, b) { return a + Math.random() * (b - a) }

const P1_KEYS = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', up: 'Space', down: 'ShiftLeft', claw: 'KeyF', breath: 'KeyG' }
const P2_KEYS = { fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', up: 'ShiftRight', down: 'ControlRight', claw: 'Comma', breath: 'Period' }

function readInput(keys, map) {
  const turn = (keys.has(map.left) ? 1 : 0) - (keys.has(map.right) ? 1 : 0)
  const thrust = (keys.has(map.fwd) ? 1 : 0) - (keys.has(map.back) ? 1 : 0)
  const vertical = (keys.has(map.up) ? 1 : 0) - (keys.has(map.down) ? 1 : 0)
  return { turn, thrust, vertical, claw: keys.has(map.claw), breath: keys.has(map.breath) }
}

const TUTORIAL_STEPS = [
  { key: 'moved', label: 'Fly forward or back — hold W or S' },
  { key: 'turned', label: 'Turn — hold A or D' },
  { key: 'altitude', label: 'Change altitude — Space to climb, Shift to dive' },
  { key: 'clawed', label: 'Claw attack — press F near the dummy' },
  { key: 'breathed', label: 'Breath attack — press G' },
]

function GameCanvas({ mode, tribeA, tribeB, onHud, onResult }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onResultRef = useRef(onResult); onResultRef.current = onResult

  useEffect(() => {
    const mount = mountRef.current
    let raf = null
    let disposed = false

    const state = mode === 'duel' ? createDuelState(tribeA, tribeB)
      : mode === 'tutorial' ? createTutorialState(tribeA)
      : createSoloState(tribeA)
    const spawnP1 = { x: state.dragons[0].x, y: state.dragons[0].y, z: state.dragons[0].z }
    const tutorialProgress = { moved: false, turned: false, altitude: false, clawed: false, breathed: false }
    let climbedUp = false, divedDown = false

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 400)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    function onKeyDown(e) {
      const codes = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'ShiftLeft', 'ShiftRight', 'ControlRight', 'Comma', 'Period']
      if (codes.includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const { scene, torchLights, torchFlames } = buildArenaScene()

    const meshById = {}
    state.dragons.forEach(d => {
      const mesh = makeDragonModel(d.tribe)
      scene.add(mesh)
      meshById[d.id] = mesh
    })

    const PROJECTILE_POOL_SIZE = 24
    const projectilePool = Array.from({ length: PROJECTILE_POOL_SIZE }, () => {
      const mesh = makeProjectileMesh(0xffffff)
      scene.add(mesh)
      return mesh
    })

    const clock = new THREE.Clock()

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const k = keysRef.current

      const p1Before = state.dragons.find(d => d.id === 'p1')
      const prevClaw = p1Before?.clawCooldown ?? 0
      const prevBreath = p1Before?.breathCooldown ?? 0

      const inputs = {}
      if (!state.result) {
        if (p1Before?.alive) inputs.p1 = readInput(k, P1_KEYS)
        if (mode === 'duel') {
          const p2 = state.dragons.find(d => d.id === 'p2')
          if (p2?.alive) inputs.p2 = readInput(k, P2_KEYS)
        }
        stepGame(state, inputs, dt)
      }

      if (mode === 'tutorial') {
        const p1 = state.dragons.find(d => d.id === 'p1')
        if (Math.hypot(p1.x - spawnP1.x, p1.z - spawnP1.z) > 2.5) tutorialProgress.moved = true
        if (Math.abs(p1.yaw) > 0.3) tutorialProgress.turned = true
        if (p1.y > spawnP1.y + 1.2) climbedUp = true
        if (p1.y < spawnP1.y - 1.2) divedDown = true
        if (climbedUp && divedDown) tutorialProgress.altitude = true
        if (prevClaw <= 0 && p1.clawCooldown > 0) tutorialProgress.clawed = true
        if (prevBreath <= 0 && p1.breathCooldown > 0) tutorialProgress.breathed = true
      }

      // Sync dragon meshes.
      state.dragons.forEach(d => {
        const mesh = meshById[d.id]
        if (!mesh) return
        mesh.visible = d.alive
        if (!d.alive) return
        mesh.position.set(d.x, d.y, d.z)
        mesh.rotation.y = d.yaw
        mesh.userData.wingPivots.forEach((pivot, i) => {
          const flap = Math.sin(t * 9 + i * Math.PI) * 0.5
          pivot.rotation.z = (i === 0 ? 1 : -1) * (0.25 + flap)
        })
        const flashColor = d.hitFlash > 0 ? 0xffffff : mesh.userData.baseColor
        mesh.userData.bodyMeshes.forEach(m => m.material.color.setHex(flashColor))
        mesh.visible = d.camoTimer > 0 ? (Math.sin(t * 20) > 0) : true
      })

      Object.keys(meshById).forEach(id => {
        if (!state.dragons.find(d => d.id === id)) meshById[id].visible = false
      })
      // Solo mode spawns a fresh CPU dragon each wave with the same id
      // ('cpu') but a new tribe — rebuild its mesh if the tribe changed.
      if (mode === 'solo') {
        const cpu = state.dragons.find(d => d.id === 'cpu')
        if (cpu && (!meshById.cpu || meshById.cpu.userData.baseColor !== getTribe(cpu.tribe).color)) {
          if (meshById.cpu) scene.remove(meshById.cpu)
          const mesh = makeDragonModel(cpu.tribe)
          scene.add(mesh)
          meshById.cpu = mesh
        }
      }

      // Sync projectile pool.
      state.projectiles.forEach((p, i) => {
        if (i >= projectilePool.length) return
        const mesh = projectilePool[i]
        mesh.visible = true
        mesh.position.set(p.x, p.y, p.z)
        mesh.scale.setScalar(p.radius)
        mesh.material.color.setHex(p.color)
        mesh.material.emissive.setHex(p.color)
      })
      for (let i = state.projectiles.length; i < projectilePool.length; i++) projectilePool[i].visible = false

      torchLights.forEach((light, i) => { light.intensity = 1.1 + Math.sin(t * 9 + i * 1.7) * 0.35 })
      torchFlames.forEach((flame, i) => { flame.scale.setScalar(1 + Math.sin(t * 12 + i * 2.1) * 0.15) })

      // Camera: chase-cam behind p1 in solo/tutorial modes; steep shared
      // top-down-ish framing of both dragons in duel mode (robust to any
      // separation direction — same technique proven for this hub's other
      // 2-player camera, see lil-monster-battles).
      if (mode === 'duel') {
        const p1 = state.dragons.find(d => d.id === 'p1')
        const p2 = state.dragons.find(d => d.id === 'p2')
        const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2, midZ = (p1.z + p2.z) / 2
        const sep = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
        const dist = Math.max(20, Math.min(135, sep * 1.3 + 16))
        const elev = 1.15
        camera.position.set(midX, midY + dist * Math.sin(elev), midZ + dist * Math.cos(elev))
        camera.lookAt(midX, midY, midZ)
      } else {
        const p1 = state.dragons.find(d => d.id === 'p1')
        const fx = -Math.sin(p1.yaw), fz = -Math.cos(p1.yaw)
        const camDist = 9, camHeight = 3.4
        camera.position.set(p1.x - fx * camDist, p1.y + camHeight, p1.z - fz * camDist)
        camera.lookAt(p1.x, p1.y + 0.6, p1.z)
      }

      renderer.render(scene, camera)

      const p1 = state.dragons.find(d => d.id === 'p1')
      const p2 = mode === 'duel' ? state.dragons.find(d => d.id === 'p2')
        : mode === 'tutorial' ? state.dragons.find(d => d.id === 'dummy')
        : state.dragons.find(d => d.id === 'cpu')
      onHudRef.current({
        mode,
        p1: p1 ? { hp: p1.hp, maxHp: p1.maxHp, tribe: p1.tribe, breathCooldown: p1.breathCooldown, clawCooldown: p1.clawCooldown, charging: p1.charging } : null,
        p2: p2 ? { hp: p2.hp, maxHp: p2.maxHp, tribe: p2.tribe, isCPU: !!p2.isCPU } : null,
        wave: state.wave, waveTotal: WAVES.length,
        toast: state.toast,
        result: state.result,
        progress: mode === 'tutorial' ? { ...tutorialProgress } : null,
      })

      if (state.result && !disposed) onResultRef.current(state.result)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      renderer.forceContextLoss()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [mode, tribeA, tribeB])

  return <div ref={mountRef} className={styles.canvasWrap} />
}

function HpBar({ label, hp, maxHp, icon }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  return (
    <div className={styles.hpWrap}>
      <span className={styles.hpLabel}>{icon} {label}</span>
      <div className={styles.hpTrack}><div className={styles.hpFill} style={{ width: `${pct}%`, background: pct < 30 ? '#ff3b3b' : '#7bff8a' }} /></div>
    </div>
  )
}

function Hud({ hud }) {
  if (!hud) return null
  const tribeP1 = hud.p1 && getTribe(hud.p1.tribe)
  const tribeP2 = hud.p2 && getTribe(hud.p2.tribe)
  return (
    <div className={styles.hud}>
      <div className={styles.hudTop}>
        {hud.mode === 'solo' && <span className={styles.waveInfo}>🏛️ Wave {hud.wave + 1}/{hud.waveTotal}</span>}
        {hud.mode === 'duel' && <span className={styles.waveInfo}>⚔️ Duel</span>}
      </div>
      {hud.p1 && <HpBar label={`You (${tribeP1.name})`} hp={hud.p1.hp} maxHp={hud.p1.maxHp} icon={tribeP1.icon} />}
      {hud.p2 && <HpBar label={hud.mode === 'duel' ? `P2 (${tribeP2.name})` : tribeP2.name} hp={hud.p2.hp} maxHp={hud.p2.maxHp} icon={tribeP2.icon} />}
      {hud.toast && <div className={`${styles.toast} ${hud.toast.kind === 'bad' ? styles.toastBad : hud.toast.kind === 'good' ? styles.toastGood : ''}`}>{hud.toast.text}</div>}
    </div>
  )
}

function TutorialHud({ hud, onDone }) {
  if (!hud?.progress) return null
  const allDone = TUTORIAL_STEPS.every(s => hud.progress[s.key])
  return (
    <div className={styles.tutorialPanel}>
      <h3 className={styles.tutorialTitle}>🎓 Flight Training</h3>
      <ul className={styles.tutorialSteps}>
        {TUTORIAL_STEPS.map(s => (
          <li key={s.key} className={hud.progress[s.key] ? styles.stepDone : ''}>
            {hud.progress[s.key] ? '✅' : '⬜'} {s.label}
          </li>
        ))}
      </ul>
      {allDone ? (
        <button className={styles.bigBtn} onClick={onDone}>🎉 I'm Ready! Continue</button>
      ) : (
        <button className={styles.backLink} onClick={onDone}>Skip Tutorial →</button>
      )}
    </div>
  )
}

function TribeCard({ tribe, selected, onClick }) {
  return (
    <button className={`${styles.tribeCard} ${selected ? styles.tribeCardSelected : ''}`} onClick={onClick}>
      <span className={styles.tribeIcon}>{tribe.icon}</span>
      <span className={styles.tribeName}>{tribe.name}</span>
      <span className={styles.tribeDesc}>{tribe.desc}</span>
      <span className={styles.tribeStats}>HP {tribe.maxHp}{tribe.fireResist ? ' · Fire Resist' : ''}</span>
    </button>
  )
}

export default function WingsOfFire() {
  const [screen, setScreen] = useState('intro') // intro | modeSelect | tribeSelect | playing | result
  const [mode, setMode] = useState(null)
  const [pick1, setPick1] = useState(null)
  const [pick2, setPick2] = useState(null)
  const [pickingSlot, setPickingSlot] = useState(1)
  const [hud, setHud] = useState(null)
  const [result, setResult] = useState(null)

  function chooseMode(m) {
    setMode(m)
    setPick1(null); setPick2(null); setPickingSlot(1)
    setScreen('tribeSelect')
  }

  function startTutorial() {
    setMode('tutorial')
    setPick1(null); setPick2(null); setPickingSlot(1)
    setScreen('tribeSelect')
  }

  function chooseTribe(key) {
    if (mode === 'solo' || mode === 'tutorial') { setPick1(key); setScreen('playing'); return }
    if (pickingSlot === 1) { setPick1(key); setPickingSlot(2) }
    else { setPick2(key); setScreen('playing') }
  }

  function handleResult(r) {
    setResult(r)
    setScreen('result')
  }

  function playAgain() { setScreen('tribeSelect'); setPick1(null); setPick2(null); setPickingSlot(1) }
  function backToModes() { setScreen('modeSelect'); setMode(null) }
  function finishTutorial() { setScreen('modeSelect'); setMode(null) }

  const tribeSelectTitle = mode === 'tutorial' ? 'Choose a Practice Dragon'
    : mode === 'solo' ? 'Choose Your Dragon'
    : `Player ${pickingSlot}: Choose Your Dragon`

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🐉 Wings of Fire<span className={styles.subtitle}>Talon Clash</span></h1>
          <p className={styles.blurb}>
            Pick a dragon tribe and take to the sky over Scarlet's Arena — a fire-lit gladiator
            colosseum ringed with a glowing lava moat. Every tribe has a basic claw attack plus one
            signature move — SkyWing's fireball, IceWing's slowing frost, SandWing's fast venom barb,
            SeaWing's knockback tidal blast, MudWing's bone-crushing charge, or RainWing's venom spit
            and camouflage. Fight solo against a gauntlet of rival tribes, or duel a friend on one keyboard.
          </p>
          <button className={styles.bigBtn} onClick={() => setScreen('modeSelect')}>▶ Take Flight</button>
          <button className={styles.secondaryBtn} onClick={startTutorial}>🎓 How to Fly (Tutorial)</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'modeSelect' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>Choose Your Battle</h2>
          <div className={styles.modeRow}>
            <button className={styles.modeCard} onClick={() => chooseMode('solo')}>
              <span className={styles.modeIcon}>🏛️</span>
              <span className={styles.modeName}>Solo vs CPU Waves</span>
              <span className={styles.modeDesc}>Survive a gauntlet of six rival tribes, one after another.</span>
            </button>
            <button className={styles.modeCard} onClick={() => chooseMode('duel')}>
              <span className={styles.modeIcon}>⚔️</span>
              <span className={styles.modeName}>2-Player Duel</span>
              <span className={styles.modeDesc}>Two dragons, one keyboard. First to fall loses.</span>
            </button>
          </div>
          <button className={styles.secondaryBtn} onClick={startTutorial}>🎓 How to Fly (Tutorial)</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'tribeSelect' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>{tribeSelectTitle}</h2>
          <div className={styles.tribeGrid}>
            {TRIBES.map(t => (
              <TribeCard key={t.key} tribe={t} selected={false} onClick={() => chooseTribe(t.key)} />
            ))}
          </div>
          <button className={styles.backLink} onClick={backToModes}>← Back</button>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <GameCanvas mode={mode} tribeA={pick1} tribeB={pick2} onHud={setHud} onResult={handleResult} />
          {mode === 'tutorial' ? <TutorialHud hud={hud} onDone={finishTutorial} /> : <Hud hud={hud} />}
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}

      {screen === 'result' && (
        <div className={styles.overlayScreen}>
          {mode === 'solo' ? (
            result === 'victory' ? (
              <>
                <h2 className={styles.title2}>🏆 Victory!</h2>
                <p className={styles.blurb}>You cleared all {WAVES.length} waves as a {getTribe(pick1).name}. Scarlet's Arena is yours.</p>
              </>
            ) : (
              <>
                <h2 className={styles.title2}>💀 Defeated</h2>
                <p className={styles.blurb}>You fell as a {getTribe(pick1).name}. Try a different tribe, or the same one with sharper flying!</p>
              </>
            )
          ) : (
            <>
              <h2 className={styles.title2}>🏆 Player {result === 'p1' ? '1' : '2'} Wins!</h2>
              <p className={styles.blurb}>
                {getTribe(result === 'p1' ? pick1 : pick2).name} beat {getTribe(result === 'p1' ? pick2 : pick1).name} in the duel.
              </p>
            </>
          )}
          <button className={styles.bigBtn} onClick={playAgain}>↻ Play Again</button>
          <button className={styles.backLink} onClick={backToModes}>← Change Mode</button>
        </div>
      )}
    </div>
  )
}
