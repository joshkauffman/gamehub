// ── The Obvious Mega Man Knockoff — Robot Masters & weapons ───────────
// A clean 4-way weakness loop, classic genre structure: each boss drops
// a weapon that happens to be exactly what the next boss can't stand.

export const WEAPONS = {
  buster: { id: 'buster', name: 'Mega Buster', color: '#9dffb0', glow: '#d8ffe0' },
  fire: { id: 'fire', name: 'Blaze Cannon', color: '#ff6a2a', glow: '#ffb85c' },
  volt: { id: 'volt', name: 'Volt Whip', color: '#ffe94a', glow: '#fff6b0' },
  saw: { id: 'saw', name: 'Saw Blade', color: '#c8c8d8', glow: '#ffffff' },
  ice: { id: 'ice', name: 'Frost Shard', color: '#5cc8ff', glow: '#bfeeff' },
}

export const BOSSES = [
  {
    id: 'blaze', name: 'Blaze Beetle', stageId: 'ember-factory', stageName: 'Ember Factory',
    weaponId: 'fire', weakTo: 'volt', color: '#ff5c2a', shape: 'round',
  },
  {
    id: 'volt', name: 'Volt Viper', stageId: 'circuit-marsh', stageName: 'Circuit Marsh',
    weaponId: 'volt', weakTo: 'saw', color: '#e8d81a', shape: 'wing',
  },
  {
    id: 'saw', name: 'Saw Shark', stageId: 'scrapyard-docks', stageName: 'Scrapyard Docks',
    weaponId: 'saw', weakTo: 'ice', color: '#8a8a9a', shape: 'square',
  },
  {
    id: 'frost', name: 'Frost Falcon', stageId: 'glacier-summit', stageName: 'Glacier Summit',
    weaponId: 'ice', weakTo: 'fire', color: '#5cc8ff', shape: 'wing',
  },
]

export function bossForStage(stageId) { return BOSSES.find(b => b.stageId === stageId) }
