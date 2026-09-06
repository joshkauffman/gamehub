// ── Geometry Rush — cosmetic skins ──────────────────────────────────────
// Pure presentation: a skin is just a color per control mode. Bought with
// coins earned from play (see engine.js), persisted separately from the
// engine's own save data since it's a display concern, not gameplay state.

export const SKINS = [
  { id: 'neon', name: 'Neon', price: 0, colors: { cube: '#00e5ff', ship: '#ff9500', ball: '#ff2ec4' } },
  { id: 'sunset', name: 'Sunset', price: 150, colors: { cube: '#ff6b35', ship: '#ffd23f', ball: '#ff2e63' } },
  { id: 'toxic', name: 'Toxic', price: 150, colors: { cube: '#39ff14', ship: '#adff02', ball: '#00ff9c' } },
  { id: 'royal', name: 'Royal', price: 250, colors: { cube: '#7b2ff7', ship: '#f107a3', ball: '#00d4ff' } },
  { id: 'mono', name: 'Monochrome', price: 250, colors: { cube: '#ffffff', ship: '#cfcfcf', ball: '#8a8a8a' } },
  { id: 'inferno', name: 'Inferno', price: 400, colors: { cube: '#ff0000', ship: '#ff7b00', ball: '#ffea00' } },
]

const SKINS_KEY = 'geometry-rush-skins'
const DEFAULT_SKIN_ID = 'neon'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SKINS_KEY))
    return {
      owned: Array.isArray(raw?.owned) ? raw.owned : [DEFAULT_SKIN_ID],
      equipped: typeof raw?.equipped === 'string' ? raw.equipped : DEFAULT_SKIN_ID,
    }
  } catch {
    return { owned: [DEFAULT_SKIN_ID], equipped: DEFAULT_SKIN_ID }
  }
}
function save(data) {
  try { localStorage.setItem(SKINS_KEY, JSON.stringify(data)) } catch { /* storage unavailable */ }
}

export function loadOwnedSkinIds() { return load().owned }
export function loadEquippedSkinId() { return load().equipped }

export function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0] }

export function ownSkin(id) {
  const data = load()
  if (!data.owned.includes(id)) { data.owned.push(id); save(data) }
}

export function equipSkin(id) {
  const data = load()
  if (!data.owned.includes(id)) return false
  data.equipped = id
  save(data)
  return true
}

export function getEquippedColors() {
  return getSkin(loadEquippedSkinId()).colors
}
