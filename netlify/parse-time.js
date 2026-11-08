// Reads the time or time range in a URL ("10pm-1am", "standup/9:30-10") as
// times on today's date in the first zone.
import * as tc from "timezonecomplete";

// Handle difference in params[0] on local vs server (firebase) looking at leading slash
const TIME_RE =
  /\/?(?<label>[^\/]+\/)?(?<h1>\d?\d):?(?<m1>\d\d)?(?<p1>[aph])?m?-?(?<h2>\d?\d)?:?(?<m2>\d\d)?(?<p2>[aph])?m?/;

const HALF_DAY = 12 * 60;
const DAY = 24 * 60;

// Minutes after midnight for a clock time; "a" and "p" make it 12-hour
// (12am is midnight, 12pm is noon), anything else leaves the hour as written.
function clockMinutes(hour, minute, meridiem) {
  if (meridiem == "a" && hour == 12) hour = 0;
  if (meridiem == "p" && hour < 12) hour += 12;
  return hour * 60 + minute;
}

const hasMeridiem = (p) => p == "a" || p == "p";

// The first time after `after` (in minutes) that a clock showing `minutes`
// reaches, checking every `step` minutes
function firstAfter(minutes, after, step) {
  while (minutes <= after) minutes += step;
  return minutes;
}

// `minutes` after midnight of `today`'s date, as wall-clock time in its zone.
// Built from the date and clock time so days when the clocks change keep
// the time as written.
function onDay(today, minutes) {
  const days = Math.floor(minutes / DAY);
  const date = new Date(Date.UTC(today.year(), today.month() - 1, today.day() + days));
  const clock = minutes - days * DAY;
  return new tc.DateTime(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    Math.floor(clock / 60),
    clock % 60,
    0,
    0,
    today.zone()
  );
}

// in: the time part of a URL (not "now"), and any moment today in the first zone
// out: { label, start, end }, or null when there's no time. label is the raw
//      text before the slash; end is undefined for a single time and falls on
//      the next day when it's at or before the start.
export function parseTime(timeString, today) {
  const match = timeString.match(TIME_RE);
  if (!match) return null;
  const { label, h1, m1, p1, h2, m2, p2 } = match.groups;
  const startHour = parseInt(h1);
  const startMinute = parseInt(m1) || 0;

  let start = clockMinutes(startHour, startMinute, p1);
  let end;
  if (h2) {
    const endHour = parseInt(h2);
    const endMinute = parseInt(m2) || 0;
    if (hasMeridiem(p2)) {
      end = clockMinutes(endHour, endMinute, p2);
      // An unmarked 12-hour start takes the end's am/pm where that keeps it
      // before the end ("1-2pm" is 1pm), else the later one ("11-1am" is 11pm).
      if (!hasMeridiem(p1) && startHour <= 12) {
        const am = (startHour % 12) * 60 + startMinute;
        const pm = am + HALF_DAY;
        start = pm < end || am >= end ? pm : am;
      }
      end = firstAfter(end, start, DAY);
    } else if (endHour <= 12) {
      // An unmarked end is the next time a 12-hour clock shows it ("10-2" is 2pm)
      end = firstAfter((endHour % 12) * 60 + endMinute, start, HALF_DAY);
    } else {
      end = firstAfter(endHour * 60 + endMinute, start, DAY);
    }
  }

  return {
    label: label ? label.slice(0, -1) : undefined,
    start: onDay(today, start),
    end: end === undefined ? undefined : onDay(today, end),
  };
}
