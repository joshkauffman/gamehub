// ── Photo gallery ────────────────────────────────────────────────────────
// The 📸 button on game pages (GameOverlay.jsx) saves a small JPEG of the
// screen here. Canvas games are copied straight from their canvases (see
// canvasCapture.js for why WebGL ones work); everything else is drawn with
// html2canvas, which is only loaded the first time it's needed.

const KEY = 'gamehub-gallery-v1'
const MAX = 30
const WIDTH = 480

export function loadGallery() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
function save(list) {
  // Photos are big; if the browser runs out of room, drop the oldest and retry.
  for (let l = list; l.length; l = l.slice(0, -1)) {
    try { localStorage.setItem(KEY, JSON.stringify(l)); return l } catch { /* full */ }
  }
  return []
}
export function addPhoto(photo) { return save([photo, ...loadGallery()].slice(0, MAX)) }
export function deletePhoto(id) { return save(loadGallery().filter(p => p.id !== id)) }

function visibleArea(r) {
  const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0)
  const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)
  return w > 0 && h > 0 ? w * h : 0
}

export async function snapScreen() {
  const vw = innerWidth, vh = innerHeight
  const scale = Math.min(1, WIDTH / vw)
  const canvases = [...document.querySelectorAll('canvas')].filter(c => !c.closest('[data-hub-overlay]') && getComputedStyle(c).visibility !== 'hidden')
  const big = canvases.some(c => visibleArea(c.getBoundingClientRect()) > vw * vh * 0.3)
  let out
  if (big) {
    out = document.createElement('canvas')
    out.width = Math.round(vw * scale); out.height = Math.round(vh * scale)
    const ctx = out.getContext('2d')
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#000'
    ctx.fillRect(0, 0, out.width, out.height)
    for (const c of canvases) {
      const r = c.getBoundingClientRect()
      if (!visibleArea(r)) continue
      try { ctx.drawImage(c, r.left * scale, r.top * scale, r.width * scale, r.height * scale) } catch { /* tainted canvas */ }
    }
  } else {
    const { default: html2canvas } = await import('html2canvas')
    out = await html2canvas(document.body, {
      x: scrollX, y: scrollY, width: vw, height: vh, scale,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#0f0f13',
      logging: false,
      ignoreElements: el => el.hasAttribute?.('data-hub-overlay'),
    })
  }
  return out.toDataURL('image/jpeg', 0.72)
}
