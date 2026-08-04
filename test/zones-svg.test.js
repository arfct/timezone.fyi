import { describe, it, expect } from "vitest";
import { getZoneInfo } from "../netlify/common.js";
import { zonesSvg, normalizeSmallCaps } from "../netlify/zones-svg.js";

// U+1D00 LATIN LETTER SMALL CAPITAL A, U+1D0D M, U+1D18 P — the Phonetic
// Extensions block. common.js renders am/pm with these, which is fine in a
// browser but no ordinary font has the glyphs, so a rasterizer draws tofu.
const SMALL_CAPS = /[ᴀ-ᴫ]/;

describe("normalizeSmallCaps", () => {
  it("converts small-capital am to AM", () => {
    expect(normalizeSmallCaps("10:30ᴀᴍ")).toBe("10:30AM");
  });

  it("converts small-capital pm to PM", () => {
    expect(normalizeSmallCaps("1:30ᴘᴍ")).toBe("1:30PM");
  });

  it("leaves ordinary text untouched", () => {
    expect(normalizeSmallCaps("10:30 PST")).toBe("10:30 PST");
  });

  it("handles undefined", () => {
    expect(normalizeSmallCaps(undefined)).toBe("");
  });
});

describe("zonesSvg with real zone data", () => {
  const info = getZoneInfo("/10:30am,pst,est");

  it("parses the real URL format", () => {
    // The format is comma-separated zones with a time, not slash-separated.
    expect(info.zones).toHaveLength(2);
    expect(info.zones.map((z) => z.niceZoneName)).toEqual(["PST", "EST"]);
  });

  it("contains no small-capital codepoints", () => {
    // Without this, 10:30ᴀᴍ renders as "10:30" followed by two tofu blocks.
    expect(SMALL_CAPS.test(zonesSvg(info))).toBe(false);
  });

  it("renders the times as legible AM/PM", () => {
    const svg = zonesSvg(info);
    expect(svg).toContain("10:30AM");
    expect(svg).toContain("1:30PM");
  });

  it("renders one column per zone", () => {
    const svg = zonesSvg(info);
    expect((svg.match(/<linearGradient/g) ?? []).length).toBe(2);
  });

  it("labels each zone", () => {
    const svg = zonesSvg(info);
    expect(svg).toContain("PST");
    expect(svg).toContain("EST");
  });

  it("is a 1200x630 document", () => {
    const svg = zonesSvg(info);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });
});

describe("zonesSvg fallbacks", () => {
  it("produces a card when a path yields no zones", () => {
    // Real input that does not parse — production returns 502 for this today.
    const svg = zonesSvg(getZoneInfo("/9am,sf,london,tokyo"));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("timezone.fyi");
  });

  it("produces a card for undefined info", () => {
    expect(zonesSvg(undefined).startsWith("<svg")).toBe(true);
  });

  it("escapes markup in a zone name", () => {
    const fake = {
      zones: [
        {
          zoneStart: { hour: () => 9 },
          niceZoneName: '</text><script>x</script>',
          startString: "9:00AM",
          night: "",
        },
      ],
    };
    const svg = zonesSvg(fake);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});
