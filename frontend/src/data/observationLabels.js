import { featureDatasets } from '../sonification/adapters/mlFeatures.js'

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dated = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function observationLabels(kind) {
  const { frames, step } = featureDatasets[kind]
  const observations = new Map(frames.map((frame, i) => {
    const value = frame.dateTime
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value ?? '')) {
      const date = new Date(value + 'Z')
      // Format the verified image stamp exactly as supplied, without a timezone conversion.
      if (Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)) {
        const time = value.slice(11)
        return [frame[step], { full: dated.format(date) + ' at ' + time, compact: monthDay.format(date) + '\n' + time }]
      }
    }
    return [frame[step], { full: 'Observation ' + (i + 1), compact: 'Obs. ' + (i + 1) }]
  }))
  return {
    label: 'Observation', plural: 'observations',
    format: step => observations.get(step)?.full ?? 'Observation',
    compact: step => observations.get(step)?.compact ?? 'Observation',
  }
}
