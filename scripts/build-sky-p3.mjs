// Builds the Display P3 version of the sky gradient (SKY_P3 in
// public/assets/shared.js) from the sRGB one (SKY).
//
// Each colour keeps its OKLCH lightness and hue, and its chroma is raised by
// CHROMA_GAIN, then lowered again as far as it takes to fit inside Display P3.
// The sRGB colours stay as they are, for screens and images without P3.
//
// Run with: node scripts/build-sky-p3.mjs   (prints the table to paste in)
import { SKY } from "../public/assets/shared.js";

const CHROMA_GAIN = 1.3;

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const mul = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

// Linear sRGB and linear Display P3 to and from CIE XYZ (D65)
const SRGB_TO_XYZ = [
  [0.4123907992659595, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151036, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559185, 0.11919477979462599, 0.9505321522496606],
];
const XYZ_TO_P3 = [
  [2.4934969119414254, -0.9313836179191239, -0.40271078445071684],
  [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
  [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
];
// XYZ (D65) and OKLab, by way of LMS
const XYZ_TO_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const OKLAB_TO_LMS = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];

const hexToOklab = (hex) => {
  const rgb = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  return mul(LMS_TO_OKLAB, mul(XYZ_TO_LMS, mul(SRGB_TO_XYZ, rgb)).map(Math.cbrt));
};
const oklabToLinearP3 = (lab) =>
  mul(
    XYZ_TO_P3,
    mul(
      LMS_TO_XYZ,
      mul(OKLAB_TO_LMS, lab).map((v) => v ** 3),
    ),
  );

const inGamut = (rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

function p3(hex) {
  const [l, a, b] = hexToOklab(hex);
  const c = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  const at = (chroma) => oklabToLinearP3([l, chroma * Math.cos(h), chroma * Math.sin(h)]);
  // Largest chroma up to the target that fits, by bisection
  let lo = 0;
  let hi = c * CHROMA_GAIN;
  if (!inGamut(at(hi))) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  return at(hi).map((v) => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 1000) / 1000);
}

const rows = SKY.map(
  ([top, bottom]) => `  [${JSON.stringify(p3(top))}, ${JSON.stringify(p3(bottom))}],`,
);
console.log(`export const SKY_P3 = [\n${rows.join("\n")}\n];`);
