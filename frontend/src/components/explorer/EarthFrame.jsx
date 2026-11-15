import { useState } from 'react'
import { ImageOff } from 'lucide-react'

export function ObservationImage({ image, className = '', style, onLoad, onError, loading = 'lazy' }) {
  const [broken, setBroken] = useState(false)
  if (!image || broken) return <div className={'frame-empty ' + className}>
    <ImageOff size={24} aria-hidden="true" /><span>{broken ? 'Image could not load' : 'Image unavailable'}</span>
  </div>
  return <img className={className} style={style} src={image.src} alt={image.alt} loading={loading} decoding="async"
    onLoad={onLoad} onError={() => { setBroken(true); onError?.() }} />
}

// A zoomed window of the global image (see data/regionView.js). The picture is placed so that `view` fills the frame.
function regionStyle(view) {
  return {
    position: 'absolute', maxWidth: 'none', objectFit: 'fill',
    width: 100 / view.width + '%', height: 100 / view.height + '%',
    left: -100 * view.left / view.width + '%', top: -100 * view.top / view.height + '%',
  }
}

export function EarthFrame({ image, step, stepLabel, scannerRef, regionId, demo, caption = 'Observation frame', view, note }) {
  const [loaded, setLoaded] = useState(false)
  const mediaStyle = view ? { '--region-aspect': view.aspect } : undefined
  return <figure className={'earth-frame' + (view ? ' is-region' : '')}>
    <div className="frame-media" style={mediaStyle}>
      <ObservationImage image={image} loading="eager" style={view ? regionStyle(view) : undefined} onLoad={() => setLoaded(true)} />
      {view?.outlines.map((box, i) => <span key={i} className="region-outline" aria-hidden="true"
        style={{ left: 100 * box.left + '%', top: 100 * box.top + '%', width: 100 * box.width + '%', height: 100 * box.height + '%' }} />)}
      {loaded && scannerRef && <div className="scan-overlay" ref={scannerRef} data-step={step} aria-hidden="true" />}
    </div>
    <figcaption><span>{demo && image ? 'Illustrative image' : caption}</span>{stepLabel && <span>{stepLabel}{regionId === 'global' ? ' · Global' : ''}</span>}</figcaption>
    {note && <p className="frame-note" role="status">{note}</p>}
  </figure>
}
