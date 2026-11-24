// ── Game ideas + home-made mini-games ────────────────────────────────────
// Shared by every player in this browser (each one remembers who made it).

function read(key) { try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ } return v }

const IDEAS = 'gamehub-ideas-v1'
export const loadIdeas = () => read(IDEAS)
export const saveIdea = (idea) => write(IDEAS, [idea, ...loadIdeas().filter(i => i.id !== idea.id)])
export const deleteIdea = (id) => write(IDEAS, loadIdeas().filter(i => i.id !== id))
export function toggleLike(id, pid) {
  return write(IDEAS, loadIdeas().map(i => (i.id !== id ? i : { ...i, likes: i.likes?.includes(pid) ? i.likes.filter(x => x !== pid) : [...(i.likes || []), pid] })))
}

export const IDEA_KINDS = ['🏃 Run & jump', '⚔️ Fighting', '🧭 Exploring', '🧩 Puzzles', '🏎️ Racing', '🧱 Building', '💎 Collecting', '👻 Scary', '⚽ Sports', '🐾 Pets & animals']
export const IDEA_LOOKS = ['🟦 2D', '🧊 3D', '👾 Pixel', '🎨 Cartoon', '🌑 Dark & spooky', '🌈 Bright & colourful']
export const IDEA_PLAYERS = ['🙂 1 player', '👥 2 players', '🌐 Online with friends']

const GAMES = 'gamehub-minigames-v1'
export const loadMiniGames = () => read(GAMES)
export const saveMiniGame = (g) => write(GAMES, [g, ...loadMiniGames().filter(x => x.id !== g.id)])
export const deleteMiniGame = (id) => write(GAMES, loadMiniGames().filter(x => x.id !== id))
export function recordMiniBest(id, pid, score) {
  return write(GAMES, loadMiniGames().map(g => (g.id !== id || (g.best?.[pid] || 0) >= score ? g : { ...g, best: { ...g.best, [pid]: score } })))
}

export const HEROES = ['🧺', '🐸', '🐱', '🦖', '🚀', '🐧', '🦄', '🤖', '🐵', '🐢', '🦈', '🧙', '🐝', '🛸', '🐶', '🐉']
export const GOODIES = ['⭐', '🍕', '🍎', '💎', '🪙', '🍪', '🍩', '🐟', '🍌', '🌟', '❤️', '🧁', '🎁', '🍓', '🦴', '🥕']
export const BADDIES = ['💣', '☄️', '🌵', '👻', '🦠', '⚡', '🔥', '🪨', '🕷️', '🐍', '💀', '🧟', '🌪️', '🦂']
export const BACKGROUNDS = {
  space: { name: '🌌 Space', css: 'radial-gradient(circle at 30% 20%, #3a1d7a, #0a0620 70%)', dark: true },
  ocean: { name: '🌊 Ocean', css: 'linear-gradient(180deg, #4fc3f7, #01579b)', dark: true },
  forest: { name: '🌲 Forest', css: 'linear-gradient(180deg, #a5d6a7, #2e7d32)', dark: false },
  candy: { name: '🍭 Candy land', css: 'linear-gradient(180deg, #ffd1e8, #ffb3d9 60%, #c5a3ff)', dark: false },
  desert: { name: '🏜️ Desert', css: 'linear-gradient(180deg, #ffe0a3, #e09a4b)', dark: false },
  night: { name: '🌙 Spooky night', css: 'radial-gradient(circle at 70% 20%, #3d2a5c, #07040f 70%)', dark: true },
}
export const SPEEDS = { slow: { name: '🐢 Slow', k: 0.75 }, medium: { name: '🐇 Medium', k: 1 }, fast: { name: '⚡ Fast', k: 1.35 } }
