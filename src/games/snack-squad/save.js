// ── Snack Squad — shared save data ───────────────────────────────────
// Extracted so other games (X Marks the Spot's Trading Post) can read
// and mutate the same collection instead of keeping a second copy of
// it — a trade or battle there really does change your Snack Squad
// binder, since it's the exact same localStorage record.

export const SAVE_KEY = 'snackSquadSaveV1'
export const START_COINS = 500

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { coins: typeof parsed.coins === 'number' ? parsed.coins : START_COINS, owned: parsed.owned || {} }
      }
    }
  } catch {}
  return { coins: START_COINS, owned: {} }
}

export function persistSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch {}
}
