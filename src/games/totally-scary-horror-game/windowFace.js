// ── The face in the window ──────────────────────────────────────────────
// Every so often a dark figure with two glowing eyes appears in a window,
// watching you. The moment you look straight at it, it ducks out of sight.
// Nobody on the staff will say who it is.
import * as THREE from 'three'

let tex = null
export function faceTexture() {
  if (tex) return tex
  const c = document.createElement('canvas')
  c.width = 128; c.height = 192
  const ctx = c.getContext('2d')
  const body = (fill, grow) => {
    ctx.fillStyle = fill
    ctx.beginPath(); ctx.ellipse(64, 82, 34 + grow, 40 + grow, 0, 0, Math.PI * 2); ctx.fill() // head
    ctx.beginPath(); ctx.moveTo(4 - grow, 192); ctx.quadraticCurveTo(10, 128, 64, 124 - grow); ctx.quadraticCurveTo(118, 128, 124 + grow, 192); ctx.fill() // shoulders
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(64 + sx * 46, 150, 13 + grow, 18 + grow, sx * 0.3, 0, Math.PI * 2); ctx.fill() } // hands on the glass
  }
  body('rgba(150,170,255,0.55)', 3) // a thin rim of moonlight
  body('#120a14', 0)
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(64 + sx * 14, 80, 0, 64 + sx * 14, 80, 11)
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#ffe27a'); g.addColorStop(1, 'rgba(255,200,80,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(64 + sx * 14, 80, 11, 0, Math.PI * 2); ctx.fill()
  }
  tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// spots(): an array of { x, y, z, rotY } in the parent's space (one per window)
// size: [width, height] of the figure.
export function makeWindowFace(parent, spots, size, { minWait = 7, maxWait = 16 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, opacity: 0, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat)
  mesh.visible = false
  mesh.renderOrder = 2
  parent.add(mesh)
  let state = 'gone', timer = minWait * 0.6, baseY = 0
  const world = new THREE.Vector3(), dir = new THREE.Vector3(), look = new THREE.Vector3()

  function update(dt, camera) {
    timer -= dt
    if (state === 'gone') {
      if (timer > 0) return
      const list = spots()
      if (!list.length) { timer = 3; return }
      const s = list[Math.floor(Math.random() * list.length)]
      mesh.position.set(s.x, s.y, s.z)
      mesh.rotation.y = s.rotY || 0
      baseY = s.y
      mesh.visible = true
      state = 'rising'
      timer = 14 // it won't stay forever
    }
    // is the player looking right at it?
    mesh.getWorldPosition(world)
    dir.copy(world).sub(camera.position)
    const dist = dir.length()
    camera.getWorldDirection(look)
    const stared = look.dot(dir.normalize()) > Math.cos(0.12) && dist < 80
    if (state === 'rising') {
      mat.opacity = Math.min(1, mat.opacity + dt * 0.8)
      if (mat.opacity >= 1) state = 'watching'
    }
    if ((state === 'rising' || state === 'watching') && (stared || timer <= 0)) state = 'ducking'
    if (state === 'ducking') {
      mat.opacity = Math.max(0, mat.opacity - dt * 5) // gone the instant you look
      mesh.position.y -= dt * size[1] * 2
      if (mat.opacity <= 0) {
        mesh.visible = false
        mesh.position.y = baseY
        state = 'gone'
        timer = minWait + Math.random() * (maxWait - minWait)
      }
    }
    // a slow lean, like it's trying to see you better
    if (state !== 'ducking') mesh.rotation.z = Math.sin(performance.now() / 900) * 0.04
  }
  if (import.meta.env.DEV) { window.__faceState = () => state; window.__facePos = () => mesh.getWorldPosition(new THREE.Vector3()) } // for automated tests
  function dispose() { mesh.geometry.dispose(); mat.dispose() }
  return { update, dispose }
}
