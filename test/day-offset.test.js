/**
 * Tests for the day marker beside each time: how many calendar days a zone's
 * date is ahead of (+) or behind (−) the first zone's date.
 *
 * The page reads the current clock, so these tests call day-offset.js with fixed
 * times.
 *
 * Run with: npm test
 */

import { expect } from "./harness.js";
import { dayOffset, formatDayOffset, superscriptDayOffset } from "../src/lib/day-offset.js";
import { instantOf, wallAt } from "../src/lib/tz.js";

// Day offset of `zone` for `hour`:00 on y-mo-d in `firstZone`
function offsetAt(y, mo, d, hour, firstZone, zone) {
  const start = instantOf(firstZone, y, mo, d, hour * 60).ms;
  return dayOffset(wallAt(firstZone, start), wallAt(zone, start));
}

// --- Tests ---

console.log("\nDay offset between the first zone and another zone");
expect("same day: 10am NYC → SFO 7am", offsetAt(2026, 11, 9, 10, "America/New_York", "America/Los_Angeles"), 0);
expect("next day: 5pm SFO → NRT 10am", offsetAt(2026, 11, 9, 17, "America/Los_Angeles", "Asia/Tokyo"), 1);
expect("previous day: 10am NRT → SFO 5pm", offsetAt(2026, 11, 9, 10, "Asia/Tokyo", "America/Los_Angeles"), -1);
expect("month end: Oct 31 5pm SFO → NRT Nov 1", offsetAt(2026, 10, 31, 17, "America/Los_Angeles", "Asia/Tokyo"), 1);
expect("month start: Nov 1 10am NRT → SFO Oct 31", offsetAt(2026, 11, 1, 10, "Asia/Tokyo", "America/Los_Angeles"), -1);
expect("year end: Dec 31 5pm SFO → NRT Jan 1", offsetAt(2026, 12, 31, 17, "America/Los_Angeles", "Asia/Tokyo"), 1);
expect("year start: Jan 1 10am NRT → SFO Dec 31", offsetAt(2027, 1, 1, 10, "Asia/Tokyo", "America/Los_Angeles"), -1);
expect("two days ahead: 11pm UTC−12 → UTC+14", offsetAt(2026, 11, 9, 23, "Etc/GMT+12", "Pacific/Kiritimati"), 2);
expect("two days behind: 1am UTC+14 → UTC−12", offsetAt(2026, 11, 9, 1, "Pacific/Kiritimati", "Etc/GMT+12"), -2);

console.log("\nDay marker in the page title and link preview");
expect("same day → no marker", formatDayOffset(0), "");
expect("+1", formatDayOffset(1), "+1");
expect("−1 uses a minus sign", formatDayOffset(-1), "−1");
expect("+2", formatDayOffset(2), "+2");
expect("−2", formatDayOffset(-2), "−2");

console.log("\nDay marker beside the time on the page");
expect("same day → no marker", superscriptDayOffset(0), "");
expect("⁺¹", superscriptDayOffset(1), "⁺¹");
expect("⁻¹", superscriptDayOffset(-1), "⁻¹");
expect("⁺²", superscriptDayOffset(2), "⁺²");
expect("⁻²", superscriptDayOffset(-2), "⁻²");

