import homePlate from './assets/home-plate.jpg'
import homePill from './assets/home-pill.png'
import homeStar from './assets/home-star.png'
import homeAnchor from './assets/home-anchor.png'
import homeRoundsLabel from './assets/home-rounds-label.png'
import homeLabel1 from './assets/home-label-1.png'
import homeLabel2 from './assets/home-label-2.png'
import homeField from './assets/home-field.png'
import homeAvatar1 from './assets/home-avatar-1.png'
import homeAvatar2 from './assets/home-avatar-2.png'

import harborPlate from './assets/harbor-plate.jpg'
import harborDie from './assets/harbor-die.png'
import harborPip from './assets/harbor-pip.png'
import harborStar from './assets/harbor-star.png'

import covePlate from './assets/cove-plate.jpg'
import coveDie from './assets/cove-die.png'
import coveBanner from './assets/cove-banner.png'
import coveShip from './assets/cove-role-ship.png'
import coveCaptain from './assets/cove-role-captain.png'
import coveCrew from './assets/cove-role-crew.png'

import seaPlate from './assets/sea-plate.jpg'
import seaDie from './assets/sea-die.png'

// The setup screen is one painting (4B94z) shared by every theme. Coordinates
// below are that painting's own pixels — nothing is measured twice.
export const HOME = {
  w: 784,
  h: 1168,
  plate: homePlate,
  pill: homePill,
  star: homeStar,
  anchor: homeAnchor,
  navy: '#182F58',
  muted: '#8E8C86',
  field: homeField,
  labels: [homeLabel1, homeLabel2],
  avatars: [homeAvatar1, homeAvatar2],
  roundsLabel: { img: homeRoundsLabel, x: 188, y: 508, w: 404, h: 36 },
  wheel: { x: 661, y: 20, w: 102, h: 100 },
  playerPills: [
    { x: 110, y: 400, w: 282, h: 84 },
    { x: 396, y: 400, w: 282, h: 84 },
  ],
  roundPills: [
    { x: 112, y: 562, w: 176, h: 86 },
    { x: 306, y: 562, w: 176, h: 86 },
    { x: 500, y: 562, w: 176, h: 86 },
  ],
  players: [
    { label: { x: 218, y: 676, w: 106, h: 36 },
      avatar: { x: 96, y: 684, w: 102, h: 104 },
      field: { x: 206, y: 714, w: 470, h: 74 } },
    { label: { x: 218, y: 813, w: 108, h: 37 },
      avatar: { x: 96, y: 820, w: 102, h: 104 },
      field: { x: 206, y: 852, w: 470, h: 74 } },
  ],
  cta: { x: 98, y: 958, w: 580, h: 120 },
}

const harbor = {
  name: 'Soft Harbor at Dawn',
  swatch: ['#A8C5D4', '#F2D6C2', '#C9A227'],
  plate: harborPlate,
  w: 734,
  h: 1083,
  ink: '#16305A',
  inkSoft: '#5C7083',
  roundTag: { x: 197, y: 336, w: 340, h: 44, chip: 'rgba(252,247,236,0.62)' },
  rolls: { x: 197, y: 566, w: 340, h: 26 },
  bakedBack: { x: 22, y: 10, w: 72, h: 72 },
  bakedGear: { x: 644, y: 10, w: 72, h: 72 },
  marker: { img: harborStar, w: 38, h: 36, y: 280, xs: [168, 348, 528] },
  die: {
    body: harborDie, pip: harborPip,
    w: 122, h: 142, cx: 60, cy: 66, dx: 24.2, dy: 26.8, pipSize: 29,
    tops: 425, xs: [44, 180, 313, 446, 578], rots: [-4, -1.5, 0, 2, 8],
    shadow: '0 7px 6px rgba(38,72,104,0.34)',
  },
  scores: {
    layout: 'side',
    panels: [
      { frame: { x: 30, y: 593, w: 326, h: 320 },
        name: { x: 36, y: 660, w: 314, h: 48 },
        value: { x: 36, y: 728, w: 314, h: 94 } },
      { frame: { x: 376, y: 593, w: 328, h: 320 },
        name: { x: 382, y: 660, w: 316, h: 48 },
        value: { x: 382, y: 728, w: 316, h: 94 } },
    ],
    nameSize: 44, valueSize: 92, nameColor: '#16305A', valueColor: '#0F2A52',
  },
  actions: {
    baked: true,
    roll: { x: 26, y: 944, w: 276, h: 74 },
    end: { x: 310, y: 932, w: 114, h: 114 },
    again: { x: 436, y: 944, w: 276, h: 74 },
  },
}

const cove = {
  name: 'Playful Pirate Cove',
  swatch: ['#2FA6A0', '#E8D6A8', '#7A4B1E'],
  plate: covePlate,
  w: 716,
  h: 1072,
  ink: '#5A3A17',
  inkSoft: '#7A5A34',
  roundTag: { x: 210, y: 219, w: 300, h: 42, size: 27, tracking: '0.05em' },
  rolls: { x: 180, y: 556, w: 356, h: 26 },
  glow: {
    y: 286, h: 116,
    cols: [{ x: 88, w: 118 }, { x: 300, w: 122 }, { x: 508, w: 126 }],
  },
  die: {
    body: coveDie, pip: null,
    w: 106, h: 115, cx: 53, cy: 56,
    numeralColor: '#1E3A5F', numeralSize: 74,
    iconSize: 64,
    roleIcons: { ship: coveShip, captain: coveCaptain, crew: coveCrew },
    tops: 432, xs: [25, 165, 305, 445, 585], rots: [-3, 1.5, -1, 3, 6],
    shadow: '0 6px 6px rgba(74,58,30,0.3)',
  },
  scores: {
    layout: 'stacked',
    panels: [
      { frame: { x: 22, y: 606, w: 678, h: 198 },
        value: { x: 250, y: 652, w: 230, h: 96 },
        name: { x: 250, y: 756, w: 262, h: 34, align: 'left' } },
      { frame: { x: 22, y: 810, w: 678, h: 188 },
        value: { x: 250, y: 844, w: 230, h: 96 },
        name: { x: 250, y: 948, w: 262, h: 34, align: 'left' } },
    ],
    nameSize: 27, valueSize: 92, letterSpacing: '0.07em', uppercase: true,
    nameColor: ['#45471C', '#24504F'], valueColor: ['#5A3A10', '#1A5458'],
  },
  actions: {
    banner: coveBanner,
    roll: { x: 34, y: 1006, w: 188, h: 50 },
    end: { x: 264, y: 1006, w: 188, h: 50 },
    again: { x: 494, y: 1006, w: 188, h: 50 },
    labelColor: '#5A3A17', labelSize: 22,
  },
}

const sea = {
  name: 'Elegant Open Sea',
  swatch: ['#3A6EA5', '#F5F6F2', '#9CAF88'],
  plate: seaPlate,
  w: 784,
  h: 1168,
  ink: '#1B2C4E',
  inkSoft: '#8A7541',
  roundTag: { x: 222, y: 388, w: 340, h: 30 },
  rolls: { x: 222, y: 606, w: 340, h: 26 },
  glow: {
    y: 60, h: 190,
    cols: [{ x: 52, w: 206 }, { x: 288, w: 210 }, { x: 528, w: 208 }],
  },
  die: {
    body: seaDie, pip: null,
    w: 136, h: 143, cx: 67, cy: 70,
    numeralColor: '#5E6C48', numeralSize: 84,
    iconSize: 70,
    tops: 442, xs: [20, 172, 324, 476, 628], rots: [-1, 1, 0, -1.5, 1],
    shadow: '0 8px 7px rgba(44,74,100,0.28)',
  },
  scores: {
    layout: 'stacked',
    panels: [
      { frame: { x: 30, y: 668, w: 726, h: 170 },
        name: { x: 200, y: 712, w: 318, h: 46, align: 'left' },
        value: { x: 546, y: 730, w: 180, h: 76, align: 'right' } },
      { frame: { x: 30, y: 852, w: 726, h: 170 },
        name: { x: 200, y: 896, w: 318, h: 46, align: 'left' },
        value: { x: 546, y: 914, w: 180, h: 76, align: 'right' } },
    ],
    nameSize: 36, valueSize: 72,
    nameColor: '#1B2C4E', valueColor: '#6B7A55',
  },
  actions: {
    plain: true,
    roll: { x: 44, y: 1058, w: 210, h: 64 },
    end: { x: 287, y: 1058, w: 210, h: 64 },
    again: { x: 530, y: 1058, w: 210, h: 64 },
    labelColor: '#1B2C4E', labelSize: 22,
  },
}

export const THEMES = { harbor, cove, sea }
export const THEME_ORDER = ['harbor', 'cove', 'sea']
export const DEFAULT_THEME = 'harbor'
