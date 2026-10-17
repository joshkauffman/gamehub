// ── The Obvious Zelda Knockoff — weapon definitions ────────────────────
// Every character maps the same four action slots (melee on Z, three
// item slots on X/C/V) onto one of these. `kind` drives engine.js's
// dispatch — the slot itself doesn't care what's plugged into it, and
// each kind is a genuinely different mechanic, not a reskin. Rook the
// Knight keeps the simple baseline version of every slot; Vale the
// Rogue and Ember the Pyromancer each rework all four slots into their
// own thing:
//   melee    - swings a short-lived hitbox in the facing direction,
//              once, on press
//   dash     - lunges the player forward a fixed distance over a few
//              frames, damaging (once each) anything it passes through
//              along the way — a mobility attack, not a static swing
//   cone     - ignites a hazard in front of the player that lingers for
//              `duration` frames, ticking damage every `tickInterval`
//              frames to anything standing in it — a channel, not an
//              instant hit
//   return   - flies out in a straight line, loops back once it
//              reaches `range`, can hit each enemy once on the way out
//              AND once on the way back (only one can be in flight) —
//              good single-target poke, no area effect
//   straight - flies in a straight line, stops and deals damage the
//              instant it touches one target, a wall, or leaves the
//              room — single hit, no return trip, no lingering effect
//   pierce   - flies in a straight line and keeps going through every
//              enemy it touches (each hit once), only stopping at a
//              wall or the room edge — rewards lining targets up
//   knockback - a straight-line bolt that stops and deals damage on
//              first contact same as `straight`, but also shoves
//              whatever it hit `knockback` pixels further away
//   dot      - flies like a straight bolt and stops on the first hit,
//              but sets its target burning: `burnTicks` extra hits of
//              `burnDamage` every `burnInterval` frames afterward
//   bomb     - drops in place, explodes after `fuse` frames, damages
//              anything within `radius`, and cracks 'B' walls; an
//              optional `burnZone` leaves a lingering tick-damage patch
//              behind after the blast
//   lob      - thrown instead of dropped: travels for `travel` frames
//              in the facing direction, lands, then still counts down
//              its own `fuse` before exploding — same blast/wall-crack
//              as a bomb, just staged in two beats instead of one
//   burst    - lobbed outward; detonates into an area-of-effect blast
//              (radius `radius`) the instant it touches a target, a
//              wall, or travels `range` — hits everything in range of
//              the blast once, good against groups, bad for chip damage

export const WEAPON_DEFS = {
  // ── Rook the Knight — the classic kit, unchanged baseline ─────────
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

  // ── Vale the Rogue — mobility and precision ────────────────────────
  dagger: {
    kind: 'dash', label: 'Twin Daggers', icon: '🔪',
    desc: 'Press Z to lunge forward in a stabbing dash — hits anything you pass through.',
    cooldown: 20, active: 8, dashFrames: 8, dashDistance: 58, reach: 14, damage: 1,
    color: '#e0c8ff', hiltColor: '#2a1a3a', guardColor: '#c86aff',
  },
  knives: {
    kind: 'pierce', label: 'Throwing Knives', icon: '🔪',
    desc: 'Press X to throw a knife — punches through every enemy in its path.',
    cooldown: 20, speed: 8, damage: 1, color: '#cfd8ff', size: 8,
  },
  crossbow: {
    kind: 'knockback', label: 'Hand Crossbow', icon: '🏹',
    desc: 'Press C to fire a heavy bolt that knocks its target back on a hit.',
    cooldown: 34, speed: 9, damage: 3, knockback: 46, color: '#8a5a3a', size: 11,
  },
  smokebomb: {
    kind: 'lob', label: 'Smoke Bomb', icon: '💨',
    desc: 'Press V to lob a smoke bomb — it travels, lands, then pops a beat later. Cracks weak walls.',
    cooldown: 46, speed: 6, travel: 16, fuse: 20, radius: 60, damage: 2, color: '#aaaaaa',
  },

  // ── Ember the Pyromancer — fire that lingers ───────────────────────
  flamerod: {
    kind: 'cone', label: 'Flame Rod', icon: '🔥',
    desc: 'Press Z to ignite a burning cone that scorches anything standing in it.',
    cooldown: 46, active: 14, reach: 30, width: 34,
    duration: 36, tickInterval: 9, tickDamage: 1,
    color: '#ff7a3a', hiltColor: '#6a1f16', guardColor: '#ffb84a',
  },
  fireorb: {
    kind: 'burst', label: 'Fire Orb', icon: '☄️',
    desc: 'Press X to lob a fire orb — it bursts into a fireball on impact, scorching everything nearby.',
    cooldown: 42, speed: 5.5, range: 160, radius: 52, damage: 2, color: '#ff5c2a',
  },
  scorchbolt: {
    kind: 'dot', label: 'Scorch Bolt', icon: '✨',
    desc: 'Press C to fire a bolt that sets its target ablaze, burning for a few seconds after.',
    cooldown: 20, speed: 7.5, damage: 1, color: '#ffb84a', size: 10,
    burnTicks: 4, burnDamage: 1, burnInterval: 24,
  },
  firebomb: {
    kind: 'bomb', label: 'Firebomb', icon: '💣',
    desc: 'Press V to drop a firebomb — big blast, then leaves the ground burning for a few seconds. Cracks weak walls.',
    cooldown: 55, fuse: 40, radius: 80, damage: 3, color: '#ff3a1f',
    burnZone: { duration: 90, tickDamage: 1, tickInterval: 20 },
  },
}
