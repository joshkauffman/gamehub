// ── Extra themes: shop presets and your own custom theme ─────────────────
// The four built-in themes live in Home.module.css. These are built from a
// small config instead (light/dark, a few colours, a background pattern and
// some floating emojis) and applied as inline CSS variables.
import { pkey } from './profiles.js'

export const PRESETS = {
  ocean: { name: '🌊 Ocean', light: false, bg: '#031627', accent: '#29b6f6', glowA: '#0077ff', glowB: '#00e5c0', glowC: '#3d5afe', pattern: 'dots', floaters: ['🐟', '🐠', '🫧', '🐡'] },
  candy: { name: '🍭 Candy', light: true, bg: '#fff0f7', accent: '#e8338a', glowA: '#ffb3d9', glowB: '#b3e5ff', glowC: '#fff3a3', pattern: 'stripes', floaters: ['🍬', '🍭', '🧁', '🍩'] },
  jungle: { name: '🌴 Jungle', light: false, bg: '#06140b', accent: '#4cd964', glowA: '#1faa59', glowB: '#ffd23f', glowC: '#0d7a4a', pattern: 'dots', floaters: ['🦜', '🍃', '🦋', '🌿'] },
  galaxy: { name: '🪐 Galaxy', light: false, bg: '#07021a', accent: '#b388ff', glowA: '#6a1bff', glowB: '#ff3dc8', glowC: '#2979ff', pattern: 'stars', floaters: ['⭐', '🪐', '✨', '☄️'] },
}

export const DEFAULT_CUSTOM = { name: '🎨 My theme', light: false, bg: '#120a22', accent: '#ff7a59', glowA: '#ff3d77', glowB: '#ffc400', glowC: '#00c2ff', pattern: 'dots', floaters: ['⭐'] }
export const FLOATER_CHOICES = ['', '⭐', '❤️', '🦋', '🎈', '🐟', '👾', '🍕', '⚽', '🌸', '🦖', '🐝', '❄️', '👻', '🚀', '🌈']
export const PATTERNS = [
  { id: 'dots', label: '• Dots' },
  { id: 'grid', label: '# Grid' },
  { id: 'stripes', label: '/ Stripes' },
  { id: 'stars', label: '✦ Stars' },
  { id: 'none', label: '○ Plain' },
]

const KEY = 'gamehub-custom-theme'
export function loadCustom() {
  try { return JSON.parse(localStorage.getItem(pkey(KEY))) } catch { return null }
}
export function saveCustom(cfg) {
  try { localStorage.setItem(pkey(KEY), JSON.stringify(cfg)) } catch { /* storage unavailable */ }
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// The full set of theme tokens (see the top of Home.module.css) for a config.
export function themeVars(cfg) {
  const base = cfg.light
    ? {
      '--text': '#1d1838', '--text2': '#4a4670', '--muted': '#5a5680', '--faint': '#7d78a0',
      '--surface': 'rgba(255, 255, 255, 0.92)', '--surface2': 'rgba(255, 255, 255, 0.75)',
      '--line': rgba(cfg.accent, 0.2), '--chip': rgba(cfg.accent, 0.08), '--glass': 'rgba(255, 255, 255, 0.8)',
      '--dots': rgba(cfg.accent, 0.12), '--blobOp': 0.55, '--artSat': '75%', '--artL1': '64%', '--artL2': '50%', '--pillText': '#1d1838',
    }
    : {
      '--text': '#f4f2ff', '--text2': '#c4c0e0', '--muted': '#aaa6c8', '--faint': '#8f8bb0',
      '--surface': 'rgba(255, 255, 255, 0.06)', '--surface2': 'rgba(255, 255, 255, 0.025)',
      '--line': rgba(cfg.accent, 0.22), '--chip': rgba(cfg.accent, 0.09), '--glass': rgba(cfg.bg, 0.8),
      '--dots': rgba(cfg.accent, 0.08), '--blobOp': 0.26, '--artSat': '65%', '--artL1': '42%', '--artL2': '28%', '--pillText': '#fff',
    }
  return {
    ...base,
    '--bg0': cfg.bg,
    '--accent': cfg.accent,
    '--glow': rgba(cfg.accent, 0.22),
    '--blobA': cfg.glowA, '--blobB': cfg.glowB, '--blobC': cfg.glowC,
    '--logo': `linear-gradient(120deg, ${cfg.accent} 0%, ${cfg.glowA} 40%, ${cfg.glowB} 75%, ${cfg.glowC} 100%)`,
    '--logoGlow': rgba(cfg.accent, 0.45),
  }
}
