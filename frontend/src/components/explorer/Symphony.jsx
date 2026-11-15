
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Headphones } from 'lucide-react';

import { EarthFrame } from './EarthFrame';
import {
  ExplorerTabs,
  ObservationTimeline,
  PlaybackControls,
  RegionSelector,
} from './ExplorerControls';
import ScientificReadout from './ScientificReadout';
import SoundPanel from './SoundPanel';

import { useTimeline } from '../../hooks/useTimeline';
import { useReducedMotion } from '../../hooks/useReducedMotion';

import { useExclusiveSonification } from '../../sonification/hooks/useExclusiveSonification';
import { adaptNightLights } from '../../sonification/adapters/nightLightsAdapter';
import nightLightsFeatures from '../../data/night-lights-features.json';

const EarthGlobe = lazy(() => import('./EarthGlobe'));

// -------------------------------------------------------
// Night Lights ML telemetry
// -------------------------------------------------------

const nightLightsTelemetry = adaptNightLights(
  nightLightsFeatures
);

const telemetryByYear = new Map(
  nightLightsTelemetry.map((frame) => [
    Number(frame.year),
    frame,
  ])
);

/**
 * Resolve a telemetry frame from either:
 * - a year, such as 2012
 * - an index, such as 0
 *
 * Also handles numeric strings.
 */
function resolveFrame(step, steps = []) {
  if (step === undefined || step === null) {
    return null;
  }

  const numericStep = Number(step);

  // First try the year directly.
  if (telemetryByYear.has(numericStep)) {
    return telemetryByYear.get(numericStep);
  }

  // Then try its position in dataset.steps.
  const index = steps.findIndex(
    (value) => String(value) === String(step)
  );

  if (index >= 0 && index < nightLightsTelemetry.length) {
    return nightLightsTelemetry[index];
  }

  // Finally support a zero-based index directly.
  if (
    Number.isInteger(numericStep) &&
    numericStep >= 0 &&
    numericStep < nightLightsTelemetry.length
  ) {
    return nightLightsTelemetry[numericStep];
  }

  return null;
}

/**
 * Prevent the Night Lights engine from being connected
 * to a completely different Earth story.
 */
function isNightLightsStory(story, dataset) {
  const identifiers = [
    story?.id,
    story?.slug,
    dataset?.id,
    dataset?.storyId,
    nightLightsFeatures?.storyId,
  ];

  const selectedIdentifiers = identifiers
    .slice(0, 4)
    .filter(Boolean);

  const hasNightLightsIdentifier = selectedIdentifiers.some(
    (value) => {
      const id = String(value).toLowerCase();
      return (
        id.includes('night-light') ||
        id.includes('night_light') ||
        id.includes('nightlight')
      );
    }
  );

  if (hasNightLightsIdentifier) {
    return true;
  }

  // Fallback for datasets without a story ID:
  // match a Night Lights title and a compatible timeline.
  const title = [
    story?.title,
    dataset?.title,
  ].filter(Boolean).join(' ').toLowerCase();

  const titleMatches =
    title.includes('night') &&
    title.includes('light');

  const steps = dataset?.steps ?? [];

  const timelineMatches =
    steps.length > 0 &&
    steps.every((step) => {
      const year = Number(step);
      return (
        telemetryByYear.has(year) ||
        (
          Number.isInteger(year) &&
          year >= 0 &&
          year < nightLightsTelemetry.length
        )
      );
    });

  return titleMatches && timelineMatches;
}

// -------------------------------------------------------
// Globe error boundary
// -------------------------------------------------------

class GlobeBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="globe-status" role="status">
          Globe unavailable. Choose a region from the list.
        </p>
      );
    }

    return this.props.children;
  }
}

// -------------------------------------------------------
// Main Symphony section
// -------------------------------------------------------

export default function Symphony({
  story,
  dataset,
  status,
  error,
  retry,
}) {
  return (
    <section
      id="experience"
      className="shell experience section-space"
      aria-labelledby="experience-title"
    >
      <div className="experience-heading section-heading">
        <h2 id="experience-title">
          {story?.title}
        </h2>

        {dataset && (
          <span className="instrument-label section-note">
            <Headphones
              size={15}
              aria-hidden="true"
            />
            Explore with sound
          </span>
        )}
      </div>

      {dataset ? (
        <SymphonyPlayer
          key={story?.id ?? dataset?.id ?? 'earth'}
          dataset={dataset}
          story={story}
        />
      ) : (
        <div className="angular-glass glass-inset">
          {status === 'unavailable' && (
            <p>{story?.description}</p>
          )}

          {status === 'loading' && (
            <p role="status">
              Loading observations…
            </p>
          )}

          {status === 'error' && (
            <>
              <p role="alert">{error}</p>

              <button
                type="button"
                className="quiet-button"
                onClick={retry}
              >
                Retry loading observations
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------
// Symphony player
// -------------------------------------------------------

function SymphonyPlayer({ dataset, story }) {
  const { timeline: labels, frameCaption } = story;

  const [mode, setMode] = useState('global');
  const [globeRequested, setGlobeRequested] =
    useState(false);

  const [selected, setSelected] = useState(
    dataset.regions?.[0]?.id
  );

  const [track, setTrack] = useState('changing');

  const timeline = useTimeline(dataset.steps);
  const reduced = useReducedMotion();
  const audio = useExclusiveSonification();

  // Detect a true -> false timeline transition.
  const previousTimelinePlaying = useRef(
    timeline.playing
  );

  const hasFrames =
    timeline.step !== undefined &&
    timeline.step !== null;

  const region =
    mode === 'global'
      ? 'global'
      : selected;

  const name =
    mode === 'global'
      ? 'Global Earth'
      : dataset.regions?.find(
          (item) => item.id === selected
        )?.name ?? 'Selected Region';

  const record = dataset.getRecord(
    timeline.step,
    region
  );

  // -----------------------------------------------------
  // Select Night Lights telemetry
  // -----------------------------------------------------

  const isNightLights = isNightLightsStory(
    story,
    dataset
  );

  const frame = isNightLights
    ? resolveFrame(
        timeline.step,
        dataset.steps
      )
    : null;

  const available =
    isNightLights &&
    mode === 'global' &&
    Boolean(frame);

  const frameKey = `${region}-${timeline.step}`;

  const stepLabel = hasFrames
    ? labels.format(timeline.step)
    : '';

  const timeLabel =
    hasFrames && frameCaption
      ? `${labels.label} ${stepLabel}`
      : stepLabel;

  // -----------------------------------------------------
  // Apply telemetry whenever the year changes
  // -----------------------------------------------------

  useEffect(() => {
    if (!available || !frame) {
      return;
    }

    audio.applyFrame(frame);

    console.log(
      '[AEVYRA] Night Lights frame applied:',
      {
        year: frame.year,
        frameIndex: frame.frameIndex,
        metrics: frame.metrics,
      }
    );
  }, [
    available,
    frame,
    audio.applyFrame,
  ]);

  // Stop sound if the selected view has no sonification.
  useEffect(() => {
    if (!available) {
      audio.stop();
    }
  }, [
    available,
    audio.stop,
  ]);

  // Stop audio when the timeline reaches its end.
  // Do not stop independently started sound previews.
  useEffect(() => {
    if (
      previousTimelinePlaying.current &&
      !timeline.playing
    ) {
      audio.stop();
    }

    previousTimelinePlaying.current =
      timeline.playing;
  }, [
    timeline.playing,
    audio.stop,
  ]);

  // -----------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------

  useEffect(() => {
    console.log(
      '[AEVYRA] Night Lights connection:',
      {
        storyId: story?.id,
        datasetId: dataset?.id,
        currentStep: timeline.step,
        isNightLights,
        frameFound: Boolean(frame),
        frameYear: frame?.year,
        available,
      }
    );
  }, [
    story?.id,
    dataset?.id,
    timeline.step,
    isNightLights,
    frame,
    available,
  ]);

  // -----------------------------------------------------
  // Mode switching
  // -----------------------------------------------------

  function selectMode(nextMode) {
    if (nextMode === mode) {
      return;
    }

    audio.stop();

    if (timeline.playing) {
      timeline.toggle();
    }

    setMode(nextMode);

    if (nextMode === 'regional') {
      setGlobeRequested(true);
    }
  }

  // -----------------------------------------------------
  // Main Play / Pause button
  // -----------------------------------------------------

  async function toggleTimeline() {
    console.log('[AEVYRA] Play clicked');

    if (timeline.playing) {
      timeline.toggle();
      audio.stop();
      return;
    }

    if (!available) {
      console.error(
        '[AEVYRA] Cannot start playback:',
        {
          storyId: story?.id,
          isNightLights,
          mode,
          step: timeline.step,
          frameFound: Boolean(frame),
        }
      );
      return;
    }

    const steps = dataset.steps ?? [];

    if (!steps.length) {
      console.error(
        '[AEVYRA] Dataset has no timeline steps.'
      );
      return;
    }

    const lastStep = steps.at(-1);

    // useTimeline restarts at the first step when
    // the current step is the last one.
    const startStep =
      timeline.step === lastStep
        ? steps[0]
        : timeline.step;

    const startFrame = resolveFrame(
      startStep,
      steps
    );

    if (!startFrame) {
      console.error(
        '[AEVYRA] Telemetry not found:',
        startStep
      );
      return;
    }

    try {
      console.log(
        '[AEVYRA] Starting sonification:',
        {
          track,
          year: startFrame.year,
          metrics: startFrame.metrics,
        }
      );

      const started = await audio.start(
        track,
        startFrame
      );

      if (!started) {
        console.error(
          '[AEVYRA] Audio engine failed to start.'
        );
        return;
      }

      // Start timeline only after Tone.js succeeds.
      timeline.toggle();

      console.log(
        '[AEVYRA] Playback started successfully.'
      );
    } catch (err) {
      console.error(
        '[AEVYRA] Playback error:',
        err
      );
    }
  }

  // -----------------------------------------------------
  // Reference / Changing tone selection
  // -----------------------------------------------------

  async function selectTrack(nextTrack) {
    if (!available || !frame) {
      return;
    }

    if (nextTrack === track) {
      if (audio.playing) {
        audio.stop();

        if (timeline.playing) {
          timeline.toggle();
        }
      } else {
        await audio.start(
          nextTrack,
          frame
        );
      }

      return;
    }

    audio.stop();
    setTrack(nextTrack);

    // Selecting a tone can preview it immediately.
    // The timeline is not started automatically.
    try {
      await audio.start(
        nextTrack,
        frame
      );
    } catch (err) {
      console.error(
        '[AEVYRA] Track selection error:',
        err
      );
    }
  }

  // -----------------------------------------------------
  // Manual timeline selection
  // -----------------------------------------------------

  function selectStep(nextStep) {
    // Stop old audio first, then update the year.
    audio.stop();
    timeline.select(nextStep);

    console.log(
      '[AEVYRA] Selected timeline step:',
      nextStep
    );
  }

  function stopAudio() {
    audio.stop();

    if (timeline.playing) {
      timeline.toggle();
    }
  }

  // -----------------------------------------------------
  // Render existing UI
  // -----------------------------------------------------

  return (
    <div className="angular-panel angular-glass glass-sweep">
      <div className="explorer-top">
        <ExplorerTabs
          mode={mode}
          onChange={selectMode}
          regionalAvailable={
            (dataset.regions?.length ?? 0) > 0
          }
          globalLabel={
            available
              ? 'Listen to Earth'
              : hasFrames
                ? 'Global View'
                : 'Preview'
          }
        />

        {dataset.demoAudio && !available && (
          <span className="demo-tag">
            <i className="signal-dot" />
            Demo audio
          </span>
        )}
      </div>

      {/* Global Earth visualization */}
      <div
        id="explorer-global"
        role="tabpanel"
        aria-labelledby="tab-global"
        className="explorer-visual"
        hidden={mode !== 'global'}
      >
        {mode === 'global' && (
          <EarthFrame
            key={frameKey}
            image={
              hasFrames
                ? record?.image
                : story.cover
            }
            stepLabel={timeLabel}
            regionId={region}
            demo={dataset.demo}
            caption={frameCaption}
          />
        )}
      </div>

      {/* Regional Earth visualization */}
      <div
        id="explorer-regional"
        role="tabpanel"
        aria-labelledby="tab-regional"
        className="explorer-visual regional-visual"
        hidden={mode !== 'regional'}
      >
        <div className="globe-viewport">
          {globeRequested && (
            <GlobeBoundary>
              <Suspense
                fallback={
                  <p
                    className="globe-status"
                    role="status"
                  >
                    Loading interactive globe…
                  </p>
                }
              >
                <EarthGlobe
                  mode={mode}
                  texture={dataset.globeTexture}
                  regions={dataset.regions}
                  selected={selected}
                  onSelect={setSelected}
                  reduced={reduced}
                />
              </Suspense>
            </GlobeBoundary>
          )}
        </div>

        {mode === 'regional' && (
          <div className="regional-frame">
            <RegionSelector
              regions={dataset.regions}
              selected={selected}
              onSelect={setSelected}
            />

            <EarthFrame
              key={frameKey}
              image={record?.image}
              stepLabel={timeLabel}
              regionId={region}
              demo={
                dataset.demo ||
                dataset.demoRegions
              }
              caption={frameCaption}
            />
          </div>
        )}
      </div>

      {/* Scientific data */}
      <div className="explorer-data">
        <ScientificReadout
          story={story}
          record={record}
          name={name}
          stepLabel={timeLabel}
          demoRegion={
            mode === 'regional' &&
            dataset.demoRegions
          }
        />
      </div>

      {/* Timeline and audio controls */}
      <div className="explorer-bottom">
        {hasFrames && (
          <ObservationTimeline
            step={timeline.step}
            steps={dataset.steps}
            labels={labels}
            onSelect={selectStep}
            getRecord={(step) =>
              dataset.getRecord(step, region)
            }
          />
        )}

        <div className="transport">
          <PlaybackControls
            timeline={timeline}
            labels={labels}
            onToggle={toggleTimeline}
            muted={audio.muted}
            hasAudio={available}
            onMute={() =>
              audio.setMuted(!audio.muted)
            }
          />

          <p>
            {dataset.description || dataset.title}

            {hasFrames &&
              !available &&
              !dataset.hasAudio &&
              ' Audio is pending.'}
          </p>
        </div>

        {/* Keep panel visible for Night Lights
            even when telemetry is unavailable. */}
        {isNightLights && (
          <SoundPanel
            audio={audio}
            track={track}
            onTrack={selectTrack}
            available={available}
            reduced={reduced}
            onStop={stopAudio}
          />
        )}
      </div>

      {/* Screen reader timeline announcement */}
      {hasFrames && (
        <p
          className="sr-only"
          role="status"
          aria-atomic="true"
        >
          {timeline.playing
            ? ''
            : `${name}, ${labels.format(
                timeline.manualStep
              )}`}
        </p>
      )}
    </div>
  );
}
