import nightLightsFeatures from '../../../ml/output/features.json'
import aerosolFeatures from '../../../ml_aerosols/output/features.json'
import co2Features from './co2.features.json'
import { demoData } from './demoData'
import { parseDataset } from '../services/earthData'

const nightLightsImages = import.meta.glob('../../../ml/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })
const co2Images = import.meta.glob('../../../ml_co2/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })
const aerosolImages = import.meta.glob('../../../ml_aerosols/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })

const isShare = value => Number.isFinite(value) && value >= 0 && value <= 1
const pixelShare = share => isShare(share) ? { value: share * 100, unit: '% of image pixels' } : null

const nightLightsData = {
  title: 'Night Lights',
  description: 'Annual NASA visualization frames. The values describe the share of pixels classified as lights in each rendering.',
  source: { label: 'NASA SVS · Change in Night Lights', url: nightLightsFeatures.sourceUrl },
  methodology: 'The project groups bright pixels in the rendered frames into three brightness tiers. The lit pixel share combines those tiers.',
  regions: [],
  records: nightLightsFeatures.frames.map(({ year, image, litShare, meanBrightness }) => ({
    year,
    regionId: 'global',
    name: 'Lit pixel share',
    value: pixelShare(litShare)?.value,
    unit: '%',
    figures: [pixelShare(litShare), isShare(meanBrightness) ? { value: meanBrightness, unit: 'Normalized brightness of lit pixels (0–1)' } : null],
    image: {
      src: nightLightsImages['../../../ml/output/frames/' + image],
      alt: 'NASA global map of the annual average night lights in ' + year,
      framing: 'svs-night-lights',
    },
  })),
}

export const nightLightsDataset = parseDataset(nightLightsData)

const demoAudioByYear = new Map(demoData.records.filter(record => record.regionId === 'global').map(record => [record.year, record.audio]))
export const nightLightsDemoDataset = {
  ...parseDataset({
    ...nightLightsData,
    regions: demoData.regions,
    globeTexture: demoData.globeTexture,
    records: [
      ...nightLightsData.records.map(record => ({ ...record, audio: demoAudioByYear.get(record.year) })),
      ...demoData.records.filter(record => record.regionId !== 'global'),
    ],
  }),
  demoAudio: true,
  demoRegions: true,
}

export const aerosolGroups = {
  seaSalt: ['Sea salt', 'Blue'],
  dust: ['Dust', 'Pink and magenta'],
  smoke: ['Smoke', 'Orange and red'],
  sulfate: ['Sulfates', 'Green'],
}

function leadingAerosolGroup(groupShares) {
  return aerosolFeatures.groups.reduce((leading, group, index) => {
    const category = aerosolGroups[group]?.[0]
    const share = pixelShare(groupShares?.[index])
    if (category && share && share.value > (leading?.value ?? 0)) return { ...share, category }
    return leading
  }, null)
}

const aerosolFrames = [...aerosolFeatures.frames].sort((a, b) => a.order - b.order)

export const aerosolDataset = parseDataset({
  title: 'GEOS Aerosols',
  description: 'Selected frames from NASA’s August 1 to September 14, 2024 visualization. The timeline uses source frame numbers because the selected frames are unevenly spaced.',
  source: { label: 'NASA SVS · GEOS Aerosols', url: aerosolFeatures.sourceUrl },
  methodology: 'The project groups colours in the visualization and calculates the percentage of pixels assigned to aerosol colours.',
  regions: [],
  records: aerosolFrames.map(({ frameIndex, image, aerosolShare, groupShares }) => ({
    frameIndex,
    regionId: 'global',
    name: 'Aerosol-coloured pixel share',
    value: pixelShare(aerosolShare)?.value,
    unit: '%',
    figures: [pixelShare(aerosolShare), leadingAerosolGroup(groupShares)],
    image: {
      src: aerosolImages['../../../ml_aerosols/output/frames/' + image],
      alt: 'Global GEOS Aerosols model visualization, source frame ' + frameIndex,
      framing: 'svs-geos-aerosols',
    },
  })),
}, { steps: aerosolFrames.map(({ frameIndex }) => frameIndex) })


const co2Frames = [...co2Features.frames].sort((a, b) => a.order - b.order)
export const co2Dataset = parseDataset({
  title: 'CO₂',
  description: 'Image-colour features from NASA CO₂ visualization; these are not measured ppm values.',
  source: { label: 'NASA SVS · CO₂', url: co2Features.sourceUrl },
  methodology: 'Rendered globe colours are grouped into visual categories; hot-colour share is an artistic proxy, not a CO₂ measurement.',
  regions: [],
  records: co2Frames.map(({ frameNumber, image, groupShares, meanBrightness }) => ({
    frameNumber,
    regionId: 'global',
    name: 'Hot-colour pixel share',
    value: pixelShare(groupShares[co2Features.groups.indexOf('hot')])?.value,
    unit: '%',
    figures: [pixelShare(groupShares[co2Features.groups.indexOf('hot')]), isShare(meanBrightness) ? { value: meanBrightness, unit: 'Normalized image brightness (0–1)' } : null],
    image: {
      src: co2Images['../../../ml_co2/output/frames/' + image],
      alt: 'NASA CO₂ visualization, source frame ' + frameNumber,
      framing: 'svs-co2',
    },
  })),
}, { steps: co2Frames.map(({ frameNumber }) => frameNumber) })