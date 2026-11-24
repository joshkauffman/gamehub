// ── Hub pet ──────────────────────────────────────────────────────────────
// Each player gets an egg. It grows from playing games (minutes played and
// games opened, counted from the day it was laid) plus treats bought with
// coins. Happy if you've played today, sleepy if you haven't.
import { pkey } from './profiles.js'
import { loadStats, dayKey } from './playStats.js'

export const SPECIES = {
  bird: { name: 'Birdy', stages: ['🐣', '🐥', '🐤', '🦜', '🦚'] },
  dino: { name: 'Dino', stages: ['🦎', '🐊', '🦕', '🦖', '🐉'] },
  bug: { name: 'Buggy', stages: ['🐛', '🐌', '🐞', '🐝', '🦋'] },
  sea: { name: 'Splash', stages: ['🦐', '🐟', '🐠', '🐬', '🐳'] },
  cat: { name: 'Whiskers', stages: ['🐱', '🐈', '🐆', '🐯', '🦁'] },
}
// XP needed to reach each stage after hatching (index = stage; 0 is the egg).
export const STAGE_XP = [0, 6, 30, 80, 160, 300]
export const STAGE_NAMES = ['Egg', 'Baby', 'Little', 'Big', 'Grown-up', 'Legendary']

const KEY = 'gamehub-pet'
const totals = (s) => Object.values(s.games).reduce((a, g) => ({ seconds: a.seconds + g.seconds, plays: a.plays + g.plays }), { seconds: 0, plays: 0 })

export function loadPet() {
  try {
    const p = JSON.parse(localStorage.getItem(pkey(KEY)))
    if (p?.species) return p
  } catch { /* storage unavailable */ }
  // A brand-new egg; it only counts play from now on.
  const kinds = Object.keys(SPECIES)
  const pet = { species: kinds[Math.floor(Math.random() * kinds.length)], name: '', laid: Date.now(), start: totals(loadStats()), bonus: 0, fed: {} }
  savePet(pet)
  return pet
}
// Another player's pet, without laying an egg for them.
export function peekPet(pid) {
  try { const p = JSON.parse(localStorage.getItem(pkey(KEY, pid))); return p?.species ? p : null } catch { return null }
}
export function savePet(p) {
  try { localStorage.setItem(pkey(KEY), JSON.stringify(p)) } catch { /* storage unavailable */ }
}

export function petInfo(pet, pid) {
  const stats = loadStats(pid)
  const now = totals(stats)
  const xp = Math.max(0, (now.seconds - pet.start.seconds) / 60 + (now.plays - pet.start.plays) * 3 + pet.bonus)
  let stage = 0
  while (stage < 5 && xp >= STAGE_XP[stage + 1]) stage++
  const sp = SPECIES[pet.species]
  const emoji = stage === 0 ? '🥚' : sp.stages[stage - 1]
  const next = stage < 5 ? STAGE_XP[stage + 1] : null
  const prev = STAGE_XP[stage]
  const today = dayKey()
  const playedToday = stats.days.includes(today)
  const lastDay = stats.days[stats.days.length - 1]
  const daysAway = lastDay ? Math.round((Date.parse(today) - Date.parse(lastDay)) / 86400000) : 0
  const fedToday = pet.fed?.[today] || 0
  const mood = stage === 0 ? 'egg' : playedToday ? (fedToday ? 'full' : 'happy') : daysAway >= 3 ? 'lonely' : 'sleepy'
  return {
    xp, stage, emoji, next, prev,
    pct: next ? Math.round(((xp - prev) / (next - prev)) * 100) : 100,
    level: 1 + Math.floor(xp / 20),
    name: pet.name || (stage === 0 ? 'Mystery egg' : sp.name),
    mood, fedToday,
  }
}

export const TREAT_PRICE = 3
export const MAX_TREATS = 3
export function feed(pet) {
  const today = dayKey()
  const next = { ...pet, bonus: pet.bonus + 4, fed: { [today]: (pet.fed?.[today] || 0) + 1 } }
  savePet(next)
  return next
}

export const PET_LINES = {
  egg: ['*wobble*', '*tap tap*', '…', '*crack?*'],
  happy: ['Yay, games!', 'Play another one!', 'I like this one!', 'Wheee!', 'You’re the best!', 'Can I watch?'],
  full: ['Yum! 😋', 'So full…', 'Thanks for the treat!'],
  sleepy: ['💤', 'zzz…', '*yawn* play something?'],
  lonely: ['I missed you!', 'Where did you go?', 'Play with me?'],
}
