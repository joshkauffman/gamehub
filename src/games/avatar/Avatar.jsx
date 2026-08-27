import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './Avatar.module.css'
import { BENDERS, getBender, WAVES, WORLD_HALF } from './constants.js'
import { createSoloState, createDuelState, stepGame } from './gameEngine.js'

// ── Avatar: Elemental Grounds ────────────────────────────────────────────
// An original bending-combat game inspired by Avatar: The Last Airbender —
// pick a bending style, roam an open-world proving grounds to find your
// opponent, then fight with a claw-equivalent strike plus one signature
// bending attack. Every bender is procedural low-poly geometry (same
// toon-shaded, outlined-primitive technique as this hub's other 3D
// games), no external art. Explore and battle share one continuous world
// and scene instead of separate arenas — engaging just holds both
// combatants near the spot they met (see gameEngine.js's battleCenter).

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

function addOutline(parent, mesh, scale = 1.08) {
  const outline = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x0a1018, side: THREE.BackSide }))
  outline.position.copy(mesh.position)
  outline.rotation.copy(mesh.rotation)
  outline.scale.copy(mesh.scale).multiplyScalar(scale)
  parent.add(outline)
}

// Per-element headgear, built the same nested-pivot way as Wings of Fire's
// horns: a nod to each bending style's silhouette without any real art —
// Airbender's swept fin (arrow-tattoo stand-in), Waterbender's looped
// braid, Earthbender's wide flat hat, Fire/Lava's flame topknot,
// Metalbender's angular visor, Sandbender's wrapped headscarf,
// Lightningbender's glowing antenna spike, Icebender's jagged shard
// cluster, Crystalbender's gem crown, Combustionbender's glowing
// third-eye gem, Stormbender's cloud-and-bolt. Authored at a shared
// "old" head-radius scale (~0.36) and uniformly scaled down in
// makeBenderModel to fit the smaller head used there.
function makeHeadgear(elementKey, accentMat, glowColor) {
  const g = new THREE.Group()
  switch (elementKey) {
    case 'air': {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 4), accentMat)
      fin.scale.set(2.2, 1, 0.4)
      fin.rotation.x = -0.3
      fin.position.set(0, 0.32, -0.05)
      g.add(fin)
      break
    }
    case 'water': {
      ;[-1, 1].forEach(side => {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 10, Math.PI * 1.4), accentMat)
        loop.position.set(side * 0.32, 0.24, 0.05)
        loop.rotation.set(0.4, side * 0.6, side * 1.1)
        g.add(loop)
      })
      break
    }
    case 'earth': {
      const brim = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.22, 10), accentMat)
      brim.position.set(0, 0.34, 0)
      g.add(brim)
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 8), accentMat)
      top.position.set(0, 0.5, 0)
      g.add(top)
      break
    }
    case 'fire':
    case 'lava': {
      for (let i = -1; i <= 1; i++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34 - Math.abs(i) * 0.08, 6), accentMat)
        flame.position.set(i * 0.11, 0.42, 0)
        flame.rotation.z = i * 0.25
        g.add(flame)
      }
      break
    }
    case 'metal': {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.08), accentMat)
      visor.position.set(0, 0.28, -0.32)
      g.add(visor)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), accentMat)
      plate.position.set(0, 0.42, 0)
      g.add(plate)
      break
    }
    case 'sand': {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 6, 12), accentMat)
      wrap.rotation.x = Math.PI / 2
      wrap.position.set(0, 0.26, 0)
      g.add(wrap)
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.08), accentMat)
      tail.position.set(0.3, 0.1, 0.2)
      tail.rotation.z = -0.6
      g.add(tail)
      break
    }
    case 'lightning': {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), accentMat)
      spike.position.set(0, 0.5, 0)
      g.add(spike)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: glowColor }))
      tip.position.set(0, 0.72, 0)
      g.add(tip)
      break
    }
    case 'ice': {
      for (let i = -1; i <= 1; i++) {
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3 - Math.abs(i) * 0.06, 4), accentMat)
        shard.position.set(i * 0.13, 0.4, 0)
        shard.rotation.set(0.1 * i, 0, i * 0.3)
        g.add(shard)
      }
      break
    }
    case 'crystal': {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), accentMat)
      gem.position.set(0, 0.42, -0.1)
      g.add(gem)
      ;[-1, 1].forEach(side => {
        const small = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), accentMat)
        small.position.set(side * 0.26, 0.3, 0.05)
        g.add(small)
      })
      break
    }
    case 'combustion': {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: glowColor }))
      gem.position.set(0, 0.2, -0.34)
      g.add(gem)
      break
    }
    case 'storm': {
      const cloudMat = new THREE.MeshToonMaterial({ color: 0xd8dee8, gradientMap: toonGradient })
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), cloudMat)
      cloud.scale.set(1.3, 0.6, 1)
      cloud.position.set(0, 0.48, 0)
      g.add(cloud)
      ;[[-0.03, 0.32, 0.3], [0.03, 0.2, -0.3]].forEach(([x, y, rotZ]) => {
        const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: glowColor }))
        bolt.position.set(x, y, 0)
        bolt.rotation.z = rotZ
        g.add(bolt)
      })
      break
    }
  }
  return g
}

// Human-proportioned rather than the old snowman-stack (sphere head glued
// straight onto a barrel torso, no neck, no waist, stub limbs): a defined
// neck, shoulder-to-waist taper, a smaller head (~4 heads tall overall,
// stylized-game proportions rather than chibi), a simple nose alongside
// the eyes, and hands/feet so limbs read as arms/legs instead of rods.
// Built bottom-up in world-space Y so every piece's position is derived
// from the piece below it rather than guessed independently.
const FOOT_Y = 0
const LEG_RADIUS = 0.11, LEG_LEN = 0.62, LEG_H = LEG_LEN + LEG_RADIUS * 2
const HIP_Y = FOOT_Y + LEG_H
const TORSO_BOTTOM_R = 0.27, TORSO_TOP_R = 0.38, TORSO_H = 0.74
const TORSO_CENTER_Y = HIP_Y + TORSO_H / 2
const NECK_R = 0.12, NECK_H = 0.16
const NECK_CENTER_Y = HIP_Y + TORSO_H + NECK_H / 2
const HEAD_R = 0.28
const HEAD_CENTER_Y = HIP_Y + TORSO_H + NECK_H + HEAD_R

function makeBenderModel(elementKey) {
  const bender = getBender(elementKey)
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshToonMaterial({ color: bender.color, gradientMap: toonGradient })
  const accentMat = new THREE.MeshToonMaterial({ color: bender.accent, gradientMap: toonGradient })
  const pantsColor = new THREE.Color(bender.color).multiplyScalar(0.55)
  const pantsMat = new THREE.MeshToonMaterial({ color: pantsColor, gradientMap: toonGradient })

  const legGeo = new THREE.CapsuleGeometry(LEG_RADIUS, LEG_LEN, 4, 8)
  const footGeo = new THREE.BoxGeometry(0.17, 0.09, 0.28)
  ;[-1, 1].forEach(side => {
    const leg = new THREE.Mesh(legGeo, pantsMat)
    leg.position.set(side * 0.15, HIP_Y - LEG_H / 2, 0)
    g.add(leg)
    const foot = new THREE.Mesh(footGeo, accentMat)
    foot.position.set(side * 0.15, FOOT_Y + 0.045, -0.05)
    g.add(foot)
  })

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(TORSO_TOP_R, TORSO_BOTTOM_R, TORSO_H, 10), bodyMat)
  torso.position.set(0, TORSO_CENTER_Y, 0)
  g.add(torso)
  addOutline(g, torso)

  const beltGeo = new THREE.TorusGeometry(TORSO_BOTTOM_R + 0.05, 0.05, 6, 12)
  const belt = new THREE.Mesh(beltGeo, accentMat)
  belt.rotation.x = Math.PI / 2
  belt.position.set(0, HIP_Y + 0.04, 0)
  g.add(belt)

  // Thin rod-like part — deliberately not outlined (same reasoning as
  // Wings of Fire's horns/legs): the duel camera's steep top-down angle
  // would look nearly straight down its axis and produce a giant wedge.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(NECK_R, NECK_R * 1.1, NECK_H, 8), bodyMat)
  neck.position.set(0, NECK_CENTER_Y, 0)
  g.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 14, 12), bodyMat)
  head.scale.set(0.92, 1.08, 0.96)
  head.position.set(0, HEAD_CENTER_Y, 0)
  g.add(head)
  addOutline(g, head)

  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
  ;[-1, 1].forEach(side => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(side * 0.1, HEAD_CENTER_Y + 0.02, -HEAD_R * 0.92)
    g.add(eye)
  })
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 6), bodyMat)
  nose.rotation.x = -Math.PI / 2
  nose.position.set(0, HEAD_CENTER_Y - 0.05, -HEAD_R * 0.98)
  g.add(nose)

  const headgear = makeHeadgear(elementKey, accentMat, bender.accent)
  headgear.scale.setScalar(0.8)
  headgear.position.set(0, HEAD_CENTER_Y, 0)
  g.add(headgear)

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.42, 4, 8)
  const armLen = 0.42 + 0.09 * 2
  const handGeo = new THREE.SphereGeometry(0.095, 8, 6)
  const shoulderY = TORSO_CENTER_Y + TORSO_H * 0.32
  ;[-1, 1].forEach(side => {
    const arm = new THREE.Mesh(armGeo, accentMat)
    arm.position.set(side * (TORSO_TOP_R + 0.1), shoulderY - armLen / 2, 0)
    arm.rotation.z = side * 0.14
    g.add(arm)
    const hand = new THREE.Mesh(handGeo, accentMat)
    hand.position.set(side * (TORSO_TOP_R + 0.1 + side * 0.05), shoulderY - armLen, 0)
    g.add(hand)
  })

  g.userData.bodyMeshes = [torso, head]
  g.userData.baseColor = bender.color
  return g
}

// Bending moves used to all render as the same plain emissive sphere.
// Now each element tag maps to one of five shared shapes so a Fireball
// actually reads differently in flight from a Metal Shard or an Air
// Gust — the sync loop in GameCanvas swaps a pooled mesh's `geometry`
// reference per-frame (cheap: just a reference swap) based on the
// active projectile's tag, and animates each shape family differently
// (pulsing blast, tumbling shard, spinning gust ring, flickering bolt,
// streaking jet) instead of sitting there as a static ball.
const PROJECTILE_GEO = {
  blast: new THREE.SphereGeometry(1, 12, 10),
  shard: new THREE.OctahedronGeometry(1, 0),
  gust: new THREE.TorusGeometry(0.75, 0.3, 8, 16),
  bolt: new THREE.BoxGeometry(0.32, 0.32, 1.7),
  stream: new THREE.CapsuleGeometry(0.4, 1.0, 4, 8),
}
const TAG_SHAPE = {
  fire: 'blast', lava: 'blast', combustion: 'blast',
  earth: 'shard', crystal: 'shard', sand: 'shard', metal: 'shard',
  air: 'gust',
  lightning: 'bolt',
  water: 'stream', ice: 'stream', storm: 'stream',
}

function makeProjectileMesh() {
  const mesh = new THREE.Mesh(
    PROJECTILE_GEO.blast,
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.35 }),
  )
  mesh.visible = false
  mesh.userData.shape = 'blast'
  return mesh
}

// A pooled expanding-and-fading ring for one-shot visual events (cast
// flashes, hit impacts, buff pulses, burst shockwaves) — the kind of
// on-hit "juice" the game had none of before: every bending attack just
// silently subtracted HP with no feedback beyond the target's hitFlash.
function makeEffectMesh() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.visible = false
  return mesh
}

// One themed monument mesh per cardinal element, dressing the open world
// so it reads as a real place rather than an empty plaza — also doubles
// as the collidable footprint the engine already knows about.
function makeMonumentMesh(monument) {
  const g = new THREE.Group()
  g.position.set(monument.x, 0, monument.z)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5468, roughness: 1 })
  switch (monument.element) {
    case 'water': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.6, 20), stoneMat)
      base.position.y = 0.3
      g.add(base)
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 20),
        new THREE.MeshStandardMaterial({ color: 0x2f8fd1, emissive: 0x0f3550, emissiveIntensity: 0.5, roughness: 0.2 }))
      pool.position.y = 0.65
      g.add(pool)
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 10), stoneMat)
      spout.position.y = 1.6
      g.add(spout)
      break
    }
    case 'fire': {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 3, 10), stoneMat)
      tower.position.y = 1.5
      g.add(tower)
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 0.5, 10), stoneMat)
      bowl.position.y = 3.1
      g.add(bowl)
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a3a }))
      flame.position.y = 3.7
      g.add(flame)
      const glow = new THREE.PointLight(0xff8a3a, 1.4, 20, 2)
      glow.position.y = 3.7
      g.add(glow)
      g.userData.flame = flame
      break
    }
    case 'earth': {
      for (let i = 0; i < 5; i++) {
        const h = 1.4 + Math.random() * 2.4
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.4, h, 6), stoneMat)
        const ang = (i / 5) * Math.PI * 2
        spire.position.set(Math.cos(ang) * 1.3, h / 2, Math.sin(ang) * 1.3)
        spire.rotation.y = Math.random() * Math.PI
        g.add(spire)
      }
      break
    }
    case 'air': {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4.4, 10), stoneMat)
      pillar.position.y = 2.2
      g.add(pillar)
      const bannerMat = new THREE.MeshStandardMaterial({ color: 0xdfeeff, roughness: 1, side: THREE.DoubleSide })
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.5, 0.05, 6, 20), bannerMat)
        ring.rotation.x = Math.PI / 2
        ring.position.y = 1.2 + i * 1.1
        g.add(ring)
      }
      break
    }
  }
  return g
}

function buildWorldScene(monuments, props) {
  const scene = new THREE.Scene()
  const skyColor = 0x1a3a4a
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.Fog(skyColor, 45, 150)

  scene.add(new THREE.HemisphereLight(0xbfe7ff, 0x1a2a1a, 1.1))
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.05)
  sun.position.set(30, 50, 20)
  scene.add(sun)

  // Much larger than WORLD_HALF (which only bounds player/CPU movement) —
  // the chase camera trails behind the player by several more units, so a
  // ground disc sized just past the movement bound left the camera itself
  // poking past the disc's edge into the void near the world boundary.
  const groundR = WORLD_HALF + 60
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(groundR, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a6b4a, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const pathMat = new THREE.MeshBasicMaterial({ color: 0xcbb98a, transparent: true, opacity: 0.35 })
  const path = new THREE.Mesh(new THREE.RingGeometry(0, 10, 32), pathMat)
  path.rotation.x = -Math.PI / 2
  path.position.y = 0.01
  scene.add(path)

  const monumentGroups = monuments.map(m => { const mesh = makeMonumentMesh(m); scene.add(mesh); return mesh })

  const propMat = new THREE.MeshStandardMaterial({ color: 0x6a6478, roughness: 1 })
  props.forEach(p => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(p.w, p.d) / 2, 0), propMat)
    rock.position.set(p.x, p.h / 2, p.z)
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    scene.add(rock)
  })

  return { scene, monumentGroups }
}

function rand(a, b) { return a + Math.random() * (b - a) }

const P1_KEYS = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', claw: 'KeyF', move0: 'KeyG', move1: 'KeyH' }
const P2_KEYS = { fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', claw: 'Comma', move0: 'Period', move1: 'Slash' }
const ALL_GAME_KEY_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'Comma', 'Period', 'Slash']

function readInput(keys, map) {
  const turn = (keys.has(map.left) ? 1 : 0) - (keys.has(map.right) ? 1 : 0)
  const thrust = (keys.has(map.fwd) ? 1 : 0) - (keys.has(map.back) ? 1 : 0)
  return { turn, thrust, claw: keys.has(map.claw), moves: [keys.has(map.move0), keys.has(map.move1)] }
}

function GameCanvas({ mode, elementA, elementB, onHud, onResult }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onResultRef = useRef(onResult); onResultRef.current = onResult

  useEffect(() => {
    const mount = mountRef.current
    let raf = null
    let disposed = false

    const state = mode === 'duel' ? createDuelState(elementA, elementB) : createSoloState(elementA)

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 400)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    function onKeyDown(e) {
      if (ALL_GAME_KEY_CODES.includes(e.code)) e.preventDefault()
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

    const { scene, monumentGroups } = buildWorldScene(state.world.monuments, state.world.props)

    const meshById = {}
    state.units.forEach(u => {
      const mesh = makeBenderModel(u.element)
      scene.add(mesh)
      meshById[u.id] = mesh
    })

    const PROJECTILE_POOL_SIZE = 24
    const projectilePool = Array.from({ length: PROJECTILE_POOL_SIZE }, () => {
      const mesh = makeProjectileMesh()
      scene.add(mesh)
      return mesh
    })

    const EFFECT_POOL_SIZE = 16
    const effectPool = Array.from({ length: EFFECT_POOL_SIZE }, () => {
      const mesh = makeEffectMesh()
      scene.add(mesh)
      return mesh
    })

    const clock = new THREE.Clock()

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const k = keysRef.current

      const inputs = {}
      if (!state.result) {
        const p1 = state.units.find(u => u.id === 'p1')
        if (p1?.alive) inputs.p1 = readInput(k, P1_KEYS)
        if (mode === 'duel') {
          const p2 = state.units.find(u => u.id === 'p2')
          if (p2?.alive) inputs.p2 = readInput(k, P2_KEYS)
        }
        stepGame(state, inputs, dt)
      }

      // Sync unit meshes; solo mode spawns a fresh CPU unit each wave with
      // the same id ('cpu') but a new element — rebuild its mesh if the
      // element changed, same pattern as Wings of Fire's solo CPU respawn.
      state.units.forEach(u => {
        let mesh = meshById[u.id]
        if (!mesh || mesh.userData.baseColor !== getBender(u.element).color) {
          if (mesh) scene.remove(mesh)
          mesh = makeBenderModel(u.element)
          scene.add(mesh)
          meshById[u.id] = mesh
        }
        mesh.visible = u.alive
        if (!u.alive) return
        mesh.position.set(u.x, 0, u.z)
        mesh.rotation.y = u.yaw
        const bob = u.engaged && state.phase === 'battle' ? 0 : Math.sin(t * 6 + (u.id === 'p1' ? 0 : 2)) * 0.03
        mesh.position.y = bob
        const flashColor = u.hitFlash > 0 ? 0xffffff : mesh.userData.baseColor
        mesh.userData.bodyMeshes.forEach(m => m.material.color.setHex(flashColor))
        mesh.visible = u.camoTimer > 0 ? (Math.sin(t * 20) > 0) : true
      })
      Object.keys(meshById).forEach(id => {
        if (!state.units.find(u => u.id === id)) { scene.remove(meshById[id]); delete meshById[id] }
      })

      state.projectiles.forEach((p, i) => {
        if (i >= projectilePool.length) return
        const mesh = projectilePool[i]
        mesh.visible = true
        const shape = TAG_SHAPE[p.tag] || 'blast'
        if (mesh.userData.shape !== shape) { mesh.geometry = PROJECTILE_GEO[shape]; mesh.userData.shape = shape }
        mesh.position.set(p.x, 1.1, p.z)
        mesh.material.color.setHex(p.color)
        mesh.material.emissive.setHex(p.color)
        const yaw = Math.atan2(p.vx, p.vz)
        if (shape === 'blast') {
          const pulse = 1 + Math.sin(t * 16 + i * 1.7) * 0.14
          mesh.scale.setScalar(p.radius * pulse)
          mesh.rotation.y += 5 * dt
        } else if (shape === 'shard') {
          mesh.scale.setScalar(p.radius)
          mesh.rotation.x += 7 * dt
          mesh.rotation.y += 5 * dt
        } else if (shape === 'gust') {
          mesh.scale.setScalar(p.radius)
          mesh.rotation.x = Math.PI / 2
          mesh.rotation.z += 11 * dt
        } else if (shape === 'bolt') {
          mesh.scale.set(p.radius, p.radius, p.radius * 1.7)
          mesh.rotation.y = yaw
          mesh.visible = Math.sin(t * 45 + i * 2.3) > -0.35 // electric flicker
        } else if (shape === 'stream') {
          mesh.scale.set(p.radius, p.radius, p.radius * 1.3)
          mesh.rotation.x = Math.PI / 2
          mesh.rotation.z = yaw
        }
      })
      for (let i = state.projectiles.length; i < projectilePool.length; i++) projectilePool[i].visible = false

      state.effects.forEach((e, i) => {
        if (i >= effectPool.length) return
        const mesh = effectPool[i]
        mesh.visible = true
        const progress = 1 - e.life / e.maxLife
        const growFrom = e.kind === 'buff' ? 0.15 : 0.35
        const growTo = e.kind === 'burst' ? 1.15 : 1.6
        mesh.position.set(e.x, e.kind === 'buff' ? 1.0 : 0.15, e.z)
        const scale = e.radius * (growFrom + progress * (growTo - growFrom))
        mesh.scale.set(scale, scale, scale)
        mesh.rotation.x = e.kind === 'buff' ? 0 : -Math.PI / 2
        mesh.material.color.setHex(e.color)
        mesh.material.opacity = Math.max(0, (1 - progress) * 0.8)
      })
      for (let i = state.effects.length; i < effectPool.length; i++) effectPool[i].visible = false

      const fireMonument = monumentGroups.find(m => m.userData.flame)
      if (fireMonument) fireMonument.userData.flame.scale.setScalar(1 + Math.sin(t * 10) * 0.15)

      // Camera: chase-cam behind p1 in solo; steep shared top-down-ish
      // framing of both players the whole game in duel (same technique as
      // Wings of Fire's duel camera — robust to separation direction,
      // needed here since duel players share one continuous explore+battle
      // world rather than a bounded arena).
      if (mode === 'duel') {
        const p1 = state.units.find(u => u.id === 'p1')
        const p2 = state.units.find(u => u.id === 'p2')
        const midX = (p1.x + p2.x) / 2, midZ = (p1.z + p2.z) / 2
        const sep = Math.hypot(p1.x - p2.x, p1.z - p2.z)
        const dist = Math.max(16, Math.min(80, sep * 1.3 + 14))
        const elev = 1.1
        camera.position.set(midX, dist * Math.sin(elev), midZ + dist * Math.cos(elev))
        camera.lookAt(midX, 0.5, midZ)
      } else {
        const p1 = state.units.find(u => u.id === 'p1')
        const fx = -Math.sin(p1.yaw), fz = -Math.cos(p1.yaw)
        const camDist = 7, camHeight = 3.2
        camera.position.set(p1.x - fx * camDist, camHeight, p1.z - fz * camDist)
        camera.lookAt(p1.x, 1.1, p1.z)
      }

      renderer.render(scene, camera)

      const p1 = state.units.find(u => u.id === 'p1')
      const p2 = mode === 'duel' ? state.units.find(u => u.id === 'p2') : state.units.find(u => u.id === 'cpu')
      onHudRef.current({
        mode, phase: state.phase,
        p1: p1 ? { hp: p1.hp, maxHp: p1.maxHp, element: p1.element, engaged: p1.engaged } : null,
        p2: p2 ? { hp: p2.hp, maxHp: p2.maxHp, element: p2.element, isCPU: !!p2.isCPU, engaged: p2.engaged } : null,
        wave: state.wave, waveTotal: WAVES.length,
        toast: state.toast,
        result: state.result,
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
  }, [mode, elementA, elementB])

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
  const benderP1 = hud.p1 && getBender(hud.p1.element)
  const benderP2 = hud.p2 && getBender(hud.p2.element)
  const inBattle = hud.phase === 'battle'
  return (
    <div className={styles.hud}>
      <div className={styles.hudTop}>
        {hud.mode === 'solo' && <span className={styles.waveInfo}>🏛️ Wave {hud.wave + 1}/{hud.waveTotal}</span>}
        <span className={styles.phaseInfo}>{inBattle ? '⚔️ Battle!' : '🔎 Find your opponent'}</span>
      </div>
      {inBattle && hud.p1 && <HpBar label={`You (${benderP1.name})`} hp={hud.p1.hp} maxHp={hud.p1.maxHp} icon={benderP1.icon} />}
      {inBattle && hud.p2 && <HpBar label={hud.mode === 'duel' ? `P2 (${benderP2.name})` : benderP2.name} hp={hud.p2.hp} maxHp={hud.p2.maxHp} icon={benderP2.icon} />}
      {inBattle && benderP1 && (
        <span className={styles.controlsHint}>
          F strike · G {benderP1.moves[0].name} · H {benderP1.moves[1].name}
        </span>
      )}
      {hud.toast && <div className={`${styles.toast} ${hud.toast.kind === 'bad' ? styles.toastBad : hud.toast.kind === 'good' ? styles.toastGood : ''}`}>{hud.toast.text}</div>}
    </div>
  )
}

function BenderCard({ bender, onClick }) {
  return (
    <button className={styles.tribeCard} onClick={onClick}>
      <span className={styles.tribeIcon}>{bender.icon}</span>
      <span className={styles.tribeName}>{bender.name}</span>
      <span className={styles.tribeDesc}>{bender.desc}</span>
      <span className={styles.tribeStats}>HP {bender.maxHp}{bender.armor ? ` · ${Math.round(bender.armor * 100)}% Armor` : ''}</span>
    </button>
  )
}

export default function Avatar() {
  const [screen, setScreen] = useState('intro') // intro | modeSelect | benderSelect | playing | result
  const [mode, setMode] = useState(null)
  const [pick1, setPick1] = useState(null)
  const [pick2, setPick2] = useState(null)
  const [pickingSlot, setPickingSlot] = useState(1)
  const [hud, setHud] = useState(null)
  const [result, setResult] = useState(null)

  function chooseMode(m) {
    setMode(m)
    setPick1(null); setPick2(null); setPickingSlot(1)
    setScreen('benderSelect')
  }

  function chooseBender(key) {
    if (mode === 'solo') { setPick1(key); setScreen('playing'); return }
    if (pickingSlot === 1) { setPick1(key); setPickingSlot(2) }
    else { setPick2(key); setScreen('playing') }
  }

  function handleResult(r) {
    setResult(r)
    setScreen('result')
  }

  function playAgain() { setScreen('benderSelect'); setPick1(null); setPick2(null); setPickingSlot(1) }
  function backToModes() { setScreen('modeSelect'); setMode(null) }

  const benderSelectTitle = mode === 'solo' ? 'Choose Your Bending Style'
    : `Player ${pickingSlot}: Choose Your Bending Style`

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🌏 Avatar<span className={styles.subtitle}>Elemental Grounds</span></h1>
          <p className={styles.blurb}>
            Pick a bending style and roam the open-world Proving Grounds to find your opponent —
            Air, Water, Earth, Fire, or the rarer specialty styles: Lava, Metal, Sand, Lightning,
            Ice, Crystal, Combustion, and Storm. Once you're close enough, the fight begins right
            where you meet: a basic strike (F), plus two signature bending moves (G and H) — a
            damaging attack and a utility move like a heal, an armor buff, or a crowd-control trap.
            Survive a gauntlet of 12 rival benders solo, or duel a friend on one keyboard
            (arrows to move, Comma to strike, Period and Slash to bend).
          </p>
          <button className={styles.bigBtn} onClick={() => setScreen('modeSelect')}>▶ Enter the Grounds</button>
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
              <span className={styles.modeDesc}>Explore the Grounds and survive a gauntlet of 12 rival benders, one after another.</span>
            </button>
            <button className={styles.modeCard} onClick={() => chooseMode('duel')}>
              <span className={styles.modeIcon}>⚔️</span>
              <span className={styles.modeName}>2-Player Duel</span>
              <span className={styles.modeDesc}>Two benders, one keyboard. Find each other in the Grounds — first to fall loses.</span>
            </button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'benderSelect' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>{benderSelectTitle}</h2>
          <div className={styles.tribeGrid}>
            {BENDERS.map(b => (
              <BenderCard key={b.key} bender={b} onClick={() => chooseBender(b.key)} />
            ))}
          </div>
          <button className={styles.backLink} onClick={backToModes}>← Back</button>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <GameCanvas mode={mode} elementA={pick1} elementB={pick2} onHud={setHud} onResult={handleResult} />
          <Hud hud={hud} />
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}

      {screen === 'result' && (
        <div className={styles.overlayScreen}>
          {mode === 'solo' ? (
            result === 'victory' ? (
              <>
                <h2 className={styles.title2}>🏆 Victory!</h2>
                <p className={styles.blurb}>You cleared all {WAVES.length} waves as a {getBender(pick1).name}. The Proving Grounds are yours.</p>
              </>
            ) : (
              <>
                <h2 className={styles.title2}>💀 Defeated</h2>
                <p className={styles.blurb}>You fell as a {getBender(pick1).name}. Try a different bending style, or the same one with sharper reflexes!</p>
              </>
            )
          ) : (
            <>
              <h2 className={styles.title2}>🏆 Player {result === 'p1' ? '1' : '2'} Wins!</h2>
              <p className={styles.blurb}>
                {getBender(result === 'p1' ? pick1 : pick2).name} beat {getBender(result === 'p1' ? pick2 : pick1).name} in the duel.
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
