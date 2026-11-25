/**
 * Tests for the calendar file: its fields, and that a parser (ical.js) reads
 * a repeating event at the right instants on both sides of a clock change.
 *
 * Run with: npm test
 */

import ICAL from "ical.js";
import { resolveEvent } from "../src/lib/event.js";
import { buildIcs, calendarLinks, eventUid, fold } from "../src/lib/ics.js";
import { parsePath } from "../src/lib/parse-path.js";
import { buildVtimezone } from "../src/lib/vtimezone.js";
import { expect } from "./harness.js";

const NOW = Date.UTC(2026, 10, 25, 15, 0);
const ORIGIN = "https://timezone.fyi";
const read = (path) => resolveEvent(parsePath(path), NOW);
const ics = async (path) => {
  const event = read(path);
  return buildIcs(event, ORIGIN + event.path, NOW);
};
const lines = (text) => text.replace(/\r\n /g, "").split("\r\n");
// A property of the VEVENT (the VTIMEZONE has its own DTSTART and RRULE lines)
const line = (text, name) => {
  const all = lines(text);
  return all.slice(all.indexOf("BEGIN:VEVENT")).find((l) => l.startsWith(name)) ?? "missing";
};
const header = (text, name) => lines(text).find((l) => l.startsWith(name)) ?? "missing";

console.log("\nA single event");
const single = await ics("/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok");
expect("starts with VCALENDAR", single.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"), true);
expect("every line ends CRLF", single.replace(/\r\n/g, "").includes("\n"), false);
expect("PRODID is this site's", header(single, "PRODID"), "PRODID:-//Artifact//timezone.fyi//EN");
expect("DTSTART in UTC", line(single, "DTSTART"), "DTSTART:20261203T150000Z");
expect("DTEND from the range", line(single, "DTEND"), "DTEND:20261203T163000Z");
expect("DTSTAMP is when it was made", line(single, "DTSTAMP"), "DTSTAMP:20261125T150000Z");
expect("SUMMARY is the label", line(single, "SUMMARY"), "SUMMARY:team sync");
expect(
  "URL is the page",
  line(single, "URL"),
  "URL:https://timezone.fyi/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok",
);
expect(
  "DESCRIPTION lists every zone",
  line(single, "DESCRIPTION").includes("12am–1:30am TOK +1"),
  true,
);
expect("no VTIMEZONE for a single event", single.includes("VTIMEZONE"), false);
expect("no RRULE", single.includes("RRULE"), false);
expect(
  "ical.js parses it",
  new ICAL.Component(ICAL.parse(single))
    .getFirstSubcomponent("vevent")
    .getFirstPropertyValue("summary"),
  "team sync",
);
expect(
  "UID has the site's domain",
  /^UID:[0-9a-f]{32}@timezone\.fyi$/.test(line(single, "UID")),
  true,
);
expect(
  "no line is over 75 octets",
  single.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75),
  true,
);

console.log("\nLength");
expect(
  "+45m sets DTEND",
  line(await ics("/2026-12-03/10am+45m,nyc"), "DTEND"),
  "DTEND:20261203T154500Z",
);
expect(
  "no end → 60 minutes",
  line(await ics("/2026-12-03/10am,nyc"), "DTEND"),
  "DTEND:20261203T160000Z",
);
expect(
  "an unlabelled event is named by its time",
  line(await ics("/2026-12-03/10am,nyc"), "SUMMARY"),
  "SUMMARY:10am NYC",
);

console.log("\nUID");
const uid = (path) => eventUid(read(path));
expect(
  "the same event through other zone lists has the same UID",
  await uid("/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok"),
  await uid("/team-sync/2026-12-03/10am-11:30am,nyc"),
);
expect(
  "…and written from another zone",
  await uid("/team-sync/2026-12-03/10am-11:30am,nyc"),
  await uid("/team-sync/2026-12-03/3pm-4:30pm,lon"),
);
expect(
  "a different time has a different UID",
  (await uid("/team-sync/2026-12-03/10am,nyc")) === (await uid("/team-sync/2026-12-03/11am,nyc")),
  false,
);
expect(
  "a different label has a different UID",
  (await uid("/a/2026-12-03/10am,nyc")) === (await uid("/b/2026-12-03/10am,nyc")),
  false,
);

console.log("\nText");
expect(
  "commas in the label are escaped",
  line(await ics("/a%3Bb/2026-12-03/10am,nyc"), "SUMMARY"),
  "SUMMARY:a\\;b",
);
expect(
  "a long line folds at 75 octets",
  fold("X".repeat(80)),
  `${"X".repeat(75)}\r\n ${"X".repeat(5)}`,
);
expect("folding doesn't split a character", fold(`${"X".repeat(74)}é`).split("\r\n ")[1], "é");

console.log("\nA repeating event keeps its local time (New York, weekly from 2 March 2026)");
const weekly = await ics("/standup/weekly/2026-03-02/9:30am+15m,nyc,lon");
expect(
  "DTSTART is local with a TZID",
  line(weekly, "DTSTART"),
  "DTSTART;TZID=America/New_York:20260302T093000",
);
expect("DTEND too", line(weekly, "DTEND"), "DTEND;TZID=America/New_York:20260302T094500");
expect("RRULE", line(weekly, "RRULE:FREQ=WEEKLY"), "RRULE:FREQ=WEEKLY;BYDAY=MO");
expect("it starts at the first date, not the next one", weekly.includes("20261130"), false);
expect("named for subscribers", header(weekly, "X-WR-CALNAME"), "X-WR-CALNAME:standup");

// Read it back with ical.js, using only the VTIMEZONE in the file
function occurrences(text, count) {
  const calendar = new ICAL.Component(ICAL.parse(text));
  const vtimezone = calendar.getFirstSubcomponent("vtimezone");
  if (vtimezone) ICAL.TimezoneService.register(new ICAL.Timezone({ component: vtimezone }));
  const event = new ICAL.Event(calendar.getFirstSubcomponent("vevent"));
  const iterator = event.iterator();
  const out = [];
  for (let i = 0; i < count; i++) out.push(iterator.next().toJSDate().toISOString().slice(0, 16));
  if (vtimezone) ICAL.TimezoneService.remove(vtimezone.getFirstPropertyValue("tzid"));
  return out;
}
const ny = occurrences(weekly, 40);
expect("ical.js parses it", ny.length, 40);
expect("2 March, before the US change: 14:30 UTC", ny[0], "2026-03-02T14:30");
expect("9 March, after it: 13:30 UTC", ny[1], "2026-03-09T13:30");
expect("26 October: 13:30 UTC", ny[34], "2026-10-26T13:30");
expect("2 November, after clocks go back: 14:30 UTC", ny[35], "2026-11-02T14:30");

console.log("\nVTIMEZONE rules");
const vtz = (zone, y = 2026) => buildVtimezone(zone, Date.UTC(y, 5, 1)).join("\n");
expect(
  "New York: second Sunday of March",
  vtz("America/New_York").includes("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU"),
  true,
);
expect(
  "New York: first Sunday of November",
  vtz("America/New_York").includes("RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU"),
  true,
);
expect(
  "London: last Sunday of March",
  vtz("Europe/London").includes("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU"),
  true,
);
expect(
  "London: last Sunday of October",
  vtz("Europe/London").includes("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU"),
  true,
);
expect(
  "London: the change is at 01:00 local",
  vtz("Europe/London").includes("T010000\nTZOFFSETFROM:+0000\nTZOFFSETTO:+0100"),
  true,
);
expect(
  "Sydney: daylight time starts in October",
  vtz("Australia/Sydney").includes(
    "TZOFFSETFROM:+1000\nTZOFFSETTO:+1100\nTZNAME:GMT+11\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU",
  ),
  true,
);
expect(
  "Tokyo: one fixed observance",
  vtz("Asia/Tokyo"),
  "BEGIN:VTIMEZONE\nTZID:Asia/Tokyo\nBEGIN:STANDARD\nDTSTART:19700101T000000\nTZOFFSETFROM:+0900\nTZOFFSETTO:+0900\nTZNAME:GMT+9\nEND:STANDARD\nEND:VTIMEZONE",
);
// Egypt changes at the end of the last Thursday of October, which is a Friday
// that no "nth weekday" rule names, so each change is listed
const cairo = vtz("Africa/Cairo");
expect("Cairo: no yearly rule", cairo.includes("RRULE"), false);
expect(
  "Cairo: 2026's start of summer time is listed",
  cairo.includes("DTSTART:20260424T000000\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0300"),
  true,
);
expect(
  "Cairo: and its end",
  cairo.includes("DTSTART:20261030T000000\nTZOFFSETFROM:+0300\nTZOFFSETTO:+0200"),
  true,
);

console.log("\nOther zones read back correctly through ical.js");
const london = occurrences(await ics("/weekly/2026-03-23/9am,lon"), 2);
expect("London, 23 March: 09:00 UTC", london[0], "2026-03-23T09:00");
expect("London, 30 March, after the change: 08:00 UTC", london[1], "2026-03-30T08:00");
const sydney = occurrences(await ics("/weekly/2026-03-30/9am,syd"), 2);
expect("Sydney, 30 March (daylight time): 22:00 UTC the day before", sydney[0], "2026-03-29T22:00");
expect("Sydney, 6 April (standard time): 23:00 UTC the day before", sydney[1], "2026-04-05T23:00");
const daily = occurrences(await ics("/daily/2026-10-24/9am,par"), 3);
expect(
  "Paris daily, across the October change",
  daily.join(" "),
  "2026-10-24T07:00 2026-10-25T08:00 2026-10-26T08:00",
);
const cairoWeekly = occurrences(await ics("/weekly/2026-04-20/9am,cai"), 2);
expect(
  "Cairo weekly, across the April change",
  cairoWeekly.join(" "),
  "2026-04-20T07:00 2026-04-27T06:00",
);
const fixed = await ics("/weekly/2026-03-02/9am,gmt+5:30");
expect("a fixed offset repeats in UTC", line(fixed, "DTSTART"), "DTSTART:20260302T033000Z");
expect("…with no VTIMEZONE", fixed.includes("VTIMEZONE"), false);
expect(
  "weekdays",
  line(await ics("/weekdays/2026-03-02/9am,nyc"), "RRULE"),
  "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
);
expect(
  "biweekly",
  line(await ics("/biweekly/2026-03-02/9am,nyc"), "RRULE"),
  "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
);
expect("monthly", line(await ics("/monthly/2026-03-02/9am,nyc"), "RRULE"), "RRULE:FREQ=MONTHLY");

console.log("\nWeb calendar links");
const links = calendarLinks(
  read("/team-sync/2026-12-03/10am-11:30am,nyc,lon"),
  "https://timezone.fyi/x",
);
const google = new URL(links.google);
expect(
  "Google: host",
  google.origin + google.pathname,
  "https://calendar.google.com/calendar/render",
);
expect(
  "Google: dates in UTC",
  google.searchParams.get("dates"),
  "20261203T150000Z/20261203T163000Z",
);
expect("Google: title", google.searchParams.get("text"), "team sync");
expect(
  "Outlook: start",
  new URL(links.outlook).searchParams.get("startdt"),
  "2026-12-03T15:00:00.000Z",
);
const repeating = calendarLinks(
  read("/standup/weekly/2026-03-02/9:30am+15m,nyc,lon"),
  "https://timezone.fyi/x",
);
const g2 = new URL(repeating.google);
expect(
  "Google, repeating: local times",
  g2.searchParams.get("dates"),
  "20260302T093000/20260302T094500",
);
expect("Google, repeating: zone", g2.searchParams.get("ctz"), "America/New_York");
expect("Google, repeating: rule", g2.searchParams.get("recur"), "RRULE:FREQ=WEEKLY;BYDAY=MO");
expect("Outlook's form has no repeat, so no link", repeating.outlook, undefined);
