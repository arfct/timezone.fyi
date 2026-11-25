/**
 * Tests for what the Worker sends: the page's head, escaping of text from the
 * URL, and a link-preview image that only uses characters its font has.
 *
 * Run with: npm test
 */

import { readFileSync } from "node:fs";
import { clockText, relativeText, skyAt } from "../public/assets/shared.js";
import { resolveEvent } from "../src/lib/event.js";
import { parsePath } from "../src/lib/parse-path.js";
import { eventCard, homeCard, textWidth } from "../src/render/card.js";
import { eventPage, homePage } from "../src/render/page.js";
import { expect } from "./harness.js";

const NOW = Date.UTC(2026, 10, 25, 15, 0);
const ORIGIN = "https://timezone.fyi";
const read = (path) => resolveEvent(parsePath(path), NOW);
const page = (path) => {
  const event = read(path);
  return eventPage(event, ORIGIN, `${ORIGIN}${event.path}/card.png`);
};
const meta = (html, key) =>
  html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1] ?? "missing";

console.log("\nThe page's head");
const html = page("/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok");
expect("doctype first", html.startsWith("<!doctype html>"), true);
expect(
  "charset before the title",
  html.indexOf('<meta charset="utf-8">') < html.indexOf("<title>"),
  true,
);
expect("viewport allows zoom", meta(html, "viewport"), "width=device-width, initial-scale=1");
expect("title", html.match(/<title>(.*?)<\/title>/)[1], "Team sync · Thursday 3 December 2026");
expect("og:title", meta(html, "og:title"), "Team sync · Thursday 3 December 2026");
expect(
  "og:description lists the times",
  meta(html, "og:description"),
  "10am–11:30am NYC · 3pm–4:30pm LON · 12am–1:30am TOK +1",
);
expect(
  "og:image is absolute",
  meta(html, "og:image"),
  "https://timezone.fyi/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok/card.png",
);
expect("og:image:width", meta(html, "og:image:width"), "1200");
expect("og:image:height", meta(html, "og:image:height"), "630");
expect("twitter:card", meta(html, "twitter:card"), "summary_large_image");
expect(
  "canonical",
  html.match(/<link rel="canonical" href="([^"]*)"/)[1],
  "https://timezone.fyi/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok",
);
expect(
  "links its calendar file",
  html.includes(
    'type="text/calendar" href="/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok/event.ics"',
  ),
  true,
);
expect(
  "an unlabelled page is titled by its times",
  page("/10:30am,pst,est").match(/<title>(.*?)<\/title>/)[1],
  "10:30am PST · 1:30pm EST",
);
expect("a live page has no calendar", page("/now,cst,pst").includes("event.ics"), false);
expect(
  "a repeating event offers webcal",
  page("/standup/weekly/2026-03-02/9:30am,nyc").includes(
    'href="webcal://timezone.fyi/standup/weekly/2026-03-02/9:30am,nyc/event.ics"',
  ),
  true,
);

console.log("\nNothing loads from another site");
const loads = (text) =>
  [...text.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*?(?:src|href)="([^"]+)"/g)].map(
    (m) => m[1],
  );
const offsite = (text) =>
  loads(text)
    .filter((u) => /^(https?:)?\/\//.test(u) && !u.startsWith(ORIGIN))
    .join(" ");
expect("event page", offsite(html), "");
expect("home page", offsite(homePage(ORIGIN)), "");
const css = readFileSync(new URL("../public/assets/app.css", import.meta.url), "utf8");
expect("stylesheet has no url() or @import", /url\(|@import/.test(css), false);

console.log("\nText from the URL is escaped");
const hostile = page("/%3Cimg%20src=x%20onerror=alert(1)%3E/10am,pst");
expect("a tag in the label can't open", hostile.includes("<img src=x"), false);
expect("…it's shown as text", hostile.includes("&lt;img src=x onerror=alert(1)&gt;"), true);
const quote = page("/a%22%20onload=%22x/10am,pst");
expect("a quote can't end an attribute", /content="[^"]*" onload=/.test(quote), false);
expect(
  "the data block can't be closed early",
  page("/%3C%2Fscript%3E/10am,pst").split("</script>").length,
  3,
);
expect(
  "an error message is escaped",
  homePage(ORIGIN, "<b>x</b>").includes("&lt;b&gt;x&lt;/b&gt;"),
  true,
);

console.log("\nThe link-preview image");
const metrics = JSON.parse(
  readFileSync(new URL("../src/fonts/inter-metrics.json", import.meta.url), "utf8"),
);
// Every character drawn as text must be in the font, or it shows as a box
function missingGlyphs(svg) {
  const text = [...svg.matchAll(/>([^<>]+)</g)]
    .map((m) => m[1])
    .join("")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return [...new Set([...text].filter((c) => !(c in metrics[700])))].join("");
}
const cards = {
  "1 zone": "/10am,nyc",
  "3 zones": "/10am,nyc,lon,tok",
  "6 zones": "/9am,sf,nyc,lon,par,ist,syd",
  "10 zones": "/9am,sf,den,chi,nyc,lon,par,ist,sin,tok,syd",
  "a labelled, dated range": "/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok",
  "a repeating event": "/standup/weekly/2026-03-02/9:30am+15m,nyc,lon",
  "24-hour": "/22:30,pst,cet",
  "a live clock": "/now,cst,pst",
};
for (const [name, path] of Object.entries(cards)) {
  const svg = eventCard(read(path));
  expect(`${name}: every character is in the font`, missingGlyphs(svg), "");
  expect(
    `${name}: 1200×630`,
    svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"'),
    true,
  );
}
expect("the home image too", missingGlyphs(homeCard()), "");
expect("no small-capital letters (the old ᴀᴍ)", /[ᴀ-ᴫ]/.test(eventCard(read("/10am,nyc"))), false);
expect(
  "10 zones: 7 cells and a count",
  eventCard(read(cards["10 zones"])).includes("+3 more"),
  true,
);
const cjk = eventCard(read("/%E4%BC%9A%E8%AD%B0-sync/2026-12-03/10am,nyc"));
expect("characters the font lacks are dropped from the label", missingGlyphs(cjk), "");
expect("…the rest of the label stays", cjk.includes(">Sync<"), true);
const tag = eventCard(read("/a%3Cb%26c/2026-12-03/10am,nyc"));
expect("the label is escaped in the SVG", tag.includes("A&lt;b&amp;c"), true);
const long = eventCard(read(`/${"very-long-label-".repeat(12)}/2026-12-03/10am,nyc`));
expect("a long label is cut with an ellipsis", /…<\/text>/.test(long), true);
expect(
  "text width: digits are wider than a colon",
  textWidth("0", 700, 100) > textWidth(":", 700, 100),
  true,
);

console.log("\nShared formatting");
expect("10:30am", clockText(630, false), "10:30am");
expect("10am drops :00", clockText(600, false), "10am");
expect("12am is midnight", clockText(0, false), "12am");
expect("12pm is noon", clockText(720, false), "12pm");
expect("24-hour pads and keeps minutes", clockText(540, true), "09:00");
expect("midnight sky wants light text", skyAt(0).dark, true);
expect("10am sky wants dark text", skyAt(600).dark, false);
expect("on the hour the sky is the hour's colours", skyAt(600).top, "#fee154");
expect("half past is halfway to the next hour's", skyAt(630).top, "#fed253");
const H = 3600000;
expect("in 3h 12m", relativeText(NOW + 3 * H + 12 * 60000, undefined, NOW), "in 3h 12m");
expect("in 8 days", relativeText(NOW + 8 * 24 * H, undefined, NOW), "in 8 days");
expect(
  "under way",
  relativeText(NOW - 5 * 60000, NOW + 25 * 60000, NOW),
  "started 5m ago, 25m left",
);
expect("over", relativeText(NOW - 2 * H, NOW - H, NOW), "ended 1h ago");

console.log("\nHow a time is drawn");
const shown = page("/2026-12-03/10:30am-1pm,nyc");
expect(
  "the page writes am/pm as one letter, set close",
  /<span class="digits">10<span class="colon">:<\/span>30<\/span><span class="ap">a<\/span>/.test(
    shown,
  ),
  true,
);
expect("…and pm as p", /<span class="ap">p<\/span>/.test(shown), true);
expect("the title keeps am/pm in full", /<title>[^<]*10:30am/.test(shown), true);
const drawn = eventCard(read("/2026-12-03/10:30pm,nyc"));
expect("the image writes pm as p", /font-weight="500"[^>]*>p<\/tspan>/.test(drawn), true);
expect("the image has no AM or PM", /\b[AP]M\b/.test(drawn), false);
expect("the home image has no panel behind the name", /<rect[^>]* rx=/.test(homeCard()), false);

console.log("\nDisplay P3");
const { SKY, SKY_P3 } = await import("../public/assets/shared.js");
expect("a P3 pair for every hour", SKY_P3.length, SKY.length);
expect(
  "every P3 component is between 0 and 1",
  SKY_P3.flat(2).every((v) => v >= 0 && v <= 1),
  true,
);
expect(
  "skyAt on the hour is the table's colour",
  skyAt(10 * 60).topP3,
  "color(display-p3 1 0.883 0.254)",
);
expect("…with the sRGB colour kept for fallback", skyAt(10 * 60).top, SKY[10][0]);
const striped = page("/2026-12-03/10am,nyc");
expect(
  "a stripe carries both palettes",
  /--top:#[0-9a-f]{6};--bottom:#[0-9a-f]{6};--top-p3:color\(display-p3 /.test(striped),
  true,
);
expect(
  "the image draws the sky with P3 values",
  eventCard(read("/2026-12-03/10am,nyc")).includes(skyAt(10 * 60).topP3Hex),
  true,
);
expect(
  "the stylesheet uses P3 where supported",
  /@supports \(color: color\(display-p3/.test(
    readFileSync(new URL("../public/assets/app.css", import.meta.url), "utf8"),
  ),
  true,
);

console.log("\nThe event page's footer");
expect("no footer on an event page", /<footer/.test(striped), false);
expect(
  "the name sits on the stripes and links home",
  /<a class="mark" href="\/">timezone.fyi<\/a>/.test(striped),
  true,
);

console.log("\nDiagonal gradients and button colours");
const { diagonal } = await import("../src/render/card.js");
// CSS 135deg over a 200×100 box at the origin: the line runs through (100, 50)
// and is (200 + 100)/√2 long, so its ends are 75 px either way on each axis
expect(
  "the image's gradient has CSS 135deg geometry",
  /x1="25.0" y1="-25.0" x2="175.0" y2="125.0"/.test(diagonal("t", 0, 0, 200, 100, "#000", "#fff")),
  true,
);
expect(
  "every image cell's gradient is diagonal",
  /x1="0" y1="0" x2="0" y2="1"/.test(eventCard(read("/2026-12-03/10am,nyc,lon"))),
  false,
);
expect(
  "no vertical gradients left in the stylesheet",
  /linear-gradient\(to bottom/.test(css),
  false,
);
const twoZones = page("/2026-12-03/10am,nyc,tok");
expect(
  "buttons start with the last zone's colours",
  twoZones.includes(`<body class="event" style="--top:${skyAt(24 * 60).top}`),
  true,
);
expect("a stripe names the text colour that reads on it", /--on:#ffffff/.test(twoZones), true);
