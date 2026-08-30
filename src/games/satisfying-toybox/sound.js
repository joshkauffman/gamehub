// Tiny shared WebAudio synth for satisfying blips/pops/squishes — no
// external audio files; every toy wants a slightly different quick sound
// and none of them justify shipping an asset for it.
let ctx = null
function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq, duration, type, peakGain) {
  const ac = getCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55), ac.currentTime + duration)
  gain.gain.setValueAtTime(peakGain, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + duration)
}

export function playPop(freq = 500, duration = 0.09) { tone(freq, duration, 'sine', 0.25) }
export function playSquish(freq = 220, duration = 0.16) { tone(freq, duration, 'triangle', 0.2) }
export function playClick(freq = 700, duration = 0.05) { tone(freq, duration, 'square', 0.08) }
