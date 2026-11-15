import assert from 'node:assert/strict'
import test from 'node:test'
import { featureDatasets, getFeatureFrame } from '../src/sonification/adapters/mlFeatures.js'
import { beatSeconds, SCORE_SECONDS, eventsAtBeat, mapReferenceFrame, midiToHz, normalize, secondsPerFrame } from '../src/sonification/mappings/referenceProfiles.js'
import { createFrameSchedule, DEFAULT_SPEED, PLAYBACK_SPEEDS } from '../src/sonification/playback/schedule.js'
import { observationLabels } from '../src/data/observationLabels.js'
import { parseDataset } from '../src/services/earthData.js'

test('use canonical observation IDs and retain frame metadata', () => {
  const firstSteps = { 'night-lights': 2012, aerosols: 200, co2: 112 }
  for (const [kind, dataset] of Object.entries(featureDatasets)) {
    assert.equal(dataset.frames.length, 12)
    assert.equal(dataset.frames[0][dataset.step], firstSteps[kind])
    assert.equal(getFeatureFrame(kind, 0), null)
    assert.equal(getFeatureFrame(kind, firstSteps[kind], 'unknown'), null)
    for (const raw of dataset.frames) {
      const frame = getFeatureFrame(kind, raw[dataset.step])
      assert.equal(frame.values, raw)
      assert.equal(frame.frameId, raw.frameId)
      assert.equal(frame.dateTime, raw.dateTime ?? null)
    }
  }
  assert.equal(getFeatureFrame('test', 0), null)
  const view = getFeatureFrame('aerosols', 200, 'europe')
  assert.equal(view.values, featureDatasets.aerosols.frames[0].regions.europe)
  assert.equal(getFeatureFrame('co2', 112, 'antarctica'), null)
  assert.ok(getFeatureFrame('co2', 112, 'oceania'))
  assert.equal(parseDataset({
    regions: [], records: [{ frameNumber: 112, regionId: 'global', figures: [{ value: 1 }] }],
  }, { steps: [112] }).getRecord(112).step, 112)
})

test('normalize with clipping and neutral constant ranges', () => {
  assert.equal(normalize(null, 2, 4), null)
  assert.equal(normalize(3, 2, 4), 0.5)
  assert.equal(normalize(4, 2, 2), 0.5)
  assert.equal(normalize(0, 2, 4), 0)
  assert.equal(normalize(5, 2, 4), 1)
  assert.equal(secondsPerFrame(12), 2.25)
  assert.equal(secondsPerFrame(9), 3)
  assert.equal(secondsPerFrame(0), 0)
})

test('Night Lights coverage changes sparkle density and brightness changes timbre', () => {
  const frame = getFeatureFrame('night-lights', 2012)
  const reference = mapReferenceFrame('night-lights', frame)
  const brighter = mapReferenceFrame('night-lights', {
    ...frame, values: { ...frame.values, litShare: 0.008, meanBrightness: 0.5, tierShares: [0.99, 0.003, 0.003, 0.004] },
  })
  assert.ok(brighter.gain > reference.gain)
  assert.ok(brighter.filterHz > reference.filterHz)
  assert.ok(brighter.sparkleGain > reference.sparkleGain)
  assert.equal(brighter.sparkleCount, 3)
  assert.equal(eventsAtBeat('night-lights', brighter, 5)[0].voice, 'sparkle')
  assert.equal(reference.movement, 0)
  assert.equal(reference.direction, 0)
})

test('Aerosol color groups set independent texture controls', () => {
  const frame = getFeatureFrame('aerosols', 200)
  const initial = mapReferenceFrame('aerosols', frame)
  const update = values => mapReferenceFrame('aerosols', { ...frame, values: { ...frame.values, ...values } })
  const [background, sulfate, smoke, salt, dust] = frame.values.groupShares
  const groups = update({ groupShares: [background, sulfate + 0.1, smoke + 0.1, salt + 0.1, dust + 0.1] })
  for (const key of ['breathGain', 'smokeGain', 'saltChance', 'windGain']) assert.ok(groups[key] > initial[key])
  assert.equal(initial.movement, 0)
  assert.ok(update({ groupShareDeltaVsPrev: [-0.2, 0.1, 0, 0.05, 0.05] }).windGain > initial.windGain)
  assert.equal(update({ changeVsPrev: 0.25 }).movement, 1)
  assert.ok(groups.dustHz > initial.dustHz)
  assert.deepEqual(update({ strips: [], groupCentroidX: [null, null, null, null, null] }).pans,
    { flute: 0, sulfate: 0, smoke: 0, dust: 0, salt: 0 })
})

test('dust uses seeded unpitched grains with a bounded moving filter', () => {
  const frame = getFeatureFrame('aerosols', 200)
  const controls = mapReferenceFrame('aerosols', frame)
  const first = eventsAtBeat('aerosols', controls, 1).find(event => event.voice === 'dust')
  const next = eventsAtBeat('aerosols', controls, 7).find(event => event.voice === 'dust')
  assert.deepEqual(first.notes, [])
  assert.equal(first.seconds, 0.65)
  assert.ok(Number.isInteger(first.grainSeed) && first.grainSeed >= 0 && first.grainSeed <= 0xffffffff)
  assert.notEqual(first.grainSeed, next.grainSeed)
  assert.deepEqual(first, eventsAtBeat('aerosols', controls, 1).find(event => event.voice === 'dust'))
  assert.ok(controls.dustHz >= 640 && controls.dustHz <= 1170)
  assert.ok(controls.windGain >= 0.0166 && controls.windGain <= 0.04446)
})

test('CO₂ uses the fixed hot-color range, delta magnitude and bounded pan', () => {
  const frame = getFeatureFrame('co2', 112)
  const control = mapReferenceFrame('co2', {
    ...frame,
    values: {
      ...frame.values,
      groupShares: [0.7, 0.1, 0.1, 0.07, 0.03],
      groupShareDeltaVsPrev: [0, 0, 0, 0.02, -0.02],
      groupCentroidX: [0.5, 0.5, 0.5, 0.5, 1],
    },
  })
  assert.equal(control.activity, 0.5)
  assert.equal(control.pulse, 0.5)
  assert.equal(control.pan, 0.25)
  assert.equal(control.filterHz, 1125)
  assert.equal(control.padGain, 0.145)
  assert.ok(Math.abs(control.pulseGain - 0.07) < 1e-10)
  assert.ok(control.spatial.strips)
})

test('score events are deterministic and valid for every available frame and region', () => {
  for (const [kind, dataset] of Object.entries(featureDatasets)) {
    const global = new Set()
    for (const raw of dataset.frames) {
      for (const region of ['global', ...dataset.regions.map(item => item.id)]) {
        const frame = getFeatureFrame(kind, raw[dataset.step], region)
        const controls = mapReferenceFrame(kind, frame)
        assert.deepEqual(controls, mapReferenceFrame(kind, frame))
        if (region === 'global') global.add(controls.filterHz + '/' + controls.gain)
        for (let beat = 0; beat < SCORE_SECONDS / beatSeconds(kind); beat++) {
          const events = eventsAtBeat(kind, controls, beat)
          assert.deepEqual(events, eventsAtBeat(kind, controls, beat))
          if (!frame) assert.equal(events.length, 0)
          for (const { notes, seconds, velocity } of events) {
            assert.ok(notes.every(note => Number.isInteger(note) && note >= 17 && note <= 100))
            assert.ok(seconds > 0 && seconds < 7)
            assert.ok(velocity > 0 && velocity < 0.7)
          }
        }
      }
    }
    assert.ok(global.size > 1)
  }
})

test('schedule shares exact frame boundaries and scanner progress across stories', () => {
  assert.equal(DEFAULT_SPEED, 0.75)
  assert.deepEqual(PLAYBACK_SPEEDS, [0.5, 0.75, 1, 1.25])
  assert.equal(midiToHz(69), 440)
  for (const dataset of Object.values(featureDatasets)) {
    const steps = dataset.frames.map(frame => frame[dataset.step])
    const schedule = createFrameSchedule(steps)
    assert.deepEqual(schedule.at(2.25), { index: 1, step: steps[1], progress: 0 })
    assert.deepEqual(schedule.at(3.375), { index: 1, step: steps[1], progress: 0.5 })
    assert.deepEqual(schedule.at(27), { index: 11, step: steps[11], progress: 1 })
    assert.equal(schedule.offsetOf(steps[4]), 9)
    assert.equal(schedule.offsetOf(0), null)
  }
})

test('visualization labels use verified time stamps or ordinal observations', () => {
  assert.equal(observationLabels('aerosols').format(453), 'Observation 4')
  assert.equal(observationLabels('co2').format(112), 'Jan 19, 2020 at 13:00')
  assert.equal(observationLabels('co2').compact(112), 'Jan 19\n13:00')
})

test('all intended layers play in the twelve-observation global arrangements', () => {
  const layerNames = {
    'night-lights': ['cello', 'piano', 'pulse', 'rumble', 'sparkle', 'strings'],
    aerosols: ['dust', 'flute', 'pulse', 'salt', 'smoke', 'sulfate'],
    co2: ['cello', 'drone', 'glint', 'piano', 'pulse', 'strings'],
  }
  for (const [kind, dataset] of Object.entries(featureDatasets)) {
    const schedule = createFrameSchedule(dataset.frames.map(frame => frame[dataset.step]))
    const voices = new Set()
    for (let beat = 0; beat < SCORE_SECONDS / beatSeconds(kind); beat++) {
      const { step } = schedule.at(beat * beatSeconds(kind))
      const controls = mapReferenceFrame(kind, dataset.get(step, 'global'))
      for (const event of eventsAtBeat(kind, controls, beat)) voices.add(event.voice)
    }
    assert.deepEqual([...voices].sort(), layerNames[kind])
  }
})
