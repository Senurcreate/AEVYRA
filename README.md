# AEVYRA

Run the frontend from `frontend` with `npm ci` and `npm run dev`. Build with `npm run build`.

- `/` contains the Earth Stories catalog, science overview, credits, and FAQ.
- `/night-lights` uses NASA annual frames and the bundled `ml/output` global image analysis. The default mode adds the existing demo tones and illustrative regional views. Set `VITE_DATA_MODE=production` to use `frontend/src/data/production.json` when populated or the bundled dataset. The `api` mode still uses `VITE_API_BASE_URL` and the existing observations contract.
- `/geos-aerosols` reads the processed frames and colour shares in `ml_aerosols/output`. The timeline uses source frame IDs. Sonification is pending.
- `/dyamond-carbon-dioxide` uses a preview and original color scale from [NASA SVS 5196](https://svs.gsfc.nasa.gov/5196/). The frame sequence, derived figures, and audio are pending.

For static hosting, configure a fallback to `index.html` for the page paths so direct links and refreshes work. Vite’s dev and preview servers already provide this fallback.
