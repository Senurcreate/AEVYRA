import * as Tone from 'tone';
import { getSonificationProfile } from '../mappings';
import type { EicFrameTelemetry, SoundControlFrame } from '../types/sonification';
import { seededUnit } from '../utils/musicTheory';

export type VisualizerReactiveCallback = (event: {
  note: string;
  velocity: number;
  pan: number;
  audioTime: number;
  currentControl: SoundControlFrame;
}) => void;

/** Owns the application's Tone Transport. Do not run a second Transport-based engine concurrently. */
export class AevyraAudioEngine {
  private initialized = false;
  private playing = false;
  private master!: Tone.Gain;
  private analyser!: Tone.Analyser;
  private limiter!: Tone.Limiter;
  private reverb!: Tone.Reverb;
  private padFilter!: Tone.Filter;
  private pad!: Tone.PolySynth<Tone.AMSynth>;
  private pulsePan!: Tone.Panner;
  private pulse!: Tone.PolySynth<Tone.FMSynth>;
  private shimmerPan!: Tone.Panner;
  private shimmer!: Tone.Synth;
  private loop!: Tone.Loop;
  private current: SoundControlFrame | null = null;
  private activeChord: string[] = [];
  private step = 0;
  private volume = 0.6;
  private muted = false;
  private onVisualTrigger?: VisualizerReactiveCallback;

  async init(onVisualTrigger?: VisualizerReactiveCallback): Promise<void> {
    if (this.initialized) { this.onVisualTrigger = onVisualTrigger; await Tone.start(); return; }
    await Tone.start(); // call init from a Play/Explore click
    this.onVisualTrigger = onVisualTrigger;
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.master = new Tone.Gain(this.volume).connect(this.limiter);
    this.analyser = new Tone.Analyser("waveform", 1024);
    this.master.connect(this.analyser);
    this.reverb = new Tone.Reverb({ decay: 3.2, wet: 0.24 }).connect(this.master);
    await this.reverb.ready;
    this.padFilter = new Tone.Filter({ type: 'lowpass', frequency: 450, rolloff: -24 }).connect(this.reverb);
    this.pad = new Tone.PolySynth(Tone.AMSynth, {
      envelope: { attack: 0.9, decay: 0.6, sustain: 0.7, release: 1.6 },
    }).connect(this.padFilter);
    this.pad.volume.value = -23;
    this.pulsePan = new Tone.Panner(0).connect(this.reverb);
    this.pulse = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.0,
      modulationIndex: 2.5,
      envelope: { attack: 0.015, decay: 0.2, sustain: 0.04, release: 0.3 },
    }).connect(this.pulsePan);
    this.pulse.volume.value = -22;
    this.shimmerPan = new Tone.Panner(0).connect(this.reverb);
    this.shimmer = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.07, decay: 0.25, sustain: 0.1, release: 0.7 },
    }).connect(this.shimmerPan);
    this.shimmer.volume.value = -23;
    this.loop = new Tone.Loop((time) => this.onStep(time), '8n');
    this.initialized = true;
    if (this.current) this.applyControls(this.current);
  }

  private onStep(time: number): void {
    const control = this.current;
    if (!control || !this.playing) return;
    const pulse = control.pulse;
    // Stable for a given frame + step: replay is reproducible.
    const seed = (pulse.seed ^ Math.imul(this.step + 1, 0x9e3779b1)) >>> 0;
    const chance = seededUnit(seed);
    if (chance < pulse.noteDensity && pulse.scaleNotes.length) {
      const noteIndex = Math.floor(seededUnit(seed ^ 0x7f4a7c15) * pulse.scaleNotes.length);
      const note = pulse.scaleNotes[noteIndex];
      const velocity = 0.32 + 0.24 * seededUnit(seed ^ 0x51ed270b);
      this.pulse.triggerAttackRelease(note, '16n', time, velocity);
      Tone.Draw.schedule(() => this.onVisualTrigger?.({
        note, velocity, pan: pulse.pan, audioTime: time, currentControl: control,
      }), time);
    }
    if (this.step % 8 === 0 && control.anomalyShimmer.intensity > 0.38) {
      this.shimmer.triggerAttackRelease(
        control.anomalyShimmer.activeNote, '8n', time,
        Math.min(0.55, control.anomalyShimmer.intensity * 0.45),
      );
    }
    this.step++;
  }

  /** Safe before init: allows frame analysis to run without activating audio. */
  applyFrameTelemetry(telemetry: EicFrameTelemetry): SoundControlFrame {
    const mapped = getSonificationProfile(telemetry.datasetId).mapTelemetryToSound(telemetry);
    this.current = mapped;
    if (this.initialized) this.applyControls(mapped);
    return mapped;
  }

  private applyControls(control: SoundControlFrame): void {
    Tone.getTransport().bpm.rampTo(control.tempoBpm, 0.3);
    this.padFilter.frequency.rampTo(control.pad.filterCutoffHz, 0.3);
    this.pad.volume.rampTo(control.pad.volumeDb, 0.3);
    this.pulse.volume.rampTo(control.pulse.volumeDb, 0.3);
    this.pulsePan.pan.rampTo(control.pulse.pan, 0.3);
    this.shimmerPan.pan.rampTo(control.anomalyShimmer.stereoPan, 0.3);
    this.loop.interval = control.pulse.subdivision;
    // PolySynth.set forwards voice options to current and future voices.
    this.pulse.set({ harmonicity: control.pulse.harmonicity });
    this.pad.set({ detune: control.pad.detuneCents });
    if (this.playing) this.updateChord(control.pad.chordNotes);
  }

  private updateChord(next: string[]): void {
    if (this.activeChord.join(',') === next.join(',')) return;
    const now = Tone.now();
    this.pad.releaseAll(now);
    // Small offset lets the old chord begin releasing before the new attack.
    this.pad.triggerAttack(next, now + 0.06, 0.55);
    this.activeChord = [...next];
  }

  start(): void {
    if (!this.initialized) throw new Error('Call await engine.init() inside a user gesture first');
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    if (this.current) this.updateChord(this.current.pad.chordNotes);
    this.loop.start(0);
    Tone.getTransport().start();
  }

  pause(): void {
    if (!this.initialized || !this.playing) return;
    this.playing = false;
    this.loop.stop();
    Tone.getTransport().pause();
    this.pad.releaseAll();
    this.pulse.releaseAll();
    this.shimmer.triggerRelease();
    this.activeChord = [];
  }

  stop(): void {
    this.pause();
    if (this.initialized) {
      Tone.getTransport().stop();
      this.step = 0;
    }
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (this.initialized) this.master.gain.rampTo(this.muted ? 0 : this.volume, 0.04);
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.initialized) this.master.gain.rampTo(muted ? 0 : this.volume, 0.04);
  }
  get isPlaying(): boolean { return this.playing; }
  get waveformAnalyser(): Tone.Analyser | null { return this.initialized ? this.analyser : null; }

  dispose(): void {
    if (!this.initialized) return;
    this.stop();
    this.loop.dispose();
    this.pad.dispose(); this.pulse.dispose(); this.shimmer.dispose();
    this.padFilter.dispose(); this.pulsePan.dispose(); this.shimmerPan.dispose();
    this.reverb.dispose(); this.analyser.dispose(); this.master.dispose(); this.limiter.dispose();
    this.initialized = false;
    this.current = null;
    this.activeChord = [];
    this.onVisualTrigger = undefined;
  }
}
