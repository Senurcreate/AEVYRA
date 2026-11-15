/**
 * Aevyra CO2 visualization mapping (NASA SVS 5196).
 * IMPORTANT: groupShares refer to *rendered image colours*, NOT CO2 concentration or ppm.
 * 'hot' orange/red is the most defensible CO2-related visual signal; the other colours
 * largely represent the rotating base map. No causal CO2 trends should be inferred.
 * Fixed normalization bounds: newly added frames will not rescale older frames.
 */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const unit = (x, a, b) => clamp((Number(x || 0) - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;

export const CO2_MAPPING_VERSION = '1.0.0';
export const CO2_MAPPING_CONFIG = Object.freeze({
  hotShareRange: [0, 0.06],  // fraction of globe-disc pixels (not ppm)
  tempoBpmRange: [55, 74],
  padNotes: ['D3', 'A3', 'E4'],
  melodyNotes: ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5'],
  secondsPerFrameAt1x: 7.5,
  baselineGain: 0.17,
  maxPulseGain: 0.12,
});

/** Convert one frame from ml_co2/output/features.json into musical parameters. */
export function mapCo2Frame(frame, groupNames = ['clear','brownDark','brownLight','grayWhite','hot']) {
  if (!frame || !Array.isArray(frame.groupShares)) {
    throw new TypeError('Expected a CO2 ML frame with groupShares array');
  }
  const hotIdx = groupNames.indexOf('hot');
  if (hotIdx < 0) throw new TypeError('CO2 ML groups must contain hot');
  const hotShare = Number(frame.groupShares[hotIdx] || 0);
  const activity = unit(hotShare, ...CO2_MAPPING_CONFIG.hotShareRange);
  // Use variation in hot coverage as an *artistic* pulse, not as a physical derivative.
  // Viewpoint, time-of-day and unevenly spaced frames confound differences.
  const hotDelta = Math.abs(Number(frame.groupShareDeltaVsPrev?.[hotIdx] || 0));
  const pulse = unit(hotDelta, 0, 0.04);
  const screenX = frame.groupCentroidX?.[hotIdx];
  const pan = Number.isFinite(screenX) ? clamp((screenX - 0.5) * 0.6, -0.25, 0.25) : 0;
  const noteIndex = Math.min(CO2_MAPPING_CONFIG.melodyNotes.length-1, Math.floor(activity * CO2_MAPPING_CONFIG.melodyNotes.length));
  return {
    frameId: frame.frameId,
    dateTime: frame.dateTime,
    hotVisualShare: hotShare,
    hotVisualSharePercent: +(hotShare * 100).toFixed(3),
    hotChangeVisualShare: hotDelta,
    activity: +activity.toFixed(5),
    tempoBpm: Math.round(mix(55, 74, 0.75 * activity + 0.25 * pulse)),
    noteProbability: +mix(0.13, 0.46, activity).toFixed(4),
    note: CO2_MAPPING_CONFIG.melodyNotes[noteIndex],
    pulseGain: +mix(0.02, CO2_MAPPING_CONFIG.maxPulseGain, activity).toFixed(4),
    padGain: +mix(0.12, 0.17, activity).toFixed(4),
    filterHz: Math.round(mix(650, 1600, activity)),
    pan: +pan.toFixed(4),
    provenance: 'ML-rendered colour area, not CO2 ppm',
  };
}

export function mapCo2Dataset(data) {
  if (data?.storyId !== 'co2' || !Array.isArray(data.frames)) throw new TypeError('Expected CO2 features.json');
  return {
    mappingVersion: CO2_MAPPING_VERSION,
    sourceUrl: data.sourceUrl,
    disclaimer: 'Visual sonification only: these values are image-colour coverage, not CO2 concentrations. Rotation and diurnal effects confound frame changes.',
    frames: data.frames.map(frame => mapCo2Frame(frame, data.groups)),
  };
}
