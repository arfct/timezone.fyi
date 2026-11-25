// Shared by the Worker (bundled) and the browser (served as a static module):
// the 24-hour sky gradient and how a clock time is written.

// Two colours per hour, top then bottom of the gradient, from midnight.
// These are the colours timezone.fyi has always used.
export const SKY = [
  ["#012459", "#001322"],
  ["#003972", "#001322"],
  ["#003972", "#001322"],
  ["#004372", "#00182b"],
  ["#004372", "#011d34"],
  ["#016792", "#00182b"],
  ["#07729f", "#042c47"],
  ["#12a1c0", "#07506e"],
  ["#74d4cc", "#1386a6"],
  ["#efeebc", "#61d0cf"],
  ["#fee154", "#a3dec6"],
  ["#fdc352", "#e8ed92"],
  ["#ffac6f", "#ffe467"],
  ["#fda65a", "#ffe467"],
  ["#fd9e58", "#ffe467"],
  ["#f18448", "#ffd364"],
  ["#f06b7e", "#f9a856"],
  ["#ca5a92", "#f4896b"],
  ["#5b2c83", "#d1628b"],
  ["#371a79", "#713684"],
  ["#28166b", "#45217c"],
  ["#192861", "#372074"],
  ["#040b3c", "#233072"],
  ["#040b3c", "#012459"],
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// WCAG relative luminance of an [r, g, b] colour
function luminance(c) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// in: minutes after midnight, local time
// out: { top, bottom } gradient colours, blended between the hour before and
//      the hour after, and `dark`: true when light text reads better on it.
export function skyAt(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(m / 60);
  const t = (m % 60) / 60;
  const a = SKY[hour];
  const b = SKY[(hour + 1) % 24];
  const top = mix(rgb(a[0]), rgb(b[0]), t);
  const bottom = mix(rgb(a[1]), rgb(b[1]), t);
  // Text sits around the middle of the gradient. Light text wins when its
  // contrast against the middle colour is higher than dark text's.
  const l = luminance(mix(top, bottom, 0.5));
  const dark = 1.05 / (l + 0.05) > (l + 0.05) / 0.05;
  return { top: hex(top), bottom: hex(bottom), dark };
}

const pad2 = (n) => String(n).padStart(2, "0");

// in: minutes after midnight; h24 for 24-hour form
// out: { digits, suffix }: "10:30" + "am", "10" + "am" (":00" dropped), or
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

// "10:30am", "22:30"
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

// "in 3h 12m", "in 2 days", "started 5m ago", "ended 2h ago", "now"
export function relativeText(start, end, now) {
  const span = (ms) => {
    const minutes = Math.round(Math.abs(ms) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
    return `${Math.round(minutes / 1440)} days`;
  };
  if (now < start - 30000) return `in ${span(start - now)}`;
  if (end && now < end) return `started ${span(now - start)} ago, ${span(end - now)} left`;
  if (!end && now - start < 60000) return "now";
  return `${end ? "ended" : "was"} ${span(now - (end ?? start))} ago`;
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

function timeHtml(minutes, h24) {
  const c = clock(minutes, h24);
  return `<span class="digits">${c.digits}</span>${c.suffix ? `<span class="ap">${c.suffix.toUpperCase()}</span>` : ""}`;
}

// One zone's card. The Worker renders these; the browser re-renders them for a
// live clock and adds one for the viewer's own zone.
// in: { name, place, offset (minutes), minutes, endMinutes?, dayOffset,
//       endDayOffset?, dayText?, you? } and h24
export function zoneCard(z, h24) {
  const sky = skyAt(z.minutes);
  const range = z.endMinutes !== undefined;
  const sign = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
  const day = (n) => (n ? `<sup class="day">${sign(n)}</sup>` : "");
  // A range on one day carries its day marker once, after the end
  const startDay = range && z.dayOffset === z.endDayOffset ? "" : day(z.dayOffset);
  const time = range
    ? `${timeHtml(z.minutes, h24)}${startDay}<span class="dash">–</span>${timeHtml(z.endMinutes, h24)}${day(z.endDayOffset)}`
    : `${timeHtml(z.minutes, h24)}${day(z.dayOffset)}`;
  const notes = [];
  if (z.you) notes.push("<b>Your zone</b>");
  if (z.dayOffset && z.dayText) notes.push(`<b>${escapeHtml(z.dayText)}</b>`);
  if (z.place) notes.push(escapeHtml(z.place));
  notes.push(offsetText(z.offset));
  return (
    `<article class="zone${sky.dark ? " dark" : ""}${range ? " range" : ""}${z.you ? " you" : ""}" style="--top:${sky.top};--bottom:${sky.bottom}">` +
    `<h2 class="name">${escapeHtml(z.name)}</h2>` +
    `<p class="time">${time}</p>` +
    `<p class="note">${notes.join(" · ")}</p>` +
    `</article>`
  );
}
