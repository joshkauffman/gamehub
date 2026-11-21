// ── The Totally Scary Horror Game — monster models ─────────────────────
// Six cartoon "monsters", each built around a visual joke about who they
// really are: a werewolf crammed into a bellhop uniform, a guy under a
// striped hotel bedsheet, a round floating vampire with joke-shop
// dentures and spinning hypno-eyes, a mummy wrapped so stiff he can only
// hop, a union-organizing vegetarian zombie, and a suit of armor with
// nobody inside it at all. Cel-shaded with a tiny gradient map.
//
// Each builder returns { group, legs, arms, sitDrop, head, animate }.
// Groups face local +Z (rotation.y = atan2(dx, dz) points along (dx, dz)).
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

let gradientMap = null
function toonGradient() {
  if (gradientMap) return gradientMap
  const data = new Uint8Array([70, 140, 210, 255])
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RedFormat)
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter
  gradientMap.needsUpdate = true
  return gradientMap
}

function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra })
}

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function sphere(r, mat, x = 0, y = 0, z = 0, seg = 18) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat)
  m.position.set(x, y, z)
  return m
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.position.set(x, y, z)
  return m
}
function capsule(r, len, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat)
  m.position.set(x, y, z)
  return m
}
function boxm(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}
function cone(r, h, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat)
  m.position.set(x, y, z)
  return m
}

// One big friendly cartoon eye: white, iris, pupil, highlight.
function eye(r, iris = 0x3a2a1a) {
  const e = new THREE.Group()
  e.add(sphere(r, toon(0xffffff)))
  e.add(sphere(r * 0.55, toon(iris), 0, 0, r * 0.62))
  e.add(sphere(r * 0.32, toon(0x0a0a0a), 0, 0, r * 0.8))
  e.add(sphere(r * 0.12, new THREE.MeshBasicMaterial({ color: 0xffffff }), r * 0.2, r * 0.25, r * 0.98, 8))
  return e
}

function limbPivot(parent, x, y, z, child) {
  const pivot = new THREE.Group()
  pivot.position.set(x, y, z)
  pivot.add(child)
  parent.add(pivot)
  return pivot
}

// ── Barry: a werewolf crammed into a bellhop uniform, shedding constantly ──
function buildBarry() {
  const g = new THREE.Group()
  const fur = toon(0x9a8fbf), furLight = toon(0xeae2f8), jacket = toon(0xc8283c)
  const gold = toon(0xf0c040), dark = toon(0x1a1420), pink = toon(0xff8fb0)

  const legs = [-1, 1].map(sx => {
    const pivot = limbPivot(g, sx * 0.17, 0.55, 0, capsule(0.11, 0.26, fur, 0, -0.25, 0))
    const foot = sphere(0.14, furLight, 0, -0.5, 0.08); foot.scale.set(1, 0.55, 1.5)
    pivot.add(foot)
    return pivot
  })
  const belly = sphere(0.42, fur, 0, 0.95, 0); belly.scale.set(1, 1.05, 0.9); g.add(belly)
  g.add(cyl(0.43, 0.46, 0.5, jacket, 0, 1.06, 0, 22))
  // fur bursting out under the too-small jacket
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    const t = cone(0.07, 0.16, furLight, Math.cos(a) * 0.43, 0.78, Math.sin(a) * 0.4, 6)
    t.rotation.x = Math.PI
    g.add(t)
  }
  for (let row = 0; row < 3; row++) for (const sx of [-1, 1]) g.add(sphere(0.035, gold, sx * 0.12, 1.22 - row * 0.13, 0.44, 8))
  for (const sx of [-1, 1]) {
    const ep = cyl(0.13, 0.13, 0.05, gold, sx * 0.4, 1.31, 0, 14)
    ep.rotation.z = sx * 0.35
    g.add(ep)
    for (let k = 0; k < 4; k++) g.add(cyl(0.01, 0.01, 0.12, gold, sx * (0.32 + k * 0.05), 1.22, 0.08, 4))
  }

  const head = new THREE.Group(); head.position.set(0, 1.64, 0.05); g.add(head)
  head.add(sphere(0.36, fur))
  // cheek-and-chin mane
  for (let k = 0; k <= 10; k++) {
    const th = Math.PI * 0.9 + (k / 10) * Math.PI * 1.2
    const tuft = sphere(0.12, furLight, Math.cos(th) * 0.37, Math.sin(th) * 0.32 - 0.03, 0.1, 10)
    tuft.scale.z = 0.7
    head.add(tuft)
  }
  const snout = sphere(0.18, furLight, 0, -0.1, 0.3); snout.scale.set(1, 0.75, 1.3); head.add(snout)
  const nose = sphere(0.075, dark, 0, -0.03, 0.53); nose.scale.set(1.3, 1, 1); head.add(nose)
  const tongue = boxm(0.09, 0.02, 0.2, pink, 0.1, -0.25, 0.42); tongue.rotation.set(0.6, 0, 0.5); head.add(tongue)
  for (const sx of [-1, 1]) {
    const e = eye(0.1, 0xe0a020); e.position.set(sx * 0.14, 0.1, 0.27); head.add(e)
    const brow = boxm(0.15, 0.04, 0.04, dark, sx * 0.14, 0.24, 0.32); brow.rotation.z = -sx * 0.3; head.add(brow)
    const ear = cone(0.11, 0.34, fur, sx * 0.24, 0.32, -0.04); ear.rotation.z = -sx * 0.3; head.add(ear)
    const inner = cone(0.06, 0.2, pink, sx * 0.23, 0.3, 0.02); inner.rotation.z = -sx * 0.3; head.add(inner)
  }
  const hat = new THREE.Group(); hat.position.set(0.08, 0.37, 0); hat.rotation.z = -0.3; head.add(hat)
  hat.add(cyl(0.17, 0.17, 0.13, jacket, 0, 0, 0, 18))
  hat.add(cyl(0.175, 0.175, 0.035, gold, 0, -0.03, 0, 18))
  hat.add(sphere(0.03, gold, 0, 0.08, 0, 8))

  const arms = [-1, 1].map(sx => {
    const arm = new THREE.Group()
    arm.add(capsule(0.09, 0.3, jacket, 0, -0.18, 0))
    arm.add(sphere(0.11, furLight, 0, -0.38, 0, 10))
    arm.add(sphere(0.1, fur, 0, -0.47, 0.02, 10))
    const p = limbPivot(g, sx * 0.47, 1.3, 0, arm)
    p.rotation.z = sx * 0.2
    p.userData.base = 0
    return p
  })

  // big fluffy tail
  const tail = new THREE.Group(); tail.position.set(0, 0.85, -0.38); g.add(tail)
  ;[0.11, 0.15, 0.17, 0.16, 0.12].forEach((r, i) => tail.add(sphere(r, i === 4 ? furLight : fur, 0, i * 0.12, -i * 0.09, 12)))
  tail.rotation.x = -0.3

  // fur puffs drifting off him, always
  const shed = []
  for (let k = 0; k < 14; k++) {
    const puff = sphere(0.035, furLight, 0, 0, 0, 6)
    puff.userData = { a: Math.random() * Math.PI * 2, r: 0.35 + Math.random() * 0.35, ph: Math.random() }
    g.add(puff); shed.push(puff)
  }

  function animate(t, { moving, sitting }) {
    tail.rotation.y = Math.sin(t * (moving ? 14 : 6)) * 0.5
    for (const p of shed) {
      const u = p.userData
      const f = (t * (moving ? 0.9 : 0.3) + u.ph) % 1
      p.position.set(Math.cos(u.a + f * 2) * u.r, 1.7 - f * 1.7, Math.sin(u.a + f * 2) * u.r - (moving ? f * 0.8 : 0))
      p.visible = !sitting || f < 0.5
    }
  }
  return { group: g, legs, arms, sitDrop: 0.42, head, animate }
}

// ── Pale Steve: a guy under a striped hotel bedsheet, wearing glasses ──
function buildSteve() {
  const g = new THREE.Group()
  const body = new THREE.Group(); g.add(body)
  const sheetTex = canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#eef4ff'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#b8cdee'
    for (let x = 0; x < w; x += 48) ctx.fillRect(x, 0, 14, h)
    ctx.save(); ctx.translate(w * 0.32, h * 0.62); ctx.rotate(-0.15)
    ctx.strokeStyle = 'rgba(200,60,60,0.55)'; ctx.lineWidth = 3; ctx.strokeRect(-56, -18, 112, 34)
    ctx.fillStyle = 'rgba(200,60,60,0.6)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('PROPERTY OF', 0, -3); ctx.fillText('THE HOTEL', 0, 12)
    ctx.restore()
  }, true)
  const sheetM = new THREE.MeshToonMaterial({ map: sheetTex, gradientMap: toonGradient(), side: THREE.DoubleSide })
  const pts = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const y = 1.95 - t * 1.75
    const r = t < 0.22 ? Math.sin((t / 0.22) * Math.PI / 2) * 0.36 : 0.36 + (t - 0.22) * 0.32
    pts.push(new THREE.Vector2(Math.max(0.001, r), y))
  }
  const geo = new THREE.LatheGeometry(pts, 32)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0.35) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i))
      pos.setY(i, pos.getY(i) + Math.sin(a * 7) * 0.05)
    }
  }
  geo.computeVertexNormals()
  body.add(new THREE.Mesh(geo, sheetM))
  // hands raised under the sheet, mid-"boo"
  const hands = [-1, 1].map(sx => {
    const hnd = sphere(0.12, sheetM, sx * 0.4, 1.3, 0.12, 12)
    hnd.scale.set(1, 1.3, 1)
    body.add(hnd)
    return hnd
  })
  // eye holes, cut too small, behind big round glasses
  const frame = toon(0x2a1a10)
  for (const sx of [-1, 1]) {
    body.add(sphere(0.03, toon(0x0a0a0a), sx * 0.11, 1.62, 0.34, 8))
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.013, 8, 22), frame)
    lens.position.set(sx * 0.11, 1.62, 0.37)
    body.add(lens)
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 18), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35 }))
    glass.position.set(sx * 0.11, 1.62, 0.372)
    body.add(glass)
  }
  body.add(boxm(0.07, 0.015, 0.015, frame, 0, 1.63, 0.375))
  // laundry tag at the hem
  const tag = boxm(0.12, 0.08, 0.005, toon(0xffffff), 0.3, 0.32, 0.43); tag.rotation.y = 0.5; body.add(tag)
  // mismatched socks + sneakers poking out
  ;[[-1, 0xd03040, 0x3a6ad0], [1, 0x40b060, 0xf0c030]].forEach(([sx, sock, shoe]) => {
    g.add(cyl(0.055, 0.055, 0.18, toon(sock), sx * 0.14, 0.17, 0.1, 10))
    const s = boxm(0.14, 0.09, 0.26, toon(shoe), sx * 0.14, 0.05, 0.14)
    s.add(boxm(0.15, 0.03, 0.27, toon(0xffffff), 0, -0.04, 0))
    g.add(s)
  })

  function animate(t, { sitting }) {
    body.position.y = Math.sin(t * 2.4) * 0.03
    body.rotation.z = Math.sin(t * 1.7) * 0.04
    hands.forEach((h, i) => { h.position.y = (sitting ? 1.05 : 1.3) + Math.sin(t * 5 + i * 2) * 0.05 })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.3, animate }
}

// ── Drakko: a round floating vampire with bat wings, joke-shop dentures,
// and the spinning hypno-spiral eyes you are NOT supposed to look into ──
function buildDrakko() {
  const g = new THREE.Group()
  const skin = toon(0xc9b8ef), capeOut = toon(0x24122e, { side: THREE.DoubleSide }), capeIn = toon(0xb01c3a, { side: THREE.DoubleSide })
  const spiralTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d0204a'; ctx.lineWidth = 12; ctx.lineCap = 'round'
    ctx.beginPath()
    for (let a = 0; a < Math.PI * 9; a += 0.08) {
      const r = a * 4.3
      const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.fillStyle = '#2a0a2a'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2); ctx.fill()
  })

  const orb = sphere(0.44, skin, 0, 1.5, 0, 26); orb.scale.y = 1.05; g.add(orb)
  // cape wrapped around the back of the orb, flaring at the bottom
  // (SphereGeometry phi runs so that phi = 3π/2 is the -Z side, i.e. his back.)
  const capeGeo = new THREE.SphereGeometry(0.47, 26, 16, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.2, Math.PI * 0.8)
  const cape = new THREE.Mesh(capeGeo, capeOut); cape.position.y = 1.5; g.add(cape)
  const lining = new THREE.Mesh(capeGeo, capeIn); lining.position.y = 1.5; lining.scale.setScalar(0.97); g.add(lining)
  for (const sx of [-1, 1]) {
    const collar = boxm(0.34, 0.5, 0.025, capeIn, sx * 0.26, 1.92, -0.12)
    collar.rotation.set(-0.15, sx * 0.55, -sx * 0.25)
    g.add(collar)
  }
  // slicked hair + widow's peak
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.455, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.3), toon(0x14101c))
  hair.position.y = 1.52; g.add(hair)
  const peak = cone(0.09, 0.2, toon(0x14101c), 0, 1.8, 0.33, 4); peak.rotation.x = Math.PI + 0.7; g.add(peak)
  // hypno-eyes
  const eyes = [-1, 1].map(sx => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 26), toon(0x2a0a2a))
    rim.position.set(sx * 0.16, 1.6, 0.41)
    g.add(rim)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 28), new THREE.MeshBasicMaterial({ map: spiralTex }))
    disc.position.set(sx * 0.16, 1.6, 0.415)
    g.add(disc)
    return disc
  })
  // oversized joke-shop dentures
  const gum = toon(0xff7a9a), tooth = toon(0xffffff)
  const upper = new THREE.Group(); upper.position.set(0, 1.36, 0.42); g.add(upper)
  upper.add(boxm(0.36, 0.06, 0.12, gum, 0, 0.03, 0))
  for (let k = 0; k < 6; k++) upper.add(boxm(0.05, 0.07, 0.05, tooth, -0.14 + k * 0.056, -0.03, 0.04))
  for (const sx of [-1, 1]) { const f = cone(0.025, 0.1, tooth, sx * 0.12, -0.08, 0.05, 6); f.rotation.x = Math.PI; upper.add(f) }
  const jaw = new THREE.Group(); jaw.position.set(0, 1.3, 0.38); g.add(jaw)
  const lower = new THREE.Group(); lower.position.z = 0.04; jaw.add(lower)
  lower.add(boxm(0.34, 0.06, 0.12, gum, 0, -0.06, 0))
  for (let k = 0; k < 6; k++) lower.add(boxm(0.05, 0.06, 0.05, tooth, -0.14 + k * 0.056, 0, 0.04))
  // bat wings
  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0)
  wingShape.lineTo(0.35, 0.3)
  wingShape.lineTo(0.85, 0.22)
  wingShape.quadraticCurveTo(0.75, 0.05, 0.85, -0.12)
  wingShape.quadraticCurveTo(0.62, -0.02, 0.55, -0.2)
  wingShape.quadraticCurveTo(0.38, -0.04, 0.25, -0.18)
  wingShape.quadraticCurveTo(0.15, -0.05, 0, -0.1)
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.02, bevelEnabled: false })
  const wings = [-1, 1].map(sx => {
    const pivot = new THREE.Group()
    pivot.position.set(sx * 0.36, 1.58, -0.12)
    const w = new THREE.Mesh(wingGeo, capeOut)
    w.scale.x = sx
    pivot.add(w)
    g.add(pivot)
    return pivot
  })
  // little dangling feet in pointy shoes
  for (const sx of [-1, 1]) {
    g.add(cyl(0.04, 0.04, 0.2, toon(0x14101c), sx * 0.12, 1.02, 0, 8))
    const shoe = cone(0.06, 0.2, toon(0x14101c), sx * 0.12, 0.92, 0.07, 8); shoe.rotation.x = Math.PI / 2; g.add(shoe)
  }

  function animate(t, { sitting }) {
    eyes[0].rotation.z = t * 3
    eyes[1].rotation.z = -t * 3
    jaw.rotation.x = Math.abs(Math.sin(t * (sitting ? 9 : 14))) * 0.45
    const flap = Math.sin(t * (sitting ? 3 : 9))
    wings.forEach((w, i) => { const sx = i ? 1 : -1; w.rotation.y = -sx * (0.35 + flap * 0.45) })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.25, animate }
}

// ── Wendell: a mummy wrapped so tight he's basically a plank, so he hops ──
function buildWendell(assets) {
  const g = new THREE.Group()
  const body = new THREE.Group(); g.add(body)
  const wrapTex = assets.bandage.clone()
  wrapTex.wrapS = wrapTex.wrapT = THREE.RepeatWrapping
  wrapTex.repeat.set(2, 4)
  wrapTex.needsUpdate = true
  const wrap = new THREE.MeshToonMaterial({ map: wrapTex, gradientMap: toonGradient() })
  const plank = new THREE.Mesh(new RoundedBoxGeometry(0.58, 1.65, 0.34, 4, 0.14), wrap)
  plank.position.y = 1.05
  body.add(plank)
  // one eye peeking out through a gap, the other one squeezed shut
  body.add(boxm(0.4, 0.09, 0.02, toon(0x2a2018), 0, 1.6, 0.17))
  const peek = eye(0.08, 0x3070c0); peek.position.set(0.1, 1.6, 0.16); peek.scale.z = 0.6; body.add(peek)
  const shut = boxm(0.09, 0.015, 0.02, toon(0x2a2018), -0.1, 1.6, 0.185); shut.rotation.z = 0.2; body.add(shut)
  // a bandage bow on top, like bunny ears
  const bow = new THREE.Group(); bow.position.set(0.08, 1.9, 0); bow.rotation.z = -0.2; body.add(bow)
  for (const sx of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16), wrap)
    loop.position.set(sx * 0.1, 0.06, 0); loop.rotation.set(0, 0.4, sx * 0.6); bow.add(loop)
  }
  bow.add(sphere(0.045, wrap, 0, 0, 0, 10))
  // arms stuck straight out forever, with ice packs taped to the elbows
  for (const sx of [-1, 1]) {
    const arm = capsule(0.085, 0.55, wrap, sx * 0.36, 1.4, 0.3)
    arm.rotation.x = Math.PI / 2
    body.add(arm)
    body.add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.08, 0.16, 2, 0.03), toon(0x6ac0ff)).translateX(sx * 0.36).translateY(1.5).translateZ(0.3))
  }
  // stubby feet
  for (const sx of [-1, 1]) body.add(capsule(0.1, 0.12, wrap, sx * 0.14, 0.17, 0.04))
  // one loose bandage trailing behind, waving
  const ribbon = []
  let parent = body
  const root = new THREE.Group(); root.position.set(-0.12, 0.75, -0.17); body.add(root); parent = root
  for (let k = 0; k < 9; k++) {
    const seg = new THREE.Group()
    seg.position.z = k === 0 ? 0 : -0.17
    seg.add(boxm(0.09, 0.012, 0.18, wrap, 0, 0, -0.085))
    parent.add(seg); parent = seg
    ribbon.push(seg)
  }

  function animate(t, { moving, sitting }) {
    const hop = moving ? Math.abs(Math.sin(t * 7)) * 0.22 : 0
    body.position.y = hop
    body.rotation.x = sitting ? -0.3 : moving ? -0.08 : 0
    ribbon.forEach((s, i) => { s.rotation.x = 0.25 + Math.sin(t * 5 - i * 0.7) * 0.28; s.rotation.y = Math.sin(t * 3 - i * 0.5) * 0.15 })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.4, animate }
}

// ── Gary: hunched vegetarian zombie in a cardigan, organizing a union ──
function buildGary() {
  const g = new THREE.Group()
  const skin = toon(0x9ccc7a), pants = toon(0x3a4a6a)
  const argyle = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c08a3a'; ctx.fillRect(0, 0, w, h)
    const s = 32
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      ctx.fillStyle = ((x + y) / s) % 2 ? '#6a4a8a' : '#4a7a5a'
      ctx.beginPath(); ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s, y + s / 2); ctx.lineTo(x + s / 2, y + s); ctx.lineTo(x, y + s / 2); ctx.fill()
    }
    ctx.strokeStyle = '#f0e0b0'; ctx.lineWidth = 1.5
    for (let k = -h; k < w; k += s) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + h, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k + h, 0); ctx.lineTo(k, h); ctx.stroke() }
  }, true)
  argyle.repeat.set(2, 1)
  const sweater = new THREE.MeshToonMaterial({ map: argyle, gradientMap: toonGradient() })

  const torso = capsule(0.31, 0.42, sweater, 0, 1.0, 0.04); torso.rotation.x = 0.3; g.add(torso)
  for (let k = 0; k < 3; k++) g.add(sphere(0.03, toon(0x4a2a10), 0, 1.18 - k * 0.15, 0.32 - k * 0.03, 8))

  const head = new THREE.Group(); head.position.set(0, 1.56, 0.24); g.add(head)
  const skull = sphere(0.34, skin); skull.scale.set(1.05, 0.95, 1); head.add(skull)
  const big = eye(0.12, 0x6a8a3a); big.position.set(-0.13, 0.05, 0.25); head.add(big)
  const small = eye(0.085, 0x6a8a3a); small.position.set(0.14, 0.03, 0.27); head.add(small)
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(0x7aa860))
  lid.position.copy(small.position); lid.rotation.x = -0.2; head.add(lid)
  head.add(boxm(0.14, 0.025, 0.02, toon(0x2a3a1a), 0, -0.15, 0.31))
  head.add(boxm(0.035, 0.045, 0.02, toon(0xffffff), 0.03, -0.18, 0.31))
  // a little sprout growing out of the top (he's vegetarian, it's fine)
  const sprout = new THREE.Group(); sprout.position.y = 0.32; head.add(sprout)
  sprout.add(cyl(0.012, 0.015, 0.16, toon(0x3a8a2a), 0, 0.06, 0, 6))
  for (const sx of [-1, 1]) { const leaf = sphere(0.06, toon(0x5ac040), sx * 0.06, 0.15, 0, 10); leaf.scale.set(1.2, 0.35, 0.7); leaf.rotation.z = sx * 0.4; sprout.add(leaf) }

  const legs = [-1, 1].map(sx => {
    const leg = new THREE.Group()
    leg.add(capsule(0.1, 0.3, pants, 0, -0.22, 0))
    if (sx < 0) leg.add(cyl(0.12, 0.12, 0.1, toon(0xffffff), 0, -0.2, 0))
    // bunny slippers
    const slip = sphere(0.12, toon(0xffc8dc), 0, -0.46, 0.07, 12); slip.scale.set(0.9, 0.6, 1.4); leg.add(slip)
    for (const ex of [-1, 1]) { const ear = capsule(0.025, 0.08, toon(0xffc8dc), ex * 0.04, -0.36, 0.17); ear.rotation.x = 0.5; leg.add(ear) }
    leg.add(sphere(0.015, toon(0x111111), -0.03, -0.42, 0.23, 6)); leg.add(sphere(0.015, toon(0x111111), 0.03, -0.42, 0.23, 6))
    return limbPivot(g, sx * 0.15, 0.6, 0, leg)
  })

  // left arm reaches out holding a carrot; right arm holds up a picket sign
  const leftArm = new THREE.Group()
  leftArm.add(capsule(0.085, 0.4, sweater, 0, -0.22, 0))
  leftArm.add(sphere(0.09, skin, 0, -0.48, 0, 10))
  const carrot = cone(0.045, 0.24, toon(0xff8a20), 0.02, -0.55, 0.08, 8); carrot.rotation.x = 1.9; leftArm.add(carrot)
  leftArm.add(cone(0.04, 0.08, toon(0x3aa030), 0.02, -0.52, -0.05, 5))
  const la = limbPivot(g, -0.38, 1.3, 0.1, leftArm)
  la.rotation.x = -1.3; la.userData.base = -1.3
  const rightArm = new THREE.Group()
  rightArm.add(capsule(0.085, 0.4, sweater, 0, 0.22, 0))
  rightArm.add(sphere(0.09, skin, 0, 0.48, 0, 10))
  const signTex = canvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f4ecd0'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#c02a2a'; ctx.textAlign = 'center'
    ctx.font = 'bold 36px sans-serif'; ctx.fillText('ZOMBIES', w / 2, 52); ctx.fillText('UNITE!', w / 2, 96)
    ctx.fillStyle = '#4a3a2a'; ctx.font = 'italic 18px sans-serif'; ctx.fillText('(Local No. 1)', w / 2, 132)
  })
  const sign = new THREE.Group(); sign.position.y = 0.5; rightArm.add(sign)
  sign.add(cyl(0.02, 0.02, 0.6, toon(0x8a5a2a), 0, 0.1, 0, 6))
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.35, 0.025), [toon(0x8a5a2a), toon(0x8a5a2a), toon(0x8a5a2a), toon(0x8a5a2a), new THREE.MeshBasicMaterial({ map: signTex }), toon(0x8a5a2a)])
  board.position.y = 0.45
  sign.add(board)
  const ra = limbPivot(g, 0.4, 1.25, 0.05, rightArm)
  ra.rotation.z = -0.2

  function animate(t, { moving, sitting }) {
    sign.rotation.z = Math.sin(t * (moving ? 6 : 2)) * 0.12
    ra.rotation.x = sitting ? -0.2 : 0
    sprout.rotation.z = Math.sin(t * 3) * 0.2
  }
  return { group: g, legs, arms: [la], sitDrop: 0.45, head, animate }
}

// ── Sir Reginald: a suit of armor with nobody inside — every piece floats
// on its own — knitting a scarf by feel ──
function buildReginald(assets) {
  const g = new THREE.Group()
  // Low metalness on purpose: there's no environment map to reflect, so
  // "real" metal would render nearly black.
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8e4, metalness: 0.3, roughness: 0.32 })
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x8a8e9a, metalness: 0.3, roughness: 0.45 })
  const scarfTex = assets.scarf.clone(); scarfTex.wrapS = scarfTex.wrapT = THREE.RepeatWrapping; scarfTex.needsUpdate = true
  const scarfM = new THREE.MeshToonMaterial({ map: scarfTex, gradientMap: toonGradient() })
  const parts = []
  const part = (obj, phase) => { obj.userData.baseY = obj.position.y; obj.userData.phase = phase; g.add(obj); parts.push(obj); return obj }

  // boots
  const boots = [-1, 1].map(sx => {
    const b = new THREE.Group(); b.position.set(sx * 0.17, 0, 0)
    b.add(boxm(0.17, 0.14, 0.22, steel, 0, 0.07, 0))
    b.add(sphere(0.09, steel, 0, 0.07, 0.12, 12))
    g.add(b)
    return b
  })
  // greaves, floating above the boots
  for (const sx of [-1, 1]) part(cyl(0.09, 0.075, 0.38, steel, sx * 0.17, 0.42, 0), sx)
  // skirt
  part(cyl(0.29, 0.36, 0.2, steelDark, 0, 0.82, 0, 18), 0.5)
  // breastplate
  const chest = new THREE.Group(); chest.position.y = 1.2
  const plate = capsule(0.3, 0.22, steel, 0, 0, 0); plate.scale.set(1.08, 1, 0.8); chest.add(plate)
  chest.add(boxm(0.03, 0.45, 0.02, steelDark, 0, 0, 0.245))
  part(chest, 1.2)
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel)
    p.position.set(sx * 0.42, 1.42, 0); p.rotation.z = -sx * 0.4
    part(p, 2 + sx)
  }
  // helmet, floating well clear of the shoulders
  const helm = new THREE.Group(); helm.position.y = 1.95
  helm.add(cyl(0.22, 0.24, 0.4, steel, 0, 0, 0, 20))
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel); dome.position.y = 0.2; helm.add(dome)
  helm.add(boxm(0.3, 0.035, 0.04, toon(0x111111), 0, 0.04, 0.22))
  for (let k = 0; k < 5; k++) helm.add(sphere(0.02, toon(0x9a5a2a), -0.12 + k * 0.06, 0.04 + (k % 2) * 0.03, 0.235, 6))
  ;[[0xd02a3a, -0.08], [0xf0c030, 0], [0x2a7ad0, 0.08]].forEach(([c, x], i) => {
    const feather = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.32, 4, 8), toon(c))
    feather.position.set(x, 0.5, -0.06 - i * 0.02); feather.rotation.set(-0.5, 0, x * 3)
    helm.add(feather)
  })
  part(helm, 3.1)
  // the scarf around nobody's neck, with a tail trailing to the floor
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.075, 10, 26), scarfM)
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.56
  part(scarf, 1.6)
  const tail = boxm(0.14, 1.1, 0.04, scarfM, 0.16, 1.02, 0.22); tail.rotation.z = 0.12
  part(tail, 1.6)
  // gauntlets floating out front, knitting
  const gaunts = [-1, 1].map(sx => {
    const gl = new THREE.Group(); gl.position.set(sx * 0.2, 1.08, 0.42)
    const hand = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.14, 0.1, 2, 0.03), steel); gl.add(hand)
    gl.add(cyl(0.07, 0.06, 0.14, steelDark, 0, -0.1, -0.03, 10))
    const needle = cyl(0.008, 0.008, 0.36, toon(0xe8d8a8), -sx * 0.06, 0.08, 0.04, 6); needle.rotation.z = sx * 0.9; gl.add(needle)
    part(gl, 4 + sx)
    return gl
  })
  const knitting = boxm(0.22, 0.2, 0.03, scarfM, 0, 0.94, 0.46)
  part(knitting, 4)
  const yarn = sphere(0.1, toon(0x3a8ad0), 0.35, 0.1, 0.35, 14)
  g.add(yarn)

  function animate(t, { moving, sitting }) {
    for (const p of parts) p.position.y = p.userData.baseY + Math.sin(t * 2 + p.userData.phase) * 0.035
    gaunts.forEach((gl, i) => { gl.rotation.z = Math.sin(t * 9 + i * Math.PI) * 0.25; gl.position.x = (i ? 0.2 : -0.2) + Math.sin(t * 9 + i * Math.PI) * 0.03 })
    helm.rotation.z = sitting ? Math.sin(t * 1.3) * 0.15 : Math.sin(t * 0.8) * 0.08
    boots.forEach((b, i) => {
      const ph = t * 6 + i * Math.PI
      b.position.z = moving ? Math.sin(ph) * 0.14 : 0
      b.position.y = moving ? Math.max(0, Math.cos(ph)) * 0.06 : 0
    })
    yarn.visible = !moving
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.4, animate }
}

// ── Doris: a witch-turned-housekeeper riding a vacuum cleaner instead of a broom ──
function buildDoris() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); g.add(rig)
  const skin = toon(0x9ad86a), dress = toon(0x5a2a7a), apron = toon(0xffffff), hairM = toon(0xff7a2a)
  const vacM = toon(0xe03a4a), chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 0.4, roughness: 0.3 })
  // the vacuum, lying along Z like a broom: canister at the back, nozzle out front
  const canister = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.34, 0.55, 3, 0.1), vacM); canister.position.set(0, 0.62, -0.45); rig.add(canister)
  for (const sx of [-1, 1]) { const w = cyl(0.09, 0.09, 0.05, toon(0x222222), sx * 0.23, 0.5, -0.45, 12); w.rotation.z = Math.PI / 2; rig.add(w) }
  const handle = cyl(0.035, 0.035, 1.3, chrome, 0, 0.62, 0.3, 8); handle.rotation.x = Math.PI / 2; rig.add(handle)
  const nozzle = boxm(0.4, 0.08, 0.16, vacM, 0, 0.58, 0.98); rig.add(nozzle)
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 18, Math.PI * 1.3), toon(0x444444)); hose.position.set(0.25, 0.72, -0.15); hose.rotation.y = Math.PI / 2; rig.add(hose)
  // Doris, sitting side-saddle-ish on the handle
  const body = new THREE.Group(); body.position.set(0, 0.68, -0.05); rig.add(body)
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 16), dress); skirt.position.y = 0.2; body.add(skirt)
  const ap = boxm(0.3, 0.36, 0.02, apron, 0, 0.22, 0.22); ap.rotation.x = -0.25; body.add(ap)
  body.add(capsule(0.17, 0.2, dress, 0, 0.55, 0))
  const head = new THREE.Group(); head.position.set(0, 0.95, 0.04); body.add(head)
  head.add(sphere(0.25, skin))
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; head.add(sphere(0.09, hairM, Math.cos(a) * 0.23, -0.02 + Math.sin(k * 1.7) * 0.05, Math.sin(a) * 0.2 - 0.04, 8)) }
  for (const sx of [-1, 1]) {
    const e = eye(0.075, 0x2a8a3a); e.position.set(sx * 0.1, 0.04, 0.2); head.add(e)
    head.add(sphere(0.05, toon(0xff8aa0), sx * 0.15, -0.07, 0.19, 8))
  }
  head.add(sphere(0.022, toon(0x5a8a3a), 0.09, -0.1, 0.24, 6)) // a wart, naturally
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), toon(0x3a1a1a)); smile.position.set(0, -0.09, 0.23); smile.rotation.z = Math.PI; head.add(smile)
  const hat = new THREE.Group(); hat.position.y = 0.2; hat.rotation.z = 0.2; head.add(hat)
  hat.add(cyl(0.36, 0.36, 0.03, dress, 0, 0, 0, 20))
  const tip = cone(0.2, 0.5, dress, 0, 0.26, 0, 16); tip.rotation.z = -0.2; hat.add(tip)
  hat.add(cyl(0.205, 0.205, 0.06, toon(0xffd84a), 0, 0.04, 0, 16))
  // one rubber-gloved hand with a feather duster
  const arm = new THREE.Group(); arm.position.set(0.2, 0.6, 0.05); body.add(arm)
  arm.add(capsule(0.05, 0.25, dress, 0.08, 0, 0.1)); arm.children[0].rotation.x = 1.2
  arm.add(sphere(0.06, toon(0xffe04a), 0.1, 0.05, 0.27, 8))
  const duster = cyl(0.015, 0.015, 0.4, toon(0x8a5a2a), 0.1, 0.2, 0.3, 6); arm.add(duster)
  for (let k = 0; k < 6; k++) arm.add(sphere(0.06, toon([0xff6a9a, 0x6ad0ff, 0xffd84a][k % 3]), 0.1 + Math.cos(k) * 0.05, 0.42 + (k % 2) * 0.05, 0.3 + Math.sin(k) * 0.05, 8))
  // dust bunnies trailing behind
  const dust = []
  for (let k = 0; k < 10; k++) { const d = sphere(0.05, toon(0xcfc6d8), 0, 0, 0, 6); d.userData.ph = k / 10; g.add(d); dust.push(d) }
  function animate(t, { moving, sitting }) {
    rig.position.y = sitting ? -0.25 : 0.15 + Math.sin(t * 4) * 0.06
    rig.rotation.z = Math.sin(t * 30) * (moving ? 0.02 : 0.005)
    arm.rotation.x = Math.sin(t * (sitting ? 2 : 8)) * 0.4
    for (const d of dust) {
      const f = (t * 1.5 + d.userData.ph) % 1
      d.visible = moving
      d.position.set(Math.sin(d.userData.ph * 20) * 0.3 * f, 0.6 + f * 0.4, -0.8 - f * 1.4)
      d.scale.setScalar(1 - f * 0.7)
    }
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.1, animate }
}

// ── Mildred: a closet skeleton in a fluffy bathrobe and hair curlers ──
function buildMildred() {
  const g = new THREE.Group()
  const bone = toon(0xf4efe2), robe = toon(0xff9ac8), dark = toon(0x2a2030)
  const robeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, 0.9, 18, 1, true), new THREE.MeshToonMaterial({ color: 0xff9ac8, gradientMap: toonGradient(), side: THREE.DoubleSide }))
  robeBody.position.y = 0.85; g.add(robeBody)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 20), toon(0xffe0ef)); collar.rotation.x = Math.PI / 2; collar.position.y = 1.3; g.add(collar)
  g.add(boxm(0.5, 0.06, 0.06, toon(0xffe0ef), 0, 0.85, 0.3)) // belt
  // ribs peeking out the front of the robe
  for (let k = 0; k < 4; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.13 - k * 0.012, 0.018, 6, 16, Math.PI), bone)
    rib.position.set(0, 1.2 - k * 0.07, 0.12); rib.rotation.x = -Math.PI / 2 + 0.3
    g.add(rib)
  }
  g.add(cyl(0.025, 0.025, 0.35, bone, 0, 1.1, 0.06, 6))
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.02); g.add(head)
  const skull = sphere(0.24, bone); skull.scale.set(1, 1.05, 1); head.add(skull)
  const jaw = boxm(0.2, 0.08, 0.16, bone, 0, -0.2, 0.06); head.add(jaw)
  for (const sx of [-1, 1]) {
    const socket = sphere(0.075, dark, sx * 0.09, 0.02, 0.18, 12); socket.scale.z = 0.5; head.add(socket)
    head.add(sphere(0.025, toon(0xffffff), sx * 0.09, 0.03, 0.215, 6)) // a little twinkle
    head.add(boxm(0.1, 0.012, 0.01, dark, sx * 0.1, 0.11, 0.2)) // lashes, she insists
  }
  const nose = cone(0.03, 0.05, dark, 0, -0.07, 0.22, 3); nose.rotation.x = Math.PI; head.add(nose)
  for (let k = 0; k < 5; k++) head.add(boxm(0.025, 0.035, 0.01, bone, -0.06 + k * 0.03, -0.15, 0.2))
  ;[[-0.14, 0.17], [0, 0.22], [0.14, 0.17], [-0.07, 0.24], [0.07, 0.24]].forEach(([x, y], k) => {
    const c = cyl(0.04, 0.04, 0.12, toon([0x6ad0ff, 0xffd84a, 0xa08aff][k % 3]), x, y, -0.02, 10); c.rotation.z = Math.PI / 2; head.add(c)
  })
  const arms = [-1, 1].map(sx => {
    const a = new THREE.Group()
    a.add(cyl(0.11, 0.08, 0.36, robe, 0, -0.17, 0, 10))
    a.add(cyl(0.02, 0.02, 0.25, bone, 0, -0.45, 0, 6))
    a.add(sphere(0.045, bone, 0, -0.58, 0, 8))
    const p = limbPivot(g, sx * 0.3, 1.28, 0, a); p.rotation.z = sx * 0.2; p.userData.base = 0
    return p
  })
  // teacup in one hand
  arms[1].add(cyl(0.05, 0.035, 0.07, toon(0xffffff), 0, -0.64, 0.05, 10))
  const legs = [-1, 1].map(sx => {
    const l = new THREE.Group()
    l.add(cyl(0.022, 0.022, 0.32, bone, 0, -0.16, 0, 6))
    const slip = sphere(0.09, toon(0xffe0ef), 0, -0.36, 0.05, 10); slip.scale.set(1, 0.6, 1.5); l.add(slip)
    return limbPivot(g, sx * 0.12, 0.42, 0, l)
  })
  function animate(t) {
    head.position.x = Math.sin(t * 40) * 0.006 // nervous rattle
    jaw.position.y = -0.2 - Math.abs(Math.sin(t * 7)) * 0.03
  }
  return { group: g, legs, arms, sitDrop: 0.38, head, animate }
}

// ── Tim: a very small spider with headphones and a podcast microphone ──
function buildTim() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); rig.scale.setScalar(1.6); g.add(rig)
  const fuzz = toon(0x4a2a6a), stripe = toon(0xffb84a)
  const abdomen = sphere(0.16, fuzz, 0, 0.22, -0.16); abdomen.scale.set(1, 0.9, 1.2); rig.add(abdomen)
  for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.13 - k * 0.02, 0.015, 6, 18), stripe); st.position.set(0, 0.22, -0.1 - k * 0.08); rig.add(st) }
  const head = new THREE.Group(); head.position.set(0, 0.24, 0.05); rig.add(head)
  head.add(sphere(0.13, fuzz))
  for (const sx of [-1, 1]) { const e = eye(0.06, 0x2a8ad0); e.position.set(sx * 0.055, 0.04, 0.1); head.add(e) }
  for (const sx of [-1, 1]) for (const sy of [0, 1]) { const e = eye(0.025, 0x2a8ad0); e.position.set(sx * 0.1, 0.1 + sy * 0.04, 0.06); head.add(e) }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 18, Math.PI), toon(0x222222)); band.position.y = 0.02; head.add(band)
  for (const sx of [-1, 1]) { const cup = cyl(0.05, 0.05, 0.04, toon(0xff4a6a), sx * 0.15, 0.0, 0, 12); cup.rotation.z = Math.PI / 2; head.add(cup) }
  const mic = new THREE.Group(); mic.position.set(0.08, 0.2, 0.22); rig.add(mic)
  mic.add(cyl(0.008, 0.008, 0.18, toon(0x333333), 0, -0.09, 0, 6))
  mic.add(sphere(0.035, toon(0x888888), 0, 0.01, 0, 10))
  const legs = []
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.1, 0.22, 0.05 - k * 0.08)
    const upper = cyl(0.012, 0.012, 0.18, fuzz, sx * 0.08, 0.04, 0, 5); upper.rotation.z = -sx * 1.1; leg.add(upper)
    const lower = cyl(0.01, 0.01, 0.22, fuzz, sx * 0.19, -0.06, 0, 5); lower.rotation.z = sx * 0.4; leg.add(lower)
    leg.rotation.y = sx * (k - 1.5) * 0.25
    rig.add(leg); legs.push(leg)
  }
  function animate(t) {
    legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 8 + i) * 0.15 })
    head.rotation.y = Math.sin(t * 2) * 0.2
  }
  return { group: g, legs: [], arms: [], sitDrop: -0.42, animate }
}

// ── Frank: a stitched-together monster who is, professionally, a door ──
function buildFrank() {
  const g = new THREE.Group()
  const skin = toon(0x8ab87a), wood = toon(0x7a4a28), woodDark = toon(0x4a2a14), boots = toon(0x2a2a2a), stitch = toon(0x2a3a2a)
  const legs = [-1, 1].map(sx => {
    const l = new THREE.Group()
    l.add(capsule(0.1, 0.35, toon(0x3a3a5a), 0, -0.25, 0))
    l.add(boxm(0.2, 0.14, 0.32, boots, 0, -0.55, 0.06))
    return limbPivot(g, sx * 0.16, 0.65, 0, l)
  })
  // his torso IS a door, complete with panels, a knob and a (wrong) number
  const door = new THREE.Group(); door.position.y = 1.2; g.add(door)
  door.add(boxm(0.7, 1.15, 0.2, wood))
  for (const py of [-0.25, 0.25]) door.add(boxm(0.5, 0.4, 0.02, woodDark, 0, py, 0.105))
  door.add(sphere(0.045, toon(0xf0c040), 0.24, -0.02, 0.13, 10))
  const plateTex = canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#d0a040'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3a2408'; ctx.font = 'bold 40px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('0??', w / 2, h / 2 + 2)
  })
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshBasicMaterial({ map: plateTex }))
  plate.position.set(0, 0.4, 0.111); door.add(plate)
  const head = new THREE.Group(); head.position.set(0, 2.0, 0); g.add(head)
  const skull = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.5, 0.42, 3, 0.08), skin); head.add(skull)
  head.add(boxm(0.48, 0.1, 0.44, toon(0x1a1a1a), 0, 0.25, 0)) // flat-top hair
  for (const sx of [-1, 1]) {
    const bolt = cyl(0.04, 0.04, 0.14, toon(0xa0a4ac), sx * 0.27, -0.12, 0, 8); bolt.rotation.z = Math.PI / 2; head.add(bolt)
    const e = eye(0.07, 0x6a4a2a); e.position.set(sx * 0.1, 0.03, 0.2); head.add(e)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), skin); lid.position.set(sx * 0.1, 0.03, 0.2); head.add(lid)
  }
  head.add(boxm(0.3, 0.035, 0.03, toon(0x1a1a1a), 0, 0.12, 0.21)) // unibrow
  head.add(boxm(0.14, 0.02, 0.02, stitch, 0, -0.14, 0.215))
  for (let k = 0; k < 4; k++) head.add(boxm(0.01, 0.05, 0.01, stitch, -0.15 + k * 0.03, 0.2 - k * 0.02, 0.215))
  const arms = [-1, 1].map(sx => {
    const a = new THREE.Group()
    a.add(capsule(0.08, 0.5, skin, 0, -0.3, 0))
    a.add(boxm(0.17, 0.03, 0.17, stitch, 0, -0.2, 0))
    a.add(sphere(0.1, skin, 0, -0.62, 0, 10))
    const p = limbPivot(g, sx * 0.45, 1.7, 0, a); p.rotation.z = sx * 0.12; p.userData.base = 0
    return p
  })
  return { group: g, legs, arms, sitDrop: 0.4, head }
}

// ── Gus: a chubby stone gargoyle (retired rain gutter) ──
function buildGus() {
  const g = new THREE.Group()
  const stoneTex = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a8a90'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 700; i++) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(40,40,50,0.25)' : 'rgba(220,220,230,0.2)'; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3) }
    ctx.strokeStyle = 'rgba(30,30,40,0.4)'; ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) { ctx.beginPath(); let x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 20; ctx.lineTo(x, y) } ctx.stroke() }
  }, true)
  const stone = new THREE.MeshToonMaterial({ map: stoneTex, gradientMap: toonGradient() })
  const moss = toon(0x5a8a3a)
  const body = sphere(0.42, stone, 0, 0.55, 0); body.scale.set(1, 0.95, 0.9); g.add(body)
  // crouched haunches + big feet + arms resting on knees
  for (const sx of [-1, 1]) {
    const thigh = sphere(0.18, stone, sx * 0.25, 0.3, 0.18); thigh.scale.set(1, 0.8, 1.3); g.add(thigh)
    const foot = sphere(0.12, stone, sx * 0.25, 0.06, 0.38); foot.scale.set(1.1, 0.5, 1.3); g.add(foot)
    for (let k = -1; k <= 1; k++) g.add(cone(0.025, 0.07, toon(0x5a5a60), sx * 0.25 + k * 0.06, 0.04, 0.53, 5).rotateX(Math.PI / 2))
    const arm = capsule(0.07, 0.3, stone, sx * 0.33, 0.55, 0.28); arm.rotation.x = 0.9; g.add(arm)
  }
  // little stone wings
  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0); wingShape.lineTo(0.4, 0.35); wingShape.lineTo(0.45, 0.05)
  wingShape.quadraticCurveTo(0.32, 0.02, 0.3, -0.12); wingShape.quadraticCurveTo(0.18, 0, 0, -0.1)
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: false })
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(wingGeo, stone); w.scale.x = sx; w.position.set(sx * 0.25, 0.75, -0.3); w.rotation.y = sx * 0.5; g.add(w) }
  const head = new THREE.Group(); head.position.set(0, 1.08, 0.12); g.add(head)
  const skull = sphere(0.3, stone); skull.scale.set(1.15, 0.9, 1); head.add(skull)
  for (const sx of [-1, 1]) {
    const e = eye(0.09, 0x6a6a74); e.position.set(sx * 0.13, 0.08, 0.22); head.add(e)
    const horn = cone(0.05, 0.18, toon(0x6a6a72), sx * 0.2, 0.25, -0.02, 6); horn.rotation.z = -sx * 0.5; head.add(horn)
    const ear = cone(0.07, 0.2, stone, sx * 0.34, 0.08, 0, 6); ear.rotation.z = -sx * 1.3; head.add(ear)
  }
  // wide grin with the old rain-spout pipe still in it
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16, Math.PI), toon(0x3a3a40)); grin.position.set(0, -0.06, 0.25); grin.rotation.z = Math.PI; head.add(grin)
  const spout = cyl(0.045, 0.045, 0.18, toon(0x6a7a8a), 0, -0.12, 0.32, 10); spout.rotation.x = Math.PI / 2; head.add(spout)
  const drip = sphere(0.025, new THREE.MeshBasicMaterial({ color: 0x8ad0ff }), 0, -0.16, 0.42, 8); head.add(drip)
  for (const [x, y, z, r] of [[0.2, 0.8, 0.3, 0.09], [-0.25, 0.4, 0.33, 0.07], [0.12, 1.3, 0.1, 0.07]]) { const m = sphere(r, moss, x, y, z, 8); m.scale.y = 0.4; g.add(m) }
  function animate(t, { moving }) {
    const f = (t * 0.8) % 1
    drip.position.y = -0.16 - f * 0.6
    drip.visible = f < 0.9
    head.rotation.z = moving ? Math.sin(t * 20) * 0.03 : 0
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.15, head, animate }
}

// ── Gloria: the gift-shop slime, the one happy employee in the building ──
function buildGloria() {
  const g = new THREE.Group()
  const jelly = new THREE.MeshToonMaterial({ color: 0x6ae08a, gradientMap: toonGradient(), transparent: true, opacity: 0.85 })
  const profile = []
  // sqrt(cos) gives a soft gumdrop dome instead of a cone
  for (let i = 0; i <= 14; i++) profile.push(new THREE.Vector2(i === 14 ? 0.001 : 0.6 * Math.sqrt(Math.cos((i / 14) * Math.PI / 2)), (i / 14) * 1.3))
  const blobGeo = new THREE.LatheGeometry(profile, 28)
  const blob = new THREE.Mesh(blobGeo, jelly); g.add(blob)
  // things she has absorbed over the years, floating inside
  g.add(sphere(0.07, toon(0xf0c040), 0.15, 0.35, 0.05, 10))
  g.add(boxm(0.12, 0.05, 0.02, toon(0xd0d0d8), -0.18, 0.5, -0.05).rotateZ(0.6))
  g.add(cyl(0.04, 0.04, 0.12, toon(0xff6a9a), 0.05, 0.7, -0.15, 8).rotateZ(1.2))
  for (const sx of [-1, 1]) {
    const e = eye(0.11, 0x2a6ad0); e.position.set(sx * 0.17, 0.95, 0.38); g.add(e)
    g.add(sphere(0.06, toon(0xff8ab0), sx * 0.3, 0.8, 0.36, 8))
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 14, Math.PI), toon(0x1a4a2a)); smile.position.set(0, 0.8, 0.45); smile.rotation.z = Math.PI; g.add(smile)
  const bow = new THREE.Group(); bow.position.set(0.15, 1.32, 0); g.add(bow)
  for (const sx of [-1, 1]) { const l = cone(0.1, 0.18, toon(0xff4a8a), sx * 0.1, 0, 0, 8); l.rotation.z = sx * Math.PI / 2; bow.add(l) }
  bow.add(sphere(0.05, toon(0xff4a8a), 0, 0, 0, 8))
  const tagTex = canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#d04a8a'; ctx.fillRect(0, 0, w, 16)
    ctx.fillStyle = '#2a2a2a'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GLORIA', w / 2, 50)
  })
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: tagTex }))
  tag.position.set(-0.22, 0.55, 0.5); tag.rotation.y = -0.3; g.add(tag)
  function animate(t) {
    const w = Math.sin(t * 3)
    blob.scale.set(1 + w * 0.04, 1 - w * 0.04, 1 + w * 0.04)
    bow.rotation.z = Math.sin(t * 2) * 0.15
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, animate }
}

// ── Hank: a fuzzy little ceiling gremlin (hang-down comedian) ──
// Built upright; the render loop flips him upside down to hang from the ceiling.
function buildHank() {
  const g = new THREE.Group()
  const fur = toon(0x6a8ad0), belly = toon(0xd8e4ff), dark = toon(0x1a1a2a)
  const body = sphere(0.26, fur, 0, 0.55, 0); body.scale.set(1, 1.15, 0.9); g.add(body)
  const tummy = sphere(0.18, belly, 0, 0.5, 0.12); tummy.scale.set(1, 1.2, 0.6); g.add(tummy)
  const head = new THREE.Group(); head.position.set(0, 0.98, 0.03); g.add(head)
  head.add(sphere(0.25, fur))
  for (const sx of [-1, 1]) {
    // huge floppy ears
    const ear = sphere(0.16, fur, sx * 0.3, 0.08, -0.02, 12); ear.scale.set(1.2, 0.8, 0.3); ear.rotation.z = sx * 0.4; head.add(ear)
    const inner = sphere(0.1, toon(0xff9ab8), sx * 0.31, 0.08, 0.02, 10); inner.scale.set(1.2, 0.8, 0.2); inner.rotation.z = sx * 0.4; head.add(inner)
    const e = eye(0.08, 0xf0a020); e.position.set(sx * 0.09, 0.05, 0.2); head.add(e)
  }
  // giant goofy grin
  const grin = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dark)
  grin.position.set(0, -0.06, 0.16); grin.scale.set(1.2, 0.8, 0.6); head.add(grin)
  for (let k = 0; k < 4; k++) head.add(boxm(0.03, 0.03, 0.01, toon(0xffffff), -0.06 + k * 0.04, -0.07, 0.25))
  // a tiny bow tie — he IS a comedian
  for (const sx of [-1, 1]) { const b = cone(0.05, 0.08, toon(0xff3a5a), sx * 0.05, 0.78, 0.18, 4); b.rotation.z = sx * Math.PI / 2; g.add(b) }
  const arms = [-1, 1].map(sx => {
    const a = new THREE.Group()
    a.add(capsule(0.05, 0.3, fur, 0, -0.18, 0))
    a.add(sphere(0.07, belly, 0, -0.38, 0, 10))
    const p = limbPivot(g, sx * 0.25, 0.72, 0, a); p.rotation.z = sx * 0.5; p.userData.base = 0
    return p
  })
  // long legs (he hangs by his feet)
  const legs = [-1, 1].map(sx => {
    const l = new THREE.Group()
    l.add(capsule(0.05, 0.3, fur, 0, -0.18, 0))
    const foot = sphere(0.07, belly, 0, -0.38, 0.04, 10); foot.scale.z = 1.5; l.add(foot)
    return limbPivot(g, sx * 0.12, 0.32, 0, l)
  })
  function animate(t, { sitting }) {
    if (!sitting) { arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 6 + i * Math.PI) * 0.6 }) }
    head.rotation.z = Math.sin(t * 9) * 0.08 // giggling
  }
  return { group: g, legs, arms: [], sitDrop: 0.05, head, animate }
}

// ── A single Gloombat (the swarm) ──
export function buildGloombat() {
  const g = new THREE.Group()
  const m = toon(0x3a2a5a)
  g.add(sphere(0.08, m, 0, 0, 0, 10))
  for (const sx of [-1, 1]) {
    const e = sphere(0.025, new THREE.MeshBasicMaterial({ color: 0xffe08a }), sx * 0.035, 0.02, 0.07, 6)
    g.add(e)
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), m)
    wing.position.set(sx * 0.13, 0, 0); wing.rotation.z = sx * Math.PI / 2
    wing.userData.sx = sx
    g.add(wing)
  }
  return g
}

// ── Bernadette: conductor of the Gloombat Choir ──
function buildBernadette() {
  const g = new THREE.Group()
  const fur = toon(0x4a3a6a), robe = toon(0x8a1a4a), gold = toon(0xf0c040)
  const body = sphere(0.36, fur, 0, 0.95, 0); body.scale.set(1, 1.1, 0.9); g.add(body)
  // choir robe with a white collar
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.7, 18), robe); r.position.y = 0.55; g.add(r)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 18), toon(0xffffff)); collar.rotation.x = Math.PI / 2; collar.position.y = 1.18; g.add(collar)
  const head = new THREE.Group(); head.position.set(0, 1.42, 0); g.add(head)
  head.add(sphere(0.27, fur))
  for (const sx of [-1, 1]) {
    const ear = cone(0.1, 0.32, fur, sx * 0.17, 0.3, 0, 8); ear.rotation.z = -sx * 0.35; head.add(ear)
    const e = eye(0.085, 0xa03a8a); e.position.set(sx * 0.1, 0.05, 0.2); head.add(e)
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16), gold); lens.position.set(sx * 0.1, 0.05, 0.27); head.add(lens)
    const fang = cone(0.018, 0.05, toon(0xffffff), sx * 0.04, -0.12, 0.24, 5); fang.rotation.x = Math.PI; head.add(fang)
  }
  const nose = sphere(0.04, toon(0xff9ab8), 0, -0.04, 0.26, 8); nose.scale.set(1.4, 1, 1); head.add(nose)
  // big membrane wings, folded like a cape
  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0); wingShape.lineTo(0.5, 0.25); wingShape.lineTo(0.7, 0.05)
  wingShape.quadraticCurveTo(0.55, -0.05, 0.6, -0.3); wingShape.quadraticCurveTo(0.4, -0.15, 0.3, -0.4); wingShape.quadraticCurveTo(0.15, -0.2, 0, -0.3)
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.02, bevelEnabled: false })
  const wings = [-1, 1].map(sx => { const p = new THREE.Group(); p.position.set(sx * 0.3, 1.1, -0.1); const w = new THREE.Mesh(wingGeo, fur); w.scale.x = sx; p.add(w); g.add(p); return p })
  // conductor's baton in one hand, sheet music in the other
  const baton = cyl(0.008, 0.008, 0.35, toon(0xffffff), 0.32, 1.0, 0.3, 6); baton.rotation.x = 1.0; g.add(baton)
  const music = boxm(0.22, 0.28, 0.01, toon(0xfff8e0), -0.3, 0.95, 0.3); music.rotation.y = 0.4; g.add(music)
  function animate(t) {
    baton.rotation.z = Math.sin(t * 6) * 0.5
    wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 2) * 0.15) })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.3, head, animate }
}

// ── Doug: an enormous, polite worm in a hard hat ──
function buildDoug() {
  const g = new THREE.Group()
  const skin = toon(0xf0a0a0), band = toon(0xd88a8a)
  const segs = []
  for (let k = 0; k < 6; k++) {
    const seg = sphere(0.3 - k * 0.012, k === 2 ? band : skin, 0, 0.25 + k * 0.3, 0, 16)
    seg.scale.set(1, 0.8, 1)
    g.add(seg); segs.push(seg)
  }
  const head = new THREE.Group(); head.position.set(0, 1.95, 0); g.add(head)
  head.add(sphere(0.3, skin))
  for (const sx of [-1, 1]) { const e = eye(0.09, 0x3a2a1a); e.position.set(sx * 0.11, 0.06, 0.24); head.add(e) }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12, Math.PI), toon(0x6a2a2a)); smile.position.set(0, -0.08, 0.27); smile.rotation.z = Math.PI; head.add(smile)
  // hard hat with a little lamp
  const hat = new THREE.Group(); hat.position.y = 0.2; head.add(hat)
  hat.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf0c020)))
  hat.add(cyl(0.34, 0.34, 0.03, toon(0xf0c020), 0, 0, 0.03, 20))
  hat.add(cyl(0.05, 0.05, 0.06, new THREE.MeshBasicMaterial({ color: 0xfff6c0 }), 0, 0.12, 0.25, 10).rotateX(Math.PI / 2))
  function animate(t) {
    segs.forEach((sg, k) => { sg.position.x = Math.sin(t * 2.5 - k * 0.6) * 0.05 * k })
    head.position.x = Math.sin(t * 2.5 - 6 * 0.6) * 0.3
    head.rotation.z = Math.sin(t * 2.5) * 0.1
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.3, head, animate }
}

// Gary's minecart for the Floor 2 chase.
export function buildMinecart() {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.6, metalness: 0.4 })
  const rim = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 })
  g.add(boxm(0.9, 0.08, 1.2, metal, 0, 0.3, 0))
  for (const sx of [-1, 1]) g.add(boxm(0.06, 0.5, 1.2, metal, sx * 0.45, 0.55, 0))
  for (const sz of [-1, 1]) g.add(boxm(0.9, 0.5, 0.06, metal, 0, 0.55, sz * 0.6))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = cyl(0.15, 0.15, 0.06, rim, sx * 0.47, 0.15, sz * 0.4, 12); w.rotation.z = Math.PI / 2; g.add(w) }
  return g
}

// ── Puff: a retired hotel tea kettle, now a little steam ghost ──
function buildPuff() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); g.add(rig)
  const enamel = toon(0x6ac0c8), trim = toon(0xf0e8d8), dark = toon(0x2a3a3a)
  const body = sphere(0.42, enamel, 0, 1.3, 0, 22); body.scale.set(1.05, 0.85, 1.05); rig.add(body)
  rig.add(cyl(0.36, 0.4, 0.1, trim, 0, 1.0, 0, 22))
  // floral band
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; rig.add(sphere(0.05, toon(k % 2 ? 0xff8ab0 : 0xffd84a), Math.cos(a) * 0.44, 1.28, Math.sin(a) * 0.44, 8)) }
  const lid = new THREE.Group(); lid.position.y = 1.64; rig.add(lid)
  lid.add(cyl(0.22, 0.26, 0.08, enamel, 0, 0, 0, 18))
  lid.add(sphere(0.07, trim, 0, 0.08, 0, 10))
  // the spout (his nose, basically) and the handle
  const spout = cyl(0.05, 0.1, 0.45, enamel, 0, 1.25, 0.48, 12); spout.rotation.x = 1.1; rig.add(spout)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16, Math.PI * 1.2), trim); handle.position.set(0, 1.42, -0.42); handle.rotation.set(0, Math.PI / 2, -0.3); rig.add(handle)
  for (const sx of [-1, 1]) {
    const e = eye(0.1, 0x2a6a8a); e.position.set(sx * 0.17, 1.42, 0.31); rig.add(e)
    rig.add(sphere(0.06, toon(0xff9ab8), sx * 0.29, 1.27, 0.3, 8))
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), dark); smile.position.set(0, 1.12, 0.38); smile.rotation.z = Math.PI; rig.add(smile)
  // a wispy steam tail instead of legs
  const tail = []
  for (let k = 0; k < 6; k++) {
    const puff = sphere(0.26 - k * 0.035, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient(), transparent: true, opacity: 0.8 - k * 0.1 }), 0, 0.85 - k * 0.15, -k * 0.05, 12)
    rig.add(puff); tail.push(puff)
  }
  function animate(t) {
    rig.position.y = Math.sin(t * 2.5) * 0.06
    lid.position.y = 1.64 + Math.abs(Math.sin(t * 12)) * 0.04 // rattling lid
    tail.forEach((p, k) => { p.position.x = Math.sin(t * 3 - k * 0.8) * 0.06 * k })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.35, animate }
}

// ── Madame Twirl: a porcelain music-box ballerina on her little box ──
function buildTwirl() {
  const g = new THREE.Group()
  const box = new THREE.Group(); g.add(box)
  const wood = toon(0xb0446a), gold = toon(0xf0c040), porcelain = toon(0xfff0f0), tutuM = toon(0xffb0d8, { side: THREE.DoubleSide })
  box.add(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.45, 0.9, 3, 0.06), wood).translateY(0.225))
  box.add(cyl(0.3, 0.3, 0.04, toon(0xe0e0e8), 0, 0.47, 0, 22)) // little mirror stage
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box.add(sphere(0.05, gold, x * 0.42, 0.45, z * 0.42, 8))
  const crank = new THREE.Group(); crank.position.set(0.47, 0.25, 0); box.add(crank)
  crank.add(cyl(0.02, 0.02, 0.15, gold, 0.07, 0, 0, 6).rotateZ(Math.PI / 2))
  crank.add(boxm(0.03, 0.2, 0.03, gold, 0.14, 0.08, 0))
  crank.add(sphere(0.035, gold, 0.14, 0.18, 0, 8))
  const dancer = new THREE.Group(); dancer.position.y = 0.49; g.add(dancer)
  // standing on point
  const leg = cyl(0.035, 0.03, 0.7, porcelain, 0, 0.35, 0, 8); dancer.add(leg)
  dancer.add(cone(0.035, 0.08, toon(0xffb0d8), 0, 0.02, 0, 8))
  const raised = cyl(0.03, 0.03, 0.6, porcelain, 0, 0.62, -0.25, 8); raised.rotation.x = 1.3; dancer.add(raised)
  const tutu = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.22, 24, 1, true), tutuM); tutu.position.y = 0.78; tutu.rotation.x = Math.PI; dancer.add(tutu)
  const tutu2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.16, 24, 1, true), toon(0xffd0e8, { side: THREE.DoubleSide })); tutu2.position.y = 0.84; tutu2.rotation.x = Math.PI; dancer.add(tutu2)
  dancer.add(capsule(0.14, 0.25, toon(0xff8ac0), 0, 1.0, 0))
  const head = new THREE.Group(); head.position.y = 1.38; dancer.add(head)
  head.add(sphere(0.17, porcelain))
  head.add(sphere(0.1, toon(0x5a3a2a), 0, 0.13, -0.05, 10)) // hair bun
  for (const sx of [-1, 1]) {
    const e = eye(0.055, 0x6a3a8a); e.position.set(sx * 0.065, 0.02, 0.13); head.add(e)
    head.add(sphere(0.035, toon(0xff7aa0), sx * 0.11, -0.05, 0.12, 8))
    for (let k = 0; k < 3; k++) head.add(boxm(0.008, 0.035, 0.008, toon(0x1a1a1a), sx * (0.05 + k * 0.022), 0.08, 0.15))
  }
  head.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 14, Math.PI), gold).translateY(0.12).rotateX(-0.3)) // tiara
  // arms up in a ballet circle
  const armRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 8, 20, Math.PI * 1.4), porcelain)
  armRing.position.set(0, 1.42, 0.02); armRing.rotation.z = -Math.PI * 0.2; dancer.add(armRing)
  // little music notes floating around her
  const notes = []
  for (let k = 0; k < 4; k++) {
    const n = new THREE.Group()
    n.add(sphere(0.05, toon(0x2a1a3a), 0, 0, 0, 8))
    n.add(cyl(0.008, 0.008, 0.16, toon(0x2a1a3a), 0.045, 0.08, 0, 4))
    n.userData.ph = k * 1.6
    g.add(n); notes.push(n)
  }
  function animate(t, { dancing = false }) {
    dancer.rotation.y = dancing ? t * 6 : Math.sin(t * 0.5) * 0.2
    crank.rotation.x = dancing ? -t * 4 : 0
    notes.forEach((n, k) => {
      n.visible = dancing
      const a = t * 1.5 + n.userData.ph
      n.position.set(Math.cos(a) * 0.8, 1.3 + Math.sin(t * 2 + k) * 0.3, Math.sin(a) * 0.8)
    })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, head, animate }
}

// ── Bumpus: a stubby bridge troll in goggles, riding his brakeless minecart ──
function buildBumpus() {
  const g = new THREE.Group()
  const cart = buildMinecart(); g.add(cart)
  const skin = toon(0x8a9ac0), dark = toon(0x2a2a3a)
  const troll = new THREE.Group(); troll.position.y = 0.4; g.add(troll)
  const body = sphere(0.34, toon(0x6a4a2a), 0, 0.45, 0); body.scale.set(1.1, 0.9, 1); troll.add(body) // overalls
  const head = new THREE.Group(); head.position.set(0, 0.95, 0.05); troll.add(head)
  head.add(sphere(0.3, skin))
  const nose = sphere(0.14, skin, 0, -0.05, 0.3, 14); nose.scale.set(1, 0.8, 1.2); head.add(nose)
  for (const sx of [-1, 1]) {
    const ear = cone(0.08, 0.28, skin, sx * 0.32, 0.05, 0, 8); ear.rotation.z = -sx * 1.2; head.add(ear)
    const gog = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 8, 18), toon(0xa07040)); gog.position.set(sx * 0.12, 0.12, 0.25); head.add(gog)
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0xa0e0ff })); lens.position.set(sx * 0.12, 0.12, 0.255); head.add(lens)
    head.add(sphere(0.035, dark, sx * 0.12, 0.12, 0.27, 8))
  }
  head.add(boxm(0.5, 0.04, 0.04, toon(0x4a3a2a), 0, 0.12, 0.08)) // goggle strap
  // big grin with two little tusks
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 14, Math.PI), dark); grin.position.set(0, -0.15, 0.25); grin.rotation.z = Math.PI; head.add(grin)
  for (const sx of [-1, 1]) head.add(cone(0.02, 0.06, toon(0xffffff), sx * 0.08, -0.15, 0.27, 5))
  head.add(cone(0.06, 0.12, toon(0x3a5a2a), 0, 0.31, 0, 6)) // a little tuft of moss-hair
  // one hand honking a bicycle horn
  const horn = new THREE.Group(); horn.position.set(0.35, 0.7, 0.35); troll.add(horn)
  horn.add(sphere(0.07, skin, 0, 0, 0, 10))
  const bulb = sphere(0.08, toon(0xd02a2a), 0, 0.1, 0.05, 10); horn.add(bulb)
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 12, 1, true), toon(0xf0c040, { side: THREE.DoubleSide })); bell.position.set(0, 0.1, 0.2); bell.rotation.x = -Math.PI / 2; horn.add(bell)
  function animate(t, { moving }) {
    troll.position.y = 0.4 + (moving ? Math.abs(Math.sin(t * 20)) * 0.04 : 0)
    bulb.scale.setScalar(moving ? 0.8 + Math.abs(Math.sin(t * 8)) * 0.4 : 1)
    head.rotation.z = moving ? Math.sin(t * 15) * 0.08 : 0
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, head, animate }
}

// ── Nibbles: a scrappy little rat in a newsboy cap, hugging a sack of your tips ──
function buildNibbles() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); rig.scale.setScalar(1.15); g.add(rig)
  const fur = toon(0x8a8a92), pink = toon(0xffa0b4), dark = toon(0x1a1a1a)
  const body = sphere(0.22, fur, 0, 0.28, 0); body.scale.set(1, 1, 1.25); rig.add(body)
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.25); rig.add(head)
  const skull = sphere(0.15, fur); skull.scale.set(1, 0.95, 1.2); head.add(skull)
  const snout = cone(0.09, 0.16, fur, 0, -0.02, 0.17, 12); snout.rotation.x = Math.PI / 2; head.add(snout)
  head.add(sphere(0.035, pink, 0, -0.02, 0.26, 8))
  for (const sx of [-1, 1]) {
    const ear = sphere(0.09, fur, sx * 0.11, 0.13, -0.02, 12); ear.scale.z = 0.3; head.add(ear)
    const inner = sphere(0.06, pink, sx * 0.11, 0.13, 0.0, 10); inner.scale.z = 0.2; head.add(inner)
    const e = eye(0.05, 0x2a1a0a); e.position.set(sx * 0.07, 0.04, 0.1); head.add(e)
    for (let k = -1; k <= 1; k++) { const w = cyl(0.004, 0.004, 0.2, dark, sx * 0.1, -0.02 + k * 0.02, 0.2, 4); w.rotation.z = Math.PI / 2 + k * 0.15; head.add(w) }
  }
  head.add(boxm(0.03, 0.04, 0.01, toon(0xffffff), 0, -0.09, 0.22)) // buck teeth
  const cap = new THREE.Group(); cap.position.y = 0.12; head.add(cap)
  cap.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x5a4a3a)))
  cap.add(boxm(0.18, 0.02, 0.12, toon(0x4a3a2a), 0, 0, 0.14))
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.018, 6, 20, Math.PI * 1.3), pink)
  tail.position.set(0, 0.25, -0.3); tail.rotation.y = Math.PI / 2; rig.add(tail)
  const sack = sphere(0.14, toon(0xc8a46a), 0.12, 0.45, 0.05, 12); sack.scale.y = 1.2; rig.add(sack)
  sack.add(boxm(0.12, 0.02, 0.02, toon(0x6a4a2a), 0, 0.14, 0))
  const dollar = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), toon(0xf0c040)); dollar.position.set(0, 0, 0.14); sack.add(dollar)
  const feet = [-1, 1].map(sx => { const f = sphere(0.06, pink, sx * 0.1, 0.05, 0.08, 8); f.scale.z = 1.6; rig.add(f); return f })
  function animate(t, { moving }) {
    rig.position.y = moving ? Math.abs(Math.sin(t * 18)) * 0.06 : 0
    feet.forEach((f, i) => { f.position.z = 0.08 + (moving ? Math.sin(t * 18 + i * Math.PI) * 0.08 : 0) })
    tail.rotation.z = Math.sin(t * 8) * 0.3
  }
  return { group: g, legs: [], arms: [], sitDrop: -0.3, animate }
}

// ── Bubbles: a floating party clown blowing up one giant balloon ──
function buildBubbles() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); g.add(rig)
  const suit = toon(0xffd84a), dots = [0xff4a6a, 0x4ab0ff, 0x6ad04a]
  const body = sphere(0.34, suit, 0, 1.1, 0); body.scale.set(1, 1.15, 0.9); rig.add(body)
  for (let k = 0; k < 9; k++) { const a = k * 2.4, y = 0.85 + (k % 3) * 0.2; rig.add(sphere(0.05, toon(dots[k % 3]), Math.cos(a) * 0.3, y, Math.sin(a) * 0.27 + 0.05, 8)) }
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 6, 16), toon(0xffffff)); ruff.rotation.x = Math.PI / 2; ruff.position.y = 1.48; rig.add(ruff)
  const head = new THREE.Group(); head.position.y = 1.75; rig.add(head)
  head.add(sphere(0.25, toon(0xfff4ec)))
  for (const sx of [-1, 1]) {
    head.add(sphere(0.13, toon(0xff6a2a), sx * 0.24, 0.05, -0.02, 10)) // poofy hair
    const e = eye(0.07, 0x3a6ad0); e.position.set(sx * 0.09, 0.06, 0.2); head.add(e)
    head.add(boxm(0.015, 0.08, 0.01, toon(0x3a6ad0), sx * 0.09, 0.17, 0.22))
  }
  head.add(sphere(0.07, toon(0xff2a3a), 0, -0.02, 0.25, 12)) // red nose
  const hat = cone(0.1, 0.28, toon(0x4ab0ff), 0, 0.3, 0, 12); hat.rotation.z = 0.2; head.add(hat)
  head.add(sphere(0.04, toon(0xffd84a), 0.06, 0.45, 0, 8))
  // the balloon he's blowing up — the render loop scales it as it grows
  const balloonPivot = new THREE.Group(); balloonPivot.position.set(0, 1.72, 0.3); rig.add(balloonPivot)
  const balloon = sphere(0.3, new THREE.MeshToonMaterial({ color: 0xff4a8a, gradientMap: toonGradient(), emissive: 0x3a0a1a }), 0, 0.3, 0.35, 20)
  balloon.scale.y = 1.15; balloonPivot.add(balloon)
  balloonPivot.add(sphere(0.06, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), -0.1, 0.45, 0.6, 8))
  // floaty legs
  for (const sx of [-1, 1]) { rig.add(capsule(0.07, 0.3, toon(0x4ab0ff), sx * 0.15, 0.6, 0)); const shoe = sphere(0.1, toon(0xff2a3a), sx * 0.16, 0.38, 0.1, 10); shoe.scale.z = 1.8; rig.add(shoe) }
  function animate(t, { size = 0.4 }) {
    rig.position.y = 0.15 + Math.sin(t * 2) * 0.08
    const k = 0.35 + size * 1.6
    balloonPivot.scale.setScalar(k)
    balloonPivot.position.y = 1.72 + size * 0.2
    balloonPivot.rotation.z = Math.sin(t * 3) * 0.05 * (1 + size * 3) // wobbles more as it gets bigger
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.2, head, animate, balloon: balloonPivot }
}

// ── Yolanda: a huge fluffy yeti with an ice-cream-scoop hairdo ──
function buildYolanda() {
  const g = new THREE.Group()
  const fur = toon(0xf4f8ff), face = toon(0x8ab0d8), blue = toon(0x6ab8ff)
  const body = sphere(0.55, fur, 0, 1.0, 0); body.scale.set(1, 1.15, 0.85); g.add(body)
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const tuft = sphere(0.13, fur, Math.cos(a) * 0.5, 0.55 + (k % 3) * 0.08, Math.sin(a) * 0.42, 8); g.add(tuft) }
  const head = new THREE.Group(); head.position.set(0, 1.75, 0.05); g.add(head)
  head.add(sphere(0.38, fur))
  const mask = sphere(0.26, face, 0, -0.03, 0.2, 16); mask.scale.set(1, 0.9, 0.6); head.add(mask)
  for (const sx of [-1, 1]) {
    const e = eye(0.08, 0x3a6ad0); e.position.set(sx * 0.1, 0.04, 0.34); head.add(e)
    head.add(sphere(0.05, toon(0xff9ab8), sx * 0.17, -0.08, 0.32, 8))
  }
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 12, Math.PI), toon(0x2a3a5a)); grin.position.set(0, -0.1, 0.36); grin.rotation.z = Math.PI; head.add(grin)
  // ice-cream scoops on her head, with a cherry
  ;[[0xffb0c8, 0], [0x8a5a3a, 0.18], [0xfff0c0, 0.34]].forEach(([c, y], k) => head.add(sphere(0.2 - k * 0.03, toon(c), (k - 1) * 0.04, 0.38 + y, 0, 14)))
  head.add(sphere(0.06, toon(0xd01a2a), 0, 0.88, 0, 8))
  const arms = [-1, 1].map(sx => {
    const a = new THREE.Group()
    a.add(capsule(0.14, 0.45, fur, 0, -0.3, 0))
    a.add(sphere(0.15, face, 0, -0.6, 0, 10))
    const p = limbPivot(g, sx * 0.58, 1.35, 0, a); p.rotation.z = sx * 0.25; p.userData.base = 0
    return p
  })
  // an ice-cream scoop in one hand
  arms[1].add(cyl(0.025, 0.025, 0.3, toon(0xc0c4cc), 0, -0.78, 0.1, 6))
  arms[1].add(sphere(0.07, blue, 0, -0.95, 0.12, 10))
  const legs = [-1, 1].map(sx => { const l = new THREE.Group(); l.add(capsule(0.17, 0.25, fur, 0, -0.2, 0)); const f = sphere(0.18, face, 0, -0.45, 0.1, 10); f.scale.set(1, 0.5, 1.4); l.add(f); return limbPivot(g, sx * 0.25, 0.55, 0, l) })
  return { group: g, legs, arms, sitDrop: 0.4, head }
}

// ── Mabel: the hotel manager — a tiny mouse in a big business suit ──
function buildMabel() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); rig.scale.setScalar(1.25); g.add(rig)
  const fur = toon(0xd8c8b8), pink = toon(0xffb0c0), suit = toon(0x3a3a6a)
  const body = capsule(0.17, 0.25, suit, 0, 0.42, 0); rig.add(body)
  rig.add(boxm(0.1, 0.18, 0.02, toon(0xffffff), 0, 0.5, 0.165))
  const tie = boxm(0.04, 0.14, 0.02, toon(0xd02a5a), 0, 0.49, 0.18); rig.add(tie)
  const head = new THREE.Group(); head.position.y = 0.82; rig.add(head)
  head.add(sphere(0.17, fur))
  for (const sx of [-1, 1]) {
    const ear = sphere(0.13, fur, sx * 0.16, 0.14, -0.03, 14); ear.scale.z = 0.3; head.add(ear)
    const inner = sphere(0.09, pink, sx * 0.16, 0.14, -0.01, 12); inner.scale.z = 0.2; head.add(inner)
    const e = eye(0.05, 0x5a3a2a); e.position.set(sx * 0.065, 0.03, 0.13); head.add(e)
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 16), toon(0xf0c040)); lens.position.set(sx * 0.065, 0.03, 0.17); head.add(lens)
  }
  head.add(sphere(0.03, pink, 0, -0.04, 0.17, 8))
  head.add(cyl(0.003, 0.003, 0.08, toon(0xf0c040), 0.12, 0.0, 0.14, 4).rotateZ(1.2)) // glasses chain
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 18, Math.PI * 1.2), pink); tail.position.set(0, 0.25, -0.18); tail.rotation.y = Math.PI / 2; rig.add(tail)
  const arms = [-1, 1].map(sx => { const a = new THREE.Group(); a.add(capsule(0.04, 0.16, suit, 0, -0.1, 0)); a.add(sphere(0.04, fur, 0, -0.22, 0, 8)); const p = limbPivot(rig, sx * 0.19, 0.58, 0, a); p.userData.base = 0; return p })
  // a giant coffee mug she can barely hold
  arms[1].add(cyl(0.06, 0.06, 0.12, toon(0xffffff), 0, -0.28, 0.06, 12))
  for (const sx of [-1, 1]) rig.add(capsule(0.04, 0.12, suit, sx * 0.07, 0.15, 0))
  return { group: g, legs: [], arms, sitDrop: 0.1, head }
}

// ── Ollie: the night janitor octopus, a mop in (most of) every tentacle ──
function buildOllie() {
  const g = new THREE.Group()
  const skin = toon(0xb06ad0), spots = toon(0x8a4ab0)
  const headM = sphere(0.45, skin, 0, 1.25, 0, 22); headM.scale.set(1, 1.2, 1); g.add(headM)
  for (let k = 0; k < 6; k++) g.add(sphere(0.05, spots, Math.cos(k) * 0.35, 1.4 + Math.sin(k * 2) * 0.2, Math.sin(k) * 0.3 - 0.1, 8))
  for (const sx of [-1, 1]) { const e = eye(0.11, 0x2a6a3a); e.position.set(sx * 0.17, 1.25, 0.38); g.add(e) }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 14, Math.PI), toon(0x4a1a5a)); smile.position.set(0, 1.05, 0.42); smile.rotation.z = Math.PI; g.add(smile)
  // janitor's cap
  const cap = new THREE.Group(); cap.position.y = 1.75; g.add(cap)
  cap.add(cyl(0.3, 0.32, 0.14, toon(0x3a5a8a), 0, 0, 0, 18))
  cap.add(boxm(0.36, 0.03, 0.18, toon(0x2a4a6a), 0, -0.06, 0.28))
  const tentacles = []
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const t = new THREE.Group(); t.position.set(Math.cos(a) * 0.32, 0.82, Math.sin(a) * 0.32); t.rotation.y = -a
    const seg = capsule(0.07, 0.55, skin, 0.25, -0.35, 0); seg.rotation.z = 0.7; t.add(seg)
    if (k % 2 === 0) {
      // a little mop
      const mop = new THREE.Group(); mop.position.set(0.5, -0.55, 0); t.add(mop)
      mop.add(cyl(0.015, 0.015, 0.6, toon(0x8a5a2a), 0, 0.25, 0, 5))
      for (let j = 0; j < 6; j++) mop.add(capsule(0.025, 0.12, toon(0xe8e0c8), Math.cos(j) * 0.05, -0.08, Math.sin(j) * 0.05))
    }
    g.add(t); tentacles.push(t)
  }
  function animate(t) {
    tentacles.forEach((tn, k) => { tn.rotation.z = Math.sin(t * 3 + k) * 0.2 })
    headM.scale.y = 1.2 + Math.sin(t * 2) * 0.03
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.1, noStool: true, animate }
}

// ── Grandma Bea: the hotel's founder, a see-through ghost granny in a rocking chair ──
function buildBea() {
  const g = new THREE.Group()
  const ghost = (c, o = 0.75) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient(), transparent: true, opacity: o })
  const wood = toon(0x6a3a1a)
  const chair = new THREE.Group(); g.add(chair)
  chair.add(boxm(0.7, 0.06, 0.6, wood, 0, 0.45, 0))
  chair.add(boxm(0.7, 0.8, 0.06, wood, 0, 0.85, -0.3))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) chair.add(cyl(0.025, 0.025, 0.45, wood, sx * 0.3, 0.23, sz * 0.25, 6))
    const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 6, 20, Math.PI * 0.5), wood)
    rocker.position.set(sx * 0.3, 0.6, 0); rocker.rotation.set(0, Math.PI / 2, Math.PI * 1.25); chair.add(rocker)
  }
  const bea = new THREE.Group(); bea.position.y = 0.5; chair.add(bea)
  const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.6, 16), ghost(0xb8d8ff)); dress.position.set(0, 0.25, 0.02); bea.add(dress)
  const shawl = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 18), ghost(0xd890c0, 0.85)); shawl.rotation.x = Math.PI / 2; shawl.position.y = 0.55; bea.add(shawl)
  const head = new THREE.Group(); head.position.y = 0.78; bea.add(head)
  head.add(sphere(0.19, ghost(0xe8f2ff, 0.85)))
  head.add(sphere(0.12, ghost(0xffffff, 0.9), 0, 0.17, -0.06, 12)) // hair bun
  for (const sx of [-1, 1]) {
    const e = sphere(0.025, toon(0x2a3a5a), sx * 0.07, 0.03, 0.17, 8); head.add(e)
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14), toon(0xc0a040)); lens.position.set(sx * 0.07, 0.03, 0.18); head.add(lens)
    head.add(sphere(0.035, ghost(0xff9ab8, 0.8), sx * 0.12, -0.05, 0.15, 8))
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), toon(0x5a3a5a)); smile.position.set(0, -0.06, 0.18); smile.rotation.z = Math.PI; head.add(smile)
  // knitting: needles and a ball of yarn in her lap
  bea.add(sphere(0.08, toon(0xd02a3a), 0.1, 0.12, 0.25, 12))
  const knit = boxm(0.2, 0.15, 0.02, toon(0xf0c040), -0.02, 0.35, 0.22); bea.add(knit)
  for (const sx of [-1, 1]) { const n = cyl(0.006, 0.006, 0.3, toon(0xe0d0a0), sx * 0.06, 0.42, 0.23, 4); n.rotation.z = sx * 0.6; bea.add(n) }
  function animate(t) {
    chair.rotation.x = Math.sin(t * 1.4) * 0.08 // rocking
    bea.position.y = 0.5 + Math.sin(t * 2) * 0.02
    knit.rotation.z = Math.sin(t * 6) * 0.1
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, animate }
}

// ── Shelly: a cheerful snail mail-carrier with a satchel and a letter ──
function buildShelly() {
  const g = new THREE.Group()
  const skin = toon(0xa0d878), shellM = toon(0xe08a4a), swirl = toon(0xb05a2a)
  const foot = capsule(0.22, 0.9, skin, 0, 0.18, 0.05); foot.rotation.x = Math.PI / 2; foot.scale.y = 1; foot.scale.x = 1.1; foot.scale.z = 0.6; g.add(foot)
  const shell = new THREE.Group(); shell.position.set(0, 0.68, -0.2); g.add(shell)
  shell.add(sphere(0.48, shellM, 0, 0, 0, 22))
  for (let k = 0; k < 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36 - k * 0.12, 0.035, 8, 26), swirl); ring.rotation.y = Math.PI / 2; ring.position.x = 0.44 - k * 0.02; shell.add(ring); const ring2 = ring.clone(); ring2.position.x = -ring.position.x; shell.add(ring2) }
  const neck = capsule(0.17, 0.45, skin, 0, 0.6, 0.5); neck.rotation.x = -0.2; g.add(neck)
  const head = new THREE.Group(); head.position.set(0, 1.05, 0.58); g.add(head)
  head.add(sphere(0.22, skin))
  for (const sx of [-1, 1]) {
    const stalk = cyl(0.025, 0.03, 0.32, skin, sx * 0.1, 0.3, 0, 6); stalk.rotation.z = -sx * 0.25; head.add(stalk)
    const e = eye(0.075, 0x3a2a6a); e.position.set(sx * 0.15, 0.47, 0.03); head.add(e)
    head.add(sphere(0.045, toon(0xff9ab8), sx * 0.13, -0.05, 0.17, 8))
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), toon(0x2a4a1a)); smile.position.set(0, -0.08, 0.2); smile.rotation.z = Math.PI; head.add(smile)
  // mail-carrier cap + satchel with one very old letter
  const cap = new THREE.Group(); cap.position.y = 0.17; head.add(cap)
  cap.add(cyl(0.16, 0.18, 0.12, toon(0x2a4a8a), 0, 0, 0, 14))
  cap.add(boxm(0.18, 0.02, 0.12, toon(0x1a2a5a), 0, -0.05, 0.14))
  g.add(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.26, 0.12, 2, 0.04), toon(0x8a5a2a)).translateX(0.3).translateY(0.45).translateZ(0.35))
  const letter = boxm(0.18, 0.12, 0.01, toon(0xfff4d8), 0.3, 0.62, 0.36); letter.rotation.z = 0.2; g.add(letter)
  // a little slime trail
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.6), new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.35 }))
  trail.rotation.x = -Math.PI / 2; trail.position.set(0, 0.01, -0.9); g.add(trail)
  function animate(t, { moving }) {
    head.rotation.z = Math.sin(t * 1.5) * 0.08
    foot.scale.z = 0.6 + (moving ? Math.sin(t * 4) * 0.05 : 0)
    neck.rotation.x = -0.2 + Math.sin(t * 2) * 0.05
  }
  return { group: g, legs: [], arms: [], sitDrop: 0.1, noStool: true, head, animate }
}

// ── Coco: a carved cuckoo clock with the bird popping out on a little spring ──
// Built to hang on a wall: the clock face points along local +Z.
function buildCoco() {
  const g = new THREE.Group()
  const clock = new THREE.Group(); clock.position.y = 1.9; g.add(clock)
  const wood = toon(0x7a4a28), dark = toon(0x3a2214)
  clock.add(boxm(0.6, 0.7, 0.3, wood, 0, 0, 0))
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 4), dark); roof.rotation.y = Math.PI / 4; roof.position.y = 0.52; roof.scale.z = 0.7; clock.add(roof)
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), toon(0xfff4d8)); face.position.set(0, -0.08, 0.152); clock.add(face)
  const hourHand = boxm(0.02, 0.1, 0.01, dark, 0, -0.04, 0.16); clock.add(hourHand)
  const minHand = boxm(0.015, 0.14, 0.01, dark, 0, -0.02, 0.162); clock.add(minHand)
  for (let k = 0; k < 12; k++) clock.add(boxm(0.012, 0.03, 0.005, dark, Math.sin(k * Math.PI / 6) * 0.14, -0.08 + Math.cos(k * Math.PI / 6) * 0.14, 0.155))
  clock.add(boxm(0.2, 0.16, 0.02, dark, 0, 0.22, 0.152)) // little door
  for (let k = 0; k < 4; k++) clock.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), toon(0x3a8a3a)).translateX(-0.25 + k * 0.17).translateY(0.36).translateZ(0.16)) // carved leaves
  // pine-cone weights on chains
  const weights = [-1, 1].map(sx => { const w = new THREE.Group(); w.position.set(sx * 0.12, -0.35, 0.05); w.add(cyl(0.006, 0.006, 0.5, toon(0xc0a040), 0, -0.25, 0, 4)); w.add(cone(0.05, 0.16, toon(0x5a3a1a), 0, -0.56, 0, 8).rotateX(Math.PI)); clock.add(w); return w })
  // the bird, on a spring
  const bird = new THREE.Group(); bird.position.set(0, 0.22, 0.1); clock.add(bird)
  const body = sphere(0.1, toon(0xffd84a), 0, 0, 0, 14); body.scale.z = 1.3; bird.add(body)
  const head = sphere(0.075, toon(0xffd84a), 0, 0.08, 0.08, 12); bird.add(head)
  for (const sx of [-1, 1]) { const e = eye(0.03, 0x2a2a2a); e.position.set(sx * 0.04, 0.1, 0.14); bird.add(e) }
  const beak = cone(0.025, 0.08, toon(0xff7a20), 0, 0.07, 0.18, 6); beak.rotation.x = Math.PI / 2; bird.add(beak)
  const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), toon(0xc0c4cc)); spring.rotation.x = Math.PI / 2; spring.position.z = -0.12; bird.add(spring)
  function animate(t, { striking = 0, sitting }) {
    // the bird pops out further the closer it gets to striking
    const out = sitting ? 0.35 : striking > 0.85 ? 0.35 + Math.abs(Math.sin(t * 20)) * 0.05 : striking * 0.12
    bird.position.z = 0.1 + out
    minHand.rotation.z = -t * 3
    hourHand.rotation.z = -t * 0.25
    weights.forEach((w, i) => { w.rotation.z = Math.sin(t * 3 + i) * 0.08 })
    clock.rotation.z = striking > 0.85 && !sitting ? Math.sin(t * 30) * 0.03 : 0
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, animate }
}

// ── Mirror Marvin: a tall standing mirror with a goofy ghost inside it ──
function buildMarvin() {
  const g = new THREE.Group()
  const frameM = toon(0xc0a040), dark = toon(0x2a1a10)
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 30), frameM); frame.scale.y = 1.7; frame.position.y = 1.2; g.add(frame)
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.5, 30), new THREE.MeshBasicMaterial({ color: 0x5a6a8a })); glass.scale.y = 1.7; glass.position.set(0, 1.2, 0.01); g.add(glass)
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })); sheen.position.set(-0.25, 1.35, 0.02); sheen.rotation.z = 0.3; g.add(sheen)
  g.add(boxm(0.5, 0.06, 0.3, dark, 0, 0.03, 0))
  for (const sx of [-1, 1]) g.add(cyl(0.025, 0.025, 0.4, dark, sx * 0.2, 0.2, 0, 6))
  g.add(sphere(0.07, frameM, 0, 2.12, 0, 10))
  // the ghost inside the glass: big face, grabby hands
  const ghost = new THREE.Group(); ghost.position.set(0, 1.25, 0.03); g.add(ghost)
  const face = sphere(0.28, new THREE.MeshToonMaterial({ color: 0xd8f4ff, gradientMap: toonGradient(), transparent: true, opacity: 0.9 }), 0, 0, 0, 18); face.scale.z = 0.25; ghost.add(face)
  for (const sx of [-1, 1]) {
    const e = eye(0.07, 0x5a2a8a); e.position.set(sx * 0.1, 0.06, 0.06); e.scale.z = 0.4; ghost.add(e)
    const hand = sphere(0.08, face.material, sx * 0.33, -0.15, 0.02, 10); hand.scale.z = 0.3; ghost.add(hand)
  }
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12, Math.PI), toon(0x2a1a4a)); grin.position.set(0, -0.08, 0.08); grin.rotation.z = Math.PI; ghost.add(grin)
  function animate(t, { mimic = 0, sitting }) {
    // he copies the way you're looking/moving, a beat late
    ghost.position.x = sitting ? 0 : Math.sin(mimic) * 0.12
    ghost.rotation.z = sitting ? Math.sin(t * 2) * 0.1 : Math.sin(mimic * 0.5) * 0.15
    ghost.position.y = 1.25 + Math.sin(t * 2) * 0.03
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, animate }
}

// ── Professor Hoot: a round owl in a tweed waistcoat with reading glasses ──
function buildHoot() {
  const g = new THREE.Group()
  const feathers = toon(0x9a7a5a), belly = toon(0xe8d8b8), tweed = toon(0x5a6a3a)
  const body = sphere(0.42, feathers, 0, 0.75, 0, 20); body.scale.set(1, 1.15, 0.9); g.add(body)
  const vest = sphere(0.36, tweed, 0, 0.62, 0.1, 18); vest.scale.set(0.95, 0.9, 0.75); g.add(vest)
  const bel = sphere(0.24, belly, 0, 0.7, 0.24, 14); bel.scale.set(0.8, 1.2, 0.5); g.add(bel)
  for (let k = 0; k < 3; k++) g.add(sphere(0.025, toon(0xc0a040), 0, 0.82 - k * 0.12, 0.38, 8))
  for (const sx of [-1, 1]) {
    const e = eye(0.12, 0xe0a020); e.position.set(sx * 0.15, 1.12, 0.3); g.add(e)
    const disc = sphere(0.17, belly, sx * 0.15, 1.12, 0.24, 14); disc.scale.z = 0.3; g.add(disc)
    const tuft = cone(0.07, 0.2, feathers, sx * 0.3, 1.42, 0, 6); tuft.rotation.z = -sx * 0.4; g.add(tuft)
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 18), toon(0x2a1a10)); lens.position.set(sx * 0.15, 1.12, 0.38); g.add(lens)
    const wing = sphere(0.2, feathers, sx * 0.4, 0.75, 0, 12); wing.scale.set(0.35, 1, 0.8); g.add(wing)
    const talon = sphere(0.07, toon(0xe0a020), sx * 0.13, 0.12, 0.2, 8); talon.scale.z = 1.5; g.add(talon)
  }
  const beak = cone(0.05, 0.12, toon(0xe0a020), 0, 1.0, 0.4, 6); beak.rotation.x = Math.PI * 0.6; g.add(beak)
  // a stack of books he's sitting next to
  ;[0x7a2a1a, 0x2a4a7a, 0x3a6a2a].forEach((c, k) => g.add(boxm(0.35, 0.08, 0.25, toon(c), 0.55, 0.04 + k * 0.08, 0.1).rotateY(k * 0.3)))
  function animate(t) { g.children[0].rotation.y = Math.sin(t * 0.8) * 0.1 }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, animate }
}

// ── The Gardener: a tall, thin man in a straw farmer's hat, holding a sickle.
// His face stays in the shadow of the brim — all you ever see is the smile. ──
function strawHat(straw) {
  const hat = new THREE.Group()
  hat.add(cyl(0.42, 0.42, 0.03, straw, 0, 0, 0, 24))
  hat.add(cyl(0.17, 0.2, 0.18, straw, 0, 0.1, 0, 16))
  hat.add(cyl(0.205, 0.205, 0.04, toon(0x7a2a1a), 0, 0.04, 0, 16)) // band
  for (let k = 0; k < 10; k++) { const s2 = boxm(0.015, 0.06, 0.005, toon(0xc8a050), Math.cos(k * 0.63) * 0.42, -0.03, Math.sin(k * 0.63) * 0.42); s2.rotation.y = -k * 0.63; hat.add(s2) } // frayed straw
  return hat
}
function sickle(steelM, handleM) {
  const g = new THREE.Group()
  g.add(cyl(0.025, 0.03, 0.45, handleM, 0, 0, 0, 8))
  const blade = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 20, Math.PI * 1.1), steelM)
  blade.scale.z = 0.3
  blade.position.set(0.2, 0.28, 0); blade.rotation.z = -0.3
  g.add(blade)
  return g
}
function buildGardener() {
  const g = new THREE.Group()
  const shirt = toon(0x8a2a2a), overalls = toon(0x3a4a6a), skin = toon(0xc8a888), straw = toon(0xe0c070)
  const glove = toon(0x6a5a3a), boots = toon(0x2a2018)
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.5, roughness: 0.25 })
  const legs = [-1, 1].map(sx => {
    const l = new THREE.Group()
    l.add(capsule(0.085, 0.55, overalls, 0, -0.34, 0))
    l.add(boxm(0.15, 0.12, 0.28, boots, 0, -0.72, 0.05))
    return limbPivot(g, sx * 0.12, 0.82, 0, l)
  })
  const torso = capsule(0.2, 0.5, shirt, 0, 1.2, 0); torso.scale.z = 0.75; g.add(torso)
  g.add(boxm(0.34, 0.42, 0.04, overalls, 0, 1.08, 0.14)) // bib
  for (const sx of [-1, 1]) g.add(boxm(0.05, 0.4, 0.03, overalls, sx * 0.12, 1.35, 0.13))
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head)
  head.add(sphere(0.17, skin))
  // the brim's shadow hides most of his face — just a dark band, two pinprick eyes, and the smile
  const shadow = sphere(0.175, new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, 0.02, 0.01); shadow.scale.set(1.02, 0.85, 1.02); head.add(shadow)
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: 0xd8c8a0 })); smile.position.set(0, -0.08, 0.17); smile.rotation.z = Math.PI; head.add(smile)
  const eyes = [-1, 1].map(sx => { const e = sphere(0.012, new THREE.MeshBasicMaterial({ color: 0xffe8a0 }), sx * 0.055, 0.04, 0.165, 6); head.add(e); return e })
  const hat = strawHat(straw); hat.position.y = 0.12; hat.rotation.x = 0.12; head.add(hat)
  const arms = [-1, 1].map(sx => {
    const a = new THREE.Group()
    a.add(capsule(0.065, 0.5, shirt, 0, -0.3, 0))
    a.add(sphere(0.075, glove, 0, -0.62, 0, 10))
    const p = limbPivot(g, sx * 0.27, 1.5, 0, a); p.userData.base = 0; p.rotation.z = sx * 0.12
    return p
  })
  const tool = sickle(steel, toon(0x5a3a1a)); tool.position.set(0, -0.66, 0.05); tool.rotation.x = Math.PI / 2; arms[1].add(tool)
  function animate(t, { pose = 'stand', moving }) {
    eyes.forEach(e => { e.visible = pose !== 'prune' && pose !== 'mow' })
    arms[0].rotation.set(0, 0, -0.12); arms[1].rotation.set(0, 0, 0.12); head.rotation.set(0, 0, 0)
    g.rotation.z = 0
    if (pose === 'prune') { arms[1].rotation.x = -1.6 + Math.abs(Math.sin(t * 5)) * 0.5; arms[0].rotation.x = -1.3 }
    else if (pose === 'wave') { arms[1].rotation.set(0, 0, 2.6 + Math.sin(t * 5) * 0.35); head.rotation.z = 0.25 }
    else if (pose === 'mow') { legs.forEach(l => { l.rotation.x = -1.4 }); arms.forEach(a => { a.rotation.x = -1.1 }) }
    else if (pose === 'stare' || pose === 'whisper') { head.rotation.z = Math.sin(t * 0.7) * 0.25; g.rotation.z = pose === 'whisper' ? 0.08 : 0 }
    else if (moving) { arms[1].rotation.x = -0.8 + Math.sin(t * 9) * 0.4; arms[0].rotation.x = Math.sin(t * 9 + Math.PI) * 0.4 }
    if (pose !== 'mow') legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 9 + i * Math.PI) * 0.6 : 0 })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, head, animate }
}

// A scarecrow: sack head, straw hat, arms out on a pole. One of them, sometimes, is him.
export function buildScarecrow() {
  const g = new THREE.Group()
  const sack = toon(0xb89a6a), shirt = toon(0x8a2a2a), straw = toon(0xe0c070), wood = toon(0x5a3a1a)
  g.add(cyl(0.05, 0.05, 2.0, wood, 0, 1.0, 0, 6))
  g.add(cyl(0.04, 0.04, 1.4, wood, 0, 1.45, 0, 6).rotateZ(Math.PI / 2))
  const body = capsule(0.2, 0.45, shirt, 0, 1.25, 0); body.scale.z = 0.7; g.add(body)
  for (const sx of [-1, 1]) { g.add(capsule(0.07, 0.5, shirt, sx * 0.45, 1.45, 0).rotateZ(Math.PI / 2)); for (let k = 0; k < 3; k++) g.add(cone(0.03, 0.18, straw, sx * (0.75 + k * 0.03), 1.45 + (k - 1) * 0.04, 0, 4).rotateZ(-sx * Math.PI / 2)) }
  const head = new THREE.Group(); head.position.y = 1.78; g.add(head)
  const face = sphere(0.18, sack); face.scale.y = 1.1; head.add(face)
  for (const sx of [-1, 1]) head.add(boxm(0.05, 0.05, 0.01, toon(0x1a1a1a), sx * 0.06, 0.03, 0.17).rotateZ(Math.PI / 4)) // stitched X eyes
  const mouth = boxm(0.12, 0.012, 0.01, toon(0x1a1a1a), 0, -0.07, 0.17); head.add(mouth)
  const hat = strawHat(straw); hat.position.y = 0.13; hat.rotation.z = 0.15; head.add(hat)
  return { group: g, head }
}

// His ride-on mower.
export function buildMower() {
  const g = new THREE.Group()
  const red = toon(0xb02a2a), black = toon(0x1a1a1a)
  g.add(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.35, 1.4, 3, 0.1), red).translateY(0.4))
  g.add(boxm(0.95, 0.12, 0.5, black, 0, 0.2, 0.55))
  g.add(boxm(0.45, 0.08, 0.4, black, 0, 0.62, -0.2)) // seat
  g.add(cyl(0.02, 0.02, 0.5, black, 0, 0.8, 0.35, 6).rotateX(-0.6))
  g.add(cyl(0.18, 0.18, 0.03, black, 0, 1.0, 0.5, 14).rotateX(-1.0)) // steering wheel
  for (const [x, z, r] of [[-0.5, 0.5, 0.17], [0.5, 0.5, 0.17], [-0.5, -0.5, 0.25], [0.5, -0.5, 0.25]]) g.add(cyl(r, r, 0.12, black, x, r, z, 14).rotateZ(Math.PI / 2))
  const headlight = sphere(0.07, new THREE.MeshBasicMaterial({ color: 0xfff6c0 }), 0, 0.5, 0.71, 10); g.add(headlight)
  return g
}

// ── THE HARVESTER: what the Gardener really is. A towering thing of twisted
// thorn-vines, a split, glowing carved-pumpkin head under the old straw hat,
// and a sickle as long as a car. Genuinely not friendly. ──
function buildHarvester() {
  const g = new THREE.Group()
  const rig = new THREE.Group(); g.add(rig)
  const bark = new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.9 })
  const vineM = new THREE.MeshStandardMaterial({ color: 0x1a2410, roughness: 0.9 })
  const glowM = new THREE.MeshBasicMaterial({ color: 0xff5a10 })
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a10 })
  const pumpkin = new THREE.MeshStandardMaterial({ color: 0x6a3008, roughness: 0.7, emissive: 0x2a0800 })
  const blade = new THREE.MeshStandardMaterial({ color: 0x8a8e96, metalness: 0.6, roughness: 0.35, emissive: 0x3a0000 })
  // root legs
  const legs = []
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.55, 1.9, 0)
    for (let k = 0; k < 3; k++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 2.1, 7), bark)
      root.position.set(sx * 0.1 * k, -1.0, (k - 1) * 0.15); root.rotation.z = sx * (0.1 + k * 0.12); root.rotation.x = (k - 1) * 0.15
      leg.add(root)
    }
    for (let k = 0; k < 4; k++) { const toe = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), bark); toe.position.set(sx * 0.2 + Math.cos(k * 1.6) * 0.4, -1.9, Math.sin(k * 1.6) * 0.4); toe.rotation.set(Math.sin(k * 1.6) * 1.3, 0, -Math.cos(k * 1.6) * 1.3); leg.add(toe) }
    rig.add(leg); legs.push(leg)
  }
  // twisted vine torso with a glowing heart showing through the gaps
  const torso = new THREE.Group(); torso.position.y = 2.7; rig.add(torso)
  for (let k = 0; k < 7; k++) {
    const curve = new THREE.CatmullRomCurve3([0, 1, 2, 3, 4].map(j => new THREE.Vector3(Math.cos(k * 0.9 + j * 0.9) * (0.45 - j * 0.04), j * 0.42 - 0.8, Math.sin(k * 0.9 + j * 0.9) * (0.35 - j * 0.03))))
    torso.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 6), k % 2 ? vineM : bark))
  }
  const heart = sphere(0.22, glowM, 0, 0.1, 0, 12); torso.add(heart)
  const heartLight = new THREE.PointLight(0xff4a10, 4, 7, 1.6); heartLight.position.y = 0.1; torso.add(heartLight)
  for (let k = 0; k < 16; k++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 4), bark); const a = k * 2.4; th.position.set(Math.cos(a) * 0.45, (k % 5) * 0.32 - 0.6, Math.sin(a) * 0.38); th.lookAt(th.position.x * 3, th.position.y, th.position.z * 3); th.rotateX(Math.PI / 2); torso.add(th) }
  // the head: a split, rotting carved pumpkin, lit from inside
  const head = new THREE.Group(); head.position.set(0, 4.4, 0.1); rig.add(head)
  for (let k = 0; k < 8; k++) { const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), pumpkin); lobe.scale.set(0.45, 0.85, 1); lobe.position.set(Math.cos(k * Math.PI / 4) * 0.28, 0, Math.sin(k * Math.PI / 4) * 0.28); lobe.rotation.y = -k * Math.PI / 4; head.add(lobe) }
  head.add(cyl(0.05, 0.08, 0.3, bark, 0.05, 0.45, 0, 6).rotateZ(0.4))
  const inner = sphere(0.5, glowM, 0, 0, 0.05, 12); inner.scale.set(0.9, 0.75, 0.85); head.add(inner)
  const eyes = [-1, 1].map(sx => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 3), eyeM); e.position.set(sx * 0.17, 0.1, 0.56); e.rotation.set(Math.PI / 2, 0, sx * 0.4); head.add(e); return e })
  for (const sx of [-1, 1]) head.add(boxm(0.03, 0.18, 0.03, bark, sx * 0.17, 0.25, 0.6).rotateZ(-sx * 0.8)) // furious brows
  const mouth = new THREE.Group(); mouth.position.set(0, -0.2, 0.55); head.add(mouth)
  mouth.add(boxm(0.5, 0.1, 0.04, glowM, 0, 0, 0))
  for (let k = 0; k < 6; k++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 3), pumpkin); tooth.position.set(-0.22 + k * 0.09, k % 2 ? -0.04 : 0.04, 0.02); tooth.rotation.z = k % 2 ? 0 : Math.PI; mouth.add(tooth) }
  const hat = strawHat(new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 1 })); hat.scale.setScalar(1.8); hat.position.y = 0.42; hat.rotation.z = 0.25; head.add(hat)
  // arms: long vine limbs; the right one ends in the great sickle
  const armL = new THREE.Group(); armL.position.set(-0.6, 3.6, 0); rig.add(armL)
  const armR = new THREE.Group(); armR.position.set(0.6, 3.6, 0); rig.add(armR)
  for (const [arm, sx] of [[armL, -1], [armR, 1]]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.6, -0.6, 0.2), new THREE.Vector3(sx * 0.9, -1.5, 0.3), new THREE.Vector3(sx * 0.8, -2.4, 0.5)])
    arm.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.09, 6), bark))
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.5, 4), bark); f.position.set(sx * 0.8 + (k - 1.5) * 0.08, -2.6, 0.55); f.rotation.x = 0.2; arm.add(f) } // twig fingers
  }
  const scythe = new THREE.Group(); scythe.position.set(0.8, -2.4, 0.5); armR.add(scythe)
  scythe.add(cyl(0.05, 0.05, 2.8, bark, 0, 0.4, 0, 8))
  const bladeMesh = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 28, Math.PI * 0.95), blade)
  bladeMesh.scale.z = 0.25; bladeMesh.position.set(0.9, 1.7, 0); bladeMesh.rotation.z = Math.PI * 0.05
  scythe.add(bladeMesh)
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.015, 4, 28, Math.PI * 0.95), new THREE.MeshBasicMaterial({ color: 0xff3a20 }))
  edge.position.copy(bladeMesh.position); edge.rotation.copy(bladeMesh.rotation); scythe.add(edge)
  // drifting embers
  const embers = []
  for (let k = 0; k < 12; k++) { const e = sphere(0.035, glowM, 0, 0, 0, 5); e.userData.ph = Math.random(); e.userData.a = Math.random() * 6; rig.add(e); embers.push(e) }
  function animate(t, { grow = 1, windup = 0, strike = 0, weak = false, sitting }) {
    rig.scale.setScalar(Math.max(0.05, grow))
    const breathe = Math.sin(t * 1.8) * 0.05
    torso.scale.set(1 + breathe, 1 - breathe * 0.5, 1 + breathe)
    heart.scale.setScalar(1 + Math.abs(Math.sin(t * 4)) * 0.3)
    heartLight.intensity = 3 + Math.abs(Math.sin(t * 4)) * 3
    head.rotation.z = Math.sin(t * 0.9) * 0.12 + (weak ? 0.5 : 0)
    head.rotation.x = weak ? 0.6 : Math.sin(t * 0.6) * 0.06
    mouth.scale.y = 1 + Math.abs(Math.sin(t * 2.2)) * 0.8 + windup * 1.5
    eyes.forEach(e => { e.scale.setScalar(1 + windup * 0.6) })
    // raise the sickle during the windup, swing it on the strike
    armR.rotation.x = weak ? 0.5 : -windup * 2.2 + strike * 1.6
    armR.rotation.z = -windup * 0.4
    armL.rotation.x = Math.sin(t * 1.3) * 0.2 - windup * 0.6
    rig.position.y = weak ? -1.2 : 0
    rig.rotation.x = weak ? 0.35 : 0
    legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 2 + i * Math.PI) * 0.08 })
    embers.forEach(e => { const f = (t * 0.25 + e.userData.ph) % 1; e.position.set(Math.cos(e.userData.a + f * 3) * 1.2, 1 + f * 4.5, Math.sin(e.userData.a + f * 3) * 1.0); e.visible = !sitting })
  }
  return { group: g, legs: [], arms: [], sitDrop: 0, noStool: true, animate }
}

export function buildMonsters(assets) {
  return {
    barry: buildBarry(),
    steve: buildSteve(),
    drakko: buildDrakko(),
    wendell: buildWendell(assets),
    gary: buildGary(),
    reginald: buildReginald(assets),
    doris: buildDoris(),
    mildred: buildMildred(),
    tim: buildTim(),
    frank: buildFrank(),
    gus: buildGus(),
    gloria: buildGloria(),
    hank: buildHank(),
    bernadette: buildBernadette(),
    doug: buildDoug(),
    puff: buildPuff(),
    twirl: buildTwirl(),
    bumpus: buildBumpus(),
    nibbles: buildNibbles(),
    bubbles: buildBubbles(),
    yolanda: buildYolanda(),
    mabel: buildMabel(),
    ollie: buildOllie(),
    bea: buildBea(),
    shelly: buildShelly(),
    coco: buildCoco(),
    marvin: buildMarvin(),
    hoot: buildHoot(),
    gardener: buildGardener(),
    harvester: buildHarvester(),
  }
}

// A little stool for monsters to sit on while they explain themselves.
export function buildStool() {
  const g = new THREE.Group()
  const wood = toon(0x8a5a30)
  g.add(cyl(0.28, 0.28, 0.06, wood, 0, 0.42, 0))
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    g.add(cyl(0.03, 0.03, 0.42, wood, Math.cos(a) * 0.18, 0.21, Math.sin(a) * 0.18, 6))
  }
  return g
}

// Per-frame pose: shared walk cycle / sitting pose, then each monster's
// own animation (shedding, hopping, flapping, knitting…).
export function poseMonster(m, t, opts = {}) {
  const { moving = false, speed = 1, sitting = false } = opts
  const phase = t * 9 * speed
  m.legs.forEach((leg, i) => { leg.rotation.x = sitting ? -1.4 : moving ? Math.sin(phase + i * Math.PI) * 0.7 : 0 })
  m.arms.forEach((arm, i) => {
    const base = arm.userData.base ?? 0
    if (sitting) arm.rotation.x = -0.5 + Math.sin(t * 2.2 + i * 1.7) * 0.3 // talking with their hands
    else if (moving) arm.rotation.x = base + Math.sin(phase + i * Math.PI + Math.PI) * 0.3
    else arm.rotation.x = base
  })
  if (m.head) m.head.rotation.z = sitting ? Math.sin(t * 1.3) * 0.12 : 0
  m.animate?.(t, { moving, sitting, speed, dancing: !!opts.dancing, size: opts.size, striking: opts.striking, mimic: opts.mimic, pose: opts.pose, grow: opts.grow, windup: opts.windup, strike: opts.strike, weak: opts.weak })
  return m.group
}

export function disposeMonsters(ms) {
  const seen = new Set()
  Object.values(ms).forEach(m => m.group.traverse(o => {
    if (o.geometry) o.geometry.dispose()
    if (!o.material) return
    for (const mm of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(mm)) continue
      seen.add(mm)
      mm.map?.dispose()
      mm.dispose()
    }
  }))
}
