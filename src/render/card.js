// The link-preview image for an event, as an SVG string, 1200×630. One cell
// per zone, filled with the sky gradient for the sun there at that moment
// (for the clock time, where the zone has no place).
// Rasterised by the og-svg Worker; see worker.js. The sky colours are written
// as Display P3 values, and worker.js tags the PNG as Display P3.
import { clock, dateText, SKY, skyAt } from "../../public/assets/shared.js";
import metrics from "../fonts/inter-metrics.json" with { type: "json" };

export const WIDTH = 1200;
export const HEIGHT = 630;
const MAX_CELLS = 8;
const INK_DARK = "#0d1117";
const HEADER_FILL = "#121212"; // Quantum's dark background

// Only characters the bundled Inter subset has: anything else would draw as an
// empty box, so it's dropped.
const drawable = (text) => [...String(text ?? "")].filter((c) => c in metrics[700]).join("");

const xml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// A gradient across a box at 135°, from the top-left corner to the bottom-
// right, with the same geometry as CSS's linear-gradient(135deg, …) so the
// image and the page match: the line runs through the centre, and its ends
// are where the lines through the corners at right angles to it cross it.
export function diagonal(id, x, y, w, h, top, bottom) {
  const half = (w + h) / 4; // (w·sin45° + h·cos45°) / 2, along a unit (½√2, ½√2)
  const cx = x + w / 2;
  const cy = y + h / 2;
  const f = (n) => n.toFixed(1);
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - half)}" y1="${f(cy - half)}" x2="${f(cx + half)}" y2="${f(cy + half)}">` +
    `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`
  );
}

// Width of `text` in Inter at `weight` (500 or 700) and `size` px
export function textWidth(text, weight, size) {
  let em = 0;
  for (const c of text) em += metrics[weight][c] ?? 0.6;
  return em * size;
}

// A run of pieces, each { text, scale, weight }, laid out on one baseline
const piecesWidth = (pieces, size) =>
  pieces.reduce(
    (sum, p) =>
      sum + textWidth(p.text, p.weight ?? 700, size * (p.scale ?? 1)) + (p.dx ?? 0) * size,
    0,
  );

function tspans(pieces, size) {
  return pieces
    .map(
      (p) =>
        `<tspan font-size="${(size * (p.scale ?? 1)).toFixed(1)}" font-weight="${p.weight ?? 700}"` +
        `${p.opacity ? ` fill-opacity="${p.opacity}"` : ""}${p.dx ? ` dx="${(p.dx * size).toFixed(1)}"` : ""}>${xml(p.text)}</tspan>`,
    )
    .join("");
}

// "10:30" + a small "a", set close; 24-hour times have no suffix. Times are
// Inter Medium, whose contextual alternates centre the colon on the digits.
const TIME_WEIGHT = 500;
function timePieces(minutes, h24) {
  const c = clock(minutes, h24);
  const pieces = [{ text: c.digits, weight: TIME_WEIGHT }];
  if (c.suffix)
    pieces.push({ text: c.suffix[0], scale: 0.5, weight: 500, opacity: 0.72, dx: 0.02 });
  return pieces;
}

const signed = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

// The lines of text in one zone's cell
function cellLines(z, event) {
  const start = timePieces(z.minutes, event.h24);
  let time = [start];
  if (z.endMinutes !== undefined) {
    const end = timePieces(z.endMinutes, event.h24);
    // "10 – 11:30a": one suffix when both ends share it
    const shared = start[1] && end[1] && start[1].text === end[1].text;
    time = [[...(shared ? [start[0]] : start), { text: " – ", weight: 500, opacity: 0.6 }, ...end]];
    time.split = [[...start, { text: " –", weight: 500, opacity: 0.6 }], end];
  }
  const notes = [];
  if (z.dayOffset) notes.push(`${dateText(z.wall)} (${signed(z.dayOffset)})`);
  else if (z.endDayOffset) notes.push(`ends ${dateText(z.endWall)}`);
  notes.push(z.offsetText);
  return { name: drawable(z.name), time, note: notes.join(" · ") };
}

// The largest time size that fits a cell `w` wide and `h` tall, and the rows
// at that size: a range splits onto two rows when one would be too small.
function fit(lines, w, h) {
  const inner = w * 0.84;
  const cap = Math.min(h * 0.36, 168);
  let rows = lines.time;
  let size = Math.min(cap, inner / piecesWidth(rows[0], 1));
  if (rows.split && size < cap * 0.62) {
    rows = rows.split;
    size = Math.min(cap * 0.8, inner / Math.max(...rows.map((r) => piecesWidth(r, 1))));
  }
  return { rows, size };
}

// `shared` is the time, name and note sizes every cell in the row uses, so
// the times line up across the image
function cell(z, event, i, x, y, w, h, shared) {
  const sky = skyAt(z.minutes, z.sun);
  const ink = sky.dark ? "#ffffff" : INK_DARK;
  const lines = cellLines(z, event);
  const inner = w * 0.84;
  const { rows } = fit(lines, w, h);
  const size = shared.size;
  const nameSize = Math.min(shared.nameSize, inner / textWidth(lines.name, 500, 1));
  const noteSize = Math.min(shared.noteSize, inner / textWidth(lines.note, 500, 1));

  // Stack: name, time row(s), note. Inter's capitals are 0.73 em tall.
  const CAP = 0.73;
  const gap = size * 0.3;
  const lineGap = size * 0.3;
  const block =
    nameSize * CAP +
    gap +
    rows.length * size * CAP +
    (rows.length - 1) * lineGap +
    gap * 0.92 +
    noteSize * CAP;
  const nameBaseline = y + (h - block) / 2 + nameSize * CAP;
  const timeBaseline = (k) => nameBaseline + gap + size * CAP + k * (size * CAP + lineGap);
  const noteBaseline = timeBaseline(rows.length - 1) + gap * 0.92 + noteSize * CAP;
  const cx = (x + w / 2).toFixed(1);
  return [
    diagonal(`g${i}`, x, y, w, h, sky.topP3Hex, sky.bottomP3Hex),
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w + 0.5).toFixed(1)}" height="${(h + 0.5).toFixed(1)}" fill="url(#g${i})"/>`,
    `<g fill="${ink}" text-anchor="middle" font-family="Inter">`,
    `<text x="${cx}" y="${nameBaseline.toFixed(1)}" font-size="${nameSize.toFixed(1)}" font-weight="500" fill-opacity="0.74" letter-spacing="${(nameSize * 0.04).toFixed(1)}">${xml(lines.name)}</text>`,
    ...rows.map(
      (row, k) => `<text x="${cx}" y="${timeBaseline(k).toFixed(1)}">${tspans(row, size)}</text>`,
    ),
    `<text x="${cx}" y="${noteBaseline.toFixed(1)}" font-size="${noteSize.toFixed(1)}" font-weight="500" fill-opacity="0.66">${xml(lines.note)}</text>`,
    "</g>",
  ].join("");
}

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Shortens `text` with an ellipsis until it fits `max` px
function truncate(text, weight, size, max) {
  if (textWidth(text, weight, size) <= max) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, weight, size) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// in: a resolved event
// out: an SVG document
export function eventCard(event) {
  const label = capitalise(drawable(event.label ?? "").trim());
  const dateLine = event.live ? "Live clock" : event.floating ? "" : event.dateText;
  const headerHeight = label ? (dateLine ? 172 : 128) : dateLine ? 92 : 0;

  const zones = event.zones.slice(0, event.zones.length > MAX_CELLS ? MAX_CELLS - 1 : MAX_CELLS);
  const more = event.zones.length - zones.length;
  const count = zones.length + (more ? 1 : 0);
  const rowCount = count <= 4 ? 1 : 2;
  const perRow = Math.ceil(count / rowCount);
  const rowHeight = (HEIGHT - headerHeight) / rowCount;

  const parts = [];
  const place = (i) => {
    const row = Math.floor(i / perRow);
    const inRow = row === rowCount - 1 ? count - perRow * row : perRow;
    return { row, w: WIDTH / inRow };
  };
  // One time size for the whole image: the smallest any cell needs
  const size = Math.min(
    ...zones.map((z, i) => fit(cellLines(z, event), place(i).w, rowHeight).size),
  );
  const shared = {
    size,
    nameSize: Math.min(Math.max(size * 0.4, 30), 60),
    noteSize: Math.min(Math.max(size * 0.26, 23), 34),
  };
  zones.forEach((z, i) => {
    const { row, w } = place(i);
    parts.push(
      cell(
        z,
        event,
        i,
        (i - row * perRow) * w,
        headerHeight + row * rowHeight,
        w,
        rowHeight,
        shared,
      ),
    );
  });
  if (more) {
    const inRow = count - perRow * (rowCount - 1);
    const w = WIDTH / inRow;
    const x = (inRow - 1) * w;
    const y = headerHeight + (rowCount - 1) * rowHeight;
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${rowHeight}" fill="${HEADER_FILL}"/>` +
        `<text x="${x + w / 2}" y="${y + rowHeight / 2 + 16}" text-anchor="middle" font-family="Inter" font-size="46" font-weight="500" fill="#ffffff" fill-opacity="0.8">+${more} more</text>`,
    );
  }

  const markSize = 24;
  if (headerHeight) {
    const pad = 56;
    const markWidth = textWidth("timezone.fyi", 500, markSize);
    parts.push(`<rect width="${WIDTH}" height="${headerHeight}" fill="${HEADER_FILL}"/>`);
    parts.push(`<g font-family="Inter" fill="#ffffff">`);
    if (label) {
      const size = 62;
      const text = truncate(label, 700, size, WIDTH - pad * 3 - markWidth);
      parts.push(
        `<text x="${pad}" y="${dateLine ? 84 : 86}" font-size="${size}" font-weight="700">${xml(text)}</text>`,
      );
      if (dateLine) {
        parts.push(
          `<text x="${pad}" y="134" font-size="32" font-weight="500" fill-opacity="0.72">${xml(dateLine)}</text>`,
        );
      }
    } else {
      parts.push(
        `<text x="${pad}" y="58" font-size="34" font-weight="500" fill-opacity="0.9">${xml(dateLine)}</text>`,
      );
    }
    parts.push(
      `<text x="${WIDTH - pad}" y="${label ? 80 : 56}" text-anchor="end" font-size="${markSize}" font-weight="500" fill-opacity="0.5">timezone.fyi</text></g>`,
    );
  } else {
    // No header: the name sits in the last cell's bottom corner
    const corner = event.zones[Math.min(event.zones.length, perRow * rowCount) - 1];
    const last = skyAt(corner?.minutes ?? 0, corner?.sun);
    parts.push(
      `<text x="${WIDTH - 32}" y="${HEIGHT - 30}" text-anchor="end" font-family="Inter" font-size="${markSize}" font-weight="500" ` +
        `fill="${more || last.dark ? "#ffffff" : INK_DARK}" fill-opacity="0.55">timezone.fyi</text>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${HEADER_FILL}"/>${parts.join("")}</svg>`
  );
}

// The image for the home page and for links that don't parse: the 24 hours of
// the sky gradient as drawn (no place, no season), the name and the tagline.
export function homeCard() {
  const w = WIDTH / 24;
  const stripes = SKY.map((_, i) => skyAt(i * 60))
    .map(
      (sky, i) =>
        diagonal(`h${i}`, i * w, 0, w, HEIGHT, sky.topP3Hex, sky.bottomP3Hex) +
        `<rect x="${i * w}" width="${w + 0.5}" height="${HEIGHT}" fill="url(#h${i})"/>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${stripes}` +
    // No panel behind the name: it sits on the stripes, with a soft shadow
    // so it reads on the pale midday ones too
    `<filter id="lift" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="10" flood-color="#000000" flood-opacity="0.35"/></filter>` +
    `<g font-family="Inter" fill="#ffffff" text-anchor="middle" filter="url(#lift)">` +
    `<text x="600" y="312" font-size="84" font-weight="700">timezone.fyi</text>` +
    `<text x="600" y="372" font-size="32" font-weight="500">Share your time with friends across zones.</text></g></svg>`
  );
}
