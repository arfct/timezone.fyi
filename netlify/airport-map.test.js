/**
 * Tests for airport code → timezone resolution via the airport-timezone package.
 *
 * Run with: node netlify/airport-map.test.js
 */

import airportMap from "./airport-map-data.json" with { type: "json" };

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

// --- Tests ---

console.log("\nairportMap coverage");
// Large + medium airports only (ourairports.com source), so ~4,500 not ~12,000
expect("has entries", Object.keys(airportMap).length > 4000, true);

console.log("\nWell-known airport codes resolve correctly");
expect("JFK → America/New_York",  airportMap["JFK"], "America/New_York");
expect("LHR → Europe/London",     airportMap["LHR"], "Europe/London");
expect("NRT → Asia/Tokyo",        airportMap["NRT"], "Asia/Tokyo");
expect("SYD → Australia/Sydney",  airportMap["SYD"], "Australia/Sydney");
expect("DXB → Asia/Dubai",        airportMap["DXB"], "Asia/Dubai");
expect("LAX → America/Los_Angeles", airportMap["LAX"], "America/Los_Angeles");
expect("CDG → Europe/Paris",      airportMap["CDG"], "Europe/Paris");
expect("ORD → America/Chicago",   airportMap["ORD"], "America/Chicago");
expect("ATL → America/New_York",  airportMap["ATL"], "America/New_York");
expect("SIN → Asia/Singapore",    airportMap["SIN"], "Asia/Singapore");
expect("AMS → Europe/Amsterdam",  airportMap["AMS"], "Europe/Amsterdam");
expect("MUC → Europe/Berlin",     airportMap["MUC"], "Europe/Berlin");
expect("GRU → America/Sao_Paulo", airportMap["GRU"], "America/Sao_Paulo");
expect("YYZ → America/Toronto",   airportMap["YYZ"], "America/Toronto");

console.log("\nSmaller regional airports");
// US regionals
expect("BZN (Bozeman, MT) → America/Denver",      airportMap["BZN"], "America/Denver");
expect("FSD (Sioux Falls, SD) → America/Chicago",  airportMap["FSD"], "America/Chicago");
expect("TVC (Traverse City, MI) → America/Detroit", airportMap["TVC"], "America/Detroit");
expect("FAI (Fairbanks, AK) → America/Anchorage",  airportMap["FAI"], "America/Anchorage");
// Hawaii
expect("HNL (Honolulu) → Pacific/Honolulu",        airportMap["HNL"], "Pacific/Honolulu");
expect("OGG (Maui) → Pacific/Honolulu",            airportMap["OGG"], "Pacific/Honolulu");
expect("KOA (Kona) → Pacific/Honolulu",            airportMap["KOA"], "Pacific/Honolulu");
// US territories / Pacific islands
expect("BQN (Aguadilla, PR) → America/Puerto_Rico", airportMap["BQN"], "America/Puerto_Rico");
expect("STT (St. Thomas, VI) → America/St_Thomas",  airportMap["STT"], "America/St_Thomas");
expect("GUM (Guam) → Pacific/Guam",                airportMap["GUM"], "Pacific/Guam");
expect("PPT (Papeete, Tahiti) → Pacific/Tahiti",   airportMap["PPT"], "Pacific/Tahiti");
// Australasia regionals
expect("MEL (Melbourne) → Australia/Melbourne",     airportMap["MEL"], "Australia/Melbourne");
expect("PER (Perth) → Australia/Perth",            airportMap["PER"], "Australia/Perth");
expect("ADL (Adelaide) → Australia/Adelaide",      airportMap["ADL"], "Australia/Adelaide");
expect("HBA (Hobart) → Australia/Hobart",          airportMap["HBA"], "Australia/Hobart");
expect("ZQN (Queenstown, NZ) → Pacific/Auckland",  airportMap["ZQN"], "Pacific/Auckland");

console.log("\nMajority vote for conflicted codes");
// DOV: first-occurrence is America/Indiana/Indianapolis (1 entry),
//      majority is America/New_York (2 entries) — majority should win
expect("DOV majority → America/New_York", airportMap["DOV"], "America/New_York");
// BPE: Asia/Rangoon (2) vs Asia/Shanghai (3) — Shanghai wins
expect("BPE majority → Asia/Shanghai",    airportMap["BPE"], "Asia/Shanghai");

// Previously hardcoded in overrides, now handled by airport-timezone
// (verifies that removing them from overrides didn't break anything)
console.log("\nFormerly-hardcoded overrides now resolved via airport-timezone");
expect("SFO (was in overrides) → America/Los_Angeles", airportMap["SFO"], "America/Los_Angeles");
expect("JFK (was in overrides) → America/New_York",    airportMap["JFK"], "America/New_York");
expect("LHR (was in overrides) → Europe/London",       airportMap["LHR"], "Europe/London");
expect("CDG (was in overrides) → Europe/Paris",        airportMap["CDG"], "Europe/Paris");

// URC (Urumqi) — override was wrong (Asia/Shanghai); airport-timezone gives correct Asia/Urumqi
console.log("\nURC override removed — airport-timezone gives correct result");
expect("URC → Asia/Urumqi (not Asia/Shanghai)", airportMap["URC"], "Asia/Urumqi");

console.log("\nUnknown code returns undefined (not resolved)");
// SOS is not in the dataset; ZZZZ is not a 3-letter code; XXX is a real placeholder entry
expect("SOS → undefined", airportMap["SOS"], undefined);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
