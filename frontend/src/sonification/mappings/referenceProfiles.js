import { featureDatasets } from '../adapters/mlFeatures.js'
import bounds from './referenceBounds.json' with { type: 'json' }

export const SCORE_SECONDS = 27
export const PHRASE_SECONDS = 2.25
export const beatSeconds = kind => PHRASE_SECONDS / (kind === 'co2' ? 5 : 6)
export const secondsPerFrame = count => count > 0 ? SCORE_SECONDS / count : 0
export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value))
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12)

export function normalize(value, low, high) {
  if (!Number.isFinite(value)) return null
  return high - low < 1e-9 ? 0.5 : clamp((value - low) / (high - low))
}

function featureScale(kind, frame) {
  const ranges = bounds[kind][frame.regionId === 'global' ? 'global' : 'regional']
  return (name, value) => normalize(value, ...ranges[name])
}

// Strip values are area fractions within each strip. Empty or hidden strips carry no weight.
function stripPosition(strips, groups) {
  if (!Array.isArray(strips)) return null
  let total = 0
  let moment = 0
  for (const [i, strip] of strips.entries()) {
    const weight = groups.reduce((sum, group) => sum + (Number.isFinite(strip?.[group]) ? clamp(strip[group]) : 0), 0)
    total += weight
    moment += weight * (2 * (i + 0.5) / strips.length - 1)
  }
  return total > 0 ? moment / total : null
}

function centered(x) {
  return Number.isFinite(x) ? 2 * clamp(x) - 1 : null
}

function mapNightLights(frame) {
  const f = frame.values
  const scale = featureScale('night-lights', frame)
  const lit = scale('lit', f.litShare)
  const brightness = scale('brightness', f.meanBrightness) ?? 0.5
  const tier = scale('brightTier', f.tierShares[3])
  const growth = scale('growth', f.grewShare) ?? 0
  const fade = scale('fade', f.fadedShare) ?? 0
  const movement = scale('change', f.changeVsPrev) ?? 0
  const direction = Number.isFinite(f.grewShare) && Number.isFinite(f.fadedShare)
    ? Math.sign(f.grewShare - f.fadedShare) * movement : 0
  const dim = f.litShare > 0 ? clamp(f.tierShares[1] / f.litShare) : 0
  const middle = f.litShare > 0 ? clamp(f.tierShares[2] / f.litShare) : 0
  const pan = 0.22 * (centered(f.centroidX) ?? stripPosition(f.strips, [1, 2, 3]) ?? 0)
  return {
    gain: 0.92 + 0.12 * lit, pan, movement, direction,
    filterHz: 1500 * (3400 / 1500) ** brightness,
    padGain: 0.7 + 0.6 * middle,
    celloGain: 0.76 + 0.48 * dim,
    sparkleCount: 1 + Number(lit > 0.45) + Number(lit > 0.86),
    sparkleGain: (0.011 + 0.012 * tier + 0.005 * growth) * (0.85 + 0.55 * brightness) * (1 + 0.12 * direction - 0.21 * fade),
    pianoVelocity: 0.102 + 0.024 * brightness + 0.012 * direction - 0.008 * fade,
    sparklePan: clamp(pan + 0.24 * (stripPosition(f.strips, [3]) ?? 0), -0.35, 0.35),
  }
}

const [sulfate, smoke, seaSalt, dust] = ['sulfate', 'smoke', 'seaSalt', 'dust']
  .map(group => featureDatasets.aerosols.groups.indexOf(group))
const hot = featureDatasets.co2.groups.indexOf('hot')

function mapAerosols(frame) {
  const f = frame.values
  const scale = featureScale('aerosols', frame)
  const brightness = scale('brightness', f.meanBrightness) ?? 0.5
  const [s, m, a, d] = [[sulfate, 'sulfate'], [smoke, 'smoke'], [seaSalt, 'seaSalt'], [dust, 'dust']]
    .map(([group, name]) => scale(name, f.groupShares[group]))
  function delta(group) {
    const value = f.groupShareDeltaVsPrev?.[group]
    return Number.isFinite(value) ? clamp(value / 0.04, -1, 1) : 0
  }
  function pan(group) {
    const strips = stripPosition(f.strips, [group])
    const centroid = centered(f.groupCentroidX?.[group]) ?? strips ?? 0
    return clamp(0.45 * centroid + 0.12 * (strips ?? 0), -0.45, 0.45)
  }
  const movement = scale('visualChange', f.changeVsPrev) ?? 0
  return {
    gain: 0.85 + 0.18 * scale('coverage', f.aerosolShare), movement,
    filterHz: 1400 * (2800 / 1400) ** brightness,
    breathGain: 0.009 + 0.013 * s + 0.008 * a,
    sulfateGain: (0.67 + 0.57 * s) * (1 + 0.1 * delta(sulfate)),
    smokeGain: (0.55 + 0.66 * m) * (1 + 0.16 * delta(smoke)),
    windGain: (0.020 + 0.018 * d) * (1 + 0.17 * delta(dust)),
    dustHz: 640 + 340 * d + 190 * movement,
    dustCount: 1 + Number(0.6 * d + 0.4 * movement > 0.5),
    saltChance: clamp(0.20 + 0.62 * a + 0.12 * delta(seaSalt)),
    pans: { flute: pan(sulfate) * 0.45, sulfate: pan(sulfate), smoke: pan(smoke), dust: pan(dust), salt: pan(seaSalt) },
  }
}

function mapCo2(frame) {
  const f = frame.values
  const activity = clamp(f.groupShares[hot] / 0.06)
  const delta = f.groupShareDeltaVsPrev?.[hot]
  const strips = stripPosition(f.strips, [hot])
  const x = centered(f.groupCentroidX?.[hot]) ?? strips ?? 0
  const brightness = Number.isFinite(f.meanBrightness) ? clamp(f.meanBrightness) : 0.5
  return {
    gain: 1, activity,
    pan: clamp(x * 0.3, -0.25, 0.25),
    pianoPan: clamp(x * 0.16 + (strips ?? 0) * 0.20, -0.28, 0.28),
    filterHz: 650 + 950 * activity,
    stringsHz: 520 * (1450 / 520) ** brightness,
    padGain: 0.12 + 0.05 * activity,
    pulseGain: 0.02 + 0.10 * activity,
    pulse: Number.isFinite(delta) ? clamp(Math.abs(delta) / 0.04) : 0,
  }
}

const maps = { 'night-lights': mapNightLights, aerosols: mapAerosols, co2: mapCo2 }

export function mapReferenceFrame(kind, frame) {
  if (!frame || !Object.hasOwn(maps, kind)) return null
  const { frameId, step, dateTime, regionId, values } = frame
  const key = [kind, frameId, regionId].join('/')
  let seed = 2166136261
  for (const character of key) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  return {
    key, version: bounds.version, frameId, step, dateTime, regionId, seed: seed >>> 0,
    ...maps[kind](frame),
    spatial: { centroidX: values.groupCentroidX ?? values.centroidX ?? null, strips: values.strips ?? null },
  }
}

// The register and voicings follow prominent pitches in the references.
export const voicings = {
  'night-lights': [[48, 55, 60, 64, 67, 72], [45, 52, 57, 60, 64, 67], [41, 48, 53, 57, 60, 65], [43, 50, 55, 59, 62, 67]],
  aerosols: [[50, 57, 62, 65, 69], [50, 57, 62, 65, 72], [52, 57, 64, 67, 71], [53, 60, 65, 69, 72]],
  co2: [[38, 50, 53, 57, 62], [34, 46, 50, 53, 58], [43, 50, 55, 58, 62], [33, 45, 52, 57, 60]],
}
const nightForm = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 0]
const airForm = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 1, 0]
const seededUnit = (seed, phrase) => ((Math.imul(seed ^ (phrase + 1), 1664525) + 1013904223) >>> 0) / 4294967296

export function eventsAtBeat(kind, c, beat) {
  if (!c) return []
  const slots = kind === 'co2' ? 5 : 6
  const phrase = Math.floor(beat / slots) % 12
  const slot = beat % slots
  const variant = (c.seed + phrase) % 3
  const events = []
  const add = (voice, notes, seconds, velocity, hold = false) => events.push({ voice, notes, seconds, velocity, hold })
  if (kind === 'night-lights') {
    const [bass, fifth, root, third, upper, octave] = voicings[kind][nightForm[phrase]]
    const dynamic = 0.82 + 0.19 * Math.min(phrase, 9) / 9
    if (slot === 0) {
      add('strings', [fifth, root, third], 2.44, 0.047 * dynamic, true)
      add('cello', [bass], 2.36, 0.083 * dynamic, true)
      if ([0, 5, 8].includes(phrase)) add('rumble', [bass - 24], 3.35, 0.010, true)
      add('piano', [root], 0.73, c.pianoVelocity * dynamic)
    }
    if (slot === 2 && (phrase % 2 === 0 || c.movement > 0.48)) {
      add('piano', [c.direction < -0.32 ? fifth : c.movement > 0.57 ? upper : third], 0.46, c.pianoVelocity * dynamic * 0.8)
    }
    if (slot === 4) add('piano', [c.direction > 0.44 ? octave : upper], 0.58, c.pianoVelocity * dynamic * 0.83)
    const sparkleSlot = [1, 3, 5].indexOf(slot)
    if (sparkleSlot >= 0 && (sparkleSlot + variant) % 3 < c.sparkleCount) {
      add('sparkle', [[upper, octave, third + 12][(variant + sparkleSlot) % 3] + 12], 0.19, c.sparkleGain * dynamic ** 2)
    }
  } else if (kind === 'aerosols') {
    const [bass, fifth, root, third, upper] = voicings[kind][airForm[phrase]]
    if (slot === 0) {
      add('sulfate', [bass, fifth], 2.46, 0.052, true)
      if (phrase % 2 === 0) add('smoke', [bass - 12, fifth], 4.65, 0.039, true)
      add('flute', [root], phrase % 2 === 1 ? 1.19 : 2.26, 0.085 + c.breathGain, true)
    }
    if (slot === 3 && phrase % 2 === 1) add('flute', [c.movement > 0.55 ? upper : third], 1.30, 0.078 + c.breathGain, true)
    if (slot === 1 || (slot === 4 && c.dustCount === 2)) {
      events.push({ voice: 'dust', notes: [], grainSeed: (c.seed ^ Math.imul(beat + 1, 2654435761)) >>> 0,
        seconds: 0.65, velocity: c.windGain, hold: false })
    }
    if (slot === (c.movement > 0.64 ? 3 : 5) && seededUnit(c.seed, phrase) < c.saltChance) {
      add('salt', [[third, upper, fifth + 12][variant]], 0.46, 0.017 + 0.010 * c.saltChance)
    }
  } else if (kind === 'co2') {
    const [bass, root, middle, upper, octave] = voicings[kind][Math.floor(phrase / 3)]
    if (slot === 0 && phrase % 3 === 0) {
      add('strings', [root, middle, upper], 6.88, 0.51, true)
      add('drone', [bass], 6.91, 0.048, true)
      add('cello', [root], 3.87, 0.104 + 0.016 * c.activity, true)
    }
    if (slot === 2 && phrase % 3 === 1) {
      add('cello', [c.pulse > 0.66 ? upper : middle], 3.42, 0.095 + c.pulseGain * c.pulse * 0.23, true)
    }
    if (slot === 2 && phrase % 3 === 2) add('piano', [variant === 0 ? upper : octave], 0.83, 0.064 + c.pulseGain * c.pulse * 0.30)
    if (slot === 4 && c.pulse > 0.73) add('piano', [root], 0.63, 0.036 + c.pulseGain * c.pulse * 0.24)
  }
  return events
}
