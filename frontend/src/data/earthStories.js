import { aerosolDataset, aerosolGroups, nightLightsDataset, co2Dataset } from './mlDatasets'
import { observationLabels } from './observationLabels.js'

const years = { label: 'Year', plural: 'years', format: String }

export const nightLights = {
  sonificationId: 'night-lights',
  path: '/night-lights', title: 'Night Lights', headline: 'The World After Dark', subtitle: 'Every light tells a story.',
  description: 'Explore Earth’s changing nighttime illumination between 2012 and 2023, and discover how its visual patterns can be transformed into sound.',
  cta: 'Explore Night Lights', cover: nightLightsDataset.getRecord(nightLightsDataset.steps.at(-1))?.image,
  source: nightLightsDataset.source, timeline: years,
  figureLabels: [['Detected Light Coverage', 2], ['Average Image Brightness', 3]],
  seeing: 'Earth’s nighttime lights reveal patterns of human activity. Between 2012 and 2023, some places brightened while others grew darker.',
  matters: 'Nighttime illumination helps researchers study urban growth, infrastructure changes, and disruptions from disasters or conflict.',
  legend: { note: 'Bright areas in the annual maps show nighttime illumination. In NASA’s separate change map, purple means more light, orange means less light, and white means no change.' },
}

export const aerosols = {
  sonificationId: 'aerosols',
  path: '/geos-aerosols', title: 'GEOS Aerosols', headline: 'The Invisible Travelers', subtitle: 'The atmosphere is always in motion.',
  description: 'Follow tiny atmospheric particles as they travel across Earth, and explore the patterns revealed through NASA’s visualizations.',
  cta: 'Explore Aerosols', cover: aerosolDataset.getRecord(aerosolDataset.steps[0])?.image,
  source: aerosolDataset.source, timeline: observationLabels('aerosols'), frameCaption: 'Model visualization',
  figureLabels: [['Detected Aerosol Coverage', 2], ['Leading Aerosol Group', 2]],
  seeing: 'In NASA’s GEOS model, winds and storms carry dust, smoke, sea salt, and sulfates around Earth. The figures show each color group’s share of image pixels.',
  matters: 'Aerosols can affect air quality, visibility, weather, and climate far from where the particles originated.',
  legend: { entries: Object.values(aerosolGroups) }, dataset: aerosolDataset,
}

export const carbonDioxide = {
  sonificationId: 'co2',
  path: '/dyamond-carbon-dioxide', title: 'DYAMOND Global Carbon Dioxide', headline: 'The Breath of Our Planet', subtitle: 'An invisible gas. A changing atmosphere.',
  description: 'Discover how carbon dioxide moves through Earth’s atmosphere and see the patterns winds shape as they carry it around the planet.',
  cta: 'Explore Carbon Dioxide',
  cover: co2Dataset.getRecord(co2Dataset.steps[0])?.image ?? { src: '/media/dyamond-preview.jpg', alt: 'NASA DYAMOND model preview showing carbon dioxide plumes around Earth' },
  source: co2Dataset.source, timeline: observationLabels('co2'), frameCaption: 'Model visualization',
  figureLabels: [['Hot-Color Pixel Coverage', 3], ['Average Image Brightness', 3]],
  seeing: 'Winds carry carbon dioxide through Earth’s atmosphere. Its distribution reflects both natural processes and human activity.',
  matters: 'Carbon dioxide traps heat and contributes to global warming. Following its movement helps researchers study the carbon cycle and climate.',
  legend: {
    scale: { src: '/media/dyamond-legend.png', viewBox: '238 323 1444 202', width: 1920, height: 1080, ticks: [380, 400, 420, 440, 460] },
    note: 'NASA’s legend shows modeled CO₂ in ppm. AEVYRA’s displayed frame features and sonification are based on rendered image colours, not measured ppm.',
  }, dataset: co2Dataset,
}

export const earthStories = [nightLights, aerosols, carbonDioxide]
