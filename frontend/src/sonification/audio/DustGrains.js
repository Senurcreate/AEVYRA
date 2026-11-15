import * as Tone from 'tone'

// A dust grain swells in and drifts away like a breath of wind instead of puffing on and off:
// the fade-in is slow (a fast noise onset sounds like a sudden hiss) and the grain is allowed to
// sound a little longer than its score event so the swell can bloom and settle.
export const GRAIN_FADE_IN = 0.55
export const GRAIN_FADE_OUT = 0.80
const GRAIN_EXTRA = 0.35
const GRAIN_MAX = 1.9
// The voice slot stays reserved until the grain has completely faded out.
export const GRAIN_RELEASE = GRAIN_EXTRA + GRAIN_FADE_OUT

export function createDustBuffer(context) {
  const rate = context.sampleRate
  const buffer = context.createBuffer(1, Math.ceil(rate * 6), rate)
  const samples = buffer.getChannelData(0)
  let seed = 24509
  let low = 0
  let drift = 0
  const smoothing = 1 - Math.exp(-2 * Math.PI * 620 / rate)
  const slow = 1 - Math.exp(-2 * Math.PI * 86 / rate)
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    low += smoothing * (seed / 2147483648 - 1 - low)
    drift += slow * (low - drift)
    samples[i] = 2.7 * (low - drift)
  }
  return buffer
}

// The noise is not heard raw. Each grain is squeezed through two narrow tuned filters, so it
// sounds like a soft, airy breath on open-fifth notes (A3 D4 A4 D5) instead of static hiss.
// The notes are chosen from the grain seed, so the result is deterministic.
const BREATH_HZ = [220.00, 293.66, 440.00, 587.33]
const BREATH_Q = 9
const BREATH_GAIN = 2.6 // the narrow filters remove most of the noise energy, so make that up

export class DustGrains {
  constructor(context, buffer, destination) {
    this.context = context
    this.buffer = buffer
    this.destination = destination
    this.grains = new Set()
  }

  triggerAttackRelease(seed, hold, time, velocity) {
    const length = Math.min(hold + GRAIN_EXTRA, GRAIN_MAX)
    const first = seed % BREATH_HZ.length
    const second = (first + 1 + (seed >>> 8) % (BREATH_HZ.length - 1)) % BREATH_HZ.length
    const entry = { filters: [] }
    entry.source = new Tone.ToneBufferSource({
      context: this.context, url: this.buffer, fadeIn: Math.min(GRAIN_FADE_IN, 0.6 * length), fadeOut: GRAIN_FADE_OUT,
      onended: () => this.free(entry),
    })
    for (const note of [first, second]) {
      const filter = new Tone.Filter({ context: this.context, type: 'bandpass', frequency: BREATH_HZ[note], Q: BREATH_Q })
      entry.source.connect(filter)
      filter.connect(this.destination)
      entry.filters.push(filter)
    }
    this.grains.add(entry)
    const offset = (seed / 4294967296) * (this.buffer.duration - length - GRAIN_FADE_OUT)
    entry.source.start(time, offset, length, BREATH_GAIN * velocity)
  }

  free(entry) {
    if (!this.grains.delete(entry)) return
    entry.source.dispose()
    for (const filter of entry.filters) filter.dispose()
  }

  dispose() {
    for (const entry of [...this.grains]) this.free(entry)
  }
}
