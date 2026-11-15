/**
 * Live ambient CO2 mapping using Tone.js. Requires `npm install tone` and
 * `import * as Tone from 'tone'` at call-site. NO frontend UI changes included.
 * The CO2 profile derives features from visualization colours, not measured ppm.
 */
import { mapCo2Frame, CO2_MAPPING_CONFIG } from '../mappings/co2Profile.js';
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));

export function createCo2AudioEngine(Tone) {
  if (!Tone?.Synth || !Tone?.Loop) throw new TypeError('Pass the Tone.js module as createCo2AudioEngine(Tone)');
  const limiter = new Tone.Limiter(-7).toDestination();
  const master = new Tone.Gain(0.58).connect(limiter);
  const analyser = new Tone.Analyser('waveform', 1024);
  master.connect(analyser);
  const padGain = new Tone.Gain(0.15).connect(master);
  const lowPass = new Tone.Filter(1100, 'lowpass');
  const pulsePan = new Tone.Panner(0).connect(master);
  lowPass.connect(pulsePan);
  const pulseGain = new Tone.Gain(0.05).connect(lowPass);
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: {type:'sine'},
    envelope: {attack:1.6,decay:0.3,sustain:0.55,release:2.0},
    volume:-10,
  }).connect(padGain);
  const melody = new Tone.Synth({
    oscillator:{type:'sine'},
    envelope:{attack:0.08,decay:0.22,sustain:0.07,release:0.55},
    volume:-9,
  }).connect(pulseGain);
  let current = null;
  let loop = null;
  let step = 0;
  let speed = 0.75;
  let running = false;
  const update = profile => {
    current = profile;
    // Short gain ramps avoid clicks and softened pulses avoid buzzy bass beating.
    const t=Tone.now();
    padGain.gain.rampTo(profile.padGain,1.2);
    pulseGain.gain.rampTo(profile.pulseGain,1.2);
    lowPass.frequency.rampTo(profile.filterHz,1.2);
    pulsePan.pan.rampTo(profile.pan,1.2);
    if (Tone.Transport) Tone.Transport.bpm.rampTo(profile.tempoBpm * speed, 1.2);
  };
  const trigger = time => {
    if (!running || !current) return;
    const seed = (Math.sin((step + 1) * 12.9898 + (Number(current.frameId?.replace(/\D/g,'')) || 0) * 78.233) * 43758.5453);
    const pseudo = seed - Math.floor(seed);
    if (pseudo < current.noteProbability) {
      melody.triggerAttackRelease(current.note, '16n', time, clamp(0.48 + current.activity * 0.28, 0, 0.76));
    }
    step += 1;
  };
  return {
    async start(frame, groupNames) {
      await Tone.start(); // call from a user-initiated click
      this.updateFrame(frame, groupNames);
      if (!running) {
        Tone.Transport.stop();
        pad.triggerAttack(CO2_MAPPING_CONFIG.padNotes);
        loop = new Tone.Loop(trigger, '8n').start(0);
        Tone.Transport.start();
        running = true;
      }
    },
    updateFrame(frame, groupNames) { update(mapCo2Frame(frame,groupNames)); },
    setSpeed(nextSpeed) {
      speed = clamp(Number(nextSpeed) || 0.75,0.5,1.25);
      if (current && Tone.Transport) Tone.Transport.bpm.rampTo(current.tempoBpm * speed, 0.5);
    },
    setMuted(value) { master.gain.rampTo(value ? 0 : 0.58, 0.04); },
    get waveformAnalyser() { return analyser; },
    stop() {
      if (loop) { loop.stop();loop.dispose();loop=null; }
      if (running) {
        pad.releaseAll();melody.triggerRelease();
        Tone.Transport.stop();
        running=false;
      }
    },
    dispose() {
      this.stop();
      [pad,melody,padGain,lowPass,pulsePan,pulseGain,master,limiter,analyser].forEach(n=>n.dispose());
    },
  };
}
