import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, Headphones, MoveDown } from 'lucide-react'
import gsap from 'gsap'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { project } from '../data/project'

const imageSizes = '(width < 768px) 240vw, max(145vw, 1440px)'
const horizonPath = 'M 146 366 A 485 485 0 0 1 1054 366'
const horizonParticles = Array.from({ length: 23 }, (_, index) => {
  const x = 160 + (index * 181 % 880)
  const y = 52 + 485 - Math.sqrt(485 ** 2 - (x - 600) ** 2) - 8 - (index * 13 % 32)
  return { x, y, radius: index % 7 === 0 ? 0.95 : 0.45 + (index % 3) * 0.11 }
})

function HeroAtmosphere({ reduced }) {
  return <svg className="hero-atmosphere" viewBox="0 0 1200 1062" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="atmosphere-light" x2="0%" y2="100%">
        <stop stopColor="#A8E4FF" stopOpacity=".52" />
        <stop offset="1" stopColor="#A8E4FF" stopOpacity="0" />
      </linearGradient>
      {!reduced && <>
        <linearGradient id="aurora-sweep" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="246" y2="0">
          <stop stopColor="#A8E4FF" stopOpacity="0" />
          <stop offset=".3" stopColor="#A8E4FF" stopOpacity=".24" />
          <stop offset=".61" stopColor="#A8E4FF" stopOpacity=".53" />
          <stop offset=".82" stopColor="#DDF5FF" />
          <stop offset="1" stopColor="#A8E4FF" stopOpacity="0" />
          <animateTransform attributeName="gradientTransform" type="translate" from="-156 0" to="1060 0" dur="7s" repeatCount="indefinite" />
        </linearGradient>
        <linearGradient id="aurora-sweep-mobile" href="#aurora-sweep" x2="142">
          <animateTransform attributeName="gradientTransform" type="translate" from="200 0" to="860 0" dur="7s" repeatCount="indefinite" />
        </linearGradient>
      </>}
    </defs>
    <path d={horizonPath} stroke="url(#atmosphere-light)" strokeWidth="4" className="atmosphere-haze" />
    <path d={horizonPath} stroke="url(#atmosphere-light)" strokeWidth=".9" />
    {!reduced && ['aurora-sweep', 'aurora-sweep-mobile'].map((gradient, index) =>
      <g className={'aurora-light ' + (index ? 'aurora-mobile' : 'aurora-desktop')} stroke={'url(#' + gradient + ')'} key={gradient}>
        <path d={horizonPath} strokeWidth="12" className="aurora-halo" />
        <path d={horizonPath} strokeWidth="2.5" className="aurora-core" />
      </g>
    )}
  </svg>
}

function introSeen() {
  try { return sessionStorage.getItem('aevyra-intro-seen') === '1' }
  catch { return false }
}

export default function Hero({ story, storyCount }) {
  const reduced = useReducedMotion()
  const root = useRef(null)
  const poster = useRef(null)
  const [intro, setIntro] = useState(() => !reduced && !introSeen() && !window.location.hash)
  const [ready, setReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const artwork = story?.cover?.src
  const image = artwork || project.heroImage
  const hasVideo = !artwork && project.heroVideo && !reduced && !videoFailed

  function dismiss() {
    try { sessionStorage.setItem('aevyra-intro-seen', '1') }
    catch { /* The intro still closes if storage is unavailable. */ }
    setIntro(false)
  }

  useLayoutEffect(() => {
    if (poster.current?.complete) setReady(true)
  }, [])

  useLayoutEffect(() => {
    if (reduced && intro) dismiss()
    if (reduced) return
    const context = gsap.context(() => {
      if (intro && ready) {
        gsap.to('.intro-screen', { opacity: 0, duration: 0.45, delay: 0.52, onComplete: dismiss })
      } else if (!intro) {
        gsap.timeline({ defaults: { ease: 'power2.out' } })
          .from('.hero-earth', { opacity: 0, scale: 0.98, duration: 1.2 })
          .from('.hero-wordmark', { opacity: 0, y: 13, duration: 0.95 }, 0.04)
          .from('.hero-message', { opacity: 0, y: 14, duration: 0.85 }, 0.2)
      }
    }, root)
    return () => context.revert()
  }, [intro, ready, reduced])

  return <section id="top" className={'hero' + (story ? ' story-hero' : '')} aria-labelledby="hero-title" ref={root}>
    {intro && <div className="intro-screen">
      <div className="intro-name" aria-hidden="true">AEVYRA</div>
      <p role="status">{ready ? 'Opening the experience' : 'Loading Earth imagery'}</p>
      <button type="button" onClick={dismiss}>Skip intro <ArrowDown size={14} aria-hidden="true" /></button>
    </div>}
    <div className="hero-frame shell" inert={intro}>
      <div className="hero-context"><span className="signal-dot" /> NASA Space Apps Challenge <span className="hero-context-divider" /> {story?.title ?? 'Earth Jukebox'}</div>
      <h1 id="hero-title" className="hero-wordmark">{story?.headline ?? 'AEVYRA'}</h1>
      <div className="hero-glow" aria-hidden="true" />
      <div className={'hero-earth' + (artwork ? ' hero-story-art' : '')} aria-hidden="true">
        <div className="hero-earth-parallax">
          <div className="hero-earth-drift">
            {hasVideo ? (
  <video
    autoPlay
    muted
    loop
    playsInline
    preload="metadata"
    poster={project.heroImage}
    onLoadedData={() => setReady(true)}
    onError={() => setVideoFailed(true)}
    className="hero-video"
    src={project.heroVideo}
  />
) : (
  <img
    ref={poster}
    src={image}
    alt=""
    fetchPriority="high"
    onLoad={() => setReady(true)}
    onError={() => {
      setReady(true)
      setImageFailed(true)
    }}
    hidden={imageFailed}
  />
)}
          </div>
        </div>
      </div>
      <div className="hero-message">
        {story ? <p className="hero-tagline">{story.subtitle}</p> : <h2 className="hero-tagline">Hear the Earth.<br /> Feel the Change.</h2>}
        <p className="hero-intro">{story?.description ?? 'Earth is constantly changing. What if we could hear its story?'}</p>
        <a className="primary-button" href={story ? '#experience' : '#earth-stories'}>{story?.cta ?? 'Choose an Earth Story'} <ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      {!story && <div className="hero-bottom">
        <a href="#story" className="scroll-cue"><MoveDown size={16} aria-hidden="true" /> <span>Scroll to explore</span></a>
        <span className="headphone-cue"><Headphones size={15} aria-hidden="true" /> Headphones recommended</span>
        <span className="hero-years">{storyCount} Earth Stories</span>
      </div>}
    </div>
  </section>
}
