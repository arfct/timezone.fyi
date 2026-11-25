// Turns a parsed path into an event: zones resolved, dates pinned, the start
// and end as instants, and the text each zone shows.
import { clockText, dateText, MONTHS, offsetText, WEEKDAYS } from "../../public/assets/shared.js";
import { dayOffset, formatDayOffset } from "./day-offset.js";
import { placeTimes } from "./parse-time.js";
import { canonicalZone, dateOfDayNumber, dayNumber, offsetAt, wallAt } from "./tz.js";
import { resolveCodes } from "./zone-lookup.js";

const OFFSET_RE = /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/i;

// in: zone codes as typed
// out: [{ code, name, zone }] or { error }. zone is an IANA name or a fixed
//      offset in minutes; name is what the page shows ("NYC", "NEW YORK").
export function resolveZones(codes) {
  const values = resolveCodes(codes);
  const zones = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const value = values[i];
    const name = code.split("/").pop().replace(/_/g, " ").toUpperCase();
    if (typeof value === "number") {
      zones.push({ code, name, zone: value * 60 });
      continue;
    }
    const offset = value.match(OFFSET_RE);
    if (offset) {
      const minutes = +offset[2] * 60 + +(offset[3] ?? 0);
      if (minutes > 14 * 60)
        return { error: `"${code}" is not a UTC offset. The largest is 14 hours.` };
      zones.push({ code, name, zone: offset[1] === "-" ? -minutes : minutes });
      continue;
    }
    const zone = canonicalZone(value);
    if (!zone) return { error: `"${code}" is not a known zone, city or airport code.` };
    zones.push({ code, name, zone });
  }
  return zones;
}

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const validDate = ({ year, month, day }) =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

// The first date of a repeating event on or after day number `from`.
// `anchor` is the day number of its first date.
export function occurrenceOnOrAfter(recur, anchor, from) {
  const start = Math.max(anchor, from);
  if (recur === "daily") return start;
  if (recur === "weekly") return anchor + Math.ceil((start - anchor) / 7) * 7;
  if (recur === "biweekly") return anchor + Math.ceil((start - anchor) / 14) * 14;
  if (recur === "weekdays") {
    let d = start;
    while ([0, 6].includes(dateOfDayNumber(d).weekday)) d++;
    return d;
  }
  // monthly and yearly keep the anchor's day of the month, and skip months
  // that don't have it (RFC 5545 does the same)
  const first = dateOfDayNumber(anchor);
  const step = recur === "yearly" ? 12 : 1;
  const target = dateOfDayNumber(start);
  let months = Math.max(0, (target.year - first.year) * 12 + (target.month - first.month) - 1);
  months -= months % step;
  for (let i = 0; i < 12 * 8 + 1; i++, months += step) {
    const year = first.year + Math.floor((first.month - 1 + months) / 12);
    const month = ((first.month - 1 + months) % 12) + 1;
    if (first.day > daysInMonth(year, month)) continue;
    const candidate = dayNumber(year, month, first.day);
    if (candidate >= start) return candidate;
  }
  return anchor;
}

const ORDINALS = ["th", "st", "nd", "rd"];
const ordinal = (n) => n + (ORDINALS[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

// "Every Thursday", "Every weekday", "Monthly on the 3rd"
export function recurrenceText(recur, date) {
  const weekday = WEEKDAYS[date.weekday];
  return {
    daily: "Every day",
    weekdays: "Every weekday",
    weekly: `Every ${weekday}`,
    biweekly: `Every other ${weekday}`,
    monthly: `Monthly on the ${ordinal(date.day)}`,
    yearly: `Every year on ${date.day} ${MONTHS[date.month - 1]}`,
  }[recur];
}

const isoDate = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// The path that names this event with its date written out. Keeps the label,
// time and zones as typed.
function canonicalPath(model, date) {
  const parts = [];
  if (model.labelSegment) parts.push(model.labelSegment);
  if (model.recur) parts.push(model.recur);
  if (date) parts.push(isoDate(date));
  const time =
    model.kind === "live"
      ? model.zoneOnly
        ? null
        : model.h24
          ? "now24"
          : "now"
      : model.timeSegment;
  const tail = [...(time ? [time] : []), ...model.zones].join(",");
  return `/${encodeURI([...parts, tail].join("/")).replace(/[?#]/g, encodeURIComponent)}`;
}

// in: a model from parsePath (kind "event" or "live"), the current instant,
//     and for images of undated links the date or minute to draw:
//     options.date { year, month, day }, options.at (ms)
// out: { error } | { redirect: path } | the event
export function resolveEvent(model, now, options = {}) {
  const zones = resolveZones(model.zones);
  if (zones.error) return zones;
  if (!zones.length) return { error: "Add a zone." };
  const first = zones[0].zone;
  const today = wallAt(first, now);
  const todayNumber = dayNumber(today.year, today.month, today.day);

  const event = {
    kind: model.kind,
    live: model.kind === "live",
    label: model.label,
    recur: model.recur,
    h24: !!model.h24,
    zoneOnly: !!model.zoneOnly,
  };

  if (event.live) {
    event.start = options.at ?? Math.floor(now / 60000) * 60000;
    event.path = canonicalPath(model);
  } else {
    // Pin the date. A relative date ("fri", "dec3", "tomorrow") or a repeat
    // without a first date redirects to the same link with the date written
    // out, so the link means the same day whenever it's opened.
    const d = model.date;
    let pinned;
    let relative = false;
    if (d?.year) pinned = d;
    else if (d || model.recur) {
      relative = true;
      let n = todayNumber;
      if (d?.days) n += d.days;
      else if (d?.weekday !== undefined) n += (d.weekday - today.weekday + 7) % 7;
      else if (d?.month) {
        let year = today.year;
        if (!validDate({ year, ...d }) || dayNumber(year, d.month, d.day) < todayNumber) year++;
        if (!validDate({ year, ...d })) year += 4 - (year % 4); // 29 February
        n = dayNumber(year, d.month, d.day);
      } else if (model.recur === "weekdays") n = occurrenceOnOrAfter("weekdays", n, n);
      pinned = dateOfDayNumber(n);
    }
    if (pinned && !validDate(pinned)) return { error: `${isoDate(pinned)} is not a date.` };
    if (relative) return { redirect: canonicalPath(model, pinned) };

    event.floating = !pinned;
    event.path = canonicalPath(model, pinned);

    let date = pinned ?? options.date ?? today;
    if (!validDate(date)) return { error: "The d parameter is not a date." };
    if (pinned)
      event.anchor = {
        ...pinned,
        weekday: dateOfDayNumber(dayNumber(pinned.year, pinned.month, pinned.day)).weekday,
      };

    const place = (on) => {
      const placed = placeTimes(model.time, first, on);
      if (placed.end === undefined && model.duration)
        placed.end = placed.start + model.duration * 60000;
      return placed;
    };
    let placed = place(date);
    if (model.recur) {
      // Show the occurrence asked for, or the next one that hasn't finished
      const anchor = dayNumber(pinned.year, pinned.month, pinned.day);
      event.anchorStart = placed.start;
      event.anchorEnd = placed.end;
      let from = options.date
        ? dayNumber(options.date.year, options.date.month, options.date.day)
        : todayNumber - 1;
      for (let i = 0; i < 4; i++) {
        const n = occurrenceOnOrAfter(model.recur, anchor, from);
        date = dateOfDayNumber(n);
        placed = place(date);
        if (options.date || (placed.end ?? placed.start) >= now) break;
        from = n + 1;
      }
    }
    event.start = placed.start;
    event.end = placed.end;
    event.duration =
      placed.end === undefined ? undefined : Math.round((placed.end - placed.start) / 60000);
  }

  const startWall = wallAt(first, event.start);
  event.date = startWall;
  event.dateIso = isoDate(startWall);
  if (event.recur) event.recurText = recurrenceText(event.recur, event.anchor);

  event.zones = zones.map(({ code, name, zone }) => {
    const wall = wallAt(zone, event.start);
    const offset = offsetAt(zone, event.start);
    const row = {
      code,
      name,
      zone,
      offset,
      offsetText: offsetText(offset),
      // "New York" under "NYC"; nothing when it would repeat the name
      place: typeof zone === "string" ? zone.split("/").pop().replace(/_/g, " ") : "",
      wall,
      minutes: wall.minutes,
      dayOffset: dayOffset(startWall, wall),
      startText: clockText(wall.minutes, event.h24),
      zoneOffsetAt: (ms) => offsetAt(zone, ms),
    };
    if (row.place.toUpperCase() === name) row.place = "";
    if (event.end !== undefined) {
      row.endWall = wallAt(zone, event.end);
      row.endMinutes = row.endWall.minutes;
      row.endDayOffset = dayOffset(startWall, row.endWall);
      row.endText = clockText(row.endMinutes, event.h24);
    }
    // "10:30am NYC", "12am TOK +1", "10pm–1am +1 NYC"
    const mark = (n) => (n ? ` ${formatDayOffset(n)}` : "");
    if (row.endText === undefined || row.dayOffset === row.endDayOffset) {
      const times = row.endText === undefined ? row.startText : `${row.startText}–${row.endText}`;
      row.text = `${times} ${name}${mark(row.dayOffset)}`;
    } else {
      row.text = `${row.startText}${mark(row.dayOffset)}–${row.endText}${mark(row.endDayOffset)} ${name}`;
    }
    return row;
  });

  event.timesText = event.zones.map((z) => z.text).join(" · ");
  // The date line: the day in the first zone, and how it repeats
  event.dateText = event.live
    ? ""
    : event.recur
      ? `${event.recurText} · next ${dateText(startWall)}`
      : dateText(startWall, true);
  return event;
}
