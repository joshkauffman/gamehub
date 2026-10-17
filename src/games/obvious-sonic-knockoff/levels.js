// ── The Obvious Sonic Knockoff — zone data ────────────────────────────
// Each zone is one continuous side-scrolling course: a list of ground
// segments (possibly sloped, with gaps between them where there's no
// segment at all — the player just falls through), plus rings, badniks,
// and a goal signpost. The last zone ends in a boss arena instead of a
// signpost.

export const ZONES = [
  {
    id: 'green-hover',
    name: 'Green Hover Zone',
    theme: 'green',
    width: 2650,
    groundSegments: [
      { x0: 0, x1: 520, y0: 460, y1: 460 },
      { x0: 520, x1: 720, y0: 460, y1: 370 },
      { x0: 720, x1: 1020, y0: 370, y1: 370 },
      { x0: 1020, x1: 1300, y0: 370, y1: 460 },
      // gap 1300-1400
      { x0: 1400, x1: 1820, y0: 460, y1: 460 },
      { x0: 1820, x1: 2020, y0: 460, y1: 410 },
      { x0: 2020, x1: 2650, y0: 410, y1: 410 },
    ],
    rings: [
      [560, 420], [600, 400], [640, 380], [760, 330], [800, 330], [840, 330],
      [1340, 400], [1360, 380], [1450, 420], [1500, 420], [1550, 420],
      [1850, 380], [1900, 360], [2100, 370], [2150, 370], [2200, 370],
    ],
    enemies: [
      { type: 'crawler', x: 820, y: 346, minX: 740, maxX: 1000 },
      { type: 'crawler', x: 1500, y: 436, minX: 1420, maxX: 1780 },
      { type: 'buzzer', x: 2150, y: 300, minX: 2060, maxX: 2500, baseY: 300 },
    ],
    goalX: 2580,
  },
  {
    id: 'rust-pipeline',
    name: 'Rust Pipeline Zone',
    theme: 'rust',
    width: 2850,
    groundSegments: [
      { x0: 0, x1: 400, y0: 460, y1: 460 },
      { x0: 400, x1: 560, y0: 460, y1: 500 },
      // gap 560-650
      { x0: 650, x1: 900, y0: 460, y1: 460 },
      { x0: 900, x1: 1150, y0: 460, y1: 340 },
      { x0: 1150, x1: 1500, y0: 340, y1: 340 },
      { x0: 1500, x1: 1700, y0: 340, y1: 460 },
      { x0: 1700, x1: 2100, y0: 460, y1: 460 },
      // gap 2100-2200
      { x0: 2200, x1: 2500, y0: 460, y1: 420 },
      { x0: 2500, x1: 2850, y0: 420, y1: 420 },
    ],
    rings: [
      [700, 420], [740, 420], [780, 420], [950, 420], [1000, 400], [1050, 380],
      [1200, 300], [1250, 300], [1300, 300], [1350, 300], [1400, 300],
      [1750, 420], [1800, 420], [2250, 390], [2300, 370], [2600, 380], [2650, 380],
    ],
    enemies: [
      { type: 'buzzer', x: 800, y: 380, minX: 700, maxX: 1050, baseY: 380 },
      { type: 'crawler', x: 1250, y: 316, minX: 1170, maxX: 1480 },
      { type: 'crawler', x: 1850, y: 436, minX: 1720, maxX: 2080 },
      { type: 'buzzer', x: 2400, y: 340, minX: 2250, maxX: 2480, baseY: 340 },
    ],
    goalX: 2800,
  },
  {
    id: 'core-meltdown',
    name: 'Core Meltdown Zone',
    theme: 'core',
    width: 2500,
    groundSegments: [
      { x0: 0, x1: 500, y0: 460, y1: 460 },
      { x0: 500, x1: 700, y0: 460, y1: 400 },
      { x0: 700, x1: 1000, y0: 400, y1: 400 },
      // gap 1000-1090
      { x0: 1090, x1: 1400, y0: 460, y1: 460 },
      { x0: 1400, x1: 1600, y0: 460, y1: 420 },
      { x0: 1600, x1: 2500, y0: 420, y1: 420 }, // boss arena, flat
    ],
    rings: [
      [540, 420], [580, 400], [750, 360], [800, 360], [850, 360],
      [1130, 420], [1180, 420], [1230, 420], [1450, 390], [1500, 390],
    ],
    enemies: [
      { type: 'crawler', x: 800, y: 376, minX: 720, maxX: 980 },
      { type: 'crawler', x: 1200, y: 436, minX: 1100, maxX: 1380 },
      { type: 'buzzer', x: 1500, y: 350, minX: 1420, maxX: 1580, baseY: 350 },
    ],
    bossArenaX: 1900,
  },
]
