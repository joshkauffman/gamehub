// ── The Obvious Guitar Hero Knockoff — songs ───────────────────────────
// Each song is generated from one beat grid so the backing track (drum
// hits + a simple bassline, both synthesized — see audioEngine.js) and
// the note chart are always perfectly in sync with each other.

import { LANE_COUNT } from './constants.js'

const BASS_SCALE_MIDI = [45, 48, 50, 52, 47, 48, 43, 45] // a short original bassline, degrees of A minor-ish

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12) }

export function generateSong({ id, name, bpm, bars, density, leadPattern }) {
  const secPerBeat = 60 / bpm
  const beatsTotal = bars * 4
  const drumEvents = []
  const bassEvents = []
  const notes = []
  let lastLane = -1
  let laneStreak = 0

  for (let b = 0; b < beatsTotal; b++) {
    const barBeat = b % 4
    const t = b * secPerBeat

    // Drums: kick on 1 & 3, snare on 2 & 4, hats on every 8th note.
    if (barBeat === 0 || barBeat === 2) drumEvents.push({ time: t, type: 'kick' })
    if (barBeat === 1 || barBeat === 3) drumEvents.push({ time: t, type: 'snare' })
    drumEvents.push({ time: t, type: 'hat' })
    drumEvents.push({ time: t + secPerBeat / 2, type: 'hat' })

    // A simple repeating original bassline, one note per beat.
    const midi = BASS_SCALE_MIDI[b % BASS_SCALE_MIDI.length]
    bassEvents.push({ time: t, freq: midiToFreq(midi) })

    // Chart notes: always on the backbeat (snare), plus extra notes on
    // off-beats scaled by the song's density for difficulty.
    const wantsNote = barBeat === 1 || barBeat === 3 || Math.random() < density
    if (wantsNote) {
      let lane = Math.floor(Math.random() * LANE_COUNT)
      if (lane === lastLane) laneStreak++; else laneStreak = 0
      if (laneStreak >= 2) lane = (lane + 1 + Math.floor(Math.random() * (LANE_COUNT - 1))) % LANE_COUNT
      lastLane = lane
      notes.push({ time: t + NOTE_LEAD_NUDGE(leadPattern, b), lane, id: notes.length })
    }
  }

  const duration = beatsTotal * secPerBeat + 2
  return { id, name, bpm, bars, duration, drumEvents, bassEvents, notes }
}

// A tiny bit of per-song swing so the three songs don't all feel
// metronome-identical; harmless no-op for the default pattern.
function NOTE_LEAD_NUDGE(pattern, beatIndex) {
  if (pattern === 'swing' && beatIndex % 2 === 1) return 0.015
  return 0
}

export const SONGS = [
  generateSong({ id: 'garage-warmup', name: 'Garage Warmup', bpm: 96, bars: 24, density: 0.18, leadPattern: 'straight' }),
  generateSong({ id: 'neon-overdrive', name: 'Neon Overdrive', bpm: 126, bars: 28, density: 0.3, leadPattern: 'swing' }),
  generateSong({ id: 'circuit-breaker', name: 'Circuit Breaker', bpm: 152, bars: 30, density: 0.42, leadPattern: 'straight' }),
]

export function songById(id) { return SONGS.find(s => s.id === id) }
