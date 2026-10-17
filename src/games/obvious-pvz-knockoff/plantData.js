// ── The Obvious Plants vs. Zombies Knockoff — plant roster ────────────

export const PLANTS = {
  shooter: {
    id: 'shooter', name: 'Sprout Shooter', cost: 100, cooldown: 7.5, hp: 20,
    color: '#3fae3f', accent: '#2a7a2a', desc: 'Lobs a pea at the first zombie in its row.',
    fireRate: 85, damage: 2, projectile: 'pea',
  },
  sun: {
    id: 'sun', name: 'Sunbloom', cost: 50, cooldown: 7.5, hp: 15,
    color: '#ffd93d', accent: '#d8a81a', desc: 'Produces sun every few seconds.',
    sunRate: 420,
  },
  wall: {
    id: 'wall', name: 'Husk Guard', cost: 50, cooldown: 25, hp: 120,
    color: '#8a6a3a', accent: '#5a4420', desc: 'No attack — just a very large, very stubborn wall.',
  },
  twin: {
    id: 'twin', name: 'Twin Shooter', cost: 200, cooldown: 7.5, hp: 20,
    color: '#2a9a6a', accent: '#1a6a48', desc: 'Two peas per volley — twice the sprout, twice the shoot.',
    fireRate: 85, damage: 2, projectile: 'pea', twin: true,
  },
  frost: {
    id: 'frost', name: 'Frost Shooter', cost: 175, cooldown: 7.5, hp: 20,
    color: '#5cc8ff', accent: '#2a8ac8', desc: 'Its peas chill zombies, slowing them for a few seconds.',
    fireRate: 95, damage: 1, projectile: 'frostpea', slowFrames: 180,
  },
  mine: {
    id: 'mine', name: 'Boom Spud', cost: 25, cooldown: 12, hp: 10,
    color: '#a85a2a', accent: '#6a3414', desc: 'Arms itself after a moment, then erupts under the next zombie that steps close.',
    armFrames: 90, blastRadius: 70, blastDamage: 999,
  },
}

export const PLANT_ORDER = ['shooter', 'sun', 'wall', 'twin', 'frost', 'mine']
