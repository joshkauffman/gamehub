// ── The Obvious Minecraft Knockoff — shared constants ─────────────────
// Everything here is original code and procedurally-drawn shapes (no
// sprites, no copied assets, no copyrighted names) — the "knockoff" is
// entirely the joke, worn openly.

export const W = 960, H = 540
export const HUD_H = 56
export const PLAY_Y0 = HUD_H
export const TILE = 28

export const WORLD_COLS = 140
export const WORLD_ROWS = 46
export const WORLD_H = WORLD_ROWS * TILE

export const GRAVITY = 0.62
export const JUMP_V = -12.2
export const MOVE_ACCEL = 0.85
export const MAX_SPEED = 4.0
export const FRICTION = 0.78
export const PLAYER_SIZE = { w: 20, h: 32 }

export const REACH = 5 * TILE // how far the mouse can target a block/enemy from the player

// ── Blocks ──────────────────────────────────────────────────────────
// tier: minimum pickaxe tier needed to get a drop (0 = hand is fine).
// hardness: base seconds to mine with a tier-0 (hand) tool.
// drop: item id placed in inventory when mined with a sufficient tool
//   (null = block just vanishes, e.g. leaves, or when the tool's tier
//   is too low for this block's required tier).
export const BLOCKS = {
  air: { id: 'air', solid: false },
  bedrock: { id: 'bedrock', solid: true, hardness: Infinity, tier: 99, color: '#1b1b22' },
  grass: { id: 'grass', solid: true, hardness: 0.5, tier: 0, drop: 'dirt', color: '#5fa83f', topColor: '#6fcf4a' },
  dirt: { id: 'dirt', solid: true, hardness: 0.5, tier: 0, drop: 'dirt', color: '#7a5433' },
  stone: { id: 'stone', solid: true, hardness: 1.4, tier: 1, drop: 'stone', color: '#8a8a92' },
  log: { id: 'log', solid: true, hardness: 0.8, tier: 0, drop: 'log', color: '#6b4a2a' },
  leaves: { id: 'leaves', solid: true, hardness: 0.3, tier: 0, drop: null, color: '#3d8a3d' },
  coal_ore: { id: 'coal_ore', solid: true, hardness: 1.6, tier: 1, drop: 'coal', color: '#555560', speck: '#17171c' },
  iron_ore: { id: 'iron_ore', solid: true, hardness: 2.2, tier: 2, drop: 'iron_ore', color: '#8a8a92', speck: '#d8b48a' },
  diamond_ore: { id: 'diamond_ore', solid: true, hardness: 3.4, tier: 3, drop: 'diamond', color: '#8a8a92', speck: '#5fe0e8' },
  planks: { id: 'planks', solid: true, hardness: 0.7, tier: 0, drop: 'planks', color: '#b08552', placeable: true },
  furnace: { id: 'furnace', solid: true, hardness: 1.6, tier: 1, drop: 'furnace', color: '#6a6a72', placeable: true },
}
export const PLACEABLE_ITEMS = ['dirt', 'stone', 'planks', 'log', 'furnace']

// ── Tools ───────────────────────────────────────────────────────────
// tier order: hand < wood < stone < iron < diamond
export const TOOL_TIERS = { hand: 0, wood: 1, stone: 2, iron: 3, diamond: 4 }
export const PICKAXE_SPEED = { hand: 1, wood: 2.2, stone: 3.4, iron: 5.2, diamond: 8 }
export const SWORD_DAMAGE = { hand: 1, wood: 2, stone: 3, iron: 4, diamond: 6 }

// ── Crafting recipes ────────────────────────────────────────────────
// Each recipe: id, label, inputs [{item,count}], output {item,count},
// and an optional `needsFurnace` flag (must be standing within reach
// of a placed furnace block).
export const RECIPES = [
  { id: 'planks', label: 'Planks', inputs: [{ item: 'log', count: 1 }], output: { item: 'planks', count: 4 } },
  { id: 'sticks', label: 'Sticks', inputs: [{ item: 'planks', count: 2 }], output: { item: 'stick', count: 4 } },
  { id: 'wood_pickaxe', label: 'Wood Pickaxe', inputs: [{ item: 'planks', count: 3 }, { item: 'stick', count: 2 }], output: { item: 'wood_pickaxe', count: 1 } },
  { id: 'wood_sword', label: 'Wood Sword', inputs: [{ item: 'planks', count: 2 }, { item: 'stick', count: 1 }], output: { item: 'wood_sword', count: 1 } },
  { id: 'furnace', label: 'Furnace', inputs: [{ item: 'stone', count: 8 }], output: { item: 'furnace', count: 1 } },
  { id: 'stone_pickaxe', label: 'Stone Pickaxe', inputs: [{ item: 'stone', count: 3 }, { item: 'stick', count: 2 }], output: { item: 'stone_pickaxe', count: 1 } },
  { id: 'stone_sword', label: 'Stone Sword', inputs: [{ item: 'stone', count: 2 }, { item: 'stick', count: 1 }], output: { item: 'stone_sword', count: 1 } },
  { id: 'smelt_iron', label: 'Smelt Iron (furnace)', inputs: [{ item: 'iron_ore', count: 1 }, { item: 'coal', count: 1 }], output: { item: 'iron_ingot', count: 1 }, needsFurnace: true },
  { id: 'iron_pickaxe', label: 'Iron Pickaxe', inputs: [{ item: 'iron_ingot', count: 3 }, { item: 'stick', count: 2 }], output: { item: 'iron_pickaxe', count: 1 } },
  { id: 'iron_sword', label: 'Iron Sword', inputs: [{ item: 'iron_ingot', count: 2 }, { item: 'stick', count: 1 }], output: { item: 'iron_sword', count: 1 } },
  { id: 'diamond_pickaxe', label: 'Diamond Pickaxe', inputs: [{ item: 'diamond', count: 3 }, { item: 'stick', count: 2 }], output: { item: 'diamond_pickaxe', count: 1 } },
  { id: 'diamond_sword', label: 'Diamond Sword', inputs: [{ item: 'diamond', count: 2 }, { item: 'stick', count: 1 }], output: { item: 'diamond_sword', count: 1 } },
]

// ── Items (icons/labels for anything that isn't a placeable block) ──
export const ITEM_META = {
  dirt: { label: 'Dirt', color: '#7a5433' },
  stone: { label: 'Stone', color: '#8a8a92' },
  planks: { label: 'Planks', color: '#b08552' },
  log: { label: 'Log', color: '#6b4a2a' },
  furnace: { label: 'Furnace', color: '#6a6a72' },
  stick: { label: 'Stick', color: '#a07840', shape: 'stick' },
  coal: { label: 'Coal', color: '#232327', shape: 'lump' },
  iron_ore: { label: 'Iron Ore', color: '#8a8a92', shape: 'lump', speck: '#d8b48a' },
  iron_ingot: { label: 'Iron Ingot', color: '#dcdce2', shape: 'ingot' },
  diamond: { label: 'Diamond', color: '#5fe0e8', shape: 'gem' },
  wood_pickaxe: { label: 'Wood Pickaxe', color: '#a07840', shape: 'pickaxe', head: '#8a6a3a' },
  stone_pickaxe: { label: 'Stone Pickaxe', color: '#a07840', shape: 'pickaxe', head: '#8a8a92' },
  iron_pickaxe: { label: 'Iron Pickaxe', color: '#a07840', shape: 'pickaxe', head: '#dcdce2' },
  diamond_pickaxe: { label: 'Diamond Pickaxe', color: '#a07840', shape: 'pickaxe', head: '#5fe0e8' },
  wood_sword: { label: 'Wood Sword', color: '#a07840', shape: 'sword', blade: '#c8a870' },
  stone_sword: { label: 'Stone Sword', color: '#a07840', shape: 'sword', blade: '#9a9aa2' },
  iron_sword: { label: 'Iron Sword', color: '#a07840', shape: 'sword', blade: '#eceef2' },
  diamond_sword: { label: 'Diamond Sword', color: '#a07840', shape: 'sword', blade: '#5fe0e8' },
}
export const PICKAXE_TIER_OF = { wood_pickaxe: 'wood', stone_pickaxe: 'stone', iron_pickaxe: 'iron', diamond_pickaxe: 'diamond' }
export const SWORD_TIER_OF = { wood_sword: 'wood', stone_sword: 'stone', iron_sword: 'iron', diamond_sword: 'diamond' }

export const HOTBAR_SIZE = 9
export const MAX_STACK = 64

// ── Day/night cycle (frames, at 60fps) ─────────────────────────────
export const DAY_LENGTH = 60 * 75   // 75s of daylight
export const NIGHT_LENGTH = 60 * 45 // 45s of darkness
export const CYCLE_LENGTH = DAY_LENGTH + NIGHT_LENGTH

// ── Enemies ─────────────────────────────────────────────────────────
export const ENEMY_SIZE = { w: 20, h: 30 }
export const ENEMY_SPEED = 1.1
export const ENEMY_HP = 6
export const ENEMY_CONTACT_DAMAGE = 1
export const ENEMY_HIT_COOLDOWN = 50 // frames between hits on the player
export const MAX_ENEMIES = 6
export const ENEMY_DETECT_RANGE = 11 * TILE

export const PLAYER_MAX_HP = 10
