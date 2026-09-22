import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './DungeonCrawlerFreeRoam.module.css'
import { loadSharedCoins, syncSharedCoins } from '../../shared/sharedCoins.js'
import {
  mkInitialState, update, markContestant, equipWeapon, equipArmor, equipSpell,
  chooseClassRace, CLASSES, RACES, SPELLS, players,
  hasSavedGame, loadSavedGame, saveGame,
  PET_DEFS, activePetInfo, setActivePet,
  shopBuyPotion, shopBuyWeapon, shopBuyArmor, shopLearnOrLevelSpell, shopTrainPet,
  acceptQuest, WEAPONS, ARMORS, lootTierFor, CHEST_TIERS, CHEST_THEMES,
  SHOP_POTION_COST, SHOP_PET_TRAIN_COST,
} from './gameEngine.js'
import {
  WORLD_HALF, MOUSE_SENSITIVITY, CAMERA_DIST, SPELL_RADIUS,
  TOTAL_FLOORS, CLASS_RACE_FLOOR, FLOOR_FLASH_TIME, SAFE_ZONE_HOME_RADIUS, MINI_DUNGEON_WALL_HEIGHT,
  VILLAGE_START_FLOOR, MAX_SPELL_LEVEL,
} from './constants.js'

// ── Dungeon Crawler Max: Free Roam ──────────────────────────────────────
// Same kid-safe "game show dungeon" universe as Dungeon Crawler Max, now
// a sequence of floors instead of house-shaped buildings: every floor is
// one big, empty, foggy plane — no rooms, no walls — with monsters
// roaming it and exactly one staircase hidden far from spawn (the final
// floor has no staircase; its boss guards the way out instead). Follows
// this hub's existing 3D-open-world convention (loot-and-scoot,
// dog-man-dash): engine/component split, tank-turn keyboard controls with
// optional pointer-lock mouse-look, third-person chase camera,
// AABB/circle collision against plain data. Player, monsters, boss,
// chests are canvas-emoji billboard sprites — reuses the 2D game's
// visual language instead of needing 3D character models.

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

// A reusable "Y stats" readout — one canvas/texture per creature/player,
// redrawn in place (not recreated) each time its text actually changes, so
// toggling it on doesn't allocate a fresh texture for every entity every
// frame. Hidden by default; DungeonCrawlerFreeRoam flips .visible based on
// showStatsRef and refreshes the text from the live entity each frame.
function createStatsLabel() {
  const canvas = document.createElement('canvas')
  canvas.width = 200; canvas.height = 44
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.renderOrder = 11
  sprite.scale.set((canvas.width / canvas.height) * 0.85, 0.85, 1)
  sprite.visible = false
  sprite.userData.canvas = canvas
  sprite.userData.ctx = ctx
  sprite.userData.tex = tex
  sprite.userData.lastText = null
  return sprite
}
function setStatsLabelText(sprite, text, color) {
  if (sprite.userData.lastText === text) return
  sprite.userData.lastText = text
  const { ctx, canvas, tex } = sprite.userData
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = color || '#ffffff'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  tex.needsUpdate = true
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
// A chest's own emoji shows its theme (weapon/armor/magic/treasure/boss)
// at a glance; the tier color tint layered on top shows its rarity —
// two independent signals sharing one sprite instead of a generic 🎁.
function makeChestMover(c) {
  const theme = CHEST_THEMES.find(t => t.id === c.theme) || CHEST_THEMES.find(t => t.id === 'treasure')
  const grp = makeMover(theme.emoji, 1.1)
  grp.position.set(c.x, 0, c.z)
  grp.visible = !c.opened
  grp.userData.sprite.material.color.copy(new THREE.Color(CHEST_TIERS[c.tierIdx ?? 0].color))
  return grp
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
function getPlayerTexture(classId, raceId, weaponName, armorName) {
  const key = `${classId || 'none'}|${raceId || 'none'}|${weaponName || 'none'}|${armorName || 'none'}`
  let tex = playerTextureCache.get(key)
  if (tex) return tex
  const cls = CLASSES.find(c => c.id === classId)
  const race = RACES.find(rc => rc.id === raceId)
  const weapon = WEAPONS.find(w => w.name === weaponName)
  const armor = ARMORS.find(a => a.name === armorName)
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

  // Held weapon reflects whatever's actually equipped — drawing the real
  // item's own emoji instead of a fixed silver line, so equipping a new
  // one now visibly changes the character, not just the attack stat.
  if (weapon) {
    ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = r * 0.14
    ctx.beginPath(); ctx.moveTo(r * 0.75, r * 0.35); ctx.lineTo(r * 1.1, -r * 0.5); ctx.stroke()
    ctx.font = `${Math.round(r * 0.85)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(weapon.emoji, r * 1.2, -r * 0.65)
  } else if (cls?.id === 'mage') {
    // No weapon found yet — mages still carry their basic wand.
    ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = r * 0.16
    ctx.beginPath(); ctx.moveTo(r * 0.75, r * 0.35); ctx.lineTo(r * 1.15, -r * 0.55); ctx.stroke()
    ctx.fillStyle = '#c9a6ff'
    ctx.beginPath(); ctx.arc(r * 1.15, -r * 0.55, r * 0.14, 0, Math.PI * 2); ctx.fill()
  }

  // A small badge showing the equipped armor — cheaper than a full
  // worn-look redraw per piece, but still visibly changes on equip.
  if (armor) {
    ctx.font = `${Math.round(r * 0.5)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(armor.emoji, 0, r * 0.28)
  }

  tex = new THREE.CanvasTexture(canvas)
  playerTextureCache.set(key, tex)
  return tex
}
function makePlayerMover(classId, raceId, weaponName, armorName, worldScale) {
  return makeMoverFromTexture(getPlayerTexture(classId, raceId, weaponName, armorName), worldScale)
}

// One big speckled floor texture per theme color — each floor gets its
// own tint instead of every floor looking like the same patch of grass,
// which matters now that the whole game is this one texture repeated
// over a huge empty plane instead of small maze-room floors.
const floorTextureCache = new Map()
function makeFloorTexture(hex) {
  let tex = floorTextureCache.get(hex)
  if (tex) return tex
  const [r0, g0, b0] = hexToRgb01(hex).map(v => Math.round(v * 255))
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = hex
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1100; i++) {
    const jitter = () => Math.max(0, Math.min(255, Math.round(rand(-26, 26))))
    ctx.fillStyle = `rgba(${clampByte(r0 + jitter())},${clampByte(g0 + jitter())},${clampByte(b0 + jitter())},0.5)`
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(WORLD_HALF / 5, WORLD_HALF / 5)
  floorTextureCache.set(hex, tex)
  return tex
}
function clampByte(v) { return Math.max(0, Math.min(255, v)) }
function rand(a, b) { return a + Math.random() * (b - a) }

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

// A soft vertical glow column, tinted per-theme — reused for both the
// staircase and the final altar so each is spottable from a real
// distance (not across the whole foggy floor, but well before you're
// standing on top of it) without needing an on-screen waypoint.
const glowMaterialCache = new Map()
function getGlowMaterial(hex) {
  let mat = glowMaterialCache.get(hex)
  if (mat) return mat
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const c = size / 2
  const [r, g, b] = hexToRgb01(hex).map(v => Math.round(v * 255))
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.85)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  glowMaterialCache.set(hex, mat)
  return mat
}

// A staircase descending into the ground — no label sprite (that would
// give its exact position away from across the floor), but the glow
// column and a bright, wide-range torch make it noticeable once you're
// exploring anywhere near it.
function buildStaircaseMesh(pos, theme) {
  const grp = new THREE.Group()
  const stepMat = new THREE.MeshLambertMaterial({ color: theme.wallColor })
  const stepCount = 8
  for (let i = 0; i < stepCount; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.7), stepMat)
    step.position.set(0, -i * 0.45, -i * 1.5)
    grp.add(step)
  }
  const pit = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 20),
    new THREE.MeshBasicMaterial({ color: 0x050505 }),
  )
  pit.rotation.x = -Math.PI / 2
  pit.position.set(0, 0.03, -(stepCount - 1) * 1.5)
  grp.add(pit)
  const torch = new THREE.PointLight(theme.accent, 1.8, 40)
  torch.position.set(0, 2.2, -2)
  grp.add(torch)
  const beacon = new THREE.Sprite(getGlowMaterial(theme.accent))
  beacon.scale.set(3.5, 18, 1)
  beacon.position.set(0, 9, -2)
  grp.add(beacon)
  grp.position.set(pos.x, 0, pos.z)
  return grp
}

// The final floor has no staircase — this dark, ominous marker sits where
// its boss lurks instead. Its glow reads as a warning, not an invitation.
function buildFinalAltarMesh(pos, theme) {
  const grp = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 2.1, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a1414 }),
  )
  base.position.y = 0.5
  grp.add(base)
  const glow = new THREE.PointLight(0xff3355, 1.8, 40)
  glow.position.set(0, 1.8, 0)
  grp.add(glow)
  const beacon = new THREE.Sprite(getGlowMaterial('#ff3355'))
  beacon.scale.set(3.5, 18, 1)
  beacon.position.set(0, 9, 0)
  grp.add(beacon)
  grp.position.set(pos.x, 0, pos.z)
  return grp
}

// A mini dungeon's walls are already plain data in world coordinates
// (`dungeon.walls`, the same rects the engine uses for collision) — this
// just turns each rect into a matching box, plus one torch at the center.
function buildMiniDungeonMesh(dungeon, theme) {
  const grp = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color: theme.wallColor })
  for (const r of dungeon.walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(r.w, MINI_DUNGEON_WALL_HEIGHT, r.d), mat)
    wall.position.set(r.x, MINI_DUNGEON_WALL_HEIGHT / 2, r.z)
    grp.add(wall)
  }
  const torch = new THREE.PointLight(theme.accent, 1.1, 24)
  torch.position.set(dungeon.x, MINI_DUNGEON_WALL_HEIGHT * 0.85, dungeon.z)
  grp.add(torch)
  return grp
}

// A handful of small, friendly house shapes scattered around the
// village's safe-zone center — purely decorative (the actual General
// Store/Blacksmith/Enchanter/Pet Trainer/Quests are one shared modal, see
// the 'village' modal below), just enough to read as a settlement rather
// than another dungeon structure.
function buildVillageMesh(village, theme) {
  const grp = new THREE.Group()
  const wallMat = new THREE.MeshLambertMaterial({ color: '#c9a876' })
  const roofMat = new THREE.MeshLambertMaterial({ color: theme.accent })
  const layout = [
    { dx: -8, dz: -6, w: 4.5, d: 4.5, h: 3.2 },
    { dx: 7, dz: -4, w: 4, d: 4, h: 2.8 },
    { dx: -2, dz: 8, w: 5, d: 4, h: 3.4 },
    { dx: 8, dz: 6, w: 3.6, d: 3.6, h: 2.6 },
  ]
  for (const h of layout) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), wallMat)
    box.position.set(village.x + h.dx, h.h / 2, village.z + h.dz)
    grp.add(box)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(h.w * 0.8, 1.8, 4), roofMat)
    roof.rotation.y = Math.PI / 4
    roof.position.set(village.x + h.dx, h.h + 0.9, village.z + h.dz)
    grp.add(roof)
  }
  const lantern = new THREE.PointLight('#ffd68a', 1.2, 30)
  lantern.position.set(village.x, 5, village.z)
  grp.add(lantern)
  return grp
}

export default function DungeonCrawlerFreeRoam() {
  const [phase, setPhaseState] = useState('intro')
  const phaseRef = useRef('intro')
  const [winStats, setWinStats] = useState(null)
  // Defaults to whatever an existing save was recorded as, not a blind
  // "true" — otherwise a solo save opens with the 2 Player card still
  // highlighted, and Continue renders a whole second (unused, never-
  // updated) Player 2 stats panel next to the real one.
  const [twoPlayer, setTwoPlayer] = useState(() => {
    try {
      const saved = hasSavedGame() ? loadSavedGame() : null
      return saved ? !!saved.twoPlayer : true
    } catch { return true }
  })
  const mountRef = useRef(null)
  const stateRef = useRef(null)
  const rafRef = useRef(null)
  const lastSyncedGoldRef = useRef(0) // see ../../shared/sharedCoins.js
  // Toggled by Y — floats an HP/ATK/etc. readout over every player,
  // monster, crawler, boss, and active pet. Read every frame in the
  // render loop, so a ref (not React state) is enough.
  const showStatsRef = useRef(false)

  // modal is null | 'gear' | 'classPick' | 'map' — a single slot since only
  // one full-screen panel makes sense open at a time; every place that used
  // to check gearOpen now checks modal !== null so all three panels share
  // one pause/input-gating path.
  const [modal, setModalState] = useState(null)
  const modalRef = useRef(null)
  const [gearTab, setGearTab] = useState('p1')
  const [gearSnapshot, setGearSnapshot] = useState(null)
  const [mapSnapshot, setMapSnapshot] = useState(null)
  const [villageTab, setVillageTab] = useState('store')
  const [villageSnapshot, setVillageSnapshot] = useState(null)
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
  const floorBadgeRef = useRef(null)
  const safeZoneBadgeRef = useRef(null)
  const villagePromptRef = useRef(null)
  const petBadgeRef = useRef(null)
  const petBadgeRef2 = useRef(null)
  const controlsHintRef = useRef(null)
  const teleportFlashRef = useRef(null)

  function setPhase(p) { phaseRef.current = p; setPhaseState(p) }

  function snapshotPlayer(p) {
    return {
      weapons: [...p.weapons], armors: [...p.armors], spells: [...p.spells],
      weaponName: p.weaponName, armorName: p.armorName, equippedSpellId: p.equippedSpellId,
      pets: p.pets.map(pet => ({ ...pet })), activePetId: p.activePetId,
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
  // A frozen-in-time snapshot, not a live view — but since opening any
  // modal pauses update() entirely (see step()'s modalRef gate), nothing
  // in the world actually moves while the map is open, so "frozen" and
  // "live" are the exact same thing here.
  function refreshMapSnapshot() {
    const s = stateRef.current
    if (!s) return
    const floor = s.floor
    setMapSnapshot({
      floorIndex: floor.index, themeName: floor.theme.name, accent: floor.theme.accent, isFinal: floor.isFinal,
      staircase: floor.staircase,
      guardPoint: floor.bossGuardPoint, bossSpawned: floor.bossSpawned,
      chests: floor.chests.filter(c => !c.opened && !c.guaranteed).map(c => ({ x: c.x, z: c.z })),
      miniDungeons: floor.miniDungeons.map(d => ({ x: d.x, z: d.z, discovered: d.discovered })),
      village: floor.village ? { x: floor.village.x, z: floor.village.z, name: floor.village.name } : null,
      wildPets: floor.wildPets.filter(wp => !wp.tamed).map(wp => ({ x: wp.x, z: wp.z, name: PET_DEFS.find(d => d.id === wp.defId)?.name })),
      crawlers: floor.monsters.filter(m => m.isCrawler && !m.dead).map(m => ({ x: m.x, z: m.z, name: m.name })),
      boss: floor.monsters.find(m => m.isBoss && !m.dead) || null,
      players: players(s).map(p => ({ x: p.x, z: p.z })),
      twoPlayer: s.twoPlayer,
    })
  }
  function setModal(next) {
    modalRef.current = next
    setModalState(next)
    if (next) {
      if (next === 'gear') { setGearTab('p1'); refreshGearSnapshot() }
      if (next === 'classPick') setClassPick({ p1: emptyPick(), p2: emptyPick() })
      if (next === 'map') refreshMapSnapshot()
      if (next === 'village') { setVillageTab('store'); refreshVillageSnapshot() }
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
  function handleSetActivePet(petId) {
    setActivePet(stateRef.current, activeGearPlayer(), petId)
    refreshGearSnapshot()
  }

  // ── Village: General Store / Blacksmith / Enchanter / Pet Trainer /
  // Quests all live in one tabbed modal — see the 'village' modal below.
  // Always Player 1's wallet/gear, even in 2-player mode (matching the
  // shared-coins design: P1 carries the persistent, cross-game purse).
  function refreshVillageSnapshot() {
    const s = stateRef.current
    if (!s) return
    const p = s.player
    setVillageSnapshot({
      gold: p.gold, potions: p.potions, floorIndex: s.floor.index, lootTier: lootTierFor(s.floor.index),
      weapons: [...p.weapons], armors: [...p.armors], spells: [...p.spells],
      pets: p.pets.map(pet => ({ ...pet })), activePetId: p.activePetId,
      quest: p.quest ? { ...p.quest } : null, questsCompleted: p.questsCompleted,
    })
  }
  function handleBuyPotion() { shopBuyPotion(stateRef.current, stateRef.current.player); refreshVillageSnapshot() }
  function handleBuyWeapon(i) { shopBuyWeapon(stateRef.current, stateRef.current.player, stateRef.current.floor, i); refreshVillageSnapshot() }
  function handleBuyArmor(i) { shopBuyArmor(stateRef.current, stateRef.current.player, stateRef.current.floor, i); refreshVillageSnapshot() }
  function handleLearnSpell(id) { shopLearnOrLevelSpell(stateRef.current, stateRef.current.player, id); refreshVillageSnapshot() }
  function handleTrainPet() { shopTrainPet(stateRef.current, stateRef.current.player); refreshVillageSnapshot() }
  function handleAcceptQuest() { acceptQuest(stateRef.current, stateRef.current.player); refreshVillageSnapshot() }
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

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 550)
    camera.position.set(0, 8, 14)

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 0.85)
    sun.position.set(120, 180, 90)
    scene.add(sun)

    // One group holds everything for the *current* floor — ground,
    // decorations, safe zone, staircase/altar, chests. No more separate
    // "overworld" vs "dungeon interior" groups: every floor IS the whole
    // world while you're on it, and the whole group is torn down and
    // rebuilt fresh on every floor change (see buildFloorScene below).
    const worldGroup = new THREE.Group()
    scene.add(worldGroup)
    let floorStaticChildren = [] // ground/decor/safezone/staircase — not chests/monsters, which sync their own lifecycle

    const moverMap = new Map()
    const chestMap = new Map()
    const wildPetMap = new Map() // wild-pet object -> mover, same pattern as chestMap
    const activePetMoverMap = new Map() // 'p1'|'p2' -> mover, at most one each
    let playerGroup = null
    let player2Group = null

    const particleGeo = new THREE.BufferGeometry()
    const particlePos = new Float32Array(MAX_PARTICLES * 3)
    const particleCol = new Float32Array(MAX_PARTICLES * 3)
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3))
    const particlePoints = new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, sizeAttenuation: true }))
    scene.add(particlePoints)

    // Fixed-size pool of magic-bolt sprites — reused every cast instead of
    // allocated, same pooling trick as the particle buffer above.
    // Each bolt gets its own cloned material (same texture, separate
    // instance) so a potent/legendary cast can be tinted without recoloring
    // every other bolt sharing the pool.
    const projectilePool = Array.from({ length: MAX_PROJECTILES }, () => {
      const sprite = new THREE.Sprite(getSpellBoltMaterial().clone())
      sprite.scale.set(SPELL_RADIUS * 2.6, SPELL_RADIUS * 2.6, 1)
      sprite.visible = false
      scene.add(sprite)
      return sprite
    })
    const PROJECTILE_TIER_TINTS = ['#ffffff', '#ffd34d', '#ff5c3a']
    function syncProjectiles(state) {
      const list = state.projectiles
      for (let i = 0; i < MAX_PROJECTILES; i++) {
        const sprite = projectilePool[i]
        if (i < list.length) {
          const pr = list[i]
          sprite.visible = true
          sprite.position.set(pr.x, 1.3, pr.z)
          const scale = SPELL_RADIUS * 2.6 * (pr.visualScale || 1)
          sprite.scale.set(scale, scale, 1)
          sprite.material.color.set(PROJECTILE_TIER_TINTS[pr.tierIdx || 0])
        } else {
          sprite.visible = false
        }
      }
    }

    function teardownFloorStatics() {
      for (const child of floorStaticChildren) worldGroup.remove(child)
      floorStaticChildren = []
    }
    function teardownFloorEntities() {
      for (const grp of moverMap.values()) grp.parent?.remove(grp)
      moverMap.clear()
      for (const grp of chestMap.values()) grp.parent?.remove(grp)
      chestMap.clear()
      for (const grp of wildPetMap.values()) grp.parent?.remove(grp)
      wildPetMap.clear()
      // Active pets are NOT torn down here — they're owned by the player,
      // not the floor, so they should keep following across a descend.
    }
    function teardownAll() {
      teardownFloorStatics()
      teardownFloorEntities()
      if (playerGroup) { scene.remove(playerGroup); playerGroup = null }
      if (player2Group) { scene.remove(player2Group); player2Group = null }
    }

    // Includes weaponName/armorName so equipping something new (or
    // resuming a save with gear already equipped) is reflected visually,
    // not just in the attack/defense stats.
    function appearanceKeyFor(p) {
      return `${p.classId || 'none'}|${p.raceId || 'none'}|${p.weaponName || 'none'}|${p.armorName || 'none'}`
    }
    function statsTextForPlayer(p) {
      return `Lv.${p.level}  ❤${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}  ⚔${p.atk}  🛡${p.def}`
    }

    function buildPlayers(state) {
      playerGroup = makePlayerMover(state.player.classId, state.player.raceId, state.player.weaponName, state.player.armorName, 1.6)
      playerGroup.userData.appearanceKey = appearanceKeyFor(state.player)
      const statsLabel1 = createStatsLabel()
      statsLabel1.position.y = 2.2
      playerGroup.add(statsLabel1)
      playerGroup.userData.statsSprite = statsLabel1
      scene.add(playerGroup)
      if (state.twoPlayer) {
        player2Group = makePlayerMover(state.player2.classId, state.player2.raceId, state.player2.weaponName, state.player2.armorName, 1.6)
        player2Group.userData.appearanceKey = appearanceKeyFor(state.player2)
        const statsLabel2 = createStatsLabel()
        statsLabel2.position.y = 2.2
        player2Group.add(statsLabel2)
        player2Group.userData.statsSprite = statsLabel2
        scene.add(player2Group)
      }
    }

    // Every floor gets its own moody, foggy atmosphere from its theme
    // colors — there's no bright outdoor "overworld" mode anymore, every
    // floor reads as its own vast dungeon level. Fog is deliberately not
    // razor-sharp-visible-forever: the far distance stays hazy so a
    // staircase hundreds of units away can't just be spotted from spawn.
    function applyFloorAtmosphere(theme) {
      const bg = darkenHex(theme.wallColor, 0.46)
      scene.background = bg
      scene.fog = new THREE.Fog(bg.getHex(), 55, 300)
      ambient.intensity = 0.68
      sun.color.set(theme.accent)
      sun.intensity = 0.45
    }

    function buildFloorScene(state) {
      teardownFloorStatics()
      teardownFloorEntities()
      const floor = state.floor
      const theme = floor.theme

      const ground = new THREE.Mesh(
        new THREE.BoxGeometry(WORLD_HALF * 2, 1, WORLD_HALF * 2),
        new THREE.MeshLambertMaterial({ map: makeFloorTexture(theme.floorColor) }),
      )
      ground.position.y = -0.5
      worldGroup.add(ground)
      floorStaticChildren.push(ground)

      for (let i = 0; i < 90; i++) {
        const x = (Math.random() * 2 - 1) * (WORLD_HALF - 15)
        const z = (Math.random() * 2 - 1) * (WORLD_HALF - 15)
        if (Math.hypot(x, z) < 30) continue // keep the immediate spawn area clear
        const deco = makeDecoration()
        deco.position.set(x, 0, z)
        worldGroup.add(deco)
        floorStaticChildren.push(deco)
      }

      for (const dungeon of floor.miniDungeons) {
        const grp = buildMiniDungeonMesh(dungeon, theme)
        worldGroup.add(grp); floorStaticChildren.push(grp)
      }

      if (floor.village) {
        const grp = buildVillageMesh(floor.village, theme)
        worldGroup.add(grp); floorStaticChildren.push(grp)
      }

      for (const zone of state.safeZones) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(zone.r - 0.4, zone.r, 48),
          new THREE.MeshBasicMaterial({ color: 0x7cff9e, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.set(zone.x, 0.05, zone.z)
        worldGroup.add(ring); floorStaticChildren.push(ring)
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(zone.r, 48),
          new THREE.MeshBasicMaterial({ color: 0x7cff9e, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
        )
        glow.rotation.x = -Math.PI / 2
        glow.position.set(zone.x, 0.03, zone.z)
        worldGroup.add(glow); floorStaticChildren.push(glow)
        const label = makeLabelSprite(`🛡️ ${zone.name}`, '#7CFF9E')
        label.position.set(zone.x, 2.4, zone.z)
        worldGroup.add(label); floorStaticChildren.push(label)
      }

      if (floor.staircase) {
        const stairs = buildStaircaseMesh(floor.staircase, theme)
        worldGroup.add(stairs); floorStaticChildren.push(stairs)
      } else {
        const altar = buildFinalAltarMesh(floor.bossGuardPoint, theme)
        worldGroup.add(altar); floorStaticChildren.push(altar)
      }

      for (const c of floor.chests) {
        const grp = makeChestMover(c)
        worldGroup.add(grp)
        chestMap.set(c, grp)
      }

      for (const wp of floor.wildPets) {
        const def = PET_DEFS.find(d => d.id === wp.defId)
        const grp = makeCreatureMover(def, 0.9)
        grp.position.set(wp.x, 0, wp.z)
        const label = makeLabelSprite(`🐾 ${def.name}`, '#7CFF9E')
        label.position.y = 1.7
        grp.add(label)
        worldGroup.add(grp)
        wildPetMap.set(wp, grp)
      }

      applyFloorAtmosphere(theme)
    }

    function syncMovers(state) {
      const monsters = state.floor.monsters
      const seen = new Set()
      for (const m of monsters) {
        seen.add(m.id)
        let grp = moverMap.get(m.id)
        if (!grp) {
          const worldScale = m.isBoss ? 3.0 : (m.isCrawler ? 1.7 : 1.3)
          grp = makeCreatureMover(m, worldScale)
          let statsY = worldScale + 0.6
          if (m.isBoss || m.isCrawler) {
            const label = makeLabelSprite(m.name, m.isCrawler ? '#ffcc99' : '#ffffff')
            label.position.y = m.isBoss ? 3.6 : 2.3
            grp.add(label)
            statsY = label.position.y + 0.5
          }
          const statsLabel = createStatsLabel()
          statsLabel.position.y = statsY
          grp.add(statsLabel)
          grp.userData.statsSprite = statsLabel
          worldGroup.add(grp)
          moverMap.set(m.id, grp)
        }
        grp.position.set(m.x, 0, m.z)
        grp.visible = !m.dead
        if (m.hp < m.maxHp && !m.isBoss) {
          grp.userData.sprite.material.color.setRGB(1, 0.7, 0.7)
        } else {
          grp.userData.sprite.material.color.setRGB(1, 1, 1)
        }
        const statsSprite = grp.userData.statsSprite
        statsSprite.visible = showStatsRef.current && !m.dead
        if (showStatsRef.current) {
          setStatsLabelText(statsSprite, `❤${Math.max(0, Math.ceil(m.hp))}/${m.maxHp}  ⚔${m.atk}`, m.isCrawler ? '#ffcc99' : '#ffffff')
        }
      }
      // Cleans up monster movers from a floor that's no longer current —
      // a descend swaps in an entirely new monster list (new ids), so any
      // leftover entries here belonged to the floor just left behind.
      for (const [id, grp] of moverMap) {
        if (!seen.has(id)) { grp.parent?.remove(grp); moverMap.delete(id) }
      }
    }

    function syncChests(state) {
      const seen = new Set(state.floor.chests)
      for (const c of state.floor.chests) {
        let grp = chestMap.get(c)
        // A boss box is pushed onto floor.chests mid-floor (on boss
        // defeat), after buildFloorScene already ran — give it a mover
        // here instead of only ever creating them at floor-build time.
        if (!grp) { grp = makeChestMover(c); worldGroup.add(grp); chestMap.set(c, grp) }
        grp.visible = !c.opened
      }
      // Same cleanup as syncMovers — chests from a floor left behind.
      for (const [c, grp] of chestMap) {
        if (!seen.has(c)) { grp.parent?.remove(grp); chestMap.delete(c) }
      }
    }

    function syncWildPets(state) {
      // Taming removes a wild pet from state.floor.wildPets entirely (see
      // tamePet in gameEngine.js), so "no longer present" already means
      // "gone" — no visible/opened-style flag to check, just cleanup.
      const seen = new Set(state.floor.wildPets)
      for (const [wp, grp] of wildPetMap) {
        if (!seen.has(wp)) { grp.parent?.remove(grp); wildPetMap.delete(wp) }
      }
    }

    // One follower mover per player that currently has an active pet —
    // created lazily, repositioned to the pet's own x/z (set every frame
    // by updatePetAI in gameEngine.js), and torn down the moment that
    // player has no active pet (switched or never tamed one).
    function syncActivePets(state) {
      for (const [key, player] of [['p1', state.player], ['p2', state.player2]]) {
        if (key === 'p2' && !state.twoPlayer) continue
        const info = activePetInfo(player)
        let grp = activePetMoverMap.get(key)
        if (!info || player.activePetId == null) {
          if (grp) { grp.parent?.remove(grp); activePetMoverMap.delete(key) }
          continue
        }
        if (!grp || grp.userData.defId !== info.def.id) {
          if (grp) grp.parent?.remove(grp)
          grp = makeCreatureMover(info.def, 1.0)
          grp.userData.defId = info.def.id
          const statsLabel = createStatsLabel()
          statsLabel.position.y = 1.6
          grp.add(statsLabel)
          grp.userData.statsSprite = statsLabel
          scene.add(grp)
          activePetMoverMap.set(key, grp)
        }
        grp.position.set(info.pet.x ?? player.x, 0, info.pet.z ?? player.z)
        grp.userData.statsSprite.visible = showStatsRef.current
        if (showStatsRef.current) {
          setStatsLabelText(grp.userData.statsSprite, `Lv.${info.pet.level}  ${Math.floor(info.pet.xp)}/${info.pet.xpNext}xp`, '#7CFF9E')
        }
      }
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

    // No anti-clip raycast needed anymore — every floor is an open plane
    // with nothing solid for the camera to clip through (no walls, no
    // buildings), so a fixed-distance chase camera is all this needs.
    function updateCamera(state) {
      const p1 = state.player
      // In solo mode player2 never moves (see update() in gameEngine.js),
      // so treat it as p1 for pivot/spread purposes — otherwise the
      // pivot would drift toward its frozen spawn point as p1 wanders off.
      const p2 = state.twoPlayer ? state.player2 : p1
      // Pivot on the midpoint of both players, and pull back farther the
      // more spread out they are, so a shared camera keeps both in frame
      // instead of only ever following Player 1.
      const pivot = new THREE.Vector3((p1.x + p2.x) / 2, 1.5, (p1.z + p2.z) / 2)
      const spread = Math.hypot(p1.x - p2.x, p1.z - p2.z)
      const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw)
      const dir = new THREE.Vector3(-fx * Math.cos(state.pitch), Math.sin(state.pitch), -fz * Math.cos(state.pitch)).normalize()
      const camDist = Math.min(22, Math.max(CAMERA_DIST, CAMERA_DIST + spread * 0.6))
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
      if (e.code === 'KeyM' && phaseRef.current === 'playing') {
        setModal(modalRef.current === 'map' ? null : 'map')
        return
      }
      if (e.code === 'KeyR' && phaseRef.current === 'playing') {
        if (modalRef.current === 'village') { setModal(null); return }
        if (stateRef.current?.inVillage) { setModal('village'); return }
      }
      if (e.code === 'KeyY' && phaseRef.current === 'playing') {
        showStatsRef.current = !showStatsRef.current
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

      const boss = state.floor.monsters.find(m => m.isBoss && !m.dead)
      if (bossBarRef.current) {
        if (boss) {
          bossBarRef.current.style.visibility = 'visible'
          bossNameRef.current.textContent = boss.name
          bossFillRef.current.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`
        } else {
          bossBarRef.current.style.visibility = 'hidden'
        }
      }

      // Deliberately no bearing/distance to the staircase — it's meant to
      // be found by exploring, not navigated to. Just which floor you're
      // on and its theme, always visible.
      if (floorBadgeRef.current) {
        const floor = state.floor
        floorBadgeRef.current.textContent = floor.isFinal
          ? `🏁 Floor ${floor.index} — ${floor.theme.name} (Final Floor!)`
          : `🪜 Floor ${floor.index} — ${floor.theme.name}`
      }

      if (controlsHintRef.current) {
        const t = Math.max(0, 16 - state.elapsed)
        controlsHintRef.current.style.opacity = Math.min(1, t / 2)
        controlsHintRef.current.style.display = t <= 0 ? 'none' : 'block'
      }

      if (teleportFlashRef.current) {
        teleportFlashRef.current.style.opacity = state.teleportFlash > 0 ? state.teleportFlash / FLOOR_FLASH_TIME : 0
      }

      if (safeZoneBadgeRef.current) {
        safeZoneBadgeRef.current.style.visibility = state.inSafeZone ? 'visible' : 'hidden'
      }

      if (villagePromptRef.current) {
        villagePromptRef.current.style.visibility = (state.inVillage && modalRef.current === null) ? 'visible' : 'hidden'
      }

      const petText = (player, ref) => {
        if (!ref.current) return
        const info = activePetInfo(player)
        if (info) { ref.current.style.visibility = 'visible'; ref.current.textContent = `🐾 ${info.pet.name || info.def.name} Lv.${info.pet.level}` }
        else ref.current.style.visibility = 'hidden'
      }
      petText(state.player, petBadgeRef)
      if (state.twoPlayer) petText(state.player2, petBadgeRef2)
    }

    let lastTime = performance.now()
    function step() {
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const state = stateRef.current

      if (phaseRef.current === 'playing' && modalRef.current === null && state) {
        update(state, input1, input2, dt, { setPhase, setWinStats })
        syncSharedCoins(state.player, lastSyncedGoldRef)
        if (state.floorChanged) buildFloorScene(state)
        if (state.pendingClassPick) { state.pendingClassPick = false; setModal('classPick') }

        if (playerGroup) {
          playerGroup.position.set(state.player.x, 0, state.player.z)
          const flicker = state.player.invuln > 0 && Math.floor(state.player.invuln * 10) % 2 === 0
          playerGroup.userData.sprite.material.opacity = flicker ? 0.35 : 1
          const pKey = appearanceKeyFor(state.player)
          if (playerGroup.userData.appearanceKey !== pKey) {
            playerGroup.userData.appearanceKey = pKey
            playerGroup.userData.sprite.material.map = getPlayerTexture(state.player.classId, state.player.raceId, state.player.weaponName, state.player.armorName)
            playerGroup.userData.sprite.material.needsUpdate = true
          }
          playerGroup.userData.statsSprite.visible = showStatsRef.current
          if (showStatsRef.current) setStatsLabelText(playerGroup.userData.statsSprite, statsTextForPlayer(state.player), '#8FD3FF')
        }
        if (player2Group) {
          player2Group.position.set(state.player2.x, 0, state.player2.z)
          const flicker2 = state.player2.invuln > 0 && Math.floor(state.player2.invuln * 10) % 2 === 0
          player2Group.userData.sprite.material.opacity = flicker2 ? 0.35 : 1
          const p2Key = appearanceKeyFor(state.player2)
          if (player2Group.userData.appearanceKey !== p2Key) {
            player2Group.userData.appearanceKey = p2Key
            player2Group.userData.sprite.material.map = getPlayerTexture(state.player2.classId, state.player2.raceId, state.player2.weaponName, state.player2.armorName)
            player2Group.userData.sprite.material.needsUpdate = true
          }
          player2Group.userData.statsSprite.visible = showStatsRef.current
          if (showStatsRef.current) setStatsLabelText(player2Group.userData.statsSprite, statsTextForPlayer(state.player2), '#8FD3FF')
        }
        syncMovers(state)
        syncChests(state)
        syncWildPets(state)
        syncActivePets(state)
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
    mount._buildPlayers = buildPlayers
    mount._buildFloorScene = buildFloorScene

    // Best-effort save on tab close/navigation-away, on top of the
    // explicit saves already triggered by floor descent, the class/race
    // pick, and the periodic autosave timer inside update().
    function onBeforeUnload() {
      if (phaseRef.current === 'playing' && stateRef.current) {
        saveGame(stateRef.current)
        syncSharedCoins(stateRef.current.player, lastSyncedGoldRef)
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      onBeforeUnload()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('beforeunload', onBeforeUnload)
      renderer.domElement.removeEventListener('click', onClick)
      teardownAll()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  function beginPlaying(state) {
    // Coins found in Dungeon Crawler Max or Hogwarts: Spellbound carry
    // over here too — see ../../shared/sharedCoins.js. Player 2's gold
    // stays part of this game's own save (unlike Max/Hogwarts, Free Roam
    // already persists player2's whole progress, not just a per-run stat).
    state.player.gold = loadSharedCoins()
    lastSyncedGoldRef.current = state.player.gold
    stateRef.current = state
    markContestant(state)
    const mount = mountRef.current
    mount._teardownAll?.()
    mount._buildPlayers?.(state)
    // Built explicitly here rather than relying on the render loop's
    // `state.floorChanged` check — update() unconditionally clears that
    // flag as its very first action, before the loop ever gets to read
    // it, so the initial floor's ground/lighting/staircase would
    // otherwise never get built (an all-black scene with nothing in it).
    mount._buildFloorScene?.(state)
    setModal(null)
    setPhase('playing')
  }
  function startGame() { beginPlaying(mkInitialState(twoPlayer)) }
  function continueGame() {
    const saved = loadSavedGame()
    // mkInitialState always honors saved.twoPlayer over whatever's passed
    // in here — keep the UI toggle in lockstep so the HUD (which reads the
    // React twoPlayer flag, not the resumed game's) doesn't render a P2
    // panel the save never actually has data for, or hide one it does.
    if (saved) setTwoPlayer(!!saved.twoPlayer)
    beginPlaying(mkInitialState(twoPlayer, saved))
  }

  return (
    <div className={styles.wrapper}>
      <div ref={mountRef} className={styles.mount} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>

      {phase === 'playing' && modal === null && (
        <>
          <button className={styles.gearButton} onClick={() => setModal('gear')}>🎒 Gear (I)</button>
          <button className={styles.mapButton} onClick={() => setModal('map')}>🗺️ Map (M)</button>
          <button ref={villagePromptRef} className={styles.villageButton} style={{ visibility: 'hidden' }} onClick={() => setModal('village')}>
            🏘️ Enter Village (R)
          </button>
        </>
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
            <div ref={petBadgeRef} className={styles.petBadge} style={{ visibility: 'hidden' }}>🐾</div>
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
              <div ref={petBadgeRef2} className={styles.petBadge} style={{ visibility: 'hidden' }}>🐾</div>
            </div>
          )}

          <div ref={floorBadgeRef} className={styles.floorBadge}>Floor 1</div>

          <div ref={safeZoneBadgeRef} className={styles.safeZoneBadge}>🛡️ Safe Zone — no monsters can reach you here</div>

          <div ref={bossBarRef} className={styles.bossBar}>
            <div ref={bossNameRef} className={styles.bossName} />
            <div className={styles.bossTrack}><div ref={bossFillRef} className={styles.bossFill} /></div>
          </div>

          <div ref={bannerRef} className={styles.banner} />
          <div ref={announcerRef} className={styles.announcer} />
          <div ref={controlsHintRef} className={styles.controlsHint}>
            {twoPlayer
              ? 'P1: W/S move · A/D turn · click to mouse-look · Space attack · F magic · E potion — P2: Arrows move · / attack · . magic · , potion — I gear · M map · R village · Y stats'
              : 'W/S move · A/D turn · click to mouse-look · Space attack · F magic · E potion — I gear · M map · R village · Y stats'}
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
                        <span className={styles.gearItemStat}>
                          Lv.{s.level}{s.level >= MAX_SPELL_LEVEL ? ' (MAX)' : ` — ${s.xp}/${s.xpNext} xp to level up`}
                        </span>
                        {equipped && <span className={styles.equippedTag}>Equipped</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.gearSection}>
                <h2 className={styles.gearHeading}>Pets</h2>
                {snap.pets.length === 0 && <p className={styles.gearEmpty}>No pets tamed yet — walk up to one wandering the floor!</p>}
                <div className={styles.gearList}>
                  {snap.pets.map(pet => {
                    const def = PET_DEFS.find(d => d.id === pet.defId)
                    const equipped = snap.activePetId === pet.id
                    return (
                      <button key={pet.id} className={`${styles.gearItem} ${equipped ? styles.gearItemActive : ''}`} onClick={() => handleSetActivePet(pet.id)} disabled={equipped}>
                        <span className={styles.gearItemEmoji}>{def.role === 'fight' ? '⚔️' : '✨'}</span>
                        <span className={styles.gearItemName}>{pet.name || def.name}</span>
                        <span className={styles.gearItemStat}>Lv.{pet.level} — {def.desc}</span>
                        {equipped && <span className={styles.equippedTag}>Active</span>}
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

      {modal === 'map' && mapSnapshot && (() => {
        const snap = mapSnapshot
        const toPct = (x, z) => ({
          left: `${((x + WORLD_HALF) / (WORLD_HALF * 2)) * 100}%`,
          top: `${((z + WORLD_HALF) / (WORLD_HALF * 2)) * 100}%`,
        })
        const safeZoneSizePct = (SAFE_ZONE_HOME_RADIUS * 2 / (WORLD_HALF * 2)) * 100
        return (
          <div className={styles.overlay} onClick={() => setModal(null)}>
            <div className={styles.card} onClick={e => e.stopPropagation()}>
              <h1 className={styles.title}>🗺️ Floor {snap.floorIndex} Map</h1>
              <p className={styles.tagline}>{snap.themeName}{snap.isFinal ? ' — Final Floor' : ''}</p>
              <div className={styles.mapSquare} style={{ borderColor: snap.accent }}>
                <div className={styles.mapSafeZone} style={{ width: `${safeZoneSizePct}%`, height: `${safeZoneSizePct}%` }} />
                {snap.staircase && (
                  <div className={styles.mapMarker} style={toPct(snap.staircase.x, snap.staircase.z)} title="Staircase down">🪜</div>
                )}
                {!snap.staircase && (
                  <div className={styles.mapMarker} style={toPct(snap.guardPoint.x, snap.guardPoint.z)} title="Something's here...">🕯️</div>
                )}
                {snap.boss && (
                  <div className={`${styles.mapMarker} ${styles.mapBoss}`} style={toPct(snap.boss.x, snap.boss.z)} title={snap.boss.name}>👹</div>
                )}
                {snap.chests.map((c, i) => (
                  <div key={i} className={styles.mapMarker} style={toPct(c.x, c.z)} title="Chest">🎁</div>
                ))}
                {snap.miniDungeons.map((d, i) => (
                  <div key={i} className={`${styles.mapMarker} ${styles.mapDungeon}`} style={toPct(d.x, d.z)} title="Mini Dungeon — guarded chest inside">⛩️</div>
                ))}
                {snap.village && (
                  <div className={`${styles.mapMarker} ${styles.mapVillage}`} style={toPct(snap.village.x, snap.village.z)} title={snap.village.name}>🏘️</div>
                )}
                {snap.wildPets.map((wp, i) => (
                  <div key={i} className={styles.mapMarker} style={toPct(wp.x, wp.z)} title={`Wild ${wp.name}`}>🐾</div>
                ))}
                {snap.crawlers.map((c, i) => (
                  <div key={i} className={`${styles.mapMarker} ${styles.mapCrawler}`} style={toPct(c.x, c.z)} title={c.name}>⚔️</div>
                ))}
                {snap.players.map((p, i) => (
                  <div key={i} className={`${styles.mapMarker} ${styles.mapPlayer}`} style={toPct(p.x, p.z)} title={snap.twoPlayer ? `Player ${i + 1}` : 'You'}>
                    {i === 0 ? '🔵' : '🟢'}
                  </div>
                ))}
              </div>
              <div className={styles.mapLegend}>
                <span>🔵 You{snap.twoPlayer ? ' (P1)' : ''}</span>
                {snap.twoPlayer && <span>🟢 Player 2</span>}
                <span>🛡️ Safe Zone</span>
                <span>🎁 Chest ({snap.chests.length} left)</span>
                <span>⛩️ Mini Dungeon ({snap.miniDungeons.length})</span>
                {snap.village && <span>🏘️ {snap.village.name}</span>}
                <span>🐾 Wild Pet ({snap.wildPets.length} left)</span>
                <span>⚔️ Rival ({snap.crawlers.length} left)</span>
                {snap.staircase ? <span>🪜 Staircase down</span> : <span>🕯️ No staircase here — someone's guarding the way out</span>}
                {snap.boss && <span>👹 {snap.boss.name}</span>}
              </div>
              <button className={styles.startButton} onClick={() => setModal(null)}>Back To The Fight →</button>
            </div>
          </div>
        )
      })()}

      {modal === 'village' && villageSnapshot && (() => {
        const snap = villageSnapshot
        return (
          <div className={styles.overlay} onClick={() => setModal(null)}>
            <div className={styles.card} onClick={e => e.stopPropagation()}>
              <h1 className={styles.title}>🏘️ Village</h1>
              <p className={styles.tagline}>🪙 {snap.gold} gold — spend it here, then get back out there.</p>

              <div className={styles.gearTabs}>
                {[['store', '🏪 Store'], ['blacksmith', '⚔️ Blacksmith'], ['enchanter', '🪄 Enchanter'], ['pets', '🐾 Pet Trainer'], ['quests', '📜 Quests']].map(([key, label]) => (
                  <button key={key} className={`${styles.gearTabBtn} ${villageTab === key ? styles.gearTabActive : ''}`} onClick={() => setVillageTab(key)}>{label}</button>
                ))}
              </div>

              {villageTab === 'store' && (
                <div className={styles.gearSection}>
                  <h2 className={styles.gearHeading}>General Store</h2>
                  <div className={styles.gearList}>
                    <button className={styles.gearItem} onClick={handleBuyPotion} disabled={snap.gold < SHOP_POTION_COST || snap.potions >= 5}>
                      <span className={styles.gearItemEmoji}>🧃</span>
                      <span className={styles.gearItemName}>Snack Potion</span>
                      <span className={styles.gearItemStat}>{snap.potions >= 5 ? 'Full up!' : `🪙 ${SHOP_POTION_COST}`}</span>
                    </button>
                  </div>
                </div>
              )}

              {villageTab === 'blacksmith' && (
                <>
                  <div className={styles.gearSection}>
                    <h2 className={styles.gearHeading}>Weapons</h2>
                    <div className={styles.gearList}>
                      {WEAPONS.slice(0, snap.lootTier + 1).map((w, i) => {
                        const owned = snap.weapons.some(x => x.name === w.name)
                        const cost = w.atk * 4
                        return (
                          <button key={w.name} className={styles.gearItem} onClick={() => handleBuyWeapon(i)} disabled={owned || snap.gold < cost}>
                            <span className={styles.gearItemEmoji}>{w.emoji}</span>
                            <span className={styles.gearItemName}>{w.name}</span>
                            <span className={styles.gearItemStat}>{owned ? 'Owned' : `🪙 ${cost}`}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className={styles.gearSection}>
                    <h2 className={styles.gearHeading}>Armor</h2>
                    <div className={styles.gearList}>
                      {ARMORS.slice(0, snap.lootTier + 1).map((a, i) => {
                        const owned = snap.armors.some(x => x.name === a.name)
                        const cost = a.def * 4
                        return (
                          <button key={a.name} className={styles.gearItem} onClick={() => handleBuyArmor(i)} disabled={owned || snap.gold < cost}>
                            <span className={styles.gearItemEmoji}>{a.emoji}</span>
                            <span className={styles.gearItemName}>{a.name}</span>
                            <span className={styles.gearItemStat}>{owned ? 'Owned' : `🪙 ${cost}`}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {villageTab === 'enchanter' && (
                <div className={styles.gearSection}>
                  <h2 className={styles.gearHeading}>Spells</h2>
                  <div className={styles.gearList}>
                    {SPELLS.map(s => {
                      const known = snap.spells.find(x => x.id === s.id)
                      const maxed = known && known.level >= MAX_SPELL_LEVEL
                      const cost = known ? (known.level + 1) * 12 : 25
                      return (
                        <button key={s.id} className={styles.gearItem} onClick={() => handleLearnSpell(s.id)} disabled={maxed || snap.gold < cost}>
                          <span className={styles.gearItemEmoji}>{s.emoji}</span>
                          <span className={styles.gearItemName}>{s.name}</span>
                          <span className={styles.gearItemStat}>{maxed ? 'Maxed' : known ? `Lv.${known.level}→${known.level + 1} — 🪙 ${cost}` : `Learn — 🪙 ${cost}`}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {villageTab === 'pets' && (
                <div className={styles.gearSection}>
                  <h2 className={styles.gearHeading}>Pet Trainer</h2>
                  {!snap.activePetId && <p className={styles.gearEmpty}>No active pet — tame one wandering the floor first, then come back!</p>}
                  {snap.activePetId && (
                    <div className={styles.gearList}>
                      <button className={styles.gearItem} onClick={handleTrainPet} disabled={snap.gold < SHOP_PET_TRAIN_COST}>
                        <span className={styles.gearItemEmoji}>🐾</span>
                        <span className={styles.gearItemName}>Train Active Pet</span>
                        <span className={styles.gearItemStat}>🪙 {SHOP_PET_TRAIN_COST}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {villageTab === 'quests' && (
                <div className={styles.gearSection}>
                  <h2 className={styles.gearHeading}>Bounty Board</h2>
                  <p className={styles.gearEmpty}>Completed so far: {snap.questsCompleted}</p>
                  {snap.quest ? (
                    <p className={styles.gearEmpty}>{snap.quest.verb} {snap.quest.target} {snap.quest.noun} — {snap.quest.progress}/{snap.quest.target} done. Payout is automatic!</p>
                  ) : (
                    <button className={styles.startButton} onClick={handleAcceptQuest}>📜 Accept A New Bounty</button>
                  )}
                </div>
              )}

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
              {twoPlayer
                ? `You've reached Floor ${CLASS_RACE_FLOOR} — time for both players to specialize. Pick one of each, permanently.`
                : `You've reached Floor ${CLASS_RACE_FLOOR} — time to specialize. Pick one of each, permanently.`}
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

      {phase === 'intro' && (() => {
        const saved = hasSavedGame() ? loadSavedGame() : null
        return (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>{twoPlayer ? '🧒 👦 🔮' : '🧒 🔮'}</div>
            <h1 className={styles.title}>Dungeon Crawler Max: Free Roam</h1>
            <p className={styles.tagline}>Floor After Floor, Deeper We Go!</p>
            <p className={styles.story}>
              {twoPlayer
                ? "Same game show, bigger stage — and it's a two-player affair! Grab a second person for the keyboard, because you're both descending together — "
                : "Same game show, bigger stage — now a long descent to roam solo — "}
              every floor is one huge, foggy stretch of dungeon with monsters roaming it, a few small
              walled-off mini dungeons hiding a guarded, guaranteed-good chest each, and exactly one
              staircase hidden somewhere far from where you start — press M any time to check the Map
              and see where all of it (chests, mini dungeons, rivals, boss) actually is. Floating host
              MC Marv is narrating from somewhere overhead. You're not the only contestant down here,
              either — rival crawlers are running the same show, and they'll fight you AND each other
              on sight. Fighting isn't just fists anymore — swing whatever's in your hands, or fling one
              of five spells you find as scrolls and level up over time. Chests also drop weapons and
              armor you pick from and equip yourself in the Gear menu
              {twoPlayer ? ' — each player keeps their own stash' : ''}. Reach Floor {CLASS_RACE_FLOOR} and
              you'll{twoPlayer ? ' both ' : ' '}pick a class and race — ten of each, a hundred combinations
              — that permanently shape your stats. A boss guards each hidden staircase (optional, but
              good loot); the final floor's boss guards the way out instead. Wild pets wander every floor
              too — walk up to tame one, no fighting required — and they'll fight or buff you as they
              level up alongside you (open Gear to switch which one's active). From Floor {VILLAGE_START_FLOOR} on,
              every floor also hides a village — find it and press R to shop, train your pet, or take on
              a bounty. Home Base and every village are safe zones — no monster or rival can follow you
              in. Getting knocked out is still just a free respawn — this game show has excellent
              insurance. Your progress saves automatically, and any gold you find carries over into
              Dungeon Crawler Max and Hogwarts: Spellbound too — one purse for the whole show.
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
              <span><b>Map</b> — M</span>
              <span><b>Village</b> — R</span>
              <span><b>Toggle Stats</b> — Y</span>
            </div>
            {saved ? (
              <div className={styles.pickRow}>
                <button className={styles.startButton} onClick={continueGame}>▶ Continue — Floor {saved.floorIndex}</button>
                <button className={styles.startButton} onClick={startGame}>🆕 New Game</button>
              </div>
            ) : (
              <button className={styles.startButton} onClick={startGame}>Step Into The World →</button>
            )}
          </div>
        </div>
        )
      })()}

      {phase === 'win' && winStats && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h1 className={styles.title}>🏆 You Win The Game Show!</h1>
            <p className={styles.story}>MC Marv: "Ladies, gentlemen, and hamsters everywhere — we have a CHAMPION!"</p>
            <div className={styles.statsList}>
              <div>Floor Reached: <b>{winStats.floor}</b> / {TOTAL_FLOORS}</div>
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
