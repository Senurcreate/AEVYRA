import * as Tone from 'tone'
import { beatSeconds, eventsAtBeat, midiToHz } from '../mappings/referenceProfiles.js'
import { createDustBuffer, DustGrains, GRAIN_RELEASE } from './DustGrains.js'
import { NoteVoices, TRANSITION_FADE } from './NoteVoices.js'

// The aerosols dust texture can be switched off here (the score and mapping stay untouched).
const DUST_ENABLED = true
const LOOKAHEAD = 0.080
const PICKUP = 0.082
const mixes = {
  'night-lights': { gain: 3.0, reverb: 0.16, decay: 1.85 },
  aerosols: { gain: 2.55, reverb: 0.25, decay: 1.90 },
  co2: { gain: 1.45, reverb: 0.25, decay: 2.55 },
}

const adsr = ([attack, decay, sustain, release]) => ({ attack, decay, sustain, release })
const synth = (type, envelope) => [Tone.Synth, { oscillator: { type }, envelope: adsr(envelope) }]
const fm = (type, ratio, index, envelope, modulationEnvelope) => [Tone.FMSynth, {
  harmonicity: ratio, modulationIndex: index, oscillator: { type }, modulation: { type: 'sine' },
  envelope: adsr(envelope), modulationEnvelope: adsr(modulationEnvelope),
}]
const patches = {
  'night-lights': {
    strings: { limit: 9, synth: synth('triangle4', [0.82, 0.75, 0.72, 1.65]), cutoff: c => c.filterHz * 0.78, gain: c => c.padGain, pan: c => c.pan },
    cello: { limit: 4, synth: fm('triangle', 1, 0.52, [0.50, 0.55, 0.76, 1.15], [0.42, 0.70, 0.40, 0.94]), cutoff: () => 720, gain: c => c.celloGain, pan: c => c.pan * 0.5 },
    piano: { limit: 5, synth: fm('sine', 2, 1.48, [0.019, 0.44, 0.20, 0.72], [0.012, 0.19, 0.032, 0.24]), cutoff: c => c.filterHz, pan: c => c.pan },
    sparkle: { limit: 4, synth: fm('sine', 2.5, 0.62, [0.012, 0.23, 0.08, 0.55], [0.012, 0.15, 0.06, 0.31]), cutoff: () => 4800, pan: c => c.sparklePan },
    rumble: { limit: 2, synth: synth('sine2', [1.15, 0.60, 0.62, 1.30]), cutoff: () => 95, highpass: 27 },
  },
  aerosols: {
    flute: { limit: 4, synth: fm('sine', 2, 0.52, [0.59, 0.48, 0.77, 1.10], [0.43, 0.62, 0.39, 0.96]), cutoff: c => c.filterHz, pan: c => c.pans.flute },
    sulfate: { limit: 6, synth: synth('sine3', [1.12, 0.80, 0.72, 1.64]), cutoff: c => c.filterHz * 0.70, gain: c => c.sulfateGain, pan: c => c.pans.sulfate, movement: true },
    smoke: { limit: 6, synth: fm('sine2', 1.41, 0.68, [1.26, 0.87, 0.65, 1.50], [0.96, 0.70, 0.32, 1.12]), cutoff: () => 440, gain: c => c.smokeGain, pan: c => c.pans.smoke },
    dust: { limit: 3, grains: true, highpass: 140, cutoff: c => c.dustHz, pan: c => c.pans.dust, movement: true },
    salt: { limit: 3, synth: synth('sine2', [0.14, 0.22, 0.12, 0.55]), cutoff: () => 1500, pan: c => c.pans.salt },
  },
  co2: {
    cello: { limit: 4, synth: fm('triangle3', 1, 0.38, [0.67, 0.90, 0.72, 1.75], [0.48, 0.90, 0.26, 1.35]), cutoff: c => c.filterHz, pan: c => c.pan * 0.7 },
    strings: { limit: 9, synth: synth('triangle4', [1.52, 0.73, 0.72, 2.44]), cutoff: c => c.stringsHz, gain: c => c.padGain, pan: c => c.pan },
    piano: { limit: 4, synth: fm('sine', 2, 0.83, [0.029, 0.65, 0.18, 1.18], [0.020, 0.32, 0.10, 0.67]), cutoff: c => c.filterHz, pan: c => c.pianoPan },
    drone: { limit: 3, synth: synth('sine2', [1.35, 0.58, 0.69, 2.08]), cutoff: () => 305, highpass: 38 },
  },
}

function makeImpulse(context, seconds) {
  const rate = context.sampleRate
  const start = Math.round(0.029 * rate)
  const tail = Math.round(seconds * rate)
  const buffer = context.createBuffer(2, start + tail, rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    let seed = 8171 + 6271 * channel
    let previous = 0
    for (let i = 0; i < tail; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      previous = 0.31 * (seed / 2147483648 - 1) + 0.69 * previous
      data[start + i] = previous * (1 - i / tail) ** 3 * (10 / Math.sqrt(tail))
    }
  }
  return buffer
}

export class GeneratedAudioEngine {
  constructor(kind, mode, { duration = Infinity, offset = 0, speed = 1, controlsAt, onEnd, onError, haptics } = {}) {
    this.context = Tone.getContext()
    this.haptics = this.context.isOffline ? undefined : haptics // optional phone vibration that follows the notes
    this.kind = kind
    this.mode = mode
    this.duration = duration
    this.speed = speed
    this.beat = beatSeconds(kind)
    this.controlsAt = controlsAt
    this.onEnd = onEnd
    this.onError = onError
    this.position = offset
    this.resetBeat()
    this.layers = {}
    this.nodes = []

    try {
      this.output = this.own(new Tone.Gain(0))
      this.limiter = this.own(new Tone.Limiter(-3)).toDestination()
      this.analyser = this.own(new Tone.Analyser('waveform', 1024))
      this.output.connect(this.limiter)
      this.limiter.connect(this.analyser)

      if (mode === 'reference') {
        this.own(new Tone.Oscillator('D3', 'sine')).connect(this.output).start()
        return
      }

      this.level = this.own(new Tone.Gain(0)).connect(this.output)
      const movement = kind === 'aerosols' ? this.own(new Tone.Chorus({
        frequency: 0.21, delayTime: 6.8, depth: 0.30, spread: 180, feedback: 0, wet: 0.38,
      })).connect(this.level).start() : null
      const dustBuffer = kind === 'aerosols' && DUST_ENABLED ? createDustBuffer(this.context) : null
      const mix = mixes[kind]
      const room = this.own(new Tone.Convolver({ url: makeImpulse(this.context, mix.decay), normalize: false }))
      const reflections = this.own(new Tone.Gain(mix.reverb))
      this.level.chain(room, reflections, this.output)
      for (const [name, patch] of Object.entries(patches[kind])) {
        if (patch.grains && !DUST_ENABLED) continue
        const filter = this.own(new Tone.Filter({ frequency: 1200, type: 'lowpass', Q: 0.55 }))
        const pan = this.own(new Tone.Panner(0))
        const gain = this.own(new Tone.Gain(1))
        filter.chain(gain, pan, patch.movement ? movement : this.level)
        const input = patch.highpass
          ? this.own(new Tone.Filter({ frequency: patch.highpass, type: 'highpass', Q: 0.60 })).connect(filter)
          : filter
        let makeVoice
        let release
        if (patch.grains) {
          makeVoice = output => new DustGrains(this.context, dustBuffer, output)
          release = GRAIN_RELEASE
        } else {
          const [Voice, options] = patch.synth
          makeVoice = output => new Voice({ ...options, context: this.context }).connect(output)
          release = Math.max(options.envelope.release, options.modulationEnvelope?.release ?? 0)
        }
        const voices = this.own(new NoteVoices(this.context, input, patch.limit, makeVoice, release))
        this.layers[name] = { voices, filter, pan, gain, patch }
      }
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  own(node) {
    this.nodes.push(node)
    return node
  }

  elapsed(now = this.context.currentTime) {
    return this.position + (this.startedAt == null ? 0 : Math.max(0, now - this.startedAt) * this.speed)
  }

  controlsFor(position) {
    return this.controlsAt ? this.controlsAt(position) : this.controls
  }

  apply(controls, now = this.context.currentTime) {
    if (this.mode !== 'changing' || this.controls === controls) return
    const recovering = !this.controls && controls && this.startedAt != null
    this.controls = controls
    this.level.gain.rampTo(controls?.gain ?? 0, controls ? 0.29 : 0.12, now)
    if (!controls) {
      this.updateOutput()
      this.release(now)
      return
    }
    for (const { filter, pan, gain, patch } of Object.values(this.layers)) {
      filter.frequency.rampTo(patch.cutoff(controls), 0.29, now)
      pan.pan.rampTo(patch.pan?.(controls) ?? 0, 0.29, now)
      gain.gain.rampTo(patch.gain?.(controls) ?? 1, 0.29, now)
    }
    if (recovering) {
      this.updateOutput()
      this.restoreSustain(now + LOOKAHEAD)
    }
  }

  setMuted(muted) {
    this.muted = muted
    this.haptics?.setMuted(muted)
    this.updateOutput()
  }

  setSpeed(speed) {
    if (!Number.isFinite(speed) || speed <= 0) return
    const now = this.context.currentTime
    this.position = this.elapsed(now)
    if (this.startedAt != null) this.startedAt = Math.max(now, this.startedAt)
    this.speed = speed
  }

  seek(position) {
    const playing = this.startedAt != null
    if (playing) this.pause()
    this.position = position
    this.resetBeat()
    if (playing) this.resume()
  }

  updateOutput() {
    const gain = this.mode === 'reference' ? 0.10 : mixes[this.kind].gain
    const active = this.startedAt != null && !this.muted && (this.mode === 'reference' || this.controls)
    const now = this.context.currentTime
    this.output.gain.rampTo(active ? gain : 0, TRANSITION_FADE, active ? Math.max(now, this.startedAt) : now)
  }

  resume() {
    if (this.startedAt != null || this.disposed) return
    this.apply(this.controlsFor(this.position))
    this.startedAt = this.context.currentTime + TRANSITION_FADE + 0.02
    this.updateOutput()
    if (this.position > 0) this.restoreSustain(this.startedAt)
    this.scheduleTick()
  }

  scheduleTick() {
    this.tick()
    if (this.startedAt == null || this.disposed) return
    const advance = () => {
      this.timer = undefined
      try { this.scheduleTick() } catch (error) { this.onError?.(error) }
    }
    this.timer = this.context.isOffline ? this.context.setTimeout(advance, 0.016) : setTimeout(advance, 16)
  }

  cancelTick() {
    if (this.timer === undefined) return
    if (this.context.isOffline) this.context.clearTimeout(this.timer)
    else clearTimeout(this.timer)
    this.timer = undefined
  }

  resetBeat() {
    this.nextBeat = Math.max(0, Math.ceil((this.position - PICKUP) / this.beat))
  }

  pause() {
    this.position = this.elapsed()
    this.resetBeat()
    this.startedAt = null
    this.updateOutput()
    this.cancelTick()
    this.release()
    this.haptics?.cancel()
  }

  release(now = this.context.currentTime) {
    for (const { voices } of Object.values(this.layers)) voices.cut(now)
  }

  // `feel` is false when held notes are only being restored after a pause or seek: they sound again, but are not new hits.
  play(event, time, seconds = event.seconds, feel = true) {
    const layer = this.layers[event.voice]
    if (!layer) return // layer switched off (see DUST_ENABLED)
    const { voices } = layer
    const hold = seconds / this.speed
    if (feel) this.haptics?.note(this.kind, event, time)
    if (event.grainSeed !== undefined) {
      voices.play(event.grainSeed, time, hold, event.velocity)
      return
    }
    for (const note of event.notes) voices.play(midiToHz(note), time, hold, event.velocity)
  }

  restoreSustain(time) {
    const position = this.elapsed()
    const beat = Math.min(this.nextBeat - 1, Math.floor((position - PICKUP) / this.beat))
    const restored = new Set()
    for (let i = beat; i >= Math.max(0, beat - 19); i--) {
      const at = PICKUP + i * this.beat
      for (const event of eventsAtBeat(this.kind, this.controlsFor(at) ?? this.controls, i)) {
        const remaining = at + event.seconds - position
        if (event.hold && remaining > 0.15 && !restored.has(event.voice)) {
          this.play(event, time, remaining, false)
          restored.add(event.voice)
        }
      }
    }
  }

  tick() {
    const now = this.context.currentTime
    const position = this.elapsed(now)
    if (position >= this.duration) {
      this.pause()
      this.onEnd?.()
      return
    }
    if (this.mode === 'reference') return
    this.apply(this.controlsFor(position), now)
    const horizon = this.position + (now + LOOKAHEAD - this.startedAt) * this.speed
    // Skip missed beats if the browser or audio device has been suspended.
    const first = Math.max(this.position, position - 0.12)
    this.nextBeat = Math.max(this.nextBeat, Math.ceil((first - PICKUP) / this.beat))
    while (PICKUP + this.nextBeat * this.beat <= horizon && PICKUP + this.nextBeat * this.beat < this.duration) {
      const beat = this.nextBeat++
      const at = PICKUP + beat * this.beat
      const time = Math.max(now, this.startedAt + (at - this.position) / this.speed)
      for (const event of eventsAtBeat(this.kind, this.controlsFor(at), beat)) this.play(event, time)
    }
    // The audio output delay is subtracted so the buzz meets the sound instead of leading it.
    this.haptics?.flush(now, this.context.rawContext?.outputLatency ?? this.context.rawContext?.baseLatency ?? 0)
  }

  stop() {
    if (this.disposed || this.stopTimer) return
    this.pause()
    this.stopTimer = this.context.setTimeout(() => this.dispose(), TRANSITION_FADE + 0.015)
  }

  dispose() {
    this.disposed = true
    this.cancelTick()
    if (this.stopTimer) this.context.clearTimeout(this.stopTimer)
    for (const node of this.nodes.reverse()) node.dispose()
    this.nodes.length = 0
  }
}
