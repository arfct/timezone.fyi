// Tags a PNG as Display P3 by adding an iCCP chunk with a Display P3 ICC
// profile. og-svg writes the colours it's given as plain numbers, so an image
// drawn with P3 values (skyAt's topP3Hex) is only read as P3 once it carries
// the profile. Viewers that ignore the profile show it as sRGB numbers, which
// look a little more saturated than the sRGB palette, not wrong.
//
// The profile is Compact-ICC-Profiles' DisplayP3-v4.icc (480 bytes, CC0;
// src/color/LICENSE-Compact-ICC-Profiles.txt).

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// zlib-wrapped deflate, which is what PNG's compressed chunks hold
async function zlib(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// in: the ICC profile's bytes; out: the whole iCCP chunk, length to CRC
export async function iccpChunk(profile) {
  const name = new TextEncoder().encode("Display P3");
  const compressed = await zlib(new Uint8Array(profile));
  // name, a zero byte, compression method 0, then the zlib stream
  const data = new Uint8Array(name.length + 2 + compressed.length);
  data.set(name, 0);
  data.set(compressed, name.length + 2);
  const typeAndData = new Uint8Array(4 + data.length);
  typeAndData.set(new TextEncoder().encode("iCCP"), 0);
  typeAndData.set(data, 4);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeAndData, 4);
  view.setUint32(8 + data.length, crc32(typeAndData));
  return chunk;
}

// in: a PNG, and an iCCP chunk from iccpChunk()
// out: the PNG with the chunk right after IHDR, replacing any sRGB, gAMA,
//      cHRM or iCCP chunk, which would contradict it
export function withChunk(png, chunk) {
  const bytes = new Uint8Array(png);
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error("not a PNG");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (!["sRGB", "gAMA", "cHRM", "iCCP"].includes(type)) parts.push(bytes.subarray(offset, end));
    if (type === "IHDR") parts.push(chunk);
    offset = end;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
