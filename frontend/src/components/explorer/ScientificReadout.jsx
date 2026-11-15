import { ArrowUpRight } from 'lucide-react'

function ColorLegend({ legend, source }) {
  const { entries, note, scale } = legend
  return <div className="readout-explanation">
    <h4>Color legend</h4>
    {entries && <dl className="color-legend">
      {entries.map(([category, color]) => <div key={category}>
        <dt>{category}</dt><dd>{color}</dd>
      </div>)}
    </dl>}
    {scale && <figure className="legend-scale">
      <svg viewBox={scale.viewBox} aria-hidden="true">
        <image href={scale.src} width={scale.width} height={scale.height} />
      </svg>
      <figcaption className="instrument-label">
        <span className="legend-ticks">{scale.ticks.map(tick => <span key={tick}>{tick}</span>)}</span>
        <span>CO₂ ppm</span>
      </figcaption>
    </figure>}
    {note && <p>{note}</p>}
    {source && <a className="text-link" href={source.url}>View NASA’s visualization <ArrowUpRight size={14} aria-hidden="true" /></a>}
  </div>
}

export default function ScientificReadout({ story, record, name, stepLabel }) {
  return <div className="readout angular-glass glass-inset">
    <div className="readout-head">
      <h3 className="instrument-label"><i className="signal-dot" /> {story.title}</h3>
      {stepLabel && <span className="instrument-label">{name === 'Global Earth' ? stepLabel : name + ' · ' + stepLabel}</span>}
    </div>
    <dl className="measurement readout-figures">
      {story.figureLabels.map(([label, digits], index) => {
        const figure = record?.figures[index]
        const value = figure?.value.toFixed(digits)
        return <div key={label}>
          <dt>{label}</dt>
          <dd>
            <strong>{figure?.category || value || 'Unavailable'}</strong>
            {figure && <span>{figure.category ? value + ' ' : ''}{figure.unit}</span>}
          </dd>
        </div>
      })}
    </dl>
    <div className="readout-explanation">
      <h4>What Are We Seeing?</h4>
      <p>{story.seeing}</p>
    </div>
    <div className="readout-explanation">
      <h4>Why Does It Matter?</h4>
      <p>{story.matters}</p>
    </div>
    <ColorLegend legend={story.legend} source={story.source} />
  </div>
}
