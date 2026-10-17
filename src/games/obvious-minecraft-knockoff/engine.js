// ── The Obvious Minecraft Knockoff — game engine ──────────────────────
// Pure state/physics, no rendering. Mining, placing, and crafting are
// exposed as discrete functions the component calls directly (mouse
// click / button click) — mirroring how shootPortal works in the
// Portal knockoff — while movement, mining progress, day/night, and
// enemy AI all run continuously inside stepGame().

import {
  WORLD_COLS, WORLD_ROWS, TILE, PLAY_Y0, GRAVITY, JUMP_V, MOVE_ACCEL, MAX_SPEED, FRICTION,
  PLAYER_SIZE, REACH, BLOCKS, PLACEABLE_ITEMS, TOOL_TIERS, PICKAXE_SPEED, SWORD_DAMAGE,
  RECIPES, PICKAXE_TIER_OF, SWORD_TIER_OF, HOTBAR_SIZE, MAX_STACK,
  DAY_LENGTH, NIGHT_LENGTH, CYCLE_LENGTH, ENEMY_SIZE, ENEMY_SPEED, ENEMY_HP,
  ENEMY_CONTACT_DAMAGE, ENEMY_HIT_COOLDOWN, MAX_ENEMIES, ENEMY_DETECT_RANGE, PLAYER_MAX_HP,
} from './constants.js'
import { generateWorld, surfaceRowAt, findSpawnCol } from './worldGen.js'

export function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function colToX(col) { return col * TILE }
function rowToY(row) { return PLAY_Y0 + row * TILE }
function tileOfPoint(x, y) { return { col: Math.floor(x / TILE), row: Math.floor((y - PLAY_Y0) / TILE) } }
function inBounds(row, col) { return row >= 0 && row < WORLD_ROWS && col >= 0 && col < WORLD_COLS }

function blockAt(state, row, col) {
  if (!inBounds(row, col)) return BLOCKS.bedrock
  return BLOCKS[state.tiles[row][col]] || BLOCKS.air
}
function isSolidAt(state, row, col) {
  if (!inBounds(row, col)) return true
  return blockAt(state, row, col).solid
}

function moveWithTiles(state, e) {
  e.x += e.vx
  const r0 = Math.floor((e.y - PLAY_Y0) / TILE), r1 = Math.floor((e.y + e.h - 1 - PLAY_Y0) / TILE)
  if (e.vx > 0) {
    const c1 = Math.floor((e.x + e.w - 1) / TILE)
    for (let r = r0; r <= r1; r++) if (isSolidAt(state, r, c1)) { e.x = c1 * TILE - e.w; e.vx = 0; break }
  } else if (e.vx < 0) {
    const c0 = Math.floor(e.x / TILE)
    for (let r = r0; r <= r1; r++) if (isSolidAt(state, r, c0)) { e.x = (c0 + 1) * TILE; e.vx = 0; break }
  }
  e.y += e.vy
  e.onGround = false
  const c0b = Math.floor(e.x / TILE), c1b = Math.floor((e.x + e.w - 1) / TILE)
  if (e.vy > 0) {
    const r1b = Math.floor((e.y + e.h - 1 - PLAY_Y0) / TILE)
    for (let c = c0b; c <= c1b; c++) if (isSolidAt(state, r1b, c)) { e.y = rowToY(r1b) - e.h; e.vy = 0; e.onGround = true; break }
  } else if (e.vy < 0) {
    const r0b = Math.floor((e.y - PLAY_Y0) / TILE)
    for (let c = c0b; c <= c1b; c++) if (isSolidAt(state, r0b, c)) { e.y = rowToY(r0b + 1); e.vy = 0; break }
  }
}

// ── Inventory helpers ───────────────────────────────────────────────
function addItem(inv, item, count) {
  let remaining = count
  for (const slot of inv) {
    if (remaining <= 0) break
    if (slot && slot.item === item && slot.count < MAX_STACK) {
      const add = Math.min(remaining, MAX_STACK - slot.count)
      slot.count += add; remaining -= add
    }
  }
  for (let i = 0; i < inv.length && remaining > 0; i++) {
    if (!inv[i]) {
      const add = Math.min(remaining, MAX_STACK)
      inv[i] = { item, count: add }; remaining -= add
    }
  }
  return remaining === 0
}
function countItem(inv, item) { return inv.reduce((n, s) => n + (s && s.item === item ? s.count : 0), 0) }
function removeItem(inv, item, count) {
  if (countItem(inv, item) < count) return false
  let remaining = count
  for (let i = 0; i < inv.length && remaining > 0; i++) {
    const slot = inv[i]
    if (slot && slot.item === item) {
      const take = Math.min(remaining, slot.count)
      slot.count -= take; remaining -= take
      if (slot.count <= 0) inv[i] = null
    }
  }
  return true
}
export function currentHotbarItem(state) {
  const slot = state.inventory[state.selectedSlot]
  return slot ? slot.item : null
}

function showToast(state, text) { state.toast = { text, timer: 150 } }
function unlock(state, id, label) {
  if (state.achievements.has(id)) return
  state.achievements.add(id)
  showToast(state, `Achievement: ${label}`)
}

// ── World init ──────────────────────────────────────────────────────
export function freshState(seed = 1) {
  const { rows, surfaces } = generateWorld(seed)
  const spawnCol = findSpawnCol(surfaces)
  const spawnRow = surfaces[spawnCol]
  return {
    seed,
    tiles: rows,
    player: {
      x: colToX(spawnCol), y: rowToY(spawnRow) - PLAYER_SIZE.h,
      w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, vx: 0, vy: 0, onGround: false, facing: 1,
      hp: PLAYER_MAX_HP, invulnTimer: 0, swingCooldown: 0,
    },
    spawnCol, spawnRow,
    inventory: new Array(HOTBAR_SIZE).fill(null),
    selectedSlot: 0,
    mining: null, // { col, row, progress }
    enemies: [],
    time: 0,
    wasNight: false,
    achievements: new Set(),
    toast: null,
    uiPanel: null, // null | 'craft'
    message: '',
  }
}

export function isNight(state) {
  const t = state.time % CYCLE_LENGTH
  return t >= DAY_LENGTH
}
export function dayProgress(state) {
  // 0..1 across the full cycle, for sky-color interpolation.
  return (state.time % CYCLE_LENGTH) / CYCLE_LENGTH
}

function surfaceRowOfColumn(state, col) {
  if (col < 0 || col >= WORLD_COLS) return 0
  for (let r = 0; r < WORLD_ROWS; r++) if (isSolidAt(state, r, col)) return r
  return WORLD_ROWS - 1
}

// ── Targeting ───────────────────────────────────────────────────────
function resolveTarget(state, aimX, aimY) {
  const p = state.player
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2
  // Enemy under the cursor takes priority over a block behind it.
  let nearestEnemy = null, nearestD = Infinity
  for (const en of state.enemies) {
    if (aimX >= en.x && aimX <= en.x + en.w && aimY >= en.y && aimY <= en.y + en.h) {
      const d = Math.hypot(pcx - (en.x + en.w / 2), pcy - (en.y + en.h / 2))
      if (d <= REACH && d < nearestD) { nearestD = d; nearestEnemy = en }
    }
  }
  if (nearestEnemy) return { type: 'enemy', enemy: nearestEnemy }

  const { col, row } = tileOfPoint(aimX, aimY)
  if (!inBounds(row, col)) return null
  const block = blockAt(state, row, col)
  if (!block.solid || block.hardness === Infinity) return null
  const tileCx = colToX(col) + TILE / 2, tileCy = rowToY(row) + TILE / 2
  const d = Math.hypot(pcx - tileCx, pcy - tileCy)
  if (d > REACH) return null
  return { type: 'block', col, row, block }
}

function miningTierName(state) {
  const item = currentHotbarItem(state)
  return (item && PICKAXE_TIER_OF[item]) || 'hand'
}
function requiredMineTime(block, tierName) {
  if (block.tier === 0) return block.hardness
  const have = TOOL_TIERS[tierName]
  if (have < block.tier) return block.hardness / PICKAXE_SPEED.hand
  return block.hardness / PICKAXE_SPEED[tierName]
}
function canDrop(block, tierName) {
  if (block.tier === 0) return true
  return TOOL_TIERS[tierName] >= block.tier
}

// ── Discrete actions (called directly by the component) ─────────────
export function placeBlock(state, aimX, aimY) {
  const item = currentHotbarItem(state)
  if (!item || !PLACEABLE_ITEMS.includes(item)) return false
  const { col, row } = tileOfPoint(aimX, aimY)
  if (!inBounds(row, col)) return false
  if (state.tiles[row][col] !== 'air') return false
  const p = state.player
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2
  const tileCx = colToX(col) + TILE / 2, tileCy = rowToY(row) + TILE / 2
  if (Math.hypot(pcx - tileCx, pcy - tileCy) > REACH) return false
  const hasAdjacentSolid = isSolidAt(state, row - 1, col) || isSolidAt(state, row + 1, col) ||
    isSolidAt(state, row, col - 1) || isSolidAt(state, row, col + 1)
  if (!hasAdjacentSolid) return false
  const targetRect = { x: colToX(col), y: rowToY(row), w: TILE, h: TILE }
  if (aabb(p, targetRect)) return false
  if (!removeItem(state.inventory, item, 1)) return false
  state.tiles[row][col] = item
  return true
}

export function craftItem(state, recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId)
  if (!recipe) return false
  if (recipe.needsFurnace && !nearFurnace(state)) { showToast(state, 'Need to be near a furnace.'); return false }
  for (const inp of recipe.inputs) if (countItem(state.inventory, inp.item) < inp.count) return false
  for (const inp of recipe.inputs) removeItem(state.inventory, inp.item, inp.count)
  addItem(state.inventory, recipe.output.item, recipe.output.count)
  showToast(state, `Crafted ${recipe.label}`)
  if (PICKAXE_TIER_OF[recipe.output.item] || SWORD_TIER_OF[recipe.output.item]) unlock(state, 'toolsmith', 'Toolsmith')
  if (recipe.output.item === 'iron_pickaxe' || recipe.output.item === 'iron_sword') unlock(state, 'blacksmith', 'Blacksmith')
  if (recipe.output.item === 'diamond_pickaxe' || recipe.output.item === 'diamond_sword') unlock(state, 'diamond_tools', 'Diamond Tipped')
  return true
}

function nearFurnace(state) {
  const p = state.player
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2
  const c0 = Math.floor((pcx - REACH) / TILE), c1 = Math.floor((pcx + REACH) / TILE)
  const r0 = Math.floor((pcy - REACH - PLAY_Y0) / TILE), r1 = Math.floor((pcy + REACH - PLAY_Y0) / TILE)
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!inBounds(r, c)) continue
    if (state.tiles[r][c] === 'furnace') {
      const d = Math.hypot(pcx - (colToX(c) + TILE / 2), pcy - (rowToY(r) + TILE / 2))
      if (d <= REACH) return true
    }
  }
  return false
}

export function resetChamber(state) { return freshState(state.seed) }

// ── Continuous simulation ───────────────────────────────────────────
function respawnPlayer(state) {
  const p = state.player
  p.x = colToX(state.spawnCol); p.y = rowToY(state.spawnRow) - p.h
  p.vx = 0; p.vy = 0; p.hp = PLAYER_MAX_HP; p.invulnTimer = 60
  showToast(state, 'You blacked out and woke up back at spawn.')
}

function stepMining(state, input) {
  if (!input.mineHeld) { state.mining = null; return }
  const target = resolveTarget(state, input.aimX, input.aimY)
  if (!target) { state.mining = null; return }
  const p = state.player

  if (target.type === 'enemy') {
    state.mining = null
    if (p.swingCooldown <= 0) {
      const item = currentHotbarItem(state)
      const tierName = (item && SWORD_TIER_OF[item]) || 'hand'
      target.enemy.hp -= SWORD_DAMAGE[tierName]
      p.swingCooldown = 18
    }
    return
  }

  const { col, row, block } = target
  const tierName = miningTierName(state)
  const need = requiredMineTime(block, tierName)
  if (!state.mining || state.mining.col !== col || state.mining.row !== row) {
    state.mining = { col, row, progress: 0, need }
  }
  state.mining.progress += 1 / 60
  state.mining.need = need
  if (state.mining.progress >= need) {
    state.tiles[row][col] = 'air'
    if (canDrop(block, tierName) && block.drop) {
      addItem(state.inventory, block.drop, 1)
      if (block.drop === 'stone') unlock(state, 'miner', 'Miner')
      if (block.drop === 'log') { if (countItem(state.inventory, 'log') >= 10) unlock(state, 'lumberjack', 'Lumberjack') }
      if (block.drop === 'diamond') unlock(state, 'treasure_hunter', 'Treasure Hunter')
      unlock(state, 'first_mine', 'First Block')
    }
    state.mining = null
  }
}

function stepEnemies(state) {
  const night = isNight(state)
  if (state.wasNight && !night) { state.enemies = []; unlock(state, 'survivor', 'Survivor') }
  state.wasNight = night

  if (night && state.enemies.length < MAX_ENEMIES && Math.random() < 1 / 180) {
    const p = state.player
    const dir = Math.random() < 0.5 ? -1 : 1
    const col = Math.max(2, Math.min(WORLD_COLS - 3, Math.floor(p.x / TILE) + dir * (10 + Math.floor(Math.random() * 10))))
    const row = surfaceRowOfColumn(state, col)
    if (row > 0) {
      state.enemies.push({
        x: colToX(col), y: rowToY(row) - ENEMY_SIZE.h, w: ENEMY_SIZE.w, h: ENEMY_SIZE.h,
        vx: 0, vy: 0, onGround: false, hp: ENEMY_HP, hitCooldown: 0,
      })
    }
  }

  const p = state.player
  for (const en of state.enemies) {
    const dx = (p.x + p.w / 2) - (en.x + en.w / 2)
    if (Math.abs(dx) < ENEMY_DETECT_RANGE) en.vx = Math.sign(dx) * ENEMY_SPEED
    else en.vx *= 0.8
    en.vy += GRAVITY
    if (en.vy > 18) en.vy = 18
    moveWithTiles(state, en)
    if (en.hitCooldown > 0) en.hitCooldown--
    if (aabb(en, p) && en.hitCooldown <= 0 && p.invulnTimer <= 0) {
      p.hp -= ENEMY_CONTACT_DAMAGE
      p.invulnTimer = 40
      en.hitCooldown = ENEMY_HIT_COOLDOWN
    }
  }
  state.enemies = state.enemies.filter(en => en.hp > 0)
}

export function stepGame(state, input) {
  state.time++
  if (state.toast) { state.toast.timer--; if (state.toast.timer <= 0) state.toast = null }
  const p = state.player
  if (p.invulnTimer > 0) p.invulnTimer--
  if (p.swingCooldown > 0) p.swingCooldown--

  if (!state.uiPanel) {
    if (input.left) { p.facing = -1; p.vx -= MOVE_ACCEL }
    else if (input.right) { p.facing = 1; p.vx += MOVE_ACCEL }
    else p.vx *= FRICTION
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx))
    if (input.jump && p.onGround) p.vy = JUMP_V
  } else {
    p.vx *= FRICTION
  }
  p.vy += GRAVITY
  if (p.vy > 18) p.vy = 18
  moveWithTiles(state, p)
  p.x = Math.max(TILE, Math.min(WORLD_COLS * TILE - TILE - p.w, p.x))

  if (!state.uiPanel) stepMining(state, input)
  else state.mining = null

  stepEnemies(state)

  if (p.hp <= 0) respawnPlayer(state)
}
