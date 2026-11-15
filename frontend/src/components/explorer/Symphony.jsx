import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Headphones } from 'lucide-react'
import { EarthFrame } from './EarthFrame'
import { ExplorerTabs, ObservationTimeline, PlaybackControls, RegionSelector } from './ExplorerControls'
import ScientificReadout from './ScientificReadout'
import SoundPanel from './SoundPanel'
import { useTimeline } from '../../hooks/useTimeline'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { getFeatureFrame } from '../../sonification/adapters/mlFeatures'
import { mapReferenceFrame, SCORE_SECONDS } from '../../sonification/mappings/referenceProfiles'
import { useExclusiveSonification } from '../../sonification/hooks/useExclusiveSonification'

const EarthGlobe = lazy(() => import('./EarthGlobe'))

class GlobeBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <p className="globe-status" role="status">Globe unavailable. Choose a region from the list.</p>
    }
    return this.props.children
  }
}

export default function Symphony({ story, dataset, status, error, retry }) {
  return <section id="experience" className="shell experience section-space" aria-labelledby="experience-title">
    <div className="experience-heading section-heading">
      <h2 id="experience-title">{story.title}</h2>
      {dataset && <span className="instrument-label section-note"><Headphones size={15} aria-hidden="true" /> Explore with sound</span>}
    </div>
    {dataset ? <SymphonyPlayer key={story.path} dataset={dataset} story={story} /> :
      <div className="angular-glass glass-inset">
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
  const { timeline: labels, frameCaption, sonificationId: kind } = story
  const [mode, setMode] = useState('global')
  const [globeRequested, setGlobeRequested] = useState(false)
  const [selected, setSelected] = useState(dataset.regions[0]?.id)
  const [track, setTrack] = useState('changing')
  const timeline = useTimeline(dataset.steps)
  const audio = useExclusiveSonification()
  const reduced = useReducedMotion()
  const region = mode === 'regional' ? selected : 'global'
  const name = mode === 'regional' ? dataset.regions.find(item => item.id === selected)?.name : 'Global Earth'
  const hasFrames = timeline.step !== undefined
  const record = dataset.getRecord(timeline.step, region)
  const globalRecord = dataset.getRecord(timeline.step)
  const frame = getFeatureFrame(kind, timeline.step, region)
  const frameKey = region + '-' + timeline.step
  const stepLabel = hasFrames ? labels.format(timeline.step) : ''
  const mappings = useMemo(() => new Map(dataset.steps.map(step => [
    step, mapReferenceFrame(kind, getFeatureFrame(kind, step, region)),
  ])), [dataset.steps, kind, region])
  const controls = useRef(mappings)
  useLayoutEffect(() => { controls.current = mappings }, [mappings])
  const { schedule } = timeline
  const controlsAt = useCallback(position => controls.current.get(schedule.at(position).step) ?? null, [schedule])
  // The sound travels left to right with the scanner line, which uses this same progress.
  const scanAt = useCallback(position => schedule.at(position).progress, [schedule])

  useEffect(() => {
    audio.applyFrame(frame, kind)
  }, [audio.applyFrame, frame, kind])

  const nextImage = dataset.getRecord(timeline.next, region)?.image ?? dataset.getRecord(timeline.next)?.image
  useEffect(() => {
    if (!nextImage) return
    const image = new Image()
    image.src = nextImage.src
  }, [nextImage])

  async function toggleTimeline() {
    if (timeline.playing) {
      audio.pause()
      timeline.pause(audio.elapsed())
      return
    }
    if (audio.status === 'loading') {
      audio.stop()
      return
    }
    if (!kind) return
    const started = audio.status === 'paused' ? audio.resume() : await audio.start(
      track, frame, kind, {
        controlsAt, scanAt, offset: timeline.offset, duration: schedule.duration, speed: timeline.speed,
        onEnd: timeline.finish, onInterrupt: timeline.pause,
      },
    )
    if (started) timeline.play(audio.elapsed)
  }

  function stopAudio() {
    timeline.pause(timeline.playing ? audio.elapsed() : undefined)
    audio.stop()
  }

  function selectStep(step) {
    const offset = schedule.offsetOf(step)
    if (offset == null) return
    if (timeline.playing || audio.status === 'paused') audio.seek(offset)
    else audio.stop()
    timeline.update(offset)
  }

  function selectSpeed(speed) {
    audio.setSpeed(speed)
    timeline.setSpeed(speed)
  }

  function selectMode(nextMode) {
    setMode(nextMode)
    if (nextMode === 'regional') setGlobeRequested(true)
  }

  function selectTrack(nextTrack) {
    const togglingOff = track === nextTrack && audio.status !== 'idle'
    stopAudio()
    setTrack(nextTrack)
    if (togglingOff || (nextTrack === 'changing' && !frame)) return
    const duration = nextTrack === 'changing' ? SCORE_SECONDS : undefined
    void audio.start(nextTrack, frame, kind, { duration, speed: timeline.speed })
  }

  return <div className="angular-panel angular-glass glass-sweep">
    <div className="explorer-top">
      <ExplorerTabs mode={mode} onChange={selectMode} regionalAvailable={dataset.regions.length > 0}
        globalLabel={kind ? 'Listen to Earth' : hasFrames ? 'Global View' : 'Preview'} />
    </div>

    <div id="explorer-global" role="tabpanel" aria-labelledby="tab-global" className="explorer-visual" hidden={mode !== 'global'}>
      {mode === 'global' && <EarthFrame key={frameKey} image={hasFrames ? record?.image : story.cover}
        step={timeline.step} stepLabel={stepLabel} scannerRef={timeline.scannerRef} regionId={region} demo={dataset.demo} caption={frameCaption} />}
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
        <EarthFrame key={frameKey} image={record?.image ?? globalRecord?.image} step={timeline.step}
          stepLabel={stepLabel} scannerRef={timeline.scannerRef} regionId={region}
          demo={dataset.demo} caption="Global image · regional analysis" />
      </div>}
    </div>

    <div className="explorer-data">
      <ScientificReadout story={story} record={record} name={name} stepLabel={stepLabel} />
    </div>
    <div className="explorer-bottom">
      {hasFrames && <ObservationTimeline step={timeline.step} steps={dataset.steps} labels={labels} onSelect={selectStep}
        getRecord={step => dataset.getRecord(step, region)} />}
      <div className="transport">
        <PlaybackControls timeline={{ ...timeline, select: selectStep, setSpeed: selectSpeed }} labels={labels} onToggle={toggleTimeline}
          muted={audio.muted} hasAudio={Boolean(kind)} onMute={() => audio.setMuted(!audio.muted)} />
        <p>{dataset.description || dataset.title}</p>
      </div>
      {kind && <SoundPanel audio={audio} track={track} onTrack={selectTrack} available={Boolean(frame)} reduced={reduced} onStop={stopAudio} />}
    </div>
    {hasFrames && <p className="sr-only" role="status" aria-atomic="true">{timeline.playing ? '' : name + ', ' + stepLabel}</p>}
  </div>
}
