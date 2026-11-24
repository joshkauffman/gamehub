// ── The Totally Scary Horror Game — hotel geometry (THREE) ──────────────
// Turns the engine's room data into meshes. Every wall/furniture mesh is
// built from the exact same numbers the engine collides against, so what
// you see is what you bump into. Textures are all drawn on canvases at
// startup (no image assets), and walls use world-space UVs so wallpaper
// lines up across separate wall boxes.
import * as THREE from 'three'
import { WALL_T, ROOM_H, GAP_HALF, GAP_H } from './constants.js'
import { mulberry32 } from './engine.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const T = WALL_T

// ── Canvas textures ─────────────────────────────────────────────────────

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

function noise(ctx, w, h, alpha, n = 900) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.6})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
  }
}

const WALL_PALETTES = [
  { base: '#5c2230', stripe: '#6a2a38', motif: '#c9a24a' }, // burgundy
  { base: '#1f4a3a', stripe: '#265645', motif: '#cdb46a' }, // green
  { base: '#2a3557', stripe: '#334068', motif: '#bca86a' }, // navy
  { base: '#6b5626', stripe: '#7a6430', motif: '#e6d48e' }, // mustard
  { base: '#4a2a52', stripe: '#573260', motif: '#cfa8d6' }, // plum
  { base: '#5a3a2a', stripe: '#674434', motif: '#e0b080' }, // cocoa
]
const HALT_PALETTE = { base: '#1b3350', stripe: '#213d5e', motif: '#7fb2e0' }
const LIB_PALETTE = { base: '#24402e', stripe: '#2b4a36', motif: '#b8a060' }
const LOBBY_PALETTE = { base: '#6a2a2a', stripe: '#783232', motif: '#e8c060' }
const SUB_PALETTE = { base: '#14161a', stripe: '#181b20', motif: '#2a2e36' }
const STAFF_PALETTE = { base: '#2a0a10', stripe: '#3a0e16', motif: '#8a2a2a' }
const SHOP_PALETTE = { base: '#2a6a6a', stripe: '#327878', motif: '#ffc0d8' }

export function paletteFor(room) {
  if (room.type === 'halt') return HALT_PALETTE
  if (room.type === 'library') return LIB_PALETTE
  if (room.type === 'lobby' || room.type === 'exit') return LOBBY_PALETTE
  if (room.type === 'shop') return SHOP_PALETTE
  return WALL_PALETTES[(room.index * 7 + 3) % WALL_PALETTES.length]
}

function wallpaper(p) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 64) { ctx.fillStyle = p.stripe; ctx.fillRect(x, 0, 32, h) }
    ctx.fillStyle = p.motif
    ctx.globalAlpha = 0.55
    for (let y = 16; y < h; y += 64) {
      for (let x = 48; x < w; x += 64) {
        ctx.beginPath()
        ctx.moveTo(x, y - 9); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 6, y)
        ctx.closePath(); ctx.fill()
        ctx.fillRect(x - 1, y + 14, 2, 10)
      }
    }
    ctx.globalAlpha = 1
    noise(ctx, w, h, 0.05)
  })
}

function woodFloor() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const browns = ['#5a3a22', '#64422a', '#4f331e', '#6b4a2e', '#583820']
    const rowH = 64
    for (let y = 0; y < h; y += rowH) {
      let x = -Math.random() * 200
      while (x < w) {
        const len = 160 + Math.random() * 200
        ctx.fillStyle = browns[Math.floor(Math.random() * browns.length)]
        ctx.fillRect(x, y, len, rowH)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(x, y, 2, rowH)
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = 'rgba(0,0,0,0.08)'
          ctx.fillRect(x, y + 6 + Math.random() * (rowH - 12), len, 1)
        }
        x += len
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, y, w, 2)
    }
  })
}

function carpet(base, a, b) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h)
    const s = 64
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.strokeStyle = a; ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(x + s / 2, y + 4); ctx.lineTo(x + s - 4, y + s / 2); ctx.lineTo(x + s / 2, y + s - 4); ctx.lineTo(x + 4, y + s / 2)
        ctx.closePath(); ctx.stroke()
        ctx.fillStyle = b
        ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(x, y, 6, 6)
      }
    }
    noise(ctx, w, h, 0.06, 1500)
  })
}

function marble() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const s = 128
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      ctx.fillStyle = ((x + y) / s) % 2 === 0 ? '#d8d0c0' : '#2a2626'
      ctx.fillRect(x, y, s, s)
    }
    ctx.strokeStyle = 'rgba(120,110,100,0.35)'; ctx.lineWidth = 1.5
    for (let i = 0; i < 14; i++) {
      ctx.beginPath()
      let x = Math.random() * w, y = Math.random() * h
      ctx.moveTo(x, y)
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.3) * 40; y += (Math.random() - 0.5) * 40; ctx.lineTo(x, y) }
      ctx.stroke()
    }
  })
}

function ceilingTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#cfc6b4'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)
    noise(ctx, w, h, 0.05, 400)
  })
}

function wainscotTex() {
  return canvasTex(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#3a2416'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#2c1a0f'
    for (let x = 12; x < w; x += 128) ctx.fillRect(x, 20, 104, h - 44)
    ctx.fillStyle = '#4a2f1d'
    for (let x = 18; x < w; x += 128) ctx.fillRect(x, 26, 92, h - 56)
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(0, 0, w, 8)
  })
}

function booksTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2a170c'; ctx.fillRect(0, 0, w, h)
    const shelfH = h / 5
    const colors = ['#7a1f1f', '#1f4a7a', '#2f6a2f', '#7a6a1f', '#5a2a6a', '#8a4a1a', '#1a5a5a', '#6a6a6a', '#9a8a6a']
    for (let s = 0; s < 5; s++) {
      const y0 = s * shelfH
      let x = 6
      while (x < w - 10) {
        const bw = 10 + Math.random() * 16
        const bh = shelfH * (0.6 + Math.random() * 0.32)
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
        ctx.fillRect(x, y0 + shelfH - bh - 6, bw - 2, bh)
        ctx.fillStyle = 'rgba(255,220,140,0.35)'
        ctx.fillRect(x + 2, y0 + shelfH - bh + 6, bw - 6, 3)
        x += bw
      }
      ctx.fillStyle = '#4a2c18'; ctx.fillRect(0, y0 + shelfH - 6, w, 6)
    }
  }, false)
}

function bandageTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8ccaa'; ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 14) {
      ctx.fillStyle = 'rgba(120,100,70,0.45)'
      ctx.save(); ctx.translate(0, y); ctx.rotate(-0.12); ctx.fillRect(-10, 0, w + 20, 2); ctx.restore()
    }
    noise(ctx, w, h, 0.08, 400)
  })
}

function scarfTex() {
  return canvasTex(64, 64, (ctx, w, h) => {
    const cols = ['#c0303a', '#f2f0e8', '#2e6ab0', '#e8b030']
    for (let i = 0; i < 8; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(i * 8, 0, 8, h) }
  })
}

// A handful of hotel paintings, plus "Employee of the Month" plaques for
// the staff you're about to meet.
const EMPLOYEES = [['🐺', 'Barry'], ['🦋', 'Pale Steve'], ['🧛', 'Drakko'], ['🩹', 'Wendell'], ['🧟', 'Gary'], ['🛡️', 'Sir Reginald']]
function paintingTextures() {
  const out = []
  out.push(canvasTex(256, 200, (ctx, w, h) => { // sunset over hills
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2a65a'); g.addColorStop(1, '#c2456a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffd88a'; ctx.beginPath(); ctx.arc(w * 0.6, h * 0.55, 30, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#4a2a4a'; ctx.beginPath(); ctx.moveTo(0, h); ctx.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.8); ctx.quadraticCurveTo(w * 0.8, h * 0.6, w, h * 0.75); ctx.lineTo(w, h); ctx.fill()
  }, false))
  out.push(canvasTex(256, 200, (ctx, w, h) => { // a bowl of fruit
    ctx.fillStyle = '#2a3a2a'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.72, 80, 26, 0, 0, Math.PI); ctx.fill()
    const fr = [['#d03030', 100, 120], ['#e0c020', 140, 112], ['#40a040', 120, 98], ['#a040a0', 160, 128]]
    fr.forEach(([c, x, y]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill() })
  }, false))
  out.push(canvasTex(256, 200, (ctx, w, h) => { // "hang in there" kitten
    ctx.fillStyle = '#7ab0d8'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(40, 30, w - 80, 8)
    ctx.font = '70px serif'; ctx.textAlign = 'center'; ctx.fillText('🐱', w / 2, 120)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('HANG IN THERE', w / 2, 180)
  }, false))
  out.push(canvasTex(256, 200, (ctx, w, h) => { // sailboat
    ctx.fillStyle = '#8ac0e0'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#2a5a8a'; ctx.fillRect(0, h * 0.62, w, h)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(128, 40); ctx.lineTo(128, 120); ctx.lineTo(70, 120); ctx.fill()
    ctx.fillStyle = '#a04020'; ctx.fillRect(70, 122, 100, 14)
  }, false))
  EMPLOYEES.forEach(([emoji, name]) => {
    out.push(canvasTex(200, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e8dcb8'; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#b08a30'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16)
      ctx.fillStyle = '#5a3a10'; ctx.textAlign = 'center'
      ctx.font = 'bold 15px sans-serif'; ctx.fillText('EMPLOYEE', w / 2, 38); ctx.fillText('OF THE MONTH', w / 2, 56)
      ctx.font = '80px serif'; ctx.fillText(emoji, w / 2, 158)
      ctx.font = 'bold 22px serif'; ctx.fillText(name, w / 2, 210)
      ctx.font = '12px sans-serif'; ctx.fillText('(again)', w / 2, 232)
    }, false))
  })
  return out
}

// The view out the front of the hotel: a calm, moonlit night.
function outsideTex() {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7)
    sky.addColorStop(0, '#0b1640'); sky.addColorStop(1, '#4a6aa8')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.6, 2, 2)
    }
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.22, 34, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,246,216,0.15)'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.22, 70, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a3a2a'; ctx.fillRect(0, h * 0.68, w, h)
    ctx.fillStyle = '#0e2418'
    for (let x = 0; x < w; x += 70) {
      const th = 60 + Math.random() * 70
      ctx.beginPath(); ctx.moveTo(x, h * 0.7); ctx.lineTo(x + 35, h * 0.7 - th); ctx.lineTo(x + 70, h * 0.7); ctx.fill()
    }
    ctx.fillStyle = '#b8a888'
    ctx.beginPath(); ctx.moveTo(w * 0.44, h); ctx.lineTo(w * 0.49, h * 0.7); ctx.lineTo(w * 0.51, h * 0.7); ctx.lineTo(w * 0.56, h); ctx.fill()
  }, false)
}

// ── Floor 2 (basement + mines) textures ──
function concreteBlockTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a7a76'; ctx.fillRect(0, 0, w, h)
    const bh = 64, bw = 128
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0
      for (let x = -bw; x < w + bw; x += bw) {
        ctx.fillStyle = `rgb(${110 + Math.random() * 20},${110 + Math.random() * 18},${104 + Math.random() * 16})`
        ctx.fillRect(x + off + 3, y + 3, bw - 6, bh - 6)
      }
    }
    noise(ctx, w, h, 0.08, 1500)
    ctx.fillStyle = 'rgba(60,70,50,0.25)'; ctx.fillRect(0, h - 30, w, 30) // damp at the bottom
  })
}
function rockTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a4634'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${50 + Math.random() * 30},0.6)`
      ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 8 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2); ctx.fill()
    }
    noise(ctx, w, h, 0.12, 2000)
  })
}
function concreteFloorTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a6a68'; ctx.fillRect(0, 0, w, h)
    noise(ctx, w, h, 0.1, 3000)
    ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(40,40,40,0.18)'; ctx.beginPath(); ctx.ellipse(170, 90, 40, 22, 0.4, 0, Math.PI * 2); ctx.fill()
  })
}
function dirtTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a3624'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(30,20,10,0.4)' : 'rgba(120,95,70,0.35)'; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3) }
    for (let i = 0; i < 25; i++) { ctx.fillStyle = 'rgba(140,130,120,0.6)'; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, Math.PI * 2); ctx.fill() }
  })
}
function brickTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a2420'; ctx.fillRect(0, 0, w, h)
    const bh = 32, bw = 64
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0
      for (let x = -bw; x < w + bw; x += bw) {
        ctx.fillStyle = `rgb(${120 + Math.random() * 40},${50 + Math.random() * 20},${36 + Math.random() * 16})`
        ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4)
      }
    }
    noise(ctx, w, h, 0.1, 1500)
  })
}
// ── Floor 3 (attic) textures ──
function atticPlankTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const browns = ['#6a4a30', '#5e4128', '#735236', '#634530']
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = browns[(x / 32) % browns.length]
      ctx.fillRect(x, 0, 32, h)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, 0, 2, h)
      for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x + 4 + Math.random() * 24, 0, 1, h) }
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(x + 16, 30 + Math.random() * 200, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    noise(ctx, w, h, 0.1, 1500)
    ctx.fillStyle = 'rgba(200,190,170,0.08)'; ctx.fillRect(0, 0, w, h) // dust
  })
}

// ── Floor 4 (garden) textures ──
function hedgeTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#16301a'; ctx.fillRect(0, 0, w, h)
    const greens = ['#1f4a24', '#2a5a2c', '#183c1c', '#335f30', '#244e26']
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)]
      const x = Math.random() * w, y = Math.random() * h, r = 3 + Math.random() * 6
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2); ctx.fill()
    }
    for (let i = 0; i < 18; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#b02040' : '#e8e0f0'; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2.5, 0, Math.PI * 2); ctx.fill() } // a few roses
  })
}
function grassTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1c3a1a'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2200; i++) {
      ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(70,120,50,0.6)' : 'rgba(20,50,20,0.6)'
      const x = Math.random() * w, y = Math.random() * h
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 5); ctx.stroke()
    }
  })
}
function gravelTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a645a'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(${130 + Math.random() * 60},${120 + Math.random() * 50},${100 + Math.random() * 40},0.8)`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill() }
  })
}

const POSTERS = [
  ['SAFETY', 'FIRST!', '#f0d020', '#1a1a1a'],
  ['DAYS WITHOUT', 'A SPOOK: 0', '#ffffff', '#c02020'],
  ['PLEASE DON\'T', 'FEED THE WORM', '#d0f0d0', '#2a5a2a'],
  ['LIGHTS OFF', 'BATS REHEARSING', '#2a2a4a', '#ffd84a'],
]
function posterTex([a, b, bg, fg]) {
  return canvasTex(200, 256, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20)
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.font = 'bold 24px sans-serif'
    ctx.fillText(a, w / 2, 110); ctx.fillText(b, w / 2, 150)
  }, false)
}

function exitSignTex() {
  return canvasTex(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#0c3a18'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#6dff8c'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('EXIT', w / 2, h / 2 + 4)
  }, false)
}

function numberPlateMat(num) {
  const t = canvasTex(256, 120, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#f0cf70'); g.addColorStop(0.5, '#c99a3a'); g.addColorStop(1, '#a87a28')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#6a4a14'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = '#3a2408'; ctx.font = 'bold 78px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(num).padStart(3, '0'), w / 2, h / 2 + 4)
  }, false)
  return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.3 })
}

export function createAssets() {
  const mats = []
  const texes = []
  const track = (m) => { mats.push(m); return m }
  const tex = (t) => { texes.push(t); return t }
  const wallMats = new Map()
  const a = {
    wallMat(p) {
      if (!wallMats.has(p)) wallMats.set(p, track(new THREE.MeshStandardMaterial({ map: tex(wallpaper(p)), roughness: 0.9 })))
      return wallMats.get(p)
    },
    wood: track(new THREE.MeshStandardMaterial({ map: tex(woodFloor()), roughness: 0.7 })),
    carpets: [
      track(new THREE.MeshStandardMaterial({ map: tex(carpet('#6a1a1a', '#c08a2a', '#2a0a0a')), roughness: 1 })),
      track(new THREE.MeshStandardMaterial({ map: tex(carpet('#1a3a4a', '#c0a040', '#0a1a2a')), roughness: 1 })),
      track(new THREE.MeshStandardMaterial({ map: tex(carpet('#3a1a4a', '#d08a3a', '#1a0a2a')), roughness: 1 })),
    ],
    haltCarpet: track(new THREE.MeshStandardMaterial({ map: tex(carpet('#16304a', '#5a90c0', '#0a1626')), roughness: 1 })),
    marble: track(new THREE.MeshStandardMaterial({ map: tex(marble()), roughness: 0.35 })),
    ceiling: track(new THREE.MeshStandardMaterial({ map: tex(ceilingTex()), roughness: 1 })),
    wainscot: track(new THREE.MeshStandardMaterial({ map: tex(wainscotTex()), roughness: 0.7 })),
    darkWood: track(new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.6 })),
    midWood: track(new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.6 })),
    lightWood: track(new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.6 })),
    brass: track(new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.8 })),
    white: track(new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.9 })),
    velvet: track(new THREE.MeshStandardMaterial({ color: 0x8a1a2a, roughness: 0.95 })),
    velvetGreen: track(new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.95 })),
    blanketMats: [0x2a4a8a, 0x8a2a3a, 0x2a6a4a, 0x8a6a2a].map(c => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }))),
    pot: track(new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.8 })),
    leaf: track(new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.8 })),
    books: track(new THREE.MeshStandardMaterial({ map: tex(booksTex()), roughness: 0.9 })),
    page: track(new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd88a, emissiveIntensity: 0.9, side: THREE.DoubleSide })),
    rope: track(new THREE.MeshStandardMaterial({ color: 0xb01a2a, roughness: 0.8 })),
    eyeWhite: track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })),
    pupil: track(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })),
    outside: track(new THREE.MeshBasicMaterial({ map: tex(outsideTex()), fog: false })),
    exitSign: track(new THREE.MeshBasicMaterial({ map: tex(exitSignTex()) })),
    paintings: paintingTextures().map(t => track(new THREE.MeshStandardMaterial({ map: tex(t), roughness: 0.8 }))),
    concreteWall: track(new THREE.MeshStandardMaterial({ map: tex(concreteBlockTex()), roughness: 0.95 })),
    rockWall: track(new THREE.MeshStandardMaterial({ map: tex(rockTex()), roughness: 1 })),
    brickWall: track(new THREE.MeshStandardMaterial({ map: tex(brickTex()), roughness: 0.95 })),
    concreteFloor: track(new THREE.MeshStandardMaterial({ map: tex(concreteFloorTex()), roughness: 0.9 })),
    dirt: track(new THREE.MeshStandardMaterial({ map: tex(dirtTex()), roughness: 1 })),
    metal: track(new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.5, metalness: 0.3 })),
    metalDark: track(new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.6, metalness: 0.3 })),
    lockerGreen: track(new THREE.MeshStandardMaterial({ color: 0x5a7a6a, roughness: 0.55, metalness: 0.25 })),
    pipe: track(new THREE.MeshStandardMaterial({ color: 0xb06a3a, roughness: 0.45, metalness: 0.4 })),
    rust: track(new THREE.MeshStandardMaterial({ color: 0x8a3a24, roughness: 0.7, metalness: 0.3 })),
    valveRed: track(new THREE.MeshStandardMaterial({ color: 0xd02a2a, roughness: 0.4 })),
    valveGreen: track(new THREE.MeshStandardMaterial({ color: 0x2ad04a, roughness: 0.4, emissive: 0x0a4a14 })),
    furnace: track(new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.6 })),
    crate: track(new THREE.MeshStandardMaterial({ color: 0x9a7444, roughness: 0.8 })),
    hedge: track(new THREE.MeshStandardMaterial({ map: tex(hedgeTex()), roughness: 1 })),
    grass: track(new THREE.MeshStandardMaterial({ map: tex(grassTex()), roughness: 1 })),
    gravel: track(new THREE.MeshStandardMaterial({ map: tex(gravelTex()), roughness: 1 })),
    stone: track(new THREE.MeshStandardMaterial({ color: 0x7a7a72, roughness: 0.95 })),
    shedWood: track(new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 0.8 })),
    roofRed: track(new THREE.MeshStandardMaterial({ color: 0x6a2a20, roughness: 0.8 })),
    flowers: [0xe02a5a, 0xffd84a, 0xb04ae0, 0xffffff, 0xff8a2a].map(c => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }))),
    fire: track(new THREE.MeshBasicMaterial({ color: 0xffa030 })),
    fireCore: track(new THREE.MeshBasicMaterial({ color: 0xfff0a0 })),
    vine: track(new THREE.MeshStandardMaterial({ color: 0x1a2a10, roughness: 0.9 })),
    atticWall: track(new THREE.MeshStandardMaterial({ map: tex(atticPlankTex()), roughness: 0.95 })),
    dustSheet: track(new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 1 })),
    cobweb: track(new THREE.MeshBasicMaterial({ color: 0xe8e8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })),
    moonlight: track(new THREE.MeshBasicMaterial({ color: 0x9ab8e8 })),
    posters: POSTERS.map(pz => track(new THREE.MeshStandardMaterial({ map: tex(posterTex(pz)), roughness: 0.8 }))),
    bandage: tex(bandageTex()),
    scarf: tex(scarfTex()),
    dispose() { mats.forEach(m => m.dispose()); texes.forEach(t => t.dispose()) },
  }
  a.wallMat(HALT_PALETTE)
  return a
}

// ── Geometry helpers ────────────────────────────────────────────────────

// A box positioned in world space whose UVs come from world coordinates,
// so tiled textures line up across neighbouring boxes.
export function worldBox(w, h, d, x, y, z, mat, scale = 1.2) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), nz = Math.abs(nor.getZ(i))
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i)
    let u, v
    if (nx > 0.5) { u = pz; v = py } else if (nz > 0.5) { u = px; v = py } else { u = px; v = pz }
    uv.setXY(i, u / scale, v / scale)
  }
  return new THREE.Mesh(g, mat)
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

// ── Furniture (local frame: length along X, depth along Z, front = +Z) ──

function buildCloset(f, A) {
  const g = new THREE.Group()
  const { len, depth, h } = f
  g.add(box(len, h, depth, A.darkWood, 0, h / 2, 0))
  g.add(box(len + 0.08, 0.1, depth + 0.08, A.midWood, 0, h + 0.05, 0))
  for (const sx of [-1, 1]) {
    g.add(box(len / 2 - 0.05, h - 0.2, 0.03, A.midWood, sx * len / 4, h / 2, depth / 2 + 0.015))
    for (let k = 0; k < 7; k++) g.add(box(len / 2 - 0.15, 0.025, 0.02, A.darkWood, sx * len / 4, 0.35 + k * 0.2, depth / 2 + 0.035))
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), A.brass)
    knob.position.set(sx * 0.07, h * 0.5, depth / 2 + 0.05)
    g.add(knob)
  }
  return g
}

function buildDresserBody(f, A) {
  const g = new THREE.Group()
  g.add(box(f.len, f.h, f.depth, A.midWood, 0, f.h / 2, 0))
  g.add(box(f.len + 0.06, 0.05, f.depth + 0.04, A.darkWood, 0, f.h + 0.025, 0))
  if (f.kind === 'nightstand') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.25, 10), A.brass).translateY(f.h + 0.17))
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.18, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc070, emissiveIntensity: 0.8, side: THREE.DoubleSide }))
    shade.userData.ownMaterial = true
    shade.position.y = f.h + 0.36
    g.add(shade)
  } else {
    // a little vase on top
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.28, 10), A.white).translateY(f.h + 0.19).translateX(0.3))
  }
  return g
}

function buildBed(f, A, rng) {
  const g = new THREE.Group()
  const W = f.len, L = f.depth
  g.add(box(W, 0.3, L, A.darkWood, 0, 0.15, 0))
  g.add(box(W - 0.06, 0.2, L - 0.1, A.white, 0, 0.4, 0.02))
  g.add(box(W - 0.02, 0.06, L * 0.62, A.blanketMats[Math.floor(rng() * A.blanketMats.length)], 0, 0.52, L * 0.18))
  g.add(box(W * 0.7, 0.12, 0.35, A.white, 0, 0.56, -L / 2 + 0.3))
  g.add(box(W + 0.06, 1.1, 0.08, A.darkWood, 0, 0.55, -L / 2 + 0.04))
  return g
}

function buildPlant(f, A) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 12), A.pot).translateY(0.2))
  for (let k = 0; k < 6; k++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), A.leaf)
    const a = k * 1.05
    leaf.scale.set(0.6, 1.8, 0.6)
    leaf.position.set(Math.cos(a) * 0.12, 0.7 + (k % 2) * 0.2, Math.sin(a) * 0.12)
    leaf.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5)
    g.add(leaf)
  }
  return g
}

function buildChair(f, A, green) {
  const g = new THREE.Group()
  const mat = green ? A.velvetGreen : A.velvet
  const W = f.len, D = f.depth
  g.add(box(W, 0.42, D, mat, 0, 0.21, 0))
  g.add(box(W, 0.55, 0.16, mat, 0, 0.62, -D / 2 + 0.08))
  for (const sx of [-1, 1]) g.add(box(0.14, 0.25, D, mat, sx * (W / 2 - 0.07), 0.5, 0))
  return g
}

function buildShelf(f, A) {
  const g = new THREE.Group()
  const mats = [A.darkWood, A.darkWood, A.darkWood, A.darkWood, A.books, A.books]
  const m = new THREE.Mesh(new THREE.BoxGeometry(f.len, f.h, f.depth), mats)
  m.position.y = f.h / 2
  g.add(m)
  g.add(box(f.len + 0.06, 0.06, f.depth + 0.06, A.midWood, 0, f.h + 0.03, 0))
  return g
}

function buildToppled(f, A, rng) {
  const g = new THREE.Group()
  const mats = [A.darkWood, A.darkWood, A.books, A.darkWood, A.darkWood, A.darkWood]
  const m = new THREE.Mesh(new THREE.BoxGeometry(f.len, 0.6, f.depth), mats)
  m.position.y = 0.3
  m.rotation.y = (rng() - 0.5) * 0.12
  g.add(m)
  const cols = [0x7a1f1f, 0x1f4a7a, 0x2f6a2f, 0x7a6a1f]
  for (let k = 0; k < 5; k++) {
    const b = box(0.22, 0.05, 0.3, new THREE.MeshStandardMaterial({ color: cols[k % 4] }), (rng() - 0.5) * f.len, 0.65 + k * 0.01, (rng() - 0.5) * 0.4)
    b.userData.ownMaterial = true
    b.rotation.y = rng() * 3
    g.add(b)
  }
  return g
}

// Gloria's counter: front faces local +Z.
function buildCounter(f, A) {
  const g = new THREE.Group()
  g.add(box(f.len, f.h, f.depth, A.midWood, 0, f.h / 2, 0))
  g.add(box(f.len + 0.1, 0.06, f.depth + 0.1, A.brass, 0, f.h + 0.03, 0))
  for (let k = -1; k <= 1; k++) g.add(box(1.1, 0.6, 0.02, A.darkWood, k * 1.3, 0.5, f.depth / 2 + 0.01))
  const register = box(0.4, 0.28, 0.3, new THREE.MeshStandardMaterial({ color: 0x3a8a7a, roughness: 0.5 }), -1.2, f.h + 0.2, 0)
  register.userData.ownMaterial = true
  g.add(register)
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), A.brass)
  bell.position.set(0.9, f.h + 0.06, 0.15)
  g.add(bell)
  return g
}

// A souvenir shelf: front faces local +Z, three shelves of colorful junk.
function buildGiftShelf(f, A, rng) {
  const g = new THREE.Group()
  g.add(box(f.len, f.h, 0.08, A.darkWood, 0, f.h / 2, -f.depth / 2 + 0.04))
  for (const sx of [-1, 1]) g.add(box(0.06, f.h, f.depth, A.darkWood, sx * (f.len / 2 - 0.03), f.h / 2, 0))
  const cols = [0xff6a9a, 0x6ad0ff, 0xffd84a, 0x8aff8a, 0xc08aff, 0xff9a4a]
  for (const y of [0.35, 0.95, 1.55]) {
    g.add(box(f.len, 0.04, f.depth, A.midWood, 0, y - 0.02, 0))
    for (let x = -f.len / 2 + 0.2; x < f.len / 2 - 0.15; x += 0.28) {
      const mat = new THREE.MeshStandardMaterial({ color: cols[Math.floor(rng() * cols.length)], roughness: 0.5 })
      const r = rng()
      const item = r < 0.4 ? new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat)
        : r < 0.7 ? new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.12), mat)
          : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 10), mat)
      item.userData.ownMaterial = true
      item.position.set(x, y + 0.12, 0.05)
      g.add(item)
    }
  }
  return g
}

function giftSignTex() {
  return canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffe3ef'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d04a8a'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#c0306a'; ctx.font = 'bold 64px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🛍️ GIFT SHOP', w / 2, h / 2 + 4)
  }, false)
}

function buildDesk(f, A) {
  const g = new THREE.Group()
  g.add(box(f.len, 0.08, f.depth, A.darkWood, 0, f.h, 0))
  for (const sx of [-1, 1]) g.add(box(0.5, f.h, f.depth - 0.1, A.midWood, sx * (f.len / 2 - 0.25), f.h / 2, 0))
  g.add(box(0.3, 0.05, 0.22, A.white, -0.3, f.h + 0.065, 0.1)) // papers
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.14, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a8a4a, emissive: 0xffd890, emissiveIntensity: 0.5, side: THREE.DoubleSide }))
  lamp.userData.ownMaterial = true
  lamp.position.set(0.6, f.h + 0.35, 0)
  g.add(lamp)
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), A.brass).translateX(0.6).translateY(f.h + 0.16))
  return g
}

// The secret room behind a gift-shop shelf: floor, ceiling, lintel over the
// gap, a hidden "???" door, a rug, and a portrait or two.
function addSecretRoom(room, group, A, extra) {
  const sec = room.secret
  const { hw } = room
  const w = sec.x1 - sec.x0 + T, cx = (hw + sec.x1 + T) / 2
  group.add(worldBox(sec.x1 + T - hw, 0.1, sec.zB - sec.zA + 2 * T, cx, -0.05, sec.z, A.carpets[2], 1.2))
  group.add(worldBox(sec.x1 + T - hw, 0.1, sec.zB - sec.zA + 2 * T, cx, ROOM_H + 0.05, sec.z, A.ceiling, 1.5))
  group.add(worldBox(T, ROOM_H - GAP_H, GAP_HALF * 2, hw + T / 2, (ROOM_H + GAP_H) / 2, sec.z, extra.wallMat))
  const rug = worldBox(w - 1.5, 0.02, 3, (sec.x0 + sec.x1) / 2, 0.01, sec.z, A.carpets[0], 1.2)
  group.add(rug)
  const door = new THREE.Group()
  door.add(buildClosedDoor(0, 0, A, '???'))
  door.position.set(hw + T / 2, 0, sec.z)
  door.rotation.y = -Math.PI / 2 // number plate faces back into the shop
  group.add(door)
  extra.secretDoor = door
  // a gold "STAFF ONLY" plaque on the inside wall + a portrait
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), A.paintings[4 + (room.index === 20 ? 2 : 4)])
  art.position.set(sec.x1 - 0.02, 1.8, sec.z - 1.5)
  art.rotation.y = -Math.PI / 2
  group.add(art)
  group.add(box(0.05, 0.9, 0.72, A.brass, sec.x1 - 0.01, 1.8, sec.z - 1.5))
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), A.paintings[5]).translateX(sec.x1 - 0.02).translateY(1.8).translateZ(sec.z + 1.5).rotateY(-Math.PI / 2))
}

// A pair of closed hotel doors filling an opening (or set against a wall).
function buildClosedDoor(x, z, A, num) {
  const g = new THREE.Group()
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group()
    leaf.add(box(GAP_HALF - 0.01, GAP_H - 0.02, 0.06, A.midWood, 0, (GAP_H - 0.02) / 2, 0))
    for (const face of [-1, 1]) for (const py of [0.6, 1.65]) leaf.add(box(GAP_HALF - 0.22, 0.75, 0.02, A.darkWood, 0, py, face * 0.035))
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), A.brass)
    knob.position.set(-sx * (GAP_HALF / 2 - 0.1), 1.0, 0.06)
    leaf.add(knob)
    leaf.position.set(x + sx * GAP_HALF / 2, 0, z)
    g.add(leaf)
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), numberPlateMat(num))
  plate.userData.ownMaterial = true
  plate.position.set(x, 1.55, z + 0.05)
  g.add(plate)
  return g
}

// ── Floor 2 furniture: same footprints as Floor 1 (same collision), new look ──
function buildLocker(f, A) {
  const g = new THREE.Group()
  const { len, depth, h } = f
  g.add(box(len, h, depth, A.lockerGreen, 0, h / 2, 0))
  for (const sx of [-1, 1]) {
    g.add(box(len / 2 - 0.04, h - 0.1, 0.02, A.lockerGreen, sx * len / 4, h / 2, depth / 2 + 0.01))
    for (let k = 0; k < 4; k++) g.add(box(len / 2 - 0.2, 0.02, 0.02, A.metalDark, sx * len / 4, h - 0.25 - k * 0.07, depth / 2 + 0.025))
    g.add(box(0.03, 0.15, 0.03, A.metal, sx * 0.07, h * 0.5, depth / 2 + 0.03))
  }
  return g
}
function buildCabinet(f, A) {
  const g = new THREE.Group()
  g.add(box(f.len, f.h, f.depth, A.metalDark, 0, f.h / 2, 0))
  g.add(box(f.len + 0.02, 0.03, f.depth + 0.02, A.metal, 0, f.h + 0.015, 0))
  if (f.kind === 'nightstand') g.add(box(0.3, 0.12, 0.2, A.valveRed, 0, f.h + 0.07, 0)) // a toolbox on top
  return g
}
function buildCrates(f, A, rng) {
  const g = new THREE.Group()
  const W = f.len, L = f.depth
  g.add(box(W, 0.6, L * 0.48, A.crate, 0, 0.3, -L * 0.25))
  g.add(box(W * 0.9, 0.55, L * 0.45, A.crate, (rng() - 0.5) * 0.1, 0.28, L * 0.26))
  g.add(box(W * 0.6, 0.45, L * 0.35, A.crate, (rng() - 0.5) * 0.3, 0.83, -L * 0.2))
  for (const z of [-L * 0.25, L * 0.26]) g.add(box(W + 0.01, 0.06, 0.06, A.darkWood, 0, 0.3, z))
  return g
}
function buildBarrel(f, A) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.85, 14), A.rust).translateY(0.425))
  for (const y of [0.15, 0.7]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.02, 6, 18), A.metalDark).rotateX(Math.PI / 2).translateZ(-y))
  return g
}
function buildWasher(f, A) {
  const g = new THREE.Group()
  g.add(box(f.len, f.h, f.depth, A.white, 0, f.h / 2, 0))
  const door = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20), A.metal)
  door.position.set(0, f.h * 0.48, f.depth / 2 + 0.02); g.add(door)
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.2 }))
  glass.userData.ownMaterial = true
  glass.position.set(0, f.h * 0.48, f.depth / 2 + 0.015); g.add(glass)
  g.add(box(f.len - 0.1, 0.1, 0.02, A.metal, 0, f.h - 0.08, f.depth / 2 + 0.01))
  return g
}
function buildBoilerMesh(f, A) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, f.depth, 24), A.rust)
  body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.74); body.position.y = 1.42
  g.add(body)
  for (const dz of [-1.8, -0.6, 0.6, 1.8]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.05, 6, 28), A.metalDark)
    band.scale.set(1, 0.74, 1); band.position.set(0, 1.42, dz); g.add(band)
  }
  // the glowing furnace hatch faces the way you came in (with a real warm glow)
  const glow = new THREE.PointLight(0xff7a30, 6, 9, 1.5)
  glow.position.set(0, 1.1, f.depth / 2 + 1.0)
  g.add(glow)
  const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), A.furnace)
  hatch.position.set(0, 1.0, f.depth / 2 + 0.02); g.add(hatch)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 22), A.metalDark); ring.position.copy(hatch.position); g.add(ring)
  for (const x of [-1.1, 1.1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 10), A.pipe).translateX(x).translateY(2.6))
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), A.white); gauge.position.set(0.9, 2.0, f.depth / 2 - 0.4); g.add(gauge)
  return g
}
function buildTank(f, A) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, f.h, 16), A.lockerGreen).translateY(f.h / 2))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), A.lockerGreen).translateY(f.h))
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), A.pipe).translateY(f.h + 0.4))
  return g
}
function buildFurniture2(f, A, rng) {
  let g
  switch (f.kind) {
    case 'closet': g = buildLocker(f, A); break
    case 'dresser': case 'nightstand': g = buildCabinet(f, A); break
    case 'bed': g = buildCrates(f, A, rng); break
    case 'plant': g = buildBarrel(f, A); break
    case 'chair': case 'sofa': g = buildWasher(f, A); break
    case 'boiler': g = buildBoilerMesh(f, A); break
    case 'tank': g = buildTank(f, A); break
    default: return buildFurniture(f, A, rng)
  }
  g.position.set(f.cx, 0, f.cz)
  if (f.faceYaw != null) g.rotation.y = f.faceYaw + Math.PI
  return g
}

// ── Floor 3 furniture: same footprints, attic junk ──
function buildDustSheetLump(f, A, rng) {
  const g = new THREE.Group()
  // something big under a dust sheet (a piano? a bed? nobody knows)
  const lump = new THREE.Mesh(new RoundedBoxGeometry(f.len, 0.9, f.depth, 3, 0.25), A.dustSheet)
  lump.position.y = 0.45; g.add(lump)
  const lump2 = new THREE.Mesh(new RoundedBoxGeometry(f.len * 0.6, 0.5, f.depth * 0.5, 3, 0.2), A.dustSheet)
  lump2.position.set((rng() - 0.5) * 0.3, 1.05, -f.depth * 0.15); g.add(lump2)
  return g
}
function buildDressForm(f, A) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), A.darkWood).translateY(0.45))
  for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5), A.darkWood); leg.position.set(Math.cos(k * 2.1) * 0.12, 0.12, Math.sin(k * 2.1) * 0.12); leg.rotation.set(Math.sin(k * 2.1) * 0.6, 0, -Math.cos(k * 2.1) * 0.6); g.add(leg) }
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), A.velvet); torso.scale.set(1, 1.5, 0.75); torso.position.y = 1.15; g.add(torso)
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), A.darkWood).translateY(1.5))
  return g
}
function buildRockingHorse(f, A) {
  const g = new THREE.Group()
  const paint = A.velvet
  for (const sx of [-1, 1]) {
    const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 20, Math.PI * 0.6), A.darkWood)
    rocker.position.set(sx * 0.15, 0.52, 0); rocker.rotation.set(0, Math.PI / 2, Math.PI * 1.2); g.add(rocker)
  }
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.25, 0.6, 2, 0.08), A.white); body.position.y = 0.45; g.add(body)
  const neck = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.35, 0.16, 2, 0.05), A.white); neck.position.set(0, 0.68, 0.25); neck.rotation.x = 0.4; g.add(neck)
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.14, 0.3, 2, 0.05), A.white); head.position.set(0, 0.85, 0.38); g.add(head)
  g.add(box(0.04, 0.3, 0.2, paint, 0, 0.78, 0.2)) // mane
  g.add(box(0.26, 0.04, 0.22, paint, 0, 0.59, 0)) // saddle
  return g
}
function buildFurniture3(f, A, rng) {
  let g
  switch (f.kind) {
    case 'bed': g = buildDustSheetLump(f, A, rng); break
    case 'plant': g = buildDressForm(f, A); break
    case 'chair': case 'sofa': g = buildRockingHorse(f, A); break
    default: return buildFurniture(f, A, rng)
  }
  g.position.set(f.cx, 0, f.cz)
  if (f.faceYaw != null) g.rotation.y = f.faceYaw + Math.PI
  return g
}

// ── Floor 4 furniture: garden beds, benches, topiary, pots, and sheds to hide in ──
function buildFlowerbed(f, A, rng) {
  const g = new THREE.Group()
  g.add(box(f.len, 0.3, f.depth, A.stone, 0, 0.15, 0))
  g.add(box(f.len - 0.12, 0.06, f.depth - 0.12, A.dirt, 0, 0.3, 0))
  for (let k = 0; k < 14; k++) {
    const x = (rng() - 0.5) * (f.len - 0.3), z = (rng() - 0.5) * (f.depth - 0.3)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4), A.leaf).translateX(x).translateY(0.42).translateZ(z))
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), A.flowers[Math.floor(rng() * A.flowers.length)]).translateX(x).translateY(0.56).translateZ(z))
  }
  return g
}
function buildBench(f, A) {
  const g = new THREE.Group()
  g.add(box(f.len, 0.06, 0.45, A.midWood, 0, 0.45, 0.05))
  g.add(box(f.len, 0.4, 0.05, A.midWood, 0, 0.75, -0.2))
  for (const sx of [-1, 1]) g.add(box(0.06, 0.45, 0.45, A.metalDark, sx * (f.len / 2 - 0.1), 0.22, 0.05))
  return g
}
function buildTopiary(f, A, rng) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.4, 10), A.pot).translateY(0.2))
  const shape = rng()
  const mat = A.hedge
  if (shape < 0.4) { g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat).translateY(0.85)); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat).translateY(1.45)) }
  else if (shape < 0.7) g.add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 10), mat).translateY(1.1))
  else { // a little topiary rabbit
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), mat).translateY(0.85))
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat).translateY(1.35).translateZ(0.1))
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.25, 4, 8), mat); e.position.set(sx * 0.1, 1.68, 0.1); e.rotation.z = -sx * 0.2; g.add(e) }
  }
  return g
}
function buildShed(f, A) {
  const g = new THREE.Group()
  const { len, depth, h } = f
  g.add(box(len, h - 0.3, depth, A.shedWood, 0, (h - 0.3) / 2, 0))
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, depth * 0.75, len + 0.25, 3, 1), A.roofRed)
  roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 6; roof.position.y = h - 0.15
  g.add(roof)
  for (const sx of [-1, 1]) g.add(box(len / 2 - 0.06, h - 0.45, 0.03, A.midWood, sx * len / 4, (h - 0.3) / 2, depth / 2 + 0.015))
  g.add(box(0.3, 0.2, 0.02, A.white, 0, h - 0.6, depth / 2 + 0.04)) // "TOOLS" sign
  return g
}
function buildFurniture4(f, A, rng) {
  let g
  switch (f.kind) {
    case 'closet': g = buildShed(f, A); break
    case 'flowerbed': g = buildFlowerbed(f, A, rng); break
    case 'bench': g = buildBench(f, A); break
    case 'topiary': g = buildTopiary(f, A, rng); break
    case 'gpot': g = buildTopiary({ ...f }, A, () => 0.1); g.scale.setScalar(0.65); break
    default: return buildFurniture(f, A, rng)
  }
  g.position.set(f.cx, 0, f.cz)
  if (f.faceYaw != null) g.rotation.y = f.faceYaw + Math.PI
  return g
}

// A gravel path down the middle, a few fireflies, and — in the courtyard —
// the four braziers, the bell, a dead tree, and the vines that seal you in.
function addGardenBits(room, group, A, rng, extra) {
  const { hw, z0, z1, len } = room
  const zc = (z0 + z1) / 2
  if (room.type === 'garden') {
    const path = worldBox(1.4, 0.02, len, (room.entryX + room.exitX) / 2, 0.01, zc, A.gravel, 1.2)
    path.rotation.y = Math.atan2(room.exitX - room.entryX, len) * 0.5
    group.add(path)
  }
  extra.fireflies = []
  for (let k = 0; k < 6; k++) {
    const ff = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd8ff8a }))
    ff.userData.ownMaterial = true
    ff.userData.base = new THREE.Vector3((rng() - 0.5) * hw * 1.6, 0.6 + rng() * 1.6, z1 + rng() * len)
    ff.userData.ph = rng() * 10
    group.add(ff); extra.fireflies.push(ff)
  }
  if (room.type !== 'boss') return
  extra.braziers = new Map()
  for (const it of room.interactables) {
    if (it.kind === 'brazier') {
      const b = new THREE.Group(); b.position.set(it.x, 0, it.z)
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 10), A.stone).translateY(0.45))
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.3, 14), A.metalDark).translateY(1.05))
      const fire = new THREE.Group(); fire.position.y = 1.2
      for (let k = 0; k < 5; k++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14 - k * 0.015, 0.6 + (k % 2) * 0.25, 7), k % 2 ? A.fire : A.fireCore); fl.position.set(Math.cos(k * 1.3) * 0.15, 0.25, Math.sin(k * 1.3) * 0.15); fire.add(fl) }
      fire.visible = false
      b.add(fire)
      const glow = new THREE.PointLight(0xff8a30, 0, 9, 1.6); glow.position.y = 1.6; b.add(glow)
      group.add(b)
      extra.braziers.set(it.id, { fire, glow })
    }
  }
  const bell = new THREE.Group(); bell.position.set(room.bell.x, 0, room.bell.z)
  bell.add(box(0.12, 2.4, 0.12, A.darkWood, 0, 1.2, 0))
  bell.add(box(0.7, 0.1, 0.1, A.darkWood, -0.3, 2.35, 0))
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 0.32, 14, 1, true), A.brass); cup.position.set(-0.55, 2.1, 0); bell.add(cup)
  group.add(bell)
  extra.bell = cup
  // a dead, twisted tree in one corner
  const tree = new THREE.Group(); tree.position.set(-hw + 2, 0, z0 - 2.5)
  tree.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 3.5, 8), A.darkWood).translateY(1.75))
  for (let k = 0; k < 5; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.6, 5), A.darkWood); br.position.set(Math.cos(k * 1.3) * 0.4, 2.8 + k * 0.15, Math.sin(k * 1.3) * 0.4); br.rotation.set(Math.sin(k) * 0.9, 0, Math.cos(k * 1.3) * 0.9); tree.add(br) }
  group.add(tree)
  // the thorny vines that grow over the way you came in
  const vines = new THREE.Group()
  for (let k = 0; k < 9; k++) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.5 + (k % 3) * 0.25, 0.05, 6, 16, Math.PI * 1.2), A.vine)
    v.position.set(room.entryX + (k - 4) * 0.18, 0.4 + (k % 4) * 0.5, z0 - 0.1)
    v.rotation.set(0, 0, k * 0.9)
    vines.add(v)
    for (let j = 0; j < 4; j++) vines.add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), A.vine).translateX(v.position.x + Math.cos(j * 1.6 + k) * 0.5).translateY(v.position.y + Math.sin(j * 1.6 + k) * 0.5).translateZ(z0 - 0.1))
  }
  vines.visible = false
  group.add(vines)
  extra.vines = vines
}

// Rafters, cobwebs in the corners, and a moonlit skylight.
function addAtticBits(room, group, A, rng) {
  const { hw, z0, z1, len } = room
  const zc = (z0 + z1) / 2
  for (let z = z0 - 1; z > z1 + 0.3; z -= 2.5) group.add(box(hw * 2, 0.16, 0.16, A.darkWood, 0, ROOM_H - 0.12, z))
  group.add(box(0.2, 0.2, len, A.darkWood, 0, ROOM_H - 0.3, zc))
  const web = new THREE.Shape()
  web.moveTo(0, 0); web.lineTo(0.7, 0); web.quadraticCurveTo(0.35, 0.1, 0, 0.7); web.lineTo(0, 0)
  const webGeo = new THREE.ShapeGeometry(web)
  for (const [x, z, ry] of [[-hw, z0, 0], [hw, z0, -Math.PI / 2], [-hw, z1, Math.PI / 2], [hw, z1, Math.PI]]) {
    if (rng() < 0.4) continue
    const m = new THREE.Mesh(webGeo, A.cobweb)
    m.position.set(x + (x < 0 ? 0.02 : -0.02), ROOM_H - 0.02, z + (z === z0 ? -0.02 : 0.02))
    m.rotation.set(-Math.PI / 4, ry, 0)
    group.add(m)
  }
  if (!room.dark && rng() < 0.6) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), A.moonlight)
    sky.rotation.x = Math.PI / 2
    sky.position.set((rng() - 0.5) * hw, ROOM_H - 0.005, zc + (rng() - 0.5) * len * 0.4)
    group.add(sky)
    group.add(box(1.5, 0.06, 0.06, A.darkWood, sky.position.x, ROOM_H - 0.03, sky.position.z))
  }
}

// Pipes, mine supports, rails, dirt mounds, valves and the elevator itself.
function addFloor2Bits(room, group, A, rng, extra) {
  const { hw, z0, z1, len } = room
  const zc = (z0 + z1) / 2
  if (room.theme !== 'mine' && room.type !== 'elevator') {
    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 10), sx < 0 ? A.pipe : A.metal)
      pipe.rotation.x = Math.PI / 2; pipe.position.set(sx * (hw - 0.35), ROOM_H - 0.2, zc)
      group.add(pipe)
    }
  }
  if (room.theme === 'mine') {
    for (let z = z0 - 1.5; z > z1 + 0.5; z -= 3) {
      for (const sx of [-1, 1]) group.add(box(0.2, ROOM_H, 0.2, A.darkWood, sx * (hw - 0.1), ROOM_H / 2, z))
      group.add(box(hw * 2, 0.2, 0.22, A.darkWood, 0, ROOM_H - 0.1, z))
    }
    // rail tracks down the middle
    for (const sx of [-1, 1]) group.add(box(0.05, 0.06, len, A.metal, sx * 0.45, 0.04, zc))
    for (let z = z0 - 0.3; z > z1; z -= 0.6) group.add(box(1.2, 0.04, 0.16, A.darkWood, 0, 0.02, z))
  }
  // Doug's dirt mounds
  if (room.mounds) {
    extra.mounds = room.mounds.map(m => {
      const g = new THREE.Group()
      const hill = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), A.dirt)
      hill.scale.y = 0.35
      g.add(hill)
      for (let k = 0; k < 5; k++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05 + rng() * 0.04, 6, 4), A.metal).translateX((rng() - 0.5) * 0.9).translateZ((rng() - 0.5) * 0.9))
      g.position.set(m.x, 0, m.z)
      group.add(g)
      return { mesh: g, data: m }
    })
  }
  // valves (boiler room)
  extra.valves = new Map()
  for (const it of room.interactables) {
    if (it.kind !== 'valve') continue
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), A.pipe).rotateZ(Math.PI / 2).translateY(-it.face * 0.15))
    const wheel = new THREE.Group()
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), A.valveRed))
    for (let k = 0; k < 3; k++) wheel.add(box(0.4, 0.03, 0.03, A.valveRed).rotateZ(k * Math.PI / 3))
    wheel.rotation.y = Math.PI / 2
    wheel.position.x = it.face * 0.02
    g.add(wheel)
    g.position.set(it.x, it.y, it.z)
    group.add(g)
    extra.valves.set(it.id, wheel)
  }
  // the elevator: steel box, a button panel, and sliding doors at both ends
  if (room.type === 'elevator') {
    const panel = box(0.04, 0.6, 0.3, A.metalDark, hw - 0.03, 1.3, zc)
    group.add(panel)
    for (let k = 0; k < 3; k++) {
      const btn = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), k === 2 ? A.furnace : A.white) // B1 is lit
      btn.position.set(hw - 0.055, 1.45 - k * 0.15, zc)
      btn.rotation.y = -Math.PI / 2
      group.add(btn)
    }
    const doorPair = (x, z) => {
      const pair = []
      for (const sx of [-1, 1]) {
        const d = box(GAP_HALF, GAP_H, 0.06, A.metal, x + sx * GAP_HALF / 2, GAP_H / 2, z)
        d.userData.baseX = d.position.x
        d.userData.sx = sx
        group.add(d)
        pair.push(d)
      }
      return pair
    }
    extra.elevFront = doorPair(room.exitX, z1 - T / 2)
    extra.elevBack = doorPair(room.entryX, z0 - 0.08)
  }
}

function buildFurniture(f, A, rng) {
  let g
  switch (f.kind) {
    case 'closet': g = buildCloset(f, A); break
    case 'dresser': case 'nightstand': g = buildDresserBody(f, A); break
    case 'bed': g = buildBed(f, A, rng); break
    case 'plant': g = buildPlant(f, A); break
    case 'chair': g = buildChair(f, A, false); break
    case 'sofa': g = buildChair(f, A, true); break
    case 'shelf': g = buildShelf(f, A); break
    case 'toppled': g = buildToppled(f, A, rng); break
    case 'counter': g = buildCounter(f, A); break
    case 'giftshelf': g = buildGiftShelf(f, A, rng); break
    case 'desk': g = buildDesk(f, A); break
    case 'candletable': {
      g = new THREE.Group()
      g.add(box(f.len, 0.06, f.depth, A.darkWood, 0, f.h, 0))
      for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) g.add(box(0.06, f.h, 0.06, A.darkWood, x, f.h / 2, z))
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 10), A.white).translateY(f.h + 0.14))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), A.fireCore).translateY(f.h + 0.28))
      const candle = new THREE.PointLight(0xffb060, 3.5, 6, 1.6); candle.position.y = f.h + 0.35; g.add(candle)
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), A.white).translateX(0.45).translateY(f.h + 0.07)) // a teacup
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), A.white).translateX(-0.45).translateY(f.h + 0.07)) // and one for you
      break
    }
    case 'pillar': {
      g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, f.h, 12), A.white).translateY(f.h / 2))
      g.add(box(1.0, 0.2, 1.0, A.darkWood, 0, 0.1, 0))
      g.add(box(1.0, 0.2, 1.0, A.darkWood, 0, f.h - 0.1, 0))
      break
    }
    default: return null
  }
  g.position.set(f.cx, 0, f.cz)
  if (f.faceYaw != null) g.rotation.y = f.faceYaw + Math.PI
  return g
}

// Wall-mounted googly eyes. Not scary. Watching you anyway.
function buildGooglyEye(A, size) {
  const g = new THREE.Group()
  const white = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), A.eyeWhite)
  white.scale.z = 0.35
  g.add(white)
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.45, 10, 8), A.pupil)
  pupil.scale.z = 0.4
  pupil.position.z = size * 0.3
  g.add(pupil)
  g.userData.pupil = pupil
  g.userData.size = size
  return g
}

// ── Rooms ───────────────────────────────────────────────────────────────

function wallMatFor(room, A) {
  if (room.type === 'elevator') return A.metal
  if (room.floor === 13) return A.wallMat(STAFF_PALETTE)
  if (room.floor === -1) return A.wallMat(SUB_PALETTE)
  if (room.floor === 4) return A.hedge
  if (room.floor === 3) return A.atticWall
  if (room.floor === 2) {
    if (room.theme === 'mine') return A.rockWall
    if (room.theme === 'boiler') return A.brickWall
    if (room.type === 'elevator') return A.metal
    return A.concreteWall
  }
  return A.wallMat(paletteFor(room))
}

function floorMat(room, A, rng) {
  if (room.type === 'elevator') return A.metalDark
  if (room.floor === 13) return room.type === 'stampede' ? A.marble : A.carpets[0]
  if (room.floor === -1) return A.wood
  if (room.floor === 4) return room.type === 'boss' ? A.gravel : A.grass
  if (room.floor === 3) return room.type === 'shop' ? A.carpets[2] : A.wood
  if (room.floor === 2) {
    if (room.type === 'shop') return A.carpets[1]
    return room.theme === 'mine' ? A.dirt : A.concreteFloor
  }
  if (room.type === 'lobby' || room.type === 'exit') return A.marble
  if (room.type === 'halt') return A.haltCarpet
  if (room.type === 'library' || room.type === 'chase') return A.wood
  if (room.type === 'shop') return A.carpets[1]
  return rng() < 0.6 ? A.carpets[room.index % A.carpets.length] : A.wood
}

export function buildRoom(room, prev, next, A) {
  const group = new THREE.Group()
  const rng = mulberry32(room.index * 9973 + 17)
  const { hw, z0, z1, len } = room
  const zc = (z0 + z1) / 2
  const f2 = room.floor === 2 || room.type === 'elevator' // the elevator is door 050 but already looks like the basement
  const wallMat = wallMatFor(room, A)
  const nextWallMat = next ? wallMatFor(next, A) : wallMat
  const f3 = room.floor === 3 && room.type !== 'elevator' // the attic
  const f4 = room.floor === 4 && room.type !== 'elevator' // the garden: outdoors, no ceiling
  const trim = f2 ? A.metalDark : A.darkWood
  const extra = { drawers: new Map(), pages: new Map(), rope: null, fixtures: [], eyes: [], wallMat }

  // Floor + ceiling (extend under the shared wall so there's no seam).
  const floor = worldBox(hw * 2 + 2 * T, 0.1, len + T, 0, -0.05, zc - T / 2, floorMat(room, A, rng), room.type === 'lobby' || room.type === 'exit' ? 1.6 : 1.8)
  group.add(floor)
  if (!f4) group.add(worldBox(hw * 2 + 2 * T, 0.1, len + T, 0, ROOM_H + 0.05, zc - T / 2, f2 ? A.concreteFloor : f3 ? A.atticWall : A.ceiling, 1.5))

  // Walls: split the shared north wall in two half-thickness layers so
  // each side wears its own room's wallpaper.
  for (const s of room.solids) {
    if (!s.wall) continue
    const h = ROOM_H
    if (s.north) {
      group.add(worldBox(s.maxX - s.minX, h, T / 2, (s.minX + s.maxX) / 2, h / 2, z1 - T / 4, wallMat))
      group.add(worldBox(s.maxX - s.minX, h, T / 2, (s.minX + s.maxX) / 2, h / 2, z1 - 3 * T / 4, nextWallMat))
    } else {
      group.add(worldBox(s.maxX - s.minX, h, s.maxZ - s.minZ, (s.minX + s.maxX) / 2, h / 2, (s.minZ + s.maxZ) / 2, wallMat))
    }
  }
  // Lintel over the opening.
  group.add(worldBox(GAP_HALF * 2, ROOM_H - GAP_H, T / 2, room.exitX, (ROOM_H + GAP_H) / 2, z1 - T / 4, wallMat))
  group.add(worldBox(GAP_HALF * 2, ROOM_H - GAP_H, T / 2, room.exitX, (ROOM_H + GAP_H) / 2, z1 - 3 * T / 4, nextWallMat))

  // Numbered doors: a frame + brass number plate over the opening on this
  // side, and this room's own entry doors standing open against the jambs.
  if (next) {
    const num = room.index + 1
    const fz = z1 + 0.03
    for (const sx of [-1, 1]) group.add(box(0.1, GAP_H + 0.1, 0.06, trim, room.exitX + sx * (GAP_HALF + 0.05), (GAP_H + 0.1) / 2, fz))
    group.add(box(GAP_HALF * 2 + 0.2, 0.1, 0.06, trim, room.exitX, GAP_H + 0.05, fz))
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.26), numberPlateMat(num))
    plate.userData.ownMaterial = true
    plate.position.set(room.exitX, GAP_H + 0.3, z1 + 0.02)
    group.add(plate)
  }
  if (room.index > 0 && room.type !== 'elevator') {
    const num = room.index
    const leafMat = f2 ? A.metal : f4 ? A.metalDark : A.midWood
    const leaves = new THREE.Group()
    group.add(leaves)
    // Behind one of Frank's rooms these only swing open once the real door is opened.
    if (prev && prev.lockKind === 'dupe') { extra.entryLeaves = leaves; extra.entryLockRoom = prev.index }
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Group()
      leaf.add(box(0.06, GAP_H - 0.03, GAP_HALF - 0.02, leafMat, 0, (GAP_H - 0.03) / 2, 0))
      for (const face of [-1, 1]) {
        for (const py of [0.6, 1.65]) leaf.add(box(0.02, 0.75, GAP_HALF - 0.22, trim, face * 0.035, py, 0))
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), A.brass)
      knob.position.set(-sx * 0.06, 1.0, -GAP_HALF / 2 + 0.1)
      leaf.add(knob)
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), numberPlateMat(num))
      plate.userData.ownMaterial = true
      plate.position.set(-sx * 0.036, 1.95, 0)
      plate.rotation.y = -sx * Math.PI / 2
      leaf.add(plate)
      leaf.position.set(room.entryX + sx * (GAP_HALF + 0.035), 0, z0 - GAP_HALF / 2)
      leaves.add(leaf)
    }
  }

  // Frank's rooms: the real door is closed in its opening; the fake one sits
  // flat against the wall with its own frame and the wrong number.
  if (room.lockKind === 'dupe') {
    extra.closedDoor = buildClosedDoor(room.exitX, z1 - T / 2, A, room.index + 1)
    group.add(extra.closedDoor)
    const fx = room.fakeX, fz = z1 + 0.03
    group.add(buildClosedDoor(fx, z1 + 0.04, A, room.fakeNum))
    for (const sx of [-1, 1]) group.add(box(0.1, GAP_H + 0.1, 0.06, A.darkWood, fx + sx * (GAP_HALF + 0.05), (GAP_H + 0.1) / 2, fz))
    group.add(box(GAP_HALF * 2 + 0.2, 0.1, 0.06, A.darkWood, fx, GAP_H + 0.05, fz))
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.26), numberPlateMat(room.fakeNum))
    plate.userData.ownMaterial = true
    plate.position.set(fx, GAP_H + 0.3, z1 + 0.02)
    group.add(plate)
  }

  if (room.type === 'shop') {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: giftSignTex() }))
    sign.userData.ownMaterial = true
    sign.position.set(-hw + 0.02, 2.35, zc)
    sign.rotation.y = Math.PI / 2
    group.add(sign)
  }

  // Wainscoting + crown trim along the interior faces.
  const WH = 0.9
  if (room.type !== 'halt' && !f2 && !f3 && !f4) {
    group.add(worldBox(0.03, WH, len, -hw + 0.015, WH / 2, zc, A.wainscot, 1.2))
    group.add(worldBox(0.03, WH, len, hw - 0.015, WH / 2, zc, A.wainscot, 1.2))
    const ex = room.exitX, en = room.index === 0 ? null : room.entryX
    const runs = (gapX) => gapX == null ? [[-hw, hw]] : [[-hw, gapX - GAP_HALF], [gapX + GAP_HALF, hw]]
    for (const [a, b] of runs(ex)) if (b - a > 0.01) group.add(worldBox(b - a, WH, 0.03, (a + b) / 2, WH / 2, z1 + 0.015, A.wainscot, 1.2))
    for (const [a, b] of runs(en)) if (b - a > 0.01) group.add(worldBox(b - a, WH, 0.03, (a + b) / 2, WH / 2, z0 - 0.015, A.wainscot, 1.2))
  }
  if (!f2 && !f3 && !f4) {
    group.add(box(0.06, 0.08, len, A.darkWood, -hw + 0.03, ROOM_H - 0.04, zc))
    group.add(box(0.06, 0.08, len, A.darkWood, hw - 0.03, ROOM_H - 0.04, zc))
  }

  // Ceiling fixtures (purely visual; real lights come from a shared pool).
  const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffd890, emissiveIntensity: room.dark ? 0 : 1.4 })
  extra.fixtureMat = fixtureMat
  const addFixture = (x, z) => {
    const f = new THREE.Group()
    if (f4) {
      // a lantern hanging from a wire strung across the hedges
      f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, hw * 2, 4), A.metalDark).rotateZ(Math.PI / 2).translateX(ROOM_H - 0.3))
      f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 6), fixtureMat).translateY(ROOM_H - 0.55))
      f.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 6), A.metalDark).translateY(ROOM_H - 0.37))
      f.position.set(0, 0, z)
      group.add(f)
      return
    }
    if (f2 || f3) {
      // a bare bulb on a wire, in a little cage
      f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), A.metalDark).translateY(ROOM_H - 0.25))
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), fixtureMat)
      bulb.position.y = ROOM_H - 0.58
      f.add(bulb)
      const cage = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true }))
      cage.userData.ownMaterial = true
      cage.position.y = ROOM_H - 0.58
      f.add(cage)
      f.position.set(x, 0, z)
      group.add(f)
      return
    }
    f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), A.brass).translateY(ROOM_H - 0.2))
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), fixtureMat)
    bulb.position.y = ROOM_H - 0.48
    f.add(bulb)
    f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.12, 12), A.brass).translateY(ROOM_H - 0.34))
    f.position.set(x, 0, z)
    group.add(f)
  }
  if (room.type === 'halt') {
    for (let z = z0 - 2; z > z1 + 0.5; z -= 3) {
      for (const sx of [-1, 1]) {
        const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fixtureMat)
        sconce.position.set(sx * (hw - 0.12), 2.0, z)
        group.add(sconce)
        group.add(box(0.06, 0.25, 0.1, A.brass, sx * (hw - 0.03), 1.9, z))
      }
    }
  } else if (room.type === 'chase') {
    for (let z = z0 - 3.5; z > z1; z -= 7) addFixture(0, z)
  } else {
    lightSpots(room).forEach(sp => addFixture(sp.x, sp.z))
  }

  // Furniture.
  for (const f of room.furniture) {
    const g = f2 ? buildFurniture2(f, A, rng) : f3 ? buildFurniture3(f, A, rng) : f4 ? buildFurniture4(f, A, rng) : buildFurniture(f, A, rng)
    if (!g) continue
    if (f.secret) {
      // the secret shelf hangs on a hinge at its north end so it can swing open
      const pivot = new THREE.Group()
      pivot.position.set(f.cx, 0, f.cz - f.len / 2)
      g.position.set(0, 0, f.len / 2)
      pivot.add(g)
      group.add(pivot)
      extra.secretShelf = pivot
      continue
    }
    group.add(g)
  }
  if (room.secret) addSecretRoom(room, group, A, extra)

  // Drawers (separate so they can slide out).
  for (const it of room.interactables) {
    if (it.kind === 'drawer') {
      const fx = -it.side
      const d = new THREE.Group()
      d.add(box(0.05, 0.26, 0.5, f2 ? A.metal : A.lightWood))
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), A.brass)
      knob.position.x = fx * 0.04
      d.add(knob)
      d.position.set(it.x + fx * 0.025, it.y, it.z)
      group.add(d)
      extra.drawers.set(it.id, { mesh: d, baseX: d.position.x, dir: fx })
    } else if (it.kind === 'page') {
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.36), A.page)
      pg.position.set(it.x, it.y, it.z + it.face * 0.01)
      pg.rotation.y = it.face > 0 ? 0 : Math.PI
      pg.rotation.z = 0.15
      group.add(pg)
      extra.pages.set(it.id, pg)
    } else if (it.kind === 'rope') {
      extra.rope = buildRope(room, A)
      group.add(extra.rope)
    }
  }
  if (room.type === 'library' || room.type === 'boiler' || room.type === 'meeting') {
    extra.rope = buildRope(room, A)
    group.add(extra.rope)
  }
  if (f2) addFloor2Bits(room, group, A, rng, extra)
  if (f3) addAtticBits(room, group, A, rng)
  if (f4) addGardenBits(room, group, A, rng, extra)

  // Decor: rug, paintings, wall eyes.
  if (room.type === 'normal' && !f2 && rng() < 0.6) {
    const rug = worldBox(Math.min(2.4, hw), 0.02, len - 3, 0, 0.01, zc, A.carpets[(room.index + 1) % A.carpets.length], 1.2)
    group.add(rug)
  }
  if (room.type !== 'halt' && room.type !== 'chase' && room.type !== 'elevator' && !f4) addPaintings(room, group, A, rng)
  if (room.seekEyes || room.type === 'chase') addEyes(room, group, A, rng, extra)
  if (room.type === 'exit' && room.floor !== 4) addOutside(room, group, A)
  if (room.type === 'exit' && room.floor === 4) {
    // a wrought-iron garden gate standing open, with moonlit fields beyond
    const z = room.z1 - T / 2
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Group()
      for (let k = 0; k < 6; k++) leaf.add(box(0.03, GAP_H, 0.03, A.metalDark, sx * (0.07 + k * 0.12), GAP_H / 2, 0))
      leaf.add(box(0.75, 0.04, 0.04, A.metalDark, sx * 0.4, GAP_H - 0.1, 0))
      leaf.add(box(0.75, 0.04, 0.04, A.metalDark, sx * 0.4, 0.3, 0))
      for (let k = 0; k < 6; k++) leaf.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), A.metalDark).translateX(sx * (0.07 + k * 0.12)).translateY(GAP_H + 0.06))
      leaf.position.set(room.exitX + sx * GAP_HALF, 0, z - 0.4)
      leaf.rotation.y = sx * 1.2
      group.add(leaf)
    }
    const field = worldBox(30, 0.1, 30, room.exitX, -0.06, z - 15.5, A.grass, 1.8)
    group.add(field)
  }
  if (room.type === 'lobby') addLobbyDesk(room, group, A)

  return { group, extra }
}

// Where a room's ceiling lights hang — also used to place the pooled real lights.
export function lightSpots(room) {
  const zc = (room.z0 + room.z1) / 2
  if (room.type === 'stampede') return [0.15, 0.35, 0.55, 0.75, 0.92].map(f => ({ x: 0, z: room.z0 - room.len * f }))
  if (room.type === 'library') return [{ x: -4, z: room.z0 - 5 }, { x: 4, z: room.z0 - 5 }, { x: -4, z: room.z1 + 5 }, { x: 4, z: room.z1 + 5 }]
  const extra = room.secret?.doorOpen ? [{ x: (room.secret.x0 + room.secret.x1) / 2, z: room.secret.z }] : []
  if (room.len > 13) return [{ x: 0, z: room.z0 - room.len / 3 }, { x: 0, z: room.z1 + room.len / 3 }, ...extra]
  return [{ x: 0, z: zc }, ...extra]
}

function buildRope(room, A) {
  const g = new THREE.Group()
  const x = room.exitX, z = room.z1 + 0.25
  for (const sx of [-1, 1]) {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 10), A.brass).translateX(x + sx * (GAP_HALF - 0.08)).translateY(0.5).translateZ(z))
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), A.brass).translateX(x + sx * (GAP_HALF - 0.08)).translateY(1.02).translateZ(z))
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 14), A.brass).translateX(x + sx * (GAP_HALF - 0.08)).translateY(0.02).translateZ(z))
  }
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(x - GAP_HALF + 0.08, 0.92, z),
    new THREE.Vector3(x, 0.55, z),
    new THREE.Vector3(x + GAP_HALF - 0.08, 0.92, z),
  )
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.035, 8), A.rope))
  return g
}

function addPaintings(room, group, A, rng) {
  const { hw, z0, z1 } = room
  const tryWall = (gapX, z, facing) => {
    const runs = gapX == null ? [[-hw, hw]] : [[-hw, gapX - GAP_HALF], [gapX + GAP_HALF, hw]]
    for (const [a, b] of runs) {
      if (b - a < 1.6 || rng() < 0.35) continue
      const isPortrait = room.floor === 2 || rng() < 0.45
      const mat = room.floor === 2 ? A.posters[Math.floor(rng() * A.posters.length)]
        : isPortrait ? A.paintings[4 + Math.floor(rng() * 6)] : A.paintings[Math.floor(rng() * 4)]
      const w = isPortrait ? 0.62 : 0.95, h = isPortrait ? 0.8 : 0.74
      const x = (a + b) / 2
      const frame = box(w + 0.1, h + 0.1, 0.05, A.brass, x, 1.75, z + facing * 0.03)
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      art.position.set(x, 1.75, z + facing * 0.06)
      if (facing < 0) art.rotation.y = Math.PI
      group.add(frame, art)
    }
  }
  if (room.lockKind !== 'dupe') tryWall(room.exitX, z1, 1)
  if (room.index > 0) tryWall(room.entryX, z0, -1)
}

function addEyes(room, group, A, rng, extra) {
  const n = room.type === 'chase' ? 14 : 8
  for (let k = 0; k < n; k++) {
    const side = rng() < 0.5 ? -1 : 1
    const size = 0.08 + rng() * 0.16
    const eye = buildGooglyEye(A, size)
    const z = room.z1 + 0.6 + rng() * (room.len - 1.2)
    eye.position.set(side * (room.hw - 0.02), 1.0 + rng() * 1.7, z)
    eye.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2
    group.add(eye)
    extra.eyes.push(eye)
  }
}

function addOutside(room, group, A) {
  const z = room.z1 - T
  const night = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), A.outside)
  night.position.set(room.exitX, room.floor === 3 ? 0.6 : 2.2, z - 5) // from the roof you see sky, not the ground
  group.add(night)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), A.exitSign)
  sign.position.set(room.exitX, GAP_H + 0.3, room.z1 + 0.02)
  group.add(sign)
}

function addLobbyDesk(room, group, A) {
  const z = room.z0 - 1.2
  group.add(box(2.6, 1.05, 0.6, A.darkWood, -2.6, 0.525, z))
  group.add(box(2.7, 0.06, 0.7, A.brass, -2.6, 1.08, z))
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), A.brass)
  bell.position.set(-2.2, 1.11, z)
  group.add(bell)
}

export function disposeRoom(built) {
  built.group.traverse(o => {
    if (o.geometry) o.geometry.dispose()
    if (o.userData.ownMaterial && o.material) { o.material.map?.dispose(); o.material.dispose() }
  })
  built.extra.fixtureMat.dispose()
}
