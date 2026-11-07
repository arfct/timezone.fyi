/**
 * Tests for zone resolution: how a code in a URL (an abbreviation, airport,
 * metro code or nickname) becomes a UTC offset or IANA zone.
 *
 * Imports zone-lookup.js directly. common.js can't be imported in Node tests
 * because the `tzdata` dependency uses JSON imports incompatible with Node ESM.
 *
 * Run with: npm test
 */

import * as lookup from "./zone-lookup.js";
import airportMap from "./airport-map-data.json" with { type: "json" };
import majorPlaceList from "./major-places.json" with { type: "json" };

const { resolveCodes } = lookup;
const majorPlaces = new Set(majorPlaceList);

// Resolve `code` as it would appear among `context` codes in one URL
function resolve(code, context = []) {
  return resolveCodes([...context, code])[context.length];
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

function resolvesTo(label, zone, expectedTz, context) {
  expect(label, resolve(zone, context), expectedTz);
}

// --- Tests ---

console.log("\nTimezone abbreviations → fixed UTC offsets (hours)");
resolvesTo("GMT → 0", "GMT", 0);
resolvesTo("JST → 9", "JST", 9);

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

console.log("\nUnknown codes pass through unchanged");
resolvesTo("Europe/London is left for tc.zone()", "Europe/London", "Europe/London");

console.log("\nZone abbreviations beat minor airports");
resolvesTo("UTC → UTC (not Soesterberg AB)",        "UTC",  "UTC");
resolvesTo("WIB → Asia/Jakarta (not Wilbarger Co)", "WIB",  "Asia/Jakarta");
resolvesTo("WITA → Asia/Makassar",                  "WITA", "Asia/Makassar");
resolvesTo("WIT → Asia/Jayapura (not Wittenoom)",   "WIT",  "Asia/Jayapura");

console.log("\nCommon abbreviations beat major places");
resolvesTo("MST → America/Denver (not Maastricht)", "MST", "America/Denver");
resolvesTo("GST → 4, Gulf Standard Time (not Gustavus)", "GST", 4);

console.log("\nMajor places beat rare abbreviations");
resolvesTo("CLT → Charlotte (not Chile Time)",       "CLT", "America/New_York");
resolvesTo("ACT → Waco (not ASEAN Common Time)",     "ACT", "America/Chicago");
resolvesTo("CIT → Shymkent (not obsolete CIT)",      "CIT", "Asia/Almaty");
resolvesTo("MHT → Manchester, NH (not Marshall Is.)", "MHT", "America/New_York");

console.log("\nTwo-sided codes: the first other code decides");
resolvesTo("IST alone → India",                  "IST", "Asia/Kolkata");
resolvesTo("IST after PST → India",              "IST", "Asia/Kolkata", ["pst"]);
resolvesTo("IST after LHR → Istanbul",           "IST", "Europe/Istanbul", ["lhr"]);
expect("IST before SFO → Istanbul",              resolveCodes(["ist", "sfo"])[0], "Europe/Istanbul");
resolvesTo("IST after MST → India",              "IST", "Asia/Kolkata", ["mst"]);
resolvesTo("IST after CLT (Charlotte) → Istanbul", "IST", "Europe/Istanbul", ["clt"]);
resolvesTo("IST after SF nickname → Istanbul",   "IST", "Europe/Istanbul", ["sf"]);
resolvesTo("IST after GMT+5 → India",            "IST", "Asia/Kolkata", ["gmt+5"]);
resolvesTo("IST after HKT, LHR → Istanbul",      "IST", "Europe/Istanbul", ["hkt", "lhr"]);
resolvesTo("IST after HKT only → India",         "IST", "Asia/Kolkata", ["hkt"]);
resolvesTo("HKT alone → 8, Hong Kong Time",      "HKT", 8);
resolvesTo("HKT after SFO → Phuket",             "HKT", "Asia/Bangkok", ["sfo"]);
resolvesTo("ICT after PST → 7, Indochina Time",  "ICT", 7, ["pst"]);
resolvesTo("ICT after JFK → Wichita",            "ICT", "America/Chicago", ["jfk"]);
resolvesTo("Lowercase ist after lhr → Istanbul", "ist", "Europe/Istanbul", ["lhr"]);

console.log("\nEvery abbreviation that is also a major place is classified");
const zoneAbbreviations = lookup.zoneAbbreviations ?? {};
const collisions = lookup.collisions ?? {};
expect("zone-lookup.js exports zoneAbbreviations", typeof lookup.zoneAbbreviations, "object");
expect("zone-lookup.js exports collisions",        typeof lookup.collisions, "object");
const unclassified = Object.keys(zoneAbbreviations)
  .filter((code) => majorPlaces.has(code) && !(code in collisions));
expect("no unclassified collisions (add them to `collisions`)", unclassified.join(", "), "");
const stale = Object.keys(collisions)
  .filter((code) => !(code in zoneAbbreviations) || !(code in airportMap));
expect("no stale `collisions` entries", stale.join(", "), "");

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
