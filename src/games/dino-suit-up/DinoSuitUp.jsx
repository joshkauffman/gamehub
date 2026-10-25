import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './DinoSuitUp.module.css'
import {
  WORLD_HALF, SUIT_TIERS, BOSSES, RESOURCE_KINDS, MATERIAL_EMOJI,
  AUTOSAVE_INTERVAL,
} from './constants.js'
import {
  createGame, stepGame, canCraft, craftSuit,
  saveGame, loadGame, applySavedState, clearSave,
} from './gameEngine.js'

// ── Dino Suit Up ─────────────────────────────────────────────────────────
// You're a dinosaur in an open world: chop wood, mine stone, and track
// down rarer materials to craft a sequence of suits, each gated behind
// defeating the boss that guards its "core" — up to the final Cyborg
// Suit. Movement is tank-style turn+thrust with a fixed chase camera
// (no mouse-look / pointer lock at all, unlike this hub's first-person
// 3D games — nothing here needs it). Procedural low-poly geometry only,
// same house style as Avatar / Wings of Fire.

const toonGradient = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 4; canvas.height = 1
  const ctx = canvas.getContext('2d')
  ;['#4d4d4d', '#8a8a8a', '#c2c2c2', '#ffffff'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1) })
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
})()

function toonMat(color) { return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient }) }

function addOutline(parent, mesh, scale = 1.07) {
  const outline = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x0a1008, side: THREE.BackSide }))
  outline.position.copy(mesh.position)
  outline.rotation.copy(mesh.rotation)
  outline.scale.copy(mesh.scale).multiplyScalar(scale)
  parent.add(outline)
}

// ── Dino character model ─────────────────────────────────────────────────
// Quadruped, body-forward along -z (matches facingVec(yaw=0) = (0,-1), the
// same convention Avatar's humanoid uses so mesh.rotation.y = yaw works
// directly with no extra offset).
function buildDinoBody() {
  const g = new THREE.Group()
  const skinMat = toonMat(0x4f9a4a)
  const bellyMat = toonMat(0x9fd89a)
  const hornMat = toonMat(0xe8d9a0)

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.5, 4, 10), skinMat)
  body.rotation.z = Math.PI / 2
  body.position.set(0, 1.1, 0.1)
  g.add(body)
  addOutline(g, body)

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.3, 4, 8), bellyMat)
  belly.rotation.z = Math.PI / 2
  belly.position.set(0, 0.85, 0.1)
  g.add(belly)

  // Neck + head, extending toward -z (forward).
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.7, 8), skinMat)
  neck.rotation.x = -0.55
  neck.position.set(0, 1.55, -1.0)
  g.add(neck)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.9), skinMat)
  head.position.set(0, 1.95, -1.65)
  g.add(head)
  addOutline(g, head)

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), skinMat)
  snout.rotation.x = Math.PI / 2
  snout.position.set(0, 1.85, -2.15)
  g.add(snout)

  ;[-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }))
    eye.position.set(side * 0.26, 2.08, -1.95)
    g.add(eye)
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), hornMat)
    horn.position.set(side * 0.22, 2.3, -1.5)
    horn.rotation.x = 0.4
    g.add(horn)
  })

  // Tail: 3 tapering segments curving back and slightly up.
  const tailSegs = [
    { r: 0.38, len: 0.9, y: 1.15, z: 1.4 },
    { r: 0.26, len: 0.8, y: 1.3, z: 2.15 },
    { r: 0.14, len: 0.7, y: 1.45, z: 2.85 },
  ]
  tailSegs.forEach(s => {
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(s.r, s.len, 4, 8), skinMat)
    seg.rotation.x = Math.PI / 2 - 0.3
    seg.position.set(0, s.y, s.z)
    g.add(seg)
  })

  // Legs: 4 short stout cylinders.
  const legGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.95, 8)
  ;[[-0.5, -0.7], [0.5, -0.7], [-0.5, 0.75], [0.5, 0.75]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, bellyMat)
    leg.position.set(x, 0.48, z)
    g.add(leg)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.42), hornMat)
    foot.position.set(x, 0.07, z - 0.05)
    g.add(foot)
  })

  g.userData.bodyMeshes = [body, head]
  return g
}

// Each suit tier attaches a distinct overlay group so the dino visibly
// changes as the player progresses — tinted body color plus a couple of
// recognizable armor pieces per tier, not full custom geometry (keeps
// scope reasonable while still reading clearly at a glance).
const TIER_BODY_TINT = [0x4f9a4a, 0x8a6a3a, 0x8a8a92, 0xe0d8bc, 0x9aa0a8, 0x6fe0e8, 0x3a3a44]
function buildSuitOverlay(tierIdx) {
  const g = new THREE.Group()
  if (tierIdx <= 0) return g
  if (tierIdx === 1) { // Bark — strapped wooden plates along the back
    const mat = toonMat(0x6b4a2a)
    for (let i = -1; i <= 1; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), mat)
      plate.position.set(0, 1.75, i * 0.55)
      g.add(plate)
    }
  } else if (tierIdx === 2) { // Stone — bulky grey slabs
    const mat = toonMat(0x6a6a72)
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.6), mat)
    chest.position.set(0, 1.25, -0.6)
    g.add(chest)
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), mat)
    back.position.set(0, 1.7, 0.3)
    g.add(back)
  } else if (tierIdx === 3) { // Bone — pale rib spikes along the spine
    const mat = toonMat(0xe8e0c8)
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), mat)
      spike.position.set(0, 1.85, i * 0.45)
      g.add(spike)
    }
  } else if (tierIdx === 4) { // Iron — full metallic plating + chest emblem
    const mat = toonMat(0x9aa0a8)
    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 1.6), mat)
    plateBack.position.set(0, 1.65, 0.3)
    g.add(plateBack)
    const plateChest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.5), mat)
    plateChest.position.set(0, 1.2, -0.8)
    g.add(plateChest)
    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: 0xc47a3a }))
    emblem.position.set(0, 1.2, -1.05)
    g.add(emblem)
  } else if (tierIdx === 5) { // Crystal — glowing cyan shards
    const mat = new THREE.MeshStandardMaterial({ color: 0x5fe0e8, emissive: 0x2a8a92, emissiveIntensity: 0.8, roughness: 0.2 })
    for (let i = -2; i <= 2; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 - Math.abs(i) * 0.02, 0), mat)
      shard.position.set(0, 1.9 + Math.abs(i) * 0.03, i * 0.45)
      g.add(shard)
    }
    const glow = new THREE.PointLight(0x5fe0e8, 0.8, 6, 2)
    glow.position.set(0, 1.9, 0)
    g.add(glow)
  } else if (tierIdx === 6) { // Cyborg — dark tech plating, red visor, antenna
    const mat = toonMat(0x2a2a33)
    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.8), mat)
    plateBack.position.set(0, 1.68, 0.3)
    g.add(plateBack)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff3a3a, emissiveIntensity: 1.2 }))
    visor.position.set(0, 2.05, -1.95)
    g.add(visor)
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), mat)
    antenna.position.set(0, 2.55, -1.4)
    g.add(antenna)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a }))
    tip.position.set(0, 2.76, -1.4)
    g.add(tip)
  }
  return g
}

function makeDinoModel(tierIdx) {
  const g = new THREE.Group()
  const body = buildDinoBody()
  g.add(body)
  const overlay = buildSuitOverlay(tierIdx)
  g.add(overlay)
  g.userData.bodyMeshes = body.userData.bodyMeshes
  g.userData.tierIdx = tierIdx
  g.userData.overlay = overlay
  g.userData.bodyGroup = body
  return g
}

// ── Boss models — five distinct silhouettes ─────────────────────────────
function makeBossModel(defIdx) {
  const def = BOSSES[defIdx]
  const g = new THREE.Group()
  const mainMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.75 })
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.6 })

  if (def.shape === 'quad') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 2.6), mainMat)
    body.position.y = 1.0
    g.add(body)
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 5), accentMat)
      spike.position.set(0, 1.7, i * 0.5)
      g.add(spike)
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 6), mainMat)
    head.rotation.x = Math.PI / 2
    head.position.set(0, 1.0, -1.7)
    g.add(head)
    ;[[-0.6, -0.9], [0.6, -0.9], [-0.6, 0.9], [0.6, 0.9]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.0, 8), accentMat)
      leg.position.set(x, 0.5, z)
      g.add(leg)
    })
  } else if (def.shape === 'biped') {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.6, 4, 8), mainMat)
    torso.position.y = 1.9
    g.add(torso)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), accentMat)
    skull.position.y = 3.0
    g.add(skull)
    ;[-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a }))
      eye.position.set(side * 0.18, 3.05, -0.38)
      g.add(eye)
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.1, 4, 6), accentMat)
      arm.position.set(side * 0.7, 1.9, 0)
      arm.rotation.z = side * 0.3
      g.add(arm)
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.4, 4, 6), accentMat)
      leg.position.set(side * 0.3, 0.7, 0)
      g.add(leg)
    })
  } else if (def.shape === 'golem') {
    const legs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.0), mainMat)
    legs.position.y = 0.9
    g.add(legs)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.8, 1.2), mainMat)
    torso.position.y = 2.5
    g.add(torso)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), accentMat)
    head.position.y = 3.8
    g.add(head)
    ;[-1, 1].forEach(side => {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), accentMat)
      shoulder.position.set(side * 1.3, 3.0, 0)
      g.add(shoulder)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), mainMat)
      arm.position.set(side * 1.3, 1.9, 0)
      g.add(arm)
    })
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.1), new THREE.MeshBasicMaterial({ color: 0xff8a3a }))
    eye.position.set(0, 3.85, -0.4)
    g.add(eye)
  } else if (def.shape === 'wraith') {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: def.color, emissive: def.accent, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 }))
    core.position.y = 2.4
    g.add(core)
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }))
      shard.position.set(Math.cos(ang) * 1.3, 2.4 + Math.sin(i * 1.7) * 0.4, Math.sin(ang) * 1.3)
      g.add(shard)
    }
    const glow = new THREE.PointLight(def.color, 1.1, 12, 2)
    glow.position.y = 2.4
    g.add(glow)
    g.userData.floaty = true
  } else if (def.shape === 'overseer') {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), mainMat)
    orb.position.y = 3.0
    g.add(orb)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 8, 24), accentMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 3.0
    g.add(ring)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff3a3a, emissiveIntensity: 1.3 }))
    eye.position.set(0, 3.0, -1.2)
    g.add(eye)
    for (let i = -1; i <= 1; i += 2) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), accentMat)
      arm.rotation.z = Math.PI / 2
      arm.position.set(i * 1.5, 3.0, 0.3)
      g.add(arm)
    }
    const light = new THREE.PointLight(0xff3a3a, 1.0, 14, 2)
    light.position.set(0, 3.0, -1.2)
    g.add(light)
    g.userData.floaty = true
  }

  g.userData.mainMat = mainMat
  return g
}

// ── Resource node models ──────────────────────────────────────────────────
function makeResourceMesh(kind) {
  const def = RESOURCE_KINDS.find(r => r.kind === kind)
  const g = new THREE.Group()
  const mainMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 })
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.7 })
  if (kind === 'wood') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8), accentMat)
    trunk.position.y = 0.8
    g.add(trunk)
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), mainMat)
    leaves.position.y = 2.3
    g.add(leaves)
  } else if (kind === 'stone') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), mainMat)
    rock.position.y = 0.55
    rock.rotation.set(0.3, 0.5, 0.1)
    g.add(rock)
  } else if (kind === 'bone') {
    for (let i = 0; i < 4; i++) {
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 6), mainMat)
      bone.position.set((Math.random() - 0.5) * 0.5, 0.15 + i * 0.1, (Math.random() - 0.5) * 0.5)
      bone.rotation.set(Math.random(), Math.random(), Math.random())
      g.add(bone)
    }
  } else if (kind === 'iron') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), mainMat)
    rock.position.y = 0.5
    g.add(rock)
    for (let i = 0; i < 5; i++) {
      const speck = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 0.5 }))
      const ang = Math.random() * Math.PI * 2
      speck.position.set(Math.cos(ang) * 0.6, 0.3 + Math.random() * 0.5, Math.sin(ang) * 0.6)
      g.add(speck)
    }
  } else if (kind === 'crystal') {
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 - i * 0.03, 0),
        new THREE.MeshStandardMaterial({ color: def.color, emissive: def.accent, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }))
      const ang = (i / 4) * Math.PI * 2
      shard.position.set(Math.cos(ang) * 0.25, 0.4 + i * 0.15, Math.sin(ang) * 0.25)
      g.add(shard)
    }
    const glow = new THREE.PointLight(def.color, 0.6, 5, 2)
    glow.position.y = 0.6
    g.add(glow)
  } else if (kind === 'tech') {
    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), mainMat)
      box.position.set((Math.random() - 0.5) * 0.4, 0.15 + i * 0.28, (Math.random() - 0.5) * 0.4)
      box.rotation.y = Math.random()
      g.add(box)
    }
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 1 }))
    light.position.y = 0.95
    g.add(light)
  }
  return g
}

function makeEffectMesh() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.visible = false
  return mesh
}

function buildWorldScene() {
  const scene = new THREE.Scene()
  const skyColor = 0x2a4a2a
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.Fog(skyColor, 60, 200)

  scene.add(new THREE.HemisphereLight(0xdfffd0, 0x1a2a14, 1.15))
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.05)
  sun.position.set(40, 60, 20)
  scene.add(sun)

  // Ground sized well past the camera's trail distance at the world edge,
  // not just past the movement bound — see this repo's 3D-game ground/
  // camera sizing bug note.
  const groundR = WORLD_HALF + 70
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(groundR, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a6b35, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const spawnRing = new THREE.Mesh(new THREE.RingGeometry(0, 6, 24), new THREE.MeshBasicMaterial({ color: 0xcbb98a, transparent: true, opacity: 0.3 }))
  spawnRing.rotation.x = -Math.PI / 2
  spawnRing.position.y = 0.01
  scene.add(spawnRing)

  return { scene }
}

const KEYS = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'Space' }
const ALL_GAME_KEY_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC']

function readInput(keys) {
  const turn = (keys.has(KEYS.left) ? 1 : 0) - (keys.has(KEYS.right) ? 1 : 0)
  const thrust = (keys.has(KEYS.fwd) ? 1 : 0) - (keys.has(KEYS.back) ? 1 : 0)
  return { turn, thrust, attack: keys.has(KEYS.attack) }
}

function GameCanvas({ onHud, apiRef }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const craftToggleRef = useRef(false) // flips to true on 'C'; cleared once consumed by tick
  const craftTierRequestRef = useRef(null) // set to a tier idx to craft; cleared once consumed

  useEffect(() => {
    const mount = mountRef.current
    let raf = null

    const state = createGame()
    const saved = loadGame()
    if (saved) applySavedState(state, saved)

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 500)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    function onKeyDown(e) {
      if (ALL_GAME_KEY_CODES.includes(e.code)) e.preventDefault()
      if (e.code === 'KeyC') { craftToggleRef.current = true; return }
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Expose imperative actions the React-side craft panel needs to reach
    // into this closure's `state` — the engine instance never leaves this
    // effect, so the parent can't call craftSuit() directly.
    if (apiRef) {
      apiRef.current = {
        toggleCraft: () => { craftToggleRef.current = true },
        requestCraft: (tierIdx) => { craftTierRequestRef.current = tierIdx },
      }
    }

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const { scene } = buildWorldScene()

    let dinoMesh = makeDinoModel(state.player.suitTier)
    scene.add(dinoMesh)

    const resourceMeshes = {}
    state.world.resources.forEach(node => {
      const mesh = makeResourceMesh(node.kind)
      mesh.position.set(node.x, 0, node.z)
      mesh.visible = node.alive
      scene.add(mesh)
      resourceMeshes[node.id] = mesh
    })

    const bossMeshes = {}
    state.world.bosses.forEach(boss => {
      const mesh = makeBossModel(boss.defIdx)
      mesh.position.set(boss.x, 0, boss.z)
      mesh.visible = boss.alive
      scene.add(mesh)
      bossMeshes[boss.id] = mesh
    })

    const EFFECT_POOL_SIZE = 16
    const effectPool = Array.from({ length: EFFECT_POOL_SIZE }, () => {
      const mesh = makeEffectMesh()
      scene.add(mesh)
      return mesh
    })

    const clock = new THREE.Clock()
    let autosaveAccum = 0
    let craftOpen = false
    let lastSuitTier = state.player.suitTier

    function doSave() { saveGame(state) }
    function onVisibility() { if (document.visibilityState === 'hidden') doSave() }
    document.addEventListener('visibilitychange', onVisibility)

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const k = keysRef.current

      if (craftToggleRef.current) {
        craftToggleRef.current = false
        craftOpen = !craftOpen
      }
      if (craftTierRequestRef.current != null) {
        craftSuit(state, craftTierRequestRef.current)
        craftTierRequestRef.current = null
      }

      if (!craftOpen) {
        const input = readInput(k)
        stepGame(state, input, dt)
      }

      autosaveAccum += dt
      if (autosaveAccum > AUTOSAVE_INTERVAL) { autosaveAccum = 0; doSave() }

      if (state.player.suitTier !== lastSuitTier) {
        scene.remove(dinoMesh)
        dinoMesh = makeDinoModel(state.player.suitTier)
        scene.add(dinoMesh)
        lastSuitTier = state.player.suitTier
      }

      const bob = Math.sin(t * 5) * 0.04
      dinoMesh.position.set(state.player.x, bob, state.player.z)
      dinoMesh.rotation.y = state.player.yaw
      const flash = state.player.hitFlash > 0
      dinoMesh.userData.bodyMeshes.forEach(m => m.material.color.setHex(flash ? 0xffffff : 0x4f9a4a))

      state.world.resources.forEach(node => {
        const mesh = resourceMeshes[node.id]
        mesh.visible = node.alive
      })

      state.world.bosses.forEach(boss => {
        const mesh = bossMeshes[boss.id]
        mesh.visible = boss.alive
        if (!boss.alive) return
        const floatY = mesh.userData.floaty ? Math.sin(t * 2 + boss.x) * 0.3 + 0.5 : 0
        mesh.position.set(boss.x, floatY, boss.z)
        mesh.rotation.y = boss.yaw
        const hitFlash = boss.hitFlash > 0
        if (mesh.userData.mainMat) mesh.userData.mainMat.color.setHex(hitFlash ? 0xffffff : BOSSES[boss.defIdx].color)
      })

      state.effects.forEach((e, i) => {
        if (i >= effectPool.length) return
        const mesh = effectPool[i]
        mesh.visible = true
        const progress = 1 - e.life / e.maxLife
        mesh.position.set(e.x, 0.15, e.z)
        const scale = e.radius * (0.3 + progress * 1.4)
        mesh.scale.set(scale, scale, scale)
        mesh.material.color.setHex(e.color)
        mesh.material.opacity = Math.max(0, (1 - progress) * 0.8)
      })
      for (let i = state.effects.length; i < effectPool.length; i++) effectPool[i].visible = false

      // Fixed chase camera behind the dino's facing direction.
      const fx = -Math.sin(state.player.yaw), fz = -Math.cos(state.player.yaw)
      const camDist = 9.5, camHeight = 4.5
      camera.position.set(state.player.x - fx * camDist, camHeight, state.player.z - fz * camDist)
      camera.lookAt(state.player.x, 1.3, state.player.z)

      renderer.render(scene, camera)

      onHudRef.current({
        player: snapshotPlayer(state.player),
        bossesDefeated: state.bossesDefeated,
        toast: state.toast,
        won: state.won,
        craftOpen,
      })
    }
    raf = requestAnimationFrame(tick)

    return () => {
      doSave()
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.dispose()
      renderer.forceContextLoss()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }

    function snapshotPlayer(p) {
      return {
        hp: p.hp, maxHp: p.maxHp, suitTier: p.suitTier, atk: p.atk, def: p.def,
        materials: { ...p.materials }, cores: { ...p.cores },
      }
    }
  }, [])

  return <div ref={mountRef} className={styles.canvasWrap} />
}

function HpBar({ hp, maxHp }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  return (
    <div className={styles.hpWrap}>
      <span className={styles.hpLabel}>❤️ {Math.ceil(hp)}/{maxHp}</span>
      <div className={styles.hpTrack}><div className={styles.hpFill} style={{ width: `${pct}%`, background: pct < 30 ? '#ff5d3d' : '#7bff8a' }} /></div>
    </div>
  )
}

function Hud({ hud, onToggleCraft }) {
  if (!hud?.player) return null
  const tier = SUIT_TIERS[hud.player.suitTier]
  return (
    <div className={styles.hud}>
      <div className={styles.hudTop}>
        <span className={styles.suitInfo}>{tier.emoji} {tier.name}</span>
        <span className={styles.bossInfo}>💀 Bosses {hud.bossesDefeated}/{BOSSES.length}</span>
      </div>
      <HpBar hp={hud.player.hp} maxHp={hud.player.maxHp} />
      <div className={styles.matsRow}>
        {Object.entries(hud.player.materials).filter(([, v]) => v > 0).map(([k, v]) => (
          <span key={k} className={styles.matChip}>{MATERIAL_EMOJI[k]} {v}</span>
        ))}
      </div>
      <button className={styles.craftHint} onClick={onToggleCraft}>🛠 Craft (C)</button>
      {hud.toast && <div className={`${styles.toast} ${hud.toast.kind === 'bad' ? styles.toastBad : hud.toast.kind === 'good' ? styles.toastGood : ''}`}>{hud.toast.text}</div>}
    </div>
  )
}

function CraftPanel({ player, onCraft, onClose }) {
  return (
    <div className={styles.craftOverlay} onClick={onClose}>
      <div className={styles.craftPanel} onClick={e => e.stopPropagation()}>
        <h2 className={styles.craftTitle}>🛠 Suit Progression</h2>
        <div className={styles.craftList}>
          {SUIT_TIERS.map((tier, idx) => {
            const isCurrent = idx === player.suitTier
            const isNext = idx === player.suitTier + 1
            const isDone = idx <= player.suitTier
            const needsBoss = tier.requiresCore && !player.cores[tier.requiresCore]
            const bossDef = tier.requiresCore ? BOSSES.find(b => b.coreId === tier.requiresCore) : null
            const ok = isNext && canCraft(player, idx)
            return (
              <div key={tier.id} className={`${styles.craftRow} ${isCurrent ? styles.craftRowCurrent : ''} ${isDone && !isCurrent ? styles.craftRowDone : ''}`}>
                <span className={styles.craftEmoji}>{tier.emoji}</span>
                <div className={styles.craftRowBody}>
                  <span className={styles.craftName}>{tier.name}{isCurrent ? ' (equipped)' : ''}</span>
                  {idx > 0 && (
                    <span className={styles.craftReq}>
                      {Object.entries(tier.cost).map(([k, v]) => (
                        <span key={k} className={(player.materials[k] || 0) >= v ? styles.reqMet : styles.reqUnmet}>
                          {MATERIAL_EMOJI[k]} {player.materials[k] || 0}/{v}
                        </span>
                      ))}
                      {bossDef && (
                        <span className={needsBoss ? styles.reqUnmet : styles.reqMet}>
                          {needsBoss ? `🔒 Defeat ${bossDef.name}` : `🔓 ${bossDef.name} defeated`}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isNext && (
                  <button className={styles.craftBtn} disabled={!ok} onClick={() => onCraft(idx)}>Craft</button>
                )}
              </div>
            )
          })}
        </div>
        <button className={styles.craftClose} onClick={onClose}>Close (C)</button>
      </div>
    </div>
  )
}

export default function DinoSuitUp() {
  const [screen, setScreen] = useState('intro') // intro | playing
  const [hud, setHud] = useState(null)
  const [craftOpen, setCraftOpen] = useState(false)
  const craftApiRef = useRef(null)
  const hasSave = useRef(!!loadGame())

  function handleHud(h) {
    setHud(h)
    setCraftOpen(h.craftOpen)
  }

  function toggleCraft() {
    craftApiRef.current?.toggleCraft()
  }

  function requestCraft(tierIdx) {
    craftApiRef.current?.requestCraft(tierIdx)
  }

  function startGame() { setScreen('playing') }
  function startFresh() { clearSave(); setScreen('playing') }

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🦖 Dino Suit Up<span className={styles.subtitle}>Gather. Craft. Evolve.</span></h1>
          <p className={styles.blurb}>
            You're a dinosaur in an open prehistoric world. Chop wood and mine stone nearby,
            then venture farther out for bone, iron, crystal, and tech scrap. Craft a suit from
            each material, strongest tier last — but each new suit needs its boss defeated first:
            The Thorn Beast, The Bone Reaper, The Iron Golem, The Crystal Wraith, and finally
            The Overseer, who guards the parts for the ultimate Cyborg Suit.
          </p>
          <p className={styles.blurb}>
            WASD to move and turn, Space to bite/claw (harvests resources or hits bosses in front
            of you), C to open the crafting menu.
          </p>
          <button className={styles.bigBtn} onClick={startGame}>{hasSave.current ? '▶ Continue' : '▶ Start Exploring'}</button>
          {hasSave.current && <button className={styles.secondaryBtn} onClick={startFresh}>↻ New Game</button>}
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <GameCanvas onHud={handleHud} apiRef={craftApiRef} />
          <Hud hud={hud} onToggleCraft={toggleCraft} />
          {craftOpen && hud?.player && (
            <CraftPanel
              player={hud.player}
              onCraft={requestCraft}
              onClose={toggleCraft}
            />
          )}
          {hud?.won && <div className={styles.winBanner}>🏆 Cyborg Suit complete — you've beaten Dino Suit Up!</div>}
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}
    </div>
  )
}
