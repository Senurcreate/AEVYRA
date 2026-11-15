import { useCallback, useEffect, useRef, useState } from 'react'
import { start as unlockAudio } from 'tone'
import { GeneratedAudioEngine } from '../audio/GeneratedAudioEngine.js'
import { configureAudioContext } from '../audio/audioContext.js'
import { hapticPlayer } from '../haptics/HapticPlayer.js'
import { mapReferenceFrame } from '../mappings/referenceProfiles.js'
import { soundLayers } from '../mappings/soundLayers.js'

// The explorer and comparison have independent controls and share one audio owner.
let activeSession

export function useExclusiveSonification() {
  const session = useRef()
  const mutedRef = useRef(false)
  const layersRef = useRef(new Set()) // layers switched off in the panel; they stay off when another story starts
  const [mutedLayers, setMutedLayers] = useState([])
  const [status, setStatus] = useState('idle')
  const [muted, setMutedState] = useState(false)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState(null)

  const stop = useCallback(() => session.current?.cancel(), [])
  const elapsed = useCallback(() => session.current?.engine?.elapsed() ?? 0, [])

  const setMuted = useCallback(value => {
    mutedRef.current = Boolean(value)
    setMutedState(mutedRef.current)
    session.current?.engine?.setMuted(mutedRef.current)
  }, [])

  const toggleLayer = useCallback((kind, layer) => {
    const muted = !layersRef.current.has(layer)
    if (muted) layersRef.current.add(layer)
    else layersRef.current.delete(layer)
    setMutedLayers([...layersRef.current])
    for (const voice of soundLayers[kind]?.[layer]?.voices ?? []) session.current?.engine?.setVoiceMuted(voice, muted)
  }, [])

  const start = useCallback(async (mode, frame, kind, options = {}) => {
    stop()
    activeSession?.cancel('interrupted')
    setError('')
    setStatus('loading')

    const entry = {
      speed: options.speed,
      cancel(reason) {
        if (session.current !== entry) return
        const position = entry.engine?.elapsed()
        session.current = undefined
        if (activeSession === entry) activeSession = undefined
        entry.engine?.stop()
        if (reason === 'unmount') return
        setAnalyser(null)
        setStatus('idle')
        if (reason === 'interrupted') options.onInterrupt?.(position)
      },
    }
    session.current = activeSession = entry
    function fail(cause) {
      if (session.current !== entry) return
      entry.cancel('interrupted')
      setError(cause instanceof Error ? cause.message : 'Unable to start audio.')
    }

    try {
      configureAudioContext()
      await unlockAudio()
      if (session.current !== entry) return false
      entry.engine = new GeneratedAudioEngine(kind, mode, {
        duration: options.duration,
        offset: options.offset,
        speed: entry.speed,
        controlsAt: options.controlsAt,
        scanAt: options.scanAt,
        haptics: hapticPlayer,
        onEnd() {
          entry.cancel()
          options.onEnd?.()
        },
        onError: fail,
      })
      if (mode === 'changing') entry.engine.apply(mapReferenceFrame(kind, frame))
      entry.engine.setMuted(mutedRef.current)
      for (const layer of layersRef.current) {
        for (const voice of soundLayers[kind]?.[layer]?.voices ?? []) entry.engine.setVoiceMuted(voice, true)
      }
      entry.engine.resume()
      setAnalyser(entry.engine.analyser)
      setStatus('playing')
      return true
    } catch (cause) {
      fail(cause)
      return false
    }
  }, [stop])

  const pause = useCallback(() => {
    session.current?.engine?.pause()
    setStatus('paused')
  }, [])

  const seek = useCallback(position => session.current?.engine?.seek(position), [])
  const setSpeed = useCallback(speed => {
    const entry = session.current
    if (!entry) return
    entry.speed = speed
    entry.engine?.setSpeed(speed)
  }, [])

  const resume = useCallback(() => {
    const engine = session.current?.engine
    if (!engine) return false
    engine.resume()
    setStatus('playing')
    return true
  }, [])

  useEffect(() => () => session.current?.cancel('unmount'), [])

  return {
    start, stop, pause, resume, elapsed, seek, setSpeed, status,
    playing: status === 'playing', muted, setMuted, error, analyser, mutedLayers, toggleLayer,
  }
}
