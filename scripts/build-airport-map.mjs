/**
 * Build script: generates netlify/airport-map-data.json
 *
 * Sources (lxndrblz/Airports — fetched from GitHub at build time):
 *   airports.csv  — all IATA airports with IANA timezone + city_code
 *   citycodes.csv — metropolitan area codes with IANA timezone
 *
 * Writes a compact code → timezone map covering all IATA airport codes
 * plus metropolitan area codes (e.g. NYC, LON, TYO).
 *
 * Usage:
 *   npm run build:airports
 *
 * ---------------------------------------------------------------------------
 * BACKUP SOURCE (OurAirports + airport-timezone npm package)
 *
 * If the lxndrblz source becomes unavailable, revert to:
 *   1. Download airports.csv from ourairports.com:
 *        curl -o airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
 *   2. Restore the airport-timezone devDependency:
 *        npm install --save-dev airport-timezone
 *   3. Replace the fetch/parse block below with the OurAirports implementation:
 *
 *      import { createReadStream, existsSync, writeFileSync } from "fs";
 *      import { createInterface } from "readline";
 *      import { createRequire } from "module";
 *
 *      const csvPath = process.argv[2] ?? "airports.csv";
 *      if (!existsSync(csvPath)) { console.error("airports.csv not found"); process.exit(1); }
 *
 *      const _require = createRequire(import.meta.url);
 *      const airportTimezoneData = _require("airport-timezone");
 *      const tzMap = {};
 *      for (const entry of airportTimezoneData) {
 *        if (!entry.code || !entry.timezone) continue;
 *        if (!tzMap[entry.code]) tzMap[entry.code] = {};
 *        tzMap[entry.code][entry.timezone] = (tzMap[entry.code][entry.timezone] || 0) + 1;
 *      }
 *      for (const [code, counts] of Object.entries(tzMap))
 *        tzMap[code] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
 *
 *      const KEEP_TYPES = new Set(["large_airport", "medium_airport"]);
 *      const rl = createInterface({ input: createReadStream(csvPath) });
 *      let header = null, colType, colIata;
 *      for await (const line of rl) {
 *        if (!header) {
 *          header = parseCSVLine(line);
 *          colType = header.indexOf("type"); colIata = header.indexOf("iata_code");
 *          continue;
 *        }
 *        if (!line.includes("large_airport") && !line.includes("medium_airport")) continue;
 *        const fields = parseCSVLine(line);
 *        const iata = fields[colIata];
 *        if (!KEEP_TYPES.has(fields[colType]) || !iata) continue;
 *        const tz = tzMap[iata];
 *        if (tz && !airportMap[iata]) airportMap[iata] = tz;
 *      }
 * ---------------------------------------------------------------------------
 */

import { writeFileSync } from "fs";

const AIRPORTS_URL =
  "https://raw.githubusercontent.com/lxndrblz/Airports/refs/heads/main/airports.csv";
const CITYCODES_URL =
  "https://raw.githubusercontent.com/lxndrblz/Airports/refs/heads/main/citycodes.csv";

// Normalize legacy/alias timezone names to canonical IANA names
const TZ_NORMALIZE = {
  "Brazil/East": "America/Sao_Paulo",
  "America/Montreal": "America/Toronto",
};

function normalizeTz(tz) {
  return TZ_NORMALIZE[tz] ?? tz;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const header = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const fields = parseCSVLine(line);
    return Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ""]));
  });
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

// --- Fetch sources ---

console.log("Fetching airports.csv and citycodes.csv from lxndrblz/Airports...");
const [airportsText, citycodesText] = await Promise.all([
  fetchCSV(AIRPORTS_URL),
  fetchCSV(CITYCODES_URL),
]);

const airports = parseCSV(airportsText);
const citycodes = parseCSV(citycodesText);

const airportMap = {};

// 1. All IATA airport codes
let airportCount = 0;
for (const row of airports) {
  const code = row.code;
  const tz = normalizeTz(row.time_zone);
  if (!code || !tz || airportMap[code]) continue;
  airportMap[code] = tz;
  airportCount++;
}

// 2. Metropolitan area codes from citycodes.csv (explicit — takes precedence)
let cityCodeCount = 0;
for (const row of citycodes) {
  const code = row.code;
  const tz = normalizeTz(row.time_zone);
  if (!code || !tz) continue;
  airportMap[code] = tz;
  cityCodeCount++;
}

// 3. Derive any city_codes that appear in airports.csv but not in citycodes.csv
//    (majority-vote timezone among the member airports)
const cityTzVotes = {};
for (const row of airports) {
  const cityCode = row.city_code;
  const tz = normalizeTz(row.time_zone);
  if (!cityCode || !tz || cityCode === row.code) continue;
  if (!cityTzVotes[cityCode]) cityTzVotes[cityCode] = {};
  cityTzVotes[cityCode][tz] = (cityTzVotes[cityCode][tz] ?? 0) + 1;
}
let derivedCount = 0;
for (const [code, votes] of Object.entries(cityTzVotes)) {
  if (airportMap[code]) continue;
  const tz = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  airportMap[code] = tz;
  derivedCount++;
}

// Sort for stable diffs
const sorted = Object.fromEntries(
  Object.entries(airportMap).sort(([a], [b]) => a.localeCompare(b))
);

const outPath = new URL("../netlify/airport-map-data.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(sorted, null, 2) + "\n");

console.log(`Airport codes:                ${airportCount}`);
console.log(`Metro codes (citycodes.csv):  ${cityCodeCount}`);
console.log(`Metro codes (derived):        ${derivedCount}`);
console.log(`Total entries:                ${Object.keys(sorted).length}`);
console.log(`Written to netlify/airport-map-data.json`);
