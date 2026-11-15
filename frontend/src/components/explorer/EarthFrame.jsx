import { useState } from 'react'
import { ImageOff } from 'lucide-react'

export function ObservationImage({ image, className = '', onLoad, onError, loading = 'lazy' }) {
  const [broken, setBroken] = useState(false)
  if (!image || broken) return <div className={'frame-empty ' + className}>
    <ImageOff size={24} aria-hidden="true" /><span>{broken ? 'Image could not load' : 'Image unavailable'}</span>
  </div>
  return <img className={className} src={image.src} alt={image.alt} loading={loading} decoding="async"
    onLoad={onLoad} onError={() => { setBroken(true); onError?.() }} />
}

export function EarthFrame({ image, step, stepLabel, scannerRef, regionId, demo, caption = 'Observation frame' }) {
  const [loaded, setLoaded] = useState(false)
  return <figure className="earth-frame">
    <div className="frame-media">
      <ObservationImage image={image} loading="eager" onLoad={() => setLoaded(true)} />
      {loaded && scannerRef && <div className="scan-overlay" ref={scannerRef} data-step={step} aria-hidden="true" />}
    </div>
    <figcaption><span>{demo && image ? 'Illustrative image' : caption}</span>{stepLabel && <span>{stepLabel}{regionId === 'global' ? ' · Global' : ''}</span>}</figcaption>
  </figure>
}
