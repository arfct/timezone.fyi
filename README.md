# timezone.fyi

Source for [timezone.fyi](https://timezone.fyi) — a tool for sharing a time across multiple time zones

## How it works

URLs encode a time and one or more zones:

```
https://timezone.fyi/10:30am,pst,est
https://timezone.fyi/2pm,JFK,LHR,NRT
https://timezone.fyi/my-meeting/10am,NYC,LON,TOK
```

- **First segment** — time string (`10am`, `10:30am`, `10am-2pm` for a range)
- **Remaining segments** — timezone codes, separated by commas or periods
- **Optional label** — prefix the time with `label/` to name the event

Accepted zone formats:

- Timezone abbreviations: `PST`, `EST`, `GMT`, `IST`
- City aliases: `NYC`, `LON`, `TOK`, `SF`
- GMT offsets: `GMT+5`, `GMT-8`
- IANA names: `America/New_York`, `Europe/London`
- Airport codes: `JFK`, `LHR`, `NRT`, `DXB` (~4,500 large/medium airports)

The page also generates a `.ics` calendar file download for the time.

## Architecture

```
static/          → landing page, CSS, client JS (served as static assets)
netlify/
  functions/
    index.js     → main request handler (Netlify Function v2)
    og.js        → Open Graph image generation
  common.js      → timezone parsing and calculation logic
  airport-map-data.json  → precomputed IATA → IANA timezone map (~4,500 codes)
scripts/
  build-airport-map.mjs  → regenerates airport-map-data.json from source data
```

All routing is handled server-side by the Netlify function — the URL path is parsed directly, no client-side routing.

## Dev setup

**Requirements:** Node 20, [Netlify CLI](https://docs.netlify.com/cli/get-started/)

```bash
npm install
npm run dev        # starts local dev server at http://localhost:8888
```

> **Note:** Use `npm run dev`, not `netlify dev` directly. The `netlify.toml` has a `[dev]` section that must be read from this directory — running the CLI directly can cause it to traverse up to a parent git repo and load the wrong files.

Test the airport timezone map:

```bash
node netlify/airport-map.test.js
```

## Regenerating the airport map

`netlify/airport-map-data.json` is a precomputed map of IATA airport codes → IANA timezone strings, covering all large and medium airports from [OurAirports](https://ourairports.com). It's committed so no download is needed at runtime or install time.

To regenerate it (e.g. after OurAirports updates their data):

```bash
curl -o airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
npm run build:airports
rm airports.csv
```

The build script cross-references OurAirports airport types with the `airport-timezone` npm package (a devDependency) to produce the final map. `airports.csv` is gitignored.

## Deployment

Deployed on [Netlify](https://netlify.com). Push to `main` to deploy.
