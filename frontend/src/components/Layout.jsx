import { useRef, useState } from 'react'
import { ArrowUp, ArrowUpRight, Menu, X } from 'lucide-react'
import { project } from '../data/project'
import { aerosols, carbonDioxide, nightLights } from '../data/earthStories'

const storyLinks = [
  [nightLights, 'Night Lights'],
  [aerosols, 'Aerosols'],
  [carbonDioxide, 'Carbon Dioxide'],
]

export function Brand({ landing }) {
  return <a className="brand" href={landing ? '#top' : '/'} aria-label="AEVYRA home"><img src="/aevyra.svg" alt="" width="31" height="31" /><span>AEVYRA</span></a>
}

export function Navbar({ story }) {
  const [open, setOpen] = useState(false)
  const menuToggle = useRef(null)

  return <header className="site-header" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      menuToggle.current?.focus()
    }
  }}>
    <div className="shell nav inner">
      <Brand />
      <button id="menu-toggle" ref={menuToggle} className="menu-toggle icon-button" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="navigation" onClick={() => setOpen(!open)}>
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
      <nav id="navigation" aria-label="Main navigation" className={open ? 'is-open' : ''}>
        {storyLinks.map(([item, label]) =>
          <a key={item.path} href={item.path} aria-current={story === item ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</a>,
        )}
      </nav>
      <a className="nav-source" href={project.challengeUrl}>Space Apps Challenge <ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>
  </header>
}

export function Footer({ landing }) {
  return <footer className="site-footer">
    <div className="shell footer-top">
      <div><Brand landing={landing} /><p>Hear the Earth. Feel the Change.</p></div>
      <a className="text-link" href="#top">Back to top <ArrowUp size={15} aria-hidden="true" /></a>
    </div>
    <div className="shell footer-bottom">
      <span>AEVYRA · NASA Space Apps Challenge project</span>
      <a href={project.challengeUrl}>Earth Information Jukebox <ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>
  </footer>
}
