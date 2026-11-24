// ── Player profiles ──────────────────────────────────────────────────────
// A few people sharing one browser. Each profile gets its own stats,
// favorites, recent games, theme and daily challenge. The first profile
// ('p1') keeps using the original un-suffixed storage keys, so everything
// saved before profiles existed stays with it.
//
// Trophies are NOT per profile: they're read straight from each game's own
// save, and the games themselves don't know who's playing.

const KEY = 'gamehub-profiles'
export const AVATARS = ['🦊', '🐸', '🐼', '🦁', '🐯', '🐙', '🦄', '🐲', '🐵', '🐧', '🦖', '🐻', '🐶', '🐱', '🦉', '🐝', '👽', '🤖', '🧙', '🦸']

const DEFAULT = { list: [{ id: 'p1', name: 'Player 1', avatar: '🦊' }], active: 'p1' }

export function loadProfiles() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY))
    if (p?.list?.length) return { ...p, active: p.list.some(x => x.id === p.active) ? p.active : p.list[0].id }
  } catch { /* storage unavailable */ }
  return DEFAULT
}
function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* storage unavailable */ }
}

export function activeProfile() {
  const p = loadProfiles()
  return p.list.find(x => x.id === p.active)
}

// The storage key for `base`, for the given (or active) profile.
export function pkey(base, pid = loadProfiles().active) {
  return pid === 'p1' ? base : `${base}::${pid}`
}

export function setActive(id) {
  const p = loadProfiles()
  save({ ...p, active: id })
}

export function addProfile(name, avatar) {
  const p = loadProfiles()
  const id = 'p' + Date.now().toString(36)
  save({ list: [...p.list, { id, name: name.trim().slice(0, 16) || 'Player', avatar }], active: id })
  return id
}

export function editProfile(id, changes) {
  const p = loadProfiles()
  save({ ...p, list: p.list.map(x => (x.id === id ? { ...x, ...changes, name: (changes.name ?? x.name).trim().slice(0, 16) || x.name } : x)) })
}

// Every per-profile key, so deleting a profile can clean up after it.
export const PROFILE_KEYS = ['gamehub-stats-v1', 'gamehub-recently-played', 'gamehub-theme', 'gamehub-favorites', 'gamehub-daily', 'gamehub-hub-secrets', 'gamehub-catcher-best', 'gamehub-rate-skip']

export function deleteProfile(id) {
  const p = loadProfiles()
  if (p.list.length < 2) return
  const list = p.list.filter(x => x.id !== id)
  save({ list, active: p.active === id ? list[0].id : p.active })
  if (id === 'p1') return // its data lives on the plain keys; leave it rather than guess
  try { for (const k of PROFILE_KEYS) localStorage.removeItem(pkey(k, id)) } catch { /* storage unavailable */ }
}
