import { useEffect, useRef, useState } from 'react'
import { ChevronsLeftRight, ImageOff, Pause, Play, Square } from 'lucide-react'
import { formatValue } from '../services/earthData'
import { ObservationImage } from './explorer/EarthFrame'
import { useExclusiveSonification } from '../sonification/hooks/useExclusiveSonification'
import { adaptNightLights } from '../sonification/adapters/nightLightsAdapter'
import nightLightsFeatures from '../data/night-lights-features.json'

const telemetry = adaptNightLights(nightLightsFeatures)
const telemetryByYear = new Map(telemetry.map(frame => [Number(frame.year), frame]))
const CLIP_MS = 4000
const GAP_MS = 300

function ComparisonSlider({ left, right, labelA, labelB, period }) {
  const [divider, setDivider] = useState(50)
  const [failed, setFailed] = useState(false)
  const framing = left?.image?.framing
  const aligned = Boolean(framing && framing === right?.image?.framing)
  if (!aligned || failed) return <div className="comparison-unavailable">
    <ImageOff size={27} aria-hidden="true" />
    <p>{failed ? 'One of the images could not load.' : `Aligned imagery is unavailable for these ${period}.`}</p>
  </div>
  return <div className="comparison-stage" style={{ '--split': divider + '%' }}>
    <div className="comparison-layer"><ObservationImage image={right.image} onError={() => setFailed(true)} /></div>
    <div className="comparison-layer comparison-before"><ObservationImage image={left.image} onError={() => setFailed(true)} /></div>
    <div className="comparison-divider" aria-hidden="true"><span><ChevronsLeftRight size={21} /></span></div>
    <div className="comparison-year-tag left" aria-hidden="true">{labelA}</div>
    <div className="comparison-year-tag right" aria-hidden="true">{labelB}</div>
    <input className="comparison-range" type="range" min="0" max="100" value={divider}
      aria-label="Reveal earlier or later Earth image" aria-valuetext={divider + '% of ' + labelA + ' image visible'}
      onChange={event => setDivider(Number(event.target.value))} />
  </div>
}

function ObservationPicker({ id, label, step, steps, format, onSelect }) {
  return <div><label className="instrument-label" htmlFor={id}>{label}</label>
    <select id={id} value={step} onChange={event => onSelect(Number(event.target.value))}>
      {steps.map(value => <option key={value} value={value}>{format(value)}</option>)}
    </select>
  </div>
}

function ObservationPanel({ slot, record, steps, labels, playing, available, onSelect, onToggle }) {
  const { step, measurement } = record
  const label = labels.label + ' ' + slot
  const description = record.story || record.explanation
  return <article className="comparison-panel angular-glass glass-sweep" data-playing={playing || undefined}
    aria-labelledby={'comparison-year-' + slot}>
    <header className="comparison-panel-header">
      <h3 id={'comparison-year-' + slot}>{labels.format(step)}</h3>
      <ObservationPicker id={labels.label.toLowerCase() + '-' + slot.toLowerCase()} label={label} step={step} steps={steps} format={labels.format} onSelect={onSelect} />
    </header>
    <figure className="comparison-frame"><ObservationImage key={step} image={record.image} /></figure>
    <div className="comparison-panel-info">
      <div>
        <p className="comparison-measurement">{measurement ? <>{measurement.name} <strong>{formatValue(measurement.value)} {measurement.unit}</strong></> : 'Measurement unavailable'}</p>
        {description && <p>{description}</p>}
      </div>
      <button className="play-button" type="button" disabled={!available}
        aria-label={(playing ? 'Stop ' : 'Play ') + label + ', ' + labels.format(step)} onClick={onToggle}>
        {playing ? <Pause size={17} fill="currentColor" aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" />}
      </button>
      {!available && <p className="comparison-audio-missing">Sonification telemetry unavailable for this {labels.label.toLowerCase()}.</p>}
    </div>
  </article>
}

export default function Comparison({ dataset, status, labels }) {
  return <section id="compare" className="shell comparison section-space" aria-labelledby="compare-title">
    <div className="section-heading compare-heading">
      <div><h2 id="compare-title">Then vs Now</h2><p>Two moments in time. One changing planet.</p></div>
    </div>
    {dataset ? <ComparisonPlayer dataset={dataset} labels={labels} /> : <div className="comparison-unavailable">
      {status === 'unavailable' && <><ImageOff size={27} aria-hidden="true" /><p>Frames are unavailable for comparison.</p></>}
      {status === 'loading' && <p role="status">Loading comparison observations…</p>}
      {status === 'error' && <p role="status">Comparison data could not load. Retry from the Sound Explorer.</p>}
    </div>}
  </section>
}

function ComparisonPlayer({ dataset, labels }) {
  const steps = dataset.steps.filter(step => dataset.getRecord(step))
  const [stepA, setStepA] = useState(steps[0])
  const [stepB, setStepB] = useState(steps.at(-1))
  const [playback, setPlayback] = useState(null)
  const [message, setMessage] = useState('')
  const timers = useRef([])
  const runId = useRef(0)
  const audio = useExclusiveSonification()
  const left = dataset.getRecord(stepA)
  const right = dataset.getRecord(stepB)
  const frameA = telemetryByYear.get(Number(stepA))
  const frameB = telemetryByYear.get(Number(stepB))
  const bothSounds = Boolean(frameA && frameB)
  const a = left?.measurement
  const b = right?.measurement
  const comparable = a && b && a.name === b.name && a.unit === b.unit
  const aligned = Boolean(left?.image?.framing && left.image.framing === right?.image?.framing)

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  function stop() {
    runId.current += 1
    clearTimers()
    audio.stop()
    setPlayback(null)
  }
  // Clean up on unmount. The hook also disposes its Tone nodes.
  useEffect(() => () => {
    runId.current += 1
    timers.current.forEach(clearTimeout)
  }, [])

  async function startSlot(slot, sequence = false) {
    const frame = slot === 'A' ? frameA : frameB
    if (!frame) return
    stop()
    const id = runId.current
    setMessage('Preparing audio…')
    const started = await audio.start('changing', frame, 'night-lights')
    if (id !== runId.current) return
    if (!started) {
      setMessage('Unable to start sonification. Check browser audio permissions and console.')
      return
    }
    setPlayback({ slot, sequence })
    setMessage(`Playing ${labels.label} ${slot} · ${labels.format(slot === 'A' ? stepA : stepB)}`)
    timers.current.push(setTimeout(async () => {
      if (id !== runId.current) return
      audio.stop()
      setPlayback(null)
      if (!sequence || slot !== 'A') {
        setMessage(sequence ? 'Comparison complete' : 'Playback complete')
        return
      }
      setMessage('Switching to Year B…')
      timers.current.push(setTimeout(async () => {
        if (id !== runId.current) return
        const secondStarted = await audio.start('changing', frameB, 'night-lights')
        if (id !== runId.current) return
        if (!secondStarted) {
          setMessage('Unable to play Year B')
          return
        }
        setPlayback({ slot: 'B', sequence: true })
        setMessage(`Playing ${labels.label} B · ${labels.format(stepB)}`)
        timers.current.push(setTimeout(() => {
          if (id !== runId.current) return
          audio.stop()
          setPlayback(null)
          setMessage('Comparison complete')
        }, CLIP_MS))
      }, GAP_MS))
    }, CLIP_MS))
  }

  function selectStep(slot, step) {
    stop()
    setMessage('')
    if (slot === 'A') setStepA(step)
    else setStepB(step)
  }
  function toggleAudio(slot) {
    if (playback?.slot === slot) stop()
    else void startSlot(slot)
  }
  const change = comparable ? `${formatValue(b.value - a.value, true)} ${b.unit === '%' ? 'percentage points' : b.unit}` : 'Unavailable'
  const status = audio.error || message || (bothSounds ? 'Ready to compare' : 'Sonification telemetry is missing for one or both years.')

  return steps.length ? <>
    {dataset.demo && <p className="compare-demo instrument-label">Mock comparison · Illustrative imagery and values</p>}
    <p className="compare-demo instrument-label">Live sonification · Image-derived Night Lights features · {CLIP_MS / 1000}s per year</p>
    <div className="comparison-panels">
      {[['A', left, frameA], ['B', right, frameB]].map(([slot, record, frame]) =>
        <ObservationPanel key={slot} slot={slot} record={record} steps={steps} labels={labels}
          playing={playback?.slot === slot} available={Boolean(frame)}
          onSelect={step => selectStep(slot, step)} onToggle={() => toggleAudio(slot)} />)}
    </div>
    <div className="comparison-transport angular-glass glass-inset">
      <dl><dt>Change from {labels.label} A to {labels.label} B</dt><dd>{change}</dd></dl>
      <div className="comparison-sequence">
        <button className="primary-button" type="button" disabled={!bothSounds}
          onClick={playback?.sequence ? stop : () => void startSlot('A', true)}>
          {playback?.sequence ? 'Stop Comparison' : 'Play Comparison'}
          {playback?.sequence ? <Square size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
        <p role="status" aria-atomic="true">{status}</p>
      </div>
    </div>
    {aligned && <details className="comparison-overlay">
      <summary>Compare aligned images with a slider <ChevronsLeftRight size={16} aria-hidden="true" /></summary>
      <ComparisonSlider key={stepA + '/' + stepB} left={left} right={right} labelA={labels.format(stepA)} labelB={labels.format(stepB)} period={labels.plural} />
    </details>}
  </> : <div className="comparison-unavailable"><ImageOff size={27} aria-hidden="true" /><p>Global observations are unavailable for comparison.</p></div>
}
