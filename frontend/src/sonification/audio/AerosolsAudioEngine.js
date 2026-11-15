import * as Tone from 'tone';

function unit(seed) {
  let x = (seed + 0x6d2b79f5) >>> 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

// Self-contained Aerosols POC engine. Does not replace the existing Night Lights engine.
export class AerosolsAudioEngine {
  constructor() {
    this.ready = false;
    this.playing = false;
    this.muted = false;
    this.controls = null;
    this.step = 0;
    this.activeChord = [];
  }

  async init() {
    await Tone.start(); // Must be invoked from a user Play gesture.
    if (this.ready) return;
    this.master = new Tone.Gain(0.65).toDestination();
    this.analyser = new Tone.Analyser('waveform', 1024);
    this.master.connect(this.analyser);
    this.limiter = new Tone.Limiter(-4).connect(this.master);
    this.filter = new Tone.Filter(500, 'lowpass').connect(this.limiter);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.7, decay: 0.3, sustain: 0.55, release: 1.2 },
    }).connect(this.filter);
    this.pad.volume.value = -24;
    this.panner = new Tone.Panner(0).connect(this.limiter);
    this.pulse = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.015, decay: 0.13, sustain: 0.06, release: 0.25 },
    }).connect(this.panner);
    this.pulse.volume.value = -20;
    this.shimmer = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.25, sustain: 0.03, release: 0.45 },
    }).connect(this.limiter);
    this.shimmer.volume.value = -25;
    this.loop = new Tone.Loop(time => this.tick(time), '8n');
    this.ready = true;
    if (this.controls) this.apply(this.controls);
  }

  apply(controls) {
    this.controls = controls;
    if (!this.ready) return;
    Tone.getTransport().bpm.rampTo(controls.tempo, 0.3);
    this.filter.frequency.rampTo(controls.filterHz, 0.35);
    this.pad.volume.rampTo(controls.padDb, 0.35);
    this.pulse.volume.rampTo(controls.pulseDb, 0.35);
    this.shimmer.volume.rampTo(controls.shimmerDb, 0.35);
    this.panner.pan.rampTo(controls.pan, 0.35);
    if (this.playing) this.updateChord();
  }

  updateChord() {
    const notes = this.controls?.padNotes ?? [];
    if (notes.join('|') === this.activeChord.join('|')) return;
    this.pad.releaseAll();
    if (notes.length) this.pad.triggerAttack(notes, Tone.now() + 0.06, 0.35);
    this.activeChord = [...notes];
  }

  tick(time) {
    const c = this.controls;
    if (!this.playing || !c) return;
    const seed = (c.seed ^ Math.imul(this.step + 1, 2654435761)) >>> 0;
    if (unit(seed) < c.density) {
      const note = c.notes[Math.floor(unit(seed ^ 0x9e3779b9) * c.notes.length)];
      this.pulse.triggerAttackRelease(note, '16n', time, 0.38 + 0.2 * c.accent);
    }
    if (this.step % 4 === 0 && unit(seed ^ 0x51ed270b) < c.shimmerChance) {
      this.shimmer.triggerAttackRelease('A4', '8n', time, 0.24 + 0.2 * c.texture);
    }
    this.step += 1;
  }

  start() {
    if (!this.ready || !this.controls) throw new Error('Initialize audio and select a frame first.');
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.updateChord();
    Tone.getTransport().stop();
    this.loop.start(0);
    Tone.getTransport().start();
  }

  stop() {
    if (!this.ready) return;
    this.playing = false;
    this.loop.stop();
    Tone.getTransport().stop();
    this.pad.releaseAll();
    this.pulse.triggerRelease();
    this.shimmer.triggerRelease();
    this.activeChord = [];
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.ready) this.master.gain.rampTo(this.muted ? 0 : 0.65, 0.04);
  }

  get waveformAnalyser() { return this.analyser ?? null; }

  dispose() {
    if (!this.ready) return;
    this.stop();
    [this.loop, this.pad, this.pulse, this.shimmer, this.filter,
      this.panner, this.limiter, this.master, this.analyser].forEach(node => node.dispose());
    this.ready = false;
  }
}
