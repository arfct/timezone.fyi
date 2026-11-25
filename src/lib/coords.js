// Where a zone code is on the Earth, for the sun's position there. Best first:
//
//   1. a place with coordinates of its own: an airport or city code, or one
//      of the nicknames below
//   2. the zone's principal place (zone-coords.js): for zone names, and for
//      abbreviations through the zone they stand for
//   3. for a bare UTC offset (gmt+5:30, utc, gmt) and an abbreviation that
//      only names one (wet, ndt): the place where most people on that offset
//      live (offset-coords.json, built by scripts/build-offset-coords.mjs)
//   4. nothing, for an offset no zone uses (gmt+7:15): the sky then follows
//      the clock
import zoneCoords from "../../public/assets/zone-coords.js";
import airportCoords from "../data/airport-coords.json" with { type: "json" };
import offsetCoords from "../data/offset-coords.json" with { type: "json" };
import { abbreviationPlaces } from "./zone-lookup.js";

// Nicknames and city codes that aren't in the airport data (placeAliases in
// zone-lookup.js)
const ALIAS_COORDS = {
  SF: [37.8, -122.4],
  MTV: [37.4, -122.1],
  MPO: [37.5, -122.2],
  CAM: [42.4, -71.1],
  TOK: [35.7, 139.7],
  TCI: [28.3, -16.6],
  QDF: [32.9, -97],
  QHO: [29.8, -95.4],
  QMI: [25.8, -80.2],
};

// airport-coords.json is one string of 7-character records in code order:
// the code, then tenths of a degree from the south pole and from 180° west
// as one number in four base-64 digits
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const RECORD = 7;
export function airportCoordsOf(code) {
  const records = airportCoords.records;
  let lo = 0;
  let hi = records.length / RECORD - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const found = records.substr(mid * RECORD, 3);
    if (found === code) {
      let n = 0;
      for (let i = 3; i < RECORD; i++) n = n * 64 + DIGITS.indexOf(records[mid * RECORD + i]);
      return [Math.floor(n / 3601) / 10 - 90, (n % 3601) / 10 - 180].map(
        (v) => Math.round(v * 10) / 10,
      );
    }
    if (found < code) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

let lowerCased;
// in: an IANA zone name in any letter case
// out: [latitude, longitude] of its principal place, or null
export function zoneCoordsOf(name) {
  if (typeof name !== "string") return null;
  if (zoneCoords[name]) return zoneCoords[name];
  lowerCased ??= new Map(Object.entries(zoneCoords).map(([k, v]) => [k.toLowerCase(), v]));
  return lowerCased.get(name.toLowerCase()) ?? null;
}

// in: a UTC offset in minutes, east positive
// out: { lat, lon } of the place that stands for that offset, or null
export function offsetCoordsOf(minutes) {
  const found = offsetCoords.coords[minutes];
  return found ? { lat: found[0], lon: found[1] } : null;
}

// in: a zone code as typed, how it read ("place", "zone" or undefined, from
//     resolvePlaces) and the zone it resolved to: an IANA name, or a fixed
//     offset in minutes
// out: { lat, lon } or null
export function coordsOf(code, kind, zone) {
  const upper = code.toUpperCase();
  const found =
    (kind === "place" ? (ALIAS_COORDS[upper] ?? airportCoordsOf(upper)) : null) ??
    zoneCoordsOf(zone) ??
    (kind === "zone" ? zoneCoordsOf(abbreviationPlaces[upper]) : null);
  if (found) return { lat: found[0], lon: found[1] };
  return typeof zone === "number" ? offsetCoordsOf(zone) : null;
}
