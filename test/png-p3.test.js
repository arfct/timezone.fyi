/**
 * Tests for tagging the link-preview PNG as Display P3.
 *
 * Run with: npm test
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { iccpChunk, withChunk } from "../src/lib/png-p3.js";
import { expect } from "./harness.js";

const profile = readFileSync(new URL("../src/color/DisplayP3-v4.icc", import.meta.url));

// A 1×1 PNG with an sRGB chunk, as some encoders write
const png = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000173524742" +
    "00aece1ce90000000c4944415408d763f8cfc0000003010100c9fe92ef0000000049454e44ae426082",
  "hex",
);

function chunks(bytes) {
  const b = Buffer.from(bytes);
  const out = [];
  for (let o = 8; o < b.length; ) {
    const n = b.readUInt32BE(o);
    out.push({
      type: b.toString("latin1", o + 4, o + 8),
      data: b.subarray(o + 8, o + 8 + n),
      crc: b.readUInt32BE(o + 8 + n),
      raw: b.subarray(o + 4, o + 8 + n),
    });
    o += 12 + n;
  }
  return out;
}

// CRC-32 as PNG defines it, written out separately from the one under test
function crc(bytes) {
  let c = ~0;
  for (const x of bytes) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

console.log("\nThe iCCP chunk");
const tagged = chunks(withChunk(png, await iccpChunk(profile)));
expect("chunk order", tagged.map((c) => c.type).join(" "), "IHDR iCCP IDAT IEND");
const iccp = tagged[1];
expect("named Display P3", iccp.data.subarray(0, 10).toString("latin1"), "Display P3");
expect(
  "then a zero byte and compression method 0",
  [...iccp.data.subarray(10, 12)].join(","),
  "0,0",
);
expect("holds the profile", Buffer.compare(inflateSync(iccp.data.subarray(12)), profile), 0);
expect("its CRC is right", iccp.crc, crc(iccp.raw));
expect(
  "the sRGB chunk is gone",
  tagged.some((c) => c.type === "sRGB"),
  false,
);
expect(
  "not a PNG is refused",
  (() => {
    try {
      withChunk(new Uint8Array(20), new Uint8Array(0));
      return "accepted";
    } catch (e) {
      return e.message;
    }
  })(),
  "not a PNG",
);
