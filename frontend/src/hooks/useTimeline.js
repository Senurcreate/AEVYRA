import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFrameSchedule, DEFAULT_SPEED } from '../sonification/playback/schedule.js'

export function useTimeline(steps) {
  const schedule = useMemo(() => createFrameSchedule(steps), [steps])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const cursor = useRef(0)
  const activeIndex = useRef(0)
  const scanner = useRef(null)
  const animation = useRef()

  const writeScanner = useCallback(({ step, progress }) => {
    const node = scanner.current
    if (node?.dataset.step !== String(step)) return
    const opacity = 0.42 * Math.min(1, progress / 0.12, (1 - progress) / 0.16)
    node.style.setProperty('--scan-position', (4 + 92 * progress) + '%')
    node.style.setProperty('--scan-opacity', opacity)
  }, [])

  const scannerRef = useCallback(node => {
    scanner.current = node
    if (node) writeScanner(schedule.at(cursor.current))
  }, [schedule, writeScanner])

  const update = useCallback(position => {
    cursor.current = position
    const frame = schedule.at(position)
    if (frame.index >= 0 && activeIndex.current !== frame.index) {
      activeIndex.current = frame.index
      setIndex(frame.index)
    }
    writeScanner(frame)
  }, [schedule, writeScanner])

  const pause = useCallback((position = cursor.current) => {
    cancelAnimationFrame(animation.current)
    animation.current = undefined
    update(position)
    setPlaying(false)
  }, [update])

  useEffect(() => () => cancelAnimationFrame(animation.current), [])

  function play(clock) {
    if (animation.current !== undefined) return
    update(clock())
    setPlaying(true)
    function advance() {
      update(clock())
      animation.current = requestAnimationFrame(advance)
    }
    animation.current = requestAnimationFrame(advance)
  }

  const finish = useCallback(() => pause(schedule.duration), [pause, schedule.duration])
  const offset = cursor.current >= schedule.duration ? 0 : cursor.current
  return {
    step: steps[index], offset, schedule, playing, speed, setSpeed, update, play, pause, finish, scannerRef,
    previous: steps[index - 1], next: steps[index + 1],
  }
}
