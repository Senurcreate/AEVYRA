import { useEffect, useRef } from 'react'

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
  ['reference', 'Reference Tone'],
  ['changing', 'Earth’s Changing Tone'],
]

export default function SoundPanel({ audio, track, onTrack, preview, playing, source, reduced, demo, onStop }) {
  const active = (preview || playing) && Boolean(source) && !audio.muted && Boolean(audio.analyser) && !audio.error
  return <div className="sound-panel angular-glass glass-inset">
    <div className="sound-switch" role="group" aria-label="Choose a sound to listen to">
      {sounds.map(([id, label]) => <button key={id} type="button" aria-pressed={track === id} onClick={() => onTrack(id)}>{label}</button>)}
    </div>
    <Waveform analyser={audio.analyser} active={active} reduced={reduced} />
    {demo && <p className="sound-caption">Demo tones follow an illustrative index separate from the image analysis.</p>}
    {!source && <p className="sound-status">This tone is unavailable for the selected view.</p>}
    {preview && !playing && <button className="quiet-button" type="button" onClick={onStop}>Stop sound</button>}
    {audio.error && source && (preview || playing) && <p className="sound-status" role="status">{audio.error}</p>}
  </div>
}
