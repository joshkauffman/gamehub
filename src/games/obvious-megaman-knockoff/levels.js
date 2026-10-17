// ── The Obvious Mega Man Knockoff — stage layouts ─────────────────────
// Each stage is a continuous side-scrolling course: flat ground
// segments (gaps between them are pits), floating platform rects, a
// handful of enemies, and a bossX where the arena begins and the
// camera stops following past it.

import { GROUND_Y } from './constants.js'

export const STAGES = [
  {
    id: 'ember-factory',
    theme: 'ember',
    width: 2200,
    groundSegments: [[0, 560], [660, 1080], [1180, 2200]],
    // Pit-crossing stepping stones all follow the same safe recipe: a
    // short (35px) hop — only a few frames to clear, so there's no
    // precise timing needed — that starts just past where the ground
    // ends (never earlier, or it acts as an invisible ceiling right
    // where the jump needs headroom) and overlaps generously into the
    // ground on the far side.
    platforms: [
      { x: 570, y: GROUND_Y - 35, w: 120, h: 16 },
      { x: 1090, y: GROUND_Y - 35, w: 120, h: 16 },
      { x: 1500, y: GROUND_Y - 120, w: 140, h: 16 }, // decorative, over solid ground
    ],
    enemies: [
      { type: 'walker', x: 300, y: GROUND_Y - 26, minX: 220, maxX: 500 },
      { type: 'turret', x: 820, y: GROUND_Y - 190, facing: 'down' },
      { type: 'walker', x: 1300, y: GROUND_Y - 26, minX: 1220, maxX: 1500 },
      { type: 'flyer', x: 1750, y: GROUND_Y - 160, minX: 1650, maxX: 1950, baseY: GROUND_Y - 160 },
    ],
    bossX: 2050,
  },
  {
    id: 'circuit-marsh',
    theme: 'circuit',
    width: 2300,
    groundSegments: [[0, 480], [600, 900], [1020, 1500], [1620, 2300]],
    platforms: [
      { x: 490, y: GROUND_Y - 35, w: 140, h: 16 },
      { x: 910, y: GROUND_Y - 35, w: 140, h: 16 },
      { x: 1510, y: GROUND_Y - 35, w: 140, h: 16 },
      { x: 1800, y: GROUND_Y - 220, w: 120, h: 16 }, // decorative, over solid ground
    ],
    enemies: [
      { type: 'flyer', x: 350, y: GROUND_Y - 140, minX: 260, maxX: 560, baseY: GROUND_Y - 140 },
      { type: 'flyer', x: 760, y: GROUND_Y - 180, minX: 660, maxX: 900, baseY: GROUND_Y - 180 },
      { type: 'walker', x: 1150, y: GROUND_Y - 26, minX: 1040, maxX: 1420 },
      { type: 'turret', x: 1950, y: GROUND_Y - 190, facing: 'down' },
    ],
    bossX: 2150,
  },
  {
    id: 'scrapyard-docks',
    theme: 'scrap',
    width: 2200,
    groundSegments: [[0, 700], [820, 1200], [1300, 2200]],
    platforms: [
      { x: 300, y: GROUND_Y - 100, w: 100, h: 16 }, // decorative, over solid ground
      { x: 710, y: GROUND_Y - 35, w: 140, h: 16 },
      { x: 1210, y: GROUND_Y - 35, w: 120, h: 16 },
      { x: 1650, y: GROUND_Y - 100, w: 100, h: 16 }, // decorative, over solid ground
      { x: 1850, y: GROUND_Y - 200, w: 100, h: 16 }, // decorative, over solid ground
    ],
    enemies: [
      { type: 'walker', x: 150, y: GROUND_Y - 26, minX: 80, maxX: 400 },
      { type: 'walker', x: 500, y: GROUND_Y - 26, minX: 420, maxX: 680 },
      { type: 'turret', x: 1000, y: GROUND_Y - 26, facing: 'left' },
      { type: 'walker', x: 1700, y: GROUND_Y - 26, minX: 1620, maxX: 1980 },
    ],
    bossX: 2050,
  },
  {
    id: 'glacier-summit',
    theme: 'glacier',
    width: 2300,
    groundSegments: [[0, 420], [560, 820], [960, 1100], [1240, 1560], [1680, 2300]],
    platforms: [
      { x: 430, y: GROUND_Y - 35, w: 160, h: 16 },
      { x: 830, y: GROUND_Y - 35, w: 160, h: 16 },
      { x: 1110, y: GROUND_Y - 35, w: 160, h: 16 },
      { x: 1570, y: GROUND_Y - 35, w: 140, h: 16 },
      { x: 1950, y: GROUND_Y - 220, w: 120, h: 16 }, // decorative, over solid ground
    ],
    enemies: [
      { type: 'flyer', x: 280, y: GROUND_Y - 150, minX: 180, maxX: 400, baseY: GROUND_Y - 150 },
      { type: 'walker', x: 660, y: GROUND_Y - 26, minX: 580, maxX: 800 },
      { type: 'turret', x: 1050, y: GROUND_Y - 130, facing: 'left' },
      { type: 'flyer', x: 1850, y: GROUND_Y - 180, minX: 1750, maxX: 2050, baseY: GROUND_Y - 180 },
    ],
    bossX: 2150,
  },
]

export function stageById(id) { return STAGES.find(s => s.id === id) }
