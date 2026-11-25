// Reads the time or time range in a URL ("10pm-1am", "standup/9:30-10") as
// minutes after midnight, and places them on a date in a zone.
import { instantOf } from "./tz.js";

// An optional "label/", then a time and an optional end time. Each time is
// 1–4 digits ("9", "930", "1030"), optional ":30" or "h30" minutes (or a bare
// colon, "10:pm"), and an optional am/pm, or "h" for 24-hour time ("10h").
// Handle difference in params[0] on local vs server (firebase) looking at leading slash
const TIME_RE =
  /\/?(?<label>[^/]+\/)?(?<t1>\d{1,4})(?:(?<s1>[:h])(?<m1>\d\d)|:)?(?<p1>[aph])?m?-?(?:(?<t2>\d{1,4})(?:(?<s2>[:h])(?<m2>\d\d)|:)?(?<p2>[aph])?m?)?/i;

const HALF_DAY = 12 * 60;
const DAY = 24 * 60;

// "team-standup" → "team standup": a hyphen is a space, "--" a hyphen and
// "---" a spaced hyphen. The URL has already been percent-decoded.
export function decodePrettyComponent(s) {
  const replacements = { "---": " - ", "--": "-", "-": " " };
  return s.replace(/-+/g, (e) => replacements[e] ?? "-");
}

// One time from the match. It's on a 12-hour clock unless it's written as 0,
// with a leading zero, as 13 or more, or with "h".
function readTime(digits, separator, minutes, suffix) {
  const short = digits.length <= 2;
  const hourText = short ? digits : digits.slice(0, -2);
  const hour = parseInt(hourText, 10);
  const minute = minutes ? parseInt(minutes, 10) : short ? 0 : parseInt(digits.slice(-2), 10);
  const meridiem = suffix?.toLowerCase();
  const twelveHour =
    meridiem !== "h" && separator?.toLowerCase() !== "h" && hourText[0] !== "0" && hour <= 12;
  return { hour, minute, meridiem, twelveHour };
}

const hasAmPm = (time) => time.meridiem === "a" || time.meridiem === "p";

// Minutes after midnight; with am/pm, 12am is midnight and 12pm is noon
function clockMinutes({ hour, minute, meridiem }) {
  if (meridiem === "a" && hour === 12) hour = 0;
  if (meridiem === "p" && hour < 12) hour += 12;
  return hour * 60 + minute;
}

// The first time after `after` (in minutes) that a clock showing `minutes`
// reaches, checking every `step` minutes
function firstAfter(minutes, after, step) {
  while (minutes <= after) minutes += step;
  return minutes;
}

// in: the time part of a URL (not "now"), percent-decoded
// out: { label, start, end, h24 }, or null when there's no time.
//      start and end are minutes after midnight of the start's day. end is
//      undefined for a single time and passes 1440 when it falls on the next
//      day (it's at or before the start). h24 is true when the time is written
//      in 24-hour form (#27): 0, a leading zero, 13–23 or "h", and no am/pm.
export function parseTime(timeString) {
  const match = timeString.match(TIME_RE);
  if (!match) return null;
  const { label, t1, s1, m1, p1, t2, s2, m2, p2 } = match.groups;

  const first = readTime(t1, s1, m1, p1);
  let start = clockMinutes(first);
  let end;
  let h24 = !first.twelveHour && !hasAmPm(first);
  if (t2) {
    const last = readTime(t2, s2, m2, p2);
    h24 = (!first.twelveHour || !last.twelveHour) && !hasAmPm(first) && !hasAmPm(last);
    if (hasAmPm(last)) {
      end = clockMinutes(last);
      // A 12-hour start without am/pm takes the end's where that keeps it
      // before the end ("1-2pm" is 1pm), else the later one ("11-1am" is 11pm).
      if (!hasAmPm(first) && first.twelveHour) {
        const am = (first.hour % 12) * 60 + first.minute;
        const pm = am + HALF_DAY;
        start = pm < end || am >= end ? pm : am;
      }
      end = firstAfter(end, start, DAY);
    } else {
      // An end without am/pm is the next time the clock shows it: "10-2" is
      // 2pm, "10h-2h" is 2am.
      end = last.twelveHour
        ? firstAfter((last.hour % 12) * 60 + last.minute, start, HALF_DAY)
        : firstAfter(last.hour * 60 + last.minute, start, DAY);
    }
  }

  return {
    label: label ? decodePrettyComponent(label.slice(0, -1)) : undefined,
    start,
    end,
    h24,
  };
}

// in: start and end from parseTime, a zone (IANA name or offset in minutes)
//     and a calendar date { year, month, day } in that zone
// out: { start, end } as instants in milliseconds; end is undefined without one.
// Built from the date and clock time so days when the clocks change keep the
// time as written. A start in the hour skipped when clocks spring forward
// moves later; the end then follows it so the range keeps its written length.
export function placeTimes({ start, end }, zone, { year, month, day }) {
  const placed = instantOf(zone, year, month, day, start);
  let endMs;
  if (end !== undefined) {
    endMs = placed.moved
      ? placed.ms + (end - start) * 60000
      : instantOf(zone, year, month, day, end).ms;
  }
  return { start: placed.ms, end: endMs };
}
