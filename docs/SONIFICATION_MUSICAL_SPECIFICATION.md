# AEVYRA musical specification

## Reference analysis

The three previously confirmed MP3s were decoded offline to stereo PCM. Three-second windows were measured with overlapped Hann-windowed spectra. Their prominent frequencies support the following pitch centers and registers. A finished stereo mix cannot identify the original patches, ADSRs, isolated stems, or exact effect settings.

| Inspected reference | Decoded time / RMS / L–R correlation | Measured tonal evidence and arrangement decision |
| --- | --- | --- |
| `night_lights_reference_faithful_27s.mp3` | 27.00 s / −22.5 dBFS / 0.976 | Bass areas near 131, 110, 87, and 98 Hz support C–Am–F–G, with upper energy near 523, 784, and 880 Hz. The warm piano, strings, cello, and distant light accents are working timbre targets from the brief. The older D Lydian palette was changed because the measured centers and F-natural sit better in C major and its relative minor. |
| `aerosols_hidden_motion_v5_27s (1).mp3` | 27.00 s / −24.4 dBFS / 0.152 | Prominent D/E/F roots and F-natural, A, B-natural, and C support a D-centered Dorian collection. The stable D section gives way to E and F before returning. The mix's stereo channels are less correlated than either other reference. Sustained flute-like sound and scattered particles are timbre targets. |
| `co2_distinct_27s.mp3` | 27.00 s / −23.8 dBFS / 0.972 | Low peaks near 73, 58, 98, and 110 Hz support Dm–B♭–Gm–Am. The generated score uses D natural minor with sustained chord blocks and sparse piano. Its 66.67 BPM quarter-note grid is inside the older 55–74 BPM range. |

The brief names numbered copies. Those files were absent from the available attachments and Downloads during this revision. The table identifies the exact earlier recordings used. All settings below describe the generated engine. They are implementation choices informed by the recordings.

## Shared equations

- Feature values and selected image IDs come from the canonical JSON. Each data control is derived independently of the audio references.
- For Night Lights and Aerosols, `n(v) = clamp((v − p05) / (p95 − p05), 0, 1)` with separate global and pooled regional bounds in [referenceBounds.json](../frontend/src/sonification/mappings/referenceBounds.json). Fractions and change magnitudes have an original domain of 0–1. Percentiles are linearly interpolated over finite values at `(N − 1)p`. A span under `1e-9` maps to `0.5`. Invalid optional data is handled as specified per mapping. The adapter checks shares, group order, and cluster-group metadata before mapping.
- `trim(x, lo, hi) = min(hi, max(lo, x))`. `center(x) = 2 × clamp(x) − 1` for finite position fractions. `strip(g)` is the share-weighted mean of strip midpoints `2(i+0.5)/N − 1` for group set `g`. Missing or hidden strips contribute zero weight. An empty moment and missing centroid fall back to center.
- Pitch uses equal temperament `Hz = 440 × 2^((MIDI − 69)/12)`. MIDI voicings live in [referenceProfiles.js](../frontend/src/sonification/mappings/referenceProfiles.js). ADSRs below give attack, decay, sustain, and release. The durations use seconds except sustain, which is a fraction. Voice hold times are in score seconds. Velocity is linear 0–1.

## Night Lights

The harmonic order is C for phrases 1–3, Am for 4–5, F for 6–8, G for 9–11, then C. Each phrase is 2.25 seconds. The 0.375-second subdivision gives an 80 BPM quarter-note grid. Let `E = 0.82 + 0.19 × min(phraseIndex,9)/9` with zero-based phrase index.

| Layer and Tone.js voice | Oscillator / synthesis | Notes and fundamental frequencies in Hz | ADSR, hold, and velocity | Filter and layer gain |
| --- | --- | --- | --- | --- |
| Warm strings, `Synth` | Triangle with four partials | G3/C4/E4, E3/A3/C4, C3/F3/A3, D3/G3/B3. Hz C3 130.81, D3 146.83, E3 164.81, F3 174.61, G3 196.00, A3 220.00, B3 246.94, C4 261.63, E4 329.63 | (0.82, 0.75, 0.72, 1.65), 2.44 s, `0.047 E` | Low-pass at `0.78 F`, gain `0.70 + 0.60 middle` |
| Cello foundation, `FMSynth` | Triangle carrier / sine modulator, ratio 1, index 0.52 | C3 130.81, A2 110, F2 87.31, G2 98 | (0.50, 0.55, 0.76, 1.15), mod (0.42, 0.70, 0.40, 0.94), 2.36 s, `0.083 E` | 720 Hz, gain `0.76 + 0.48 dim` |
| Piano, `FMSynth` | Sine/sine, ratio 2, index 1.48 | C3 130.81, D3 146.83, E3 164.81, F3 174.61, G3 196, A3 220, B3 246.94, C4 261.63, D4 293.66, E4 329.63, F4 349.23, G4 392, C5 523.25 | (0.019, 0.44, 0.20, 0.72), mod (0.012, 0.19, 0.032, 0.24), 0.46–0.73 s, mapped velocity × `E` × 0.8–1 | Low-pass at `F`, unity gain |
| Celesta-like sparkle, `FMSynth` | Sine/sine, ratio 2.5, index 0.62 | C5 523.25, D5 587.33, E5 659.26, F5 698.46, G5 783.99, A5 880, B5 987.77, C6 1046.50, E6 1318.51 | (0.012, 0.23, 0.08, 0.55), mod (0.012, 0.15, 0.06, 0.31), 0.19 s, mapped velocity × `E²` | 4800 Hz, unity gain |
| Distant rumble, `Synth` | Sine with two partials | F0 21.83, G0 24.50, C1 32.70 | (1.15, 0.60, 0.62, 1.30), 3.35 s, 0.010 | 27 Hz high-pass and 95 Hz low-pass. Centered. Fixed in phrases 1, 6 and 9. |

| Original feature | Meaning, normalization, and handling | Applied control and range |
| --- | --- | --- |
| `litShare` | Share classified as lit, `L = n(litShare)`. Unusable frames are silent. | Scene gain `0.92 + 0.12L` and sparkle count `1 + (L>.45) + (L>.86)` per phrase. The frame/region key rotates accent positions among slots 1, 3, and 5. |
| `meanBrightness` | Normalized rendered light brightness, `B = n(meanBrightness)`, fallback 0.5 | `F = 1500(3400/1500)^B` Hz. Sparkle multiplier `0.85 + 0.55B`. |
| `tierShares` | Relative image coverage by tier. `dim = clamp(tierShares[1]/litShare)`, `middle = clamp(tierShares[2]/litShare)` or 0 if litShare is zero. `T = n(tierShares[3])`. | Cello trim 0.76–1.24, strings trim 0.70–1.30, and sparkle base velocity `0.011 + 0.012T + 0.005G`. |
| `grewShare`, `fadedShare`, `changeVsPrev` | Image classification changes, `G = n(grew)`, `D = n(faded)`, `M = n(changeVsPrev)`, each 0 when missing. `S = sign(grew − faded)M`, or 0 if either share is absent. | Piano base velocity `0.102 + 0.024B + 0.012S − 0.008D` within 0.082–0.138. Sparkle base also multiplies by `(0.85 + 0.55B)(1 + 0.12S − 0.21D)`. Piano has two or three hits. Movement above .48 admits a middle hit in odd phrases. The middle hit picks fifth for `S < -.32`, upper chord tone for `M > .57`, otherwise third. The final hit rises to the octave above `S > .44`. |
| `centroidX`, `strips` | Global lit centroid or lit strip moment for region, brightest-tier strip moment for accents | Overall `P = .22(center(x) or strip(1,2,3))`. Cello uses half. Sparkle pan `trim(P + .24 strip(3), −.35, .35)`. |

The rumble is an arrangement choice. It conveys distance, with no scientific interpretation as thunder.

## GEOS Aerosols

The Dorian palette is D E F G A B C. The 12-phrase voicing order is `D, D, D(add upper C), D(add upper C), E, E, E, F, F, F, D(add upper C), D`. Bass/fifth/lead/alternate/upper voicings are `D3 A3 D4 F4 A4`, `D3 A3 D4 F4 C5`, `E3 A3 E4 G4 B4`, and `F3 C4 F4 A4 C5`. The 80 BPM quarter-note grid is the same duration as Night Lights. Long flute notes and scattered particle entrances create the different pace.

| Layer and class | Oscillator / synthesis | Notes and frequencies in Hz | ADSR, hold, and velocity | Filter and layer gain |
| --- | --- | --- | --- | --- |
| Flute, `FMSynth` | Sine/sine, ratio 2, index 0.52 | D4 293.66, E4 329.63, F4 349.23, G4 392, A4 440, B4 493.88, C5 523.25 | (0.59, 0.48, 0.77, 1.10), mod (0.43, 0.62, 0.39, 0.96), 1.19–2.26 s, base 0.078 or 0.085 plus breath | `F`, unity |
| Sulfate atmosphere, `Synth` | Sine with three partials | D3 146.83, E3 164.81, F3 174.61, A3 220, C4 261.63 | (1.12, 0.80, 0.72, 1.64), 2.46 s, 0.052 | `0.70 F`, mapped sulfate trim |
| Smoke drone, `FMSynth` | Two-partial sine carrier / sine modulator, ratio 1.41, index 0.68 | D2 73.42, E2 82.41, F2 87.31, A3 220, C4 261.63 | (1.26, 0.87, 0.65, 1.50), mod (0.96, 0.70, 0.32, 1.12), held 4.65 s in alternate phrases, 0.039 | 440 Hz, mapped smoke trim |
| Rounded dust grains, `ToneBufferSource` | Six seconds of seeded noise generated in memory. One-pole smoothing at 620 Hz with an 86 Hz running mean subtracted. | Unpitched. Frame/region seed and beat select the buffer offset. | 95 ms attack, 160 ms release, 0.65 authored seconds. Grain gain `1.45 × wind velocity`. | 140 Hz high-pass. Low-pass `640 + 340D + 190V` Hz. |
| Airy salt accents, `Synth` | Sine with two partials | F4 349.23, G4 392, A4 440, B4 493.88, C5 523.25 | (0.14, 0.22, 0.12, 0.55), 0.46 s, `0.017 + .010 chance` | 1500 Hz, unity |

The verified group order is background, sulfate, smoke, seaSalt, dust. K-means cluster assignments in index order are background, background, background, background, sulfate, seaSalt, smoke, dust, sulfate, dust. Program lookups use group names from the checked schema.

| Source features | Meaning and normalization | Applied control and range |
| --- | --- | --- |
| `aerosolShare`, `meanBrightness` | Fraction assigned an aerosol color, rendered brightness `B = n(brightness)`, fallback 0.5 | Scene gain `.85 + .18 n(aerosolShare)`. Cutoff `F = 1400 × 2^B` Hz. |
| `groupShares`, `groupShareDeltaVsPrev` | Image group fractions normalized to `S, M, A, D` for sulfate/smoke/salt/dust. Signed change `d(g) = trim(delta(g)/.04, −1, 1)` defaults to 0. | Breath `.009 + .013S + .008A` (0.009–0.030). Sulfate gain `(.67 + .57S)(1+.10d(sulfate))` (0.603–1.364). Smoke gain `(.55 + .66M)(1+.16d(smoke))` (0.462–1.404). Dust velocity `(.020 + .018D)(1+.17d(dust))` (0.0166–0.0445). Salt chance `clamp(.20 + .62A + .12d(seaSalt))` (0.08–0.94). |
| `changeVsPrev` | Overall visual difference, `V = n(changeVsPrev)` or 0 when missing | The dust low-pass follows `640 + 340D + 190V` Hz (640–1170 Hz). A second dust accent enters above `.60D + .40V > .50`. The flute's alternate note rises above `V > .55`. Eligible salt accents move earlier above `V > .64`. A deterministic draw from the frame/region key and phrase selects whether the salt accent plays. |
| `groupCentroidX`, `strips` | Image x for a group or local strip moment when missing | `trim(.45 center_or_strip + .12 strip, −.45, .45)` per group. Flute uses 45% of sulfate pan. |

## DYAMOND CO₂

The D natural minor voicings hold for three phrases or 6.75 seconds each. The 0.45-second subdivision is an eighth note at 66.67 BPM. Dm uses D2 / D3 F3 A3, B♭ uses B♭1 / B♭2 D3 F3, Gm uses G2 / D3 G3 B♭3, and Am uses A1 / A2 E3 A3. The slash separates the low drone from the strings.

| Layer and class | Oscillator / synthesis | Notes and frequencies in Hz | ADSR, hold, and velocity | Filter and layer gain |
| --- | --- | --- | --- | --- |
| Cello, `FMSynth` | Three-partial triangle carrier and sine modulator, ratio 1, index 0.38 | A2 110, B♭2 116.54, D3 146.83, E3 164.81, F3 174.61, G3 196, A3 220, B♭3 233.08 | (0.67, 0.90, 0.72, 1.75), mod (0.48, 0.90, 0.26, 1.35), 3.42 or 3.87 s. First velocity `.104 + .016H`, response `.095 + .23GP`. | `F`, unity |
| Cinematic strings, `Synth` | Triangle with four partials | Voicings above, Hz as in cello row | (1.52, 0.73, 0.72, 2.44), 6.88 s, 0.51 | `J`, pad gain |
| Sparse piano, `FMSynth` | Sine/sine, ratio 2, index 0.83 | A2 110, B♭2 116.54, D3 146.83, F3 174.61, A3 220, B♭3 233.08, C4 261.63, D4 293.66 | (0.029, 0.65, 0.18, 1.18), mod (0.020, 0.32, 0.10, 0.67), 0.63–0.83 s | `F`, unity |
| Deep drone, `Synth` | Sine with two partials | A1 55, B♭1 58.27, D2 73.42, G2 98 | (1.35, 0.58, 0.69, 2.08), 6.91 s, 0.048 | 38 Hz high-pass and 305 Hz low-pass. Centered. |

| Source features | Meaning and normalization | Applied control and range |
| --- | --- | --- |
| `groupShares[hot]` | Coverage of the rendered hot-color class, `H = clamp(hotShare/.06)`. Hot index resolved from validated groups. | `F = 650 + 950H` Hz, pad gain `.12 + .05H`, pulse coefficient `G = .02 + .10H`. |
| `groupShareDeltaVsPrev[hot]` | Image color change magnitude, `P = clamp(abs(delta)/.04)`, missing 0 | Cello response chooses upper chord note above `.66`. Mapped cello velocity 0.095–0.123. Piano velocity `.064 + .30GP` (0.064–0.100). Additional quiet piano root above `.73` at `.036 + .24GP`. |
| `meanBrightness`, `groupCentroidX[hot]`, `strips` | Rendered image brightness `B = clamp(brightness)`, fallback .5. Position `X = center(centroid) or strip(hot)`. | String low-pass `J = 520(1450/520)^B` Hz. Strings pan `trim(.3X, −.25, .25)`, cello uses 70% of that. Piano pan `trim(.16X + .20 strip(hot), −.28, .28)`. |

Hot-color coverage is an image feature influenced by the rotating camera. It represents neither a calibrated measurement nor a local CO₂ concentration in ppm.

## Audio graph and timing

Pitched layers use bounded pools of individual `Tone.Synth` or `Tone.FMSynth` voices. Layer limits in the table order are 9/4/5/4/2 for Night Lights, 4/6/6/3/3 for Aerosols, and 4/9/4/3 for CO₂. Signals pass through a layer low-pass filter (Q 0.55), gain, and stereo panner into a smoothed scene bus. Dust, rumble, and drone also have individual high-pass filters (Q 0.60). A slow chorus widens only the sulfate and dust paths (0.21 Hz sine, 6.8 ms delay, 0.30 depth, 180° spread, zero feedback, 0.38 wet). The scene and generated stereo convolution return merge before the output gain, −3 dB limiter, and 1024-sample waveform analyser.

Each reverb uses a seeded, low-passed noise impulse with 29 ms of predelay and a cubic falloff. Night Lights, Aerosols, and CO₂ use tail lengths of 1.85 s, 1.90 s, and 2.55 s and send gains of 0.16, 0.25, and 0.25. Their output trims are 3.0, 2.55, and 1.45. Reference Tone is a 146.83 Hz sine at 0.10 output gain through the same limiter.

Gain, filter, and pan ramp over 290 ms. Output start, mute, and stop use a 42 ms gain ramp. A missing observation also fades the output gate over 42 ms so old reverb cannot carry into the silent observation. Pause and seek cancel future voice attacks and fade active voice gates over 42 ms. Disposal waits for that fade on the audio clock. The scheduler ticks every 16 ms with 80 ms of lookahead and an 82 ms authored pickup. Frames, images, scanner and notes use the same logical boundaries. Held sounds re-enter with their attack envelope after a seek or resume. A live speed change re-anchors musical time immediately. Already queued notes and active envelope tails finish on their original schedule. See [the playback overview](SONIFICATION_MAPPING.md).

## Artifact diagnosis

The previous pool queued releases by MIDI pitch. Releasing all notes during a seek or pause marked current voices as released while previously scheduled release callbacks could still find a later same-pitch note. The engine now schedules attack and release on the same voice. It also retires voice nodes against the audio clock, which lets the fade finish when browser wall timers and audio rendering fall out of step. [Tone.js 15.1.22 note scheduling](https://github.com/Tonejs/Tone.js/blob/15.1.22/Tone/instrument/PolySynth.ts)

Chrome's offline Web Audio test reproduced the stale callback with two C4 notes. The first started at 0.08 s with a one-second hold, was interrupted at 0.24 s, and was replaced at 0.36 s. The original pool dropped the replacement from 0.09265 RMS to silence when the old release fired at 1.08 s. The owned-voice pool held 0.09265 RMS through the same window. Cancelling a future attack yielded zero signal.

The previous strong FM dust voice could produce a pitched whistle. The scene-wide chorus modulated the flute, smoke drone, and salt accents together. Filtered procedural grains replace the dust oscillator, and chorus is limited to the air and dust layers. A lower modulation index and a longer attack soften Night Lights' sparkles. Selective low cuts on the rumble and CO₂ drone limit sub-bass accumulation while preserving the atmosphere.

## Remaining differences from the references

These are original Tone.js patches. The references' performances, instrument resonance, and mix automation remain distinct. Night Lights and CO₂ use bounded stereo positioning and generated room tails that can differ from the original mix. Reference matching remains a listening comparison alongside the pitch, timing, and level measurements.

Each 1× offline export rendered all 12 observations using the live engine's sequencing logic and feature lookups. The generated RMS levels are within 0.5 dB of the references. Aerosols remains narrower than the reference (L–R correlation 0.152) with the chorus limited to its moving textures. Night Lights is spectrally darker than the earlier reference. These are measured signal comparisons. Subjective timbre and performance similarity remain for listening review.

| Generated mix | RMS (dBFS) | Peak (dBFS) | L–R correlation |
| --- | ---: | ---: | ---: |
| Night Lights | −22.7 | −10.8 | 0.985 |
| Aerosols | −23.9 | −9.7 | 0.806 |
| CO₂ | −23.3 | −12.3 | 0.933 |

## Implementation files

- The distortion pass changed the [engine](../frontend/src/sonification/audio/GeneratedAudioEngine.js), [story mappings](../frontend/src/sonification/mappings/referenceProfiles.js), [tests](../frontend/tests/sonification.test.js), and this specification. It added [note voice ownership](../frontend/src/sonification/audio/NoteVoices.js) and [procedural dust grains](../frontend/src/sonification/audio/DustGrains.js).
- Canonical data and labels. [mlFeatures.js](../frontend/src/sonification/adapters/mlFeatures.js), [mlDatasets.js](../frontend/src/data/mlDatasets.js), [observationLabels.js](../frontend/src/data/observationLabels.js), [earthStories.js](../frontend/src/data/earthStories.js).
- Synthesis and data mappings. [GeneratedAudioEngine.js](../frontend/src/sonification/audio/GeneratedAudioEngine.js), [NoteVoices.js](../frontend/src/sonification/audio/NoteVoices.js), [DustGrains.js](../frontend/src/sonification/audio/DustGrains.js), [referenceProfiles.js](../frontend/src/sonification/mappings/referenceProfiles.js), [referenceBounds.json](../frontend/src/sonification/mappings/referenceBounds.json).
- Playback and scanner. [schedule.js](../frontend/src/sonification/playback/schedule.js), [useExclusiveSonification.js](../frontend/src/sonification/hooks/useExclusiveSonification.js), [useTimeline.js](../frontend/src/hooks/useTimeline.js), [Symphony.jsx](../frontend/src/components/explorer/Symphony.jsx), [EarthFrame.jsx](../frontend/src/components/explorer/EarthFrame.jsx), [ExplorerControls.jsx](../frontend/src/components/explorer/ExplorerControls.jsx), [global.css](../frontend/src/styles/global.css).
- Automated checks. [sonification.test.js](../frontend/tests/sonification.test.js).
