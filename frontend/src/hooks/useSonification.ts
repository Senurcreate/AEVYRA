import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AevyraAudioEngine,
  type VisualizerReactiveCallback
} from '../audio/AudioEngine';
import type { EicFrameTelemetry } from '../types/sonification';

/** React integration. Audio context starts only after an explicit Play gesture. */
export function useSonification() {
  const engineRef = useRef<AevyraAudioEngine | null>(null);

const engine = useCallback(() => {
  if (!engineRef.current) {
    engineRef.current = new AevyraAudioEngine();
  }

  return engineRef.current;
}, []);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.6);
  const [muted, setMutedState] = useState(false);
  
  useEffect(() => () => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);
  const play = useCallback(async (callback?: VisualizerReactiveCallback) => {
    const instance = engine();
    await instance.init(callback);
    instance.start();
    setPlaying(true);
  }, [engine]);
  const pause = useCallback(() => { engineRef.current?.pause(); setPlaying(false); }, []);
  const stop = useCallback(() => { engineRef.current?.stop(); setPlaying(false); }, []);
  const applyFrame = useCallback((telemetry: EicFrameTelemetry) => engine().applyFrameTelemetry(telemetry), [engine]);
  const setVolume = useCallback((v: number) => {
    setVolumeState(v); engine().setVolume(v);
  }, [engine]);
  const setMuted = useCallback((v: boolean) => {
    setMutedState(v); engine().setMuted(v);
  }, [engine]);
  return { play, pause, stop, applyFrame, playing, volume, muted, setVolume, setMuted };
}
