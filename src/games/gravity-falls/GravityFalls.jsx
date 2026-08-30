import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './GravityFalls.module.css'
import {
  CHARACTERS, getCharacter, TOTAL_PAGES, SHACK_POS, DINER_POS, STORE_POS, WATER_TOWER_POS, CLIMAX_POS,
  loadBest, saveBest,
} from './constants.js'
import { createGameState, stepGame, nearestUncollectedPage } from './gameEngine.js'

// ── Gravity Falls: Journal Hunt ─────────────────────────────────────────
// An open-world explore-and-collect game inspired by Gravity Falls: pick a
// character and roam the Mystery Shack grounds, the forest, and downtown
// finding torn Journal 3 pages. Forest gnomes, the Multi-Bear, and the
// rest of the cast are flavor — wandering NPCs with a one-time greeting,
// not enemies. Find every page and the finale triggers: the sky ripples,
// and Bill Cipher is waiting in the clearing north of town. Every
// character is procedural low-poly geometry (boxes, spheres, cylinders,
// cones), no external art — same technique as this hub's other 3D games.

function hexToCss(hex) { return `#${hex.toString(16).padStart(6, '0')}` }

// A small drawn-not-copied pattern baked onto a torso texture — Mabel's
// sweater star, Wendy's flannel plaid. Painted directly with the 2D canvas
// API (no images), same technique as this hub's label/badge sprites.
// material.color is left white when a pattern is used so the canvas's own
// colors show through unmodified instead of getting double-tinted.
function makePatternTexture(kind, bg, fg) {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = hexToCss(bg)
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = ctx.strokeStyle = hexToCss(fg)
  if (kind === 'star') {
    ctx.translate(32, 30)
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a1 = (i * 2 * Math.PI) / 5 - Math.PI / 2, a2 = a1 + Math.PI / 5
      const x1 = Math.cos(a1) * 18, y1 = Math.sin(a1) * 18
      const x2 = Math.cos(a2) * 8, y2 = Math.sin(a2) * 8
      if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1)
      ctx.lineTo(x2, y2)
    }
    ctx.closePath(); ctx.fill()
  } else if (kind === 'plaid') {
    ctx.lineWidth = 5
    for (let i = 8; i < 64; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke()
    }
  }
  return new THREE.CanvasTexture(canvas)
}

// A pine-tree emblem sprite for Dipper's cap — the show's single most
// iconic silhouette element. Drawn, not copied.
function makePineTreeSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#2f6b3a'
  ctx.beginPath()
  ctx.moveTo(32, 8); ctx.lineTo(48, 30); ctx.lineTo(40, 30); ctx.lineTo(52, 50)
  ctx.lineTo(12, 50); ctx.lineTo(24, 30); ctx.lineTo(16, 30)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#5a3a20'
  ctx.fillRect(29, 50, 6, 8)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.renderOrder = 9
  return sprite
}

// ── Human-proportioned character model ──────────────────────────────────
// A defined neck, waist taper, and capsule limbs (same shape language as
// this hub's Avatar game) instead of a snowman-stack of boxes, plus hair,
// optional glasses, an optional drawn shirt pattern, and one of a few hat
// shapes — enough per-character silhouette variety (pine-tree cap,
// top hat, ponytail, sweater star) to read as the right character at a
// glance without using any actual show artwork.
const FOOT_Y = 0
const LEG_R = 0.1, LEG_LEN = 0.5, LEG_H = LEG_LEN + LEG_R * 2
const HIP_Y = FOOT_Y + LEG_H
const TORSO_BOTTOM_R = 0.23, TORSO_TOP_R = 0.3, TORSO_H = 0.58
const TORSO_CENTER_Y = HIP_Y + TORSO_H / 2
const NECK_R = 0.09, NECK_H = 0.1
const NECK_CENTER_Y = HIP_Y + TORSO_H + NECK_H / 2
const HEAD_R = 0.25
const HEAD_CENTER_Y = HIP_Y + TORSO_H + NECK_H + HEAD_R
const ARM_R = 0.08, ARM_LEN = 0.4, ARM_H = ARM_LEN + ARM_R * 2
const SHOULDER_Y = TORSO_CENTER_Y + TORSO_H * 0.3

function makeCharacterModel(spec) {
  const {
    skin = 0xe8b98a, shirt, pants = 0x2a2622, accent = shirt,
    shirtPattern, shirtPatternFg,
    hair, hairStyle = 'short',
    hat, hatAccent, hatShape = 'none',
    glasses = false, scale = 1,
  } = spec
  const g = new THREE.Group()
  const skinMat = new THREE.MeshStandardMaterial({ color: skin })
  const shirtMat = shirtPattern
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: makePatternTexture(shirtPattern, shirt, shirtPatternFg) })
    : new THREE.MeshStandardMaterial({ color: shirt })
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants })
  const accentMat = new THREE.MeshStandardMaterial({ color: accent })

  const legGeo = new THREE.CapsuleGeometry(LEG_R, LEG_LEN, 4, 8)
  const legs = [-0.12, 0.12].map(x => {
    const leg = new THREE.Mesh(legGeo, pantsMat)
    leg.position.set(x, HIP_Y - LEG_H / 2, 0)
    g.add(leg)
    return leg
  })
  const footGeo = new THREE.BoxGeometry(0.14, 0.08, 0.22)
  ;[-0.12, 0.12].forEach(x => {
    const foot = new THREE.Mesh(footGeo, accentMat)
    foot.position.set(x, FOOT_Y + 0.04, -0.03)
    g.add(foot)
  })

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(TORSO_TOP_R, TORSO_BOTTOM_R, TORSO_H, 10), shirtMat)
  torso.position.y = TORSO_CENTER_Y
  g.add(torso)

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(NECK_R, NECK_R * 1.1, NECK_H, 8), skinMat)
  neck.position.y = NECK_CENTER_Y
  g.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 14, 12), skinMat)
  head.position.y = HEAD_CENTER_Y
  g.add(head)

  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
  ;[-1, 1].forEach(side => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(side * 0.09, HEAD_CENTER_Y + 0.02, -HEAD_R * 0.92)
    g.add(eye)
  })
  if (glasses) {
    const ringGeo = new THREE.TorusGeometry(0.075, 0.012, 6, 12)
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
    ;[-1, 1].forEach(side => {
      const ring = new THREE.Mesh(ringGeo, glassMat)
      ring.position.set(side * 0.09, HEAD_CENTER_Y + 0.02, -HEAD_R * 0.95)
      g.add(ring)
    })
  }

  if (hairStyle !== 'bald' && hair) {
    const hairMat = new THREE.MeshStandardMaterial({ color: hair })
    if (hairStyle === 'short') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.04, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat)
      cap.position.y = HEAD_CENTER_Y + HEAD_R * 0.15
      g.add(cap)
    } else if (hairStyle === 'ponytail') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.04, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat)
      cap.position.y = HEAD_CENTER_Y + HEAD_R * 0.15
      g.add(cap)
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 4, 8), hairMat)
      tail.position.set(0, HEAD_CENTER_Y - 0.06, HEAD_R * 0.78)
      tail.rotation.x = 0.5
      g.add(tail)
    } else if (hairStyle === 'full') {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.15, 12, 10), hairMat)
      blob.scale.set(1, 1.15, 1.05)
      blob.position.y = HEAD_CENTER_Y + HEAD_R * 0.05
      g.add(blob)
    } else if (hairStyle === 'sideburns') {
      ;[-1, 1].forEach(side => {
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hairMat)
        tuft.position.set(side * HEAD_R * 0.85, HEAD_CENTER_Y - 0.05, -0.02)
        g.add(tuft)
      })
    }
  }

  if (hatShape !== 'none') {
    const hatMat = new THREE.MeshStandardMaterial({ color: hat })
    const hatAccentMat = new THREE.MeshStandardMaterial({ color: hatAccent ?? hat })
    if (hatShape === 'pine-cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.08, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat)
      dome.position.y = HEAD_CENTER_Y + HEAD_R * 0.2
      g.add(dome)
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R * 1.05, HEAD_R * 1.05, 0.05, 12, 1, false, -0.5, Math.PI * 1), hatMat)
      brim.position.set(0, HEAD_CENTER_Y + HEAD_R * 0.5, -HEAD_R * 0.65)
      g.add(brim)
      const emblem = makePineTreeSprite()
      emblem.scale.set(0.24, 0.24, 1)
      emblem.position.set(0, HEAD_CENTER_Y + HEAD_R * 0.35, -HEAD_R * 1.02)
      g.add(emblem)
    } else if (hatShape === 'tophat') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R * 1.3, HEAD_R * 1.3, 0.05, 14), hatMat)
      brim.position.y = HEAD_CENTER_Y + HEAD_R * 0.7
      g.add(brim)
      const top = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R * 0.85, HEAD_R * 0.95, 0.34, 14), hatMat)
      top.position.y = HEAD_CENTER_Y + HEAD_R * 0.9
      g.add(top)
      const band = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R * 0.97, HEAD_R * 0.97, 0.06, 14), hatAccentMat)
      band.position.y = HEAD_CENTER_Y + HEAD_R * 0.75
      g.add(band)
    } else if (hatShape === 'trucker') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.08, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat)
      dome.position.y = HEAD_CENTER_Y + HEAD_R * 0.25
      g.add(dome)
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(HEAD_R * 1.0, HEAD_R * 1.0, 0.04, 12, 1, false, -0.5, Math.PI * 1), hatMat)
      brim.position.set(0, HEAD_CENTER_Y + HEAD_R * 0.5, -HEAD_R * 0.65)
      g.add(brim)
    }
  }

  const armGeo = new THREE.CapsuleGeometry(ARM_R, ARM_LEN, 4, 8)
  const arms = [-1, 1].map(side => {
    const arm = new THREE.Mesh(armGeo, shirtMat)
    arm.position.set(side * (TORSO_TOP_R + 0.08), SHOULDER_Y - ARM_H / 2, 0)
    g.add(arm)
    return arm
  })
  const handGeo = new THREE.SphereGeometry(0.075, 8, 6)
  ;[-1, 1].forEach(side => {
    const hand = new THREE.Mesh(handGeo, skinMat)
    hand.position.set(side * (TORSO_TOP_R + 0.08), SHOULDER_Y - ARM_H, 0)
    g.add(hand)
  })

  g.userData.legs = legs
  g.userData.arms = arms
  g.scale.setScalar(scale)
  return g
}

// One spec per named character — reused for both the playable model and
// its wandering-NPC counterpart, so Stan looks the same whether you're
// playing as him or just meeting him in the world.
const CHAR_SPECS = {
  dipper: {
    skin: 0xe8b98a, shirt: 0x2b4a7a, pants: 0xc9a876, accent: 0xf0e6d2,
    hair: 0x4a2f1a, hairStyle: 'short',
    hat: 0xe8eef5, hatAccent: 0x2b4a7a, hatShape: 'pine-cap',
  },
  mabel: {
    skin: 0xe8b98a, shirt: 0xff6fae, pants: 0x8a4fff, accent: 0xff6fae,
    shirtPattern: 'star', shirtPatternFg: 0xfff2a8,
    hair: 0x5a3a20, hairStyle: 'full',
  },
  stan: {
    skin: 0xd9a878, shirt: 0x2f2f2f, pants: 0x232323, accent: 0x2f2f2f,
    hair: 0x9a9a9a, hairStyle: 'sideburns', glasses: true,
    hat: 0x1a1a1a, hatAccent: 0xffd54a, hatShape: 'tophat',
  },
  wendy: {
    skin: 0xe8b98a, shirt: 0x3a6b3a, pants: 0x3a5a8a, accent: 0x3a6b3a,
    shirtPattern: 'plaid', shirtPatternFg: 0x1f3f22,
    hair: 0xc9581f, hairStyle: 'ponytail',
  },
  soos: {
    skin: 0xd9a878, shirt: 0xdedad0, pants: 0x5a6b8a, accent: 0xdedad0,
    hair: 0x2a2018, hairStyle: 'short',
    hat: 0x6a4a2a, hatShape: 'trucker',
  },
}

// Not every figure has both parts (Waddles and the Multi-Bear are
// legs-only quadrupeds), so each pair is animated independently.
function animateWalk(figure, moving, t) {
  const { legs, arms } = figure.userData
  const swing = moving ? Math.sin(t * 9) * 0.55 : 0
  if (legs) { legs[0].rotation.x = swing; legs[1].rotation.x = -swing }
  if (arms) { arms[0].rotation.x = -swing; arms[1].rotation.x = swing }
}

function faceToward(obj, dx, dz) {
  if (Math.hypot(dx, dz) < 0.01) return
  obj.rotation.y = Math.atan2(dx, dz)
}

function makeLabel(text, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 30px "Courier New", monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.scale.set(2.4, 0.6, 1)
  sprite.renderOrder = 10
  return sprite
}

function makeWaddles() {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0a8b8 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bodyMat)
  body.scale.set(1.3, 1, 1)
  body.position.y = 0.36
  g.add(body)
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xd88898 }))
  snout.rotation.z = Math.PI / 2
  snout.position.set(0.38, 0.34, 0)
  g.add(snout)
  ;[-1, 1].forEach(side => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 6), bodyMat)
    ear.position.set(0.2, 0.58, side * 0.12)
    ear.rotation.z = -0.4
    g.add(ear)
  })
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6)
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd88898 })
  const legs = [[0.18, 0.14], [0.18, -0.14], [-0.18, 0.14], [-0.18, -0.14]].map(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(x, 0.1, z)
    g.add(leg)
    return leg
  })
  g.userData.legs = legs
  g.userData.baseY = 0
  return g
}

function makeGnome() {
  return makeCharacterModel({
    shirt: 0x4a7a3f, pants: 0x3a5a2f, skin: 0xe0b090, accent: 0x4a7a3f,
    hair: 0xe8e0d0, hairStyle: 'sideburns',
    hat: 0xd94a3a, hatShape: 'trucker', scale: 0.62,
  })
}

// A big, gently absurd forest creature — a large quadruped body with one
// main bear head and a couple of small extra heads bunched beside it, a
// light nod to the show's "many heads" joke without overbuilding it.
function makeMultiBear() {
  const g = new THREE.Group()
  const furMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2.2), furMat)
  body.position.y = 1.0
  g.add(body)
  function head(scale, x, y, z) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 10, 8), furMat)
    h.position.set(x, y, z)
    g.add(h)
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.18 * scale, 0.3 * scale, 8), new THREE.MeshStandardMaterial({ color: 0x7a5535 }))
    snout.rotation.x = Math.PI / 2
    snout.position.set(x, y - 0.05 * scale, z - 0.36 * scale)
    g.add(snout)
    return h
  }
  head(1, 0, 1.75, 0.9)
  head(0.55, -0.55, 1.5, 0.75)
  head(0.55, 0.55, 1.5, 0.75)
  const legGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.75, 8)
  const legs = [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]].map(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, furMat)
    leg.position.set(x, 0.4, z)
    g.add(leg)
    return leg
  })
  g.userData.legs = legs
  return g
}

function makeTree(t) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, t.h * 0.4, 7), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }))
  trunk.position.y = t.h * 0.2
  g.add(trunk)
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1, t.h * 0.75, 8), new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: 1 }))
  leaves.position.y = t.h * 0.4 + t.h * 0.35
  g.add(leaves)
  g.position.set(t.x, 0, t.z)
  return g
}

// The sign is added straight to `scene`, not as a child of the returned
// group: that group also goes into the camera's anti-clip collision
// raycast, and a Sprite child needs `raycaster.camera` set to be
// raycast-safe — same reason this hub's other open-world games keep
// label sprites out of their collidable-mesh arrays.
function buildBuilding(scene, b, color, signText, signColor) {
  const g = new THREE.Group()
  const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, 3.2, b.d), new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  wall.position.y = 1.6
  g.add(wall)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.5, 0.3, b.d + 0.5), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1 }))
  roof.position.y = 3.35
  g.add(roof)
  if (signText) {
    // Real clearance from the wall (not just 0.1) — the chase camera's
    // anti-clip raycast can legitimately pull it to within ~0.3 units of
    // a wall it's facing (e.g. at spawn, looking straight at the Shack),
    // and a depthTest:false sprite that close to the camera balloons to
    // fill the screen. Keeping the sign a few units clear keeps the
    // camera from ever landing next to it.
    const sign = makeLabel(signText, signColor)
    sign.position.set(b.x, 3.9, b.z + b.d / 2 + 2.6)
    scene.add(sign)
  }
  const lamp = new THREE.PointLight(0xffd8a0, 4, 14, 2)
  lamp.position.set(0, 3, 0)
  g.add(lamp)
  g.position.set(b.x, 0, b.z)
  return g
}

function buildWaterTower(pos) {
  const g = new THREE.Group()
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.2, 12), new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 1 }))
  tank.position.y = 6
  g.add(tank)
  const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 5, 6)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3428 })
  ;[[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(x, 2.5, z)
    g.add(leg)
  })
  g.position.set(pos.x, 0, pos.z)
  return g
}

function makePageMesh() {
  const geo = new THREE.PlaneGeometry(0.6, 0.8)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf2e6c8, emissive: 0xd9b26a, emissiveIntensity: 0.5, roughness: 0.6, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  const glow = new THREE.PointLight(0xffd98a, 2.5, 5, 2)
  mesh.add(glow)
  return mesh
}

function makeBillCipher() {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.TetrahedronGeometry(1.6, 0),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 0.9, roughness: 0.3 }),
  )
  g.add(body)
  const eyeWhite = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0xfff8e0, side: THREE.DoubleSide }))
  eyeWhite.position.set(0, 0, 1.05)
  g.add(eyeWhite)
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0x1a1408, side: THREE.DoubleSide }))
  pupil.position.set(0, 0, 1.07)
  g.add(pupil)
  const glow = new THREE.PointLight(0xffd23f, 8, 30, 2)
  g.add(glow)
  return g
}

function buildWorldScene(world) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x2a2440)
  scene.fog = new THREE.Fog(0x2a2440, 24, 100)

  scene.add(new THREE.HemisphereLight(0xd8c8ff, 0x2a2418, 0.9))
  const sun = new THREE.DirectionalLight(0xffe8c0, 0.9)
  sun.position.set(-20, 30, 10)
  scene.add(sun)

  const full = 90
  const ground = new THREE.Mesh(new THREE.BoxGeometry(full, 0.4, full), new THREE.MeshStandardMaterial({ color: 0x5a6b3f, roughness: 1 }))
  ground.position.y = -0.2
  scene.add(ground)

  // Forest floor patch (west half) and town pavement patch (east half) —
  // cheap zone-differentiation, same technique as this hub's other
  // open-world games' street-grid overlays.
  const forestFloor = new THREE.Mesh(new THREE.BoxGeometry(38, 0.42, full), new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 1 }))
  forestFloor.position.set(-24, -0.19, 0)
  scene.add(forestFloor)
  const townFloor = new THREE.Mesh(new THREE.BoxGeometry(38, 0.42, full), new THREE.MeshStandardMaterial({ color: 0x6b6458, roughness: 1 }))
  townFloor.position.set(24, -0.19, 0)
  scene.add(townFloor)

  const collidableMeshes = []
  world.buildings.forEach(b => {
    let mesh
    if (b.kind === 'shack') mesh = buildBuilding(scene, b, 0x8a5a3a, 'MYSTERY SHACK', '#ffd166')
    else if (b.kind === 'diner') mesh = buildBuilding(scene, b, 0xc25a4a, "GREASY'S", '#fff2c0')
    else if (b.kind === 'store') mesh = buildBuilding(scene, b, 0x4a6a8a, 'GENERAL STORE', '#c0e8ff')
    else { mesh = buildWaterTower(b); }
    scene.add(mesh)
    collidableMeshes.push(mesh)
  })
  world.trees.forEach(t => { const mesh = makeTree(t); scene.add(mesh); collidableMeshes.push(mesh) })
  world.clutter.forEach(c => {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 1 }))
    crate.position.set(c.x, c.h / 2, c.z)
    scene.add(crate)
  })

  return { scene, collidableMeshes }
}

function GameCanvas({ characterKey, onHud, onWin }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const [locked, setLocked] = useState(false)
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onWinRef = useRef(onWin); onWinRef.current = onWin

  useEffect(() => {
    const mount = mountRef.current
    let raf = null

    const state = createGameState(characterKey)
    const character = getCharacter(characterKey)

    const camera = new THREE.PerspectiveCamera(64, mount.clientWidth / mount.clientHeight, 0.1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    let yaw = Math.PI
    let pitch = 0.35

    function onKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return
      yaw -= e.movementX * 0.0024
      pitch -= e.movementY * 0.0018
      pitch = Math.max(-0.05, Math.min(1.1, pitch))
    }
    document.addEventListener('mousemove', onMouseMove)
    function onClick() {
      try { renderer.domElement.requestPointerLock()?.catch?.(() => {}) } catch { /* pointer lock unavailable */ }
    }
    renderer.domElement.addEventListener('click', onClick)
    function onLockChange() { setLocked(document.pointerLockElement === renderer.domElement) }
    document.addEventListener('pointerlockchange', onLockChange)

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const { scene, collidableMeshes } = buildWorldScene(state.world)
    const camRaycaster = new THREE.Raycaster()

    const player = makeCharacterModel(CHAR_SPECS[characterKey])
    scene.add(player)

    // NPC meshes, built once per npc in state.npcs (already excludes
    // whichever matches the chosen playable character).
    const npcMeshes = state.npcs.map(npc => {
      let mesh
      if (npc.id === 'stan_npc') mesh = makeCharacterModel(CHAR_SPECS.stan)
      else if (npc.id === 'wendy_npc') mesh = makeCharacterModel(CHAR_SPECS.wendy)
      else if (npc.id === 'soos_npc') mesh = makeCharacterModel(CHAR_SPECS.soos)
      else if (npc.id === 'waddles_npc') mesh = makeWaddles()
      else if (npc.id === 'multibear_npc') mesh = makeMultiBear()
      else mesh = makeGnome() // gnome0..3
      scene.add(mesh)
      return mesh
    })

    const pageMeshes = state.pages.map(p => {
      const mesh = makePageMesh()
      mesh.position.set(p.pos.x, 1.1, p.pos.z)
      scene.add(mesh)
      return mesh
    })

    const bill = makeBillCipher()
    bill.position.set(CLIMAX_POS.x, 2.4, CLIMAX_POS.z)
    bill.visible = false
    scene.add(bill)

    const clock = new THREE.Clock()
    const TURN_SPEED = 2.6
    let climaxTriggered = false

    function tick() {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(clock.getDelta(), 0.05)
      const k = keysRef.current
      const t = clock.elapsedTime

      if (k.has('KeyA') || k.has('ArrowLeft')) yaw += TURN_SPEED * dt
      if (k.has('KeyD') || k.has('ArrowRight')) yaw -= TURN_SPEED * dt
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      let moveX = 0, moveZ = 0
      if (k.has('KeyW') || k.has('ArrowUp')) { moveX += fx; moveZ += fz }
      if (k.has('KeyS') || k.has('ArrowDown')) { moveX -= fx; moveZ -= fz }
      stepGame(state, { moveX, moveZ }, dt)

      const moving = Math.hypot(moveX, moveZ) > 0.01
      player.position.set(state.player.x, 0, state.player.z)
      player.rotation.y = yaw
      animateWalk(player, moving, t)

      state.npcs.forEach((npc, i) => {
        const mesh = npcMeshes[i]
        const prevX = mesh.position.x, prevZ = mesh.position.z
        mesh.position.set(npc.x, 0, npc.z)
        faceToward(mesh, npc.x - prevX, npc.z - prevZ)
        animateWalk(mesh, true, t + i)
      })

      pageMeshes.forEach((mesh, i) => {
        const p = state.pages[i]
        mesh.visible = !p.collected
        if (!p.collected) {
          mesh.position.y = 1.1 + Math.sin(t * 2.2 + i) * 0.12
          mesh.rotation.y += dt * 1.2
        }
      })

      if (state.phase !== 'explore' && !climaxTriggered) {
        climaxTriggered = true
        bill.visible = true
        scene.background = new THREE.Color(0x4a2a5a)
        scene.fog.color.setHex(0x4a2a5a)
      }
      if (bill.visible) {
        bill.rotation.y += dt * 0.6
        bill.position.y = 2.4 + Math.sin(t * 1.5) * 0.3
      }

      // Third-person orbit camera with anti-clip raycast (same pattern as
      // this hub's other open-world games).
      const pivot = new THREE.Vector3(state.player.x, 1.3, state.player.z)
      const dir = new THREE.Vector3(-fx * Math.cos(pitch), Math.sin(pitch), -fz * Math.cos(pitch)).normalize()
      let camDist = 7.2
      camRaycaster.set(pivot, dir)
      camRaycaster.far = camDist
      const hit = camRaycaster.intersectObjects(collidableMeshes, true)[0]
      if (hit) camDist = Math.max(1.8, hit.distance - 0.3)
      camera.position.copy(pivot).addScaledVector(dir, camDist)
      camera.lookAt(pivot)

      renderer.render(scene, camera)

      // Compass bearing to the nearest unfound page (Dipper only) or to
      // Bill once the climax triggers — same convention as Loot & Scoot's
      // fence/loot compass.
      let compassTarget = null
      if (state.phase === 'explore' && character.hasCompass) compassTarget = nearestUncollectedPage(state)?.pos ?? null
      else if (state.phase !== 'explore') compassTarget = CLIMAX_POS
      let compassDeg = null
      if (compassTarget) {
        const dx = compassTarget.x - state.player.x, dz = compassTarget.z - state.player.z
        const worldAngle = Math.atan2(-dx, -dz)
        let rel = worldAngle - yaw
        rel = Math.atan2(Math.sin(rel), Math.cos(rel))
        compassDeg = -rel * 180 / Math.PI
      }

      onHudRef.current({
        collected: state.collectedCount, total: TOTAL_PAGES, phase: state.phase,
        toast: state.toast, compassDeg, elapsed: state.elapsed,
      })
      if (state.result === 'victory') onWinRef.current({ time: state.elapsed })
    }
    raf = requestAnimationFrame(tick)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      renderer.domElement.removeEventListener('click', onClick)
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [characterKey])

  return (
    <div ref={mountRef} className={styles.canvasWrap}>
      {!locked && <div className={styles.lockHint}>Click for mouse-look (optional) — WASD/arrows work either way</div>}
    </div>
  )
}

function CharacterCard({ character, onClick }) {
  return (
    <button className={styles.charCard} onClick={onClick}>
      <span className={styles.charIcon}>{character.icon}</span>
      <span className={styles.charName}>{character.name}</span>
      <span className={styles.charDesc}>{character.desc}</span>
    </button>
  )
}

function Hud({ hud, character }) {
  if (!hud) return null
  return (
    <div className={styles.hud}>
      <div className={styles.hudTop}>
        <span className={styles.charTag}>{character.icon} {character.name}</span>
        <span className={styles.journalCount}>📖 {hud.collected}/{hud.total}</span>
        {hud.phase === 'climax' && <span className={styles.climaxTag}>👁 Bill is waiting...</span>}
      </div>
      {hud.compassDeg !== null && (
        <div className={styles.compass}>
          <span className={styles.compassArrow} style={{ transform: `rotate(${hud.compassDeg}deg)` }}>▲</span>
        </div>
      )}
      {hud.toast && <div className={`${styles.toast} ${hud.toast.kind === 'bad' ? styles.toastBad : hud.toast.kind === 'good' ? styles.toastGood : ''}`}>{hud.toast.text}</div>}
    </div>
  )
}

export default function GravityFalls() {
  const [screen, setScreen] = useState('intro')
  const [characterKey, setCharacterKey] = useState(null)
  const [hud, setHud] = useState(null)
  const [result, setResult] = useState(null)
  const [best, setBest] = useState(() => loadBest())

  function chooseCharacter(key) {
    setCharacterKey(key)
    setHud(null)
    setResult(null)
    setScreen('playing')
  }

  function handleWin({ time }) {
    if (result) return
    const updated = saveBest(characterKey, time)
    setBest(b => ({ ...b, [characterKey]: updated }))
    setResult({ time })
    setScreen('result')
  }

  function playAgain() { setScreen('select') }

  const character = characterKey ? getCharacter(characterKey) : null

  return (
    <div className={styles.page}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>🌲 Gravity Falls<span className={styles.subtitle}>Journal Hunt</span></h1>
          <p className={styles.blurb}>
            Pick a character and roam the Mystery Shack grounds, the forest, and downtown Gravity Falls
            looking for torn pages of Journal 3 — ten in all, each with its own one-line mystery. Say hi
            to Stan, Wendy, Soos, and Waddles along the way, and don't get too close to the gnomes (or do,
            they're harmless). Find every page and the sky changes — Bill Cipher is waiting north of town.
          </p>
          <p className={styles.blurb}>W/S move · A/D turn (or mouse-look after clicking)</p>
          <button className={styles.bigBtn} onClick={() => setScreen('select')}>▶ Start Exploring</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'select' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>Choose Your Character</h2>
          <div className={styles.charGrid}>
            {CHARACTERS.map(c => (
              <CharacterCard key={c.key} character={c} onClick={() => chooseCharacter(c.key)} />
            ))}
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <GameCanvas characterKey={characterKey} onHud={setHud} onWin={handleWin} />
          <Hud hud={hud} character={character} />
          <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
        </>
      )}

      {screen === 'result' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>👁 Weirdmageddon... Averted?</h2>
          <p className={styles.blurb}>
            You found all {TOTAL_PAGES} pages as {character.name} in {result.time.toFixed(1)}s.
            {best[characterKey] !== undefined && Math.abs(best[characterKey] - result.time) < 0.001 && ' New best!'}
            {' '}Bill Cipher gives a slow, unsettling thumbs up and dissolves into golden static. For now, Gravity Falls is safe.
          </p>
          <button className={styles.bigBtn} onClick={playAgain}>▶ Play Again</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
