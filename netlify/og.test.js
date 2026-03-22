/**
 * Smoke test for the /og endpoint (OG image generation via canvas).
 * Verifies that canvas loads and can produce a PNG buffer without error.
 *
 * Does NOT require a running server — imports the canvas dependency directly.
 *
 * Run with: npm test
 */

import { createCanvas } from "canvas";

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

console.log("\ncanvas smoke test (used by /og endpoint)");

let canvas, ctx, buf;
try {
  canvas = createCanvas(1200, 630);
  ctx = canvas.getContext("2d");
  ctx.fillStyle = "#012459";
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px sans-serif";
  ctx.fillText("timezone.fyi", 80, 120);
  buf = canvas.toBuffer("image/png");
} catch (e) {
  console.error(`  ✗ canvas threw: ${e.message}`);
  failed++;
}

expect("createCanvas returns a canvas", !!canvas, true);
expect("getContext returns a context", !!ctx, true);
expect("toBuffer returns a Buffer", Buffer.isBuffer(buf), true);
expect("PNG starts with correct magic bytes",
  buf?.slice(0, 4).toString("hex"), "89504e47"); // \\x89PNG
expect("output is at least 1 KB", buf?.length > 1024, true);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
