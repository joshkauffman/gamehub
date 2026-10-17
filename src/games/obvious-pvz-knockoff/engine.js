// ── The Obvious Plants vs. Zombies Knockoff — game engine ─────────────
// Pure state/physics, no rendering. No continuous key input here — the
// whole game is driven by a handful of explicit actions (select a seed
// packet, click a cell, click a falling sun) called from the React
// wrapper, plus one stepGame() tick per animation frame.

import {
  GRID_X0, GRID_Y0, ROWS, COLS, CELL_W, CELL_H,
  SUN_START, SUN_VALUE, SUN_FALL_INTERVAL, SUN_FALL_SPEED, SUN_CLICK_RADIUS,
  PEA_SPEED, MOWER_SPEED, TOTAL_WAVES, WAVE_GAP_FRAMES,
} from './constants.js'
import { PLANTS } from './plantData.js'
import { ZOMBIES, buildWave } from './zombieData.js'

function cellCenter(row, col) {
  return { x: GRID_X0 + col * CELL_W + CELL_W / 2, y: GRID_Y0 + row * CELL_H + CELL_H / 2 }
}
function cellOf(x, y) {
  const col = Math.floor((x - GRID_X0) / CELL_W)
  const row = Math.floor((y - GRID_Y0) / CELL_H)
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
  return { row, col }
}

let nextId = 1
function uid() { return nextId++ }

export function freshState() {
  return {
    frame: 0,
    status: 'playing',
    message: 'A wave is coming...', messageTimer: 140,
    sun: SUN_START,
    score: 0,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    plantCooldowns: {},
    selectedPlant: null,
    zombies: [],
    projectiles: [],
    suns: [],
    particles: [],
    mowers: Array.from({ length: ROWS }, () => ({ state: 'ready', x: GRID_X0 - 30 })), // ready | sweeping | used
    waveIndex: 0,
    waveSpawns: buildWave(0).map(s => ({ ...s, remaining: s.delay })),
    waveGapTimer: 0,
    sunFallTimer: SUN_FALL_INTERVAL,
    wavePending: true,
  }
}

function showMessage(state, text, frames = 110) { state.message = text; state.messageTimer = frames }

function spawnParticles(state, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    state.particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1, life: 22, color })
  }
}

export function selectPlant(state, plantId) {
  if (state.status !== 'playing') return
  const def = PLANTS[plantId]
  if (!def) return
  if (state.selectedPlant === plantId) { state.selectedPlant = null; return }
  if (state.sun < def.cost) return
  if ((state.plantCooldowns[plantId] || 0) > 0) return
  state.selectedPlant = plantId
}

function collectSun(state, s) {
  state.sun += SUN_VALUE
  spawnParticles(state, s.x, s.y, '#ffd93d', 10)
  s.dead = true
}

export function handleCanvasClick(state, x, y) {
  if (state.status !== 'playing') return
  // Falling/landed suns take priority — always collectible regardless
  // of whether a seed packet is armed.
  for (const s of state.suns) {
    if (!s.dead && Math.hypot(s.x - x, s.y - y) < SUN_CLICK_RADIUS) { collectSun(state, s); return }
  }
  if (!state.selectedPlant) return
  const cell = cellOf(x, y)
  if (!cell) return
  if (state.grid[cell.row][cell.col]) return
  const def = PLANTS[state.selectedPlant]
  if (state.sun < def.cost) { state.selectedPlant = null; return }
  state.sun -= def.cost
  state.plantCooldowns[def.id] = Math.round(def.cooldown * 60)
  const c = cellCenter(cell.row, cell.col)
  state.grid[cell.row][cell.col] = {
    type: def.id, hp: def.hp, maxHp: def.hp, row: cell.row, col: cell.col, x: c.x, y: c.y,
    fireCooldown: Math.floor(Math.random() * 20), sunCooldown: def.sunRate || 0, armTimer: def.armFrames || 0,
  }
  state.selectedPlant = null
}

function firstZombieAhead(state, row, fromX) {
  let best = null
  for (const z of state.zombies) {
    if (!z.alive || z.row !== row) continue
    if (z.x <= fromX) continue
    if (!best || z.x < best.x) best = z
  }
  return best
}

function zombieBlockingAt(state, row, x) {
  for (const z of state.zombies) {
    if (!z.alive || z.row !== row) continue
    if (Math.abs(z.x - x) < CELL_W * 0.4) return z
  }
  return null
}

function damageZombie(state, z, dmg) {
  z.hp -= dmg
  spawnParticles(state, z.x, z.y, '#8fae6a', 4)
  if (z.hp <= 0) { z.alive = false; state.score += 10 }
}

function stepPlants(state) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = state.grid[r][c]
      if (!p) continue
      const def = PLANTS[p.type]
      if (p.hp <= 0) { state.grid[r][c] = null; spawnParticles(state, p.x, p.y, def.color, 10); continue }

      if (def.fireRate) {
        p.fireCooldown--
        if (p.fireCooldown <= 0 && firstZombieAhead(state, r, p.x)) {
          p.fireCooldown = def.fireRate
          const shots = def.twin ? 2 : 1
          for (let i = 0; i < shots; i++) {
            state.projectiles.push({
              id: uid(), x: p.x + 20 + i * 10, y: p.y, row: r, vx: PEA_SPEED,
              damage: def.damage, type: def.projectile,
            })
          }
        }
      }
      if (def.sunRate) {
        p.sunCooldown--
        if (p.sunCooldown <= 0) {
          p.sunCooldown = def.sunRate
          state.suns.push({ id: uid(), x: p.x, y: p.y - 10, vy: 0.5, row: r, landed: false, timer: 0 })
        }
      }
      if (def.armFrames) {
        if (p.armTimer > 0) { p.armTimer--; continue }
        const victim = zombieBlockingAt(state, r, p.x)
        if (victim) {
          for (const z of state.zombies) {
            if (z.alive && z.row === r && Math.abs(z.x - p.x) < def.blastRadius) damageZombie(state, z, def.blastDamage)
          }
          spawnParticles(state, p.x, p.y, '#ff8a3d', 24)
          state.grid[r][c] = null
        }
      }
    }
  }
}

function stepZombies(state) {
  for (const z of state.zombies) {
    if (!z.alive) continue
    if (z.slowTimer > 0) z.slowTimer--
    const speed = (ZOMBIES[z.type].speed) * (z.slowTimer > 0 ? 0.45 : 1)

    const col = Math.max(0, Math.min(COLS - 1, Math.floor((z.x - GRID_X0) / CELL_W)))
    const plant = state.grid[z.row][col]
    if (plant && plant.x < z.x && plant.x > z.x - CELL_W) {
      plant.hp -= 0.12
      z.eating = true
    } else {
      z.eating = false
      z.x -= speed
    }

    if (z.x <= GRID_X0 - 4) {
      const mower = state.mowers[z.row]
      if (mower.state === 'ready') {
        mower.state = 'sweeping'
      } else if (mower.state !== 'sweeping') {
        state.status = 'gameover'
        showMessage(state, 'The zombies made it inside!', 300)
      }
      z.x = GRID_X0 - 4
    }
  }
  state.zombies = state.zombies.filter(z => z.alive)
}

function stepMowers(state) {
  for (const mower of state.mowers) {
    if (mower.state !== 'sweeping') continue
    mower.x += MOWER_SPEED
    for (const z of state.zombies) {
      const row = state.mowers.indexOf(mower)
      if (z.alive && z.row === row && Math.abs(z.x - mower.x) < 26) z.alive = false
    }
    if (mower.x > GRID_X0 + COLS * CELL_W) mower.state = 'used'
  }
  state.zombies = state.zombies.filter(z => z.alive)
}

function stepProjectiles(state) {
  for (const pr of state.projectiles) {
    pr.x += pr.vx
    const target = state.zombies.find(z => z.alive && z.row === pr.row && Math.abs(z.x - pr.x) < 18)
    if (target) {
      damageZombie(state, target, pr.damage)
      if (pr.type === 'frostpea') target.slowTimer = 180
      pr.dead = true
    }
    if (pr.x > GRID_X0 + COLS * CELL_W + 20) pr.dead = true
  }
  state.projectiles = state.projectiles.filter(pr => !pr.dead)
}

function stepSuns(state) {
  if (state.sunFallTimer > 0) {
    state.sunFallTimer--
  } else {
    state.sunFallTimer = SUN_FALL_INTERVAL
    const col = Math.floor(Math.random() * COLS)
    const { x } = cellCenter(0, col)
    state.suns.push({ id: uid(), x, y: -20, vy: SUN_FALL_SPEED, landed: false, timer: 0 })
  }
  const groundY = GRID_Y0 + ROWS * CELL_H - 30
  for (const s of state.suns) {
    if (s.dead) continue
    if (!s.landed) {
      s.y += s.vy
      if (s.y >= groundY) { s.y = groundY; s.landed = true }
    } else {
      s.timer++
      if (s.timer > 360) s.dead = true
    }
  }
  state.suns = state.suns.filter(s => !s.dead)
}

function stepWaves(state) {
  // Spawn queued zombies for the active wave.
  let anyPending = false
  for (const spawn of state.waveSpawns) {
    if (spawn.spawned) continue
    anyPending = true
    spawn.remaining--
    if (spawn.remaining <= 0) {
      spawn.spawned = true
      const row = Math.floor(Math.random() * ROWS)
      const def = ZOMBIES[spawn.type]
      const { y } = cellCenter(row, COLS - 1)
      state.zombies.push({
        id: uid(), type: spawn.type, row, x: GRID_X0 + COLS * CELL_W + 20, y,
        hp: def.hp, maxHp: def.hp, alive: true, slowTimer: 0, eating: false,
      })
    }
  }
  if (!anyPending) state.wavePending = false

  if (!state.wavePending && state.zombies.length === 0) {
    if (state.waveIndex + 1 >= TOTAL_WAVES) {
      state.status = 'win'
      showMessage(state, 'The lawn held! Every wave repelled.', 300)
      return
    }
    state.waveGapTimer++
    if (state.waveGapTimer === 1) showMessage(state, `Wave ${state.waveIndex + 2} incoming...`, WAVE_GAP_FRAMES)
    if (state.waveGapTimer >= WAVE_GAP_FRAMES) {
      state.waveIndex++
      state.waveSpawns = buildWave(state.waveIndex).map(s => ({ ...s, remaining: s.delay }))
      state.waveGapTimer = 0
      state.wavePending = true
    }
  }
}

export function stepGame(state) {
  if (state.status !== 'playing') return
  state.frame++
  if (state.messageTimer > 0) state.messageTimer--

  for (const id in state.plantCooldowns) if (state.plantCooldowns[id] > 0) state.plantCooldowns[id]--

  stepPlants(state)
  stepZombies(state)
  stepMowers(state)
  stepProjectiles(state)
  stepSuns(state)
  state.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.25; pt.life-- })
  state.particles = state.particles.filter(pt => pt.life > 0)
  if (state.status !== 'playing') return
  stepWaves(state)
}

export function waveProgress(state) { return { current: state.waveIndex + 1, total: TOTAL_WAVES } }
