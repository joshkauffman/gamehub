// ── Hub coins + the Hub Shop ─────────────────────────────────────────────
// Per player. Coins come from daily challenges, hub secrets, badges,
// trophies, ratings, the ghost, birthdays and the treasure map. Every
// reward has a unique key so it can only ever be paid out once.
import { pkey } from './profiles.js'

const KEY = 'gamehub-wallet'
const blank = () => ({ balance: 0, total: 0, earned: {}, owned: [], frame: null, petHat: null })

export function loadWallet(pid) {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(pkey(KEY, pid))) } } catch { return blank() }
}
function save(w) {
  try { localStorage.setItem(pkey(KEY), JSON.stringify(w)) } catch { /* storage unavailable */ }
}

// Pays `n` coins the first time `key` is seen. Returns the new wallet, or null if already paid.
export function earn(key, n) {
  const w = loadWallet()
  if (w.earned[key]) return null
  const next = { ...w, balance: w.balance + n, total: w.total + n, earned: { ...w.earned, [key]: Date.now() } }
  save(next)
  return next
}
// How many rewards whose key starts with `prefix` were paid today (for daily caps).
export function earnedToday(prefix) {
  const t0 = new Date().setHours(0, 0, 0, 0)
  return Object.entries(loadWallet().earned).filter(([k, at]) => k.startsWith(prefix) && at >= t0).length
}

export function spend(n) {
  const w = loadWallet()
  if (w.balance < n) return null
  const next = { ...w, balance: w.balance - n }
  save(next)
  return next
}

export function buy(item) {
  const w = loadWallet()
  if (w.owned.includes(item.id) || w.balance < item.price) return null
  const next = { ...w, balance: w.balance - item.price, owned: [...w.owned, item.id] }
  if (item.kind === 'frame') next.frame = item.id
  if (item.kind === 'hat') next.petHat = item.id
  save(next)
  return next
}

export function equip(field, id) {
  const w = loadWallet()
  const next = { ...w, [field]: w[field] === id ? null : id }
  save(next)
  return next
}

export const SHOP = [
  { id: 'frame:gold', kind: 'frame', name: 'Gold frame', icon: '🟨', price: 40, desc: 'Shiny gold edges on every game card.' },
  { id: 'frame:ice', kind: 'frame', name: 'Ice frame', icon: '🧊', price: 50, desc: 'Frosty blue card edges.' },
  { id: 'frame:fire', kind: 'frame', name: 'Fire frame', icon: '🔥', price: 60, desc: 'Cards that glow like they’re on fire.' },
  { id: 'frame:rainbow', kind: 'frame', name: 'Rainbow frame', icon: '🌈', price: 80, desc: 'Every colour, always moving.' },
  { id: 'frame:galaxy', kind: 'frame', name: 'Galaxy frame', icon: '🌌', price: 100, desc: 'Sparkly purple space edges.' },
  { id: 'theme:ocean', kind: 'theme', name: 'Ocean theme', icon: '🌊', price: 60, desc: 'Deep blue with fish swimming by.' },
  { id: 'theme:candy', kind: 'theme', name: 'Candy theme', icon: '🍭', price: 60, desc: 'Pink, sweet, and full of candy.' },
  { id: 'theme:jungle', kind: 'theme', name: 'Jungle theme', icon: '🌴', price: 60, desc: 'Green leaves and parrots.' },
  { id: 'theme:galaxy', kind: 'theme', name: 'Galaxy theme', icon: '🪐', price: 80, desc: 'Planets and stars in deep space.' },
  { id: 'avatar:🐉', kind: 'avatar', name: 'Dragon', icon: '🐉', price: 30 },
  { id: 'avatar:🦈', kind: 'avatar', name: 'Shark', icon: '🦈', price: 25 },
  { id: 'avatar:🥷', kind: 'avatar', name: 'Ninja', icon: '🥷', price: 30 },
  { id: 'avatar:🧛', kind: 'avatar', name: 'Vampire', icon: '🧛', price: 30 },
  { id: 'avatar:🧜', kind: 'avatar', name: 'Merperson', icon: '🧜', price: 30 },
  { id: 'avatar:🧚', kind: 'avatar', name: 'Fairy', icon: '🧚', price: 30 },
  { id: 'avatar:🦩', kind: 'avatar', name: 'Flamingo', icon: '🦩', price: 20 },
  { id: 'avatar:🐺', kind: 'avatar', name: 'Wolf', icon: '🐺', price: 25 },
  { id: 'avatar:👑', kind: 'avatar', name: 'Crown', icon: '👑', price: 75 },
  { id: 'hat:🎀', kind: 'hat', name: 'Bow', icon: '🎀', price: 20, desc: 'For your pet.' },
  { id: 'hat:🧢', kind: 'hat', name: 'Cap', icon: '🧢', price: 20, desc: 'For your pet.' },
  { id: 'hat:🎩', kind: 'hat', name: 'Top hat', icon: '🎩', price: 25, desc: 'For your pet.' },
  { id: 'hat:🕶️', kind: 'hat', name: 'Sunglasses', icon: '🕶️', price: 30, desc: 'For your pet.' },
  { id: 'hat:👑', kind: 'hat', name: 'Pet crown', icon: '👑', price: 60, desc: 'For your pet.' },
]
export const shopItem = (id) => SHOP.find(i => i.id === id)
export const ownedAvatars = (w) => w.owned.filter(id => id.startsWith('avatar:')).map(id => id.slice(7))
