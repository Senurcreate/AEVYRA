import { useEffect, useRef } from 'react'
import { AudioLines } from 'lucide-react'

function Waveform({ analyser, active, reduced }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const context = canvas.getContext('2d')
    if (!context) return
    const data = analyser ? new Uint8Array(analyser.fftSize) : null
    let frame
    const stationary = !analyser || !active || reduced
    function draw() {
      const { width, height } = canvas
      context.clearRect(0, 0, width, height)
      context.strokeStyle = stationary ? 'rgba(168,228,255,0.3)' : '#A8E4FF'
      context.lineWidth = 1.75
      context.beginPath()
      if (!stationary) analyser.getByteTimeDomainData(data)
      const count = stationary ? 2 : 180
      for (let i = 0; i < count; i++) {
        const x = width * i / (count - 1)
        const sample = stationary ? 128 : data[i * 3]
        const y = height / 2 + (sample - 128) * height / 93
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
      if (!stationary) frame = window.requestAnimationFrame(draw)
    }
    draw()
    return () => window.cancelAnimationFrame(frame)
  }, [active, analyser, reduced])

  return <canvas className="waveform" ref={ref} width="600" height="76" aria-hidden="true" />
}

const sounds = [
  ['reference', 'Reference Tone', 'The steady sound used for comparison.'],
  ['changing', 'Earth’s Changing Tone', 'The sound that follows the selected data.'],
]

export default function SoundPanel({ audio, track, onTrack, preview, playing, source, reduced, demo, onStop }) {
  const active = (preview || playing) && Boolean(source) && !audio.muted && Boolean(audio.analyser) && !audio.error
  return <div className="sound-panel angular-glass glass-inset">
    <div className="sound-title"><AudioLines size={16} aria-hidden="true" /><h3>Listen to Earth’s Changing Story</h3></div>
    <p className="sound-caption sound-intro">Two sounds tell one story. The reference tone stays constant, while Earth’s changing tone responds to scientific measurements over time. Listen to how the relationship between them changes as you explore different years.</p>
    {demo && <p className="sound-caption sound-demo">In this demo, the changing tone follows fictional values.</p>}
    <div className="sound-switch" role="group" aria-label="Choose a sound to listen to">
      {sounds.map(([id, label, help]) => <div key={id}>
        <button type="button" aria-pressed={track === id} aria-describedby={'sound-help-' + id}
          onClick={() => onTrack(id)}>{label}</button>
        <p id={'sound-help-' + id} className="sound-caption">{help}</p>
      </div>)}
    </div>
    <Waveform analyser={audio.analyser} active={active} reduced={reduced} />
    {!source && <p className="sound-status">This sound is unavailable for the selected year and region.</p>}
    {preview && !playing && <button className="quiet-button" type="button" onClick={onStop}>Stop sound</button>}
    {audio.error && source && (preview || playing) && <p className="sound-status" role="status">{audio.error}</p>}
  </div>
}
