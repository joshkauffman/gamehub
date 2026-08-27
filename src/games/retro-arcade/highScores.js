// ── Per-cartridge high scores, kept in localStorage on this device. ────
const KEY = 'retro-arcade-high-scores-v1'

export function loadHighScores() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function recordScore(cartridgeId, score) {
  const scores = loadHighScores()
  const isNewBest = !scores[cartridgeId] || score > scores[cartridgeId]
  if (isNewBest) {
    scores[cartridgeId] = score
    try { localStorage.setItem(KEY, JSON.stringify(scores)) } catch { /* storage unavailable */ }
  }
  return { scores, isNewBest }
}
