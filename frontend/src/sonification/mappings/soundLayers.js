// The five sound layers of every story and what drives them. This is documentation that is also checked by a test:
// every voice the engine plays belongs to exactly one layer, and `basis` says honestly whether a layer follows the
// data or is atmosphere only. All values are features of the rendered NASA images (shares of coloured pixels,
// normalized brightness), never measured radiance, aerosol amounts or CO₂ concentrations.
//
//   ambient      soft sustained pads: the overall state of the selected observation
//   melodic      the notes you follow: differences between groups or regions and change over time
//   rhythmic     soft pulses: how much the picture changed since the previous observation
//   detail       small high sparkles for local or smaller features
//   environmental  texture behind the music, secondary to the data

export const soundLayers = {
  'night-lights': {
    ambient: { voices: ['strings', 'cello'], plain: "Warm pads that follow how much of the lit area is dim or medium, and how bright the picture is.", basis: 'data',
      drivers: 'strings level <- share of lit pixels in the middle brightness tier; cello level <- share in the dim tier; filter <- meanBrightness; pan <- centroidX' },
    melodic: { voices: ['piano'], plain: "Soft piano that brightens, and rises or falls, as the lights grow or fade.", basis: 'data',
      drivers: 'velocity <- meanBrightness and the balance of grewShare vs fadedShare; note choice <- that balance and changeVsPrev' },
    rhythmic: { voices: ['pulse'], plain: "Gentle pulses that appear when the lights changed since the previous year.", basis: 'data',
      drivers: 'number and firmness of pulses <- changeVsPrev (none when the lights did not change)' },
    detail: { voices: ['sparkle'], plain: "Little sparkles for the brightest lights.", basis: 'data',
      drivers: 'number of sparkles <- litShare; loudness <- share in the brightest tier and grewShare; pan <- bright-tier strips' },
    environmental: { voices: ['rumble'], plain: "A very quiet low rumble. Atmosphere only; it carries no data.", basis: 'atmosphere',
      drivers: 'atmosphere only: a very quiet low rumble on fixed phrases; carries no data' },
  },
  aerosols: {
    ambient: { voices: ['sulfate', 'smoke'], plain: "Sulfate and smoke pads that rise and fall with their share of the picture.", basis: 'data',
      drivers: 'sulfate level <- sulfate (green) share; smoke level <- smoke (orange/red) share; their change vs the previous observation nudges both; filter <- meanBrightness; pan <- group centroids' },
    melodic: { voices: ['flute'], plain: "A breathy flute that follows sulfate and sea salt, and reaches higher when the picture changes more.", basis: 'data',
      drivers: 'loudness <- sulfate and sea-salt shares; upper note when changeVsPrev is high' },
    rhythmic: { voices: ['pulse'], plain: "Gentle pulses that appear when the picture changed since the previous observation.", basis: 'data',
      drivers: 'number and firmness of pulses <- changeVsPrev (none when the picture did not change)' },
    detail: { voices: ['salt'], plain: "Sparse, airy notes for sea salt.", basis: 'data',
      drivers: 'chance of a sparse airy note <- sea-salt (blue) share and its change' },
    environmental: { voices: ['dust'], plain: "A drifting breath of wind that follows dust.", basis: 'data',
      drivers: 'a breath-like wind texture: level <- dust (pink/magenta) share; brightness and density <- dust share and changeVsPrev' },
  },
  co2: {
    ambient: { voices: ['strings'], plain: "Strings that follow how much hot colour is in the picture.", basis: 'data',
      drivers: 'level <- hot-colour share of the picture; filter <- meanBrightness; pan <- hot-colour centroid' },
    melodic: { voices: ['cello', 'piano'], plain: "Cello and piano that follow the hot-colour share and how much it changed.", basis: 'data',
      drivers: 'loudness and note choice <- hot-colour share and the size of its change since the previous observation' },
    rhythmic: { voices: ['pulse'], plain: "Gentle pulses that appear when the hot colour changed since the previous frame.", basis: 'data',
      drivers: 'number and firmness of pulses <- size of the change in hot-colour share (none when it did not change)' },
    detail: { voices: ['glint'], plain: "Faint high glints while there is hot colour. A picture feature, not CO₂ ppm.", basis: 'data',
      drivers: 'number and loudness of faint high glints <- hot-colour share of the picture (a rendered-image feature, not CO₂ ppm)' },
    environmental: { voices: ['drone'], plain: "A quiet low drone. Atmosphere only; it carries no data.", basis: 'atmosphere',
      drivers: 'atmosphere only: a quiet low drone on fixed phrases; carries no data' },
  },
}

export const soundLayerNames = ['ambient', 'melodic', 'rhythmic', 'detail', 'environmental']

export const soundLayerLabels = {
  ambient: 'Ambient foundation',
  melodic: 'Melodic data layer',
  rhythmic: 'Rhythmic layer',
  detail: 'Detail layer',
  environmental: 'Environmental texture',
}
