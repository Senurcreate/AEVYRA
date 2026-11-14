export type EicDatasetId = 'night-lights-2012-2023' | 'geos-aerosols' | 'ocean-currents';
export type FramePhase = 'annual' | 'change-map';
export type ChangeDirection = 'increase' | 'decrease' | 'stable';

export interface SpatialCell {
  /** x/y are normalized image coordinates; x=0 left, x=1 right. */
  x: number;
  y: number;
  intensity: number;
  coverage: number;
  delta: number;
}

export interface EicFrameTelemetry {
  datasetId: EicDatasetId;
  frameIndex: number;
  /** Seconds into the source video; required for synchronizing playback. */
  timestampSec: number;
  sourceFilename: string;
  phase: FramePhase;
  /** Only available when frame represents a known annual observation. */
  year?: number;
  metrics: {
    /** Average visual illumination after masking overlays, [0,1]. */
    globalIntensity: number;
    /** Fraction of pixels classified as illuminated, [0,1]. */
    litCoverage: number;
    /** Spatial concentration/cluster score, [0,1]. */
    spatialDensity: number;
    /** Signed difference from preceding comparable year, [-1,1]. */
    yearOverYearDelta: number;
    /** Signed difference from 2012 reference, [-1,1]. */
    cumulativeDelta: number;
    /** Salience of a spatially localized change, [0,1]. */
    hotspotAnomaly: number;
    /** Fraction of valid change-map pixels increasing/decreasing, [0,1]. */
    increaseFraction: number;
    decreaseFraction: number;
  };
  spatialCells: SpatialCell[];
  accessibilitySummary: string;
  metadata: {
    extractionMethod: 'canvas' | 'ml' | 'hybrid';
    processingVersion: string;
    /** Human-defined reference frame for temporal comparison. */
    referenceYear: number;
    /** Confidence is optional; absence does not imply certainty. */
    confidence?: number;
  };
}

export type PulseSubdivision = '4n' | '8n' | '16n';
export interface SoundControlFrame {
  frameIndex: number;
  timestampSec: number;
  tempoBpm: number;
  pad: {
    chordNotes: string[];
    filterCutoffHz: number;
    volumeDb: number;
    detuneCents: number;
  };
  pulse: {
    scaleNotes: string[];
    noteDensity: number;
    subdivision: PulseSubdivision;
    harmonicity: number;
    volumeDb: number;
    pan: number;
    /** Fixed seed from the frame for reproducible musical choices. */
    seed: number;
  };
  anomalyShimmer: {
    activeNote: string;
    intensity: number;
    stereoPan: number;
    direction: ChangeDirection;
  };
  sonicLegend: {
    pitchMeaning: string;
    timbreMeaning: string;
    rhythmMeaning: string;
    narrativeSummary: string;
  };
}

export interface DatasetSonificationProfile {
  datasetId: EicDatasetId;
  displayName: string;
  soundIdentity: string;
  mapTelemetryToSound(telemetry: EicFrameTelemetry): SoundControlFrame;
}
