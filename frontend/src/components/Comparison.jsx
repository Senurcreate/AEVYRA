import { useCallback, useState } from 'react'
import { ChevronsLeftRight, ImageOff, Pause, Play, Square } from 'lucide-react'
import { formatValue, YEARS } from '../services/earthData'
import { ObservationImage } from './explorer/EarthFrame'
import { useAudio } from '../hooks/useAudio'

function ComparisonSlider({ left, right, yearA, yearB }) {
  const [divider, setDivider] = useState(50)
  const [failed, setFailed] = useState(false)
  const framing = left?.image?.framing
  const aligned = Boolean(framing && framing === right?.image?.framing)

  if (!aligned || failed) return <div className="comparison-unavailable">
    <ImageOff size={27} aria-hidden="true" />
    <p>{failed ? 'One of the images could not load.' : 'Aligned imagery is unavailable for these years.'}</p>
  </div>

  const position = { '--split': divider + '%' }
  return <div className="comparison-stage" style={position}>
    <div className="comparison-layer"><ObservationImage image={right.image} onError={() => setFailed(true)} /></div>
    <div className="comparison-layer comparison-before"><ObservationImage image={left.image} onError={() => setFailed(true)} /></div>
    <div className="comparison-divider" aria-hidden="true"><span><ChevronsLeftRight size={21} /></span></div>
    <div className="comparison-year-tag left" aria-hidden="true">{yearA}</div>
    <div className="comparison-year-tag right" aria-hidden="true">{yearB}</div>
    <input className="comparison-range" type="range" min="0" max="100" value={divider}
      aria-label="Reveal earlier or later Earth image" aria-valuetext={divider + '% of ' + yearA + ' image visible'}
      onChange={event => setDivider(Number(event.target.value))} />
  </div>
}

function YearPicker({ id, label, year, years, setYear }) {
  return <div><label className="instrument-label" htmlFor={id}>{label}</label>
    <select id={id} value={year} onChange={event => setYear(Number(event.target.value))}>
      {years.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
  </div>
}

function YearPanel({ slot, record, years, playing, onSelect, onToggle }) {
  const { year, measurement, audio } = record
  const description = record.story || record.explanation

  return <article className="comparison-panel angular-glass glass-sweep" data-playing={playing || undefined}
    aria-labelledby={'comparison-year-' + slot}>
    <header className="comparison-panel-header">
      <h3 id={'comparison-year-' + slot}>{year}</h3>
      <YearPicker id={'year-' + slot.toLowerCase()} label={'Year ' + slot} year={year} years={years} setYear={onSelect} />
    </header>
    <figure className="comparison-frame">
      <ObservationImage key={year} image={record.image} />
    </figure>
    <div className="comparison-panel-info">
      <div>
        <p className="comparison-measurement">{measurement ? <>{measurement.name} <strong>{formatValue(measurement.value)} {measurement.unit}</strong></> : 'Measurement unavailable'}</p>
        {description && <p>{description}</p>}
      </div>
      <button className="play-button" type="button" disabled={!audio.changing}
        aria-label={(playing ? 'Pause' : 'Play') + ' Year ' + slot + ', ' + year} onClick={onToggle}>
        {playing ? <Pause size={17} fill="currentColor" aria-hidden="true" /> : <Play size={17} fill="currentColor" aria-hidden="true" />}
      </button>
      {!audio.changing && <p className="comparison-audio-missing">Sound unavailable for this year.</p>}
    </div>
  </article>
}

export default function Comparison({ dataset, status }) {
  return <section id="compare" className="shell comparison section-space" aria-labelledby="compare-title">
    <div className="section-heading compare-heading">
      <div><h2 id="compare-title">Then vs Now</h2><p>Two moments in time. One changing planet.</p></div>
    </div>
    {dataset ? <ComparisonPlayer dataset={dataset} /> : <div className="comparison-unavailable">
      <p role="status">{status === 'loading' ? 'Loading comparison observations…' : 'Comparison data could not load. Retry from the Sound Explorer.'}</p>
    </div>}
  </section>
}

function ComparisonPlayer({ dataset }) {
  const years = YEARS.filter(year => dataset.getRecord(year))
  const [yearA, setYearA] = useState(years[0])
  const [yearB, setYearB] = useState(years.at(-1))
  const [playback, setPlayback] = useState(null)
  const left = dataset.getRecord(yearA)
  const right = dataset.getRecord(yearB)
  const a = left?.measurement
  const b = right?.measurement
  const comparable = a && b && a.name === b.name && a.unit === b.unit
  const aligned = Boolean(left?.image?.framing && left.image.framing === right?.image?.framing)
  const bothSounds = Boolean(left?.audio.changing && right?.audio.changing)
  const activeRecord = playback?.slot === 'A' ? left : playback?.slot === 'B' ? right : null
  const finishClip = useCallback(() => {
    setPlayback(current => current === playback
      ? current.sequence && current.slot === 'A' ? { slot: 'B', sequence: true } : null
      : current)
  }, [playback])
  const audio = useAudio(activeRecord?.audio.changing, Boolean(playback), {
    onEnded: playback?.sequence ? finishClip : undefined,
    exclusive: true,
    playbackKey: playback,
  })
  const playing = Boolean(playback && audio.analyser && !audio.error)
  const sequenceActive = Boolean(playback?.sequence && !audio.error)

  function selectYear(slot, year) {
    if (slot === 'A') setYearA(year)
    else setYearB(year)
    if (playback?.sequence || (playback?.slot === slot && !dataset.getRecord(year)?.audio.changing)) setPlayback(null)
  }

  function toggleAudio(slot) {
    if (playback?.slot === slot && !audio.error) {
      setPlayback(null)
      return
    }
    void audio.unlock()
    setPlayback({ slot, sequence: false })
  }

  function playComparison() {
    void audio.unlock()
    setPlayback({ slot: 'A', sequence: true })
  }

  let status = ''
  if (playing) status = 'Playing Year ' + playback.slot + ' · ' + activeRecord.year
  else if (playback && audio.error) status = audio.error
  else if (playback) status = 'Preparing audio…'
  else if (bothSounds) status = 'Ready to compare'
  else status = 'Comparison playback needs sound for both years.'

  return years.length ? <>
    {dataset.demo && <p className="compare-demo instrument-label">Mock comparison · Illustrative imagery and values</p>}
    <div className="comparison-panels">
      {[['A', left], ['B', right]].map(([slot, record]) => <YearPanel key={slot} slot={slot} record={record} years={years}
        playing={playing && playback.slot === slot} onSelect={year => selectYear(slot, year)} onToggle={() => toggleAudio(slot)} />)}
    </div>
    <div className="comparison-transport angular-glass glass-inset">
      <dl><dt>Change from Year A to Year B</dt><dd>{comparable ? formatValue(b.value - a.value, true) + ' ' + b.unit : 'Unavailable'}</dd></dl>
      <div className="comparison-sequence">
        <button className="primary-button" type="button" disabled={!bothSounds}
          onClick={sequenceActive ? () => setPlayback(null) : playComparison}>
          {sequenceActive ? 'Stop Comparison' : 'Play Comparison'}
          {sequenceActive ? <Square size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
        <p role="status" aria-atomic="true">{status}</p>
      </div>
    </div>
    {aligned && <details className="comparison-overlay">
      <summary>Compare aligned images with a slider <ChevronsLeftRight size={16} aria-hidden="true" /></summary>
      <ComparisonSlider key={yearA + '/' + yearB} left={left} right={right} yearA={yearA} yearB={yearB} />
    </details>}
  </> : <div className="comparison-unavailable"><ImageOff size={27} aria-hidden="true" /><p>Global observations are unavailable for comparison.</p></div>
}
