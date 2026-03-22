/**
 * Build script: generates netlify/airport-map-data.json
 *
 * Sources:
 *   - airports.csv from ourairports.com (provided locally, not bundled)
 *   - airport-timezone npm package (devDependency) for timezone strings
 *
 * Filters to large_airport + medium_airport with an IATA code, cross-references
 * with airport-timezone for the IANA timezone string, and writes a compact
 * code → timezone map (~150 KB vs the 2.8 MB airport-timezone source).
 *
 * Usage:
 *   node scripts/build-airport-map.mjs <path-to-airports.csv>
 *
 * The CSV is not committed — download it from:
 *   https://davidmegginson.github.io/ourairports-data/airports.csv
 */

import { createReadStream, existsSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { createRequire } from "module";

const csvPath = process.argv[2] ?? "airports.csv";

if (!existsSync(csvPath)) {
  console.error(`airports.csv not found at: ${csvPath}`);
  console.error("");
  console.error("Download it first:");
  console.error("  curl -o airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv");
  console.error("");
  console.error("Then run:  npm run build:airports");
  process.exit(1);
}

// --- Build majority-vote timezone map from airport-timezone ---

const _require = createRequire(import.meta.url);
const airportTimezoneData = _require("airport-timezone");

const tzCounts = {};
for (const entry of airportTimezoneData) {
  if (!entry.code || !entry.timezone) continue;
  if (!tzCounts[entry.code]) tzCounts[entry.code] = {};
  tzCounts[entry.code][entry.timezone] = (tzCounts[entry.code][entry.timezone] || 0) + 1;
}
const tzMap = {};
for (const [code, counts] of Object.entries(tzCounts)) {
  tzMap[code] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// --- Parse airports.csv ---

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

const KEEP_TYPES = new Set(["large_airport", "medium_airport"]);

const rl = createInterface({ input: createReadStream(csvPath) });

let header = null;
let colType, colIata;
const airportMap = {};
let total = 0, matched = 0, noTz = 0;

for await (const line of rl) {
  if (!header) {
    header = parseCSVLine(line);
    colType = header.indexOf("type");
    colIata = header.indexOf("iata_code");
    if (colType === -1 || colIata === -1) {
      console.error("CSV missing expected columns. Got:", header);
      process.exit(1);
    }
    continue;
  }

  // Cheap pre-filter: skip the ~89% of rows that aren't large/medium airports
  // before paying for full CSV parsing on each line.
  if (!line.includes("large_airport") && !line.includes("medium_airport")) continue;

  const fields = parseCSVLine(line);
  const type = fields[colType];
  const iata = fields[colIata];

  if (!KEEP_TYPES.has(type) || !iata) continue;
  total++;

  const tz = tzMap[iata];
  if (!tz) { noTz++; continue; }

  // Prefer existing entry if already set (first occurrence of a code wins;
  // OurAirports data is ordered by id so larger/older airports come first)
  if (!airportMap[iata]) {
    airportMap[iata] = tz;
    matched++;
  }
}

// Sort for stable diffs
const sorted = Object.fromEntries(
  Object.entries(airportMap).sort(([a], [b]) => a.localeCompare(b))
);

const outPath = new URL("../netlify/airport-map-data.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(sorted, null, 2) + "\n");

console.log(`OurAirports large+medium with IATA code: ${total}`);
console.log(`Matched to timezone:                     ${matched}`);
console.log(`No timezone in airport-timezone:         ${noTz}`);
console.log(`Written to netlify/airport-map-data.json`);
