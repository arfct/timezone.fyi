// Shared by the Worker (bundled) and the browser (served as a static module):
// how a clock time is written and how a zone's card is drawn. The sky's
// colours are sky.js; where the sun is, sun.js.

import { SKY, skyAt } from "./sky.js";

export { SKY, skyAt };

const pad2 = (n) => String(n).padStart(2, "0");

// in: minutes after midnight; h24 for 24-hour form
// out: { digits, suffix }: "10:30" + "am", "10" + "pm" (":00" dropped), or
//      "22:30" + "" (24-hour keeps its minutes and pads the hour)
export function clock(minutes, h24) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  if (h24) return { digits: `${pad2(hour)}:${pad2(minute)}`, suffix: "" };
  return {
    digits: `${hour % 12 || 12}${minute ? `:${pad2(minute)}` : ""}`,
    suffix: hour < 12 ? "am" : "pm",
  };
}

// "10:30am", "22:30": for titles and calendar text
export function clockText(minutes, h24) {
  const c = clock(minutes, h24);
  return c.digits + c.suffix;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// "Thu 3 Dec" (short) or "Thursday 3 December 2026" (long). weekday: 0 is Sunday.
export function dateText({ year, month, day, weekday }, long) {
  if (long) return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]} ${year}`;
  return `${WEEKDAYS[weekday].slice(0, 3)} ${day} ${MONTHS[month - 1].slice(0, 3)}`;
}

// "UTC", "UTC−8", "UTC+5:30" for an offset in minutes
export function offsetText(minutes) {
  if (!minutes) return "UTC";
  const abs = Math.abs(minutes);
  const m = abs % 60;
  return `UTC${minutes < 0 ? "−" : "+"}${Math.floor(abs / 60)}${m ? `:${pad2(m)}` : ""}`;
}

// "in 3 h 12 min", "in 8 days", "started 5 min ago, 55 min left", "ended 2 h ago",
// "2 h ago", "now". From 48 hours it counts calendar days where the code runs:
// in the browser, the reader's zone.
export function relativeText(start, end, now) {
  const midnight = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const span = (from, to) => {
    const minutes = Math.round((to - from) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
    // Rounded, because a day with a clock change is 23 or 25 hours long
    return `${Math.round((midnight(to) - midnight(from)) / 86400000)} days`;
  };
  if (now < start - 30000) return `in ${span(now, start)}`;
  if (end && now < end) return `started ${span(start, now)} ago, ${span(now, end)} left`;
  if (!end && now - start < 60000) return "now";
  return `${end ? "ended " : ""}${span(end ?? start, now)} ago`;
}

// How many columns the zone cards sit in on a wide screen, so rows stay even:
// up to 4 side by side, 5–6 in threes, 7–8 in fours, then fives.
export function columnsFor(count) {
  if (count <= 4) return Math.max(count, 1);
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 5;
}

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

// On the page am/pm is one letter, "10:30a". The colon is its own element so it can sit centred on the digits, as a
// clock's does, whatever the font puts there by default.
function timeHtml(minutes, h24) {
  const c = clock(minutes, h24);
  const digits = c.digits.replace(":", '<span class="colon">:</span>');
  return `<span class="digits">${digits}</span>${c.suffix ? `<span class="ap">${c.suffix[0]}</span>` : ""}`;
}

// The custom properties that paint a stripe: sRGB, and P3 where it's supported
// and --on, the text colour that reads on it
export const skyStyle = (s) =>
  `--top:${s.top};--bottom:${s.bottom};--top-p3:${s.topP3};--bottom-p3:${s.bottomP3};--on:${s.dark ? "#ffffff" : INK}`;

const INK = "#0d1117";

// One zone's card. The Worker renders these; the browser re-renders them for a
// live clock and adds one for the viewer's own zone.
// in: { name, place, offset (minutes), minutes, endMinutes?, dayOffset,
//       endDayOffset?, dayText?, you?, sun? } and h24. sun is the sun's state
//       there (sunSky); without it the colours follow the clock.
export function zoneCard(z, h24) {
  const sky = skyAt(z.minutes, z.sun);
  const range = z.endMinutes !== undefined;
  const sign = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
  const day = (n) => (n ? `<sup class="day">${sign(n)}</sup>` : "");
  // A range on one day carries its day marker once, after the end
  const startDay = range && z.dayOffset === z.endDayOffset ? "" : day(z.dayOffset);
  const time = range
    ? `<span class="from">${timeHtml(z.minutes, h24)}${startDay}<span class="dash">–</span></span><span class="to">${timeHtml(z.endMinutes, h24)}${day(z.endDayOffset)}</span>`
    : `${timeHtml(z.minutes, h24)}${day(z.dayOffset)}`;
  const notes = [];
  if (z.you) notes.push("<b>Your zone</b>");
  if (z.dayOffset && z.dayText) notes.push(`<b>${escapeHtml(z.dayText)}</b>`);
  notes.push(offsetText(z.offset));
  return (
    `<article class="zone${sky.dark ? " dark" : ""}${range ? " range" : ""}${z.you ? " you" : ""}" style="${skyStyle(sky)}">` +
    `<h2 class="name"${z.place ? ` title="${escapeHtml(z.place)}"` : ""}>${escapeHtml(z.name)}</h2>` +
    `<p class="time">${time}</p>` +
    `<p class="note">${notes.join(" · ")}</p>` +
    `</article>`
  );
}
