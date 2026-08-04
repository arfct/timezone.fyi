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

describe("resolveZone, via getZoneInfo", () => {
  const zonesFor = (path) => getZoneInfo(path)?.zones ?? [];

  it("resolves an uppercase abbreviation mapped to an IANA name", () => {
    expect(zonesFor("/10:30am,pst,est")).toHaveLength(2);
  });

  it("resolves a lowercase UTC", () => {
    // 'utc' never normalized, so this failed with "non-existing time zone name".
    expect(zonesFor("/2pm,utc")).toHaveLength(1);
  });

  it("resolves an uppercase UTC", () => {
    expect(zonesFor("/2pm,UTC")).toHaveLength(1);
  });

  it("resolves an abbreviation that maps to a numeric offset", () => {
    // JST has only a numeric entry (9), and a number reached z.startsWith,
    // throwing "z.startsWith is not a function".
    expect(zonesFor("/2pm,jst")).toHaveLength(1);
  });

  it("places a numeric-offset zone at the right time", () => {
    // 2pm UTC is 11pm JST (UTC+9). The offset is hours, converted to minutes.
    const [z] = zonesFor("/2pm,utc,jst").slice(-1);
    expect(z.startString).toContain("11");
  });

  it("still resolves a GMT offset", () => {
    expect(zonesFor("/2pm,gmt+5")).toHaveLength(1);
  });

  it("resolves a percent-encoded IANA name", () => {
    expect(zonesFor("/2pm,Asia%2FTokyo")).toHaveLength(1);
  });

  it("resolves a lowercase percent-encoded IANA name", () => {
    expect(zonesFor("/2pm,asia%2Ftokyo")).toHaveLength(1);
  });

  it("resolves an underscored IANA name regardless of case", () => {
    expect(zonesFor("/2pm,america%2Fnew_york")).toHaveLength(1);
  });

  it("labels a percent-encoded IANA zone by its city", () => {
    // The label comes from the raw URL token, so an encoded slash left it as
    // "ASIA%2FTOKYO" once these paths started resolving.
    expect(zonesFor("/2pm,Asia%2FTokyo")[0].niceZoneName).toBe("TOKYO");
  });

  it("turns underscores in a city name into non-breaking spaces", () => {
    // U+00A0, not a plain space — the existing code uses a non-breaking space
    // so a two-word city does not wrap in the UI. Asserted explicitly so it is
    // not "corrected" to U+0020 by someone reading the rendered output.
    expect(zonesFor("/2pm,america%2Fnew_york")[0].niceZoneName).toBe("NEW YORK");
  });

  it("labels an abbreviation by the abbreviation", () => {
    // Not by the resolved zone, which for a numeric override is just a number.
    expect(zonesFor("/2pm,jst")[0].niceZoneName).toBe("JST");
    expect(zonesFor("/2pm,pst")[0].niceZoneName).toBe("PST");
  });

  it("reports an unknown zone as an error rather than throwing", () => {
    const info = getZoneInfo("/2pm,notazonename");
    expect(info.error).toBeTruthy();
    expect(info.zones ?? []).toHaveLength(0);
  });

  it("does not throw on any input", () => {
    for (const p of ["/", "/2pm", "/2pm,", "/,,,", "/garbage", "/2pm,jst,utc,gmt+5"]) {
      expect(() => getZoneInfo(p)).not.toThrow();
    }
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
