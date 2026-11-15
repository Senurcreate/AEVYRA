import { featureDatasets, isShare } from '../sonification/adapters/mlFeatures.js'
import { parseDataset } from '../services/earthData.js'
import { observationLabels } from './observationLabels.js'

const nightLightsImages = import.meta.glob('../../../ml/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })
const co2Images = import.meta.glob('../../../ml_co2/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })
const aerosolImages = import.meta.glob('../../../ml_aerosols/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })

const pixelShare = share => isShare(share) ? { value: share * 100, unit: '% of image pixels' } : null
const brightness = value => isShare(value) ? { value, unit: 'Normalized image brightness (0–1)' } : null
const aerosolLabels = observationLabels('aerosols')
const co2Labels = observationLabels('co2')

export const aerosolGroups = {
  seaSalt: ['Sea salt', 'Blue'],
  dust: ['Dust', 'Pink and magenta'],
  smoke: ['Smoke', 'Orange and red'],
  sulfate: ['Sulfates', 'Green'],
}

function leadingAerosolGroup(groupShares) {
  return featureDatasets.aerosols.groups.reduce((leading, group, index) => {
    const category = aerosolGroups[group]?.[0]
    const share = pixelShare(groupShares[index])
    if (category && share && share.value > (leading?.value ?? 0)) return { ...share, category }
    return leading
  }, null)
}

function createDataset(kind, { images, alt, figures, measurement, attribution, ...info }) {
  const source = featureDatasets[kind]
  const regions = source.regions
  const regionIds = ['global', ...regions.map(region => region.id)]
  const records = source.frames.flatMap(frame => regionIds.flatMap(regionId => {
    const step = frame[source.step]
    const selected = source.get(step, regionId)
    if (!selected) return []
    const values = figures(selected.values)
    return [{
      [source.step]: step,
      regionId,
      name: measurement,
      value: values[0]?.value,
      unit: '%',
      figures: values,
      image: { src: images[frame.image], alt: alt(step), framing: 'svs-' + kind },
    }]
  }))
  return parseDataset({
    ...info, regions, records, source: { label: attribution, url: source.sourceUrl },
  }, { steps: source.frames.map(frame => frame[source.step]) })
}

function byFileName(images) {
  return Object.fromEntries(Object.entries(images).map(([path, url]) => [path.split('/').at(-1), url]))
}

export const nightLightsDataset = createDataset('night-lights', {
  title: 'Night Lights',
  description: 'Annual NASA visualization frames. The values describe the share of pixels classified as lights in each rendering.',
  attribution: 'NASA SVS · Change in Night Lights',
  methodology: 'The project groups bright pixels in the rendered frames into three brightness tiers. The lit pixel share combines those tiers.',
  measurement: 'Lit pixel share',
  images: byFileName(nightLightsImages),
  alt: year => 'NASA global map of the annual average night lights in ' + year,
  figures: f => [pixelShare(f.litShare), brightness(f.meanBrightness)],
})

export const aerosolDataset = createDataset('aerosols', {
  title: 'GEOS Aerosols',
  description: 'Selected observations from NASA’s August 1 to September 14, 2024 visualization. The sampled observations are unevenly spaced.',
  attribution: 'NASA SVS · GEOS Aerosols',
  methodology: 'The project groups colours in the visualization and calculates the percentage of pixels assigned to aerosol colours.',
  measurement: 'Aerosol-coloured pixel share',
  images: byFileName(aerosolImages),
  alt: step => 'Global GEOS Aerosols model visualization, ' + aerosolLabels.format(step),
  figures: f => [pixelShare(f.aerosolShare), leadingAerosolGroup(f.groupShares)],
})

export const co2Dataset = createDataset('co2', {
  title: 'CO₂',
  description: 'The frame values and sound describe colour features from NASA’s CO₂ visualization.',
  attribution: 'NASA SVS · CO₂',
  methodology: 'The sonification uses hot-colour pixel coverage as a feature of the rendered image.',
  measurement: 'Hot-colour pixel share',
  images: byFileName(co2Images),
  alt: step => 'NASA CO₂ visualization, ' + co2Labels.format(step),
  figures: f => [pixelShare(f.groupShares[4]), brightness(f.meanBrightness)],
})
