import { formatValue } from '../../services/earthData'

export default function ScientificReadout({ record, name, year }) {
  const measurement = record?.measurement
  const baseline = measurement?.referenceValue
  const difference = baseline == null ? null : measurement.value - baseline
  return <div className="readout angular-glass glass-inset">
    <div className="readout-head"><span className="instrument-label"><i className="signal-dot" /> {name}</span><span className="instrument-label">{year}</span></div>
    <div className="measurement">
      <p>{measurement?.name ?? 'Measurement'}</p>
      {measurement ? <div><strong>{formatValue(measurement.value)}</strong><span>{measurement.unit}</span></div> : <strong className="missing-measurement">Unavailable</strong>}
    </div>
    <dl className="measurement-reference">
      <div><dt>Reference value</dt><dd>{formatValue(baseline)} {baseline != null && <span>{measurement.unit}</span>}</dd></div>
      <div><dt>Difference</dt><dd>{formatValue(difference, true)} {difference != null && <span>{measurement.unit}</span>}</dd></div>
    </dl>
  </div>
}
