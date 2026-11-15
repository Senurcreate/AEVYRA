import { buildPattern, hapticPulses, mergeRuns } from './hapticPatterns.js'

const STORAGE_KEY = 'aevyra.haptics'
const MOTOR_SPIN_UP = 0.03 // the motor needs about this long to start, so buzzes begin slightly early
const MAX_SHIFT = 0.25

// Vibration only works on Android Chromium browsers. iPhones expose none to web pages, Firefox for
// Android reports success without vibrating, and desktops have no motor.
export function detectHaptics(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!nav || typeof nav.vibrate !== 'function') return false
  if (!(nav.maxTouchPoints > 0)) return false
  return !/iPhone|iPad|iPod|Firefox/i.test(nav.userAgent ?? '')
}

// Turns scheduled notes into one vibration stream. navigator.vibrate() replaces whatever is running,
// so overlapping layers are merged into runs and the remaining pattern is re-sent when notes are added.
export class HapticPlayer {
  constructor(vibrate = detectHaptics() ? navigator.vibrate.bind(navigator) : null) {
    this.vibrate = vibrate
    this.enabled = true
    this.muted = false
    this.queue = []
    this.dirty = false
  }

  get supported() {
    return typeof this.vibrate === 'function'
  }

  get active() {
    return this.supported && this.enabled && !this.muted
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled)
    if (!this.active) this.cancel()
  }

  setMuted(muted) {
    this.muted = Boolean(muted)
    if (!this.active) this.cancel()
  }

  // Called when the audio engine schedules a note to start at audio-clock `time`.
  note(kind, event, time) {
    if (!this.active || !Number.isFinite(time)) return
    for (const { start, duration } of hapticPulses(kind, event)) {
      this.queue.push({ start: time + start, end: time + start + duration })
      this.dirty = true
    }
  }

  // Called often with the audio clock. `latency` is the audio output delay, so the buzz meets the sound.
  flush(now, latency = 0) {
    if (!this.active) return
    const shift = Math.min(MAX_SHIFT, Math.max(-0.05, latency - MOTOR_SPIN_UP))
    this.queue = this.queue.filter(item => item.end + shift > now)
    if (!this.queue.length) this.dirty = false
    if (!this.dirty) return
    const runs = mergeRuns(this.queue.map(item => ({ start: item.start + shift, end: item.end + shift })))
    if (runs[0].start > now) return // not due yet; the next flush will send it
    const pattern = buildPattern(runs, now)
    this.dirty = false
    if (pattern.length) this.send(pattern)
  }

  send(pattern) {
    try { this.vibrate(pattern) } catch { /* vibration is optional; never break the audio */ }
  }

  cancel() {
    this.queue = []
    this.dirty = false
    if (this.supported) this.send(0)
  }
}

function readEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off' } catch { return true }
}

export const hapticPlayer = new HapticPlayer()
const listeners = new Set()
hapticPlayer.setEnabled(readEnabled())

export const hapticsSupported = () => hapticPlayer.supported
export const getHapticsEnabled = () => hapticPlayer.enabled
export function setHapticsEnabled(enabled) {
  hapticPlayer.setEnabled(enabled)
  try { localStorage.setItem(STORAGE_KEY, hapticPlayer.enabled ? 'on' : 'off') } catch { /* private mode */ }
  for (const listener of listeners) listener()
}
export function subscribeHaptics(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
