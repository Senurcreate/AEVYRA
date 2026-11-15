import assert from 'node:assert/strict'
import test from 'node:test'
import { featureDatasets } from '../src/sonification/adapters/mlFeatures.js'
import { eventsAtBeat, mapReferenceFrame } from '../src/sonification/mappings/referenceProfiles.js'
import { soundLayerNames, soundLayers } from '../src/sonification/mappings/soundLayers.js'

function voicesPlayed(kind) {
  const dataset = featureDatasets[kind]
  const played = new Set()
  for (const frame of dataset.frames) {
    for (const region of ['global', ...dataset.regions.map(r => r.id)]) {
      const view = dataset.get(frame[dataset.step], region)
      const controls = view && mapReferenceFrame(kind, view)
      if (!controls) continue
      for (let beat = 0; beat < 72; beat++) for (const event of eventsAtBeat(kind, controls, beat)) played.add(event.voice)
    }
  }
  return played
}

test('every story documents all five layers, and every voice belongs to exactly one layer', () => {
  for (const kind of ['night-lights', 'aerosols', 'co2']) {
    assert.deepEqual(Object.keys(soundLayers[kind]), soundLayerNames)
    const documented = soundLayerNames.flatMap(name => soundLayers[kind][name].voices)
    assert.equal(new Set(documented).size, documented.length, kind + ': a voice is listed twice')
    assert.deepEqual([...voicesPlayed(kind)].sort(), [...documented].sort(), kind)
    for (const name of soundLayerNames) {
      const layer = soundLayers[kind][name]
      assert.ok(layer.drivers.length > 20, kind + '/' + name + ' needs a documented mapping')
      assert.ok(['data', 'atmosphere'].includes(layer.basis))
    }
  }
})

test('layers that carry no data are labelled as atmosphere only', () => {
  assert.equal(soundLayers['night-lights'].environmental.basis, 'atmosphere')
  assert.equal(soundLayers.co2.environmental.basis, 'atmosphere')
  assert.match(soundLayers.co2.environmental.drivers, /atmosphere only/)
})

test('CO₂ layers describe image features, never concentrations', () => {
  for (const layer of Object.values(soundLayers.co2)) assert.doesNotMatch(layer.drivers, /\bppm\b(?!\))/)
  assert.match(soundLayers.co2.detail.drivers, /not CO₂ ppm/)
})

test('the rhythmic layer follows change: silent when nothing changed, busier when more changed', () => {
  for (const kind of ['night-lights', 'aerosols', 'co2']) {
    const dataset = featureDatasets[kind]
    const pulsesFor = controls => {
      let count = 0
      for (let beat = 0; beat < 36; beat++) count += eventsAtBeat(kind, controls, beat).filter(e => e.voice === 'pulse').length
      return count
    }
    const base = mapReferenceFrame(kind, dataset.get(dataset.frames[0][dataset.step], 'global'))
    const still = { ...base, pulseCount: 0, pulseLevel: 0 }
    const busy = { ...base, pulseCount: kind === 'co2' ? 2 : 3, pulseLevel: 1 }
    const mid = { ...base, pulseCount: 1, pulseLevel: 0.5 }
    assert.equal(pulsesFor(still), 0, kind)
    assert.ok(pulsesFor(mid) > 0 && pulsesFor(busy) > pulsesFor(mid), kind)
    const firm = eventsAtBeat(kind, busy, 0).concat(...Array.from({ length: 6 }, (_, i) => eventsAtBeat(kind, busy, i))).filter(e => e.voice === 'pulse')
    const soft = Array.from({ length: 6 }, (_, i) => eventsAtBeat(kind, { ...busy, pulseLevel: 0.1 }, i)).flat().filter(e => e.voice === 'pulse')
    assert.ok(Math.max(...firm.map(e => e.velocity)) > Math.max(...soft.map(e => e.velocity)), kind + ' louder with more change')
  }
})

test('rhythm and detail layers follow the real data across the frames', () => {
  for (const kind of ['night-lights', 'aerosols']) {
    const dataset = featureDatasets[kind]
    const counts = dataset.frames.map(frame => {
      const controls = mapReferenceFrame(kind, dataset.get(frame[dataset.step], 'global'))
      let n = 0
      for (let beat = 0; beat < 36; beat++) n += eventsAtBeat(kind, controls, beat).filter(e => e.voice === 'pulse').length
      return n
    })
    assert.equal(counts[0], 0, kind + ': the first observation has no previous one, so no pulses')
    assert.ok(new Set(counts).size > 2, kind + ': pulse activity varies with the data')
  }
  const co2 = featureDatasets.co2
  const glints = co2.frames.map(frame => {
    const controls = mapReferenceFrame('co2', co2.get(frame.frameNumber, 'global'))
    let n = 0
    for (let beat = 0; beat < 30; beat++) n += eventsAtBeat('co2', controls, beat).filter(e => e.voice === 'glint').length
    return n
  })
  assert.ok(glints[0] > 0 && glints.at(-1) === 0, 'glints follow the hot-colour share, which fades over the frames')
})
