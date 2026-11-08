/**
 * Tests for escaping text from the URL (labels, zone codes, error messages)
 * before it goes into the page or the calendar file.
 *
 * Run with: npm test
 */

import { escapeHtml, escapeIcsText } from "./escape.js";

// --- Minimal test harness ---

let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${expected}`);
    console.error(`      actual:   ${actual}`);
    failed++;
  }
}

// --- Tests ---

console.log("\nHTML text and attribute values");
expect("plain text is unchanged", escapeHtml("team standup"), "team standup");
expect("a tag can't open", escapeHtml("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;");
expect("quotes can't end an attribute", escapeHtml(`a" onload="x' b`), "a&quot; onload=&quot;x&#39; b");
expect("ampersands", escapeHtml("R&D"), "R&amp;D");
expect("an HTML comment can't close", escapeHtml("--><b>"), "--&gt;&lt;b&gt;");

console.log("\nCalendar file text");
expect("plain text is unchanged", escapeIcsText("team standup"), "team standup");
expect("commas and semicolons", escapeIcsText("a,b;c"), "a\\,b\;c");
expect("backslashes", escapeIcsText("a\\b"), "a\\\\b");
expect("a newline can't start a new property", escapeIcsText("x\nDTSTART:2000"), "x\\nDTSTART:2000");
expect("a carriage return can't either", escapeIcsText("x\r\nATTENDEE:y\rz"), "x\\nATTENDEE:y\\nz");

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
