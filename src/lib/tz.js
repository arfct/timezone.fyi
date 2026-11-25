// Time zone arithmetic on the runtime's own time zone data (Intl), with no
// bundled database. A zone is either an IANA name ("America/New_York") or a
// fixed UTC offset in minutes (a number).

const MINUTE = 60000;
const DAY = 86400000;

const formatters = new Map();

function formatter(zone) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(zone, f);
  }
  return f;
}

// The IANA spelling of a zone name ("america/new_york" → "America/New_York"),
// or null when the runtime doesn't know the zone. A current name the runtime
// files under an older one keeps the current name: "Asia/Kolkata" stays, where
// resolvedOptions() alone would answer "Asia/Calcutta".
export function canonicalZone(name) {
  let resolved;
  try {
    resolved = new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  if (resolved.toLowerCase() === name.toLowerCase() || !name.includes("/")) return resolved;
  if (/[A-Z]/.test(name)) return name;
  return name.replace(/(^|[/_-])([a-z])/g, (_, lead, letter) => lead + letter.toUpperCase());
}

// Wall-clock fields of the instant `ms` in `zone`, as if they were UTC
function wallMs(zone, ms) {
  if (typeof zone === "number") return ms + zone * MINUTE;
  const p = {};
  for (const part of formatter(zone).formatToParts(ms)) p[part.type] = part.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

// UTC offset of `zone` at the instant `ms`, in minutes east of UTC
export function offsetAt(zone, ms) {
  if (typeof zone === "number") return zone;
  return Math.round((wallMs(zone, ms) - Math.floor(ms / 1000) * 1000) / MINUTE);
}

// The calendar date and clock time of the instant `ms` in `zone`.
// weekday: 0 is Sunday. minutes: minutes after midnight.
export function wallAt(zone, ms) {
  const d = new Date(wallMs(zone, ms));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

// The instant when a clock in `zone` shows `minutes` after midnight on the
// given date. `minutes` may pass 1440 to reach later days.
// - A time the clocks skip (spring forward) moves later by the skipped amount;
//   `moved` is then true.
// - A time the clocks show twice (fall back) is the first of the two.
export function instantOf(zone, year, month, day, minutes = 0) {
  const local = Date.UTC(year, month - 1, day, 0, minutes);
  if (typeof zone === "number") return { ms: local - zone * MINUTE, moved: false };
  const before = offsetAt(zone, local - DAY);
  const after = offsetAt(zone, local + DAY);
  const candidates = [...new Set([before, after])]
    .map((offset) => ({ ms: local - offset * MINUTE, offset }))
    .filter((c) => offsetAt(zone, c.ms) === c.offset)
    .sort((a, b) => a.ms - b.ms);
  if (candidates.length) return { ms: candidates[0].ms, moved: false };
  return { ms: local - before * MINUTE, moved: true };
}

// Whole days since 1970-01-01 for a calendar date, and back
export const dayNumber = (year, month, day) => Date.UTC(year, month - 1, day) / DAY;
export function dateOfDayNumber(n) {
  const d = new Date(n * DAY);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

// Every change of UTC offset in `zone` from `fromMs` up to `toMs`, oldest first:
// [{ at, before, after }] with the offsets in minutes. `step` is how far apart
// it samples; two changes closer together than that are missed.
export function transitions(zone, fromMs, toMs, step = DAY) {
  if (typeof zone === "number") return [];
  const found = [];
  let t = fromMs;
  let offset = offsetAt(zone, t);
  while (t < toMs) {
    const next = Math.min(t + step, toMs);
    const nextOffset = offsetAt(zone, next);
    if (nextOffset !== offset) {
      // Narrow to the minute the offset changes
      let lo = t;
      let hi = next;
      while (hi - lo > MINUTE) {
        const mid = lo + Math.floor((hi - lo) / 2 / MINUTE) * MINUTE;
        if (offsetAt(zone, mid) === offset) lo = mid;
        else hi = mid;
      }
      found.push({ at: hi, before: offset, after: nextOffset });
      offset = nextOffset;
    }
    t = next;
  }
  return found;
}

const nameFormatters = new Map();

// The zone's short name at the instant `ms`: "PST", "BST", or "GMT+9" where
// the runtime's English data has no abbreviation.
export function shortName(zone, ms) {
  if (typeof zone === "number") return formatOffset(zone);
  let f = nameFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" });
    nameFormatters.set(zone, f);
  }
  return f.formatToParts(ms).find((p) => p.type === "timeZoneName")?.value ?? zone;
}

// "UTC", "UTC−8", "UTC+5:30"
export function formatOffset(minutes) {
  if (!minutes) return "UTC";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${minutes < 0 ? "−" : "+"}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}
