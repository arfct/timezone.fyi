// Builds an iCalendar VTIMEZONE for an IANA zone from the runtime's own time
// zone data, so a repeating event keeps its local time when the clocks change.
import { offsetAt, shortName, transitions } from "./tz.js";

const DAY = 86400000;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const pad = (n, width = 2) => String(n).padStart(width, "0");

// Minutes east of UTC → "+0530", "-0800"
export function icsOffset(minutes) {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

// A wall-clock time given as UTC milliseconds → "20261101T020000"
export function icsLocal(wallMs) {
  const d = new Date(wallMs);
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

// One change of offset, described the way a yearly rule would state it
function describe(zone, t) {
  const wall = new Date(t.at + t.before * 60000); // the clock time just as it changes
  const day = wall.getUTCDate();
  const monthLength = new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return {
    ...t,
    kind: t.after > t.before ? "DAYLIGHT" : "STANDARD",
    name: shortName(zone, t.at),
    wall: wall.getTime(),
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    weekday: wall.getUTCDay(),
    nth: Math.ceil(day / 7),
    last: day + 7 > monthLength,
    clock: wall.getUTCHours() * 60 + wall.getUTCMinutes(),
  };
}

// The yearly rule a list of same-kind changes follows ("2SU" in month 3), or
// null when they don't follow one.
function yearlyRule(changes) {
  const [first] = changes;
  const same = (key) => changes.every((c) => c[key] === first[key]);
  const years = new Set(changes.map((c) => c.year));
  if (years.size !== changes.length || !same("month") || !same("weekday") || !same("clock"))
    return null;
  if (!same("before") || !same("after")) return null;
  const everyLast = changes.every((c) => c.last);
  let ordinal;
  if (everyLast && (!same("nth") || first.nth >= 4)) ordinal = -1;
  else if (same("nth")) ordinal = first.nth;
  else return null;
  return `FREQ=YEARLY;BYMONTH=${first.month};BYDAY=${ordinal}${BYDAY[first.weekday]}`;
}

function observance(kind, dtstart, from, to, name, rrule) {
  return [
    `BEGIN:${kind}`,
    `DTSTART:${dtstart}`,
    `TZOFFSETFROM:${icsOffset(from)}`,
    `TZOFFSETTO:${icsOffset(to)}`,
    `TZNAME:${name}`,
    ...(rrule ? [`RRULE:${rrule}`] : []),
    `END:${kind}`,
  ];
}

// in: an IANA zone and the instant of the event's first start
// out: the VTIMEZONE's content lines.
// Looks at the changes from the start of the year before the event to five
// years after. Where each year repeats the same rule (most zones) the block
// carries that rule with no end. Otherwise it lists each change in that span.
export function buildVtimezone(zone, startMs) {
  const year = new Date(startMs).getUTCFullYear();
  const from = Date.UTC(year - 1, 0, 1);
  const changes = transitions(zone, from, Date.UTC(year + 5, 0, 1), 7 * DAY).map((t) =>
    describe(zone, t),
  );
  const lines = ["BEGIN:VTIMEZONE", `TZID:${zone}`];

  if (!changes.length) {
    const offset = offsetAt(zone, startMs);
    lines.push(
      ...observance("STANDARD", "19700101T000000", offset, offset, shortName(zone, startMs)),
    );
  } else {
    const kinds = ["DAYLIGHT", "STANDARD"].map((kind) => changes.filter((c) => c.kind === kind));
    const rules = kinds.map((list) => (list.length >= 5 ? yearlyRule(list) : null));
    if (rules.every(Boolean)) {
      kinds.forEach((list, i) => {
        const c = list[0];
        lines.push(...observance(c.kind, icsLocal(c.wall), c.before, c.after, c.name, rules[i]));
      });
    } else {
      // The offset in force before the first listed change
      const c0 = changes[0];
      lines.push(
        ...observance("STANDARD", "19700101T000000", c0.before, c0.before, shortName(zone, from)),
      );
      for (const c of changes)
        lines.push(...observance(c.kind, icsLocal(c.wall), c.before, c.after, c.name));
    }
  }
  lines.push("END:VTIMEZONE");
  return lines;
}
