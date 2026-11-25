/**
 * Tests for the time zone arithmetic the Worker does with Intl, checked
 * against timezonecomplete and the tzdata package (the library and data the
 * Netlify site used).
 *
 * Run with: npm test
 */

import { createRequire } from "node:module";
import {
  canonicalZone,
  formatOffset,
  instantOf,
  offsetAt,
  transitions,
  wallAt,
} from "../src/lib/tz.js";
import { expect } from "./harness.js";

const require = createRequire(import.meta.url);
const tc = require("timezonecomplete");
tc.TzDatabase.init(require("tzdata"));
const tzdb = tc.TzDatabase.instance();

const ZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "America/St_Johns",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Pacific/Chatham",
];

console.log("\nOffsets agree with tzdata, every 6 hours through 2026 and 2027");
for (const zone of ZONES) {
  let mismatches = 0;
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 6 * 3600000) {
    if (offsetAt(zone, t) !== tzdb.totalOffset(zone, t).minutes()) mismatches++;
  }
  expect(zone, mismatches, 0);
}

// timezonecomplete 5.15.1 with tzdata 1.0.54 puts Cairo at UTC+2 in July,
// though tzdata's own rule (Egypt, 2023 onwards) has summer time from the last
// Friday of April. Intl follows the rule, so Cairo is checked on its own.
console.log("\nCairo follows Egypt's summer time, back since 2023");
expect("UTC+3 on 1 July 2026", offsetAt("Africa/Cairo", Date.UTC(2026, 6, 1)), 180);
expect("UTC+2 on 1 December 2026", offsetAt("Africa/Cairo", Date.UTC(2026, 11, 1)), 120);
expect(
  "timezonecomplete disagrees in July (if this fails, it was fixed)",
  tzdb.totalOffset("Africa/Cairo", Date.UTC(2026, 6, 1)).minutes(),
  120,
);

console.log("\nClock time → instant");
const iso = (r) => new Date(r.ms).toISOString().slice(0, 16) + (r.moved ? " moved" : "");
expect(
  "10:00 in New York in winter",
  iso(instantOf("America/New_York", 2026, 11, 25, 600)),
  "2026-11-25T15:00",
);
expect(
  "10:00 in New York in summer",
  iso(instantOf("America/New_York", 2026, 7, 1, 600)),
  "2026-07-01T14:00",
);
expect(
  "a fixed offset: 10:00 at UTC+5:30",
  iso(instantOf(330, 2026, 7, 1, 600)),
  "2026-07-01T04:30",
);
expect(
  "02:30 on the day clocks spring forward moves to 03:30",
  iso(instantOf("America/Los_Angeles", 2026, 3, 8, 150)),
  "2026-03-08T10:30 moved",
);
expect(
  "01:30 on the day clocks fall back is the first 01:30",
  iso(instantOf("America/Los_Angeles", 2026, 11, 1, 90)),
  "2026-11-01T08:30",
);
expect(
  "minutes past 1440 reach the next day",
  iso(instantOf("America/New_York", 2026, 11, 25, 1500)),
  "2026-11-26T06:00",
);
expect(
  "02:15 in Lord Howe's half-hour gap moves to 02:45",
  iso(instantOf("Australia/Lord_Howe", 2026, 10, 4, 135)),
  "2026-10-03T15:45 moved",
);

console.log("\nInstant → clock time");
const wall = wallAt("Asia/Tokyo", Date.UTC(2026, 10, 25, 15, 0));
expect(
  "15:00 UTC is midnight in Tokyo",
  `${wall.year}-${wall.month}-${wall.day} ${wall.hour}:${wall.minute}`,
  "2026-11-26 0:0",
);
expect("…on a Thursday", wall.weekday, 4);
expect("a fixed offset", wallAt(-210, Date.UTC(2026, 10, 25, 15, 0)).minutes, 690);

console.log("\nZone names");
expect("canonical spelling", canonicalZone("america/new_york"), "America/New_York");
expect("unknown zone", canonicalZone("Mars/Olympus"), null);
expect(
  "a current name isn't swapped for an older one",
  canonicalZone("Asia/Kolkata"),
  "Asia/Kolkata",
);
expect("…typed in lowercase", canonicalZone("asia/ho_chi_minh"), "Asia/Ho_Chi_Minh");
expect("UTC", formatOffset(0), "UTC");
expect("UTC−8", formatOffset(-480), "UTC−8");
expect("UTC+5:30", formatOffset(330), "UTC+5:30");

console.log("\nOffset changes");
const show = (list) =>
  list.map((t) => `${new Date(t.at).toISOString().slice(0, 16)} ${t.before}→${t.after}`).join(", ");
expect(
  "New York, 2026",
  show(transitions("America/New_York", Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1))),
  "2026-03-08T07:00 -300→-240, 2026-11-01T06:00 -240→-300",
);
expect(
  "found the same sampling weekly",
  show(transitions("America/New_York", Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), 7 * 86400000)),
  "2026-03-08T07:00 -300→-240, 2026-11-01T06:00 -240→-300",
);
expect(
  "Tokyo has none",
  show(transitions("Asia/Tokyo", Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1))),
  "",
);
expect(
  "a fixed offset has none",
  show(transitions(330, Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1))),
  "",
);
