import assert from 'node:assert/strict'
import test from 'node:test'
import { featureDatasets } from '../src/sonification/adapters/mlFeatures.js'
import { eventsAtBeat, mapReferenceFrame } from '../src/sonification/mappings/referenceProfiles.js'
import { buildPattern, hapticIntensity, hapticPulses, hapticVoices, mergeRuns } from '../src/sonification/haptics/hapticPatterns.js'
import { detectHaptics, HapticPlayer } from '../src/sonification/haptics/HapticPlayer.js'

const span = pulses => Math.max(...pulses.map(p => p.start + p.duration))

function everyEvent(visit) {
  for (const kind of ['night-lights', 'aerosols', 'co2']) {
    const dataset = featureDatasets[kind]
    for (const frame of dataset.frames) {
      for (const region of ['global', ...dataset.regions.map(r => r.id)]) {
        const view = dataset.get(frame[dataset.step], region)
        const controls = view && mapReferenceFrame(kind, view)
        if (!controls) continue
        for (let beat = 0; beat < 72; beat++) for (const event of eventsAtBeat(kind, controls, beat)) visit(kind, event)
      }
    }
  }
}

test('every voice the engine plays has a haptic rule, and every pulse is long enough to feel', () => {
  let felt = 0
  everyEvent((kind, event) => {
    assert.ok(hapticVoices[kind][event.voice], kind + '/' + event.voice + ' has no haptic rule')
    const pulses = hapticPulses(kind, event)
    if (!pulses.length) return
    felt++
    for (const pulse of pulses) {
      assert.ok(pulse.start >= 0 && pulse.duration >= 0.012 && pulse.duration <= 0.14, JSON.stringify(pulse))
    }
    assert.ok(span(pulses) <= 0.35, 'a single note should not buzz longer than 350 ms')
    assert.deepEqual(pulses, hapticPulses(kind, event))
  })
  assert.ok(felt > 1000)
})

test('sub-bass and rumble are never vibrated', () => {
  assert.deepEqual(hapticPulses('co2', { voice: 'drone', notes: [33], velocity: 0.048 }), [])
  assert.deepEqual(hapticPulses('night-lights', { voice: 'rumble', notes: [24], velocity: 0.01 }), [])
})

test('low notes thump, middle notes tap twice, high notes flutter, dust double-taps', () => {
  const piano = notes => hapticPulses('night-lights', { voice: 'piano', notes, velocity: 0.1 })
  assert.equal(piano([41]).length, 1)
  assert.equal(piano([60]).length, 2)
  assert.ok(piano([84]).length >= 3)
  assert.ok(piano([41])[0].duration > piano([84])[0].duration * 3, 'low thumps are longer than flutter pulses')
  const dust = hapticPulses('aerosols', { voice: 'dust', notes: [], grainSeed: 5, velocity: 0.03 })
  assert.equal(dust.length, 2)
})

test('louder notes feel firmer', () => {
  const at = (velocity, notes) => hapticPulses('night-lights', { voice: 'piano', notes, velocity })
  assert.ok(hapticIntensity('night-lights', { voice: 'piano', velocity: 0.13 }) > hapticIntensity('night-lights', { voice: 'piano', velocity: 0.07 }))
  assert.ok(at(0.13, [60])[0].duration > at(0.07, [60])[0].duration)
  assert.ok(at(0.13, [84]).length >= at(0.07, [84]).length)
})

test('overlapping layers merge into one run and the pattern starts with a buzz', () => {
  const runs = mergeRuns([{ start: 1, end: 1.1 }, { start: 1.05, end: 1.2 }, { start: 1.5, end: 1.55 }])
  assert.deepEqual(runs, [{ start: 1, end: 1.2 }, { start: 1.5, end: 1.55 }])
  assert.deepEqual(buildPattern(runs, 1), [200, 300, 50])
  assert.deepEqual(buildPattern(runs, 1.1), [100, 300, 50], 'a running pattern is rebuilt from the current time')
  assert.deepEqual(buildPattern([], 1), [])
})

function player() {
  const calls = []
  const p = new HapticPlayer(pattern => { calls.push(pattern); return true })
  return { p, calls }
}
const hit = { voice: 'piano', notes: [60], velocity: 0.12 }

test('a note buzzes when it is due, not before', () => {
  const { p, calls } = player()
  p.note('night-lights', hit, 5)
  p.flush(4.5)
  assert.equal(calls.length, 0)
  p.flush(5.001)
  assert.equal(calls.length, 1)
  assert.ok(Array.isArray(calls[0]) && calls[0].length === 3 && calls[0].every(n => Number.isInteger(n) && n > 0))
  p.flush(5.01)
  assert.equal(calls.length, 1, 'nothing new, so the running pattern is left alone')
})

test('a second layer arriving mid-buzz is merged into the remaining pattern', () => {
  const { p, calls } = player()
  p.note('night-lights', hit, 5)
  p.flush(5.001)
  p.note('night-lights', { voice: 'cello', notes: [41], velocity: 0.08 }, 5.02)
  p.flush(5.02)
  assert.equal(calls.length, 2)
  assert.ok(calls[1][0] > 0)
})

test('muting, disabling and cancelling stop the motor', () => {
  const { p, calls } = player()
  p.note('night-lights', hit, 5)
  p.setMuted(true)
  assert.equal(calls.at(-1), 0)
  p.note('night-lights', hit, 6)
  p.flush(6.01)
  assert.equal(calls.filter(c => c !== 0).length, 0)
  p.setMuted(false)
  p.setEnabled(false)
  p.note('night-lights', hit, 7)
  p.flush(7.01)
  assert.equal(calls.filter(c => c !== 0).length, 0)
  p.setEnabled(true)
  p.note('night-lights', hit, 8)
  p.flush(8.01)
  assert.equal(calls.filter(c => c !== 0).length, 1)
  p.cancel()
  assert.equal(calls.at(-1), 0)
})

test('output latency delays the buzz so it meets the sound, and failures never throw', () => {
  const { p, calls } = player()
  p.note('night-lights', hit, 5)
  p.flush(5.05, 0.15) // sound is 150 ms late; buzz is held back
  assert.equal(calls.length, 0)
  p.flush(5.13, 0.15)
  assert.equal(calls.length, 1)
  const broken = new HapticPlayer(() => { throw new Error('blocked') })
  broken.note('night-lights', hit, 1)
  assert.doesNotThrow(() => broken.flush(1.001))
  assert.doesNotThrow(() => new HapticPlayer(null).flush(1))
  assert.equal(new HapticPlayer(null).supported, false)
})

test('only Android Chromium touch devices count as vibration capable', () => {
  const nav = (userAgent, touch = 5, vibrate = () => true) => ({ userAgent, maxTouchPoints: touch, vibrate })
  assert.equal(detectHaptics(nav('Mozilla/5.0 (Linux; Android 10; K) Chrome/157.0 Mobile Safari/537.36')), true)
  assert.equal(detectHaptics(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) CriOS/157')), false)
  assert.equal(detectHaptics(nav('Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0')), false)
  assert.equal(detectHaptics(nav('Mozilla/5.0 (Windows NT 10.0) Chrome/157', 0)), false)
  assert.equal(detectHaptics({ userAgent: 'Chrome', maxTouchPoints: 5 }), false)
})
