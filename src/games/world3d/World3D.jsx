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

// Each area's geometry is only shown while the player is within its
// radius (in XZ), so the zones can't be seen from one another.
const MEADOW_ZONE = { x: 0, z: -5, radius: 55 }
const RUINS_ZONE  = { x: 0, z: -165, radius: 55 }

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

// ── Aviary Village — an explorable, customizable bird hamlet ────────
const AVIARY_THEME_KEY = 'skylight-aviary-theme'

const VILLAGE_ORIGIN = { x: 110, z: 30 }
const VILLAGE_SPAWN  = { x: 110, y: 0, z: 17, yaw: Math.PI }
const VILLAGE_PORTAL = { x: 9, z: 20 }
const VILLAGE_ZONE = { x: VILLAGE_ORIGIN.x, z: VILLAGE_ORIGIN.z, radius: 55 }

const VILLAGE_HUTS = [
  { x: 119,   z: 30 },
  { x: 114.5, z: 37.8 },
  { x: 105.5, z: 37.8 },
  { x: 101,   z: 30 },
  { x: 105.5, z: 22.2 },
  { x: 114.5, z: 22.2 },
]
const VILLAGE_PERCHES = [
  { x: 110,   z: 34 },
  { x: 106.5, z: 26 },
  { x: 113.5, z: 26 },
]

const ROOF_PALETTE    = [0xd97757, 0x6c63ff, 0xe0c07a, 0x4fa3d1, 0x9fe0d6, 0xff8fa3]
const ROOF_NAMES      = ['Terracotta', 'Violet', 'Golden', 'Sky Blue', 'Seafoam', 'Blossom']
const BANNER_PALETTE  = [0xffffff, 0xffd9a0, 0x9fe0d6, 0xff8fa3, 0x8a7dff, 0xe0c07a]
const BANNER_NAMES    = ['Snow', 'Amber', 'Seafoam', 'Blossom', 'Violet', 'Golden']
const LANTERN_PALETTE = [0xffe6b0, 0xff8fa3, 0x9fe0d6, 0x8a7dff, 0xffffff]
const LANTERN_NAMES   = ['Honey', 'Blossom', 'Seafoam', 'Violet', 'Moonlight']

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

function tintColor(hex, hueShift, satShift, lightShift) {
  const c = new THREE.Color(hex)
  c.offsetHSL(hueShift, satShift, lightShift)
  return c
}

// A "floating island" platform: a rock body capped with a lighter crust,
// a glowing rim trim, dangling root tendrils underneath, and (on larger
// islands) a few crystal shards — instead of a single flat-colored box.
function makePlatformIsland(p) {
  const group = new THREE.Group()
  const baseColor = new THREE.Color(p.color)

  const body = new THREE.Mesh(
    roundedBox(p.w, p.h, p.d),
    new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85, metalness: 0.05 })
  )
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const capColor = tintColor(p.color, 0, 0.08, 0.16)
  const capH = Math.min(0.3, Math.max(0.12, p.h * 0.16))
  const cap = new THREE.Mesh(
    roundedBox(p.w * 0.97, capH, p.d * 0.97),
    new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.6 })
  )
  cap.position.y = p.h / 2 + capH / 2 - 0.03
  cap.castShadow = true
  cap.receiveShadow = true
  group.add(cap)

  const trim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w * 0.985, 0.01, p.d * 0.985)),
    new THREE.LineBasicMaterial({ color: tintColor(p.color, 0, 0.2, 0.28), transparent: true, opacity: 0.85 })
  )
  trim.position.y = p.h / 2 + capH - 0.02
  group.add(trim)

  const rootColor = tintColor(p.color, 0, -0.05, -0.24)
  const rootMat = new THREE.MeshStandardMaterial({ color: rootColor, roughness: 1 })
  const rootCount = 3 + Math.round(Math.min(p.w, p.d))
  for (let i = 0; i < rootCount; i++) {
    const rl = 0.5 + Math.random() * (0.4 + p.h * 0.2)
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.16 + Math.random() * 0.18, rl, 6), rootMat)
    root.position.set(
      (Math.random() - 0.5) * (p.w * 0.75),
      -p.h / 2 - rl / 2 + 0.2,
      (Math.random() - 0.5) * (p.d * 0.75)
    )
    root.rotation.x = (Math.random() - 0.5) * 0.25
    root.rotation.z = (Math.random() - 0.5) * 0.25
    root.castShadow = true
    group.add(root)
  }

  if (Math.min(p.w, p.d) >= 3) {
    const crystalColor = tintColor(p.color, 0, 0.25, 0.32)
    const crystalMat = new THREE.MeshStandardMaterial({
      color: crystalColor, emissive: crystalColor, emissiveIntensity: 0.55, roughness: 0.3,
    })
    const corners = [
      [p.w / 2 - 0.45, p.d / 2 - 0.45], [-p.w / 2 + 0.45, p.d / 2 - 0.45],
      [p.w / 2 - 0.45, -p.d / 2 + 0.45], [-p.w / 2 + 0.45, -p.d / 2 + 0.45],
    ]
    corners.forEach(([cx, cz]) => {
      if (Math.random() < 0.45) return
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2 + Math.random() * 0.14), crystalMat)
      crystal.position.set(cx, p.h / 2 + capH + 0.28, cz)
      crystal.rotation.y = Math.random() * Math.PI
      crystal.castShadow = true
      group.add(crystal)
    })
  }

  group.position.set(p.x, p.y, p.z)
  return group
}

// An elder spirit: a tall hooded, cloaked figure with a fanned cape and a
// halo of light — echoing the elder statues of Sky: Children of the Light,
// scaled well above the player rather than a small robed sprite.
function makeSpiritFigure(color) {
  const g = new THREE.Group()
  const mat = (emissiveIntensity = 0.4, roughness = 0.55) => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity, roughness, metalness: 0.05,
  })

  const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.6, 16, 1, true), mat(0.3, 0.6))
  cloak.position.y = 1.3
  cloak.castShadow = true
  g.add(cloak)

  const hem = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.16, 10, 24), mat(0.25, 0.7))
  hem.position.y = 0.05
  hem.rotation.x = Math.PI / 2
  hem.castShadow = true
  g.add(hem)

  const cape = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.06, 8, 24, Math.PI * 1.15),
    mat(0.35, 0.5)
  )
  cape.position.set(0, 2.15, -0.1)
  cape.rotation.set(Math.PI / 2.4, 0, Math.PI / 2 - (Math.PI * 1.15) / 2)
  cape.castShadow = true
  g.add(cape)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), mat(0.55, 0.45))
  head.position.y = 2.75
  g.add(head)

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 16), mat(0.3, 0.55))
  hood.position.y = 3.15
  g.add(hood)

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.05, 10, 28),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.3 })
  )
  halo.position.y = 3.55
  halo.rotation.x = Math.PI / 2.3
  g.add(halo)
  g.userData.halo = halo

  const glow = new THREE.PointLight(color, 1.8, 11)
  glow.position.y = 2.2
  g.add(glow)

  return g
}

// ── Aviary Village builders ──────────────────────────────────────────
function makeHut(roofColor) {
  const g = new THREE.Group()
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b8, roughness: 0.85 })
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 1.6, 10), wallMat)
  wall.position.y = 0.8
  wall.castShadow = true
  wall.receiveShadow = true
  g.add(wall)

  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 })
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 10), roofMat)
  roof.position.y = 2.25
  roof.castShadow = true
  g.add(roof)

  const door = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a2f22, roughness: 1 })
  )
  door.position.set(0, 0.55, 1.24)
  g.add(door)

  const perchStick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b5638, roughness: 1 })
  )
  perchStick.position.set(0, 0.35, 1.35)
  perchStick.rotation.x = Math.PI / 2
  perchStick.castShadow = true
  g.add(perchStick)

  g.userData.roofMat = roofMat
  return g
}

function makeBanner(color) {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b5638, roughness: 1 })
  )
  pole.position.y = 0.55
  pole.castShadow = true
  g.add(pole)

  const flagMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide })
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), flagMat)
  flag.position.set(0.23, 0.95, 0)
  flag.castShadow = true
  g.add(flag)

  g.userData.flagMat = flagMat
  g.userData.flag = flag
  return g
}

function makePerch(height = 1.8) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b5638, roughness: 1 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, height, 8), mat)
  pole.position.y = height / 2
  pole.castShadow = true
  g.add(pole)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), mat)
  bar.position.y = height
  bar.rotation.z = Math.PI / 2
  bar.castShadow = true
  g.add(bar)
  return g
}

function makeFenceSegment(x, z, ry) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 1 })
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6)
  const postL = new THREE.Mesh(postGeo, mat)
  postL.position.set(-0.9, 0.45, 0)
  postL.castShadow = true
  g.add(postL)
  const postR = new THREE.Mesh(postGeo, mat)
  postR.position.set(0.9, 0.45, 0)
  postR.castShadow = true
  g.add(postR)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.08), mat)
  rail.position.y = 0.65
  rail.castShadow = true
  g.add(rail)
  g.position.set(x, 0, z)
  g.rotation.y = ry
  return g
}

// A tiny low-poly bird: a cone body (nose along local +Z) with two flat
// wing planes that flap via rotation, reused for both flying and perched
// birds.
function makeBird(color) {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 6), bodyMat)
  body.rotation.x = Math.PI / 2
  body.castShadow = true
  g.add(body)

  const wingGeo = new THREE.BoxGeometry(0.32, 0.02, 0.13)
  const wingL = new THREE.Mesh(wingGeo, bodyMat)
  wingL.position.set(-0.16, 0, 0)
  g.add(wingL)
  const wingR = new THREE.Mesh(wingGeo, bodyMat)
  wingR.position.set(0.16, 0, 0)
  g.add(wingR)

  g.userData.wingL = wingL
  g.userData.wingR = wingR
  return g
}

// A customization plinth: an interactable pedestal with a floating,
// glowing icon tinted to the currently-selected palette color.
function makePlinth(color) {
  const g = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0x8f8264, roughness: 0.9 })
  )
  base.position.y = 0.45
  base.castShadow = true
  g.add(base)

  const iconMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 })
  const icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), iconMat)
  icon.position.y = 1.3
  icon.castShadow = true
  g.add(icon)

  const glow = new THREE.PointLight(color, 0.9, 5)
  glow.position.y = 1.3
  g.add(glow)

  g.userData.icon = icon
  g.userData.glow = glow
  return g
}

function loadAviaryTheme() {
  try {
    const raw = localStorage.getItem(AVIARY_THEME_KEY)
    if (!raw) return { roof: 0, banner: 0, lantern: 0 }
    const parsed = JSON.parse(raw)
    const clamp = (v, len) => (Number.isInteger(v) && v >= 0 && v < len ? v : 0)
    return {
      roof: clamp(parsed.roof, ROOF_PALETTE.length),
      banner: clamp(parsed.banner, BANNER_PALETTE.length),
      lantern: clamp(parsed.lantern, LANTERN_PALETTE.length),
    }
  } catch {
    return { roof: 0, banner: 0, lantern: 0 }
  }
}
function saveAviaryTheme(theme) {
  try { localStorage.setItem(AVIARY_THEME_KEY, JSON.stringify(theme)) } catch { /* storage unavailable */ }
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
  const [nearCustomize, setNearCustomize] = useState(null)

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

    // Zone groups — each area's geometry lives under its own group so it
    // can be shown/hidden as a whole based on the player's location.
    const meadowGroup = new THREE.Group()
    const ruinsGroup = new THREE.Group()
    scene.add(meadowGroup, ruinsGroup)

    // Walkable platforms — floating islands with rock/crust/root detail
    const zonedPlatformDefs = [
      ...MEADOW_PLATFORMS.map(p => ({ p, group: meadowGroup })),
      ...RUINS_PLATFORMS.map(p => ({ p, group: ruinsGroup })),
    ]
    const platformMeshes = zonedPlatformDefs.map(({ p, group }) => {
      const island = makePlatformIsland(p)
      group.add(island)
      return {
        top: p.y + p.h / 2,
        minX: p.x - p.w / 2 - PLAYER_RADIUS,
        maxX: p.x + p.w / 2 + PLAYER_RADIUS,
        minZ: p.z - p.d / 2 - PLAYER_RADIUS,
        maxZ: p.z + p.d / 2 + PLAYER_RADIUS,
      }
    })

    // Decorative scenery (no collision)
    ;[[10, 14], [-10, 12], [4, 19], [-13, 4], [13, -2]].forEach(([x, z]) => meadowGroup.add(makeTree(x, z)))
    ;[[2, -2, 0.3], [-5, -6, -0.4], [9, 5, 0.7], [-9, -10, 0.2]].forEach(([x, z, r]) => meadowGroup.add(makeStone(x, z, r)))
    meadowGroup.add(makeArch(0, 9, 0))
    // ruins flanking columns + scattered broken pillars
    ruinsGroup.add(makeColumn(-4, -139, 5))
    ruinsGroup.add(makeColumn(4, -139, 5))
    ;[[10, -152, 2.4, 0.5], [-11, -156, 1.8, -0.7], [-2, -170, 3, 0.3], [9, -175, 2, -0.4], [-9, -182, 2.6, 0.6]]
      .forEach(([x, z, h, tilt]) => ruinsGroup.add(makeColumn(x, z, h, tilt)))
    ruinsGroup.add(makeArch(-2, -190, 0.3, 4, 0x8f8264))

    // Aviary Village — huts, perches, a lantern garland, customization
    // plinths, and birds, clustered off to the side and reached by portal.
    const aviaryTheme = loadAviaryTheme()
    const roofMaterials = []
    const bannerFlags = []
    const lanternMeshes = []
    const villageGroup = new THREE.Group()

    VILLAGE_HUTS.forEach(h => {
      const dx = h.x - VILLAGE_ORIGIN.x, dz = h.z - VILLAGE_ORIGIN.z
      const r = Math.hypot(dx, dz)
      const ux = dx / r, uz = dz / r

      const hut = makeHut(ROOF_PALETTE[aviaryTheme.roof])
      hut.position.set(h.x, 0, h.z)
      hut.rotation.y = Math.atan2(-dx, -dz)
      villageGroup.add(hut)
      roofMaterials.push(hut.userData.roofMat)

      const banner = makeBanner(BANNER_PALETTE[aviaryTheme.banner])
      banner.position.set(h.x + ux * 1.7, 0, h.z + uz * 1.7)
      banner.rotation.y = hut.rotation.y
      banner.userData.phase = Math.random() * 10
      villageGroup.add(banner)
      bannerFlags.push(banner)
    })

    VILLAGE_PERCHES.forEach(pp => {
      const perch = makePerch(1.8)
      perch.position.set(pp.x, 0, pp.z)
      perch.rotation.y = Math.random() * Math.PI
      villageGroup.add(perch)
    })

    ;[[104, 18, 0.5], [116, 18, -0.5]].forEach(([x, z, ry]) => villageGroup.add(makeFenceSegment(x, z, ry)))

    // Lantern garland strung between two posts at the plaza entrance
    const lanternPostMat = new THREE.MeshStandardMaterial({ color: 0x6b5638, roughness: 1 })
    const postA = { x: 104, z: 20 }
    const postB = { x: 116, z: 20 }
    ;[postA, postB].forEach(post => {
      const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), lanternPostMat)
      postMesh.position.set(post.x, 1.3, post.z)
      postMesh.castShadow = true
      villageGroup.add(postMesh)
    })
    const LANTERN_COUNT = 7
    const lanternGeo = new THREE.SphereGeometry(0.14, 10, 8)
    for (let i = 0; i < LANTERN_COUNT; i++) {
      const tt = i / (LANTERN_COUNT - 1)
      const x = postA.x + (postB.x - postA.x) * tt
      const z = postA.z + (postB.z - postA.z) * tt
      const baseY = 2.55 - Math.sin(Math.PI * tt) * 0.7
      const color = LANTERN_PALETTE[aviaryTheme.lantern]
      const lantern = new THREE.Mesh(
        lanternGeo,
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, roughness: 0.4 })
      )
      lantern.position.set(x, baseY, z)
      lantern.userData.baseY = baseY
      lantern.userData.phase = i * 0.6
      villageGroup.add(lantern)
      lanternMeshes.push(lantern)
    }
    const lanternLight = new THREE.PointLight(LANTERN_PALETTE[aviaryTheme.lantern], 1, 10)
    lanternLight.position.set((postA.x + postB.x) / 2, 2, (postA.z + postB.z) / 2)
    villageGroup.add(lanternLight)

    // Customization plinths — press E nearby to cycle each palette
    const roofPlinth = makePlinth(ROOF_PALETTE[aviaryTheme.roof])
    roofPlinth.position.set(110, 0, 41)
    villageGroup.add(roofPlinth)
    const bannerPlinth = makePlinth(BANNER_PALETTE[aviaryTheme.banner])
    bannerPlinth.position.set(98, 0, 30)
    villageGroup.add(bannerPlinth)
    const lanternPlinth = makePlinth(LANTERN_PALETTE[aviaryTheme.lantern])
    lanternPlinth.position.set(110, 0, 19)
    villageGroup.add(lanternPlinth)

    function applyRoofTheme(idx) {
      aviaryTheme.roof = idx
      const color = ROOF_PALETTE[idx]
      roofMaterials.forEach(m => m.color.setHex(color))
      roofPlinth.userData.icon.material.color.setHex(color)
      roofPlinth.userData.icon.material.emissive.setHex(color)
      roofPlinth.userData.glow.color.setHex(color)
      saveAviaryTheme(aviaryTheme)
    }
    function applyBannerTheme(idx) {
      aviaryTheme.banner = idx
      const color = BANNER_PALETTE[idx]
      bannerFlags.forEach(b => b.userData.flagMat.color.setHex(color))
      bannerPlinth.userData.icon.material.color.setHex(color)
      bannerPlinth.userData.icon.material.emissive.setHex(color)
      bannerPlinth.userData.glow.color.setHex(color)
      saveAviaryTheme(aviaryTheme)
    }
    function applyLanternTheme(idx) {
      aviaryTheme.lantern = idx
      const color = LANTERN_PALETTE[idx]
      lanternMeshes.forEach(l => { l.material.color.setHex(color); l.material.emissive.setHex(color) })
      lanternLight.color.setHex(color)
      lanternPlinth.userData.icon.material.color.setHex(color)
      lanternPlinth.userData.icon.material.emissive.setHex(color)
      lanternPlinth.userData.glow.color.setHex(color)
      saveAviaryTheme(aviaryTheme)
    }
    const customizePlinths = [
      { x: 110, z: 41, label: 'roof color', palette: ROOF_PALETTE, names: ROOF_NAMES, index: aviaryTheme.roof, apply: applyRoofTheme },
      { x: 98,  z: 30, label: 'banner color', palette: BANNER_PALETTE, names: BANNER_NAMES, index: aviaryTheme.banner, apply: applyBannerTheme },
      { x: 110, z: 19, label: 'lantern color', palette: LANTERN_PALETTE, names: LANTERN_NAMES, index: aviaryTheme.lantern, apply: applyLanternTheme },
    ]

    // Birds — a few looping the plaza, a few perched and idling
    const BIRD_COLORS = [0xffffff, 0xffe0b0, 0x9fe0d6, 0xff8fa3, 0x8a7dff, 0xe0c07a]
    const flyingBirds = []
    for (let i = 0; i < 6; i++) {
      const bird = makeBird(BIRD_COLORS[i % BIRD_COLORS.length])
      villageGroup.add(bird)
      flyingBirds.push({
        group: bird,
        radius: 6 + Math.random() * 5,
        height: 4 + Math.random() * 3,
        speed: 0.22 + Math.random() * 0.18,
        dir: Math.random() < 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2,
        flapPhase: Math.random() * 10,
      })
    }
    const perchedBirds = VILLAGE_PERCHES.map((pp, i) => {
      const bird = makeBird(BIRD_COLORS[(i + 2) % BIRD_COLORS.length])
      const baseYaw = Math.random() * Math.PI * 2
      bird.position.set(pp.x, 1.85, pp.z)
      bird.rotation.y = baseYaw
      villageGroup.add(bird)
      return { group: bird, baseY: 1.85, baseYaw, phase: Math.random() * 10 }
    })

    scene.add(villageGroup)

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

    // Elder spirits — freed with E, unlocking maps/finale instead of expressions
    const spirits = SPIRITS.map(s => {
      const g = makeSpiritFigure(s.color)
      g.position.set(s.x, s.y - 1.2, s.z)
      ;(s.id === 'meadow' ? meadowGroup : ruinsGroup).add(g)
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
    gatePortal.target = RUINS_SPAWN
    const returnPortal = makePortal(0, -124, 0x9fe0d6)
    returnPortal.active = true
    returnPortal.target = MEADOW_SPAWN
    const villagePortal = makePortal(VILLAGE_PORTAL.x, VILLAGE_PORTAL.z, 0xffd27a)
    villagePortal.active = true
    villagePortal.target = VILLAGE_SPAWN
    const villageReturnPortal = makePortal(VILLAGE_SPAWN.x, VILLAGE_SPAWN.z - 3, 0x9fe0d6)
    villageReturnPortal.active = true
    villageReturnPortal.target = MEADOW_SPAWN
    const allPortals = [gatePortal, returnPortal, villagePortal, villageReturnPortal]

    // Collectible orbs — grouped by zone so they hide/show along with it
    const orbGeo = new THREE.SphereGeometry(0.22, 12, 10)
    function buildOrbs(defs, group) {
      return defs.map((o, i) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xfff2c0, emissive: 0xffdd88, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0,
        })
        const mesh = new THREE.Mesh(orbGeo, mat)
        mesh.position.set(o.x, o.y, o.z)
        group.add(mesh)
        return { mesh, group, x: o.x, y: o.y, z: o.z, collected: false, phase: i * 0.7 }
      })
    }
    const orbs = [
      ...buildOrbs(MEADOW_ORBS, meadowGroup),
      ...buildOrbs(RUINS_ORBS, ruinsGroup),
    ]

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
        for (const p of customizePlinths) {
          const dx = p.x - player.x, dz = p.z - player.z
          if (dx * dx + dz * dz < INTERACT_RANGE * INTERACT_RANGE) {
            p.index = (p.index + 1) % p.palette.length
            p.apply(p.index)
            playChime(ensureAudio(), 900, 1500)
            setBanner(`Aviary ${p.label} set to ${p.names[p.index]}`)
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

      // Zone visibility: only show an area's geometry while the player is
      // actually within it, so the zones can't be seen from one another.
      const dMeadow = (player.x - MEADOW_ZONE.x) ** 2 + (player.z - MEADOW_ZONE.z) ** 2
      const dRuins = (player.x - RUINS_ZONE.x) ** 2 + (player.z - RUINS_ZONE.z) ** 2
      const dVillage = (player.x - VILLAGE_ZONE.x) ** 2 + (player.z - VILLAGE_ZONE.z) ** 2
      meadowGroup.visible = dMeadow < MEADOW_ZONE.radius * MEADOW_ZONE.radius
      ruinsGroup.visible = dRuins < RUINS_ZONE.radius * RUINS_ZONE.radius
      villageGroup.visible = dVillage < VILLAGE_ZONE.radius * VILLAGE_ZONE.radius

      // Spirits: idle bob, free-animation, interact prompt
      let nearestName = null
      for (const s of spirits) {
        if (!s.freed) {
          s.group.position.y = (s.y - 1.2) + Math.sin(t * 1.2) * 0.08
          s.group.rotation.y = Math.sin(t * 0.4) * 0.3
          if (s.group.userData.halo) s.group.userData.halo.rotation.z = t * 0.6
          const dx = s.x - player.x, dy = s.y - 1.2 - player.y, dz = s.z - player.z
          if (dx * dx + dy * dy + dz * dz < INTERACT_RANGE * INTERACT_RANGE) nearestName = s.name
        } else {
          const dt2 = t - s.freeStartT
          if (dt2 < 1.4) {
            const k = Math.max(0, 1 - dt2 / 1.4)
            s.group.scale.setScalar(k)
            s.group.position.y = (s.y - 1.2) + dt2 * 1.5
          } else if (s.group.visible) {
            s.group.visible = false
          }
        }
      }
      setNearSpirit(prev => (prev === nearestName ? prev : nearestName))

      // Portals: activate visuals + handle teleport trigger
      for (const portal of allPortals) {
        const targetOpacity = portal.active ? 0.55 : 0.9
        portal.disc.material.opacity += (targetOpacity - portal.disc.material.opacity) * 0.1
        portal.disc.material.emissive.setHex(portal.active ? portal.color : 0x000000)
        portal.disc.material.emissiveIntensity = portal.active ? 0.9 : 0
        portal.light.intensity += ((portal.active ? 1.4 : 0) - portal.light.intensity) * 0.1
        if (portal.active) portal.disc.rotation.z += dt * 0.6
      }
      if (t > teleportLockUntil) {
        for (const portal of allPortals) {
          if (!portal.active) continue
          const dx = portal.x - player.x, dy = portal.y - player.y, dz = portal.z - player.z
          if (dx * dx + dy * dy + dz * dz < PORTAL_RANGE * PORTAL_RANGE) {
            const target = portal.target
            player.x = target.x; player.y = target.y; player.z = target.z
            yaw = target.yaw
            velocity.y = 0
            teleportLockUntil = t + TELEPORT_LOCK
            break
          }
        }
      }

      // Aviary Village: bird flight/perch idle, banner wave, lantern sway,
      // plinth glow, and the nearest-customizable-object interact prompt
      for (const b of flyingBirds) {
        const angle = t * b.speed * b.dir + b.phase
        const vx = -Math.sin(angle) * b.dir
        const vz = Math.cos(angle) * b.dir
        b.group.position.set(
          VILLAGE_ORIGIN.x + Math.cos(angle) * b.radius,
          b.height + Math.sin(t * 1.6 + b.phase) * 0.4,
          VILLAGE_ORIGIN.z + Math.sin(angle) * b.radius
        )
        b.group.rotation.y = Math.atan2(vx, vz)
        const flap = Math.sin(t * 9 + b.flapPhase) * 0.7
        b.group.userData.wingL.rotation.z = flap
        b.group.userData.wingR.rotation.z = -flap
      }
      for (const b of perchedBirds) {
        b.group.position.y = b.baseY + Math.sin(t * 1.2 + b.phase) * 0.03
        b.group.rotation.y = b.baseYaw + Math.sin(t * 0.3 + b.phase) * 0.3
        const flap = Math.max(0, Math.sin(t * 1.4 + b.phase * 2)) * 0.25
        b.group.userData.wingL.rotation.z = flap
        b.group.userData.wingR.rotation.z = -flap
      }
      for (const banner of bannerFlags) {
        banner.userData.flag.rotation.y = Math.sin(t * 2.5 + banner.userData.phase) * 0.35
      }
      for (const l of lanternMeshes) {
        l.position.y = l.userData.baseY + Math.sin(t * 1.3 + l.userData.phase) * 0.06
      }
      for (const plinth of [roofPlinth, bannerPlinth, lanternPlinth]) {
        plinth.userData.icon.rotation.y = t * 0.8
      }
      let nearestPlinthLabel = null
      for (const p of customizePlinths) {
        const dx = p.x - player.x, dz = p.z - player.z
        if (dx * dx + dz * dz < INTERACT_RANGE * INTERACT_RANGE) nearestPlinthLabel = p.label
      }
      setNearCustomize(prev => (prev === nearestPlinthLabel ? prev : nearestPlinthLabel))

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
          orb.group.remove(orb.mesh)
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
      {!nearSpirit && nearCustomize && locked && (
        <div className={styles.interactPrompt}>Press E to cycle the {nearCustomize}</div>
      )}
      {locked && <div className={styles.crosshair} />}
      {!locked && (
        <div className={styles.overlay}>
          <h1 className={styles.title}>Skylight</h1>
          <p className={styles.hint}>Click to begin</p>
          <p className={styles.controls}>
            WASD to walk · Mouse to look around · Space to jump, then hold Space to fly on gathered light · E to free a spirit or customize the Aviary Village · Esc to release
          </p>
        </div>
      )}
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
