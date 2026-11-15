import * as Tone from 'tone'

export const TRANSITION_FADE = 0.042
const BLOCK_MARGIN = 0.012

// Every release belongs to the same oscillator or grain that received the attack.
export class NoteVoices {
  constructor(context, destination, limit, makeVoice, release) {
    this.context = context
    this.destination = destination
    this.limit = limit
    this.makeVoice = makeVoice
    this.release = release
    this.slots = new Set()
  }

  play(note, time, hold, velocity) {
    const now = this.context.currentTime
    let slot = [...this.slots].find(slot => !slot.retiring && slot.freeAt <= now)
    if (!slot) {
      if (this.slots.size >= this.limit) return false
      const gain = new Tone.Gain({ context: this.context, gain: 1 }).connect(this.destination)
      let voice
      try {
        voice = this.makeVoice(gain)
      } catch (error) {
        gain.dispose()
        throw error
      }
      slot = { gain, voice, freeAt: 0 }
      this.slots.add(slot)
    }
    slot.startAt = time
    slot.freeAt = time + hold + this.release + BLOCK_MARGIN
    slot.voice.triggerAttackRelease(note, hold, time, velocity)
    return true
  }

  cut(now) {
    for (const slot of this.slots) {
      if (slot.retiring || slot.freeAt <= now) continue
      if (slot.startAt > now) {
        if (!this.context.isOffline) {
          this.disposeSlot(slot)
          continue
        }
        slot.gain.gain.setValueAtTime(0, now)
      } else {
        slot.gain.gain.rampTo(0, TRANSITION_FADE, now)
      }
      slot.retiring = true
      // Offline rendering needs the graph until it has rendered the scheduled fades.
      if (!this.context.isOffline) {
        slot.cleanup = this.context.setTimeout(() => this.disposeSlot(slot), TRANSITION_FADE + BLOCK_MARGIN)
      }
    }
  }

  disposeSlot(slot) {
    if (slot.cleanup) this.context.clearTimeout(slot.cleanup)
    slot.gain.dispose()
    slot.voice.dispose()
    this.slots.delete(slot)
  }

  dispose() {
    for (const slot of this.slots) this.disposeSlot(slot)
  }
}
