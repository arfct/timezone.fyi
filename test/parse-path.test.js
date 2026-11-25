/**
 * Tests for the URL grammar: every form the original site accepted, and the
 * dates, lengths, repeats and 24-hour display added by the Worker refactor.
 *
 * Run with: npm test
 */

import { resolveEvent } from "../src/lib/event.js";
import { parsePath, readDate, readRecurrence } from "../src/lib/parse-path.js";
import { expect } from "./harness.js";

// Wednesday 25 November 2026, 15:00 UTC: 10am in New York, 7am in Los Angeles
const NOW = Date.UTC(2026, 10, 25, 15, 0);
const iso = (ms) => (ms === undefined ? "none" : new Date(ms).toISOString().slice(0, 16));

function read(path, now = NOW) {
  const model = parsePath(path);
  if (model.kind === "error" || model.kind === "home") return model;
  return resolveEvent(model, now);
}
const times = (path) => read(path).timesText;

console.log("\nThe README's examples still read the same");
expect("/10:30am,pst,est", times("/10:30am,pst,est"), "10:30am PST · 1:30pm EST");
expect("/2pm,JFK,LHR,NRT", times("/2pm,JFK,LHR,NRT"), "2pm JFK · 7pm LHR · 4am NRT +1");
expect(
  "/my-meeting/10am,NYC,LON,TOK",
  times("/my-meeting/10am,NYC,LON,TOK"),
  "10am NYC · 3pm LON · 12am TOK +1",
);
expect("its label", read("/my-meeting/10am,NYC,LON,TOK").label, "my meeting");
expect("/now,cst,pst is live", read("/now,cst,pst").live, true);
expect("/now,cst,pst shows the current minute", times("/now,cst,pst"), "9am CST · 7am PST");
expect("a range: /10am-2pm,pst,est", times("/10am-2pm,pst,est"), "10am–2pm PST · 1pm–5pm EST");
expect("a range across midnight: /10pm-1am,nyc", times("/10pm-1am,nyc"), "10pm–1am +1 NYC");
expect("periods separate zones: /10am.pst.est", times("/10am.pst.est"), "10am PST · 1pm EST");
expect("GMT offsets", times("/10am,GMT+5,GMT-8"), "10am GMT+5 · 9pm GMT-8 −1");
expect("IANA names", times("/10am,America/New_York,Europe/London"), "10am NEW YORK · 3pm LONDON");
expect("IST after PST is India", times("/10am,pst,ist"), "10am PST · 11:30pm IST");
expect("IST after LHR is Istanbul", times("/10am,lhr,ist"), "10am LHR · 1pm IST");
expect("CLT is Charlotte", read("/10am,clt").zones[0].zone, "America/New_York");
expect(
  "an undated time is today in the first zone",
  iso(read("/10:30am,pst,est").start),
  "2026-11-25T18:30",
);
expect("…and is marked as undated", read("/10:30am,pst,est").floating, true);
expect("percent-encoded label", read("/100%25-done/10am,pst").label, "100% done");
expect("lowercase IANA name", read("/10am,europe/london").zones[0].zone, "Europe/London");

console.log("\nA link with no time is a live clock");
expect("/pst,est", times("/pst,est"), "7am PST · 10am EST");
expect("/pst,est is live", read("/pst,est").live, true);
expect("/Europe/London", times("/Europe/London"), "3pm LONDON");
expect("/ is the home page", parsePath("/").kind, "home");

console.log("\n24-hour display (#27)");
expect("/22:30,pst,cet", times("/22:30,pst,cet"), "22:30 PST · 07:30 CET +1");
expect("/9-17,lon,nyc", times("/9-17,lon,nyc"), "09:00–17:00 LON · 04:00–12:00 NYC");
expect("/10:30,pst stays 12-hour", times("/10:30,pst"), "10:30am PST");
expect("/now24,cst,pst", times("/now24,cst,pst"), "09:00 CST · 07:00 PST");
expect("/standup/now24,cst,pst keeps its label", read("/standup/now24,cst,pst").label, "standup");

console.log("\nReading a date segment");
const show = (v) => JSON.stringify(v);
expect("2026-12-03", show(readDate("2026-12-03")), '{"year":2026,"month":12,"day":3}');
expect("dec3", show(readDate("dec3")), '{"month":12,"day":3}');
expect("3dec", show(readDate("3dec")), '{"month":12,"day":3}');
expect("dec-3", show(readDate("dec-3")), '{"month":12,"day":3}');
expect("december3", show(readDate("december3")), '{"month":12,"day":3}');
expect("Dec3-2027", show(readDate("Dec3-2027")), '{"year":2027,"month":12,"day":3}');
expect("fri", show(readDate("fri")), '{"weekday":5}');
expect("Friday", show(readDate("Friday")), '{"weekday":5}');
expect("thurs", show(readDate("thurs")), '{"weekday":4}');
expect("today", show(readDate("today")), '{"days":0}');
expect("tomorrow", show(readDate("tomorrow")), '{"days":1}');
expect("a label isn't a date: standup", readDate("standup"), null);
expect("sprint12 isn't a date", readDate("sprint12"), null);
expect("frisbee isn't a weekday", readDate("frisbee"), null);
expect("monsday isn't a weekday", readDate("monsday"), null);
expect("dec32 isn't a date", readDate("dec32"), null);

console.log("\nReading a repeat segment");
expect("weekly", show(readRecurrence("weekly")), '{"recur":"weekly"}');
expect("every-mon", show(readRecurrence("every-mon")), '{"recur":"weekly","weekday":1}');
expect("every-weekday", show(readRecurrence("every-weekday")), '{"recur":"weekdays"}');
expect("fortnightly", show(readRecurrence("fortnightly")), '{"recur":"biweekly"}');
expect("every-so-often isn't a repeat", readRecurrence("every-so-often"), null);

console.log("\nDates");
expect("a dated link isn't undated", read("/2026-12-03/10am,nyc,lon").floating, false);
expect("/2026-12-03/10am,nyc,lon", iso(read("/2026-12-03/10am,nyc,lon").start), "2026-12-03T15:00");
expect("label, then date", read("/team-sync/2026-12-03/10am,nyc,lon").label, "team sync");
expect(
  "its date line",
  read("/team-sync/2026-12-03/10am,nyc,lon").dateText,
  "Thursday 3 December 2026",
);
expect(
  "a summer date uses summer offsets",
  times("/2026-07-01/10am,nyc,lon"),
  "10am NYC · 3pm LON",
);
expect(
  "…between the US and UK clock changes too",
  times("/2026-03-20/10am,nyc,lon"),
  "10am NYC · 2pm LON",
);
expect(
  "an impossible date is an error",
  read("/2026-02-30/10am,pst").error,
  "2026-02-30 isn't a date.",
);

console.log("\nRelative dates redirect to the link with the date written out");
expect("fri → the coming Friday", read("/fri/10am,pst").redirect, "/2026-11-27/10am,pst");
expect("wed → today, a Wednesday", read("/wed/10am,pst").redirect, "/2026-11-25/10am,pst");
expect("tomorrow", read("/tomorrow/10am,pst").redirect, "/2026-11-26/10am,pst");
expect("today", read("/today/10am,pst").redirect, "/2026-11-25/10am,pst");
expect("dec3", read("/dec3/10am,pst").redirect, "/2026-12-03/10am,pst");
expect(
  "3dec keeps the label",
  read("/launch/3dec/10am,pst").redirect,
  "/launch/2026-12-03/10am,pst",
);
expect(
  "a date already past this year is next year's",
  read("/nov3/10am,pst").redirect,
  "/2027-11-03/10am,pst",
);
expect("feb29 → the next leap year", read("/feb29/10am,pst").redirect, "/2028-02-29/10am,pst");
expect(
  "today is read in the first zone (Tokyo is a day ahead at 23:00 UTC)",
  read("/today/10am,tok", Date.UTC(2026, 10, 25, 23, 0)).redirect,
  "/2026-11-26/10am,tok",
);

console.log("\nLengths");
expect("10am+45m", times("/10am+45m,nyc"), "10am–10:45am NYC");
expect("10am+1h", read("/10am+1h,nyc").duration, 60);
expect("10am+1h30m", read("/10am+1h30m,nyc").duration, 90);
expect("10am+90", read("/10am+90,nyc").duration, 90);
expect("22:30+2h crosses midnight", times("/22:30+2h,nyc"), "22:30–00:30 +1 NYC");
expect("a range ignores a length", read("/10am-11am+45m,nyc").duration, 60);
expect("no length → no end", iso(read("/10am,nyc").end), "none");
expect("GMT+5 as a zone isn't a length", times("/10am,gmt+5"), "10am GMT+5");

console.log("\nRepeats");
expect(
  "every-mon pins the first Monday",
  read("/standup/every-mon/9:30am,nyc,lon").redirect,
  "/standup/weekly/2026-11-30/9:30am,nyc,lon",
);
expect(
  "weekly without a date starts today",
  read("/weekly/9:30am,nyc").redirect,
  "/weekly/2026-11-25/9:30am,nyc",
);
expect(
  "weekdays on a Saturday starts Monday",
  read("/weekdays/9am,nyc", Date.UTC(2026, 10, 28, 15)).redirect,
  "/weekdays/2026-11-30/9am,nyc",
);
const weekly = read("/standup/weekly/2026-03-02/9:30am+15m,nyc,lon");
expect("weekly shows the next occurrence", iso(weekly.start), "2026-11-30T14:30");
expect("…and says how it repeats", weekly.dateText, "Every Monday · next Mon 30 Nov");
expect("…and keeps its first date", `${weekly.anchor.day}/${weekly.anchor.month}`, "2/3");
expect(
  "an occurrence still running counts as next",
  iso(read("/weekly/2026-03-04/9:30am+1h,nyc", Date.UTC(2026, 10, 25, 15, 0)).start),
  "2026-11-25T14:30",
);
expect(
  "…a finished one doesn't",
  iso(read("/weekly/2026-03-04/9:30am+15m,nyc", Date.UTC(2026, 10, 25, 15, 0)).start),
  "2026-12-02T14:30",
);
expect(
  "a repeat that hasn't started shows its first date",
  iso(read("/weekly/2027-01-04/9am,nyc").start),
  "2027-01-04T14:00",
);
expect("daily", iso(read("/daily/2026-01-01/9am,nyc").start), "2026-11-26T14:00");
expect(
  "weekdays skips the weekend",
  iso(read("/weekdays/2026-01-01/9am,nyc", Date.UTC(2026, 10, 28, 15)).start),
  "2026-11-30T14:00",
);
expect("biweekly", iso(read("/biweekly/2026-11-09/9am,nyc").start), "2026-12-07T14:00");
expect(
  "monthly on the 31st skips short months",
  iso(read("/monthly/2026-01-31/10am,nyc").start),
  "2026-12-31T15:00",
);
expect("monthly text", read("/monthly/2026-01-31/10am,nyc").recurText, "Monthly on the 31st");
expect("yearly", iso(read("/yearly/2020-12-03/10am,nyc").start), "2026-12-03T15:00");

console.log("\nPaths for the image and the calendar file");
expect("…/event.ics", parsePath("/10am,nyc,lon/event.ics").suffix, "ics");
expect("…/card.png", parsePath("/10am,nyc,lon/card.png").suffix, "png");
expect(
  "an IANA zone before the suffix",
  read("/10am,Europe/London/event.ics").zones[0].zone,
  "Europe/London",
);
expect("the airport ICS is still a zone", read("/10am.pst.ics").zones[1].zone, "America/Boise");
expect("/card.png alone is the home image", parsePath("/card.png").kind, "home");

console.log("\nSmall repairs");
expect("a dot in the time: /10.30am,pst", times("/10.30am,pst"), "10:30am PST");
expect("spaces in the zone list", times("/10am,pst,%20est"), "10am PST · 1pm EST");

console.log("\nErrors");
expect("no zones", parsePath("/10am").kind, "error");
expect("an unknown zone", /isn't a zone/.test(read("/10am,xyz").error), true);
expect("a broken escape", parsePath("/%E0%A4%A/10am,pst").kind, "error");
expect("an offset past UTC+14", /outside/.test(read("/10am,gmt+19").error), true);

console.log("\nThe one change to an old reading: a label that is a date or repeat word");
expect(
  "/fri/10am,pst is Friday, not a label",
  read("/fri/10am,pst").redirect,
  "/2026-11-27/10am,pst",
);
expect(
  "/friday-sync/10am,pst is still a label",
  read("/friday-sync/10am,pst").label,
  "friday sync",
);
