// ── Hub soundtrack + little UI sounds ─────────────────────────────────────
// Web Audio only, no files. Each theme has its own tune. Music only plays on
// the home page and only after you've turned it on (browsers need a click
// before any audio can start anyway).

const KEY = 'gamehub-sound'
export function loadSound() {
  try { return { music: false, sfx: true, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return { music: false, sfx: true } }
}
export function saveSound(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

let ctx = null
function getCtx() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

function note(c, out, { type = 'triangle', freq, at, dur, peak = 0.2, glide }) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g); g.connect(out)
  o.start(at); o.stop(at + dur + 0.05)
}

// Chord roots (MIDI) and chord shapes; each bar = one chord, 8 eighth notes.
const TUNES = {
  midnight: { bpm: 84, lead: 'triangle', bass: 'sine', chords: [[60, 'maj7'], [57, 'm7'], [53, 'maj7'], [55, '7']], pattern: [0, 2, 1, 3, 2, 1, 3, 2] },
  daylight: { bpm: 112, lead: 'triangle', bass: 'triangle', chords: [[60, 'maj'], [67, 'maj'], [57, 'min'], [65, 'maj']], pattern: [0, 1, 2, 1, 3, 2, 1, 2] },
  arcade: { bpm: 132, lead: 'square', bass: 'square', chords: [[57, 'min'], [53, 'maj'], [60, 'maj'], [55, 'maj']], pattern: [0, 2, 3, 2, 1, 2, 3, 1] },
  spooky: { bpm: 72, lead: 'sine', bass: 'sawtooth', chords: [[57, 'min'], [53, 'maj'], [52, '7'], [57, 'min']], pattern: [0, -1, 2, -1, 1, 3, -1, 2] },
}
const SHAPES = { maj: [0, 4, 7, 12], min: [0, 3, 7, 12], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10] }

let music = null // { stop }

export function startMusic(theme, speed = 1) {
  stopMusic()
  const c = getCtx(); if (!c) return
  const tune = TUNES[theme] || TUNES.midnight
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, c.currentTime)
  out.gain.exponentialRampToValueAtTime(tune.lead === 'square' ? 0.035 : 0.07, c.currentTime + 1.5)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = theme === 'arcade' ? 3200 : 2200
  out.connect(lp); lp.connect(c.destination)
  const step = 60 / tune.bpm / 2 / speed
  let i = 0
  let t = c.currentTime + 0.1
  const timer = setInterval(() => {
    while (t < c.currentTime + 0.4) {
      const bar = Math.floor(i / 8) % tune.chords.length
      const [root, shape] = tune.chords[bar]
      const p = tune.pattern[i % 8]
      if (p >= 0) note(c, out, { type: tune.lead, freq: midi(root + 12 + SHAPES[shape][p]), at: t, dur: step * 1.8, peak: 0.25 })
      if (i % 8 === 0) note(c, out, { type: tune.bass, freq: midi(root - 12), at: t, dur: step * 7.5, peak: tune.bass === 'sawtooth' ? 0.12 : 0.3 })
      if (theme === 'spooky' && i % 32 === 28) note(c, out, { type: 'sine', freq: midi(root + 24), glide: midi(root + 19), at: t, dur: step * 6, peak: 0.12 })
      if (theme === 'arcade' && i % 2 === 1) note(c, out, { type: 'square', freq: 90, glide: 40, at: t, dur: 0.05, peak: 0.15 })
      t += step
      i++
    }
  }, 100)
  music = {
    stop() {
      clearInterval(timer)
      const now = c.currentTime
      out.gain.cancelScheduledValues(now)
      out.gain.setValueAtTime(out.gain.value, now)
      out.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      setTimeout(() => out.disconnect(), 600)
    },
  }
}
export function stopMusic() { music?.stop(); music = null }

// ── UI sounds ── each checks the sfx setting itself.
const sfxOn = () => loadSound().sfx
let lastTick = 0
export function sfx(kind) {
  if (!sfxOn()) return
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const out = c.destination
  switch (kind) {
    case 'hover':
      if (t - lastTick < 0.06) return
      lastTick = t
      note(c, out, { type: 'sine', freq: 1400, at: t, dur: 0.05, peak: 0.025 })
      break
    case 'click': note(c, out, { type: 'triangle', freq: 660, glide: 990, at: t, dur: 0.09, peak: 0.08 }); break
    case 'tick': note(c, out, { type: 'square', freq: 1800, at: t, dur: 0.03, peak: 0.03 }); break
    case 'heart': note(c, out, { type: 'sine', freq: 880, at: t, dur: 0.1, peak: 0.08 }); note(c, out, { type: 'sine', freq: 1320, at: t + 0.08, dur: 0.14, peak: 0.08 }); break
    case 'unheart': note(c, out, { type: 'sine', freq: 660, glide: 440, at: t, dur: 0.15, peak: 0.06 }); break
    case 'win': [0, 4, 7, 12].forEach((n, k) => note(c, out, { type: 'triangle', freq: midi(72 + n), at: t + k * 0.09, dur: 0.3, peak: 0.1 })); break
    case 'secret': [0, 7, 12, 16, 19, 24].forEach((n, k) => note(c, out, { type: 'sine', freq: midi(76 + n), at: t + k * 0.07, dur: 0.4, peak: 0.07 })); break
    case 'boom': note(c, out, { type: 'sawtooth', freq: 120, glide: 40, at: t, dur: 0.35, peak: 0.12 }); break
    default: break
  }
}

// Browsers only let audio start from a click/tap; call this from one.
export function unlockAudio() { getCtx() }
