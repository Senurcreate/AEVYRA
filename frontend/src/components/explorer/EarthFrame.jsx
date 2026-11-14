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

export function EarthFrame({ image, year, regionId, demo }) {
  const [loaded, setLoaded] = useState(false)
  return <figure className="earth-frame">
    <div className="frame-media">
      <ObservationImage image={image} loading="eager" onLoad={() => setLoaded(true)} />
      {loaded && <div className="scan-overlay" aria-hidden="true" />}
    </div>
    <figcaption><span>{demo && image ? 'Illustrative image' : 'Observation frame'}</span><span>{year}{regionId === 'global' ? ' · Global' : ''}</span></figcaption>
  </figure>
}
