/**
 * Tests for reading the time or time range in a URL ("10pm-1am",
 * "standup/9:30-10") as times on today's date in the first zone.
 *
 * Several ranges come from #22 by @X6M-Work.
 *
 * Run with: npm test
 */

import { expect } from "./harness.js";
import { parseTime, placeTimes } from "../src/lib/parse-time.js";
import { wallAt } from "../src/lib/tz.js";

// A date in Los Angeles, standing in for "today" in the first zone
const ZONE = "America/Los_Angeles";
const day = (year, month, d) => ({ year, month, day: d });
const NOV_9 = day(2026, 11, 9);

const pad = (n) => String(n).padStart(2, "0");
function show(ms) {
  if (ms === undefined) return "none";
  const w = wallAt(ZONE, ms);
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
}

// "start → end" wall-clock times for `timeString` on `today`
function times(timeString, today = NOV_9) {
  const parsed = parseTime(timeString);
  if (!parsed) return "no match";
  const placed = placeTimes(parsed, ZONE, today);
  return placed.end ? `${show(placed.start)} → ${show(placed.end)}` : show(placed.start);
}

// --- Tests ---

console.log("\nSingle times");
expect("10am", times("10am"), "2026-11-09 10:00");
expect("10pm", times("10pm"), "2026-11-09 22:00");
expect("10:30pm", times("10:30pm"), "2026-11-09 22:30");
expect("22 (24-hour)", times("22"), "2026-11-09 22:00");
expect("12am is midnight", times("12am"), "2026-11-09 00:00");
expect("12pm is noon", times("12pm"), "2026-11-09 12:00");
expect("text without a time", times("lunch"), "no match");

console.log("\nLabels");
expect("label before the time", parseTime("standup/9:30").label, "standup");
expect("time after a label", times("standup/9:30"), "2026-11-09 09:30");
expect("no label", parseTime("9:30").label, undefined);
expect("a hyphen in a label is a space", parseTime("team-standup/10am").label, "team standup");
expect("two hyphens are one hyphen", parseTime("weekly--sync/10am").label, "weekly-sync");
expect("three hyphens are a spaced hyphen", parseTime("plan---review/10am").label, "plan - review");
expect("a percent sign in a label", parseTime("100%-done/10am").label, "100% done");

console.log("\nOther ways to write a time");
expect("930am", times("930am"), "2026-11-09 09:30");
expect("1030-1130", times("1030-1130"), "2026-11-09 10:30 → 2026-11-09 11:30");
expect("130pm-3", times("130pm-3"), "2026-11-09 13:30 → 2026-11-09 15:00");
expect("uppercase 10:30PM", times("10:30PM"), "2026-11-09 22:30");
expect("uppercase 10PM-1AM", times("10PM-1AM"), "2026-11-09 22:00 → 2026-11-10 01:00");
expect("a colon without minutes: 10:pm", times("10:pm"), "2026-11-09 22:00");
expect("a colon without minutes: 10-11:pm", times("10-11:pm"), "2026-11-09 22:00 → 2026-11-09 23:00");

console.log("\n24-hour times: 0, a leading zero, 13-23, or h");
expect("0-2pm starts at midnight", times("0-2pm"), "2026-11-09 00:00 → 2026-11-09 14:00");
expect("8-0 ends at midnight", times("8-0"), "2026-11-09 08:00 → 2026-11-10 00:00");
expect("07-9pm starts at 7am", times("07-9pm"), "2026-11-09 07:00 → 2026-11-09 21:00");
expect("14h30", times("14h30"), "2026-11-09 14:30");
expect("9h30-11h", times("9h30-11h"), "2026-11-09 09:30 → 2026-11-09 11:00");
expect("10h-2h ends at 2am", times("10h-2h"), "2026-11-09 10:00 → 2026-11-10 02:00");
expect("11h-1am starts at 11am", times("11h-1am"), "2026-11-09 11:00 → 2026-11-10 01:00");

console.log("\nRanges within one day");
expect("10-2 is 10am to 2pm", times("10-2"), "2026-11-09 10:00 → 2026-11-09 14:00");
expect("9-5 is 9am to 5pm", times("9-5"), "2026-11-09 09:00 → 2026-11-09 17:00");
expect("10am-2pm", times("10am-2pm"), "2026-11-09 10:00 → 2026-11-09 14:00");
expect("1pm-3 ends at 3pm", times("1pm-3"), "2026-11-09 13:00 → 2026-11-09 15:00");
expect("12pm-1 ends at 1pm", times("12pm-1"), "2026-11-09 12:00 → 2026-11-09 13:00");
expect("10pm-11 ends at 11pm", times("10pm-11"), "2026-11-09 22:00 → 2026-11-09 23:00");
expect("12pm-1pm", times("12pm-1pm"), "2026-11-09 12:00 → 2026-11-09 13:00");
expect("12am-1am", times("12am-1am"), "2026-11-09 00:00 → 2026-11-09 01:00");

console.log("\nStart takes am/pm from the end");
expect("1-2pm starts at 1pm", times("1-2pm"), "2026-11-09 13:00 → 2026-11-09 14:00");
expect("6-9pm starts at 6pm", times("6-9pm"), "2026-11-09 18:00 → 2026-11-09 21:00");
expect("10-2pm starts at 10am", times("10-2pm"), "2026-11-09 10:00 → 2026-11-09 14:00");
expect("12-1pm starts at noon", times("12-1pm"), "2026-11-09 12:00 → 2026-11-09 13:00");
expect("8-9am starts at 8am", times("8-9am"), "2026-11-09 08:00 → 2026-11-09 09:00");

console.log("\nRanges across midnight end the next day");
expect("10pm-1am", times("10pm-1am"), "2026-11-09 22:00 → 2026-11-10 01:00");
expect("10pm-2", times("10pm-2"), "2026-11-09 22:00 → 2026-11-10 02:00");
expect("11:30pm-12am", times("11:30pm-12am"), "2026-11-09 23:30 → 2026-11-10 00:00");
expect("11pm-12 ends at midnight", times("11pm-12"), "2026-11-09 23:00 → 2026-11-10 00:00");
expect("11-1am starts at 11pm", times("11-1am"), "2026-11-09 23:00 → 2026-11-10 01:00");
expect("22-1 (24-hour)", times("22-1"), "2026-11-09 22:00 → 2026-11-10 01:00");
expect("10am-10am lasts a day", times("10am-10am"), "2026-11-09 10:00 → 2026-11-10 10:00");
expect("Oct 31 10pm-1am ends Nov 1", times("10pm-1am", day(2026, 10, 31)), "2026-10-31 22:00 → 2026-11-01 01:00");

console.log("\nDays when the clocks change");
expect("10pm on the day DST ends", times("10pm", day(2026, 11, 1)), "2026-11-01 22:00");
expect("10pm on the day DST starts", times("10pm", day(2026, 3, 8)), "2026-03-08 22:00");
expect("10pm-1am on the day DST ends", times("10pm-1am", day(2026, 11, 1)), "2026-11-01 22:00 → 2026-11-02 01:00");
expect("2-3am in the hour DST skips keeps its length", times("2-3am", day(2026, 3, 8)), "2026-03-08 03:00 → 2026-03-08 04:00");
expect("2:30-3:45am starting in the skipped hour keeps its length", times("2:30-3:45am", day(2026, 3, 8)), "2026-03-08 03:30 → 2026-03-08 04:45");


console.log("\n24-hour display follows how the time is written (#27)");
const h24 = (t) => parseTime(t).h24;
expect("22:30 is 24-hour", h24("22:30"), true);
expect("0 is 24-hour", h24("0"), true);
expect("09:00 (leading zero) is 24-hour", h24("09:00"), true);
expect("10h is 24-hour", h24("10h"), true);
expect("10h30 is 24-hour", h24("10h30"), true);
expect("10 reads either way: 12-hour", h24("10"), false);
expect("10:30 reads either way: 12-hour", h24("10:30"), false);
expect("10pm is 12-hour", h24("10pm"), false);
expect("9-17 is 24-hour", h24("9-17"), true);
expect("9-5 is 12-hour", h24("9-5"), false);
expect("07-9pm has am/pm: 12-hour", h24("07-9pm"), false);
expect("14-3pm has am/pm: 12-hour", h24("14-3pm"), false);
expect("22-1 is 24-hour", h24("22-1"), true);
