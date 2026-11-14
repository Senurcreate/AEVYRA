import { useCallback, useEffect, useRef, useState } from 'react'
import { createAudioEngine } from '../services/audioService'

export function useAudio(source, enabled, { onEnded, exclusive = false, playbackKey } = {}) {
  const engine = useRef(null)
  const [analyser, setAnalyser] = useState(null)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  const unlock = useCallback(async () => {
    try {
      engine.current ??= createAudioEngine()
      const current = engine.current
      await current.unlock()
      if (engine.current === current) {
        setAnalyser(current.analyser)
        if (error) setRetry(value => value + 1)
      }
    } catch {
      if (engine.current) engine.current.close()
      engine.current = null
      setAnalyser(null)
      setError('Sound is unavailable in this browser or playback is blocked.')
    }
  }, [error])

  useEffect(() => {
    const current = engine.current
    if (!analyser || !current) return
    current.mute(muted)
  }, [analyser, muted])

  useEffect(() => {
    const current = engine.current
    if (!analyser || !current || !enabled || !source) return
    try {
      setError('')
      current.play(source, setError, { onEnded, exclusive })
    } catch {
      setError('This sound could not play. Try another year or sound.')
    }
    return () => current.stop()
  }, [analyser, enabled, source, retry, onEnded, exclusive, playbackKey])

  useEffect(() => () => {
    engine.current?.close()
    engine.current = null
  }, [])

  return { analyser, muted, setMuted, unlock, error }
}
