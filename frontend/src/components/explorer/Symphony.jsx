import { Component, lazy, Suspense, useState } from 'react'
import { Headphones } from 'lucide-react'
import { EarthFrame } from './EarthFrame'
import { ExplorerTabs, ObservationTimeline, PlaybackControls, RegionSelector } from './ExplorerControls'
import ScientificReadout from './ScientificReadout'
import SoundPanel from './SoundPanel'
import { useTimeline } from '../../hooks/useTimeline'
import { useAudio } from '../../hooks/useAudio'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const EarthGlobe = lazy(() => import('./EarthGlobe'))

class GlobeBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p className="globe-status" role="status">Globe unavailable. Choose a region from the list.</p> : this.props.children
  }
}

export default function Symphony({ story, dataset, status, error, retry }) {
  return <section id="experience" className="shell experience section-space" aria-labelledby="experience-title">
    <div className="experience-heading section-heading">
      <h2 id="experience-title">{story.title}</h2>
      {dataset?.hasAudio && <span className="instrument-label section-note"><Headphones size={15} aria-hidden="true" /> Explore with sound</span>}
    </div>
    {dataset ? <SymphonyPlayer dataset={dataset} story={story} /> : <div className="angular-glass glass-inset">
      {status === 'unavailable' && <p>{story.description}</p>}
      {status === 'loading' && <p role="status">Loading observations…</p>}
      {status === 'error' && <>
        <p role="alert">{error}</p>
        <button type="button" className="quiet-button" onClick={retry}>Retry loading observations</button>
      </>}
    </div>}
  </section>
}

function SymphonyPlayer({ dataset, story }) {
  const { timeline: labels, frameCaption } = story
  const [mode, setMode] = useState('global')
  const [globeRequested, setGlobeRequested] = useState(false)
  const [selected, setSelected] = useState(dataset.regions[0]?.id)
  const [track, setTrack] = useState('changing')
  const [preview, setPreview] = useState(false)
  const timeline = useTimeline(dataset.steps)
  const hasFrames = timeline.step !== undefined
  const reduced = useReducedMotion()
  const region = mode === 'global' ? 'global' : selected
  const name = mode === 'global' ? 'Global Earth' : dataset.regions.find(item => item.id === selected)?.name
  const record = dataset.getRecord(timeline.step, region)
  const source = record?.audio[track] ?? null
  const audio = useAudio(source, timeline.playing || preview)
  const frameKey = region + '-' + timeline.step
  const stepLabel = hasFrames ? labels.format(timeline.step) : ''
  const timeLabel = hasFrames && frameCaption ? labels.label + ' ' + stepLabel : stepLabel

  function selectMode(nextMode) {
    setMode(nextMode)
    if (nextMode === 'regional') setGlobeRequested(true)
  }

  function toggleTimeline() {
    if (!timeline.playing && dataset.hasAudio) void audio.unlock()
    setPreview(false)
    timeline.toggle()
  }

  function selectTrack(nextTrack) {
    const shouldPlay = nextTrack !== track || !preview
    if ((timeline.playing || shouldPlay) && record?.audio[nextTrack]) void audio.unlock()
    setTrack(nextTrack)
    if (!timeline.playing) setPreview(shouldPlay && Boolean(record?.audio[nextTrack]))
  }

  return <div className="angular-panel angular-glass glass-sweep">
    <div className="explorer-top">
      <ExplorerTabs mode={mode} onChange={selectMode} regionalAvailable={dataset.regions.length > 0}
        globalLabel={dataset.hasAudio ? 'Listen to Earth' : hasFrames ? 'Global View' : 'Preview'} />
      {dataset.demoAudio && <span className="demo-tag"><i className="signal-dot" /> Demo audio</span>}
    </div>
    <div id="explorer-global" role="tabpanel" aria-labelledby="tab-global" className="explorer-visual" hidden={mode !== 'global'}>
      {mode === 'global' && <EarthFrame key={frameKey} image={hasFrames ? record?.image : story.cover} stepLabel={timeLabel} regionId={region} demo={dataset.demo} caption={frameCaption} />}
    </div>
    <div id="explorer-regional" role="tabpanel" aria-labelledby="tab-regional" className="explorer-visual regional-visual" hidden={mode !== 'regional'}>
      <div className="globe-viewport">
        {globeRequested && <GlobeBoundary>
          <Suspense fallback={<p className="globe-status" role="status">Loading interactive globe…</p>}>
            <EarthGlobe mode={mode} texture={dataset.globeTexture} regions={dataset.regions} selected={selected} onSelect={setSelected} reduced={reduced} />
          </Suspense>
        </GlobeBoundary>}
      </div>
      {mode === 'regional' && <div className="regional-frame">
        <RegionSelector regions={dataset.regions} selected={selected} onSelect={setSelected} />
        <EarthFrame key={frameKey} image={record?.image} stepLabel={timeLabel} regionId={region} demo={dataset.demo || dataset.demoRegions} caption={frameCaption} />
      </div>}
    </div>
    <div className="explorer-data">
      <ScientificReadout story={story} record={record} name={name} stepLabel={timeLabel} demoRegion={mode === 'regional' && dataset.demoRegions} />
    </div>
    <div className="explorer-bottom">
      {hasFrames && <ObservationTimeline step={timeline.step} steps={dataset.steps} labels={labels} onSelect={timeline.select} getRecord={step => dataset.getRecord(step, region)} />}
      <div className="transport">
        <PlaybackControls timeline={timeline} labels={labels} onToggle={toggleTimeline} muted={audio.muted} hasAudio={dataset.hasAudio} onMute={() => audio.setMuted(!audio.muted)} />
        <p>{dataset.description || dataset.title}{hasFrames && !dataset.hasAudio && ' Audio is pending.'}</p>
      </div>
      {dataset.hasAudio && <SoundPanel audio={audio} track={track} onTrack={selectTrack} preview={preview} playing={timeline.playing}
        source={source} reduced={reduced} demo={dataset.demoAudio} onStop={() => setPreview(false)} />}
    </div>
    {hasFrames && <p className="sr-only" role="status" aria-atomic="true">{timeline.playing ? '' : name + ', ' + labels.format(timeline.manualStep)}</p>}
  </div>
}
