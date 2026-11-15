import { clamp, normalize } from '../mappings/referenceProfiles.js'

// Vibration cannot change pitch or strength on the web: the motor only switches on and off.
// So the feel of a note is built from the SHAPE of its pulses:
//   low note   -> one slow, heavy thump           (deep)
//   middle     -> two taps                        (steady)
//   high note  -> a quick flutter of tiny pulses  (light, buzzy)
//   dust       -> a soft double tap               (unpitched)
// and the loudness of the note sets the length and number of pulses (firmer when louder).
// Everything is derived deterministically from the same event the audio engine plays.

export const MIN_INTENSITY = 0.12
const LOW_BELOW_MIDI = 50
const HIGH_FROM_MIDI = 66
const lerp = (a, b, t) => a + (b - a) * t

// weight: how strongly a voice should reach the hand (0 = never; sub-bass and rumble are not felt).
// range: velocity range of that voice across every frame and region of the ML features,
// so a voice's own quietest and loudest notes map to its softest and firmest pulses.
export const hapticVoices = {
  'night-lights': {
    piano: { weight: 1.0, range: [0.067, 0.133] },
    sparkle: { weight: 0.8, range: [0.006, 0.039] },
    cello: { weight: 0.6, range: [0.068, 0.084] },
    strings: { weight: 0.35, range: [0.038, 0.048] },
    rumble: { weight: 0 },
  },
  aerosols: {
    flute: { weight: 1.0, range: [0.087, 0.113] },
    salt: { weight: 0.8, range: [0.019, 0.026] },
    dust: { weight: 0.6, range: [0.0185, 0.0416] },
    smoke: { weight: 0.5, range: [0.039, 0.039] },
    sulfate: { weight: 0.4, range: [0.052, 0.052] },
  },
  co2: {
    cello: { weight: 1.0, range: [0.095, 0.123] },
    piano: { weight: 0.9, range: [0.04, 0.10] },
    strings: { weight: 0.35, range: [0.51, 0.51] },
    drone: { weight: 0 },
  },
}

// How firmly a note should be felt, 0..1 (0 = not at all).
export function hapticIntensity(kind, event) {
  const voice = hapticVoices[kind]?.[event.voice]
  if (!voice || !(voice.weight > 0)) return 0
  const [low, high] = voice.range
  const level = high - low < 1e-9 ? 0.6 : normalize(event.velocity, low, high) ?? 0.6
  return clamp(voice.weight * (0.35 + 0.65 * level))
}

// Pulses for one note, relative to its start: [{ start, duration }] in seconds. Empty = nothing to feel.
export function hapticPulses(kind, event) {
  const i = hapticIntensity(kind, event)
  if (i < MIN_INTENSITY) return []
  const notes = Array.isArray(event.notes) ? event.notes.filter(Number.isFinite) : []
  if (event.grainSeed !== undefined || !notes.length) {
    const duration = lerp(0.018, 0.040, i)
    return [{ start: 0, duration }, { start: duration + 0.070, duration }]
  }
  const pitch = notes.reduce((sum, note) => sum + note, 0) / notes.length
  if (pitch < LOW_BELOW_MIDI) return [{ start: 0, duration: lerp(0.045, 0.130, i) }]
  if (pitch < HIGH_FROM_MIDI) {
    const duration = lerp(0.025, 0.060, i)
    return [{ start: 0, duration }, { start: duration + 0.055, duration }]
  }
  const count = 3 + Math.round(3 * i)
  const duration = lerp(0.016, 0.024, i)
  const step = duration + 0.022
  return Array.from({ length: count }, (_, n) => ({ start: n * step, duration }))
}

// Merge overlapping or touching [start, end] intervals (several layers share one motor).
export function mergeRuns(intervals, joinGap = 0.008) {
  const sorted = intervals.map(({ start, end }) => ({ start, end })).sort((a, b) => a.start - b.start)
  const runs = []
  for (const item of sorted) {
    const last = runs.at(-1)
    if (last && item.start - last.end <= joinGap) last.end = Math.max(last.end, item.end)
    else runs.push(item)
  }
  return runs
}

// navigator.vibrate pattern [on, off, on, ...] in whole milliseconds, starting at `from`.
// The first run is clipped to `from`, so a pattern can be rebuilt while it is playing.
export function buildPattern(runs, from, horizon = 1.2) {
  const pattern = []
  let cursor = from
  for (const run of runs) {
    if (run.start > from + horizon) break
    const start = Math.max(run.start, cursor)
    const on = Math.round((run.end - start) * 1000)
    if (on < 8) continue
    if (pattern.length) pattern.push(Math.max(1, Math.round((start - cursor) * 1000)))
    pattern.push(on)
    cursor = run.end
  }
  return pattern
}
