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
function hourAngleAt(elevation, lat, declination) {
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

// --- From the sun to the sky gradient -------------------------------------
//
// The gradient (SKY in shared.js) has 24 entries, drawn for the hours of a
// day with sunrise near 6am and sunset near 6pm. A place and an instant pick a
// "palette hour" in it, by the sun and not by the clock:
//
//   solar midnight 0 · civil dawn 5.5 · sunrise 6.5 · solar noon 12
//   · sunset 18.5 · civil dusk 19.5 · solar midnight 24
//
// and in a straight line between those. So morning keeps the morning colours
// and evening the evening ones, however long the day is.
//
// Where the sun doesn't reach one of those marks, the end of the line is set
// by how high or low the sun does get: a winter noon with the sun under 30°
// stops short of the full midday colours, a summer midnight with the sun 15°
// down stops short of full night, a polar noon in twilight stays in the
// twilight colours and a polar midnight in sunlight stays in the day's.

// Palette hour for the sun standing at an elevation, morning side and evening
// side. Past 30° up it's midday; past 30° down it's midnight.
const RAMP = [
  [-30, 0, 24],
  [-18, 4, 21],
  [CIVIL, 5.5, 19.5],
  [SUNRISE, 6.5, 18.5],
  [2, 9, 15.5],
  [30, 12, 12],
];
function rampAt(elevation, side) {
  if (elevation <= RAMP[0][0]) return RAMP[0][side];
  for (let i = 1; i < RAMP.length; i++) {
    if (elevation <= RAMP[i][0]) {
      const t = (elevation - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]);
      return RAMP[i - 1][side] + (RAMP[i][side] - RAMP[i - 1][side]) * t;
    }
  }
  return 12;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// in: an instant (ms) and a place
// out: { hour, other, mix } for skyAt in shared.js: the palette hour, and
//      where morning and evening colours meet without passing through midday
//      or midnight (a polar noon, a white night), a second palette hour and
//      how much of it to blend in, 0 to 1. On an ordinary day mix is 0.
export function sunSky(ms, lat, lon) {
  // At the poles themselves the hour angle means nothing; stay a hair inside
  lat = Math.min(89.9, Math.max(-89.9, lat));
  const { hourAngle, declination } = sunAt(ms, lat, lon);
  const high = 90 - Math.abs(lat - declination); // elevation at solar noon
  const low = Math.abs(lat + declination) - 90; // and at solar midnight
  const rise = hourAngleAt(SUNRISE, lat, declination);
  const dusk = hourAngleAt(CIVIL, lat, declination);
  const h = Math.abs(hourAngle);

  // One side of the day: palette hours at midnight, dusk or dawn, sunset or
  // sunrise, and noon, against the hour angle
  const branch = (side) => {
    const points = [[0, rampAt(high, side)]];
    if (rise > 0 && rise < 180) points.push([rise, RAMP[3][side]]);
    if (dusk > 0 && dusk < 180) points.push([dusk, RAMP[2][side]]);
    points.push([180, rampAt(low, side)]);
    for (let i = 1; i < points.length; i++) {
      if (h <= points[i][0]) {
        const t = (h - points[i - 1][0]) / (points[i][0] - points[i - 1][0]);
        return points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t;
      }
    }
    return points[points.length - 1][1];
  };
  const morning = branch(1);
  const evening = branch(2);

  // Morning and evening meet at noon and at midnight. When they don't meet at
  // the same palette hour there, one fades into the other around that moment:
  // over the six hours either side when the gap is whole (blue dawn against
  // pink dusk), and over much less when it's small (two shades of yellow).
  const noonSpan = 90 * clamp01((12 - rampAt(high, 1)) / 5.5) ** 2;
  const nightSpan = 90 * clamp01(rampAt(low, 1) / 5.5) ** 2;
  let evenings = hourAngle > 0 ? 1 : 0; // how much of the evening branch
  if (h < noonSpan) evenings = 0.5 + hourAngle / noonSpan / 2;
  else if (180 - h < nightSpan) {
    const past = hourAngle > 0 ? h - 180 : 180 - h; // degrees after midnight
    evenings = 0.5 - past / nightSpan / 2;
  }
  return evenings <= 0.5
    ? { hour: morning, other: evening, mix: evenings }
    : { hour: evening, other: morning, mix: 1 - evenings };
}
