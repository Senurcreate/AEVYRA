# AEVYRA

Run the frontend from `frontend` with `npm ci` and `npm run dev`. Build with `npm run build`.

- `/` contains the Earth Stories catalog, science overview, credits, and FAQ.
- `/night-lights` uses NASA annual frames and the bundled global and regional image analysis in `ml/output`. Set `VITE_DATA_MODE=production` to use `frontend/src/data/production.json` when populated or the bundled dataset. The `api` mode uses `VITE_API_BASE_URL` and the existing observations contract.
- `/geos-aerosols` uses processed NASA GEOS frames and color shares in `ml_aerosols/output`. The timeline uses source frame IDs.
- `/dyamond-carbon-dioxide` uses processed frames and rendered color features in `ml_co2/output`. The original model color scale comes from [NASA SVS 5196](https://svs.gsfc.nasa.gov/5196/).

All three stories synthesize their changing tones from the bundled ML features. Run `npm test` from `frontend` to verify the mappings. See [Sonification mapping](docs/SONIFICATION_MAPPING.md) for the feature formulas and playback controls.

For static hosting, configure a fallback to `index.html` for the page paths so direct links and refreshes work. Vite’s dev and preview servers already provide this fallback.
