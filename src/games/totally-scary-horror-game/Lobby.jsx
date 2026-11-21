import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './TotallyScaryHorrorGame.module.css'
import { MONSTER_DEFS, MONSTER_ORDER, MOUSE_SENSITIVITY, KEY_TURN_SPEED, WALK_SPEED, FLOOR3_PRICE, LOCAL_START_COINS } from './constants.js'
import { createAssets, worldBox, box, paletteFor } from './scene.js'
import { buildMonsters, buildStool, poseMonster, disposeMonsters } from './models.js'
import { loadJournal, markFaced } from './journal.js'
import { loadProgress, updateProgress, savePhoto, isLocalhost } from './progress.js'
import { newlyEarned, ACHIEVEMENTS } from './achievements.js'
import { snapPhoto } from './photo.js'
import Journal from './Journal.jsx'
import { ElevatorPanel, AchievementsPanel, AlbumPanel, RecordsPanel, fmtTime } from './Panels.jsx'
import * as sfx from './sfx.js'

// ── The Lobby ───────────────────────────────────────────────────────────
// A walkable 3D hub between runs (like the hotel-crawler games' lobby):
// the elevator starts a run, and the trophy case, journal lectern, photo
// album and scoreboard each open a panel. Every monster you've met sits in
// the "It's Just A Job" support-group circle in the middle. And if you say
// BOO to the fireplace… well.

const H = 4 // ceiling height
const HX = 8, HZ = 9 // half-size of the lobby
const R = 0.3 // player radius
const RING = { x: 0, z: 0.5, r: 4.4 }
// the Harvester never sits in the circle; the Gardener only joins once you've set him free
const SEATED = MONSTER_ORDER.filter(id => id !== 'bea' && id !== 'harvester')

const STATIONS = [
  { id: 'elevator', label: '🛗 Elevator', x: 0, z: -HZ + 1.0, ly: 3.1 },
  { id: 'trophies', label: '🏆 Trophy Case', x: -HX + 1.35, z: -4.5, ly: 2.6 },
  { id: 'journal', label: '📖 Monster Journal', x: -HX + 1.6, z: 4, ly: 1.9 },
  { id: 'album', label: '📷 Photo Album', x: HX - 1.7, z: -4.5, ly: 1.7 },
  { id: 'records', label: '⏱️ Scoreboard', x: HX - 1.1, z: 4, ly: 2.9 },
  { id: 'notice', label: '📌 Notice Board', x: 4.6, z: HZ - 1.0, ly: 2.6 },
]

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function signTex(lines, bg = '#2a1a10', fg = '#ffd76b', w = 512, h = 256) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    lines.forEach((l, i) => {
      ctx.font = `bold ${l.size || 30}px ${l.font || 'Georgia, serif'}`
      ctx.fillStyle = l.color || fg
      ctx.fillText(l.text, w / 2, l.y)
    })
  })
}

export default function Lobby({ onStart, showTitle, onDismissTitle }) {
  const mountRef = useRef(null)
  const [panel, setPanel] = useState(null)
  const [prompt, setPrompt] = useState(null)
  const [caption, setCaption] = useState(null)
  const [labels, setLabels] = useState([])
  const [locked, setLocked] = useState(false)
  const [dialogue, setDialogue] = useState(null)
  const [toasts, setToasts] = useState([])
  const [flash, setFlash] = useState(0)
  const [progress, setProgress] = useState(() => {
    // on localhost the tip jar is always topped back up to 50 when you come into the lobby
    if (isLocalhost()) return updateProgress(p => { if (p.wallet < LOCAL_START_COINS) p.wallet = LOCAL_START_COINS })
    return loadProgress()
  })
  const [journal, setJournal] = useState(() => loadJournal())
  const api = useRef({})
  const panelRef = useRef(null); panelRef.current = panel
  const titleRef = useRef(showTitle); titleRef.current = showTitle

  function closePanel() { setPanel(null); api.current.relock?.() }

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0608)
    scene.fog = new THREE.Fog(0x0a0608, 14, 40)
    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.05, 80)
    camera.rotation.order = 'YXZ'
    scene.add(new THREE.HemisphereLight(0xffe8d0, 0x3a2418, 0.9))
    const chandelier = new THREE.PointLight(0xffd6a0, 30, 22, 1.4)
    chandelier.position.set(0, H - 0.8, 0)
    scene.add(chandelier)
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      const l = new THREE.PointLight(0xffd6a0, 8, 12, 1.6)
      l.position.set(x, H - 0.5, z)
      scene.add(l)
    }
    const fireLight = new THREE.PointLight(0xff7a30, 8, 9, 1.5)
    fireLight.position.set(0, 1, HZ - 1.4)
    scene.add(fireLight)

    const A = createAssets()
    const world = new THREE.Group()
    scene.add(world)
    const own = [] // materials/textures made just for the lobby
    const mat = (m) => { own.push(m); return m }

    // ── Room shell ──
    const wallMat = A.wallMat(paletteFor({ type: 'lobby' }))
    world.add(worldBox(HX * 2, 0.1, HZ * 2, 0, -0.05, 0, A.marble, 1.6))
    world.add(worldBox(HX * 2, 0.1, HZ * 2, 0, H + 0.05, 0, A.ceiling, 1.5))
    world.add(worldBox(0.3, H, HZ * 2, -HX - 0.15, H / 2, 0, wallMat))
    world.add(worldBox(0.3, H, HZ * 2, HX + 0.15, H / 2, 0, wallMat))
    world.add(worldBox(HX * 2 + 0.6, H, 0.3, 0, H / 2, -HZ - 0.15, wallMat))
    // south wall, with a doorway hidden behind the fireplace
    world.add(worldBox(HX - 0.9 + 0.3, H, 0.3, -(HX + 0.9 + 0.3) / 2 + 0.0, H / 2, HZ + 0.15, wallMat))
    world.add(worldBox(HX - 0.9 + 0.3, H, 0.3, (HX + 0.9 + 0.3) / 2, H / 2, HZ + 0.15, wallMat))
    world.add(worldBox(1.8, H - 2.3, 0.3, 0, (H + 2.3) / 2, HZ + 0.15, wallMat))
    for (const sx of [-1, 1]) world.add(worldBox(0.03, 0.9, HZ * 2, sx * (HX - 0.015), 0.45, 0, A.wainscot))
    world.add(worldBox(HX * 2, 0.9, 0.03, 0, 0.45, -HZ + 0.015, A.wainscot))

    // the secret nook behind the fireplace (always built; you just can't get in)
    const NZ0 = HZ + 0.3, NZ1 = HZ + 4.3, NX = 2.4
    world.add(worldBox(NX * 2, 0.1, NZ1 - NZ0, 0, -0.05, (NZ0 + NZ1) / 2, A.carpets[2], 1.2))
    world.add(worldBox(NX * 2, 0.1, NZ1 - NZ0, 0, 2.6, (NZ0 + NZ1) / 2, A.ceiling, 1.5))
    world.add(worldBox(0.3, 2.6, NZ1 - NZ0, -NX - 0.15, 1.3, (NZ0 + NZ1) / 2, wallMat))
    world.add(worldBox(0.3, 2.6, NZ1 - NZ0, NX + 0.15, 1.3, (NZ0 + NZ1) / 2, wallMat))
    world.add(worldBox(NX * 2 + 0.6, 2.6, 0.3, 0, 1.3, NZ1 + 0.15, wallMat))
    const nookLight = new THREE.PointLight(0xc8e0ff, 0, 7, 1.5)
    nookLight.position.set(0, 2.2, NZ1 - 1.6)
    scene.add(nookLight)
    const founderArt = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), mat(new THREE.MeshStandardMaterial({ map: signTex([{ text: '👵', y: 120, size: 120 }, { text: 'Our Founder', y: 220, size: 28 }], '#e8dcb8', '#5a3a10', 256, 256) })))
    founderArt.position.set(0, 1.6, NZ1 - 0.02); founderArt.rotation.y = Math.PI
    world.add(founderArt)

    // ── Fireplace (slides into the floor when you say BOO) ──
    const fireplace = new THREE.Group()
    fireplace.position.set(0, 0, HZ - 0.4)
    const stone = mat(new THREE.MeshStandardMaterial({ color: 0x8a8076, roughness: 0.9 }))
    fireplace.add(box(2.4, 2.3, 0.7, stone, 0, 1.15, 0))
    fireplace.add(box(1.3, 1.0, 0.72, mat(new THREE.MeshBasicMaterial({ color: 0x120804 })), 0, 0.55, 0.01))
    fireplace.add(box(2.7, 0.15, 0.85, A.darkWood, 0, 2.35, 0.05))
    const flames = []
    for (let k = 0; k < 5; k++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), mat(new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffb030 : 0xff6a10 })))
      f.position.set(-0.4 + k * 0.2, 0.35, -0.3)
      fireplace.add(f); flames.push(f)
    }
    world.add(fireplace)

    // ── Stations ──
    // Elevator: steel doors set into the north wall.
    const steel = mat(new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.3, metalness: 0.5 }))
    for (const sx of [-1, 1]) world.add(box(0.85, 2.5, 0.08, steel, sx * 0.43, 1.25, -HZ + 0.05))
    world.add(box(2.1, 0.15, 0.12, A.brass, 0, 2.6, -HZ + 0.06))
    for (const sx of [-1, 1]) world.add(box(0.12, 2.6, 0.12, A.brass, sx * 0.98, 1.3, -HZ + 0.06))
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), mat(new THREE.MeshBasicMaterial({ map: signTex([{ text: '▲ ▼', y: 128, size: 120, color: '#ffb040' }], '#1a1008', '#ffb040', 256, 256) })))
    arrow.position.set(0, 2.95, -HZ + 0.02); world.add(arrow)
    // Trophy case: a glass cabinet with one gold cup per achievement.
    const caseG = new THREE.Group(); caseG.position.set(-HX + 0.45, 0, -4.5); world.add(caseG)
    caseG.add(box(0.8, 0.5, 2.4, A.darkWood, 0, 0.25, 0))
    caseG.add(box(0.8, 1.6, 2.4, mat(new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18 })), 0, 1.3, 0))
    caseG.add(box(0.8, 0.08, 2.4, A.darkWood, 0, 2.14, 0))
    const cupMat = mat(new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.5, roughness: 0.25, emissive: 0x3a2a00 }))
    const cups = []
    for (let k = 0; k < ACHIEVEMENTS.length; k++) {
      const cup = new THREE.Group()
      cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.035, 0.12, 10), cupMat).translateY(0.12))
      cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 8), cupMat))
      cup.position.set(-0.08, 0.55 + Math.floor(k / 13) * 0.55, -1.08 + (k % 13) * 0.18)
      caseG.add(cup); cups.push(cup)
    }
    for (const y of [1.08]) caseG.add(box(0.75, 0.03, 2.35, mat(new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.3 })), 0, y, 0))
    // Journal lectern.
    const lect = new THREE.Group(); lect.position.set(-HX + 0.9, 0, 4); world.add(lect)
    lect.add(box(0.5, 1.0, 0.5, A.darkWood, 0, 0.5, 0))
    const top = box(0.7, 0.06, 0.6, A.midWood, 0, 1.1, 0); top.rotation.z = -0.3; lect.add(top)
    const book = box(0.45, 0.06, 0.5, mat(new THREE.MeshStandardMaterial({ color: 0x7a2a1a })), 0.05, 1.17, 0); book.rotation.z = -0.3; lect.add(book)
    // Photo album table with a camera on it.
    const tbl = new THREE.Group(); tbl.position.set(HX - 1.0, 0, -4.5); world.add(tbl)
    tbl.add(box(1.0, 0.06, 1.4, A.midWood, 0, 0.8, 0))
    for (const [x, z] of [[-0.4, -0.6], [0.4, -0.6], [-0.4, 0.6], [0.4, 0.6]]) tbl.add(box(0.06, 0.8, 0.06, A.darkWood, x, 0.4, z))
    tbl.add(box(0.5, 0.08, 0.6, mat(new THREE.MeshStandardMaterial({ color: 0x2a4a8a })), 0, 0.87, -0.2))
    const cam = new THREE.Group(); cam.position.set(0, 0.92, 0.4); tbl.add(cam)
    cam.add(box(0.25, 0.15, 0.12, mat(new THREE.MeshStandardMaterial({ color: 0x222222 }))))
    cam.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), A.metal).rotateX(Math.PI / 2).translateY(0.08).translateZ(0))
    // Scoreboard on the east wall (redrawn whenever records change).
    const boardMat = mat(new THREE.MeshBasicMaterial({}))
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), boardMat)
    board.position.set(HX - 0.06, 2.1, 4); board.rotation.y = -Math.PI / 2
    world.add(board)
    world.add(box(0.05, 1.62, 2.52, A.brass, HX - 0.01, 2.1, 4))
    function drawBoard(prog) {
      boardMat.map?.dispose()
      const best = prog.records.filter(r => r.startFloor === 1).sort((a, b) => a.seconds - b.seconds).slice(0, 3)
      boardMat.map = signTex([
        { text: '⏱️ FASTEST CHECKOUTS', y: 50, size: 34 },
        ...(best.length ? best.map((r, i) => ({ text: `${['🥇', '🥈', '🥉'][i]} ${(r.name || 'Guest').slice(0, 12)}  ${fmtTime(r.seconds)}`, y: 110 + i * 48, size: 30, color: '#ffffff', font: 'Courier New, monospace' }))
          : [{ text: 'No escapes yet!', y: 140, size: 30, color: '#ffffff' }]),
      ], '#10201a', '#ffd76b', 512, 320)
      boardMat.needsUpdate = true
    }
    // Notice board by the fireplace (the hint for the secret).
    const notice = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), mat(new THREE.MeshStandardMaterial({ map: signTex([
      { text: '📌 NOTICES', y: 40, size: 34, color: '#3a2408' },
      { text: '• Support group: Wednesdays.', y: 100, size: 24, color: '#3a2408' },
      { text: '• Please stop feeding the worm.', y: 140, size: 24, color: '#3a2408' },
      { text: '• "Lonely? Just say BOO to', y: 190, size: 24, color: '#7a1a1a' },
      { text: '   the fireplace." — The Founder', y: 222, size: 24, color: '#7a1a1a' },
    ], '#e8d8a8', '#3a2408') })))
    notice.position.set(4.6, 1.8, HZ - 0.02); notice.rotation.y = Math.PI
    world.add(notice)
    world.add(box(1.5, 1.1, 0.04, A.darkWood, 4.6, 1.8, HZ + 0.0))
    // Support-group rug + sign.
    const rug = new THREE.Mesh(new THREE.CircleGeometry(RING.r + 0.9, 40), A.carpets[0])
    rug.rotation.x = -Math.PI / 2; rug.position.set(RING.x, 0.01, RING.z)
    world.add(rug)
    const groupSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), mat(new THREE.MeshBasicMaterial({ map: signTex([{ text: '"IT\'S JUST A JOB"', y: 55, size: 40 }, { text: 'monster support group · all welcome', y: 105, size: 22 }], '#3a1a2a', '#ffd76b', 512, 140) })))
    groupSign.rotation.x = -Math.PI / 2; groupSign.position.set(RING.x, 0.02, RING.z)
    world.add(groupSign)
    // A few plants for coziness.
    for (const [x, z] of [[-HX + 0.6, -HZ + 0.6], [HX - 0.6, -HZ + 0.6], [-HX + 0.6, HZ - 0.6], [HX - 0.6, HZ - 2.4]]) {
      const pg = new THREE.Group(); pg.position.set(x, 0, z)
      pg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.45, 12), A.pot).translateY(0.22))
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), A.leaf); l.scale.set(0.6, 1.8, 0.6); l.position.set(Math.cos(k) * 0.14, 0.8 + (k % 2) * 0.2, Math.sin(k) * 0.14); l.rotation.set(Math.sin(k) * 0.5, 0, Math.cos(k) * 0.5); pg.add(l) }
      world.add(pg)
    }
    // Chandelier.
    const chand = new THREE.Group(); chand.position.set(0, H, 0.5); world.add(chand)
    chand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), A.brass).translateY(-0.4))
    chand.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 24), A.brass).rotateX(Math.PI / 2).translateZ(0.85))
    for (let k = 0; k < 8; k++) chand.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffd890, emissiveIntensity: 1.6 }))).translateX(Math.cos(k * Math.PI / 4) * 0.7).translateY(-0.78).translateZ(Math.sin(k * Math.PI / 4) * 0.7))

    // ── Monsters you've met, in the support-group circle ──
    const monsters = buildMonsters(A)
    Object.values(monsters).forEach(m => { m.group.visible = false; scene.add(m.group) })
    const stools = []
    const seats = SEATED.map((id, k) => {
      const a = (k / SEATED.length) * Math.PI * 2 + Math.PI / SEATED.length
      return { id, x: RING.x + Math.cos(a) * RING.r, z: RING.z + Math.sin(a) * RING.r }
    })
    function placeMonsters(j) {
      stools.forEach(s => { scene.remove(s); s.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.() }) })
      stools.length = 0
      // spread whoever you've met evenly around the circle, facing the middle
      const freed = (j.entries.harvester?.dodged || 0) > 0
      const metIds = seats.filter(seat => !!j.entries[seat.id]?.faced && (seat.id !== 'gardener' || freed)).map(seat => seat.id)
      for (const seat of seats) {
        const m = monsters[seat.id]
        const k = metIds.indexOf(seat.id)
        const met = k >= 0
        m.group.visible = met
        seat.met = met
        if (!met) continue
        const a = (k / metIds.length) * Math.PI * 2 - Math.PI / 2 + 0.3
        seat.x = RING.x + Math.cos(a) * RING.r
        seat.z = RING.z + Math.sin(a) * RING.r
        m.group.position.set(seat.x, m.noStool ? 0 : -m.sitDrop + 0.42, seat.z)
        m.group.rotation.y = Math.atan2(RING.x - seat.x, RING.z - seat.z)
        if (!m.noStool) { const st = buildStool(); st.position.set(seat.x, 0, seat.z); scene.add(st); stools.push(st) }
      }
    }

    // ── State ──
    const p = { x: 0, z: HZ - 2.2, yaw: 0, pitch: -0.05 }
    let secretOpen = false, fireDrop = 0, typed = ''
    let talking = null // { lines, i }
    let photoPending = 0
    let prog = loadProgress(), jour = loadJournal()
    placeMonsters(jour)
    drawBoard(prog)
    cups.forEach((c, k) => { c.visible = k < Object.keys(prog.achievements).length })
    monsters.bea.group.visible = true
    monsters.bea.group.position.set(0, 0, NZ1 - 1.4)
    monsters.bea.group.rotation.y = Math.PI

    function refresh() {
      prog = loadProgress(); jour = loadJournal()
      setProgress(prog); setJournal(jour)
      placeMonsters(jour); drawBoard(prog)
      cups.forEach((c, k) => { c.visible = k < Object.keys(prog.achievements).length })
    }
    function checkAchievements() {
      const got = newlyEarned({ run: null, journal: jour, progress: prog })
      if (!got.length) return
      prog = updateProgress(pp => { for (const a of got) pp.achievements[a.id] = Date.now() })
      setProgress(prog)
      cups.forEach((c, k) => { c.visible = k < Object.keys(prog.achievements).length })
      sfx.chime()
      setToasts(ts => [...ts, ...got.map(a => ({ ...a, key: a.id + Date.now() }))])
      got.forEach(a => setTimeout(() => setToasts(ts => ts.filter(t => t.id !== a.id)), 4000))
    }

    // ── Collision ──
    const obstacles = [
      { minX: -HX, maxX: -HX + 0.85, minZ: -5.7, maxZ: -3.3 }, // trophy case
      { minX: -HX + 0.65, maxX: -HX + 1.15, minZ: 3.75, maxZ: 4.25 }, // lectern
      { minX: HX - 1.5, maxX: HX - 0.5, minZ: -5.2, maxZ: -3.8 }, // album table
    ]
    function blocked(x, z) {
      const inMain = x > -HX + R && x < HX - R && z > -HZ + R && z < HZ - R
      const inGap = secretOpen && fireDrop > 0.9 && Math.abs(x) < 0.9 - R && z >= HZ - R - 0.01 && z <= NZ0 + R
      const inNook = secretOpen && fireDrop > 0.9 && x > -NX + R && x < NX - R && z > NZ0 - R && z < NZ1 - R
      if (!inMain && !inGap && !inNook) return true
      if (!(secretOpen && fireDrop > 0.9) && Math.abs(x) < 1.2 + R && z > HZ - 0.75 - R) return true // fireplace
      for (const o of obstacles) if (x > o.minX - R && x < o.maxX + R && z > o.minZ - R && z < o.maxZ + R) return true
      for (const s of seats) if (s.met && Math.hypot(x - s.x, z - s.z) < 0.35 + R) return true
      if (Math.hypot(x - 0, z - (NZ1 - 1.4)) < 1.3 + R && inNook) return true // keep a polite distance from Bea's rocking chair // Bea's rocking chair
      return false
    }

    // ── Input ──
    const keys = new Set()
    const input = { yaw: 0, pitch: 0, use: false }
    function onKeyDown(e) {
      if (titleRef.current) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      sfx.unlockAudio()
      if (panelRef.current) { if (e.code === 'KeyE' || e.code === 'Escape' || (e.code === 'KeyJ' && panelRef.current === 'journal')) api.current.close(); return }
      if (talking) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') advanceTalk(); return }
      if (e.repeat) return
      if (e.code === 'KeyE') input.use = true
      if (e.code === 'KeyJ') openPanel('journal')
      // the founder's secret: say BOO
      if (e.key && e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-3)
        if (typed === 'boo' && !secretOpen) {
          secretOpen = true
          sfx.creak(true)
          setCaption('🔥 The fire sputters out… and the whole fireplace sinks into the floor!')
          setTimeout(() => setCaption(null), 4500)
        }
      }
      keys.add(e.code)
    }
    function onKeyUp(e) { keys.delete(e.code) }
    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      input.yaw -= e.movementX * MOUSE_SENSITIVITY
      input.pitch -= e.movementY * MOUSE_SENSITIVITY
    }
    function relock() { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}) }
    function onClick() {
      sfx.unlockAudio()
      if (titleRef.current) return
      if (talking) { advanceTalk(); return }
      if (panelRef.current) return
      if (document.pointerLockElement === renderer.domElement) { input.use = true; return }
      relock()
    }
    function onLockChange() { setLocked(document.pointerLockElement === renderer.domElement) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLockChange)
    renderer.domElement.addEventListener('click', onClick)
    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    function openPanel(id) {
      if (id === 'notice') {
        setCaption('📌 "Lonely? Just say BOO to the fireplace." — The Founder. (Huh. Say it how?)')
        setTimeout(() => setCaption(null), 5000)
        return
      }
      document.exitPointerLock?.()
      sfx.pageFlip()
      setPanel(id)
    }
    api.current = {
      close: () => { setPanel(null); refresh(); relock() },
      relock,
      start: (opts) => onStart(opts),
      checkAchievements: () => { prog = loadProgress(); checkAchievements() },
    }

    function startTalk() {
      const first = !jour.entries.bea?.faced
      const def = MONSTER_DEFS.bea
      talking = { lines: first ? def.lines : [def.repeatLine], i: 0, first }
      p.yaw = Math.atan2(-(0 - p.x), -((NZ1 - 1.4) - p.z))
      p.pitch = -0.15
      setDialogue({ monster: def, line: talking.lines[0], isLast: talking.lines.length === 1 })
      sfx.chime()
      photoPending = 12
    }
    function advanceTalk() {
      talking.i += 1
      if (talking.i < talking.lines.length) {
        setDialogue({ monster: MONSTER_DEFS.bea, line: talking.lines[talking.i], isLast: talking.i === talking.lines.length - 1 })
        return
      }
      const first = talking.first
      talking = null
      setDialogue(null)
      if (first) {
        jour = markFaced('bea')
        prog = updateProgress(pp => { pp.perks.allowance = true })
        setCaption(`👵 Grandma Bea's allowance: you'll start every stay with a few extra tips!`)
        setTimeout(() => setCaption(null), 4500)
        refresh()
      }
      checkAchievements()
    }

    // ── Loop ──
    let raf = 0, last = performance.now(), lastPrompt = null, labelT = 0
    const tmp = new THREE.Vector3()
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000

      // look + move
      p.yaw += input.yaw + ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * KEY_TURN_SPEED * dt
      p.pitch = Math.max(-1.3, Math.min(1.3, p.pitch + input.pitch))
      input.yaw = 0; input.pitch = 0
      if (!panelRef.current && !talking && !titleRef.current) {
        const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
        const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
        if (f || s) {
          const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw)
          let dx = fx * f + rx * s, dz = fz * f + rz * s
          const l = Math.hypot(dx, dz); dx /= l; dz /= l
          const nx = p.x + dx * WALK_SPEED * dt, nz = p.z + dz * WALK_SPEED * dt
          if (!blocked(nx, p.z)) p.x = nx
          if (!blocked(p.x, nz)) p.z = nz
        }
      }

      // what are we looking at?
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
      let focus = null, bestD = 2.4
      const targets = [...STATIONS]
      if (secretOpen && fireDrop > 0.9) targets.push({ id: 'bea', x: 0, z: NZ1 - 1.4 })
      for (const st of targets) {
        const dx = st.x - p.x, dz = st.z - p.z, d = Math.hypot(dx, dz)
        const reach = st.id === 'bea' ? 2.6 : st.id === 'elevator' ? 2.4 : 2.2
        if (d > reach) continue
        if (d > 0.3 && (dx * fx + dz * fz) / d < 0.55) continue
        if (d < bestD) { bestD = d; focus = st }
      }
      const pr = focus ? (focus.id === 'bea' ? '[E] Talk to Grandma Bea' : `[E] ${focus.label}`) : null
      if (pr !== lastPrompt) { lastPrompt = pr; setPrompt(pr) }
      if (input.use) {
        input.use = false
        if (focus?.id === 'bea') startTalk()
        else if (focus) openPanel(focus.id)
      }

      // fireplace + fire
      if (secretOpen && fireDrop < 1) fireDrop = Math.min(1, fireDrop + dt * 0.6)
      fireplace.position.y = -fireDrop * 2.45
      flames.forEach((fl, k) => { fl.scale.y = secretOpen ? 0.01 : 0.8 + Math.sin(t * 9 + k * 1.7) * 0.25 })
      fireLight.intensity = secretOpen ? 0 : 7 + Math.sin(t * 13) * 1.5
      nookLight.intensity = secretOpen ? 6 * fireDrop : 0

      // monsters idling in the circle; Bea rocking
      for (const seat of seats) if (seat.met) poseMonster(monsters[seat.id], t + seat.x, { sitting: true })
      poseMonster(monsters.bea, t, { sitting: true })

      camera.position.set(p.x, 1.6, p.z)
      camera.rotation.y = p.yaw
      camera.rotation.x = p.pitch
      renderer.render(scene, camera)

      if (photoPending > 0 && --photoPending === 0) {
        const url = snapPhoto(renderer.domElement)
        if (url) { prog = savePhoto('bea', url); setFlash(f => f + 1); sfx.pop() }
      }

      // floating station labels
      labelT -= dt
      if (labelT <= 0) {
        labelT = 0.1
        const w = mount.clientWidth, h = mount.clientHeight
        const out = []
        for (const st of STATIONS) {
          tmp.set(st.x, st.ly, st.z)
          const d = tmp.distanceTo(camera.position)
          tmp.project(camera)
          if (tmp.z > 1 || d > 20) continue
          out.push({ id: st.id, text: st.label, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, o: Math.min(1, (20 - d) / 5) })
        }
        setLabels(out)
      }
    }
    raf = requestAnimationFrame(tick)
    checkAchievements()
    if (import.meta.env.DEV) window.__lobby = { p, get secretOpen() { return secretOpen }, get fireDrop() { return fireDrop }, use: () => { input.use = true } }

    return () => {
      cancelAnimationFrame(raf)
      if (import.meta.env.DEV) delete window.__lobby
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerlockchange', onLockChange)
      renderer.domElement.removeEventListener('click', onClick)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.()
      world.traverse(o => o.geometry?.dispose())
      stools.forEach(s => s.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.() }))
      boardMat.map?.dispose()
      own.forEach(m => { m.map?.dispose(); m.dispose() })
      disposeMonsters(monsters)
      A.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className={styles.playWrap}>
      <div ref={mountRef} className={styles.mount} />
      {!panel && !dialogue && labels.map(l => (
        <div key={l.id} className={styles.lobbyLabel} style={{ left: l.x, top: l.y, opacity: l.o }}>{l.text}</div>
      ))}
      {!panel && !dialogue && !showTitle && <div className={styles.crosshair} />}
      {!panel && !dialogue && prompt && <div className={styles.prompt}>{prompt}</div>}
      {!panel && !dialogue && caption && <div className={`${styles.caption} ${styles.capGood}`}>{caption}</div>}
      {!locked && !panel && !dialogue && !showTitle && (
        <div className={styles.lockHint}>Click to look around · WASD move · E to use · walk to the 🛗 elevator to start</div>
      )}
      <div className={styles.hudTop}><span>🏨 The Lobby</span><span>🫙 🪙 {progress.wallet}</span>{progress.perks.allowance && <span>👵 +10 tips each stay</span>}</div>

      {dialogue && (
        <div className={styles.dialogueWrap}>
          <div className={styles.dialogueBox}>
            <div className={styles.dialogueHead}>
              <span className={styles.dialogueIcon}>{dialogue.monster.icon}</span>
              <span className={styles.dialogueName}>{dialogue.monster.name}</span>
              <span className={styles.dialogueTitle}>{dialogue.monster.title}</span>
            </div>
            <p className={styles.dialogueText}>{dialogue.line}</p>
            <span className={styles.dim}>{dialogue.isLast ? 'Space to say goodbye' : 'Space to continue'}</span>
          </div>
        </div>
      )}
      {flash > 0 && <div key={flash} className={styles.flash} />}
      <div className={styles.toastWrap}>
        {toasts.map(a => (
          <div key={a.key} className={styles.toast}><span className={styles.toastIcon}>{a.icon}</span><span><b>Achievement unlocked!</b><br />{a.name}</span></div>
        ))}
      </div>

      {panel === 'elevator' && <ElevatorPanel settings={progress.settings} perks={progress.perks} wallet={progress.wallet} unlocked3={progress.unlocks.floor3} unlocked4={progress.unlocks.floor4 || isLocalhost()}
        onUnlock={() => {
          const p2 = updateProgress(pp => { if (pp.wallet >= FLOOR3_PRICE && !pp.unlocks.floor3) { pp.wallet -= FLOOR3_PRICE; pp.unlocks.floor3 = true } })
          setProgress(p2)
          sfx.chime()
          api.current.checkAchievements?.()
        }}
        onClose={() => api.current.close()} onGo={(o) => { updateProgress(pp => { pp.settings.difficulty = o.difficulty; pp.settings.startFloor = o.floor }); api.current.start(o) }} />}
      {panel === 'trophies' && <AchievementsPanel progress={progress} onClose={() => api.current.close()} />}
      {panel === 'journal' && <Journal journal={journal} onClose={() => api.current.close()} />}
      {panel === 'album' && <AlbumPanel progress={progress} onClose={() => api.current.close()} />}
      {panel === 'records' && <RecordsPanel progress={progress} onClose={() => api.current.close()} />}

      {showTitle && (
        <div className={styles.overlayScreen} style={{ background: 'radial-gradient(circle at 50% 20%, rgba(42,16,32,0.92) 0%, rgba(10,5,16,0.96) 70%)' }}>
          <h1 className={styles.title}>🏨 The Totally Scary<span className={styles.subtitle}>Horror Game</span></h1>
          <p className={styles.blurb}>
            A haunted hotel: 50 doors of Floor 1, then an elevator down to 50 more in the basement and mines. The staff will
            try to get you. None of them are actually scary — if one catches you, it just pulls up a stool and tells you why
            it really needs this job.
          </p>
          <p className={styles.blurb}>
            Wander the lobby first: check your <b>trophies</b>, <b>journal</b>, <b>photo album</b> and the <b>scoreboard</b>,
            then take the <b>🛗 elevator</b> to check in. (Psst — read the notice board.)
          </p>
          <p className={styles.blurbSmall}>Mouse to look · WASD / arrows to move · E or click to use · Shift sneak · F light · Q vitamins · J journal</p>
          <button className={styles.bigBtn} onClick={() => { onDismissTitle(); setTimeout(() => api.current.relock?.(), 50) }}>▶ Enter the Lobby</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
      <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
    </div>
  )
}
