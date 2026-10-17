// ── The Obvious Zelda Knockoff — weapon definitions ────────────────────
// Every character maps the same four action slots (melee on Z, three
// item slots on X/C/V) onto one of these. `kind` drives engine.js's
// dispatch — the slot itself doesn't care what's plugged into it, and
// each kind is a genuinely different mechanic, not a reskin:
//   melee    - swings a short-lived hitbox in the facing direction
//   return   - flies out in a straight line, loops back once it
//              reaches `range`, can hit each enemy once on the way out
//              AND once on the way back (only one can be in flight) —
//              good single-target poke, no area effect
//   straight - flies in a straight line, stops and deals damage the
//              instant it touches one target, a wall, or leaves the
//              room — single hit, no return trip
//   burst    - lobbed outward; detonates into an area-of-effect blast
//              (radius `radius`) the instant it touches a target, a
//              wall, or travels `range` — hits everything in range of
//              the blast once, good against groups, bad for chip damage
//   bomb     - drops in place, explodes after `fuse` frames, damages
//              anything within `radius`, and cracks 'B' walls

export const WEAPON_DEFS = {
  // ── Rook the Knight — the classic kit ──────────────────────────────
  sword: {
    kind: 'melee', label: 'Sword', icon: '🗡️', desc: 'Press Z to swing it.',
    cooldown: 26, active: 10, reach: 22, damage: 1,
    color: '#d8d8e4', hiltColor: '#5a3a1f', guardColor: '#ffd54a',
  },
  boomerang: {
    kind: 'return', label: 'Boomerang', icon: '🪃',
    desc: 'Press X to throw it — stuns enemies, comes right back.',
    cooldown: 40, speed: 6, range: 170, damage: 1, color: '#5bc8ff',
  },
  bow: {
    kind: 'straight', label: 'Bow', icon: '🏹', desc: 'Press C to fire an arrow.',
    cooldown: 22, speed: 7, damage: 2, color: '#c99a5b', size: 10,
  },
  bombs: {
    kind: 'bomb', label: 'Bombs', icon: '💣', desc: 'Press V to drop a bomb — cracks weak walls.',
    cooldown: 50, fuse: 50, radius: 70, damage: 3, color: '#444444',
  },

  // ── Vale the Rogue — fast and light ────────────────────────────────
  dagger: {
    kind: 'melee', label: 'Twin Daggers', icon: '🔪', desc: 'Press Z for a quick stab.',
    cooldown: 16, active: 6, reach: 16, damage: 1,
    color: '#e0c8ff', hiltColor: '#2a1a3a', guardColor: '#c86aff',
  },
  knives: {
    kind: 'straight', label: 'Throwing Knives', icon: '🔪',
    desc: "Press X to throw a knife — fast, but it won't come back.",
    cooldown: 16, speed: 8, damage: 1, color: '#cfd8ff', size: 8,
  },
  crossbow: {
    kind: 'straight', label: 'Hand Crossbow', icon: '🏹', desc: 'Press C to fire a heavy bolt.',
    cooldown: 34, speed: 9, damage: 3, color: '#8a5a3a', size: 11,
  },
  smokebomb: {
    kind: 'bomb', label: 'Smoke Bomb', icon: '💨',
    desc: 'Press V to drop a smoke bomb — quick fuse, cracks weak walls.',
    cooldown: 46, fuse: 36, radius: 60, damage: 2, color: '#aaaaaa',
  },

  // ── Ember the Pyromancer — big and slow ────────────────────────────
  flamerod: {
    kind: 'melee', label: 'Flame Rod', icon: '🔥', desc: 'Press Z to sweep a gout of flame.',
    cooldown: 30, active: 14, reach: 26, damage: 1,
    color: '#ff7a3a', hiltColor: '#6a1f16', guardColor: '#ffb84a',
  },
  fireorb: {
    kind: 'burst', label: 'Fire Orb', icon: '☄️',
    desc: 'Press X to lob a fire orb — it bursts into a fireball on impact, scorching everything nearby.',
    cooldown: 42, speed: 5.5, range: 160, radius: 52, damage: 2, color: '#ff5c2a',
  },
  scorchbolt: {
    kind: 'straight', label: 'Scorch Bolt', icon: '✨', desc: 'Press C to fire a scorch bolt.',
    cooldown: 20, speed: 7.5, damage: 2, color: '#ffb84a', size: 10,
  },
  firebomb: {
    kind: 'bomb', label: 'Firebomb', icon: '💣', desc: 'Press V to drop a firebomb — big blast, cracks weak walls.',
    cooldown: 55, fuse: 40, radius: 80, damage: 3, color: '#ff3a1f',
  },
}
