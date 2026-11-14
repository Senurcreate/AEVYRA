import { useCallback, useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

const rendererConfig = { antialias: true, alpha: false, powerPreference: 'low-power' }
const empty = []

export default function EarthGlobe({ mode, texture, regions, selected, onSelect, reduced }) {
  const host = useRef(null)
  const globe = useRef(null)
  const selectedRef = useRef(selected)
  const selectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [size, setSize] = useState({ width: 1, height: 1 })
  selectedRef.current = selected
  selectRef.current = onSelect

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 1 && height > 1) setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const image = new Image()
    image.onerror = () => { if (active) setFailed(true) }
    image.src = texture
    const timer = window.setTimeout(() => { if (!ready) setFailed(true) }, 15000)
    return () => { active = false; window.clearTimeout(timer) }
  }, [texture, ready])

  const markReady = useCallback(() => {
    const instance = globe.current
    if (!instance) return
    const controls = instance.controls()
    controls.enableZoom = false
    controls.enablePan = false
    controls.rotateSpeed = 0.65
    const key = new DirectionalLight(0xdcecff, 0.75)
    key.position.set(-100, 165, 220)
    instance.lights([new AmbientLight(0xffffff, 1.25), key])
    setReady(true)
  }, [])

  useEffect(() => {
    const instance = globe.current
    if (!ready || !instance) return
    const onLost = event => { event.preventDefault(); setFailed(true) }
    const canvas = instance.renderer().domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [ready])

  useEffect(() => {
    if (!ready || !globe.current) return
    if (mode === 'regional') globe.current.resumeAnimation()
    else globe.current.pauseAnimation()
  }, [mode, ready])

  useEffect(() => {
    const current = regions.find(region => region.id === selected)
    if (ready && current) globe.current?.pointOfView({ lat: current.lat, lng: current.lng, altitude: 2.10 }, reduced ? 0 : 700)
    for (const mark of host.current?.querySelectorAll('[data-region]') ?? []) {
      mark.setAttribute('aria-pressed', String(mark.dataset.region === selected))
    }
  }, [ready, regions, selected, reduced])

  const marker = useCallback(region => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'globe-marker'
    button.dataset.region = region.id
    button.setAttribute('aria-label', region.name)
    button.setAttribute('aria-pressed', String(selectedRef.current === region.id))
    const name = document.createElement('span')
    name.textContent = region.name
    button.append(name)
    button.onclick = event => { event.stopPropagation(); selectRef.current(region.id) }
    return button
  }, [])

  return <div className="globe-host" ref={host}>
    {!failed && size.width > 1 && <Globe ref={globe} width={size.width} height={size.height}
      animateIn={false} rendererConfig={rendererConfig} backgroundColor="#010101" globeImageUrl={texture}
      atmosphereColor="#A8E4FF" atmosphereAltitude={0.14} showAtmosphere
      htmlElementsData={mode === 'regional' ? regions : empty} htmlLat="lat" htmlLng="lng"
      htmlAltitude={0.012} htmlElement={marker} htmlTransitionDuration={0} onGlobeReady={markReady}
      htmlElementVisibilityModifier={(element, visible) => { element.hidden = !visible; element.tabIndex = visible ? 0 : -1 }} />}
    {(!ready || failed) && <div className="globe-status" role="status">{failed ? 'Globe unavailable. Choose a region from the list.' : 'Loading interactive globe…'}</div>}
  </div>
}
