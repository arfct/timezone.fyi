// Where the sun is, for the sky gradient. Shared by the Worker (bundled) and
// the browser (served as a static module). No dependencies.
//
// The position is NOAA's low-precision method (Meeus, Astronomical Algorithms,
// chapter 25): declination and the equation of time from the date, then the
// hour angle from the longitude. Against an ephemeris, sunrise, sunset and
// civil twilight came out within 6 seconds for 20 place-days of 2026 from
// Singapore to Longyearbyen (test/sun.test.js). The method is meant for 1900
// to 2100.

const RAD = Math.PI / 180;
const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);
const MINUTE = 60000;
const DAY = 86400000;

// The sun's centre is this far below the horizon when its top edge touches
// it, with average refraction; civil twilight ends at 6° below.
export const SUNRISE = -0.833;
export const CIVIL = -6;

// in: an instant (ms)
// out: the sun's declination in degrees, and the equation of time in minutes
//      (how far a sundial runs ahead of a clock)
export function solar(ms) {
  // Julian centuries since 2000-01-01 12:00 UTC
  const t = (ms / DAY - 10957.5) / 36525;
  const meanLongitude = 280.46646 + t * (36000.76983 + t * 0.0003032);
  const anomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * anomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * anomaly) * 0.000289;
  const node = 125.04 - 1934.136 * t;
  const longitude = meanLongitude + centre - 0.00569 - 0.00478 * sin(node);
  const obliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 +
    0.00256 * cos(node);
  const declination = Math.asin(sin(obliquity) * sin(longitude)) / RAD;
  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const equation =
    (4 / RAD) *
    (y * sin(2 * meanLongitude) -
      2 * eccentricity * sin(anomaly) +
      4 * eccentricity * y * sin(anomaly) * cos(2 * meanLongitude) -
      0.5 * y * y * sin(4 * meanLongitude) -
      1.25 * eccentricity * eccentricity * sin(2 * anomaly));
  return { declination, equation };
}

// The hour angle at which the sun stands at `elevation` degrees: 0 when it
// never gets that high on this day, 180 when it never gets that low.
export function hourAngleAt(elevation, lat, declination) {
  const c = (sin(elevation) - sin(lat) * sin(declination)) / (cos(lat) * cos(declination));
  return c >= 1 ? 0 : c <= -1 ? 180 : Math.acos(c) / RAD;
}

// in: an instant (ms) and a place (degrees; east and north are positive)
// out: elevation, the sun's height above the horizon in degrees (no
//      refraction), and hourAngle in degrees: 0 at solar noon, −90 six hours
//      before, ±180 at solar midnight
export function sunAt(ms, lat, lon) {
  const { declination, equation } = solar(ms);
  const minutes = (((ms % DAY) + DAY) % DAY) / MINUTE + equation + 4 * lon;
  const hourAngle = ((((minutes / 4 - 180) % 360) + 540) % 360) - 180;
  const elevation =
    Math.asin(sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle)) / RAD;
  return { elevation, hourAngle, declination };
}

// in: an instant (ms) and a place
// out: the events of the solar day around that instant, as instants (ms):
//      { noon, sunrise, sunset, dawn, dusk, polar }. dawn and dusk are civil
//      (6° below). In polar day and polar night sunrise and sunset are null
//      and polar is "day" or "night"; dawn and dusk are null when the sky
//      never gets, or never stops being, that dark.
export function sunEvents(ms, lat, lon) {
  // Solar noon nearest the instant: two steps is within a second
  let noon = ms;
  for (let i = 0; i < 2; i++) noon -= sunAt(noon, lat, lon).hourAngle * 4 * MINUTE;
  const cross = (elevation, side) => {
    let at = noon;
    for (let i = 0; i < 3; i++) {
      const h = hourAngleAt(elevation, lat, solar(at).declination);
      if (h === 0 || h === 180) return null;
      at = noon + side * h * 4 * MINUTE;
      // The equation of time moves a little between noon and the event
      at -= (solar(at).equation - solar(noon).equation) * MINUTE;
    }
    return at;
  };
  const sunrise = cross(SUNRISE, -1);
  const sunset = cross(SUNRISE, 1);
  const high = sunAt(noon, lat, lon).elevation;
  return {
    noon,
    sunrise,
    sunset,
    dawn: cross(CIVIL, -1),
    dusk: cross(CIVIL, 1),
    polar: sunrise !== null && sunset !== null ? null : high > SUNRISE ? "day" : "night",
  };
}

// in: an instant (ms) and a place
// out: the sun's state there, for skyAt in sky.js: { lat, hourAngle,
//      elevation, declination, turnDeclination }. turnDeclination is the
//      declination at the nearest solar noon or solar midnight, whichever is
//      nearer: a value that holds still for the six hours either side.
export function sunSky(ms, lat, lon) {
  // At the poles themselves the hour angle means nothing; stay a hair inside
  lat = Math.min(89.9, Math.max(-89.9, lat));
  const { hourAngle, elevation, declination } = sunAt(ms, lat, lon);
  // Degrees since the nearest turn of the day: noon, or midnight
  const since =
    Math.abs(hourAngle) < 90 ? hourAngle : hourAngle > 0 ? hourAngle - 180 : hourAngle + 180;
  return {
    lat,
    hourAngle,
    elevation,
    declination,
    turnDeclination: solar(ms - since * 4 * MINUTE).declination,
  };
}
