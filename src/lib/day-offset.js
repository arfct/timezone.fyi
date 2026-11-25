// The day marker beside each time: how many calendar days a zone's date is
// ahead of (+) or behind (−) the first zone's date. UTC offsets span 26 hours
// (UTC−12 to UTC+14), so a zone can be up to two days away.

const MS_PER_DAY = 86400000;

// A calendar date { year, month, day } as a whole number of days
const calendarDay = (date) => Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;

// in: the start's calendar date in the first zone, and the date of the same
//     (or a later) instant in another zone, both from wallAt() in tz.js
// out: signed whole days, e.g. -1 when `zoneStart` falls on the day before
export const dayOffset = (start, zoneStart) => calendarDay(zoneStart) - calendarDay(start);

// "+1" / "−1" for the page title and link preview; "" on the same day
export const formatDayOffset = (offset) =>
  offset ? `${offset > 0 ? "+" : "−"}${Math.abs(offset)}` : "";

// "⁺¹" / "⁻¹" beside the time on the page; "" on the same day
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const superscriptDayOffset = (offset) =>
  offset
    ? (offset > 0 ? "⁺" : "⁻") +
      [...String(Math.abs(offset))].map((d) => SUPERSCRIPT_DIGITS[d]).join("")
    : "";
