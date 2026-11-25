// Reads a URL path into its parts, without resolving zones or dates:
//
//   /[label/][recurrence/][date/]time[-time | +duration],zone[,zone…][/event.ics | /card.png]
//
// Everything the original grammar accepted still reads the same way; see
// docs/plans/2026-11-25-worker-refactor.md for the one exception (a label that
// is exactly a date or recurrence word).
import { decodePrettyComponent, parseTime } from "./parse-time.js";

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const WEEKDAY_RE = /^(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(day|sday|nesday|urday)?$/;

const RECURRENCES = {
  daily: "daily",
  weekdays: "weekdays",
  weekly: "weekly",
  biweekly: "biweekly",
  fortnightly: "biweekly",
  monthly: "monthly",
  yearly: "yearly",
  annually: "yearly",
};

const SUFFIXES = { "/event.ics": "ics", "/card.png": "png", "/card.svg": "svg" };

// A month name or its first three letters or more ("dec", "sept") → 1–12
function readMonth(word) {
  if (word.length < 3) return 0;
  return MONTH_NAMES.findIndex((name) => name.startsWith(word)) + 1;
}

// A weekday name or abbreviation → 0 (Sunday) – 6, or -1
function readWeekday(word) {
  if (!WEEKDAY_RE.test(word)) return -1;
  const index = WEEKDAY_NAMES.findIndex((name) => name.startsWith(word.slice(0, 3)));
  return WEEKDAY_NAMES[index].startsWith(word) || /^(tues|weds|thur|thurs)$/.test(word)
    ? index
    : -1;
}

// in: one path segment
// out: null when it isn't a date, else one of
//   { year, month, day }          2026-12-03, dec3-2026
//   { month, day }                dec3, 3dec, dec-3: the next such date
//   { weekday }                   fri, friday: the next such day, today included
//   { days }                      today (0), tomorrow (1)
export function readDate(segment) {
  const s = segment.toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  if (s === "today") return { days: 0 };
  if (s === "tomorrow") return { days: 1 };
  const weekday = readWeekday(s);
  if (weekday >= 0) return { weekday };
  m =
    s.match(/^([a-z]{3,9})-?(\d{1,2})(?:-(\d{4}))?$/) ||
    s.match(/^(\d{1,2})-?([a-z]{3,9})(?:-(\d{4}))?$/);
  if (m) {
    const monthFirst = /[a-z]/.test(m[1]);
    const month = readMonth(monthFirst ? m[1] : m[2]);
    const day = +(monthFirst ? m[2] : m[1]);
    if (month && day >= 1 && day <= 31) return m[3] ? { year: +m[3], month, day } : { month, day };
  }
  return null;
}

// in: one path segment
// out: null, or { recur, weekday? }. "every-mon" is weekly on the next Monday.
export function readRecurrence(segment) {
  const s = segment.toLowerCase();
  if (RECURRENCES[s]) return { recur: RECURRENCES[s] };
  const every = s.match(/^every-(.+)$/);
  if (!every) return null;
  if (every[1] === "day") return { recur: "daily" };
  if (every[1] === "weekday") return { recur: "weekdays" };
  if (every[1] === "week") return { recur: "weekly" };
  if (every[1] === "month") return { recur: "monthly" };
  if (every[1] === "year") return { recur: "yearly" };
  const weekday = readWeekday(every[1]);
  return weekday >= 0 ? { recur: "weekly", weekday } : null;
}

// "+45m", "+1h", "+1h30m", "+1h30", "+90" at the end of the time → minutes
const DURATION_RE = /\+(?:(\d{1,2})h)?(?:(\d{1,3})m?)?$/i;

// in: a URL pathname, still percent-encoded
// out: one of
//   { kind: "home" }
//   { kind: "error", message }
//   { kind: "event" | "live", suffix, labelSegment, label, recur, date,
//     timeSegment, time, duration, h24, zones }
// zones are the codes as typed. suffix is "ics", "png", "svg" or undefined.
export function parsePath(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return {
      kind: "error",
      message: 'The address has a stray "%". Remove it, or write %25 for a percent sign.',
    };
  }
  path = path.replace(/^\/+/, "");

  let suffix;
  for (const [ending, kind] of Object.entries(SUFFIXES)) {
    if (`/${path}`.endsWith(ending)) {
      suffix = kind;
      path = path.slice(0, -ending.length).replace(/\/$/, "");
      break;
    }
  }
  if (!path) return { kind: "home", suffix };

  const pieces = path.split(/[,.]/);
  const segments = pieces[0].split("/");
  let timeSegment = segments.pop();

  // "10.30am,pst": the dot is part of the time, not a separator
  while (/(^|-)\d{1,2}$/.test(timeSegment) && /^\d\d([ap]m?)?(-\d|\+|$)/i.test(pieces[1] ?? "")) {
    timeSegment = `${timeSegment}:${pieces.splice(1, 1)[0]}`;
  }

  const zones = pieces
    .slice(1)
    .map((zone) => zone.trim().replace(/ /g, "+"))
    .filter(Boolean);

  const nowMatch = timeSegment.match(/^now(24)?$/i);
  const isTime = /^\d/.test(timeSegment);

  if (!nowMatch && !isTime) {
    // No time: every piece is a zone, and the page is a live clock
    // ("/pst,est", "/Europe/London").
    const all = path.split(/[,.]/).map((zone) => zone.trim().replace(/ /g, "+"));
    return { kind: "live", suffix, zones: all.filter(Boolean), h24: false, zoneOnly: true };
  }
  if (!zones.length) {
    return {
      kind: "error",
      message: `Add a time zone after the time: /${path},nyc`,
    };
  }

  // Segments before the time, read right to left: a date, then a recurrence,
  // then the label.
  const model = { suffix, zones };
  let segment = segments.pop();
  const date = segment !== undefined ? readDate(segment) : null;
  if (date) {
    model.date = date;
    segment = segments.pop();
  }
  const recurrence = segment !== undefined ? readRecurrence(segment) : null;
  if (recurrence) {
    model.recur = recurrence.recur;
    if (recurrence.weekday !== undefined && !model.date)
      model.date = { weekday: recurrence.weekday };
    segment = segments.pop();
  }
  if (segment) {
    model.labelSegment = segment;
    model.label = decodePrettyComponent(segment);
  }

  if (nowMatch) {
    // A live clock has no date to pin and nothing to repeat
    return {
      kind: "live",
      suffix,
      zones,
      label: model.label,
      labelSegment: model.labelSegment,
      h24: !!nowMatch[1],
    };
  }

  model.kind = "event";
  model.timeSegment = timeSegment;
  let timeText = timeSegment;
  const duration = timeText.match(DURATION_RE);
  if (duration && (duration[1] || duration[2])) {
    model.duration = +(duration[1] ?? 0) * 60 + +(duration[2] ?? 0);
    timeText = timeText.slice(0, duration.index);
  }
  const time = parseTime(timeText);
  if (!time)
    return {
      kind: "error",
      message: `"${timeSegment}" isn't a time. Try 10am, 14:00 or 9-5.`,
    };
  if (time.end !== undefined || !model.duration) delete model.duration;
  model.time = time;
  model.h24 = time.h24;
  return model;
}
