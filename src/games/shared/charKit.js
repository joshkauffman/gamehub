// ── Character kit: shared polish for the hub's 3D characters ─────────────
// Small, dependency-free helpers several games use so their characters
// share one finished, "cartoon production" look:
//   • toonMat()        cel shading with a soft 4-step ramp
//   • addInkOutline()  a clean dark outline around a whole model
//   • cartoonEye()     a big eye with iris, pupil and two highlights
//   • makeBlinker()    blinks a set of eyes every few seconds
//   • contactShadow()  a soft round shadow under the feet
import * as THREE from 'three'

let ramp = null
export function toonRamp() {
  if (ramp) return ramp
  ramp = new THREE.DataTexture(new Uint8Array([90, 160, 220, 255]), 4, 1, THREE.RedFormat)
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter
  ramp.needsUpdate = true
  return ramp
}

const matCache = new Map()
// Cel-shaded material. Shared per colour unless `extra` is given.
export function toonMat(color, extra) {
  if (!extra) {
    const hit = matCache.get(color)
    if (hit) return hit
  }
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra })
  if (!extra) matCache.set(color, m)
  return m
}

// ── Ink outline ──
// Each solid mesh gets a twin drawn back-faces-only and pushed out along
// its normals in view space, scaled by distance so the line stays about
// the same thickness on screen whether the character is near or far.
// Tiny bits (eye highlights) and transparent / unlit / glowing parts are
// skipped, and so is anything marked userData.noOutline.
const outlineMats = new Map()
function outlineMaterial(color, width) {
  const key = `${color}|${width}`
  let m = outlineMats.get(key)
  if (m) return m
  m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uInk = { value: width }
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uInk;\nvoid main() {')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
        vec3 inkN = normalize( normalMatrix * normal );
        mvPosition.xyz += inkN * uInk * clamp( -mvPosition.z, 1.0, 40.0 );
        gl_Position = projectionMatrix * mvPosition;
      `)
  }
  m.customProgramCacheKey = () => `ink-${width}`
  m.userData.isInk = true
  outlineMats.set(key, m)
  return m
}

export function addInkOutline(root, { color = 0x17111f, width = 0.006, minSize = 0.05 } = {}) {
  const mat = outlineMaterial(color, width)
  const targets = []
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noOutline || o.userData.isInkLine) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    if (mats.some(mm => !mm || mm.transparent || mm.isMeshBasicMaterial || mm.userData?.isInk || mm.side === THREE.BackSide || (mm.emissiveIntensity > 0.6 && mm.emissive?.getHex()))) return
    const g = o.geometry
    if (!g?.attributes?.normal) return
    if (!g.boundingSphere) g.computeBoundingSphere()
    const s = o.getWorldScale(new THREE.Vector3())
    if (g.boundingSphere.radius * Math.max(s.x, s.y, s.z) < minSize) return
    targets.push(o)
  })
  for (const o of targets) {
    const ink = new THREE.Mesh(o.geometry, mat)
    ink.userData.isInkLine = true
    ink.userData.noOutline = true
    ink.castShadow = false
    ink.receiveShadow = false
    ink.raycast = () => {}
    o.add(ink)
  }
  return root
}

// ── Eyes ──
const white = () => toonMat(0xffffff)
const shine = new THREE.MeshBasicMaterial({ color: 0xffffff })
// A cartoon eye facing +Z: white ball, coloured iris, pupil, two highlights.
export function cartoonEye(r, iris = 0x3b2a1a, { lid } = {}) {
  const e = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), white())
  ball.userData.noOutline = true // an outlined eyeball shows a thin ring through the face around it
  e.add(ball)
  // iris, pupil and highlights sit just proud of the eyeball's front
  const irisM = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 18, 12), toonMat(iris))
  irisM.position.z = r * 0.74
  irisM.scale.z = 0.45
  irisM.userData.noOutline = true
  e.add(irisM)
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 14, 10), toonMat(0x0b0b12))
  pupil.position.z = r * 0.92
  pupil.scale.z = 0.4
  pupil.userData.noOutline = true
  e.add(pupil)
  for (const [x, y, s] of [[0.22, 0.24, 0.17], [-0.2, -0.2, 0.08]]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r * s, 8, 6), shine)
    h.position.set(r * x, r * y, r * 1.06)
    h.userData.noOutline = true
    e.add(h)
  }
  if (lid) {
    // a half-closed lid for sleepy / grumpy faces
    const l = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), toonMat(lid))
    l.rotation.x = -0.25
    e.add(l)
  }
  e.userData.isEye = true
  return e
}

// Blinks every few seconds (both eyes together). Call the returned
// function with the time in seconds every frame.
export function makeBlinker(eyes, { every = 3.6 } = {}) {
  let next = 1 + Math.random() * every
  let start = -1
  return (t) => {
    if (start < 0 && t > next) { start = t; next = t + every * (0.6 + Math.random() * 0.8) }
    let k = 1
    if (start >= 0) {
      const p = (t - start) / 0.14
      if (p >= 1) start = -1
      else k = Math.max(0.08, Math.abs(1 - p * 2))
    }
    for (const e of eyes) e.scale.y = k
  }
}

// ── Contact shadow ── a soft dark disc under a character.
let shadowTex = null
export function contactShadow(radius = 0.5, opacity = 0.35) {
  if (!shadowTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(0,0,0,1)')
    grd.addColorStop(0.55, 'rgba(0,0,0,0.55)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 64, 64)
    shadowTex = new THREE.CanvasTexture(c)
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }),
  )
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.015
  m.renderOrder = -1
  m.userData.noOutline = true
  m.raycast = () => {}
  return m
}
