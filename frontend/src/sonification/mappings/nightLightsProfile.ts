import type { DatasetSonificationProfile, EicFrameTelemetry, SoundControlFrame, ChangeDirection } from '../types/sonification';
import { assertValidTelemetry } from '../utils/telemetryValidation';
import { clamp, expScale, lerp, quantizeToScale, smoothstep, SCALES } from '../utils/musicTheory';

const SCALE = SCALES.D_LYDIAN;
function signedDirection(value: number): ChangeDirection {
  return value > 0.035 ? 'increase' : value < -0.035 ? 'decrease' : 'stable';
}
function spatialPan(t: EicFrameTelemetry): number {
  // Weighted horizontal centroid of visible illumination CHANGE; left image -> left ear.
  const weights = t.spatialCells.map(c => t.phase === 'change-map' ? Math.abs(c.delta) * c.coverage : c.intensity * c.coverage);
  const total = weights.reduce((s,v) => s+v, 0);
  if (total < 1e-6) return 0;
  const x = t.spatialCells.reduce((s,c,i) => s + c.x*weights[i], 0) / total;
  return clamp((x-0.5)*1.5, -0.75, 0.75);
}
export const nightLightsProfile: DatasetSonificationProfile = {
  datasetId: 'night-lights-2012-2023',
  displayName: 'Change in Night Lights (2012–2023)',
  soundIdentity: 'D Lydian nocturnal soundscape',
  mapTelemetryToSound(t: EicFrameTelemetry): SoundControlFrame {
    assertValidTelemetry(t);
    const m = t.metrics;
    const changeMap = t.phase === 'change-map';
    // Rendered-image values are visualization-relative, not calibrated radiance.
    const illumination = clamp(m.globalIntensity * 0.68 + m.litCoverage * 0.32);
    const change = changeMap ? m.increaseFraction - m.decreaseFraction : m.yearOverYearDelta;
    const magnitude = changeMap ? clamp(m.increaseFraction + m.decreaseFraction) : clamp(Math.abs(m.yearOverYearDelta));
    const direction = signedDirection(change);
    const growth = clamp((m.cumulativeDelta + 1) / 2);
    // const growth = clamp(m.cumulativeDelta);

    const activity = clamp(m.spatialDensity * 0.55 + m.litCoverage * 0.25 + magnitude * 0.20);
    const tempoBpm = Math.round(lerp(64, 96, smoothstep(activity)));
    const chordNotes = illumination < 0.30
      ? ['D2','A2','E3']
      : illumination < 0.62
        ? ['D2','A2','E3','F#3']
        : ['D2','A2','E3','F#3','G#3'];
    // The pulse's note register follows baseline-relative change, while timbre tracks intensity.

    const register = changeMap ? clamp((change+1)/2) : growth;
    const start = Math.min(6, Math.floor(register*7));
    const scaleNotes = [...SCALE.slice(start, start+7)];
    const subdivision = activity > 0.74 ? '16n' : activity > 0.42 ? '8n' : '4n';
    const pan = spatialPan(t);
    const accentIntensity = clamp(magnitude * 0.65 + m.hotspotAnomaly * 0.35);
    const shimmerPosition = changeMap ? clamp((change+1)/2) : clamp((m.yearOverYearDelta+1)/2);
    const shimmerNote = quantizeToScale(shimmerPosition, SCALE.slice(4));
    return {
      frameIndex: t.frameIndex,
      timestampSec: t.timestampSec,
      tempoBpm,
      pad: {
        chordNotes,
        filterCutoffHz: Math.round(expScale(illumination, 260, 2900)),
        volumeDb: lerp(-23, -15, illumination),
        detuneCents: lerp(2, 8, m.hotspotAnomaly),
        //detuneCents: lerp(0,18,Math.abs(m.cumulativeDelta)),
      },
      pulse: {
        scaleNotes,
        noteDensity: lerp(0.17, 0.78, activity),
        subdivision,
        harmonicity: lerp(1.5, 3.2, illumination),
        volumeDb: lerp(-22, -15, activity),
        pan,
        seed: ((t.frameIndex+1)*2654435761) >>> 0,
      },
      anomalyShimmer: {
        activeNote: shimmerNote,
        intensity: accentIntensity,
        stereoPan: pan,
        direction,
      },
      sonicLegend: {
        pitchMeaning: changeMap
          ? 'Higher/lower accent notes reflect the balance of visible illumination increases and decreases.'
          : 'Pulse register reflects signed illumination change relative to the 2012 reference.',
        timbreMeaning: 'Pad brightness reflects image-derived illumination; this is not calibrated radiance.',
        rhythmMeaning: 'Pulse activity reflects illuminated coverage, spatial concentration and change magnitude.',
        narrativeSummary: t.accessibilitySummary,
      },
    };
  },
};
