// ── The Obvious Mario Knockoff — selectable characters ────────────────
// `body` picks which draw routine in render.js handles the shape:
//   'plumber'  — cap + overalls + mustache (Mario/Luigi/Wario/Waluigi)
//   'royal'    — dress + crown, no mustache (Peach/Daisy/Rosalina)
//   'mushroom' — big spotted cap dominates the head (Toad/Toadette)
//   'yoshi'    — dinosaur torso + snout + saddle, no cap/overalls at all
// Everyone still shares the same hitbox/physics — this is cosmetic only.

export const CHARACTERS = [
  { id: 'red', name: 'The Original (Not Him)', body: 'plumber',
    cap: '#d43a2f', overall: '#2f6fd0', overallDark: '#1f4a90', hair: '#4a2f18' },
  { id: 'green', name: 'His Taller Cousin', body: 'plumber',
    cap: '#2f9e4a', overall: '#1c355c', overallDark: '#122442', hair: '#3a2a10' },
  { id: 'yellow', name: 'Cousin With A Van', body: 'plumber',
    cap: '#f0d020', overall: '#8a3fd0', overallDark: '#5c2a90', hair: '#241a10', bodyScale: 1.25, headScale: 1.15 },
  { id: 'purple', name: 'The Weird Uncle', body: 'plumber',
    cap: '#8a3fd0', overall: '#241a2e', overallDark: '#140f1a', hair: '#1a1008', bodyScale: 0.68, headScale: 0.95 },
  { id: 'peach', name: 'Definitely Not Royalty', body: 'royal',
    dress: '#ffb6d9', dressDark: '#ff8fc4', hair: '#f5d34d', crown: '#ffe066' },
  { id: 'daisy', name: 'The Other One (Orange)', body: 'royal',
    dress: '#ff9d3d', dressDark: '#e07a1f', hair: '#f5a623', crown: '#fff2b0' },
  { id: 'rosalina', name: 'Cosmic Chaperone', body: 'royal',
    dress: '#4a5fc9', dressDark: '#33418f', hair: '#e8ecff', crown: '#ffffff' },
  { id: 'toad', name: 'Guy With A Big Hat', body: 'mushroom',
    cap: '#e8503c', spots: '#ffffff', vest: '#3a6bd0', skin: '#f2c299' },
  { id: 'toadette', name: 'Same Guy, Pigtails', body: 'mushroom',
    cap: '#ff6fae', spots: '#ffffff', vest: '#e8503c', skin: '#f2c299', pigtails: true },
  { id: 'yoshi', name: 'Green Dinosaur Friend', body: 'yoshi',
    main: '#3fae4a', belly: '#f5e6b0', saddle: '#e8503c',
    tagline: 'Easy mode: tongue-eats enemies at range, walks munchers off',
    tongue: true, munchersSafe: true },
]
