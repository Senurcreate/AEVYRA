import { useEffect, useState } from 'react'

export function useTimeline(steps) {
  const first = steps[0]
  const [step, setStep] = useState(first)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [manualStep, setManualStep] = useState(first)
  const index = steps.indexOf(step)
  const previous = steps[index - 1]
  const next = steps[index + 1]

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      if (next === undefined) {
        setPlaying(false)
        setManualStep(step)
      } else {
        setStep(next)
      }
    }, 2400 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, speed, step, next])

  function select(nextStep) {
    setPlaying(false)
    setStep(nextStep)
    setManualStep(nextStep)
  }

  function toggle() {
    if (playing) {
      setManualStep(step)
      setPlaying(false)
      return
    }
    if (next === undefined) setStep(first)
    setPlaying(true)
  }

  return { step, manualStep, playing, speed, setSpeed, select, toggle, previous, next }
}
