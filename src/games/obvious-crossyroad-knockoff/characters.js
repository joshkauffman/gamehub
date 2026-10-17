// ── The Obvious Crossy Road Knockoff — playable critters ──────────────
// Purely cosmetic — every critter hops, dodges, and drowns exactly the
// same way. Only the colors and a couple of silhouette details (ears,
// belly patch, eyes) change; see drawPlayer in render.js.

export const CHARACTERS = [
  { id: 'chicken', name: 'Chicken', emoji: '🐔', bodyColor: '#f2d94e', accentColor: '#e8503a', legColor: '#e8a23a' },
  { id: 'bunny', name: 'Bunny', emoji: '🐰', bodyColor: '#f4eeee', accentColor: '#ff9ac1', legColor: '#d8d2d2' },
  { id: 'frog', name: 'Frog', emoji: '🐸', bodyColor: '#5fbf4a', accentColor: '#2f8f2a', legColor: '#4a9f3a' },
  { id: 'penguin', name: 'Penguin', emoji: '🐧', bodyColor: '#2a2a33', accentColor: '#ffb84a', legColor: '#e8a23a' },
]

export function characterById(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]
}
