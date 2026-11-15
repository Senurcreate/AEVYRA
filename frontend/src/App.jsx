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
      if (!story) {
        gsap.to('.hero-frame', {
          opacity: 0, ease: 'none',
          scrollTrigger: { trigger: '#story', start: 'top 88%', end: 'top 28%', scrub: true },
        })
      }

      const motion = gsap.matchMedia()
      motion.add({ all: 'all', desktop: '(min-width: 768px) and (pointer: fine)' }, ({ conditions: { desktop } }) => {
        if (story) {
          gsap.from('.experience-heading', {
            ...(desktop ? {} : { y: 14 }), duration: 0.85, opacity: 0.65, ease: 'power2.out',
            scrollTrigger: { trigger: '.experience-heading', start: 'top 91%', once: true },
          })
        } else {
          gsap.timeline({
            defaults: { duration: 0.55, ease: 'power2.out' },
            scrollTrigger: { trigger: '.story-content', start: 'top 86%', once: true },
          })
            .from('.story-heading', { opacity: 0, ...(desktop ? {} : { y: 12 }) })
            .from('.story-copy', { opacity: 0, ...(desktop ? {} : { y: 6 }) }, '-=0.28')
            .from('.story-closing', { opacity: 0 }, '-=0.27')
        }

        gsap.utils.toArray('.process').forEach(grid => {
          gsap.from(grid.children, {
            opacity: 0, y: desktop ? 40 : 24, duration: 0.55, stagger: 0.12, ease: 'power2.out',
            scrollTrigger: { trigger: grid, start: 'top 90%', once: true },
          })
        })
        if (!desktop) return

        const scrub = (trigger, start = 'top bottom', end = 'bottom top') => ({
          trigger, start, end, scrub: 0.6, invalidateOnRefresh: true,
        })
        const hero = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: scrub('.hero', 'top top', 'bottom top') })
        hero.to('.hero-glow', { y: -20 }, 0)
        if (story) {
          const artwork = main.current.querySelector('.hero-story-art img')
          if (artwork) hero.fromTo(artwork, { y: 0, scale: 1.05 }, {
            // The artwork extends 24px above the hero. Limit travel on very short windows.
            y: () => Math.min(60, 24 + 0.06 * artwork.offsetHeight), scale: 1.12,
          }, 0)
        } else {
          hero.to('.hero-earth-parallax', { y: 80 }, 0)
            .to('.horizon-particles', { y: -30 }, 0)
        }

        // Pointer motion remains on the parent star layers.
        gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: scrub('.exhibition', 'top bottom', 'clamp(bottom top)') })
          .to('.star-dots-0', { y: -40 }, 0)
          .to('.star-dots-1', { y: -80 }, 0)
          .to('.star-dots-2', { y: -140 }, 0)
        gsap.from('.starfield', {
          opacity: 0, ease: 'none',
          scrollTrigger: scrub(story ? '#experience' : '#earth-stories', 'top bottom', 'top center'),
        })

        gsap.utils.toArray('.section-heading h2, .story-heading, .story-copy').forEach(element => {
          const copy = element.matches('.story-copy')
          gsap.fromTo(element, { y: copy ? 15 : 40 }, {
            y: copy ? -8 : -20, ease: 'none',
            scrollTrigger: scrub(element.closest('.section-heading, .story-content')),
          })
        })
      })
      return () => motion.revert()
    }, main)
    return () => context.revert()
  }, [reduced, story])

  useEffect(() => {
    if (!reduced) ScrollTrigger.refresh()
  }, [reduced, status])

  useEffect(() => {
    if (reduced) return
    const element = main.current
    let frame
    function refreshOnImageLoad(event) {
      if (!(event.target instanceof HTMLImageElement)) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => ScrollTrigger.refresh())
    }
    element.addEventListener('load', refreshOnImageLoad, true)
    return () => {
      element.removeEventListener('load', refreshOnImageLoad, true)
      window.cancelAnimationFrame(frame)
    }
  }, [reduced])

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
