// ── Shared coin purse ────────────────────────────────────────────────
// One gold/coin balance shared across Dungeon Crawler Max, Dungeon
// Crawler Max: Free Roam, and Hogwarts: Spellbound — all three are the
// same "kid-safe game show dungeon" universe under the hood (near-
// identical player/loot/achievement code), so coins found in any one of
// them spend in the others too. Backed by one localStorage number; each
// game's Player 1 reads it in at game start and writes back through it
// whenever their own gold changes (see syncSharedCoins below) — Player 2
// in any game's 2-player mode keeps their own per-run-only gold, since
// they're a guest player with no persistent identity across sessions.
const SHARED_COINS_KEY = 'gamehub-shared-dungeon-coins-v1'

export function loadSharedCoins() {
  try { return Math.max(0, Math.floor(Number(localStorage.getItem(SHARED_COINS_KEY)) || 0)) } catch { return 0 }
}
export function saveSharedCoins(amount) {
  try { localStorage.setItem(SHARED_COINS_KEY, String(Math.max(0, Math.floor(amount)))) } catch { /* storage unavailable */ }
}

// Call every frame (or on any event that might change gold) with a
// player object and a ref holding the last-synced value — writes to
// storage only when the number actually changed, so this is cheap to
// call unconditionally from a game loop instead of needing every single
// `player.gold +=` call site hooked individually.
export function syncSharedCoins(player, lastSyncedRef) {
  if (!player || player.gold === lastSyncedRef.current) return
  lastSyncedRef.current = player.gold
  saveSharedCoins(player.gold)
}
