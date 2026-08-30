// ── Intergalactic Poker — the shop ──────────────────────────────────────
// Cosmetic-only purchases (card backs, table themes, Bill's color) bought
// with a persistent wallet of Secrets carried between matches — never
// anything that changes the odds or the rules. This is a game you might
// play against a real friend online, so nothing purchasable can give
// either side an actual edge; it's all look-and-feel.
//
// Wallet only ever grows: banking happens on a win or a profitable
// cash-out, and a bad hand or a loss never claws back Secrets you already
// banked from a better one — losing a match just doesn't add anything.

export const CARD_BACKS = [
  { id: 'static', name: 'Cosmic Static', price: 0, colorA: '#241a3a', colorB: '#1a1428', border: '#b98eff', icon: '🔺' },
  { id: 'goldeye', name: 'Golden Eye', price: 80, colorA: '#2a2010', colorB: '#1a1408', border: '#ffd23f', icon: '👁' },
  { id: 'rift', name: 'Rift Storm', price: 120, colorA: '#2a1210', colorB: '#1a0a08', border: '#ff5d3d', icon: '🔺' },
  { id: 'warp', name: 'Warp Tunnel', price: 150, colorA: '#0f1e2a', colorB: '#0a141a', border: '#4fc3ff', icon: '🌀' },
]

export const TABLE_THEMES = [
  { id: 'midnight', name: 'Midnight Cell', price: 0, bg: '#0a0714', glow: '#241a3a', accent: '#ffd23f' },
  { id: 'bloodrift', name: 'Blood Rift', price: 100, bg: '#140508', glow: '#3a0a12', accent: '#ff5d3d' },
  { id: 'staticstorm', name: 'Static Storm', price: 130, bg: '#050a14', glow: '#0f2233', accent: '#4fc3ff' },
  { id: 'goldenreality', name: 'Golden Reality', price: 180, bg: '#0f0a02', glow: '#2a2008', accent: '#ffd23f' },
]

export const BILL_SKINS = [
  { id: 'classic', name: 'Classic Gold', price: 0, color: '#ffd23f' },
  { id: 'blueflame', name: 'Blue Flame', price: 90, color: '#4fc3ff' },
  { id: 'shadow', name: 'Shadow', price: 140, color: '#b98eff' },
  { id: 'staticwhite', name: 'Static White', price: 160, color: '#eef2ff' },
]

const DEFAULT_EQUIPPED = { cardBack: 'static', tableTheme: 'midnight', billSkin: 'classic' }
const DEFAULT_OWNED = ['static', 'midnight', 'classic']

const WALLET_KEY = 'intergalactic-poker-wallet'
const COSMETICS_KEY = 'intergalactic-poker-cosmetics'

export function loadWallet() {
  try { return Math.max(0, Math.round(Number(localStorage.getItem(WALLET_KEY)) || 0)) } catch { return 0 }
}
export function saveWallet(amount) {
  try { localStorage.setItem(WALLET_KEY, String(Math.max(0, Math.round(amount)))) } catch { /* ignore */ }
}

export function loadCosmetics() {
  try {
    const raw = localStorage.getItem(COSMETICS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      owned: Array.isArray(parsed.owned) ? Array.from(new Set([...DEFAULT_OWNED, ...parsed.owned])) : DEFAULT_OWNED,
      equipped: { ...DEFAULT_EQUIPPED, ...(parsed.equipped || {}) },
    }
  } catch {
    return { owned: DEFAULT_OWNED, equipped: DEFAULT_EQUIPPED }
  }
}
export function saveCosmetics(state) {
  try { localStorage.setItem(COSMETICS_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

// Only ever adds — a losing or break-even match banks nothing, but never
// takes back Secrets already earned from a better one.
export function bankProfit(finalStack, startingStack) {
  const profit = Math.max(0, finalStack - startingStack)
  if (profit <= 0) return loadWallet()
  const next = loadWallet() + profit
  saveWallet(next)
  return next
}

export function findById(list, id) { return list.find(x => x.id === id) || list[0] }
