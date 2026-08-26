// ── Horror mode audio ──────────────────────────────────────────────────
// Everything here is synthesized with the Web Audio API — no audio files,
// same "procedural, no assets" rule the rest of the hub follows. A low
// dissonant drone plays while horror mode is on; playStinger() fires a
// short noise-burst-plus-shriek for jump scares.

let ctx = null
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Two slightly-detuned saw oscillators through a slow-sweeping lowpass
// filter — the detune beats against itself for an uneasy, droning hum.
// Returns a stop() that fades out and tears down its nodes.
export function startDrone() {
  const c = getCtx()
  const master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)
  master.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.5)

  const oscA = c.createOscillator()
  oscA.type = 'sawtooth'
  oscA.frequency.value = 55
  const oscB = c.createOscillator()
  oscB.type = 'sawtooth'
  oscB.frequency.value = 58.5

  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 260

  const lfo = c.createOscillator()
  lfo.frequency.value = 0.13
  const lfoGain = c.createGain()
  lfoGain.gain.value = 90
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)

  oscA.connect(filter)
  oscB.connect(filter)
  filter.connect(master)

  oscA.start()
  oscB.start()
  lfo.start()

  return function stop() {
    const now = c.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(0, now + 0.5)
    setTimeout(() => {
      oscA.stop(); oscB.stop(); lfo.stop()
      oscA.disconnect(); oscB.disconnect(); filter.disconnect()
      lfo.disconnect(); lfoGain.disconnect(); master.disconnect()
    }, 600)
  }
}

// A jump-scare stinger: a fast-decaying noise burst plus a pitch-dropping
// shriek, both gone within half a second.
export function playStinger() {
  const c = getCtx()
  const now = c.currentTime

  const bufferSize = Math.floor(c.sampleRate * 0.3)
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  const noise = c.createBufferSource()
  noise.buffer = buffer
  const noiseGain = c.createGain()
  noiseGain.gain.value = 0.25
  noise.connect(noiseGain)
  noiseGain.connect(c.destination)
  noise.start(now)

  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(1200, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.35)
  const oscGain = c.createGain()
  oscGain.gain.setValueAtTime(0.22, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  osc.connect(oscGain)
  oscGain.connect(c.destination)
  osc.start(now)
  osc.stop(now + 0.4)
}
