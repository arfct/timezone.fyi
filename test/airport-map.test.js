/**
 * Tests for airport code + metro area code → timezone resolution.
 * Data source: lxndrblz/Airports (airports.csv + citycodes.csv)
 *
 * Run with: npm test
 */

import { expect } from "./harness.js";
import airportMap from "../src/data/airport-map-data.json" with { type: "json" };

// --- Tests ---

console.log("\nairportMap coverage");
// lxndrblz source covers all IATA airports + metro codes
expect("has entries", Object.keys(airportMap).length > 9000, true);

console.log("\nWell-known airport codes resolve correctly");
expect("JFK → America/New_York",    airportMap["JFK"], "America/New_York");
expect("LHR → Europe/London",       airportMap["LHR"], "Europe/London");
expect("NRT → Asia/Tokyo",          airportMap["NRT"], "Asia/Tokyo");
expect("SYD → Australia/Sydney",    airportMap["SYD"], "Australia/Sydney");
expect("DXB → Asia/Dubai",          airportMap["DXB"], "Asia/Dubai");
expect("LAX → America/Los_Angeles", airportMap["LAX"], "America/Los_Angeles");
expect("CDG → Europe/Paris",        airportMap["CDG"], "Europe/Paris");
expect("ORD → America/Chicago",     airportMap["ORD"], "America/Chicago");
expect("ATL → America/New_York",    airportMap["ATL"], "America/New_York");
expect("SIN → Asia/Singapore",      airportMap["SIN"], "Asia/Singapore");
expect("AMS → Europe/Amsterdam",    airportMap["AMS"], "Europe/Amsterdam");
expect("MUC → Europe/Berlin",       airportMap["MUC"], "Europe/Berlin");
expect("GRU → America/Sao_Paulo",   airportMap["GRU"], "America/Sao_Paulo");
expect("YYZ → America/Toronto",     airportMap["YYZ"], "America/Toronto");

console.log("\nSmaller regional airports");
expect("BZN (Bozeman, MT) → America/Denver",       airportMap["BZN"], "America/Denver");
expect("FSD (Sioux Falls, SD) → America/Chicago",  airportMap["FSD"], "America/Chicago");
expect("TVC (Traverse City, MI) → America/Detroit",airportMap["TVC"], "America/Detroit");
expect("FAI (Fairbanks, AK) → America/Anchorage",  airportMap["FAI"], "America/Anchorage");
expect("HNL (Honolulu) → Pacific/Honolulu",        airportMap["HNL"], "Pacific/Honolulu");
expect("OGG (Maui) → Pacific/Honolulu",            airportMap["OGG"], "Pacific/Honolulu");
expect("BQN (Aguadilla, PR) → America/Puerto_Rico",airportMap["BQN"], "America/Puerto_Rico");
expect("GUM (Guam) → Pacific/Guam",                airportMap["GUM"], "Pacific/Guam");
expect("PPT (Papeete, Tahiti) → Pacific/Tahiti",   airportMap["PPT"], "Pacific/Tahiti");
expect("MEL (Melbourne) → Australia/Melbourne",    airportMap["MEL"], "Australia/Melbourne");
expect("PER (Perth) → Australia/Perth",            airportMap["PER"], "Australia/Perth");
expect("ADL (Adelaide) → Australia/Adelaide",      airportMap["ADL"], "Australia/Adelaide");
expect("ZQN (Queenstown, NZ) → Pacific/Auckland",  airportMap["ZQN"], "Pacific/Auckland");

console.log("\nCodes IATA reassigned to new airports (checked against OurAirports coordinates)");
expect("RSI (Red Sea Intl, SA) → Asia/Riyadh",   airportMap["RSI"], "Asia/Riyadh");
expect("CCE (Capital Intl, EG) → Africa/Cairo",  airportMap["CCE"], "Africa/Cairo");
expect("YSQ (Songyuan, CN) → Asia/Shanghai",     airportMap["YSQ"], "Asia/Shanghai");

console.log("\nNew airports");
expect("WSI (Western Sydney) → Australia/Sydney", airportMap["WSI"], "Australia/Sydney");
expect("DXN (Noida, IN) → Asia/Kolkata",          airportMap["DXN"], "Asia/Kolkata");

console.log("\nMetro area codes (citycodes.csv)");
expect("NYC → America/New_York",   airportMap["NYC"], "America/New_York");
expect("LON → Europe/London",      airportMap["LON"], "Europe/London");
expect("TYO → Asia/Tokyo",         airportMap["TYO"], "Asia/Tokyo");
expect("PAR → Europe/Paris",       airportMap["PAR"], "Europe/Paris");
expect("MOW → Europe/Moscow",      airportMap["MOW"], "Europe/Moscow");
expect("BJS → Asia/Shanghai",      airportMap["BJS"], "Asia/Shanghai");
expect("SEL → Asia/Seoul",         airportMap["SEL"], "Asia/Seoul");
expect("OSA → Asia/Tokyo",         airportMap["OSA"], "Asia/Tokyo");
expect("ROM → Europe/Rome",        airportMap["ROM"], "Europe/Rome");
expect("MIL → Europe/Rome",        airportMap["MIL"], "Europe/Rome");
expect("BUH → Europe/Bucharest",   airportMap["BUH"], "Europe/Bucharest");
expect("WAS → America/New_York",   airportMap["WAS"], "America/New_York");
expect("YTO → America/Toronto",    airportMap["YTO"], "America/Toronto");
expect("YMQ → America/Toronto",    airportMap["YMQ"], "America/Toronto");
expect("SAO → America/Sao_Paulo",  airportMap["SAO"], "America/Sao_Paulo");
expect("BUE → America/Argentina/Buenos_Aires", airportMap["BUE"], "America/Argentina/Buenos_Aires");

console.log("\nDerived city codes (from airports.csv city_code field)");
expect("CHI → America/Chicago",    airportMap["CHI"], "America/Chicago");
expect("DTT → America/Detroit",    airportMap["DTT"], "America/Detroit");

console.log("\nTZ alias normalization (Brazil/East → America/Sao_Paulo)");
expect("RIO → America/Sao_Paulo (not Brazil/East)", airportMap["RIO"], "America/Sao_Paulo");
expect("GIG → America/Sao_Paulo (not Brazil/East)", airportMap["GIG"], "America/Sao_Paulo");

console.log("\nTCI collision — lxndrblz maps TCI to a Russian airport, not Tenerife");
// TCI in the JSON should be Asia/Vladivostok (Terney Airport, RU).
// The Tenerife metro override is handled in placeAliases in zone-lookup.js, not the JSON.
expect("TCI in JSON → Asia/Vladivostok (Russian airport)", airportMap["TCI"], "Asia/Vladivostok");

console.log("\nUnknown code returns undefined");
expect("SOS → undefined", airportMap["SOS"], undefined);

