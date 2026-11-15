import nightLights from '../../../../ml/output/features.json' with { type: 'json' }
import aerosols from '../../../../ml_aerosols/output/features.json' with { type: 'json' }
import co2 from '../../../../ml_co2/output/features.json' with { type: 'json' }

export const isShare = value => Number.isFinite(value) && value >= 0 && value <= 1
const isVector = (values, size) => Array.isArray(values) && values.length === size && values.every(isShare)

const definitions = {
  'night-lights': { data: nightLights, step: 'year' },
  aerosols: { data: aerosols, step: 'frameIndex', groups: ['background', 'sulfate', 'smoke', 'seaSalt', 'dust'] },
  co2: { data: co2, step: 'frameNumber', groups: ['clear', 'brownDark', 'brownLight', 'grayWhite', 'hot'] },
}

export function readFeatureDataset(kind, definition = definitions[kind]) {
  if (!definition) return null
  const { data, step, groups } = definition
  if (!Array.isArray(data?.frames) || !Array.isArray(data.regions)) throw new TypeError('Invalid ML dataset: ' + kind)
  if (groups && (data.groups?.length !== groups.length || !groups.every((group, i) => data.groups[i] === group))) {
    throw new TypeError('Unexpected ML color group order: ' + kind)
  }
  if (groups && (!Array.isArray(data.clusterGroup) || data.clusterGroup.length !== data.k ||
    !data.clusterGroup.every(group => data.groups.includes(group)))) {
    throw new TypeError('Invalid ML cluster group assignment: ' + kind)
  }
  const frames = [...data.frames].sort((a, b) => (a.order ?? a[step]) - (b.order ?? b[step]))
  const byStep = new Map()
  const regions = data.regions.map(({ id, label, boxesLonLat }) => {
    const [west, east, south, north] = boxesLonLat[0]
    return { id, name: label, lng: (west + east) / 2, lat: (south + north) / 2 }
  })
  function featured(raw, regionId, frame) {
    if (!raw || (kind === 'co2' && regionId !== 'global' && raw.reliable !== true)) return null
    const usable = groups
      ? isVector(raw.groupShares, groups.length) && (kind !== 'aerosols' || isShare(raw.aerosolShare))
      : isShare(raw.litShare) && isVector(raw.tierShares, 4)
    if (!usable) return null
    return { values: raw, regionId, step: frame[step], frameId: frame.frameId, dateTime: frame.dateTime ?? null }
  }
  for (const frame of frames) {
    const id = frame[step]
    if (!Number.isInteger(id) || byStep.has(id)) throw new TypeError('Invalid or duplicate ML frame ID: ' + kind)
    const views = new Map([['global', featured(frame, 'global', frame)]])
    for (const { id: regionId } of regions) views.set(regionId, featured(frame.regions?.[regionId], regionId, frame))
    byStep.set(id, views)
  }
  return { frames, regions, groups: data.groups, sourceUrl: data.sourceUrl, step, get: (id, regionId) => byStep.get(id)?.get(regionId) ?? null }
}

export const featureDatasets = Object.fromEntries(Object.keys(definitions).map(kind => [kind, readFeatureDataset(kind)]))
export function getFeatureFrame(kind, step, regionId = 'global') {
  return Object.hasOwn(featureDatasets, kind) ? featureDatasets[kind].get(step, regionId) : null
}
