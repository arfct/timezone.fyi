# timezone.fyi

Source for [timezone.fyi](https://timezone.fyi) — a tool for sharing a time across multiple time zones

## How it works

URLs encode a time and one or more zones:

```
https://timezone.fyi/10:30am,pst,est
https://timezone.fyi/2pm,JFK,LHR,NRT
https://timezone.fyi/my-meeting/10am,NYC,LON,TOK
https://timezone.fyi/now,cst,pst
```

- **First segment** — time string (`10am`, `10:30am`, `10am-2pm` for a range), or `now` for a live clock that updates every minute
- **Remaining segments** — timezone codes, separated by commas or periods
- **Optional label** — prefix the time with `label/` to name the event

Accepted zone formats:

- Timezone abbreviations: `PST`, `EST`, `GMT`, `UTC`, `IST`
- City aliases: `NYC`, `LON`, `TOK`, `SF`
- GMT offsets: `GMT+5`, `GMT-8`
- IANA names: `America/New_York`, `Europe/London`
- Airport codes: `JFK`, `LHR`, `NRT`, `DXB` (~9,800 airports)
- Metro area codes: `NYC`, `LON`, `TYO`, `PAR`, `CHI` ([full list](https://en.wikipedia.org/wiki/List_of_airports_by_IATA_metropolitan_area_code))

Many zone abbreviations are also airport codes. The abbreviation wins, except that large airports and metro codes beat rarely used abbreviations: `CLT` is Charlotte, not Chile Time. A few codes are plausible either way (`IST`, `HKT`, `ICT`). For these, the first other code that's a zone abbreviation or a place decides: `/10am,pst,ist` is India and `/10am,lhr,ist` is Istanbul. The full list, including hand-picked exceptions such as `MHT` (Manchester, NH), is `collisions` in `netlify/zone-lookup.js`.

The page also generates a `.ics` calendar file download for the time.

## Architecture

```
static/          → landing page, CSS, client JS (served as static assets)
netlify/
  functions/
    index.js     → main request handler (Netlify Function v2)
    og.js        → Open Graph image generation
  common.js      → timezone parsing and calculation logic
  zone-lookup.js → turns zone codes into offsets or IANA zones (abbreviations, aliases, airports)
  airport-map-data.json  → precomputed IATA → IANA timezone map (~9,800 airports + metro codes)
  major-places.json      → large airports and metro codes; tests use it to check every collision is classified
scripts/
  build-airport-map.mjs  → regenerates airport-map-data.json and major-places.json
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

The build script fetches `airports.csv` and `citycodes.csv` directly from GitHub, plus [OurAirports](https://ourairports.com/data/) `airports.csv` for airport size. It also writes `netlify/major-places.json`: large airports and metro codes. After regenerating, run `npm test`. It fails if a zone abbreviation now matches a major place that isn't classified in `collisions` in `netlify/zone-lookup.js`.

## Deployment

Deployed on [Netlify](https://netlify.com). Push to `main` to deploy.
