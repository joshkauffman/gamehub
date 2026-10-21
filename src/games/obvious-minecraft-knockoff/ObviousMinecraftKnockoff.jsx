import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './ObviousMinecraftKnockoff.module.css'
import {
  createWorld, generateTerrain, getBlock, setBlock, buildMeshData,
  raycastVoxels, collidesBox, groundHeightBelow, heightAt, isBlockNearby, moveWithStep,
  BLOCK, BLOCK_DROP, BLOCK_REQUIRED_TIER, BLOCK_HARDNESS,
  SIZE_X, SIZE_Y, SIZE_Z,
} from './voxelWorld.js'
import {
  ITEM_META, ALWAYS_VISIBLE_ITEMS, PLACEABLE_ITEM_BLOCK,
  RECIPES, freshInventory, canCraft, craft, addItem, removeItem,
  pickaxeTierOf, swordDamageOf, PICKAXE_SPEED,
} from './items.js'
import {
  stepMob, mobTouchesPlayer, damageMob, raycastMobs, trySpawnMob,
  MOB_CONTACT_DAMAGE, MOB_DESPAWN_RANGE,
} from './mobs.js'
import { saveGame, loadGame } from './persistence.js'
import {
  GRAVITY, JUMP_SPEED, MOVE_SPEED, MAX_FALL_SPEED,
  PLAYER_HALF_W, PLAYER_HEIGHT, EYE_HEIGHT, REACH, PLAYER_MAX_HP, STEP_HEIGHT,
  CYCLE_LENGTH, FURNACE_RANGE, SAVE_DEBOUNCE_MS, dayFactorAt,
} from './constants.js'

// ── The Obvious Minecraft Knockoff — full 3D version ───────────────────
// Everything here is original code and procedurally-generated voxel
// geometry (no sprites, no copied assets, no copyrighted names) — the
// "knockoff" is entirely the joke, worn openly. First-person voxel
// sandbox: mine, craft tools up through wood/stone/iron/diamond, smelt
// ore at a furnace, survive hostile mobs that show up at night, and
// your world is saved automatically.

const WORLD_SEED = 1337
const SPAWN_X = Math.floor(SIZE_X / 2), SPAWN_Z = Math.floor(SIZE_Z / 2)
const ATTACK_COOLDOWN = 0.4
const MOB_SPAWN_INTERVAL = 5

const DAY_SKY = new THREE.Color(0x8fc7e8)
const NIGHT_SKY = new THREE.Color(0x0a0f24)

function freshSpawnPos() {
  return { x: SPAWN_X + 0.5, y: heightAt(SPAWN_X, SPAWN_Z, WORLD_SEED) + 1, z: SPAWN_Z + 0.5 }
}

const TIER_NAMES = ['hand', 'wood', 'stone', 'iron', 'diamond']

function miningTimeFor(blockId, pickaxeTier) {
  const base = BLOCK_HARDNESS[blockId] ?? 1
  // A pickaxe weaker than the block's required tier still works, just
  // at hand speed — it simply won't yield a drop (see finishBreak).
  const required = BLOCK_REQUIRED_TIER[blockId] || 0
  const effectiveTier = pickaxeTier >= required ? pickaxeTier : 0
  const speed = PICKAXE_SPEED[TIER_NAMES[effectiveTier]] ?? PICKAXE_SPEED.hand
  return base / speed
}

function makeMobMesh() {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a6b3a, roughness: 0.9 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.3), bodyMat)
  body.position.y = 0.95
  body.castShadow = true
  g.add(body)
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.9 })
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMat)
  head.position.y = 1.72
  head.castShadow = true
  g.add(head)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 0.9 })
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04)
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.11, 1.74, 0.22); g.add(eyeL)
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.11, 1.74, 0.22); g.add(eyeR)
  return g
}

export default function ObviousMinecraftKnockoff() {
  const mountRef = useRef(null)
  const [locked, setLocked] = useState(false)
  const [inventory, setInventory] = useState(freshInventory)
  const [selected, setSelected] = useState(0)
  const [minedTotal, setMinedTotal] = useState(0)
  const [hp, setHp] = useState(PLAYER_MAX_HP)
  const [miningProgress, setMiningProgress] = useState(null)
  const [craftingOpen, setCraftingOpen] = useState(false)
  const [nearFurnace, setNearFurnace] = useState(false)
  const [isNight, setIsNight] = useState(false)
  const [toast, setToast] = useState(null)

  // Non-React mirrors so the render-loop / event handlers (set up once
  // below) always read current values without re-running Three.js setup.
  const selectedRef = useRef(0)
  const inventoryRef = useRef(freshInventory())
  const hpRef = useRef(PLAYER_MAX_HP)
  const craftingOpenRef = useRef(false)
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { inventoryRef.current = inventory }, [inventory])
  useEffect(() => { hpRef.current = hp }, [hp])
  useEffect(() => { craftingOpenRef.current = craftingOpen }, [craftingOpen])

  const visibleItems = Object.keys(ITEM_META).filter(
    id => ALWAYS_VISIBLE_ITEMS.includes(id) || (inventory[id] || 0) > 0
  )

  // If the selected slot's item drops out of the (progressive-
  // disclosure) hotbar — e.g. crafting consumes your last ore — fall
  // back to the last valid slot instead of pointing at nothing.
  useEffect(() => {
    if (visibleItems.length > 0 && selected >= visibleItems.length) {
      setSelected(visibleItems.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length])

  function showToast(text) { setToast(text) }

  function craftRecipe(recipe) {
    if (recipe.needsFurnace && !nearFurnace) return
    if (!canCraft(inventoryRef.current, recipe)) return
    setInventory(inv => craft(inv, recipe))
    showToast(`Crafted ${ITEM_META[recipe.output.item]?.label || recipe.output.item}`)
  }

  useEffect(() => {
    const mount = mountRef.current

    const scene = new THREE.Scene()
    scene.background = DAY_SKY.clone()
    scene.fog = new THREE.Fog(DAY_SKY.getHex(), 28, 100)

    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.08, 300)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 0.9)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0xffffff, 0.35)
    scene.add(ambient)
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

    // ── voxel world (load a save if there is one, else generate) ──
    const world = createWorld()
    const saved = loadGame(SIZE_X, SIZE_Y, SIZE_Z)
    if (saved) {
      world.blocks.set(saved.blocks)
    } else {
      generateTerrain(world, WORLD_SEED)
    }

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

    const highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x111111 })
    )
    highlight.visible = false
    scene.add(highlight)

    // ── player state ──
    const player = saved && saved.player ? { ...saved.player } : freshSpawnPos()
    const velocity = { y: 0 }
    let yaw = 0.6, pitch = -0.12
    let onGround = false
    let timeOfDay = saved ? saved.timeOfDay : 10
    if (saved) {
      inventoryRef.current = saved.inventory
      setInventory(saved.inventory)
      selectedRef.current = saved.selected
      setSelected(saved.selected)
      hpRef.current = saved.hp ?? PLAYER_MAX_HP
      setHp(saved.hp ?? PLAYER_MAX_HP)
    }

    camera.rotation.order = 'YXZ'
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
    camera.rotation.set(pitch, yaw, 0)

    // ── mobs ──
    let mobEntities = [] // [{ mob, mesh }]
    let mobSpawnTimer = MOB_SPAWN_INTERVAL
    function removeMobEntity(entity) {
      scene.remove(entity.mesh)
      mobEntities = mobEntities.filter(e => e !== entity)
    }

    // ── save/load ──
    let saveTimer = null
    function scheduleSave() {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveGame({
          world, inventory: inventoryRef.current, player,
          selected: selectedRef.current, hp: hpRef.current, timeOfDay,
        })
      }, SAVE_DEBOUNCE_MS)
    }

    // Recomputed on demand from inventoryRef (already kept in sync with
    // the React inventory state) rather than mirrored separately — so
    // there's exactly one source of truth and no staleness window.
    function currentVisibleItems() {
      return Object.keys(ITEM_META).filter(
        id => ALWAYS_VISIBLE_ITEMS.includes(id) || (inventoryRef.current[id] || 0) > 0
      )
    }
    function selectedItemId() {
      return currentVisibleItems()[selectedRef.current]
    }

    // ── input ──
    const keys = new Set()
    let leftDown = false
    const DIGIT_SLOT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8 }

    function toggleCrafting(open) {
      craftingOpenRef.current = open
      setCraftingOpen(open)
      if (open && document.pointerLockElement === renderer.domElement) document.exitPointerLock()
    }

    function onKeyDown(e) {
      keys.add(e.code)
      if (e.code === 'Space') e.preventDefault()
      if (e.code === 'KeyC') { toggleCrafting(!craftingOpenRef.current); return }
      if (craftingOpenRef.current) return
      if (e.code in DIGIT_SLOT) {
        const idx = DIGIT_SLOT[e.code]
        if (idx < currentVisibleItems().length) {
          selectedRef.current = idx
          setSelected(idx)
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

    function onCanvasClick() {
      if (craftingOpenRef.current) return
      if (document.pointerLockElement !== renderer.domElement) {
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

    // mining state, advanced in the tick loop while leftDown
    let miningTarget = null // {x,y,z,block}
    let miningElapsed = 0

    function resetMining() {
      miningTarget = null
      miningElapsed = 0
      setMiningProgress(null)
    }

    function finishBreak(x, y, z, block) {
      setBlock(world, x, y, z, BLOCK.AIR)
      rebuildTerrainMesh()
      scheduleSave()
      const required = BLOCK_REQUIRED_TIER[block] || 0
      const toolTier = pickaxeTierOf(selectedItemId())
      const drop = BLOCK_DROP[block]
      if (drop != null && toolTier >= required) {
        setInventory(inv => addItem(inv, drop, 1))
        showToast(`+1 ${ITEM_META[drop]?.label || drop}`)
      }
      setMinedTotal(n => n + 1)
    }

    function tryPlace() {
      const hit = raycastVoxels(world, camera.position, currentAim(), REACH)
      if (!hit.hit) return
      const px = hit.x + hit.normal.x, py = hit.y + hit.normal.y, pz = hit.z + hit.normal.z
      const itemId = selectedItemId()
      const blockName = itemId && PLACEABLE_ITEM_BLOCK[itemId]
      if (!blockName) return
      if ((inventoryRef.current[itemId] || 0) <= 0) return
      if (getBlock(world, px, py, pz) !== BLOCK.AIR) return
      if (overlapsPlayer(px, py, pz)) return
      setBlock(world, px, py, pz, BLOCK[blockName.toUpperCase()])
      rebuildTerrainMesh()
      scheduleSave()
      setInventory(inv => removeItem(inv, itemId, 1))
    }

    function onMouseDown(e) {
      if (document.pointerLockElement !== renderer.domElement || craftingOpenRef.current) return
      if (e.button === 0) {
        const livingMobs = mobEntities.map(en => en.mob)
        const mobHit = raycastMobs(livingMobs, camera.position, currentAim(), REACH)
        if (mobHit && attackCooldown <= 0) {
          const dmg = swordDamageOf(selectedItemId())
          damageMob(mobHit, dmg)
          attackCooldown = ATTACK_COOLDOWN
          if (!mobHit.alive) {
            const entity = mobEntities.find(en => en.mob === mobHit)
            if (entity) removeMobEntity(entity)
            showToast('Shambler defeated')
          }
          return
        }
        leftDown = true
      } else if (e.button === 2) {
        tryPlace()
      }
    }
    function onMouseUp(e) {
      if (e.button === 0) { leftDown = false; resetMining() }
    }
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    function onContextMenu(e) { e.preventDefault() }
    renderer.domElement.addEventListener('contextmenu', onContextMenu)

    let attackCooldown = 0

    function respawnPlayer() {
      const spawn = freshSpawnPos()
      player.x = spawn.x; player.y = spawn.y; player.z = spawn.z
      velocity.y = 0
      hpRef.current = PLAYER_MAX_HP
      setHp(PLAYER_MAX_HP)
      showToast('You respawned.')
    }

    // ── game loop ──
    const clock = new THREE.Clock()
    let raf
    let furnaceCheckTimer = 0
    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.1)
      const active = document.pointerLockElement === renderer.domElement

      if (attackCooldown > 0) attackCooldown -= dt

      if (active && !craftingOpenRef.current) {
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
        const moved = moveWithStep(world, player, dx, dz, PLAYER_HALF_W, PLAYER_HEIGHT, STEP_HEIGHT)
        player.x = moved.x; player.y = moved.y; player.z = moved.z

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

      if (player.y < -10) respawnPlayer()

      camera.position.set(player.x, player.y + EYE_HEIGHT, player.z)
      camera.rotation.set(pitch, yaw, 0)

      // ── targeted-block highlight + timed mining ──
      if (active && !craftingOpenRef.current) {
        const hit = raycastVoxels(world, camera.position, currentAim(), REACH)
        if (hit.hit) {
          highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
          highlight.visible = true
        } else {
          highlight.visible = false
        }

        if (leftDown) {
          if (!hit.hit) {
            resetMining()
          } else {
            const block = getBlock(world, hit.x, hit.y, hit.z)
            if (block === BLOCK.BEDROCK) {
              resetMining()
            } else if (!miningTarget || miningTarget.x !== hit.x || miningTarget.y !== hit.y || miningTarget.z !== hit.z) {
              miningTarget = { x: hit.x, y: hit.y, z: hit.z, block }
              miningElapsed = 0
            } else {
              miningElapsed += dt
              const tier = pickaxeTierOf(selectedItemId())
              const speed = PICKAXE_SPEED[['hand', 'wood', 'stone', 'iron', 'diamond'][tier]] ?? PICKAXE_SPEED.hand
              const required = miningTimeFor(block, tier, speed)
              setMiningProgress(Math.min(1, miningElapsed / required))
              if (miningElapsed >= required) {
                finishBreak(hit.x, hit.y, hit.z, block)
                resetMining()
              }
            }
          }
        }
      } else {
        highlight.visible = false
        if (leftDown) resetMining()
      }

      // ── day/night ──
      timeOfDay = (timeOfDay + dt) % CYCLE_LENGTH
      const dayFactor = dayFactorAt(timeOfDay)
      const nightNow = dayFactor < 0.4
      setIsNight(prev => (prev === nightNow ? prev : nightNow))
      const skyColor = NIGHT_SKY.clone().lerp(DAY_SKY, dayFactor)
      scene.background = skyColor
      scene.fog.color.copy(skyColor)
      sun.intensity = 0.15 + dayFactor * 1.0
      hemi.intensity = 0.25 + dayFactor * 0.65
      ambient.intensity = 0.12 + dayFactor * 0.23

      // ── furnace proximity (cheap, checked a few times a second) ──
      furnaceCheckTimer -= dt
      if (furnaceCheckTimer <= 0) {
        furnaceCheckTimer = 0.25
        const near = isBlockNearby(world, player.x, player.y, player.z, BLOCK.FURNACE, FURNACE_RANGE)
        setNearFurnace(prev => (prev === near ? prev : near))
      }

      // ── mobs: spawn, AI, combat-contact, render ──
      mobSpawnTimer -= dt
      if (mobSpawnTimer <= 0) {
        mobSpawnTimer = MOB_SPAWN_INTERVAL
        const spawned = trySpawnMob(
          (x, z, fromY) => groundHeightBelow(world, Math.floor(x), Math.floor(z), fromY),
          player, mobEntities.length, nightNow
        )
        if (spawned) {
          const mesh = makeMobMesh()
          scene.add(mesh)
          mobEntities.push({ mob: spawned, mesh })
        }
      }
      for (const entity of mobEntities.slice()) {
        stepMob(entity.mob, (x, z, fromY) => groundHeightBelow(world, Math.floor(x), Math.floor(z), fromY), player, dt)
        const distToPlayer = Math.hypot(entity.mob.x - player.x, entity.mob.z - player.z)
        if (distToPlayer > MOB_DESPAWN_RANGE) { removeMobEntity(entity); continue }
        if (mobTouchesPlayer(entity.mob, player)) {
          hpRef.current = Math.max(0, hpRef.current - MOB_CONTACT_DAMAGE)
          setHp(hpRef.current)
          if (hpRef.current <= 0) respawnPlayer()
        }
        entity.mesh.position.set(entity.mob.x, entity.mob.y, entity.mob.z)
        entity.mesh.rotation.y = Math.atan2(player.x - entity.mob.x, player.z - entity.mob.z)
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

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        saveGame({ world, inventory: inventoryRef.current, player, selected: selectedRef.current, hp: hpRef.current, timeOfDay })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelAnimationFrame(raf)
      if (saveTimer) clearTimeout(saveTimer)
      saveGame({ world, inventory: inventoryRef.current, player, selected: selectedRef.current, hp: hpRef.current, timeOfDay })
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      renderer.domElement.removeEventListener('click', onCanvasClick)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.canvasWrap} />

      <div className={styles.hud}>
        <div className={styles.counter}>⛏️ {minedTotal} blocks mined</div>
        <div className={styles.hpRow}>
          <span className={styles.hpLabel}>❤️ HP</span>
          <div className={styles.hpBar}><div className={styles.hpFill} style={{ width: `${(hp / PLAYER_MAX_HP) * 100}%` }} /></div>
        </div>
        <div className={styles.timeOfDay}>{isNight ? '🌙 Night' : '☀️ Day'}</div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {miningProgress != null && (
        <div className={styles.miningBarWrap}>
          <div className={styles.miningBarFill} style={{ width: `${miningProgress * 100}%` }} />
        </div>
      )}

      <div className={styles.hotbar}>
        {visibleItems.map((itemId, i) => (
          <button
            key={itemId}
            className={`${styles.hotbarSlot}${i === selected ? ' ' + styles.hotbarSlotActive : ''}`}
            onClick={() => setSelected(i)}
          >
            <span className={styles.hotbarKey}>{i + 1}</span>
            <span className={styles.hotbarSwatch} style={{ background: ITEM_META[itemId].color }} />
            <span className={styles.hotbarLabel}>{ITEM_META[itemId].label}</span>
            <span className={styles.hotbarCount}>{inventory[itemId] || 0}</span>
          </button>
        ))}
      </div>

      {locked && !craftingOpen && <div className={styles.crosshair} />}

      {!locked && !craftingOpen && (
        <div className={styles.overlay}>
          <h1 className={styles.title}>The Obvious Minecraft Knockoff</h1>
          <p className={styles.hint}>Click to begin</p>
          <p className={styles.controls}>
            WASD to walk · Mouse to look · Space to jump · Left click to mine or attack · Right click to place ·
            Number keys to pick an item · C to craft · Esc to release
          </p>
        </div>
      )}

      {craftingOpen && (
        <div className={styles.craftingOverlay}>
          <div className={styles.craftingPanel}>
            <h2 className={styles.craftingTitle}>Crafting</h2>
            {!nearFurnace && <p className={styles.craftingHint}>Stand near a furnace to smelt ore.</p>}
            <div className={styles.recipeList}>
              {RECIPES.map(r => {
                const locked = r.needsFurnace && !nearFurnace
                const has = canCraft(inventory, r)
                return (
                  <button
                    key={r.id}
                    className={styles.recipeRow}
                    disabled={!has || locked}
                    onClick={() => craftRecipe(r)}
                  >
                    <span className={styles.recipeLabel}>{r.label}</span>
                    <span className={styles.recipeInputs}>
                      {r.inputs.map(inp => `${inp.count} ${ITEM_META[inp.item]?.label || inp.item}`).join(' + ')}
                      {locked ? ' (needs furnace)' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
            <button className={styles.craftingClose} onClick={() => setCraftingOpen(false)}>Close (C)</button>
          </div>
        </div>
      )}

      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
