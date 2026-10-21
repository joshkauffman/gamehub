import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './ObviousMinecraftKnockoff.module.css'
import {
  createWorld, generateTerrain, getBlock, setBlock, buildMeshData,
  raycastVoxels, collidesBox, groundHeightBelow, heightAt,
  BLOCK, BLOCK_DROP,
} from './voxelWorld.js'
import {
  GRAVITY, JUMP_SPEED, MOVE_SPEED, MAX_FALL_SPEED,
  PLAYER_HALF_W, PLAYER_HEIGHT, EYE_HEIGHT, REACH,
} from './constants.js'

// ── The Obvious Minecraft Knockoff — now actually 3D (beta) ───────────
// Everything here is original code and procedurally-generated voxel
// geometry (no sprites, no copied assets, no copyrighted names) — the
// "knockoff" is entirely the joke, worn openly. First-person, mine
// blocks (left click) and place them back (right click) in a small
// hand-rolled voxel world. This is an early beta: one static terrain,
// four placeable block types, no crafting/mobs/day-night yet — more
// to come.

const WORLD_SEED = 1337
const SPAWN_X = 24, SPAWN_Z = 24

const HOTBAR = [BLOCK.DIRT, BLOCK.STONE, BLOCK.LOG, BLOCK.LEAVES]
const HOTBAR_LABEL = { [BLOCK.DIRT]: 'Dirt', [BLOCK.STONE]: 'Stone', [BLOCK.LOG]: 'Log', [BLOCK.LEAVES]: 'Leaves' }
const HOTBAR_SWATCH = { [BLOCK.DIRT]: '#7a5433', [BLOCK.STONE]: '#8a8a92', [BLOCK.LOG]: '#6b4a2a', [BLOCK.LEAVES]: '#3d8a3d' }

function freshInventory() {
  return { [BLOCK.DIRT]: 0, [BLOCK.STONE]: 0, [BLOCK.LOG]: 0, [BLOCK.LEAVES]: 0 }
}

export default function ObviousMinecraftKnockoff() {
  const mountRef = useRef(null)
  const [locked, setLocked] = useState(false)
  const [inventory, setInventory] = useState(freshInventory)
  const [selected, setSelected] = useState(0)
  const [minedTotal, setMinedTotal] = useState(0)

  // Non-React mirrors so the render-loop / event handlers (set up once,
  // in the effect below) always read current values without re-running
  // the whole Three.js setup on every state change.
  const selectedRef = useRef(0)
  const inventoryRef = useRef(freshInventory())
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { inventoryRef.current = inventory }, [inventory])

  useEffect(() => {
    const mount = mountRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8fc7e8)
    scene.fog = new THREE.Fog(0x8fc7e8, 30, 110)

    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.08, 300)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 0.9))
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.15)
    sun.position.set(40, 60, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -40
    sun.shadow.camera.right = 40
    sun.shadow.camera.top = 40
    sun.shadow.camera.bottom = -40
    sun.shadow.camera.far = 150
    scene.add(sun)

    // ── voxel world + its one merged mesh ──
    const world = createWorld()
    generateTerrain(world, WORLD_SEED)

    const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    let terrainMesh = null
    function rebuildTerrainMesh() {
      const data = buildMeshData(world)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3))
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3))
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.colors), 3))
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1))
      if (terrainMesh) {
        scene.remove(terrainMesh)
        terrainMesh.geometry.dispose()
      }
      terrainMesh = new THREE.Mesh(geo, terrainMaterial)
      terrainMesh.castShadow = true
      terrainMesh.receiveShadow = true
      scene.add(terrainMesh)
    }
    rebuildTerrainMesh()

    // Wireframe outline shown over whichever block the crosshair is aimed at.
    const highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x111111 })
    )
    highlight.visible = false
    scene.add(highlight)

    // ── player state ──
    const player = { x: SPAWN_X + 0.5, y: heightAt(SPAWN_X, SPAWN_Z, WORLD_SEED) + 1, z: SPAWN_Z + 0.5 }
    const velocity = { y: 0 }
    let yaw = 0.6, pitch = -0.12
    let onGround = false

    camera.rotation.order = 'YXZ'
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
    camera.rotation.set(pitch, yaw, 0)

    // ── input ──
    const keys = new Set()
    const DIGIT_SLOT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }
    function onKeyDown(e) {
      keys.add(e.code)
      if (e.code === 'Space') e.preventDefault()
      if (e.code in DIGIT_SLOT) {
        selectedRef.current = DIGIT_SLOT[e.code]
        setSelected(DIGIT_SLOT[e.code])
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

    function onCanvasClick() {
      if (document.pointerLockElement !== renderer.domElement) {
        // Pointer lock can legitimately fail (revoked permission, a
        // headless/automated browsing context with no real cursor to
        // lock, etc.) — swallow the rejection rather than let it
        // surface as an uncaught page error.
        const req = renderer.domElement.requestPointerLock()
        if (req && typeof req.catch === 'function') req.catch(() => {})
      }
    }
    renderer.domElement.addEventListener('click', onCanvasClick)

    function onLockChange() { setLocked(document.pointerLockElement === renderer.domElement) }
    document.addEventListener('pointerlockchange', onLockChange)

    const aimDir = new THREE.Vector3()
    function currentAim() {
      camera.getWorldDirection(aimDir)
      return aimDir
    }

    function overlapsPlayer(px, py, pz) {
      const pMinX = player.x - PLAYER_HALF_W, pMaxX = player.x + PLAYER_HALF_W
      const pMinZ = player.z - PLAYER_HALF_W, pMaxZ = player.z + PLAYER_HALF_W
      const pMinY = player.y, pMaxY = player.y + PLAYER_HEIGHT
      return px < pMaxX && px + 1 > pMinX && pz < pMaxZ && pz + 1 > pMinZ && py < pMaxY && py + 1 > pMinY
    }

    function tryMine() {
      const hit = raycastVoxels(world, camera.position, currentAim(), REACH)
      if (!hit.hit) return
      const block = getBlock(world, hit.x, hit.y, hit.z)
      if (block === BLOCK.BEDROCK) return
      setBlock(world, hit.x, hit.y, hit.z, BLOCK.AIR)
      rebuildTerrainMesh()
      const drop = BLOCK_DROP[block]
      if (drop != null) setInventory(inv => ({ ...inv, [drop]: (inv[drop] || 0) + 1 }))
      setMinedTotal(n => n + 1)
    }

    function tryPlace() {
      const hit = raycastVoxels(world, camera.position, currentAim(), REACH)
      if (!hit.hit) return
      const px = hit.x + hit.normal.x, py = hit.y + hit.normal.y, pz = hit.z + hit.normal.z
      const blockId = HOTBAR[selectedRef.current]
      if ((inventoryRef.current[blockId] || 0) <= 0) return
      if (getBlock(world, px, py, pz) !== BLOCK.AIR) return
      if (overlapsPlayer(px, py, pz)) return
      setBlock(world, px, py, pz, blockId)
      rebuildTerrainMesh()
      setInventory(inv => ({ ...inv, [blockId]: inv[blockId] - 1 }))
    }

    function onMouseDown(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      if (e.button === 0) tryMine()
      else if (e.button === 2) tryPlace()
    }
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    function onContextMenu(e) { e.preventDefault() }
    renderer.domElement.addEventListener('contextmenu', onContextMenu)

    // ── game loop ──
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
        if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += forward.x; mz += forward.z }
        if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= forward.x; mz -= forward.z }
        if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += right.x; mz += right.z }
        if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= right.x; mz -= right.z }
        const len = Math.hypot(mx, mz)
        if (len > 0) { mx /= len; mz /= len }

        const dx = mx * MOVE_SPEED * dt
        const dz = mz * MOVE_SPEED * dt
        if (!collidesBox(world, player.x + dx, player.y, player.z, PLAYER_HALF_W, PLAYER_HEIGHT)) player.x += dx
        if (!collidesBox(world, player.x, player.y, player.z + dz, PLAYER_HALF_W, PLAYER_HEIGHT)) player.z += dz

        if (keys.has('Space') && onGround) {
          velocity.y = JUMP_SPEED
          onGround = false
        }
      }

      velocity.y -= GRAVITY * dt
      velocity.y = Math.max(velocity.y, MAX_FALL_SPEED)
      const newY = player.y + velocity.y * dt

      if (velocity.y <= 0) {
        const groundY = groundHeightBelow(world, Math.floor(player.x), Math.floor(player.z), player.y + 0.01)
        if (newY <= groundY) {
          player.y = groundY
          velocity.y = 0
          onGround = true
        } else {
          player.y = newY
          onGround = false
        }
      } else if (collidesBox(world, player.x, newY, player.z, PLAYER_HALF_W, PLAYER_HEIGHT)) {
        velocity.y = 0
      } else {
        player.y = newY
        onGround = false
      }

      // Never let the player fall out of the world forever.
      if (player.y < -10) {
        player.x = SPAWN_X + 0.5
        player.y = heightAt(SPAWN_X, SPAWN_Z, WORLD_SEED) + 1
        player.z = SPAWN_Z + 0.5
        velocity.y = 0
      }

      camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
      camera.rotation.set(pitch, yaw, 0)

      if (active) {
        const hit = raycastVoxels(world, camera.position, currentAim(), REACH)
        if (hit.hit) {
          highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
          highlight.visible = true
        } else {
          highlight.visible = false
        }
      } else {
        highlight.visible = false
      }

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
      renderer.domElement.removeEventListener('click', onCanvasClick)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.canvasWrap} />
      <div className={styles.hud}>
        <div className={styles.counter}>⛏️ {minedTotal} blocks mined</div>
      </div>
      <div className={styles.hotbar}>
        {HOTBAR.map((blockId, i) => (
          <div key={blockId} className={`${styles.hotbarSlot}${i === selected ? ' ' + styles.hotbarSlotActive : ''}`}>
            <span className={styles.hotbarKey}>{i + 1}</span>
            <span className={styles.hotbarSwatch} style={{ background: HOTBAR_SWATCH[blockId] }} />
            <span className={styles.hotbarLabel}>{HOTBAR_LABEL[blockId]}</span>
            <span className={styles.hotbarCount}>{inventory[blockId] || 0}</span>
          </div>
        ))}
      </div>
      {locked && <div className={styles.crosshair} />}
      {!locked && (
        <div className={styles.overlay}>
          <h1 className={styles.title}>The Obvious Minecraft Knockoff</h1>
          <p className={styles.betaTag}>3D beta</p>
          <p className={styles.hint}>Click to begin</p>
          <p className={styles.controls}>
            WASD to walk · Mouse to look · Space to jump · Left click to mine · Right click to place ·
            1-4 to pick a block · Esc to release
          </p>
        </div>
      )}
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
