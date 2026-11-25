/**
 * Tests for the pages as Quicksilver web widgets (public/assets/widget.js):
 * reading the widget context from the fragment, the layouts' grid, the
 * timelines for live clocks and fixed events, and that nothing changes for a
 * page opened without the fragment.
 *
 * Run with: npm test
 */

import { readFileSync } from "node:fs";
import {
  countdown,
  fixedTimeline,
  hourlyTimeline,
  isoUtc,
  liveTimeline,
  MAX_ENTRIES,
  widgetContext,
  widgetGrid,
  widgetRelative,
} from "../public/assets/widget.js";
import { resolveEvent } from "../src/lib/event.js";
import { parsePath } from "../src/lib/parse-path.js";
import { eventPage, homePage } from "../src/render/page.js";
import { expect, section } from "./harness.js";

const MINUTE = 60000;
const HOUR = 60 * MINUTE;

section("The widget context, as docs/web-widgets.md reads it");
const c = widgetContext(
  "#widget?family=systemMedium&displaySize=338x158&displayScale=3&colorScheme=dark&date=2026-11-14T09:00:00Z",
);
expect("family", c.family, "systemMedium");
expect("width", c.width, 338);
expect("height", c.height, 158);
expect("displayScale", c.displayScale, 3);
expect("colorScheme", c.colorScheme, "dark");
expect("date", c.date.getTime(), Date.UTC(2026, 10, 14, 9));
expect("no intent", c.intent, null);
expect(
  "an intent",
  widgetContext(
    "#widget?family=systemSmall&displaySize=158x158&date=2026-11-14T09:00:00Z&intent=refresh",
  ).intent,
  "refresh",
);
expect(
  "Quicksilver's percent-encoded colons",
  widgetContext("#widget?family=systemSmall&date=2026-11-14T09%3A30%3A00Z").date.getTime(),
  Date.UTC(2026, 10, 14, 9, 30),
);
expect("a fractional scale", widgetContext("#widget?displayScale=2.5").displayScale, 2.5);
expect("no displaySize reads 0x0", widgetContext("#widget?family=systemSmall").width, 0);

section("Without the marker the page is not a widget");
for (const hash of [
  "",
  "#",
  "#widget",
  "#widgets?family=systemSmall",
  "#top",
  "#?widget",
  undefined,
])
  expect(`${JSON.stringify(hash)} is null`, widgetContext(hash), null);

section("Zones each family shows, and in how many columns");
const grid = (f, n) => {
  const g = widgetGrid(f, n);
  return `${g.shown}/${g.cols}`;
};
expect("small, one zone", grid("systemSmall", 1), "1/1");
expect("small, two side by side", grid("systemSmall", 2), "2/2");
expect("small, three: the first alone", grid("systemSmall", 3), "1/1");
expect("medium, three", grid("systemMedium", 3), "3/3");
expect("medium, up to four", grid("systemMedium", 7), "4/4");
expect("large, four side by side", grid("systemLarge", 4), "4/4");
expect("large, five in threes", grid("systemLarge", 5), "5/3");
expect("large, up to six", grid("systemLarge", 9), "6/3");
expect("Lock Screen, a line each, three at most", grid("accessoryRectangular", 5), "3/1");
expect("an unknown family reads as medium", grid(null, 5), "4/4");

section("Live clock timeline");
expect("25 pictures in all", MAX_ENTRIES, 25);
const now = Date.UTC(2026, 10, 25, 9, 7, 23);
const live = liveTimeline(now);
expect("24 later entries", live.entries.length, 24);
expect("the first is the next five minutes", isoUtc(live.entries[0]), "2026-11-25T09:10:00Z");
expect("the last is two hours on", isoUtc(live.entries.at(-1)), "2026-11-25T11:05:00Z");
expect(
  "every five minutes",
  live.entries.every((t, i) => i === 0 || t - live.entries[i - 1] === 5 * MINUTE),
  true,
);
expect("reloads after the last", live.policy, "atEnd");
expect(
  "on a five-minute mark, the next one",
  isoUtc(liveTimeline(Date.UTC(2026, 10, 25, 9, 10)).entries[0]),
  "2026-11-25T09:15:00Z",
);
const hourly = hourlyTimeline(now);
expect("home: 24 later entries", hourly.entries.length, 24);
expect("home: on the next hour", isoUtc(hourly.entries[0]), "2026-11-25T10:00:00Z");
expect("home: reloads after the last", hourly.policy, "atEnd");

section("The widget's line for a fixed event");
const start = Date.UTC(2026, 11, 3, 15, 30);
const end = start + 30 * MINUTE;
const rel = (at, e = end) => widgetRelative(start, e, at).text;
expect("3 h 12 min: whole hours, down", rel(start - (3 * HOUR + 12 * MINUTE)), "in 3 h");
expect("exactly 3 h", rel(start - 3 * HOUR), "in 2 h");
expect("1 h 30 min", rel(start - 90 * MINUTE), "in 1 h");
expect("exactly 1 h", rel(start - HOUR), "in 1 h");
expect("58 min", rel(start - 58 * MINUTE), "in 1 h");
expect("44 min: five minutes, up", rel(start - 44 * MINUTE), "in 45 min");
expect("40 min", rel(start - 40 * MINUTE), "in 40 min");
expect("1 min", rel(start - MINUTE), "in 5 min");
expect("at the start", rel(start), "now · 30 min left");
expect("12 min in", rel(start + 12 * MINUTE), "now · 20 min left");
expect("at the end", rel(end), "ended");
const open = (at) => widgetRelative(start, undefined, at).text;
expect("no end: now for a quarter of an hour", open(start + 10 * MINUTE), "now");
expect("no end, later", open(start + 20 * MINUTE), "passed");
expect("47 h 30 min", rel(start - 47.5 * HOUR), "in 47 h");
expect(
  "over 48 h: calendar days",
  /^in \d+ days$/.test(rel(start - 8 * 24 * HOUR - 5 * HOUR)),
  true,
);
expect(
  "the days change at midnight",
  new Date(countdown(start, start - 8 * 24 * HOUR).next).getHours(),
  0,
);

section("Fixed event timeline");
const soon = fixedTimeline({ start, end, now: start - 38 * MINUTE });
expect(
  "each change, in five-minute steps to the end",
  soon.entries.map((t) => (t - start) / MINUTE).join(","),
  "-35,-30,-25,-20,-15,-10,-5,0,5,10,15,20,25,30",
);
expect("over: never drawn again", soon.policy, "never");
const changes = (tl, e) =>
  tl.entries.every(
    (t) => widgetRelative(start, e, t).text !== widgetRelative(start, e, t - 1000).text,
  );
expect("the line changes at every entry", changes(soon, end), true);
const far = fixedTimeline({ start, end, now: start - 3 * 24 * HOUR });
expect("three days off: 24 entries", far.entries.length, MAX_ENTRIES - 1);
expect("three days off: the line changes at every entry", changes(far, end), true);
expect("more to come: drawn again after the last", far.policy, "atEnd");
const day = fixedTimeline({ start, end, now: start - 10 * HOUR });
expect(
  'ten hours off: hourly, then every five minutes ("in 1 h" either side of the hour is one picture)',
  day.entries
    .slice(0, 10)
    .map((t) => (start - t) / HOUR)
    .join(","),
  "9,8,7,6,5,4,3,2,0.9166666666666666,0.8333333333333334",
);
const past = fixedTimeline({ start, end, now: end + HOUR });
expect("past: no entries", past.entries.length, 0);
expect("past: never", past.policy, "never");
const noEnd = fixedTimeline({ start, end: undefined, now: start - 2 * MINUTE });
expect(
  "no end: now, then passed",
  noEnd.entries.map((t) => (t - start) / MINUTE).join(","),
  "0,15",
);
const repeat = fixedTimeline({ start, end, now: start - 20 * MINUTE, rollover: end + MINUTE });
expect("a repeat: up to the end", isoUtc(repeat.entries.at(-1)), isoUtc(end));
expect("a repeat: drawn again after the last picture", repeat.policy, "atEnd");
const rolled = fixedTimeline({ start, end, now: end + 10 * MINUTE, rollover: end + 30 * MINUTE });
expect("over, but the next one is coming: no entries", rolled.entries.length, 0);
expect("drawn again at the rollover", rolled.policy, `after=${isoUtc(end + 30 * MINUTE)}`);
const floating = fixedTimeline({
  start,
  end,
  now: start - 3 * HOUR,
  rollover: start + 20 * MINUTE,
});
expect(
  "stops before the rollover",
  floating.entries.every((t) => t < start + 20 * MINUTE),
  true,
);
expect("no entry far off is ever before now", far.entries[0] > start - 3 * 24 * HOUR, true);

section("A page opened normally is unchanged");
const NOW = Date.UTC(2026, 10, 25, 15, 0);
const ORIGIN = "https://timezone.fyi";
const page = (path) => {
  const event = resolveEvent(parsePath(path), NOW);
  return eventPage(event, ORIGIN, `${ORIGIN}${event.path}/card.png`);
};
const html = page("/team-sync/2026-12-03/10:30am,nyc,lon,tok");
expect("no widget meta from the Worker", /name="widget-/.test(html), false);
expect("no widget classes from the Worker", /class="[^"]*\bw-/.test(html), false);
expect("home: no widget meta", /name="widget-/.test(homePage(ORIGIN)), false);
const data = (h) =>
  JSON.parse(h.match(/<script type="application\/json" id="event">(.*?)<\/script>/)[1]);
expect("a dated event isn't floating", data(html).floating, false);
expect("an undated event is floating", data(page("/10am,nyc,lon")).floating, true);
expect("a repeat says so", data(page("/standup/weekly/2026-03-02/9:30am+15m,nyc")).recur, "weekly");

// Every rule for widgets is scoped to html.widget or a family class, which
// only app.js sets, and only with the fragment (or hides .wcap, which only
// app.js adds in a widget)
const css = readFileSync(new URL("../public/assets/app.css", import.meta.url), "utf8");
const widgetCss = css.slice(css.indexOf("/* Widgets."));
const selectors = widgetCss
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .match(/[^{}]+(?=\{)/g)
  .flatMap((s) => s.split(","))
  .map((s) => s.trim())
  .filter(Boolean);
expect("the widget rules are found", selectors.length > 40, true);
const unscoped = selectors.filter((s) => !/^html\.(widget|w-)/.test(s) && s !== ".wcap");
expect("every widget rule is scoped", unscoped.join(" | "), "");
const app = readFileSync(new URL("../public/assets/app.js", import.meta.url), "utf8");
expect(
  "app.js adds the classes only in widget mode",
  /if \(widget\) \{\s*widgetClasses\(\);/.test(app),
  true,
);
