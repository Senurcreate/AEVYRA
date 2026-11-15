import nightLightsFeatures from '../../../ml/output/features.json'
import aerosolFeatures from '../../../ml_aerosols/output/features.json'
import { demoData } from './demoData'
import { parseDataset } from '../services/earthData'

const nightLightsImages = import.meta.glob('../../../ml/output/frames/*.webp', { eager: true, query: '?url&no-inline', import: 'default' })
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
