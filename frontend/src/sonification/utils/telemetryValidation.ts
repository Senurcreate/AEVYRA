import type { EicFrameTelemetry } from '../types/sonification';

const unit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const signed = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= -1 && v <= 1;
export function assertValidTelemetry(input: EicFrameTelemetry): void {
  
  if (!input || input.datasetId !== 'night-lights-2012-2023') {
    throw new Error('Night Lights mapper requires night-lights-2012-2023 telemetry');
  }
  if (!Number.isInteger(input.frameIndex) || input.frameIndex < 0 ||
      !Number.isFinite(input.timestampSec) || input.timestampSec < 0) throw new Error('Invalid frame timing');
  if (input.phase !== 'annual' && input.phase !== 'change-map') throw new Error('Invalid frame phase');
  if (input.phase === 'annual' && (!Number.isInteger(input.year) || input.year! < 2012 || input.year! > 2023)) {
    throw new Error('Annual Night Lights frame must have a year from 2012 to 2023');
  }

  const m = input.metrics;
  if (!m) throw new Error('Missing telemetry metrics');
  for (const k of ['globalIntensity','litCoverage','spatialDensity','hotspotAnomaly','increaseFraction','decreaseFraction'] as const) {
    if (!unit(m[k])) throw new Error(`Invalid metric: ${k}`);
  }
  for (const k of ['yearOverYearDelta','cumulativeDelta'] as const) {
    if (!signed(m[k])) throw new Error(`Invalid signed metric: ${k}`);
  }

  if (m.increaseFraction + m.decreaseFraction > 1.001) throw new Error('Change fractions exceed 1');
  if (!Array.isArray(input.spatialCells) || input.spatialCells.length === 0) throw new Error('Missing spatial cells');
  for (const cell of input.spatialCells) {
    if (![cell.x,cell.y,cell.intensity,cell.coverage].every(unit) || !signed(cell.delta)) {
      throw new Error('Invalid spatial cell');
    }
  }
  if (!input.metadata || input.metadata.referenceYear !== 2012 || !input.metadata.processingVersion) {
    throw new Error('Missing/invalid analysis metadata');
  }
  if (input.metadata.confidence !== undefined && !unit(input.metadata.confidence)) throw new Error('Invalid confidence');
}
