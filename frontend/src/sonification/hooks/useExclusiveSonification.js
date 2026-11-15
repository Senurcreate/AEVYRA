import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { AevyraAudioEngine } from '../audio/AudioEngine';
import { AerosolsAudioEngine } from '../audio/AerosolsAudioEngine';
import { createCo2AudioEngine } from '../audio/Co2AudioEngine';
import { mapAerosolFrame } from '../mappings/aerosolsProfile';

export function useExclusiveSonification() {
  const owner = useRef(null);
  const generation = useRef(0);
  const mutedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [error, setError] = useState('');
  const [analyser, setAnalyser] = useState(null);

  const setMuted = useCallback(value => {
    const next = Boolean(value);
    mutedRef.current = next;
    setMutedState(next);
    owner.current?.engine?.setMuted?.(next);
    owner.current?.referenceGain?.gain.rampTo(next ? 0 : 0.10, 0.04);
  }, []);

  const silence = useCallback(() => {
    const previous = owner.current;
    owner.current = null;
    if (!previous) return;
    try { previous.engine?.stop?.(); } finally {
      previous.engine?.dispose?.();
      previous.reference?.stop?.();
      previous.reference?.dispose?.();
      previous.referenceGain?.dispose?.();
      previous.referenceAnalyser?.dispose?.();
    }
  }, []);

  const stop = useCallback(() => {
    generation.current += 1;
    silence();
    setPlaying(false);
    setAnalyser(null);
  }, [silence]);

  const start = useCallback(async (mode, frame, kind = 'night-lights', groups) => {
    if (!frame || !['night-lights', 'aerosols', 'co2'].includes(kind)) return false;
    const token = ++generation.current;
    setError('');
    // Start from the user gesture; Tone.start unlocks browser audio.
    try {
      await Tone.start();
      if (token !== generation.current) return false;
      silence();
      const current = { kind, mode, engine: null, reference: null, referenceGain: null, referenceAnalyser: null };
      owner.current = current;
      if (mode === 'reference') {
        current.referenceAnalyser = new Tone.Analyser('waveform', 1024);
        current.referenceGain = new Tone.Gain(mutedRef.current ? 0 : 0.10).toDestination();
        current.referenceGain.connect(current.referenceAnalyser);
        current.reference = new Tone.Oscillator({ frequency: 'D3', type: 'sine' }).connect(current.referenceGain);
        current.reference.start();
        setAnalyser(current.referenceAnalyser);
      } else if (mode === 'changing') {
        if (kind === 'night-lights') {
          current.engine = new AevyraAudioEngine();
          current.engine.applyFrameTelemetry(frame);
          await current.engine.init();
          if (token !== generation.current) return false;
          current.engine.setMuted(mutedRef.current);
          current.engine.start();
        } else if (kind === 'aerosols') {
          current.engine = new AerosolsAudioEngine();
          current.engine.apply(mapAerosolFrame(frame));
          await current.engine.init();
          if (token !== generation.current) return false;
          current.engine.setMuted(mutedRef.current);
          current.engine.start();
        } else {
          current.engine = createCo2AudioEngine(Tone);
          current.engine.setMuted(mutedRef.current);
          await current.engine.start(frame, groups);
          if (token !== generation.current) return false;
        }
        setAnalyser(current.engine.waveformAnalyser ?? null);
      } else throw new Error('Unknown sound track');
      if (token !== generation.current) return false;
      setPlaying(true);
      return true;
    } catch (err) {
      if (token === generation.current) {
        silence();
        setPlaying(false);
        setAnalyser(null);
        setError(err instanceof Error ? err.message : 'Unable to start audio');
      }
      return false;
    }
  }, [silence]);

  const applyFrame = useCallback((frame, kind, groups) => {
    const current = owner.current;
    if (!frame || !current || current.kind !== kind || current.mode !== 'changing') return;
    try {
      if (kind === 'night-lights') current.engine.applyFrameTelemetry(frame);
      else if (kind === 'aerosols') current.engine.apply(mapAerosolFrame(frame));
      else if (kind === 'co2') current.engine.updateFrame(frame, groups);
    } catch (err) { setError(err instanceof Error ? err.message : 'Invalid frame'); }
  }, []);

  useEffect(() => () => {
    generation.current += 1;
    silence();
  }, [silence]);

  return { start, stop, applyFrame, playing, muted, setMuted, error, analyser };
}
