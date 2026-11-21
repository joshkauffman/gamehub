import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import styles from './TotallyScaryHorrorGame.module.css'
import {
  MONSTER_DEFS, MONSTER_ORDER, MOUSE_SENSITIVITY, LIBRARY_ROOM, ROOM_H,
  SHOP_ROOM, SHOP_ITEMS, SHOPKEEPER, SHOP2_ROOM, ELEVATOR_ROOM, FLOOR2_START, DOORS_PER_FLOOR,
  BOILER_ROOM, VALVES_NEEDED, DOUG_RUMBLE, JOURNAL,
} from './constants.js'
import { createGame, stepGame, advanceDialogue, promptFor, triggerCatch, buyItem, closeShop, startGardener } from './engine.js'
import { createAssets, buildRoom, disposeRoom, lightSpots } from './scene.js'
import { buildMonsters, buildStool, poseMonster, disposeMonsters, buildGloombat, buildMinecart, buildScarecrow, buildMower } from './models.js'
import * as sfx from './sfx.js'
import Journal from './Journal.jsx'
import Lobby from './Lobby.jsx'
import { fmtTime } from './Panels.jsx'
import { loadProgress, updateProgress, savePhoto, addRecord, isLocalhost } from './progress.js'
import { newlyEarned } from './achievements.js'
import { snapPhoto } from './photo.js'
import { DIFFICULTIES, LOBBY_ALLOWANCE, FLOOR3_ELEVATOR, FLOOR3_START, SHOP3_ROOM, LOCAL_START_COINS, FLOOR4_ELEVATOR, FLOOR4_START, BOSS_ROOM, BOSS_HEARTS } from './constants.js'
import { loadJournal, withRun, commitRun, runKey } from './journal.js'

// ── The Totally Scary Horror Game ───────────────────────────────────────
// First-person, room after room through a haunted hotel, in the style of
// the Roblox hotel-crawlers. Each monster has its own "mechanic" (hide,
// look, don't look, turn around, run, sneak). Failing one never ends the
// game: the monster just sits down on a little stool and explains why it
// really needs this job. Engine (pure logic) / scene + models (THREE) /
// this file (loop, input, HUD) split, like the hub's other 3D games.

const LIGHT_POOL = 6
const HUD_KEYS = ['room', 'coins', 'hasPass', 'pages', 'showPages', 'prompt', 'caption', 'tone', 'hidden', 'hypno', 'turnCue', 'sneaking', 'locked', 'dlgKey', 'dark', 'inv', 'boost', 'rattle', 'shopOpen', 'valves', 'showValves', 'lightOff', 'journalOpen', 'frost', 'time', 'hearts', 'bossOn', 'hurt', 'lit']

function doorLabel(room, startFloor) {
  if (room == null || room < 1) return '🏨 Lobby'
  const attic = startFloor === 3
  if (startFloor === 4) {
    if (room === FLOOR4_ELEVATOR) return '🛗 Service Lift'
    if (room === BOSS_ROOM) return '🎃 The Courtyard'
    if (room > BOSS_ROOM) return '🌳 The Garden Gate'
    if (room >= FLOOR4_START) return <><span className={styles.dim}>Floor 4 · </span>🌙 Door {String(room).padStart(3, '0')}<span className={styles.dim}> / 200</span></>
  }
  if (room === ELEVATOR_ROOM || (attic && room === FLOOR3_ELEVATOR)) return '🛗 Elevator'
  if (attic && room > DOORS_PER_FLOOR * 3) return '🌙 The Rooftop'
  if (!attic && room > DOORS_PER_FLOOR * 2) return '🚚 Loading Dock'
  const floor = attic && room >= FLOOR3_START ? 3 : room >= FLOOR2_START ? 2 : 1
  const pad = (n) => String(n).padStart(3, '0')
  return (
    <>
      <span className={styles.dim}>Floor {floor} · </span>🚪 Door {pad(room)}
      <span className={styles.dim}> / {pad(floor * DOORS_PER_FLOOR)}</span>
    </>
  )
}

function GameView({ onWin, onLeave, startFloor, difficulty, startCoins, baseCoins }) {
  const mountRef = useRef(null)
  const [hud, setHud] = useState({})
  const [dialogue, setDialogue] = useState(null)
  const [journal, setJournal] = useState(null)
  const [toasts, setToasts] = useState([])
  const [flash, setFlash] = useState(0)
  const onLeaveRef = useRef(onLeave); onLeaveRef.current = onLeave
  const leaveRef = useRef(() => {})
  const journalRef = useRef({ toggle: () => {} })
  const advanceRef = useRef(() => {})
  const shopRef = useRef({ buy: () => {}, close: () => {} })
  const onWinRef = useRef(onWin); onWinRef.current = onWin

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const fogColor = new THREE.Color(0x060407)
    scene.background = fogColor.clone()
    scene.fog = new THREE.Fog(fogColor.clone(), 8, 34)
    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.05, 80)
    camera.rotation.order = 'YXZ'
    scene.add(camera)

    const hemi = new THREE.HemisphereLight(0x8a7a9a, 0x2a1a14, 0.45)
    scene.add(hemi)
    // the moon (only out in the garden)
    const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf4f0dc, fog: false }))
    moon.visible = false
    scene.add(moon)
    const lantern = new THREE.PointLight(0xffc888, 2.2, 7, 1.6)
    lantern.position.set(0.15, -0.1, 0)
    camera.add(lantern)
    const pool = []
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xffd6a0, 0, 16, 1.7)
      scene.add(l)
      pool.push(l)
    }
    const monsterLight = new THREE.PointLight(0xff3060, 0, 6, 2)
    scene.add(monsterLight)

    const assets = createAssets()
    const monsters = buildMonsters(assets)
    Object.values(monsters).forEach(m => { m.group.visible = false; scene.add(m.group) })
    const stool = buildStool()
    stool.visible = false
    scene.add(stool)

    const state = createGame(undefined, { startFloor, difficulty, startCoins, baseCoins })
    // the Gloombat swarm + Gary's minecart (shown only while those events run)
    // Floor 4 props: four scarecrows, his mower, the glowing mower lane, and the boss's warning marks
    const crows = [0, 1, 2, 3].map(() => { const c = buildScarecrow(); c.group.visible = false; scene.add(c.group); return c })
    const mower = buildMower(); mower.visible = false; scene.add(mower)
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.35, depthWrite: false })
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), laneMat); lane.rotation.x = -Math.PI / 2; lane.visible = false; scene.add(lane)
    const dangerMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
    const sweepMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32, 0, 1), dangerMat); sweepMesh.rotation.x = -Math.PI / 2; sweepMesh.visible = false; scene.add(sweepMesh)
    let sweepKey = ''
    const thornDiscs = [], thornSpikes = []
    for (let k = 0; k < 8; k++) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), dangerMat); disc.rotation.x = -Math.PI / 2; disc.visible = false; scene.add(disc); thornDiscs.push(disc)
      const sp = new THREE.Group()
      for (let j = 0; j < 7; j++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x1a2410, roughness: 0.9 })); c.position.set(Math.cos(j) * 0.6 * (j % 2 ? 1 : 0.4), 0.7, Math.sin(j) * 0.6 * (j % 2 ? 1 : 0.4)); c.rotation.set(Math.sin(j) * 0.3, 0, Math.cos(j) * 0.3); sp.add(c) }
      sp.visible = false; scene.add(sp); thornSpikes.push(sp)
    }
    const swarm = []
    for (let k = 0; k < 14; k++) { const b = buildGloombat(); b.visible = false; b.userData.ph = Math.random() * Math.PI * 2; b.userData.r = 1.2 + Math.random() * 1.6; b.userData.h = 1.3 + Math.random() * 1.3; scene.add(b); swarm.push(b) }
    // Steam cloud for Puff's blasts: a soft white slab that rolls through the room at head height.
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.55, depthWrite: false })
    const steam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 2.6), steamMat)
    steam.visible = false
    scene.add(steam)
    // The journal: what was saved before this run, plus this run's live numbers.
    const journalBase = loadJournal()
    // Achievements + photos: a cached copy of saved progress, checked twice a second.
    let prog = loadProgress()
    let achT = 0
    let photoPending = 0
    function checkAchievements() {
      const got = newlyEarned({ run: state, journal: withRun(journalBase, state), progress: prog })
      if (!got.length) return
      prog = updateProgress(pp => { for (const a of got) pp.achievements[a.id] = Date.now() })
      sfx.chime()
      setToasts(ts => [...ts, ...got.map(a => ({ ...a, key: a.id + Date.now() }))])
      got.forEach(a => setTimeout(() => setToasts(ts => ts.filter(t => t.id !== a.id)), 4200))
    }
    leaveRef.current = () => { onLeaveRef.current?.({ popped: state.popped, coins: state.coins }) }
    let lastRunKey = ''
    journalRef.current.toggle = () => {
      if (state.dialogue || state.shopOpen || state.won) return
      state.paused = !state.paused
      sfx.pageFlip()
      if (state.paused) { setJournal(withRun(journalBase, state)); document.exitPointerLock?.() }
      else { setJournal(null); renderer.domElement.requestPointerLock?.()?.catch?.(() => {}) }
    }
    // ── Door 199: the overgrown room. Everyone, sitting still, wrapped in glowing vines. ──
    const overgrowth = new THREE.Group()
    overgrowth.visible = false
    scene.add(overgrowth)
    const overRoom = startFloor === 4 ? state.rooms[BOSS_ROOM - 1] : null
    const spores = []
    if (overRoom?.statues) {
      const green = new THREE.Color(0x6aff7a)
      // tint every one of them a sickly, faintly glowing green (this run only)
      for (const st of overRoom.statues) {
        monsters[st.id].group.traverse(o => {
          for (const mm of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
            if (mm.userData.vined) continue
            mm.userData.vined = true
            if (mm.color) mm.color.lerp(new THREE.Color(0x3a6a3a), 0.45)
            if (mm.emissive) { mm.emissive.setHex(0x1f7a2a); mm.emissiveIntensity = 0.35 }
            else if (mm.color) mm.color.lerp(green, 0.25)
          }
        })
      }
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x142a0e, roughness: 0.95, emissive: 0x2aff4a, emissiveIntensity: 0.05 })
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e4a18, roughness: 0.85, emissive: 0x2aff4a, emissiveIntensity: 0.12, side: THREE.DoubleSide })
      const moundMat = new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 1 })
      const sporeMat = new THREE.MeshBasicMaterial({ color: 0x9aff9a, transparent: true, opacity: 0.8 })
      overRoom.statues.forEach((st, k) => {
        const m = monsters[st.id]
        const cage = new THREE.Group()
        cage.position.set(st.x, 0, st.z)
        if (!m.noStool) cage.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.42, 10), moundMat).translateY(0.21))
        // vines spiralling up around them, with leaves
        for (let v = 0; v < 3; v++) {
          const pts = []
          for (let j = 0; j <= 30; j++) {
            const a = j * 0.55 + v * 2.1, y = j * 0.06, r = 0.42 - j * 0.004 + Math.sin(j * 0.7 + v) * 0.05
            pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
          }
          cage.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.028, 5), vineMat))
          for (let j = 2; j < 30; j += 3) {
            const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.07, 5), leafMat)
            leaf.position.copy(pts[j]).multiplyScalar(1.08)
            leaf.rotation.set(Math.random() * 3, Math.random() * 3, 0)
            cage.add(leaf)
          }
        }
        // a few creeping runners across the ground toward the walkway
        for (let r = 0; r < 2; r++) {
          const len = 0.8 + Math.random() * 1.2
          const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, len, 5), moundMat)
          runner.rotation.z = Math.PI / 2; runner.rotation.y = (st.x < 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8
          runner.position.set(Math.cos(runner.rotation.y) * len / 2, 0.02, -Math.sin(runner.rotation.y) * len / 2)
          cage.add(runner)
        }
        overgrowth.add(cage)
        for (let q = 0; q < 2; q++) {
          const sp = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), sporeMat)
          sp.userData = { x: st.x, z: st.z, ph: Math.random() * 10 }
          overgrowth.add(sp); spores.push(sp)
        }
      })
      // a soft green light hanging over each row
      for (const x of [-4.5, 4.5]) for (const zf of [0.3, 0.7]) {
        const l = new THREE.PointLight(0x5aff6a, 3, 10, 1.6)
        l.position.set(x, 2.4, overRoom.z0 - overRoom.len * zf)
        overgrowth.add(l)
      }
    }
    const cart = buildMinecart()
    cart.visible = false
    scene.add(cart)
    const rooms = state.rooms
    const itemById = new Map()
    rooms.forEach(r => r.interactables.forEach(it => itemById.set(it.id, it)))
    advanceRef.current = () => advanceDialogue(state)
    shopRef.current = {
      buy: (id) => { if (buyItem(state, id)) sfx.coin() },
      close: () => { closeShop(state); renderer.domElement.requestPointerLock?.()?.catch?.(() => {}) },
    }
    if (import.meta.env.DEV) { window.__horrorGame = { state, triggerCatch, THREE, scene, camera }; window.__startGardener = startGardener }

    // ── Rooms near the player are built; far ones are disposed. ──
    const built = new Map()
    function syncRooms(cur) {
      const lo = Math.max(0, cur - 2), hi = Math.min(rooms.length - 1, cur + 3)
      for (const [i, b] of built) {
        if (i < lo || i > hi) { scene.remove(b.group); disposeRoom(b); built.delete(i) }
      }
      for (let i = lo; i <= hi; i++) {
        if (!built.has(i)) {
          const b = buildRoom(rooms[i], rooms[i - 1], rooms[i + 1], assets)
          scene.add(b.group)
          built.set(i, b)
        }
      }
    }

    // ── Input ──
    const keys = new Set()
    const input = { yawDelta: 0, pitchDelta: 0, interact: false, advance: false, useItem: false, toggleLight: false }
    const GAME_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyC', 'KeyQ', 'KeyJ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight']
    function onKeyDown(e) {
      if (GAME_CODES.includes(e.code)) e.preventDefault()
      sfx.unlockAudio()
      if (e.repeat) return
      if (e.code === 'KeyJ') { journalRef.current.toggle(); return }
      if (state.paused) { if (e.code === 'Escape') journalRef.current.toggle(); return }
      if (state.shopOpen) {
        if (e.code === 'KeyE' || e.code === 'Escape') shopRef.current.close()
        return
      }
      if (e.code === 'KeyQ') input.useItem = true
      if (e.code === 'KeyE') input.interact = true
      if (e.code === 'KeyF') input.toggleLight = true
      if (e.code === 'Space' || e.code === 'Enter') input.advance = true
      keys.add(e.code)
    }
    function onKeyUp(e) { keys.delete(e.code) }
    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      input.yawDelta -= e.movementX * MOUSE_SENSITIVITY
      input.pitchDelta -= e.movementY * MOUSE_SENSITIVITY
    }
    function onClick() {
      sfx.unlockAudio()
      if (state.dialogue) { input.advance = true; return }
      if (state.shopOpen || state.paused) return
      // already looking around? then a click is a "use" — that's how you poke at shelves, pop balloons…
      if (document.pointerLockElement === renderer.domElement) { input.interact = true; return }
      if (!state.won) renderer.domElement.requestPointerLock?.()?.catch?.(() => {})
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('click', onClick)
    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // ── Per-frame helpers ──
    let flickerMul = 1, flickerT = 0
    const tmpV = new THREE.Vector3()
    let eyeY = state.player.eyeY

    function placeLights() {
      const p = state.player
      const spots = []
      for (let r = Math.max(0, p.room - 1); r <= Math.min(rooms.length - 1, p.room + 2); r++) {
        const room = rooms[r]
        if (room.dark) continue
        if (room.type === 'halt') {
          // Lights ride along with the player so the endless hallway's wrap is seamless.
          const k0 = Math.round((room.z0 - 2 - p.z) / 3)
          for (let k = k0 - 1; k <= k0 + 1; k++) {
            const z = room.z0 - 2 - k * 3
            if (z < room.z0 && z > room.z1) spots.push({ x: 0, y: 2.1, z, i: 0.5, room: r })
          }
        } else {
          lightSpots(room).forEach(s => spots.push({ x: s.x, y: ROOM_H - 0.6, z: s.z, i: room.type === 'library' ? 1.3 : 1, room: r }))
        }
      }
      spots.sort((a, b) => Math.abs(a.z - p.z) - Math.abs(b.z - p.z))
      const flickerRooms = state.flicker
      pool.forEach((l, i) => {
        const s = spots[i]
        if (!s) { l.intensity = 0; return }
        l.position.set(s.x, s.y, s.z)
        const fm = flickerRooms && Math.abs(s.room - p.room) <= 1 ? flickerMul : 1
        l.intensity = 9 * s.i * fm
      })
      for (const [i, b] of built) {
        const room = rooms[i]
        const fm = flickerRooms && Math.abs(i - p.room) <= 1 ? flickerMul : 1
        b.extra.fixtureMat.emissiveIntensity = room.dark ? 0 : 1.4 * fm
      }
    }

    function updateFog() {
      const p = state.player
      const room = rooms[p.room]
      let col = 0x060407, near = 8, far = 34
      const outside = room.floor === 4 && room.type !== 'elevator'
      moon.visible = outside
      hemi.intensity = outside ? 0.95 : 0.45
      hemi.color.setHex(outside ? 0x8aa0d0 : 0x8a7a9a)
      if (outside) {
        col = 0x0a1430; near = 10; far = 42
        const b = state.ev.boss
        if (b && room.type === 'boss' && b.phase !== 'done') { col = b.phase === 'intro' ? 0x1a0a20 : 0x3a0606; near = 8; far = 38; hemi.color.setHex(0xd04a3a) }
        moon.position.set(p.x + 30, 38, p.z - 60)
        moon.material.color.setHex(b && room.type === 'boss' && b.phase !== 'done' && b.phase !== 'intro' ? 0xff3a2a : 0xf4f0dc)
      } else if (room.type === 'halt') {
        col = 0x0c1a2e
        if (state.ev.halt.phase === 'active') { near = 1; far = 6.5 } else { near = 3; far = 16 }
      } else if (room.dark) { near = 3; far = 14 }
      scene.fog.color.setHex(col)
      scene.background.setHex(col)
      scene.fog.near += (near - scene.fog.near) * 0.1
      scene.fog.far += (far - scene.fog.far) * 0.1
    }

    function showMonster(id, x, y, z, faceYaw, t, opts) {
      const m = monsters[id]
      m.group.visible = true
      m.group.position.set(x, y, z)
      m.group.rotation.y = faceYaw
      poseMonster(m, t, opts)
      return m
    }

    // ── Floor 4: the Gardener (one man, many moods) and the Harvester ──
    function updateGarden(t) {
      crows.forEach(c => { c.group.visible = false })
      mower.visible = false; lane.visible = false; sweepMesh.visible = false
      thornDiscs.forEach(d => { d.visible = false }); thornSpikes.forEach(s2 => { s2.visible = false })
      if (state.sitting) return
      const p = state.player, g = state.ev.gard, b = state.ev.boss
      if (g) {
        const room = rooms[g.room]
        const show = (pose, y = 0) => showMonster('gardener', g.x, y, g.z, g.faceYaw, t, { pose, moving: g.moving })
        if (g.mood === 'prune') show(g.heard ? 'stare' : 'prune')
        else if (g.mood === 'watch') show('stare')
        else if (g.mood === 'chase' && g.phase === 'run') show('walk')
        else if (g.mood === 'whisper') show('whisper')
        else if (g.mood === 'wave') show('wave')
        else if (g.mood === 'scarecrows') {
          g.crows.forEach((c, k) => {
            const cr = crows[k]
            cr.group.visible = true
            cr.group.position.set(c.x, 0, c.z)
            cr.group.rotation.y = Math.atan2(p.x - c.x, p.z - c.z) * 0.15 // they all sort of face you
            cr.head.rotation.y = k === g.real ? Math.atan2(p.x - c.x, p.z - c.z) - cr.group.rotation.y : Math.sin(t * 0.7 + k) * 0.05
          })
        } else if (g.mood === 'mower') {
          lane.visible = true
          lane.scale.y = room.len
          lane.position.set(g.lane, 0.03, (room.z0 + room.z1) / 2)
          laneMat.opacity = g.phase === 'warn' ? 0.25 + Math.abs(Math.sin(t * 8)) * 0.3 : 0.35
          if (g.phase === 'run') {
            mower.visible = true
            mower.position.set(g.lane, 0, g.z)
            mower.rotation.y = 0
            show('mow', 0.45)
          }
        }
      }
      if (b && b.phase !== 'done') {
        const room = rooms[BOSS_ROOM]
        if (b.phase === 'intro') {
          // he stands there… then grows
          const k = 1 - b.t / 5
          if (k < 0.45) showMonster('gardener', b.x, 0, b.z, Math.atan2(p.x - b.x, p.z - b.z), t, { pose: 'stare' })
          else showMonster('harvester', b.x, 0, b.z, Math.atan2(p.x - b.x, p.z - b.z), t, { grow: Math.min(1, (k - 0.45) / 0.5) + Math.sin(t * 40) * 0.03 })
        } else {
          const a = b.attack
          const windup = a ? 1 - a.t / a.total : 0
          showMonster('harvester', b.x, 0, b.z, b.faceYaw, t, { windup: a && a.kind === 'sweep' ? Math.max(0, windup) : 0, strike: b.strikeFlash > 0 && b.lastStrike?.kind === 'sweep' ? 1 : 0, weak: b.phase === 'weak' })
          if (a && a.kind === 'sweep') {
            const key = `${a.r}|${a.half}`
            if (key !== sweepKey) { sweepMesh.geometry.dispose(); sweepMesh.geometry = new THREE.CircleGeometry(a.r, 40, -a.half, a.half * 2); sweepKey = key }
            sweepMesh.visible = true
            sweepMesh.position.set(a.x, 0.04, a.z)
            // CircleGeometry's angle 0 points along +X; after laying it flat, rotate so the wedge points along `ang`
            sweepMesh.rotation.set(-Math.PI / 2, 0, a.ang - Math.PI / 2)
          }
          if (a && a.kind === 'thorns') a.spots.forEach((sp, k) => { const d = thornDiscs[k]; if (!d) return; d.visible = true; d.scale.setScalar(a.r); d.position.set(sp.x, 0.04, sp.z) })
          dangerMat.opacity = a ? 0.25 + Math.abs(Math.sin(t * (6 + (1 - (a.t || 0)) * 14))) * 0.35 : 0.4
          if (b.strikeFlash > 0 && b.lastStrike?.kind === 'thorns') b.lastStrike.spots.forEach((sp, k) => { const s2 = thornSpikes[k]; if (!s2) return; s2.visible = true; s2.position.set(sp.x, (b.strikeFlash - 0.4) * 2, sp.z) })
        }
        void room
      }
      if (b && b.phase === 'done' && !state.sitting) {
        // afterwards he's just a little man in a hat again, sitting by the warm fire
        showMonster('gardener', b.x, 0, b.z, Math.atan2(p.x - b.x, p.z - b.z), t, { pose: 'wave' })
      }
    }

    function updateMonsters(t) {
      Object.values(monsters).forEach(m => { m.group.visible = false; m.group.rotation.set(0, 0, 0) })
      steam.visible = false
      updateGarden(t)
      if (overRoom) {
        overgrowth.visible = built.has(overRoom.index)
        if (overgrowth.visible && !state.sitting) {
          overRoom.statues.forEach((st, k) => {
            const m = monsters[st.id]
            // frozen mid-moment: each pinned at its own instant, barely breathing
            const frozenT = k * 3.7 + Math.sin(t * 0.3 + k) * 0.05
            showMonster(st.id, st.x, m.noStool ? 0 : -m.sitDrop + 0.42, st.z, st.faceYaw + Math.sin(k * 1.9) * 0.25, frozenT, { sitting: true })
            m.group.rotation.x = 0.12 // heads slightly bowed
          })
          spores.forEach(sp => { const u = sp.userData, f = (t * 0.15 + u.ph) % 1; sp.position.set(u.x + Math.sin(t * 0.5 + u.ph) * 0.4, 0.3 + f * 2.4, u.z + Math.cos(t * 0.4 + u.ph) * 0.4); sp.material.opacity = 0.8 * (1 - f) })
        }
      }
      {
        const ev = state.ev, p = state.player
        const pf = ev.puff
        if (pf && pf.phase === 'blast' && !state.dialogue) {
          const r = rooms[pf.room]
          const cz = r.z0 + (r.z1 - r.z0) * pf.s
          steam.visible = true
          steam.scale.x = r.hw * 2
          steam.position.set(0, 2.15, cz)
          steamMat.opacity = 0.45 + Math.sin(t * 20) * 0.08
          showMonster('puff', 0, 1.0, cz, Math.PI, t, { moving: true }) // rides the front of his own steam cloud
        }
        const tw = ev.twirl
        if (tw && !state.dialogue) showMonster('twirl', tw.x, 0, tw.z, Math.atan2(p.x - tw.x, p.z - tw.z), t, { dancing: tw.phase === 'dance' })
        const bu = ev.bumpus
        if (bu && bu.phase === 'run' && !state.dialogue) showMonster('bumpus', 0, 0, bu.z, 0, t, { moving: true })
      }
      cart.visible = false
      const bats = state.ev.bats
      swarm.forEach((b, i) => {
        const on = bats && (bats.phase === 'swarm' || (bats.phase === 'warning' && i % 3 === 0))
        b.visible = !!on && !state.dialogue
        if (!b.visible) return
        const a = b.userData.ph + t * (1.5 + (i % 3) * 0.4)
        const r = bats.phase === 'warning' ? b.userData.r + 3 : b.userData.r
        b.position.set(state.player.x + Math.cos(a) * r, b.userData.h + Math.sin(t * 3 + i) * 0.2, state.player.z + Math.sin(a) * r)
        b.rotation.y = -a
        b.children.forEach(c => { if (c.userData.sx) c.rotation.x = Math.sin(t * 25 + i) * 0.8 })
      })
      stool.visible = false
      monsterLight.intensity = 0
      const p = state.player
      const faceP = (x, z) => Math.atan2(p.x - x, p.z - z)
      const ev = state.ev
      if (state.sitting) {
        const s = state.sitting
        const m = monsters[s.id]
        const pose = s.id === 'gardener' ? (state.bossDefeated ? 'wave' : 'stare') : undefined
        showMonster(s.id, s.x, m.noStool ? 0 : -m.sitDrop + 0.42, s.z, s.faceYaw, t, { sitting: s.id !== 'gardener', pose })
        stool.visible = !m.noStool
        stool.position.set(s.x, 0, s.z)
        return
      }
      if (ev.rush && ev.rush.phase === 'running') showMonster('barry', ev.rush.x, 0, ev.rush.z, Math.atan2(ev.rush.dirX, ev.rush.dirZ), t, { moving: true, speed: 2.2 })
      if (ev.eyes) {
        showMonster('drakko', ev.eyes.x, 0.25 + Math.sin(t * 1.5) * 0.08, ev.eyes.z, faceP(ev.eyes.x, ev.eyes.z), t, {})
        monsterLight.position.set(ev.eyes.x, ev.eyes.y, ev.eyes.z)
        monsterLight.intensity = 3 + Math.max(0, state.hypno) * 6
      }
      if (ev.screech && ev.screech.phase === 'active') showMonster('steve', ev.screech.x, Math.sin(t * 3) * 0.04, ev.screech.z, faceP(ev.screech.x, ev.screech.z), t, {})
      if (ev.halt.wendell) showMonster('wendell', ev.halt.wendell.x, 0, ev.halt.wendell.z, faceP(ev.halt.wendell.x, ev.halt.wendell.z), t, { moving: true, speed: 0.6 })
      if (ev.seek.phase === 'active') showMonster('gary', ev.seek.x, 0, ev.seek.z, Math.atan2(ev.seek.dirX, ev.seek.dirZ), t, { moving: true, speed: 1.3 })
      if (ev.ambush && ev.ambush.phase === 'running') showMonster('doris', ev.ambush.x, 0, ev.ambush.z, Math.atan2(ev.ambush.dirX, ev.ambush.dirZ), t, { moving: true })
      if (ev.gus) showMonster('gus', ev.gus.x, 0, ev.gus.z, ev.gus.faceYaw, t, { moving: ev.gus.moving })
      for (const shopIdx of [SHOP_ROOM, SHOP2_ROOM, SHOP3_ROOM]) {
        if (rooms[shopIdx]?.type !== 'shop') continue
        if (!built.has(shopIdx)) continue
        const sk = rooms[shopIdx].shopkeeper
        showMonster('gloria', sk.x, 0.55, sk.z, Math.PI / 2, t, {}) // standing on a crate behind the counter
        const sec = rooms[shopIdx].secret
        if (sec?.doorOpen && state.sitting?.id !== sec.npc) showMonster(sec.npc, sec.npcPos.x, 0, sec.npcPos.z, -Math.PI / 2, t, {})
      }
      if (ev.cold) {
        // she peeks in from the far end of the room, blowing a chilly breeze
        const cr = rooms[ev.cold.room]
        const yx = (cr.entryX + cr.exitX) / 2, yz = cr.z1 + 1.2
        showMonster('yolanda', yx, 0, yz, faceP(yx, yz), t, { moving: false })
      }
      if (ev.shelly) showMonster('shelly', ev.shelly.x, 0, ev.shelly.z, Math.atan2(ev.shelly.dirX, ev.shelly.dirZ), t, { moving: true })
      if (ev.coco && built.has(ev.coco.room)) {
        const c = ev.coco
        showMonster('coco', c.x, 0, c.z, c.x < 0 ? Math.PI / 2 : -Math.PI / 2, t, { striking: Math.max(0, 1 - c.t / 7) })
      }
      if (ev.mirror) {
        const m = ev.mirror
        showMonster('marvin', m.x, 0, m.z, m.side < 0 ? Math.PI / 2 : -Math.PI / 2, t, { mimic: p.yaw * 2 + p.bob })
      }
      if (ev.nibbles) showMonster('nibbles', ev.nibbles.x, 0, ev.nibbles.z, ev.nibbles.faceYaw, t, { moving: true })
      if (ev.bubbles) showMonster('bubbles', ev.bubbles.x, 0, ev.bubbles.z, faceP(ev.bubbles.x, ev.bubbles.z), t, { size: ev.bubbles.size ?? 0 })
      if (ev.hank) {
        // hanging upside down from the ceiling by his feet
        const m = showMonster('hank', ev.hank.x, ROOM_H - 0.02, ev.hank.z, faceP(ev.hank.x, ev.hank.z), t, {})
        m.group.rotation.set(0, faceP(ev.hank.x, ev.hank.z), Math.PI)
        m.group.position.y = ROOM_H + 0.05
        m.group.rotation.z = Math.PI + Math.sin(t * 2) * 0.12
      }
      const room = rooms[p.room]
      for (const md of room.mounds || []) {
        if (md.phase !== 'rumble') continue
        const rise = 1 - md.t / DOUG_RUMBLE
        showMonster('doug', md.x, -2.2 + rise * 0.9, md.z, faceP(md.x, md.z), t, {})
      }
      if (ev.seek2.phase === 'active') {
        const yaw = Math.atan2(ev.seek2.dirX, ev.seek2.dirZ)
        showMonster('gary', ev.seek2.x, 0.35, ev.seek2.z, yaw, t, {})
        cart.visible = true
        cart.position.set(ev.seek2.x, 0, ev.seek2.z)
        cart.rotation.y = yaw
      }
      if (ev.figure && Math.abs(p.room - LIBRARY_ROOM) <= 1) {
        const f = ev.figure
        showMonster('reginald', f.x, 0, f.z, f.faceYaw, t, { moving: f.listen <= 0 && f.path.length > 0, speed: f.mode === 'hunt' ? 1.2 : 0.7 })
      }
    }

    function updateRoomBits(dt) {
      const camPos = camera.position
      for (const [i, b] of built) {
        const room = rooms[i]
        for (const [id, d] of b.extra.drawers) {
          const it = itemById.get(id)
          const target = d.baseX + d.dir * (it.opened ? 0.32 : 0)
          d.mesh.position.x += (target - d.mesh.position.x) * Math.min(1, dt * 10)
        }
        for (const [id, pg] of b.extra.pages) pg.visible = !itemById.get(id).taken
        if (b.extra.rope) b.extra.rope.visible = !room.unlocked
        if (b.extra.closedDoor) b.extra.closedDoor.visible = !room.unlocked
        if (b.extra.entryLeaves) b.extra.entryLeaves.visible = rooms[b.extra.entryLockRoom].unlocked
        if (b.extra.braziers) for (const [id, br] of b.extra.braziers) {
          const lit = itemById.get(id).lit
          br.fire.visible = lit
          br.glow.intensity = lit ? 7 + Math.sin(performance.now() / 70 + id.length) * 1.5 : 0
          if (lit) br.fire.children.forEach((f, k) => { f.scale.y = 0.8 + Math.sin(performance.now() / 90 + k) * 0.25 })
        }
        if (b.extra.vines) b.extra.vines.visible = !!room.backClosed
        if (b.extra.bell && state.ev.boss?.phase === 'done') b.extra.bell.rotation.z = Math.sin(performance.now() / 120) * 0.3
        if (b.extra.fireflies) b.extra.fireflies.forEach(ff => { const u = ff.userData; const tt = performance.now() / 1000 + u.ph; ff.position.set(u.base.x + Math.sin(tt * 0.7) * 0.6, u.base.y + Math.sin(tt * 1.3) * 0.3, u.base.z + Math.cos(tt * 0.5) * 0.6); ff.visible = Math.sin(tt * 2) > -0.3 })
        if (b.extra.secretShelf) {
          const sec = room.secret
          if (sec.clicks !== b.extra.lastClicks) { b.extra.lastClicks = sec.clicks; b.extra.wobbleT = 0.45 }
          b.extra.wobbleT = Math.max(0, (b.extra.wobbleT || 0) - dt)
          const target = sec.opened ? -Math.PI / 2 : Math.sin(b.extra.wobbleT * 40) * 0.05 * (b.extra.wobbleT / 0.45)
          const pv = b.extra.secretShelf
          pv.rotation.y += (target - pv.rotation.y) * Math.min(1, dt * (sec.opened ? 2.5 : 30))
        }
        if (b.extra.secretDoor) b.extra.secretDoor.visible = !room.secret.doorOpen
        // elevator sliding doors
        const slide = (pair, open) => pair?.forEach(d => {
          const target = d.userData.baseX + d.userData.sx * (open ? 0.75 : 0)
          d.position.x += (target - d.position.x) * Math.min(1, dt * 4)
        })
        slide(b.extra.elevFront, room.unlocked)
        slide(b.extra.elevBack, !room.backClosed)
        if (b.extra.valves) for (const [id, w] of b.extra.valves) {
          const it = itemById.get(id)
          if (it.turned && w.rotation.x < Math.PI * 4) w.rotation.x += dt * 4 // spins a couple of turns, then stops
        }
        if (b.extra.mounds) for (const { mesh, data } of b.extra.mounds) {
          const shake = data.phase === 'rumble' ? 0.04 : 0
          mesh.position.x = data.x + (Math.random() - 0.5) * shake
          mesh.position.z = data.z + (Math.random() - 0.5) * shake
        }
        if (Math.abs(i - state.player.room) <= 1) {
          for (const eye of b.extra.eyes) {
            tmpV.copy(camPos)
            eye.worldToLocal(tmpV)
            tmpV.normalize()
            const s = eye.userData.size
            eye.userData.pupil.position.set(tmpV.x * s * 0.45, tmpV.y * s * 0.45, s * 0.3)
          }
        }
      }
    }

    // ── HUD (React state only when something visible changed) ──
    let lastHudKey = ''
    let lastDlgKey = ''
    function pushHud() {
      const p = state.player
      const dlg = state.dialogue
      const dlgKey = dlg ? `${dlg.monsterId}:${dlg.lineIndex}` : ''
      const h = {
        room: p.room + 1,
        coins: state.coins,
        hasPass: state.hasPass,
        pages: state.pages,
        showPages: p.room >= LIBRARY_ROOM - 1 && p.room <= LIBRARY_ROOM && !rooms[LIBRARY_ROOM].unlocked,
        valves: state.valves,
        showValves: p.room >= BOILER_ROOM - 1 && p.room <= BOILER_ROOM && !rooms[BOILER_ROOM].unlocked,
        lightOff: !p.lightOn,
        frost: Math.round((state.frost || 0) * 20) / 20,
        journalOpen: state.paused,
        time: Math.floor(state.elapsed * 10) / 10,
        bossOn: !!state.ev.boss && state.ev.boss.phase !== 'done' && state.ev.boss.phase !== 'intro',
        hearts: state.ev.boss?.hearts ?? 0,
        hurt: (state.ev.boss?.hitFlash ?? 0) > 0,
        lit: state.ev.boss?.lit ?? 0,
        prompt: dlg ? null : promptFor(state, state.focus),
        caption: state.caption?.text ?? null,
        tone: state.caption?.tone ?? 'info',
        hidden: !!p.hidden,
        hypno: Math.round(state.hypno * 20) / 20,
        turnCue: state.turnCue > 0,
        sneaking: p.sneaking && !p.hidden,
        locked: document.pointerLockElement === renderer.domElement,
        dlgKey,
        dark: rooms[p.room].dark,
        inv: { ...state.inventory },
        boost: p.boostT > 0,
        rattle: !!state.ev.mildred,
        shopOpen: state.shopOpen,
      }
      h.invKey = JSON.stringify(h.inv)
      const key = HUD_KEYS.map(k => (k === 'inv' ? h.invKey : h[k])).join('|')
      if (key !== lastHudKey) { lastHudKey = key; setHud(h) }
      if (dlgKey !== lastDlgKey) {
        lastDlgKey = dlgKey
        setDialogue(dlg ? { freed: !!dlg.talk, monster: MONSTER_DEFS[dlg.monsterId], line: dlg.lines[dlg.lineIndex], isLast: dlg.lineIndex >= dlg.lines.length - 1, first: dlg.lines.length > 1 } : null)
      }
    }

    // ── Sounds keyed off state transitions ──
    const prev = { shop: false, ambushPhase: null, caption: null, rushPhase: null, turnCue: false, dialogue: false, coins: 0, pages: 0, pass: false, seek: 'idle', opened: 0 }
    function sounds() {
      const capText = state.caption?.text ?? null
      if (capText !== prev.caption && capText === '*psst*') sfx.psst()
      prev.caption = capText
      const rp = state.ev.rush?.phase ?? null
      if (rp !== prev.rushPhase) { if (rp === 'warning') sfx.rumble(); if (rp === 'running') sfx.whoosh() }
      prev.rushPhase = rp
      const ap = state.ev.ambush?.phase ?? null
      if (ap !== prev.ambushPhase) { if (ap === 'warning') sfx.rumble(5.5); if (ap === 'running') sfx.whoosh() }
      prev.ambushPhase = ap
      if (state.shopOpen && !prev.shop) { sfx.chime(); document.exitPointerLock?.() }
      prev.shop = state.shopOpen
      if (state.ev.puff && !prev.puff) sfx.hiss()
      prev.puff = !!state.ev.puff
      const twPhase = state.ev.twirl?.phase ?? null
      if (twPhase === 'dance' && prev.twirl !== 'dance') sfx.musicBox()
      prev.twirl = twPhase
      if (state.ev.bumpus && !prev.bumpus) sfx.honk()
      prev.bumpus = !!state.ev.bumpus
      if (state.ev.nibbles && !prev.nibbles) sfx.squeak()
      prev.nibbles = !!state.ev.nibbles
      if (state.ev.cold && !prev.cold) sfx.wind()
      prev.cold = !!state.ev.cold
      if ((state.shortcuts || 0) > (prev.shortcuts || 0)) { sfx.whoosh(); sfx.creak(true); setFlash(f => f + 1) }
      prev.shortcuts = state.shortcuts || 0
      const gm = state.ev.gard ? state.ev.gard.mood + (state.ev.gard.phase || '') : null
      if (gm && gm !== prev.gard) {
        const m = state.ev.gard.mood
        if (m === 'prune' || m === 'chase') sfx.snip()
        if (m === 'whisper') sfx.psst()
        if (m === 'mower') sfx.rumble(2)
      }
      prev.gard = gm
      const bp = state.ev.boss?.phase ?? null
      if (bp !== prev.boss) { if (bp === 'intro') sfx.rumble(5); if (bp === 'fight') sfx.roar(); if (bp === 'weak') sfx.roar(); if (bp === 'done') sfx.bell() }
      prev.boss = bp
      const sk = state.ev.boss?.attack ? state.ev.boss.attack.kind : null
      if (sk && sk !== prev.bossAtk) sfx.whoosh()
      prev.bossAtk = sk
      const litN = state.ev.boss?.lit ?? 0
      if (litN > (prev.lit ?? 0)) { sfx.roar(); sfx.chime() }
      prev.lit = litN
      const hearts = state.ev.boss?.hearts ?? BOSS_HEARTS
      if (hearts < (prev.hearts ?? BOSS_HEARTS)) sfx.pop()
      prev.hearts = hearts
      if (!state.ev.bubbles && prev.bubbles && !state.dialogue) sfx.pop()
      if (state.dialogue?.monsterId === 'bubbles' && prev.bubbles) sfx.pop()
      prev.bubbles = !!state.ev.bubbles
      const secClicks = (rooms[SHOP_ROOM].secret?.clicks ?? 0) + (rooms[SHOP2_ROOM].secret?.clicks ?? 0)
      if (secClicks > (prev.secClicks ?? 0)) sfx.creak(secClicks >= 3)
      prev.secClicks = secClicks
      // keep the saved journal up to date as things happen
      const rk = runKey(state)
      if (rk !== lastRunKey) { lastRunKey = rk; commitRun(journalBase, state) }
      const tc = state.turnCue > 0
      if (tc && !prev.turnCue) sfx.turnAround()
      prev.turnCue = tc
      const dl = !!state.dialogue
      if (dl && !prev.dialogue) sfx.sadTrombone()
      prev.dialogue = dl
      if (state.coins > prev.coins) sfx.coin()
      prev.coins = state.coins
      if (state.pages > prev.pages || (state.hasPass && !prev.pass)) sfx.chime()
      prev.pages = state.pages; prev.pass = state.hasPass
      if (state.ev.seek.phase === 'active' && prev.seek !== 'active') sfx.whoosh()
      prev.seek = state.ev.seek.phase
    }

    // ── Main loop ──
    let raf = 0
    let last = performance.now()
    let wonSent = false
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000

      const frameInput = {
        forward: keys.has('KeyW') || keys.has('ArrowUp'),
        back: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA'),
        right: keys.has('KeyD'),
        turnLeft: keys.has('ArrowLeft'),
        turnRight: keys.has('ArrowRight'),
        sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC'),
        yawDelta: input.yawDelta,
        pitchDelta: input.pitchDelta,
        interact: input.interact,
        advance: input.advance,
        useItem: input.useItem,
        toggleLight: input.toggleLight,
      }
      input.yawDelta = 0; input.pitchDelta = 0; input.interact = false; input.advance = false; input.useItem = false; input.toggleLight = false
      const openedBefore = countOpened()
      stepGame(state, frameInput, dt)
      if (countOpened() > openedBefore) sfx.drawer()
      sounds()

      const p = state.player
      syncRooms(p.room)

      flickerT -= dt
      if (flickerT <= 0) { flickerMul = Math.random() < 0.45 ? 0.05 : 0.6 + Math.random() * 0.4; flickerT = 0.04 + Math.random() * 0.12 }
      placeLights()
      updateFog()

      eyeY += (p.eyeY - eyeY) * Math.min(1, dt * 10)
      const bob = p.moving ? Math.sin(p.bob) * 0.035 : 0
      if (p.hidden) {
        // Peek out from just past the closet's front, so we see the room
        // rather than the backs of the closet's own panels.
        const c = itemById.get(p.hidden)
        camera.position.set(c.x - Math.sin(c.faceYaw) * 0.06, eyeY, c.z - Math.cos(c.faceYaw) * 0.06)
      } else {
        camera.position.set(p.x, eyeY + bob, p.z)
      }
      const bo = state.ev.boss
      if (bo && (bo.phase === 'intro' || bo.strikeFlash > 0 || bo.hitFlash > 0)) {
        const k = bo.phase === 'intro' ? Math.max(0, 1 - bo.t / 5) * 0.06 : 0.08
        camera.position.x += (Math.random() - 0.5) * k
        camera.position.y += (Math.random() - 0.5) * k
      }
      if (state.ev.elevator.phase === 'ride') {
        camera.position.x += (Math.random() - 0.5) * 0.025
        camera.position.y += (Math.random() - 0.5) * 0.025
      }
      camera.rotation.y = p.yaw
      camera.rotation.x = p.pitch
      const flash = state.inventory.flashlight > 0
      lantern.intensity = !p.lightOn ? 0 : p.hidden ? 0.3 : rooms[p.room].dark ? (flash ? 7 : 3.2) : (flash ? 2.4 : 1.6)
      lantern.distance = flash ? 13 : 7

      updateMonsters(t)
      updateRoomBits(dt)
      renderer.render(scene, camera)
      // Snap a trading-card photo once the monster has settled onto its stool.
      if (state.dialogue && state.dialogue.lineIndex === 0 && !state.dialogue.photoTaken) {
        if (!photoPending) photoPending = 14
        else if (--photoPending === 0) {
          state.dialogue.photoTaken = true
          const url = snapPhoto(renderer.domElement)
          if (url) { prog = savePhoto(state.dialogue.monsterId, url); setFlash(f => f + 1); sfx.pop() }
        }
      }
      pushHud()

      achT -= dt
      if (achT <= 0 || (state.won && !wonSent)) { achT = 0.5; checkAchievements() }

      if (state.won && !wonSent) {
        wonSent = true
        document.exitPointerLock?.()
        onWinRef.current({
          seconds: state.elapsed,
          coins: state.coins,
          catches: state.catchCount,
          dodges: state.dodges,
          popped: state.popped,
          bossDefeated: state.bossDefeated,
          difficulty: state.difficulty,
          startFloor: state.startFloor,
          met: MONSTER_ORDER.filter(id => state.metIds.has(id)),
        })
      }
    }
    function countOpened() {
      let n = 0
      for (const it of itemById.values()) if (it.opened) n++
      return n
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      if (import.meta.env.DEV) delete window.__horrorGame
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.()
      for (const b of built.values()) disposeRoom(b)
      disposeMonsters(monsters)
      stool.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.() })
      overgrowth.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.() })
      for (const o of [steam, cart, mower, lane, sweepMesh, moon, ...thornDiscs, ...thornSpikes, ...crows.map(c => c.group), ...swarm]) o.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.() })
      assets.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  const toneClass = { warn: styles.capWarn, danger: styles.capDanger, good: styles.capGood }[hud.tone] || ''

  return (
    <div className={styles.playWrap}>
      <div ref={mountRef} className={styles.mount} />

      {hud.hidden && <div className={`${styles.closetOverlay} ${hud.rattle ? styles.rattle : ''}`}><span>{hud.rattle ? '💀 *rattle rattle* — GET OUT! (E)' : 'Hiding in a closet… (E to step out)'}</span></div>}
      {hud.frost > 0 && <div className={styles.frost} style={{ opacity: Math.min(1, 0.25 + hud.frost) }} />}
      {hud.hurt && <div className={styles.hurt} />}
      {hud.bossOn && (
        <div className={styles.bossBar}>
          <span>{'❤️'.repeat(Math.max(0, hud.hearts))}{'🖤'.repeat(Math.max(0, BOSS_HEARTS - hud.hearts))}</span>
          <span>🔥 {hud.lit}/4 braziers</span>
        </div>
      )}
      {hud.hypno > 0 && <div className={styles.hypno} style={{ opacity: Math.min(0.9, hud.hypno) }} />}
      {hud.turnCue && <div className={styles.turnCue}>TURN AROUND</div>}

      {!dialogue && !hud.hidden && <div className={styles.crosshair} />}
      {!dialogue && hud.prompt && <div className={styles.prompt}>{hud.prompt}</div>}
      {!dialogue && hud.caption && <div className={`${styles.caption} ${toneClass}`}>{hud.caption}</div>}

      <div className={styles.timer}>⏱️ {fmtTime(hud.time ?? 0)} <span className={styles.dim}>{DIFFICULTIES[difficulty]?.icon}</span></div>
      {flash > 0 && <div key={flash} className={styles.flash} />}
      <div className={styles.toastWrap}>
        {toasts.map(a => (
          <div key={a.key} className={styles.toast}><span className={styles.toastIcon}>{a.icon}</span><span><b>Achievement unlocked!</b><br />{a.name}</span></div>
        ))}
      </div>
      <div className={styles.hudTop}>
        <span>{doorLabel(hud.room - 1, startFloor)}</span>
        <span>🪙 {hud.coins ?? 0}</span>
        {hud.hasPass && <span>🎫 Staff Pass</span>}
        {hud.showPages && <span>📖 {hud.pages}/3</span>}
        {hud.showValves && <span>🔧 {hud.valves}/{VALVES_NEEDED}</span>}
        {hud.lightOff && <span className={styles.dim}>🌑 light off (F)</span>}
        {hud.sneaking && <span className={styles.dim}>🤫 sneaking</span>}
      </div>
      {hud.inv && SHOP_ITEMS.some(it => hud.inv[it.id] > 0) && (
        <div className={styles.invBar}>
          {SHOP_ITEMS.filter(it => hud.inv[it.id] > 0).map(it => (
            <span key={it.id} title={it.name}>
              {it.icon}{it.max > 1 ? `×${hud.inv[it.id]}` : ''}{it.id === 'vitamins' ? <span className={styles.dim}> (Q)</span> : ''}
            </span>
          ))}
          {hud.boost && <span className={styles.boost}>⚡ boosted!</span>}
        </div>
      )}

      {journal && <Journal journal={journal} onClose={() => journalRef.current.toggle()} />}

      {hud.shopOpen && (
        <div className={styles.shopWrap}>
          <div className={styles.shopBox}>
            <div className={styles.shopHead}>
              <span className={styles.shopTitle}>🛍️ Gloria's Gift Shop</span>
              <span className={styles.shopCoins}>🪙 {hud.coins} tips</span>
            </div>
            <p className={styles.shopGreet}>“{SHOPKEEPER.greet}”</p>
            <div className={styles.shopGrid}>
              {[...SHOP_ITEMS.filter(i => !i.costume), 'costumes', ...SHOP_ITEMS.filter(i => i.costume)].map(it => {
                if (it === 'costumes') return <div key="costumes" className={styles.journalFloor}>👔 Costumes — each one fools a certain monster, once</div>
                const owned = hud.inv?.[it.id] ?? 0
                const maxed = owned >= it.max
                const poor = hud.coins < it.price
                return (
                  <div key={it.id} className={styles.shopItem}>
                    <div className={styles.shopIcon}>{it.icon}</div>
                    <div className={styles.shopInfo}>
                      <b>{it.name}</b>
                      <span>{it.desc}</span>
                      <span className={styles.dim}>{it.max > 1 ? `You have ${owned} (max ${it.max})` : owned ? 'You have this' : ''}</span>
                    </div>
                    <button className={styles.shopBuy} disabled={maxed || poor} onClick={() => shopRef.current.buy(it.id)}>
                      {maxed ? 'Got it' : `🪙 ${it.price}`}
                    </button>
                  </div>
                )
              })}
            </div>
            <button className={styles.dialogueBtn} onClick={() => shopRef.current.close()}>Back to the hotel (E)</button>
          </div>
        </div>
      )}

      {!hud.locked && !dialogue && !hud.shopOpen && !journal && (
        <div className={styles.lockHint}>Click to look around · WASD move · E use/hide · Shift sneak · F light · Q vitamins · J journal</div>
      )}

      {dialogue?.monster.id === 'gardener' && !dialogue.freed && <div className={styles.gardenerDark} />}
      {dialogue && (
        <div className={styles.dialogueWrap}>
          <div className={`${styles.dialogueBox} ${dialogue.monster.id === 'gardener' && !dialogue.freed ? styles.gardenerBox : ''}`}>
            <div className={styles.dialogueHead}>
              <span className={styles.dialogueIcon}>{dialogue.monster.icon}</span>
              <span className={styles.dialogueName}>{dialogue.monster.name}</span>
              <span className={styles.dialogueTitle}>{dialogue.monster.title}</span>
            </div>
            <p className={styles.dialogueText}>{dialogue.line}</p>
            <button className={styles.dialogueBtn} onClick={() => advanceRef.current()}>
              {dialogue.monster.id === 'gardener' && !dialogue.freed ? '…wake up (Space)' : dialogue.isLast ? 'Let them get back to work (Space)' : 'Continue (Space)'}
            </button>
          </div>
        </div>
      )}

      <button className={styles.backLinkFloating} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => leaveRef.current()}>← Back to the Lobby</button>
    </div>
  )
}


export default function TotallyScaryHorrorGame() {
  const [screen, setScreen] = useState('lobby') // lobby | playing | won
  const [showTitle, setShowTitle] = useState(true)
  const [runKey, setRunKey] = useState(0)
  const [run, setRun] = useState({ floor: 1, difficulty: 'normal', coins: 0 })
  const [result, setResult] = useState(null)
  const [name, setName] = useState(() => loadProgress().settings.name || '')
  const [saved, setSaved] = useState(false)

  function start({ floor, difficulty }) {
    const prog = updateProgress(p => { p.stats.runs += 1 })
    // on localhost you always start with 50 tips (plus Grandma Bea's allowance)
    setRun({ floor, difficulty, coins: prog.perks.allowance ? LOBBY_ALLOWANCE : 0, base: isLocalhost() ? LOCAL_START_COINS : null })
    setResult(null)
    setSaved(false)
    setRunKey(k => k + 1)
    setScreen('playing')
  }
  function leave({ popped, coins }) {
    // whatever tips you carry out go in the lobby tip jar
    updateProgress(p => { p.stats.popped += popped || 0; p.wallet += coins || 0 })
    setScreen('lobby')
  }
  function won(r) {
    // escaping the attic opens up the garden
    updateProgress(p => { p.stats.escapes += 1; p.stats.popped += r.popped || 0; p.wallet += r.coins || 0; if (r.startFloor === 3) p.unlocks.floor4 = true })
    setResult(r)
    setScreen('won')
  }
  function saveRecord() {
    if (saved || !result) return
    const nm = name.trim().slice(0, 16) || 'Guest'
    addRecord({ name: nm, seconds: result.seconds, catches: result.catches, dodges: result.dodges, coins: result.coins, difficulty: result.difficulty, startFloor: result.startFloor, date: Date.now() })
    updateProgress(p => { p.settings.name = nm })
    setSaved(true)
  }

  // where this run lands on the scoreboard
  const place = result ? 1 + loadProgress().records.filter(r => r.startFloor === result.startFloor && r.seconds < result.seconds).length : 0

  return (
    <div className={styles.page}>
      {screen === 'lobby' && <Lobby showTitle={showTitle} onDismissTitle={() => setShowTitle(false)} onStart={start} />}

      {screen === 'playing' && (
        <GameView key={runKey} startFloor={run.floor} difficulty={run.difficulty} startCoins={run.coins} baseCoins={run.base} onWin={won} onLeave={leave} />
      )}

      {screen === 'won' && result && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>🌙 You Got Out!</h2>
          <div className={styles.bigTime}>⏱️ {fmtTime(result.seconds)}</div>
          <p className={styles.blurb}>
            {DIFFICULTIES[result.difficulty]?.icon} {DIFFICULTIES[result.difficulty]?.name} ·{' '}
            {result.startFloor === 1 ? `all ${DOORS_PER_FLOOR * 2} doors on both floors` : result.startFloor === 4 ? 'the whole garden — and you beat the Harvester' : result.startFloor === 3 ? `all ${DOORS_PER_FLOOR} doors of the attic` : `all ${DOORS_PER_FLOOR} doors of the basement`} ·{' '}
            🪙 {result.coins} tips · caught {result.catches} time{result.catches === 1 ? '' : 's'} · got away {result.dodges} time{result.dodges === 1 ? '' : 's'}
          </p>
          <p className={styles.blurb}>That's <b>#{place}</b> on the {result.startFloor === 1 ? 'full-run' : `Floor ${result.startFloor}`} scoreboard! Your {result.coins} tips went in the lobby tip jar.</p>
          {result.startFloor === 3 && <p className={styles.blurb}>🌙 Something opened up in the elevator… <b>Floor 4: the garden</b> is now unlocked.</p>}
          {!saved ? (
            <form className={styles.btnRow} onSubmit={e => { e.preventDefault(); saveRecord() }}>
              <input className={styles.nameInput} value={name} maxLength={16} placeholder="Your name" onChange={e => setName(e.target.value)} autoFocus />
              <button className={styles.bigBtn} type="submit">✍️ Sign the scoreboard</button>
            </form>
          ) : (
            <p className={styles.blurb}>✅ Signed! Check the ⏱️ scoreboard in the lobby.</p>
          )}
          <div className={styles.metRow}>
            {MONSTER_ORDER.filter(id => JOURNAL[id].floor !== 'secret').map(id => (
              <div key={id} className={`${styles.metCard} ${result.met.includes(id) ? '' : styles.metUnknown}`}>
                <div className={styles.metIcon}>{result.met.includes(id) ? MONSTER_DEFS[id].icon : '❔'}</div>
                <div className={styles.metName}>{result.met.includes(id) ? MONSTER_DEFS[id].name : 'never met'}</div>
              </div>
            ))}
          </div>
          <div className={styles.btnRow}>
            <button className={styles.bigBtn} onClick={() => { saveRecord(); start({ floor: result.startFloor, difficulty: result.difficulty }) }}>↻ Check In Again</button>
            <button className={styles.secondaryBtn} onClick={() => { saveRecord(); setScreen('lobby') }}>🏨 Back to the Lobby</button>
          </div>
        </div>
      )}
    </div>
  )
}
