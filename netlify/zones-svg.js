/**
 * The Open Graph card for a timezone comparison, as an SVG string.
 *
 * Replaces the node-canvas drawing in netlify/functions/og.js and the disabled
 * Deno/Satori attempt in netlify/edge-functions/og.tsx. Rasterizing is done by
 * the shared renderer: https://github.com/arfct/og-svg
 *
 * One column per zone, filled with the same top-to-bottom gradient the canvas
 * version used, with the zone name above centre and the local time below.
 */

import { colors } from "./common.js";

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {{ zones?: Array<{ zoneStart: any, niceZoneName: string, startString: string, night: string }> }} info
 * @returns {string} an SVG document
 */
export function zonesSvg(info) {
  const zones = info?.zones ?? [];

  if (!zones.length) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
      `<rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>` +
      `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" text-anchor="middle" ` +
      `font-family="Manrope" font-size="72" fill="#333">timezone.fyi</text>` +
      `</svg>`
    );
  }

  const columnWidth = WIDTH / zones.length;
  const fontSize = columnWidth / 5;

  const gradients = zones
    .map((z, i) => {
      const hour = z.zoneStart.hour();
      return (
        `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${colors[hour * 2]}"/>` +
        `<stop offset="1" stop-color="${colors[hour * 2 + 1]}"/>` +
        `</linearGradient>`
      );
    })
    .join("");

  const columns = zones
    .map((z, i) => {
      const x = columnWidth * i;
      const centre = x + columnWidth / 2;
      // The canvas version drew white text on night columns, black on day.
      const fill = z.night ? "white" : "black";
      return (
        `<rect x="${x}" y="0" width="${columnWidth}" height="${HEIGHT}" fill="url(#g${i})"/>` +
        `<text x="${centre}" y="${HEIGHT / 2 - fontSize / 2}" text-anchor="middle" ` +
        `font-family="Manrope" font-size="${fontSize / 1.5}" fill="${fill}" ` +
        `fill-opacity="0.65">${escapeXml(z.niceZoneName)}</text>` +
        `<text x="${centre}" y="${HEIGHT / 2 + fontSize}" text-anchor="middle" ` +
        `font-family="Manrope" font-size="${fontSize}" font-weight="700" fill="${fill}" ` +
        `fill-opacity="0.9">${escapeXml(z.startString)}</text>`
      );
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<defs>${gradients}</defs>` +
    columns +
    `</svg>`
  );
}
