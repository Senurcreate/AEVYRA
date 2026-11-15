import { useEffect, useRef } from 'react'
import { useHaptics } from '../../sonification/hooks/useHaptics'
import { soundLayerLabels, soundLayerNames, soundLayers } from '../../sonification/mappings/soundLayers'


function Waveform({ analyser, active, reduced }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!context) return;

    let animationId;

    const draw = () => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);

      const stationary = !active || !analyser || reduced;

      context.strokeStyle = stationary
        ? 'rgba(168,228,255,0.3)'
        : '#A8E4FF';

      context.lineWidth = 1.75;
      context.beginPath();

      const samples = stationary
        ? null
        : analyser.getValue();

      const count = stationary ? 2 : 180;

      for (let i = 0; i < count; i++) {
        const x = (width * i) / (count - 1);

        const index = samples
          ? Math.min(
              samples.length - 1,
              Math.floor(
                (i / (count - 1)) * samples.length
              )
            )
          : 0;

        const value = samples ? samples[index] : 0;
        const y = height / 2 + value * height * 0.4;

        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }

      context.stroke();

      if (!stationary) {
        animationId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyser, active, reduced]);

  return (
    <canvas
      className="waveform"
      ref={ref}
      width="600"
      height="76"
      aria-hidden="true"
    />
  );
}


export default function SoundPanel({
  audio,
  kind,
  available,
  availabilityExplained,
  reduced,
}) {
  const haptics = useHaptics();
  const active =
    audio.playing &&
    !audio.muted &&
    Boolean(audio.analyser) &&
    !audio.error;

  return (
    <div className="sound-panel">
      <Waveform
        analyser={audio.analyser}
        active={active}
        reduced={reduced}
      />

      {!available && !availabilityExplained && (
        <p className="sound-status">
          ML features are unavailable for this frame and region.
        </p>
      )}

      {audio.status === 'loading' && (
        <p className="sound-status" role="status">Preparing audio…</p>
      )}

      {kind && soundLayers[kind] && (
        <details className="sound-layers">
          <summary>Sound layers</summary>
          <p className="sound-status">Five layers make up the sound. Switch one off to hear what it adds.</p>
          <ul>
            {soundLayerNames.map(name => {
              const layer = soundLayers[kind][name]
              const off = audio.mutedLayers.includes(name)
              return (
                <li key={name}>
                  <div className="layer-text">
                    <strong>{soundLayerLabels[name]}</strong>
                    <span className="layer-basis">{layer.basis === 'data' ? 'Follows the data' : 'Atmosphere only'}</span>
                    <span>{layer.plain}</span>
                  </div>
                  <button
                    className="layer-switch"
                    type="button"
                    role="switch"
                    aria-checked={!off}
                    aria-label={soundLayerLabels[name]}
                    onClick={() => audio.toggleLayer(kind, name)}
                  >
                    <span className="layer-switch-text layer-switch-on" aria-hidden="true">ON</span>
                    <span className="layer-switch-text layer-switch-off" aria-hidden="true">OFF</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {haptics.supported && (
        <>
          <button
            className="quiet-button"
            type="button"
            aria-pressed={haptics.enabled}
            onClick={() => haptics.setEnabled(!haptics.enabled)}
          >
            Vibration: {haptics.enabled ? 'On' : 'Off'}
          </button>
          {haptics.enabled && (
            <p className="sound-status">
              The phone vibrates with the notes. If you feel nothing, turn off Do Not Disturb.
            </p>
          )}
        </>
      )}

      {audio.error && (
        <p className="sound-status" role="alert">
          {audio.error}
        </p>
      )}
    </div>
  );
}

