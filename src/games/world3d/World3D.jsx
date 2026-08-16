import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './World3D.module.css'

// ── Constants ─────────────────────────────────────────────────────────
const GRAVITY      = 28
const JUMP_SPEED    = 10.5
const MOVE_SPEED    = 7
const PLAYER_RADIUS = 0.4
const EYE_HEIGHT    = 1.7
const GROUND_SIZE   = 200

const PLATFORMS = [
  { x: 6,   y: 1,   z: -4,  w: 4, h: 2,   d: 4, color: 0xd97757 },
  { x: 11,  y: 2.5, z: -8,  w: 4, h: 5,   d: 4, color: 0xe0a06b },
  { x: -8,  y: 1.5, z: 6,   w: 5, h: 3,   d: 5, color: 0x6c63ff },
  { x: -14, y: 3.5, z: 10,  w: 4, h: 7,   d: 4, color: 0x8a7dff },
  { x: 0,   y: 4.5, z: -16, w: 6, h: 9,   d: 6, color: 0x4fa3d1 },
  { x: -3,  y: 0.5, z: 3,   w: 3, h: 1,   d: 3, color: 0xd97757 },
]

// ── Component ────────────────────────────────────────────────────────
export default function World3D() {
  const mountRef = useRef(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    const mount = mountRef.current

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8fc7e8)
    scene.fog = new THREE.Fog(0x8fc7e8, 30, 130)

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.7))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(30, 40, 10)
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
      new THREE.MeshStandardMaterial({ color: 0x4c8c3a })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE / 2, 0x336622, 0x336622)
    grid.position.y = 0.01
    grid.material.opacity = 0.25
    grid.material.transparent = true
    scene.add(grid)

    // Platforms
    const platformMeshes = PLATFORMS.map(p => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshStandardMaterial({ color: p.color })
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

    // Player state
    const player = { x: 0, y: 0, z: 16 }
    const velocity = { y: 0 }
    let yaw = 0.15
    let pitch = -0.08
    let onGround = true

    camera.rotation.order = 'YXZ'
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
    camera.rotation.set(pitch, yaw, 0)

    // Input
    const keys = new Set()
    function onKeyDown(e) {
      keys.add(e.code)
      if (e.code === 'Space') e.preventDefault()
    }
    function onKeyUp(e) {
      keys.delete(e.code)
    }
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
    }
    renderer.domElement.addEventListener('click', onClick)

    function onLockChange() {
      setLocked(document.pointerLockElement === renderer.domElement)
    }
    document.addEventListener('pointerlockchange', onLockChange)

    // Ground/platform height under a point (only surfaces at or below foot+epsilon)
    function surfaceHeightAt(x, z, footY) {
      let best = 0
      for (const p of platformMeshes) {
        if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
          if (p.top <= footY + 0.35 && p.top > best) best = p.top
        }
      }
      return best
    }

    // Blocks horizontal movement into a platform's side (below its top)
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

        const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? MOVE_SPEED * 1.6 : MOVE_SPEED
        const dx = mx * speed * dt
        const dz = mz * speed * dt

        const nx = player.x + dx
        if (!blockedAt(nx, player.z, player.y)) player.x = nx
        const nz = player.z + dz
        if (!blockedAt(player.x, nz, player.y)) player.z = nz

        if (onGround && keys.has('Space')) {
          velocity.y = JUMP_SPEED
          onGround = false
        }
      }

      // Gravity + vertical resolve
      velocity.y -= GRAVITY * dt
      player.y += velocity.y * dt

      const ground = surfaceHeightAt(player.x, player.z, player.y)
      if (player.y <= ground) {
        player.y = ground
        velocity.y = 0
        onGround = true
      } else {
        onGround = false
      }

      camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
      camera.rotation.set(pitch, yaw, 0)

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
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.canvasWrap} />
      {locked && <div className={styles.crosshair} />}
      {!locked && (
        <div className={styles.overlay}>
          <h1 className={styles.title}>3D World</h1>
          <p className={styles.hint}>Click to look around</p>
          <p className={styles.controls}>WASD to walk · Mouse to look · Space to jump · Shift to sprint · Esc to release</p>
        </div>
      )}
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
