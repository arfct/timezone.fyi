/**
 * Tests for zone resolution: how a code in a URL (an abbreviation, airport,
 * metro code or nickname) becomes a UTC offset or IANA zone.
 *
 * Imports zone-lookup.js directly. common.js can't be imported in Node tests
 * because the `tzdata` dependency uses JSON imports incompatible with Node ESM.
 *
 * Run with: npm test
 */

import { resolveCodes } from "./zone-lookup.js";

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

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
