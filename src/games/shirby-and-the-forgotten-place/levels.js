// ── Shirby and the Forgotten Place — level data ───────────────────────
// Five worlds of two levels each: a regular level, then a boss level
// (flagX: null — beating the boss clears the level instead of a flagpole).
// Beating the last boss finishes the game; see engine.js's stepGame (the
// win check is just `levelIndex + 1 < LEVELS.length`, so nothing else
// needs to know how many worlds there are — add another and it's final).
//
// Shirby floats, so pits here are a "detour, not a wall" — a precision
// jump is never the only way past a gap, floating always works too. Don't
// treat gap width as a difficulty knob the way a non-floating platformer
// would; it's mostly a pacing/visual thing.

import { TILE, GROUND_Y } from './constants.js'

// ── Level-authoring helpers ────────────────────────────────────────────
export function brickRow(x0, y, spec) {
  return spec.map((s, i) => {
    if (!s) return null
    const [kind, contents] = s.split(':')
    return { x: x0 + i * TILE, y, w: TILE, h: TILE, kind, contents: contents || null, used: false, bump: 0 }
  }).filter(Boolean)
}
export function buttonLine(x0, y, count, step = 40) {
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * step, y, w: 18, h: 18, taken: false }))
}
function baseEnemy(type, x, y, min, max, vx) {
  return { type, x, y, w: 30, h: 28, vx, min, max, baseY: y, alive: true, squish: 0, frozen: 0, timer: 0 }
}
export function groundEnemy(type, x, min, max, vx = -1.1) { return baseEnemy(type, x, GROUND_Y - 28, min, max, vx) }
export function flyEnemy(type, x, min, max, vx = -1.3, baseY = GROUND_Y - 140) { return baseEnemy(type, x, baseY, min, max, vx) }
export function erraticEnemy(type, x, min, max) { return baseEnemy(type, x, GROUND_Y - 28, min, max, 0) }
export function bobEnemy(type, x, y) { return baseEnemy(type, x, y, x, x, 0) }

// A power source for a boss corridor: same shape as any other enemy, but
// tagged so the engine revives it a while after it's consumed (captured or
// killed) instead of removing it for good — losing your copied power
// mid-fight should never be a dead end, just a walk back down the hall.
export function respawnEnemy(e, frames = 300) { return { ...e, respawnTime: frames } }

// A boss patrols within [x - range, x + range], has `hp` hits worth of
// health, and (unless `melee` is set) periodically lobs a projectile.
export function makeBoss(x, hp, speed, range = 220, melee = false, shape = 'teddy') {
  return {
    x, y: GROUND_Y - 76, w: 76, h: 76, vx: -speed, hp, maxHp: hp, alive: true, invincible: 0,
    attackCooldown: 110, minX: x - range, maxX: x + range, melee, phase2: false, shape,
  }
}
// A short corridor (a couple of item blocks, plus one or two respawning
// power sources) leading into a walled boss arena — no pits, no flagpole,
// just the fight, and always a way back to a copyable power.
function bossLevel(id, theme, boss, extra = {}) {
  const width = boss.maxX + 420
  return {
    id, theme, width, flagX: null,
    groundSegments: [{ x0: 0, x1: width }],
    blocks: extra.blocks || [],
    enemies: extra.enemies || [],
    buttons: extra.buttons || [],
    boss,
  }
}

// ── The eight levels ───────────────────────────────────────────────────
export const LEVELS = [
  // ── World 1: The Dusty Attic ─────────────────────────────────────────
  {
    id: '1-1', theme: 'attic', width: 4200, flagX: 3800,
    groundSegments: [{ x0: 0, x1: 780 }, { x0: 940, x1: 1720 }, { x0: 1880, x1: 2600 }, { x0: 2760, x1: 4200 }],
    blocks: [
      ...brickRow(300, GROUND_Y - 150, ['brick', 'brick', 'question:button', 'brick']),
      ...brickRow(1020, GROUND_Y - 190, ['question:button', 'question:heart']),
      ...brickRow(1500, GROUND_Y - 150, ['brick', 'question:button', 'brick']),
      ...brickRow(2050, GROUND_Y - 210, ['question:button']),
      ...brickRow(2900, GROUND_Y - 160, ['brick', 'question:1up', 'brick']),
      ...brickRow(3450, GROUND_Y - 190, ['question:button', 'question:button']),
    ],
    enemies: [
      groundEnemy('dustbunny', 500, 400, 700),
      groundEnemy('bladebeetle', 1100, 980, 1650),
      groundEnemy('dustbunny', 2000, 1900, 2550),
      groundEnemy('bladebeetle', 2850, 2780, 3200),
      groundEnemy('dustbunny', 3600, 3500, 4000),
    ],
    buttons: [...buttonLine(830, GROUND_Y - 90, 3), ...buttonLine(1780, GROUND_Y - 90, 3), ...buttonLine(3200, GROUND_Y - 260, 4)],
  },
  bossLevel('1-2', 'attic', makeBoss(880, 5, 1.2, 200, true, 'teddy'), {
    blocks: [...brickRow(200, GROUND_Y - 150, ['brick', 'question:heart', 'brick'])],
    buttons: buttonLine(420, GROUND_Y - 90, 3),
    // Lost your Blade mid-fight? Walk back down the hall — it's always here.
    enemies: [respawnEnemy(groundEnemy('bladebeetle', 500, 420, 620))],
  }),

  // ── World 2: The Overgrown Garden ────────────────────────────────────
  {
    id: '2-1', theme: 'garden', width: 4500, flagX: 4100,
    groundSegments: [{ x0: 0, x1: 900 }, { x0: 1060, x1: 1900 }, { x0: 2060, x1: 2700 }, { x0: 2900, x1: 4500 }],
    blocks: [
      ...brickRow(320, GROUND_Y - 160, ['brick', 'question:button', 'brick', 'question:button', 'brick']),
      ...brickRow(1200, GROUND_Y - 210, ['question:button', 'question:heart', 'question:button']),
      ...brickRow(1750, GROUND_Y - 160, ['brick', 'question:button', 'brick']),
      ...brickRow(2300, GROUND_Y - 220, ['question:button']),
      ...brickRow(3300, GROUND_Y - 170, ['question:1up', 'brick', 'question:button']),
      ...brickRow(3900, GROUND_Y - 200, ['question:button', 'question:button']),
    ],
    enemies: [
      groundEnemy('snailsprout', 560, 460, 780),
      flyEnemy('embermoth', 1150, 1080, 1780),
      groundEnemy('frostsnail', 1450, 1380, 1780),
      groundEnemy('snailsprout', 2200, 2100, 2620),
      flyEnemy('embermoth', 3000, 2950, 3550),
      groundEnemy('bladebeetle', 3700, 3600, 4300),
    ],
    buttons: [...buttonLine(950, GROUND_Y - 90, 3), ...buttonLine(1950, GROUND_Y - 90, 3), ...buttonLine(2750, GROUND_Y - 90, 3)],
  },
  bossLevel('2-2', 'garden', makeBoss(950, 7, 1.5, 230, false, 'gnome'), {
    blocks: [...brickRow(200, GROUND_Y - 160, ['brick', 'question:heart', 'brick']), ...brickRow(500, GROUND_Y - 160, ['brick', 'question:button', 'brick'])],
    buttons: buttonLine(420, GROUND_Y - 90, 3),
    enemies: [respawnEnemy(flyEnemy('embermoth', 250, 150, 650)), respawnEnemy(groundEnemy('frostsnail', 550, 450, 690))],
  }),

  // ── World 3: The Broken Arcade ───────────────────────────────────────
  {
    id: '3-1', theme: 'arcade', width: 4400, flagX: 4000,
    groundSegments: [{ x0: 0, x1: 760 }, { x0: 920, x1: 1600 }, { x0: 1760, x1: 2500 }, { x0: 2680, x1: 4400 }],
    blocks: [
      ...brickRow(300, GROUND_Y - 170, ['brick', 'question:button', 'brick']),
      ...brickRow(1050, GROUND_Y - 220, ['question:button', 'question:button', 'question:heart']),
      ...brickRow(1900, GROUND_Y - 170, [null, 'brick', 'brick']),
      ...brickRow(2300, GROUND_Y - 210, ['question:button']),
      ...brickRow(3100, GROUND_Y - 170, ['question:1up', 'brick', 'question:button']),
      ...brickRow(3700, GROUND_Y - 200, ['question:button', 'question:button']),
    ],
    enemies: [
      erraticEnemy('glitchblob', 550, 460, 700),
      groundEnemy('staticsock', 1080, 980, 1550),
      groundEnemy('dustbunny', 1850, 1780, 2450),
      erraticEnemy('glitchblob', 2400, 2320, 2600),
      groundEnemy('staticsock', 3000, 2900, 3550),
      groundEnemy('bladebeetle', 3850, 3760, 4300),
    ],
    buttons: [...buttonLine(800, GROUND_Y - 90, 3), ...buttonLine(1650, GROUND_Y - 90, 3), ...buttonLine(2550, GROUND_Y - 90, 3)],
  },
  bossLevel('3-2', 'arcade', makeBoss(1000, 8, 1.7, 240, false, 'cabinet'), {
    blocks: [...brickRow(200, GROUND_Y - 160, ['brick', 'question:heart', 'brick']), ...brickRow(500, GROUND_Y - 160, ['brick', 'question:button', 'brick'])],
    buttons: buttonLine(420, GROUND_Y - 90, 3),
    enemies: [respawnEnemy(groundEnemy('staticsock', 480, 400, 660)), respawnEnemy(groundEnemy('bladebeetle', 200, 150, 380))],
  }),

  // ── World 4: The Landfill Core ───────────────────────────────────────
  {
    id: '4-1', theme: 'landfill', width: 4900, flagX: 4500,
    groundSegments: [{ x0: 0, x1: 720 }, { x0: 900, x1: 1550 }, { x0: 1720, x1: 2400 }, { x0: 2580, x1: 3200 }, { x0: 3380, x1: 4900 }],
    blocks: [
      ...brickRow(300, GROUND_Y - 170, ['brick', 'question:button', 'brick', 'question:button']),
      ...brickRow(1100, GROUND_Y - 220, ['question:button', 'question:heart', 'question:button']),
      ...brickRow(1850, GROUND_Y - 170, ['brick', 'question:button', 'brick']),
      ...brickRow(2650, GROUND_Y - 210, ['question:button']),
      ...brickRow(3450, GROUND_Y - 170, ['question:1up', 'brick', 'question:button']),
      ...brickRow(4100, GROUND_Y - 200, ['question:button', 'question:button', 'question:heart']),
    ],
    enemies: [
      groundEnemy('pebblegolem', 520, 440, 760),
      bobEnemy('bubblefish', 1150, GROUND_Y - 180),
      groundEnemy('staticsock', 1400, 1330, 1620),
      erraticEnemy('glitchblob', 1900, 1800, 2350),
      groundEnemy('frostsnail', 2250, 2180, 2600),
      bobEnemy('bubblefish', 2900, GROUND_Y - 200),
      groundEnemy('pebblegolem', 3050, 2980, 3450),
      groundEnemy('bladebeetle', 3700, 3620, 4200),
      groundEnemy('spikeball', 4300, 4250, 4700, 1.4),
    ],
    buttons: [...buttonLine(760, GROUND_Y - 90, 3), ...buttonLine(1600, GROUND_Y - 90, 3), ...buttonLine(2450, GROUND_Y - 90, 3), ...buttonLine(3250, GROUND_Y - 90, 3)],
  },
  bossLevel('4-2', 'landfill', makeBoss(1050, 14, 1.4, 260, false, 'lostfound'), {
    blocks: [
      ...brickRow(200, GROUND_Y - 160, ['brick', 'question:heart', 'brick']),
      ...brickRow(500, GROUND_Y - 160, ['brick', 'question:1up', 'brick']),
      ...brickRow(780, GROUND_Y - 160, ['brick', 'question:heart', 'brick']),
    ],
    buttons: buttonLine(420, GROUND_Y - 90, 3),
    enemies: [respawnEnemy(groundEnemy('pebblegolem', 350, 300, 460)), respawnEnemy(bobEnemy('bubblefish', 650, GROUND_Y - 180))],
  }),

  // ── World 5: The Under-the-Bed Deep (final) ───────────────────────────
  {
    id: '5-1', theme: 'underbed', width: 5200, flagX: 4800,
    groundSegments: [
      { x0: 0, x1: 700 }, { x0: 860, x1: 1500 }, { x0: 1680, x1: 2300 },
      { x0: 2480, x1: 3100 }, { x0: 3280, x1: 3900 }, { x0: 4080, x1: 5200 },
    ],
    blocks: [
      ...brickRow(280, GROUND_Y - 170, ['brick', 'question:button', 'brick']),
      ...brickRow(950, GROUND_Y - 210, ['question:star']),
      ...brickRow(1450, GROUND_Y - 160, ['brick', 'question:button', 'brick', 'question:heart']),
      ...brickRow(2100, GROUND_Y - 220, ['question:button']),
      ...brickRow(2700, GROUND_Y - 170, ['question:1up', 'brick', 'question:button']),
      ...brickRow(3450, GROUND_Y - 200, ['question:button', 'question:heart']),
      ...brickRow(4200, GROUND_Y - 190, ['brick', 'question:button', 'brick']),
    ],
    enemies: [
      // Whirlwind Wisp (Gust) shows up twice — it's the newest power and
      // the last one you can find, so it gets two chances instead of one.
      flyEnemy('whirlwindwisp', 500, 420, 750),
      groundEnemy('bedspring', 1050, 980, 1250, 1.3),
      erraticEnemy('sockpuppet', 1350, 1280, 1550),
      flyEnemy('lintghost', 1900, 1780, 2250),
      flyEnemy('whirlwindwisp', 2550, 2480, 2950),
      erraticEnemy('glitchblob', 3050, 2950, 3300),
      groundEnemy('bedspring', 3500, 3430, 3850, 1.4),
      flyEnemy('lintghost', 4150, 4080, 4700),
      erraticEnemy('sockpuppet', 4500, 4420, 4850),
    ],
    buttons: [
      ...buttonLine(720, GROUND_Y - 90, 3), ...buttonLine(1520, GROUND_Y - 90, 3),
      ...buttonLine(2320, GROUND_Y - 90, 3), ...buttonLine(3120, GROUND_Y - 260, 4),
      ...buttonLine(3920, GROUND_Y - 90, 3),
    ],
  },
  bossLevel('5-2', 'underbed', makeBoss(1100, 20, 1.6, 280, false, 'lurker'), {
    blocks: [
      ...brickRow(200, GROUND_Y - 160, ['brick', 'question:heart', 'brick']),
      ...brickRow(500, GROUND_Y - 160, ['brick', 'question:1up', 'brick']),
      ...brickRow(780, GROUND_Y - 160, ['brick', 'question:heart', 'brick']),
    ],
    buttons: buttonLine(420, GROUND_Y - 90, 3),
    // A little of everything within reach for a last stand — including a
    // fresh shot at Cyclone Boulder, if Rock's still equipped going in.
    enemies: [
      respawnEnemy(flyEnemy('whirlwindwisp', 300, 220, 500)),
      respawnEnemy(groundEnemy('pebblegolem', 650, 580, 800)),
    ],
  }),
]
