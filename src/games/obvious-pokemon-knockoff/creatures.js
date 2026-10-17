// ── The Obvious Pokémon Knockoff — creatures & moves ──────────────────
// Original species, original names, original (simple) stats. No real
// species names, no copied designs — just small procedural blobs with
// a type and a couple of moves, drawn from scratch in render.js.

export const MOVES = {
  tackle: { name: 'Tackle', type: 'normal', power: 7 },
  emberJab: { name: 'Ember Jab', type: 'ember', power: 10 },
  aquaSplash: { name: 'Aqua Splash', type: 'aqua', power: 10 },
  vineSnap: { name: 'Vine Snap', type: 'leaf', power: 10 },
}

// Every evolving species carries evolvesTo + evolveAt (a number of
// battles won while that creature was the one that landed the final
// blow) — see checkEvolution in engine.js.
export const SPECIES = {
  charbit: { name: 'Charbit', type: 'ember', hp: 28, atk: 11, def: 8, spd: 10, moves: ['tackle', 'emberJab'], catchRate: 0.3, color: '#ff6a3d', shape: 'round', evolvesTo: 'charbrand', evolveAt: 3 },
  dampup: { name: 'Dampup', type: 'aqua', hp: 30, atk: 9, def: 10, spd: 9, moves: ['tackle', 'aquaSplash'], catchRate: 0.3, color: '#3dafff', shape: 'round', evolvesTo: 'damposaur', evolveAt: 3 },
  sproutling: { name: 'Sproutling', type: 'leaf', hp: 29, atk: 9, def: 9, spd: 10, moves: ['tackle', 'vineSnap'], catchRate: 0.3, color: '#5cd85c', shape: 'round', evolvesTo: 'sprouzilla', evolveAt: 3 },

  fluttermoth: { name: 'Fluttermoth', type: 'leaf', hp: 20, atk: 7, def: 6, spd: 13, moves: ['tackle', 'vineSnap'], catchRate: 0.55, color: '#8a6ad8', shape: 'wing', evolvesTo: 'mothwing', evolveAt: 3 },
  pebblet: { name: 'Pebblet', type: 'ember', hp: 24, atk: 9, def: 10, spd: 6, moves: ['tackle', 'emberJab'], catchRate: 0.5, color: '#c97a3d', shape: 'square', evolvesTo: 'boulderon', evolveAt: 3 },
  puddlit: { name: 'Puddlit', type: 'aqua', hp: 22, atk: 8, def: 7, spd: 11, moves: ['tackle', 'aquaSplash'], catchRate: 0.5, color: '#4ddfe8', shape: 'round', evolvesTo: 'puddlord', evolveAt: 3 },
  rockling: { name: 'Rockling', type: 'ember', hp: 26, atk: 10, def: 12, spd: 5, moves: ['tackle', 'emberJab'], catchRate: 0.45, color: '#a85a2a', shape: 'square', evolvesTo: 'rockzilla', evolveAt: 3 },

  // Evolved forms — noticeably stronger, same type and moveset, a
  // richer color so they read as "the same creature, grown up".
  charbrand: { name: 'Charbrand', type: 'ember', hp: 40, atk: 16, def: 12, spd: 13, moves: ['tackle', 'emberJab'], catchRate: 0, color: '#e8400f', shape: 'round' },
  damposaur: { name: 'Damposaur', type: 'aqua', hp: 42, atk: 14, def: 15, spd: 12, moves: ['tackle', 'aquaSplash'], catchRate: 0, color: '#1a6fdf', shape: 'round' },
  sprouzilla: { name: 'Sprouzilla', type: 'leaf', hp: 41, atk: 14, def: 14, spd: 13, moves: ['tackle', 'vineSnap'], catchRate: 0, color: '#2fa82f', shape: 'round' },
  mothwing: { name: 'Mothwing', type: 'leaf', hp: 29, atk: 11, def: 9, spd: 17, moves: ['tackle', 'vineSnap'], catchRate: 0, color: '#6a3fb8', shape: 'wing' },
  boulderon: { name: 'Boulderon', type: 'ember', hp: 34, atk: 14, def: 15, spd: 8, moves: ['tackle', 'emberJab'], catchRate: 0, color: '#a85a1f', shape: 'square' },
  puddlord: { name: 'Puddlord', type: 'aqua', hp: 31, atk: 12, def: 11, spd: 14, moves: ['tackle', 'aquaSplash'], catchRate: 0, color: '#1fb8c8', shape: 'round' },
  rockzilla: { name: 'Rockzilla', type: 'ember', hp: 37, atk: 15, def: 18, spd: 7, moves: ['tackle', 'emberJab'], catchRate: 0, color: '#8a3f10', shape: 'square' },

  // South Path / Lakeshore.
  leaflen: { name: 'Leaflen', type: 'leaf', hp: 21, atk: 7, def: 7, spd: 12, moves: ['tackle', 'vineSnap'], catchRate: 0.5, color: '#7adf5c', shape: 'round', evolvesTo: 'leafwood', evolveAt: 3 },
  driftkit: { name: 'Driftkit', type: 'aqua', hp: 23, atk: 8, def: 8, spd: 10, moves: ['tackle', 'aquaSplash'], catchRate: 0.5, color: '#5cc8ff', shape: 'round', evolvesTo: 'driftwhale', evolveAt: 3 },
  leafwood: { name: 'Leafwood', type: 'leaf', hp: 31, atk: 12, def: 11, spd: 15, moves: ['tackle', 'vineSnap'], catchRate: 0, color: '#3fae1f', shape: 'round' },
  driftwhale: { name: 'Driftwhale', type: 'aqua', hp: 35, atk: 13, def: 13, spd: 12, moves: ['tackle', 'aquaSplash'], catchRate: 0, color: '#1f7adf', shape: 'round' },

  // Route 3.
  sandnap: { name: 'Sandnap', type: 'ember', hp: 25, atk: 10, def: 9, spd: 7, moves: ['tackle', 'emberJab'], catchRate: 0.45, color: '#e0b35c', shape: 'square', evolvesTo: 'sanddrake', evolveAt: 3 },
  sanddrake: { name: 'Sanddrake', type: 'ember', hp: 36, atk: 15, def: 14, spd: 9, moves: ['tackle', 'emberJab'], catchRate: 0, color: '#b8822a', shape: 'square' },

  // Dusk Cave.
  cindermite: { name: 'Cindermite', type: 'ember', hp: 22, atk: 9, def: 8, spd: 9, moves: ['tackle', 'emberJab'], catchRate: 0.5, color: '#ff8a4a', shape: 'square', evolvesTo: 'cinderlord', evolveAt: 3 },
  cinderlord: { name: 'Cinderlord', type: 'ember', hp: 33, atk: 14, def: 12, spd: 11, moves: ['tackle', 'emberJab'], catchRate: 0, color: '#d84a1a', shape: 'square' },
  glowgrub: { name: 'Glowgrub', type: 'leaf', hp: 19, atk: 7, def: 6, spd: 6, moves: ['tackle', 'vineSnap'], catchRate: 0.4, color: '#c8ff8a', shape: 'round', evolvesTo: 'glowmoth', evolveAt: 3 },
  glowmoth: { name: 'Glowmoth', type: 'leaf', hp: 28, atk: 12, def: 9, spd: 16, moves: ['tackle', 'vineSnap'], catchRate: 0, color: '#9adf5c', shape: 'wing' },
  // A rare, no-evolution find waiting at the very end of the cave.
  embergeist: { name: 'Embergeist', type: 'ember', hp: 34, atk: 15, def: 11, spd: 12, moves: ['tackle', 'emberJab'], catchRate: 0.15, color: '#ff5c2a', shape: 'wing' },

  rivalstarter: { name: "Rival's Dampup", type: 'aqua', hp: 32, atk: 10, def: 10, spd: 10, moves: ['tackle', 'aquaSplash'], catchRate: 0, color: '#2d8fdf', shape: 'round' },
  magmadon: { name: 'Magmadon', type: 'ember', hp: 48, atk: 14, def: 12, spd: 9, moves: ['tackle', 'emberJab'], catchRate: 0, color: '#ff3d1a', shape: 'square' },
  anglerace: { name: "Angler's Driftkit", type: 'aqua', hp: 26, atk: 10, def: 9, spd: 11, moves: ['tackle', 'aquaSplash'], catchRate: 0, color: '#2a8fdf', shape: 'round' },
}

export function freshCreature(speciesId) {
  const def = SPECIES[speciesId]
  return { speciesId, hp: def.hp, maxHp: def.hp, wins: 0 }
}
