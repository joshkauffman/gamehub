// ── The Totally Scary Horror Game — tiny synthesized sound effects ─────
// Web Audio only, no files (same rule as src/horrorAudio.js). Every
// effect is a short one-shot; nothing loops.

let ctx = null
function getCtx() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

function noiseBuffer(c, secs) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function envGain(c, peak, attack, release, at = c.currentTime) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release)
  g.connect(c.destination)
  return g
}

function tone(type, freq, peak, attack, release, at, glideTo) {
  const c = getCtx(); if (!c) return
  const t0 = at ?? c.currentTime
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + attack + release)
  o.connect(envGain(c, peak, attack, release, t0))
  o.start(t0); o.stop(t0 + attack + release + 0.05)
}

export function unlockAudio() { getCtx() }

// A breathy two-syllable whisper.
export function psst() {
  const c = getCtx(); if (!c) return
  ;[0, 0.22].forEach((dt, i) => {
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, 0.3)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = i ? 5200 : 3800; bp.Q.value = 2.5
    src.connect(bp)
    bp.connect(envGain(c, 0.35, 0.02, i ? 0.22 : 0.12, c.currentTime + dt))
    src.start(c.currentTime + dt)
  })
}

// Low rumble that swells — something big is coming down the hall.
export function rumble(secs = 4.5) {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, secs + 0.5)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 180
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.5, c.currentTime + secs)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + secs + 0.5)
  src.connect(lp); lp.connect(g); g.connect(c.destination)
  src.start()
}

export function whoosh() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.8)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'; bp.Q.value = 1.2
  bp.frequency.setValueAtTime(300, c.currentTime)
  bp.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.4)
  bp.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.8)
  src.connect(bp); bp.connect(envGain(c, 0.6, 0.15, 0.6))
  src.start()
}

export function turnAround() {
  tone('square', 110, 0.12, 0.02, 0.5)
  tone('square', 82, 0.12, 0.02, 0.6, (getCtx()?.currentTime ?? 0) + 0.35)
}

// Wah wah wahhh. Getting "caught" is never scary, just a little sad.
export function sadTrombone() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  ;[[311, 0], [294, 0.32], [277, 0.64]].forEach(([f, dt]) => tone('sawtooth', f, 0.08, 0.03, 0.28, t + dt))
  tone('sawtooth', 262, 0.08, 0.03, 1.0, t + 0.96, 240)
}

export function drawer() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.25)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 900
  src.connect(lp); lp.connect(envGain(c, 0.25, 0.01, 0.2))
  src.start()
}

export function coin() {
  const c = getCtx(); if (!c) return
  tone('triangle', 1320, 0.12, 0.005, 0.12)
  tone('triangle', 1760, 0.12, 0.005, 0.25, c.currentTime + 0.07)
}

export function chime() {
  const c = getCtx(); if (!c) return
  ;[660, 880, 1100].forEach((f, i) => tone('sine', f, 0.1, 0.01, 0.4, c.currentTime + i * 0.08))
}

// Steam escaping a pipe.
export function hiss(secs = 2.8) {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, secs + 2)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 3000
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + secs)
  g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + secs + 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + secs + 1.8)
  src.connect(hp); hp.connect(g); g.connect(c.destination)
  src.start()
}

// A tinkly little music-box tune (her solo).
export function musicBox() {
  const c = getCtx(); if (!c) return
  const notes = [1047, 1319, 1568, 1319, 1175, 1397, 1760, 1397, 1047, 1319, 1568, 2093]
  notes.forEach((f, i) => tone('sine', f, 0.07, 0.005, 0.35, c.currentTime + i * 0.28))
}

// HONK HONK (a bicycle horn on a brakeless minecart).
export function honk() {
  const c = getCtx(); if (!c) return
  ;[0, 0.32].forEach(dt => {
    tone('square', 420, 0.09, 0.01, 0.18, c.currentTime + dt, 380)
    tone('square', 525, 0.06, 0.01, 0.18, c.currentTime + dt, 470)
  })
}

export function pageFlip() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.2)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = 2500
  src.connect(bp); bp.connect(envGain(c, 0.15, 0.01, 0.15))
  src.start()
}

export function squeak() {
  const c = getCtx(); if (!c) return
  ;[0, 0.12, 0.24].forEach(dt => tone('sine', 2400, 0.08, 0.005, 0.07, c.currentTime + dt, 3200))
}

export function pop() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.15)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 1800
  src.connect(lp); lp.connect(envGain(c, 0.7, 0.002, 0.12))
  src.start()
}

export function wind() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 4)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'; bp.Q.value = 3
  bp.frequency.setValueAtTime(400, c.currentTime)
  bp.frequency.linearRampToValueAtTime(900, c.currentTime + 2)
  bp.frequency.linearRampToValueAtTime(500, c.currentTime + 4)
  src.connect(bp); bp.connect(envGain(c, 0.3, 0.8, 3))
  src.start()
}

// A wooden creak (the secret shelf); a big one when it finally swings open.
export function creak(big = false) {
  const c = getCtx(); if (!c) return
  tone('sawtooth', big ? 90 : 140, 0.06, 0.05, big ? 1.2 : 0.3, c.currentTime, big ? 60 : 110)
}

// A deep, rattling ROAR (the Harvester).
export function roar() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const o = c.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 1.4)
  const lfo = c.createOscillator(); lfo.frequency.value = 28
  const lg = c.createGain(); lg.gain.value = 25
  lfo.connect(lg); lg.connect(o.frequency)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700
  o.connect(lp); lp.connect(envGain(c, 0.35, 0.08, 1.4, t))
  o.start(t); lfo.start(t); o.stop(t + 1.6); lfo.stop(t + 1.6)
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 1.5)
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.8
  src.connect(bp); bp.connect(envGain(c, 0.3, 0.1, 1.3, t)); src.start(t)
}

export function snip() {
  const c = getCtx(); if (!c) return
  ;[0, 0.35, 0.7].forEach(dt => tone('square', 2600, 0.05, 0.002, 0.05, c.currentTime + dt, 1800))
}

export function bell() {
  const c = getCtx(); if (!c) return
  ;[523, 1046, 1568, 659].forEach((f, i) => tone('sine', f, 0.12 / (i + 1), 0.005, 3.5, c.currentTime))
}

export function chomp() {
  const c = getCtx(); if (!c) return
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 0.12)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
  src.connect(lp); lp.connect(envGain(c, 0.5, 0.005, 0.1))
  src.start()
}

export function gulp() {
  const c = getCtx(); if (!c) return
  tone('sine', 220, 0.25, 0.01, 0.18, c.currentTime, 90)
}

export function burp() {
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const o = c.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(70, t + 1.1)
  const lfo = c.createOscillator(); lfo.frequency.value = 22
  const lg = c.createGain(); lg.gain.value = 18
  lfo.connect(lg); lg.connect(o.frequency)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500
  o.connect(lp); lp.connect(envGain(c, 0.4, 0.05, 1.1, t))
  o.start(t); lfo.start(t); o.stop(t + 1.3); lfo.stop(t + 1.3)
}
