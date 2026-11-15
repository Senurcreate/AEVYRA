import { useRef } from 'react'
import { AudioLines, Globe2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { PLAYBACK_SPEEDS } from '../../sonification/playback/schedule.js'

const modes = [
  { id: 'global', label: 'Listen to Earth', Icon: AudioLines },
  { id: 'regional', label: 'Explore by Region', Icon: Globe2 },
]

export function ExplorerTabs({ mode, onChange, regionalAvailable, globalLabel }) {
  const refs = useRef({})
  const available = modes.filter(item => item.id === 'global' || regionalAvailable)

  function navigate(event, index) {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % available.length
    else if (event.key === 'ArrowLeft') next = (index + available.length - 1) % available.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = available.length - 1
    else return
    event.preventDefault()
    const id = available[next].id
    onChange(id)
    refs.current[id]?.focus()
  }

  return <div className="explorer-tabs" role="tablist" aria-label="Earth explorer mode">
    {modes.map(({ id, label, Icon }, index) =>
      <button key={id} type="button" id={'tab-' + id} role="tab"
        ref={node => { refs.current[id] = node }}
        aria-selected={mode === id} aria-controls={'explorer-' + id}
        tabIndex={mode === id ? 0 : -1} disabled={id === 'regional' && !regionalAvailable}
        onClick={() => onChange(id)} onKeyDown={event => navigate(event, index)}>
        <Icon size={16} aria-hidden="true" /> {id === 'global' ? globalLabel : label}
      </button>,
    )}
  </div>
}

export function RegionSelector({ regions, selected, onSelect }) {
  return <div className="region-selector">
    <label className="instrument-label" htmlFor="region">Region</label>
    <select id="region" value={selected} onChange={event => onSelect(event.target.value)}>
      {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
    </select>
  </div>
}

export function ObservationTimeline({ step, steps, labels, onSelect, getRecord }) {
  return <div className="timeline" role="group" aria-label={'Select a ' + labels.label.toLowerCase()}
    style={{ '--timeline-wide': Math.min(steps.length, 12), '--timeline-narrow': Math.min(steps.length, 6) }}>
    {steps.map(item => {
      const hasData = Boolean(getRecord(item))
      return <button type="button" key={item} className={'timeline-year' + (hasData ? '' : ' no-data')}
        aria-current={step === item ? 'true' : undefined}
        aria-label={labels.format(item) + (hasData ? '' : ', data unavailable')}
        onClick={() => onSelect(item)}>
        <span className="year-notch" /><span className="timeline-label">{labels.compact?.(item) ?? labels.format(item)}</span>
      </button>
    })}
  </div>
}

export function PlaybackControls({ timeline, labels, onToggle, muted, onMute, hasAudio }) {
  const { step, select, playing, previous, next, speed, setSpeed } = timeline
  const label = labels.label.toLowerCase()
  return <div className="playback-controls">
    <button type="button" className="play-button" aria-label={playing ? 'Pause timeline' : 'Play timeline'} disabled={step === undefined} onClick={onToggle}>
      {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
    </button>
    <button type="button" className="icon-button" aria-label={'Previous ' + label} disabled={previous === undefined} onClick={() => select(previous)}><SkipBack size={17} /></button>
    <button type="button" className="icon-button" aria-label={'Next ' + label} disabled={next === undefined} onClick={() => select(next)}><SkipForward size={17} /></button>
    <span className="control-divider" aria-hidden="true" />
    <label className="sr-only" htmlFor="speed">Timeline playback speed</label>
    <select id="speed" value={speed} disabled={step === undefined} onChange={event => setSpeed(Number(event.target.value))}>
      {PLAYBACK_SPEEDS.map(rate => <option key={rate} value={rate}>{rate}×</option>)}
    </select>
    <button type="button" className="icon-button" aria-label={muted ? 'Unmute audio' : 'Mute audio'} disabled={!hasAudio} onClick={onMute}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
  </div>
}
