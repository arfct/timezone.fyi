// The calendar file for an event (RFC 5545), and links that add it to web
// calendars.
import { escapeIcsText } from "./escape.js";
import { buildVtimezone, icsLocal } from "./vtimezone.js";

const PRODID = "-//Artifact//timezone.fyi//EN";
// Used when the link gives no end time or duration
export const DEFAULT_DURATION = 60;

const RRULES = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function rrule(event) {
  if (!event.recur) return null;
  const rule = RRULES[event.recur];
  return /weekly/.test(event.recur) ? `${rule};BYDAY=${BYDAY[event.anchor.weekday]}` : rule;
}

// An instant → "20261203T150000Z"
export const icsUtc = (ms) => `${icsLocal(ms)}Z`;

// The event's own start and end: the first occurrence for a repeating event
export function span(event) {
  const start = event.anchorStart ?? event.start;
  const end = (event.recur ? event.anchorEnd : event.end) ?? start + DEFAULT_DURATION * 60000;
  return { start, end };
}

// A repeating event in an IANA zone is written in that zone's local time, so
// it stays at the same clock time when the clocks change. Everything else is
// written in UTC.
const localZone = (event) =>
  event.recur && typeof event.zones[0].zone === "string" ? event.zones[0].zone : null;

// Stable for the same event however its link is written: the same start, end,
// repeat and name give the same UID, so adding it twice doesn't duplicate it.
export async function eventUid(event) {
  const { start, end } = span(event);
  const material = JSON.stringify([
    start,
    end,
    event.recur ?? "",
    localZone(event) ?? "",
    event.label ?? "",
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 32)}@timezone.fyi`;
}

export const summary = (event) => event.label || event.zones[0].text;

// Folds a content line at 75 octets (RFC 5545, section 3.1)
export function fold(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join("\r\n ");
}

// in: a resolved event (not live), its page URL, and the current instant
// out: the text of a .ics file
export async function buildIcs(event, pageUrl, now) {
  const { start, end } = span(event);
  const zone = localZone(event);
  const first = event.zones[0];
  const local = (ms) => icsLocal(ms + first.zoneOffsetAt(ms) * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (event.recur) {
    // Shown as the calendar's name when someone subscribes to the link
    lines.push(`X-WR-CALNAME:${escapeIcsText(summary(event))}`);
    lines.push("REFRESH-INTERVAL;VALUE=DURATION:P1W", "X-PUBLISHED-TTL:P1W");
  }
  if (zone) lines.push(...buildVtimezone(zone, start));
  lines.push(
    "BEGIN:VEVENT",
    `UID:${await eventUid(event)}`,
    `DTSTAMP:${icsUtc(Math.floor(now / 1000) * 1000)}`,
    zone ? `DTSTART;TZID=${zone}:${local(start)}` : `DTSTART:${icsUtc(start)}`,
    zone ? `DTEND;TZID=${zone}:${local(end)}` : `DTEND:${icsUtc(end)}`,
  );
  const rule = rrule(event);
  if (rule) lines.push(`RRULE:${rule}`);
  lines.push(
    `SUMMARY:${escapeIcsText(summary(event))}`,
    `DESCRIPTION:${escapeIcsText(`${event.timesText}\n${pageUrl}`)}`,
    `URL:${pageUrl}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

// Links that open a web calendar's "new event" form with the event filled in.
// Outlook's form takes no repeat rule, so a repeating event gets only Google
// and the calendar file.
export function calendarLinks(event, pageUrl) {
  const { start, end } = span(event);
  const zone = localZone(event);
  const first = event.zones[0];
  const details = `${event.timesText}\n${pageUrl}`;
  const google = new URLSearchParams({ action: "TEMPLATE", text: summary(event), details });
  if (zone) {
    const local = (ms) => icsLocal(ms + first.zoneOffsetAt(ms) * 60000);
    google.set("dates", `${local(start)}/${local(end)}`);
    google.set("ctz", zone);
    google.set("recur", `RRULE:${rrule(event)}`);
  } else {
    google.set("dates", `${icsUtc(start)}/${icsUtc(end)}`);
    if (event.recur) google.set("recur", `RRULE:${rrule(event)}`);
  }
  const links = { google: `https://calendar.google.com/calendar/render?${google}` };
  if (!event.recur) {
    const outlook = new URLSearchParams({
      rru: "addevent",
      subject: summary(event),
      startdt: new Date(start).toISOString(),
      enddt: new Date(end).toISOString(),
      body: details,
    });
    links.outlook = `https://outlook.live.com/calendar/0/action/compose?${outlook}`;
    links.office = `https://outlook.office.com/calendar/0/action/compose?${outlook}`;
  }
  return links;
}
