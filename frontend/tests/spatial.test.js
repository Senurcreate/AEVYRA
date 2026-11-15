import assert from 'node:assert/strict'
import test from 'node:test'
import { createFrameSchedule, SCAN_SPAN, SCAN_START, SWEEP_WIDTH, sweepPan } from '../src/sonification/playback/schedule.js'

test('the stereo sweep starts on the left, ends on the right and never hard-pans', () => {
  assert.ok(sweepPan(0) < -0.7 && sweepPan(0) > -SWEEP_WIDTH)
  assert.ok(sweepPan(1) > 0.7 && sweepPan(1) < SWEEP_WIDTH)
  assert.ok(Math.abs(sweepPan(0.5)) < 1e-9, 'the middle of the scan is the middle of the stereo field')
  assert.ok(Math.abs(sweepPan(0) + sweepPan(1)) < 1e-9, 'left and right are symmetric')
  assert.equal(sweepPan(-3), sweepPan(0))
  assert.equal(sweepPan(7), sweepPan(1))
})

test('the sweep moves steadily left to right with scanner progress', () => {
  let previous = -Infinity
  for (let i = 0; i <= 20; i++) {
    const pan = sweepPan(i / 20)
    assert.ok(pan > previous)
    previous = pan
  }
})

test('the sweep follows the on-screen scanner line, which spans 4% to 96% of the frame', () => {
  assert.equal(SCAN_START, 0.04)
  assert.ok(Math.abs(SCAN_START + SCAN_SPAN - 0.96) < 1e-12)
  assert.ok(Math.abs(sweepPan(0, 1) - (2 * 0.04 - 1)) < 1e-9)
  assert.ok(Math.abs(sweepPan(1, 1) - (2 * 0.96 - 1)) < 1e-9)
})

test('every frame sweeps once from left to right and restarts at the next frame', () => {
  const schedule = createFrameSchedule(Array.from({ length: 12 }, (_, i) => i))
  const slot = schedule.duration / 12
  for (let frame = 0; frame < 12; frame++) {
    const start = sweepPan(schedule.at(frame * slot + 1e-6).progress)
    const end = sweepPan(schedule.at((frame + 1) * slot - 1e-6).progress)
    assert.ok(start < -0.7 && end > 0.7, 'frame ' + frame)
  }
})
