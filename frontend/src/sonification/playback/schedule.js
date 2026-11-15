import { SCORE_SECONDS, clamp, secondsPerFrame } from '../mappings/referenceProfiles.js'

// The scanner line is drawn from SCAN_START to SCAN_START + SCAN_SPAN of the frame width (see useTimeline).
export const SCAN_START = 0.04
export const SCAN_SPAN = 0.92
export const SWEEP_WIDTH = 0.85

// Stereo position (-1 left .. +1 right) that matches where the scanner line is on screen.
// progress 0 -> the line is at the left edge, 1 -> the right edge. Width < 1 never hard-pans.
export const sweepPan = (progress, width = SWEEP_WIDTH) => {
  const p = Math.min(1, Math.max(0, progress))
  return width * (2 * (SCAN_START + SCAN_SPAN * p) - 1)
}

export const DEFAULT_SPEED = 0.75
export const PLAYBACK_SPEEDS = [0.5, DEFAULT_SPEED, 1, 1.25]

export function createFrameSchedule(steps) {
  const slot = secondsPerFrame(steps.length)
  return {
    duration: SCORE_SECONDS,
    at(position) {
      if (!slot) return { index: -1, step: undefined, progress: 0 }
      const offset = clamp(position, 0, SCORE_SECONDS) / slot
      const index = Math.min(steps.length - 1, Math.floor(offset + 1e-10))
      return { index, step: steps[index], progress: clamp(offset - index) }
    },
    offsetOf(step) {
      const index = steps.indexOf(step)
      return index < 0 ? null : index * slot
    },
  }
}
