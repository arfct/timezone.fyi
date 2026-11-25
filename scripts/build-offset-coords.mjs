// Builds src/data/offset-coords.json: for each UTC offset, one place to stand
// for it, so that a bare offset (utc, gmt, gmt+5:30) has a sun to draw its
// sky from. The place is at the latitude where most people on that offset
// live.
//
// Each offset is worked out on its own:
//
//   1. Its strip is every city whose time zone has that offset as standard
//      time (the smaller of its January and July offsets in 2026). An offset
//      that zones only have in summer (−2:30, +10:30) takes the cities that
//      are on it then. An offset no zone has (−12:00) takes the cities in its
//      band of longitude, 15° per hour and 7.5° either side. A zone with no
//      city in the data (the Line Islands, +14:00) counts as one person at
//      its principal place, so it only decides a strip that is otherwise
//      empty.
//   2. The cities' populations are added up by latitude in 1° bins, each bin
//      then counted with its two neighbours. The bin with the most is the
//      peak, and it and its neighbours are the peak band.
//   3. The latitude and the longitude are the population-weighted medians of
//      the cities in the peak band (offset × 15° for the longitude when the
//      band is empty), rounded to 0.1°.
//
// Cities: GeoNames cities15000 (every city of 15,000 people or more, and
// capitals), which names each city's time zone. It is downloaded here and not
// kept. https://download.geonames.org/export/dump/cities15000.zip, CC BY 4.0.
//
// Run with: node scripts/build-offset-coords.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zoneCoords from "../public/assets/zone-coords.js";

const SOURCE = "https://download.geonames.org/export/dump/cities15000.zip";

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE} answered ${response.status}`);
const zip = join(mkdtempSync(join(tmpdir(), "cities-")), "cities15000.zip");
writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
const rows = execFileSync("unzip", ["-p", zip, "cities15000.txt"], {
  encoding: "utf8",
  maxBuffer: 1 << 28,
}).split("\n");

// A zone's offset in minutes at an instant
const formats = new Map();
function offsetAt(zone, ms) {
  if (!formats.has(zone))
    formats.set(
      zone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  const p = {};
  for (const part of formats.get(zone).formatToParts(ms)) p[part.type] = +part.value;
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms) / 60000;
}
// [standard, summer] offsets of a zone in 2026
const zoneOffsets = new Map();
function offsetsOf(zone) {
  if (!zoneOffsets.has(zone)) {
    const january = offsetAt(zone, Date.UTC(2026, 0, 15, 12));
    const july = offsetAt(zone, Date.UTC(2026, 6, 15, 12));
    zoneOffsets.set(zone, [Math.min(january, july), Math.max(january, july)]);
  }
  return zoneOffsets.get(zone);
}

// geonameid, name, asciiname, alternatenames, latitude, longitude, feature
// class, feature code, country, cc2, admin1 to admin4, population, elevation,
// dem, timezone, modified
const cities = [];
for (const row of rows) {
  const f = row.split("\t");
  if (f.length < 18 || !+f[14]) continue;
  const [standard, summer] = offsetsOf(f[17]);
  cities.push({
    name: f[1],
    country: f[8],
    lat: +f[4],
    lon: +f[5],
    people: +f[14],
    standard,
    summer,
  });
}

const withCities = new Set(rows.map((row) => row.split("\t")[17]));
for (const [zone, [lat, lon]] of Object.entries(zoneCoords)) {
  if (withCities.has(zone)) continue;
  let both;
  try {
    both = offsetsOf(zone);
  } catch {
    continue; // a name this runtime doesn't know
  }
  cities.push({
    name: zone,
    country: "zone",
    lat,
    lon,
    people: 1,
    standard: both[0],
    summer: both[1],
  });
}

// Every whole hour from −12 to +14, and every other offset a zone has
const offsets = new Set();
for (let hour = -12; hour <= 14; hour++) offsets.add(hour * 60);
for (const city of cities) offsets.add(city.standard).add(city.summer);

// The value at which half the people are on either side
function median(list, key) {
  const sorted = [...list].sort((a, b) => a[key] - b[key]);
  const half = sorted.reduce((sum, c) => sum + c.people, 0) / 2;
  let sum = 0;
  for (const c of sorted) {
    sum += c.people;
    if (sum >= half) return c[key];
  }
}
const round = (degrees) => Math.round(degrees * 10) / 10;
const label = (minutes) => {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? "−" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

function place(offset, strip) {
  const bins = new Array(180).fill(0);
  for (const c of strip) bins[Math.min(179, Math.floor(c.lat) + 90)] += c.people;
  let peak = 0;
  let most = -1;
  for (let i = 0; i < 180; i++) {
    const sum = (bins[i - 1] ?? 0) + bins[i] + (bins[i + 1] ?? 0);
    if (sum > most) {
      most = sum;
      peak = i;
    }
  }
  const band = strip.filter((c) => Math.abs(Math.min(179, Math.floor(c.lat) + 90) - peak) <= 1);
  if (!band.length) return { lat: 0, lon: round(offset / 4), top: null, people: 0 };
  // Across the date line a median of longitudes would land on the far side
  // of the world, so they're measured from the strip's own meridian
  const centre = offset / 4;
  const turned = band.map((c) => ({ ...c, lon: ((((c.lon - centre) % 360) + 540) % 360) - 180 }));
  const lon = ((((median(turned, "lon") + centre) % 360) + 540) % 360) - 180;
  const top = band.reduce((a, b) => (b.people > a.people ? b : a));
  return { lat: round(median(band, "lat")), lon: round(lon), top, people: most };
}

const coords = {};
const log = [];
for (const offset of [...offsets].sort((a, b) => a - b)) {
  if (offset < -720 || offset > 840) continue;
  let basis = "standard time";
  let strip = cities.filter((c) => c.standard === offset);
  if (!strip.length) {
    basis = "summer time only";
    strip = cities.filter((c) => c.summer === offset);
  }
  if (!strip.length) {
    basis = "longitude band";
    const centre = offset / 4;
    strip = cities.filter((c) => Math.abs(((((c.lon - centre) % 360) + 540) % 360) - 180) <= 7.5);
  }
  const found = place(offset, strip);
  coords[offset] = [found.lat, found.lon];
  // For comparison, not kept: the same with every city that is on this
  // offset at any time of the year, summer time included
  const ever = place(
    offset,
    cities.filter((c) => c.standard === offset || c.summer === offset),
  );
  log.push(
    `${label(offset)}  ${String(found.lat).padStart(6)} ${String(found.lon).padStart(7)}  ` +
      `${(found.top ? `${found.top.name}, ${found.top.country}` : "no city").padEnd(28)} ` +
      `${basis.padEnd(17)} ${strip.length} cities, ${(found.people / 1e6).toFixed(1)} M in the peak band` +
      (ever.top && ever.top.name !== found.top?.name
        ? `   (with summer time: ${ever.lat}, ${ever.lon}, ${ever.top.name})`
        : ""),
  );
}

console.log("offset     lat     lon  largest city in the peak band");
console.log(log.join("\n"));
writeFileSync(
  new URL("../src/data/offset-coords.json", import.meta.url),
  `${JSON.stringify(
    {
      source: SOURCE,
      fetched: new Date().toISOString().slice(0, 10),
      strip: "zones by their standard offset in 2026",
      // Minutes east of UTC → [latitude, longitude]
      coords,
    },
    null,
    1,
  ).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, "[$1, $2]")}\n`,
);
console.log(`\n${Object.keys(coords).length} offsets written to src/data/offset-coords.json`);
