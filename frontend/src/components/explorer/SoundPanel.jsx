import { useEffect, useRef } from 'react'
import { AudioLines } from 'lucide-react'

function Waveform({ analyser, active, reduced }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let raf
    function draw() {
      const { width, height } = canvas
      context.clearRect(0, 0, width, height)
      context.strokeStyle = active && !reduced ? '#A8E4FF' : 'rgba(168,228,255,0.3)'
      context.lineWidth = 1.75
      context.beginPath()
      // Supports Tone.Analyser (Float32Array in [-1, 1]).
      const samples = analyser && active && !reduced ? analyser.getValue() : null
      const count = samples ? 180 : 2
      for (let i = 0; i < count; i++) {
        const x = width * i / (count - 1)
        const value = samples ? samples[Math.floor(i * samples.length / count)] : 0
        const y = height / 2 - value * height * 0.42
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
      if (samples) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [analyser, active, reduced])
  return <canvas className="waveform" ref={ref} width="600" height="76" aria-hidden="true" />
}

const sounds = [
  ['reference', 'Reference Tone', 'A fixed D3 reference tone; it does not change with the year.'],
  ['changing', 'Earth’s Changing Tone', 'A musical soundscape synthesized from the selected year’s extracted image features.'],
]

export default function SoundPanel({ audio, track, onTrack, reduced, demo, available, year }) {
  return <div className="sound-panel angular-glass glass-inset">
    <div className="sound-title"><AudioLines size={16} aria-hidden="true" /><h3>Listen to Earth’s Changing Story</h3></div>
    <p className="sound-caption sound-intro">Compare a steady reference tone with a data-driven soundscape. Only one plays at a time.</p>
    {demo && <p className="sound-caption sound-demo">Image features are not independently scientifically verified.</p>}
    <div className="sound-switch" role="group" aria-label="Choose a sound to listen to">
      {sounds.map(([id, label, help]) => <div key={id}>
        <button type="button" aria-pressed={track === id} aria-describedby={'sound-help-' + id}
          onClick={() => onTrack(id)}>{label}</button>
        <p id={'sound-help-' + id} className="sound-caption">{help}</p>
      </div>)}
    </div>
    <Waveform analyser={audio.analyser} active={audio.playing && !audio.muted} reduced={reduced} />
    {!available && <p className="sound-status">No ML features available for {year}.</p>}
    {audio.error && <p className="sound-status" role="alert">{audio.error}</p>}
  </div>
}
