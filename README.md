# timezone.fyi

Source for [timezone.fyi](https://timezone.fyi) — a tool for sharing a time across multiple time zones

## How it works

A link holds a time and one or more zones:

```
https://timezone.fyi/10:30am,pst,est
https://timezone.fyi/2pm,JFK,LHR,NRT
https://timezone.fyi/my-meeting/10am,NYC,LON,TOK
https://timezone.fyi/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok
https://timezone.fyi/standup/weekly/2026-03-02/9:30am+15m,nyc,lon
https://timezone.fyi/now,cst,pst
```

The full form is:

```
/[label/][repeat/][date/]time[-time | +length],zone[,zone…]
```

- **Time**: `10am`, `10:30am`, `22:30`, a range `10am-2pm`, a start and a length `10am+45m` (`+1h`, `+1h30m`, `+90`), or `now` for a live clock. A link with zones and no time (`/pst,est`) is also a live clock.
- **Zones**: separated by commas or periods. The time is read in the first zone.
- **Label** (optional): `my-meeting/` names the event. Hyphens show as spaces.
- **Date** (optional): `2026-12-03`, `dec3`, `3dec`, `fri`, `today`, `tomorrow`. Every form except the first redirects to the link with the date written out, so the link that gets shared means the same day whenever it's opened. Without a date, the time is today in the first zone, as before.
- **Repeat** (optional): `daily`, `weekdays`, `weekly`, `biweekly`, `monthly`, `yearly`, or `every-mon`. The date is the first occurrence. The page shows the next one.

A range can cross midnight: `10pm-1am` ends the next day. A start without am/pm takes the end's, so `1-2pm` is 1pm–2pm. An end without am/pm is the next time the clock shows it after the start, so `10-2` is 10am–2pm. A time on a different day from the first zone's start gets a marker: +1 for the next day, −1 for the day before.

A time written in 24-hour form (`22:30`, `9-17`, `now24`) is shown in 24-hour form in every zone. `10:30` alone stays 12-hour, as it always read as 10:30am.

Accepted zone formats:

- Timezone abbreviations: `PST`, `EST`, `GMT`, `UTC`, `IST`
- City aliases: `NYC`, `LON`, `TOK`, `SF`
- GMT offsets: `GMT+5`, `GMT-8`
- IANA names: `America/New_York`, `Europe/London`
- Airport codes: `JFK`, `LHR`, `NRT`, `DXB` (~9,250 airports)
- Metro area codes: `NYC`, `LON`, `TYO`, `PAR`, `CHI` ([full list](https://en.wikipedia.org/wiki/List_of_airports_by_IATA_metropolitan_area_code))

Many zone abbreviations are also airport codes. The abbreviation wins, except that large airports and metro codes beat rarely used abbreviations: `CLT` is Charlotte, not Chile Time. A few codes are plausible either way (`IST`, `HKT`, `ICT`). For these, the first other code that's a zone abbreviation or a place decides: `/10am,pst,ist` is India and `/10am,lhr,ist` is Istanbul. The full list, including hand-picked exceptions such as `MHT` (Manchester, NH), is `collisions` in `src/lib/zone-lookup.js`.

Every link has two more addresses:

- `<link>/event.ics`: the calendar file. A repeating event's file carries its zone's clock-change rules, so it stays at the same local time all year.
- `<link>/card.png`: the 1200×630 image that link previews show.

## Status of this branch

`geist/worker-refactor` is a prototype of the site as a Cloudflare Worker. It is deployed at https://v2.timezone.fyi and https://timezone-fyi-proto.arfct.workers.dev. timezone.fyi itself is still served by Netlify from `main`, and merging this branch would stop that deployment from building, because the Netlify functions are gone from it. The proposal, with the order to switch over in, is [docs/plans/2026-11-25-worker-refactor.md](docs/plans/2026-11-25-worker-refactor.md).

## Architecture

```
src/
  worker.js        → the Worker: reads the path, answers with the page, card.png or event.ics
  lib/
    parse-path.js  → splits a path into label, repeat, date, time and zones
    parse-time.js  → reads the time or range (10pm-1am, 1-2pm, 22:30, 10am+45m)
    zone-lookup.js → turns zone codes into offsets or IANA zones (abbreviations, aliases, airports)
    event.js       → resolves a parsed path at a given moment: the date, each zone's time
    coords.js      → where a zone code is on the Earth, for the sun's position there
    tz.js          → time zone arithmetic on the runtime's own Intl data
    ics.js         → the calendar file and the Google and Outlook links
    vtimezone.js   → a zone's clock-change rules for the calendar file
    day-offset.js  → the +1/−1 day marker beside each time
    escape.js      → escapes text from the URL for the page and the calendar file
  render/
    page.js        → the HTML for an event and for the home page
    card.js        → the SVG of the link-preview image
  data/            → airport-map-data.json (IATA → IANA zone), major-places.json
  fonts/           → Inter Medium and Bold, cut down to the characters the image uses (OFL)
public/assets/     → stylesheet, page script, icon: served without running the Worker
scripts/           → build-airport-map.mjs, build-fonts.py
test/              → node test/run.js runs every *.test.js
```

The Worker turns the image's SVG into a PNG by calling [arfct/og-svg](https://github.com/arfct/og-svg) over a service binding, so no image code or WASM is in this Worker.

## Dev setup

**Requirements:** Node 22+

```bash
npm ci
npm run dev        # wrangler dev, at http://localhost:8787
npm test           # every test file
npm run check      # Biome: lint and format
npm run deploy     # wrangler deploy, to v2.timezone.fyi and workers.dev
```

`npm run dev` needs the `og-svg` Worker for `card.png`: either run `wrangler dev` in a checkout of og-svg at the same time, or use `npx wrangler dev --remote`.

## Regenerating the airport map

`src/data/airport-map-data.json` is a precomputed map of IATA codes → IANA timezone strings, covering ~9,250 airports plus metropolitan area codes. It's committed so no download is needed at runtime or install time.

Data is sourced from [lxndrblz/Airports](https://github.com/lxndrblz/Airports) and fetched at build time — no local files required:

```bash
npm run build:airports
```

The build script fetches `airports.csv` and `citycodes.csv` directly from GitHub, plus [OurAirports](https://ourairports.com/data/) `airports.csv` for airport size. It also writes `src/data/major-places.json`: large airports and metro codes. After regenerating, run `npm test`. It fails if a zone abbreviation now matches a major place that isn't classified in `collisions` in `src/lib/zone-lookup.js`.

The sky colours follow the sun at each place (`public/assets/sun.js`). `node scripts/build-coords.mjs` writes where places are: `public/assets/zone-coords.js` from the time zone database's `zone.tab`, and `src/data/airport-coords.json` from the same airport source, for the codes already in the zone map. Run it after `build:airports`.

A refresh can remove codes and change zones. lxndrblz/Airports drops codes that aren't in IATA's public code directory, and moves a code to its new airport when IATA reassigns it: `RSI` was Río Sidra, Panama, and is now Red Sea International, Saudi Arabia. Before committing, check each changed zone against the airport's coordinates in OurAirports. Corrections to upstream zones go in `placeAliases` in `src/lib/zone-lookup.js`.

## Time zone data

Times come from the IANA time zone database that the Workers runtime carries, read through `Intl` (`src/lib/tz.js`). Nothing is bundled, and Cloudflare's runtime updates bring new releases. `/_/runtime` on the deployed Worker reports what its data knows. The `tzdata` and `timezonecomplete` packages remain as test-only dependencies: `test/tz.test.js` checks the Worker's arithmetic against them, and `test/resolve-zone.test.js` checks the fixed offsets in `src/lib/zone-lookup.js`. Dependabot still checks `tzdata` monthly, and its pull request merges itself once `npm test` passes ([workflow](.github/workflows/tzdata-automerge.yml)).

## Deployment

`npm run deploy` publishes the prototype to v2.timezone.fyi and workers.dev. Nothing deploys on push from this branch.

## Catalogue

The catalogue entry for this product lives in [`.artifact/timezone-fyi.md`](.artifact/timezone-fyi.md), with its images beside it. Edit it here, in the same PR as any change that would make it wrong.
