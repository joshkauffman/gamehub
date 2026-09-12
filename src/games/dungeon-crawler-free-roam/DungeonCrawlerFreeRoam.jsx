import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './DungeonCrawlerFreeRoam.module.css'
import {
  mkInitialState, update, markContestant, boundsCenterXZ, equipWeapon, equipArmor, equipSpell,
  chooseClassRace, CLASSES, RACES, SPELLS,
} from './gameEngine.js'
import {
  WORLD_HALF, TILE, WALL_HEIGHT, MOUSE_SENSITIVITY, CAMERA_DIST,
  BUILDING_RADIUS, BUILDING_W, BUILDING_D, BUILDING_H, SPELL_RADIUS,
} from './constants.js'

// ── Dungeon Crawler Max: Free Roam ──────────────────────────────────────
// Same kid-safe "game show dungeon" universe as Dungeon Crawler Max, now
// one 3D open world with real buildings scattered around it. Walking up
// to a building's door teleports you into that dungeon's own interior
// map (rooms, corridors, monsters, boss); reaching the exit disc inside
// teleports you back out to the door you entered from. Follows this
// hub's existing 3D-open-world convention (loot-and-scoot, dog-man-dash):
// engine/component split, tank-turn keyboard controls
// with optional pointer-lock mouse-look, third-person chase camera with
// an anti-clip raycast, AABB/circle collision against plain data. Player,
// pet, monsters, boss, chests are canvas-emoji billboard sprites — reuses
// the 2D game's visual language instead of needing 3D character models.

const MAX_PARTICLES = 300
const MAX_PROJECTILES = 24

// ── Emoji sprite factory (texture cached by emoji, material per-instance
// so effects like the player's invuln flicker never leak across movers) ─
const emojiTextureCache = new Map()
function getEmojiTexture(emoji) {
  let tex = emojiTextureCache.get(emoji)
  if (tex) return tex
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.font = `${size * 0.82}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.05)
  tex = new THREE.CanvasTexture(canvas)
  emojiTextureCache.set(emoji, tex)
  return tex
}
function makeEmojiSprite(emoji) {
  const mat = new THREE.SpriteMaterial({ map: getEmojiTexture(emoji), transparent: true, depthWrite: false })
  return new THREE.Sprite(mat)
}
function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas')
  const measureCtx = canvas.getContext('2d')
  measureCtx.font = 'bold 40px sans-serif'
  const w = Math.ceil(measureCtx.measureText(text).width) + 40
  canvas.width = w; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, w, 64)
  ctx.fillStyle = color || '#ffffff'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, 34)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.renderOrder = 10
  sprite.scale.set((w / 64) * 1.15, 1.15, 1)
  return sprite
}

const sharedShadowGeom = new THREE.CircleGeometry(0.6, 16)
sharedShadowGeom.rotateX(-Math.PI / 2)
const sharedShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })

function makeMoverFromTexture(tex, worldScale) {
  const group = new THREE.Group()
  const shadow = new THREE.Mesh(sharedShadowGeom, sharedShadowMat)
  shadow.position.y = 0.02
  shadow.scale.setScalar(worldScale * 0.6)
  group.add(shadow)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(worldScale, worldScale, 1)
  sprite.position.y = worldScale / 2 + 0.05
  group.add(sprite)
  group.userData.sprite = sprite
  return group
}
function makeMover(emoji, worldScale) {
  return makeMoverFromTexture(getEmojiTexture(emoji), worldScale)
}

// ── Creature & player sprite factory (procedural fantasy-monster icons
// drawn to an offscreen canvas, cached by visual signature, then used as
// a billboard sprite texture) — same drawing language as Dungeon Crawler
// Max's 2D canvas renderer, ported to a single static icon per signature
// since these are billboards (always face the camera) rather than a
// live per-frame canvas draw. No emoji glyphs involved. ─────────────────
function creatureDrawEyes(ctx, cx, cy, gap, rad, pupilColor) {
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(cx + s * gap, cy, rad, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.beginPath(); ctx.arc(cx + s * gap, cy, rad * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = pupilColor; ctx.fill()
  }
}
function creatureGlowEyes(ctx, cx, cy, gap, rad, color) {
  ctx.fillStyle = color
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * gap, cy, rad, 0, Math.PI * 2); ctx.fill() }
}
function creatureCrown(ctx, cy, w) {
  ctx.fillStyle = '#FFD34D'
  ctx.beginPath()
  ctx.moveTo(-w, cy); ctx.lineTo(-w, cy - w * 0.5)
  ctx.lineTo(-w * 0.5, cy - w * 0.1); ctx.lineTo(0, cy - w * 0.7)
  ctx.lineTo(w * 0.5, cy - w * 0.1); ctx.lineTo(w, cy - w * 0.5)
  ctx.lineTo(w, cy); ctx.closePath(); ctx.fill()
}

const creatureTextureCache = new Map()
function getCreatureTexture(m) {
  const key = [m.kind, m.variant || '', m.color, m.accent, m.crown ? 1 : 0, m.bulky ? 1 : 0, m.chimera ? 1 : 0, m.heads || 1, m.demon ? 1 : 0, m.scythe ? 1 : 0].join('|')
  let tex = creatureTextureCache.get(key)
  if (tex) return tex
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.translate(size / 2, size / 2)
  const r = 62
  const color = m.color, accent = m.accent, variant = m.variant || ''

  switch (m.kind) {
    case 'ooze': {
      const wob = r * 0.05
      ctx.beginPath()
      ctx.moveTo(-r, r * 0.6)
      ctx.quadraticCurveTo(-r - wob, -r * 0.15, -r * 0.5, -r * 0.75)
      ctx.quadraticCurveTo(0, -r * 0.95, r * 0.5, -r * 0.75)
      ctx.quadraticCurveTo(r + wob, -r * 0.15, r, r * 0.6)
      ctx.quadraticCurveTo(0, r * 0.85, -r, r * 0.6)
      ctx.closePath()
      ctx.globalAlpha = 0.85; ctx.fillStyle = color; ctx.fill()
      ctx.globalAlpha = 1; ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke()
      creatureDrawEyes(ctx, 0, -r * 0.1, r * 0.28, r * 0.14, '#1a1a1a')
      if (m.crown) creatureCrown(ctx, -r * 0.85, r * 0.35)
      break
    }
    case 'beast': {
      ctx.fillStyle = color
      ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.85, r * 0.55, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.18
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * r * 0.5, r * 0.5); ctx.lineTo(s * r * 0.55, r * 0.98); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(s * r * 0.1, r * 0.55); ctx.lineTo(s * r * 0.15, r * 1.02); ctx.stroke()
      }
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.14
      ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.1); ctx.quadraticCurveTo(-r * 1.35, -r * 0.15, -r * 1.15, -r * 0.55); ctx.stroke()
      ctx.beginPath(); ctx.arc(r * 0.68, -r * 0.2, r * 0.42, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.55); ctx.lineTo(r * 0.62, -r * 0.9); ctx.lineTo(r * 0.78, -r * 0.55); ctx.closePath(); ctx.fill()
      creatureDrawEyes(ctx, r * 0.75, -r * 0.25, r * 0.14, r * 0.08, '#1a1a1a')
      if (variant === 'wolf') {
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.02); ctx.lineTo(r * 0.6, r * 0.18); ctx.lineTo(r * 0.65, r * 0.02); ctx.closePath(); ctx.fill()
      }
      if (variant === 'boar') {
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.moveTo(r * 0.5, r * 0.05); ctx.lineTo(r * 0.62, r * 0.15); ctx.lineTo(r * 0.52, r * 0.18); ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.05); ctx.lineTo(r * 0.98, r * 0.02); ctx.lineTo(r * 0.88, r * 0.08); ctx.closePath(); ctx.fill()
      }
      if (m.chimera) {
        ctx.strokeStyle = accent; ctx.lineWidth = r * 0.09
        ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.5); ctx.lineTo(-r * 0.55, -r * 0.85); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.55); ctx.lineTo(0, -r * 0.92); ctx.stroke()
        ctx.fillStyle = accent
        ctx.beginPath(); ctx.arc(-r * 1.05, -r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fill()
      }
      break
    }
    case 'flyer': {
      const flap = 0.85
      ctx.fillStyle = color
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1)
        ctx.beginPath()
        ctx.moveTo(r * 0.15, 0)
        ctx.quadraticCurveTo(r * 1.3, -r * (0.5 + flap * 0.5), r * 1.5, r * 0.1)
        ctx.quadraticCurveTo(r * 0.8, r * 0.15, r * 0.15, r * 0.3)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.5, r * 0.4, 0, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      if (variant === 'harpy') {
        ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
        creatureDrawEyes(ctx, 0, -r * 0.4, r * 0.13, r * 0.07, '#1a1a1a')
        ctx.fillStyle = '#e8c060'
        ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(r * 0.15, -r * 0.15); ctx.lineTo(-r * 0.02, -r * 0.12); ctx.closePath(); ctx.fill()
      } else if (variant === 'bat') {
        creatureGlowEyes(ctx, 0, -r * 0.05, r * 0.16, r * 0.09, accent)
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.2); ctx.lineTo(-r * 0.15, r * 0.35); ctx.lineTo(-r * 0.02, r * 0.22); ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.2); ctx.lineTo(r * 0.15, r * 0.35); ctx.lineTo(r * 0.02, r * 0.22); ctx.closePath(); ctx.fill()
      } else {
        creatureDrawEyes(ctx, 0, r * 0.05, r * 0.2, r * 0.14, '#1a1a1a')
      }
      if (m.crown) creatureCrown(ctx, -r * 0.65, r * 0.3)
      break
    }
    case 'humanoid': {
      const bulky = m.bulky || variant === 'ogre' || variant === 'ice'
      const w = bulky ? r * 0.95 : r * 0.6
      ctx.fillStyle = color
      ctx.beginPath(); ctx.moveTo(-w * 0.55, r * 0.9); ctx.lineTo(-w * 0.4, -r * 0.1)
      ctx.lineTo(w * 0.4, -r * 0.1); ctx.lineTo(w * 0.55, r * 0.9); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = r * (bulky ? 0.24 : 0.16)
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.3, r * 0.9); ctx.lineTo(s * w * 0.32, r * 1.3); ctx.stroke() }
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.5, r * 0.05); ctx.lineTo(s * w * 0.85, r * 0.45); ctx.stroke() }
      ctx.beginPath(); ctx.arc(0, -r * 0.4, r * (bulky ? 0.55 : 0.42), 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      if (variant === 'bone') {
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.42, r * 0.09, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.42, r * 0.09, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(-r * 0.12, -r * 0.22, r * 0.24, r * 0.08)
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.18, r * 0.05); ctx.lineTo(i * r * 0.18, r * 0.55); ctx.stroke() }
      } else if (variant === 'shadow') {
        ctx.globalAlpha = 0.75
        creatureGlowEyes(ctx, 0, -r * 0.42, r * 0.16, r * 0.09, accent)
        ctx.globalAlpha = 1
      } else if (variant === 'scarecrow') {
        creatureDrawEyes(ctx, 0, -r * 0.42, r * 0.15, r * 0.08, '#3a2a10')
        ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.22); ctx.lineTo(r * 0.12, -r * 0.1)
        ctx.moveTo(r * 0.12, -r * 0.22); ctx.lineTo(-r * 0.12, -r * 0.1); ctx.stroke()
        ctx.strokeStyle = accent; ctx.lineWidth = 2
        for (const s of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.moveTo(s * r * 0.4, -r * 0.5 + i * r * 0.08); ctx.lineTo(s * (r * 0.4 + r * 0.25), -r * 0.55 + i * r * 0.1); ctx.stroke()
          }
        }
      } else {
        creatureDrawEyes(ctx, 0, -r * 0.42, r * 0.15, r * 0.08, '#1a1a1a')
        if (variant === 'goblin' || !variant) {
          ctx.fillStyle = accent
          ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.55); ctx.lineTo(-r * 0.65, -r * 0.85); ctx.lineTo(-r * 0.35, -r * 0.65); ctx.closePath(); ctx.fill()
          ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.55); ctx.lineTo(r * 0.65, -r * 0.85); ctx.lineTo(r * 0.35, -r * 0.65); ctx.closePath(); ctx.fill()
        }
      }
      ctx.strokeStyle = m.scythe ? '#c9c9c9' : (accent || '#c9c9c9')
      ctx.lineWidth = r * 0.12
      ctx.beginPath(); ctx.moveTo(w * 0.7, r * 0.1); ctx.lineTo(w * (m.scythe ? 1.3 : 1.05), -r * (m.scythe ? 0.8 : 0.5)); ctx.stroke()
      if (m.crown) creatureCrown(ctx, -r * 0.85, r * 0.3)
      break
    }
    case 'arachnid': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.1
      for (let i = 0; i < 4; i++) {
        const ang = -0.5 + i * 0.35
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, 0)
          ctx.quadraticCurveTo(s * r * Math.cos(ang) * 0.8, r * 0.1, s * r * (0.9 + i * 0.1), r * (0.5 - i * 0.15))
          ctx.stroke()
        }
      }
      ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.55, r * 0.45, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      creatureGlowEyes(ctx, 0, -r * 0.4, r * 0.15, r * 0.06, accent)
      creatureGlowEyes(ctx, 0, -r * 0.28, r * 0.09, r * 0.045, accent)
      break
    }
    case 'spectral': {
      const wob = r * 0.06
      ctx.globalAlpha = 0.75
      ctx.beginPath()
      ctx.moveTo(-r * 0.7, r * 0.4)
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.5, 0, -r * 0.85)
      ctx.quadraticCurveTo(r * 0.9, -r * 0.5, r * 0.7, r * 0.4)
      ctx.quadraticCurveTo(r * 0.4 + wob, r * 0.75, r * 0.15, r * 0.5)
      ctx.quadraticCurveTo(0, r * 0.7, -r * 0.15, r * 0.5)
      ctx.quadraticCurveTo(-r * 0.4 - wob, r * 0.75, -r * 0.7, r * 0.4)
      ctx.closePath()
      ctx.fillStyle = color; ctx.fill()
      ctx.globalAlpha = 1
      if (variant === 'banshee') {
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.6); ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, -r * 0.5, r * 0.2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.6); ctx.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.5, r * 0.2); ctx.stroke()
        ctx.fillStyle = '#3a2030'
        ctx.beginPath(); ctx.ellipse(0, r * 0.05, r * 0.14, r * 0.2, 0, 0, Math.PI * 2); ctx.fill()
      } else if (variant === 'mirror') {
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.3, -r * 0.7); ctx.lineTo(i * r * 0.3 + r * 0.1, r * 0.3); ctx.stroke() }
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.3); ctx.lineTo(r * 0.1, -r * 0.5); ctx.lineTo(r * 0.05, 0); ctx.closePath(); ctx.fill()
      }
      creatureGlowEyes(ctx, 0, -r * 0.35, r * 0.18, r * 0.09, accent)
      if (m.crown) creatureCrown(ctx, -r * 0.75, r * 0.3)
      break
    }
    case 'golem': {
      ctx.fillStyle = color
      ctx.fillRect(-r * 0.75, -r * 0.15, r * 1.5, r * 1.0)
      ctx.fillRect(-r * 0.4, -r * 0.75, r * 0.8, r * 0.65)
      for (const s of [-1, 1]) ctx.fillRect(s > 0 ? r * 0.85 : -r * 1.1, -r * 0.05, r * 0.25, r * 0.55)
      ctx.strokeStyle = accent; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.1); ctx.lineTo(0, r * 0.3); ctx.lineTo(r * 0.3, -r * 0.05); ctx.stroke()
      creatureGlowEyes(ctx, 0, -r * 0.45, r * 0.14, r * 0.08, accent)
      break
    }
    case 'serpent': {
      const heads = m.heads || 1
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.5; ctx.lineCap = 'round'
      const spread = heads > 1 ? r * 0.45 : 0
      for (let h = 0; h < heads; h++) {
        const off = heads > 1 ? (h - (heads - 1) / 2) * spread : 0
        ctx.beginPath()
        ctx.moveTo(0, r * 0.7)
        ctx.quadraticCurveTo(off * 0.6, r * 0.1, off, -r * 0.6)
        ctx.stroke()
        ctx.beginPath(); ctx.arc(off, -r * 0.65, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
        creatureGlowEyes(ctx, off, -r * 0.7, r * 0.11, r * 0.055, accent)
      }
      ctx.lineCap = 'butt'
      break
    }
    case 'orb': {
      const pulse = 1.05
      ctx.save(); ctx.scale(pulse, pulse)
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
      ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.1, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#1a1a1a'; ctx.fill()
      ctx.restore()
      break
    }
    case 'plant': {
      if (variant === 'tumbleweed') {
        ctx.strokeStyle = color; ctx.lineWidth = r * 0.08
        for (let i = 0; i < 7; i++) {
          const ang = i * (Math.PI / 3.3)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.quadraticCurveTo(Math.cos(ang) * r * 0.5, Math.sin(ang) * r * 0.5 - r * 0.1, Math.cos(ang) * r * 0.85, Math.sin(ang) * r * 0.85 - r * 0.15)
          ctx.stroke()
        }
        ctx.strokeStyle = accent; ctx.lineWidth = r * 0.05
        ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.55, 0, Math.PI * 2); ctx.stroke()
        creatureGlowEyes(ctx, 0, -r * 0.15, r * 0.16, r * 0.08, '#ffffff')
        break
      }
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.22
      const sway = r * 0.1
      ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.quadraticCurveTo(sway, 0, 0, -r * 0.6); ctx.stroke()
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, r * 0.3); ctx.quadraticCurveTo(s * r * 0.7, r * 0.1, s * r * 0.9 + sway * 0.5, -r * 0.3); ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.55); ctx.quadraticCurveTo(0, -r * 0.25, r * 0.3, -r * 0.55); ctx.quadraticCurveTo(0, -r * 0.4, -r * 0.3, -r * 0.55); ctx.fill()
      creatureGlowEyes(ctx, 0, -r * 0.85, r * 0.14, r * 0.07, '#ffffff')
      break
    }
    case 'imp': {
      ctx.fillStyle = color
      ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.8); ctx.lineTo(-r * 0.35, -r * 0.05); ctx.lineTo(r * 0.35, -r * 0.05); ctx.lineTo(r * 0.4, r * 0.8); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.4, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.65); ctx.lineTo(-r * 0.45, -r * 1.0); ctx.lineTo(-r * 0.12, -r * 0.75); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.65); ctx.lineTo(r * 0.45, -r * 1.0); ctx.lineTo(r * 0.12, -r * 0.75); ctx.closePath(); ctx.fill()
      const flap = 0.9
      ctx.fillStyle = accent
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1)
        ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.1)
        ctx.quadraticCurveTo(r * 1.0, -r * 0.2 * flap, r * 0.9, r * 0.4)
        ctx.quadraticCurveTo(r * 0.5, r * 0.2, r * 0.3, r * 0.15)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      creatureGlowEyes(ctx, 0, -r * 0.42, r * 0.14, r * 0.07, variant === 'frost' ? '#ffffff' : '#ffe08a')
      if (m.demon) {
        ctx.strokeStyle = accent; ctx.lineWidth = r * 0.1
        ctx.beginPath(); ctx.moveTo(0, r * 0.75); ctx.quadraticCurveTo(r * 0.3, r * 1.1, r * 0.15, r * 1.35); ctx.stroke()
      }
      break
    }
    case 'mimic': {
      ctx.fillStyle = color
      ctx.fillRect(-r * 0.9, -r * 0.1, r * 1.8, r * 0.85)
      ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.1); ctx.quadraticCurveTo(0, -r * 0.7, r * 0.9, -r * 0.1); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = accent; ctx.lineWidth = 2
      ctx.strokeRect(-r * 0.9, -r * 0.1, r * 1.8, r * 0.85)
      const bite = 0.6
      ctx.fillStyle = '#2a1a10'
      ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.55, r * 0.12 + bite * r * 0.08, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.18, r * 0.02); ctx.lineTo(i * r * 0.18 + r * 0.06, r * 0.02); ctx.lineTo(i * r * 0.12, r * 0.14); ctx.closePath(); ctx.fill()
      }
      creatureGlowEyes(ctx, 0, -r * 0.35, r * 0.2, r * 0.08, accent)
      break
    }
    case 'dragon': {
      const flap = 0.9
      ctx.fillStyle = color
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1)
        ctx.beginPath()
        ctx.moveTo(r * 0.1, -r * 0.1)
        ctx.quadraticCurveTo(r * 1.4, -r * (0.6 + flap * 0.5), r * 1.7, r * 0.15)
        ctx.quadraticCurveTo(r * 1.0, r * 0.25, r * 0.5, r * 0.1)
        ctx.quadraticCurveTo(r * 0.9, -r * 0.05, r * 1.15, r * (0.15 + flap * 0.3))
        ctx.quadraticCurveTo(r * 0.6, r * 0.35, r * 0.1, r * 0.15)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.28
      ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(-r * 1.1, r * 0.7, -r * 1.4, r * 0.2); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.65, r * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.4, r * 0.32, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.6); ctx.lineTo(-r * 0.25, -r * 0.95); ctx.lineTo(0, -r * 0.7); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.15, -r * 0.6); ctx.lineTo(r * 0.25, -r * 0.95); ctx.lineTo(0, -r * 0.7); ctx.closePath(); ctx.fill()
      creatureGlowEyes(ctx, 0, -r * 0.4, r * 0.16, r * 0.08, accent)
      ctx.fillStyle = accent
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.25); ctx.lineTo(r * 0.6, -r * 0.15); ctx.lineTo(r * 0.3, -r * 0.05); ctx.closePath(); ctx.fill()
      break
    }
    default: {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      creatureDrawEyes(ctx, 0, -r * 0.1, r * 0.2, r * 0.1, '#1a1a1a')
    }
  }

  tex = new THREE.CanvasTexture(canvas)
  creatureTextureCache.set(key, tex)
  return tex
}
function makeCreatureMover(m, worldScale) {
  return makeMoverFromTexture(getCreatureTexture(m), worldScale)
}

const playerTextureCache = new Map()
function getPlayerTexture(classId, raceId) {
  const key = `${classId || 'none'}|${raceId || 'none'}`
  let tex = playerTextureCache.get(key)
  if (tex) return tex
  const cls = CLASSES.find(c => c.id === classId)
  const race = RACES.find(rc => rc.id === raceId)
  const bodyColors = { warrior: '#8a5a3a', mage: '#6b4aa8', rogue: '#2f4a3a', cleric: '#e8dcc0' }
  const bodyColor = cls ? bodyColors[cls.id] : '#3a7a4a'
  const skinColor = race?.id === 'hamsterkin' ? '#d9a860' : '#e8c090'
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.translate(size / 2, size / 2 + 12)
  const r = 60

  ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = r * 0.22
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.25, r * 0.6); ctx.lineTo(s * r * 0.3, r * 1.15); ctx.stroke() }

  ctx.fillStyle = bodyColor
  ctx.beginPath()
  ctx.moveTo(-r * 0.5, r * 0.7); ctx.lineTo(-r * 0.45, -r * 0.15)
  ctx.lineTo(r * 0.45, -r * 0.15); ctx.lineTo(r * 0.5, r * 0.7); ctx.closePath(); ctx.fill()

  ctx.strokeStyle = bodyColor; ctx.lineWidth = r * 0.2
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.5, r * 0.05); ctx.lineTo(s * r * 0.8, r * 0.4); ctx.stroke() }

  ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.45, 0, Math.PI * 2); ctx.fillStyle = skinColor; ctx.fill()

  if (race?.id === 'elf') {
    ctx.fillStyle = skinColor
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.6); ctx.lineTo(-r * 0.65, -r * 0.7); ctx.lineTo(-r * 0.35, -r * 0.45); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.6); ctx.lineTo(r * 0.65, -r * 0.7); ctx.lineTo(r * 0.35, -r * 0.45); ctx.closePath(); ctx.fill()
  }
  if (race?.id === 'dwarf') {
    ctx.fillStyle = '#a06a3a'
    ctx.beginPath()
    ctx.moveTo(-r * 0.32, -r * 0.4); ctx.lineTo(-r * 0.3, r * 0.05); ctx.lineTo(0, r * 0.15)
    ctx.lineTo(r * 0.3, r * 0.05); ctx.lineTo(r * 0.32, -r * 0.4); ctx.closePath(); ctx.fill()
  }
  if (race?.id === 'hamsterkin') {
    ctx.fillStyle = skinColor
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.35, -r * 0.9, r * 0.2, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.7); ctx.quadraticCurveTo(-r * 0.8, r * 0.6, -r * 0.7, r * 0.35); ctx.stroke()
  }

  ctx.fillStyle = '#2a1a10'
  ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.55, r * 0.07, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.55, r * 0.07, 0, Math.PI * 2); ctx.fill()

  if (cls?.id === 'mage') {
    ctx.fillStyle = bodyColor
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(0, -r * 1.5); ctx.lineTo(r * 0.5, -r * 0.75); ctx.closePath(); ctx.fill()
  } else if (cls?.id === 'rogue') {
    ctx.fillStyle = bodyColor
    ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.5, Math.PI, Math.PI * 2); ctx.fill()
  } else if (cls?.id === 'cleric') {
    ctx.fillStyle = '#ffd34d'
    ctx.beginPath(); ctx.arc(0, -r * 1.05, r * 0.12, 0, Math.PI * 2); ctx.fill()
  } else if (cls?.id === 'warrior') {
    ctx.fillStyle = '#c9c9c9'
    ctx.fillRect(-r * 0.5, -r * 0.85, r, r * 0.2)
  }

  ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = r * 0.16
  ctx.beginPath(); ctx.moveTo(r * 0.75, r * 0.35); ctx.lineTo(r * 1.15, -r * 0.55); ctx.stroke()
  if (cls?.id === 'mage') {
    ctx.fillStyle = '#c9a6ff'
    ctx.beginPath(); ctx.arc(r * 1.15, -r * 0.55, r * 0.14, 0, Math.PI * 2); ctx.fill()
  }

  tex = new THREE.CanvasTexture(canvas)
  playerTextureCache.set(key, tex)
  return tex
}
function makePlayerMover(classId, raceId, worldScale) {
  return makeMoverFromTexture(getPlayerTexture(classId, raceId), worldScale)
}

function makeGrassTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#3a6b35'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = `rgba(${20 + Math.random() * 40},${70 + Math.random() * 55},${20 + Math.random() * 30},0.5)`
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(WORLD_HALF / 5, WORLD_HALF / 5)
  return tex
}

function hexToRgb01(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}
function darkenHex(hex, factor) {
  const [r, g, b] = hexToRgb01(hex)
  return new THREE.Color(r * factor, g * factor, b * factor)
}

// Shared glow texture for magic-bolt projectiles — one radial-gradient
// sprite material reused across the whole pool, only positions differ.
let spellBoltMaterial = null
function getSpellBoltMaterial() {
  if (spellBoltMaterial) return spellBoltMaterial
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const c = size / 2
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(201,166,255,0.95)')
  grad.addColorStop(1, 'rgba(143,211,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  spellBoltMaterial = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  return spellBoltMaterial
}

function makeDecoration() {
  const kind = Math.random() < 0.5 ? 'rock' : 'tree'
  const group = new THREE.Group()
  if (kind === 'rock') {
    const geo = new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.8, 0)
    const mat = new THREE.MeshLambertMaterial({ color: 0x777268 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = 0.4
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    group.add(mesh)
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x5c4430 }))
    trunk.position.y = 1.1
    group.add(trunk)
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 6), new THREE.MeshLambertMaterial({ color: 0x3d6b34 }))
    foliage.position.y = 2.5
    group.add(foliage)
  }
  return group
}

function buildBuildingExterior(site) {
  const grp = new THREE.Group()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_W, BUILDING_H, BUILDING_D),
    new THREE.MeshLambertMaterial({ color: site.theme.wallColor }),
  )
  box.position.set(site.centerX, BUILDING_H / 2, site.centerZ)
  grp.add(box)

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(BUILDING_RADIUS + 2, 4.2, 4),
    new THREE.MeshLambertMaterial({ color: site.theme.floorColor }),
  )
  roof.rotation.y = Math.PI / 4
  roof.position.set(site.centerX, BUILDING_H + 2.1, site.centerZ)
  grp.add(roof)

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 3.6),
    new THREE.MeshBasicMaterial({ color: site.theme.accent, side: THREE.DoubleSide }),
  )
  door.position.set(site.doorX, 1.8, site.doorZ)
  door.lookAt(site.doorX + site.doorDirX * 10, 1.8, site.doorZ + site.doorDirZ * 10)
  grp.add(door)

  const sign = makeLabelSprite(site.theme.name, site.theme.accent)
  sign.position.set(site.doorX, BUILDING_H + 0.9, site.doorZ)
  grp.add(sign)

  return { group: grp, clipMesh: box }
}

export default function DungeonCrawlerFreeRoam() {
  const [phase, setPhaseState] = useState('intro')
  const phaseRef = useRef('intro')
  const [winStats, setWinStats] = useState(null)
  const [twoPlayer, setTwoPlayer] = useState(true)
  const mountRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)

  // modal is null | 'gear' | 'classPick' — a single slot since only one
  // full-screen panel makes sense open at a time; every place that used to
  // check gearOpen now checks modal !== null so both panels share one
  // pause/input-gating path.
  const [modal, setModalState] = useState(null)
  const modalRef = useRef(null)
  const [gearTab, setGearTab] = useState('p1')
  const [gearSnapshot, setGearSnapshot] = useState(null)
  const emptyPick = () => ({ classId: null, raceId: null })
  const [classPick, setClassPick] = useState({ p1: emptyPick(), p2: emptyPick() })

  const hpFillRef = useRef(null)
  const hpTextRef = useRef(null)
  const xpFillRef = useRef(null)
  const manaFillRef = useRef(null)
  const manaTextRef = useRef(null)
  const levelTextRef = useRef(null)
  const goldTextRef = useRef(null)
  const potionTextRef = useRef(null)
  const hpFillRef2 = useRef(null)
  const hpTextRef2 = useRef(null)
  const xpFillRef2 = useRef(null)
  const manaFillRef2 = useRef(null)
  const manaTextRef2 = useRef(null)
  const levelTextRef2 = useRef(null)
  const goldTextRef2 = useRef(null)
  const potionTextRef2 = useRef(null)
  const bannerRef = useRef(null)
  const announcerRef = useRef(null)
  const bossBarRef = useRef(null)
  const bossFillRef = useRef(null)
  const bossNameRef = useRef(null)
  const compassRef = useRef(null)
  const compassArrowRef = useRef(null)
  const safeZoneBadgeRef = useRef(null)
  const controlsHintRef = useRef(null)
  const teleportFlashRef = useRef(null)

  function setPhase(p) { phaseRef.current = p; setPhaseState(p) }

  function snapshotPlayer(p) {
    return {
      weapons: [...p.weapons], armors: [...p.armors], spells: [...p.spells],
      weaponName: p.weaponName, armorName: p.armorName, equippedSpellId: p.equippedSpellId,
    }
  }
  function refreshGearSnapshot() {
    const s = stateRef.current
    if (!s) return
    setGearSnapshot({ p1: snapshotPlayer(s.player), p2: snapshotPlayer(s.player2) })
  }
  function activeGearPlayer() {
    return gearTab === 'p1' ? stateRef.current.player : stateRef.current.player2
  }
  function setModal(next) {
    modalRef.current = next
    setModalState(next)
    if (next) {
      if (next === 'gear') { setGearTab('p1'); refreshGearSnapshot() }
      if (next === 'classPick') setClassPick({ p1: emptyPick(), p2: emptyPick() })
      try { document.exitPointerLock?.() } catch { /* not locked */ }
    }
  }
  function handleEquipWeapon(item) {
    equipWeapon(stateRef.current, activeGearPlayer(), item)
    refreshGearSnapshot()
  }
  function handleEquipArmor(item) {
    equipArmor(stateRef.current, activeGearPlayer(), item)
    refreshGearSnapshot()
  }
  function handleEquipSpell(id) {
    equipSpell(stateRef.current, activeGearPlayer(), id)
    refreshGearSnapshot()
  }
  function confirmClassRace() {
    const { p1, p2 } = classPick
    const solo = !stateRef.current.twoPlayer
    if (!p1.classId || !p1.raceId || (!solo && (!p2.classId || !p2.raceId))) return
    chooseClassRace(stateRef.current, stateRef.current.player, p1.classId, p1.raceId)
    if (!solo) chooseClassRace(stateRef.current, stateRef.current.player2, p2.classId, p2.raceId)
    setModal(null)
  }

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const skyColor = 0x8fd0f0
    scene.background = new THREE.Color(skyColor)
    scene.fog = new THREE.Fog(skyColor, 140, 430)

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 550)
    camera.position.set(0, 8, 14)

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 0.85)
    sun.position.set(120, 180, 90)
    scene.add(sun)

    const overworldGroup = new THREE.Group()
    scene.add(overworldGroup)
    const dungeonGroup = new THREE.Group()
    dungeonGroup.visible = false
    scene.add(dungeonGroup)

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_HALF * 2, 1, WORLD_HALF * 2),
      new THREE.MeshLambertMaterial({ map: makeGrassTexture() }),
    )
    ground.position.y = -0.5
    overworldGroup.add(ground)

    for (let i = 0; i < 90; i++) {
      const x = (Math.random() * 2 - 1) * (WORLD_HALF - 15)
      const z = (Math.random() * 2 - 1) * (WORLD_HALF - 15)
      const deco = makeDecoration()
      deco.position.set(x, 0, z)
      overworldGroup.add(deco)
    }
    const permanentOverworldChildren = overworldGroup.children.length // ground + decorations, never torn down

    let buildingClipMeshes = []
    let interiorClipMeshes = []
    const moverMap = new Map()
    const chestMap = new Map()
    let playerGroup = null
    let player2Group = null
    let currentInteriorSite = null

    const particleGeo = new THREE.BufferGeometry()
    const particlePos = new Float32Array(MAX_PARTICLES * 3)
    const particleCol = new Float32Array(MAX_PARTICLES * 3)
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3))
    const particlePoints = new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, sizeAttenuation: true }))
    scene.add(particlePoints)

    // Fixed-size pool of magic-bolt sprites — reused every cast instead of
    // allocated, same pooling trick as the particle buffer above.
    const projectilePool = Array.from({ length: MAX_PROJECTILES }, () => {
      const sprite = new THREE.Sprite(getSpellBoltMaterial())
      sprite.scale.set(SPELL_RADIUS * 2.6, SPELL_RADIUS * 2.6, 1)
      sprite.visible = false
      scene.add(sprite)
      return sprite
    })
    function syncProjectiles(state) {
      const list = state.projectiles
      for (let i = 0; i < MAX_PROJECTILES; i++) {
        const sprite = projectilePool[i]
        if (i < list.length) {
          sprite.visible = true
          sprite.position.set(list[i].x, 1.3, list[i].z)
        } else {
          sprite.visible = false
        }
      }
    }

    function teardownAll() {
      while (overworldGroup.children.length > permanentOverworldChildren) {
        overworldGroup.remove(overworldGroup.children[overworldGroup.children.length - 1])
      }
      while (dungeonGroup.children.length) dungeonGroup.remove(dungeonGroup.children[0])
      buildingClipMeshes = []
      interiorClipMeshes = []
      moverMap.clear()
      chestMap.clear()
      currentInteriorSite = null
      dungeonGroup.visible = false
      if (playerGroup) { scene.remove(playerGroup); playerGroup = null }
      if (player2Group) { scene.remove(player2Group); player2Group = null }
    }

    function buildWorld(state) {
      for (const site of state.sites) {
        const { group, clipMesh } = buildBuildingExterior(site)
        overworldGroup.add(group)
        buildingClipMeshes.push(clipMesh)
      }
      for (const zone of state.safeZones) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(zone.r - 0.4, zone.r, 48),
          new THREE.MeshBasicMaterial({ color: 0x7cff9e, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.set(zone.x, 0.05, zone.z)
        overworldGroup.add(ring)
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(zone.r, 48),
          new THREE.MeshBasicMaterial({ color: 0x7cff9e, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
        )
        glow.rotation.x = -Math.PI / 2
        glow.position.set(zone.x, 0.03, zone.z)
        overworldGroup.add(glow)
        const label = makeLabelSprite(`🛡️ ${zone.name}`, '#7CFF9E')
        label.position.set(zone.x, 2.4, zone.z)
        overworldGroup.add(label)
      }
      playerGroup = makePlayerMover(null, null, 1.6)
      playerGroup.userData.appearanceKey = 'none|none'
      scene.add(playerGroup)
      if (state.twoPlayer) {
        player2Group = makePlayerMover(null, null, 1.6)
        player2Group.userData.appearanceKey = 'none|none'
        scene.add(player2Group)
      }
    }

    function buildInterior(site) {
      const wallGeo = new THREE.BoxGeometry(TILE * 0.92, WALL_HEIGHT, TILE * 0.92)
      const wallMat = new THREE.MeshLambertMaterial({ color: site.theme.wallColor })
      const inst = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, site.wallRects.length))
      const m4 = new THREE.Matrix4()
      site.wallRects.forEach((r, i) => { m4.makeTranslation(r.x, WALL_HEIGHT / 2, r.z); inst.setMatrixAt(i, m4) })
      inst.instanceMatrix.needsUpdate = true
      inst.count = site.wallRects.length
      dungeonGroup.add(inst)
      interiorClipMeshes = [inst]

      const fb = site.floorBounds
      const w = fb.x1 - fb.x0, d = fb.z1 - fb.z0
      const cx = (fb.x0 + fb.x1) / 2, cz = (fb.z0 + fb.z1) / 2

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: site.theme.floorColor }))
      floor.rotation.x = -Math.PI / 2
      floor.position.set(cx, 0, cz)
      dungeonGroup.add(floor)

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: site.theme.wallColor }))
      ceiling.rotation.x = Math.PI / 2
      ceiling.position.set(cx, WALL_HEIGHT, cz)
      dungeonGroup.add(ceiling)

      for (const c of site.chests) {
        const grp = makeMover('🎁', 1.1)
        grp.position.set(c.x, 0, c.z)
        grp.visible = !c.opened
        dungeonGroup.add(grp)
        chestMap.set(c, grp)
      }

      const exitSign = makeLabelSprite('Exit', '#8fd3ff')
      exitSign.position.set(site.exitDisc.x, 2.4, site.exitDisc.z)
      dungeonGroup.add(exitSign)

      const torch1 = new THREE.PointLight(0xffaa55, 1.0, 26)
      torch1.position.set(site.entrance.x, WALL_HEIGHT * 0.8, site.entrance.z)
      dungeonGroup.add(torch1)
      const bc = boundsCenterXZ(site.bossRoom)
      const torch2 = new THREE.PointLight(0xffaa55, 1.0, 26)
      torch2.position.set(bc.x, WALL_HEIGHT * 0.8, bc.z)
      dungeonGroup.add(torch2)
    }

    function teardownInterior(site) {
      for (const m of site.monsters) {
        const grp = moverMap.get(m.id)
        if (grp) { grp.parent?.remove(grp); moverMap.delete(m.id) }
      }
      for (const c of site.chests) {
        const grp = chestMap.get(c)
        if (grp) { grp.parent?.remove(grp); chestMap.delete(c) }
      }
      while (dungeonGroup.children.length) dungeonGroup.remove(dungeonGroup.children[0])
      interiorClipMeshes = []
    }

    function handleTeleport(state, dir) {
      if (dir === 'in') {
        const site = state.sites[state.activeSite]
        currentInteriorSite = site
        buildInterior(site)
        dungeonGroup.visible = true
        overworldGroup.visible = false
        scene.background = darkenHex(site.theme.wallColor, 0.32)
        scene.fog = new THREE.Fog(scene.background.getHex(), 14, 80)
        ambient.intensity = 0.6
        sun.visible = false
      } else {
        if (currentInteriorSite) teardownInterior(currentInteriorSite)
        currentInteriorSite = null
        dungeonGroup.visible = false
        overworldGroup.visible = true
        scene.background = new THREE.Color(skyColor)
        scene.fog = new THREE.Fog(skyColor, 140, 430)
        ambient.intensity = 0.7
        sun.visible = true
      }
    }

    function syncMovers(state) {
      const parentGroup = state.mode === 'dungeon' ? dungeonGroup : overworldGroup
      const monsters = state.mode === 'dungeon' ? state.sites[state.activeSite].monsters : state.overworldMobs
      const seen = new Set()
      for (const m of monsters) {
        seen.add(m.id)
        let grp = moverMap.get(m.id)
        if (!grp) {
          grp = makeCreatureMover(m, m.isBoss ? 3.0 : 1.3)
          if (m.isBoss) {
            const label = makeLabelSprite(m.name, '#ffffff')
            label.position.y = 3.6
            grp.add(label)
          }
          parentGroup.add(grp)
          moverMap.set(m.id, grp)
        }
        grp.position.set(m.x, 0, m.z)
        grp.visible = !m.dead
        if (m.hp < m.maxHp && !m.isBoss) {
          grp.userData.sprite.material.color.setRGB(1, 0.7, 0.7)
        } else {
          grp.userData.sprite.material.color.setRGB(1, 1, 1)
        }
      }
      for (const [id, grp] of moverMap) {
        if (!seen.has(id) && grp.parent === parentGroup) { parentGroup.remove(grp); moverMap.delete(id) }
      }
    }

    function syncChests() {
      for (const [c, grp] of chestMap) grp.visible = !c.opened
    }

    function syncParticles(state) {
      const arr = state.particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (i < arr.length) {
          const p = arr[i]
          particlePos[i * 3] = p.x; particlePos[i * 3 + 1] = p.y; particlePos[i * 3 + 2] = p.z
          const [r, g, b] = hexToRgb01(p.color)
          particleCol[i * 3] = r; particleCol[i * 3 + 1] = g; particleCol[i * 3 + 2] = b
        } else {
          particlePos[i * 3 + 1] = -9999
        }
      }
      particleGeo.attributes.position.needsUpdate = true
      particleGeo.attributes.color.needsUpdate = true
    }

    const raycaster = new THREE.Raycaster()
    function updateCamera(state) {
      const p1 = state.player, p2 = state.player2
      // Pivot on the midpoint of both players, and pull back farther the
      // more spread out they are, so a shared camera keeps both in frame
      // instead of only ever following Player 1.
      const pivot = new THREE.Vector3((p1.x + p2.x) / 2, 1.5, (p1.z + p2.z) / 2)
      const spread = Math.hypot(p1.x - p2.x, p1.z - p2.z)
      const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw)
      const dir = new THREE.Vector3(-fx * Math.cos(state.pitch), Math.sin(state.pitch), -fz * Math.cos(state.pitch)).normalize()
      let camDist = Math.min(22, Math.max(CAMERA_DIST, CAMERA_DIST + spread * 0.6))
      raycaster.set(pivot, dir)
      raycaster.far = camDist
      const clipMeshes = state.mode === 'dungeon' ? interiorClipMeshes : buildingClipMeshes
      const hits = clipMeshes.length ? raycaster.intersectObjects(clipMeshes, false) : []
      if (hits[0]) camDist = Math.max(2.2, hits[0].distance - 0.4)
      camera.position.copy(pivot).addScaledVector(dir, camDist)
      camera.lookAt(pivot)
    }

    // ── Input ── two independent players share this one keyboard: Player 1
    // is WASD + mouse-look (steers the shared camera), Player 2 is the
    // arrow-key cluster + Slash/Period/Comma, moving relative to wherever
    // that camera currently faces (no camera control of their own).
    const input1 = { forward: false, back: false, left: false, right: false, attackPressed: false, potionPressed: false, spellPressed: false, yawDelta: 0, pitchDelta: 0 }
    const input2 = { forward: false, back: false, left: false, right: false, attackPressed: false, potionPressed: false, spellPressed: false }
    function onKeyDown(e) {
      if (e.code === 'KeyI' && phaseRef.current === 'playing') {
        setModal(modalRef.current === 'gear' ? null : 'gear')
        return
      }
      if (phaseRef.current !== 'playing' || modalRef.current !== null) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Period', 'Comma'].includes(e.code)) e.preventDefault()
      if (e.code === 'KeyW') input1.forward = true
      if (e.code === 'KeyS') input1.back = true
      if (e.code === 'KeyA') input1.left = true
      if (e.code === 'KeyD') input1.right = true
      if (e.code === 'Space') input1.attackPressed = true
      if (e.code === 'KeyE') input1.potionPressed = true
      if (e.code === 'KeyF') input1.spellPressed = true
      if (e.code === 'ArrowUp') input2.forward = true
      if (e.code === 'ArrowDown') input2.back = true
      if (e.code === 'ArrowLeft') input2.left = true
      if (e.code === 'ArrowRight') input2.right = true
      if (e.code === 'Slash') input2.attackPressed = true
      if (e.code === 'Period') input2.spellPressed = true
      if (e.code === 'Comma') input2.potionPressed = true
    }
    function onKeyUp(e) {
      if (e.code === 'KeyW') input1.forward = false
      if (e.code === 'KeyS') input1.back = false
      if (e.code === 'KeyA') input1.left = false
      if (e.code === 'KeyD') input1.right = false
      if (e.code === 'ArrowUp') input2.forward = false
      if (e.code === 'ArrowDown') input2.back = false
      if (e.code === 'ArrowLeft') input2.left = false
      if (e.code === 'ArrowRight') input2.right = false
    }
    function onMouseMove(e) {
      if (document.pointerLockElement === renderer.domElement) {
        input1.yawDelta -= e.movementX * MOUSE_SENSITIVITY
        input1.pitchDelta -= e.movementY * MOUSE_SENSITIVITY
      }
    }
    function onClick() {
      if (phaseRef.current === 'playing' && modalRef.current === null) renderer.domElement.requestPointerLock?.()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('click', onClick)

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // ── HUD writer (direct DOM mutation — avoids per-frame React re-render) ──
    function writeHud(state) {
      const p = state.player
      if (hpFillRef.current) hpFillRef.current.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`
      if (hpTextRef.current) hpTextRef.current.textContent = `❤️ ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`
      if (xpFillRef.current) xpFillRef.current.style.width = `${Math.max(0, Math.min(1, p.xp / p.xpNext)) * 100}%`
      if (manaFillRef.current) manaFillRef.current.style.width = `${Math.max(0, (p.mana / p.maxMana) * 100)}%`
      if (manaTextRef.current) manaTextRef.current.textContent = `🔮 ${Math.floor(p.mana)}/${p.maxMana}`
      if (levelTextRef.current) levelTextRef.current.textContent = `Lv.${p.level}`
      if (goldTextRef.current) goldTextRef.current.textContent = `🪙 ${p.gold}`
      if (potionTextRef.current) potionTextRef.current.textContent = `🧃 x${p.potions}`

      if (state.twoPlayer) {
        const p2 = state.player2
        if (hpFillRef2.current) hpFillRef2.current.style.width = `${Math.max(0, (p2.hp / p2.maxHp) * 100)}%`
        if (hpTextRef2.current) hpTextRef2.current.textContent = `❤️ ${Math.max(0, Math.ceil(p2.hp))}/${p2.maxHp}`
        if (xpFillRef2.current) xpFillRef2.current.style.width = `${Math.max(0, Math.min(1, p2.xp / p2.xpNext)) * 100}%`
        if (manaFillRef2.current) manaFillRef2.current.style.width = `${Math.max(0, (p2.mana / p2.maxMana) * 100)}%`
        if (manaTextRef2.current) manaTextRef2.current.textContent = `🔮 ${Math.floor(p2.mana)}/${p2.maxMana}`
        if (levelTextRef2.current) levelTextRef2.current.textContent = `Lv.${p2.level}`
        if (goldTextRef2.current) goldTextRef2.current.textContent = `🪙 ${p2.gold}`
        if (potionTextRef2.current) potionTextRef2.current.textContent = `🧃 x${p2.potions}`
      }

      if (bannerRef.current) {
        if (state.banner) {
          bannerRef.current.style.opacity = state.bannerTimer > 0.4 ? 1 : state.bannerTimer / 0.4
          bannerRef.current.style.visibility = 'visible'
          bannerRef.current.style.color = state.banner.color
          bannerRef.current.textContent = `${state.banner.icon} ${state.banner.text}`
        } else {
          bannerRef.current.style.visibility = 'hidden'
        }
      }
      if (announcerRef.current) {
        announcerRef.current.style.opacity = state.announcerTimer > 0.5 ? 0.95 : Math.max(0, state.announcerTimer / 0.5) * 0.95
        announcerRef.current.textContent = `🔮 MC Marv: "${state.announcerText}"`
      }

      const boss = state.mode === 'dungeon' ? state.sites[state.activeSite].monsters.find(m => m.isBoss && !m.dead) : null
      if (bossBarRef.current) {
        if (boss) {
          bossBarRef.current.style.visibility = 'visible'
          bossNameRef.current.textContent = boss.name
          bossFillRef.current.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`
        } else {
          bossBarRef.current.style.visibility = 'hidden'
        }
      }

      if (compassRef.current) {
        if (state.compass) {
          compassRef.current.style.visibility = 'visible'
          const rel = state.compass.bearing - state.yaw
          compassArrowRef.current.style.transform = `rotate(${rel}rad)`
          compassRef.current.querySelector('span').textContent = `${state.compass.name} — ${Math.round(state.compass.dist)}m`
        } else {
          compassRef.current.style.visibility = 'hidden'
        }
      }

      if (controlsHintRef.current) {
        const t = Math.max(0, 16 - state.elapsed)
        controlsHintRef.current.style.opacity = Math.min(1, t / 2)
        controlsHintRef.current.style.display = t <= 0 ? 'none' : 'block'
      }

      if (teleportFlashRef.current) {
        teleportFlashRef.current.style.opacity = state.teleportFlash > 0 ? state.teleportFlash / 0.4 : 0
      }

      if (safeZoneBadgeRef.current) {
        safeZoneBadgeRef.current.style.visibility = state.inSafeZone ? 'visible' : 'hidden'
      }
    }

    let lastTime = performance.now()
    function step() {
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const state = stateRef.current

      if (phaseRef.current === 'playing' && modalRef.current === null && state) {
        update(state, input1, input2, dt, { setPhase, setWinStats })
        if (state.justTeleported) handleTeleport(state, state.justTeleported)
        if (state.pendingClassPick) { state.pendingClassPick = false; setModal('classPick') }

        if (playerGroup) {
          playerGroup.position.set(state.player.x, 0, state.player.z)
          const flicker = state.player.invuln > 0 && Math.floor(state.player.invuln * 10) % 2 === 0
          playerGroup.userData.sprite.material.opacity = flicker ? 0.35 : 1
          const pKey = `${state.player.classId || 'none'}|${state.player.raceId || 'none'}`
          if (playerGroup.userData.appearanceKey !== pKey) {
            playerGroup.userData.appearanceKey = pKey
            playerGroup.userData.sprite.material.map = getPlayerTexture(state.player.classId, state.player.raceId)
            playerGroup.userData.sprite.material.needsUpdate = true
          }
        }
        if (player2Group) {
          player2Group.position.set(state.player2.x, 0, state.player2.z)
          const flicker2 = state.player2.invuln > 0 && Math.floor(state.player2.invuln * 10) % 2 === 0
          player2Group.userData.sprite.material.opacity = flicker2 ? 0.35 : 1
          const p2Key = `${state.player2.classId || 'none'}|${state.player2.raceId || 'none'}`
          if (player2Group.userData.appearanceKey !== p2Key) {
            player2Group.userData.appearanceKey = p2Key
            player2Group.userData.sprite.material.map = getPlayerTexture(state.player2.classId, state.player2.raceId)
            player2Group.userData.sprite.material.needsUpdate = true
          }
        }
        syncMovers(state)
        syncChests()
        syncParticles(state)
        syncProjectiles(state)
        updateCamera(state)
        writeHud(state)
      }

      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    mount._teardownAll = teardownAll
    mount._buildWorld = buildWorld

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      teardownAll()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  function startGame() {
    const state = mkInitialState(twoPlayer)
    stateRef.current = state
    markContestant(state)
    const mount = mountRef.current
    mount._teardownAll?.()
    mount._buildWorld?.(state)
    setModal(null)
    setPhase('playing')
  }

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.mount} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>

      {phase === 'playing' && modal === null && (
        <button className={styles.gearButton} onClick={() => setModal('gear')}>🎒 Gear (I)</button>
      )}

      {phase === 'playing' && (
        <div className={styles.hud}>
          <div ref={teleportFlashRef} className={styles.teleportFlash} />
          <div className={styles.crosshair} />
          <div className={styles.statsPanel}>
            {twoPlayer && <span className={styles.playerTag}>P1</span>}
            <div className={styles.hpBar}><div ref={hpFillRef} className={styles.hpFill} /></div>
            <div ref={hpTextRef} className={styles.hpText}>❤️ 40/40</div>
            <div className={styles.xpBar}><div ref={xpFillRef} className={styles.xpFill} /></div>
            <div className={styles.manaBar}><div ref={manaFillRef} className={styles.manaFill} /></div>
            <div ref={manaTextRef} className={styles.manaText}>🔮 40/40</div>
            <div ref={levelTextRef} className={styles.levelText}>Lv.1</div>
            <div className={styles.row}>
              <span ref={goldTextRef}>🪙 0</span>
              <span ref={potionTextRef}>🧃 x1</span>
            </div>
          </div>

          {twoPlayer && (
            <div className={`${styles.statsPanel} ${styles.statsPanel2}`}>
              <span className={styles.playerTag}>P2</span>
              <div className={styles.hpBar}><div ref={hpFillRef2} className={styles.hpFill} /></div>
              <div ref={hpTextRef2} className={styles.hpText}>❤️ 40/40</div>
              <div className={styles.xpBar}><div ref={xpFillRef2} className={styles.xpFill} /></div>
              <div className={styles.manaBar}><div ref={manaFillRef2} className={styles.manaFill} /></div>
              <div ref={manaTextRef2} className={styles.manaText}>🔮 40/40</div>
              <div ref={levelTextRef2} className={styles.levelText}>Lv.1</div>
              <div className={styles.row}>
                <span ref={goldTextRef2}>🪙 0</span>
                <span ref={potionTextRef2}>🧃 x1</span>
              </div>
            </div>
          )}

          <div ref={compassRef} className={styles.compass}>
            <div ref={compassArrowRef} className={styles.compassArrow}>▲</div>
            <span>—</span>
          </div>

          <div ref={safeZoneBadgeRef} className={styles.safeZoneBadge}>🛡️ Safe Zone — no monsters can reach you here</div>

          <div ref={bossBarRef} className={styles.bossBar}>
            <div ref={bossNameRef} className={styles.bossName} />
            <div className={styles.bossTrack}><div ref={bossFillRef} className={styles.bossFill} /></div>
          </div>

          <div ref={bannerRef} className={styles.banner} />
          <div ref={announcerRef} className={styles.announcer} />
          <div ref={controlsHintRef} className={styles.controlsHint}>
            {twoPlayer
              ? 'P1: W/S move · A/D turn · click to mouse-look · Space attack · F magic · E potion — P2: Arrows move · / attack · . magic · , potion — I gear'
              : 'W/S move · A/D turn · click to mouse-look · Space attack · F magic · E potion — I gear'}
          </div>
        </div>
      )}

      {modal === 'gear' && gearSnapshot && (() => {
        const snap = gearSnapshot[gearTab]
        return (
          <div className={styles.overlay} onClick={() => setModal(null)}>
            <div className={styles.card} onClick={e => e.stopPropagation()}>
              <h1 className={styles.title}>🎒 Gear</h1>
              <p className={styles.tagline}>Pick your own weapon, armor, and spell — press I or click outside to close.</p>

              {twoPlayer && (
                <div className={styles.gearTabs}>
                  <button className={`${styles.gearTabBtn} ${gearTab === 'p1' ? styles.gearTabActive : ''}`} onClick={() => setGearTab('p1')}>Player 1</button>
                  <button className={`${styles.gearTabBtn} ${gearTab === 'p2' ? styles.gearTabActive : ''}`} onClick={() => setGearTab('p2')}>Player 2</button>
                </div>
              )}

              <div className={styles.gearSection}>
                <h2 className={styles.gearHeading}>Weapons</h2>
                {snap.weapons.length === 0 && <p className={styles.gearEmpty}>No weapons found yet — open chests in a dungeon!</p>}
                <div className={styles.gearList}>
                  {snap.weapons.map(w => {
                    const equipped = snap.weaponName === w.name
                    return (
                      <button key={w.name} className={`${styles.gearItem} ${equipped ? styles.gearItemActive : ''}`} onClick={() => handleEquipWeapon(w)} disabled={equipped}>
                        <span className={styles.gearItemEmoji}>{w.emoji}</span>
                        <span className={styles.gearItemName}>{w.name}</span>
                        <span className={styles.gearItemStat}>+{w.atk} ATK</span>
                        {equipped && <span className={styles.equippedTag}>Equipped</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.gearSection}>
                <h2 className={styles.gearHeading}>Armor</h2>
                {snap.armors.length === 0 && <p className={styles.gearEmpty}>No armor found yet — open chests in a dungeon!</p>}
                <div className={styles.gearList}>
                  {snap.armors.map(a => {
                    const equipped = snap.armorName === a.name
                    return (
                      <button key={a.name} className={`${styles.gearItem} ${equipped ? styles.gearItemActive : ''}`} onClick={() => handleEquipArmor(a)} disabled={equipped}>
                        <span className={styles.gearItemEmoji}>{a.emoji}</span>
                        <span className={styles.gearItemName}>{a.name}</span>
                        <span className={styles.gearItemStat}>+{a.def} DEF</span>
                        {equipped && <span className={styles.equippedTag}>Equipped</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.gearSection}>
                <h2 className={styles.gearHeading}>Spells</h2>
                <div className={styles.gearList}>
                  {snap.spells.map(s => {
                    const def = SPELLS.find(sp => sp.id === s.id)
                    const equipped = snap.equippedSpellId === s.id
                    return (
                      <button key={s.id} className={`${styles.gearItem} ${equipped ? styles.gearItemActive : ''}`} onClick={() => handleEquipSpell(s.id)} disabled={equipped}>
                        <span className={styles.gearItemEmoji}>{def.emoji}</span>
                        <span className={styles.gearItemName}>{def.name}</span>
                        <span className={styles.gearItemStat}>Lv.{s.level}</span>
                        {equipped && <span className={styles.equippedTag}>Equipped</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button className={styles.startButton} onClick={() => setModal(null)}>Back To The Fight →</button>
            </div>
          </div>
        )
      })()}

      {modal === 'classPick' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>✨ Choose Your Path</h1>
            <p className={styles.tagline}>
              {twoPlayer ? 'Three dungeons in — time for both players to specialize. Pick one of each, permanently.' : 'Three dungeons in — time to specialize. Pick one of each, permanently.'}
            </p>

            {(twoPlayer ? [['p1', 'Player 1'], ['p2', 'Player 2']] : [['p1', null]]).map(([key, label]) => (
              <div key={key} className={styles.pickPlayerBlock}>
                {label && <h2 className={styles.pickPlayerHeading}>{label}</h2>}
                <p className={styles.pickLabel}>Class</p>
                <div className={styles.pickRow}>
                  {CLASSES.map(c => (
                    <button
                      key={c.id}
                      className={`${styles.pickCard} ${classPick[key].classId === c.id ? styles.pickCardActive : ''}`}
                      onClick={() => setClassPick(cp => ({ ...cp, [key]: { ...cp[key], classId: c.id } }))}
                    >
                      <span className={styles.pickCardEmoji}>{c.emoji}</span>
                      <span className={styles.pickCardName}>{c.name}</span>
                      <span className={styles.pickCardDesc}>{c.desc}</span>
                    </button>
                  ))}
                </div>
                <p className={styles.pickLabel}>Race</p>
                <div className={styles.pickRow}>
                  {RACES.map(r => (
                    <button
                      key={r.id}
                      className={`${styles.pickCard} ${classPick[key].raceId === r.id ? styles.pickCardActive : ''}`}
                      onClick={() => setClassPick(cp => ({ ...cp, [key]: { ...cp[key], raceId: r.id } }))}
                    >
                      <span className={styles.pickCardEmoji}>{r.emoji}</span>
                      <span className={styles.pickCardName}>{r.name}</span>
                      <span className={styles.pickCardDesc}>{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              className={styles.startButton}
              disabled={!classPick.p1.classId || !classPick.p1.raceId || (twoPlayer && (!classPick.p2.classId || !classPick.p2.raceId))}
              onClick={confirmClassRace}
            >
              Confirm →
            </button>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>{twoPlayer ? '🧒 👦 🔮' : '🧒 🔮'}</div>
            <h1 className={styles.title}>Dungeon Crawler Max: Free Roam</h1>
            <p className={styles.tagline}>The Game Show Goes Open World!</p>
            <p className={styles.story}>
              {twoPlayer
                ? "Same game show, bigger stage — and it's a two-player affair! Grab a second person for the keyboard, because you're both free to roam a whole wide-open world together — "
                : "Same game show, bigger stage — now a whole wide-open world to roam solo — "}
              eighteen dungeon buildings are scattered around the map, each guarded by its own boss,
              building toward whoever's really running this show. Walk up to a door and you'll{twoPlayer ? ' both ' : ' '}be
              teleported straight inside; find the exit to teleport back out. Floating host MC Marv is
              narrating from somewhere overhead. Fighting isn't just fists anymore — swing whatever's
              in your hands, or fling one of five spells you find as scrolls and level up over time.
              Chests also drop weapons and armor you pick from and equip yourself in the Gear menu
              {twoPlayer ? ' — each player keeps their own stash' : ''}. Three dungeons in, you'll{twoPlayer ? ' both ' : ' '}
              pick a class and race that permanently shape your stats. Feeling outmatched? Home Base and
              several Rest Stops scattered across the field are safe zones — no monster can follow you in.
              Explore, fight, loot, and clear every dungeon to win the show. Getting knocked out is still
              just a free respawn — this game show has excellent insurance.
            </p>
            <p className={styles.pickLabel}>Players</p>
            <div className={styles.pickRow}>
              <button
                className={`${styles.pickCard} ${!twoPlayer ? styles.pickCardActive : ''}`}
                onClick={() => setTwoPlayer(false)}
              >
                <span className={styles.pickCardEmoji}>🧍</span>
                <span className={styles.pickCardName}>1 Player</span>
                <span className={styles.pickCardDesc}>Just you, WASD + mouse-look.</span>
              </button>
              <button
                className={`${styles.pickCard} ${twoPlayer ? styles.pickCardActive : ''}`}
                onClick={() => setTwoPlayer(true)}
              >
                <span className={styles.pickCardEmoji}>🧑‍🤝‍🧑</span>
                <span className={styles.pickCardName}>2 Player</span>
                <span className={styles.pickCardDesc}>Share the keyboard — P2 takes the arrow-key cluster.</span>
              </button>
            </div>
            <div className={styles.controls}>
              <span><b>{twoPlayer ? 'P1 Move' : 'Move'}</b> — W / S</span>
              <span><b>{twoPlayer ? 'P1 Turn' : 'Turn'}</b> — A / D</span>
              <span><b>{twoPlayer ? 'P1 Look' : 'Look'}</b> — click + mouse</span>
              <span><b>{twoPlayer ? 'P1 Attack' : 'Attack'}</b> — Space</span>
              <span><b>{twoPlayer ? 'P1 Magic' : 'Magic'}</b> — F</span>
              <span><b>{twoPlayer ? 'P1 Potion' : 'Potion'}</b> — E</span>
              {twoPlayer && <span><b>P2 Move</b> — Arrow keys</span>}
              {twoPlayer && <span><b>P2 Attack</b> — /</span>}
              {twoPlayer && <span><b>P2 Magic</b> — .</span>}
              {twoPlayer && <span><b>P2 Potion</b> — ,</span>}
              <span><b>Gear</b> — I</span>
            </div>
            <button className={styles.startButton} onClick={startGame}>Step Into The World →</button>
          </div>
        </div>
      )}

      {phase === 'win' && winStats && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>🏆 You Win The Game Show!</h1>
            <p className={styles.story}>MC Marv: "Ladies, gentlemen, and hamsters everywhere — we have a CHAMPION!"</p>
            <div className={styles.statsList}>
              <div>Final Level: <b>{winStats.level}</b></div>
              <div>Gold Collected: <b>{winStats.gold}</b> 🪙</div>
              <div>Achievements: <b>{winStats.achievements.length}/{winStats.totalAchievements}</b></div>
            </div>
            <ul className={styles.achList}>
              {winStats.achievements.map(name => (<li key={name}>🏅 {name}</li>))}
            </ul>
            <button className={styles.startButton} onClick={startGame}>Play Again</button>
          </div>
        </div>
      )}
    </div>
  )
}
