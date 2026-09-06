import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import styles from '../SatisfyingToybox.module.css'
import { playClick } from '../sound.js'

// ── Rubik's Cube ─────────────────────────────────────────────────────
// The trick that keeps this correct: we never touch sticker colors after
// building the cube. A face "turn" physically reparents the 9 cubies in
// that layer under a temporary pivot (via Object3D.attach, which
// preserves world transform), animates the pivot's rotation by exactly
// ±90°, then reparents the cubies back and snaps their position to the
// grid. The visible colors permute themselves as a side effect of the
// real rotation — there's no separate sticker-permutation table to get
// wrong.

const SIZE = 320
const SPACING = 1.04
const TURN_MS = 260

const COLORS = {
  U: 0xf7f7f7, D: 0xffd500, F: 0x00a651, B: 0x0051ba, R: 0xc41e3a, L: 0xff5800, hidden: 0x181818,
}

const FACES = [
  { id: 'U', label: 'U', axis: 'y', layer: 1 },
  { id: 'D', label: 'D', axis: 'y', layer: -1 },
  { id: 'F', label: 'F', axis: 'z', layer: 1 },
  { id: 'B', label: 'B', axis: 'z', layer: -1 },
  { id: 'R', label: 'R', axis: 'x', layer: 1 },
  { id: 'L', label: 'L', axis: 'x', layer: -1 },
]

function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 }

export default function RubiksCube() {
  const mountRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const busyCountRef = useRef(0)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(SIZE, SIZE)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const key = new THREE.DirectionalLight(0xffffff, 0.7)
    key.position.set(5, 8, 6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-6, -3, -4)
    scene.add(fill)

    const cubeGroup = new THREE.Group()
    scene.add(cubeGroup)
    let cubies = []
    const cubieGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98)

    function faceMaterial(color) {
      return new THREE.MeshLambertMaterial({ color })
    }

    function buildCube() {
      for (const c of cubies) { cubeGroup.remove(c) }
      cubies = []
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const materials = [
              faceMaterial(x === 1 ? COLORS.R : COLORS.hidden),
              faceMaterial(x === -1 ? COLORS.L : COLORS.hidden),
              faceMaterial(y === 1 ? COLORS.U : COLORS.hidden),
              faceMaterial(y === -1 ? COLORS.D : COLORS.hidden),
              faceMaterial(z === 1 ? COLORS.F : COLORS.hidden),
              faceMaterial(z === -1 ? COLORS.B : COLORS.hidden),
            ]
            const mesh = new THREE.Mesh(cubieGeo, materials)
            mesh.position.set(x * SPACING, y * SPACING, z * SPACING)
            cubeGroup.add(mesh)
            cubies.push(mesh)
          }
        }
      }
    }
    buildCube()

    // ── Orbit view (drag to look around — separate from face turns) ──
    let yaw = 0.55, pitch = 0.5
    function updateCameraOrbit() {
      const r = 6.4
      camera.position.set(
        r * Math.sin(yaw) * Math.cos(pitch),
        r * Math.sin(pitch),
        r * Math.cos(yaw) * Math.cos(pitch),
      )
      camera.lookAt(0, 0, 0)
    }
    updateCameraOrbit()

    let dragging = false, lastX = 0, lastY = 0
    function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY }
    function onMove(e) {
      if (!dragging) return
      yaw -= (e.clientX - lastX) * 0.008
      pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - lastY) * 0.008))
      lastX = e.clientX; lastY = e.clientY
      updateCameraOrbit()
    }
    function onUp() { dragging = false }
    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    function render() { renderer.render(scene, camera) }
    let raf = requestAnimationFrame(function loop() { raf = requestAnimationFrame(loop); render() })

    // ── Face turns ───────────────────────────────────────────────────
    const axisVec = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

    function turnFace(axis, layer, dir) {
      return new Promise(resolve => {
        const selected = cubies.filter(c => Math.round(c.position[axis] / SPACING) === layer)
        const pivot = new THREE.Group()
        cubeGroup.add(pivot)
        for (const c of selected) pivot.attach(c)
        const targetAngle = dir * (Math.PI / 2)
        const start = performance.now()
        playClick(520 + Math.random() * 60, 0.05)
        function step(now) {
          const t = Math.min(1, (now - start) / TURN_MS)
          const eased = easeInOutQuad(t)
          pivot.quaternion.setFromAxisAngle(axisVec[axis], targetAngle * eased)
          if (t < 1) {
            requestAnimationFrame(step)
          } else {
            pivot.quaternion.setFromAxisAngle(axisVec[axis], targetAngle)
            for (const c of selected) {
              cubeGroup.attach(c)
              c.position.set(
                Math.round(c.position.x / SPACING) * SPACING,
                Math.round(c.position.y / SPACING) * SPACING,
                Math.round(c.position.z / SPACING) * SPACING,
              )
            }
            cubeGroup.remove(pivot)
            resolve()
          }
        }
        requestAnimationFrame(step)
      })
    }

    let queue = Promise.resolve()
    function enqueue(axis, layer, dir) {
      busyCountRef.current += 1
      setBusy(true)
      queue = queue.then(() => turnFace(axis, layer, dir)).then(() => {
        busyCountRef.current -= 1
        if (busyCountRef.current <= 0) { busyCountRef.current = 0; setBusy(false) }
      })
    }

    mount._enqueue = enqueue
    mount._reset = () => { buildCube() }

    return () => {
      cancelAnimationFrame(raf)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  function turn(face, dir) {
    mountRef.current._enqueue?.(face.axis, face.layer, dir)
  }
  function scramble() {
    for (let i = 0; i < 18; i++) {
      const f = FACES[Math.floor(Math.random() * FACES.length)]
      const dir = Math.random() < 0.5 ? 1 : -1
      mountRef.current._enqueue?.(f.axis, f.layer, dir)
    }
  }
  function reset() { mountRef.current._reset?.() }

  return (
    <div className={styles.toyPanel}>
      <div className={styles.toyToolbar}>
        <span className={styles.toyStat}>Drag to look around · tap a face button to turn it</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.toyBtn} onClick={scramble} disabled={busy}>Scramble</button>
          <button className={styles.toyBtn} onClick={reset}>Reset</button>
        </div>
      </div>
      <div className={styles.cubeStage}>
        <div ref={mountRef} className={styles.cubeMount} style={{ width: SIZE, height: SIZE }} />
      </div>
      <div className={styles.cubeButtons}>
        {FACES.map(f => (
          <div key={f.id} className={styles.cubeFaceGroup}>
            <button className={styles.cubeTurnBtn} onClick={() => turn(f, -1)} aria-label={`${f.label} counter-clockwise`}>{f.label}'</button>
            <span className={styles.cubeFaceLabel}>{f.label}</span>
            <button className={styles.cubeTurnBtn} onClick={() => turn(f, 1)} aria-label={`${f.label} clockwise`}>{f.label}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
