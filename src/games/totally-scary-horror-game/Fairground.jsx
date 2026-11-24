import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import styles from './TotallyScaryHorrorGame.module.css'
import { MONSTER_DEFS, MOUSE_SENSITIVITY, KEY_TURN_SPEED, WALK_SPEED } from './constants.js'
import { nextTalk } from './talk.js'
import { makeWindowFace } from './windowFace.js'
import { createAssets } from './scene.js'
import { buildMonsters, poseMonster, disposeMonsters } from './models.js'
import { loadJournal } from './journal.js'
import { updateProgress } from './progress.js'
import { newlyEarned } from './achievements.js'
import * as sfx from './sfx.js'

// ── The Moonlight Fair ──────────────────────────────────────────────────
// Out the garden door at the side of the lobby: the hotel's back lawn,
// where the staff go when their shift ends. A Ferris wheel you can ride all
// the way to the top, a carousel, a fireworks cart, Doug's pizza stand,
// and a bonfire where every monster you've met dances. Nobody chases
// anybody out here. Walk back through the garden door to return.

const FW = { x: -15, z: -24, R: 9, hub: 10.8 } // Ferris wheel
const CA = { x: 15, z: -22, r: 4.6 } // carousel
const BF = { x: 0, z: -34 } // bonfire
const CART = { x: 3.5, z: -13 } // fireworks cart
const PIZZA = { x: -6.5, z: -33 }
const DOOR = { x: 0, z: 6.6 }
const BOUNDS = { minX: -40, maxX: 40, minZ: -52, maxZ: 6.9 }
const R = 0.3
const GONDOLAS = 12
const HORSES = 10

const STATIONS = [
  { id: 'door', label: '🏨 Back to the Lobby', x: DOOR.x, z: DOOR.z, ly: 3.2, reach: 2.4 },
  { id: 'ferris', label: '🎡 Ride the Ferris Wheel', x: FW.x + 4.4, z: FW.z, ly: 1.9, reach: 2.6 },
  { id: 'carousel', label: '🎠 Ride the Carousel', x: CA.x, z: CA.z + CA.r + 1.4, ly: 1.9, reach: 2.6 },
  { id: 'fireworks', label: '🎆 Launch Fireworks', x: CART.x, z: CART.z, ly: 1.6, reach: 2.4 },
  { id: 'pizza', label: "🍕 Doug's Pizza", x: PIZZA.x, z: PIZZA.z + 1.4, ly: 2.9, reach: 2.4 },
]

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

let ramp = null
function toon(color, extra = {}) {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([80, 150, 215, 255]), 4, 1, THREE.RedFormat)
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter
    ramp.needsUpdate = true
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra })
}
const glow = (color) => new THREE.MeshBasicMaterial({ color })
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj }

// ── A tiny fairground organ: an oom-pah-pah waltz, all synthesized ──
function startOrgan() {
  let ctx
  try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return () => {} }
  const out = ctx.createGain()
  out.gain.value = 0.0001
  out.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 2)
  out.connect(ctx.destination)
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)
  const note = (type, f, at, dur, peak) => {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.value = f
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.05)
  }
  // chords (root, third, fifth) and a cheerful melody, one bar = 3 beats
  const bars = [[60, 64, 67], [60, 64, 67], [55, 59, 62], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67]]
  const melody = [[76, 79, 81], [79, 76, 72], [74, 77, 79], [77, 74, 71], [72, 76, 77], [77, 76, 74], [74, 72, 71], [72, -1, -1]]
  const beat = 60 / 150
  let i = 0, t = ctx.currentTime + 0.2
  const timer = setInterval(() => {
    while (t < ctx.currentTime + 0.5) {
      const bar = Math.floor(i / 3) % bars.length, b = i % 3
      const [r, th, fi] = bars[bar]
      if (b === 0) note('triangle', midi(r - 12), t, beat * 0.9, 0.5)
      else { note('square', midi(th), t, beat * 0.5, 0.12); note('square', midi(fi), t, beat * 0.5, 0.12) }
      const m = melody[bar][b]
      if (m > 0) note('triangle', midi(m), t, beat * 0.85, 0.35)
      t += beat
      i++
    }
  }, 120)
  return () => {
    clearInterval(timer)
    try { out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); setTimeout(() => ctx.close(), 800) } catch { /* already closed */ }
  }
}

export default function Fairground({ onBack }) {
  const mountRef = useRef(null)
  const [prompt, setPrompt] = useState(null)
  const [caption, setCaption] = useState(null)
  const [labels, setLabels] = useState([])
  const [locked, setLocked] = useState(false)
  const [toasts, setToasts] = useState([])
  const [riding, setRiding] = useState(null)
  const [dialogue, setDialogue] = useState(null)
  const [fade, setFade] = useState(1)
  const leaving = useRef(false)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x141a3a, 35, 140)
    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.05, 400)
    camera.rotation.order = 'YXZ'
    const disposables = []
    const own = (x) => { disposables.push(x); return x }

    // ── Sky, stars, moon ──
    const skyTex = own(canvasTex(16, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#04061a'); g.addColorStop(0.45, '#141a4a'); g.addColorStop(0.75, '#3a2a6a'); g.addColorStop(0.9, '#8a4a7a'); g.addColorStop(1, '#d8806a')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    }))
    const sky = new THREE.Mesh(own(new THREE.SphereGeometry(300, 32, 16)), own(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })))
    scene.add(sky)
    {
      const n = 1400, pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.acos(1 - Math.random() * 0.95)
        pos.set([Math.sin(e) * Math.cos(a) * 280, Math.cos(e) * 280, Math.sin(e) * Math.sin(a) * 280], i * 3)
      }
      const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      scene.add(new THREE.Points(g, own(new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }))))
    }
    const moon = new THREE.Mesh(own(new THREE.SphereGeometry(14, 32, 24)), own(new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false })))
    moon.position.set(-90, 120, -230)
    scene.add(moon)
    const haloTex = own(canvasTex(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(255,246,220,0.55)'); g.addColorStop(0.4, 'rgba(255,230,200,0.18)'); g.addColorStop(1, 'rgba(255,230,200,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    }))
    const halo = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: haloTex, fog: false, depthWrite: false, transparent: true })))
    halo.scale.set(110, 110, 1); halo.position.copy(moon.position)
    scene.add(halo)

    scene.add(new THREE.HemisphereLight(0x8a9cff, 0x1c2a18, 0.75))
    const moonLight = new THREE.DirectionalLight(0xc8d4ff, 1.1)
    moonLight.position.set(-40, 60, -30)
    scene.add(moonLight)

    // ── Ground: lawn, a sandy path, the hotel's back wall ──
    const grassTex = own(canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#25412a'; ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 1800; i++) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(60,110,60,0.5)' : 'rgba(18,40,22,0.5)'; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3) }
    }, true))
    grassTex.repeat.set(40, 40)
    const ground = new THREE.Mesh(own(new THREE.PlaneGeometry(400, 400)), own(toon(0xffffff, { map: grassTex })))
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)
    const path = new THREE.Mesh(own(new THREE.PlaneGeometry(4, 44)), own(toon(0xc8a878)))
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -15)
    scene.add(path)
    const plaza = new THREE.Mesh(own(new THREE.CircleGeometry(9, 40)), own(toon(0xb89868)))
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(BF.x, 0.012, BF.z)
    scene.add(plaza)

    const litWindows = [] // { r, c } — the face only ever appears in a lit one
    const facadeTex = own(canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#3a2228'; ctx.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 8) { ctx.fillStyle = y % 16 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(0, y, w, 1) }
      for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
        if (r === 3 && (c === 5 || c === 6)) continue // the garden door goes here
        const lit = Math.random() < 0.6
        if (lit) litWindows.push({ r, c })
        const x = 14 + c * 41, y = 18 + r * 58
        ctx.fillStyle = '#1a1018'; ctx.fillRect(x - 3, y - 3, 30, 42)
        ctx.fillStyle = lit ? (Math.random() < 0.3 ? '#ffd890' : '#ffb85a') : '#2a3050'; ctx.fillRect(x, y, 24, 36)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 11, y, 2, 36); ctx.fillRect(x, y + 17, 24, 2)
      }
    }))
    const wallMat = own(toon(0x5a3a40))
    const facade = new THREE.Mesh(own(new THREE.BoxGeometry(60, 26, 3)), [wallMat, wallMat, wallMat, wallMat, wallMat, own(new THREE.MeshBasicMaterial({ map: facadeTex }))])
    facade.position.set(0, 13, 9)
    scene.add(facade)
    // the facade's back face (toward the fair) maps canvas x → world x = 30 - px/512*60, canvas y → world y = 26 - py/256*26
    const windowFace = makeWindowFace(scene, () => litWindows.map(({ r, c }) => ({
      x: 30 - ((14 + c * 41 + 12) / 512) * 60,
      y: 26 - ((18 + r * 58 + 22) / 256) * 26,
      z: 7.47,
      rotY: Math.PI,
    })), [2.4, 3.2], { minWait: 6, maxWait: 14 })
    const roof = new THREE.Mesh(own(new THREE.CylinderGeometry(0.01, 6, 4, 4)), own(toon(0x2a1a24)))
    roof.scale.set(7.2, 1, 0.6); roof.rotation.y = Math.PI / 4; roof.position.set(0, 28, 9)
    scene.add(roof)
    // the garden door (glowing warm — the lobby's behind it)
    const doorFrame = new THREE.Mesh(own(new RoundedBoxGeometry(2.4, 3.2, 0.3, 3, 0.08)), own(toon(0x6a4a2a)))
    doorFrame.position.set(DOOR.x, 1.6, 7.45)
    scene.add(doorFrame)
    const doorGlow = new THREE.Mesh(own(new THREE.PlaneGeometry(2, 2.85)), own(glow(0xffd8a0)))
    doorGlow.position.set(DOOR.x, 1.5, 7.29)
    doorGlow.rotation.y = Math.PI
    scene.add(doorGlow)
    const doorLight = new THREE.PointLight(0xffc880, 12, 12, 1.6)
    doorLight.position.set(DOOR.x, 2, 6.2)
    scene.add(doorLight)
    const signTex = own(canvasTex(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#ffd76b'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = '#ffd76b'; ctx.font = 'bold 54px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('✦ MOONLIGHT FAIR ✦', w / 2, h / 2 + 2)
    }))
    const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(6, 1.5)), own(new THREE.MeshBasicMaterial({ map: signTex })))
    sign.position.set(0, 4.6, 7.3); sign.rotation.y = Math.PI
    scene.add(sign)

    // ── Lamp posts along the path, with moths (Steve's cousins) ──
    const lampMat = own(toon(0x23232a)), bulbMat = own(glow(0xffe6a8))
    const moths = []
    const mothGeo = own(new THREE.PlaneGeometry(0.14, 0.1)), mothMat = own(new THREE.MeshBasicMaterial({ color: 0xf4eedc, side: THREE.DoubleSide }))
    for (const z of [1, -7, -15, -23]) for (const sx of [-1, 1]) {
      const x = sx * 2.8
      const post = new THREE.Mesh(own(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 10)), lampMat)
      post.position.set(x, 1.7, z); scene.add(post)
      const head = new THREE.Mesh(own(new THREE.SphereGeometry(0.24, 16, 12)), bulbMat)
      head.position.set(x, 3.5, z); scene.add(head)
      const pl = new THREE.PointLight(0xffd8a0, 5, 9, 1.8); pl.position.set(x, 3.4, z); scene.add(pl)
      for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(mothGeo, mothMat)
        m.userData = { cx: x, cz: z, ph: Math.random() * 10, r: 0.5 + Math.random() * 0.4 }
        scene.add(m); moths.push(m)
      }
    }

    // ── String lights zig-zagging over the plaza ──
    const bulbs = []
    const BULB_COLORS = [0xff4a6a, 0xffd04a, 0x4ad0ff, 0x7aff6a, 0xd06aff, 0xff9a3a]
    const bulbGeo = own(new THREE.SphereGeometry(0.09, 8, 6))
    const strandPosts = [[-9, -26], [9, -26], [-9, -42], [9, -42], [-4, -14], [4, -14]]
    for (const [x, z] of strandPosts) {
      const p = new THREE.Mesh(own(new THREE.CylinderGeometry(0.08, 0.1, 5, 8)), own(toon(0x5a3a22)))
      p.position.set(x, 2.5, z); scene.add(p)
    }
    const strands = [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [1, 2], [4, 0], [5, 1], [4, 5]]
    let bi = 0
    for (const [a, b] of strands) {
      const [x0, z0] = strandPosts[a], [x1, z1] = strandPosts[b]
      const n = Math.max(6, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9))
      for (let k = 1; k < n; k++) {
        const u = k / n
        const mesh = new THREE.Mesh(bulbGeo, own(glow(BULB_COLORS[bi++ % BULB_COLORS.length])))
        mesh.position.set(x0 + (x1 - x0) * u, 4.9 - Math.sin(u * Math.PI) * 1.1, z0 + (z1 - z0) * u)
        scene.add(mesh); bulbs.push(mesh)
      }
    }

    // ── The Ferris wheel ──
    // The wheel turns edge-on to the hotel and face-on to the fair (its plane runs north–south),
    // so from the top gondola you look straight out over everything.
    const wheel = new THREE.Group()
    wheel.position.set(FW.x, FW.hub, FW.z)
    wheel.rotation.y = Math.PI / 2
    scene.add(wheel)
    const steel = own(toon(0xe8e8f0)), red = own(toon(0xd83a4a))
    for (const sz of [-1, 1]) {
      const rim = new THREE.Mesh(own(new THREE.TorusGeometry(FW.R, 0.13, 8, 96)), steel)
      rim.position.z = sz * 0.6; wheel.add(rim)
      const inner = new THREE.Mesh(own(new THREE.TorusGeometry(FW.R * 0.55, 0.08, 8, 64)), red)
      inner.position.z = sz * 0.6; wheel.add(inner)
      for (let k = 0; k < GONDOLAS; k++) {
        const a = (k / GONDOLAS) * Math.PI * 2
        const sp = new THREE.Mesh(own(new THREE.CylinderGeometry(0.06, 0.06, FW.R, 6)), steel)
        sp.position.set(Math.cos(a) * FW.R / 2, Math.sin(a) * FW.R / 2, sz * 0.6)
        sp.rotation.z = a - Math.PI / 2
        wheel.add(sp)
      }
    }
    for (let k = 0; k < GONDOLAS; k++) {
      const a = (k / GONDOLAS) * Math.PI * 2
      // axles stick out past the front rim: the gondolas hang on the fair side, clear of the spokes
      const axle = new THREE.Mesh(own(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6)), steel)
      axle.rotation.x = Math.PI / 2; axle.position.set(Math.cos(a) * FW.R, Math.sin(a) * FW.R, 0.65)
      wheel.add(axle)
    }
    const hubM = new THREE.Mesh(own(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 20)), red)
    hubM.rotation.x = Math.PI / 2; wheel.add(hubM)
    const rimLights = []
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(bulbGeo, own(glow(0xffffff)))
        m.position.set(Math.cos(a) * (FW.R + 0.2), Math.sin(a) * (FW.R + 0.2), sz * 0.75)
        wheel.add(m); rimLights.push({ m, k })
      }
    }
    // A-frame legs
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(own(new THREE.CylinderGeometry(0.18, 0.25, FW.hub / Math.cos(0.32), 10)), steel)
      leg.position.set(FW.x + sz * 1.3, FW.hub / 2, FW.z + sx * Math.tan(0.32) * FW.hub / 2)
      leg.rotation.x = -sx * 0.32
      scene.add(leg)
    }
    const platform = new THREE.Mesh(own(new RoundedBoxGeometry(3, 0.5, 4, 2, 0.1)), own(toon(0x6a4a3a)))
    platform.position.set(FW.x + 2.9, 0.25, FW.z)
    scene.add(platform)
    const GONDOLA_COLORS = [0xff5a6a, 0xffc84a, 0x4ac8ff, 0x8aff6a, 0xc86aff, 0xff8a3a]
    const gondolas = []
    for (let k = 0; k < GONDOLAS; k++) {
      const g = new THREE.Group()
      const c = GONDOLA_COLORS[k % GONDOLA_COLORS.length]
      // an open-topped tub you sit in (so the view from the top is all yours), under a little canopy
      const cm = own(toon(c, { side: THREE.DoubleSide }))
      const tub = new THREE.Mesh(own(new THREE.CylinderGeometry(0.85, 0.7, 0.6, 24, 1, true)), cm)
      tub.position.y = -1.55; g.add(tub)
      const floorD = new THREE.Mesh(own(new THREE.CircleGeometry(0.7, 24)), cm)
      floorD.rotation.x = -Math.PI / 2; floorD.position.y = -1.84; g.add(floorD)
      const lip = new THREE.Mesh(own(new THREE.TorusGeometry(0.85, 0.05, 8, 32)), own(toon(0xf4f0e8)))
      lip.rotation.x = Math.PI / 2; lip.position.y = -1.25; g.add(lip)
      const roofM = new THREE.Mesh(own(new THREE.ConeGeometry(0.95, 0.4, 24, 1, true)), own(toon(0xf4f0e8, { side: THREE.DoubleSide })))
      roofM.position.y = 0.05; g.add(roofM)
      const hangers = [roofM]
      for (const sx of [-1, 1]) {
        const rod = new THREE.Mesh(own(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 6)), steel)
        rod.position.set(sx * 0.82, -0.6, 0); g.add(rod); hangers.push(rod)
      }
      g.userData.hangers = hangers // hidden on the one you're riding, so they don't block the view
      scene.add(g)
      gondolas.push(g)
    }
    const wheelLight = new THREE.PointLight(0xff8acc, 18, 30, 1.6)
    wheelLight.position.set(FW.x + 3, FW.hub, FW.z)
    scene.add(wheelLight)

    // ── The carousel ──
    const carousel = new THREE.Group()
    carousel.position.set(CA.x, 0, CA.z)
    scene.add(carousel)
    const stripeTex = own(canvasTex(512, 64, (ctx, w, h) => { for (let x = 0; x < w; x += 32) { ctx.fillStyle = (x / 32) % 2 ? '#f4ead8' : '#d83a4a'; ctx.fillRect(x, 0, 32, h) } }, true))
    const base = new THREE.Mesh(own(new THREE.CylinderGeometry(CA.r + 0.4, CA.r + 0.5, 0.5, 48)), [own(toon(0xffffff, { map: stripeTex })), own(toon(0x8a5a3a)), own(toon(0x5a3a2a))])
    base.position.y = 0.25
    carousel.add(base)
    const spin = new THREE.Group(); carousel.add(spin) // the part that turns
    const floor = new THREE.Mesh(own(new THREE.CylinderGeometry(CA.r, CA.r, 0.08, 48)), own(toon(0xc89a5a)))
    floor.position.y = 0.54; spin.add(floor)
    const column = new THREE.Mesh(own(new THREE.CylinderGeometry(0.9, 0.9, 4, 20)), own(toon(0xf0d070)))
    column.position.y = 2.5; spin.add(column)
    const canopy = new THREE.Mesh(own(new THREE.ConeGeometry(CA.r + 0.8, 2.2, 32, 1, true)), own(toon(0xffffff, { map: stripeTex, side: THREE.DoubleSide })))
    canopy.position.y = 5.6; spin.add(canopy)
    const valance = new THREE.Mesh(own(new THREE.CylinderGeometry(CA.r + 0.8, CA.r + 0.8, 0.55, 48, 1, true)), own(toon(0xffffff, { map: stripeTex, side: THREE.DoubleSide })))
    valance.position.y = 4.25; spin.add(valance)
    const flagPole = new THREE.Mesh(own(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6)), steel)
    flagPole.position.y = 7.2; spin.add(flagPole)
    const flag = new THREE.Mesh(own(new THREE.PlaneGeometry(0.7, 0.4)), own(new THREE.MeshBasicMaterial({ color: 0xffd04a, side: THREE.DoubleSide })))
    flag.position.set(0.36, 7.5, 0); spin.add(flag)
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2
      const m = new THREE.Mesh(bulbGeo, own(glow(k % 2 ? 0xffe08a : 0xffffff)))
      m.position.set(Math.cos(a) * (CA.r + 0.82), 4.0, Math.sin(a) * (CA.r + 0.82))
      spin.add(m)
    }
    const gold = own(toon(0xf2c84a))
    const HORSE_COLORS = [0xf4f0e8, 0x7a4a2a, 0x2a2a34, 0xd8a8e8, 0xa8d8f8]
    const horses = []
    for (let k = 0; k < HORSES; k++) {
      const a = (k / HORSES) * Math.PI * 2
      const holder = new THREE.Group()
      holder.position.set(Math.cos(a) * (CA.r - 1.1), 0, Math.sin(a) * (CA.r - 1.1))
      holder.rotation.y = -a // face along the direction of travel
      spin.add(holder)
      const pole = new THREE.Mesh(own(new THREE.CylinderGeometry(0.05, 0.05, 3.8, 8)), gold)
      pole.position.y = 2.4; holder.add(pole)
      const horse = new THREE.Group(); holder.add(horse)
      const coat = own(toon(HORSE_COLORS[k % HORSE_COLORS.length])), mane = own(toon(GONDOLA_COLORS[k % GONDOLA_COLORS.length]))
      const torso = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.28, 0.75, 6, 14)), coat); torso.rotation.x = Math.PI / 2; horse.add(torso)
      const neck = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.15, 0.45, 6, 10)), coat); neck.position.set(0, 0.35, 0.5); neck.rotation.x = 0.6; horse.add(neck)
      const head = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.13, 0.3, 6, 10)), coat); head.position.set(0, 0.62, 0.78); head.rotation.x = 1.4; horse.add(head)
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(own(new THREE.ConeGeometry(0.05, 0.14, 6)), coat); ear.position.set(sx * 0.07, 0.8, 0.7); horse.add(ear)
        const eye = new THREE.Mesh(own(new THREE.SphereGeometry(0.035, 8, 6)), own(glow(0x1a1a1a))); eye.position.set(sx * 0.1, 0.68, 0.84); horse.add(eye)
      }
      const maneM = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.07, 0.45, 4, 8)), mane); maneM.position.set(0, 0.5, 0.42); maneM.rotation.x = 0.6; horse.add(maneM)
      const saddle = new THREE.Mesh(own(new RoundedBoxGeometry(0.5, 0.12, 0.45, 2, 0.05)), mane); saddle.position.y = 0.3; horse.add(saddle)
      for (const [sx, sz, up] of [[-1, 0.35, 0.5], [1, 0.35, 0.5], [-1, -0.35, 0], [1, -0.35, 0]]) {
        const leg = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8)), coat)
        leg.position.set(sx * 0.15, -0.35, sz); leg.rotation.x = up ? -0.9 : 0.2; horse.add(leg)
      }
      const tail = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8)), mane); tail.position.set(0, 0.05, -0.62); tail.rotation.x = -0.6; horse.add(tail)
      horses.push({ holder, horse, ph: k * 1.3 })
    }
    const carouselLight = new THREE.PointLight(0xffd890, 16, 16, 1.6)
    carouselLight.position.set(CA.x, 3.6, CA.z)
    scene.add(carouselLight)

    // ── Fireworks cart ──
    const cart = new THREE.Group(); cart.position.set(CART.x, 0, CART.z); scene.add(cart)
    cart.add(at(new THREE.Mesh(own(new RoundedBoxGeometry(1.4, 0.7, 0.9, 2, 0.06)), own(toon(0x8a3a2a))), 0, 0.6, 0))
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(own(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16)), own(toon(0x2a1a10))); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.75, 0.28, 0); cart.add(w) }
    for (let k = 0; k < 6; k++) {
      const r = new THREE.Mesh(own(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8)), own(toon(GONDOLA_COLORS[k])))
      r.position.set(-0.45 + (k % 3) * 0.45, 1.2, k < 3 ? -0.15 : 0.15); cart.add(r)
      const tip = new THREE.Mesh(own(new THREE.ConeGeometry(0.08, 0.18, 8)), own(toon(0xf4f0e8)))
      tip.position.set(r.position.x, 1.58, r.position.z); cart.add(tip)
    }

    // ── Bonfire + Doug's pizza stand ──
    for (let k = 0; k < 6; k++) {
      const log = new THREE.Mesh(own(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 8)), own(toon(0x4a2a18)))
      const a = (k / 6) * Math.PI
      log.rotation.set(Math.PI / 2, a, 0.4); log.position.set(BF.x, 0.2, BF.z)
      scene.add(log)
    }
    const flames = []
    for (const [s, c, y] of [[1, 0xff6a1a, 0.7], [0.75, 0xffa83a, 0.85], [0.45, 0xffe68a, 0.95]]) {
      const f = new THREE.Mesh(own(new THREE.ConeGeometry(0.55 * s, 1.5 * s, 12)), own(glow(c)))
      f.position.set(BF.x, y, BF.z); scene.add(f); flames.push(f)
    }
    const fireLight = new THREE.PointLight(0xff8a3a, 30, 20, 1.5)
    fireLight.position.set(BF.x, 1.5, BF.z)
    scene.add(fireLight)
    const stand = new THREE.Group(); stand.position.set(PIZZA.x, 0, PIZZA.z); stand.rotation.y = 0.5; scene.add(stand)
    stand.add(at(new THREE.Mesh(own(new RoundedBoxGeometry(2.6, 1.1, 1, 2, 0.08)), own(toon(0xe8d8b8))), 0, 0.55, 0))
    for (const sx of [-1, 1]) stand.add(at(new THREE.Mesh(own(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8)), own(toon(0x6a4a2a))), sx * 1.2, 1.3, 0.4))
    const awning = new THREE.Mesh(own(new THREE.CylinderGeometry(1.5, 1.5, 3, 24, 1, true, 0, Math.PI)), own(toon(0xffffff, { map: stripeTex, side: THREE.DoubleSide })))
    awning.rotation.z = Math.PI / 2; awning.scale.set(0.35, 1, 0.6); awning.position.set(0, 2.6, 0.2); stand.add(awning)
    const pizzaSign = new THREE.Mesh(own(new THREE.PlaneGeometry(2.2, 0.55)), own(new THREE.MeshBasicMaterial({ map: own(canvasTex(512, 128, (ctx, w, h) => { ctx.fillStyle = '#c02020'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = 'bold 64px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText("🍕 DOUG'S PIZZA", w / 2, h / 2 + 4) })) })))
    pizzaSign.position.set(0, 3.15, 0.45); stand.add(pizzaSign)
    const standLight = new THREE.PointLight(0xffd8a0, 6, 8, 1.6); standLight.position.set(0, 2.2, 1); stand.add(standLight)

    // ── Off-duty monsters: everyone you've met, dancing round the bonfire ──
    const A = createAssets()
    const monsters = buildMonsters(A)
    Object.values(monsters).forEach(m => { m.group.visible = false; scene.add(m.group) })
    const jour = loadJournal()
    const met = Object.keys(monsters).filter(id => jour.entries[id]?.faced && !['harvester', 'bea', 'lamplighter', 'gardener'].includes(id))
    const dancers = met.map((id, k) => {
      const a = (k / Math.max(1, met.length)) * Math.PI * 2
      const r = 4.2 + (k % 2) * 1.1
      return { id, m: monsters[id], a, r, ph: k * 0.9 }
    })
    dancers.forEach(d => { d.m.group.visible = true })
    // the Lamplighter keeps to the edge of the light, by the last lamp post
    const lamp = jour.entries.lamplighter?.faced ? monsters.lamplighter : null
    if (lamp) { lamp.group.visible = true; lamp.group.position.set(-4.2, 0, -26); lamp.group.rotation.y = Math.PI * 0.6 }
    const LAMP_YAW = Math.PI * 0.6, GARDENER_YAW = -Math.PI * 0.8
    // and if you've set the Gardener free, he's out here watering his flowers
    const freed = (jour.entries.harvester?.dodged || 0) > 0
    const gardener = freed ? monsters.gardener : null
    if (gardener) { gardener.group.visible = true; gardener.group.position.set(9, 0, 3.5); gardener.group.rotation.y = -Math.PI * 0.8 }
    const flowerMats = [0xff6a8a, 0xffd84a, 0xb88aff, 0x6ad8ff].map(c => own(toon(c)))
    for (let k = 0; k < 40; k++) {
      const f = new THREE.Mesh(own(new THREE.SphereGeometry(0.12, 8, 6)), flowerMats[k % 4])
      const x = 6 + Math.random() * 9, z = 2 + Math.random() * 3.5
      f.position.set(x, 0.35, z); scene.add(f)
      const stem = new THREE.Mesh(own(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4)), own(toon(0x3a7a3a)))
      stem.position.set(x, 0.17, z); scene.add(stem)
    }

    // ── Fireworks ──
    const fireworks = [] // { kind: 'rocket'|'burst', ... }
    const flash = new THREE.PointLight(0xffffff, 0, 120, 1.2)
    scene.add(flash)
    const sparkTex = own(canvasTex(32, 32, (ctx, w, h) => { const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h) }))
    const FW_COLORS = [0xff4a6a, 0xffd04a, 0x4ad0ff, 0x7aff6a, 0xd06aff, 0xffffff, 0xff9a3a]
    function launch(x, z, delay = 0) {
      const target = 24 + Math.random() * 16
      fireworks.push({ kind: 'rocket', x, z, y: 1.2, vy: 26 + Math.random() * 6, target, delay, color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)], mesh: null })
    }
    function burst(x, y, z, color) {
      const n = 120, pos = new Float32Array(n * 3), vel = []
      for (let i = 0; i < n; i++) {
        pos.set([x, y, z], i * 3)
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = 9 + Math.random() * 3
        vel.push([Math.sqrt(1 - u * u) * Math.cos(a) * s, u * s, Math.sqrt(1 - u * u) * Math.sin(a) * s])
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({ color, size: 1.1, map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
      const pts = new THREE.Points(geo, mat)
      scene.add(pts)
      fireworks.push({ kind: 'burst', pts, vel, life: 0 })
      flash.color.setHex(color); flash.position.set(x, y, z); flash.intensity = 900
      sfx.pop()
    }
    const rocketGeo = own(new THREE.SphereGeometry(0.12, 6, 4))
    function stepFireworks(dt) {
      for (const f of fireworks) {
        if (f.kind === 'rocket') {
          if (f.delay > 0) { f.delay -= dt; continue }
          if (!f.mesh) { f.mesh = new THREE.Mesh(rocketGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c0 })); scene.add(f.mesh); sfx.whoosh() }
          f.y += f.vy * dt; f.vy *= 0.985
          f.mesh.position.set(f.x + Math.sin(f.y) * 0.1, f.y, f.z)
          if (f.y >= f.target) { burst(f.x, f.y, f.z, f.color); scene.remove(f.mesh); f.mesh.material.dispose(); f.dead = true }
        } else {
          f.life += dt
          const pos = f.pts.geometry.attributes.position
          f.vel.forEach((v, i) => {
            v[1] -= 6 * dt; v[0] *= 0.985; v[1] *= 0.985; v[2] *= 0.985
            pos.array[i * 3] += v[0] * dt; pos.array[i * 3 + 1] += v[1] * dt; pos.array[i * 3 + 2] += v[2] * dt
          })
          pos.needsUpdate = true
          f.pts.material.opacity = Math.max(0, 1 - f.life / 2.4)
          if (f.life > 2.4) { scene.remove(f.pts); f.pts.geometry.dispose(); f.pts.material.dispose(); f.dead = true }
        }
      }
      for (let i = fireworks.length - 1; i >= 0; i--) if (fireworks[i].dead) fireworks.splice(i, 1)
      flash.intensity *= Math.pow(0.02, dt)
    }
    function show(n) {
      for (let k = 0; k < n; k++) launch(-20 + Math.random() * 40, -55 - Math.random() * 25, k * 0.45)
    }

    // ── Achievements (riding the wheel, setting off fireworks) ──
    function earn(stat) {
      let prog = updateProgress(pp => { pp.stats[stat] = true })
      const got = newlyEarned({ run: null, journal: jour, progress: prog })
      if (!got.length) return
      prog = updateProgress(pp => { for (const a of got) pp.achievements[a.id] = Date.now() })
      sfx.chime()
      setToasts(ts => [...ts, ...got.map(a => ({ ...a, key: a.id + Date.now() }))])
      got.forEach(a => setTimeout(() => setToasts(ts => ts.filter(t => t.id !== a.id)), 4000))
    }

    // ── Collision ──
    const circles = [
      { x: FW.x + 1.2, z: FW.z, r: 2.4 }, { x: FW.x, z: FW.z - 3.4, r: 0.6 }, { x: FW.x, z: FW.z + 3.4, r: 0.6 },
      { x: CA.x, z: CA.z, r: CA.r + 0.6 }, { x: BF.x, z: BF.z, r: 1.4 }, { x: CART.x, z: CART.z, r: 0.9 },
      { x: PIZZA.x, z: PIZZA.z, r: 1.5 },
      ...strandPosts.map(([x, z]) => ({ x, z, r: 0.25 })),
    ]
    function blocked(x, z) {
      if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true
      for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + R) return true
      for (const d of dancers) if (Math.hypot(x - d.m.group.position.x, z - d.m.group.position.z) < 0.5 + R) return true
      return false
    }

    // ── Talking (the Gardener and the Lamplighter stop to chat) ──
    const speakers = [
      gardener && { id: 'gardener', label: '💬 Talk to the Gardener', m: gardener, yaw: GARDENER_YAW, x: 9, z: 3.5, ly: 2.3, reach: 2.6 },
      lamp && { id: 'lamplighter', label: '💬 Talk to the Lamplighter', m: lamp, yaw: LAMP_YAW, x: -4.2, z: -26, ly: 2.9, reach: 2.8 },
    ].filter(Boolean)
    circles.push(...speakers.map(sp => ({ x: sp.x, z: sp.z, r: 0.5 })))
    let talking = null // { sp, lines, i }
    function startTalk(sp) {
      talking = { sp, lines: nextTalk(sp.id), i: 0 }
      p.yaw = Math.atan2(-(sp.x - p.x), -(sp.z - p.z)) // face him
      p.pitch = 0.1
      setDialogue({ monster: MONSTER_DEFS[sp.id], line: talking.lines[0], isLast: talking.lines.length === 1 })
      sfx.chime()
    }
    function advanceTalk() {
      talking.i += 1
      if (talking.i < talking.lines.length) {
        setDialogue({ monster: MONSTER_DEFS[talking.sp.id], line: talking.lines[talking.i], isLast: talking.i === talking.lines.length - 1 })
        sfx.pageFlip()
        return
      }
      talking = null
      setDialogue(null)
    }

    // ── Input ──
    const p = { x: 0, z: 4.6, yaw: 0, pitch: 0.12 }
    const keys = new Set()
    const input = { yaw: 0, pitch: 0, use: false }
    let ride = null // { kind: 'ferris', k, laps, topped } | { kind: 'carousel', k, t }
    let stopOrgan = null
    const ensureOrgan = () => { if (!stopOrgan) stopOrgan = startOrgan() }
    function onKeyDown(e) {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      sfx.unlockAudio(); ensureOrgan()
      if (e.repeat) return
      if (talking) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') advanceTalk(); return }
      if (e.code === 'KeyE') input.use = true
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
      sfx.unlockAudio(); ensureOrgan()
      if (talking) { advanceTalk(); return }
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
    let capTimer = null
    const say = (text, ms = 4500) => { setCaption(text); clearTimeout(capTimer); capTimer = setTimeout(() => setCaption(null), ms) }

    let wheelAngle = 0, carouselAngle = 0, nextAmbient = 4
    const gondolaPos = (k) => {
      const a = wheelAngle + (k / GONDOLAS) * Math.PI * 2
      return { x: FW.x + 1.55, y: FW.hub + Math.sin(a) * FW.R, z: FW.z - Math.cos(a) * FW.R, a }
    }

    function use(focus) {
      if (ride) {
        if (ride.kind === 'ferris') {
          const gp = gondolaPos(ride.k)
          if (Math.sin(gp.a) > -0.93) { say('🎡 Hang on — you can hop off when your gondola reaches the bottom.', 2500); return }
        }
        endRide()
        return
      }
      if (!focus) return
      if (focus.id === 'door') { leave(); return }
      if (focus.speaker) { startTalk(focus.speaker); return }
      if (focus.id === 'ferris') {
        // board whichever gondola is closest to the bottom
        let best = 0, bestY = Infinity
        for (let k = 0; k < GONDOLAS; k++) { const y = gondolaPos(k).y; if (y < bestY) { bestY = y; best = k } }
        ride = { kind: 'ferris', k: best, start: wheelAngle, topped: false }
        gondolas[best].userData.hangers.forEach(h => { h.visible = false })
        p.yaw = -Math.PI / 2; p.pitch = -0.1 // facing out over the fair
        setRiding('ferris'); sfx.chime()
        say('🎡 Up you go! (Press E at the bottom to hop off.)', 3500)
        return
      }
      if (focus.id === 'carousel') {
        ride = { kind: 'carousel', k: 0, start: carouselAngle }
        setRiding('carousel'); sfx.chime()
        say('🎠 Wheee! (Press E to hop off.)', 3000)
        return
      }
      if (focus.id === 'fireworks') {
        show(7)
        say('🎆 Ooooooh… aaaaaah!', 3000)
        earn('fireworks')
        return
      }
      if (focus.id === 'pizza') {
        sfx.chomp()
        say(met.includes('doug') ? '🍕 "Sorry, I ate the last slice," says a sign in Doug\'s handwriting. "And the box."' : '🍕 The stand is empty except for a sign: "BACK IN 5 MIN — DOUG". There is a worm-shaped hole in the counter.', 5000)
      }
    }
    function endRide() {
      if (!ride) return
      if (ride.kind === 'ferris') { gondolas[ride.k].userData.hangers.forEach(h => { h.visible = true }); p.x = FW.x + 4.6; p.z = FW.z; p.yaw = Math.PI / 2 }
      else { p.x = CA.x; p.z = CA.z + CA.r + 1.6; p.yaw = 0 }
      ride = null
      setRiding(null)
    }
    function leave() {
      if (leaving.current) return
      leaving.current = true
      setFade(1) // fade to black, then back to the lobby
      setTimeout(() => onBack(), 600)
    }

    // ── Loop ──
    let raf = 0, last = performance.now(), lastPrompt = null, labelT = 0
    const tmp = new THREE.Vector3()
    setTimeout(() => setFade(0), 50) // fade in from black
    function tick(now) {
      raf = requestAnimationFrame(tick)
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05))
      last = now
      const t = now / 1000

      p.yaw += input.yaw + ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * KEY_TURN_SPEED * dt
      p.pitch = Math.max(-1.3, Math.min(1.3, p.pitch + input.pitch))
      input.yaw = 0; input.pitch = 0
      if (!ride && !leaving.current && !talking) {
        const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
        const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
        if (f || s) {
          const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw)
          let dx = fx * f + rx * s, dz = fz * f + rz * s
          const l = Math.hypot(dx, dz); dx /= l; dz /= l
          const sp = WALK_SPEED * 1.25 * (keys.has('ShiftLeft') ? 1.6 : 1)
          const nx = p.x + dx * sp * dt, nz = p.z + dz * sp * dt
          if (!blocked(nx, p.z)) p.x = nx
          if (!blocked(p.x, nz)) p.z = nz
        }
      }

      // rides turning
      wheelAngle += dt * (ride?.kind === 'ferris' ? 0.24 : 0.1)
      wheel.rotation.z = wheelAngle
      gondolas.forEach((g, k) => {
        const gp = gondolaPos(k)
        g.position.set(gp.x, gp.y, gp.z)
        g.rotation.x = Math.sin(t * 1.3 + k) * 0.04 // a gentle sway
      })
      rimLights.forEach(({ m, k }) => { m.material.color.setHex(BULB_COLORS[(k + Math.floor(t * 6)) % BULB_COLORS.length]) })
      carouselAngle += dt * 0.55
      spin.rotation.y = -carouselAngle
      horses.forEach(h => { h.horse.position.y = 1.35 + Math.sin(t * 2.2 + h.ph) * 0.3 })
      flag.rotation.y = Math.sin(t * 4) * 0.3

      // bonfire, lights, moths
      flames.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 11 + k) * 0.08, 1 + Math.sin(t * 13 + k * 2) * 0.18, 1); f.rotation.y = t * (k + 1) })
      fireLight.intensity = 26 + Math.sin(t * 17) * 4
      moths.forEach(m => {
        const u = m.userData
        m.position.set(u.cx + Math.cos(t * 3 + u.ph) * u.r, 3.5 + Math.sin(t * 5 + u.ph) * 0.3, u.cz + Math.sin(t * 2.6 + u.ph) * u.r)
        m.rotation.set(0, t * 3 + u.ph, Math.sin(t * 30 + u.ph) * 0.8) // flapping
      })
      bulbs.forEach((b, i) => { if ((i + Math.floor(t * 2)) % 9 === 0) b.scale.setScalar(0.6); else b.scale.setScalar(1) })

      // the off-duty staff, dancing
      dancers.forEach(d => {
        const a = d.a + t * 0.25
        const x = BF.x + Math.cos(a) * d.r, z = BF.z + Math.sin(a) * d.r
        d.m.group.position.set(x, Math.abs(Math.sin(t * 4 + d.ph)) * 0.18, z)
        d.m.group.rotation.y = Math.atan2(BF.x - x, BF.z - z) + Math.sin(t * 2 + d.ph) * 0.5
        poseMonster(d.m, t + d.ph, { moving: true, speed: 0.6, dancing: true })
      })
      for (const sp of speakers) {
        const want = talking?.sp === sp ? Math.atan2(p.x - sp.x, p.z - sp.z) : sp.yaw
        let dy = want - sp.m.group.rotation.y
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        sp.m.group.rotation.y += dy * Math.min(1, dt * 4) // turn to look at you
      }
      if (lamp) poseMonster(lamp, t, { glow: talking?.sp.id === 'lamplighter' ? 1 : 0.7 })
      if (gardener) poseMonster(gardener, t, { pose: talking?.sp.id === 'gardener' ? 'stand' : 'prune' })

      // fireworks: a few on their own, more when you push the button
      nextAmbient -= dt
      if (nextAmbient <= 0) { nextAmbient = 4 + Math.random() * 5; show(1 + Math.floor(Math.random() * 2)) }
      stepFireworks(dt)
      windowFace.update(dt, camera)

      // camera: walking, or riding
      if (ride?.kind === 'ferris') {
        const gp = gondolaPos(ride.k)
        camera.position.set(gp.x + 0.2, gp.y - 0.82, gp.z) // sitting in the tub, eyes over the rim
        if (!ride.topped && Math.sin(gp.a) > 0.97) {
          ride.topped = true
          say('🎡 You can see the whole hotel from up here!', 4000)
          show(9)
          earn('ferris')
        }
        if (ride.topped && Math.sin(gp.a) < -0.995 && wheelAngle - ride.start > Math.PI * 2) endRide() // one full turn, then off at the bottom
      } else if (ride?.kind === 'carousel') {
        const h = horses[ride.k]
        h.horse.getWorldPosition(tmp)
        camera.position.set(tmp.x, tmp.y + 1.05, tmp.z)
      } else {
        camera.position.set(p.x, 1.6, p.z)
      }
      camera.rotation.y = p.yaw
      camera.rotation.x = p.pitch

      // what are we looking at?
      let focus = null
      if (!ride) {
        const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw)
        let bestD = 99
        for (const st of [...STATIONS, ...speakers.map(sp => ({ ...sp, speaker: sp }))]) {
          const dx = st.x - p.x, dz = st.z - p.z, d = Math.hypot(dx, dz)
          if (d > st.reach) continue
          if (d > 0.4 && (dx * fx + dz * fz) / d < 0.4) continue
          if (d < bestD) { bestD = d; focus = st }
        }
      }
      const pr = talking ? null : ride ? '[E] Hop off' : focus ? `[E] ${focus.label}` : null
      if (pr !== lastPrompt) { lastPrompt = pr; setPrompt(pr) }
      if (input.use) { input.use = false; if (!talking) use(focus) }

      renderer.render(scene, camera)

      labelT -= dt
      if (labelT <= 0) {
        labelT = 0.12
        const w = mount.clientWidth, h = mount.clientHeight
        const out = []
        if (!ride && !talking) for (const st of [...STATIONS, ...speakers]) {
          tmp.set(st.x, st.ly, st.z)
          const d = tmp.distanceTo(camera.position)
          tmp.project(camera)
          if (tmp.z > 1 || d > 26) continue
          out.push({ id: st.id, text: st.label, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, o: Math.min(1, (26 - d) / 6) })
        }
        setLabels(out)
      }
    }
    raf = requestAnimationFrame(tick)
    say(met.length
      ? '🌙 The Moonlight Fair. The staff come out here after their shifts. Nobody chases anybody tonight.'
      : "🌙 The Moonlight Fair. It's quiet — the staff only come out once you've met them inside.", 6000)
    if (import.meta.env.DEV) window.__fair = { windowFace, p, use: () => { input.use = true }, get ride() { return ride }, get talking() { return talking }, next: () => { if (talking) advanceTalk() } }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(capTimer)
      stopOrgan?.()
      if (import.meta.env.DEV) delete window.__fair
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerlockchange', onLockChange)
      renderer.domElement.removeEventListener('click', onClick)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.()
      fireworks.forEach(f => { if (f.pts) { f.pts.geometry.dispose(); f.pts.material.dispose() } if (f.mesh) f.mesh.material.dispose() })
      windowFace.dispose()
      disposables.forEach(d => { d.map?.dispose?.(); d.dispose?.() })
      disposeMonsters(monsters)
      A.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.playWrap}>
      <div ref={mountRef} className={styles.mount} />
      {labels.map(l => <div key={l.id} className={styles.lobbyLabel} style={{ left: l.x, top: l.y, opacity: l.o }}>{l.text}</div>)}
      {!riding && !dialogue && <div className={styles.crosshair} />}
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
      {prompt && !dialogue && <div className={styles.prompt}>{prompt}</div>}
      {caption && <div className={`${styles.caption} ${styles.capGood}`}>{caption}</div>}
      {!locked && <div className={styles.lockHint}>Click to look around · WASD move (Shift to run) · E to use · the glowing door goes back inside</div>}
      <div className={styles.hudTop}><span>🎡 The Moonlight Fair</span>{riding && <span>{riding === 'ferris' ? '🎡 Riding the wheel' : '🎠 Riding the carousel'}</span>}</div>
      <div className={styles.toastWrap}>
        {toasts.map(a => <div key={a.key} className={styles.toast}><span className={styles.toastIcon}>{a.icon}</span><span><b>Achievement unlocked!</b><br />{a.name}</span></div>)}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: fade, transition: 'opacity 0.6s', pointerEvents: 'none', zIndex: 40 }} />
    </div>
  )
}
