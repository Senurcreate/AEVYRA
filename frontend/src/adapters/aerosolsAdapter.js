import raw from '../data/aerosols.features.json';

export const AEROSOL_GROUPS = ['background', 'sulfate', 'smoke', 'seaSalt', 'dust'];

function assertFrame(frame) {
  if (!Array.isArray(frame.groupShares) || frame.groupShares.length !== 5 ||
      !Array.isArray(frame.strips) || frame.strips.length !== raw.stripCount ||
      frame.strips.some(strip => !Array.isArray(strip) || strip.length !== 5) ||
      !Number.isFinite(frame.aerosolShare) || !Number.isFinite(frame.meanBrightness)) {
    throw new Error(`Invalid aerosol features for ${frame.frameId}`);
  }
}

// The JSON describes sampled visualization colors, not physical aerosol concentrations.
export const aerosolFrames = [...raw.frames].sort((a, b) => a.order - b.order).map(frame => {
  assertFrame(frame);
  return {
    ...frame,
    datasetId: 'geos-aerosols',
    imageUrl: `/aerosols/${encodeURIComponent(frame.image)}`,
    label: `NASA source frame ${frame.frameIndex}`,
  };
});
export const aerosolSource = raw.sourceUrl;
export const aerosolMetadata = {
  method: raw.method,
  frameCount: aerosolFrames.length,
  verified: aerosolFrames.every(frame => frame.verified === true),
};
