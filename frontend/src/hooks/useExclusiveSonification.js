import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { AevyraAudioEngine } from '../audio/AudioEngine'

/** One audio owner for BOTH modes. Reference and changing sound never overlap. */
export function useExclusiveSonification() {
  const owner = useRef(null)
  const ownerId = useRef(`sonification-${Math.random().toString(36).slice(2)}`)
  const generation = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState(null)

  const getOwner = useCallback(() => {
    if (!owner.current) owner.current = {
      engine: new AevyraAudioEngine(), reference: null, referenceGain: null,
      referenceAnalyser: null, mode: null, initialized: false,
    }
    return owner.current
  }, [])

  const silence = useCallback(() => {
    const o = owner.current
    if (!o) return
    o.engine.stop()
    o.reference?.stop()
    o.reference?.dispose()
    o.reference = null
    o.referenceGain?.dispose()
    o.referenceGain = null
    o.referenceAnalyser?.dispose()
    o.referenceAnalyser = null
    o.mode = null
  }, [])

  const stop = useCallback(() => {
    generation.current++
    silence()
    setPlaying(false)
    setAnalyser(null)
  }, [silence])

  const start = useCallback(async (mode, frame) => {
    if (!frame) return
    const token = ++generation.current
    setError('')
    const o = getOwner()
    try {
      // Called from a user click. Tone.start unlocks the AudioContext.
      await Tone.start()
      if (token !== generation.current) return
      silence()
      window.dispatchEvent(new CustomEvent('aevyra:audio-claim', { detail: { owner: ownerId.current } }))
      if (mode === 'reference') {
        // Constant D3 reference, independent of the selected year's features.
        o.referenceAnalyser = new Tone.Analyser('waveform', 1024)
        o.referenceGain = new Tone.Gain(muted ? 0 : 0.10).toDestination()
        o.referenceGain.connect(o.referenceAnalyser)
        o.reference = new Tone.Oscillator({ frequency: 'D3', type: 'sine' }).connect(o.referenceGain)
        o.reference.start()
        o.mode = 'reference'
        setAnalyser(o.referenceAnalyser)
      } else {
        o.engine.applyFrameTelemetry(frame)
        await o.engine.init()
        if (token !== generation.current) { o.engine.stop(); return }
        o.engine.setMuted(muted)
        o.engine.start()
        o.mode = 'changing'
        setAnalyser(o.engine.waveformAnalyser)
      }
      setPlaying(true)
      return true
    } catch (e) {
      if (token === generation.current) {
        silence()
        setPlaying(false)
        setAnalyser(null)
        setError(e instanceof Error ? e.message : 'Audio could not start')
      }
      return false
    }
  }, [getOwner, muted, silence])

  const applyFrame = useCallback(frame => {
    const o = owner.current
    if (frame && o?.mode === 'changing') {
      try { o.engine.applyFrameTelemetry(frame) }
      catch (e) { setError(e instanceof Error ? e.message : 'Invalid telemetry') }
    }
  }, [])

  useEffect(() => {
    const o = owner.current
    if (!o) return
    o.engine.setMuted(muted)
    if (o.referenceGain) o.referenceGain.gain.rampTo(muted ? 0 : 0.10, 0.04)
  }, [muted])

  useEffect(() => {
    const onClaim = event => { if (event.detail?.owner !== ownerId.current) stop() }
    window.addEventListener('aevyra:audio-claim', onClaim)
    return () => window.removeEventListener('aevyra:audio-claim', onClaim)
  }, [stop])

  useEffect(() => () => {
    generation.current++
    silence()
    owner.current?.engine.dispose()
    owner.current = null
  }, [silence])

  return { start, stop, applyFrame, playing, muted, setMuted, error, analyser }
}
