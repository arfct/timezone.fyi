/**
 * Tests for zone resolution — validates the overrides table in common.js
 * and confirms the airport map covers expected codes end-to-end.
 *
 * Note: common.js cannot be directly imported in Node tests because the
 * `tzdata` dependency uses JSON imports incompatible with Node ESM.
 * These tests validate the static override mappings by reading and parsing
 * common.js, and cross-reference against airport-map-data.json.
 *
 * Run with: npm test
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

const airportMap = _require("./airport-map-data.json");

// --- Extract overrides from common.js by parsing the static object ---
// We read the file and eval just the overrides literal (no side effects).
const commonSrc = readFileSync(path.join(__dirname, "common.js"), "utf8");
const overridesMatch = commonSrc.match(/var overrides\s*=\s*(\{[\s\S]*?\n\});/);
if (!overridesMatch) throw new Error("Could not parse overrides from common.js");
const overrides = eval(`(${overridesMatch[1]})`); // eslint-disable-line no-eval

// Simulate resolveZone: overrides first, then airportMap
function resolveZone(z) {
  const upper = z.toUpperCase();
  return overrides[upper] ?? airportMap[upper];
}

// --- Minimal test harness ---

let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${expected}`);
    console.error(`      actual:   ${actual}`);
    failed++;
  }
}

function resolvesTo(label, zone, expectedTz) {
  expect(label, resolveZone(zone), expectedTz);
}

// --- Tests ---

console.log("\nTimezone abbreviation overrides → numeric offsets");
// EST/PST appear twice: once as a raw number, then overridden to an IANA string
expect("EST is overridden to IANA string", typeof overrides["EST"], "string");
expect("PST is overridden to IANA string", typeof overrides["PST"], "string");
expect("GMT offset is 0",        overrides["GMT"], 0);
expect("JST offset is 9",        overrides["JST"], 9);

console.log("\nTimezone abbreviation overrides → IANA strings");
resolvesTo("EST → America/New_York",    "EST",  "America/New_York");
resolvesTo("ET → America/New_York",     "ET",   "America/New_York");
resolvesTo("CDT → America/Chicago",     "CDT",  "America/Chicago");
resolvesTo("CST → America/Chicago",     "CST",  "America/Chicago");
resolvesTo("CT → America/Chicago",      "CT",   "America/Chicago");
resolvesTo("MST → America/Denver",      "MST",  "America/Denver");
resolvesTo("PST → America/Los_Angeles", "PST",  "America/Los_Angeles");
resolvesTo("PT → America/Los_Angeles",  "PT",   "America/Los_Angeles");
resolvesTo("KST → Asia/Seoul",          "KST",  "Asia/Seoul");
resolvesTo("IST → Asia/Kolkata",        "IST",  "Asia/Kolkata");

console.log("\nAirport codes (via airport-map-data.json)");
resolvesTo("SFO → America/Los_Angeles", "SFO", "America/Los_Angeles");
resolvesTo("JFK → America/New_York",    "JFK", "America/New_York");
resolvesTo("LHR → Europe/London",       "LHR", "Europe/London");
resolvesTo("NRT → Asia/Tokyo",          "NRT", "Asia/Tokyo");
resolvesTo("SYD → Australia/Sydney",    "SYD", "Australia/Sydney");

console.log("\nMetro area codes (via airport-map-data.json)");
resolvesTo("NYC → America/New_York",  "NYC", "America/New_York");
resolvesTo("LON → Europe/London",     "LON", "Europe/London");
resolvesTo("TYO → Asia/Tokyo",        "TYO", "Asia/Tokyo");
resolvesTo("PAR → Europe/Paris",      "PAR", "Europe/Paris");
resolvesTo("CHI → America/Chicago",   "CHI", "America/Chicago");

console.log("\nOverride-only metro codes (not in airport-map-data.json)");
resolvesTo("TCI → Atlantic/Canary",   "TCI", "Atlantic/Canary");
resolvesTo("QDF → America/Chicago",   "QDF", "America/Chicago");
resolvesTo("QHO → America/Chicago",   "QHO", "America/Chicago");
resolvesTo("QMI → America/New_York",  "QMI", "America/New_York");

console.log("\nColloquial aliases");
resolvesTo("SF → America/Los_Angeles", "SF",  "America/Los_Angeles");
resolvesTo("TOK → Asia/Tokyo",         "TOK", "Asia/Tokyo");

console.log("\nOverrides take priority over airport map");
// TCI in airport map is Asia/Vladivostok (Russian airport);
// override must win and return Atlantic/Canary (Tenerife metro)
expect("TCI override beats airport map",
  overrides["TCI"] ?? airportMap["TCI"], "Atlantic/Canary");

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
