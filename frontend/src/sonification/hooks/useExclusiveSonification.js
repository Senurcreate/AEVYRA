
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { AevyraAudioEngine } from '../audio/AudioEngine';

export function useExclusiveSonification() {
  const owner = useRef(null);
  const generation = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [analyser, setAnalyser] = useState(null);

  const getOwner = useCallback(() => {
    if (!owner.current) {
      owner.current = {
        engine: new AevyraAudioEngine(),
        reference: null,
        referenceGain: null,
        referenceAnalyser: null,
        mode: null,
      };
    }
    return owner.current;
  }, []);

  const silence = useCallback(() => {
    const o = owner.current;
    if (!o) return;

    o.engine.stop();

    o.reference?.stop();
    o.reference?.dispose();
    o.referenceGain?.dispose();
    o.referenceAnalyser?.dispose();

    o.reference = null;
    o.referenceGain = null;
    o.referenceAnalyser = null;
    o.mode = null;
  }, []);

  const stop = useCallback(() => {
    generation.current += 1;
    silence();
    setPlaying(false);
    setAnalyser(null);
  }, [silence]);

  const start = useCallback(async (mode, frame) => {
    if (!frame) return false;

    const token = ++generation.current;
    setError('');

    try {
      await Tone.start();
      if (token !== generation.current) return false;

      const o = getOwner();
      silence();

      if (mode === 'reference') {
        o.referenceAnalyser = new Tone.Analyser(
          'waveform',
          1024
        );

        o.referenceGain = new Tone.Gain(
          muted ? 0 : 0.10
        ).toDestination();

        o.referenceGain.connect(o.referenceAnalyser);

        o.reference = new Tone.Oscillator({
          frequency: 'D3',
          type: 'sine',
        }).connect(o.referenceGain);

        o.reference.start();
        o.mode = 'reference';

        setAnalyser(o.referenceAnalyser);
      } else {
        o.engine.applyFrameTelemetry(frame);

        await o.engine.init();

        if (token !== generation.current) {
          o.engine.stop();
          return false;
        }

        o.engine.setMuted(muted);
        o.engine.start();
        o.mode = 'changing';

        setAnalyser(o.engine.waveformAnalyser);
      }

      setPlaying(true);
      return true;
    } catch (err) {
      if (token === generation.current) {
        silence();
        setPlaying(false);
        setAnalyser(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to start audio'
        );
      }
      return false;
    }
  }, [getOwner, muted, silence]);

  const applyFrame = useCallback((frame) => {
    const o = owner.current;

    if (frame && o?.mode === 'changing') {
      try {
        o.engine.applyFrameTelemetry(frame);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Invalid telemetry'
        );
      }
    }
  }, []);

  useEffect(() => {
    const o = owner.current;
    if (!o) return;

    o.engine.setMuted(muted);

    o.referenceGain?.gain.rampTo(
      muted ? 0 : 0.10,
      0.04
    );
  }, [muted]);

  useEffect(() => {
    return () => {
      generation.current += 1;
      silence();
      owner.current?.engine.dispose();
      owner.current = null;
    };
  }, [silence]);

  return {
    start,
    stop,
    applyFrame,
    playing,
    muted,
    setMuted,
    error,
    analyser,
  };
}
