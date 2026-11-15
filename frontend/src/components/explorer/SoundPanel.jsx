import { useEffect, useRef } from 'react'
import { useHaptics } from '../../sonification/hooks/useHaptics'


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


const sounds = [
  ['reference', 'Reference Tone'],
  ['changing', 'Earth’s Changing Tone'],
];

export default function SoundPanel({
  audio,
  track,
  onTrack,
  available = true,
  reduced,
  onStop,
}) {
  const haptics = useHaptics();
  const active =
    audio.playing &&
    !audio.muted &&
    Boolean(audio.analyser) &&
    !audio.error;

  return (
    <div className="sound-panel angular-glass glass-inset">
      <div
        className="sound-switch"
        role="group"
        aria-label="Choose a sound to listen to"
      >
        {sounds.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={track === id}
            disabled={id === 'changing' && !available}
            onClick={() => onTrack(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <Waveform
        analyser={audio.analyser}
        active={active}
        reduced={reduced}
      />

      {!available && (
        <p className="sound-status">
          ML features are unavailable for this frame and region.
        </p>
      )}

      {audio.status !== 'idle' && (
        <button
          className="quiet-button"
          type="button"
          onClick={onStop}
        >
          Stop sound
        </button>
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

