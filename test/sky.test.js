/**
 * Tests for the sky gradient (public/assets/sky.js): the top and the bottom
 * placed separately, the working-hours glow, and the two rules every stripe
 * keeps (a visible shift from top to bottom, between neighbouring hues).
 *
 * Run with: npm test
 */

import { glowAt, oklab, SKY, SKY_MODEL, skyAt } from "../public/assets/sky.js";
import { sunSky } from "../public/assets/sun.js";
import { expect } from "./harness.js";

// A hex colour as { L, C, h, a, b } in OKLCH and OKLab
function lch(hexColour) {
  const [L, a, b] = oklab(hexColour);
  return { L, a, b, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}
// Distance in OKLab: 0.02 is about the least difference an eye picks out
const deltaE = (x, y) => Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
const between = (x, y) => deltaE(lch(x), lch(y));
const hueGap = (x, y) => Math.abs(((((y.h - x.h) % 360) + 540) % 360) - 180);

// The sky at a local clock time in a place: [lat, lon, hours east of UTC]
const STOCKHOLM = [59.3, 18.1];
const TROMSO = [69.6, 19];
const REYKJAVIK = [64.1, -21.9];
const SINGAPORE = [1.4, 103.8];
function at([lat, lon], date, offset, clock, model) {
  const [h, m] = clock.split(":").map(Number);
  const minutes = h * 60 + m;
  const ms = Date.parse(`${date}T00:00Z`) + (minutes - offset * 60) * 60000;
  return skyAt(minutes, sunSky(ms, lat, lon), model);
}
const NO_GLOW = { ...SKY_MODEL, glowStrength: 0 };

console.log("\nThe anchors");
expect(
  "with no place, each hour is its anchor pair exactly",
  SKY.filter((pair, h) => skyAt(h * 60).top !== pair[0] || skyAt(h * 60).bottom !== pair[1]).length,
  0,
);
const anchorShift = SKY.map(([top, bottom]) => between(top, bottom));
expect(
  "the least shift among the anchors is the model's minimum, to 3 places",
  Math.min(...anchorShift).toFixed(3),
  SKY_MODEL.minDistinction.toFixed(3),
);
const anchorGap = SKY.map(([top, bottom]) => hueGap(lch(top), lch(bottom)));
expect(
  `the widest hue gap among the anchors is inside the model's (${Math.max(...anchorGap).toFixed(0)}°)`,
  Math.max(...anchorGap) <= SKY_MODEL.maxHueGap,
  true,
);

console.log("\nA mid-latitude equinox day keeps its look");
// New York on 20 March 2026 at each local hour, as the model before this one
// drew it (commit 7b6f984): [top, bottom]
const BEFORE = [
  ["#040e40", "#012252"],
  ["#012358", "#001425"],
  ["#003871", "#001322"],
  ["#003972", "#001322"],
  ["#004372", "#00182b"],
  ["#004372", "#011d34"],
  ["#016691", "#00182b"],
  ["#0d8ab0", "#063e5b"],
  ["#3bb6c5", "#0c6785"],
  ["#9cdcc7", "#2c9eb3"],
  ["#f1edb2", "#68d1ce"],
  ["#f7e88a", "#82d7cb"],
  ["#fbe469", "#94dac8"],
  ["#fee155", "#a2dec6"],
  ["#fedb53", "#c6e5b0"],
  ["#fdcf52", "#eaed90"],
  ["#fdc053", "#fce677"],
  ["#fba754", "#ffd763"],
  ["#f48457", "#fdb95d"],
  ["#d9617d", "#f38f63"],
  ["#5b2b83", "#c15b87"],
  ["#2a276c", "#63327c"],
  ["#0f1a4f", "#2d2873"],
  ["#040b3c", "#192c6a"],
];
let topDrift = 0;
let bottomDrift = 0;
BEFORE.forEach(([top, bottom], h) => {
  const now = at([40.7, -74], "2026-03-20", -4, `${h}:00`);
  topDrift = Math.max(topDrift, between(now.top, top));
  bottomDrift = Math.max(bottomDrift, between(now.bottom, bottom));
});
// Neighbouring anchors are 0.05 to 0.2 apart, so 0.04 is a small part of an
// hour's change. The top's place on its ramp is as before and only the
// space it's blended in changed; the bottom also runs 1.5° ahead of the sun.
expect(
  `no hour's top moved more than 0.015 (most: ${topDrift.toFixed(3)})`,
  topDrift < 0.015,
  true,
);
expect(
  `no hour's bottom moved more than 0.04 (most: ${bottomDrift.toFixed(3)})`,
  bottomDrift < 0.04,
  true,
);

console.log("\nThe working-hours glow");
// Stockholm on 21 December: sunrise 08:43, sunset 14:48, six hours of sun.
// The working day starts in the dark.
for (const clock of ["8:00", "8:30", "9:00"]) {
  const lit = at(STOCKHOLM, "2026-12-21", 1, clock);
  const unlit = at(STOCKHOLM, "2026-12-21", 1, clock, NO_GLOW);
  expect(
    `Stockholm in December at ${clock}: the bottom is brighter with the glow`,
    lch(lit.bottom).L > lch(unlit.bottom).L + 0.02,
    true,
  );
  // Warmer: further toward red on OKLab's green to red axis
  expect("…and warmer", lch(lit.bottom).a > lch(unlit.bottom).a + 0.02, true);
  expect("…the top is as it was", lit.top, unlit.top);
  expect("…and the stripe takes light text", lit.dark, true);
}
expect(
  "…at 8:00 that top is the blue of dawn",
  [
    lch(at(STOCKHOLM, "2026-12-21", 1, "8:00").top).L < 0.55,
    at(STOCKHOLM, "2026-12-21", 1, "8:00").top,
  ].join(),
  "true,#056f9b",
);
// At 10:00 the sun is up, and from sunset to 17:30 the long northern dusk
// keeps the bottom brighter than the glow, which only ever brightens
for (const clock of ["10:00", "15:00", "17:00"])
  expect(
    `Stockholm in December at ${clock}: daylight or dusk, so the glow adds nothing`,
    at(STOCKHOLM, "2026-12-21", 1, clock).bottom,
    at(STOCKHOLM, "2026-12-21", 1, clock, NO_GLOW).bottom,
  );
// Tromsø on 21 December: the sun never rises, and is 3° down at noon
for (const clock of ["8:30", "17:30"]) {
  const lit = at(TROMSO, "2026-12-21", 1, clock);
  const unlit = at(TROMSO, "2026-12-21", 1, clock, NO_GLOW);
  expect(
    `Tromsø in December at ${clock}: the bottom is brighter with the glow`,
    lch(lit.bottom).L > lch(unlit.bottom).L + 0.08,
    true,
  );
  expect("…and warmer", lch(lit.bottom).a > lch(unlit.bottom).a + 0.02, true);
  expect("…the top is as it was, and dim", lit.top === unlit.top && lch(lit.top).L < 0.5, true);
  expect("…and the stripe takes light text", lit.dark, true);
}
for (const clock of ["10:00", "15:00"])
  expect(
    `Tromsø in December at ${clock}: twilight already lights the bottom, so the glow adds nothing`,
    at(TROMSO, "2026-12-21", 1, clock).bottom,
    at(TROMSO, "2026-12-21", 1, clock, NO_GLOW).bottom,
  );
expect(
  "the glow is stronger in Tromsø's polar night than in Stockholm",
  glowAt(600, sunSky(Date.parse("2026-12-21T09:00Z"), ...TROMSO)) >
    glowAt(600, sunSky(Date.parse("2026-12-21T09:00Z"), ...STOCKHOLM)),
  true,
);
expect(
  "…where it is at full strength",
  glowAt(600, sunSky(Date.parse("2026-12-21T09:00Z"), ...TROMSO)),
  SKY_MODEL.glowStrength,
);
const sto = (clock) =>
  glowAt(
    ...((c) => [c[0] * 60 + c[1]])(clock.split(":").map(Number)),
    sunSky(Date.parse("2026-12-21T12:00Z"), ...STOCKHOLM),
  );
expect("none at 07:00, before the working day", sto("7:00"), 0);
expect("part at 07:40, on the soft edge", sto("7:40") > 0 && sto("7:40") < sto("8:00"), true);
expect(
  "all of it from 08:00 to 18:00",
  sto("8:00") === sto("13:00") && sto("13:00") === sto("18:00"),
  true,
);
expect("part at 18:20", sto("18:20") > 0 && sto("18:20") < sto("18:00"), true);
expect("none at 19:00", sto("19:00"), 0);
expect(
  "Stockholm in June at 13:00 is unchanged by the glow",
  JSON.stringify(at(STOCKHOLM, "2026-06-21", 2, "13:00")),
  JSON.stringify(at(STOCKHOLM, "2026-06-21", 2, "13:00", NO_GLOW)),
);
let tropics = 0;
let newYork = 0;
for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 20 * 60000) {
  const minutes = (ms / 60000) % 1440;
  tropics = Math.max(tropics, glowAt(minutes, sunSky(ms, ...SINGAPORE)));
  newYork = Math.max(newYork, glowAt(minutes, sunSky(ms, 40.7, -74)));
}
expect("Singapore never glows, any hour of the year", tropics, 0);
expect(`New York barely does (most: ${newYork.toFixed(2)} of 1)`, newYork < 0.15, true);

console.log("\nEvery stripe: a visible shift, between neighbouring hues, and no jumps");
// Colours the sky doesn't have, which blends of far-apart hues used to make
const olive = (c) => c.h >= 80 && c.h <= 140 && c.L < 0.72 && c.C > 0.02; // dark yellow-green
const mauve = (c) => c.h >= 290 && c.C < 0.06 && c.L > 0.4 && c.L < 0.78; // greyed pink-purple
const grey = (c) => c.C < 0.03 && c.L > 0.35 && c.L < 0.8;
const LATITUDES = [
  -70, -60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 59.3, 60, 64.1, 66.6, 69.6, 70, 78.2,
  80,
];
let least = 9;
let widest = 0;
let step = 0;
let muddy = 0;
let unreadable = 0;
for (const lat of LATITUDES) {
  let before;
  // The whole of 2026 in 5-minute steps, on the meridian 10° east, where the
  // local clock is 40 minutes ahead of UTC
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 5 * 60000) {
    const sky = skyAt((ms / 60000 + 40) % 1440, sunSky(ms, lat, 10));
    const top = lch(sky.top);
    const bottom = lch(sky.bottom);
    least = Math.min(least, deltaE(top, bottom));
    // The hue rule is for colours that have a hue: a little over the
    // model's neutralChroma. Rounding a pale colour to 8 bits a channel can
    // move its hue a degree or two.
    if (top.C > 0.045 && bottom.C > 0.045) widest = Math.max(widest, hueGap(top, bottom));
    if (before) step = Math.max(step, deltaE(top, before[0]), deltaE(bottom, before[1]));
    before = [top, bottom];
    for (const c of [top, bottom]) if (olive(c) || mauve(c) || grey(c)) muddy++;
    // The text colour chosen must have at least 3:1 against the middle
    const mid = [1, 3, 5].map((i) => {
      const v =
        (parseInt(sky.top.slice(i, i + 2), 16) + parseInt(sky.bottom.slice(i, i + 2), 16)) / 510;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    const l = 0.2126 * mid[0] + 0.7152 * mid[1] + 0.0722 * mid[2];
    if ((sky.dark ? 1.05 / (l + 0.05) : (l + 0.05) / 0.05) < 3) unreadable++;
  }
}
// 0.06 is the rule. A bottom at the edge of what sRGB can show is pulled
// back inside after it's moved, which costs up to 0.006.
expect(
  `top and bottom are never closer than 0.054, 21 latitudes, all year (least: ${least.toFixed(4)})`,
  least >= 0.054,
  true,
);
expect(
  `…nor further apart in hue than 90°, give or take 2° (widest: ${widest.toFixed(1)}°)`,
  widest <= SKY_MODEL.maxHueGap + 2,
  true,
);
// The anchors themselves move 0.059 in 5 minutes at their fastest, at dusk
expect(
  `no colour moves more than 0.065 in 5 minutes (most: ${step.toFixed(4)})`,
  step < 0.065,
  true,
);
expect("no olive, mauve or grey anywhere in that year", muddy, 0);
expect("the text colour always has 3:1 against the middle of its stripe", unreadable, 0);

console.log("\nThe days that used to go olive or mauve");
// Minute by minute through the days named, both colours
function muddyIn(place, offset, from, days) {
  let count = 0;
  for (
    let ms = Date.parse(`${from}T00:00Z`);
    ms < Date.parse(`${from}T00:00Z`) + days * 86400000;
    ms += 60000
  ) {
    const sky = skyAt((ms / 60000 + offset * 60) % 1440, sunSky(ms, place[0], place[1]));
    for (const c of [lch(sky.top), lch(sky.bottom)]) if (olive(c) || mauve(c) || grey(c)) count++;
  }
  return count;
}
expect(
  "Tromsø as the polar night begins, 15 November to 5 December",
  muddyIn(TROMSO, 1, "2026-11-15", 20),
  0,
);
expect("…and as it ends, 10 to 25 January", muddyIn(TROMSO, 1, "2026-01-10", 15), 0);
expect("Reykjavik's white nights, 1 June to 10 July", muddyIn(REYKJAVIK, 0, "2026-06-01", 40), 0);
expect("Tromsø as the midnight sun begins, 10 to 25 May", muddyIn(TROMSO, 2, "2026-05-10", 15), 0);
const whiteNight = at(REYKJAVIK, "2026-06-21", 0, "1:28"); // solar midnight
expect(
  "Reykjavik at solar midnight in June is violet, with colour in it",
  [lch(whiteNight.top).h > 270 && lch(whiteNight.top).h < 330, lch(whiteNight.top).C > 0.08].join(),
  "true,true",
);
const polarNoon = at(TROMSO, "2026-12-21", 1, "11:42"); // solar noon
expect(
  "Tromsø at solar noon in December is violet over pink, with colour in both",
  [
    lch(polarNoon.top).h > 270 && lch(polarNoon.top).h < 330,
    lch(polarNoon.bottom).h > 300,
    Math.min(lch(polarNoon.top).C, lch(polarNoon.bottom).C) > 0.07,
  ].join(),
  "true,true,true",
);
