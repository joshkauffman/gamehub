// ── The hub ghost: jokes, hints and the odd coin ─────────────────────────
import { pkey } from './profiles.js'

export const JOKES = [
  'Why did the ghost go to the party? For the BOO-ffet! 👻',
  'What do you call a sleeping dinosaur? A dino-SNORE! 🦖',
  'Why can’t a bicycle stand up by itself? It’s two-tired! 🚲',
  'What do you call a fish with no eyes? A fsh! 🐟',
  'Why did the cookie go to the doctor? It felt crummy. 🍪',
  'What’s a ghost’s favourite fruit? BOO-berries! 🫐',
  'Why do bees have sticky hair? They use honeycombs! 🐝',
  'What do you call a pig that does karate? A pork chop! 🐷',
  'Why was the math book sad? It had too many problems. 📘',
  'What did one wall say to the other? I’ll meet you at the corner! 🧱',
  'How does a penguin build its house? Igloos it together! 🐧',
  'Why did the scarecrow win a prize? He was outstanding in his field! 🌾',
  'What do you call a dog magician? A labracadabrador! 🐶',
  'Why are skeletons so calm? Nothing gets under their skin! 💀',
  'What has ears but can’t hear? A cornfield! 🌽',
  'Why did the computer go to the doctor? It had a virus! 💻',
  'What do you call a dinosaur that’s a good sleeper? A Stega-snore-us! 🦕',
  'Why don’t eggs tell jokes? They’d crack each other up! 🥚',
  'What kind of tree fits in your hand? A palm tree! 🌴',
  'I tried to scare a game card once. It just got shuffled. 🃏',
]

const KEY = 'gamehub-ghost-clicks'
export function ghostClicks(pid) {
  try { return Number(localStorage.getItem(pkey(KEY, pid))) || 0 } catch { return 0 }
}
export function addGhostClick() {
  const n = ghostClicks() + 1
  try { localStorage.setItem(pkey(KEY), String(n)) } catch { /* storage unavailable */ }
  return n
}
