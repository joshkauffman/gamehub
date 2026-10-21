// ── The Obvious Minecraft Knockoff — save/load ─────────────────────────
// localStorage persistence for the voxel grid + inventory + player
// state, wrapped in try/catch throughout (private browsing, quota
// exceeded, corrupted/old-shape data — any of it should just mean
// "start fresh", never a crash).

const SAVE_KEY = 'obvious-minecraft-knockoff:save-v1'
const SAVE_VERSION = 1

// Uint8Array -> base64, chunked so spreading into String.fromCharCode
// never hits the call-stack argument limit on a large world.
export function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function serializeSave({ world, inventory, player, selected, hp, timeOfDay }) {
  return JSON.stringify({
    v: SAVE_VERSION,
    sizeX: world.sizeX, sizeY: world.sizeY, sizeZ: world.sizeZ,
    blocks: bytesToBase64(world.blocks),
    inventory, player, selected, hp, timeOfDay,
  })
}

// Returns null if there's nothing usable to load (no save, corrupted
// JSON, or a save whose world dimensions don't match the current
// build's — rather than try to migrate/crop a mismatched grid, the
// caller just falls back to a fresh generated world).
export function deserializeSave(raw, expectedSizeX, expectedSizeY, expectedSizeZ) {
  if (!raw) return null
  let data
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || data.v !== SAVE_VERSION) return null
  if (data.sizeX !== expectedSizeX || data.sizeY !== expectedSizeY || data.sizeZ !== expectedSizeZ) return null
  let blocks
  try { blocks = base64ToBytes(data.blocks) } catch { return null }
  if (blocks.length !== expectedSizeX * expectedSizeY * expectedSizeZ) return null
  return {
    blocks,
    inventory: data.inventory || {},
    player: data.player || null,
    selected: typeof data.selected === 'number' ? data.selected : 0,
    hp: typeof data.hp === 'number' ? data.hp : null,
    timeOfDay: typeof data.timeOfDay === 'number' ? data.timeOfDay : 0,
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(state))
    return true
  } catch {
    return false // quota exceeded, private mode, etc. — just skip it
  }
}

export function loadGame(sizeX, sizeY, sizeZ) {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return deserializeSave(raw, sizeX, sizeY, sizeZ)
  } catch {
    return null
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
}
