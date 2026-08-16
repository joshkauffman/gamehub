import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './World3D.module.css'

// ── Constants ─────────────────────────────────────────────────────────
const GRAVITY        = 16
const FLY_ACCEL       = 30
const MAX_RISE_SPEED  = 8
const MAX_FALL_SPEED  = -11
const JUMP_SPEED      = 7
const MOVE_SPEED      = 6
const TURN_LERP       = 10
const PLAYER_RADIUS   = 0.4
const GROUND_SIZE     = 200

const CAM_DISTANCE = 6.5
const CAM_HEIGHT   = 2.2
const CAM_LERP     = 6

const ENERGY_MAX      = 100
const ENERGY_START    = 45
const ENERGY_DRAIN    = 26   // per second while flying
const ENERGY_PER_ORB  = 16

const PLATFORMS = [
  { x: 6,   y: 1,   z: -4,  w: 4, h: 2,   d: 4, color: 0xd97757 },
  { x: 11,  y: 2.5, z: -8,  w: 4, h: 5,   d: 4, color: 0xe0a06b },
  { x: -8,  y: 1.5, z: 6,   w: 5, h: 3,   d: 5, color: 0x6c63ff },
  { x: -14, y: 3.5, z: 10,  w: 4, h: 7,   d: 4, color: 0x8a7dff },
  { x: 0,   y: 4.5, z: -16, w: 6, h: 9,   d: 6, color: 0x4fa3d1 },
  { x: -3,  y: 0.5, z: 3,   w: 3, h: 1,   d: 3, color: 0xd97757 },
]

// Collectible light orbs: on the ground, atop platforms, and floating high
// (the sky ones only reachable by flying).
const ORBS = [
  // ground scatter
  { x: 3, y: 0.7, z: 6 }, { x: -4, y: 0.7, z: -2 }, { x: 8, y: 0.7, z: 2 },
  { x: -10, y: 0.7, z: -3 }, { x: 2, y: 0.7, z: 12 }, { x: -6, y: 0.7, z: -9 },
  { x: 14, y: 0.7, z: 4 }, { x: -2, y: 0.7, z: -12 },
  // atop each platform
  { x: 6,   y: 2.7, z: -4 },
  { x: 11,  y: 5.7, z: -8 },
  { x: -8,  y: 3.7, z: 6 },
  { x: -14, y: 7.7, z: 10 },
  { x: 0,   y: 9.7, z: -16 },
  { x: -3,  y: 1.7, z: 3 },
  // sky orbs — need flight
  { x: 3,   y: 12, z: -10 }, { x: -10, y: 14, z: -6 },
  { x: 9,   y: 16, z: -14 }, { x: -16, y: 13, z: 3 },
  { x: 0,   y: 18, z: -4 },  { x: 6,   y: 10, z: 8 },
]

// ── tiny WebAudio chime, no assets ──────────────────────────────────
function playChime(ctx) {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(740, t)
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.18)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.5)
}

// ── Component ────────────────────────────────────────────────────────
export default function World3D() {
  const mountRef = useRef(null)
  const [locked, setLocked] = useState(false)
  const [collected, setCollected] = useState(0)
  const [energyPct, setEnergyPct] = useState(ENERGY_START / ENERGY_MAX)
  const [allFound, setAllFound] = useState(false)

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
    scene.fog = new THREE.Fog(0xd9a06f, 35, 140)

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
    mount.appendChild(renderer.domElement)

    // Lights — warm dusk sun + cool fill
    scene.add(new THREE.HemisphereLight(0xffe6c0, 0x445577, 1.0))
    scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const sun = new THREE.DirectionalLight(0xffc98a, 1.3)
    sun.position.set(-25, 30, -15)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -50
    sun.shadow.camera.right = 50
    sun.shadow.camera.top = 50
    sun.shadow.camera.bottom = -50
    scene.add(sun)

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x4c8355, roughness: 1, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE / 2, 0x2c4d33, 0x2c4d33)
    grid.position.y = 0.01
    grid.material.opacity = 0.2
    grid.material.transparent = true
    scene.add(grid)

    // Platforms
    const platformMeshes = PLATFORMS.map(p => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9, metalness: 0 })
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

    // Firefly-style ambient particles
    const fireflyCount = 120
    const fireflyGeo = new THREE.BufferGeometry()
    const fireflyPos = new Float32Array(fireflyCount * 3)
    const fireflySpeed = new Float32Array(fireflyCount)
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPos[i * 3]     = (Math.random() - 0.5) * 80
      fireflyPos[i * 3 + 1] = Math.random() * 14
      fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 80
      fireflySpeed[i] = 0.3 + Math.random() * 0.6
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3))
    const fireflyMat = new THREE.PointsMaterial({
      color: 0xffe6b0, size: 0.18, transparent: true, opacity: 0.8,
      depthWrite: false,
    })
    const fireflies = new THREE.Points(fireflyGeo, fireflyMat)
    scene.add(fireflies)

    // Player character — simple robed figure
    const playerGroup = new THREE.Group()
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x4a3d72, roughness: 0.8, metalness: 0 })
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 8), robeMat)
    robe.position.y = 0.9
    robe.castShadow = true
    playerGroup.add(robe)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.7, metalness: 0 })
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), headMat)
    head.position.y = 1.65
    head.castShadow = true
    playerGroup.add(head)
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0xd97757, side: THREE.DoubleSide, emissive: 0x4a2a1c, emissiveIntensity: 0.15, roughness: 0.8, metalness: 0,
    })
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15), capeMat)
    cape.position.set(0, 1.0, 0.32)
    cape.rotation.x = 0.25
    playerGroup.add(cape)
    scene.add(playerGroup)

    // Light halo that follows the player, brighter with more energy
    const playerGlow = new THREE.PointLight(0xffd9a0, 0.8, 6)
    playerGlow.position.set(0, 1.2, 0)
    playerGroup.add(playerGlow)

    // Collectible orbs
    const orbGroup = new THREE.Group()
    scene.add(orbGroup)
    const orbGeo = new THREE.SphereGeometry(0.22, 12, 10)
    const orbs = ORBS.map((o, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfff2c0, emissive: 0xffdd88, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0,
      })
      const mesh = new THREE.Mesh(orbGeo, mat)
      mesh.position.set(o.x, o.y, o.z)
      const light = new THREE.PointLight(0xffdd88, 1.1, 4)
      mesh.add(light)
      orbGroup.add(mesh)
      return { mesh, x: o.x, y: o.y, z: o.z, collected: false, phase: i * 0.7 }
    })

    // Player physics state
    const player = { x: 0, y: 0, z: 16 }
    const velocity = { y: 0 }
    let camYaw = 3.0
    let camPitch = 0.35
    let facing = camYaw
    let onGround = true
    let energy = ENERGY_START
    let totalCollected = 0

    camera.position.set(player.x, player.y + 3, player.z + CAM_DISTANCE)

    // Input
    const keys = new Set()
    function onKeyDown(e) {
      keys.add(e.code)
      if (e.code === 'Space') e.preventDefault()
    }
    function onKeyUp(e) { keys.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let audioCtx = null
    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      camYaw -= e.movementX * 0.0025
      camPitch -= e.movementY * 0.002
      camPitch = Math.max(-0.15, Math.min(1.1, camPitch))
    }
    document.addEventListener('mousemove', onMouseMove)

    function onClick() {
      renderer.domElement.requestPointerLock()
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        audioCtx = new Ctx()
      }
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

      let flying = false
      if (active) {
        const forward = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) }
        const right = { x: Math.cos(camYaw), z: -Math.sin(camYaw) }
        let mx = 0, mz = 0
        if (keys.has('KeyW') || keys.has('ArrowUp'))    { mx += forward.x; mz += forward.z }
        if (keys.has('KeyS') || keys.has('ArrowDown'))  { mx -= forward.x; mz -= forward.z }
        if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += right.x;   mz += right.z }
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  { mx -= right.x;   mz -= right.z }
        const len = Math.hypot(mx, mz)
        if (len > 0) {
          mx /= len; mz /= len
          facing = Math.atan2(mx, mz) + Math.PI
        }

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
          flying = true
          velocity.y += FLY_ACCEL * dt
          velocity.y = Math.min(velocity.y, MAX_RISE_SPEED)
          energy = Math.max(0, energy - ENERGY_DRAIN * dt)
        }
      }

      velocity.y -= GRAVITY * dt
      velocity.y = Math.max(velocity.y, MAX_FALL_SPEED)
      player.y += velocity.y * dt

      const ground = surfaceHeightAt(player.x, player.z, player.y)
      if (player.y <= ground) {
        player.y = ground
        velocity.y = 0
        onGround = true
      } else {
        onGround = false
      }

      // Smoothly rotate character to face movement direction
      let da = facing - playerGroup.rotation.y
      da = ((da + Math.PI) % (Math.PI * 2)) - Math.PI
      playerGroup.rotation.y += da * Math.min(1, TURN_LERP * dt)
      playerGroup.position.set(player.x, player.y, player.z)

      // Cape flutters more while flying/falling
      const capeTarget = flying ? -0.35 : (onGround ? 0.25 : 0.05)
      cape.rotation.x += (capeTarget - cape.rotation.x) * Math.min(1, 6 * dt)
      playerGlow.intensity = 0.5 + (energy / ENERGY_MAX) * 0.9

      // Orbit camera around the player, damped
      const desiredX = player.x - Math.sin(camYaw) * Math.cos(camPitch) * CAM_DISTANCE
      const desiredZ = player.z - Math.cos(camYaw) * Math.cos(camPitch) * CAM_DISTANCE
      const desiredY = player.y + CAM_HEIGHT + Math.sin(camPitch) * CAM_DISTANCE
      const lerpAmt = Math.min(1, CAM_LERP * dt)
      camera.position.x += (desiredX - camera.position.x) * lerpAmt
      camera.position.y += (desiredY - camera.position.y) * lerpAmt
      camera.position.z += (desiredZ - camera.position.z) * lerpAmt
      if (camera.position.y < 0.4) camera.position.y = 0.4
      camera.lookAt(player.x, player.y + 1.1, player.z)

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
          if (totalCollected >= ORBS.length) setAllFound(true)
        }
      }

      // Firefly drift
      const posAttr = fireflyGeo.attributes.position
      for (let i = 0; i < fireflyCount; i++) {
        let y = posAttr.getY(i) + fireflySpeed[i] * dt
        if (y > 15) y = 0
        posAttr.setY(i, y)
        posAttr.setX(i, posAttr.getX(i) + Math.sin(t * 0.5 + i) * 0.004)
      }
      posAttr.needsUpdate = true

      setEnergyPct(energy / ENERGY_MAX)

      renderer.render(scene, camera)
    }
    tick()

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
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

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.canvasWrap} />
      <div className={styles.hud}>
        <div className={styles.counter}>✨ {collected} / {ORBS.length}</div>
        <div className={styles.energyBar}>
          <div className={styles.energyFill} style={{ width: `${Math.round(energyPct * 100)}%` }} />
        </div>
      </div>
      {allFound && (
        <div className={styles.winBanner}>You gathered all the Light ✨</div>
      )}
      {!locked && (
        <div className={styles.overlay}>
          <h1 className={styles.title}>Skylight</h1>
          <p className={styles.hint}>Click to begin</p>
          <p className={styles.controls}>
            WASD to walk · Mouse to orbit the view · Space to jump, then hold Space to fly on gathered light · Esc to release
          </p>
        </div>
      )}
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
