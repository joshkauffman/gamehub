// ── The Obvious Guitar Hero Knockoff — audio engine ───────────────────
// A tiny synthesizer built on the Web Audio API: a kick (sine thump), a
// snare (filtered noise burst), a hi-hat (short bright noise), a simple
// bass tone, and a fret-hit "strum" sound. No audio files anywhere —
// every sound here is generated at runtime.

let ctx = null
let noiseBuffer = null

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    noiseBuffer = buildNoiseBuffer(ctx)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function buildNoiseBuffer(audioCtx) {
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 1, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function noiseSource() {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  return src
}

export function playKick(time) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(140, time)
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12)
  gain.gain.setValueAtTime(0.9, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
  osc.connect(gain).connect(ctx.destination)
  osc.start(time); osc.stop(time + 0.2)
}

export function playSnare(time) {
  const src = noiseSource()
  const filt = ctx.createBiquadFilter()
  filt.type = 'highpass'; filt.frequency.value = 1200
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.5, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
  src.connect(filt).connect(gain).connect(ctx.destination)
  src.start(time); src.stop(time + 0.15)
}

export function playHat(time) {
  const src = noiseSource()
  const filt = ctx.createBiquadFilter()
  filt.type = 'highpass'; filt.frequency.value = 7000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.18, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
  src.connect(filt).connect(gain).connect(ctx.destination)
  src.start(time); src.stop(time + 0.06)
}

export function playBass(time, freq) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, time)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(0.35, time + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
  osc.connect(gain).connect(ctx.destination)
  osc.start(time); osc.stop(time + 0.32)
}

const LANE_FREQS = [196, 247, 294, 330, 392] // G3, B3, D4, E4, G4 — a little strum chord per fret

export function playStrum(laneId) {
  if (!ctx) return
  const time = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(LANE_FREQS[laneId] || 260, time)
  gain.gain.setValueAtTime(0.14, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16)
  osc.connect(gain).connect(ctx.destination)
  osc.start(time); osc.stop(time + 0.2)
}

// Schedules an entire song's drum/bass events against the audio clock,
// starting at `startTime` (an audioContext.currentTime value). Web
// Audio's own scheduler keeps everything sample-accurate from here —
// no setTimeout/rAF involved for the actual sound.
export function scheduleSong(song, startTime) {
  for (const ev of song.drumEvents) {
    const t = startTime + ev.time
    if (ev.type === 'kick') playKick(t)
    else if (ev.type === 'snare') playSnare(t)
    else if (ev.type === 'hat') playHat(t)
  }
  for (const ev of song.bassEvents) playBass(startTime + ev.time, ev.freq)
}
