// Minimal test harness shared by every test file. Each file prints its own
// count; test/run.js adds them up.

export const totals = { passed: 0, failed: 0 };

export function section(title) {
  console.log(`\n${title}`);
}

export function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    totals.passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${expected}`);
    console.error(`      actual:   ${actual}`);
    totals.failed++;
  }
}
