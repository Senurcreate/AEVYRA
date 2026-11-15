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
import EarthStories from './components/EarthStories'
import { earthStories, nightLights } from './data/earthStories'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useEarthDataset } from './hooks/useEarthDataset'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const main = useRef(null)
  const reduced = useReducedMotion()
  const path = window.location.pathname.replace(/\/+$/, '')
  const story = earthStories.find(item => item.path === path)
  const isNightLights = story === nightLights
  const nightLightsState = useEarthDataset(isNightLights)
  const { dataset, status, error, retry } = isNightLights ? nightLightsState : {
    dataset: story?.dataset,
    status: story?.dataset ? 'ready' : 'unavailable',
  }

  useEffect(() => {
    if (story) document.title = story.title + ' | AEVYRA'
    if (performance.getEntriesByType('navigation')[0]?.type === 'back_forward') return
    const target = document.getElementById(window.location.hash.slice(1))
    if (!target) return
    // Scroll after ScrollTrigger refreshes the layout.
    const frame = window.requestAnimationFrame(() => target.scrollIntoView())
    return () => window.cancelAnimationFrame(frame)
  }, [story])

  useEffect(() => {
    if (reduced) return
    const context = gsap.context(() => {
      const mobile = window.matchMedia('(width < 768px)')
      const parallax = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      })
      parallax.to('.hero-earth-parallax', { y: () => mobile.matches ? 12 : 30 })
      if (main.current.querySelector('.horizon-particles')) {
        // The stars inherit the Earth's translation, so offset them to move at a different rate.
        parallax.to('.horizon-particles', { y: () => mobile.matches ? -6 : -16 }, 0)
      }
      if (!story) {
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
      }
      if (story) {
        gsap.from('.experience-heading', {
          y: 14, duration: 0.85, opacity: 0.65, ease: 'power2.out',
          scrollTrigger: { trigger: '.experience-heading', start: 'top 91%', once: true },
        })
      }
      gsap.from('.starfield', {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: story ? '#experience' : '#earth-stories', start: 'top bottom', end: 'top center', scrub: 1 },
      })
    }, main)
    return () => context.revert()
  }, [reduced, story])

  useEffect(() => {
    if (!reduced) ScrollTrigger.refresh()
  }, [reduced, status])

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <Navbar story={story} />
    <main id="main" ref={main} tabIndex={-1}>
      <Hero story={story} storyCount={earthStories.length} />
      {!story && <StoryTransition />}
      <div className="exhibition">
        <Starfield />
        {story ? <>
          <Symphony story={story} dataset={dataset} status={status} error={error} retry={retry} />
          {isNightLights && <Comparison dataset={dataset} status={status} labels={story.timeline} />}
          <EarthStories currentStory={story} />
        </> : <EarthStories />}
      </div>
      {!story && <Science />}
    </main>
    <Footer landing={!story} />
  </>
}
