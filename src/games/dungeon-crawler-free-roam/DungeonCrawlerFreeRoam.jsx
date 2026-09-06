import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './DungeonCrawlerFreeRoam.module.css'
import {
  mkInitialState, update, markContestant, boundsCenterXZ,
} from './gameEngine.js'
import {
  WORLD_HALF, TILE, WALL_HEIGHT, MOUSE_SENSITIVITY, CAMERA_DIST,
  BUILDING_RADIUS, BUILDING_W, BUILDING_D, BUILDING_H,
} from './constants.js'

// ── Dungeon Crawler Max: Free Roam ──────────────────────────────────────
// Same kid-safe "game show dungeon" universe as Dungeon Crawler Max, now
// one 3D open world with real buildings scattered around it. Walking up
// to a building's door teleports you into that dungeon's own interior
// map (rooms, corridors, monsters, boss); reaching the exit disc inside
// teleports you back out to the door you entered from. Follows this
// hub's existing 3D-open-world convention (loot-and-scoot, dog-man-dash,
// gravity-falls): engine/component split, tank-turn keyboard controls
// with optional pointer-lock mouse-look, third-person chase camera with
// an anti-clip raycast, AABB/circle collision against plain data. Player,
// pet, monsters, boss, chests are canvas-emoji billboard sprites — reuses
// the 2D game's visual language instead of needing 3D character models.

const MAX_PARTICLES = 300

// ── Emoji sprite factory (texture cached by emoji, material per-instance
// so effects like the player's invuln flicker never leak across movers) ─
const emojiTextureCache = new Map()
function getEmojiTexture(emoji) {
  let tex = emojiTextureCache.get(emoji)
  if (tex) return tex
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.font = `${size * 0.82}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.05)
  tex = new THREE.CanvasTexture(canvas)
  emojiTextureCache.set(emoji, tex)
  return tex
}
function makeEmojiSprite(emoji) {
  const mat = new THREE.SpriteMaterial({ map: getEmojiTexture(emoji), transparent: true, depthWrite: false })
  return new THREE.Sprite(mat)
}
function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas')
  const measureCtx = canvas.getContext('2d')
  measureCtx.font = 'bold 40px sans-serif'
  const w = Math.ceil(measureCtx.measureText(text).width) + 40
  canvas.width = w; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, w, 64)
  ctx.fillStyle = color || '#ffffff'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, 34)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.renderOrder = 10
  sprite.scale.set((w / 64) * 1.15, 1.15, 1)
  return sprite
}

const sharedShadowGeom = new THREE.CircleGeometry(0.6, 16)
sharedShadowGeom.rotateX(-Math.PI / 2)
const sharedShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })

function makeMover(emoji, worldScale) {
  const group = new THREE.Group()
  const shadow = new THREE.Mesh(sharedShadowGeom, sharedShadowMat)
  shadow.position.y = 0.02
  shadow.scale.setScalar(worldScale * 0.6)
  group.add(shadow)
  const sprite = makeEmojiSprite(emoji)
  sprite.scale.set(worldScale, worldScale, 1)
  sprite.position.y = worldScale / 2 + 0.05
  group.add(sprite)
  group.userData.sprite = sprite
  return group
}

function makeGrassTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#3a6b35'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = `rgba(${20 + Math.random() * 40},${70 + Math.random() * 55},${20 + Math.random() * 30},0.5)`
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(WORLD_HALF / 5, WORLD_HALF / 5)
  return tex
}

function hexToRgb01(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}
function darkenHex(hex, factor) {
  const [r, g, b] = hexToRgb01(hex)
  return new THREE.Color(r * factor, g * factor, b * factor)
}

function makeDecoration() {
  const kind = Math.random() < 0.5 ? 'rock' : 'tree'
  const group = new THREE.Group()
  if (kind === 'rock') {
    const geo = new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.8, 0)
    const mat = new THREE.MeshLambertMaterial({ color: 0x777268 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = 0.4
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    group.add(mesh)
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x5c4430 }))
    trunk.position.y = 1.1
    group.add(trunk)
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 6), new THREE.MeshLambertMaterial({ color: 0x3d6b34 }))
    foliage.position.y = 2.5
    group.add(foliage)
  }
  return group
}

function buildBuildingExterior(site) {
  const grp = new THREE.Group()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_W, BUILDING_H, BUILDING_D),
    new THREE.MeshLambertMaterial({ color: site.theme.wallColor }),
  )
  box.position.set(site.centerX, BUILDING_H / 2, site.centerZ)
  grp.add(box)

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(BUILDING_RADIUS + 2, 4.2, 4),
    new THREE.MeshLambertMaterial({ color: site.theme.floorColor }),
  )
  roof.rotation.y = Math.PI / 4
  roof.position.set(site.centerX, BUILDING_H + 2.1, site.centerZ)
  grp.add(roof)

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 3.6),
    new THREE.MeshBasicMaterial({ color: site.theme.accent, side: THREE.DoubleSide }),
  )
  door.position.set(site.doorX, 1.8, site.doorZ)
  door.lookAt(site.doorX + site.doorDirX * 10, 1.8, site.doorZ + site.doorDirZ * 10)
  grp.add(door)

  const sign = makeLabelSprite(site.theme.name, site.theme.accent)
  sign.position.set(site.doorX, BUILDING_H + 0.9, site.doorZ)
  grp.add(sign)

  return { group: grp, clipMesh: box }
}

export default function DungeonCrawlerFreeRoam() {
  const [phase, setPhaseState] = useState('intro')
  const phaseRef = useRef('intro')
  const [winStats, setWinStats] = useState(null)
  const mountRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  const hpFillRef = useRef(null)
  const hpTextRef = useRef(null)
  const xpFillRef = useRef(null)
  const levelTextRef = useRef(null)
  const goldTextRef = useRef(null)
  const potionTextRef = useRef(null)
  const bannerRef = useRef(null)
  const announcerRef = useRef(null)
  const petRef = useRef(null)
  const bossBarRef = useRef(null)
  const bossFillRef = useRef(null)
  const bossNameRef = useRef(null)
  const compassRef = useRef(null)
  const compassArrowRef = useRef(null)
  const controlsHintRef = useRef(null)
  const teleportFlashRef = useRef(null)

  function setPhase(p) { phaseRef.current = p; setPhaseState(p) }

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const skyColor = 0x8fd0f0
    scene.background = new THREE.Color(skyColor)
    scene.fog = new THREE.Fog(skyColor, 140, 430)

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 550)
    camera.position.set(0, 8, 14)

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 0.85)
    sun.position.set(120, 180, 90)
    scene.add(sun)

    const overworldGroup = new THREE.Group()
    scene.add(overworldGroup)
    const dungeonGroup = new THREE.Group()
    dungeonGroup.visible = false
    scene.add(dungeonGroup)

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_HALF * 2, 1, WORLD_HALF * 2),
      new THREE.MeshLambertMaterial({ map: makeGrassTexture() }),
    )
    ground.position.y = -0.5
    overworldGroup.add(ground)

    for (let i = 0; i < 90; i++) {
      const x = (Math.random() * 2 - 1) * (WORLD_HALF - 15)
      const z = (Math.random() * 2 - 1) * (WORLD_HALF - 15)
      const deco = makeDecoration()
      deco.position.set(x, 0, z)
      overworldGroup.add(deco)
    }
    const permanentOverworldChildren = overworldGroup.children.length // ground + decorations, never torn down

    let buildingClipMeshes = []
    let interiorClipMeshes = []
    const moverMap = new Map()
    const chestMap = new Map()
    let playerGroup = null
    let petGroup = null
    let petPos = { x: 0, z: 0 }
    let currentInteriorSite = null

    const particleGeo = new THREE.BufferGeometry()
    const particlePos = new Float32Array(MAX_PARTICLES * 3)
    const particleCol = new Float32Array(MAX_PARTICLES * 3)
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3))
    const particlePoints = new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, sizeAttenuation: true }))
    scene.add(particlePoints)

    function teardownAll() {
      while (overworldGroup.children.length > permanentOverworldChildren) {
        overworldGroup.remove(overworldGroup.children[overworldGroup.children.length - 1])
      }
      while (dungeonGroup.children.length) dungeonGroup.remove(dungeonGroup.children[0])
      buildingClipMeshes = []
      interiorClipMeshes = []
      moverMap.clear()
      chestMap.clear()
      currentInteriorSite = null
      dungeonGroup.visible = false
      if (playerGroup) { scene.remove(playerGroup); playerGroup = null }
      if (petGroup) { scene.remove(petGroup); petGroup = null }
    }

    function buildWorld(state) {
      for (const site of state.sites) {
        const { group, clipMesh } = buildBuildingExterior(site)
        overworldGroup.add(group)
        buildingClipMeshes.push(clipMesh)
      }
      playerGroup = makeMover('🧒', 1.6)
      scene.add(playerGroup)
      petGroup = makeMover('🐹', 1.0)
      scene.add(petGroup)
      petPos = { x: 0, z: 2 }
    }

    function buildInterior(site) {
      const wallGeo = new THREE.BoxGeometry(TILE * 0.92, WALL_HEIGHT, TILE * 0.92)
      const wallMat = new THREE.MeshLambertMaterial({ color: site.theme.wallColor })
      const inst = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, site.wallRects.length))
      const m4 = new THREE.Matrix4()
      site.wallRects.forEach((r, i) => { m4.makeTranslation(r.x, WALL_HEIGHT / 2, r.z); inst.setMatrixAt(i, m4) })
      inst.instanceMatrix.needsUpdate = true
      inst.count = site.wallRects.length
      dungeonGroup.add(inst)
      interiorClipMeshes = [inst]

      const fb = site.floorBounds
      const w = fb.x1 - fb.x0, d = fb.z1 - fb.z0
      const cx = (fb.x0 + fb.x1) / 2, cz = (fb.z0 + fb.z1) / 2

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: site.theme.floorColor }))
      floor.rotation.x = -Math.PI / 2
      floor.position.set(cx, 0, cz)
      dungeonGroup.add(floor)

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: site.theme.wallColor }))
      ceiling.rotation.x = Math.PI / 2
      ceiling.position.set(cx, WALL_HEIGHT, cz)
      dungeonGroup.add(ceiling)

      for (const c of site.chests) {
        const grp = makeMover('🎁', 1.1)
        grp.position.set(c.x, 0, c.z)
        grp.visible = !c.opened
        dungeonGroup.add(grp)
        chestMap.set(c, grp)
      }

      const exitSign = makeLabelSprite('Exit', '#8fd3ff')
      exitSign.position.set(site.exitDisc.x, 2.4, site.exitDisc.z)
      dungeonGroup.add(exitSign)

      const torch1 = new THREE.PointLight(0xffaa55, 1.0, 26)
      torch1.position.set(site.entrance.x, WALL_HEIGHT * 0.8, site.entrance.z)
      dungeonGroup.add(torch1)
      const bc = boundsCenterXZ(site.bossRoom)
      const torch2 = new THREE.PointLight(0xffaa55, 1.0, 26)
      torch2.position.set(bc.x, WALL_HEIGHT * 0.8, bc.z)
      dungeonGroup.add(torch2)
    }

    function teardownInterior(site) {
      for (const m of site.monsters) {
        const grp = moverMap.get(m.id)
        if (grp) { grp.parent?.remove(grp); moverMap.delete(m.id) }
      }
      for (const c of site.chests) {
        const grp = chestMap.get(c)
        if (grp) { grp.parent?.remove(grp); chestMap.delete(c) }
      }
      while (dungeonGroup.children.length) dungeonGroup.remove(dungeonGroup.children[0])
      interiorClipMeshes = []
    }

    function handleTeleport(state, dir) {
      if (dir === 'in') {
        const site = state.sites[state.activeSite]
        currentInteriorSite = site
        buildInterior(site)
        dungeonGroup.visible = true
        overworldGroup.visible = false
        scene.background = darkenHex(site.theme.wallColor, 0.32)
        scene.fog = new THREE.Fog(scene.background.getHex(), 14, 80)
        ambient.intensity = 0.6
        sun.visible = false
      } else {
        if (currentInteriorSite) teardownInterior(currentInteriorSite)
        currentInteriorSite = null
        dungeonGroup.visible = false
        overworldGroup.visible = true
        scene.background = new THREE.Color(skyColor)
        scene.fog = new THREE.Fog(skyColor, 140, 430)
        ambient.intensity = 0.7
        sun.visible = true
      }
    }

    function syncMovers(state) {
      const parentGroup = state.mode === 'dungeon' ? dungeonGroup : overworldGroup
      const monsters = state.mode === 'dungeon' ? state.sites[state.activeSite].monsters : state.overworldMobs
      const seen = new Set()
      for (const m of monsters) {
        seen.add(m.id)
        let grp = moverMap.get(m.id)
        if (!grp) {
          grp = makeMover(m.emoji, m.isBoss ? 3.0 : 1.3)
          if (m.isBoss) {
            const label = makeLabelSprite(m.name, '#ffffff')
            label.position.y = 3.6
            grp.add(label)
          }
          parentGroup.add(grp)
          moverMap.set(m.id, grp)
        }
        grp.position.set(m.x, 0, m.z)
        grp.visible = !m.dead
        if (m.hp < m.maxHp && !m.isBoss) {
          grp.userData.sprite.material.color.setRGB(1, 0.7, 0.7)
        } else {
          grp.userData.sprite.material.color.setRGB(1, 1, 1)
        }
      }
      for (const [id, grp] of moverMap) {
        if (!seen.has(id) && grp.parent === parentGroup) { parentGroup.remove(grp); moverMap.delete(id) }
      }
    }

    function syncChests() {
      for (const [c, grp] of chestMap) grp.visible = !c.opened
    }

    function syncParticles(state) {
      const arr = state.particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (i < arr.length) {
          const p = arr[i]
          particlePos[i * 3] = p.x; particlePos[i * 3 + 1] = p.y; particlePos[i * 3 + 2] = p.z
          const [r, g, b] = hexToRgb01(p.color)
          particleCol[i * 3] = r; particleCol[i * 3 + 1] = g; particleCol[i * 3 + 2] = b
        } else {
          particlePos[i * 3 + 1] = -9999
        }
      }
      particleGeo.attributes.position.needsUpdate = true
      particleGeo.attributes.color.needsUpdate = true
    }

    const raycaster = new THREE.Raycaster()
    function updateCamera(state) {
      const p = state.player
      const pivot = new THREE.Vector3(p.x, 1.5, p.z)
      const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw)
      const dir = new THREE.Vector3(-fx * Math.cos(state.pitch), Math.sin(state.pitch), -fz * Math.cos(state.pitch)).normalize()
      let camDist = CAMERA_DIST
      raycaster.set(pivot, dir)
      raycaster.far = camDist
      const clipMeshes = state.mode === 'dungeon' ? interiorClipMeshes : buildingClipMeshes
      const hits = clipMeshes.length ? raycaster.intersectObjects(clipMeshes, false) : []
      if (hits[0]) camDist = Math.max(2.2, hits[0].distance - 0.4)
      camera.position.copy(pivot).addScaledVector(dir, camDist)
      camera.lookAt(pivot)
    }

    // ── Input ──
    const input = { forward: false, back: false, left: false, right: false, attackPressed: false, potionPressed: false, yawDelta: 0, pitchDelta: 0 }
    function onKeyDown(e) {
      if (phaseRef.current !== 'playing') return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = true
      if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = true
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true
      if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true
      if (e.code === 'Space') input.attackPressed = true
      if (e.code === 'KeyE') input.potionPressed = true
    }
    function onKeyUp(e) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = false
      if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = false
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false
      if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false
    }
    function onMouseMove(e) {
      if (document.pointerLockElement === renderer.domElement) {
        input.yawDelta -= e.movementX * MOUSE_SENSITIVITY
        input.pitchDelta -= e.movementY * MOUSE_SENSITIVITY
      }
    }
    function onClick() {
      if (phaseRef.current === 'playing') renderer.domElement.requestPointerLock?.()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('click', onClick)

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // ── HUD writer (direct DOM mutation — avoids per-frame React re-render) ──
    function writeHud(state) {
      const p = state.player
      if (hpFillRef.current) hpFillRef.current.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`
      if (hpTextRef.current) hpTextRef.current.textContent = `❤️ ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`
      if (xpFillRef.current) xpFillRef.current.style.width = `${Math.max(0, Math.min(1, p.xp / p.xpNext)) * 100}%`
      if (levelTextRef.current) levelTextRef.current.textContent = `Lv.${p.level}`
      if (goldTextRef.current) goldTextRef.current.textContent = `🪙 ${p.gold}`
      if (potionTextRef.current) potionTextRef.current.textContent = `🧃 x${p.potions}`

      if (bannerRef.current) {
        if (state.banner) {
          bannerRef.current.style.opacity = state.bannerTimer > 0.4 ? 1 : state.bannerTimer / 0.4
          bannerRef.current.style.visibility = 'visible'
          bannerRef.current.style.color = state.banner.color
          bannerRef.current.textContent = `${state.banner.icon} ${state.banner.text}`
        } else {
          bannerRef.current.style.visibility = 'hidden'
        }
      }
      if (announcerRef.current) {
        announcerRef.current.style.opacity = state.announcerTimer > 0.5 ? 0.95 : Math.max(0, state.announcerTimer / 0.5) * 0.95
        announcerRef.current.textContent = `🔮 MC Marv: "${state.announcerText}"`
      }
      if (petRef.current) {
        petRef.current.style.opacity = state.petTimer > 0.5 ? 1 : Math.max(0, state.petTimer / 0.5)
        petRef.current.textContent = `🐹 Biscuit: "${state.petText}"`
      }

      const boss = state.mode === 'dungeon' ? state.sites[state.activeSite].monsters.find(m => m.isBoss && !m.dead) : null
      if (bossBarRef.current) {
        if (boss) {
          bossBarRef.current.style.visibility = 'visible'
          bossNameRef.current.textContent = boss.name
          bossFillRef.current.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`
        } else {
          bossBarRef.current.style.visibility = 'hidden'
        }
      }

      if (compassRef.current) {
        if (state.compass) {
          compassRef.current.style.visibility = 'visible'
          const rel = state.compass.bearing - state.yaw
          compassArrowRef.current.style.transform = `rotate(${rel}rad)`
          compassRef.current.querySelector('span').textContent = `${state.compass.name} — ${Math.round(state.compass.dist)}m`
        } else {
          compassRef.current.style.visibility = 'hidden'
        }
      }

      if (controlsHintRef.current) {
        const t = Math.max(0, 16 - state.elapsed)
        controlsHintRef.current.style.opacity = Math.min(1, t / 2)
        controlsHintRef.current.style.display = t <= 0 ? 'none' : 'block'
      }

      if (teleportFlashRef.current) {
        teleportFlashRef.current.style.opacity = state.teleportFlash > 0 ? state.teleportFlash / 0.4 : 0
      }
    }

    let lastTime = performance.now()
    function step() {
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const state = stateRef.current

      if (phaseRef.current === 'playing' && state) {
        update(state, input, dt, { setPhase, setWinStats })
        if (state.justTeleported) handleTeleport(state, state.justTeleported)

        if (playerGroup) {
          playerGroup.position.set(state.player.x, 0, state.player.z)
          const flicker = state.player.invuln > 0 && Math.floor(state.player.invuln * 10) % 2 === 0
          playerGroup.userData.sprite.material.opacity = flicker ? 0.35 : 1
        }
        if (petGroup) {
          const behindX = state.player.x + Math.sin(state.yaw) * 2.2 + Math.cos(state.yaw) * 1.4
          const behindZ = state.player.z + Math.cos(state.yaw) * 2.2 - Math.sin(state.yaw) * 1.4
          petPos.x += (behindX - petPos.x) * 0.06
          petPos.z += (behindZ - petPos.z) * 0.06
          petGroup.position.set(petPos.x, 0, petPos.z)
        }
        syncMovers(state)
        syncChests()
        syncParticles(state)
        updateCamera(state)
        writeHud(state)
      }

      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    mount._teardownAll = teardownAll
    mount._buildWorld = buildWorld

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      teardownAll()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  function startGame() {
    const state = mkInitialState()
    stateRef.current = state
    markContestant(state)
    const mount = mountRef.current
    mount._teardownAll?.()
    mount._buildWorld?.(state)
    setPhase('playing')
  }

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.mount} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>

      {phase === 'playing' && (
        <div className={styles.hud}>
          <div ref={teleportFlashRef} className={styles.teleportFlash} />
          <div className={styles.crosshair} />
          <div className={styles.statsPanel}>
            <div className={styles.hpBar}><div ref={hpFillRef} className={styles.hpFill} /></div>
            <div ref={hpTextRef} className={styles.hpText}>❤️ 40/40</div>
            <div className={styles.xpBar}><div ref={xpFillRef} className={styles.xpFill} /></div>
            <div ref={levelTextRef} className={styles.levelText}>Lv.1</div>
            <div className={styles.row}>
              <span ref={goldTextRef}>🪙 0</span>
              <span ref={potionTextRef}>🧃 x1</span>
            </div>
          </div>

          <div ref={compassRef} className={styles.compass}>
            <div ref={compassArrowRef} className={styles.compassArrow}>▲</div>
            <span>—</span>
          </div>

          <div ref={bossBarRef} className={styles.bossBar}>
            <div ref={bossNameRef} className={styles.bossName} />
            <div className={styles.bossTrack}><div ref={bossFillRef} className={styles.bossFill} /></div>
          </div>

          <div ref={bannerRef} className={styles.banner} />
          <div ref={announcerRef} className={styles.announcer} />
          <div ref={petRef} className={styles.petBubble} />
          <div ref={controlsHintRef} className={styles.controlsHint}>
            W/S move · A/D turn · click to mouse-look · Space attack · E potion
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>🧒 🐹 🔮</div>
            <h1 className={styles.title}>Dungeon Crawler Max: Free Roam</h1>
            <p className={styles.tagline}>The Game Show Goes Open World!</p>
            <p className={styles.story}>
              Same game show, bigger stage! You and your hamster, Biscuit, are free to roam a whole
              wide-open world this time — five dungeon buildings are scattered around the map, each
              guarded by its own boss. Walk up to a door and you'll be teleported straight inside;
              find the exit to teleport back out. Floating host MC Marv is narrating from somewhere
              overhead. Explore, fight, loot, and clear every dungeon to win the show. Getting knocked
              out is still just a free respawn — this game show has excellent insurance.
            </p>
            <div className={styles.controls}>
              <span><b>Move</b> — W / S</span>
              <span><b>Turn</b> — A / D</span>
              <span><b>Look</b> — click + mouse</span>
              <span><b>Attack</b> — Space</span>
              <span><b>Potion</b> — E</span>
            </div>
            <button className={styles.startButton} onClick={startGame}>Step Into The World →</button>
          </div>
        </div>
      )}

      {phase === 'win' && winStats && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>🏆 You Win The Game Show!</h1>
            <p className={styles.story}>MC Marv: "Ladies, gentlemen, and hamsters everywhere — we have a CHAMPION!"</p>
            <div className={styles.statsList}>
              <div>Final Level: <b>{winStats.level}</b></div>
              <div>Gold Collected: <b>{winStats.gold}</b> 🪙</div>
              <div>Achievements: <b>{winStats.achievements.length}/{winStats.totalAchievements}</b></div>
            </div>
            <ul className={styles.achList}>
              {winStats.achievements.map(name => (<li key={name}>🏅 {name}</li>))}
            </ul>
            <button className={styles.startButton} onClick={startGame}>Play Again</button>
          </div>
        </div>
      )}
    </div>
  )
}
