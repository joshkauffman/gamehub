// ── Capeville — hero customization options ────────────────────────────

export const POWERS = [
  { id: 'flight', name: 'Flight', icon: '🕊️', desc: 'Hold the ability button to lift off and soar clean over every building and gap in the city. Get in close and tap the button to throw a punch, same as anyone.' },
  { id: 'speed', name: 'Super Speed', icon: '⚡', desc: 'Already runs faster than traffic — tap the ability button for a sonic dash that slams into every villain in your path.' },
  { id: 'strength', name: 'Super Strength', icon: '💪', desc: 'Your punches hit harder than anyone else’s. Walk up to a car or dumpster and tap the ability button to hoist it overhead, then tap again to hurl it for an instant knockout.' },
  { id: 'blast', name: 'Energy Blast', icon: '✨', desc: 'Fires bolts of elemental energy in whichever direction you’re facing — or get in close and tap the button to punch instead.' },
]

export const ELEMENTS = [
  { id: 'fire', name: 'Fire', color: '#ff5c2a', glow: '#ffb84a' },
  { id: 'ice', name: 'Ice', color: '#5cc8ff', glow: '#bfeeff' },
  { id: 'lightning', name: 'Lightning', color: '#ffe94a', glow: '#fff6b0' },
  { id: 'cosmic', name: 'Cosmic', color: '#c86aff', glow: '#eac8ff' },
]

export const EMBLEMS = ['star', 'bolt', 'shield', 'flame', 'paw', 'atom', 'wings', 'spiral']

export const MASKS = [
  { id: 'none', name: 'No Mask' },
  { id: 'domino', name: 'Domino Mask' },
  { id: 'full', name: 'Full Cowl' },
]

export const PRIMARY_COLORS = [
  '#d8303a', '#2a5fd8', '#1f9a4a', '#ffb81a', '#7a3fc8', '#1f1f2a', '#e8e8f0', '#d84a9a',
]
export const ACCENT_COLORS = [
  '#ffd93d', '#ffffff', '#1a1a2a', '#5cc8ff', '#ff8a3d', '#2a2a2a', '#d8303a', '#5cd85c',
]
export const CAPE_COLORS = [
  '#ffd93d', '#ffffff', '#1a1a2a', '#5cc8ff', '#ff8a3d', '#2a2a2a', '#d8303a', '#5cd85c',
]

export const SKIN_TONES = ['#ffdbb0', '#f2c89a', '#d8a46a', '#aa7142', '#7a4a28', '#4a2f1c']

export const HAIR_STYLES = [
  { id: 'bald', name: 'Bald' },
  { id: 'short', name: 'Short' },
  { id: 'long', name: 'Long' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'ponytail', name: 'Ponytail' },
]
export const HAIR_COLORS = [
  '#1a1a1a', '#3a2412', '#6a3a1a', '#a8742a', '#e8c878', '#e8e8e8', '#d8303a', '#5cc8ff', '#c86aff',
]

export const EYE_COLORS = ['#1a1a1a', '#2a5fd8', '#1f9a4a', '#7a3fc8', '#ffb81a', '#d8303a']

export function freshHero() {
  return {
    name: '',
    catchphrase: '',
    primaryColor: PRIMARY_COLORS[0],
    accentColor: ACCENT_COLORS[0],
    capeColor: CAPE_COLORS[0],
    emblem: 'star',
    cape: true,
    mask: 'domino',
    skinTone: SKIN_TONES[1],
    hairStyle: 'short',
    hairColor: HAIR_COLORS[0],
    eyeColor: EYE_COLORS[0],
    powerId: 'flight',
    elementId: 'fire',
  }
}
