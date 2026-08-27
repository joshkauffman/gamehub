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

// A stylized tapered wing membrane with three "finger" bumps along the
// leading edge and a scalloped (concave) trailing edge — a bat/dragon
// silhouette instead of one smooth ellipse — authored spanning local
// x:[0.1, 2.3] (root to tip) in the wing's own 2D plane, mirrored via
// scale.x for the left side. Rotating flat (-90° around X) maps local +Y
// to world -Z, so the shape's leading edge (larger local Y) lands toward
// the front of the dragon, matching the head-at--Z convention above.
function makeWingGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0.12, 0.22)
  shape.quadraticCurveTo(0.55, 0.5, 1.1, 0.58)
  shape.quadraticCurveTo(1.65, 0.64, 2.3, 0.42)
  shape.quadraticCurveTo(2.1, 0.1, 1.85, -0.08)
  shape.quadraticCurveTo(1.55, -0.4, 1.25, -0.14)
  shape.quadraticCurveTo(0.95, -0.48, 0.68, -0.24)
  shape.quadraticCurveTo(0.4, -0.5, 0.12, -0.22)
  shape.closePath()
  return new THREE.ShapeGeometry(shape, 10)
}
const sharedWingGeo = makeWingGeometry()

// Three thin "finger bone" struts fanning from the wrist to the leading
// edge's bumps — cheap detail that reads as actual wing structure instead
// of one floppy membrane blob. Authored in the wing's local 2D (x,y)
// plane (same space as makeWingGeometry above) and laid just in front of
// the membrane (z: 0.012) so they don't z-fight with it.
const WING_STRUT_POINTS = [[0.15, 0.14, 0.55, 0.42], [0.15, 0.2, 1.1, 0.58], [0.15, 0.14, 1.85, 0.35]]
function makeWingStrut(x0, y0, x1, y1, material) {
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, len, 5), material)
  strut.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.012)
  strut.rotation.z = Math.atan2(-dx, dy)
  return strut
}

function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
function gaussianBump(x, mu, sigma) { const d = (x - mu) / sigma; return Math.exp(-0.5 * d * d) }

// Per-tribe horn silhouettes, shaped after reference art of each tribe's
// canon head profile: IceWing's long backswept curling horns, SkyWing's
// sharp swept spikes, MudWing's thick blunt stubs, SandWing's straighter
// forward-angled pair, SeaWing's minimal fin-like nub, RainWing's small
// nubs. Each horn is a base cone plus an optional angled tip cone (as a
// child pivot, so the tip inherits the base's sweep) for tribes whose
// horns visibly curl or kink partway up.
const HORN_SPECS = {
  skywing:  { baseAngle: -0.3, baseLen: 0.4,  baseRadius: 0.07, tipAngle: -0.5, tipLen: 0.22, tipRadius: 0.025, sweepOut: 0.32 },
  icewing:  { baseAngle: -0.1, baseLen: 0.36, baseRadius: 0.06, tipAngle: -0.95, tipLen: 0.36, tipRadius: 0.02, sweepOut: 0.42 },
  sandwing: { baseAngle: 0.4,  baseLen: 0.32, baseRadius: 0.07, tipAngle: 0, tipLen: 0, tipRadius: 0, sweepOut: 0.26 },
  seawing:  { baseAngle: 0,    baseLen: 0.16, baseRadius: 0.09, tipAngle: 0, tipLen: 0, tipRadius: 0, sweepOut: 0.15 },
  mudwing:  { baseAngle: 0.12, baseLen: 0.3,  baseRadius: 0.12, tipAngle: 0, tipLen: 0, tipRadius: 0, sweepOut: 0.3 },
  rainwing: { baseAngle: 0,    baseLen: 0.16, baseRadius: 0.05, tipAngle: 0, tipLen: 0, tipRadius: 0, sweepOut: 0.2 },
}

function makeHorn(spec, material) {
  const group = new THREE.Group()
  group.rotation.x = spec.baseAngle
  const base = new THREE.Mesh(new THREE.ConeGeometry(spec.baseRadius, spec.baseLen, 6), material)
  base.position.y = spec.baseLen / 2
  group.add(base)
  if (spec.tipLen > 0) {
    const tipPivot = new THREE.Group()
    tipPivot.position.y = spec.baseLen
    tipPivot.rotation.x = spec.tipAngle
    const tip = new THREE.Mesh(new THREE.ConeGeometry(spec.tipRadius, spec.tipLen, 6), material)
    tip.position.y = spec.tipLen / 2
    tipPivot.add(tip)
    group.add(tipPivot)
  }
  return group
}

// SeaWings glow along their sides in canon — a row of small bioluminescent
// dots down each flank stands in for that without needing real textures.
function addGlowStripes(g, accentColor) {
  const glowMat = new THREE.MeshBasicMaterial({ color: accentColor })
  const glowGeo = new THREE.SphereGeometry(0.05, 6, 4)
  for (let i = 0; i < 5; i++) {
    ;[-1, 1].forEach(side => {
      const dot = new THREE.Mesh(glowGeo, glowMat)
      dot.position.set(side * 0.52, -0.05, -0.6 + i * 0.5)
      g.add(dot)
    })
  }
}

const _shimmerHsl = { h: 0, s: 0, l: 0 }
// RainWings' scales shift color in canon; slowly cycling hue on the body
// while out of camouflage approximates that without a shader.
function rainwingShimmer(baseColorHex, t) {
  const c = new THREE.Color(baseColorHex)
  c.getHSL(_shimmerHsl)
  c.setHSL((_shimmerHsl.h + t * 0.05) % 1, Math.min(1, _shimmerHsl.s + 0.15), _shimmerHsl.l)
  return c.getHex()
}

// The body's cross-section radius varies along its length instead of being
// one uniform stretched sphere: it narrows into the neck at the front
// (zt near -1), bulges through the ribcage, pinches at the waist, bulges
// again at the haunches, then narrows into the tail base (zt near +1).
function bodyProfile(zt) {
  const neckTaper = 0.4 + 0.6 * smoothstep(-1, -0.5, zt)
  const chestBulge = 1 + 0.14 * gaussianBump(zt, -0.15, 0.22)
  const waistPinch = 1 - 0.28 * gaussianBump(zt, 0.4, 0.13)
  const haunchBulge = 1 + 0.18 * gaussianBump(zt, 0.7, 0.16)
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

// A two-segment articulated leg (thigh + shin, bent at a knee pivot) with
// a small foot pad and three fanned clawed toes — replacing what used to
// be a single rigid box "stub." Same nested-pivot technique as the horns:
// each joint is a child Object3D so the whole chain bends correctly, and
// only the thigh (the chunky part) gets the cartoon outline.
function makeLeg(front, bulk, side, bodyMat, clawMat) {
  const thighLen = (front ? 0.3 : 0.4) * bulk
  const thighR = (front ? 0.072 : 0.098) * bulk
  const shinLen = (front ? 0.26 : 0.32) * bulk
  const shinR = (front ? 0.048 : 0.062) * bulk
  const bend = front ? 0.95 : 1.15

  const g = new THREE.Group()
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(thighR * 0.75, thighR, thighLen, 8), bodyMat)
  thigh.position.y = -thighLen / 2
  thigh.rotation.z = side * 0.12
  g.add(thigh)
  addOutline(g, thigh, 1.1)

  const knee = new THREE.Group()
  knee.position.y = -thighLen
  knee.rotation.x = bend
  g.add(knee)

  const shin = new THREE.Mesh(new THREE.CylinderGeometry(shinR * 0.6, shinR, shinLen, 8), bodyMat)
  shin.position.y = -shinLen / 2
  knee.add(shin)

  const foot = new THREE.Group()
  foot.position.y = -shinLen
  foot.rotation.x = -bend * 0.7
  knee.add(foot)

  const pad = new THREE.Mesh(new THREE.SphereGeometry(shinR * 0.85, 7, 5), bodyMat)
  pad.scale.set(1, 0.55, 1.3)
  foot.add(pad)

  for (let i = 0; i < 3; i++) {
    const spread = (i - 1) * 0.15
    const toe = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 5), clawMat)
    toe.rotation.x = Math.PI * 0.42
    toe.position.set(spread, -0.03, -0.13)
    foot.add(toe)
  }

  return g
}

// A curved, tapering multi-segment tail with small dorsal spikes running
// down it, instead of one straight cone — built the same chained-cursor
// way as the horns: each segment is a child of the previous one's end
// pivot, so a small alternating rotation per segment produces a gentle
// S-curve for free rather than needing per-vertex bending.
function buildTail(parent, bodyMat, accentMat, bulk, tribeKey) {
  const segCount = 6
  const baseR = 0.14 * bulk, tipR = 0.02
  const segLen = 0.4
  let cursor = new THREE.Object3D()
  cursor.position.set(0, -0.04, 1.0)
  parent.add(cursor)
  const bodyMeshes = []
  for (let i = 0; i < segCount; i++) {
    const t0 = i / segCount
    const r0 = THREE.MathUtils.lerp(baseR, tipR, t0)
    const r1 = THREE.MathUtils.lerp(baseR, tipR, (i + 1) / segCount)
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen, 8), bodyMat)
    seg.rotation.x = Math.PI / 2
    seg.position.z = segLen / 2
    cursor.add(seg)
    bodyMeshes.push(seg)
    if (i === 0) addOutline(cursor, seg, 1.08)

    if (i < segCount - 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07 * (1 - t0 * 0.5), 0.24 * (1 - t0 * 0.4), 4), accentMat)
      spike.position.set(0, r0 * 0.88, segLen * 0.55)
      cursor.add(spike)
    }

    const next = new THREE.Object3D()
    next.position.z = segLen
    next.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.1
    next.rotation.y = (i % 2 === 0 ? -1 : 1) * 0.045
    cursor.add(next)
    cursor = next
  }

  if (tribeKey === 'sandwing') {
    const barb = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 6), accentMat)
    barb.rotation.x = Math.PI / 2
    barb.position.z = 0.18
    cursor.add(barb)
  } else {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(tipR * 1.4, 0.18, 6), accentMat)
    tip.rotation.x = Math.PI / 2
    tip.position.z = 0.09
    cursor.add(tip)
  }

  return bodyMeshes
}

// A gently curved 2-segment neck (instead of one straight pipe) with the
// entire head assembly — skull, snout, jaw, teeth, brow ridges, nostrils,
// horns, eyes — hung off its far end as one local group, so the head
// automatically inherits the neck's upward curve instead of needing its
// own hand-tuned world-space offsets. Internal head-part offsets below
// are all relative to the skull sphere's own center (headGroup's origin).
function buildNeckAndHead(parent, tribeKey, bodyMat, accentMat, clawMat, eyeMat, bulk) {
  const segCount = 3
  const baseR = 0.21 * bulk, tipR = 0.11
  const segLen = 0.4
  let cursor = new THREE.Object3D()
  cursor.position.set(0, 0.06, -0.85)
  cursor.rotation.x = -0.08
  parent.add(cursor)
  const bodyMeshes = []
  for (let i = 0; i < segCount; i++) {
    const r0 = THREE.MathUtils.lerp(baseR, tipR, i / segCount)
    const r1 = THREE.MathUtils.lerp(baseR, tipR, (i + 1) / segCount)
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen, 10), bodyMat)
    seg.rotation.x = -Math.PI / 2
    seg.position.z = -segLen / 2
    cursor.add(seg)
    bodyMeshes.push(seg)
    if (i === 0) addOutline(cursor, seg, 1.08)

    const next = new THREE.Object3D()
    next.position.z = -segLen
    next.rotation.x = -0.13
    cursor.add(next)
    cursor = next
  }

  // The whole head assembly is authored below at its original, larger
  // scale (so all the relative offsets among snout/jaw/teeth/horns/eyes
  // stay easy to reason about) and then shrunk uniformly to fit the now
  // much slimmer neck — much less error-prone than rescaling every
  // child's position and size by hand.
  const headGroup = new THREE.Group()
  headGroup.position.set(0, 0.05, -0.14)
  headGroup.scale.setScalar(0.72)
  cursor.add(headGroup)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bodyMat)
  head.scale.set(0.7, 0.56, 1.28)
  headGroup.add(head)
  addOutline(headGroup, head)
  bodyMeshes.push(head)

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.68, 8), bodyMat)
  snout.rotation.x = -Math.PI / 2
  snout.position.set(0, -0.13, -0.5)
  headGroup.add(snout)
  bodyMeshes.push(snout)

  // Lower jaw — a slightly smaller, offset-down snout half, giving the
  // head an actual mouth line instead of one solid wedge.
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.5, 8), bodyMat)
  jaw.rotation.x = -Math.PI / 2
  jaw.position.set(0, -0.27, -0.4)
  headGroup.add(jaw)
  bodyMeshes.push(jaw)

  // Teeth peeking from the jawline.
  const toothGeo = new THREE.ConeGeometry(0.025, 0.09, 4)
  const toothMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc })
  ;[-0.09, -0.03, 0.03, 0.09].forEach(x => {
    const tooth = new THREE.Mesh(toothGeo, toothMat)
    tooth.rotation.x = Math.PI
    tooth.position.set(x, -0.18, -0.6)
    headGroup.add(tooth)
  })

  // Brow ridges above the eyes and small nostril bumps near the snout tip.
  ;[-1, 1].forEach(side => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), accentMat)
    brow.position.set(side * 0.27, 0.19, -0.32)
    brow.rotation.z = side * -0.15
    headGroup.add(brow)

    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), clawMat)
    nostril.position.set(side * 0.09, -0.08, -0.82)
    headGroup.add(nostril)
  })

  const hornSpec = HORN_SPECS[tribeKey] ?? HORN_SPECS.sandwing
  ;[-1, 1].forEach(side => {
    const horn = makeHorn(hornSpec, accentMat)
    horn.position.set(side * 0.22, 0.37, 0.2)
    horn.rotation.z = side * hornSpec.sweepOut
    headGroup.add(horn)
  })

  const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6)
  ;[-1, 1].forEach(side => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(side * 0.3, 0.1, -0.3)
    headGroup.add(eye)
  })

  return { bodyMeshes }
}

function makeDragonModel(tribeKey) {
  const tribe = getTribe(tribeKey)
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshToonMaterial({ color: tribe.color, gradientMap: toonGradient })
  const accentMat = new THREE.MeshToonMaterial({ color: tribe.accent, gradientMap: toonGradient })
  const bellyColor = new THREE.Color(tribe.color).lerp(new THREE.Color(0xffffff), 0.55)
  const bellyMat = new THREE.MeshToonMaterial({ color: bellyColor, gradientMap: toonGradient })
  const clawMat = new THREE.MeshToonMaterial({ color: 0x262229, gradientMap: toonGradient })
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe98a })

  const bulk = tribeKey === 'mudwing' ? 1.18 : 1

  // A serpentine torso: much narrower relative to its length than a
  // simple stretched sphere reads as (that "football" cross-section is
  // what made earlier passes look fat) — long and lean, closer to a
  // snake with limbs than a barrel with wings.
  const body = new THREE.Mesh(sharedBodyGeo, bodyMat)
  body.scale.set(0.5 * bulk, 0.4 * bulk, 2.2)
  g.add(body)
  addOutline(g, body)

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), bellyMat)
  belly.scale.set(0.34 * bulk, 0.22 * bulk, 1.6)
  belly.position.set(0, -0.23, 0.1)
  g.add(belly)

  // Belly scutes — small overlapping plates along the underside.
  const scuteGeo = new THREE.BoxGeometry(0.24 * bulk, 0.06, 0.3)
  for (let i = 0; i < 5; i++) {
    const scute = new THREE.Mesh(scuteGeo, bellyMat)
    scute.position.set(0, -0.36 * bulk, -0.9 + i * 0.5)
    g.add(scute)
  }

  // Shoulder bulges where the wings root into the body.
  const shoulderGeo = new THREE.SphereGeometry(0.18, 8, 6)
  const shoulders = [-1, 1].map(side => {
    const shoulder = new THREE.Mesh(shoulderGeo, bodyMat)
    shoulder.scale.set(1, 0.85, 1.2)
    shoulder.position.set(side * 0.3 * bulk, 0.05, -0.15)
    g.add(shoulder)
    return shoulder
  })

  const { bodyMeshes: neckHeadMeshes } = buildNeckAndHead(g, tribeKey, bodyMat, accentMat, clawMat, eyeMat, bulk)

  if (tribeKey === 'seawing') addGlowStripes(g, tribe.accent)

  // Spine ridge — small spikes from behind the head to the base of the
  // tail. SeaWing gets a taller, more dramatic dorsal fin row.
  const ridgeGeo = new THREE.ConeGeometry(0.1, 0.3, 4)
  const ridgeScale = tribeKey === 'seawing' ? 1.9 : 1
  for (let i = 0; i < 6; i++) {
    const z = -1.0 + i * 0.5
    const taper = 1 - Math.abs(i - 2.5) / 4
    const fin = new THREE.Mesh(ridgeGeo, accentMat)
    fin.scale.setScalar(ridgeScale * Math.max(0.5, taper))
    fin.position.set(0, 0.36 * bulk, z)
    g.add(fin)
  }

  const tailMeshes = buildTail(g, bodyMat, accentMat, bulk, tribeKey)

  const legMounts = [
    { x: -0.26, z: -0.62, front: true }, { x: 0.26, z: -0.62, front: true },
    { x: -0.28, z: 0.6, front: false }, { x: 0.28, z: 0.6, front: false },
  ]
  legMounts.forEach(m => {
    const side = m.x < 0 ? -1 : 1
    const leg = makeLeg(m.front, bulk, side, bodyMat, clawMat)
    leg.position.set(m.x, 0.02, m.z)
    g.add(leg)
  })

  const wingMat = new THREE.MeshToonMaterial({ color: tribe.accent, gradientMap: toonGradient, side: THREE.DoubleSide, transparent: true, opacity: 0.94 })
  const strutMat = new THREE.MeshToonMaterial({ color: tribe.accent, gradientMap: toonGradient })
  const wingPivots = [-1, 1].map(side => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.19, 0.09, 0.05)
    const wingAssembly = new THREE.Group()
    wingAssembly.rotation.x = -Math.PI / 2
    wingAssembly.scale.x = side
    pivot.add(wingAssembly)
    const wing = new THREE.Mesh(sharedWingGeo, wingMat)
    wingAssembly.add(wing)
    addOutline(wingAssembly, wing, 1.12)
    WING_STRUT_POINTS.forEach(([x0, y0, x1, y1]) => wingAssembly.add(makeWingStrut(x0, y0, x1, y1, strutMat)))
    g.add(pivot)
    return pivot
  })
  g.userData.wingPivots = wingPivots
  g.userData.bodyMeshes = [body, ...shoulders, ...neckHeadMeshes, ...tailMeshes]
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
        const flashColor = d.hitFlash > 0 ? 0xffffff
          : d.tribe === 'rainwing' ? rainwingShimmer(mesh.userData.baseColor, t)
          : mesh.userData.baseColor
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
        // Wide enough to actually see the dragon's elongated profile
        // instead of staring straight down its cross-section — from very
        // close directly behind, length doesn't help the silhouette at
        // all, so a lean model still read as a round blob at camDist=9.
        const camDist = 13, camHeight = 4.6
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
