// ── The Obvious Mario Knockoff — level data ───────────────────────────
// Four "worlds" of two levels each: a regular level, then a boss level
// (flagX: null — beating the boss clears the level instead of a flagpole).
// The last level's completion (boss or flag) is what finishes the game;
// see engine.js's stepGame/startLevelTransition.

import { TILE, GROUND_Y } from './constants.js'

// ── Level-authoring helpers ──────────────────────────────────────────
export function brickRow(x0, y, spec) {
  return spec.map((s, i) => {
    if (!s) return null
    const [kind, contents] = s.split(':')
    return { x: x0 + i * TILE, y, w: TILE, h: TILE, kind, contents: contents || null, used: false, bump: 0 }
  }).filter(Boolean)
}
export function staircaseUp(x0, steps) {
  const out = []
  for (let i = 0; i < steps; i++) for (let j = 0; j <= i; j++) {
    out.push({ x: x0 + i * TILE, y: GROUND_Y - TILE * (j + 1), w: TILE, h: TILE, kind: 'stair', contents: null, used: true, bump: 0 })
  }
  return out
}
export function enemy(x, min, max, vx = -1.2) { return { x, y: GROUND_Y - 28, w: 28, h: 28, vx, min, max, alive: true, squish: 0 } }
export function coinLine(x0, y, count, step = 40) {
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * step, y, w: 20, h: 20, taken: false }))
}
// Munchers sit directly on the ground — not solid, just lethal on touch.
// Everyone has to jump them; Yoshi's easy mode walks straight through.
export function muncherRow(x0, count, step = 40) {
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * step, y: GROUND_Y - 26, w: 32, h: 26 }))
}
// A boss patrols within [x - range, x + range], has `hp` stomps/fireballs
// worth of health, and periodically lobs a projectile at the player.
export function makeBoss(x, hp, speed, range = 260) {
  return { x, y: GROUND_Y - 70, w: 70, h: 70, vx: -speed, hp, maxHp: hp, alive: true, invincible: 0, attackCooldown: 100, minX: x - range, maxX: x + range }
}
// A short corridor (one power-up, a few coins) leading into a walled boss
// arena — no pits, no flagpole, just the fight.
function bossLevel(id, theme, boss, extra = {}) {
  const width = boss.maxX + 400
  return {
    id, theme, width, time: 150, flagX: null,
    groundSegments: [{ x0: 0, x1: width }],
    pipes: [],
    blocks: extra.blocks || [],
    enemies: [],
    coins: extra.coins || [],
    boss,
  }
}

// ── The eight levels ───────────────────────────────────────────────────
export const LEVELS = [
  // ── World 1: Grassland ──────────────────────────────────────────────
  {
    id: '1-1', theme: 'overworld', width: 4400, time: 200, flagX: 3900,
    groundSegments: [{ x0: 0, x1: 760 }, { x0: 920, x1: 1680 }, { x0: 1840, x1: 4400 }],
    pipes: [{ x: 1140, y: GROUND_Y - 80, w: 70, h: 80, enterable: true, warpTo: 1900 }, { x: 2620, y: GROUND_Y - 120, w: 70, h: 120 }],
    blocks: [
      ...brickRow(300, GROUND_Y - 160, ['brick', 'brick', 'question:mushroom', 'brick', 'brick']),
      ...brickRow(1040, GROUND_Y - 200, ['question:coin']),
      ...brickRow(1500, GROUND_Y - 200, ['question:sneaker']),
      ...brickRow(2180, GROUND_Y - 160, ['brick', 'question:coin', 'brick']),
      ...staircaseUp(3480, 5),
    ],
    enemies: [enemy(560, 480, 700), enemy(1100, 1000, 1300), enemy(2050, 1950, 2260), enemy(2900, 2800, 3150), { ...enemy(2650, 2620, 2680, -1), y: GROUND_Y - 120 - 28 }],
    coins: [...coinLine(820, GROUND_Y - 90, 2), ...coinLine(1780, GROUND_Y - 90, 2), ...coinLine(1900, GROUND_Y - 220, 3), ...coinLine(3300, GROUND_Y - 60, 4)],
    munchers: muncherRow(2350, 3),
  },
  bossLevel('1-2', 'overworld', makeBoss(900, 3, 1.4, 220), {
    blocks: [...brickRow(200, GROUND_Y - 160, ['brick', 'question:mushroom', 'brick']), ...brickRow(500, GROUND_Y - 160, ['brick', 'question:shield', 'brick'])],
    coins: coinLine(420, GROUND_Y - 90, 3),
  }),

  // ── World 2: Underground ─────────────────────────────────────────────
  {
    id: '2-1', theme: 'underground', width: 4700, time: 260, flagX: 4250,
    groundSegments: [{ x0: 0, x1: 1180 }, { x0: 1340, x1: 2560 }, { x0: 2720, x1: 4700 }],
    pipes: [{ x: 900, y: GROUND_Y - 90, w: 70, h: 90, enterable: true, warpTo: 1500 }, { x: 2900, y: GROUND_Y - 100, w: 70, h: 100 }],
    blocks: [
      ...brickRow(320, GROUND_Y - 160, ['brick', 'question:coin', 'brick', 'question:fireflower', 'brick']),
      ...brickRow(1500, GROUND_Y - 220, ['question:coin', 'question:coin', 'question:coin']),
      ...brickRow(1980, GROUND_Y - 160, [null, 'brick', 'brick', 'brick']),
      ...brickRow(1980, GROUND_Y - 200, [null, null, 'brick']),
      ...brickRow(2300, GROUND_Y - 200, ['question:feather']),
      ...brickRow(3350, GROUND_Y - 180, ['question:coin', 'brick', 'question:1up', 'brick']),
      ...staircaseUp(3980, 5),
    ],
    enemies: [enemy(500, 420, 680), enemy(1050, 950, 1300), enemy(1450, 1400, 1650, -1.5), enemy(2050, 1980, 2400), enemy(2450, 2380, 2530), enemy(3150, 3080, 3450, -1.4)],
    coins: [...coinLine(1220, GROUND_Y - 90, 2), ...coinLine(2600, GROUND_Y - 90, 2), ...coinLine(3700, GROUND_Y - 260, 4)],
    munchers: muncherRow(1700, 3),
  },
  bossLevel('2-2', 'underground', makeBoss(1000, 4, 1.7, 250), {
    blocks: [...brickRow(200, GROUND_Y - 160, ['brick', 'question:fireflower', 'brick']), ...brickRow(500, GROUND_Y - 160, ['brick', 'question:shield', 'brick'])],
    coins: coinLine(420, GROUND_Y - 90, 3),
  }),

  // ── World 3: Sky ─────────────────────────────────────────────────────
  {
    id: '3-1', theme: 'sky', width: 4300, time: 250, flagX: 3900,
    groundSegments: [{ x0: 0, x1: 700 }, { x0: 860, x1: 1500 }, { x0: 1660, x1: 2400 }, { x0: 2560, x1: 4300 }],
    pipes: [{ x: 1000, y: GROUND_Y - 90, w: 70, h: 90, enterable: true, warpTo: 1700 }, { x: 2900, y: GROUND_Y - 100, w: 70, h: 100 }],
    blocks: [
      ...brickRow(300, GROUND_Y - 160, ['brick', 'question:coin', 'brick', 'question:mushroom', 'brick']),
      ...brickRow(1900, GROUND_Y - 220, ['question:coin', 'question:coin', 'question:coin']),
      ...brickRow(2700, GROUND_Y - 200, ['question:sneaker']),
      ...staircaseUp(3400, 5),
    ],
    enemies: [enemy(500, 420, 650), enemy(950, 900, 1450, -1.4), enemy(1750, 1700, 2350, -1.4), enemy(2650, 2600, 3000, -1.5), enemy(3200, 3100, 3450, -1.3)],
    coins: [...coinLine(760, GROUND_Y - 90, 2), ...coinLine(1560, GROUND_Y - 90, 2), ...coinLine(2420, GROUND_Y - 90, 2), ...coinLine(3250, GROUND_Y - 280, 4)],
    munchers: muncherRow(3020, 2),
  },
  bossLevel('3-2', 'sky', makeBoss(1000, 4, 1.9, 250), {
    blocks: [...brickRow(200, GROUND_Y - 160, ['brick', 'question:star', 'brick']), ...brickRow(500, GROUND_Y - 160, ['brick', 'question:shield', 'brick'])],
    coins: coinLine(420, GROUND_Y - 90, 3),
  }),

  // ── World 4: Castle (final) ──────────────────────────────────────────
  {
    id: '4-1', theme: 'castle', width: 5200, time: 300, flagX: 4950,
    groundSegments: [{ x0: 0, x1: 700 }, { x0: 860, x1: 1500 }, { x0: 1660, x1: 2320 }, { x0: 2480, x1: 5200 }],
    pipes: [{ x: 950, y: GROUND_Y - 90, w: 70, h: 90, enterable: true, warpTo: 1700 }, { x: 1900, y: GROUND_Y - 115, w: 70, h: 115 }, { x: 3300, y: GROUND_Y - 100, w: 70, h: 100 }],
    blocks: [
      ...brickRow(300, GROUND_Y - 160, ['brick', 'question:star', 'brick']),
      ...brickRow(1150, GROUND_Y - 200, ['brick', 'brick', 'question:fireflower', 'brick', 'brick']),
      ...brickRow(2600, GROUND_Y - 160, ['question:coin', 'brick', 'question:1up', 'brick', 'question:coin']),
      ...brickRow(3600, GROUND_Y - 220, ['brick', 'brick', 'brick']),
      ...brickRow(4200, GROUND_Y - 200, ['question:feather']),
      ...staircaseUp(4600, 6),
    ],
    enemies: [
      enemy(500, 420, 650, -1.3), enemy(1000, 920, 1450, -1.4), enemy(1750, 1700, 2280, -1.4),
      enemy(2650, 2560, 3000, -1.5), enemy(3150, 3080, 3450, -1.3), enemy(3800, 3700, 4200, -1.6),
      enemy(4300, 4230, 4550, -1.5), { ...enemy(1930, 1900, 1970, -1), y: GROUND_Y - 115 - 28 },
    ],
    coins: [...coinLine(760, GROUND_Y - 90, 2), ...coinLine(1550, GROUND_Y - 90, 2), ...coinLine(2350, GROUND_Y - 90, 2), ...coinLine(4000, GROUND_Y - 280, 5)],
    munchers: muncherRow(3480, 3),
  },
  bossLevel('4-2', 'castle', makeBoss(1100, 6, 2.1, 300), {
    blocks: [...brickRow(200, GROUND_Y - 160, ['brick', 'question:fireflower', 'brick']), ...brickRow(500, GROUND_Y - 160, ['brick', 'question:1up', 'brick']), ...brickRow(680, GROUND_Y - 160, ['brick', 'question:shield', 'brick'])],
    coins: coinLine(750, GROUND_Y - 90, 3),
  }),
]
