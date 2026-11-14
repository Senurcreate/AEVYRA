import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from '../hooks/useReducedMotion'

const layers = [
  { count: 43, opacity: 0.45, spread: 0, shift: 4 },
  { count: 23, opacity: 0.64, spread: 0.3, shift: 9 },
  { count: 8, opacity: 0.87, spread: 0.65, shift: 15 },
].map((layer, index) => ({
  ...layer,
  shadow: Array.from({ length: layer.count }, (_, i) => {
    const n = i + 83 * index
    const x = ((n * 7919 + 137) % 997) / 9.97
    const y = ((n * 4111 + 51) % 991) / 9.91
    const alpha = Math.min(1, (layer.opacity - (n % 4) * 0.035) * 1.25)
    return `${x}vw ${y}vh 0 ${layer.spread}px rgba(198,222,236,${alpha})`
  }).join(','),
}))

export default function Starfield() {
  const field = useRef(null)
  const meteor = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const element = field.current
    const surface = element.parentElement
    const context = gsap.context(() => {})
    const move = context.add(() => Array.from(element.querySelectorAll('.star-layer')).map((layer, index) => {
      const options = { duration: 0.95 + index * 0.12, ease: 'power2.out' }
      return { x: gsap.quickTo(layer, 'x', options), y: gsap.quickTo(layer, 'y', options) }
    }))

    function onMove(event) {
      if (event.pointerType !== 'mouse') return
      const x = event.clientX / window.innerWidth - 0.5
      const y = event.clientY / window.innerHeight - 0.5
      move.forEach((layer, index) => {
        layer.x(x * layers[index].shift)
        layer.y(y * layers[index].shift)
      })
    }

    function reset() { move.forEach(layer => { layer.x(0); layer.y(0) }) }

    surface.addEventListener('pointermove', onMove, { passive: true })
    surface.addEventListener('pointerleave', reset)
    return () => {
      surface.removeEventListener('pointermove', onMove)
      surface.removeEventListener('pointerleave', reset)
      context.revert()
    }
  }, [reduced])

  useEffect(() => {
    if (reduced) return
    const star = meteor.current
    const lane = star.parentElement
    let timer
    let animation

    function schedule() {
      timer = window.setTimeout(() => {
        const bounds = lane.getBoundingClientRect()
        if (!document.hidden && bounds.top >= 0 && bounds.bottom <= window.innerHeight) {
          const distance = 44 + Math.random() * 44
          const angle = 9 + Math.random() * 7
          const radians = angle * Math.PI / 180
          star.style.left = 24 + Math.random() * Math.max(0, lane.clientWidth - 145) + 'px'
          star.style.top = 9 + Math.random() * 11 + 'px'
          const start = 'translate(0, 0) rotate(' + angle + 'deg)'
          const end = 'translate(' + Math.cos(radians) * distance + 'px, ' + Math.sin(radians) * distance + 'px) rotate(' + angle + 'deg)'
          animation = star.animate([
            { opacity: 0, transform: start },
            { opacity: 0.72, offset: 0.22 },
            { opacity: 0, transform: end },
          ], { duration: 700 + Math.random() * 400, easing: 'ease-out' })
        }
        schedule()
      }, 15000 + Math.random() * 15000)
    }

    schedule()
    return () => {
      window.clearTimeout(timer)
      animation?.cancel()
    }
  }, [reduced])

  return <div className="starfield" aria-hidden="true" ref={field}>
    {layers.map((layer, index) => <div className="star-layer" key={layer.shift}>
      <i className={'star-dots star-dots-' + index} style={{ boxShadow: layer.shadow }} />
    </div>)}
    <div className="shooting-star-lane"><i className="shooting-star" ref={meteor} /></div>
  </div>
}
