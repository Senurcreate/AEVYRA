import { useEffect, useState } from 'react'
import { ArrowUp, ArrowUpRight, Menu, X } from 'lucide-react'
import { project } from '../data/project'

const links = [['experience', 'Experience'], ['compare', 'Compare'], ['science', 'The Science']]

export function Brand() {
  return <a className="brand" href="#top" aria-label="AEVYRA home"><img src="/aevyra.svg" alt="" width="31" height="31" /><span>AEVYRA</span></a>
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  useEffect(() => {
    const observed = ['top', 'story', ...links.map(([id]) => id)]
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: '-20% 0px -65% 0px' })
    for (const id of observed) observer.observe(document.getElementById(id))
    return () => observer.disconnect()
  }, [])

  return <header className="site-header" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      document.getElementById('menu-toggle')?.focus()
    }
  }}>
    <div className="shell nav inner">
      <Brand />
      <button id="menu-toggle" className="menu-toggle icon-button" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="navigation" onClick={() => setOpen(!open)}>
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
      <nav id="navigation" aria-label="Main navigation" className={open ? 'is-open' : ''}>
        {links.map(([id, label]) => <a key={id} href={'#' + id} aria-current={active === id ? 'location' : undefined} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>
      <a className="nav-source" href={project.challengeUrl}>Space Apps Challenge <ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>
  </header>
}

export function Footer() {
  return <footer className="site-footer">
    <div className="shell footer-top">
      <div><Brand /><p>Hear the Earth. Feel the Change.</p></div>
      <a className="text-link" href="#top">Back to top <ArrowUp size={15} aria-hidden="true" /></a>
    </div>
    <div className="shell footer-bottom">
      <span>AEVYRA · NASA Space Apps Challenge project</span>
      <a href={project.challengeUrl}>Earth Information Jukebox <ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>
  </footer>
}
