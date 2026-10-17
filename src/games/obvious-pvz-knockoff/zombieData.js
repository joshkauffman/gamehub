// ── The Obvious Plants vs. Zombies Knockoff — zombie roster ───────────

export const ZOMBIES = {
  walker: { id: 'walker', name: 'Shuffler', hp: 10, speed: 0.28, damage: 0.4, color: '#8a9a7a', headColor: '#c8b89a' },
  cone: { id: 'cone', name: 'Cone Head', hp: 20, speed: 0.26, damage: 0.4, color: '#8a9a7a', headColor: '#c8b89a', hat: 'cone' },
  bucket: { id: 'bucket', name: 'Bucket Head', hp: 35, speed: 0.24, damage: 0.4, color: '#8a9a7a', headColor: '#c8b89a', hat: 'bucket' },
  runner: { id: 'runner', name: 'Sprinter', hp: 8, speed: 0.6, damage: 0.4, color: '#a86a6a', headColor: '#d8a890' },
}

// Each wave: a list of { type, delay } spawns (delay = frames after the
// wave starts). Waves get bigger and meaner as the game goes on.
export function buildWave(waveIndex) {
  const n = waveIndex + 1
  const spawns = []
  let t = 60
  const count = 4 + n * 2
  for (let i = 0; i < count; i++) {
    let type = 'walker'
    const roll = Math.random()
    if (n >= 2 && roll < 0.08 * n) type = 'runner'
    else if (n >= 2 && roll < 0.18 * n) type = 'bucket'
    else if (n >= 1 && roll < 0.35 * n) type = 'cone'
    spawns.push({ type, delay: t })
    t += 70 - Math.min(40, n * 4) + Math.random() * 40
  }
  // Every 3rd wave ends with a little rush.
  if (n % 3 === 0) {
    for (let i = 0; i < 3; i++) { spawns.push({ type: 'cone', delay: t }); t += 20 }
  }
  return spawns
}
