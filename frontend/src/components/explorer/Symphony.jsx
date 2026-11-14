import { Component, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Headphones } from 'lucide-react'
import { EarthFrame } from './EarthFrame'
import { ExplorerTabs, PlaybackControls, RegionSelector, YearTimeline } from './ExplorerControls'
import ScientificReadout from './ScientificReadout'
import SoundPanel from './SoundPanel'
import { useTimeline } from '../../hooks/useTimeline'
import { useExclusiveSonification } from '../../hooks/useExclusiveSonification'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { adaptNightLights } from "../../adapters/nightLightsAdapter";
//import mlFeatures from "../../data/nightLights.features.enriched.json";
import mlFeatures from "../../data/night-lights-features.json";

const EarthGlobe = lazy(() => import('./EarthGlobe'))
const telemetry = adaptNightLights(mlFeatures)
const byYear = new Map(telemetry.map(frame => [frame.year, frame]))

class GlobeBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p className="globe-status" role="status">Globe unavailable. Choose a region from the list.</p> : this.props.children }
}

export default function Symphony({ dataset, status, error, retry }) {
  return <section id="experience" className="shell experience section-space" aria-labelledby="experience-title">
    <div className="experience-heading section-heading">
      <h2 id="experience-title">Earth’s Changing<br className="desktop-break" /> Symphony</h2>
      <div><p>Explore how Earth’s changing measurements become sound, from 2012 to 2023.</p>
        <span className="instrument-label section-note"><Headphones size={15} aria-hidden="true" /> Explore with sound</span></div>
    </div>
    {dataset ? <SymphonyPlayer dataset={dataset} /> : <div className="angular-glass glass-inset">
      {status === 'loading' ? <p role="status">Loading observations…</p> : <><p role="alert">{error}</p><button type="button" className="quiet-button" onClick={retry}>Retry loading observations</button></>}
    </div>}
  </section>
}

function SymphonyPlayer({ dataset }) {
  const [mode, setMode] = useState('global')
  const [globeRequested, setGlobeRequested] = useState(false)
  const [selected, setSelected] = useState(dataset.regions[0]?.id)
  const [track, setTrack] = useState('changing')
  const timeline = useTimeline()
  const reduced = useReducedMotion()
  const audio = useExclusiveSonification()
  const region = mode === 'global' ? 'global' : selected
  const name = mode === 'global' ? 'Global Earth' : dataset.regions.find(item => item.id === selected)?.name
  const record = dataset.getRecord(timeline.year, region)
  const frame = byYear.get(timeline.year)
  const frameKey = region + '-' + timeline.year
  const story = record?.story || record?.explanation || (record
    ? 'A description is unavailable for this observation.'
    : 'There is no observation for ' + name + ' in ' + timeline.year + '. Try another year or region.')

  // Timeline changes update the running Tone.js engine without restarting it.

  console.table(
  telemetry.map(frame => ({
    year: frame.year,
    brightness: frame.metrics.globalIntensity,
    coverage: frame.metrics.litCoverage,
    yearlyChange: frame.metrics.yearOverYearDelta,
    cumulativeChange: frame.metrics.cumulativeDelta,
  }))
  )

  useEffect(() => { audio.applyFrame(frame) }, [frame, audio.applyFrame])
  useEffect(() => { if (mode === 'regional') audio.stop() }, [mode, audio.stop])
  // The existing timeline is authoritative. Stop audio when it finishes or is paused.
  useEffect(() => { if (!timeline.playing && !audio.playing) return
    if (!timeline.playing && audio.playing) audio.stop()
  }, [timeline.playing])

  function selectMode(nextMode) {
    setMode(nextMode)
    if (nextMode === 'regional') { setGlobeRequested(true); audio.stop(); if (timeline.playing) timeline.toggle() }
  }
  async function toggleTimeline() {
    if (timeline.playing) { timeline.toggle(); audio.stop(); return }
    if (mode !== 'global' || !frame) return
    const startYear = timeline.year === timeline.last ? timeline.first : timeline.year
    const startFrame = byYear.get(startYear)
    if (!startFrame) return
    try {
      const started = await audio.start(track, startFrame)
      if (started) timeline.toggle()
    } catch { /* hook surfaces the audio error */ }
  }
  async function selectTrack(nextTrack) {
    if (nextTrack === track) return
    setTrack(nextTrack)
    audio.stop()
    if (timeline.playing && frame) await audio.start(nextTrack, frame)
  }
  function selectYear(year) {
    timeline.select(year)
    audio.stop()
  }
  return <div className="angular-panel angular-glass glass-sweep">
    <div className="explorer-top">
      <ExplorerTabs mode={mode} onChange={selectMode} regionalAvailable={dataset.regions.length > 0} />
      {dataset.demo && <span className="demo-tag"><i className="signal-dot" /> Mock visual data</span>}
    </div>
    <div id="explorer-global" role="tabpanel" aria-labelledby="tab-global" className="explorer-visual" hidden={mode !== 'global'}>
      {mode === 'global' && <EarthFrame key={frameKey} image={record?.image} year={timeline.year} regionId={region} demo={dataset.demo} />}
    </div>
    <div id="explorer-regional" role="tabpanel" aria-labelledby="tab-regional" className="explorer-visual regional-visual" hidden={mode !== 'regional'}>
      <div className="globe-viewport">{globeRequested && <GlobeBoundary><Suspense fallback={<p className="globe-status" role="status">Loading interactive globe…</p>}>
        <EarthGlobe mode={mode} texture={dataset.globeTexture} regions={dataset.regions} selected={selected} onSelect={setSelected} reduced={reduced} />
      </Suspense></GlobeBoundary>}</div>
      {mode === 'regional' && <div className="regional-frame"><RegionSelector regions={dataset.regions} selected={selected} onSelect={setSelected} />
        <EarthFrame key={frameKey} image={record?.image} year={timeline.year} regionId={region} demo={dataset.demo} /></div>}
    </div>
    <div className="explorer-data">
      <ScientificReadout record={record} name={name} year={timeline.year} />
      <SoundPanel audio={audio} track={track} onTrack={selectTrack} reduced={reduced} demo={dataset.demo} available={mode === 'global' && Boolean(frame)} year={timeline.year} />
      <div className="earth-story angular-glass glass-inset" aria-live={timeline.playing ? 'off' : 'polite'} aria-atomic="true">
        <h3 className="instrument-label">EARTH’S STORY {dataset.demo && <span>· DEMO</span>}</h3><p>{story}</p>
      </div>
    </div>
    <div className="explorer-bottom">
      <YearTimeline year={timeline.year} onSelect={selectYear} getRecord={year => dataset.getRecord(year, region)} />
      <div className="transport"><PlaybackControls timeline={timeline} onToggle={toggleTimeline} muted={audio.muted} onMute={() => audio.setMuted(!audio.muted)} />
        <p>{dataset.description || dataset.title}</p></div>
    </div>
    <p className="sr-only" role="status" aria-atomic="true">{timeline.playing ? '' : name + ', ' + timeline.manualYear}</p>
  </div>
}