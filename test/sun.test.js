/**
 * Tests for the sun's position (public/assets/sun.js), the sky colours drawn
 * from it, and where a zone code is on the Earth (src/lib/coords.js).
 *
 * Run with: npm test
 */

import { paletteHours, skyAt } from "../public/assets/sky.js";
import { SUNRISE, sunAt, sunEvents, sunSky } from "../public/assets/sun.js";
import { coordsOf, offsetCoordsOf } from "../src/lib/coords.js";
import { resolveEvent, resolveZones } from "../src/lib/event.js";
import { parsePath } from "../src/lib/parse-path.js";
import { offsetAt } from "../src/lib/tz.js";
import { resolvePlaces } from "../src/lib/zone-lookup.js";
import { eventCard } from "../src/render/card.js";
import { eventPage, homePage } from "../src/render/page.js";
import { expect } from "./harness.js";

// Reference times from PyEphem 4.2 (the XEphem ephemeris, an independent
// implementation), with the sun's centre 0.8333° below the horizon for rise
// and set (the convention NOAA's solar calculator uses) and 6° below for
// civil twilight, no atmosphere, sea level. "up" and "down": the sun stays
// above or below that mark all day.
// [place, lat, lon, date, solar noon, sunrise, sunset, civil dawn, civil dusk, elevation at 12:00 UTC]
const REFERENCE = [
  [
    "New York",
    40.7128,
    -74.006,
    "2026-03-20",
    "17:03:23",
    "10:59:18",
    "23:08:10",
    "10:32:01",
    "23:35:30",
    10.635,
  ],
  [
    "New York",
    40.7128,
    -74.006,
    "2026-06-21",
    "16:57:53",
    "09:25:01",
    "+00:30:44",
    "08:51:35",
    "+01:04:10",
    26.47,
  ],
  [
    "New York",
    40.7128,
    -74.006,
    "2026-12-21",
    "16:54:11",
    "12:16:34",
    "21:31:47",
    "11:45:34",
    "22:02:48",
    -3.567,
  ],
  [
    "London",
    51.5074,
    -0.1278,
    "2026-03-20",
    "12:07:56",
    "06:03:24",
    "18:13:29",
    "05:30:08",
    "18:46:51",
    38.418,
  ],
  [
    "London",
    51.5074,
    -0.1278,
    "2026-06-21",
    "12:02:19",
    "03:43:05",
    "20:21:33",
    "02:55:19",
    "21:09:19",
    61.926,
  ],
  [
    "London",
    51.5074,
    -0.1278,
    "2026-12-21",
    "11:58:34",
    "08:03:45",
    "15:53:23",
    "07:23:24",
    "16:33:44",
    15.053,
  ],
  [
    "Reykjavik",
    64.1466,
    -21.9426,
    "2026-06-21",
    "13:29:36",
    "02:55:12",
    "+00:03:57",
    "up",
    "up",
    46.705,
  ],
  [
    "Reykjavik",
    64.1466,
    -21.9426,
    "2026-12-21",
    "13:25:51",
    "11:22:21",
    "15:29:21",
    "10:03:00",
    "16:48:42",
    0.824,
  ],
  [
    "Singapore",
    1.3521,
    103.8198,
    "2026-03-20",
    "05:12:14",
    "-23:09:00",
    "11:15:29",
    "-22:48:20",
    "11:36:09",
    -11.961,
  ],
  [
    "Singapore",
    1.3521,
    103.8198,
    "2026-06-21",
    "05:06:28",
    "-23:00:27",
    "11:12:29",
    "-22:37:53",
    "11:35:03",
    -11.694,
  ],
  [
    "Singapore",
    1.3521,
    103.8198,
    "2026-12-21",
    "05:02:38",
    "-23:01:14",
    "11:04:02",
    "-22:38:42",
    "11:26:34",
    -13.653,
  ],
  [
    "Tromsø",
    69.6492,
    18.9553,
    "2026-03-20",
    "10:51:37",
    "04:43:55",
    "17:01:30",
    "03:43:49",
    "18:02:05",
    19.367,
  ],
  ["Tromsø", 69.6492, 18.9553, "2026-06-21", "10:45:59", "up", "up", "up", "up", 42.492],
  [
    "Tromsø",
    69.6492,
    18.9553,
    "2026-12-21",
    "10:42:13",
    "down",
    "down",
    "08:31:15",
    "12:53:09",
    -4.133,
  ],
  [
    "Tromsø",
    69.6492,
    18.9553,
    "2026-01-25",
    "10:56:28",
    "09:03:00",
    "12:50:54",
    "07:26:00",
    "14:27:59",
    0.74,
  ],
  [
    "Sydney",
    -33.8688,
    151.2093,
    "2026-06-21",
    "01:56:53",
    "-20:59:57",
    "06:53:48",
    "-20:32:13",
    "07:21:32",
    -62.422,
  ],
  [
    "Sydney",
    -33.8688,
    151.2093,
    "2026-12-21",
    "01:53:01",
    "-18:40:38",
    "09:05:24",
    "-18:11:29",
    "09:34:34",
    -26.685,
  ],
  [
    "Longyearbyen",
    78.2232,
    15.6267,
    "2026-03-20",
    "11:04:56",
    "04:51:51",
    "17:21:59",
    "03:06:07",
    "19:09:38",
    11.386,
  ],
  ["Longyearbyen", 78.2232, 15.6267, "2026-06-21", "10:59:18", "up", "up", "up", "up", 34.756],
  [
    "Longyearbyen",
    78.2232,
    15.6267,
    "2026-12-21",
    "10:55:32",
    "down",
    "down",
    "down",
    "down",
    -12.093,
  ],
];

// "17:03:23" on the date, UTC; "+…" the day after, "-…" the day before
function instant(date, time) {
  const shift = time[0] === "+" ? 1 : time[0] === "-" ? -1 : 0;
  return Date.parse(`${date}T${time.replace(/^[+-]/, "")}Z`) + shift * 86400000;
}

console.log("\nSunrise, sunset and twilight against an ephemeris");
let worst = 0;
for (const [place, lat, lon, date, ...want] of REFERENCE) {
  // Any instant of the day will do: the local clock's noon by longitude
  const events = sunEvents(Date.parse(`${date}T12:00Z`) - lon * 240000, lat, lon);
  const got = [events.noon, events.sunrise, events.sunset, events.dawn, events.dusk];
  const names = ["solar noon", "sunrise", "sunset", "civil dawn", "civil dusk"];
  let late = 0;
  let wrong = "";
  names.forEach((name, i) => {
    if (want[i] === "up" || want[i] === "down") {
      if (got[i] !== null) wrong += ` ${name} should be none`;
    } else if (got[i] === null) wrong += ` ${name} missing`;
    else late = Math.max(late, Math.abs(got[i] - instant(date, want[i])) / 1000);
  });
  worst = Math.max(worst, late);
  expect(`${place} ${date}: every event within 30 s${wrong}`, late <= 30 && !wrong, true);
  const polar = want[1] === "up" ? "day" : want[1] === "down" ? "night" : null;
  expect(`${place} ${date}: polar ${polar ?? "neither"}`, events.polar, polar);
  const elevation = sunAt(Date.parse(`${date}T12:00Z`), lat, lon).elevation;
  expect(
    `${place} ${date}: elevation at 12:00 UTC within 0.02°`,
    Math.abs(elevation - want[5]) < 0.02,
    true,
  );
}
console.log(`  (worst event: ${worst.toFixed(0)} s)`);

console.log("\nThe sun's place in the sky");
const equinoxNoon = sunAt(Date.parse("2026-03-20T12:07:30Z"), 0, 0);
expect("overhead at the equator at an equinox noon", equinoxNoon.elevation > 89, true);
expect("hour angle is 0 at solar noon", Math.abs(equinoxNoon.hourAngle) < 0.2, true);
expect(
  "and −90° six hours before",
  Math.round(sunAt(Date.parse("2026-03-20T06:07:30Z"), 0, 0).hourAngle),
  -90,
);
expect(
  "15° of longitude is an hour of sun",
  Math.round(sunAt(Date.parse("2026-03-20T12:07:30Z"), 0, 15).hourAngle),
  15,
);
expect(
  "the south pole in June is dark",
  sunAt(Date.UTC(2026, 5, 21), -90, 0).elevation < -23,
  true,
);

console.log("\nFrom the sun to the palette hour");
const near = (a, b, by = 0.05) => Math.abs(a - b) <= by;
const ny = { lat: 40.7128, lon: -74.006 };
const day = sunEvents(Date.parse("2026-03-20T17:00Z"), ny.lat, ny.lon);
// The top's palette hour: the morning's before solar noon, the evening's after
const hours = (ms, place = ny) => paletteHours(sunSky(ms, place.lat, place.lon));
const hourAt = (ms, place = ny) => {
  const [morning, evening, evenings] = hours(ms, place);
  return evenings > 0.5 ? evening : morning;
};
expect("solar noon is palette hour 12", near(hourAt(day.noon), 12), true);
expect("sunrise is 6.5", near(hourAt(day.sunrise), 6.5), true);
expect("sunset is 18.5", near(hourAt(day.sunset), 18.5), true);
expect("civil dawn is 5.5", near(hourAt(day.dawn), 5.5), true);
expect("civil dusk is 19.5", near(hourAt(day.dusk), 19.5), true);
const midnight = hourAt(day.noon - 43200000);
expect("solar midnight is 0, or 24", Math.min(midnight, 24 - midnight) < 0.1, true);
expect("an ordinary morning is all morning", hours(day.noon - 3 * 3600000)[2], 0);
expect("…and an ordinary afternoon all evening", hours(day.noon + 3 * 3600000)[2], 1);
expect(
  "the bottom, lit from further round, is ahead of the top at dawn",
  paletteHours(sunSky(day.dawn, ny.lat, ny.lon), 1.5)[0] > hourAt(day.dawn),
  true,
);
expect(
  "…and behind it at dusk",
  paletteHours(sunSky(day.dusk, ny.lat, ny.lon), 1.5)[1] < hourAt(day.dusk),
  true,
);

// On the day the gradient was drawn for, the sun and the clock agree
let apart = 0;
for (let minute = 0; minute < 1440; minute += 10) {
  // 40° north on the Greenwich meridian at the March equinox; the clock runs
  // 7 minutes ahead of the sun that day
  const hour = hourAt(Date.parse("2026-03-20T00:00Z") + minute * 60000, { lat: 40, lon: 0 });
  const clock = minute / 60;
  apart = Math.max(apart, Math.min(Math.abs(hour - clock), 24 - Math.abs(hour - clock)));
}
expect("a mid-latitude equinox day stays within 0.9 h of the clock's colours", apart < 0.9, true);

// Same clock time, different sun: 9pm on the longest and the shortest day
const rey = { lat: 64.1, lon: -21.9 };
const juneNine = sunSky(Date.parse("2026-06-21T21:00Z"), rey.lat, rey.lon);
const decNine = sunSky(Date.parse("2026-12-21T21:00Z"), rey.lat, rey.lon);
expect(
  "Reykjavik at 9pm in June is still afternoon",
  paletteHours(juneNine)[1] > 14 && paletteHours(juneNine)[1] < 18,
  true,
);
expect("…with a sky that takes dark text", skyAt(21 * 60, juneNine).dark, false);
expect("Reykjavik at 9pm in December is night", paletteHours(decNine)[1] > 21, true);
expect("…with a sky that takes light text", skyAt(21 * 60, decNine).dark, true);

const tromso = { lat: 69.6, lon: 19 };
const polarNoon = sunSky(Date.parse("2026-12-21T10:42Z"), tromso.lat, tromso.lon);
expect(
  "polar night: noon in Tromsø in December is twilight on both sides",
  paletteHours(polarNoon)[0] < 6.5 && paletteHours(polarNoon)[1] > 18.5,
  true,
);
expect("…half dawn and half dusk", near(paletteHours(polarNoon)[2], 0.5, 0.02), true);
expect("…and no lighter than twilight", skyAt(11 * 60 + 42, polarNoon).top < "#9", true);
const polarMidnight = sunSky(Date.parse("2026-06-21T22:46Z"), tromso.lat, tromso.lon);
expect(
  "polar day: midnight in Tromsø in June stays in the day's colours",
  paletteHours(polarMidnight)[0] >= 9 && paletteHours(polarMidnight)[1] <= 15.5,
  true,
);
expect("…and light", skyAt(46, polarMidnight).dark, false);
const svalbardNoon = paletteHours(sunSky(Date.parse("2026-12-21T10:55Z"), 78.2, 15.6));
expect(
  "deeper polar night: noon in Longyearbyen is night",
  svalbardNoon[0] < 5.5 && svalbardNoon[1] > 19.5,
  true,
);
expect(
  "the poles themselves give colours",
  /^#[0-9a-f]{6}$/.test(skyAt(0, sunSky(0, 90, 0)).top),
  true,
);

console.log("\nThe clock's colours where there is no place");
expect("without a sun the sky follows the clock", skyAt(600).top, "#f6e98f");
expect(
  "with one it follows the sun",
  skyAt(600, sunSky(Date.parse("2026-06-21T10:00Z"), 69.6, 19)).top === skyAt(600).top,
  false,
);

console.log("\nWhere a zone code is");
const where = (code) => {
  const [{ value, kind }] = resolvePlaces([code]);
  const zone = typeof value === "number" ? null : value;
  const found = coordsOf(code, kind, zone);
  return found ? `${found.lat},${found.lon}` : "none";
};
expect("an airport has its own coordinates: SEA", where("sea"), "47.4,-122.3");
expect("…and LAX, in the same zone, its own", where("lax"), "33.9,-118.4");
expect("a city code: LON", where("lon"), "51.5,-0.1");
expect("a city code: NYC", where("nyc"), "40.7,-74");
expect("a southern airport: SYD", where("syd"), "-33.9,151.2");
expect("a nickname: SF", where("sf"), "37.8,-122.4");
expect("a zone name takes the zone's principal city", where("Europe/Paris"), "48.9,2.3");
expect("…in any letter case", where("europe/paris"), "48.9,2.3");
expect("an old zone name takes its successor's", where("US/Pacific"), "34.1,-118.2");
expect("an abbreviation takes its zone's: PST", where("pst"), "34.1,-118.2");
expect("…a fixed-offset one takes its stand-in's: PDT", where("pdt"), "34.1,-118.2");
expect("…JST", where("jst"), "35.7,139.7");
expect("IST with no other code is India, not Istanbul", where("ist"), "22.5,88.4");

console.log("\nWhere an offset is: the latitude most of its people live at");
// As the event resolves it, for codes that name an offset and no place
const stands = (code) => {
  const [{ coords }] = resolveZones([code]);
  return coords ? `${coords.lat},${coords.lon}` : "none";
};
// 00:00 by standard time is the British Isles, Portugal, Iceland and West
// Africa. The 1° band with the most people in it is London's, 50.1 million
// with its neighbours, ahead of West Africa's coast at 5° to 7° north (Nigeria is on +01:00).
expect("GMT is southern England", stands("gmt"), "51.8,-1");
expect(
  "…and so are UTC and Etc/UTC",
  [stands("utc"), stands("Etc/UTC")].join(" "),
  "51.8,-1 51.8,-1",
);
expect("WET has a place of its own, Lisbon", stands("wet"), "38.7,-9.1");
expect("+05:30 is northern India", stands("gmt+5:30"), "22.6,79.1");
expect("+08:00 is eastern China", stands("utc+8"), "30.7,117.3");
expect("−03:00 is São Paulo's latitude", stands("utc-3"), "-23.4,-46.6");
expect("−05:00 is New York's", stands("gmt-5"), "40.8,-74");
expect("an Etc zone is its offset: Etc/GMT+5 is −05:00", stands("Etc/GMT+5"), "40.8,-74");
expect("an abbreviation that only names an offset: NDT, −02:30", stands("ndt"), "47.6,-52.7");
expect("−12:00, which no zone keeps, takes its band of longitude", stands("gmt-12"), "-36.8,174.8");
expect("an offset nobody keeps has no place", stands("gmt+7:15"), "none");
expect("an abbreviation with a place keeps it: JST", stands("jst"), "35.7,139.7");
// Every offset a zone keeps in 2026, in either season, and every whole hour
const kept = new Set();
for (let hour = -12; hour <= 14; hour++) kept.add(hour * 60);
for (const zone of Intl.supportedValuesOf("timeZone"))
  for (const month of [0, 6]) kept.add(offsetAt(zone, Date.UTC(2026, month, 15, 12)));
expect(
  `all ${kept.size} offsets from −12:00 to +14:00 have a place`,
  [...kept].filter((minutes) => !offsetCoordsOf(minutes)).join(),
  "",
);
expect(
  "…the half and quarter hours among them",
  [-570, -210, -150, 210, 270, 330, 345, 390, 525, 570, 630, 765, 825].every(offsetCoordsOf),
  true,
);
expect(
  "…each within the world, to 0.1°",
  [...kept].every((minutes) => {
    const { lat, lon } = offsetCoordsOf(minutes);
    return (
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && Number.isInteger(Math.round(lat * 1e6) / 1e5)
    );
  }),
  true,
);
// Longitude within 30° of the offset's own meridian, except across the date
// line and where a country keeps one time over a wide span
const astray = [...kept].filter((minutes) => {
  const { lon } = offsetCoordsOf(minutes);
  return Math.abs(((((lon - minutes / 4) % 360) + 540) % 360) - 180) > 30;
});
expect("…and near its own meridian", astray.join(), "");
const everyZone = Intl.supportedValuesOf("timeZone").filter(
  (zone) => !coordsOf(zone, undefined, zone),
);
expect("every zone this runtime lists has a place", everyZone.join(), "");

console.log("\nPages and images drawn from the sun");
const NOW = Date.UTC(2026, 10, 25, 15, 0);
const ORIGIN = "https://timezone.fyi";
const read = (path) => resolveEvent(parsePath(path), NOW);
const june = read("/2026-06-21/9pm,rek,lon,mad,sin");
const december = read("/2026-12-21/9pm,rek,lon,mad,sin");
expect("each zone carries its place", `${june.zones[0].lat},${june.zones[0].lon}`, "64.1,-21.9");
expect(
  "Reykjavik at 9pm: light in June",
  skyAt(june.zones[0].minutes, june.zones[0].sun).dark,
  false,
);
expect(
  "Reykjavik at 9pm: dark in December",
  skyAt(december.zones[0].minutes, december.zones[0].sun).dark,
  true,
);
expect(
  "Singapore at 5am the next day: the same sky in both",
  near(paletteHours(june.zones[3].sun)[0], paletteHours(december.zones[3].sun)[0], 0.3),
  true,
);
const junePage = eventPage(june, ORIGIN, `${ORIGIN}${june.path}/card.png`);
expect(
  "the page paints Reykjavik's stripe from its sun",
  junePage.includes(`--top:${skyAt(june.zones[0].minutes, june.zones[0].sun).top};`),
  true,
);
expect(
  "the page gives the browser each zone's place",
  /"zone":"Atlantic\/Reykjavik","lat":64.1,"lon":-21.9/.test(junePage),
  true,
);
expect(
  "the image paints it from the same sun",
  eventCard(june).includes(skyAt(june.zones[0].minutes, june.zones[0].sun).topP3Hex),
  true,
);
const placed = read("/2026-06-21/9pm,gmt+1,utc");
expect(
  "a bare offset has the sun of the place that stands for it: civil twilight at 9pm in June",
  [
    placed.zones[0].sun.elevation < 0 && placed.zones[0].sun.elevation > -6,
    /"lat":51.4,"lon":8.3/.test(eventPage(placed, ORIGIN, "")),
  ].join(),
  "true,true",
);
const offsets = read("/2026-06-21/9pm,gmt+7:15,gmt+7:15");
expect("an offset nobody keeps has no sun", offsets.zones[0].sun, undefined);
expect(
  "…so its stripe has the clock's colours",
  eventPage(offsets, ORIGIN, "").includes(`--top:${skyAt(21 * 60).top};`),
  true,
);
expect("…and the page gives it no place", /"lat"/.test(eventPage(offsets, ORIGIN, "")), false);

console.log("\nThe home page's stripes");
const plain = homePage(ORIGIN);
expect(
  "with no place they're the clock's 24 hours",
  plain.includes(`--top:${skyAt(12 * 60).top};`),
  true,
);
expect("…and carry no place", /data-lat/.test(plain), false);
const oslo = { lat: 59.9, lon: 10.7, zone: "Europe/Oslo" };
const homeJune = homePage(ORIGIN, undefined, oslo, Date.parse("2026-06-21T10:00Z"));
const homeDecember = homePage(ORIGIN, undefined, oslo, Date.parse("2026-12-21T10:00Z"));
const stripes = (html) => [
  ...html.matchAll(/<i style="--top:(#[0-9a-f]{6});[^"]*--on:(#[0-9a-f]{6})"/g),
];
expect("24 stripes", stripes(homeJune).length, 24);
expect(
  "the page says where they're for",
  /class="strip" data-lat="59.9" data-lon="10.7"/.test(homeJune),
  true,
);
const lightHours = (html) => stripes(html).filter((m) => m[2] !== "#ffffff").length;
expect("Oslo in June has many light hours", lightHours(homeJune) >= 17, true);
expect("Oslo in December has few", lightHours(homeDecember) <= 8, true);
// 4pm in Oslo on 21 December is 15:00 UTC
expect(
  "a stripe is that hour of today in the visitor's zone",
  stripes(homeDecember)[16][1],
  skyAt(16 * 60, sunSky(Date.parse("2026-12-21T15:00Z"), oslo.lat, oslo.lon)).top,
);
expect("SUNRISE is where the sun's top edge meets the horizon", SUNRISE, -0.833);
