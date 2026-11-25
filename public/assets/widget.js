// Pages drawn into Home Screen widgets by Quicksilver for iPhone
// (arfct/alchemy, docs/web-widgets.md). Quicksilver loads the page with the
// widget's context in the fragment, `#widget?family=…&date=…`, waits for it to
// settle, takes a picture, and takes one more for each date the page lists in
// `<meta name="widget-timeline">`, changing only the fragment between them.
// A picture can't tick, so everything here is drawn for the context's `date`
// and the timeline says when the picture next changes.
//
// Pure functions, so the tests can run them without a browser.

const MINUTE = 60000;
const HOUR = 60 * MINUTE;

// The most pictures a page asks Quicksilver for in one render: the one for
// now and 24 later ones. Quicksilver is raising its limit
// (WebWidgets.maximumEntries) from 12 to 25; until then it keeps the earliest
// eleven later dates and drops the rest, so every timeline here is written
// to stay right when it's cut short: its reload policy is `atEnd`, the last
// picture Quicksilver kept.
export const MAX_ENTRIES = 25;

// The context, read as docs/web-widgets.md shows; null without the marker, so
// a page opened normally (or with any other fragment) is never in widget mode.
export function widgetContext(hash) {
  if (!hash?.startsWith("#widget?")) return null;
  const p = new URLSearchParams(hash.slice("#widget?".length));
  const [width, height] = (p.get("displaySize") || "0x0").split("x").map(Number);
  return {
    family: p.get("family"),
    width,
    height,
    displayScale: +p.get("displayScale"),
    colorScheme: p.get("colorScheme"),
    date: new Date(p.get("date")),
    intent: p.get("intent"),
  };
}

// "2026-11-25T10:05:00Z": ISO 8601 in UTC without milliseconds, as the
// convention writes dates
export const isoUtc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

// How many zones a family shows and in how many columns. Small: two side by
// side, or the first alone when there are more. Medium: up to four side by
// side. Large: up to four side by side, five or six in two rows of three.
// The Lock Screen: a line each, three at most.
export function widgetGrid(family, count) {
  if (family === "accessoryRectangular") return { shown: Math.min(count, 3), cols: 1 };
  if (family === "systemSmall") {
    const shown = count > 2 ? 1 : count;
    return { shown, cols: shown };
  }
  if (family === "systemLarge") {
    const shown = Math.min(count, 6);
    return { shown, cols: shown <= 4 ? shown : 3 };
  }
  const shown = Math.min(count, 4);
  return { shown, cols: shown };
}

// A live clock's timeline: the next 24 minutes, each on the minute, then a
// reload. Each picture shows the minute of its entry, so the clock is right
// for as long as the timeline lasts (24 minutes; 11 where Quicksilver keeps
// 12) and stays on its last minute until Quicksilver draws it again.
export const LIVE_STEP = MINUTE;
export function liveTimeline(now) {
  const step = LIVE_STEP;
  const first = Math.floor(now / step) * step + step;
  const entries = Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => first + i * step);
  return { entries, policy: "atEnd" };
}

// The home page's timeline: on each hour for the next 24, which is when
// the hour marked on the 24 stripes moves (and, at midnight, the date).
export function hourlyTimeline(now) {
  const first = Math.floor(now / HOUR) * HOUR + HOUR;
  const entries = Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => first + i * HOUR);
  return { entries, policy: "atEnd" };
}

// Midnight before and after `ms` where the code runs: in the widget, the
// phone's own zone, as the page's relative text counts days
const midnight = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const nextMidnight = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

// The time left until `target` at `now`, in steps a timeline can follow, and
// when the text next changes. Over 48 hours: calendar days, changing at
// midnight. Over an hour: whole hours, rounded down. Within the hour: five
// minutes, rounded up, so the last five minutes read "5 min".
export function countdown(target, now, days = true) {
  const left = target - now;
  if (days && left > 48 * HOUR) {
    const n = Math.round((midnight(target) - midnight(now)) / 86400000);
    return { text: `${n} days`, next: Math.min(nextMidnight(now), target - 48 * HOUR) };
  }
  if (left > HOUR) {
    const h = Math.floor((left - 1) / HOUR);
    return { text: `${h} h`, next: target - h * HOUR };
  }
  const m = Math.ceil(left / (5 * MINUTE)) * 5;
  return { text: m === 60 ? "1 h" : `${m} min`, next: target - (m - 5) * MINUTE };
}

// The widget's line for a fixed event: "in 3 h", "in 45 min", "now",
// "now · 25 min left", "ended". Coarser than the page's "in 3 h 12 min", so a
// dozen pictures can keep it right. `next` is when it changes, or null.
export function widgetRelative(start, end, now) {
  if (now < start) {
    const c = countdown(start, now);
    return { text: `in ${c.text}`, next: c.next };
  }
  if (end !== undefined && end !== null) {
    if (now >= end) return { text: "ended", next: null };
    const c = countdown(end, now);
    return { text: `now · ${c.text} left`, next: c.next };
  }
  // With no end, "now" for a quarter of an hour
  if (now < start + 15 * MINUTE) return { text: "now", next: start + 15 * MINUTE };
  return { text: "passed", next: null };
}

// A fixed event's timeline: each moment the widget's line changes, 24 at
// most, and when to draw the page again. `rollover` is when the Worker would
// answer with another event (an undated link at the next midnight, a repeat
// once this one is over): the timeline stops there. While anything is left
// to change, the page is drawn again after the last picture (`atEnd`, which
// also holds when Quicksilver keeps fewer than were asked for), or at the
// rollover when there's no picture to wait for. Past, with nothing to roll
// over to: never.
export function fixedTimeline({ start, end, now, rollover }) {
  const entries = [];
  const rolled = (at) => rollover !== undefined && rollover !== null && rollover <= at;
  let { text, next } = widgetRelative(start, end, now);
  while (next !== null && entries.length < MAX_ENTRIES - 1 && !rolled(next)) {
    const step = widgetRelative(start, end, next);
    // A boundary where the words stay the same ("in 1 h" either side of the
    // hour) needs no picture of its own
    if (step.text !== text) entries.push(next);
    text = step.text;
    next = step.next;
  }
  const more = next !== null || (rollover !== undefined && rollover !== null);
  let policy = "never";
  if (more && entries.length) policy = "atEnd";
  else if (more) policy = `after=${isoUtc(rollover ?? next)}`;
  return { entries, policy };
}
