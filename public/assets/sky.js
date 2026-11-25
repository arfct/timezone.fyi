// The sky gradient: two colours, top and bottom, for the sun's state at a
// place. Shared by the Worker (bundled) and the browser (a static module).
//
// The top is the upper sky and the bottom is the light along the horizon.
// Each has its own ramp of 24 colours and its own place on it, so one can be
// dim while the other still glows. Colours are held and blended in OKLCH
// (lightness, chroma, hue), where a blend keeps its colour and moves through
// the hues in between, not through grey.
import { CIVIL, hourAngleAt, SUNRISE } from "./sun.js";

// The anchors: two colours per hour, top then bottom, from midnight, drawn
// for a day with sunrise near 6am and sunset near 6pm. Noon is the yellow to
// pale green that 10am used to be; orange starts at 4pm and sunset is 6pm to
// 8pm. Every colour the page shows is one of these or lies between two.
export const SKY = [
  ["#012459", "#001322"],
  ["#003972", "#001322"],
  ["#003972", "#001322"],
  ["#004372", "#00182b"],
  ["#004372", "#011d34"],
  ["#016792", "#00182b"],
  ["#07729f", "#042c47"],
  ["#12a1c0", "#07506e"],
  ["#74d4cc", "#1386a6"],
  ["#efeebc", "#61d0cf"],
  ["#f6e98f", "#7fd6cb"],
  ["#fbe46a", "#93dac8"],
  ["#fee154", "#a3dec6"],
  ["#fedb53", "#c6e5b0"],
  ["#fdd052", "#e8ed92"],
  ["#fdc352", "#fbe87a"],
  ["#fdae56", "#ffdc64"],
  ["#f68e4c", "#ffc65e"],
  ["#ee6b74", "#f79a5c"],
  ["#b44e8e", "#ec7a70"],
  ["#4a2481", "#b9558b"],
  ["#192861", "#372074"],
  ["#040b3c", "#233072"],
  ["#040b3c", "#012459"],
];

// Every number the model uses. Angles are degrees, clock times are minutes
// after midnight.
export const SKY_MODEL = {
  // Where on the ramps ("palette hour", 0 to 24) the sun's height puts the
  // sky: [elevation, morning, evening]. Astronomical twilight (18° below) is
  // the last of the night's blue, civil twilight (6° below) is dawn and
  // dusk, the horizon is sunrise and sunset. A sun that never gets 30° up
  // stops short of full midday; one that never gets 30° down, of full night.
  marks: [
    [-30, 0, 24],
    [-18, 4, 21],
    [CIVIL, 5.5, 19.5],
    [SUNRISE, 6.5, 18.5],
    [2, 9, 15.5],
    [30, 12, 12],
  ],
  // The horizon is lit from further round the Earth than the sky overhead:
  // it brightens before the top at dawn and holds its light after it at
  // dusk. The bottom is coloured for a sun this much higher than it is.
  // (The anchors already draw the bottom about an hour behind the top.)
  horizonLead: 1.5,
  // Where morning and evening colours meet away from full midday or full
  // night (a winter noon, a white night), one fades into the other around
  // that moment. The fade lasts this much hour angle either side (90° is six
  // hours) when the sides meet at sunrise and sunset colours or darker, and
  // less as they meet nearer midday or midnight: by the square of the
  // distance at noon, so a winter noon's two yellows meet quickly and the
  // morning's blue is gone before the evening's orange arrives; in
  // proportion at midnight, where both sides are dark and a slow fade keeps
  // each minute's step small.
  meetSpan: 90,
  // Such a fade goes one of two ways round the colour wheel: through the
  // day's hues (green, yellow) or through the night's (blue, violet, pink).
  // The day's way is right for two colours of the same family, two yellows
  // at a winter noon; between a morning blue and an evening orange it would
  // pass through greens the sky doesn't have. So it is taken only when the
  // two are within this much in hue, and the night's way otherwise.
  dayWayWithin: 70,
  // A fade the night's way between colours more than hazeFrom apart in hue
  // would pass through violets and pinks stronger than the sky's. Its middle
  // loses up to hazeDepth of its chroma and rises toward hazeLight, like
  // haze; full effect when the two are opposite (180°) or further.
  hazeFrom: 70,
  hazeDepth: 0.3,
  hazeLight: 0.86,
  // Working hours, local clock time, and the length of the soft edge outside
  // each end.
  workFrom: 8 * 60,
  workTo: 18 * 60,
  workRamp: 45,
  // The glow that stands in for daylight along the bottom in working hours:
  // the bottom ramp at this palette hour (between the 8pm and 9pm anchors,
  // the last warm light of dusk), and how far toward it the bottom goes at
  // most.
  glowHour: 20.4,
  glowStrength: 0.85,
  // The glow's strength by the hours the sun is up that day: none from
  // glowNoneAt (the length of the working day, so daylight can cover it),
  // full at glowFullAt and under.
  glowNoneAt: 10,
  glowFullAt: 4,
  // The glow only ever brightens, so it is there only while the sun is down:
  // it fades out as the bottom's own lightness comes within this much of the
  // glow's.
  glowSoft: 0.12,
  // Top and bottom must differ by at least this OKLab distance, or the
  // stripe reads as flat. It is the least among the 24 anchors (9pm, 0.060),
  // so no anchor is changed by it.
  minDistinction: 0.06,
  // Top and bottom must be neighbours on the colour wheel: at most this far
  // apart in hue. The widest anchor pair is 88° (9am, cream over aqua).
  maxHueGap: 90,
  // A colour with less chroma than this has no hue to speak of, so the hue
  // rule lets go of it: fully at half this chroma.
  neutralChroma: 0.04,
  // Display P3 has room for more colour: chroma is raised by this factor
  // there, as far as fits.
  p3Chroma: 1.3,
};

const RAD = Math.PI / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

// --- Colour -----------------------------------------------------------------

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

// "#rrggbb" to OKLab [L, a, b] (Björn Ottosson's matrices)
export function oklab(hexColour) {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hexColour.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// From OKLab's cone responses to linear sRGB and to linear Display P3
const TO_SRGB = [
  4.0767416621, -3.3077115913, 0.2309699292, -1.2684380046, 2.6097574011, -0.3413193965,
  -0.0041960863, -0.7034186147, 1.707614701,
];
const TO_P3 = [
  3.1277689872, -2.2571357962, 0.129366809, -1.0910090478, 2.4133317587, -0.3223227108,
  -0.026010813, -0.5080413259, 1.5340521389,
];
function linearRgb(L, a, b, to) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    to[0] * l + to[1] * m + to[2] * s,
    to[3] * l + to[4] * m + to[5] * s,
    to[6] * l + to[7] * m + to[8] * s,
  ];
}
const fits = (c) => c.every((v) => v >= -0.0005 && v <= 1.0005);

// The most chroma up to C that fits sRGB or Display P3 at this lightness and
// hue
function fitChroma(L, C, h, to) {
  const x = Math.cos(h * RAD);
  const y = Math.sin(h * RAD);
  if (fits(linearRgb(L, C * x, C * y, to))) return C;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (fits(linearRgb(L, mid * x, mid * y, to))) lo = mid;
    else hi = mid;
  }
  return lo;
}

// An OKLCH colour as [r, g, b] from 0 to 1 in sRGB or Display P3, with up to
// `gain` times its chroma where that fits; lightness and hue stay.
function encode([L, C, h], to, gain = 1) {
  const c = fitChroma(L, C * gain, h, to);
  return linearRgb(L, c * Math.cos(h * RAD), c * Math.sin(h * RAD), to).map((v) =>
    toGamma(clamp01(v)),
  );
}

const hex = (c) =>
  `#${c
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

// WCAG relative luminance of a gamma-encoded [r, g, b] from 0 to 1
function luminance(c) {
  const [r, g, b] = c.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The short way round from hue a to hue b, −180 to 180
const turnTo = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

// A straight line through OKLab from one [L, C, hue] colour to another
function mix(from, to, t) {
  const a = lerp(from[1] * Math.cos(from[2] * RAD), to[1] * Math.cos(to[2] * RAD), t);
  const b = lerp(from[1] * Math.sin(from[2] * RAD), to[1] * Math.sin(to[2] * RAD), t);
  return [
    lerp(from[0], to[0], t),
    Math.hypot(a, b),
    from[2] + turnTo(from[2], Math.atan2(b, a) / RAD),
  ];
}

// --- The ramps --------------------------------------------------------------

// The top ramp and the bottom ramp: the anchors as [L, C, hue], plus the
// first again at the end to close the day. The hue is unwound: each step is
// the short way round from the one before, so it runs on from midnight's
// blue through green, yellow, red and purple and ends one whole turn below
// where it began. Two points of a ramp are then joined through the hues the
// day itself passes between them.
const RAMPS = [0, 1].map((layer) => {
  let before;
  const stops = SKY.map((pair) => {
    const [L, a, b] = oklab(pair[layer]);
    let h = Math.atan2(b, a) / RAD;
    if (before !== undefined) h = before + turnTo(before, h);
    before = h;
    return [L, Math.hypot(a, b), h];
  });
  stops.push([stops[0][0], stops[0][1], stops[0][2] - 360]);
  return stops;
});

// A ramp's colour at a palette hour, 0 to 24. Between two anchors it moves
// in a straight line through OKLab: neighbours on a ramp are neighbours in
// hue, so the line keeps its colour.
function rampAt(layer, hour) {
  const i = Math.min(23, Math.floor(hour));
  const from = RAMPS[layer][i];
  return hour === i ? from.slice() : mix(from, RAMPS[layer][i + 1], hour - i);
}

// --- From the sun to a place on the ramps -----------------------------------

// Palette hour for the sun standing at an elevation; side 1 is the morning,
// 2 the evening
function markAt(marks, elevation, side) {
  if (elevation <= marks[0][0]) return marks[0][side];
  for (let i = 1; i < marks.length; i++) {
    if (elevation <= marks[i][0]) {
      const t = (elevation - marks[i - 1][0]) / (marks[i][0] - marks[i - 1][0]);
      return lerp(marks[i - 1][side], marks[i][side], t);
    }
  }
  return marks[marks.length - 1][side];
}

// in: the sun's state (sunSky in sun.js), how many degrees higher this layer
//     sees the sun, and the model
// out: [morning, evening, evenings, turnMorning, turnEvening]. morning and
//      evening are the palette hours on each side of the day: the marks hold
//      at their events (dawn, sunrise, noon, …) and the hour angle runs in a
//      straight line between them, so every day passes through the ramp in
//      order, stretched or squeezed to its length. evenings, 0 to 1, is how
//      much of the evening's colour to use: 0 before noon and 1 after, with a
//      fade around noon or midnight when the two sides don't meet there.
//      turnMorning and turnEvening are the palette hours the sides have at
//      the nearest solar noon or midnight, fixed for the hours either side.
export function paletteHours(sun, lead = 0, model = SKY_MODEL) {
  const { marks, meetSpan } = model;
  const { lat, declination, hourAngle } = sun;
  const high = 90 - Math.abs(lat - declination) + lead; // elevation at solar noon
  const low = Math.abs(lat + declination) - 90 + lead; // and at solar midnight
  const rise = hourAngleAt(SUNRISE - lead, lat, declination);
  const dusk = hourAngleAt(CIVIL - lead, lat, declination);
  const h = Math.abs(hourAngle);
  const branch = (side) => {
    const points = [[0, markAt(marks, high, side)]];
    if (rise > 0 && rise < 180) points.push([rise, marks[3][side]]);
    if (dusk > 0 && dusk < 180) points.push([dusk, marks[2][side]]);
    points.push([180, markAt(marks, low, side)]);
    for (let i = 1; i < points.length; i++) {
      if (h <= points[i][0]) {
        const t = (h - points[i - 1][0]) / (points[i][0] - points[i - 1][0]);
        return lerp(points[i - 1][1], points[i][1], t);
      }
    }
    return points[points.length - 1][1];
  };
  const noonSpan = meetSpan * clamp01((12 - markAt(marks, high, 1)) / 5.5) ** 2;
  const nightSpan = meetSpan * clamp01(markAt(marks, low, 1) / 5.5);
  let evenings = hourAngle > 0 ? 1 : 0;
  if (h < noonSpan) evenings = 0.5 + hourAngle / noonSpan / 2;
  else if (180 - h < nightSpan) {
    const past = hourAngle > 0 ? h - 180 : 180 - h; // degrees after midnight
    evenings = 0.5 - past / nightSpan / 2;
  }
  // The sun's height at the nearest turn of the day, from the declination
  // then, which doesn't move while a fade around that turn is under way
  const turn =
    (h < 90 ? 90 - Math.abs(lat - sun.turnDeclination) : Math.abs(lat + sun.turnDeclination) - 90) +
    lead;
  return [branch(1), branch(2), evenings, markAt(marks, turn, 1), markAt(marks, turn, 2)];
}

// One layer's colour (0 the top, 1 the bottom) for its palette hours, as
// [L, C, hue]. `night` is which way round the wheel morning's colour and
// evening's are joined when one fades into the other.
function layerAt(layer, [morning, evening, evenings], night, model) {
  const a = rampAt(layer, morning);
  if (evenings <= 0) return a;
  const b = rampAt(layer, evening);
  if (evenings >= 1) return b;
  // The day's way is between near colours: a straight line, as on the ramp
  if (!night) return mix(a, b, evenings);
  // The night's way: the hue is led round through blue, violet and pink at
  // an even pace, with haze in the middle of a long way round
  const haze =
    model.hazeDepth *
    4 *
    evenings *
    (1 - evenings) *
    clamp01((360 - (a[2] - b[2]) - model.hazeFrom) / (180 - model.hazeFrom));
  const L = lerp(a[0], b[0], evenings);
  return [
    L + (model.hazeLight - L) * haze,
    lerp(a[1], b[1], evenings) * (1 - haze),
    lerp(a[2], b[2], evenings) + 360 * evenings,
  ];
}

// How much working-hours glow the bottom gets, 0 to 1, before its own
// lightness is considered: how short the day is, times the clock (inside
// working hours).
export function glowAt(minutes, sun, model = SKY_MODEL) {
  const m = model;
  const daylight = (hourAngleAt(SUNRISE, sun.lat, sun.declination) * 2) / 15; // hours
  const short = clamp01((m.glowNoneAt - daylight) / (m.glowNoneAt - m.glowFullAt));
  if (!short) return 0;
  const clockTime = ((minutes % 1440) + 1440) % 1440;
  const working =
    smooth((clockTime - m.workFrom) / m.workRamp + 1) *
    smooth((m.workTo - clockTime) / m.workRamp + 1);
  return m.glowStrength * short * working;
}

// The bottom colour moved straight away from the top until the two are `least`
// apart in OKLab, as [L, C, hue] within sRGB. Unchanged when they already are.
function apart(top, bottom, least) {
  const x = Math.cos(top[2] * RAD);
  const y = Math.sin(top[2] * RAD);
  const t = [top[0], top[1] * x, top[1] * y];
  const d = [
    bottom[0] - t[0],
    bottom[1] * Math.cos(bottom[2] * RAD) - t[1],
    bottom[1] * Math.sin(bottom[2] * RAD) - t[2],
  ];
  const far = Math.hypot(d[0], d[1], d[2]);
  if (far >= least) return bottom;
  // Straight away from the top has no direction when the two are the same
  // colour, and swings round fast when they nearly are: a bottom that passes
  // through the top's colour would jump from one side to the other. So a
  // little of one fixed direction is added, more the closer they are: toward
  // the next hue round from the top's (from blue, toward violet). The bottom
  // then swings past the top on that side.
  const lean = (least / 2) * (1 - far / least);
  d[1] -= y * lean;
  d[2] += x * lean;
  const k = least / Math.hypot(d[0], d[1], d[2]);
  const a = t[1] + d[1] * k;
  const b = t[2] + d[2] * k;
  const L = clamp01(t[0] + d[0] * k);
  const h = Math.atan2(b, a) / RAD;
  return [L, fitChroma(L, Math.hypot(a, b), h, TO_SRGB), h];
}

// in: minutes after midnight, local clock time; and, where the place is
//     known, the sun's state there from sunSky (sun.js). With it the colours
//     follow the sun, and the clock is only used for the working-hours glow.
//     Without it, both colours are the ramps at the clock's hour.
// out: { top, bottom } gradient colours in sRGB hex; topP3 and bottomP3, the
//      same in CSS Display P3; topP3Hex and bottomP3Hex, the P3 values written
//      as hex for the P3-tagged image; and `dark`: true when light text reads
//      better.
export function skyAt(minutes, sun, model = SKY_MODEL) {
  let top;
  let bottom;
  if (sun) {
    const hours = paletteHours(sun, 0, model);
    // Which way round the wheel a fade between morning and evening goes
    // (dayWayWithin). It is chosen from the top's colours at the nearest
    // turn of the day, once for that turn and for both layers, so a hue
    // can't change sides halfway through a fade and the bottom can't go the
    // other way round from the top.
    const night = rampAt(0, hours[3])[2] - rampAt(0, hours[4])[2] > model.dayWayWithin;
    top = layerAt(0, hours, night, model);
    bottom = layerAt(1, paletteHours(sun, model.horizonLead, model), night, model);
    let glow = glowAt(minutes, sun, model);
    if (glow > 0) {
      const to = rampAt(1, model.glowHour);
      glow *= smooth((to[0] - bottom[0]) / model.glowSoft);
      bottom = [
        lerp(bottom[0], to[0], glow),
        lerp(bottom[1], to[1], glow),
        bottom[2] + turnTo(bottom[2], to[2]) * glow,
      ];
    }
  } else {
    const hour = (((minutes / 60) % 24) + 24) % 24;
    top = rampAt(0, hour);
    bottom = rampAt(1, hour);
  }

  // Both colours as sRGB can show them, before they're compared
  top[1] = fitChroma(top[0], top[1], top[2], TO_SRGB);
  bottom[1] = fitChroma(bottom[0], bottom[1], bottom[2], TO_SRGB);

  // Neighbouring hues only: the bottom's hue is turned back toward the top's
  // until the two are within maxHueGap. A colour near grey is let off.
  const colour = clamp01((Math.min(top[1], bottom[1]) / model.neutralChroma) * 2 - 1);
  const gap = turnTo(top[2], bottom[2]);
  const most = lerp(180, model.maxHueGap, colour);
  if (Math.abs(gap) > most) bottom[2] = top[2] + Math.sign(gap) * most;

  // A visible shift: if the two are closer than minDistinction, the bottom
  // moves straight away from the top until they aren't. Done twice, because
  // the first move can leave what sRGB can show and be pulled back.
  for (let pass = 0; pass < 2; pass++) bottom = apart(top, bottom, model.minDistinction);

  const rgbTop = encode(top, TO_SRGB);
  const rgbBottom = encode(bottom, TO_SRGB);
  const p3Top = encode(top, TO_P3, model.p3Chroma);
  const p3Bottom = encode(bottom, TO_P3, model.p3Chroma);
  // Text sits around the middle of the gradient. Light text wins when its
  // contrast against the middle colour is higher than dark text's.
  const l = luminance(rgbTop.map((v, i) => (v + rgbBottom[i]) / 2));
  const css = (c) => `color(display-p3 ${c.map((v) => +v.toFixed(4)).join(" ")})`;
  return {
    top: hex(rgbTop),
    bottom: hex(rgbBottom),
    topP3: css(p3Top),
    bottomP3: css(p3Bottom),
    // P3 components written as a hex colour, for an image tagged as Display P3
    topP3Hex: hex(p3Top),
    bottomP3Hex: hex(p3Bottom),
    dark: 1.05 / (l + 0.05) > (l + 0.05) / 0.05,
  };
}
