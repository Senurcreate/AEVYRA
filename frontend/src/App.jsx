import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Footer, Navbar } from './components/Layout'
import Hero from './components/Hero'
import StoryTransition from './components/StoryTransition'
import Starfield from './components/Starfield'
import Symphony from './components/explorer/Symphony'
import Comparison from './components/Comparison'
import Science from './components/Science'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useEarthDataset } from './hooks/useEarthDataset'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const main = useRef(null)
  const reduced = useReducedMotion()
  const { dataset, status, error, retry } = useEarthDataset()
  useEffect(() => {
    if (reduced) return
    const context = gsap.context(() => {
      gsap.to('.hero-frame', {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: '#story', start: 'top 88%', end: 'top 28%', scrub: true },
      })
      gsap.timeline({
        defaults: { duration: 0.55, ease: 'power2.out' },
        scrollTrigger: { trigger: '.story-content', start: 'top 86%', once: true },
      })
        .from('.story-heading', { opacity: 0, y: 12 })
        .from('.story-copy', { opacity: 0, y: 6 }, '-=0.28')
        .from('.story-closing', { opacity: 0 }, '-=0.27')
      gsap.from('.experience-heading', {
        y: 14, duration: 0.85, opacity: 0.65, ease: 'power2.out',
        scrollTrigger: { trigger: '.experience-heading', start: 'top 91%', once: true },
      })
      gsap.from('.starfield', {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: '#experience', start: 'top bottom', end: 'top center', scrub: 1 },
      })
    }, main)
    return () => context.revert()
  }, [reduced])

  useEffect(() => {
    if (!reduced) ScrollTrigger.refresh()
  }, [reduced, status])

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <Navbar />
    <main id="main" ref={main} tabIndex={-1}>
      <Hero />
      <StoryTransition />
      <div className="exhibition">
        <Starfield />
        <Symphony dataset={dataset} status={status} error={error} retry={retry} />
        <Comparison dataset={dataset} status={status} />
      </div>
      <Science dataset={dataset} />
    </main>
    <Footer />
  </>
}
