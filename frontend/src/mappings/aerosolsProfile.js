import { aerosolFrames } from '../adapters/aerosolsAdapter';

const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));
const lerp = (a, b, t) => a + (b - a) * t;
const extent = values => [Math.min(...values), Math.max(...values)];
const scale = (value, [min, max]) => max - min < 1e-9 ? 0.5 : clamp((value - min) / (max - min));
const groupExtent = index => extent(aerosolFrames.map(f => f.groupShares[index]));

const ranges = {
  aerosol: extent(aerosolFrames.map(f => f.aerosolShare)),
  brightness: extent(aerosolFrames.map(f => f.meanBrightness)),
  change: extent(aerosolFrames.map(f => f.changeVsPrev ?? 0)),
  sulfate: groupExtent(1), smoke: groupExtent(2),
  seaSalt: groupExtent(3), dust: groupExtent(4),
};

const SCALE = ['D3', 'E3', 'F#3', 'G#3', 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G#4', 'A4'];

export function mapAerosolFrame(frame) {
  const aerosol = scale(frame.aerosolShare, ranges.aerosol);
  const brightness = scale(frame.meanBrightness, ranges.brightness);
  const sulfate = scale(frame.groupShares[1], ranges.sulfate);
  const smoke = scale(frame.groupShares[2], ranges.smoke);
  const seaSalt = scale(frame.groupShares[3], ranges.seaSalt);
  const dust = scale(frame.groupShares[4], ranges.dust);
  const change = scale(frame.changeVsPrev ?? 0, ranges.change);

  // Aerosol-weighted horizontal centroid; spatial position in the visualization only.
  const aerosolGroups = [1, 2, 3, 4];
  const sum = aerosolGroups.reduce((s, i) => s + frame.groupShares[i], 0);
  const x = sum > 0 ? aerosolGroups.reduce((s, i) => s + frame.groupShares[i] * frame.groupCentroidX[i], 0) / sum : 0.5;

  // Each strip is a horizontal image segment with five color-group proportions.
  const stripActivity = frame.strips.map(strip => strip.slice(1).reduce((s, v) => s + v, 0));
  const spread = Math.max(...stripActivity) - Math.min(...stripActivity);

  return {
    frameId: frame.frameId,
    tempo: Math.round(lerp(68, 96, change)),
    padNotes: ['D3', 'A3', 'E4'],
    filterHz: Math.round(lerp(420, 2600, brightness * 0.55 + sulfate * 0.45)),
    padDb: lerp(-26, -19, sulfate),
    // Distinct musical dimensions driven by separate observed image features.
    notes: SCALE.slice(Math.round(lerp(0, 4, dust)), Math.round(lerp(0, 4, dust)) + 7),
    density: lerp(0.22, 0.82, aerosol),
    pulseDb: lerp(-24, -16, smoke),
    shimmerDb: lerp(-29, -19, seaSalt),
    shimmerChance: lerp(0.06, 0.45, seaSalt),
    pan: clamp((x - 0.5) * 2.4, -0.75, 0.75),
    texture: clamp(spread),
    accent: change,
    // Deterministic note pattern per frame, not random on each playback.
    seed: frame.frameIndex >>> 0,
    diagnostics: { aerosol, brightness, sulfate, smoke, seaSalt, dust, change, spread },
  };
}
