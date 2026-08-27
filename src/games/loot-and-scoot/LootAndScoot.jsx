import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './LootAndScoot.module.css'
import { MAP_HALF, GEAR, gearCost, MINIONS, minionCost, loadSave, persistSave } from './constants.js'
import {
  generateWorld, createGameState, stepGame, startMission, tryBuyGear, tryRecruitMinion,
  FENCE_POS, SHOP_POS,
} from './gameEngine.js'

// ── Loot & Scoot ─────────────────────────────────────────────────────────
// An original cartoon cat-burglar heist game: open-world 3D (Three.js),
// same mouse-look-optional / WASD-turn control scheme as this hub's other
// open-world games. Take a job from the Fence, sneak past guards to grab
// the loot without their suspicion meter maxing out, then spend the cash
// at the Shop on gear that makes the next job easier. Nobody gets hurt —
// getting caught just sends you back to the hideout to try again. Every
// character is procedural low-poly geometry (boxes, spheres, cylinders) —
// no sprites, no external art.

function makeLabel(text, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 34px "Courier New", monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.scale.set(2.6, 0.65, 1)
  sprite.renderOrder = 10
  return sprite
}

function makeFigure({ shirt, pants = 0x22222e, skin = 0xd8a878, hat, mask, bag }) {
  const g = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: shirt }))
  torso.position.y = 1.1
  g.add(torso)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: skin }))
  head.position.y = 1.75
  g.add(head)
  if (mask) {
    const maskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }))
    maskMesh.position.set(0, 1.78, 0.3)
    g.add(maskMesh)
  }
  if (hat) {
    const hatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.2, 12), new THREE.MeshStandardMaterial({ color: hat }))
    hatMesh.position.y = 2.05
    g.add(hatMesh)
  }
  const legGeo = new THREE.BoxGeometry(0.26, 0.7, 0.3)
  const legMat = new THREE.MeshStandardMaterial({ color: pants })
  const legs = [-0.18, 0.18].map(x => {
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(x, 0.35, 0)
    g.add(leg)
    return leg
  })
  const armGeo = new THREE.BoxGeometry(0.22, 0.62, 0.22)
  const armMat = new THREE.MeshStandardMaterial({ color: shirt })
  const arms = [-0.5, 0.5].map(x => {
    const arm = new THREE.Mesh(armGeo, armMat)
    arm.position.set(x, 1.1, 0)
    g.add(arm)
    return arm
  })
  if (bag) {
    const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.22), new THREE.MeshStandardMaterial({ color: 0x6b4a2a }))
    bagMesh.position.set(0, 1.1, -0.3)
    g.add(bagMesh)
  }
  g.userData.legs = legs
  g.userData.arms = arms
  return g
}

function animateWalk(figure, moving, t) {
  const { legs, arms } = figure.userData
  const swing = moving ? Math.sin(t * 9) * 0.55 : 0
  legs[0].rotation.x = swing
  legs[1].rotation.x = -swing
  arms[0].rotation.x = -swing
  arms[1].rotation.x = swing
}

function faceToward(obj, dx, dz) {
  if (Math.hypot(dx, dz) < 0.01) return
  obj.rotation.y = Math.atan2(dx, dz)
}

// Small companion critters — same procedural-primitives style as the
// figures, just tiny and quadruped-ish (or, for the raven, a little flier).
const CRITTER_COLORS = {
  cat: { body: 0x4a4a55, accent: 0x2a2a30 },
  raven: { body: 0x1c1c22, accent: 0x2a2a30 },
  raccoon: { body: 0x6b5a45, accent: 0x2a2622 },
  pup: { body: 0xc99a5c, accent: 0x8a6a3a },
}

function makeCritter(key) {
  const { body, accent } = CRITTER_COLORS[key]
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: body })
  const accentMat = new THREE.MeshStandardMaterial({ color: accent })

  if (key === 'raven') {
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), bodyMat)
    g.add(torso)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bodyMat)
    head.position.set(0, 0.1, 0.16)
    g.add(head)
    const wingGeo = new THREE.BoxGeometry(0.32, 0.03, 0.16)
    const wings = [-1, 1].map(side => {
      const wing = new THREE.Mesh(wingGeo, accentMat)
      wing.position.set(side * 0.2, 0.02, 0)
      g.add(wing)
      return wing
    })
    g.userData.wings = wings
    g.userData.baseY = 1.6
  } else {
    const body_ = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.5), bodyMat)
    body_.position.y = 0.18
    g.add(body_)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bodyMat)
    head.position.set(0, 0.24, 0.3)
    g.add(head)
    const earGeo = new THREE.ConeGeometry(0.06, 0.1, 6)
    ;[-1, 1].forEach(side => {
      const ear = new THREE.Mesh(earGeo, accentMat)
      ear.position.set(side * 0.08, 0.36, 0.32)
      g.add(ear)
    })
    const legGeo = new THREE.BoxGeometry(0.07, 0.16, 0.07)
    const legs = [[-0.12, 0.18], [0.12, 0.18], [-0.12, -0.18], [0.12, -0.18]].map(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, accentMat)
      leg.position.set(x, 0.08, z)
      g.add(leg)
      return leg
    })
    g.userData.legs = legs
    g.userData.baseY = 0
  }
  return g
}

function hexToInt(hex) { return typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex }

function buildTargetHouse(scene, building) {
  const meshes = []
  const wallMat = new THREE.MeshStandardMaterial({ color: hexToInt(building.color), roughness: 1 })
  building.walls.forEach(w => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat)
    mesh.scale.set(w.w, building.h, w.d)
    mesh.position.set(w.x, building.h / 2, w.z)
    scene.add(mesh)
    meshes.push(mesh)
  })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(building.w, 0.15, building.d), new THREE.MeshStandardMaterial({ color: 0x1a1826, roughness: 1 }))
  floor.position.set(building.x, 0.07, building.z)
  scene.add(floor)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(building.w + 0.6, 0.3, building.d + 0.6), new THREE.MeshStandardMaterial({ color: hexToInt(building.color), roughness: 1 }))
  roof.position.set(building.x, building.h + 0.15, building.z)
  scene.add(roof)
  const lamp = new THREE.PointLight(0xffd8a0, 6, 14, 2)
  lamp.position.set(building.x, building.h - 0.6, building.z)
  scene.add(lamp)
  return meshes
}

function buildHQ(scene, hq) {
  const meshes = []
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2436, roughness: 1 })
  hq.walls.forEach(w => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat)
    mesh.scale.set(w.w, hq.h, w.d)
    mesh.position.set(w.x, hq.h / 2, w.z)
    scene.add(mesh)
    meshes.push(mesh)
  })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(hq.w, 0.15, hq.d), new THREE.MeshStandardMaterial({ color: 0x1c1830, roughness: 1 }))
  floor.position.set(hq.x, 0.07, hq.z)
  scene.add(floor)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(hq.w + 0.6, 0.3, hq.d + 0.6), new THREE.MeshStandardMaterial({ color: 0x241f30, roughness: 1 }))
  roof.position.set(hq.x, hq.h + 0.15, hq.z)
  scene.add(roof)
  const fenceLamp = new THREE.PointLight(0xffb066, 5, 16, 2)
  fenceLamp.position.set(FENCE_POS.x, hq.h - 1, FENCE_POS.z)
  scene.add(fenceLamp)
  const shopLamp = new THREE.PointLight(0x7bff8a, 5, 16, 2)
  shopLamp.position.set(SHOP_POS.x, hq.h - 1, SHOP_POS.z)
  scene.add(shopLamp)
  const sign = makeLabel('HIDEOUT', '#ffd700')
  sign.position.set(hq.x, hq.h - 0.5, hq.z + hq.d / 2 - 0.2)
  scene.add(sign)
  return meshes
}

// The boss tower is solid (not a hollow room) — a switchback fire escape
// bolted to one face leads up to a rooftop deck.
function buildBossTower(scene, tower) {
  const meshes = []
  const body = new THREE.Mesh(new THREE.BoxGeometry(tower.w, tower.h, tower.d), new THREE.MeshStandardMaterial({ color: hexToInt(tower.color), roughness: 1 }))
  body.position.set(tower.x, tower.h / 2, tower.z)
  scene.add(body)
  meshes.push(body)

  const winMat = new THREE.MeshBasicMaterial({ color: 0xff8f6a })
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), winMat)
    const side = i % 2 === 0 ? 1 : -1
    win.position.set(tower.x + side * (tower.w / 2 + 0.01), 1 + (i / 8) * (tower.h - 1), tower.z + (Math.random() - 0.5) * (tower.d - 1))
    win.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
    scene.add(win)
  }

  const stepMat = new THREE.MeshStandardMaterial({ color: 0x5a5a68, roughness: 1 })
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a34 })
  const roof = tower.platforms[tower.platforms.length - 1]
  tower.platforms.slice(0, -1).forEach(p => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.2, p.d), stepMat)
    deck.position.set(p.x, p.y, p.z)
    scene.add(deck)
    meshes.push(deck)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, p.y, 6), poleMat)
    pole.position.set(p.x - p.w / 2 + 0.1, p.y / 2, p.z - p.d / 2 + 0.1)
    scene.add(pole)
  })
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(roof.w, 0.3, roof.d), new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 1 }))
  roofDeck.position.set(roof.x, roof.y, roof.z)
  scene.add(roofDeck)
  meshes.push(roofDeck)

  const lamp = new THREE.PointLight(0xff8f6a, 8, 22, 2)
  lamp.position.set(tower.x, tower.h + 3, tower.z)
  scene.add(lamp)

  return meshes
}

function buildWorldScene(world) {
  const { buildings, targets, hq } = world
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0c0e22)
  scene.fog = new THREE.Fog(0x0c0e22, 20, 95)

  scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x14121c, 0.9))
  const moon = new THREE.DirectionalLight(0xcfd8ff, 0.85)
  moon.position.set(-20, 30, -10)
  scene.add(moon)
  const moonBall = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf2f0e0 }))
  moonBall.position.set(-70, 55, -90)
  scene.add(moonBall)

  const full = MAP_HALF * 2 + 20
  const ground = new THREE.Mesh(new THREE.BoxGeometry(full, 0.4, full), new THREE.MeshStandardMaterial({ color: 0x23222e, roughness: 1 }))
  ground.position.y = -0.2
  scene.add(ground)

  // Faint street grid for visual scale/orientation.
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x35354a })
  for (let i = -MAP_HALF; i <= MAP_HALF; i += 12) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(full, 0.02, 0.35), gridMat)
    a.position.set(0, 0.01, i)
    scene.add(a)
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, full), gridMat)
    b.position.set(i, 0.01, 0)
    scene.add(b)
  }

  const buildingGeo = new THREE.BoxGeometry(1, 1, 1)
  const buildingMeshes = buildings.map(b => {
    const mesh = new THREE.Mesh(buildingGeo, new THREE.MeshStandardMaterial({ color: hexToInt(b.color), roughness: 1 }))
    mesh.scale.set(b.w, b.h, b.d)
    mesh.position.set(b.x, b.h / 2, b.z)
    scene.add(mesh)
    // A couple of lit windows for night-time atmosphere.
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffdf8a })
    for (let i = 0; i < 2; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), winMat)
      const side = i === 0 ? 1 : -1
      win.position.set(b.x + side * (b.w / 2 + 0.01), b.h * 0.6, b.z)
      win.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
      scene.add(win)
    }
    return mesh
  })

  targets.forEach(t => buildingMeshes.push(...(t.isBoss ? buildBossTower(scene, t) : buildTargetHouse(scene, t))))
  buildingMeshes.push(...buildHQ(scene, hq))

  // Streetlights scattered for atmosphere (decorative only).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c26 })
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 })
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - 0.5) * full * 0.9
    const z = (Math.random() - 0.5) * full * 0.9
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), poleMat)
    pole.position.set(x, 1.6, z)
    scene.add(pole)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lampMat)
    lamp.position.set(x, 3.25, z)
    scene.add(lamp)
  }

  return { scene, buildingMeshes }
}

function GameCanvas({ saveRef, onHud, onDirty, shopOpenRef }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const [locked, setLocked] = useState(false)
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onDirtyRef = useRef(onDirty); onDirtyRef.current = onDirty

  useEffect(() => {
    const mount = mountRef.current
    let disposed = false
    let raf = null

    const world = generateWorld()
    const run = createGameState(world, saveRef.current)

    const camera = new THREE.PerspectiveCamera(64, mount.clientWidth / mount.clientHeight, 0.1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    let yaw = Math.PI
    let pitch = 0.35

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      yaw -= e.movementX * 0.0024
      pitch -= e.movementY * 0.0018
      pitch = Math.max(-0.05, Math.min(1.1, pitch))
    }
    document.addEventListener('mousemove', onMouseMove)

    function onClick() {
      try { renderer.domElement.requestPointerLock()?.catch?.(() => {}) } catch { /* pointer lock unavailable */ }
    }
    renderer.domElement.addEventListener('click', onClick)
    function onLockChange() { setLocked(document.pointerLockElement === renderer.domElement) }
    document.addEventListener('pointerlockchange', onLockChange)

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const { scene, buildingMeshes } = buildWorldScene(world)
    const camRaycaster = new THREE.Raycaster()

    const player = makeFigure({ shirt: 0x2a2a44, mask: true, bag: true })
    scene.add(player)

    const fenceFigure = makeFigure({ shirt: 0x4a2a5c, hat: 0x2a1a34 })
    fenceFigure.position.set(FENCE_POS.x, 0, FENCE_POS.z)
    scene.add(fenceFigure)
    const fenceLabel = makeLabel('FENCE', '#ffb066')
    fenceLabel.position.set(FENCE_POS.x, 2.6, FENCE_POS.z)
    scene.add(fenceLabel)

    const shopFigure = makeFigure({ shirt: 0xc9821f, hat: 0x5c3a10 })
    shopFigure.position.set(SHOP_POS.x, 0, SHOP_POS.z)
    scene.add(shopFigure)
    const shopLabel = makeLabel('SHOP', '#7bff8a')
    shopLabel.position.set(SHOP_POS.x, 2.6, SHOP_POS.z)
    scene.add(shopLabel)

    const guardPool = Array.from({ length: 3 }, () => {
      const g = makeFigure({ shirt: 0x2a3a6a, hat: 0x1a2a4a })
      g.visible = false
      scene.add(g)
      return g
    })

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.6, 40, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    )
    beacon.visible = false
    scene.add(beacon)

    const lootMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xaa7700, emissiveIntensity: 0.6 }))
    lootMesh.visible = false
    scene.add(lootMesh)

    // The boss — a bigger, meaner figure that stands its ground on the
    // roof. The ring under it glows during its telegraphed windup so a
    // swipe is always dodgeable if you back off in time.
    const bossFigure = makeFigure({ shirt: 0x6a1a1a, pants: 0x1a0a0a, hat: 0x2a0a0a })
    bossFigure.scale.set(1.9, 1.9, 1.9)
    bossFigure.visible = false
    scene.add(bossFigure)
    const bossWindupRing = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.3, 24), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0, side: THREE.DoubleSide }))
    bossWindupRing.rotation.x = -Math.PI / 2
    bossWindupRing.visible = false
    scene.add(bossWindupRing)

    const suspicionRings = guardPool.map(() => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 20), new THREE.MeshBasicMaterial({ color: 0xff5d3d, transparent: true, opacity: 0, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      scene.add(ring)
      return ring
    })

    // Owned pets/minions trail behind the player, one slot each, in the
    // order they were recruited. Always built (hidden until owned) so
    // recruiting one mid-run doesn't need a scene rebuild.
    const critterMeshes = {}
    const critterPos = {}
    MINIONS.forEach((m, i) => {
      const mesh = makeCritter(m.key)
      mesh.visible = false
      scene.add(mesh)
      critterMeshes[m.key] = mesh
      critterPos[m.key] = { x: FENCE_POS.x - i, z: FENCE_POS.z, slot: i }
    })

    const clock = new THREE.Clock()
    const TURN_SPEED = 2.6

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const k = keysRef.current
      const t = clock.elapsedTime

      if (k.has('KeyA') || k.has('ArrowLeft')) yaw += TURN_SPEED * dt
      if (k.has('KeyD') || k.has('ArrowRight')) yaw -= TURN_SPEED * dt

      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      let moveX = 0, moveZ = 0
      const paused = shopOpenRef.current
      if (!paused) {
        if (k.has('KeyW') || k.has('ArrowUp')) { moveX += fx; moveZ += fz }
        if (k.has('KeyS') || k.has('ArrowDown')) { moveX -= fx; moveZ -= fz }
      }
      const input = {
        moveX, moveZ,
        jump: !paused && k.has('Space'),
        crouch: !paused && (k.has('KeyC') || k.has('ShiftLeft') || k.has('ShiftRight')),
        interact: !paused && k.has('KeyE'),
        attack: !paused && k.has('KeyF'),
      }

      if (!paused) stepGame(run, input, dt)

      const moving = Math.hypot(moveX, moveZ) > 0.01
      player.position.set(run.x, run.y, run.z)
      if (moving) faceToward(player, moveX, moveZ)
      animateWalk(player, moving, t)

      run.guards.forEach((g, i) => {
        const mesh = guardPool[i]
        mesh.visible = true
        const prevX = mesh.position.x, prevZ = mesh.position.z
        mesh.position.set(g.x, 0, g.z)
        faceToward(mesh, g.x - prevX, g.z - prevZ)
        animateWalk(mesh, true, t + i)
        mesh.children.forEach(c => { if (c.isMesh) c.material.color.setHex(g.state === 'chase' ? 0xff5d3d : 0x2a3a6a) })
        const ring = suspicionRings[i]
        ring.position.set(g.x, 0.05, g.z)
        ring.material.opacity = g.state === 'chase' ? 0 : g.suspicion * 0.8
      })
      for (let i = run.guards.length; i < guardPool.length; i++) {
        guardPool[i].visible = false
        suspicionRings[i].material.opacity = 0
      }

      // Owned pets trail behind the player, fanned out by slot; the cat
      // breaks formation to dart at whoever it's currently distracting.
      const rightX = -fz, rightZ = fx
      MINIONS.forEach(m => {
        const mesh = critterMeshes[m.key]
        const owned = run.minions.includes(m.key)
        mesh.visible = owned
        if (!owned) return
        const pos = critterPos[m.key]
        const dashing = m.key === 'cat' && run.catPulse
        const behind = 1.4 + pos.slot * 0.7
        const side = (pos.slot % 2 === 0 ? 1 : -1) * 0.5
        const targetX = dashing ? run.catPulse.x : run.x - fx * behind + rightX * side
        const targetZ = dashing ? run.catPulse.z : run.z - fz * behind + rightZ * side
        const followRate = dashing ? 10 : 5
        const dx = targetX - pos.x, dz = targetZ - pos.z
        pos.x += dx * Math.min(1, dt * followRate)
        pos.z += dz * Math.min(1, dt * followRate)
        const bob = m.key === 'raven' ? 1.5 + Math.sin(t * 2.5 + pos.slot) * 0.15 : 0.02 + Math.abs(Math.sin(t * 6 + pos.slot)) * 0.04
        mesh.position.set(pos.x, bob, pos.z)
        faceToward(mesh, dx, dz)
        if (m.key === 'raven') mesh.userData.wings.forEach((w, wi) => { w.rotation.z = Math.sin(t * 12 + wi * Math.PI) * 0.5 })
      })

      if (run.boss && !run.boss.defeated) {
        bossFigure.visible = true
        bossFigure.position.set(run.boss.x, run.boss.roofY, run.boss.z)
        bossFigure.children.forEach(c => { if (c.isMesh) c.material.color.setHex(run.boss.mode === 'windup' ? 0xff3b3b : 0x6a1a1a) })
        bossWindupRing.visible = run.boss.mode === 'windup'
        bossWindupRing.position.set(run.boss.x, run.boss.roofY + 0.05, run.boss.z)
        bossWindupRing.material.opacity = run.boss.mode === 'windup' ? 0.5 + Math.sin(t * 20) * 0.3 : 0
      } else {
        bossFigure.visible = false
        bossWindupRing.visible = false
      }

      if (run.mission && run.lootPos && run.lootReady) {
        beacon.visible = true
        beacon.position.set(run.lootPos.x, 20, run.lootPos.z)
        beacon.material.opacity = 0.14 + Math.sin(t * 4) * 0.06
        lootMesh.visible = true
        lootMesh.position.set(run.lootPos.x, run.lootY + 1.1 + Math.sin(t * 3) * 0.1, run.lootPos.z)
        lootMesh.rotation.y += dt * 2
      } else if (run.mission && run.boss && !run.boss.defeated) {
        // Still fighting — no loot marker yet, but keep the beacon lit on
        // the tower so it's findable from a distance.
        beacon.visible = true
        beacon.position.set(run.lootPos.x, 20, run.lootPos.z)
        beacon.material.opacity = 0.14 + Math.sin(t * 4) * 0.06
        lootMesh.visible = false
      } else {
        beacon.visible = false
        lootMesh.visible = false
      }

      // Third-person orbit camera with anti-clip raycast (see dog-man-dash
      // for the sibling implementation this is copied from).
      const pivot = new THREE.Vector3(run.x, run.y + 1.3, run.z)
      const dir = new THREE.Vector3(-fx * Math.cos(pitch), Math.sin(pitch), -fz * Math.cos(pitch)).normalize()
      let camDist = 7.2
      camRaycaster.set(pivot, dir)
      camRaycaster.far = camDist
      const hit = camRaycaster.intersectObjects(buildingMeshes, false)[0]
      if (hit) camDist = Math.max(1.8, hit.distance - 0.3)
      camera.position.copy(pivot).addScaledVector(dir, camDist)
      camera.lookAt(pivot)

      renderer.render(scene, camera)

      // Compass bearing to the current point of interest, relative to
      // camera yaw (0 = dead ahead, +90 = to the right).
      let compassTarget = null
      if (run.mission && run.lootPos) compassTarget = run.lootPos
      else if (!run.mission) compassTarget = { x: FENCE_POS.x, z: FENCE_POS.z }
      let compassDeg = null
      if (compassTarget) {
        const dx = compassTarget.x - run.x, dz = compassTarget.z - run.z
        const worldAngle = Math.atan2(-dx, -dz)
        let rel = worldAngle - yaw
        rel = Math.atan2(Math.sin(rel), Math.cos(rel))
        // Negated: this hub's turn convention has KeyA/← increase yaw (turn
        // left) and KeyD/→ decrease it (turn right) — verified empirically
        // — so a positive `rel` means "turn left is correct", i.e. the
        // target is to the left. Flip the sign so +compassDeg reliably
        // means "to the right" for the CSS rotate() below.
        compassDeg = -rel * 180 / Math.PI
      }

      const nearBossFight = !!(run.boss && !run.boss.defeated && run.y > run.boss.roofY - 3 && Math.hypot(run.x - run.boss.x, run.z - run.boss.z) < 4)
      onHudRef.current({
        cash: run.cash,
        mission: run.mission ? { name: run.mission.name, timeLeft: run.mission.timeLeft, totalTime: run.mission.totalTime, alerted: run.mission.alerted, isBoss: run.mission.isBoss } : null,
        nearFence: run.nearFence, nearShop: run.nearShop,
        toast: run.toast, compassDeg,
        suspicion: Math.max(0, ...run.guards.filter(g => g.state !== 'chase').map(g => g.suspicion), 0),
        minions: run.minions,
        boss: run.boss ? { hp: run.boss.hp, maxHp: run.boss.maxHp, defeated: run.boss.defeated } : null,
        nearBossFight,
      })

      if (run.dirty) {
        persistSave({ cash: run.cash, gear: run.gear, minions: run.minions, jobsDone: saveRef.current.jobsDone })
        saveRef.current = { ...saveRef.current, cash: run.cash, gear: run.gear, minions: run.minions }
        run.dirty = false
        onDirtyRef.current(saveRef.current)
      }

      // Let the shop UI (React) trigger purchases through this ref.
      shopOpenRef.buy = (key, cost, nextTier) => tryBuyGear(run, key, cost, nextTier)
      shopOpenRef.recruit = (key, cost) => tryRecruitMinion(run, key, cost)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      renderer.domElement.removeEventListener('click', onClick)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={mountRef} className={styles.canvasWrap}>
      {!locked && <div className={styles.lockHint}>Click for mouse-look (optional) — WASD/arrows work either way</div>}
    </div>
  )
}

function ShopPanel({ save, onBuy, onRecruit, onClose }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>🛒 The Shop</h2>
        <p className={styles.cashLine}>Cash: ${save.cash}</p>
        <div className={styles.gearGrid}>
          {GEAR.map(g => {
            const tier = save.gear[g.key]
            const maxed = tier >= g.tiers.length - 1
            const cost = maxed ? null : gearCost(g.key, tier + 1)
            const canAfford = cost !== null && save.cash >= cost
            return (
              <div key={g.key} className={styles.gearCard}>
                <span className={styles.gearIcon}>{g.icon}</span>
                <span className={styles.gearName}>{g.name}</span>
                <span className={styles.gearDesc}>{g.desc}</span>
                <div className={styles.tierDots}>
                  {g.tiers.slice(1).map((_, i) => (
                    <span key={i} className={`${styles.dot} ${i < tier ? styles.dotFilled : ''}`} />
                  ))}
                </div>
                {maxed ? (
                  <span className={styles.maxedLabel}>MAX</span>
                ) : (
                  <button className={styles.buyBtn} disabled={!canAfford} onClick={() => onBuy(g.key, cost, tier + 1)}>
                    Buy — ${cost}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <h3 className={styles.modalSubtitle}>🐾 Recruit a Minion</h3>
        <div className={styles.gearGrid}>
          {MINIONS.map(m => {
            const owned = save.minions.includes(m.key)
            const cost = minionCost(m.key)
            const canAfford = save.cash >= cost
            return (
              <div key={m.key} className={styles.gearCard}>
                <span className={styles.gearIcon}>{m.icon}</span>
                <span className={styles.gearName}>{m.name}</span>
                <span className={styles.gearDesc}>{m.desc}</span>
                {owned ? (
                  <span className={styles.maxedLabel}>RECRUITED</span>
                ) : (
                  <button className={styles.buyBtn} disabled={!canAfford} onClick={() => onRecruit(m.key, cost)}>
                    Recruit — ${cost}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button className={styles.closeBtn} onClick={onClose}>Close (E)</button>
      </div>
    </div>
  )
}

function Hud({ hud, shopOpen }) {
  if (!hud) return null
  return (
    <div className={styles.hud}>
      <div className={styles.hudTop}>
        <span className={styles.cash}>💰 ${hud.cash}</span>
        {hud.mission && (
          <span className={styles.missionInfo}>
            🎯 {hud.mission.name} {hud.mission.alerted && <span className={styles.alertTag}>ALERTED</span>}
          </span>
        )}
      </div>
      {hud.minions?.length > 0 && (
        <div className={styles.petRow}>
          {hud.minions.map(key => <span key={key}>{MINIONS.find(m => m.key === key)?.icon}</span>)}
        </div>
      )}
      {hud.mission && (
        <div className={styles.timeTrack}>
          <div className={styles.timeFill} style={{ width: `${Math.max(0, Math.min(100, (hud.mission.timeLeft / hud.mission.totalTime) * 100))}%` }} />
        </div>
      )}
      {hud.suspicion > 0 && (
        <div className={styles.suspicionWrap}>
          <span className={styles.suspicionLabel}>👀 Suspicion</span>
          <div className={styles.suspicionTrack}><div className={styles.suspicionFill} style={{ width: `${hud.suspicion * 100}%` }} /></div>
        </div>
      )}
      {hud.boss && !hud.boss.defeated && (
        <div className={styles.suspicionWrap}>
          <span className={styles.suspicionLabel}>👹 Boss HP</span>
          <div className={styles.bossTrack}><div className={styles.bossFill} style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} /></div>
        </div>
      )}
      {hud.compassDeg !== null && !shopOpen && (
        <div className={styles.compass}>
          <span className={styles.compassArrow} style={{ transform: `rotate(${hud.compassDeg}deg)` }}>▲</span>
        </div>
      )}
      {hud.toast && <div className={`${styles.toast} ${hud.toast.kind === 'bad' ? styles.toastBad : hud.toast.kind === 'good' ? styles.toastGood : ''}`}>{hud.toast.text}</div>}
      {!shopOpen && hud.nearFence && !hud.mission && <div className={styles.prompt}>Press E to get a job from the Fence</div>}
      {!shopOpen && hud.nearFence && hud.mission && <div className={styles.prompt}>You're already on a job — go grab that loot!</div>}
      {!shopOpen && hud.nearShop && <div className={styles.prompt}>Press E to open the Shop</div>}
      {!shopOpen && hud.nearBossFight && <div className={styles.prompt}>Press F to attack — back away when the boss glows red!</div>}
    </div>
  )
}

export default function LootAndScoot() {
  const [screen, setScreen] = useState('intro')
  const [hud, setHud] = useState(null)
  const [shopOpen, setShopOpen] = useState(false)
  const [save, setSave] = useState(() => loadSave())
  const saveRef = useRef(save)
  const shopOpenRef = useRef(false)
  shopOpenRef.current = shopOpen

  useEffect(() => {
    if (screen !== 'playing') return
    function onKeyDown(e) {
      if (e.code !== 'KeyE') return
      if (shopOpenRef.current) { setShopOpen(false); return }
      if (hud?.nearShop) setShopOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, hud?.nearShop])

  function start() { setScreen('playing') }

  function handleDirty(nextSave) { setSave(nextSave) }

  function handleBuy(key, cost, nextTier) {
    if (shopOpenRef.buy?.(key, cost, nextTier)) {
      // saveRef/save get updated on the next tick's dirty-flush; nudge
      // local state immediately too so the shop UI feels responsive.
      setSave(s => ({ ...s, cash: s.cash - cost, gear: { ...s.gear, [key]: nextTier } }))
    }
  }

  function handleRecruit(key, cost) {
    if (shopOpenRef.recruit?.(key, cost)) {
      setSave(s => (s.minions.includes(key) ? s : { ...s, cash: s.cash - cost, minions: [...s.minions, key] }))
    }
  }

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🥷 Loot <span className={styles.and}>&amp;</span> Scoot</h1>
          <p className={styles.blurb}>
            Take jobs from the Fence, sneak past guards to grab the loot before their suspicion
            maxes out, then spend your cash at the Shop on gear that makes the next job easier.
            Nobody gets hurt — getting spotted just means a chase, and getting caught just sends
            you back to the hideout to try again. Every so often the job is a tower — scale the
            fire escape on the outside and take down whoever's guarding the roof.
          </p>
          <p className={styles.blurb}>W/S move · A/D turn · Space jump · C or Shift crouch (sneak) · E interact · F attack (bosses only)</p>
          <button className={styles.bigBtn} onClick={start}>▶ Start Scootin'</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <GameCanvas saveRef={saveRef} onHud={setHud} onDirty={handleDirty} shopOpenRef={shopOpenRef} />
          <Hud hud={hud} shopOpen={shopOpen} />
          {shopOpen && <ShopPanel save={save} onBuy={handleBuy} onRecruit={handleRecruit} onClose={() => setShopOpen(false)} />}
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}
    </div>
  )
}
