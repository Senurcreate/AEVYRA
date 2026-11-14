const regions = [
  { id: 'north-america', name: 'North America', lat: 41, lng: -101 },
  { id: 'south-america', name: 'South America', lat: -17, lng: -60 },
  { id: 'europe', name: 'Europe', lat: 51, lng: 19 },
  { id: 'north-africa', name: 'North Africa', lat: 24, lng: 15 },
  { id: 'asia', name: 'Asia', lat: 36, lng: 89 },
  { id: 'oceania', name: 'Oceania', lat: -25, lng: 136 },
]

const index = [50, 52, 49, 55, 54, 58, 57, 61, 60, 65, 63, 68]

function demoStory(year, regionName, difference) {
  const subject = 'The demo uses a fictional value for ' + regionName + ' in ' + year + '.'
  if (difference === 0) return subject + ' It matches the reference value, so both tones have the same pitch.'
  const direction = difference > 0 ? 'above' : 'below'
  const pitch = difference > 0 ? 'higher' : 'lower'
  const unit = Math.abs(difference) === 1 ? 'point' : 'points'
  return subject + ' It is ' + Math.abs(difference) + ' ' + unit + ' ' + direction + ' the reference value, so the changing tone sounds ' + pitch + '.'
}

export const demoData = {
  title: 'Illustrative dataset',
  description: 'Synthetic index values, example tones, and illustrative images. The images do not depict conditions in the selected years.',
  globeTexture: '/media/earth-map.webp',
  regions,
  methodology: 'This demo uses a fictional index. The reference tone stays at 180 Hz, while each synthetic index point from the baseline changes the example tone by 4 Hz.',
  baselineDescription: 'The demo uses an index of 50 and a steady 180 Hz reference tone.',
  records: ['global', ...regions.map(region => region.id)].flatMap((regionId, regionIndex) =>
    index.flatMap((sample, i) => {
      const year = 2012 + i
      if (regionId === 'oceania' && year === 2016) return []
      const referenceValue = 50
      const value = sample + (regionIndex ? (i * (regionIndex + 1) % 11) - 5 : 0)
      const name = regions[regionIndex - 1]?.name ?? 'Earth as a whole'
      return [{
        year, regionId, name: 'Demo measurement', value, unit: 'points', referenceValue,
        story: demoStory(year, name, value - referenceValue),
        image: regionId === 'oceania' && year === 2018 ? undefined : {
          src: regionId === 'global' ? '/media/demo-' + year + '.webp' : '/media/region-' + regionId + '.webp',
          alt: 'Illustrative Earth image for ' + (regions.find(region => region.id === regionId)?.name ?? 'the global view'),
          framing: regionId === 'global' ? 'demo-global-disc' : 'demo-' + regionId,
        },
        audio: {
          reference: { kind: 'tone', hz: 180 },
          changing: { kind: 'tone', hz: 180 + (value - referenceValue) * 4 },
        },
      }]
    }),
  ),
}
