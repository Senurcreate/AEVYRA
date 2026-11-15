export const YEARS = Object.freeze(Array.from({ length: 12 }, (_, i) => 2012 + i))
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 4 })

const hasText = value => typeof value === 'string' && value.trim().length > 0
const optionalText = value => hasText(value) ? value.trim() : ''

export function isWebUrl(url) {
  return !url.username && !url.password && (url.protocol === 'https:' ||
    (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
}

function mediaUrl(value, base) {
  if (!hasText(value) || /[\s\\]/.test(value) || value.startsWith('//')) return null
  if (!base && value.startsWith('/')) return value
  try {
    const url = new URL(value, base)
    return isWebUrl(url) ? url.href : null
  } catch {
    return null
  }
}

function audioSource(source, base) {
  if (source?.kind === 'file') {
    const src = mediaUrl(source.src, base)
    return src ? { kind: 'file', src } : null
  }
  if (source?.kind === 'tone' && Number.isFinite(source.hz) && source.hz >= 40 && source.hz <= 2000) {
    return { kind: 'tone', hz: source.hz }
  }
  return null
}

export function parseDataset(input, { demo = false, base, steps = YEARS } = {}) {
  if (!input || !Array.isArray(input.regions) || !Array.isArray(input.records)) {
    throw new Error('The dataset response must include regions and records arrays.')
  }
  const records = new Map()
  const availableSteps = new Set(steps)
  const seenRegions = new Set(['global'])
  const regions = input.regions.filter(region => {
    if (!hasText(region?.id) || seenRegions.has(region.id) || !hasText(region.name) ||
      !Number.isFinite(region.lat) || Math.abs(region.lat) > 90 ||
      !Number.isFinite(region.lng) || Math.abs(region.lng) > 180) return false
    seenRegions.add(region.id)
    return true
  })

  for (const record of input.records) {
    const step = record?.frameIndex ?? record?.frameNumber ?? record?.year
    if (!availableSteps.has(step) || !seenRegions.has(record.regionId)) continue
    const key = JSON.stringify([record.regionId, step])
    if (records.has(key)) continue
    const measurement = hasText(record.name) && hasText(record.unit) && Number.isFinite(record.value)
      ? { name: record.name, unit: record.unit, value: record.value, referenceValue: Number.isFinite(record.referenceValue) ? record.referenceValue : null }
      : null
    const src = mediaUrl(record.image?.src, base)
    const image = src && hasText(record.image?.alt)
      ? { src, alt: record.image.alt, framing: optionalText(record.image.framing) || null }
      : null
    const audio = { reference: audioSource(record.audio?.reference, base), changing: audioSource(record.audio?.changing, base) }
    const figures = Array.isArray(record.figures) ? record.figures.slice(0, 2).map(figure =>
      Number.isFinite(figure?.value) ? { value: figure.value, unit: optionalText(figure.unit), category: optionalText(figure.category) } : null,
    ) : []
    const story = optionalText(record.story)
    const explanation = optionalText(record.explanation)
    if (!measurement && !image && !audio.reference && !audio.changing && !figures.some(Boolean) && !story && !explanation) continue
    records.set(key, {
      step, regionId: record.regionId, measurement, image, audio, figures, explanation, story,
    })
  }

  const sourceUrl = mediaUrl(input.source?.url, base)
  const hasAudio = [...records.values()].some(({ audio }) => audio.reference || audio.changing)
  return {
    demo, regions, steps, hasAudio,
    title: optionalText(input.title) || 'Earth observation dataset',
    description: optionalText(input.description),
    source: hasText(input.source?.label) && sourceUrl ? { label: input.source.label, url: sourceUrl } : null,
    methodology: optionalText(input.methodology),
    baselineDescription: optionalText(input.baselineDescription),
    globeTexture: mediaUrl(input.globeTexture, base) || '/media/earth-map.webp',
    getRecord: (step, regionId = 'global') => records.get(JSON.stringify([regionId, step])) ?? null,
  }
}

export function formatValue(value, signed = false) {
  if (!Number.isFinite(value)) return '—'
  return (signed && value > 0 ? '+' : '') + numberFormat.format(value)
}
