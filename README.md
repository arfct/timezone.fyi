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
- Airport codes: `JFK`, `LHR`, `NRT`, `DXB` (~9,800 airports)
- Metro area codes: `NYC`, `LON`, `TYO`, `PAR`, `CHI` ([full list](https://en.wikipedia.org/wiki/List_of_airports_by_IATA_metropolitan_area_code))

The page also generates a `.ics` calendar file download for the time.

## Architecture

```
static/          → landing page, CSS, client JS (served as static assets)
netlify/
  functions/
    index.js     → main request handler (Netlify Function v2)
    og.js        → Open Graph image generation
  common.js      → timezone parsing and calculation logic
  airport-map-data.json  → precomputed IATA → IANA timezone map (~9,800 airports + metro codes)
scripts/
  build-airport-map.mjs  → regenerates airport-map-data.json from source data
```

All routing is handled server-side by the Netlify function — the URL path is parsed directly, no client-side routing.

## Dev setup

**Requirements:** Node 20+, [Netlify CLI](https://docs.netlify.com/cli/get-started/)

```bash
npm install        # must be run with Node 20+ — canvas has a native binary tied to the Node version
npm run dev        # starts local dev server at http://localhost:8888
npm test           # runs the full test suite
```

> **Note:** Use `npm run dev`, not `netlify dev` directly. The `netlify.toml` has a `[dev]` section that must be read from this directory — running the CLI directly can cause it to traverse up to a parent git repo and load the wrong files.

> **Node version:** `canvas` uses a prebuilt native binary tied to the Node version it was installed under. If you switch Node versions and see a `NODE_MODULE_VERSION` mismatch error from `/og`, re-run `npm install` to fetch the matching binary for your current Node version (20+).

## Regenerating the airport map

`netlify/airport-map-data.json` is a precomputed map of IATA codes → IANA timezone strings, covering ~9,800 airports plus metropolitan area codes. It's committed so no download is needed at runtime or install time.

Data is sourced from [lxndrblz/Airports](https://github.com/lxndrblz/Airports) and fetched at build time — no local files required:

```bash
npm run build:airports
```

The build script fetches `airports.csv` and `citycodes.csv` directly from GitHub.

## Deployment

Deployed on [Netlify](https://netlify.com). Push to `main` to deploy.
