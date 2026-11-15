import * as Tone from 'tone'

// Tone.js defaults to the smallest audio buffer ('interactive'), which is the first thing to stutter on
// laptop speakers, weaker laptops and Bluetooth earphones. Sonification is scheduled ahead of time and
// never needs instant response, so ask the browser for the larger, safer 'playback' buffer instead.
// Must run before any Tone node is created.
let configured = false

export function configureAudioContext() {
  if (configured) return
  configured = true
  try {
    Tone.setContext(new Tone.Context({ latencyHint: 'playback' }), true)
  } catch {
    // Keep Tone's default context; the sound still plays, only with the small buffer.
  }
}
