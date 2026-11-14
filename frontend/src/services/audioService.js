const comparisonToneSeconds = 2.5

export function createAudioEngine() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) throw new Error('This browser does not support sound playback.')
  const context = new AudioContext()
  const output = context.createGain()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  output.connect(analyser)
  analyser.connect(context.destination)
  let stopCurrent = () => {}

  return {
    analyser,
    async unlock() {
      await context.resume()
    },
    play(source, onError, { onEnded, exclusive } = {}) {
      stopCurrent()
      if (source.kind === 'tone') {
        const tone = context.createOscillator()
        const envelope = context.createGain()
        const time = context.currentTime
        tone.type = 'sine'
        tone.frequency.value = source.hz
        tone.connect(envelope)
        envelope.connect(output)
        envelope.gain.setValueAtTime(0, time)
        envelope.gain.linearRampToValueAtTime(0.15, time + 0.12)
        let cancelled = false
        tone.onended = () => {
          tone.disconnect()
          envelope.disconnect()
          if (!cancelled) {
            stopCurrent = () => {}
            onEnded?.()
          }
        }
        tone.start()
        if (onEnded) {
          const end = time + comparisonToneSeconds
          envelope.gain.setValueAtTime(0.15, end - 0.08)
          envelope.gain.linearRampToValueAtTime(0, end)
          tone.stop(end)
        }
        stopCurrent = () => {
          if (context.state === 'closed') return
          cancelled = true
          if (exclusive) {
            tone.disconnect()
            tone.stop()
            return
          }
          const now = context.currentTime
          envelope.gain.cancelAndHoldAtTime(now)
          envelope.gain.linearRampToValueAtTime(0, now + 0.045)
          tone.stop(now + 0.05)
        }
        return
      }

      const media = new Audio()
      media.crossOrigin = 'anonymous'
      media.loop = !onEnded
      const node = context.createMediaElementSource(media)
      node.connect(output)
      let active = true
      let reported = false
      function report() {
        if (active && !reported) {
          reported = true
          onError('This sound could not play. Try another year or sound.')
        }
      }
      media.addEventListener('error', report)
      if (onEnded) media.addEventListener('ended', onEnded)
      media.src = source.src
      media.play().catch(report)
      stopCurrent = () => {
        active = false
        media.removeEventListener('error', report)
        if (onEnded) media.removeEventListener('ended', onEnded)
        media.pause()
        media.removeAttribute('src')
        media.load()
        node.disconnect()
      }
    },
    stop() {
      stopCurrent()
      stopCurrent = () => {}
    },
    mute(muted) {
      output.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.025)
    },
    close() {
      this.stop()
      if (context.state !== 'closed') context.close().catch(() => {})
    },
  }
}
