// Runs every *.test.js beside this file and exits non-zero if any check fails.
import { readdirSync } from "node:fs";
import { totals } from "./harness.js";

const only = process.argv[2];
const files = readdirSync(new URL(".", import.meta.url))
  .filter((name) => name.endsWith(".test.js") && (!only || name.includes(only)))
  .sort();

for (const file of files) {
  const before = { ...totals };
  console.log(`\n=== ${file}`);
  await import(new URL(file, import.meta.url));
  console.log(`\n${totals.passed - before.passed} passed, ${totals.failed - before.failed} failed`);
}

console.log(`\nTotal: ${totals.passed} passed, ${totals.failed} failed in ${files.length} files`);
if (totals.failed > 0) process.exit(1);
