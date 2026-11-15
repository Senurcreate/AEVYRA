# AEVYRA sonification mapping

The explorer reads the original NASA visualization feature JSON and synthesizes each changing tone with Tone.js. [The musical specification](SONIFICATION_MUSICAL_SPECIFICATION.md) records the reference analysis, voice parameters, note frequencies, and exact mapping equations.

| Story | Canonical ML output | Internal lookup | Visible timeline |
| --- | --- | --- | --- |
| Night Lights | [features.json](../ml/output/features.json) | Year | 2012 through 2023 |
| GEOS Aerosols | [features.json](../ml_aerosols/output/features.json) | Source frame index | Observation number in source order |
| DYAMOND CO₂ | [features.json](../ml_co2/output/features.json) | Source frame number | Verified image date/time stamp in the source's unstated time zone |

## Playback and synchronization

- An exclusive audio session anchors the score to the Web Audio clock. The logical score position is the saved offset plus elapsed audio-clock time multiplied by the selected speed. Changing speed first saves the current position, then uses the new rate from that position.
- The full generated score is 27 seconds at 1×. Each of the 12 observations gets a 2.25-second slot. At the default 0.75×, each slot takes 3 seconds and a full run takes 36 seconds. The other speeds are 0.5×, 1×, and 1.25×. The speed changes event spacing and note hold times. Note frequencies and envelope settings remain fixed.
- The scheduler resolves each note's feature controls at its scheduled score position. Continuous gain, pan, and filter changes start at the frame boundary with a short ramp. A shared schedule resolves the image, selected marker, and scanner progress. The next image is prefetched.
- The scanner samples the same clock on animation frames. It writes CSS properties directly and honors reduced motion. React updates the active observation only when its index changes. Pause freezes the position, seek jumps to the selected observation boundary and preserves play or pause state, and reaching the end stops the session on the final frame.
- Regional views use the selected region's features and show the global image for context. An unavailable CO₂ region fades to silence while time advances. Selecting a reliable region restores the appropriate held section.
- Reference Tone is a fixed D3 sine. A separate Changing Tone preview holds the selected observation for one score cycle. Then vs Now plays two four-second Night Lights previews with the same opening chord form and separate feature values.

## Adding observations

Add the generated image and record to the relevant canonical ML output. Keep the chronological order, unique observation ID, image filename, group order, and region IDs consistent with existing records. Keep the versioned percentile bounds for compatibility. Recompute them and increment the version for deliberate recalibrations. Run `npm test` and `npm run build` from `frontend`.

## Scientific scope

Night Lights uses rendered brightness and cluster shares as proxies for illumination. Aerosols uses shares of classified visualization colors. CO₂ uses rendered hot-color coverage, which is affected by the rotating globe and viewing angle. The sonification represents these image features. The original NASA color scale is shown separately for reference.
