import { useRef } from 'react'
import { AudioLines, Globe2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { YEARS } from '../../services/earthData'

const modes = [
  { id: 'global', label: 'Listen to Earth', Icon: AudioLines },
  { id: 'regional', label: 'Explore by Region', Icon: Globe2 },
]

export function ExplorerTabs({ mode, onChange, regionalAvailable }) {
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
        <Icon size={16} aria-hidden="true" /> {label}
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

export function YearTimeline({ year, onSelect, getRecord }) {
  return <div className="timeline" role="group" aria-label="Select a year">
    {YEARS.map(item => {
      const hasData = Boolean(getRecord(item))
      return <button type="button" key={item} className={'timeline-year' + (hasData ? '' : ' no-data')}
        aria-current={year === item ? 'true' : undefined}
        aria-label={String(item) + (hasData ? '' : ', data unavailable')}
        onClick={() => onSelect(item)}>
        <span className="year-notch" /><span>{item}</span>
      </button>
    })}
  </div>
}

export function PlaybackControls({ timeline, onToggle, muted, onMute }) {
  const { year, select, playing, first, last, speed, setSpeed } = timeline
  return <div className="playback-controls">
    <button type="button" className="play-button" aria-label={playing ? 'Pause timeline' : 'Play timeline'} onClick={onToggle}>
      {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
    </button>
    <button type="button" className="icon-button" aria-label="Previous year" disabled={year === first} onClick={() => select(year - 1)}><SkipBack size={17} /></button>
    <button type="button" className="icon-button" aria-label="Next year" disabled={year === last} onClick={() => select(year + 1)}><SkipForward size={17} /></button>
    <span className="control-divider" aria-hidden="true" />
    <label className="sr-only" htmlFor="speed">Timeline playback speed</label>
    <select id="speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
      {[0.5, 1, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
    </select>
    <button type="button" className="icon-button" aria-label={muted ? 'Unmute audio' : 'Mute audio'} onClick={onMute}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
  </div>
}
