import { useEffect, useState } from 'react'
import { YEARS } from '../services/earthData'

const first = YEARS[0]
const last = YEARS.at(-1)

export function useTimeline() {
  const [year, setYear] = useState(first)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [manualYear, setManualYear] = useState(first)

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      if (year >= last) {
        setPlaying(false)
        setManualYear(year)
      } else {
        setYear(year + 1)
      }
    }, 2400 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, speed, year])

  function select(nextYear) {
    setPlaying(false)
    setYear(nextYear)
    setManualYear(nextYear)
  }

  function toggle() {
    if (playing) {
      setManualYear(year)
      setPlaying(false)
      return
    }
    if (year === last) setYear(first)
    setPlaying(true)
  }

  return { year, manualYear, playing, speed, setSpeed, select, toggle, first, last }
}
