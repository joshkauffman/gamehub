import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './DogManDash.module.css'
import {
  CHARACTERS, ENEMY_TYPES, CHIEF_WIN_QUOTES, CHIEF_LOSE_QUOTES, CHIEF_TEXTURE,
  MAP_HALF, DOCKS_START, HIDEOUT_START, DISTRICTS, HOME_BASE, SHOP_RADIUS, SHOP_ITEMS,
  BOSS_NAME, BOSS_TEXTURE,
  loadSave, isCharUnlocked, checkScoreUnlocks, recordRunScore,
} from './constants.js'
import { createWorldState, stepWorld, currentDistrictName, generateBuildings, TARGET_CAPTURES, buyShopItem, MAX_LIVES } from './worldEngine.js'

// ── Dog Man Dash 3D — open world ────────────────────────────────────────
// A free-roam city (Three.js) instead of a forced-scroll lane. Click to
// lock the mouse, look around, and walk anywhere across three connected
// districts (same mouse-look + WASD convention as this hub's other open
// world, Skylight/World3D.jsx) — third-person instead of first-person so
// the original character art stays visible. That art is reused verbatim
// as camera-facing billboards standing in real 3D geometry; only the
// road/city/coins/enemies are actual geometry. Gameplay state lives in
// worldEngine.js and knows nothing about THREE or the camera — this file
// only turns mouse-look + WASD into a movement vector and maps engine
// state onto meshes.

const textureCache = new Map()
function loadTextureAsync(path) {
  if (textureCache.has(path)) return textureCache.get(path)
  const promise = new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      path,
      tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve({ texture: tex, aspect: tex.image.width / tex.image.height }) },
      undefined,
      reject,
    )
  })
  textureCache.set(path, promise)
  return promise
}

function makeBillboard(texResult, height) {
  const material = new THREE.SpriteMaterial({ map: texResult.texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.center.set(0.5, 0)
  sprite.scale.set(height * texResult.aspect, height, 1)
  return sprite
}

// A small billboard sign drawn with canvas 2D text rather than a loaded
// texture — used for the HQ shop sign, which has no piece of book art to
// reuse the way characters/enemies do.
function makeLabelSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(20,10,40,0.88)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 52px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
  sprite.scale.set(4, 1, 1)
  return sprite
}

function hexToInt(hex) { return parseInt(hex.replace('#', ''), 16) }
function lerpColor(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))) }

function buildWorldScene(buildings) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x7a8ab8)
  scene.fog = new THREE.Fog(0x7a8ab8, 18, 85)

  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x333355, 1.1))
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.0)
  sun.position.set(-10, 25, 8)
  scene.add(sun)

  const full = MAP_HALF * 2 + 30
  const groundSegs = [
    { z0: -MAP_HALF - 15, z1: HIDEOUT_START, color: DISTRICTS.hideout.ground },
    { z0: HIDEOUT_START, z1: DOCKS_START, color: DISTRICTS.city.ground },
    { z0: DOCKS_START, z1: MAP_HALF + 15, color: DISTRICTS.docks.ground },
  ]
  groundSegs.forEach(seg => {
    const depth = seg.z1 - seg.z0
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(full, 0.4, depth), new THREE.MeshStandardMaterial({ color: hexToInt(seg.color), roughness: 1 }))
    mesh.position.set(0, -0.2, (seg.z0 + seg.z1) / 2)
    scene.add(mesh)
  })

  const water = new THREE.Mesh(new THREE.PlaneGeometry(full, 22), new THREE.MeshStandardMaterial({ color: 0x2a6a8a, transparent: true, opacity: 0.85, roughness: 0.3 }))
  water.rotation.x = -Math.PI / 2
  water.position.set(0, -0.03, MAP_HALF + 4)
  scene.add(water)

  // Same building layout the engine uses for collision (see
  // worldEngine.js's generateBuildings) — built from shared data so the
  // visible geometry and the collision boxes never drift apart.
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1)
  const buildingMeshes = buildings.map(b => {
    const mesh = new THREE.Mesh(buildingGeo, new THREE.MeshStandardMaterial({ color: b.color, roughness: 1 }))
    mesh.scale.set(b.w, b.h, b.d)
    mesh.position.set(b.x, b.h / 2, b.z)
    scene.add(mesh)
    return mesh
  })

  // Low perimeter wall so the map's edge reads as a boundary, not a bug.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24 })
  const wallH = 2.2
  ;[[full, 1, -MAP_HALF], [full, 1, MAP_HALF]].forEach(([w, , z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 1), wallMat)
    m.position.set(0, wallH / 2, z)
    scene.add(m)
  })
  ;[[-MAP_HALF, 1, full], [MAP_HALF, 1, full]].forEach(([x, , d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, wallH, d), wallMat)
    m.position.set(x, wallH / 2, 0)
    scene.add(m)
  })

  // The HQ shop — a cabin planted in the clearing generateBuildings()
  // keeps free around HOME_BASE, facing the city (+z, where the player
  // approaches from). See SHOP_ITEMS/SHOP_RADIUS in constants.js.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 }))
  cabin.position.set(HOME_BASE.x, 1.1, HOME_BASE.z)
  scene.add(cabin)

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0xE53935, roughness: 0.8 }))
  roof.position.set(HOME_BASE.x, 3, HOME_BASE.z)
  roof.rotation.y = Math.PI / 4
  scene.add(roof)

  const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.4 }))
  door.position.set(HOME_BASE.x, 0.8, HOME_BASE.z + 1.51)
  scene.add(door)

  const label = makeLabelSprite('🏠 HQ SHOP')
  label.position.set(HOME_BASE.x, 4.6, HOME_BASE.z)
  scene.add(label)

  const homeRing = new THREE.Mesh(
    new THREE.RingGeometry(SHOP_RADIUS - 0.15, SHOP_RADIUS, 32),
    new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  )
  homeRing.rotation.x = -Math.PI / 2
  homeRing.position.set(HOME_BASE.x, 0.05, HOME_BASE.z)
  scene.add(homeRing)

  return { scene, buildingMeshes, homeRing }
}

function GameCanvas({ character, carry, saveRef, onHud, onUnlock, onGameOver, onWin, onBossSpawn }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const [locked, setLocked] = useState(false)

  const runRef = useRef(null)
  const nearShopRef = useRef(false)
  const shopOpenRef = useRef(false)
  const shopActionsRef = useRef({ buy: () => {}, close: () => {} })
  const [shopOpen, setShopOpenState] = useState(false)
  const [shopTick, setShopTick] = useState(0)

  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onUnlockRef = useRef(onUnlock); onUnlockRef.current = onUnlock
  const onGameOverRef = useRef(onGameOver); onGameOverRef.current = onGameOver
  const onWinRef = useRef(onWin); onWinRef.current = onWin
  const onBossSpawnRef = useRef(onBossSpawn); onBossSpawnRef.current = onBossSpawn

  useEffect(() => {
    const mount = mountRef.current
    let disposed = false
    let raf = null

    const buildings = generateBuildings()
    const run = createWorldState(character.proj, carry, buildings)
    runRef.current = run

    // Opening the shop releases the mouse (so you can click its buttons)
    // and pauses the world (see the stepWorld gate in tick()) — enemies
    // and the clock freeze while you browse.
    function setShopOpen(v) {
      shopOpenRef.current = v
      setShopOpenState(v)
      if (v && document.pointerLockElement === renderer.domElement) document.exitPointerLock()
    }

    function handleBuy(key) {
      if (buyShopItem(run, key)) setShopTick(t => t + 1)
    }
    shopActionsRef.current = { buy: handleBuy, close: () => setShopOpen(false) }

    const camera = new THREE.PerspectiveCamera(64, mount.clientWidth / mount.clientHeight, 0.1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    let yaw = Math.PI
    let pitch = 0.35

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
      if (e.code === 'KeyE' && (nearShopRef.current || shopOpenRef.current)) setShopOpen(!shopOpenRef.current)
      else if (e.code === 'Escape' && shopOpenRef.current) setShopOpen(false)
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
      try { renderer.domElement.requestPointerLock()?.catch?.(() => {}) } catch { /* pointer lock unavailable in this context */ }
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

    const enemyTexturePromises = Object.fromEntries(ENEMY_TYPES.map(t => [t.key, loadTextureAsync(t.texture)]))
    const charTexturePromise = loadTextureAsync(character.texture)
    const bossTexturePromise = loadTextureAsync(BOSS_TEXTURE)

    Promise.all([charTexturePromise, bossTexturePromise, ...Object.values(enemyTexturePromises)]).then(([charTex, bossTex, ...enemyTexList]) => {
      if (disposed) return
      const enemyTex = {}
      ENEMY_TYPES.forEach((t, i) => { enemyTex[t.key] = enemyTexList[i] })

      const { scene, buildingMeshes, homeRing } = buildWorldScene(buildings)
      const camRaycaster = new THREE.Raycaster()

      const player = makeBillboard(charTex, 1.9)
      scene.add(player)

      const glowGeo = new THREE.RingGeometry(0.55, 0.75, 24)
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0, side: THREE.DoubleSide })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.rotation.x = -Math.PI / 2
      scene.add(glow)

      const enemyMesh = new Map()
      run.enemies.forEach(e => { const m = makeBillboard(enemyTex[e.type], 1.7); m.visible = false; scene.add(m); enemyMesh.set(e.id, m) })

      // The final boss — created up front but hidden until defeatEnemy()
      // spawns run.boss (see worldEngine.js), same lazy-reveal pattern as
      // the regular enemy billboards above.
      const bossMesh = makeBillboard(bossTex, 4.5)
      bossMesh.visible = false
      scene.add(bossMesh)

      const coinGeo = new THREE.TorusGeometry(0.32, 0.12, 8, 16)
      const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x996a00, emissiveIntensity: 0.4 })
      const coinMesh = new Map()
      run.coinPool.forEach(c => { const m = new THREE.Mesh(coinGeo, coinMat); m.rotation.x = Math.PI / 2; scene.add(m); coinMesh.set(c.id, m) })

      const powerColors = { star: 0xffd700, bone: 0xffffff, yarn: 0xff69b4, laser: 0xff3333, speech: 0x8fc7ff }
      const puMesh = new Map()
      run.powerups.forEach(pu => {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color: powerColors[pu.ptype] || 0xffffff, emissive: powerColors[pu.ptype] || 0xffffff, emissiveIntensity: 0.5 }))
        scene.add(m); puMesh.set(pu.id, m)
      })

      const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
      const laserLine = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0xff3333 }))
      laserLine.visible = false
      scene.add(laserLine)

      const projMesh = new Map()

      let finished = false
      let bossAnnounced = false
      const clock = new THREE.Clock()

      const TURN_SPEED = 2.6

      function tick() {
        raf = requestAnimationFrame(tick)
        const dt = Math.min(clock.getDelta(), 0.05)
        const k = keysRef.current

        // Keyboard-only "tank" turning always works (A/D or ←/→); mouse
        // look (once you click to lock the pointer) additionally steers
        // yaw/pitch for players who want it — neither is required for
        // the other, so the game is fully playable with just a keyboard.
        if (k.has('KeyA') || k.has('ArrowLeft')) yaw += TURN_SPEED * dt
        if (k.has('KeyD') || k.has('ArrowRight')) yaw -= TURN_SPEED * dt

        // Same forward convention as World3D.jsx (this hub's other
        // mouse-look game), verified there.
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
        let moveX = 0, moveZ = 0
        if (k.has('KeyW') || k.has('ArrowUp')) { moveX += fx; moveZ += fz }
        if (k.has('KeyS') || k.has('ArrowDown')) { moveX -= fx; moveZ -= fz }

        const input = {
          moveX, moveZ, facingX: fx, facingZ: fz,
          jump: k.has('Space'),
          attack: k.has('ShiftLeft') || k.has('ShiftRight'),
        }

        const dHome = Math.hypot(run.x - HOME_BASE.x, run.z - HOME_BASE.z)
        const isNear = dHome < SHOP_RADIUS
        if (isNear !== nearShopRef.current) {
          nearShopRef.current = isNear
          if (!isNear && shopOpenRef.current) setShopOpen(false)
        }
        homeRing.material.opacity = 0.22 + Math.sin(clock.elapsedTime * 2) * 0.1

        if (!finished && !shopOpenRef.current) stepWorld(run, input, dt)

        run.enemies.forEach(e => {
          const m = enemyMesh.get(e.id)
          m.visible = e.alive
          if (e.alive) m.position.set(e.x, 0, e.z)
        })
        if (run.boss) {
          bossMesh.visible = run.boss.alive
          if (run.boss.alive) bossMesh.position.set(run.boss.x, 0, run.boss.z)
          if (!bossAnnounced) { bossAnnounced = true; onBossSpawnRef.current() }
        }
        run.coinPool.forEach(c => {
          const m = coinMesh.get(c.id)
          m.visible = c.alive
          if (c.alive) { m.position.set(c.x, 1.1 + Math.sin(clock.elapsedTime * 3 + c.x) * 0.08, c.z); m.rotation.z += dt * 3 }
        })
        run.powerups.forEach(pu => {
          const m = puMesh.get(pu.id)
          m.visible = pu.alive
          if (pu.alive) { m.position.set(pu.x, 1.2 + Math.sin(clock.elapsedTime * 2.4 + pu.x) * 0.1, pu.z); m.rotation.y += dt * 1.6 }
        })

        const seen = new Set()
        run.projectiles.forEach(p => {
          seen.add(p)
          let m = projMesh.get(p)
          if (!m) {
            m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: p.type === 'bone' ? 0xffffff : 0xff69b4 }))
            scene.add(m); projMesh.set(p, m)
          }
          m.position.set(p.x, 1.2, p.z)
        })
        projMesh.forEach((m, key) => { if (!seen.has(key)) { scene.remove(m); projMesh.delete(key) } })

        if (run.laserZap) {
          laserLine.visible = true
          const pos = laserLine.geometry.attributes.position
          pos.setXYZ(0, run.x, 1.3, run.z)
          pos.setXYZ(1, run.laserZap.x, 1.1, run.laserZap.z)
          pos.needsUpdate = true
        } else {
          laserLine.visible = false
        }

        player.scale.set(1.9 * charTex.aspect, 1.9, 1)
        player.position.set(run.x, run.y, run.z)
        const flashing = run.invuln > 0 && Math.floor(clock.elapsedTime * 10) % 2 === 0
        player.material.color.setHex(flashing ? 0xff6666 : (run.buff?.type === 'star' ? 0xfff2a0 : 0xffffff))

        glow.visible = run.buff?.type === 'star'
        glow.material.opacity = run.buff?.type === 'star' ? 0.55 + Math.sin(clock.elapsedTime * 8) * 0.25 : 0
        glow.position.set(run.x, 0.03, run.z)

        // Third-person orbit camera: yaw/pitch from mouse-look. A raycast
        // from the player back toward the desired camera spot keeps a
        // building from ever sitting between the lens and the subject.
        const pivot = new THREE.Vector3(run.x, run.y + 1.3, run.z)
        const dir = new THREE.Vector3(-fx * Math.cos(pitch), Math.sin(pitch), -fz * Math.cos(pitch)).normalize()
        let camDist = 7.2
        camRaycaster.set(pivot, dir)
        camRaycaster.far = camDist
        const hit = camRaycaster.intersectObjects(buildingMeshes, false)[0]
        if (hit) camDist = Math.max(1.8, hit.distance - 0.3)
        camera.position.copy(pivot).addScaledVector(dir, camDist)
        camera.lookAt(pivot)

        const fogColor = run.z > DOCKS_START
          ? lerpColor(DISTRICTS.city.fog, DISTRICTS.docks.fog, Math.min(1, (run.z - DOCKS_START) / 20))
          : run.z < HIDEOUT_START
            ? lerpColor(DISTRICTS.city.fog, DISTRICTS.hideout.fog, Math.min(1, (HIDEOUT_START - run.z) / 20))
            : new THREE.Color(DISTRICTS.city.fog)
        scene.fog.color.copy(fogColor)
        scene.background.copy(fogColor)

        renderer.render(scene, camera)

        onHudRef.current({
          score: run.score, coins: run.coins, lives: run.lives,
          district: currentDistrictName(run), buff: run.buff, heldItem: run.heldItem,
          captures: run.captures, nearShop: isNear && !shopOpenRef.current,
          boss: run.boss?.alive ? { hp: run.boss.hp, maxHp: run.boss.maxHp } : null,
        })

        const unlockResult = checkScoreUnlocks(run.score, saveRef.current)
        if (unlockResult.newlyUnlocked.length) onUnlockRef.current(unlockResult.save, unlockResult.newlyUnlocked)

        if (!finished && run.status === 'dead') {
          finished = true
          onGameOverRef.current(run.score)
        } else if (!finished && run.status === 'won') {
          finished = true
          onWinRef.current(run.score)
        }
      }
      raf = requestAnimationFrame(tick)
    })

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
  }, [character, carry])

  const run = runRef.current
  return (
    <div ref={mountRef} className={styles.canvasWrap}>
      {!locked && !shopOpen && <div className={styles.lockHint}>Click for mouse-look (optional) — WASD/arrows work either way</div>}
      {shopOpen && run && (
        <div className={styles.shopPanel}>
          <h2 className={styles.title}>🏠 HQ SHOP</h2>
          <p className={styles.shopCoins}>🪙 {run.coins} coins to spend</p>
          <div className={styles.shopGrid}>
            {SHOP_ITEMS.map(item => {
              const blocked = (item.key === 'weapon' && !!run.heldItem) || (item.key === 'life' && run.lives >= MAX_LIVES)
              const afford = run.coins >= item.cost
              return (
                <div key={item.key} className={styles.shopItem}>
                  <span className={styles.shopIcon}>{item.icon}</span>
                  <span className={styles.charName}>{item.name}</span>
                  <span className={styles.charDesc}>{item.desc}</span>
                  <button
                    className={styles.bigBtn}
                    disabled={!afford || blocked}
                    onClick={() => shopActionsRef.current.buy(item.key)}
                  >
                    {blocked ? (item.key === 'life' ? 'FULL' : 'HELD') : `${item.cost} 🪙 Buy`}
                  </button>
                </div>
              )
            })}
          </div>
          <button className={styles.backBtn} onClick={() => shopActionsRef.current.close()}>Close (E)</button>
        </div>
      )}
    </div>
  )
}

function CharSelect({ save, onPick }) {
  return (
    <div className={styles.overlayScreen}>
      <h1 className={styles.title}>DOG MAN <span className={styles.dash}>DASH</span></h1>
      <p className={styles.blurb}>One open city, three districts, no fixed path. Pick your officer.</p>
      <div className={styles.charGrid}>
        {CHARACTERS.map((c, i) => {
          const unlocked = isCharUnlocked(c, save)
          return (
            <button
              key={c.key}
              className={styles.charCard}
              disabled={!unlocked}
              onClick={() => unlocked && onPick(i)}
              style={{ '--accent': c.color }}
            >
              <img src={c.texture} alt={c.name} className={styles.charImg} />
              <span className={styles.charName}>{c.name}</span>
              <span className={styles.charDesc}>{unlocked ? c.desc : `🔒 ${c.unlockHint}`}</span>
            </button>
          )
        })}
      </div>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function Hud({ hud }) {
  if (!hud) return null
  const buffLabel = { star: '⭐ STAR POWER', laser: '⚡ LASER LOCK-ON', speech: '💬 SNOOZE WAVE' }[hud.buff?.type]
  return (
    <div className={styles.hud}>
      <div className={styles.hudRow}>
        <span>SCORE {hud.score}</span>
        <span>🪙 {hud.coins}</span>
        <span>{'❤️'.repeat(Math.max(0, hud.lives))}</span>
      </div>
      <div className={styles.districtName}>📍 {hud.district}</div>
      {hud.boss ? (
        <div className={styles.bossBar}>🦖 {BOSS_NAME} HP {hud.boss.hp} / {hud.boss.maxHp}</div>
      ) : (
        <div className={styles.wantedBar}>
          🐾 BAD GUYS NABBED {Math.min(hud.captures, TARGET_CAPTURES)} / {TARGET_CAPTURES}
        </div>
      )}
      {buffLabel && <div className={styles.buffBadge}>{buffLabel}</div>}
      {hud.heldItem && !buffLabel && <div className={styles.buffBadge}>🎯 {hud.heldItem.toUpperCase()} READY (Shift to throw)</div>}
      {hud.nearShop && <div className={styles.shopPrompt}>🏠 Press E to open the HQ Shop</div>}
    </div>
  )
}

export default function DogManDash() {
  const [screen, setScreen] = useState('select')
  const [charIndex, setCharIndex] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [hud, setHud] = useState(null)
  const [finalScore, setFinalScore] = useState(0)
  const [chiefQuote, setChiefQuote] = useState('')
  const [save, setSave] = useState(() => loadSave())
  const [unlockToast, setUnlockToast] = useState(null)
  const [bossToast, setBossToast] = useState(false)
  const saveRef = useRef(save)
  saveRef.current = save

  const character = CHARACTERS[charIndex]

  function pickCharacter(i) {
    setCharIndex(i)
    setUnlockToast(null)
    setBossToast(false)
    setRunKey(k => k + 1)
    setScreen('playing')
  }

  function handleUnlock(nextSave, names) {
    setSave(nextSave)
    setUnlockToast(names.join(', '))
  }

  function handleGameOver(score) {
    setSave(recordRunScore(score))
    setFinalScore(score)
    setChiefQuote(CHIEF_LOSE_QUOTES[Math.floor(Math.random() * CHIEF_LOSE_QUOTES.length)])
    setScreen('gameover')
  }

  function handleWin(score) {
    setSave(recordRunScore(score))
    setFinalScore(score)
    setChiefQuote(CHIEF_WIN_QUOTES[Math.floor(Math.random() * CHIEF_WIN_QUOTES.length)])
    setScreen('win')
  }

  function handleBossSpawn() {
    setBossToast(true)
  }

  function playAgain() {
    setUnlockToast(null)
    setBossToast(false)
    setRunKey(k => k + 1)
    setScreen('playing')
  }

  function backToSelect() { setScreen('select') }

  return (
    <div className={styles.page}>
      {screen === 'select' && <CharSelect save={save} onPick={pickCharacter} />}

      {screen === 'playing' && (
        <>
          <GameCanvas
            key={runKey}
            character={character}
            carry={null}
            saveRef={saveRef}
            onHud={setHud}
            onUnlock={handleUnlock}
            onGameOver={handleGameOver}
            onWin={handleWin}
            onBossSpawn={handleBossSpawn}
          />
          <Hud hud={hud} />
          {unlockToast && <div className={styles.unlockToast}>🔓 {unlockToast} unlocked!</div>}
          {bossToast && <div className={styles.bossToast}>🦖 ROBO-BRONTO AWAKENS! Hunt it down deep in the Hideout!</div>}
          <div className={styles.controls}>W/S move · A/D turn · Space jump · Shift attack/throw · E to shop at HQ · click for mouse-look</div>
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}

      {screen === 'win' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🎉 CASE CLOSED!</h1>
          <img src={CHIEF_TEXTURE} alt="The Chief" className={styles.chiefImg} />
          <p className={styles.blurb}>"{chiefQuote}"</p>
          <p className={styles.blurb}>You nabbed all {TARGET_CAPTURES} bad guys AND took down {BOSS_NAME}! Final score: {finalScore}. Best: {save.bestScore}</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Next Case</button>
            <button className={styles.backBtn} onClick={backToSelect}>🧑 Pick A Different Officer</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'gameover' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>💥 DOWN FOR THE COUNT</h1>
          <img src={CHIEF_TEXTURE} alt="The Chief" className={styles.chiefImg} />
          <p className={styles.blurb}>"{chiefQuote}"</p>
          <p className={styles.blurb}>Final score: {finalScore}. Best: {save.bestScore}</p>
          <div className={styles.row}>
            <button className={styles.bigBtn} onClick={playAgain}>🔁 Back On Duty</button>
            <button className={styles.backBtn} onClick={backToSelect}>🧑 Pick A Different Officer</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
