import { SCORE_SECONDS, clamp, secondsPerFrame } from '../mappings/referenceProfiles.js'

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
