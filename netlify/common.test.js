/**
 * Tests for common.js: time parsing, time ranges, crossing midnight,
 * day markers (start and end), duration, and formatting.
 *
 * Run with: npm test
 */

import { getZoneInfo } from "./common.js";

let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\nTime range crossing midnight (Issue #20)");

{
  const info = getZoneInfo("10pm-1am,pst,est");
  expect("duration is 180 minutes (not negative)", info.duration, 180);

  const pst = info.zones.find(z => z.niceZoneName === "PST");
  expect("PST startString is 10pm", pst.startString, "10ᴘᴍ");
  expect("PST endString is 1am (not 1pm)", pst.endString, "1ᴀᴍ");
  expect("PST startMarker is empty", pst.startMarker, "");
  expect("PST endMarker is ⁺¹", pst.endMarker, "⁺¹");
  expect("PST endExtraDay is true", pst.endExtraDay, true);

  const est = info.zones.find(z => z.niceZoneName === "EST");
  expect("EST startString is 1am", est.startString, "1ᴀᴍ");
  expect("EST endString is 4am (not 4pm)", est.endString, "4ᴀᴍ");
  expect("EST startMarker is ⁺¹", est.startMarker, "⁺¹");
  expect("EST endMarker is ⁺¹", est.endMarker, "⁺¹");
  expect("EST startDayDiff is 1", est.startDayDiff, 1);
  expect("EST endDayDiff is 1", est.endDayDiff, 1);
  expect("EST description contains 1am+1-4am+1", est.description.includes("1ᴀᴍ+1‑4ᴀᴍ+1"), true);
}

console.log("\nTime range with no am/pm (same-day heuristic)");

{
  const info = getZoneInfo("10-2,pst,est");
  expect("10-2 duration is 240 minutes (10am to 2pm)", info.duration, 240);
  const pst = info.zones.find(z => z.niceZoneName === "PST");
  expect("10-2 PST startString is 10am", pst.startString, "10ᴀᴍ");
  expect("10-2 PST endString is 2pm", pst.endString, "2ᴘᴍ");
  expect("10-2 PST startMarker is empty", pst.startMarker, "");
  expect("10-2 PST endMarker is empty", pst.endMarker, "");
}

{
  const info = getZoneInfo("9-5,pst,est");
  expect("9-5 duration is 480 minutes (9am to 5pm)", info.duration, 480);
  const pst = info.zones.find(z => z.niceZoneName === "PST");
  expect("9-5 PST startString is 9am", pst.startString, "9ᴀᴍ");
  expect("9-5 PST endString is 5pm", pst.endString, "5ᴘᴍ");
}

console.log("\nTime range with pm start and no am/pm on end");

{
  const info = getZoneInfo("10pm-2,pst,est");
  expect("10pm-2 duration is 240 minutes (10pm to 2am next day)", info.duration, 240);
  const pst = info.zones.find(z => z.niceZoneName === "PST");
  expect("10pm-2 PST startString is 10pm", pst.startString, "10ᴘᴍ");
  expect("10pm-2 PST endString is 2am", pst.endString, "2ᴀᴍ");
  expect("10pm-2 PST endMarker is ⁺¹", pst.endMarker, "⁺¹");
}

console.log("\nMidnight and noon boundaries (12am / 12pm)");

{
  const info = getZoneInfo("11:30pm-12am,pst,est");
  expect("11:30pm-12am duration is 30 minutes", info.duration, 30);
  const pst = info.zones.find(z => z.niceZoneName === "PST");
  expect("11:30pm-12am PST endString is 12am", pst.endString, "12ᴀᴍ");
  expect("11:30pm-12am PST endMarker is ⁺¹", pst.endMarker, "⁺¹");
}

{
  const info = getZoneInfo("12am-1am,pst");
  expect("12am-1am duration is 60 minutes", info.duration, 60);
  const pst = info.zones[0];
  expect("12am-1am PST startString is 12am", pst.startString, "12ᴀᴍ");
  expect("12am-1am PST endString is 1am", pst.endString, "1ᴀᴍ");
  expect("12am-1am PST endMarker is empty (same day)", pst.endMarker, "");
}

{
  const info = getZoneInfo("12pm-1pm,pst");
  expect("12pm-1pm duration is 60 minutes", info.duration, 60);
  const pst = info.zones[0];
  expect("12pm-1pm PST startString is 12pm", pst.startString, "12ᴘᴍ");
  expect("12pm-1pm PST endString is 1pm", pst.endString, "1ᴘᴍ");
}

console.log("\nEqual start and end times roll to next day");

{
  const info = getZoneInfo("10am-10am,pst");
  expect("10am-10am duration is 1440 minutes (24 hours)", info.duration, 1440);
  const pst = info.zones[0];
  expect("10am-10am PST endMarker is ⁺¹", pst.endMarker, "⁺¹");
}

console.log("\nPrevious day day-marker (Issue #19)");

{
  const info = getZoneInfo("10am,nrt,sfo");
  const sfo = info.zones.find(z => z.niceZoneName === "SFO");
  expect("SFO startDayDiff is -1", sfo.startDayDiff, -1);
  expect("SFO startMarker is ⁻¹", sfo.startMarker, "⁻¹");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
