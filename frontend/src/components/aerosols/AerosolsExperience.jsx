import { useEffect, useMemo, useRef, useState } from 'react';
import { aerosolFrames, aerosolMetadata, aerosolSource } from '../../adapters/aerosolsAdapter';
import { mapAerosolFrame } from '../../mappings/aerosolsProfile';
import { AerosolsAudioEngine } from '../../audio/AerosolsAudioEngine';
import "../../styles/aerosols.css";

const OWNER = 'aevyra-aerosols';

export default function AerosolsExperience() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [imageMissing, setImageMissing] = useState(false);
  const engineRef = useRef(null);
  const generation = useRef(0);
  const frame = aerosolFrames[index];
  const controls = useMemo(() => mapAerosolFrame(frame), [frame]);

  useEffect(() => {
    const engine = new AerosolsAudioEngine();
    engineRef.current = engine;
    const onClaim = event => {
      if (event.detail?.owner !== OWNER) {
        generation.current += 1;
        engine.stop();
        setPlaying(false);
      }
    };
    window.addEventListener('aevyra:audio-claim', onClaim);
    return () => {
      generation.current += 1;
      window.removeEventListener('aevyra:audio-claim', onClaim);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { engineRef.current?.apply(controls); }, [controls]);
  useEffect(() => { engineRef.current?.setMuted(muted); }, [muted]);
  useEffect(() => { setImageMissing(false); }, [index]);

  useEffect(() => {
    if (!playing || !autoAdvance) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % aerosolFrames.length), 3200);
    return () => window.clearInterval(timer);
  }, [playing, autoAdvance]);

  async function togglePlay() {
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      generation.current += 1;
      engine.stop();
      setPlaying(false);
      return;
    }
    const token = ++generation.current;
    setError('');
    try {
      // This claim stops the existing AEVYRA audio owner before Aerosols starts.
      window.dispatchEvent(new CustomEvent('aevyra:audio-claim', { detail: { owner: OWNER } }));
      await engine.init();
      if (token !== generation.current) return;
      engine.apply(controls);
      engine.setMuted(muted);
      engine.start();
      setPlaying(true);
    } catch (e) {
      if (token === generation.current) {
        engine.stop();
        setPlaying(false);
        setError(e instanceof Error ? e.message : 'Audio could not start.');
      }
    }
  }

  return (
    <section className="aerosols-experience" aria-label="Aerosols sonification">
      <header className="aerosols-heading">
        <div>
          <p className="aerosols-eyebrow">AEVYRA / EARTH INFORMATION JUKEBOX</p>
          <h2>Aerosols · Earth in Motion</h2>
          <p>Hear changing color patterns extracted from NASA's aerosol visualization.</p>
        </div>
        <a href={aerosolSource} target="_blank" rel="noreferrer">NASA source</a>
      </header>

      <div className="aerosols-grid">
        <div className="aerosols-visual">
          {!imageMissing ? (
            <img key={frame.frameId} src={frame.imageUrl} alt={`NASA aerosol visualization, source frame ${frame.frameIndex}`} onError={() => setImageMissing(true)} />
          ) : (
            <div className="aerosols-image-fallback" role="status">
              Image not found: {frame.image}<small>Copy the original frame to frontend/public/aerosols/</small>
            </div>
          )}
          <span className="aerosols-frame-label">{frame.label} · sample {index + 1} of {aerosolFrames.length}</span>
        </div>

        <div className="aerosols-panel">
          <h3>Sonification controls</h3>
          <div className="aerosols-buttons">
            <button type="button" onClick={togglePlay}>{playing ? '■ Stop' : '▶ Play sound'}</button>
            <button type="button" onClick={() => setMuted(v => !v)} aria-pressed={muted}>{muted ? 'Unmute' : 'Mute'}</button>
          </div>
          <label className="aerosols-auto"><input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} /> Advance sampled frames every 3.2 seconds</label>
          <label className="aerosols-slider">Selected frame: {index + 1} / {aerosolFrames.length}
            <input type="range" min="0" max={aerosolFrames.length - 1} value={index} onChange={e => setIndex(Number(e.target.value))} />
          </label>
          <div className="aerosols-buttons">
            <button type="button" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>Previous</button>
            <button type="button" onClick={() => setIndex(i => Math.min(aerosolFrames.length - 1, i + 1))} disabled={index === aerosolFrames.length - 1}>Next</button>
          </div>
          {error && <p className="aerosols-error" role="alert">{error}</p>}
          <dl className="aerosols-stats">
            <div><dt>Image-classified aerosol share</dt><dd>{(frame.aerosolShare * 100).toFixed(2)}%</dd></div>
            <div><dt>Mean image brightness</dt><dd>{frame.meanBrightness.toFixed(4)}</dd></div>
            <div><dt>Image change vs previous sample</dt><dd>{frame.changeVsPrev == null ? 'Baseline sample' : frame.changeVsPrev.toFixed(4)}</dd></div>
            <div><dt>Musical tempo</dt><dd>{controls.tempo} BPM</dd></div>
            <div><dt>Melodic density</dt><dd>{Math.round(controls.density * 100)}%</dd></div>
          </dl>
        </div>
      </div>
      <p className="aerosols-note">This is an image-derived sonification, not a measurement of atmospheric aerosol concentration. The K-means labels and frames have not been independently verified ({aerosolMetadata.frameCount} irregularly selected samples). Musical ranges are normalized within these samples; sample playback is not real-time NASA animation.</p>
    </section>
  );
}
