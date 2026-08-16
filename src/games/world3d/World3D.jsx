import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import styles from './World3D.module.css'

function roundedBox(w, h, d) {
  const radius = Math.min(0.16, Math.min(w, h, d) * 0.14)
  return new RoundedBoxGeometry(w, h, d, 2, radius)
}

// ── Constants ─────────────────────────────────────────────────────────
const GRAVITY        = 16
const FLY_ACCEL       = 30
const MAX_RISE_SPEED  = 8
const MAX_FALL_SPEED  = -11
const JUMP_SPEED      = 7
const MOVE_SPEED      = 6
const PLAYER_RADIUS   = 0.4
const GROUND_SIZE     = 420
const EYE_HEIGHT      = 1.7

const ENERGY_MAX      = 100
const ENERGY_START    = 45
const ENERGY_DRAIN    = 26   // per second while flying
const ENERGY_PER_ORB  = 16

const INTERACT_RANGE  = 2.4
const PORTAL_RANGE    = 2.2
const TELEPORT_LOCK   = 0.8  // seconds of immunity after a teleport

const MEADOW_SPAWN = { x: 0, y: 0, z: 16, yaw: 0.15 }
const RUINS_SPAWN  = { x: 0, y: 0, z: -130, yaw: 0 }

// Walkable, collidable platforms (axis-aligned boxes only — collision math
// assumes no rotation).
const MEADOW_PLATFORMS = [
  { x: 6,   y: 1,   z: -4,  w: 4, h: 2,   d: 4,  color: 0xd97757 },
  { x: 11,  y: 2.5, z: -8,  w: 4, h: 5,   d: 4,  color: 0xe0a06b },
  { x: -8,  y: 1.5, z: 6,   w: 5, h: 3,   d: 5,  color: 0x6c63ff },
  { x: -14, y: 3.5, z: 10,  w: 4, h: 7,   d: 4,  color: 0x8a7dff },
  { x: 0,   y: 4.5, z: -16, w: 6, h: 9,   d: 6,  color: 0x4fa3d1 },
  { x: -3,  y: 0.5, z: 3,   w: 3, h: 1,   d: 3,  color: 0xd97757 },
  { x: 2,   y: 5.5, z: -30, w: 3, h: 11,  d: 3,  color: 0x9b8bdb }, // spirit shrine
]

const RUINS_PLATFORMS = [
  { x: 0,  y: 0.4, z: -142, w: 5, h: 0.8, d: 5,  color: 0xb9ab8a },
  { x: -4, y: 0.25,z: -138, w: 1.3,h: 0.5,d: 1.3,color: 0xa89a78 },
  { x: 4,  y: 0.25,z: -136, w: 1.3,h: 0.5,d: 1.3,color: 0xa89a78 },
  { x: -2, y: 0.25,z: -146, w: 1.3,h: 0.5,d: 1.3,color: 0xa89a78 },
  { x: 6,  y: 1.5, z: -150, w: 4, h: 3,   d: 4,  color: 0xaea080 },
  { x: -6, y: 2.5, z: -158, w: 4, h: 5,   d: 4,  color: 0x9c8f70 },
  { x: 2,  y: 4,   z: -168, w: 5, h: 8,   d: 5,  color: 0x8f8264 },
  { x: 2,  y: 7,   z: -180, w: 6, h: 14,  d: 6,  color: 0x7d7050 }, // temple summit
]

// Collectible light orbs: on the ground, atop platforms, and floating high
// (the sky ones only reachable by flying).
const MEADOW_ORBS = [
  { x: 3, y: 0.7, z: 6 }, { x: -4, y: 0.7, z: -2 }, { x: 8, y: 0.7, z: 2 },
  { x: -10, y: 0.7, z: -3 }, { x: 2, y: 0.7, z: 12 }, { x: -6, y: 0.7, z: -9 },
  { x: 14, y: 0.7, z: 4 }, { x: -2, y: 0.7, z: -12 },
  { x: 6,   y: 2.7, z: -4 },
  { x: 11,  y: 5.7, z: -8 },
  { x: -8,  y: 3.7, z: 6 },
  { x: -14, y: 7.7, z: 10 },
  { x: 0,   y: 9.7, z: -16 },
  { x: -3,  y: 1.7, z: 3 },
  { x: 3,   y: 12, z: -10 }, { x: -10, y: 14, z: -6 },
  { x: 9,   y: 16, z: -14 }, { x: -16, y: 13, z: 3 },
  { x: 0,   y: 18, z: -4 },  { x: 6,   y: 10, z: 8 },
  { x: 2,   y: 3,  z: -20 }, { x: 2,   y: 11.7, z: -30 }, // breadcrumbs to the shrine
]

const RUINS_ORBS = [
  { x: 0, y: 1.3, z: -142 }, { x: -4, y: 1, z: -138 }, { x: 4, y: 1, z: -136 },
  { x: 6, y: 3.7, z: -150 }, { x: -6, y: 5.7, z: -158 },
  { x: 2, y: 8.7, z: -168 }, { x: 2, y: 15, z: -180 },
  { x: -3, y: 0.7, z: -150 }, { x: 8, y: 0.7, z: -162 },
  { x: 2, y: 20, z: -180 }, { x: -8, y: 18, z: -170 },
]

const ALL_ORBS = [
  ...MEADOW_ORBS.map(o => ({ ...o })),
  ...RUINS_ORBS.map(o => ({ ...o })),
]

const SPIRITS = [
  {
    id: 'meadow', name: 'Meadow Spirit', color: 0x9fe0d6,
    x: 2, y: 11.6, z: -30,
    unlockMessage: 'The Meadow Spirit is free ✨ A new map has opened to the north — follow the shrine path.',
  },
  {
    id: 'ruins', name: 'Ruins Spirit', color: 0xe0c07a,
    x: 2, y: 14.6, z: -180,
    unlockMessage: "The Ruins Spirit is free ✨ You've freed every spirit of Skylight.",
  },
]

// ── tiny WebAudio chimes, no assets ─────────────────────────────────
function playChime(ctx, base = 740, top = 1320) {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base, t)
  osc.frequency.exponentialRampToValueAtTime(top, t + 0.18)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.5)
}
function playSpiritChime(ctx) {
  const t = ctx.currentTime
  ;[520, 660, 880].forEach((f, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f, t + i * 0.12)
    gain.gain.setValueAtTime(0.0001, t + i * 0.12)
    gain.gain.exponentialRampToValueAtTime(0.2, t + i * 0.12 + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 1.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t + i * 0.12)
    osc.stop(t + i * 0.12 + 1.1)
  })
}

// ── decorative (non-collidable) scenery builders ────────────────────
function makeTree(x, z) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
  )
  trunk.position.y = 0.8
  trunk.castShadow = true
  g.add(trunk)
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.9 })
  )
  foliage.position.y = 2.4
  foliage.castShadow = true
  g.add(foliage)
  g.position.set(x, 0, z)
  return g
}
function makeStone(x, z, rot) {
  const stone = new THREE.Mesh(
    roundedBox(0.7, 1.3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x6b6b73, roughness: 1 })
  )
  stone.position.set(x, 0.55, z)
  stone.rotation.set(0.06, rot, 0.1)
  stone.castShadow = true
  return stone
}
function makeArch(x, z, ry, radius = 3.2, color = 0x9b8bdb) {
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.35, 10, 24, Math.PI),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  )
  arch.position.set(x, radius, z)
  arch.rotation.set(0, ry, Math.PI)
  arch.castShadow = true
  return arch
}
function makeColumn(x, z, height = 4, tilt = 0) {
  const g = new THREE.Group()
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.55, height, 10),
    new THREE.MeshStandardMaterial({ color: 0xa89a78, roughness: 1 })
  )
  shaft.position.y = height / 2
  shaft.castShadow = true
  g.add(shaft)
  const cap = new THREE.Mesh(
    roundedBox(1.3, 0.3, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x8f8264, roughness: 1 })
  )
  cap.position.y = height + 0.15
  cap.castShadow = true
  g.add(cap)
  g.position.set(x, 0, z)
  g.rotation.z = tilt
  return g
}

// ── Component ────────────────────────────────────────────────────────
export default function World3D() {
  const mountRef = useRef(null)
  const [locked, setLocked] = useState(false)
  const [collected, setCollected] = useState(0)
  const [spiritsFreed, setSpiritsFreed] = useState(0)
  const [energyPct, setEnergyPct] = useState(ENERGY_START / ENERGY_MAX)
  const [banner, setBanner] = useState(null)
  const [nearSpirit, setNearSpirit] = useState(null)

  useEffect(() => {
    const mount = mountRef.current

    // Scene setup — dusk sky gradient
    const scene = new THREE.Scene()
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 2
    skyCanvas.height = 256
    const skyCtx = skyCanvas.getContext('2d')
    const grad = skyCtx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#2a2a5c')
    grad.addColorStop(0.45, '#5a4a8f')
    grad.addColorStop(0.75, '#d97757')
    grad.addColorStop(1, '#f2c78c')
    skyCtx.fillStyle = grad
    skyCtx.fillRect(0, 0, 2, 256)
    const skyTexture = new THREE.CanvasTexture(skyCanvas)
    scene.background = skyTexture
    const fogMeadow = new THREE.Color(0xd9a06f)
    const fogRuins = new THREE.Color(0x6b5a7a)
    scene.fog = new THREE.Fog(fogMeadow.getHex(), 35, 140)

    const camera = new THREE.PerspectiveCamera(
      68,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.65, 0.5, 0.82
    )
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())

    // Lights — warm dusk sun + cool fill
    scene.add(new THREE.HemisphereLight(0xffe6c0, 0x445577, 1.0))
    scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const sun = new THREE.DirectionalLight(0xffc98a, 1.3)
    sun.position.set(-25, 30, -15)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -60
    sun.shadow.camera.right = 60
    sun.shadow.camera.top = 60
    sun.shadow.camera.bottom = -60
    scene.add(sun)

    // Ground — a single plane whose vertex colors fade from meadow green
    // to sandy ruin stone as you travel north (-Z).
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 2, 140)
    const meadowGround = new THREE.Color(0x4c8355)
    const ruinsGround = new THREE.Color(0xc9b486)
    const posAttr = groundGeo.attributes.position
    const colors = new Float32Array(posAttr.count * 3)
    for (let i = 0; i < posAttr.count; i++) {
      const localY = posAttr.getY(i) // maps to world z = -localY after rotation
      const worldZ = -localY
      const tt = Math.min(1, Math.max(0, (-worldZ - 40) / 70))
      const c = meadowGround.clone().lerp(ruinsGround, tt)
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // Walkable platforms
    const allPlatformDefs = [...MEADOW_PLATFORMS, ...RUINS_PLATFORMS]
    const platformMeshes = allPlatformDefs.map(p => {
      const mesh = new THREE.Mesh(
        roundedBox(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.75, metalness: 0.05 })
      )
      mesh.position.set(p.x, p.y, p.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      return {
        top: p.y + p.h / 2,
        minX: p.x - p.w / 2 - PLAYER_RADIUS,
        maxX: p.x + p.w / 2 + PLAYER_RADIUS,
        minZ: p.z - p.d / 2 - PLAYER_RADIUS,
        maxZ: p.z + p.d / 2 + PLAYER_RADIUS,
      }
    })

    // Decorative scenery (no collision)
    const decor = new THREE.Group()
    ;[[10, 14], [-10, 12], [4, 19], [-13, 4], [13, -2]].forEach(([x, z]) => decor.add(makeTree(x, z)))
    ;[[2, -2, 0.3], [-5, -6, -0.4], [9, 5, 0.7], [-9, -10, 0.2]].forEach(([x, z, r]) => decor.add(makeStone(x, z, r)))
    decor.add(makeArch(0, 9, 0))
    // ruins flanking columns + scattered broken pillars
    decor.add(makeColumn(-4, -139, 5))
    decor.add(makeColumn(4, -139, 5))
    ;[[10, -152, 2.4, 0.5], [-11, -156, 1.8, -0.7], [-2, -170, 3, 0.3], [9, -175, 2, -0.4], [-9, -182, 2.6, 0.6]]
      .forEach(([x, z, h, tilt]) => decor.add(makeColumn(x, z, h, tilt)))
    decor.add(makeArch(-2, -190, 0.3, 4, 0x8f8264))
    scene.add(decor)

    // Firefly-style ambient particles
    const fireflyCount = 140
    const fireflyGeo = new THREE.BufferGeometry()
    const fireflyPos = new Float32Array(fireflyCount * 3)
    const fireflySpeed = new Float32Array(fireflyCount)
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3]     = (Math.random() - 0.5) * 60
      fireflyPos[i * 3 + 1] = Math.random() * 14
      fireflyPos[i * 3 + 2] = -Math.random() * 210
      fireflySpeed[i] = 0.3 + Math.random() * 0.6
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3))
    const fireflyMat = new THREE.PointsMaterial({
      color: 0xffe6b0, size: 0.18, transparent: true, opacity: 0.8,
      depthWrite: false,
    })
    const fireflies = new THREE.Points(fireflyGeo, fireflyMat)
    scene.add(fireflies)

    // Player character — simple robed figure, hidden in first person but
    // still tracked so its light halo follows along.
    const playerGroup = new THREE.Group()
    const playerGlow = new THREE.PointLight(0xffd9a0, 0.8, 6)
    playerGlow.position.set(0, 1.2, 0)
    playerGroup.add(playerGlow)
    scene.add(playerGroup)

    // Spirits — freed with E, unlocking maps/finale instead of expressions
    const spirits = SPIRITS.map(s => {
      const g = new THREE.Group()
      const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 0.35, roughness: 0.6 })
      )
      robe.position.y = 0.6
      robe.castShadow = true
      g.add(robe)
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 10),
        new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 0.5, roughness: 0.5 })
      )
      head.position.y = 1.25
      g.add(head)
      const glow = new THREE.PointLight(s.color, 1.1, 7)
      glow.position.y = 1
      g.add(glow)
      g.position.set(s.x, s.y - 1.3, s.z)
      scene.add(g)
      return { ...s, group: g, freed: false, freeStartT: null }
    })

    // Portal gate: closed until the Meadow spirit is freed, then opens the
    // path to the Ruins. A return portal is always active.
    function makePortal(x, z, color) {
      const g = new THREE.Group()
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.22, 10, 28),
        new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5, metalness: 0.3 })
      )
      g.add(ring)
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.45, 28),
        new THREE.MeshStandardMaterial({ color: 0x22222a, emissive: 0x000000, roughness: 1, transparent: true, opacity: 0.9 })
      )
      g.add(disc)
      const light = new THREE.PointLight(color, 0, 6)
      g.add(light)
      g.position.set(x, 1.9, z)
      scene.add(g)
      return { group: g, ring, disc, light, color, active: false, x, y: 1.9, z }
    }
    const gatePortal = makePortal(0, -50, 0xffd9a0)
    const returnPortal = makePortal(0, -124, 0x9fe0d6)
    returnPortal.active = true

    // Collectible orbs
    const orbGroup = new THREE.Group()
    scene.add(orbGroup)
    const orbGeo = new THREE.SphereGeometry(0.22, 12, 10)
    const orbs = ALL_ORBS.map((o, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfff2c0, emissive: 0xffdd88, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0,
      })
      const mesh = new THREE.Mesh(orbGeo, mat)
      mesh.position.set(o.x, o.y, o.z)
      orbGroup.add(mesh)
      return { mesh, x: o.x, y: o.y, z: o.z, collected: false, phase: i * 0.7 }
    })

    // Player physics state
    const player = { x: MEADOW_SPAWN.x, y: MEADOW_SPAWN.y, z: MEADOW_SPAWN.z }
    const velocity = { y: 0 }
    let yaw = MEADOW_SPAWN.yaw
    let pitch = -0.05
    let onGround = true
    let energy = ENERGY_START
    let totalCollected = 0
    let teleportLockUntil = 0

    camera.rotation.order = 'YXZ'
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
    camera.rotation.set(pitch, yaw, 0)

    // Input
    const keys = new Set()
    let audioCtx = null
    function ensureAudio() {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        audioCtx = new Ctx()
      }
      return audioCtx
    }
    function onKeyDown(e) {
      keys.add(e.code)
      if (e.code === 'Space') e.preventDefault()
      if (e.code === 'KeyE') {
        for (const s of spirits) {
          if (s.freed) continue
          const dx = s.x - player.x, dy = s.y - 1.2 - player.y, dz = s.z - player.z
          if (dx * dx + dy * dy + dz * dz < INTERACT_RANGE * INTERACT_RANGE) {
            s.freed = true
            s.freeStartT = performance.now() / 1000
            playSpiritChime(ensureAudio())
            setBanner(s.unlockMessage)
            setSpiritsFreed(n => n + 1)
            if (s.id === 'meadow') gatePortal.active = true
          }
        }
      }
    }
    function onKeyUp(e) { keys.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      yaw -= e.movementX * 0.0022
      pitch -= e.movementY * 0.0022
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch))
    }
    document.addEventListener('mousemove', onMouseMove)

    function onClick() {
      renderer.domElement.requestPointerLock()
      ensureAudio()
    }
    renderer.domElement.addEventListener('click', onClick)

    function onLockChange() {
      setLocked(document.pointerLockElement === renderer.domElement)
    }
    document.addEventListener('pointerlockchange', onLockChange)

    function surfaceHeightAt(x, z, footY) {
      let best = 0
      for (const p of platformMeshes) {
        if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
          if (p.top <= footY + 0.35 && p.top > best) best = p.top
        }
      }
      return best
    }
    function blockedAt(x, z, footY) {
      for (const p of platformMeshes) {
        if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
          if (footY < p.top - 0.35) return true
        }
      }
      return false
    }

    // Game loop
    const clock = new THREE.Clock()
    let raf
    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.1)
      const t = clock.elapsedTime
      const active = document.pointerLockElement === renderer.domElement

      if (active) {
        const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) }
        const right = { x: Math.cos(yaw), z: -Math.sin(yaw) }
        let mx = 0, mz = 0
        if (keys.has('KeyW') || keys.has('ArrowUp'))    { mx += forward.x; mz += forward.z }
        if (keys.has('KeyS') || keys.has('ArrowDown'))  { mx -= forward.x; mz -= forward.z }
        if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += right.x;   mz += right.z }
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  { mx -= right.x;   mz -= right.z }
        const len = Math.hypot(mx, mz)
        if (len > 0) { mx /= len; mz /= len }

        const dx = mx * MOVE_SPEED * dt
        const dz = mz * MOVE_SPEED * dt
        const nx = player.x + dx
        if (!blockedAt(nx, player.z, player.y)) player.x = nx
        const nz = player.z + dz
        if (!blockedAt(player.x, nz, player.y)) player.z = nz

        if (keys.has('Space') && onGround) {
          velocity.y = JUMP_SPEED
          onGround = false
        } else if (keys.has('Space') && !onGround && energy > 0) {
          velocity.y += FLY_ACCEL * dt
          velocity.y = Math.min(velocity.y, MAX_RISE_SPEED)
          energy = Math.max(0, energy - ENERGY_DRAIN * dt)
        }
      }

      velocity.y -= GRAVITY * dt
      velocity.y = Math.max(velocity.y, MAX_FALL_SPEED)
      player.y += velocity.y * dt

      const groundY = surfaceHeightAt(player.x, player.z, player.y)
      if (player.y <= groundY) {
        player.y = groundY
        velocity.y = 0
        onGround = true
      } else {
        onGround = false
      }

      // Safety net: never let the player fall out of the world
      if (player.y < -25) {
        player.x = MEADOW_SPAWN.x; player.y = MEADOW_SPAWN.y; player.z = MEADOW_SPAWN.z
        yaw = MEADOW_SPAWN.yaw
        velocity.y = 0
      }

      playerGroup.position.set(player.x, player.y, player.z)
      playerGlow.intensity = 0.5 + (energy / ENERGY_MAX) * 0.9

      camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
      camera.rotation.set(pitch, yaw, 0)

      // Zone-tinted fog: shifts from meadow warmth to ruin dusk as you go north
      const zt = Math.min(1, Math.max(0, (-player.z - 60) / 100))
      scene.fog.color.copy(fogMeadow).lerp(fogRuins, zt)

      // Spirits: idle bob, free-animation, interact prompt
      let nearestName = null
      for (const s of spirits) {
        if (!s.freed) {
          s.group.position.y = (s.y - 1.3) + Math.sin(t * 1.2) * 0.08
          s.group.rotation.y = Math.sin(t * 0.4) * 0.3
          const dx = s.x - player.x, dy = s.y - 1.2 - player.y, dz = s.z - player.z
          if (dx * dx + dy * dy + dz * dz < INTERACT_RANGE * INTERACT_RANGE) nearestName = s.name
        } else {
          const dt2 = t - s.freeStartT
          if (dt2 < 1.4) {
            const k = Math.max(0, 1 - dt2 / 1.4)
            s.group.scale.setScalar(k)
            s.group.position.y = (s.y - 1.3) + dt2 * 1.5
          } else if (s.group.visible) {
            s.group.visible = false
          }
        }
      }
      setNearSpirit(prev => (prev === nearestName ? prev : nearestName))

      // Portals: activate visuals + handle teleport trigger
      for (const portal of [gatePortal, returnPortal]) {
        const targetOpacity = portal.active ? 0.55 : 0.9
        portal.disc.material.opacity += (targetOpacity - portal.disc.material.opacity) * 0.1
        portal.disc.material.emissive.setHex(portal.active ? portal.color : 0x000000)
        portal.disc.material.emissiveIntensity = portal.active ? 0.9 : 0
        portal.light.intensity += ((portal.active ? 1.4 : 0) - portal.light.intensity) * 0.1
        if (portal.active) portal.disc.rotation.z += dt * 0.6
      }
      if (t > teleportLockUntil) {
        if (gatePortal.active) {
          const dx = gatePortal.x - player.x, dy = gatePortal.y - player.y, dz = gatePortal.z - player.z
          if (dx * dx + dy * dy + dz * dz < PORTAL_RANGE * PORTAL_RANGE) {
            player.x = RUINS_SPAWN.x; player.y = RUINS_SPAWN.y; player.z = RUINS_SPAWN.z
            yaw = RUINS_SPAWN.yaw
            velocity.y = 0
            teleportLockUntil = t + TELEPORT_LOCK
          }
        }
        if (returnPortal.active) {
          const dx = returnPortal.x - player.x, dy = returnPortal.y - player.y, dz = returnPortal.z - player.z
          if (dx * dx + dy * dy + dz * dz < PORTAL_RANGE * PORTAL_RANGE) {
            player.x = MEADOW_SPAWN.x; player.y = MEADOW_SPAWN.y; player.z = MEADOW_SPAWN.z
            yaw = MEADOW_SPAWN.yaw
            velocity.y = 0
            teleportLockUntil = t + TELEPORT_LOCK
          }
        }
      }

      // Animate orbs + collection
      for (const orb of orbs) {
        if (orb.collected) continue
        orb.mesh.position.y = orb.y + Math.sin(t * 1.6 + orb.phase) * 0.15
        orb.mesh.rotation.y = t * 1.2
        const dx = orb.x - player.x
        const dy = orb.mesh.position.y - (player.y + 1)
        const dz = orb.z - player.z
        if (dx * dx + dy * dy + dz * dz < 1.4 * 1.4) {
          orb.collected = true
          orbGroup.remove(orb.mesh)
          totalCollected += 1
          energy = Math.min(ENERGY_MAX, energy + ENERGY_PER_ORB)
          setCollected(totalCollected)
          if (audioCtx) playChime(audioCtx)
          if (totalCollected >= ALL_ORBS.length) setBanner('You gathered all the Light ✨')
        }
      }

      // Firefly drift
      const fPos = fireflyGeo.attributes.position
      for (let i = 0; i < fireflyCount; i++) {
        let y = fPos.getY(i) + fireflySpeed[i] * dt
        if (y > 15) y = 0
        fPos.setY(i, y)
        fPos.setX(i, fPos.getX(i) + Math.sin(t * 0.5 + i) * 0.004)
      }
      fPos.needsUpdate = true

      setEnergyPct(energy / ENERGY_MAX)

      composer.render()
    }
    tick()

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      composer.setSize(mount.clientWidth, mount.clientHeight)
      bloomPass.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      renderer.domElement.removeEventListener('click', onClick)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      if (audioCtx) audioCtx.close()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    if (!banner) return
    const id = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(id)
  }, [banner])

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.canvasWrap} />
      <div className={styles.hud}>
        <div className={styles.counter}>✨ {collected} / {ALL_ORBS.length} light · 👤 {spiritsFreed} / {SPIRITS.length} spirits</div>
        <div className={styles.energyBar}>
          <div className={styles.energyFill} style={{ width: `${Math.round(energyPct * 100)}%` }} />
        </div>
      </div>
      {banner && <div className={styles.winBanner}>{banner}</div>}
      {nearSpirit && locked && (
        <div className={styles.interactPrompt}>Press E to free the {nearSpirit}</div>
      )}
      {locked && <div className={styles.crosshair} />}
      {!locked && (
        <div className={styles.overlay}>
          <h1 className={styles.title}>Skylight</h1>
          <p className={styles.hint}>Click to begin</p>
          <p className={styles.controls}>
            WASD to walk · Mouse to look around · Space to jump, then hold Space to fly on gathered light · E to free a spirit · Esc to release
          </p>
        </div>
      )}
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
