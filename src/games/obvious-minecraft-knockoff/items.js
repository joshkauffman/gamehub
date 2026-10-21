// ── The Obvious Minecraft Knockoff — items & crafting ──────────────────
// Pure data + pure functions, no rendering, no world/Three.js
// dependency — inventory is a plain `{ itemId: count }` object, items
// identified by string id (block-backed items share an id with
// BLOCK_DROP's output in voxelWorld.js; tool/ingot/stick ids exist
// only here, with no corresponding placeable block).

export const ITEM_META = {
  dirt: { label: 'Dirt', color: '#7a5433' },
  stone: { label: 'Stone', color: '#8a8a92' },
  log: { label: 'Log', color: '#6b4a2a' },
  leaves: { label: 'Leaves', color: '#3d8a3d' },
  planks: { label: 'Planks', color: '#b08552' },
  stick: { label: 'Stick', color: '#a07840' },
  coal: { label: 'Coal', color: '#232327' },
  iron_ore: { label: 'Iron Ore', color: '#c4a383' },
  iron_ingot: { label: 'Iron Ingot', color: '#dcdce2' },
  diamond: { label: 'Diamond', color: '#5fe0e8' },
  furnace: { label: 'Furnace', color: '#6a6a72' },
  wood_pickaxe: { label: 'Wood Pickaxe', color: '#a07840' },
  stone_pickaxe: { label: 'Stone Pickaxe', color: '#9a9aa2' },
  iron_pickaxe: { label: 'Iron Pickaxe', color: '#dcdce2' },
  diamond_pickaxe: { label: 'Diamond Pickaxe', color: '#5fe0e8' },
  wood_sword: { label: 'Wood Sword', color: '#c8a870' },
  stone_sword: { label: 'Stone Sword', color: '#9a9aa2' },
  iron_sword: { label: 'Iron Sword', color: '#eceef2' },
  diamond_sword: { label: 'Diamond Sword', color: '#5fe0e8' },
}

// The handful of items you start out able to see/select even at zero
// count (basic blocks); everything else (crafted goods, ores) only
// shows up in the hotbar once you actually have one.
export const ALWAYS_VISIBLE_ITEMS = ['dirt', 'stone', 'log', 'leaves']

// Items placeable back into the world, and which block they become.
export const PLACEABLE_ITEM_BLOCK = {
  dirt: 'dirt', stone: 'stone', log: 'log', leaves: 'leaves',
  planks: 'planks', furnace: 'furnace',
}

export const TOOL_TIERS = { hand: 0, wood: 1, stone: 2, iron: 3, diamond: 4 }
export const PICKAXE_TIER_OF = { wood_pickaxe: 'wood', stone_pickaxe: 'stone', iron_pickaxe: 'iron', diamond_pickaxe: 'diamond' }
export const SWORD_TIER_OF = { wood_sword: 'wood', stone_sword: 'stone', iron_sword: 'iron', diamond_sword: 'diamond' }
export const PICKAXE_SPEED = { hand: 1, wood: 2.2, stone: 3.4, iron: 5.2, diamond: 8 }
export const SWORD_DAMAGE = { hand: 1, wood: 2, stone: 3, iron: 4, diamond: 6 }

export function pickaxeTierOf(itemId) { return TOOL_TIERS[PICKAXE_TIER_OF[itemId]] ?? 0 }
export function swordDamageOf(itemId) { return SWORD_DAMAGE[SWORD_TIER_OF[itemId]] ?? SWORD_DAMAGE.hand }

// Each: id, label, inputs [{item,count}], output {item,count}, and an
// optional needsFurnace flag (the component checks furnace proximity
// before allowing it — this module only does the item arithmetic).
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

export function freshInventory() {
  const inv = {}
  for (const id of ALWAYS_VISIBLE_ITEMS) inv[id] = 0
  return inv
}

export function canCraft(inventory, recipe) {
  return recipe.inputs.every(inp => (inventory[inp.item] || 0) >= inp.count)
}

// Returns a NEW inventory object (never mutates the one passed in) —
// callers pass the result straight to a state setter.
export function craft(inventory, recipe) {
  if (!canCraft(inventory, recipe)) return inventory
  const next = { ...inventory }
  for (const inp of recipe.inputs) next[inp.item] = (next[inp.item] || 0) - inp.count
  next[recipe.output.item] = (next[recipe.output.item] || 0) + recipe.output.count
  return next
}

export function addItem(inventory, itemId, count = 1) {
  return { ...inventory, [itemId]: (inventory[itemId] || 0) + count }
}

export function removeItem(inventory, itemId, count = 1) {
  const have = inventory[itemId] || 0
  if (have < count) return inventory
  return { ...inventory, [itemId]: have - count }
}
