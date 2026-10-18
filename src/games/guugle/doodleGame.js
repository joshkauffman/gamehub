// ── Guugle doodle game — "catch the falling things" engine ────────────
// Pure state/physics, no rendering — one shared engine, reskinned per
// doodle (see DOODLE_GAME_SKINS in constants.js) the same way a real
// Google doodle sometimes turns into a tiny playable game. Move a
// basket left/right to catch good falling emoji (+1) and dodge the
// one bad emoji for that skin (-1, floored at 0) before the 30s timer
// runs out.

export const CANVAS_W = 480
export const CANVAS_H = 360
export const BASKET_W = 64
export const BASKET_Y = CANVAS_H - 34
export const GAME_FRAMES = 30 * 60 // 30s @ 60fps
export const BASKET_EASE = 0.35
export const BASKET_KEY_SPEED = 7
export const BAD_ITEM_CHANCE = 0.22
export const SPAWN_START_FRAMES = 65
export const SPAWN_MIN_FRAMES = 24
export const FALL_SPEED_START = 2.2
export const FALL_SPEED_RAMP = 1 / 1400 // extra speed per frame-since-start, applied to new spawns

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function freshState(skin) {
  return {
    skin,
    frame: 0,
    timeLeft: GAME_FRAMES,
    score: 0,
    basketX: CANVAS_W / 2,
    items: [],
    spawnTimer: SPAWN_START_FRAMES,
    status: 'playing', // playing | done
  }
}

// input: { targetX?: number (pointer position in canvas space),
//          left?: bool, right?: bool (keyboard fallback) }
export function stepGame(state, input = {}) {
  if (state.status !== 'playing') return
  state.frame++
  state.timeLeft--
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.status = 'done'
    return
  }

  if (input.targetX != null) {
    state.basketX += (input.targetX - state.basketX) * BASKET_EASE
  } else {
    if (input.left) state.basketX -= BASKET_KEY_SPEED
    if (input.right) state.basketX += BASKET_KEY_SPEED
  }
  state.basketX = clamp(state.basketX, BASKET_W / 2, CANVAS_W - BASKET_W / 2)

  state.spawnTimer--
  if (state.spawnTimer <= 0) {
    const bad = Math.random() < BAD_ITEM_CHANCE
    const emoji = bad ? state.skin.bad : state.skin.good[Math.floor(Math.random() * state.skin.good.length)]
    const speed = FALL_SPEED_START + Math.random() * 1.4 + state.frame * FALL_SPEED_RAMP
    state.items.push({ x: 20 + Math.random() * (CANVAS_W - 40), y: -20, emoji, bad, speed })
    state.spawnTimer = Math.max(SPAWN_MIN_FRAMES, SPAWN_START_FRAMES - Math.floor(state.frame / 90))
  }

  state.items.forEach(it => { it.y += it.speed })
  state.items = state.items.filter(it => {
    const caught = it.y >= BASKET_Y - 12 && it.y <= BASKET_Y + 16 && Math.abs(it.x - state.basketX) < BASKET_W / 2 + 8
    if (caught) {
      state.score += it.bad ? -1 : 1
      if (state.score < 0) state.score = 0
      return false
    }
    return it.y < CANVAS_H + 24
  })
}
