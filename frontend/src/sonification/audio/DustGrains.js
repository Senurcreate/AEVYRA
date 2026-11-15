import * as Tone from 'tone'

export const GRAIN_RELEASE = 0.16

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

export class DustGrains {
  constructor(context, buffer, destination) {
    this.context = context
    this.buffer = buffer
    this.destination = destination
    this.sources = new Set()
  }

  triggerAttackRelease(seed, hold, time, velocity) {
    const grain = new Tone.ToneBufferSource({
      context: this.context, url: this.buffer, fadeIn: 0.095, fadeOut: GRAIN_RELEASE,
      onended: source => this.sources.delete(source),
    }).connect(this.destination)
    this.sources.add(grain)
    const length = Math.min(hold, 1.50)
    const offset = (seed / 4294967296) * (this.buffer.duration - length - GRAIN_RELEASE)
    grain.start(time, offset, length, 1.45 * velocity)
  }

  dispose() {
    for (const source of this.sources) source.dispose()
    this.sources.clear()
  }
}
