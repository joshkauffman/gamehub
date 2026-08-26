import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import styles from './LilMonsterBattles.module.css'

// ── Monster roster ──────────────────────────────────────────────────────
// Every monster is a mix of two of: cat, bear, dino, alligator — and every
// one gets horns and a tail, per the design brief. Each also has its own
// build (sizeScale) so the six don't just read as one body recolored six
// times, and a short backstory tying it to a home turf on Monster Isle.
const MONSTERS = [
  {
    id: 'furrocub', name: 'Furrocub', mix: 'Cat + Bear', mixEmoji: '🐱+🐻',
    color: '#C97A3D', dark: '#7A4A22', accent: '#FFD873', sizeScale: 0.88,
    ear: 'round', snout: 'short', spikes: false, tailTip: 'tuft',
    special: { name: 'Bear Hug Slam', type: 'lunge', range: 136, dmg: 22, knock: 14 },
    blurb: 'Cuddly-looking, but the hug is not gentle.',
    lore: 'Wandered into a den of Volcano Peak bears as a lost kitten and never left — kept the curiosity, gained the hug.',
  },
  {
    id: 'clawrex', name: 'Clawrex', mix: 'Cat + Dino', mixEmoji: '🐱+🦖',
    color: '#4E9A51', dark: '#2B5C2E', accent: '#FFEE58', sizeScale: 1.0,
    ear: 'point', snout: 'short', spikes: true, tailTip: 'spike',
    special: { name: 'Tail Whirl', type: 'spin', range: 162, dmg: 16, knock: 10 },
    blurb: 'Whips its spiky tail in a big circle.',
    lore: 'Hatched from an egg a Wild Jungle farm cat adopted by accident. Struts around like it owns every fern.',
  },
  {
    id: 'snaptail', name: 'Snaptail', mix: 'Cat + Alligator', mixEmoji: '🐱+🐊',
    color: '#2FA6A1', dark: '#186460', accent: '#E0FFFB', sizeScale: 0.94,
    ear: 'point', snout: 'long', spikes: false, tailTip: 'paddle',
    special: { name: 'Death Roll', type: 'dash', range: 289, dmg: 18, knock: 20 },
    blurb: 'Rolls forward in a teal blur.',
    lore: 'Naps on the one warm rock in Frozen Cave and swims like an alligator whenever nap time is over too soon.',
  },
  {
    id: 'thornbear', name: 'Thornbear', mix: 'Bear + Dino', mixEmoji: '🐻+🦖',
    color: '#8C6B45', dark: '#4F3A23', accent: '#D6FF6B', sizeScale: 1.18,
    ear: 'round', snout: 'short', spikes: true, tailTip: 'spike',
    special: { name: 'Ground Pound', type: 'aoe', range: 238, dmg: 20, knock: 16 },
    blurb: 'Leaps up and slams down hard.',
    lore: 'The gentle giant of Volcano Peak. Slow to anger — but when Thornbear jumps, the whole mountain feels it.',
  },
  {
    id: 'chompclaw', name: 'Chompclaw', mix: 'Bear + Alligator', mixEmoji: '🐻+🐊',
    color: '#5C7A3D', dark: '#33471F', accent: '#FFD1E8', sizeScale: 1.1,
    ear: 'round', snout: 'long', spikes: false, tailTip: 'paddle',
    special: { name: 'Chomp Lunge', type: 'lunge', range: 162, dmg: 27, knock: 8 },
    blurb: 'One huge, unforgettable bite.',
    lore: 'Guards the swampy edge of Wild Jungle and has never once lost a staring contest.',
  },
  {
    id: 'rexjaw', name: 'Rexjaw', mix: 'Dino + Alligator', mixEmoji: '🦖+🐊',
    color: '#3D6B7A', dark: '#203945', accent: '#FFB86B', sizeScale: 1.12,
    ear: 'none', snout: 'long', spikes: true, tailTip: 'spike',
    special: { name: 'Horn Charge', type: 'dash', range: 272, dmg: 16, knock: 26 },
    blurb: 'Charges straight ahead, horns first.',
    lore: 'The oldest rival on Monster Isle — has challenged, and out-charged, every other monster at least twice.',
  },
]

const ARENAS = [
  { id: 'volcano', name: 'Volcano Peak', sky: ['#3a0e0e', '#7a1f0f'], ground: '#241010', glow: '#ff6a1a', deco: 'volcano',
    lore: 'Where the toughest monsters train beside rivers of glowing lava.' },
  { id: 'ice', name: 'Frozen Cave', sky: ['#0b2540', '#1d5c86'], ground: '#c9e9f7', glow: '#8fe0ff', deco: 'ice',
    lore: 'A shimmering ice cavern that never quite thaws, even in summer.' },
  { id: 'jungle', name: 'Wild Jungle', sky: ['#0d2b12', '#1f5c2a'], ground: '#274d22', glow: '#7ee081', deco: 'jungle',
    lore: 'Thick with ferns, secrets, and one very grumpy tree.' },
  { id: 'castle', name: 'Spooky Castle', sky: ['#160a24', '#3a1a4d'], ground: '#241633', glow: '#b98cff', deco: 'castle',
    lore: 'An old castle the monsters moved into after the ghosts got bored and left.' },
]

// A one-off, story-only arena for the final boss — not in ARENAS (never
// shows up in the normal arena picker), deliberately over-the-top stormy
// given what's actually waiting in it. `dramatic: true` turns on lightning
// flashes, a bigger shake, a scarier encounter banner, and a sting.
const FINAL_BOSS_ARENA = {
  id: 'finalboss', name: 'The Final Clearing',
  sky: ['#05030a', '#1c0a2e'], ground: '#0c0714', glow: '#ff2b4d', deco: 'jungle',
  lore: 'Something is different here. The wind has stopped.',
  dramatic: true,
}

const STORY_INTRO = "Long ago Monster Isle split into four lands — fire, ice, jungle, and shadow — each home to its own wild tribes. Now, once a season, monsters from every land set out to find a rival, test their strength in a friendly battle, and see who'll be crowned Monster Isle Champion."

// ── Legendary monsters — unlocked one at a time by beating Story Mode
// trials. `bodyType` picks a different model builder (wings, beak, blocky
// stone body) instead of the base chibi-animal shape.
const LEGENDARY_MONSTERS = [
  {
    id: 'dragon', name: 'Dragon', mix: 'Legendary', mixEmoji: '🐉', legendary: true, bodyType: 'dragon',
    color: '#C7382E', dark: '#6E1A17', accent: '#FFB63D', sizeScale: 1.15,
    ear: 'none', snout: 'long', spikes: true, tailTip: 'spike',
    special: { name: 'Fire Charge', type: 'dash', range: 300, dmg: 22, knock: 22 },
    blurb: 'Hatched from an egg deep inside Volcano Peak.',
    lore: "Small for a dragon, but its fire charge leaves scorch marks twice its size.",
  },
  {
    id: 'griffin', name: 'Griffin', mix: 'Legendary', mixEmoji: '🦅', legendary: true, bodyType: 'griffin',
    color: '#D9B35C', dark: '#7A5A22', accent: '#FFF3D6', sizeScale: 1.05,
    ear: 'none', snout: 'long', spikes: false, tailTip: 'tuft',
    special: { name: 'Talon Dive', type: 'lunge', range: 160, dmg: 25, knock: 16 },
    blurb: 'Swoops down from the cliffs above Frozen Cave.',
    lore: 'Watched every Frozen Cave trial from high above before finally deciding to join in.',
  },
  {
    id: 'golem', name: 'Golem', mix: 'Legendary', mixEmoji: '🗿', legendary: true, bodyType: 'golem',
    color: '#8A8F98', dark: '#4C5058', accent: '#6FE8D1', sizeScale: 1.3,
    ear: 'none', snout: 'short', spikes: false, tailTip: 'tuft',
    special: { name: 'Quake Slam', type: 'aoe', range: 230, dmg: 26, knock: 20 },
    blurb: "Slept inside Spooky Castle's walls for a hundred years.",
    lore: 'Woke up mid-battle and has been in a fantastic mood ever since.',
  },
  {
    // The final boss. Deliberately absurd: tiny, soft, and named Tim.
    id: 'tim', name: 'Tim', mix: 'Final Boss', mixEmoji: '🧶', legendary: true, bodyType: 'fluff',
    color: '#F5EFE0', dark: '#D8CBB0', accent: '#FFC9DE', sizeScale: 0.5,
    ear: 'round', snout: 'short', spikes: false, tailTip: 'tuft',
    special: { name: 'Fluff Bomb', type: 'aoe', range: 260, dmg: 30, knock: 26 },
    blurb: "Don't let the fluff fool you.",
    lore: 'No one remembers where Tim came from, or how he became the final boss. He just is. Deal with it.',
  },
]

const ALL_MONSTERS = [...MONSTERS, ...LEGENDARY_MONSTERS]

// ── Story Mode — three trials plus a final boss, each unlocking one
// legendary ────────────────────────────────────────────────────────────
const STORY_CHAPTERS = [
  {
    id: 'volcano-trial', arenaId: 'volcano', opponentId: 'thornbear',
    title: 'Chapter 1 — The Volcano Trial',
    introText: "Your first trial waits at Volcano Peak, where Thornbear has guarded the mountain since before anyone can remember. Win here, and something ancient stirring beneath the lava might finally wake up...",
    victoryText: 'Thornbear steps aside with a respectful nod. Deep in the volcano, a cracked egg glows red-hot — and a tiny DRAGON bursts out, delighted to meet you!',
    unlocks: 'dragon',
  },
  {
    id: 'ice-trial', arenaId: 'ice', opponentId: 'snaptail',
    title: 'Chapter 2 — The Frozen Trial',
    introText: 'Next up: Frozen Cave, where Snaptail dozes on the one warm rock all winter. Beat Snaptail, and the icy cliffs above might just answer your call.',
    victoryText: 'Snaptail gives a respectful nod (then goes right back to napping). High above the cave, a GRIFFIN swoops down from the cliffs — impressed, and ready to join you!',
    unlocks: 'griffin',
  },
  {
    id: 'castle-trial', arenaId: 'castle', opponentId: 'rexjaw',
    title: 'Chapter 3 — The Castle Trial',
    introText: "Finally: Spooky Castle, home to Rexjaw, the oldest rival on the whole island. Win here, and even the castle's stone walls will take notice.",
    victoryText: "Rexjaw finally meets its match! With a deep rumble, part of the castle wall crumbles away to reveal a GOLEM who's been sleeping there for a hundred years — and it wants to fight alongside you now!",
    unlocks: 'golem',
  },
  {
    id: 'final-boss', arenaOverride: FINAL_BOSS_ARENA, opponentId: 'tim',
    title: 'Chapter 4 — The Final Trial',
    introText: "With Dragon, Griffin, and Golem by your side, only one challenger remains — the one every monster on the island refuses to talk about. Deep in Wild Jungle, past the very grumpiest tree, something small is waiting. Its name... is Tim.",
    victoryText: "Tim tumbles over, squeaks once, and immediately falls asleep in a sunbeam. That's it. That's the final boss. Somehow, against all logic, Tim joins your team!",
    unlocks: 'tim',
  },
]

const UNLOCKS_KEY = 'lilMonsterBattlesUnlocks'
function loadUnlocked() {
  try {
    const saved = JSON.parse(localStorage.getItem(UNLOCKS_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch { return [] }
}
function saveUnlocked(list) {
  try { localStorage.setItem(UNLOCKS_KEY, JSON.stringify(list)) } catch {}
}

// A synthesized "dun dun DUNNN" — three descending sawtooth notes with a
// quick attack and decay. No audio assets needed, and it's triggered from
// a click handler so autoplay policies don't block it.
function playBossSting() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const notes = [196.0, 174.61, 130.81]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.35
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })
    setTimeout(() => ctx.close(), 1700)
  } catch {}
}

// ── Physics constants (abstract sim units — see toWorldX/toWorldY for the
// mapping into actual Three.js world space) ─────────────────────────────
const W = 960, H = 540
const GROUND_Y = 420
const STAGE_L = 110, STAGE_R = 850
const GRAVITY = 0.85
const JUMP_V = 15
const MOVE_SPEED = 3.6
const PUNCH_DUR = 22
const HP_MAX = 100
const WORLD_SCALE = 1 / 80

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function toWorldX(x) { return (x - W / 2) * WORLD_SCALE }
function toWorldY(airY) { return airY * WORLD_SCALE }

// ── Fighter factory & simulation (pure state, no rendering) ────────────
function mkFighter(data, x, name) {
  return {
    data, name, x, airY: 0, vAir: 0, grounded: true,
    facing: 1, hp: HP_MAX, meter: 0, moving: false,
    punchTimer: 0, punchHit: false,
    specialTimer: 0, specialType: null, specialHit: false, specialFacing: 1,
    hitstun: 0, hitFlash: 0, knockVX: 0, frame: 0,
  }
}

function aiInput(cpu, foe) {
  cpu.aiTimer = (cpu.aiTimer || 0) - 1
  if (cpu.aiTimer > 0) return cpu.aiInput || {}
  cpu.aiTimer = 8 + Math.random() * 12
  const dist = Math.abs(foe.x - cpu.x)
  const towardFoe = foe.x < cpu.x ? 'left' : 'right'
  const input = {}
  if (dist > 130) {
    input[towardFoe] = true
    if (Math.random() < 0.06) input.jump = true
  } else if (dist > 70) {
    if (Math.random() < 0.55) input[towardFoe] = true
    if (Math.random() < 0.3) input.punch = true
  } else {
    if (Math.random() < 0.4) input.punch = true
    if (cpu.meter >= 100 && Math.random() < 0.35) input.special = true
    if (Math.random() < 0.15) input[towardFoe === 'left' ? 'right' : 'left'] = true
  }
  cpu.aiInput = input
  return input
}

function triggerSpecial(f) {
  const sp = f.data.special
  f.meter = 0
  f.specialType = sp.type
  f.specialHit = false
  f.specialFacing = f.facing
  f.specialTimer = sp.type === 'aoe' ? 999 : (sp.type === 'dash' ? 32 : 26)
  if (sp.type === 'aoe') { f.vAir = 16; f.grounded = false; f.aoeLaunched = true }
}

function stepFighter(f, foe, input, particles) {
  f.frame++
  if (f.hitFlash > 0) f.hitFlash--
  f.facing = foe.x >= f.x ? 1 : -1
  f.moving = false

  const locked = f.hitstun > 0
  if (!locked) {
    if (f.specialTimer > 0) {
      const sp = f.data.special
      const facing = f.specialFacing
      if (sp.type === 'dash' && f.specialTimer > 16) { f.x += facing * 8.5; f.moving = true }
      if (sp.type === 'lunge' && f.specialTimer > 18) { f.x += facing * 5.5; f.moving = true }
      f.x = clamp(f.x, STAGE_L, STAGE_R)

      const elapsed = (sp.type === 'dash' ? 32 : 26) - f.specialTimer
      const activeWindow = sp.type === 'spin' ? [6, 18] : [10, 22]
      if (!f.specialHit && elapsed >= activeWindow[0] && elapsed <= activeWindow[1]) {
        const dist = Math.abs(foe.x - f.x)
        if (dist <= sp.range) {
          f.specialHit = true
          applyHit(f, foe, sp.dmg, sp.knock, true, particles)
        }
      }
      if (sp.type !== 'aoe') { f.specialTimer--; if (f.specialTimer <= 0) f.specialType = null }
    } else {
      if (input.left) { f.x -= MOVE_SPEED; f.moving = true }
      if (input.right) { f.x += MOVE_SPEED; f.moving = true }
      f.x = clamp(f.x, STAGE_L, STAGE_R)
      if (input.jump && f.grounded) { f.vAir = JUMP_V; f.grounded = false }
      if (input.punch && f.punchTimer <= 0) { f.punchTimer = PUNCH_DUR; f.punchHit = false }
      if (input.special && f.meter >= 100 && f.punchTimer <= 0) triggerSpecial(f)
    }

    if (f.punchTimer > 0) {
      const elapsed = PUNCH_DUR - f.punchTimer
      if (!f.punchHit && elapsed >= 8 && elapsed <= 14) {
        const dist = Math.abs(foe.x - f.x)
        if (dist <= 105) {
          f.punchHit = true
          applyHit(f, foe, 7, 6, false, particles)
        }
      }
      f.punchTimer--
    }
  }

  f.airY += f.vAir
  f.vAir -= GRAVITY
  if (f.airY <= 0) {
    f.airY = 0; f.vAir = 0
    if (!f.grounded && f.aoeLaunched) {
      f.aoeLaunched = false
      const sp = f.data.special
      const dist = Math.abs(foe.x - f.x)
      if (dist <= sp.range) applyHit(f, foe, sp.dmg, sp.knock, true, particles)
      f.specialType = null
      f.specialTimer = 0
      particles.push({ x: f.x, y: GROUND_Y, r: 6, life: 18, color: f.data.accent, ring: true })
    }
    f.grounded = true
  } else {
    f.grounded = false
  }

  if (Math.abs(f.knockVX) > 0.15) {
    f.x = clamp(f.x + f.knockVX, STAGE_L, STAGE_R)
    f.knockVX *= 0.86
  } else f.knockVX = 0

  if (f.hitstun > 0) f.hitstun--
  if (f.meter < 100) f.meter = Math.min(100, f.meter + 0.06)
}

function applyHit(attacker, defender, dmg, knock, isSpecial, particles) {
  defender.hp = Math.max(0, defender.hp - dmg)
  defender.hitstun = isSpecial ? 22 : 11
  defender.hitFlash = 8
  const dir = Math.sign(defender.x - attacker.x) || attacker.facing
  defender.knockVX = dir * knock
  defender.meter = Math.min(100, defender.meter + (isSpecial ? 10 : 5))
  if (!isSpecial) attacker.meter = Math.min(100, attacker.meter + 8)
  for (let i = 0; i < (isSpecial ? 10 : 5); i++) {
    particles.push({
      x: defender.x, y: GROUND_Y - 60,
      vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5 - 1,
      life: 20 + Math.random() * 10, color: isSpecial ? defender.data.accent : '#ffffff',
    })
  }
}

// ── 3D monster model ─────────────────────────────────────────────────
// Shared cartoon-outline material: every mesh gets a slightly-enlarged
// backface-only copy of itself in near-black, a cheap classic toon-outline
// trick that makes the low-poly shapes read as clean, designed toy figures.
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x140b08, side: THREE.BackSide })
const CATCHLIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff })
function withOutline(mesh, scale = 1.1) {
  const outline = new THREE.Mesh(mesh.geometry, OUTLINE_MAT)
  outline.scale.setScalar(scale)
  mesh.add(outline)
}

// Toon/cel shading — the standard technique for stylized game characters.
// A stepped gradient map turns light response into flat color bands instead
// of the smooth plastic-look shading a physical material gives primitives.
function makeToonGradient() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  ;[70, 140, 200, 255].forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(i, 0, 1, 1)
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
}
const TOON_GRADIENT = makeToonGradient()

// One seamless, sculpted torso (deformed sphere: tapers toward the neck at
// +X, bulges into round haunches toward -X) instead of two overlapping
// spheres glued together with a visible seam. Built fresh per monster
// instance (not shared) — each Battle/Explore/thumbnail mount disposes its
// own geometries on unmount, so a shared geometry would get destroyed out
// from under every other still-mounted monster using it.
function buildBodyGeometry() {
  const geo = new THREE.SphereGeometry(0.46, 28, 20)
  const pos = geo.attributes.position
  const R = 0.46
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const t = x / R
    const scale = t > 0 ? 1 - t * 0.3 : 1 + Math.sin(Math.min(-t, 1) * Math.PI) * 0.26
    pos.setXYZ(i, x * scale, y * scale * 0.95, z * scale)
  }
  geo.computeVertexNormals()
  return geo
}

// A stylized wing fan (a rounded shoulder tapering to two clawed "finger"
// tips with scalloped webbing between) — flat enough to read as a wing at
// this level of detail without needing a real membrane simulation.
function buildWingGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.05)
  shape.quadraticCurveTo(0.28, 0.22, 0.62, 0.1)
  shape.quadraticCurveTo(0.5, -0.02, 0.58, -0.22)
  shape.quadraticCurveTo(0.32, -0.14, 0.28, -0.3)
  shape.quadraticCurveTo(0.12, -0.16, 0, -0.12)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false })
}

// Scatters small cone "fur tufts" outward from a center point — used for
// Tim's fluffy pom-pom texture. Each tuft is oriented so its point faces
// away from the center, via a quaternion rather than manually-picked
// rotations (there are too many of them to hand-place).
function scatterFluff(group, mat, center, radius, count) {
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.045 + Math.random() * 0.03, 0.12 + Math.random() * 0.08, 6), mat)
    tuft.position.copy(center).addScaledVector(dir, radius)
    tuft.quaternion.setFromUnitVectors(up, dir)
    group.add(tuft)
  }
}

// Chibi/mascot proportions: a big head with huge eyes on a small stubby
// body is the single most reliable way to make primitive-built characters
// read as an appealing designed creature rather than "shapes stuck
// together" — this is the same formula behind most cute game mascots.
// `opts` lets the legendary body types (dragon/griffin/golem) reuse this
// same rig with a few parts swapped instead of duplicating the whole thing:
//   wings    — dragon, griffin
//   beak     — griffin (replaces the snout)
//   blocky   — golem (faceted icosahedron body/head, no snout/tail/fangs)
//   glowEyes — golem (single glowing eye instead of white+pupil)
function buildChibiModel(data, opts = {}) {
  const group = new THREE.Group()
  const flat = opts.blocky ? { flatShading: true } : {}
  const colorMat = new THREE.MeshToonMaterial({ color: data.color, gradientMap: TOON_GRADIENT, emissive: 0xffffff, emissiveIntensity: 0, ...flat })
  const darkMat = new THREE.MeshToonMaterial({ color: data.dark, gradientMap: TOON_GRADIENT, ...flat })
  const accentMat = new THREE.MeshToonMaterial({ color: data.accent, gradientMap: TOON_GRADIENT, emissive: data.accent, emissiveIntensity: 0.25, ...flat })
  const muzzleColor = new THREE.Color(data.color).lerp(new THREE.Color('#ffffff'), 0.6)
  const muzzleMat = new THREE.MeshToonMaterial({ color: muzzleColor, gradientMap: TOON_GRADIENT })
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const eyeBlackMat = new THREE.MeshBasicMaterial({ color: 0x111111 })

  // torso — small stubby seat for the head, not the main event
  const bodyGeo = opts.blocky ? new THREE.IcosahedronGeometry(0.46, 0) : buildBodyGeometry()
  const body = new THREE.Mesh(bodyGeo, colorMat)
  body.position.set(-0.1, 0.5, 0)
  body.scale.set(0.78, 0.66, 0.72)
  group.add(body)

  function makeLeg(zOff) {
    const pivot = new THREE.Group()
    pivot.position.set(-0.05, 0.26, zOff)
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.1, 4, 10), darkMat)
    leg.position.y = -0.08
    pivot.add(leg)
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), darkMat)
    paw.position.y = -0.2
    paw.scale.set(1.1, 0.6, 1.15)
    pivot.add(paw)
    group.add(pivot)
    return pivot
  }
  const legL = makeLeg(0.2)
  const legR = makeLeg(-0.2)

  const armPivot = new THREE.Group()
  armPivot.position.set(0.26, 0.56, 0)
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.14, 4, 10), darkMat)
  arm.rotation.z = Math.PI / 2
  arm.position.x = 0.1
  armPivot.add(arm)
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), darkMat)
  fist.position.x = 0.2
  armPivot.add(fist)
  group.add(armPivot)

  // head — the dominant shape, overlapping the body so it reads as one
  // cohesive character rather than a ball glued onto another ball
  const headGroup = new THREE.Group()
  headGroup.position.set(0.18, 1.0, 0)
  group.add(headGroup)
  const headGeo = opts.blocky ? new THREE.IcosahedronGeometry(0.5, 0) : new THREE.SphereGeometry(0.5, 24, 20)
  const head = new THREE.Mesh(headGeo, colorMat)
  headGroup.add(head)

  if (opts.beak) {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), accentMat)
    beak.rotation.z = Math.PI / 2
    beak.position.set(0.5, -0.08, 0)
    headGroup.add(beak)
  } else if (!opts.blocky) {
    if (data.snout === 'long') {
      const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.32, 4, 10), muzzleMat)
      snout.rotation.z = Math.PI / 2
      snout.position.set(0.46, -0.1, 0)
      headGroup.add(snout)
    } else {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), muzzleMat)
      bump.position.set(0.36, -0.16, 0)
      bump.scale.set(1, 0.78, 1.05)
      headGroup.add(bump)
    }
  }

  if (data.ear === 'round') {
    [0.3, -0.3].forEach(z => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), darkMat)
      ear.position.set(-0.18, 0.36, z)
      headGroup.add(ear)
    })
  } else if (data.ear === 'point') {
    [0.3, -0.3].forEach(z => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 10), darkMat)
      ear.position.set(-0.18, 0.44, z)
      headGroup.add(ear)
    })
  }

  // horns — every monster gets these
  ;[0.17, -0.17].forEach(z => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.36, 10), accentMat)
    horn.position.set(0.08, 0.52, z)
    horn.rotation.x = z > 0 ? -0.35 : 0.35
    headGroup.add(horn)
  })

  const eyeMeshes = []
  ;[0.24, -0.24].forEach(z => {
    if (opts.glowEyes) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshBasicMaterial({ color: data.accent }))
      eye.position.set(0.4, 0.05, z)
      headGroup.add(eye)
      eyeMeshes.push(eye)
    } else {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), eyeWhiteMat)
      eyeW.position.set(0.36, 0.05, z)
      headGroup.add(eyeW)
      eyeMeshes.push(eyeW)
      const eyeB = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), eyeBlackMat)
      eyeB.position.set(0.47, 0.05, z)
      headGroup.add(eyeB)
      eyeMeshes.push(eyeB)
      const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), CATCHLIGHT_MAT)
      catchlight.position.set(0.52, 0.11, z + (z > 0 ? -0.03 : 0.03))
      headGroup.add(catchlight)
      eyeMeshes.push(catchlight)
    }
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.055), darkMat)
    brow.position.set(0.32, 0.28, z)
    brow.rotation.z = 0.45
    headGroup.add(brow)
    if (!opts.blocky && !opts.beak) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 8), eyeWhiteMat)
      fang.position.set(0.34, -0.28, z * 0.5)
      fang.rotation.x = Math.PI
      headGroup.add(fang)
    }
  })
  eyeMeshes.forEach(m => { m.userData.noOutline = true })

  // spine ridge — a colored stripe running head-to-tail reads clearly from
  // every camera angle (side profile, chase-cam from behind, menu spins)
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.32, 1.38, 0),
    new THREE.Vector3(0.0, 1.28, 0),
    new THREE.Vector3(-0.25, 0.95, 0),
    new THREE.Vector3(-0.4, 0.68, 0),
  ])
  const spine = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 12, 0.05, 6, false), accentMat)
  spine.userData.noOutline = true
  group.add(spine)

  if (data.spikes) {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 10), accentMat)
      s.position.set(0.08 - i * 0.2, 1.1, 0)
      group.add(s)
    }
  }

  // tail — a gentle curved tube reads far more like a real tail than a
  // straight cylinder. Golems don't get one, but still need the pivot
  // group since animateMonsterParts rotates it unconditionally.
  const tailPivot = new THREE.Group()
  tailPivot.position.set(-0.36, 0.56, 0)
  group.add(tailPivot)
  if (!opts.blocky) {
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.26, 0.12, 0),
      new THREE.Vector3(-0.48, 0.06, 0),
      new THREE.Vector3(-0.68, -0.05, 0),
    ])
    const tailBone = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 16, 0.095, 8, false), darkMat)
    tailPivot.add(tailBone)
    let tailTip
    if (data.tailTip === 'spike') {
      tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.27, 10), accentMat)
      tailTip.rotation.z = -Math.PI / 2
    } else if (data.tailTip === 'paddle') {
      tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), darkMat)
      tailTip.scale.set(1, 0.5, 1.4)
    } else {
      tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), accentMat)
    }
    tailTip.position.set(-0.68, -0.05, 0)
    tailPivot.add(tailTip)
  }

  // wings — dragon and griffin
  let wingL, wingR
  if (opts.wings) {
    const wingMat = new THREE.MeshToonMaterial({ color: data.dark, gradientMap: TOON_GRADIENT, side: THREE.DoubleSide })
    const wingGeo = buildWingGeometry()
    // Span direction is the wing shape's local +X, rotated by rotation.y —
    // it must point outward (away from the body) on each side, not inward.
    const wingRotY = -(Math.PI / 2 - 0.4)
    wingL = new THREE.Mesh(wingGeo, wingMat)
    wingL.position.set(-0.08, 0.82, 0.2)
    wingL.rotation.set(0.15, wingRotY, 0)
    wingL.userData.noOutline = true
    group.add(wingL)
    wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.position.set(-0.08, 0.82, -0.2)
    wingR.rotation.set(0.15, wingRotY, 0)
    wingR.scale.z = -1
    wingR.userData.noOutline = true
    group.add(wingR)
  }

  // fluff — Tim only. Tiny cone tufts scattered over the head/body give a
  // pom-pom texture; each one is too small to bother outlining.
  if (opts.fluffy) {
    const fluffMat = new THREE.MeshToonMaterial({ color: data.accent, gradientMap: TOON_GRADIENT })
    const fluffStart = group.children.length
    scatterFluff(group, fluffMat, new THREE.Vector3(0.05, 0.85, 0), 0.5, 45)
    for (let i = fluffStart; i < group.children.length; i++) group.children[i].userData.noOutline = true
  }

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.05, 8, 24),
    new THREE.MeshStandardMaterial({ color: data.accent, emissive: data.accent, emissiveIntensity: 1.3, transparent: true, opacity: 0 })
  )
  glowRing.rotation.x = Math.PI / 2
  glowRing.position.y = 0.8
  glowRing.userData.noOutline = true
  group.add(glowRing)

  const outlineTargets = []
  group.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
      if (!o.userData.noOutline) outlineTargets.push(o)
    }
  })
  outlineTargets.forEach(m => withOutline(m))

  group.scale.setScalar(data.sizeScale || 1)

  return { group, legL, legR, armPivot, tailPivot, glowRing, colorMat, wingL, wingR }
}

// Base six get the plain chibi rig; legendaries reuse it with a few parts
// swapped (see buildChibiModel's opts) instead of a whole separate build.
function buildMonsterModel(data) {
  if (data.bodyType === 'dragon') return buildChibiModel(data, { wings: true })
  if (data.bodyType === 'griffin') return buildChibiModel(data, { wings: true, beak: true })
  if (data.bodyType === 'golem') return buildChibiModel(data, { blocky: true, glowEyes: true })
  if (data.bodyType === 'fluff') return buildChibiModel(data, { fluffy: true })
  return buildChibiModel(data, {})
}

function animateMonsterParts(model, f) {
  const swing = (f.moving && f.grounded !== false) ? Math.sin(f.frame * 0.35) * 0.5 : 0
  model.legL.rotation.x = swing
  model.legR.rotation.x = -swing
  model.tailPivot.rotation.y = Math.sin(f.frame * 0.15) * 0.35
  if (model.wingL && model.wingR) {
    const flap = Math.sin(f.frame * 0.2) * 0.3
    model.wingL.rotation.x = flap
    model.wingR.rotation.x = -flap
  }
  const punching = f.punchTimer > 0 || (f.specialTimer > 0 && f.specialType === 'lunge')
  model.armPivot.rotation.z += ((punching ? -1.1 : -0.15) - model.armPivot.rotation.z) * 0.5
  model.colorMat.emissiveIntensity = f.hitFlash > 0 ? Math.min(1, f.hitFlash / 8) : 0
  const wantGlow = f.specialTimer > 0 ? 0.55 : 0
  model.glowRing.material.opacity += (wantGlow - model.glowRing.material.opacity) * 0.4
  if (f.specialTimer > 0) model.glowRing.rotation.z += 0.12
}

function poseBattleModel(model, f) {
  model.group.position.set(toWorldX(f.x), toWorldY(f.airY), 0)
  model.group.rotation.y = f.facing >= 0 ? 0 : Math.PI
  animateMonsterParts(model, f)
}

function disposeMaterial(m) {
  // NOTE: gradientMap (TOON_GRADIENT) and outline/catchlight materials are
  // intentional module-level singletons shared across every monster
  // instance — never dispose those here, only per-instance textures like a
  // ground map.
  if (m.map) m.map.dispose()
  m.dispose()
}
function disposeObject(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(disposeMaterial)
      else disposeMaterial(o.material)
    }
  })
}

// ── Shared sky / ground texturing ───────────────────────────────────
// A flat-color plane and a 2-stop gradient read as placeholder geometry; a
// tiled noise texture on the ground and a richer, detailed sky are most of
// the difference between "primitives" and "a game".
function makeSkyTexture(arena) {
  // scene.background stretches this single image across the whole viewport
  // (not tiled) — any fine detail (stars, clouds) gets smeared into blurry
  // blobs at that scale, so keep this a clean gradient only. Sky "interest"
  // (moon, lava glow) comes from real 3D objects in the scene instead.
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, arena.sky[0])
  grad.addColorStop(1, arena.sky[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeGroundTexture(arena, repeat = 12) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = arena.ground
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 260; i++) {
    const light = Math.random() < 0.5
    ctx.fillStyle = `rgba(${light ? 255 : 0},${light ? 255 : 0},${light ? 255 : 0},${Math.random() * 0.05})`
    ctx.beginPath()
    ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 2.2 + 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  return tex
}

// Filmic tone mapping is a native renderer feature (a per-pixel curve baked
// into the standard render path) — it gives a more cinematic color response
// for free. An EffectComposer + UnrealBloomPass was tried for extra glow but
// measured a ~6x framerate drop (60fps -> ~10fps) from its multi-pass
// downsample/blur chain; since this game ticks its simulation once per
// rendered frame, that's not just choppier, it's slow-motion. Not worth it.
function setFilmicTone(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
}

// ── 3D arena ─────────────────────────────────────────────────────────
function buildArena(scene, arena) {
  scene.background = makeSkyTexture(arena)
  scene.fog = new THREE.Fog(new THREE.Color(arena.sky[1]).getHex(), 13, 32)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(arena, 10), roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  scene.add(new THREE.HemisphereLight(0xffffff, arena.ground, 0.65))
  scene.add(new THREE.AmbientLight(0xffffff, 0.45))
  const sun = new THREE.DirectionalLight(0xffffff, 1.05)
  sun.position.set(-6, 10, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -9
  sun.shadow.camera.right = 9
  sun.shadow.camera.top = 9
  sun.shadow.camera.bottom = -9
  sun.shadow.camera.far = 25
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xffffff, 0.3)
  fill.position.set(5, 5, 6)
  scene.add(fill)
  const glowLight = new THREE.PointLight(arena.glow, 1.3, 22)
  glowLight.position.set(0, 3, -5)
  scene.add(glowLight)

  const deco = new THREE.Group()
  scene.add(deco)

  if (arena.deco === 'volcano') {
    const rockMat = new THREE.MeshStandardMaterial({ color: '#1a0806', roughness: 1 })
    ;[-5.5, 5.5].forEach(x => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4, 5), rockMat)
      cone.position.set(x, 2, -7)
      cone.castShadow = true
      deco.add(cone)
    })
    const lava = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 20, 16),
      new THREE.MeshStandardMaterial({ color: arena.glow, emissive: arena.glow, emissiveIntensity: 1.2 })
    )
    lava.position.set(0, 1, -8.5)
    deco.add(lava)
  } else if (arena.deco === 'ice') {
    const crystalMat = new THREE.MeshStandardMaterial({ color: '#bdeeff', roughness: 0.15, transparent: true, opacity: 0.75, emissive: '#8fe0ff', emissiveIntensity: 0.25 })
    for (let i = 0; i < 6; i++) {
      const x = -6 + i * 2.4
      const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + (i % 3) * 0.15, 0), crystalMat)
      crystal.position.set(x, 1.2 + (i % 3) * 0.3, -6.5)
      crystal.scale.y = 1.8
      crystal.castShadow = true
      deco.add(crystal)
    }
  } else if (arena.deco === 'jungle') {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3420', roughness: 1 })
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2f7a3a', roughness: 0.9 })
    for (let i = 0; i < 6; i++) {
      const x = -6.5 + i * 2.6
      const tree = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.8, 6), trunkMat)
      trunk.position.y = 0.9
      tree.add(trunk)
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), leafMat)
      leaf.position.y = 2.1
      leaf.scale.set(1, 0.9, 1)
      tree.add(leaf)
      tree.position.set(x, 0, -6.5)
      tree.traverse(o => { if (o.isMesh) o.castShadow = true })
      deco.add(tree)
    }
  } else if (arena.deco === 'castle') {
    const towerMat = new THREE.MeshStandardMaterial({ color: '#241633', roughness: 0.9 })
    const roofMat = new THREE.MeshStandardMaterial({ color: arena.glow, roughness: 0.6, emissive: arena.glow, emissiveIntensity: 0.15 })
    for (let i = 0; i < 4; i++) {
      const x = -6 + i * 4
      const tower = new THREE.Group()
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 3.2, 10), towerMat)
      body.position.y = 1.6
      tower.add(body)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 10), roofMat)
      roof.position.y = 3.75
      tower.add(roof)
      tower.position.set(x, 0, -7)
      tower.traverse(o => { if (o.isMesh) o.castShadow = true })
      deco.add(tower)
    }
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 20, 16),
      new THREE.MeshStandardMaterial({ color: '#e8ddff', emissive: '#c9b8ff', emissiveIntensity: 0.7 })
    )
    moon.position.set(4, 7, -12)
    deco.add(moon)
  }

  return deco
}

// ── Open-world exploration ──────────────────────────────────────────
// Free-roam movement lives in real (x,z) world units — separate from the
// abstract 1D stage sim the Battle screen uses.
const WORLD_RADIUS = 32
const ENCOUNTER_RADIUS = 3.2
const EXPLORE_SPEED = 0.15
const EXPLORE_TURN = 0.045

function mkExplorer(data, x, z, heading, name) {
  return { data, name, x, z, heading, frame: 0, moving: false }
}

// Model forward is built along local +X, so with group.rotation.y = heading
// the world-space forward direction is (cos(heading), 0, -sin(heading)) —
// this matches the facing convention already used by the battle stage sim.
function stepExplorer(e, input) {
  e.frame++
  e.moving = false
  if (input.left) e.heading += EXPLORE_TURN
  if (input.right) e.heading -= EXPLORE_TURN
  const dir = input.forward ? 1 : input.back ? -1 : 0
  if (dir !== 0) {
    e.x += Math.cos(e.heading) * EXPLORE_SPEED * dir
    e.z -= Math.sin(e.heading) * EXPLORE_SPEED * dir
    e.moving = true
    const r = Math.hypot(e.x, e.z)
    if (r > WORLD_RADIUS) { e.x *= WORLD_RADIUS / r; e.z *= WORLD_RADIUS / r }
  }
}

function wanderAI(e) {
  e.wanderTimer = (e.wanderTimer || 0) - 1
  if (e.wanderTimer > 0) return e.wanderInput || {}
  e.wanderTimer = 50 + Math.random() * 90
  const input = {}
  const roll = Math.random()
  if (roll < 0.75) {
    input.forward = true
    if (Math.random() < 0.6) input[Math.random() < 0.5 ? 'left' : 'right'] = true
  } else if (roll < 0.9) {
    input.left = Math.random() < 0.5
    input.right = !input.left
  }
  e.wanderInput = input
  return input
}

function poseExploreModel(model, e) {
  model.group.position.set(e.x, 0, e.z)
  model.group.rotation.y = e.heading
  animateMonsterParts(model, { frame: e.frame, moving: e.moving, grounded: true, punchTimer: 0, specialTimer: 0, hitFlash: 0 })
}

// ── Open-world decoration factories (scattered across a big field) ─────
function decoVolcanoRock() {
  const rockMat = new THREE.MeshStandardMaterial({ color: '#1a0806', roughness: 1 })
  return new THREE.Mesh(new THREE.ConeGeometry(1.8 + Math.random() * 1.2, 3 + Math.random() * 2, 5), rockMat)
}
function decoIceCrystal() {
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#bdeeff', roughness: 0.15, transparent: true, opacity: 0.75, emissive: '#8fe0ff', emissiveIntensity: 0.25 })
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.35, 0), crystalMat)
  crystal.scale.y = 1.6 + Math.random() * 0.6
  return crystal
}
function decoJungleTree() {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3420', roughness: 1 })
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f7a3a', roughness: 0.9 })
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.8, 6), trunkMat)
  trunk.position.y = 0.9
  tree.add(trunk)
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + Math.random() * 0.3, 0), leafMat)
  leaf.position.y = 2.1
  tree.add(leaf)
  return tree
}
function decoCastleTower(arena) {
  const towerMat = new THREE.MeshStandardMaterial({ color: '#241633', roughness: 0.9 })
  const roofMat = new THREE.MeshStandardMaterial({ color: arena.glow, roughness: 0.6, emissive: arena.glow, emissiveIntensity: 0.15 })
  const tower = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 3.2, 10), towerMat)
  body.position.y = 1.6
  tower.add(body)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 10), roofMat)
  roof.position.y = 3.75
  tower.add(roof)
  return tower
}

function buildOpenWorld(scene, arena) {
  scene.background = makeSkyTexture(arena)
  scene.fog = new THREE.Fog(new THREE.Color(arena.sky[1]).getHex(), 20, 160)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_RADIUS * 3, WORLD_RADIUS * 3),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(arena, 24), roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  scene.add(new THREE.HemisphereLight(0xffffff, arena.ground, 0.7))
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 1.05)
  sun.position.set(-10, 16, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -20
  sun.shadow.camera.right = 20
  sun.shadow.camera.top = 20
  sun.shadow.camera.bottom = -20
  sun.shadow.camera.far = 45
  scene.add(sun)

  const deco = new THREE.Group()
  scene.add(deco)
  const colliders = []
  const count = 26
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = 8 + Math.random() * (WORLD_RADIUS - 4)
    let piece = null
    if (arena.deco === 'volcano') piece = decoVolcanoRock()
    else if (arena.deco === 'ice') piece = decoIceCrystal()
    else if (arena.deco === 'jungle') piece = decoJungleTree()
    else if (arena.deco === 'castle') piece = decoCastleTower(arena)
    if (!piece) continue
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r
    piece.position.set(x, 0, z)
    piece.rotation.y = Math.random() * Math.PI * 2
    const s = 0.75 + Math.random() * 0.6
    piece.scale.multiplyScalar(s)
    piece.traverse(o => { if (o.isMesh) o.castShadow = true })
    deco.add(piece)
    colliders.push({ x, z, r: 0.85 * s })
  }
  if (arena.deco === 'volcano') {
    const lava = new THREE.Mesh(
      new THREE.SphereGeometry(3, 20, 16),
      new THREE.MeshStandardMaterial({ color: arena.glow, emissive: arena.glow, emissiveIntensity: 1.1 })
    )
    lava.position.set(WORLD_RADIUS * 0.3, 1.5, -WORLD_RADIUS * 0.85)
    deco.add(lava)
  } else if (arena.deco === 'castle') {
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 20, 16),
      new THREE.MeshStandardMaterial({ color: '#e8ddff', emissive: '#c9b8ff', emissiveIntensity: 0.7 })
    )
    moon.position.set(-WORLD_RADIUS * 0.5, 14, -WORLD_RADIUS * 1.1)
    deco.add(moon)
  }

  return { colliders }
}

function resolveCollisions(e, colliders, clearance = 0.55) {
  for (const c of colliders) {
    const dx = e.x - c.x, dz = e.z - c.z
    const d = Math.hypot(dx, dz)
    const minD = c.r + clearance
    if (d < minD && d > 0.0001) {
      const push = minD - d
      e.x += (dx / d) * push
      e.z += (dz / d) * push
    }
  }
}

// ── Battle screen ────────────────────────────────────────────────────
function Battle({ p1Data, p2Data, mode, arena, onFinish }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const hpP1Ref = useRef(null)
  const hpP2Ref = useRef(null)
  const meterP1Ref = useRef(null)
  const meterP2Ref = useRef(null)
  const lightningRef = useRef(null)
  const [banner, setBanner] = useState(null)
  const dramatic = !!arena.dramatic

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    buildArena(scene, arena)

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 3.3, 10.5)
    camera.lookAt(0, 1.5, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    setFilmicTone(renderer)

    const p1 = mkFighter(p1Data, W * 0.3, 'P1')
    const p2 = mkFighter(p2Data, W * 0.7, mode === 'cpu' ? 'CPU' : 'P2')
    const p1Model = buildMonsterModel(p1Data)
    const p2Model = buildMonsterModel(p2Data)
    scene.add(p1Model.group, p2Model.group)

    const particleGeo = new THREE.SphereGeometry(0.055, 6, 6)
    const ringGeo = new THREE.RingGeometry(0.3, 0.4, 28)
    let particleSpecs = []
    const particleMeshes = []

    function onKeyDown(e) {
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)
      if (blocked) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function readP1() {
      const k = keysRef.current
      return { left: k.has('KeyA'), right: k.has('KeyD'), jump: k.has('KeyW'), punch: k.has('KeyF'), special: k.has('KeyG') }
    }
    function readP2() {
      const k = keysRef.current
      return { left: k.has('ArrowLeft'), right: k.has('ArrowRight'), jump: k.has('ArrowUp'), punch: k.has('KeyK'), special: k.has('KeyL') }
    }

    function onResize() {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    let over = false
    let overTimer = 0
    let shake = 0
    let bannerShown = false
    let lightningTimer = dramatic ? 30 + Math.random() * 60 : Infinity
    let lightningOpacity = 0

    function spawnParticleMeshes() {
      for (const spec of particleSpecs) {
        let mesh
        if (spec.ring) {
          mesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
            color: spec.color, emissive: spec.color, emissiveIntensity: 1, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
          }))
          mesh.rotation.x = -Math.PI / 2
          mesh.position.set(toWorldX(spec.x), 0.02, 0)
        } else {
          mesh = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 1 }))
          mesh.position.set(toWorldX(spec.x), (GROUND_Y - spec.y) * WORLD_SCALE, 0)
        }
        scene.add(mesh)
        particleMeshes.push({ spec, mesh })
      }
      particleSpecs = []
    }

    function updateParticleMeshes() {
      for (let i = particleMeshes.length - 1; i >= 0; i--) {
        const p = particleMeshes[i]
        p.spec.life--
        if (p.spec.ring) {
          p.spec.r += 3
          p.mesh.scale.setScalar(0.5 + p.spec.r * WORLD_SCALE)
        } else {
          p.spec.x += p.spec.vx
          p.spec.y += p.spec.vy
          p.spec.vy += 0.25
          p.mesh.position.set(toWorldX(p.spec.x), (GROUND_Y - p.spec.y) * WORLD_SCALE, 0)
        }
        p.mesh.material.opacity = clamp(p.spec.life / 20, 0, 1)
        if (p.spec.life <= 0) {
          scene.remove(p.mesh)
          p.mesh.material.dispose()
          particleMeshes.splice(i, 1)
        }
      }
    }

    function step() {
      const p1in = readP1()
      const p2in = mode === 'cpu' ? aiInput(p2, p1) : readP2()

      if (!over) {
        stepFighter(p1, p2, p1in, particleSpecs)
        stepFighter(p2, p1, p2in, particleSpecs)
        spawnParticleMeshes()
        if (p1.hp <= 0 || p2.hp <= 0) { over = true; overTimer = 70; shake = dramatic ? 26 : 14 }
      } else {
        overTimer--
        if (!bannerShown) {
          bannerShown = true
          const text = p1.hp <= 0 && p2.hp <= 0 ? "It's a tie!" : (p1.hp <= 0 ? `${p2.name} wins!` : `${p1.name} wins!`)
          setBanner(text)
        }
        if (overTimer <= 0) {
          const winner = p1.hp <= 0 && p2.hp <= 0 ? 'draw' : (p1.hp <= 0 ? 'p2' : 'p1')
          onFinish(winner)
          return
        }
      }

      updateParticleMeshes()
      poseBattleModel(p1Model, p1)
      poseBattleModel(p2Model, p2)

      if (dramatic) {
        lightningTimer--
        if (lightningTimer <= 0) {
          lightningOpacity = 0.7
          lightningTimer = 90 + Math.random() * 200
        }
        lightningOpacity *= 0.82
        if (lightningRef.current) lightningRef.current.style.opacity = lightningOpacity
      }

      if (shake > 0) {
        camera.position.x = (Math.random() - 0.5) * 0.06 * shake
        camera.position.y = 3.3 + (Math.random() - 0.5) * 0.04 * shake
        shake--
      } else {
        camera.position.x = 0
        camera.position.y = 3.3
      }

      if (hpP1Ref.current) hpP1Ref.current.style.width = `${(p1.hp / HP_MAX) * 100}%`
      if (hpP2Ref.current) hpP2Ref.current.style.width = `${(p2.hp / HP_MAX) * 100}%`
      if (meterP1Ref.current) meterP1Ref.current.style.width = `${p1.meter}%`
      if (meterP2Ref.current) meterP2Ref.current.style.width = `${p2.meter}%`

      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      disposeObject(scene)
      if (scene.background && scene.background.isTexture) scene.background.dispose()
      particleMeshes.forEach(p => p.mesh.material.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [p1Data, p2Data, mode, arena, onFinish])

  return (
    <div className={styles.battleWrap}>
      <div ref={mountRef} className={styles.canvas3d} />
      {dramatic && <div ref={lightningRef} className={styles.lightningFlash} />}

      <div className={styles.hudTop}>
        <div className={styles.fighterPanel}>
          <span className={styles.fighterName}>P1 · {p1Data.name}{p1Data.mix === 'Final Boss' ? <span className={styles.bossBadge}>FINAL BOSS</span> : null}</span>
          <div className={styles.hpBarBg}><div ref={hpP1Ref} className={styles.hpBarFill} /></div>
          <div className={styles.meterBarBg}><div ref={meterP1Ref} className={styles.meterBarFill} style={{ background: p1Data.accent }} /></div>
        </div>
        <div className={styles.arenaLabel}>{arena.name}</div>
        <div className={`${styles.fighterPanel} ${styles.fighterPanelRight}`}>
          <span className={styles.fighterName}>{mode === 'cpu' ? 'CPU' : 'P2'} · {p2Data.name}{p2Data.mix === 'Final Boss' ? <span className={styles.bossBadge}>FINAL BOSS</span> : null}</span>
          <div className={styles.hpBarBg}><div ref={hpP2Ref} className={styles.hpBarFill} /></div>
          <div className={styles.meterBarBg}><div ref={meterP2Ref} className={styles.meterBarFill} style={{ background: p2Data.accent }} /></div>
        </div>
      </div>

      {banner && (
        <div className={`${styles.koBanner} ${dramatic ? styles.koBannerDramatic : ''}`}>{banner}</div>
      )}

      <div className={styles.legend}>
        <span><strong>P1</strong> — A/D move · W jump · F punch · G special</span>
        {mode === 'twoplayer' && <span><strong>P2</strong> — ←/→ move · ↑ jump · K punch · L special</span>}
      </div>
    </div>
  )
}

// ── Explore screen — free-roam the open world until you find the other
// monster, then it hands off into Battle ──────────────────────────────
function Explore({ p1Data, p2Data, mode, arena, onEncounter }) {
  const mountRef = useRef(null)
  const keysRef = useRef(new Set())
  const rafRef = useRef(null)
  const compassRef = useRef(null)
  const distRef = useRef(null)
  const lightningRef = useRef(null)
  const [banner, setBanner] = useState(null)
  const dramatic = !!arena.dramatic

  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    const { colliders } = buildOpenWorld(scene, arena)

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 220)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    setFilmicTone(renderer)

    const startAngle = Math.random() * Math.PI * 2
    // Headings are chosen so each explorer starts facing the other spawn
    // point (forward direction is (cos h, 0, -sin h) — see stepExplorer).
    const p1 = mkExplorer(p1Data, Math.cos(startAngle) * 14, Math.sin(startAngle) * 14, Math.PI - startAngle, 'P1')
    const p2 = mkExplorer(p2Data, Math.cos(startAngle + Math.PI) * 14, Math.sin(startAngle + Math.PI) * 14, -startAngle, mode === 'cpu' ? 'CPU' : 'P2')
    const p1Model = buildMonsterModel(p1Data)
    const p2Model = buildMonsterModel(p2Data)
    scene.add(p1Model.group, p2Model.group)

    // camera starts wherever the follow logic below will settle it
    camera.position.set(p1.x - 6, 4, p1.z)
    camera.lookAt(p1.x, 1, p1.z)

    function onKeyDown(e) {
      const blocked = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)
      if (blocked) e.preventDefault()
      keysRef.current.add(e.code)
    }
    function onKeyUp(e) { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function readP1() {
      const k = keysRef.current
      return { forward: k.has('KeyW'), back: k.has('KeyS'), left: k.has('KeyA'), right: k.has('KeyD') }
    }
    function readP2() {
      const k = keysRef.current
      return { forward: k.has('ArrowUp'), back: k.has('ArrowDown'), left: k.has('ArrowLeft'), right: k.has('ArrowRight') }
    }

    function onResize() {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    let encountering = false
    let encounterTimer = 0
    const camPos = camera.position.clone()
    let lightningTimer = dramatic ? 40 + Math.random() * 60 : Infinity
    let lightningOpacity = 0

    function step() {
      const p1in = readP1()
      const p2in = mode === 'cpu' ? wanderAI(p2) : readP2()

      if (!encountering) {
        stepExplorer(p1, p1in)
        stepExplorer(p2, p2in)
        resolveCollisions(p1, colliders)
        resolveCollisions(p2, colliders)
        const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z)
        if (compassRef.current && distRef.current) {
          const targetAngle = Math.atan2(-(p2.z - p1.z), p2.x - p1.x)
          let rel = targetAngle - p1.heading
          rel = ((rel + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
          compassRef.current.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`
          distRef.current.textContent = dist > 20 ? 'Far away' : dist > 10 ? 'Getting closer!' : dist > ENCOUNTER_RADIUS + 1 ? 'Very close!' : 'Right here!'
        }
        if (dist < ENCOUNTER_RADIUS) {
          encountering = true
          encounterTimer = dramatic ? 100 : 55
          setBanner(dramatic ? '⚡ THE FINAL BOSS APPROACHES ⚡' : (mode === 'cpu' ? `A wild ${p2Data.name} appears!` : 'Monsters meet!'))
        }
      } else {
        encounterTimer--
        if (encounterTimer <= 0) { onEncounter(); return }
      }

      if (dramatic) {
        lightningTimer--
        if (lightningTimer <= 0) {
          lightningOpacity = 0.8
          lightningTimer = 70 + Math.random() * 150
        }
        lightningOpacity *= 0.82
        if (lightningRef.current) lightningRef.current.style.opacity = lightningOpacity
      }

      poseExploreModel(p1Model, p1)
      poseExploreModel(p2Model, p2)

      if (mode === 'cpu') {
        const camDist = encountering ? (dramatic ? 3.2 : 4.5) : 6.5
        const desired = new THREE.Vector3(
          p1.x - Math.cos(p1.heading) * camDist,
          3.1,
          p1.z + Math.sin(p1.heading) * camDist
        )
        resolveCollisions(desired, colliders, 0.7)
        camPos.lerp(desired, 0.07)
        camera.position.copy(camPos)
        if (dramatic && encountering) {
          camera.position.x += (Math.random() - 0.5) * 0.12
          camera.position.y += (Math.random() - 0.5) * 0.08
        }
        const lookX = p1.x + Math.cos(p1.heading) * 2
        const lookZ = p1.z - Math.sin(p1.heading) * 2
        camera.lookAt(lookX, 1.1, lookZ)
      } else {
        const midX = (p1.x + p2.x) / 2, midZ = (p1.z + p2.z) / 2
        const sep = Math.hypot(p2.x - p1.x, p2.z - p1.z)
        const dist = clamp(9 + sep * 1.0, 9, 85)
        // Steep, near-top-down angle: however the two players spread apart
        // (side to side or toward/away from the camera), both stay framed —
        // a shallower angle can put a far player behind the camera entirely.
        const desired = new THREE.Vector3(midX, dist * 0.92, midZ + dist * 0.32)
        resolveCollisions(desired, colliders, 0.7)
        camPos.lerp(desired, 0.06)
        camera.position.copy(camPos)
        camera.lookAt(midX, 1, midZ)
      }

      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      disposeObject(scene)
      if (scene.background && scene.background.isTexture) scene.background.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [p1Data, p2Data, mode, arena, onEncounter])

  return (
    <div className={styles.battleWrap}>
      <div ref={mountRef} className={styles.canvas3d} />
      {dramatic && <div ref={lightningRef} className={styles.lightningFlash} />}

      <div className={styles.arenaLabelTop}>{arena.name}</div>

      {mode === 'cpu' && (
        <div className={styles.compassPanel}>
          <div className={styles.compassLabel}>Find {p2Data.name}!</div>
          <div className={styles.compassDial}>
            <div ref={compassRef} className={styles.compassArrow}>▲</div>
          </div>
          <div ref={distRef} className={styles.compassDist}>Far away</div>
        </div>
      )}

      {banner && <div className={`${styles.koBanner} ${dramatic ? styles.koBannerDramatic : ''}`}>{banner}</div>}

      <div className={styles.legend}>
        <span><strong>P1</strong> — W forward · S back · A/D turn</span>
        {mode === 'twoplayer' && <span><strong>P2</strong> — ↑ forward · ↓ back · ←/→ turn</span>}
      </div>
    </div>
  )
}

// ── 3D monster thumbnail (menus) ────────────────────────────────────
function MonsterThumb({ monster, size = 96 }) {
  const mountRef = useRef(null)
  useEffect(() => {
    const mount = mountRef.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20)
    camera.position.set(0, 1.35, 4.4)
    camera.lookAt(0, 0.9, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(3, 5, 4)
    scene.add(key)

    const model = buildMonsterModel(monster)
    scene.add(model.group)

    let raf, frame = 0
    function loop() {
      frame++
      model.group.rotation.y = frame * 0.018
      animateMonsterParts(model, { frame, moving: true, grounded: true, punchTimer: 0, specialTimer: 0, hitFlash: 0 })
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      disposeObject(scene)
      renderer.dispose()
      renderer.forceContextLoss()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [monster, size])
  return <div ref={mountRef} className={styles.thumb3d} style={{ width: size, height: size }} />
}

// ── Top-level app: title / mode / select / arena / battle / result ─────
export default function LilMonsterBattles() {
  const [screen, setScreen] = useState('title')
  const [mode, setMode] = useState(null)
  const [p1Choice, setP1Choice] = useState(null)
  const [p2Choice, setP2Choice] = useState(null)
  const [arena, setArena] = useState(null)
  const [winner, setWinner] = useState(null)
  const [unlocked, setUnlocked] = useState(() => loadUnlocked())
  const [storyMode, setStoryMode] = useState(false)
  const [chapterIndex, setChapterIndex] = useState(0)

  const availableMonsters = [...MONSTERS, ...LEGENDARY_MONSTERS.filter(m => unlocked.includes(m.id))]

  function pickMode(m) {
    setMode(m)
    setP1Choice(null)
    setP2Choice(null)
    setScreen('select-p1')
  }

  function pickP1(m) {
    setP1Choice(m)
    if (mode === 'cpu') {
      const pool = availableMonsters.filter(x => x.id !== m.id)
      setP2Choice(pool[Math.floor(Math.random() * pool.length)])
      setScreen('select-arena')
    } else {
      setScreen('select-p2')
    }
  }

  function pickP2(m) {
    setP2Choice(m)
    setScreen('select-arena')
  }

  function pickArena(a) {
    setArena(a)
    setScreen('explore')
  }

  function handleEncounter() {
    setScreen('battle')
  }

  function handleFinish(w) {
    if (storyMode) {
      if (w === 'p1') {
        const chapter = STORY_CHAPTERS[chapterIndex]
        setUnlocked(prev => {
          const next = prev.includes(chapter.unlocks) ? prev : [...prev, chapter.unlocks]
          saveUnlocked(next)
          return next
        })
        setScreen('story-victory')
      } else {
        setScreen('story-retry')
      }
      return
    }
    setWinner(w)
    setScreen('result')
  }

  function rematch() {
    setWinner(null)
    setScreen('battle')
  }

  function newMatchup() {
    setMode(null); setP1Choice(null); setP2Choice(null); setArena(null); setWinner(null)
    setScreen('title')
  }

  // ── Story Mode ─────────────────────────────────────────────────────
  function startStory() {
    setStoryMode(true)
    setChapterIndex(0)
    setP1Choice(null); setP2Choice(null); setArena(null)
    setScreen('story-intro-start')
  }

  function pickStoryHero(m) {
    setP1Choice(m)
    setMode('cpu')
    setScreen('story-chapter-intro')
  }

  function beginChapter() {
    const chapter = STORY_CHAPTERS[chapterIndex]
    setP2Choice(ALL_MONSTERS.find(m => m.id === chapter.opponentId))
    const chapterArena = chapter.arenaOverride || ARENAS.find(a => a.id === chapter.arenaId)
    setArena(chapterArena)
    if (chapterArena.dramatic) playBossSting()
    setScreen('explore')
  }

  function nextChapter() {
    if (chapterIndex + 1 >= STORY_CHAPTERS.length) {
      setScreen('story-finale')
    } else {
      setChapterIndex(chapterIndex + 1)
      setScreen('story-chapter-intro')
    }
  }

  function retryChapter() {
    setScreen('story-chapter-intro')
  }

  function exitStory() {
    setStoryMode(false)
    setChapterIndex(0)
    setMode(null); setP1Choice(null); setP2Choice(null); setArena(null); setWinner(null)
    setScreen('title')
  }

  return (
    <div className={styles.page}>
      {screen === 'title' && (
        <div className={styles.center}>
          <h1 className={styles.title}>🐲 Lil' Monster Battles</h1>
          <p className={styles.subtitle}>Mix-and-match monsters. Punch. Charge up. Smash your special move.</p>
          <p className={styles.storyIntro}>{STORY_INTRO}</p>
          <button className={styles.bigBtn} onClick={() => setScreen('mode')}>▶ Start</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'mode' && (
        <div className={styles.center}>
          <h2 className={styles.h2}>Who's playing?</h2>
          <div className={styles.modeRow}>
            <button className={styles.modeBtn} onClick={() => pickMode('cpu')}>
              🧠 1 Player <span>vs the Computer</span>
            </button>
            <button className={styles.modeBtn} onClick={() => pickMode('twoplayer')}>
              🎮 2 Players <span>same keyboard</span>
            </button>
            <button className={styles.modeBtn} onClick={startStory}>
              📖 Story Mode <span>4 trials · unlock legends</span>
            </button>
          </div>
          <button className={styles.backBtn} onClick={() => setScreen('title')}>← Back</button>
        </div>
      )}

      {screen === 'select-p1' && (
        <SelectScreen
          title={mode === 'twoplayer' ? 'Player 1 — pick your monster!' : 'Pick your monster!'}
          monsters={availableMonsters}
          unlocked={unlocked}
          onPick={pickP1}
          onBack={() => setScreen('mode')}
        />
      )}

      {screen === 'select-p2' && (
        <SelectScreen
          title="Player 2 — pick your monster!"
          exclude={p1Choice}
          monsters={availableMonsters}
          unlocked={unlocked}
          onPick={pickP2}
          onBack={() => setScreen('select-p1')}
        />
      )}

      {screen === 'story-intro-start' && (
        <div className={styles.center}>
          <h2 className={styles.h2}>📖 The Trials of Monster Isle</h2>
          <p className={styles.storyIntro}>You've just arrived on Monster Isle to take on the Trials. Pick a partner monster, then prove yourselves against the guardians of Fire, Ice, and Shadow — you might just awaken a few legends along the way. One last challenge waits after that... but nobody on the island wants to talk about it.</p>
          <button className={styles.bigBtn} onClick={() => setScreen('story-select-hero')}>Choose Your Partner ▶</button>
          <button className={styles.backBtn} onClick={() => setScreen('mode')}>← Back</button>
        </div>
      )}

      {screen === 'story-select-hero' && (
        <SelectScreen
          title="Choose your story partner!"
          monsters={availableMonsters}
          unlocked={unlocked}
          onPick={pickStoryHero}
          onBack={() => setScreen('story-intro-start')}
        />
      )}

      {screen === 'story-chapter-intro' && (
        <div className={`${styles.center} ${STORY_CHAPTERS[chapterIndex].arenaOverride?.dramatic ? styles.dramaticIntro : ''}`}>
          <h2 className={`${styles.h2} ${STORY_CHAPTERS[chapterIndex].arenaOverride?.dramatic ? styles.dramaticTitle : ''}`}>{STORY_CHAPTERS[chapterIndex].title}</h2>
          <p className={styles.storyIntro}>{STORY_CHAPTERS[chapterIndex].introText}</p>
          <div className={styles.resultRow}>
            <MonsterThumb monster={p1Choice} size={100} />
            <span className={styles.vs}>VS</span>
            <MonsterThumb monster={ALL_MONSTERS.find(m => m.id === STORY_CHAPTERS[chapterIndex].opponentId)} size={100} />
          </div>
          <button className={styles.bigBtn} onClick={beginChapter}>⚔️ Begin Trial</button>
          <button className={styles.backBtn} onClick={exitStory}>← Give Up Story</button>
        </div>
      )}

      {screen === 'story-victory' && (
        <div className={styles.center}>
          <h1 className={styles.title}>Trial Complete! 🏆</h1>
          <p className={styles.storyIntro}>{STORY_CHAPTERS[chapterIndex].victoryText}</p>
          <MonsterThumb monster={ALL_MONSTERS.find(m => m.id === STORY_CHAPTERS[chapterIndex].unlocks)} size={140} />
          <strong className={styles.monsterName}>{ALL_MONSTERS.find(m => m.id === STORY_CHAPTERS[chapterIndex].unlocks).name} unlocked!</strong>
          <button className={styles.bigBtn} onClick={nextChapter}>Continue ▶</button>
        </div>
      )}

      {screen === 'story-retry' && (
        <div className={styles.center}>
          <h2 className={styles.h2}>So close!</h2>
          <p className={styles.storyIntro}>{ALL_MONSTERS.find(m => m.id === STORY_CHAPTERS[chapterIndex].opponentId).name} put up a great fight. Want to try again?</p>
          <div className={styles.modeRow}>
            <button className={styles.bigBtn} onClick={retryChapter}>🔁 Retry Trial</button>
            <button className={styles.bigBtn} onClick={exitStory}>🏠 Back to Title</button>
          </div>
        </div>
      )}

      {screen === 'story-finale' && (
        <div className={styles.center}>
          <h1 className={styles.title}>Monster Isle Champion! 🎉</h1>
          <p className={styles.storyIntro}>You've earned the respect of every guardian on Monster Isle — and befriended the mysterious, terrifying, extremely fluffy Tim. Dragon, Griffin, Golem, and Tim all fight by your side now. Go show them off in Quick Battle!</p>
          <button className={styles.bigBtn} onClick={exitStory}>🏠 Back to Title</button>
        </div>
      )}

      {screen === 'select-arena' && (
        <div className={styles.center}>
          <h2 className={styles.h2}>Choose where to explore!</h2>
          <div className={styles.arenaGrid}>
            {ARENAS.map(a => (
              <button key={a.id} className={styles.arenaCard} style={{ background: `linear-gradient(${a.sky[0]}, ${a.sky[1]})` }} onClick={() => pickArena(a)}>
                <span className={styles.arenaName}>{a.name}</span>
                <span className={styles.arenaLore}>{a.lore}</span>
              </button>
            ))}
            <button className={styles.arenaCard} style={{ background: '#222' }} onClick={() => pickArena(ARENAS[Math.floor(Math.random() * ARENAS.length)])}>
              <span className={styles.arenaName}>🎲 Surprise me!</span>
              <span className={styles.arenaLore}>Let fate pick your battleground.</span>
            </button>
          </div>
          {mode === 'cpu' && p2Choice && (
            <p className={styles.cpuNote}>The computer picked <strong>{p2Choice.name}</strong> ({p2Choice.mix})!</p>
          )}
          <button className={styles.backBtn} onClick={() => setScreen(mode === 'cpu' ? 'select-p1' : 'select-p2')}>← Back</button>
        </div>
      )}

      {screen === 'explore' && (
        <Explore p1Data={p1Choice} p2Data={p2Choice} mode={mode} arena={arena} onEncounter={handleEncounter} />
      )}

      {screen === 'battle' && (
        <Battle p1Data={p1Choice} p2Data={p2Choice} mode={mode} arena={arena} onFinish={handleFinish} />
      )}

      {screen === 'result' && (
        <div className={styles.center}>
          <h1 className={styles.title}>
            {winner === 'draw' ? "It's a tie!" : winner === 'p1' ? `${p1Choice.name} wins! 🏆` : `${(mode === 'cpu' ? 'The Computer' : 'Player 2')}'s ${p2Choice.name} wins! 🏆`}
          </h1>
          <p className={styles.storyIntro}>
            {winner === 'draw'
              ? `${p1Choice.name} and ${p2Choice.name} call it even — Monster Isle throws them a party anyway.`
              : `Word travels fast across Monster Isle: ${winner === 'p1' ? p1Choice.name : p2Choice.name} is the one to beat now.`}
          </p>
          <div className={styles.resultRow}>
            <MonsterThumb monster={p1Choice} size={130} />
            <span className={styles.vs}>VS</span>
            <MonsterThumb monster={p2Choice} size={130} />
          </div>
          <div className={styles.modeRow}>
            <button className={styles.bigBtn} onClick={rematch}>🔁 Rematch</button>
            <button className={styles.bigBtn} onClick={newMatchup}>🆕 New Matchup</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}

function SelectScreen({ title, exclude, onPick, onBack, monsters = MONSTERS, unlocked = [] }) {
  const pool = exclude ? monsters.filter(m => m.id !== exclude.id) : monsters
  return (
    <div className={styles.center}>
      <h2 className={styles.h2}>{title}</h2>
      <div className={styles.monsterGrid}>
        {pool.map(m => {
          const locked = m.legendary && !unlocked.includes(m.id)
          if (locked) {
            return (
              <div key={m.id} className={`${styles.monsterCard} ${styles.monsterCardLocked}`}>
                <div className={styles.lockedThumb}>🔒</div>
                <strong className={styles.monsterName}>???</strong>
                <span className={styles.monsterLore}>Unlock in Story Mode!</span>
              </div>
            )
          }
          return (
            <button key={m.id} className={styles.monsterCard} onClick={() => onPick(m)}>
              <MonsterThumb monster={m} size={96} />
              <strong className={styles.monsterName}>{m.name}{m.legendary ? ' ⭐' : ''}</strong>
              <span className={styles.monsterMix}>{m.mixEmoji} {m.mix}</span>
              <span className={styles.monsterSpecial}>✨ {m.special.name}</span>
              <span className={styles.monsterBlurb}>{m.blurb}</span>
              <span className={styles.monsterLore}>{m.lore}</span>
            </button>
          )
        })}
      </div>
      <button className={styles.backBtn} onClick={onBack}>← Back</button>
    </div>
  )
}
